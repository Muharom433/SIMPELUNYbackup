/*
  # Complete Database Schema Setup

  1. New Tables
    - `departments` - Academic departments
    - `users` - User profiles with roles
    - `rooms` - Room management
    - `equipment` - Equipment catalog
    - `bookings` - Room booking system
    - `study_programs` - Academic programs

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each user role
    - Ensure proper access control

  3. Sample Data
    - Basic departments
    - Essential equipment
    - Sample rooms
*/

-- Create departments table first (no dependencies)
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Create indexes for departments
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);

-- Insert sample departments first
INSERT INTO departments (name, code, description) VALUES
  ('Computer Science', 'CS', 'Department of Computer Science'),
  ('Information Systems', 'IS', 'Department of Information Systems'),
  ('Mathematics', 'MATH', 'Department of Mathematics'),
  ('Physics', 'PHYS', 'Department of Physics')
ON CONFLICT (code) DO NOTHING;

-- Create users table (references departments)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  identity_number text UNIQUE NOT NULL,
  role text DEFAULT 'student' CHECK (role IN ('student', 'department_admin', 'super_admin')),
  department_id uuid REFERENCES departments(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_identity_number ON users(identity_number);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create rooms table (references departments)
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  capacity integer NOT NULL DEFAULT 0,
  department_id uuid REFERENCES departments(id),
  equipment text[] DEFAULT '{}',
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on rooms
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Create indexes for rooms
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_department_id ON rooms(department_id);
CREATE INDEX IF NOT EXISTS idx_rooms_available ON rooms(is_available);

-- Create equipment table (references departments)
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

-- Enable RLS on equipment
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- Create indexes for equipment
CREATE INDEX IF NOT EXISTS idx_equipment_code ON equipment(code);
CREATE INDEX IF NOT EXISTS idx_equipment_department_id ON equipment(department_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_available ON equipment(is_available);

-- Create bookings table (references users and rooms)
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  room_id uuid REFERENCES rooms(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  purpose text NOT NULL,
  sks integer NOT NULL DEFAULT 1,
  class_type text DEFAULT 'theory' CHECK (class_type IN ('theory', 'practical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  equipment_requested text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create indexes for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Create study_programs table (references departments)
CREATE TABLE IF NOT EXISTS study_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  department_id uuid REFERENCES departments(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on study_programs
ALTER TABLE study_programs ENABLE ROW LEVEL SECURITY;

-- Create indexes for study_programs
CREATE INDEX IF NOT EXISTS idx_study_programs_code ON study_programs(code);
CREATE INDEX IF NOT EXISTS idx_study_programs_department_id ON study_programs(department_id);

-- RLS Policies for departments
CREATE POLICY "Anyone can read departments"
  ON departments
  FOR SELECT
  USING (true);

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
  );

-- RLS Policies for users
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
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- RLS Policies for rooms
CREATE POLICY "Anyone can read available rooms"
  ON rooms
  FOR SELECT
  USING (is_available = true);

CREATE POLICY "Department admins can manage their rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'department_admin'
      AND users.department_id = rooms.department_id
    )
  );

CREATE POLICY "Super admins can manage all rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- RLS Policies for equipment
CREATE POLICY "Anyone can read available equipment"
  ON equipment
  FOR SELECT
  USING (is_available = true);

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
  );

-- RLS Policies for bookings
CREATE POLICY "Users can read their own bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

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
  );

CREATE POLICY "Super admins can manage all bookings"
  ON bookings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- RLS Policies for study_programs
CREATE POLICY "Anyone can read study programs"
  ON study_programs
  FOR SELECT
  USING (true);

CREATE POLICY "Department admins can manage their study programs"
  ON study_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'department_admin'
      AND users.department_id = study_programs.department_id
    )
  );

CREATE POLICY "Super admins can manage all study programs"
  ON study_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Insert sample equipment data
INSERT INTO equipment (name, code, category, is_mandatory, is_available, department_id) VALUES
  ('Projector', 'PROJ-001', 'Audio Visual', true, true, NULL),
  ('Whiteboard', 'WB-001', 'Teaching Aid', true, true, NULL),
  ('Laptop', 'LAP-001', 'Computer', false, true, NULL),
  ('Microphone', 'MIC-001', 'Audio Visual', false, true, NULL),
  ('Speaker System', 'SPK-001', 'Audio Visual', false, true, NULL),
  ('HDMI Cable', 'HDMI-001', 'Cable', false, true, NULL),
  ('Extension Cord', 'EXT-001', 'Power', false, true, NULL),
  ('Marker Set', 'MRK-001', 'Stationery', false, true, NULL)
ON CONFLICT (code) DO NOTHING;

-- Insert sample rooms data
INSERT INTO rooms (name, code, capacity, department_id, is_available) 
SELECT 
  'Room ' || code || '-101', 
  code || '-101', 
  30, 
  id, 
  true
FROM departments
ON CONFLICT (code) DO NOTHING;

INSERT INTO rooms (name, code, capacity, department_id, is_available) 
SELECT 
  'Room ' || code || '-102', 
  code || '-102', 
  50, 
  id, 
  true
FROM departments
ON CONFLICT (code) DO NOTHING;

-- Insert sample study programs
INSERT INTO study_programs (name, code, department_id)
SELECT 
  CASE 
    WHEN departments.code = 'CS' THEN 'Bachelor of Computer Science'
    WHEN departments.code = 'IS' THEN 'Bachelor of Information Systems'
    WHEN departments.code = 'MATH' THEN 'Bachelor of Mathematics'
    WHEN departments.code = 'PHYS' THEN 'Bachelor of Physics'
  END,
  'S1-' || departments.code,
  departments.id
FROM departments
ON CONFLICT (code) DO NOTHING;