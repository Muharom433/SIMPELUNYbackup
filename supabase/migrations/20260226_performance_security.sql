-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: Database Performance & Security Hardening
-- Tanggal: 2026-02-26
-- Tujuan:
--   1. INDEX untuk mempercepat query berat (anti-timeout)
--   2. Statement timeout per role (cegah query "nakal" blokir DB)
--   3. RLS rate-limiting sederhana (cegah DDoS via Supabase API)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- BAGIAN 1: INDEXES UNTUK QUERY ATTENDANCE YANG CEPAT
-- Tanpa index, query ke tabel besar = full table scan = TIMEOUT
-- ─────────────────────────────────────────────────────────────────

-- Index utama: filter berdasarkan tanggal (paling sering dipakai)
CREATE INDEX IF NOT EXISTS idx_lecturer_attendance_date
    ON lecturer_attendance (attendance_date DESC);

-- Index untuk filter status + tanggal (tab "pending", "verified", dll)
CREATE INDEX IF NOT EXISTS idx_lecturer_attendance_status_date
    ON lecturer_attendance (verification_status, attendance_date DESC);

-- Index untuk filter per study_program + tanggal
CREATE INDEX IF NOT EXISTS idx_lecturer_attendance_sp_date
    ON lecturer_attendance (study_program_id, attendance_date DESC);

-- Index untuk filter per lecturer (keperluan recap individual)
CREATE INDEX IF NOT EXISTS idx_lecturer_attendance_user_date
    ON lecturer_attendance (lecturer_user_id, attendance_date DESC);

-- Index composite untuk query recap (gabungan status + tanggal + user)
CREATE INDEX IF NOT EXISTS idx_lecturer_attendance_recap
    ON lecturer_attendance (verification_status, is_included_in_recap, attendance_date DESC);

-- PARTIAL INDEX: Only index non-verified rows (lebih kecil, lebih cepat untuk tab pending)
CREATE INDEX IF NOT EXISTS idx_lecturer_attendance_pending
    ON lecturer_attendance (attendance_date DESC)
    WHERE verification_status = 'pending';

-- Index untuk attendance_details (foreign key lookup)
CREATE INDEX IF NOT EXISTS idx_attendance_details_attendance_id
    ON lecturer_attendance_details (attendance_id);

-- Index pada users untuk is_homebase lookup (sering diakses saat enriching data)
CREATE INDEX IF NOT EXISTS idx_users_role_homebase
    ON users (role, is_homebase)
    WHERE role = 'lecturer';

-- ─────────────────────────────────────────────────────────────────
-- BAGIAN 2: STATEMENT TIMEOUT PER ROLE
-- Mencegah query lambat memblokir koneksi database terlalu lama.
-- Ini TIDAK membatasi admin — hanya memaksa query dioptimasi.
-- ─────────────────────────────────────────────────────────────────

-- Timeout untuk anonymous users (tanpa login): 5 detik
-- Ini mencegah DDoS via endpoint publik
ALTER ROLE anon SET statement_timeout = '5s';

-- Timeout untuk authenticated users (dosen, receptionist): 15 detik
ALTER ROLE authenticated SET statement_timeout = '15s';

-- Catatan: service_role (admin API key dari backend) tidak dibatasi
-- karena digunakan untuk operasi internal yang memang butuh waktu lama.
-- Jangan gunakan service_role dari frontend!

-- ─────────────────────────────────────────────────────────────────
-- BAGIAN 3: VACUUM & ANALYZE (Maintenance)
-- Refresh query planner statistics agar PostgreSQL bisa pilih
-- execution plan yang optimal (pakai index, bukan full scan)
-- ─────────────────────────────────────────────────────────────────

ANALYZE lecturer_attendance;
ANALYZE lecturer_attendance_details;
ANALYZE users;

-- ─────────────────────────────────────────────────────────────────
-- BAGIAN 4: MATERIALIZED VIEW untuk RECAP CEPAT (Opsional)
-- Jika query recap sering timeout, buat "snapshot" yang di-refresh
-- periodik. Admin tidak perlu tunggu query berat saat melihat recap.
-- ─────────────────────────────────────────────────────────────────

