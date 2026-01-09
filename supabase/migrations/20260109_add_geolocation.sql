-- =====================================================
-- Migration: Add Geolocation Columns to Campus Table
-- Date: 2026-01-09
-- Description: Menambahkan kolom latitude dan longitude ke tabel campus
--              untuk validasi lokasi presensi dosen
-- =====================================================

-- Tambahkan kolom-kolom untuk geolokasi kampus
ALTER TABLE campus 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 1000;

-- Komentar untuk dokumentasi
COMMENT ON COLUMN campus.latitude IS 'Latitude koordinat GPS lokasi kampus';
COMMENT ON COLUMN campus.longitude IS 'Longitude koordinat GPS lokasi kampus';
COMMENT ON COLUMN campus.radius_meters IS 'Radius yang diizinkan untuk presensi dalam meter (default 1000m = 1km)';

-- Contoh cara mengisi data (uncomment dan sesuaikan koordinat):
-- UPDATE campus SET latitude = -7.773456, longitude = 110.386328, radius_meters = 1000 WHERE name = 'Kampus UNY';

-- Catatan untuk USER:
-- Untuk mendapatkan koordinat dari Google Maps:
-- 1. Buka Google Maps
-- 2. Klik kanan di lokasi kampus
-- 3. Klik koordinat yang muncul (akan ter-copy)
-- 4. Format: -7.773456, 110.386328 (latitude, longitude)
