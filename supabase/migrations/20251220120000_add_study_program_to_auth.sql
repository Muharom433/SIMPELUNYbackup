/*
  # Add study_program_id to authenticate_user function
  
  This migration updates the authenticate_user function to return
  the study_program_id field, which is needed for laboran filtering
  in Tool Lending Management.
*/

-- Drop and recreate the authenticate_user function with study_program_id
CREATE OR REPLACE FUNCTION authenticate_user(input_username text, input_password text)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  identity_number text,
  role text,
  department_id uuid,
  study_program_id uuid,  -- ✅ ADDED
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
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::uuid, false, 'Invalid username or password';
    RETURN;
  END IF;
  
  -- Verify password
  SELECT verify_password(input_password, user_record.password) INTO password_valid;
  
  IF NOT password_valid THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::uuid, false, 'Invalid username or password';
    RETURN;
  END IF;
  
  -- Set current user context
  PERFORM set_current_user(user_record.id);
  
  -- Return user data with study_program_id
  RETURN QUERY SELECT 
    user_record.id,
    user_record.email,
    user_record.full_name,
    user_record.identity_number,
    user_record.role,
    user_record.department_id,
    user_record.study_program_id,  -- ✅ ADDED
    true,
    'Login successful'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION authenticate_user(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION authenticate_user(text, text) TO anon;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '=== AUTHENTICATE_USER UPDATED ===';
  RAISE NOTICE 'study_program_id now included in authentication response';
END $$;
