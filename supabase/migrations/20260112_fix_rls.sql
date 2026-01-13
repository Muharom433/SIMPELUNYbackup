-- Fix RLS Policies for attendance tables
-- This script drops existing policies and creates simple permissive policies

-- ========== attendance_week_settings ==========
DROP POLICY IF EXISTS "Finance and Super Admin can manage week settings" ON attendance_week_settings;
DROP POLICY IF EXISTS "Authenticated users can read week settings" ON attendance_week_settings;

CREATE POLICY "anon_all_week_settings" ON attendance_week_settings
    FOR ALL USING (true) WITH CHECK (true);

-- ========== attendance_special_dates ==========
DROP POLICY IF EXISTS "Finance and Super Admin can manage special dates" ON attendance_special_dates;
DROP POLICY IF EXISTS "Authenticated users can read special dates" ON attendance_special_dates;

CREATE POLICY "anon_all_special_dates" ON attendance_special_dates
    FOR ALL USING (true) WITH CHECK (true);

-- ========== attendance_payment_rates ==========
DROP POLICY IF EXISTS "Finance and Super Admin can manage payment rates" ON attendance_payment_rates;
DROP POLICY IF EXISTS "Authenticated users can read payment rates" ON attendance_payment_rates;

CREATE POLICY "anon_all_payment_rates" ON attendance_payment_rates
    FOR ALL USING (true) WITH CHECK (true);
