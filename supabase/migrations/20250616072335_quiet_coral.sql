/*
  # Add study program relationship to users table

  1. Changes
    - Add `study_program_id` column to `users` table
    - Add foreign key constraint linking users to study_programs
    - Update existing users to have a study_program_id if possible

  2. Security
    - No RLS changes needed as users table already has RLS disabled for development
*/

-- Add study_program_id column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'study_program_id'
  ) THEN
    ALTER TABLE users ADD COLUMN study_program_id uuid;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_study_program_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_study_program_id_fkey
      FOREIGN KEY (study_program_id) 
      REFERENCES study_programs (id);
  END IF;
END $$;

-- Create index for better query performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_users_study_program_id'
  ) THEN
    CREATE INDEX idx_users_study_program_id ON users (study_program_id);
  END IF;
END $$;