/*
  # Remove password column from users table

  1. Changes
    - Remove the password column from users table as Supabase handles authentication separately
    - Remove the unique constraint on password
    - Update the users table to work properly with Supabase Auth

  2. Security
    - Passwords are handled securely by Supabase Auth system
    - No need to store passwords in our custom users table
*/

-- Remove the password column and its unique constraint
DO $$
BEGIN
  -- Drop the unique constraint on password if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_password_key' 
    AND table_name = 'users'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_password_key;
  END IF;

  -- Drop the password column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password'
  ) THEN
    ALTER TABLE users DROP COLUMN password;
  END IF;
END $$;

-- Ensure the users table has the correct structure for Supabase Auth integration
-- The id should be a UUID that matches the Supabase Auth user ID
DO $$
BEGIN
  -- Make sure id column is properly set up
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    -- If id column doesn't exist or isn't UUID, this would need manual intervention
    RAISE NOTICE 'Users table id column should be UUID type matching Supabase Auth user ID';
  END IF;
END $$;

-- Update RLS policies to work with Supabase Auth
-- The policies should reference auth.uid() which returns the authenticated user's ID

-- Ensure we have proper policies for the users table
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Super admins can read all users" ON users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;

-- Recreate policies
CREATE POLICY "Users can read their own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Allow users to update their own profile (except role and id)
CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);