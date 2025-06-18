/*
  # Add phone_number field to users table

  1. Schema Changes
    - Add phone_number column to users table
    - Create index for better query performance

  2. Data Migration
    - No data migration needed as this is a new field
*/

-- Add phone_number column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE users ADD COLUMN phone_number text;
    RAISE NOTICE 'Added phone_number column to users table';
  ELSE
    RAISE NOTICE 'Phone number column already exists';
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

-- Update auto_save_user_from_booking function to handle phone_number
CREATE OR REPLACE FUNCTION auto_save_user_from_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_info is provided and user_id is null, try to find or create user
  IF NEW.user_info IS NOT NULL AND NEW.user_id IS NULL THEN
    DECLARE
      existing_user_id uuid;
      new_user_id uuid;
      department_id_from_program uuid;
    BEGIN
      -- Get department_id from study_program if provided
      IF NEW.user_info->>'study_program_id' IS NOT NULL THEN
        SELECT department_id INTO department_id_from_program
        FROM study_programs
        WHERE id = (NEW.user_info->>'study_program_id')::uuid;
      END IF;
      
      -- Try to find existing user by identity_number
      SELECT id INTO existing_user_id
      FROM users
      WHERE identity_number = (NEW.user_info->>'identity_number');
      
      IF existing_user_id IS NOT NULL THEN
        -- Update existing user data
        UPDATE users SET
          full_name = COALESCE(NEW.user_info->>'full_name', full_name),
          email = COALESCE(NEW.user_info->>'email', email),
          phone_number = COALESCE(NEW.user_info->>'phone_number', phone_number),
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
          phone_number,
          role,
          study_program_id,
          department_id,
          password
        ) VALUES (
          new_user_id,
          NEW.user_info->>'identity_number', -- Use identity_number as username
          COALESCE(NEW.user_info->>'email', (NEW.user_info->>'identity_number') || '@student.edu'),
          NEW.user_info->>'full_name',
          NEW.user_info->>'identity_number',
          NEW.user_info->>'phone_number',
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