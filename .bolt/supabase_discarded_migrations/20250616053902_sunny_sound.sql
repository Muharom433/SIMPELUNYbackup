/*
  # Fix Department RLS Policy

  1. Security Updates
    - Update RLS policies to work with Supabase Auth
    - Fix user role checking for department management
    - Ensure proper authentication flow

  2. Changes
    - Drop existing problematic policies
    - Create new policies that work with auth.uid()
    - Add proper role checking based on users table
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Super admins can manage departments" ON departments;
DROP POLICY IF EXISTS "Public can read departments" ON departments;

-- Create new policies that work with Supabase Auth
CREATE POLICY "Super admins can manage departments"
  ON departments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Public can read departments"
  ON departments
  FOR SELECT
  TO public
  USING (true);

-- Also update the users policies to ensure proper authentication
DROP POLICY IF EXISTS "auth" ON users;

CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Super admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );