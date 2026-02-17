-- Run this SQL in your Supabase SQL Editor
-- Or in any PostgreSQL client connected to your database

-- Add additional_notes column to lecturer_attendance table
ALTER TABLE lecturer_attendance
ADD COLUMN IF NOT EXISTS additional_notes TEXT;

COMMENT ON COLUMN lecturer_attendance.additional_notes IS 'Optional additional notes or remarks provided by the lecturer during attendance submission';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'lecturer_attendance'
  AND column_name = 'additional_notes';
