/*
  # Add System Branding Columns

  This migration ensures the system_settings table has proper structure for branding.
  It drops the old key-value style table if exists and creates a new single-row branding table.

  ## Added Columns:
  - system_name (text) - Application name displayed in header, sidebar, title
  - system_description (text) - Short description/tagline
  - system_logo (text) - Base64 encoded logo image
  - system_version (text) - Application version
  - developer_name (text) - Developer/company name
  - developer_logo (text) - Developer logo (optional)
  - favicon_url (text) - Favicon URL (optional)
*/

-- First, check if system_settings exists and has the old structure (setting_key column)
-- If so, drop it and create new structure
DO $$ 
BEGIN
  -- Check if the old structure exists (has setting_key column)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_settings' 
    AND column_name = 'setting_key'
  ) THEN
    -- Drop the old table
    DROP TABLE IF EXISTS system_settings CASCADE;
  END IF;
END $$;

-- Create new system_settings table with flat structure if not exists
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Branding Settings
  system_name text NOT NULL DEFAULT 'SIMPEL Kuliah',
  system_description text DEFAULT 'Sistem Manajemen Kampus Cerdas',
  system_logo text, -- Base64 encoded image
  system_version text NOT NULL DEFAULT '2.0',
  developer_name text NOT NULL DEFAULT 'Swarna Works Agency',
  developer_logo text, -- Base64 encoded image (optional)
  favicon_url text, -- Custom favicon URL (optional)
  
  -- Localization
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  date_format text NOT NULL DEFAULT 'DD/MM/YYYY',
  time_format text NOT NULL DEFAULT '24h',
  
  -- Booking Settings
  max_booking_duration integer NOT NULL DEFAULT 8,
  advance_booking_days integer NOT NULL DEFAULT 30,
  auto_approval boolean NOT NULL DEFAULT false,
  require_approval_for_equipment boolean NOT NULL DEFAULT true,
  booking_reminder_hours integer NOT NULL DEFAULT 2,
  
  -- Notification Settings
  email_notifications boolean NOT NULL DEFAULT true,
  sms_notifications boolean NOT NULL DEFAULT false,
  push_notifications boolean NOT NULL DEFAULT true,
  notification_email text,
  
  -- Security Settings
  session_timeout integer NOT NULL DEFAULT 60,
  password_min_length integer NOT NULL DEFAULT 8,
  require_2fa boolean NOT NULL DEFAULT false,
  login_attempts_limit integer NOT NULL DEFAULT 5,
  
  -- Maintenance Settings
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text DEFAULT 'System is under maintenance. Please try again later.',
  backup_frequency text NOT NULL DEFAULT 'daily',
  auto_cleanup_days integer NOT NULL DEFAULT 90,
  
  -- Meta
  updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT 'System Administrator',
  created_at timestamptz DEFAULT now()
);

-- Create or replace the trigger for updated_at
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at 
  BEFORE UPDATE ON system_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_system_settings_timestamp();

-- Insert default row if table is empty
INSERT INTO system_settings (
  system_name,
  system_description,
  system_version,
  developer_name
) 
SELECT 
  'SIMPEL Kuliah',
  'Sistem Manajemen Kampus Cerdas',
  '2.0',
  'Swarna Works Agency'
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- Add comments for documentation
COMMENT ON TABLE system_settings IS 'Single row table for system-wide configuration and branding';
COMMENT ON COLUMN system_settings.system_name IS 'Application name displayed in header, sidebar, and browser title';
COMMENT ON COLUMN system_settings.system_logo IS 'Base64 encoded logo image for header and sidebar';
COMMENT ON COLUMN system_settings.developer_name IS 'Developer/company name shown in credits section';
