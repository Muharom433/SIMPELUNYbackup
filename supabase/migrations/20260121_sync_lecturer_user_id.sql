-- =====================================================
-- Migration: Sync Lecturer User ID untuk Data Existing
-- Date: 2026-01-21
-- Description: Mengisi lecturer_user_id untuk jadwal yang sudah 
--              di-match via UI tapi belum ter-link ke users
-- =====================================================

-- Info: Migration ini aman untuk dijalankan multiple kali (idempotent)
--       Karena hanya update yang lecturer_user_id-nya NULL

BEGIN;

-- Step 1: Sync berdasarkan exact match nama
-- Ini akan mengisi lecturer_user_id untuk jadwal yang nama dosen-nya 
-- sama persis dengan users.full_name

UPDATE lecture_schedules ls
SET lecturer_user_id = u.id,
    updated_at = NOW()
FROM users u
WHERE u.role = 'lecturer'
  AND ls.lecturer_user_id IS NULL
  AND ls.lecturer IS NOT NULL
  AND LOWER(TRIM(ls.lecturer)) = LOWER(TRIM(u.full_name));

-- Step 2: Report hasil sync
DO $$
DECLARE
  total_schedules INT;
  synced_schedules INT;
  unsynced_schedules INT;
  percentage_synced NUMERIC;
BEGIN
  -- Count total jadwal
  SELECT COUNT(*) INTO total_schedules FROM lecture_schedules;
  
  -- Count jadwal yang sudah punya lecturer_user_id
  SELECT COUNT(*) INTO synced_schedules 
  FROM lecture_schedules 
  WHERE lecturer_user_id IS NOT NULL;
  
  -- Count jadwal yang lecturer_user_id-nya masih NULL tapi ada nama dosen
  SELECT COUNT(*) INTO unsynced_schedules 
  FROM lecture_schedules 
  WHERE lecturer_user_id IS NULL AND lecturer IS NOT NULL;
  
  -- Calculate percentage
  IF total_schedules > 0 THEN
    percentage_synced := ROUND((synced_schedules::NUMERIC / total_schedules) * 100, 2);
  ELSE
    percentage_synced := 0;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '         SYNC RESULT SUMMARY            ';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Jadwal: %', total_schedules;
  RAISE NOTICE 'Synced (lecturer_user_id terisi): %', synced_schedules;
  RAISE NOTICE 'Still Unsynced: %', unsynced_schedules;
  RAISE NOTICE 'Percentage Synced: %', percentage_synced || '%';
  RAISE NOTICE '========================================';
  
  IF unsynced_schedules > 0 THEN
    RAISE NOTICE 'Ada % jadwal yang belum ter-link.', unsynced_schedules;
    RAISE NOTICE 'Gunakan Matching Modal di LectureSchedules untuk fix.';
  ELSE
    RAISE NOTICE 'Semua jadwal sudah ter-link dengan dosen!';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- Step 3: List nama dosen yang belum ter-sync (untuk review)
DO $$
DECLARE
  rec RECORD;
  counter INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '    UNSYNCED LECTURERS (Sample)        ';
  RAISE NOTICE '========================================';
  
  FOR rec IN 
    SELECT 
      lecturer,
      COUNT(*) as schedule_count
    FROM lecture_schedules
    WHERE lecturer_user_id IS NULL
      AND lecturer IS NOT NULL
    GROUP BY lecturer
    ORDER BY COUNT(*) DESC
    LIMIT 15
  LOOP
    counter := counter + 1;
    RAISE NOTICE '%: "%" (% jadwal)', counter, rec.lecturer, rec.schedule_count;
  END LOOP;
  
  IF counter = 0 THEN
    RAISE NOTICE 'Tidak ada jadwal yang belum ter-sync!';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE 'Catatan: Daftar di atas adalah dosen yang nama-nya';
    RAISE NOTICE 'tidak exact match dengan users.full_name.';
    RAISE NOTICE 'Gunakan Matching Modal untuk mencocokkan manual.';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- Step 4: Create helper view untuk monitoring (optional)
CREATE OR REPLACE VIEW lecture_schedule_sync_status AS
SELECT 
  ls.id,
  ls.course_name,
  ls.lecturer as lecturer_name_in_schedule,
  ls.lecturer_user_id,
  u.full_name as lecturer_name_in_users,
  u.identity_number as lecturer_nip,
  ls.day,
  ls.start_time,
  ls.end_time,
  CASE 
    WHEN ls.lecturer_user_id IS NULL AND ls.lecturer IS NOT NULL THEN '❌ UNSYNCED'
    WHEN ls.lecturer_user_id IS NULL AND ls.lecturer IS NULL THEN '⚠️ NO LECTURER'
    WHEN ls.lecturer_user_id IS NOT NULL THEN '✅ SYNCED'
    ELSE 'UNKNOWN'
  END as sync_status
FROM lecture_schedules ls
LEFT JOIN users u ON ls.lecturer_user_id = u.id AND u.role = 'lecturer'
ORDER BY 
  CASE 
    WHEN ls.lecturer_user_id IS NULL AND ls.lecturer IS NOT NULL THEN 1
    WHEN ls.lecturer_user_id IS NULL AND ls.lecturer IS NULL THEN 2
    ELSE 3
  END,
  ls.lecturer;

COMMENT ON VIEW lecture_schedule_sync_status IS 'View untuk monitoring status sync lecturer_user_id';

-- Step 5: Verify data integrity
DO $$
DECLARE
  invalid_fk_count INT;
BEGIN
  -- Check if there are any invalid lecturer_user_id (yang nggak ada di users table)
  SELECT COUNT(*) INTO invalid_fk_count
  FROM lecture_schedules ls
  WHERE ls.lecturer_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = ls.lecturer_user_id 
      AND u.role = 'lecturer'
    );
  
  IF invalid_fk_count > 0 THEN
    RAISE WARNING 'Found % schedules with invalid lecturer_user_id!', invalid_fk_count;
    RAISE WARNING 'These lecturer_user_id point to non-existent or non-lecturer users.';
    RAISE WARNING 'You may want to set them to NULL.';
  ELSE
    RAISE NOTICE 'All lecturer_user_id values are valid!';
  END IF;
END $$;

COMMIT;

-- ========================================
-- Post-Migration Queries (Run Manually)
-- ========================================

-- Query 1: Quick check sync status
-- SELECT sync_status, COUNT(*) as count 
-- FROM lecture_schedule_sync_status 
-- GROUP BY sync_status;

--Query 2: View unsynced schedules grouped by lecturer
-- SELECT 
--   lecturer_name_in_schedule,
--   COUNT(*) as schedule_count,
--   STRING_AGG(DISTINCT course_name, ', ') as courses
-- FROM lecture_schedule_sync_status
-- WHERE sync_status = '❌ UNSYNCED'
-- GROUP BY lecturer_name_in_schedule
-- ORDER BY COUNT(*) DESC;

-- Query 3: Test presensi query for a specific lecturer
-- SELECT 
--   ls.*,
--   u.full_name as user_name
-- FROM lecture_schedules ls
-- JOIN users u ON ls.lecturer_user_id = u.id
-- WHERE u.id = '<paste-user-id-here>'
--   AND ls.day ILIKE 'Senin';  -- Change to current day
