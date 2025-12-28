-- Enable Public Access for Custom Auth System
-- Since the application uses a custom 'users' table and not Supabase Auth,
-- all requests come in as 'anon' (Anonymous).
-- We must allow the 'anon' role to access the tables, or else the app will not work.

-- ==============================================================================
-- 1. UTILITY FUNCTION
-- ==============================================================================
-- We can't use auth.uid() or standard auth policies.
-- We rely on the client application to handle authentication logic (as it currently does).

-- ==============================================================================
-- 2. APPLY PERMISSIVE POLICIES (Read & Write for Anon)
-- ==============================================================================

DO $$
DECLARE
  -- List of all tables that need access
  tables text[] := ARRAY[
    'users', 'departments', 'study_programs', 'rooms', 'equipment', 
    'bookings', 'lending_tool', 'checkouts', 'checkout_items', 'checkout_violations',
    'reports', 'report_comments', 'work_orders', 'system_settings',
    'lecture_schedules', 'exam_schedules', 'exams', 'final_sessions', 
    'equipment_quantity_logs', 'forms', 'form_fields', 'form_responses', 
    'form_response_values', 'table', 'rack', 'box'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      -- Ensure RLS is enabled (good practice even if permissive)
      EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);

      -- DROP existing restrictive policies
      EXECUTE format('DROP POLICY IF EXISTS "Read for registered users" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Insert for registered users" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Update for registered users" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Delete for registered users" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated Read" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Public read system settings" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow read for registered users" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow update for own profile" ON public.%I', t);

      -- CREATE PUBLIC READ POLICY
      -- "TO anon, authenticated" covers both unsigned and signed requests (though here primarily anon)
      EXECUTE format('CREATE POLICY "Public Read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);

      -- CREATE PUBLIC WRITE POLICIES
      -- Since we can't verify the user ID at DB level without Supabase Auth,
      -- we must trust the client application (Postgres will allow writes from anon key).
      EXECUTE format('CREATE POLICY "Public Insert" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t);
      EXECUTE format('CREATE POLICY "Public Update" ON public.%I FOR UPDATE TO anon, authenticated USING (true)', t);
      EXECUTE format('CREATE POLICY "Public Delete" ON public.%I FOR DELETE TO anon, authenticated USING (true)', t);

      RAISE NOTICE 'Enabled Public Access for table: %', t;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping table % (may not exist)', t;
    END;
  END LOOP;
END $$;
