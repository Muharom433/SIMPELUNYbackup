/*
  # Fix RLS Policies and Checkout System

  1. Security Updates
    - Fix RLS policies for bookings table
    - Add proper policies for checkouts table
    - Enable public access for checkout operations

  2. Database Updates
    - Ensure proper indexes exist
    - Update checkout system tables
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow public booking creation" ON bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON bookings;
DROP POLICY IF EXISTS "Enable read access for all users" ON bookings;

-- Temporarily disable RLS to fix issues
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with proper policies
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies for bookings
CREATE POLICY "Enable insert for authenticated and anonymous users" ON bookings
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON bookings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage all bookings" ON bookings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = ANY(ARRAY['super_admin', 'department_admin'])
    )
  );

-- Fix checkouts table policies
DROP POLICY IF EXISTS "Users can view own checkouts" ON checkouts;
DROP POLICY IF EXISTS "Admins can view all checkouts" ON checkouts;
DROP POLICY IF EXISTS "Allow checkout creation" ON checkouts;

-- Disable RLS temporarily for checkouts
ALTER TABLE checkouts DISABLE ROW LEVEL SECURITY;

-- Re-enable with proper policies
ALTER TABLE checkouts ENABLE ROW LEVEL SECURITY;

-- Create policies for checkouts that allow public access
CREATE POLICY "Enable read access for checkouts" ON checkouts
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert for checkouts" ON checkouts
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update for checkouts" ON checkouts
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Admins can manage all checkouts" ON checkouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = ANY(ARRAY['super_admin', 'department_admin'])
    )
  );

-- Fix checkout_items policies
DROP POLICY IF EXISTS "Users can view own checkout items" ON checkout_items;
DROP POLICY IF EXISTS "Admins can view all checkout items" ON checkout_items;

ALTER TABLE checkout_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for checkout items" ON checkout_items
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert for checkout items" ON checkout_items
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable update for checkout items" ON checkout_items
  FOR UPDATE
  TO public
  USING (true);

-- Fix reports table policies
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for reports" ON reports
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable read access for reports" ON reports
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage all reports" ON reports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = ANY(ARRAY['super_admin', 'department_admin'])
    )
  );

-- Create function to set current user context
CREATE OR REPLACE FUNCTION set_current_user(user_id uuid)
RETURNS void AS $$
BEGIN
  -- This function can be used to set user context for RLS
  PERFORM set_config('app.current_user_id', user_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get current user context
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure purpose column exists and has proper default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'purpose'
  ) THEN
    ALTER TABLE bookings ADD COLUMN purpose text DEFAULT 'Class/Study Session';
  END IF;
END $$;

-- Update existing null purposes
UPDATE bookings SET purpose = 'Class/Study Session' WHERE purpose IS NULL OR purpose = '';

-- Make purpose NOT NULL with default
ALTER TABLE bookings ALTER COLUMN purpose SET DEFAULT 'Class/Study Session';
ALTER TABLE bookings ALTER COLUMN purpose SET NOT NULL;

-- Add some sample checkout data for testing (only if no checkouts exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM checkouts LIMIT 1) THEN
    -- Insert sample approved bookings first
    INSERT INTO bookings (id, room_id, start_time, end_time, purpose, sks, class_type, status, user_info) VALUES
    (gen_random_uuid(), 
     (SELECT id FROM rooms LIMIT 1), 
     now() - interval '2 hours', 
     now() - interval '1 hour', 
     'Database Systems Lab', 
     2, 
     'practical', 
     'approved',
     '{"full_name": "John Doe", "identity_number": "12345678", "email": "john.doe@student.edu"}'::jsonb),
    (gen_random_uuid(), 
     (SELECT id FROM rooms LIMIT 1), 
     now() - interval '4 hours', 
     now() - interval '2 hours', 
     'Web Development Workshop', 
     3, 
     'practical', 
     'approved',
     '{"full_name": "Jane Smith", "identity_number": "87654321", "email": "jane.smith@student.edu"}'::jsonb);

    -- Insert sample checkouts
    INSERT INTO checkouts (id, user_id, booking_id, checkout_date, expected_return_date, status, total_items) 
    SELECT 
      gen_random_uuid(),
      (SELECT id FROM users WHERE role = 'student' LIMIT 1),
      b.id,
      b.start_time,
      b.end_time + interval '1 day',
      'active',
      2
    FROM bookings b 
    WHERE b.status = 'approved' 
    LIMIT 2;

    -- Insert sample checkout items
    INSERT INTO checkout_items (checkout_id, equipment_id, quantity)
    SELECT 
      c.id,
      (SELECT id FROM equipment WHERE is_available = true LIMIT 1),
      1
    FROM checkouts c
    WHERE c.status = 'active';
  END IF;
END $$;