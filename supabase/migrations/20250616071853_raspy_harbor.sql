/*
  # Fix Booking System for Students

  1. Updates
    - Add user_info jsonb column to bookings table for non-logged users
    - Create function to auto-save user data
    - Add indexes for better performance

  2. Security
    - Enable RLS on bookings table
    - Add policies for public booking access
*/

-- Add user_info column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'user_info'
  ) THEN
    ALTER TABLE bookings ADD COLUMN user_info jsonb;
  END IF;
END $$;

-- Create function to auto-save user data from bookings
CREATE OR REPLACE FUNCTION auto_save_user_from_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_info is provided and user_id is null, try to find or create user
  IF NEW.user_info IS NOT NULL AND NEW.user_id IS NULL THEN
    DECLARE
      existing_user_id uuid;
      new_user_id uuid;
    BEGIN
      -- Try to find existing user by identity_number
      SELECT id INTO existing_user_id
      FROM users
      WHERE identity_number = (NEW.user_info->>'identity_number');
      
      IF existing_user_id IS NOT NULL THEN
        -- Update existing user data
        UPDATE users SET
          full_name = COALESCE(NEW.user_info->>'full_name', full_name),
          email = COALESCE(NEW.user_info->>'email', email),
          updated_at = now()
        WHERE id = existing_user_id;
        
        -- Set user_id in booking
        NEW.user_id = existing_user_id;
      ELSE
        -- Create new user
        new_user_id = gen_random_uuid();
        
        INSERT INTO users (
          id,
          username,
          email,
          full_name,
          identity_number,
          role,
          department_id,
          password
        ) VALUES (
          new_user_id,
          NEW.user_info->>'identity_number', -- Use identity_number as username
          COALESCE(NEW.user_info->>'email', (NEW.user_info->>'identity_number') || '@student.edu'),
          NEW.user_info->>'full_name',
          NEW.user_info->>'identity_number',
          'student',
          (NEW.user_info->>'study_program_id')::uuid,
          'password123' -- Default password
        );
        
        -- Set user_id in booking
        NEW.user_id = new_user_id;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-saving user data
DROP TRIGGER IF EXISTS auto_save_user_trigger ON bookings;
CREATE TRIGGER auto_save_user_trigger
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_save_user_from_booking();

-- Enable RLS on bookings table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create policy for public booking access
CREATE POLICY "Allow public booking creation" ON bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create policy for users to view their own bookings
CREATE POLICY "Users can view own bookings" ON bookings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create policy for admins to view all bookings
CREATE POLICY "Admins can view all bookings" ON bookings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'department_admin')
    )
  );

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_user_info ON bookings USING gin(user_info);
CREATE INDEX IF NOT EXISTS idx_users_identity_number ON users(identity_number);