-- Add username field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Create index for username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Update existing users with usernames based on their emails
UPDATE users SET username = CASE 
  WHEN email = 'admin@faculty.edu' THEN 'admin'
  WHEN email = 'dept@faculty.edu' THEN 'deptadmin'
  WHEN email = 'student@faculty.edu' THEN 'student'
  ELSE split_part(email, '@', 1)
END
WHERE username IS NULL;

-- Make username NOT NULL after updating existing records
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- Update RLS policies to work with username
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
CREATE POLICY "Users can read their own profile" ON users FOR SELECT TO authenticated 
  USING (auth.uid() = id OR username = current_setting('app.current_username', true));

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE '=== USERNAME FIELD ADDED ===';
  RAISE NOTICE 'Updated login credentials:';
  RAISE NOTICE '- Super Admin: username "admin" (password: password123)';
  RAISE NOTICE '- Department Admin: username "deptadmin" (password: password123)';
  RAISE NOTICE '- Test Student: username "student" (password: password123)';
  RAISE NOTICE '';
  RAISE NOTICE 'Users can now login with username instead of email.';
END $$;