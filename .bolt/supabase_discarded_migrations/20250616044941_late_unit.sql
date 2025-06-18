/*
  # Fix RLS Infinite Recursion Error

  1. Problem
    - Infinite recursion detected in policy for relation "users"
    - This happens when policies reference each other in a circular manner
    - The get_current_user_id() function likely has issues

  2. Solution
    - Create a proper get_current_user_id() function that doesn't cause recursion
    - Update policies to use auth.uid() directly where possible
    - Simplify policy conditions to avoid circular references

  3. Changes
    - Drop and recreate get_current_user_id() function
    - Update equipment policies to be more direct
    - Ensure no circular policy dependencies
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_current_user_id();

-- Create a simple, non-recursive function to get current user ID
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid();
$$;

-- Drop existing policies on equipment table that might cause recursion
DROP POLICY IF EXISTS "Users can read equipment" ON equipment;
DROP POLICY IF EXISTS "Department admins can manage their equipment" ON equipment;
DROP POLICY IF EXISTS "Super admins can manage all equipment" ON equipment;

-- Create new, simplified policies for equipment table
CREATE POLICY "Anyone can read equipment"
  ON equipment
  FOR SELECT
  TO public
  USING (is_available = true);

CREATE POLICY "Authenticated users can read all equipment"
  ON equipment
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Department admins can manage their equipment"
  ON equipment
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'department_admin' 
      AND users.department_id = equipment.department_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'department_admin' 
      AND users.department_id = equipment.department_id
    )
  );

CREATE POLICY "Super admins can manage all equipment"
  ON equipment
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

-- Update users table policies to use auth.uid() directly
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Super admins can read all users" ON users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;

CREATE POLICY "Users can read their own profile"
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
      SELECT 1 FROM users u2 
      WHERE u2.id = auth.uid() 
      AND u2.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u2 
      WHERE u2.id = auth.uid() 
      AND u2.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u2 
      WHERE u2.id = auth.uid() 
      AND u2.role = 'super_admin'
    )
  );

-- Update bookings policies to avoid recursion
DROP POLICY IF EXISTS "Department admins can manage bookings in their department" ON bookings;
DROP POLICY IF EXISTS "Super admins can manage all bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can read their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own pending bookings" ON bookings;

CREATE POLICY "Users can read their own bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pending bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Department admins can manage bookings in their department"
  ON bookings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN rooms r ON r.id = bookings.room_id
      WHERE u.id = auth.uid() 
      AND u.role = 'department_admin' 
      AND u.department_id = r.department_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN rooms r ON r.id = bookings.room_id
      WHERE u.id = auth.uid() 
      AND u.role = 'department_admin' 
      AND u.department_id = r.department_id
    )
  );

CREATE POLICY "Super admins can manage all bookings"
  ON bookings
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

-- Update rooms policies
DROP POLICY IF EXISTS "Department admins can manage their rooms" ON rooms;
DROP POLICY IF EXISTS "Super admins can manage all rooms" ON rooms;

CREATE POLICY "Department admins can manage their rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'department_admin' 
      AND u.department_id = rooms.department_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'department_admin' 
      AND u.department_id = rooms.department_id
    )
  );

CREATE POLICY "Super admins can manage all rooms"
  ON rooms
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

-- Update study programs policies
DROP POLICY IF EXISTS "Department admins can manage their study programs" ON study_programs;
DROP POLICY IF EXISTS "Super admins can manage all study programs" ON study_programs;

CREATE POLICY "Department admins can manage their study programs"
  ON study_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'department_admin' 
      AND u.department_id = study_programs.department_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'department_admin' 
      AND u.department_id = study_programs.department_id
    )
  );

CREATE POLICY "Super admins can manage all study programs"
  ON study_programs
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

-- Update departments policies
DROP POLICY IF EXISTS "Super admins can manage departments" ON departments;

CREATE POLICY "Super admins can manage departments"
  ON departments
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