-- ============================================================
-- JALANKAN SQL INI DI SUPABASE SQL EDITOR
-- Untuk menambahkan kolom yang dibutuhkan ke tabel users
-- ============================================================

-- Tambah kolom pangkat_golongan (pangkat/golongan untuk dosen)
ALTER TABLE users ADD COLUMN IF NOT EXISTS pangkat_golongan TEXT;

-- Tambah kolom address (alamat untuk dosen)
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

-- Verifikasi kolom yang sudah ada di tabel users
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
