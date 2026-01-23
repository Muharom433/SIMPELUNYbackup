-- =====================================================
-- Debug Script: Lecture Schedule Data Quality Check
-- Purpose: Memeriksa kondisi data jadwal dan matching dengan dosen
-- =====================================================

-- 1. Overview statistik jadwal
SELECT 
  '=== OVERVIEW STATISTIK JADWAL ===' as section;

SELECT 
  COUNT(*) as total_jadwal,
  COUNT(lecturer_user_id) as jadwal_dengan_user_id,
  COUNT(*) - COUNT(lecturer_user_id) as jadwal_tanpa_user_id,
  ROUND(COUNT(lecturer_user_id)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as persentase_matched
FROM lecture_schedules;

-- 2. Daftar dosen di sistem
SELECT 
  '=== DAFTAR DOSEN DI USERS ===' as section;

SELECT 
  id,
  full_name,
  identity_number,
  email,
  COALESCE(
    (SELECT COUNT(*) FROM lecture_schedules WHERE lecturer_user_id = users.id),
    0
  ) as jumlah_jadwal
FROM users
WHERE role = 'lecturer'
ORDER BY full_name;

-- 3. Jadwal yang TIDAK punya lecturer_user_id (Unmatched)
SELECT 
  '=== JADWAL TANPA LECTURER_USER_ID (UNMATCHED) ===' as section;

SELECT 
  id,
  course_name,
  course_code,
  lecturer as nama_dosen_di_jadwal,
  day,
  start_time,
  end_time,
  room,
  class as rombel
FROM lecture_schedules
WHERE lecturer_user_id IS NULL
  AND lecturer IS NOT NULL
ORDER BY lecturer, day, start_time
LIMIT 50;

-- 4. Cek nama dosen yang mungkin typo atau tidak match
SELECT 
  '=== ANALISIS NAMA DOSEN YANG TIDAK MATCH ===' as section;

SELECT 
  ls.lecturer as nama_di_jadwal,
  COUNT(*) as jumlah_jadwal,
  -- Cari kemungkinan user yang mirip
  (
    SELECT STRING_AGG(full_name, ', ')
    FROM users
    WHERE role = 'lecturer'
      AND (
        LOWER(full_name) LIKE '%' || LOWER(SPLIT_PART(ls.lecturer, ' ', 1)) || '%'
        OR LOWER(ls.lecturer) LIKE '%' || LOWER(SPLIT_PART(full_name, ' ', 1)) || '%'
      )
    LIMIT 3
  ) as kemungkinan_match
FROM lecture_schedules ls
WHERE ls.lecturer_user_id IS NULL
  AND ls.lecturer IS NOT NULL
GROUP BY ls.lecturer
ORDER BY COUNT(*) DESC;

-- 5. Cek jadwal hari ini untuk testing
SELECT 
  '=== JADWAL HARI INI (untuk testing presensi) ===' as section;

SELECT 
  ls.id,
  ls.course_name,
  ls.lecturer,
  u.full_name as nama_dosen_di_users,
  u.id as user_id,
  ls.lecturer_user_id,
  ls.day,
  ls.start_time,
  ls.end_time,
  ls.room,
  CASE 
    WHEN ls.lecturer_user_id IS NULL THEN '❌ TIDAK AKAN MUNCUL'
    ELSE '✅ AKAN MUNCUL'
  END as status_deteksi
FROM lecture_schedules ls
LEFT JOIN users u ON ls.lecturer_user_id = u.id
WHERE ls.day = TO_CHAR(CURRENT_DATE, 'Day')  -- Hari ini (e.g., "Tuesday")
   OR ls.day ILIKE TO_CHAR(CURRENT_DATE, 'Day')
   OR ls.day = CASE 
     WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN 'Minggu'
     WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN 'Senin'
     WHEN EXTRACT(DOW FROM CURRENT_DATE) = 2 THEN 'Selasa'
     WHEN EXTRACT(DOW FROM CURRENT_DATE) = 3 THEN 'Rabu'
     WHEN EXTRACT(DOW FROM CURRENT_DATE) = 4 THEN 'Kamis'
     WHEN EXTRACT(DOW FROM CURRENT_DATE) = 5 THEN 'Jumat'
     WHEN EXTRACT(DOW FROM CURRENT_DATE) = 6 THEN 'Sabtu'
   END
ORDER BY ls.start_time;

-- 6. Data Quality: Jadwal tanpa informasi penting
SELECT 
  '=== DATA QUALITY ISSUES ===' as section;

SELECT 
  'Jadwal tanpa nama dosen' as issue,
  COUNT(*) as jumlah
FROM lecture_schedules
WHERE lecturer IS NULL AND lecturer_user_id IS NULL

UNION ALL

SELECT 
  'Jadwal tanpa hari' as issue,
  COUNT(*) as jumlah
FROM lecture_schedules
WHERE day IS NULL

UNION ALL

SELECT 
  'Jadwal tanpa waktu mulai' as issue,
  COUNT(*) as jumlah
FROM lecture_schedules
WHERE start_time IS NULL

UNION ALL

SELECT 
  'Jadwal tanpa ruangan' as issue,
  COUNT(*) as jumlah
FROM lecture_schedules
WHERE room IS NULL;

-- 7. Test query yang digunakan DosenPresensi.tsx
SELECT 
  '=== SIMULASI QUERY DOSENPRESENSI.TSX ===' as section;

-- Ganti <USER_ID> dengan ID dosen yang mau di test
-- Ganti <HARI> dengan hari yang mau di test (e.g., 'Senin')
SELECT 
  'Query by lecturer_user_id' as query_type,
  ls.id,
  ls.course_name,
  ls.course_code,
  ls.room,
  ls.start_time,
  ls.end_time,
  ls.class,
  ls.subject_study,
  ls.semester
FROM lecture_schedules ls
WHERE ls.lecturer_user_id = '<USER_ID_GANTI_INI>'  -- GANTI dengan ID dosen
  AND ls.day ILIKE '<HARI_GANTI_INI>'  -- GANTI dengan hari (e.g., 'Senin')
LIMIT 10;

-- 8. Matching quality check (jika view sudah dibuat dari migration)
SELECT 
  '=== MATCHING QUALITY SUMMARY ===' as section;

-- Akan error jika view belum dibuat, abaikan jika migration belum dijalankan
SELECT 
  match_quality,
  COUNT(*) as jumlah,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) as persentase
FROM lecture_schedule_matching_quality
GROUP BY match_quality
ORDER BY COUNT(*) DESC;

-- 9. Rekomendasi action items
SELECT 
  '=== REKOMENDASI ===' as section;

SELECT 
  CASE
    WHEN (SELECT COUNT(*) FROM lecture_schedules WHERE lecturer_user_id IS NULL AND lecturer IS NOT NULL) > 0
    THEN '⚠️ Jalankan migration untuk sync data: 20260121_fix_lecture_schedule_lecturer_fk.sql'
    ELSE '✅ Semua jadwal sudah ter-link dengan baik'
  END as action_required;
