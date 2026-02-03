-- POLICY UNTUK MEMBUKA AKSES PENUH (BACKUP & DELETE) BAGI USER LOGGED-IN
-- Jalankan script ini di Supabase SQL Editor untuk mengatasi masalah "Tidak ada data" saat backup.
-- Script ini memberikan hak akses SELECT, INSERT, UPDATE, DELETE ke semua table terkait bagi user yang sudah login (authenticated).

BEGIN;

-- 1. Checkouts & Items
ALTER TABLE checkouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON checkouts;
CREATE POLICY "Enable all access for authenticated users" ON checkouts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE checkout_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON checkout_items;
CREATE POLICY "Enable all access for authenticated users" ON checkout_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE checkout_violations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON checkout_violations;
CREATE POLICY "Enable all access for authenticated users" ON checkout_violations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON bookings;
CREATE POLICY "Enable all access for authenticated users" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Lending Tools
ALTER TABLE lending_tool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON lending_tool;
CREATE POLICY "Enable all access for authenticated users" ON lending_tool FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON notifications;
CREATE POLICY "Enable all access for authenticated users" ON notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON reports;
CREATE POLICY "Enable all access for authenticated users" ON reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Attendance
ALTER TABLE lecturer_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON lecturer_attendance;
CREATE POLICY "Enable all access for authenticated users" ON lecturer_attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE lecturer_attendance_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON lecturer_attendance_details;
CREATE POLICY "Enable all access for authenticated users" ON lecturer_attendance_details FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Tasks & Forms
ALTER TABLE technician_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON technician_tasks;
CREATE POLICY "Enable all access for authenticated users" ON technician_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON forms;
CREATE POLICY "Enable all access for authenticated users" ON forms FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON form_responses;
CREATE POLICY "Enable all access for authenticated users" ON form_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
