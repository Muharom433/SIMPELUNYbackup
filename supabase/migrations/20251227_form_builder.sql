-- Form Builder Tables Migration
-- Creates tables for dynamic form creation, responses, and management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: forms
-- Master form definitions
-- ============================================
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  header_image TEXT, -- Base64 or URL for form header
  theme_color TEXT DEFAULT '#3b82f6', -- Primary color for form styling
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true, -- Anyone can fill, or only logged-in users
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  study_program_id UUID REFERENCES study_programs(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}'::jsonb, -- Additional settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: form_fields
-- Field definitions for each form
-- ============================================
CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text', 'textarea', 'number', 'email', 'phone', 'date', 'time',
    'dropdown', 'checkbox', 'radio', 'signature', 'file', 'header', 'paragraph'
  )),
  label TEXT NOT NULL,
  placeholder TEXT,
  helper_text TEXT, -- Description below the field
  is_required BOOLEAN DEFAULT false,
  options JSONB, -- For dropdown/checkbox/radio: [{value: 'opt1', label: 'Option 1'}]
  data_source JSONB, -- Dynamic data: {table: 'users', filter: {role: 'lecturer'}, displayField: 'full_name'}
  validation JSONB, -- {minLength: 3, maxLength: 100, pattern: 'regex'}
  field_order INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}'::jsonb, -- Conditional logic, styling, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster field ordering
CREATE INDEX IF NOT EXISTS idx_form_fields_order ON form_fields(form_id, field_order);

-- ============================================
-- Table: form_responses
-- Submitted form responses (header)
-- ============================================
CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  respondent_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Logged-in user
  respondent_name TEXT, -- For anonymous/guest submissions
  respondent_email TEXT,
  respondent_phone TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  study_program_id UUID REFERENCES study_programs(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering responses
CREATE INDEX IF NOT EXISTS idx_form_responses_form ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_dept ON form_responses(department_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_prodi ON form_responses(study_program_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_date ON form_responses(submitted_at);

-- ============================================
-- Table: form_response_values
-- Individual field values for each response
-- ============================================
CREATE TABLE IF NOT EXISTS form_response_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
  value TEXT, -- Text value for most fields
  value_array JSONB, -- For multi-select checkboxes: ['opt1', 'opt2']
  signature_data TEXT, -- Base64 encoded signature image
  file_url TEXT, -- URL to uploaded file
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster value lookup
CREATE INDEX IF NOT EXISTS idx_form_response_values_response ON form_response_values(response_id);
CREATE INDEX IF NOT EXISTS idx_form_response_values_field ON form_response_values(field_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_response_values ENABLE ROW LEVEL SECURITY;

-- Forms: Super admin and creator can manage
CREATE POLICY "forms_select_policy" ON forms FOR SELECT USING (true);
CREATE POLICY "forms_insert_policy" ON forms FOR INSERT WITH CHECK (true);
CREATE POLICY "forms_update_policy" ON forms FOR UPDATE USING (true);
CREATE POLICY "forms_delete_policy" ON forms FOR DELETE USING (true);

-- Form Fields: Same as parent form
CREATE POLICY "form_fields_select_policy" ON form_fields FOR SELECT USING (true);
CREATE POLICY "form_fields_insert_policy" ON form_fields FOR INSERT WITH CHECK (true);
CREATE POLICY "form_fields_update_policy" ON form_fields FOR UPDATE USING (true);
CREATE POLICY "form_fields_delete_policy" ON form_fields FOR DELETE USING (true);

-- Form Responses: Anyone can insert, authorized can read
CREATE POLICY "form_responses_select_policy" ON form_responses FOR SELECT USING (true);
CREATE POLICY "form_responses_insert_policy" ON form_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "form_responses_delete_policy" ON form_responses FOR DELETE USING (true);

-- Response Values: Follow parent response
CREATE POLICY "form_response_values_select_policy" ON form_response_values FOR SELECT USING (true);
CREATE POLICY "form_response_values_insert_policy" ON form_response_values FOR INSERT WITH CHECK (true);
CREATE POLICY "form_response_values_delete_policy" ON form_response_values FOR DELETE USING (true);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW
  EXECUTE FUNCTION update_forms_updated_at();
