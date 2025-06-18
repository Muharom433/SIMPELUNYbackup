/*
  # Create equipment table

  1. New Tables
    - `equipment`
      - `id` (uuid, primary key)
      - `name` (text, not null) - Equipment name
      - `code` (text, unique, not null) - Equipment code/identifier
      - `category` (text, not null) - Equipment category
      - `is_mandatory` (boolean, default false) - Whether equipment is mandatory
      - `is_available` (boolean, default true) - Whether equipment is available
      - `department_id` (uuid, foreign key) - Associated department
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `equipment` table
    - Add policies for authenticated users to read equipment data
    - Add policies for department admins to manage their department's equipment
    - Add policies for super admins to manage all equipment

  3. Indexes
    - Add index on department_id for faster queries
    - Add index on category for filtering
*/

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_equipment_department_id ON equipment(department_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_available ON equipment(is_available);

-- RLS Policies

-- Allow authenticated users to read all equipment
CREATE POLICY "Users can read equipment"
  ON equipment
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow department admins to manage equipment in their department
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

-- Allow super admins to manage all equipment
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

-- Insert some sample equipment data
INSERT INTO equipment (name, code, category, is_mandatory, is_available, department_id) VALUES
  ('Projector', 'PROJ-001', 'Audio Visual', true, true, NULL),
  ('Whiteboard', 'WB-001', 'Teaching Aid', true, true, NULL),
  ('Laptop', 'LAP-001', 'Computer', false, true, NULL),
  ('Microphone', 'MIC-001', 'Audio Visual', false, true, NULL),
  ('Speaker System', 'SPK-001', 'Audio Visual', false, true, NULL),
  ('HDMI Cable', 'HDMI-001', 'Cable', false, true, NULL),
  ('Extension Cord', 'EXT-001', 'Power', false, true, NULL),
  ('Marker Set', 'MRK-001', 'Stationery', false, true, NULL);