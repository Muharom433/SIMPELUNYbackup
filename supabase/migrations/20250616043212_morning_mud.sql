/*
  # Add username field to users table

  1. Schema Changes
    - Add username column if it doesn't exist
    - Create unique constraint and index
    - Update existing users with usernames
    - Make username NOT NULL

  2. Security
    - Update RLS policies to work with username authentication
    - Maintain existing security model

  3. Data Migration
    - Safely update existing users with usernames
    - Handle conflicts gracefully
*/

-- Check if username column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE users ADD COLUMN username text;
    RAISE NOTICE 'Added username column to users table';
  ELSE
    RAISE NOTICE 'Username column already exists';
  END IF;
END $$;

-- Create unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'users' AND constraint_name = 'users_username_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    RAISE NOTICE 'Added unique constraint for username';
  ELSE
    RAISE NOTICE 'Username unique constraint already exists';
  END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Update existing users with usernames, handling conflicts
DO $$
DECLARE
  user_record RECORD;
  new_username text;
  counter int;
BEGIN
  FOR user_record IN SELECT id, email FROM users WHERE username IS NULL LOOP
    -- Determine base username
    new_username := CASE 
      WHEN user_record.email = 'admin@faculty.edu' THEN 'admin'
      WHEN user_record.email = 'dept@faculty.edu' THEN 'deptadmin'
      WHEN user_record.email = 'student@faculty.edu' THEN 'student'
      ELSE split_part(user_record.email, '@', 1)
    END;
    
    -- Handle conflicts by adding numbers
    counter := 0;
    WHILE EXISTS (SELECT 1 FROM users WHERE username = new_username) LOOP
      counter := counter + 1;
      new_username := CASE 
        WHEN user_record.email = 'admin@faculty.edu' THEN 'admin' || counter
        WHEN user_record.email = 'dept@faculty.edu' THEN 'deptadmin' || counter
        WHEN user_record.email = 'student@faculty.edu' THEN 'student' || counter
        ELSE split_part(user_record.email, '@', 1) || counter
      END;
    END LOOP;
    
    -- Update the user with the unique username
    UPDATE users SET username = new_username WHERE id = user_record.id;
    RAISE NOTICE 'Updated user % with username: %', user_record.email, new_username;
  END LOOP;
END $$;

-- Make username NOT NULL after updating existing records
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'username' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    RAISE NOTICE 'Set username column to NOT NULL';
  ELSE
    RAISE NOTICE 'Username column is already NOT NULL';
  END IF;
END $$;

-- Update RLS policies to work with username
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
CREATE POLICY "Users can read their own profile" ON users FOR SELECT TO authenticated 
  USING (auth.uid() = id);

-- Log the final state
DO $$
DECLARE
  user_record RECORD;
BEGIN
  RAISE NOTICE '=== USERNAME MIGRATION COMPLETED ===';
  RAISE NOTICE 'Current user accounts:';
  
  FOR user_record IN 
    SELECT username, email, role 
    FROM users 
    WHERE email IN ('admin@faculty.edu', 'dept@faculty.edu', 'student@faculty.edu')
    ORDER BY role DESC
  LOOP
    RAISE NOTICE '- %: username "%s" (role: %)', user_record.email, user_record.username, user_record.role;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'All users can now login with their username and password.';
  RAISE NOTICE 'Default password for demo accounts: password123';
END $$;