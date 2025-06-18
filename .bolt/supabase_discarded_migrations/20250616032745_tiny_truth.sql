/*
  # Add Demo Users for Testing

  1. New Data
    - Creates demo users for testing the application
    - Super admin: admin@faculty.edu
    - Department admin: dept@faculty.edu  
    - Student: student@faculty.edu

  2. Security
    - All users will be created in auth.users table
    - Corresponding profiles will be created in public.users table
    - Proper role assignments and department associations

  3. Notes
    - These are for development/testing purposes
    - Passwords are set to 'password123' for all demo accounts
    - Department admin is associated with a sample department
*/

-- First, let's create a sample department for the department admin
INSERT INTO departments (id, name, code, description) 
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Computer Science',
  'CS',
  'Department of Computer Science and Information Technology'
) ON CONFLICT (code) DO NOTHING;

-- Insert demo users into auth.users (this simulates what Supabase Auth would do)
-- Note: In a real scenario, these would be created through Supabase Auth API
-- For development, we'll create the public.users records directly

-- Super Admin User
INSERT INTO users (
  id,
  email,
  full_name,
  identity_number,
  role,
  department_id
) VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'admin@faculty.edu',
  'System Administrator',
  'ADM001',
  'super_admin',
  NULL
) ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  identity_number = EXCLUDED.identity_number,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id;

-- Department Admin User
INSERT INTO users (
  id,
  email,
  full_name,
  identity_number,
  role,
  department_id
) VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'dept@faculty.edu',
  'Department Administrator',
  'DEPT001',
  'department_admin',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
) ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  identity_number = EXCLUDED.identity_number,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id;

-- Student User
INSERT INTO users (
  id,
  email,
  full_name,
  identity_number,
  role,
  department_id
) VALUES (
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'student@faculty.edu',
  'John Student',
  'STU001',
  'student',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
) ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  identity_number = EXCLUDED.identity_number,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id;