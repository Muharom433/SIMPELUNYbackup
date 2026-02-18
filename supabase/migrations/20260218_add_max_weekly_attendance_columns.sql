-- Migration: Add max weekly attendance columns to attendance_global_settings
-- Purpose: Allow admin to configure max attendance per week separately for homebase (HBV) and non-homebase (NHBV) lecturers

-- Add columns with default values
ALTER TABLE attendance_global_settings
ADD COLUMN IF NOT EXISTS max_weekly_attendance_hbv INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS max_weekly_attendance_nhbv INTEGER DEFAULT 2;

-- Update existing row to set defaults
UPDATE attendance_global_settings
SET max_weekly_attendance_hbv = 3,
    max_weekly_attendance_nhbv = 2
WHERE max_weekly_attendance_hbv IS NULL OR max_weekly_attendance_nhbv IS NULL;
