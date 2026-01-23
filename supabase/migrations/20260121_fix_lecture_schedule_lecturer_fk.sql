-- =====================================================
-- Migration: Fix Lecture Schedule Lecturer Relationship
-- Date: 2026-01-21
-- Description: Menambahkan/memperbaiki foreign key lecturer_user_id
--              dan melakukan sync data untuk jadwal yang belum ter-link
-- =====================================================

-- Step 1: Pastikan kolom lecturer_user_id ada
-- (Jika sudah ada, perintah ini akan diabaikan)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lecture_schedules' AND column_name = 'lecturer_user_id'
  ) THEN
    ALTER TABLE lecture_schedules 
      ADD COLUMN lecturer_user_id UUID;
    
    RAISE NOTICE 'Kolom lecturer_user_id berhasil ditambahkan';
  ELSE
    RAISE NOTICE 'Kolom lecturer_user_id sudah ada';
  END IF;
END $$;

-- Step 2: Tambahkan foreign key constraint jika belum ada
-- ON DELETE SET NULL: Jika user dihapus, jadwal tetap ada tapi lecturer_user_id jadi NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_lecture_schedules_lecturer_user'
      AND table_name = 'lecture_schedules'
  ) THEN
    ALTER TABLE lecture_schedules
      ADD CONSTRAINT fk_lecture_schedules_lecturer_user
      FOREIGN KEY (lecturer_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
    
    RAISE NOTICE 'Foreign key constraint berhasil ditambahkan';
  ELSE
    RAISE NOTICE 'Foreign key constraint sudah ada';
  END IF;
END $$;

-- Step 3: Create index untuk performa query
CREATE INDEX IF NOT EXISTS idx_lecture_schedules_lecturer_user_id 
  ON lecture_schedules(lecturer_user_id);

CREATE INDEX IF NOT EXISTS idx_lecture_schedules_day_time
  ON lecture_schedules(day, start_time, end_time)
  WHERE lecturer_user_id IS NOT NULL;

-- Step 4: Sync data - Match lecturer by name (EXACT MATCH first)
UPDATE lecture_schedules ls
SET lecturer_user_id = u.id
FROM users u
WHERE u.role = 'lecturer'
  AND ls.lecturer_user_id IS NULL
  AND ls.lecturer IS NOT NULL
  -- Exact match (case insensitive, trimmed)
  AND LOWER(TRIM(ls.lecturer)) = LOWER(TRIM(u.full_name));

-- Step 5: Sync data - Match lecturer by name (PARTIAL MATCH for remaining)
-- Hati-hati dengan partial match, hanya untuk yang kemungkinan benar
UPDATE lecture_schedules ls
SET lecturer_user_id = u.id
FROM users u
WHERE u.role = 'lecturer'
  AND ls.lecturer_user_id IS NULL
  AND ls.lecturer IS NOT NULL
  -- Lecturer column contains full_name (e.g., "Dr. Name, M.Pd" contains "Name")
  AND LOWER(ls.lecturer) LIKE '%' || LOWER(TRIM(u.full_name)) || '%'
  -- Safety check: Nama harus minimal 5 karakter untuk menghindari false positive
  AND LENGTH(TRIM(u.full_name)) >= 5;

-- Step 6: Log hasil sync
DO $$
DECLARE
  total_schedules INT;
  matched_schedules INT;
  unmatched_schedules INT;
BEGIN
  SELECT COUNT(*) INTO total_schedules FROM lecture_schedules;
  SELECT COUNT(*) INTO matched_schedules FROM lecture_schedules WHERE lecturer_user_id IS NOT NULL;
  SELECT COUNT(*) INTO unmatched_schedules FROM lecture_schedules WHERE lecturer_user_id IS NULL AND lecturer IS NOT NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SYNC RESULT:';
  RAISE NOTICE 'Total Jadwal: %', total_schedules;
  RAISE NOTICE 'Matched (Ter-link ke Dosen): %', matched_schedules;
  RAISE NOTICE 'Unmatched (Belum Ter-link): %', unmatched_schedules;
  RAISE NOTICE '========================================';
  
  -- Jika ada yang belum match, tampilkan sample
  IF unmatched_schedules > 0 THEN
    RAISE WARNING 'Ada % jadwal yang belum ter-link ke dosen. Perlu review manual!', unmatched_schedules;
  END IF;
END $$;

-- Step 7: Create view untuk monitoring data quality
CREATE OR REPLACE VIEW lecture_schedule_matching_quality AS
SELECT 
  ls.id,
  ls.course_name,
  ls.lecturer as lecturer_name_in_schedule,
  u.full_name as lecturer_name_in_users,
  u.identity_number as lecturer_nip,
  ls.lecturer_user_id,
  CASE 
    WHEN ls.lecturer_user_id IS NULL AND ls.lecturer IS NOT NULL THEN 'UNMATCHED'
    WHEN ls.lecturer_user_id IS NULL AND ls.lecturer IS NULL THEN 'NO_LECTURER'
    WHEN LOWER(TRIM(ls.lecturer)) = LOWER(TRIM(u.full_name)) THEN 'EXACT_MATCH'
    WHEN LOWER(ls.lecturer) LIKE '%' || LOWER(TRIM(u.full_name)) || '%' THEN 'PARTIAL_MATCH'
    ELSE 'MATCHED_BUT_NAME_DIFFERS'
  END as match_quality,
  ls.day,
  ls.start_time,
  ls.end_time
FROM lecture_schedules ls
LEFT JOIN users u ON ls.lecturer_user_id = u.id AND u.role = 'lecturer';

-- Step 8: Add helpful comments
COMMENT ON COLUMN lecture_schedules.lecturer_user_id IS 'Foreign key ke users table (dosen). ON DELETE SET NULL untuk menjaga integritas data jadwal.';
COMMENT ON COLUMN lecture_schedules.lecturer IS 'Nama dosen sebagai string. Digunakan untuk display dan Excel import. Sync dengan lecturer_user_id.';

-- Step 9: Show unmatched schedules sample (untuk review)
DO $$
DECLARE
  rec RECORD;
  counter INT := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SAMPLE UNMATCHED SCHEDULES (Max 10):';
  RAISE NOTICE '========================================';
  
  FOR rec IN 
    SELECT DISTINCT lecturer 
    FROM lecture_schedules 
    WHERE lecturer_user_id IS NULL 
      AND lecturer IS NOT NULL 
    LIMIT 10
  LOOP
    counter := counter + 1;
    RAISE NOTICE '%: Nama Dosen = "%"', counter, rec.lecturer;
  END LOOP;
  
  IF counter = 0 THEN
    RAISE NOTICE '✅ Semua jadwal sudah ter-link ke dosen!';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;
