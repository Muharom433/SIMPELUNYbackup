-- Migration: QR and Signature features
-- Date: 2026-01-12
-- Description: Add columns for room scanning and signature verification, create storage bucket

-- 1. Add columns to lecturer_attendance
ALTER TABLE lecturer_attendance
ADD COLUMN IF NOT EXISTS scanned_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS signature_url TEXT;

COMMENT ON COLUMN lecturer_attendance.scanned_room_id IS 'Room ID scanned by QR code at the time of attendance';
COMMENT ON COLUMN lecturer_attendance.signature_url IS 'URL of the digital signature image';

-- 2. Create Storage Bucket for Signatures if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance_signatures', 'attendance_signatures', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies (Safe to re-run?)
-- We wrap in DO block to avoid error if policy exists, or just DROP IF EXISTS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update own signatures" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'attendance_signatures' );

CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'attendance_signatures' AND auth.role() = 'authenticated' );

CREATE POLICY "Users can update own signatures" ON storage.objects FOR UPDATE
USING ( bucket_id = 'attendance_signatures' AND auth.uid() = owner );
