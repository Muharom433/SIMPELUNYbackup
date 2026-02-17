/*
  # Add room transfer flag to checkouts
  
  1. Changes
     - Add 'is_room_transfer' boolean column to checkouts table
     - This flag indicates if the checkout was created due to room transfer
     - Default value is false
  
  2. Purpose
     - Track checkouts created automatically during room changes
     - Helps distinguish between normal checkouts and transfer-related checkouts
*/

-- Add is_room_transfer column to checkouts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkouts' AND column_name = 'is_room_transfer'
  ) THEN
    ALTER TABLE checkouts ADD COLUMN is_room_transfer boolean DEFAULT false;
  END IF;
END $$;

-- Update existing checkouts to have a default value
UPDATE checkouts SET is_room_transfer = false WHERE is_room_transfer IS NULL;

-- Make the column have a default value
ALTER TABLE checkouts ALTER COLUMN is_room_transfer SET DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_checkouts_is_room_transfer ON checkouts(is_room_transfer);

-- Add comment to the column
COMMENT ON COLUMN checkouts.is_room_transfer IS 'Flag indicating if this checkout was created automatically due to room transfer in borrowed status';
