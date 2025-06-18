/*
  # Create Exam Table

  1. New Table
    - `exams` - For managing exam schedules and details
      - `id` (uuid, primary key)
      - `day` (text, not null) - Day of the week
      - `date` (date, not null) - Exam date
      - `session` (text, not null) - Exam session/time slot
      - `course_code` (text, not null) - Course code
      - `semester` (integer, not null) - Semester number
      - `class` (text, not null) - Class identifier
      - `student_amount` (integer, not null) - Number of students
      - `room_id` (uuid, foreign key) - Reference to rooms table
      - `lecturer_id` (uuid, foreign key) - Reference to users table (lecturer in charge)
      - `department_id` (uuid, foreign key) - Reference to departments table
      - `study_program_id` (uuid, foreign key) - Reference to study_programs table
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `exams` table
    - Add policies for role-based access

  3. Indexes
    - Add performance indexes for common queries
*/

-- Create exams table
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day text NOT NULL,
  date date NOT NULL,
  session text NOT NULL,
  course_code text NOT NULL,
  semester integer NOT NULL CHECK (semester >= 1 AND semester <= 8),
  class text NOT NULL,
  student_amount integer NOT NULL DEFAULT 0,
  room_id uuid REFERENCES rooms(id),
  lecturer_id uuid REFERENCES users(id),
  department_id uuid REFERENCES departments(id),
  study_program_id uuid REFERENCES study_programs(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exams_date ON exams(date);
CREATE INDEX IF NOT EXISTS idx_exams_room_id ON exams(room_id);
CREATE INDEX IF NOT EXISTS idx_exams_lecturer_id ON exams(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_exams_department_id ON exams(department_id);
CREATE INDEX IF NOT EXISTS idx_exams_study_program_id ON exams(study_program_id);

-- Add trigger for updated_at
CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
CREATE POLICY "Enable read access for all users"
  ON exams
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Super admins can manage all exams"
  ON exams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Department admins can manage their department exams"
  ON exams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'department_admin'
      AND users.department_id = exams.department_id
    )
  );

-- Insert sample data
INSERT INTO exams (
  day, 
  date, 
  session, 
  course_code, 
  semester, 
  class, 
  student_amount, 
  room_id, 
  lecturer_id, 
  department_id, 
  study_program_id
)
SELECT
  CASE floor(random() * 7)
    WHEN 0 THEN 'Monday'
    WHEN 1 THEN 'Tuesday'
    WHEN 2 THEN 'Wednesday'
    WHEN 3 THEN 'Thursday'
    WHEN 4 THEN 'Friday'
    WHEN 5 THEN 'Saturday'
    ELSE 'Sunday'
  END,
  current_date + (floor(random() * 30) || ' days')::interval,
  CASE floor(random() * 3)
    WHEN 0 THEN 'Morning (08:00-10:00)'
    WHEN 1 THEN 'Midday (12:00-14:00)'
    ELSE 'Afternoon (15:00-17:00)'
  END,
  'CS' || (floor(random() * 400) + 100)::text,
  floor(random() * 8) + 1,
  chr(65 + floor(random() * 3)::int),
  floor(random() * 50) + 10,
  r.id,
  u.id,
  d.id,
  sp.id
FROM
  rooms r,
  users u,
  departments d,
  study_programs sp
WHERE
  u.role IN ('department_admin', 'super_admin')
  AND sp.department_id = d.id
LIMIT 10;