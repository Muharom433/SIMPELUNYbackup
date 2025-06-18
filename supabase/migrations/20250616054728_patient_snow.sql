/*
  # Disable RLS for Development

  This migration temporarily disables Row Level Security (RLS) on all tables
  to allow easier development and testing. 
  
  **IMPORTANT**: This should only be used in development environments.
  Re-enable RLS before going to production!

  ## Changes
  1. Disable RLS on all tables
  2. Drop existing policies (they can be recreated later)
  3. Add comments for easy re-enabling

  ## Tables affected:
  - users
  - departments  
  - study_programs
  - rooms
  - equipment
  - bookings
*/

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to clean up
-- Users policies
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;
DROP POLICY IF EXISTS "Super admins can read all users" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "auth" ON users;

-- Departments policies
DROP POLICY IF EXISTS "Public can read departments" ON departments;
DROP POLICY IF EXISTS "Super admins can manage departments" ON departments;

-- Study programs policies
DROP POLICY IF EXISTS "Department admins can manage dept study programs" ON study_programs;
DROP POLICY IF EXISTS "Public can read study programs" ON study_programs;
DROP POLICY IF EXISTS "Super admins can manage study programs" ON study_programs;

-- Rooms policies
DROP POLICY IF EXISTS "Department admins can manage dept rooms" ON rooms;
DROP POLICY IF EXISTS "Public can read available rooms" ON rooms;
DROP POLICY IF EXISTS "Super admins can manage rooms" ON rooms;

-- Equipment policies
DROP POLICY IF EXISTS "Authenticated can read all equipment" ON equipment;
DROP POLICY IF EXISTS "Department admins can manage dept equipment" ON equipment;
DROP POLICY IF EXISTS "Public can read available equipment" ON equipment;
DROP POLICY IF EXISTS "Super admins can manage equipment" ON equipment;

-- Bookings policies
DROP POLICY IF EXISTS "Department admins can manage dept bookings" ON bookings;
DROP POLICY IF EXISTS "Super admins can manage bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can read own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own pending bookings" ON bookings;

-- Add helpful comments
COMMENT ON TABLE users IS 'RLS DISABLED FOR DEVELOPMENT - Remember to re-enable before production!';
COMMENT ON TABLE departments IS 'RLS DISABLED FOR DEVELOPMENT - Remember to re-enable before production!';
COMMENT ON TABLE study_programs IS 'RLS DISABLED FOR DEVELOPMENT - Remember to re-enable before production!';
COMMENT ON TABLE rooms IS 'RLS DISABLED FOR DEVELOPMENT - Remember to re-enable before production!';
COMMENT ON TABLE equipment IS 'RLS DISABLED FOR DEVELOPMENT - Remember to re-enable before production!';
COMMENT ON TABLE bookings IS 'RLS DISABLED FOR DEVELOPMENT - Remember to re-enable before production!';