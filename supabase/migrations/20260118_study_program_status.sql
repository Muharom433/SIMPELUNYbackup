-- Add status column to study_programs for visibility control
-- Purpose: Allow hiding study programs from user-facing dropdowns while keeping them available for internal use (e.g., non-homebase lecturers)

-- Add status column with constraint
ALTER TABLE study_programs 
ADD COLUMN status TEXT NOT NULL DEFAULT 'show' 
CHECK (status IN ('show', 'hide'));

-- Add index for filtering performance
CREATE INDEX idx_study_programs_status ON study_programs(status);

-- Add comment for documentation
COMMENT ON COLUMN study_programs.status IS 'Visibility status: show (appears in dropdowns) or hide (only for internal use like non-homebase lecturers)';
