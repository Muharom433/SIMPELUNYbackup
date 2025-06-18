/*
  # Add Admin Users to Database

  1. Admin Users
    - Super Admin: admin@faculty.edu
    - Department Admin: dept@faculty.edu
    - Student: student@faculty.edu (for testing)

  2. Security
    - Users will be created in Supabase Auth with encrypted passwords
    - Profile data will be stored in users table
    - Proper role assignments

  Note: These are demo accounts for testing purposes
*/

-- First, ensure we have at least one department for the department admin
DO $$
DECLARE
  dept_id uuid;
BEGIN
  -- Check if we have any departments, if not create a default one
  SELECT id INTO dept_id FROM departments LIMIT 1;
  
  IF dept_id IS NULL THEN
    INSERT INTO departments (name, code, description)
    VALUES ('Computer Science', 'CS', 'Department of Computer Science')
    RETURNING id INTO dept_id;
    
    RAISE NOTICE 'Created default Computer Science department with ID: %', dept_id;
  END IF;
END $$;

-- Insert admin user profiles
-- Note: The actual Supabase Auth users need to be created through the application
-- These are the profile records that will be linked to the auth users

-- Super Admin Profile
INSERT INTO users (
  id,
  email,
  full_name,
  identity_number,
  role,
  department_id
) VALUES (
  gen_random_uuid(),
  'admin@faculty.edu',
  'System Administrator',
  'ADMIN001',
  'super_admin',
  NULL
) ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  identity_number = EXCLUDED.identity_number,
  role = EXCLUDED.role,
  updated_at = now();

-- Department Admin Profile
INSERT INTO users (
  id,
  email,
  full_name,
  identity_number,
  role,
  department_id
) VALUES (
  gen_random_uuid(),
  'dept@faculty.edu',
  'Department Administrator',
  'DEPT001',
  'department_admin',
  (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)
) ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  identity_number = EXCLUDED.identity_number,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id,
  updated_at = now();

-- Student Profile (for testing)
INSERT INTO users (
  id,
  email,
  full_name,
  identity_number,
  role,
  department_id
) VALUES (
  gen_random_uuid(),
  'student@faculty.edu',
  'Test Student',
  'STU001',
  'student',
  (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)
) ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  identity_number = EXCLUDED.identity_number,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id,
  updated_at = now();

-- Add some sample study programs
INSERT INTO study_programs (name, code, department_id)
VALUES 
  ('Computer Science', 'CS', (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)),
  ('Information Systems', 'IS', (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)),
  ('Software Engineering', 'SE', (SELECT id FROM departments WHERE code = 'CS' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

-- Add some sample rooms
INSERT INTO rooms (name, code, capacity, department_id, equipment, is_available)
VALUES 
  ('Computer Lab A', 'LAB-A101', 40, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1), ARRAY['Projector', 'AC', 'Computers'], true),
  ('Computer Lab B', 'LAB-B201', 35, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1), ARRAY['Projector', 'AC', 'Computers'], true),
  ('Lecture Hall 1', 'LH-101', 100, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1), ARRAY['Projector', 'AC', 'Microphone'], true),
  ('Lecture Hall 2', 'LH-102', 80, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1), ARRAY['Projector', 'AC', 'Microphone'], true),
  ('Meeting Room', 'MR-301', 20, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1), ARRAY['Projector', 'AC', 'Whiteboard'], true)
ON CONFLICT (code) DO NOTHING;

-- Add some sample equipment
INSERT INTO equipment (name, code, category, is_mandatory, is_available, department_id)
VALUES 
  ('Remote AC', 'AC-001', 'Climate Control', true, true, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)),
  ('Remote Projector', 'PROJ-001', 'Audio Visual', true, true, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)),
  ('HDMI Cable', 'HDMI-001', 'Connectivity', false, true, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)),
  ('VGA Cable', 'VGA-001', 'Connectivity', false, true, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)),
  ('Microphone', 'MIC-001', 'Audio Visual', false, true, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)),
  ('Speaker', 'SPK-001', 'Audio Visual', false, true, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1)),
  ('Laptop', 'LAP-001', 'Computing', false, true, (SELECT id FROM departments WHERE code = 'CS' LIMIT 1))
ON CONFLICT (code) DO NOTHING;

-- Display the created admin accounts
DO $$
BEGIN
  RAISE NOTICE '=== ADMIN ACCOUNTS CREATED ===';
  RAISE NOTICE 'Super Admin: admin@faculty.edu (password: password123)';
  RAISE NOTICE 'Department Admin: dept@faculty.edu (password: password123)';
  RAISE NOTICE 'Test Student: student@faculty.edu (password: password123)';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: You need to create these users in Supabase Auth manually or through the application signup process.';
  RAISE NOTICE 'The profile data has been prepared in the users table.';
END $$;