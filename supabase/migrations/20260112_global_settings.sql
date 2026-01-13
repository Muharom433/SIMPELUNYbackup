-- Migration: Create attendance global settings table
-- Purpose: Simple toggle to disable/enable attendance with custom message

-- Table for global attendance settings (single row)
CREATE TABLE IF NOT EXISTS attendance_global_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_attendance_disabled BOOLEAN DEFAULT false,
    disabled_from_date DATE,
    disabled_message TEXT DEFAULT 'Presensi transport sedang ditutup',
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE attendance_global_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy - everyone can read, finance can update
CREATE POLICY "anon_all_global_settings" ON attendance_global_settings
    FOR ALL USING (true) WITH CHECK (true);

-- Insert default row
INSERT INTO attendance_global_settings (is_attendance_disabled, disabled_message)
VALUES (false, 'Presensi transport sedang ditutup')
ON CONFLICT DO NOTHING;
