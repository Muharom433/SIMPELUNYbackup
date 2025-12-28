-- Fix RLS Policies to ensure authenticated users can access data
-- This script simplifies the check to just "is the user logged in?" for read operations
-- ignoring the "is_registered_user" check which requires a row in public.users table.

-- Function to check generic authentication (standard Supabase check)
-- We don't need a custom function for this, we can just use permissions "TO authenticated"

-- ==============================================================================
-- 1. REFERENCE TABLES (Read All, Write Admin/Registered)
-- ==============================================================================
-- These tables define the system structure and should be readable by any logged-in user.

DO $$
DECLARE
  -- Tables that should be readable by ANY authenticated user
  tables text[] := ARRAY[
    'users', 'departments', 'study_programs', 'rooms', 'equipment', 
    'lecture_schedules', 'exam_schedules', 'exams', 'final_sessions', 
    'table', 'rack', 'box', 'bookings', 'lending_tool', 'checkouts', 'reports'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      -- Ensure RLS is enabled
      EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);

      -- DROP existing policies to avoid conflicts
      EXECUTE format('DROP POLICY IF EXISTS "Read for registered users" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow read for registered users" ON public.%I', t); -- specific to users table
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated Read" ON public.%I', t); -- cleanup

      -- CREATE NEW SIMPLE READ POLICY
      -- "TO authenticated" means any user with a valid token can run this.
      -- "USING (true)" means they can see all rows.
      EXECUTE format('CREATE POLICY "Authenticated Read" ON public.%I FOR SELECT TO authenticated USING (true)', t);

      RAISE NOTICE 'Updated Read Policy for table: %', t;
    END;
  END LOOP;
END $$;

-- ==============================================================================
-- 2. SYSTEM SETTINGS (Public Read)
-- ==============================================================================
-- Ensure system settings are readable by everyone (even without login) for the login page logo.

ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read system settings" ON public.system_settings;
CREATE POLICY "Public read system settings" ON public.system_settings FOR SELECT TO anon, authenticated USING (true);


-- ==============================================================================
-- 3. EXPLANATION
-- ==============================================================================
-- "Authenticated" is categorized by Supabase automatically when a user logs in.
-- The "authenticated" role is assigned to the request.
-- By using "TO authenticated" and "USING (true)", we allow any logged-in user to see the data.
-- This bypasses the need for a lookup in the 'users' table, assuming that if they can log in, they should see the data.
