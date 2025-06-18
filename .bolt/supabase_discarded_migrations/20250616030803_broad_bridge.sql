/*
  # Create departments and equipment tables

  1. New Tables
    - `departments`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `code` (text, unique)
      - `description` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `equipment`
      - `id` (uuid, primary key)
      - `name` (text)
      - `code` (text, unique)
      - `category` (text)
      - `is_mandatory` (boolean, default false)
      - `is_available` (boolean, default true)
      - `department_id` (uuid, foreign key to departments)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read data
    - Add policies for department admins to manage their department's data
    - Add policies for super admins to manage all data

  3. Sample Data
    - Insert sample departments
    - Insert sample equipment
*/

-- Create departments table first
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

-- RLS Policies for departments
CREATE POLICY "Users can read departments"
  ON departments
  FOR SELECT
  TO authenticated
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

-- Insert sample departments
INSERT INTO departments (name, code, description) VALUES
  ('Computer Science', 'CS', 'Department of Computer Science'),
  ('Information Systems', 'IS', 'Department of Information Systems'),
  ('Mathematics', 'MATH', 'Department of Mathematics'),
  ('Physics', 'PHYS', 'Department of Physics')
ON CONFLICT (code) DO NOTHING;

-- Now create equipment table
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
CREATE INDEX IF NOT EXISTS idx_equipment_department_id ON equipment(department_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_available ON equipment(is_available);

-- RLS Policies for equipment
CREATE POLICY "Users can read equipment"
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