-- ============================================================
-- FIX FINAL: equipment_mutations - Complete Setup & RLS Fix
-- Dibuat: 2026-07-20
-- Cara pakai: Copy semua isi file ini, paste di Supabase SQL Editor
-- URL: https://supabase.com/dashboard > Project > SQL Editor > New Query
-- ============================================================

-- ============================================================
-- STEP 1: Pastikan extension uuid-ossp ada
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STEP 2: Buat tabel equipment_mutations jika belum ada
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipment_mutations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    previous_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    new_room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    pic_name TEXT NOT NULL,
    pic_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STEP 3: Tambah kolom pic_phone jika belum ada (backward compat)
-- ============================================================
ALTER TABLE public.equipment_mutations ADD COLUMN IF NOT EXISTS pic_phone TEXT;

-- ============================================================
-- STEP 4: Buat index untuk performa query
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_created_at
    ON public.equipment_mutations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_equipment_id
    ON public.equipment_mutations (equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_new_room_id
    ON public.equipment_mutations (new_room_id);
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_previous_room_id
    ON public.equipment_mutations (previous_room_id);

-- ============================================================
-- STEP 5: Enable RLS
-- ============================================================
ALTER TABLE public.equipment_mutations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6: Hapus SEMUA policy lama yang mungkin conflict
-- (menggunakan DO block untuk menghapus semua policy sekaligus)
-- ============================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE tablename = 'equipment_mutations' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.equipment_mutations', pol.policyname);
    END LOOP;
END $$;

-- ============================================================
-- STEP 7: Buat RLS policy baru yang benar
-- ============================================================

-- SELECT: authenticated users bisa melihat semua record
CREATE POLICY "em_select_authenticated"
    ON public.equipment_mutations
    FOR SELECT TO authenticated
    USING (true);

-- SELECT: anon users juga bisa melihat (untuk form publik)
CREATE POLICY "em_select_anon"
    ON public.equipment_mutations
    FOR SELECT TO anon
    USING (true);

-- INSERT: authenticated users bisa insert
CREATE POLICY "em_insert_authenticated"
    ON public.equipment_mutations
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- INSERT: anon users bisa insert (form publik /item-mutation tidak perlu login)
CREATE POLICY "em_insert_anon"
    ON public.equipment_mutations
    FOR INSERT TO anon
    WITH CHECK (true);

-- UPDATE: hanya authenticated users
CREATE POLICY "em_update_authenticated"
    ON public.equipment_mutations
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE: hanya super_admin dan laboratory
CREATE POLICY "em_delete_admin"
    ON public.equipment_mutations
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('super_admin', 'laboratory')
        )
    );

-- ============================================================
-- STEP 8: Grant permissions eksplisit ke role anon & authenticated
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.equipment_mutations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_mutations TO authenticated;

-- ============================================================
-- STEP 9: Fix equipment table - pastikan anon bisa INSERT & UPDATE
-- (diperlukan saat form memindahkan barang atau buat barang baru)
-- ============================================================
DO $$
BEGIN
    DROP POLICY IF EXISTS "equipment_update_anon" ON public.equipment;
    DROP POLICY IF EXISTS "Anyone can update equipment" ON public.equipment;
    DROP POLICY IF EXISTS "allow_authenticated_update_equipment" ON public.equipment;
    DROP POLICY IF EXISTS "em_equipment_insert_anon" ON public.equipment;
    DROP POLICY IF EXISTS "em_equipment_update_anon" ON public.equipment;

    CREATE POLICY "em_equipment_insert_anon"
        ON public.equipment
        FOR INSERT TO anon, authenticated
        WITH CHECK (true);

    CREATE POLICY "em_equipment_update_anon"
        ON public.equipment
        FOR UPDATE TO anon, authenticated
        USING (true)
        WITH CHECK (true);
END $$;

-- ============================================================
-- STEP 10: Fix rooms table - pastikan anon bisa INSERT room baru
-- (fitur "Cari atau ketik ruangan baru" di form)
-- ============================================================
DO $$
BEGIN
    DROP POLICY IF EXISTS "rooms_insert_anon" ON public.rooms;
    DROP POLICY IF EXISTS "Anyone can insert rooms" ON public.rooms;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'rooms'
        AND schemaname = 'public'
        AND policyname = 'em_rooms_insert_anon'
    ) THEN
        CREATE POLICY "em_rooms_insert_anon"
            ON public.rooms
            FOR INSERT TO anon
            WITH CHECK (true);
    END IF;
END $$;

-- ============================================================
-- STEP 11: Reload PostgREST schema cache agar perubahan langsung aktif
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- STEP 12: Verifikasi - tampilkan struktur tabel & policy yang aktif
-- ============================================================
SELECT
    'COLUMNS' as info_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'equipment_mutations'
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT
    'POLICIES' as info_type,
    policyname,
    cmd,
    roles::text
FROM pg_policies
WHERE tablename = 'equipment_mutations'
AND schemaname = 'public'
ORDER BY policyname;
