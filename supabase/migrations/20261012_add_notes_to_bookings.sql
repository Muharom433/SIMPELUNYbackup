-- Add notes column to bookings table
-- Used to store the reason/purpose description for "Other Activity" bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

COMMENT ON COLUMN bookings.notes IS 'Alasan atau keperluan peminjaman, wajib diisi ketika purpose = ''Other''';
