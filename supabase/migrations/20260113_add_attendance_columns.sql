-- Add missing columns to lecturer_attendance table
ALTER TABLE lecturer_attendance
ADD COLUMN IF NOT EXISTS scanned_room_id text,
ADD COLUMN IF NOT EXISTS signature_url text,
ADD COLUMN IF NOT EXISTS location_latitude double precision,
ADD COLUMN IF NOT EXISTS location_longitude double precision,
ADD COLUMN IF NOT EXISTS location_accuracy double precision,
ADD COLUMN IF NOT EXISTS location_name text,
ADD COLUMN IF NOT EXISTS is_within_allowed_location boolean;
