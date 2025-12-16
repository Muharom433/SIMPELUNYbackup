-- Add unique constraint on setting_key for upsert functionality
-- This allows the application to use upsert (insert or update) based on setting_key

-- First, check if constraint already exists and add if not
DO $$
BEGIN
    -- Check if the unique constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'system_settings_setting_key_key'
    ) THEN
        -- Add unique constraint on setting_key
        ALTER TABLE public.system_settings 
        ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);
    END IF;
END $$;

-- Create index for faster lookups by setting_key
CREATE INDEX IF NOT EXISTS idx_system_settings_setting_key 
ON public.system_settings(setting_key);

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_system_settings_category 
ON public.system_settings(category);
