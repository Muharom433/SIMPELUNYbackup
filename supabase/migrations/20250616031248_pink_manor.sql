/*
  # Create equipment table and policies

  1. New Tables
    - `equipment`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `code` (text, unique, not null)
      - `category` (text, not null)
      - `is_mandatory` (boolean, default false)
      - `is_available` (boolean, default true)
      - `department_id` (uuid, foreign key to departments)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `equipment` table
    - Drop existing policies to avoid conflicts
    - Add policies for students, department admins, and super admins
    - Add updated_at trigger

  3. Sample Data
    - Insert basic equipment items for testing
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_equipment_available ON equipment(is_available);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_code ON equipment(code);
CREATE INDEX IF NOT EXISTS idx_equipment_department_id ON equipment(department_id);

-- Enable RLS
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Students can view available equipment" ON equipment;
DROP POLICY IF EXISTS "Department admins can manage their department equipment" ON equipment;
DROP POLICY IF EXISTS "Super admins can manage all equipment" ON equipment;
DROP POLICY IF EXISTS "Anyone can read available equipment" ON equipment;
DROP POLICY IF EXISTS "Department admins can manage their equipment" ON equipment;

-- Create policies
CREATE POLICY "Anyone can read available equipment"
  ON equipment
  FOR SELECT
  TO public
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

-- Drop existing trigger to avoid conflicts
DROP TRIGGER IF EXISTS update_equipment_updated_at ON equipment;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample equipment data (use ON CONFLICT to avoid duplicates)
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
  ('Timer', 'TIME-001', 'Utility', false, true, NULL)
ON CONFLICT (code) DO NOTHING;