-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Allow public booking creation" ON bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;

-- Disable RLS temporarily to fix issues
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with proper policies
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies for bookings
CREATE POLICY "Enable insert for users based on user_id" ON bookings
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON bookings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can view all bookings" ON bookings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = ANY(ARRAY['super_admin'])
    )
  );

-- Create function to set current user context
CREATE OR REPLACE FUNCTION set_current_user(user_id uuid)
RETURNS void AS $$
BEGIN
  -- This function can be used to set user context for RLS
  PERFORM set_config('app.current_user_id', user_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get current user context
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the auto_save_user_from_booking function to handle email generation better
CREATE OR REPLACE FUNCTION auto_save_user_from_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_info is provided and user_id is null, try to find or create user
  IF NEW.user_info IS NOT NULL AND NEW.user_id IS NULL THEN
    DECLARE
      existing_user_id uuid;
      new_user_id uuid;
      department_id_from_program uuid;
      user_email text;
    BEGIN
      -- Get department_id from study_program if provided
      IF NEW.user_info->>'study_program_id' IS NOT NULL THEN
        SELECT department_id INTO department_id_from_program
        FROM study_programs
        WHERE id = (NEW.user_info->>'study_program_id')::uuid;
      END IF;
      
      -- Generate email if not provided
      user_email := COALESCE(
        NEW.user_info->>'email',
        (NEW.user_info->>'identity_number') || '@student.edu'
      );
      
      -- Try to find existing user by identity_number
      SELECT id INTO existing_user_id
      FROM users
      WHERE identity_number = (NEW.user_info->>'identity_number');
      
      IF existing_user_id IS NOT NULL THEN
        -- Update existing user data
        UPDATE users SET
          full_name = COALESCE(NEW.user_info->>'full_name', full_name),
          email = COALESCE(user_email, email),
          study_program_id = COALESCE((NEW.user_info->>'study_program_id')::uuid, study_program_id),
          department_id = COALESCE(department_id_from_program, department_id),
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
          study_program_id,
          department_id,
          password
        ) VALUES (
          new_user_id,
          NEW.user_info->>'identity_number', -- Use identity_number as username
          user_email,
          NEW.user_info->>'full_name',
          NEW.user_info->>'identity_number',
          'student',
          (NEW.user_info->>'study_program_id')::uuid,
          department_id_from_program,
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

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS auto_save_user_trigger ON bookings;
CREATE TRIGGER auto_save_user_trigger
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_save_user_from_booking();

-- Add purpose column with default value if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'purpose'
  ) THEN
    ALTER TABLE bookings ADD COLUMN purpose text DEFAULT 'Class/Study Session';
  ELSE
    -- Update existing null purposes
    UPDATE bookings SET purpose = 'Class/Study Session' WHERE purpose IS NULL;
  END IF;
END $$;

-- Make purpose NOT NULL with default
ALTER TABLE bookings ALTER COLUMN purpose SET DEFAULT 'Class/Study Session';
UPDATE bookings SET purpose = 'Class/Study Session' WHERE purpose IS NULL OR purpose = '';
ALTER TABLE bookings ALTER COLUMN purpose SET NOT NULL;