-- Migration: Add department_id and study_program_id to equipment table
-- Purpose: Enable direct filtering of equipment by department/study program
--          without needing to join through the rooms table

-- Step 1: Add new columns to equipment table
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS study_program_id UUID REFERENCES study_programs(id) ON DELETE SET NULL;

-- Step 2: Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_equipment_department_id ON equipment(department_id);
CREATE INDEX IF NOT EXISTS idx_equipment_study_program_id ON equipment(study_program_id);

-- Step 3: Backfill existing equipment with department_id and study_program_id from rooms
-- This updates all existing equipment records to have the same department_id and study_program_id
-- as their assigned room
UPDATE equipment e
SET 
    department_id = r.department_id,
    study_program_id = r.study_program_id
FROM rooms r
WHERE e.rooms_id = r.id
  AND e.rooms_id IS NOT NULL
  AND (e.department_id IS NULL OR e.study_program_id IS NULL);

-- Step 4: Verify the update
-- SELECT 
--     e.id, 
--     e.name, 
--     e.department_id as eq_dept, 
--     e.study_program_id as eq_sp,
--     r.department_id as room_dept, 
--     r.study_program_id as room_sp
-- FROM equipment e
-- LEFT JOIN rooms r ON e.rooms_id = r.id
-- LIMIT 10;
