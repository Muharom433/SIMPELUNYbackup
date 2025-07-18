/*
  # Force Remove All Room Availability Triggers
  
  This migration forcefully removes any triggers that might be updating room availability
  when bookings are approved/rejected/deleted.
  
  1. Drop all triggers on bookings table that might affect rooms
  2. Drop all functions that update room availability
  3. Verify no triggers remain
*/

-- Drop any triggers on bookings table that might update rooms
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Get all triggers on bookings table
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers 
        WHERE event_object_table = 'bookings'
    LOOP
        -- Drop each trigger
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE', 
                      trigger_record.trigger_name, 
                      trigger_record.event_object_table);
        
        RAISE NOTICE 'Dropped trigger: %', trigger_record.trigger_name;
    END LOOP;
END $$;

-- Drop any functions that might update room availability
DROP FUNCTION IF EXISTS update_room_availability() CASCADE;
DROP FUNCTION IF EXISTS auto_update_room_status() CASCADE;
DROP FUNCTION IF EXISTS handle_booking_status_change() CASCADE;
DROP FUNCTION IF EXISTS update_room_on_booking_change() CASCADE;

-- Verify no triggers remain on bookings table
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE event_object_table = 'bookings';
    
    IF trigger_count > 0 THEN
        RAISE WARNING 'Still have % triggers on bookings table', trigger_count;
    ELSE
        RAISE NOTICE 'SUCCESS: No triggers remain on bookings table';
    END IF;
END $$;

-- Add comment to rooms table about manual-only policy
COMMENT ON COLUMN rooms.is_available IS 'Room availability (is_available) should ONLY be updated manually by admins in RoomManagement. NO automatic updates based on booking status.';

-- Log completion
INSERT INTO system_settings (setting_key, setting_value, description, category)
VALUES (
  'room_availability_policy',
  '{"manual_only": true, "auto_update": false, "updated_at": "' || NOW() || '"}',
  'Room availability must be updated manually only, no automatic updates from booking status',
  'system'
) ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();