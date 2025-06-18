/*
  # Complete Faculty Room Booking System Database Schema
  
  This migration creates the complete database schema with proper authentication support.
  
  ## Tables Created:
  1. departments - Academic departments
  2. users - User profiles (linked to Supabase Auth)
  3. study_programs - Academic programs within departments
  4. rooms - Bookable rooms with equipment
  5. equipment - Available equipment for booking
  6. bookings - Room booking records
  
  ## Security:
  - Row Level Security (RLS) enabled on all tables
  - Proper policies for different user roles
  - Password encryption using bcrypt
  
  ## Sample Data:
  - Default Computer Science department
  - Admin accounts with encrypted passwords
  - Sample rooms, equipment, and study programs
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table (profiles linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, -- This will be the Supabase Auth user ID
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  identity_number text UNIQUE NOT NULL,
  role text DEFAULT 'student' CHECK (role IN ('student', 'department_admin', 'super_admin')),
  department_id uuid REFERENCES departments(id),
  password text NOT NULL, -- Encrypted password for custom auth
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create study programs table
CREATE TABLE IF NOT EXISTS study_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  department_id uuid REFERENCES departments(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  capacity integer DEFAULT 0,
  department_id uuid REFERENCES departments(id),
  equipment text[] DEFAULT '{}',
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  category text NOT NULL,
  is_mandatory boolean DEFAULT false,
  is_available boolean DEFAULT true,
  department_id uuid REFERENCES departments(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  room_id uuid REFERENCES rooms(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  purpose text NOT NULL,
  sks integer DEFAULT 1,
  class_type text DEFAULT 'theory' CHECK (class_type IN ('theory', 'practical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  equipment_requested text[] DEFAULT '{}',
  notes text,
  user_info jsonb, -- For non-logged users
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_identity_number ON users(identity_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);

CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);

CREATE INDEX IF NOT EXISTS idx_study_programs_code ON study_programs(code);
CREATE INDEX IF NOT EXISTS idx_study_programs_department_id ON study_programs(department_id);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_department_id ON rooms(department_id);
CREATE INDEX IF NOT EXISTS idx_rooms_available ON rooms(is_available);

CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_available ON equipment(is_available);
CREATE INDEX IF NOT EXISTS idx_equipment_department_id ON equipment(department_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Enable Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Departments policies
CREATE POLICY "Anyone can read departments" ON departments FOR SELECT TO public USING (true);
CREATE POLICY "Super admins can manage departments" ON departments FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

-- Users policies
CREATE POLICY "Users can read their own profile" ON users FOR SELECT TO authenticated 
  USING (auth.uid() = id);
CREATE POLICY "Super admins can read all users" ON users FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM users users_1 WHERE users_1.id = auth.uid() AND users_1.role = 'super_admin'));
CREATE POLICY "Super admins can manage all users" ON users FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users users_1 WHERE users_1.id = auth.uid() AND users_1.role = 'super_admin'));

-- Study programs policies
CREATE POLICY "Anyone can read study programs" ON study_programs FOR SELECT TO public USING (true);
CREATE POLICY "Super admins can manage all study programs" ON study_programs FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));
CREATE POLICY "Department admins can manage their study programs" ON study_programs FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'department_admin' AND users.department_id = study_programs.department_id));

-- Rooms policies
CREATE POLICY "Anyone can read available rooms" ON rooms FOR SELECT TO public USING (is_available = true);
CREATE POLICY "Super admins can manage all rooms" ON rooms FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));
CREATE POLICY "Department admins can manage their rooms" ON rooms FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'department_admin' AND users.department_id = rooms.department_id));

-- Equipment policies
CREATE POLICY "Users can read equipment" ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage all equipment" ON equipment FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));
CREATE POLICY "Department admins can manage their equipment" ON equipment FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'department_admin' AND users.department_id = equipment.department_id));

-- Bookings policies
CREATE POLICY "Users can read their own bookings" ON bookings FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookings" ON bookings FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pending bookings" ON bookings FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id AND status = 'pending') WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all bookings" ON bookings FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));
CREATE POLICY "Department admins can manage bookings in their department" ON bookings FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users u JOIN rooms r ON r.id = bookings.room_id WHERE u.id = auth.uid() AND u.role = 'department_admin' AND u.department_id = r.department_id));

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_study_programs_updated_at BEFORE UPDATE ON study_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
DO $$
DECLARE
  cs_dept_id uuid;
  admin_user_id uuid;
  dept_admin_user_id uuid;
  student_user_id uuid;
BEGIN
  -- Create default department
  INSERT INTO departments (name, code, description)
  VALUES ('Computer Science', 'CS', 'Department of Computer Science and Information Technology')
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = now()
  RETURNING id INTO cs_dept_id;

  -- If no ID was returned (conflict), get the existing one
  IF cs_dept_id IS NULL THEN
    SELECT id INTO cs_dept_id FROM departments WHERE code = 'CS';
  END IF;

  -- Create admin users with encrypted passwords
  admin_user_id := gen_random_uuid();
  INSERT INTO users (id, email, full_name, identity_number, role, department_id, password)
  VALUES (
    admin_user_id,
    'admin@faculty.edu',
    'System Administrator',
    'ADMIN001',
    'super_admin',
    NULL,
    crypt('password123', gen_salt('bf'))
  ) ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    identity_number = EXCLUDED.identity_number,
    role = EXCLUDED.role,
    password = EXCLUDED.password,
    updated_at = now();

  dept_admin_user_id := gen_random_uuid();
  INSERT INTO users (id, email, full_name, identity_number, role, department_id, password)
  VALUES (
    dept_admin_user_id,
    'dept@faculty.edu',
    'Department Administrator',
    'DEPT001',
    'department_admin',
    cs_dept_id,
    crypt('password123', gen_salt('bf'))
  ) ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    identity_number = EXCLUDED.identity_number,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    password = EXCLUDED.password,
    updated_at = now();

  student_user_id := gen_random_uuid();
  INSERT INTO users (id, email, full_name, identity_number, role, department_id, password)
  VALUES (
    student_user_id,
    'student@faculty.edu',
    'Test Student',
    'STU001',
    'student',
    cs_dept_id,
    crypt('password123', gen_salt('bf'))
  ) ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    identity_number = EXCLUDED.identity_number,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    password = EXCLUDED.password,
    updated_at = now();

  -- Create study programs
  INSERT INTO study_programs (name, code, department_id)
  VALUES 
    ('Computer Science', 'CS', cs_dept_id),
    ('Information Systems', 'IS', cs_dept_id),
    ('Software Engineering', 'SE', cs_dept_id),
    ('Data Science', 'DS', cs_dept_id)
  ON CONFLICT (code) DO NOTHING;

  -- Create sample rooms
  INSERT INTO rooms (name, code, capacity, department_id, equipment, is_available)
  VALUES 
    ('Computer Lab A', 'LAB-A101', 40, cs_dept_id, ARRAY['Projector', 'AC', 'Computers', 'Whiteboard'], true),
    ('Computer Lab B', 'LAB-B201', 35, cs_dept_id, ARRAY['Projector', 'AC', 'Computers', 'Whiteboard'], true),
    ('Computer Lab C', 'LAB-C301', 30, cs_dept_id, ARRAY['Projector', 'AC', 'Computers', 'Whiteboard'], true),
    ('Lecture Hall 1', 'LH-101', 100, cs_dept_id, ARRAY['Projector', 'AC', 'Microphone', 'Speaker'], true),
    ('Lecture Hall 2', 'LH-102', 80, cs_dept_id, ARRAY['Projector', 'AC', 'Microphone', 'Speaker'], true),
    ('Lecture Hall 3', 'LH-103', 120, cs_dept_id, ARRAY['Projector', 'AC', 'Microphone', 'Speaker'], true),
    ('Meeting Room A', 'MR-A301', 20, cs_dept_id, ARRAY['Projector', 'AC', 'Whiteboard'], true),
    ('Meeting Room B', 'MR-B302', 15, cs_dept_id, ARRAY['Projector', 'AC', 'Whiteboard'], true),
    ('Seminar Room', 'SR-401', 50, cs_dept_id, ARRAY['Projector', 'AC', 'Microphone', 'Whiteboard'], true),
    ('Multimedia Room', 'MM-501', 25, cs_dept_id, ARRAY['Projector', 'AC', 'Computers', 'Audio System'], true)
  ON CONFLICT (code) DO NOTHING;

  -- Create sample equipment
  INSERT INTO equipment (name, code, category, is_mandatory, is_available, department_id)
  VALUES 
    -- Mandatory equipment (auto-selected)
    ('Air Conditioning Remote', 'AC-001', 'Climate Control', true, true, cs_dept_id),
    ('Projector Remote', 'PROJ-001', 'Audio Visual', true, true, cs_dept_id),
    ('Basic Lighting', 'LIGHT-001', 'Lighting', true, true, cs_dept_id),
    
    -- Optional equipment
    ('HDMI Cable', 'HDMI-001', 'Connectivity', false, true, cs_dept_id),
    ('VGA Cable', 'VGA-001', 'Connectivity', false, true, cs_dept_id),
    ('USB-C Hub', 'USB-001', 'Connectivity', false, true, cs_dept_id),
    ('Wireless Microphone', 'MIC-001', 'Audio Visual', false, true, cs_dept_id),
    ('Lapel Microphone', 'MIC-002', 'Audio Visual', false, true, cs_dept_id),
    ('Bluetooth Speaker', 'SPK-001', 'Audio Visual', false, true, cs_dept_id),
    ('Portable Speaker', 'SPK-002', 'Audio Visual', false, true, cs_dept_id),
    ('Laptop (Backup)', 'LAP-001', 'Computing', false, true, cs_dept_id),
    ('Tablet for Presentation', 'TAB-001', 'Computing', false, true, cs_dept_id),
    ('Document Camera', 'CAM-001', 'Audio Visual', false, true, cs_dept_id),
    ('Webcam HD', 'CAM-002', 'Audio Visual', false, true, cs_dept_id),
    ('Extension Cord', 'PWR-001', 'Power', false, true, cs_dept_id),
    ('Power Strip', 'PWR-002', 'Power', false, true, cs_dept_id),
    ('Whiteboard Markers', 'MARK-001', 'Stationery', false, true, cs_dept_id),
    ('Laser Pointer', 'PTR-001', 'Presentation', false, true, cs_dept_id)
  ON CONFLICT (code) DO NOTHING;

  -- Log success
  RAISE NOTICE '=== DATABASE SCHEMA CREATED SUCCESSFULLY ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Admin Accounts Created:';
  RAISE NOTICE '- Super Admin: admin@faculty.edu (password: password123)';
  RAISE NOTICE '- Department Admin: dept@faculty.edu (password: password123)';
  RAISE NOTICE '- Test Student: student@faculty.edu (password: password123)';
  RAISE NOTICE '';
  RAISE NOTICE 'Sample Data Added:';
  RAISE NOTICE '- 1 Department (Computer Science)';
  RAISE NOTICE '- 4 Study Programs';
  RAISE NOTICE '- 10 Rooms with various capacities';
  RAISE NOTICE '- 18 Equipment items (3 mandatory, 15 optional)';
  RAISE NOTICE '';
  RAISE NOTICE 'All passwords are encrypted using bcrypt.';
  RAISE NOTICE 'Row Level Security is enabled on all tables.';
END $$;