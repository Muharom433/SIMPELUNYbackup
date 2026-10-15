-- ─────────────────────────────────────────────────────────────────
-- Fix RLS policy UPDATE untuk tabel lecturer_attendance
-- 
-- MASALAH: Policy "Update attendance verification" tidak punya
-- WITH CHECK clause. Supabase memerlukan BOTH USING dan WITH CHECK
-- untuk operasi UPDATE — tanpa WITH CHECK, update silently gagal
-- (error: null, rows updated: 0).
--
-- Referensi: https://www.postgresql.org/docs/current/sql-createpolicy.html
-- ─────────────────────────────────────────────────────────────────

-- Drop policy lama yang tidak punya WITH CHECK
DROP POLICY IF EXISTS "Update attendance verification" ON lecturer_attendance;

-- Buat ulang dengan WITH CHECK yang benar
CREATE POLICY "Update attendance verification"
    ON lecturer_attendance
    FOR UPDATE
    TO authenticated
    USING (
        -- Siapa yang boleh melihat/memilih baris untuk diupdate
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('finance', 'super_admin', 'admin')
        )
    )
    WITH CHECK (
        -- Kondisi baris setelah diupdate (harus sama agar tidak di-reject)
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('finance', 'super_admin', 'admin')
        )
    );
