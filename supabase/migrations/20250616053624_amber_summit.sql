/*
  # Fix RLS policies for departments and study programs

  1. Policy Updates
    - Fix INSERT policies for departments table to allow super admins
    - Fix INSERT policies for study_programs table to allow super admins and department admins
    - Ensure all CRUD operations work correctly with proper role checks

  2. Helper Functions
    - Create helper functions to check user roles and department access
    - These functions will be used in RLS policies for consistent role checking

  3. Security
    - Maintain strict access control based on user roles
    - Department admins can only manage their own department's study programs
    - Super admins have full access to all resources
*/

-- Create helper function to get current user's role
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

-- Create helper function to get current user's department
CREATE OR REPLACE FUNCTION current_user_department_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT department_id FROM users WHERE id = auth.uid();
$$;

-- Drop existing policies for departments table
DROP POLICY IF EXISTS "Super admins can manage all users" ON departments;
DROP POLICY IF EXISTS "Super admins can read all users" ON departments;
DROP POLICY IF EXISTS "Super admins can manage departments" ON departments;
DROP POLICY IF EXISTS "Public can read departments" ON departments;

-- Create comprehensive policies for departments table
CREATE POLICY "Super admins can manage departments"
  ON departments
  FOR ALL
  TO authenticated
  USING (current_user_has_role('super_admin'))
  WITH CHECK (current_user_has_role('super_admin'));

CREATE POLICY "Public can read departments"
  ON departments
  FOR SELECT
  TO public
  USING (true);

-- Drop existing policies for study_programs table
DROP POLICY IF EXISTS "Super admins can manage study programs" ON study_programs;
DROP POLICY IF EXISTS "Department admins can manage dept study programs" ON study_programs;
DROP POLICY IF EXISTS "Public can read study programs" ON study_programs;

-- Create comprehensive policies for study_programs table
CREATE POLICY "Super admins can manage study programs"
  ON study_programs
  FOR ALL
  TO authenticated
  USING (current_user_has_role('super_admin'))
  WITH CHECK (current_user_has_role('super_admin'));

CREATE POLICY "Department admins can manage dept study programs"
  ON study_programs
  FOR ALL
  TO authenticated
  USING (
    current_user_has_role('department_admin') 
    AND department_id = current_user_department_id()
  )
  WITH CHECK (
    current_user_has_role('department_admin') 
    AND department_id = current_user_department_id()
  );

CREATE POLICY "Public can read study programs"
  ON study_programs
  FOR SELECT
  TO public
  USING (true);

-- Ensure RLS is enabled on both tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_programs ENABLE ROW LEVEL SECURITY;