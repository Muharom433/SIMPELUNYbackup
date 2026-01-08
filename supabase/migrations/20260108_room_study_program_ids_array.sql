-- Migration: Change study_program_id to study_program_ids (array)
-- Description: Allows rooms to have multiple study programs instead of just one

-- Step 1: Add new column study_program_ids as uuid array
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS study_program_ids uuid[] DEFAULT NULL;

-- Step 2: Migrate existing data - copy study_program_id to study_program_ids array
UPDATE rooms 
SET study_program_ids = ARRAY[study_program_id]::uuid[]
WHERE study_program_id IS NOT NULL;

-- Step 3: Drop the old study_program_id column (optional - do this after testing)
-- WARNING: Only run this after verifying all applications work with the new column
-- ALTER TABLE rooms DROP COLUMN IF EXISTS study_program_id;

-- Create index for better query performance on array column
CREATE INDEX IF NOT EXISTS idx_rooms_study_program_ids ON rooms USING GIN (study_program_ids);

-- Comment for documentation
COMMENT ON COLUMN rooms.study_program_ids IS 'Array of study program IDs that can access this room. NULL or empty means general access.';
