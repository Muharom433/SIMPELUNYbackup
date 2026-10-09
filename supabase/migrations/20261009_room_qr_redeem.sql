-- Migration: Room QR Redeem and Dynamic Token Rotation
-- Date: 2026-10-09
-- Description:
--   1. Create room_qr_tokens table (secret tokens, RLS enabled, no public access)
--   2. Create room_qr_redeem_log table (audit log for redeems, no old tokens stored)
--   3. Helper function is_user_allowed_to_manage_room for centralized role & scoping checks
--   4. RPC redeem_room_qr: Re-authenticates caller password, generates new 32-byte secret token, invalidates old QR
--   5. RPC get_room_qr_payload: Fetches QR string for modal (prefixed secured token or legacy UUID)
--   6. RPC get_room_qr_statuses: Bulk status check (legacy/secured, version, rotated_at) for badges
--   7. RPC resolve_room_qr: Validates scanned QR for attendance (supports gradual migration per room)
--
-- Note on Custom Auth Architecture:
--   SIMPEL uses a custom public.users table rather than Supabase Auth JWTs. All frontend requests
--   arrive under the Postgres 'anon' role, and auth.uid() is NULL. Consequently:
--   - Functions resolve caller as COALESCE(auth.uid(), p_user_id).
--   - Sensitive action redeem_room_qr requires p_password and re-verifies it via verify_password().
--   - get_room_qr_payload and get_room_qr_statuses accept p_user_id; limitations documented below.
--   - Functions are explicitly GRANTed to anon, authenticated after REVOKE from PUBLIC.

