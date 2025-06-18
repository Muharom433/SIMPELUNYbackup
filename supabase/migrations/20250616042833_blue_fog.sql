/*
  # Add password verification function

  1. Functions
    - `verify_password` - Function to verify bcrypt passwords
    - `encrypt_password` - Trigger function to encrypt passwords on insert/update

  2. Triggers
    - Automatically encrypt passwords when users are created or updated
*/

-- Create password verification function
CREATE OR REPLACE FUNCTION verify_password(input_password text, stored_hash text)
RETURNS boolean AS $$
BEGIN
  RETURN crypt(input_password, stored_hash) = stored_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create password encryption function for triggers
CREATE OR REPLACE FUNCTION encrypt_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Only encrypt if password has changed and is not already encrypted
  IF NEW.password IS DISTINCT FROM OLD.password OR OLD.password IS NULL THEN
    -- Check if password is already encrypted (bcrypt hashes start with $2)
    IF NEW.password !~ '^\$2[aby]?\$[0-9]{2}\$' THEN
      NEW.password = crypt(NEW.password, gen_salt('bf'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically encrypt passwords
DROP TRIGGER IF EXISTS encrypt_user_password ON users;
CREATE TRIGGER encrypt_user_password
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_password();

-- Grant execute permission on the verify_password function
GRANT EXECUTE ON FUNCTION verify_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_password(text, text) TO anon;