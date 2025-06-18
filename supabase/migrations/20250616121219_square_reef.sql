/*
  # Add checkout type field

  1. Changes
     - Add 'type' column to checkouts table with values 'room' or 'things'
     - Update existing checkouts to have a default type
     - Make the type column required with a default value
  
  2. Validation Queue
     - Support filtering by checkout type
*/

-- Add type column to checkouts table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkouts' AND column_name = 'type'
  ) THEN
    ALTER TABLE checkouts ADD COLUMN type text DEFAULT 'room';
  END IF;
END $$;

-- Update existing checkouts to have a default type
UPDATE checkouts SET type = 'room' WHERE type IS NULL;

-- Make the type column required with a default value
ALTER TABLE checkouts ALTER COLUMN type SET NOT NULL;
ALTER TABLE checkouts ALTER COLUMN type SET DEFAULT 'room';

-- Add check constraint to ensure type is either 'room' or 'things'
ALTER TABLE checkouts ADD CONSTRAINT checkouts_type_check 
  CHECK (type IN ('room', 'things'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_checkouts_type ON checkouts(type);