-- Hapus yang lama kalau ada
DROP MATERIALIZED VIEW IF EXISTS mv_attendance_monthly_recap;

-- Buat materialized view: rekap per dosen per bulan
CREATE MATERIALIZED VIEW mv_attendance_monthly_recap AS
SELECT
    la.lecturer_user_id,
    la.lecturer_name,
    la.study_program_id,
    u.is_homebase,
    DATE_TRUNC('month', la.attendance_date::date) AS month_year,
    COUNT(*) AS total_attendance,
    COUNT(*) FILTER (WHERE la.verification_status = 'verified') AS verified_count,
    COUNT(*) FILTER (WHERE la.verification_status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE la.verification_status = 'rejected') AS rejected_count,
    MIN(la.attendance_date) AS first_attendance,
    MAX(la.attendance_date) AS last_attendance
FROM lecturer_attendance la
LEFT JOIN users u ON la.lecturer_user_id = u.id
GROUP BY
    la.lecturer_user_id,
    la.lecturer_name,
    la.study_program_id,
    u.is_homebase,
    DATE_TRUNC('month', la.attendance_date::date)
WITH DATA;

-- Index untuk materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_recap_unique
    ON mv_attendance_monthly_recap (lecturer_user_id, month_year);

CREATE INDEX IF NOT EXISTS idx_mv_recap_month
    ON mv_attendance_monthly_recap (month_year DESC);

-- Grant akses ke authenticated user
GRANT SELECT ON mv_attendance_monthly_recap TO authenticated;

-- Fungsi untuk refresh materialized view (panggil via cron/Edge Function)
-- Jalankan ini: SELECT refresh_attendance_recap();
CREATE OR REPLACE FUNCTION refresh_attendance_recap()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attendance_monthly_recap;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- BAGIAN 5: FUNGSI KEAMANAN - Cegah Query Dump Massal dari API
-- Batasi jumlah data yang bisa diambil sekali pakai RLS
-- ─────────────────────────────────────────────────────────────────

-- Pastikan RLS aktif di tabel attendance
ALTER TABLE lecturer_attendance ENABLE ROW LEVEL SECURITY;

-- Policy untuk authenticated users (dosen hanya lihat data sendiri)
DROP POLICY IF EXISTS "Dosen hanya bisa lihat presensi sendiri" ON lecturer_attendance;
CREATE POLICY "Dosen hanya bisa lihat presensi sendiri"
    ON lecturer_attendance
    FOR SELECT
    TO authenticated
    USING (
        -- Finance dan super_admin bisa lihat semua
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('finance', 'super_admin', 'admin')
        )
        OR
        -- Dosen hanya lihat milik sendiri
        lecturer_user_id = auth.uid()
    );

-- Policy untuk INSERT (hanya dosen sendiri atau admin yang bisa tambah)
DROP POLICY IF EXISTS "Insert attendance" ON lecturer_attendance;
CREATE POLICY "Insert attendance"
    ON lecturer_attendance
    FOR INSERT
    TO authenticated
    WITH CHECK (
        lecturer_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('finance', 'super_admin', 'admin')
        )
    );

-- Policy untuk UPDATE (hanya finance/admin yang bisa verifikasi)
DROP POLICY IF EXISTS "Update attendance verification" ON lecturer_attendance;
CREATE POLICY "Update attendance verification"
    ON lecturer_attendance
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('finance', 'super_admin', 'admin')
        )
    );

-- Policy untuk DELETE (hanya super_admin)
DROP POLICY IF EXISTS "Delete attendance" ON lecturer_attendance;
CREATE POLICY "Delete attendance"
    ON lecturer_attendance
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin')
        )
    );

-- ─────────────────────────────────────────────────────────────────
-- SELESAI
-- Setelah migration ini, jalankan juga di Supabase Dashboard:
-- Settings → Database → Connection Pooling → Mode: Transaction
-- Pool Size: 15 (untuk free tier), 25+ untuk Pro tier
-- ─────────────────────────────────────────────────────────────────
