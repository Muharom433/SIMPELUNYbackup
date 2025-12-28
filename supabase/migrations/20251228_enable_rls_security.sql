-- Enable RLS and set generic policies for all tables
-- Usage: Run this in Supabase SQL Editor

-- Helper function to check if user is registered
CREATE OR REPLACE FUNCTION public.is_registered_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List of tables to protect
-- users, departments, study_programs, rooms, equipment, bookings, lending_tool, checkouts
-- checkout_items, checkout_violations, reports, report_comments, work_orders, system_settings
-- lecture_schedules, exam_schedules, exams, final_sessions, equipment_quantity_logs
-- forms, form_fields, form_responses, form_response_values
-- table, rack, box

-- ==============================================================================
-- 1. USERS (Special handling)
-- ==============================================================================
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for registered users" ON public.users;
CREATE POLICY "Allow read for registered users" ON public.users
  FOR SELECT TO authenticated USING (true); -- Allow all auth users to read user list (for dropdowns etc)

DROP POLICY IF EXISTS "Allow update for own profile" ON public.users;
CREATE POLICY "Allow update for own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ==============================================================================
-- 2. SYSTEM SETTINGS (Public Read, Strict Write)
-- ==============================================================================
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read system settings" ON public.system_settings;
CREATE POLICY "Public read system settings" ON public.system_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Insert for registered users" ON public.system_settings;
CREATE POLICY "Insert for registered users" ON public.system_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_registered_user());

DROP POLICY IF EXISTS "Update for registered users" ON public.system_settings;
CREATE POLICY "Update for registered users" ON public.system_settings
  FOR UPDATE TO authenticated USING (public.is_registered_user()) WITH CHECK (public.is_registered_user());

DROP POLICY IF EXISTS "Delete for registered users" ON public.system_settings;
CREATE POLICY "Delete for registered users" ON public.system_settings
  FOR DELETE TO authenticated USING (public.is_registered_user());

-- ==============================================================================
-- 3. GENERIC TABLES (Apply standard strict policy)
-- ==============================================================================

DO $$
DECLARE
  tables text[] := ARRAY[
    'departments', 'study_programs', 'rooms', 'equipment', 'bookings', 'lending_tool',
    'checkouts', 'checkout_items', 'checkout_violations', 'reports', 'report_comments',
    'work_orders', 'lecture_schedules', 'exam_schedules', 'exams',
    'final_sessions', 'equipment_quantity_logs', 'forms', 'form_fields',
    'form_responses', 'form_response_values', 'table', 'rack', 'box'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      -- Enable RLS
      EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);

      -- Drop existing policies
      EXECUTE format('DROP POLICY IF EXISTS "Read for registered users" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Insert for registered users" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Update for registered users" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Delete for registered users" ON public.%I', t);

      -- Create Read Policy (Select)
      EXECUTE format('CREATE POLICY "Read for registered users" ON public.%I FOR SELECT TO authenticated USING (public.is_registered_user())', t);

      -- Create Write Policies (Insert, Update, Delete)
      EXECUTE format('CREATE POLICY "Insert for registered users" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_registered_user())', t);
      
      EXECUTE format('CREATE POLICY "Update for registered users" ON public.%I FOR UPDATE TO authenticated USING (public.is_registered_user()) WITH CHECK (public.is_registered_user())', t);
      
      EXECUTE format('CREATE POLICY "Delete for registered users" ON public.%I FOR DELETE TO authenticated USING (public.is_registered_user())', t);

      RAISE NOTICE 'Enabled RLS and policies for table: %', t;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping table % (may not exist or error: %)', t, SQLERRM;
    END;
  END LOOP;
END $$;
