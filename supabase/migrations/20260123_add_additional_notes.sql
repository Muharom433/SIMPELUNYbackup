-- Add additional_notes column to lecturer_attendance table
-- This column stores optional additional notes/remarks from the lecturer during attendance

ALTER TABLE lecturer_attendance
ADD COLUMN IF NOT EXISTS additional_notes TEXT;

COMMENT ON COLUMN lecturer_attendance.additional_notes IS 'Optional additional notes or remarks provided by the lecturer during attendance submission';
