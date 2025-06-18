/*
  # Create equipment table

  1. New Tables
    - `equipment`
      - `id` (uuid, primary key)
      - `name` (text, equipment name)
      - `code` (text, unique equipment code)
      - `category` (text, equipment category)
      - `is_mandatory` (boolean, whether equipment is mandatory for certain room types)
      - `is_available` (boolean, whether equipment is currently available)
      - `department_id` (uuid, foreign key to departments table)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `equipment` table
    - Add policies for different user roles:
      - Students can view available equipment
      - Department admins can manage equipment for their department
      - Super admins can manage all equipment

  3. Sample Data
    - Insert common equipment items for different categories
*/

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

-- Enable RLS
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Students can view available equipment"
  ON equipment
  FOR SELECT
  TO authenticated
  USING (
    is_available = true AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'student'
    )
  );

CREATE POLICY "Department admins can manage their department equipment"
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
  ('Microphone', 'MIC-001', 'Audio Visual', false, true, NULL),
  ('Laptop', 'LAP-001', 'Computing', false, true, NULL),
  ('HDMI Cable', 'HDMI-001', 'Connectivity', false, true, NULL),
  ('Extension Cord', 'EXT-001', 'Power', false, true, NULL),
  ('Marker Set', 'MARK-001', 'Teaching Aid', true, true, NULL),
  ('Eraser', 'ERAS-001', 'Teaching Aid', true, true, NULL),
  ('Screen', 'SCR-001', 'Audio Visual', false, true, NULL),
  ('Speakers', 'SPK-001', 'Audio Visual', false, true, NULL),
  ('Document Camera', 'DOC-001', 'Audio Visual', false, true, NULL),
  ('Flip Chart', 'FLIP-001', 'Teaching Aid', false, true, NULL),
  ('Pointer', 'PTR-001', 'Teaching Aid', false, true, NULL),
  ('Calculator', 'CALC-001', 'Computing', false, true, NULL),
  ('Timer', 'TIME-001', 'Utility', false, true, NULL);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();