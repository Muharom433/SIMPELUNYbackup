/*
  # Fix Authentication System

  1. Create proper authentication functions
  2. Update RLS policies to work with custom auth
  3. Add session management
  4. Fix login functionality
*/

-- Create a function to set the current user context
CREATE OR REPLACE FUNCTION set_current_user(user_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get the current user ID
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_user_id', true)::uuid, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to authenticate users
CREATE OR REPLACE FUNCTION authenticate_user(input_username text, input_password text)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  identity_number text,
  role text,
  department_id uuid,
  success boolean,
  message text
) AS $$
DECLARE
  user_record users%ROWTYPE;
  password_valid boolean;
BEGIN
  -- Find user by username
  SELECT * INTO user_record FROM users WHERE username = input_username;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::uuid, false, 'Invalid username or password';
    RETURN;
  END IF;
  
  -- Verify password
  SELECT verify_password(input_password, user_record.password) INTO password_valid;
  
  IF NOT password_valid THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::uuid, false, 'Invalid username or password';
    RETURN;
  END IF;
  
  -- Set current user context
  PERFORM set_current_user(user_record.id);
  
  -- Return user data
  RETURN QUERY SELECT 
    user_record.id,
    user_record.email,
    user_record.full_name,
    user_record.identity_number,
    user_record.role,
    user_record.department_id,
    true,
    'Login successful'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Super admins can read all users" ON users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;

-- Create new RLS policies that work with our custom auth
CREATE POLICY "Users can read their own profile" ON users FOR SELECT 
  USING (id = get_current_user_id());

CREATE POLICY "Super admins can read all users" ON users FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage all users" ON users FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() AND role = 'super_admin'
    )
  );

-- Update other RLS policies to use our custom auth
DROP POLICY IF EXISTS "Super admins can manage departments" ON departments;
CREATE POLICY "Super admins can manage departments" ON departments FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can manage all study programs" ON study_programs;
DROP POLICY IF EXISTS "Department admins can manage their study programs" ON study_programs;

CREATE POLICY "Super admins can manage all study programs" ON study_programs FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() AND role = 'super_admin'
    )
  );

CREATE POLICY "Department admins can manage their study programs" ON study_programs FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() 
        AND role = 'department_admin' 
        AND department_id = study_programs.department_id
    )
  );

-- Update rooms policies
DROP POLICY IF EXISTS "Super admins can manage all rooms" ON rooms;
DROP POLICY IF EXISTS "Department admins can manage their rooms" ON rooms;

CREATE POLICY "Super admins can manage all rooms" ON rooms FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() AND role = 'super_admin'
    )
  );

CREATE POLICY "Department admins can manage their rooms" ON rooms FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() 
        AND role = 'department_admin' 
        AND department_id = rooms.department_id
    )
  );

-- Update equipment policies
DROP POLICY IF EXISTS "Super admins can manage all equipment" ON equipment;
DROP POLICY IF EXISTS "Department admins can manage their equipment" ON equipment;

CREATE POLICY "Super admins can manage all equipment" ON equipment FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() AND role = 'super_admin'
    )
  );

CREATE POLICY "Department admins can manage their equipment" ON equipment FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() 
        AND role = 'department_admin' 
        AND department_id = equipment.department_id
    )
  );

-- Update bookings policies
DROP POLICY IF EXISTS "Users can read their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own pending bookings" ON bookings;
DROP POLICY IF EXISTS "Super admins can manage all bookings" ON bookings;
DROP POLICY IF EXISTS "Department admins can manage bookings in their department" ON bookings;

CREATE POLICY "Users can read their own bookings" ON bookings FOR SELECT 
  USING (user_id = get_current_user_id());

CREATE POLICY "Users can create bookings" ON bookings FOR INSERT 
  WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update their own pending bookings" ON bookings FOR UPDATE 
  USING (user_id = get_current_user_id() AND status = 'pending') 
  WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Super admins can manage all bookings" ON bookings FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = get_current_user_id() AND role = 'super_admin'
    )
  );

CREATE POLICY "Department admins can manage bookings in their department" ON bookings FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      JOIN rooms r ON r.id = bookings.room_id 
      WHERE u.id = get_current_user_id() 
        AND u.role = 'department_admin' 
        AND u.department_id = r.department_id
    )
  );

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_current_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_current_user(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO anon;
GRANT EXECUTE ON FUNCTION authenticate_user(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION authenticate_user(text, text) TO anon;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '=== AUTHENTICATION SYSTEM FIXED ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Available login credentials:';
  RAISE NOTICE '- Username: admin (Super Admin)';
  RAISE NOTICE '- Username: deptadmin (Department Admin)';
  RAISE NOTICE '- Username: student (Student)';
  RAISE NOTICE '- Password: password123 (for all accounts)';
  RAISE NOTICE '';
  RAISE NOTICE 'Authentication functions created:';
  RAISE NOTICE '- authenticate_user(username, password)';
  RAISE NOTICE '- set_current_user(user_id)';
  RAISE NOTICE '- get_current_user_id()';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS policies updated to work with custom authentication.';
END $$;