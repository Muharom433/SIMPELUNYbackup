-- =====================================================
-- Migration: Lecturer Attendance Details
-- Date: 2026-01-09
-- Description: Tabel untuk menyimpan detail jadwal/kegiatan per presensi dosen
--              Mendukung multiple jadwal per presensi (dosen bisa 5 matkul sehari)
--              Data denormalisasi agar tetap utuh walau jadwal asli dihapus
-- =====================================================

-- Create lecturer_attendance_details table
CREATE TABLE IF NOT EXISTS lecturer_attendance_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_id UUID NOT NULL REFERENCES lecturer_attendance(id) ON DELETE CASCADE,
    
    -- Tipe kegiatan: 'mengajar' atau 'sidang' atau 'lainnya'
    activity_type VARCHAR(20) NOT NULL DEFAULT 'mengajar',
    
    -- ========== Untuk MENGAJAR (Jadwal Kuliah) ==========
    -- Data denormalisasi dari lecture_schedules (TIDAK pakai FK karena bisa dihapus tiap semester)
    course_name VARCHAR(255),                -- Nama mata kuliah
    course_code VARCHAR(50),                 -- Kode mata kuliah (jika ada)
    study_program_name VARCHAR(255),         -- Nama program studi
    class_group VARCHAR(50),                 -- Rombel (A, B, C, dll)
    semester VARCHAR(50),                    -- Semester (contoh: "Ganjil 2025/2026")
    academic_year VARCHAR(20),               -- Tahun akademik (contoh: "2025/2026")
    
    -- ========== Untuk SIDANG ==========
    -- ID sidang (tanpa FK constraint karena tabel mungkin tidak ada)
    -- Data tetap disimpan secara denormalisasi sehingga aman
    session_schedule_id UUID,  -- No FK constraint
    student_name VARCHAR(255),               -- Nama mahasiswa yang disidang
    student_nim VARCHAR(50),                 -- NIM mahasiswa
    session_type VARCHAR(100),               -- Jenis sidang (Skripsi, Tesis, dll)
    role_in_session VARCHAR(50),             -- 'supervisor'/'examiner'/'secretary' (Pembimbing/Penguji/Sekretaris)
    
    -- ========== Data Jadwal Umum ==========
    scheduled_date DATE,                     -- Tanggal jadwal
    start_time TIME,                         -- Waktu mulai
    end_time TIME,                           -- Waktu selesai
    room_name VARCHAR(255),                  -- Nama ruangan
    
    -- ========== Metadata ==========
    notes TEXT,                              -- Catatan tambahan
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_details_attendance_id 
    ON lecturer_attendance_details(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_details_activity_type 
    ON lecturer_attendance_details(activity_type);
CREATE INDEX IF NOT EXISTS idx_attendance_details_session_id 
    ON lecturer_attendance_details(session_schedule_id);

-- Enable RLS
ALTER TABLE lecturer_attendance_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all authenticated users to read, finance and super_admin can write
CREATE POLICY "Allow read for authenticated users" ON lecturer_attendance_details
    FOR SELECT USING (true);

CREATE POLICY "Allow insert for authenticated users" ON lecturer_attendance_details
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for finance and super_admin" ON lecturer_attendance_details
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('finance', 'super_admin')
        )
    );

CREATE POLICY "Allow delete for super_admin" ON lecturer_attendance_details
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'super_admin'
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_attendance_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_attendance_details_updated_at
    BEFORE UPDATE ON lecturer_attendance_details
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_details_updated_at();

-- Add helpful comments
COMMENT ON TABLE lecturer_attendance_details IS 'Detail jadwal/kegiatan per presensi dosen. Mendukung multiple entry per presensi.';
COMMENT ON COLUMN lecturer_attendance_details.activity_type IS 'Tipe kegiatan: mengajar, sidang, atau lainnya';
COMMENT ON COLUMN lecturer_attendance_details.course_name IS 'Nama mata kuliah (denormalisasi, aman dari hapus jadwal)';
COMMENT ON COLUMN lecturer_attendance_details.session_schedule_id IS 'FK ke session_schedules (opsional, untuk sidang)';
COMMENT ON COLUMN lecturer_attendance_details.role_in_session IS 'Peran dosen dalam sidang: supervisor/examiner/secretary';
