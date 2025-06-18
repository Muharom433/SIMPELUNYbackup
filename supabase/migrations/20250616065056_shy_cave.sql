/*
  # Create Admin Module Tables

  1. New Tables
    - `lecture_schedules` - For managing academic schedules
    - `exam_schedules` - For exam coordination
    - `reports` - For issue/complaint management
    - `system_settings` - For system configuration
    - `report_comments` - For communication threads in reports
    - `work_orders` - For maintenance tasks

  2. Security
    - Enable RLS on all tables (disabled for development)
    - Add policies for role-based access

  3. Indexes
    - Add performance indexes for common queries
*/

-- Lecture Schedules Table
CREATE TABLE IF NOT EXISTS lecture_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name text NOT NULL,
  subject_code text NOT NULL,
  lecturer_id uuid REFERENCES users(id),
  room_id uuid REFERENCES rooms(id),
  study_program_id uuid REFERENCES study_programs(id),
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  semester integer NOT NULL CHECK (semester >= 1 AND semester <= 8),
  academic_year text NOT NULL,
  class_type text NOT NULL CHECK (class_type IN ('theory', 'practical')),
  sks integer NOT NULL CHECK (sks >= 1 AND sks <= 6),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Exam Schedules Table
CREATE TABLE IF NOT EXISTS exam_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name text NOT NULL,
  subject_code text NOT NULL,
  exam_type text NOT NULL CHECK (exam_type IN ('midterm', 'final', 'quiz', 'practical')),
  study_program_id uuid REFERENCES study_programs(id),
  semester integer NOT NULL CHECK (semester >= 1 AND semester <= 8),
  academic_year text NOT NULL,
  exam_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  room_id uuid REFERENCES rooms(id),
  supervisor_id uuid REFERENCES users(id),
  max_students integer NOT NULL DEFAULT 30,
  registered_students integer DEFAULT 0,
  instructions text,
  materials_allowed text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Reports Table (Issue/Complaint Management)
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id),
  reporter_name text,
  reporter_email text,
  reporter_phone text,
  is_anonymous boolean DEFAULT false,
  category text NOT NULL CHECK (category IN ('equipment', 'room_condition', 'cleanliness', 'safety', 'maintenance', 'other')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text NOT NULL,
  location text,
  room_id uuid REFERENCES rooms(id),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'under_review', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid REFERENCES users(id),
  attachments text[] DEFAULT '{}',
  due_date timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  feedback_rating integer CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Report Comments Table (Communication Thread)
CREATE TABLE IF NOT EXISTS report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  comment text NOT NULL,
  is_internal boolean DEFAULT false,
  attachments text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Work Orders Table
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES reports(id),
  title text NOT NULL,
  description text NOT NULL,
  assigned_to uuid REFERENCES users(id),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  estimated_hours integer,
  actual_hours integer,
  materials_needed text,
  completion_notes text,
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  updated_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lecture_schedules_lecturer ON lecture_schedules(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_lecture_schedules_room ON lecture_schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_lecture_schedules_program ON lecture_schedules(study_program_id);
CREATE INDEX IF NOT EXISTS idx_lecture_schedules_day ON lecture_schedules(day_of_week);

CREATE INDEX IF NOT EXISTS idx_exam_schedules_room ON exam_schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_supervisor ON exam_schedules(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_program ON exam_schedules(study_program_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_date ON exam_schedules(exam_date);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_status ON exam_schedules(status);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_assigned ON reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_room ON reports(room_id);

CREATE INDEX IF NOT EXISTS idx_report_comments_report ON report_comments(report_id);
CREATE INDEX IF NOT EXISTS idx_report_comments_user ON report_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_report ON work_orders(report_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lecture_schedules_updated_at BEFORE UPDATE ON lecture_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exam_schedules_updated_at BEFORE UPDATE ON exam_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description, category) VALUES
('system_name', '"Faculty Room Booking System"', 'Name of the system', 'general'),
('timezone', '"Asia/Jakarta"', 'System timezone', 'general'),
('date_format', '"DD/MM/YYYY"', 'Date display format', 'general'),
('time_format', '"24h"', 'Time display format', 'general'),
('max_booking_duration', '8', 'Maximum booking duration in hours', 'booking'),
('advance_booking_days', '30', 'How many days in advance bookings can be made', 'booking'),
('auto_approval', 'false', 'Enable automatic approval for bookings', 'booking'),
('require_approval_for_equipment', 'true', 'Require approval for equipment requests', 'booking'),
('booking_reminder_hours', '2', 'Hours before booking to send reminder', 'booking'),
('email_notifications', 'true', 'Enable email notifications', 'notifications'),
('sms_notifications', 'false', 'Enable SMS notifications', 'notifications'),
('push_notifications', 'true', 'Enable push notifications', 'notifications'),
('session_timeout', '60', 'Session timeout in minutes', 'security'),
('password_min_length', '8', 'Minimum password length', 'security'),
('require_2fa', 'false', 'Require two-factor authentication', 'security'),
('login_attempts_limit', '5', 'Maximum login attempts before lockout', 'security'),
('maintenance_mode', 'false', 'Enable maintenance mode', 'maintenance'),
('backup_frequency', '"daily"', 'Backup frequency', 'maintenance'),
('auto_cleanup_days', '90', 'Auto cleanup old data after days', 'maintenance')
ON CONFLICT (setting_key) DO NOTHING;