-- ==============================================================================
-- 1. TABLE: room_qr_tokens
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.room_qr_tokens (
    room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    version INTEGER NOT NULL DEFAULT 1,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    rotated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.room_qr_tokens IS 'Stores active secret QR tokens per room. Never expose directly to clients.';
COMMENT ON COLUMN public.room_qr_tokens.token IS 'Cryptographically secure 32-byte hex token for room QR validation.';
COMMENT ON COLUMN public.room_qr_tokens.version IS 'Incrementing rotation counter (starts at 1 upon first redeem).';

-- Enable RLS and do NOT create any policies for anon/authenticated (strict RPC access only)
ALTER TABLE public.room_qr_tokens ENABLE ROW LEVEL SECURITY;

-- Ensure table is excluded from supabase_realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.room_qr_tokens;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 2. TABLE: room_qr_redeem_log
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.room_qr_redeem_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    old_version INTEGER,
    new_version INTEGER NOT NULL,
    redeemed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.room_qr_redeem_log IS 'Audit trail for QR rotations. Does NOT store tokens.';

-- Enable RLS and do NOT create any policies for anon/authenticated (strict RPC access only)
ALTER TABLE public.room_qr_redeem_log ENABLE ROW LEVEL SECURITY;

-- Ensure table is excluded from supabase_realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.room_qr_redeem_log;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 3. HELPER FUNCTION: is_user_allowed_to_manage_room
-- Centralized role and department scoping checks:
-- Allowed roles: super_admin, department_admin, laboratory. Denies staffing & others.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_user_allowed_to_manage_room(
    p_user_id UUID,
    p_room_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_user_dept_id UUID;
    v_user_prodi_id UUID;
    v_room_dept_id UUID;
    v_room_prodi_ids UUID[];
BEGIN
    IF p_user_id IS NULL OR p_room_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Look up caller in public.users
    SELECT role, department_id, study_program_id
    INTO v_role, v_user_dept_id, v_user_prodi_id
    FROM public.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Allowed roles: super_admin, department_admin, laboratory (staffing and others denied)
    IF v_role NOT IN ('super_admin', 'department_admin', 'laboratory') THEN
        RETURN FALSE;
    END IF;

    -- super_admin has access to manage all rooms
    IF v_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    -- Fetch room details for scoping check
    SELECT department_id, study_program_ids
    INTO v_room_dept_id, v_room_prodi_ids
    FROM public.rooms
    WHERE id = p_room_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- department_admin scoping: room department must match caller department
    IF v_role = 'department_admin' THEN
        RETURN (v_user_dept_id IS NOT NULL AND v_room_dept_id = v_user_dept_id);
    END IF;

    -- laboratory scoping:
    -- 1. Room department matches laboran department, OR
    -- 2. Room department is NULL (general) AND laboran study program matches room study_program_ids
    IF v_role = 'laboratory' THEN
        IF v_user_dept_id IS NOT NULL AND v_room_dept_id = v_user_dept_id THEN
            RETURN TRUE;
        END IF;
        IF v_room_dept_id IS NULL AND v_user_prodi_id IS NOT NULL
           AND v_user_prodi_id = ANY(COALESCE(v_room_prodi_ids, ARRAY[]::uuid[])) THEN
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END IF;

    RETURN FALSE;
END;
$$;

-- ==============================================================================
-- 4. RPC: redeem_room_qr
-- Re-authenticates caller password, generates new 32-byte secret token,
-- updates version, and logs rotation.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.redeem_room_qr(
    p_room_id UUID,
    p_user_id UUID,
    p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_user RECORD;
    v_raw_token TEXT;
    v_full_payload TEXT;
    v_old_version INTEGER;
    v_new_version INTEGER;
BEGIN
    -- Resolve caller
    v_caller_id := COALESCE(auth.uid(), p_user_id);

    -- Authentication check: user must exist and password must verify
    IF v_caller_id IS NULL OR p_password IS NULL OR length(trim(p_password)) = 0 THEN
        RAISE EXCEPTION 'Authentication failed';
    END IF;

    SELECT * INTO v_user FROM public.users WHERE id = v_caller_id;
    IF NOT FOUND OR NOT public.verify_password(p_password, v_user.password) THEN
        -- Generic error: never reveal whether user exists or password was incorrect
        RAISE EXCEPTION 'Authentication failed';
    END IF;

    -- Authorization check
    IF NOT public.is_user_allowed_to_manage_room(v_caller_id, p_room_id) THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to manage this room';
    END IF;

    -- Lock room record to prevent race conditions
    PERFORM 1 FROM public.rooms WHERE id = p_room_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found';
    END IF;

    -- Generate cryptographically random token (32 bytes = 64 hex characters)
    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_full_payload := 'simpel:room:v1:' || v_raw_token;

    -- Upsert room_qr_tokens
    SELECT version INTO v_old_version FROM public.room_qr_tokens WHERE room_id = p_room_id FOR UPDATE;
    IF FOUND THEN
        v_new_version := v_old_version + 1;
        UPDATE public.room_qr_tokens
        SET token = v_raw_token,
            version = v_new_version,
            rotated_at = now(),
            rotated_by = v_caller_id
        WHERE room_id = p_room_id;
    ELSE
        v_old_version := 0;
        v_new_version := 1;
        INSERT INTO public.room_qr_tokens (room_id, token, version, rotated_at, rotated_by)
        VALUES (p_room_id, v_raw_token, v_new_version, now(), v_caller_id);
    END IF;

    -- Record in redeem audit log
    INSERT INTO public.room_qr_redeem_log (room_id, old_version, new_version, redeemed_by, redeemed_at)
    VALUES (p_room_id, v_old_version, v_new_version, v_caller_id, now());

    RETURN json_build_object(
        'payload', v_full_payload,
        'version', v_new_version,
        'rotated_at', now(),
        'mode', 'secured'
    );
END;
$$;

-- ==============================================================================
-- 5. RPC: get_room_qr_payload
-- Fetches the QR string to display in the modal:
-- - Secured room: 'simpel:room:v1:<token>'
-- - Legacy room: room.id (UUID string)
-- Limitation: p_user_id is client-supplied (see header comment regarding custom auth).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_room_qr_payload(
    p_room_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_token TEXT;
    v_version INTEGER;
    v_rotated_at TIMESTAMPTZ;
BEGIN
    v_caller_id := COALESCE(auth.uid(), p_user_id);

    IF v_caller_id IS NULL OR NOT public.is_user_allowed_to_manage_room(v_caller_id, p_room_id) THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to view QR payload for this room';
    END IF;

    SELECT token, version, rotated_at
    INTO v_token, v_version, v_rotated_at
    FROM public.room_qr_tokens
    WHERE room_id = p_room_id;

    IF FOUND THEN
        RETURN json_build_object(
            'payload', 'simpel:room:v1:' || v_token,
            'mode', 'secured',
            'version', v_version,
            'rotated_at', v_rotated_at
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room_id) THEN
            RAISE EXCEPTION 'Room not found';
        END IF;

        RETURN json_build_object(
            'payload', p_room_id::text,
            'mode', 'legacy',
            'version', 0,
            'rotated_at', NULL
        );
    END IF;
END;
$$;

-- ==============================================================================
-- 6. RPC: get_room_qr_statuses
-- Returns room_id, mode ('legacy' | 'secured'), version, rotated_at
-- for all rooms the caller is allowed to manage (avoids N+1 queries).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_room_qr_statuses(
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    room_id UUID,
    mode TEXT,
    version INTEGER,
    rotated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_role TEXT;
    v_user_dept_id UUID;
    v_user_prodi_id UUID;
BEGIN
    v_caller_id := COALESCE(auth.uid(), p_user_id);

    IF v_caller_id IS NULL THEN
        RETURN;
    END IF;

    SELECT role, department_id, study_program_id
    INTO v_role, v_user_dept_id, v_user_prodi_id
    FROM public.users
    WHERE id = v_caller_id;

    IF NOT FOUND OR v_role NOT IN ('super_admin', 'department_admin', 'laboratory') THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        r.id AS room_id,
        CASE WHEN t.token IS NOT NULL THEN 'secured'::text ELSE 'legacy'::text END AS mode,
        COALESCE(t.version, 0) AS version,
        t.rotated_at
    FROM public.rooms r
    LEFT JOIN public.room_qr_tokens t ON t.room_id = r.id
    WHERE
        v_role = 'super_admin'
        OR (v_role = 'department_admin' AND r.department_id = v_user_dept_id)
        OR (v_role = 'laboratory' AND (
            r.department_id = v_user_dept_id
            OR (r.department_id IS NULL AND v_user_prodi_id = ANY(COALESCE(r.study_program_ids, ARRAY[]::uuid[])))
        ));
END;
$$;

-- ==============================================================================
-- 7. RPC: resolve_room_qr
-- Validates scanned QR text.
-- Returns room_id, name, and status_code:
--   'VALID': Scanned code is valid (active token or legacy unredeemed UUID)
--   'OUTDATED': Scanned code is a legacy UUID for a room that has been redeemed
-- Safe against arbitrary/garbage inputs without throwing casting errors.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.resolve_room_qr(
    p_scanned TEXT
)
RETURNS TABLE (
    room_id UUID,
    name TEXT,
    status_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_text TEXT;
    v_token_val TEXT;
    v_uuid_val UUID;
    v_room_id UUID;
    v_room_name TEXT;
BEGIN
    IF p_scanned IS NULL THEN
        RETURN;
    END IF;

    v_clean_text := trim(p_scanned);
    IF length(v_clean_text) = 0 THEN
        RETURN;
    END IF;

    -- 1. Check for secured token prefix
    IF v_clean_text LIKE 'simpel:room:v1:%' THEN
        v_token_val := substring(v_clean_text from 16);
        RETURN QUERY
        SELECT r.id AS room_id, r.name, 'VALID'::text AS status_code
        FROM public.room_qr_tokens t
        JOIN public.rooms r ON r.id = t.room_id
        WHERE t.token = v_token_val;
        RETURN;
    END IF;

    -- 2. Check for UUID format (safe regex test before cast)
    IF v_clean_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_uuid_val := v_clean_text::uuid;

        SELECT r.id, r.name INTO v_room_id, v_room_name
        FROM public.rooms r
        WHERE r.id = v_uuid_val;

        IF FOUND THEN
            -- Check if this room has already been secured/redeemed
            IF EXISTS (SELECT 1 FROM public.room_qr_tokens WHERE room_id = v_uuid_val) THEN
                -- Legacy QR is rejected because the room was secured
                RETURN QUERY SELECT v_room_id, v_room_name, 'OUTDATED'::text AS status_code;
            ELSE
                -- Legacy room that has never been redeemed: accept UUID
                RETURN QUERY SELECT v_room_id, v_room_name, 'VALID'::text AS status_code;
            END IF;
            RETURN;
        END IF;
    END IF;

    -- Any other input returns no rows (empty set)
    RETURN;
END;
$$;

-- ==============================================================================
-- 8. PERMISSIONS & GRANTS
-- ==============================================================================
REVOKE ALL ON FUNCTION public.is_user_allowed_to_manage_room(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_allowed_to_manage_room(UUID, UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.redeem_room_qr(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_room_qr(UUID, UUID, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_room_qr_payload(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_room_qr_payload(UUID, UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_room_qr_statuses(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_room_qr_statuses(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.resolve_room_qr(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_room_qr(TEXT) TO anon, authenticated;

-- ==============================================================================
-- ROLLBACK INSTRUCTIONS (DOWN MIGRATION)
-- To revert these changes, run the following in Supabase SQL editor:
--
-- DROP FUNCTION IF EXISTS public.resolve_room_qr(TEXT);
-- DROP FUNCTION IF EXISTS public.get_room_qr_statuses(UUID);
-- DROP FUNCTION IF EXISTS public.get_room_qr_payload(UUID, UUID);
-- DROP FUNCTION IF EXISTS public.redeem_room_qr(UUID, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.is_user_allowed_to_manage_room(UUID, UUID);
-- DROP TABLE IF EXISTS public.room_qr_redeem_log CASCADE;
-- DROP TABLE IF EXISTS public.room_qr_tokens CASCADE;
-- ==============================================================================
