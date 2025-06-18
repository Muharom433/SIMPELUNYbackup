/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem Analysis
    - The custom authentication system is creating circular dependencies
    - RLS policies are referencing each other causing infinite loops
    - Equipment table queries are failing due to user table policy recursion

  2. Solution
    - Simplify authentication to work with Supabase's built-in auth
    - Use direct auth.uid() calls instead of custom functions where possible
    - Break circular dependencies in RLS policies
    - Allow public access to equipment for non-authenticated users

  3. Changes
    - Update get_current_user_id() function to be non-recursive
    - Simplify all RLS policies to avoid circular references
    - Add public access policies for equipment and rooms
    - Maintain security while fixing recursion issues
*/

-- Update the get_current_user_id function to be simple and non-recursive
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid();
$$;

-- Create a simple function to check if current user has a specific role
CREATE OR REPLACE FUNCTION current_user_has_role(required_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = required_role
  );
$$;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Anyone can read equipment" ON equipment;
DROP POLICY IF EXISTS "Authenticated users can read all equipment" ON equipment;
DROP POLICY IF EXISTS "Users can read equipment" ON equipment;
DROP POLICY IF EXISTS "Department admins can manage their equipment" ON equipment;
DROP POLICY IF EXISTS "Super admins can manage all equipment" ON equipment;

-- Create new, simple equipment policies
CREATE POLICY "Public can read available equipment"
  ON equipment
  FOR SELECT
  TO public
  USING (is_available = true);

CREATE POLICY "Authenticated can read all equipment"
  ON equipment
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage equipment"
  ON equipment
  FOR ALL
  TO authenticated
  USING (current_user_has_role('super_admin'));

CREATE POLICY "Department admins can manage dept equipment"
  ON equipment
  FOR ALL
  TO authenticated
  USING (
    current_user_has_role('department_admin') AND
    department_id IN (
      SELECT department_id FROM users WHERE id = auth.uid()
    )
  );

-- Update users policies
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Super admins can read all users" ON users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;

CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Super admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (current_user_has_role('super_admin'));

CREATE POLICY "Super admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (current_user_has_role('super_admin'));

-- Update rooms policies
DROP POLICY IF EXISTS "Anyone can read available rooms" ON rooms;
DROP POLICY IF EXISTS "Department admins can manage their rooms" ON rooms;
DROP POLICY IF EXISTS "Super admins can manage all rooms" ON rooms;

CREATE POLICY "Public can read available rooms"
  ON rooms
  FOR SELECT
  TO public
  USING (is_available = true);

CREATE POLICY "Super admins can manage rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (current_user_has_role('super_admin'));

CREATE POLICY "Department admins can manage dept rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (
    current_user_has_role('department_admin') AND
    department_id IN (
      SELECT department_id FROM users WHERE id = auth.uid()
    )
  );

-- Update bookings policies
DROP POLICY IF EXISTS "Users can read their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own pending bookings" ON bookings;
DROP POLICY IF EXISTS "Department admins can manage bookings in their department" ON bookings;
DROP POLICY IF EXISTS "Super admins can manage all bookings" ON bookings;

CREATE POLICY "Users can read own bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can manage bookings"
  ON bookings
  FOR ALL
  TO authenticated
  USING (current_user_has_role('super_admin'));

CREATE POLICY "Department admins can manage dept bookings"
  ON bookings
  FOR ALL
  TO authenticated
  USING (
    current_user_has_role('department_admin') AND
    EXISTS (
      SELECT 1 FROM rooms r, users u
      WHERE r.id = bookings.room_id 
      AND u.id = auth.uid()
      AND r.department_id = u.department_id
    )
  );

-- Update study programs policies
DROP POLICY IF EXISTS "Anyone can read study programs" ON study_programs;
DROP POLICY IF EXISTS "Department admins can manage their study programs" ON study_programs;
DROP POLICY IF EXISTS "Super admins can manage all study programs" ON study_programs;

CREATE POLICY "Public can read study programs"
  ON study_programs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Super admins can manage study programs"
  ON study_programs
  FOR ALL
  TO authenticated
  USING (current_user_has_role('super_admin'));

CREATE POLICY "Department admins can manage dept study programs"
  ON study_programs
  FOR ALL
  TO authenticated
  USING (
    current_user_has_role('department_admin') AND
    department_id IN (
      SELECT department_id FROM users WHERE id = auth.uid()
    )
  );

-- Update departments policies
DROP POLICY IF EXISTS "Anyone can read departments" ON departments;
DROP POLICY IF EXISTS "Super admins can manage departments" ON departments;

CREATE POLICY "Public can read departments"
  ON departments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Super admins can manage departments"
  ON departments
  FOR ALL
  TO authenticated
  USING (current_user_has_role('super_admin'));

-- Grant permissions for the new function
GRANT EXECUTE ON FUNCTION current_user_has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_has_role(text) TO anon;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '=== INFINITE RECURSION FIXED ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '- Updated get_current_user_id() to be non-recursive';
  RAISE NOTICE '- Created current_user_has_role() helper function';
  RAISE NOTICE '- Simplified all RLS policies to avoid circular dependencies';
  RAISE NOTICE '- Added public access for equipment and rooms';
  RAISE NOTICE '- Maintained security while fixing recursion';
  RAISE NOTICE '';
  RAISE NOTICE 'The equipment table should now be accessible without errors.';
END $$;