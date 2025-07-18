/*
  # Debug Room Triggers and Functions
  
  This migration will:
  1. List all triggers on rooms table
  2. List all functions that might update rooms
  3. Remove any triggers that update room availability
  4. Add logging to track room updates
*/

-- First, let's see what triggers exist on rooms table
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    RAISE NOTICE 'CHECKING TRIGGERS ON ROOMS TABLE:';
    FOR trigger_record IN 
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers 
        WHERE event_object_table = 'rooms'
    LOOP
        RAISE NOTICE 'Trigger: %, Event: %, Action: %', 
            trigger_record.trigger_name, 
            trigger_record.event_manipulation, 
            trigger_record.action_statement;
    END LOOP;
END $$;

-- Check for any functions that might update rooms
DO $$
DECLARE
    func_record RECORD;
BEGIN
    RAISE NOTICE 'CHECKING FUNCTIONS THAT MIGHT UPDATE ROOMS:';
    FOR func_record IN 
        SELECT routine_name, routine_definition
        FROM information_schema.routines 
        WHERE routine_type = 'FUNCTION' 
        AND routine_definition ILIKE '%rooms%'
        AND routine_definition ILIKE '%is_available%'
    LOOP
        RAISE NOTICE 'Function: %, Definition contains rooms.is_available', func_record.routine_name;
    END LOOP;
END $$;

-- Drop any triggers that might update room availability
DROP TRIGGER IF EXISTS update_room_availability_on_booking ON bookings;
DROP TRIGGER IF EXISTS auto_update_room_status ON bookings;
DROP TRIGGER IF EXISTS booking_room_status_trigger ON bookings;

-- Drop any functions that update room availability
DROP FUNCTION IF EXISTS update_room_availability();
DROP FUNCTION IF EXISTS auto_update_room_status();
DROP FUNCTION IF EXISTS handle_booking_room_status();

-- Add a comment to rooms table to document the policy
COMMENT ON COLUMN rooms.is_available IS 'Room availability (is_available) should ONLY be updated manually by admins in RoomManagement. NO automatic updates based on booking status.';

-- Verify no triggers remain
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE event_object_table = 'rooms';
    
    RAISE NOTICE 'REMAINING TRIGGERS ON ROOMS TABLE: %', trigger_count;
    
    IF trigger_count = 0 THEN
        RAISE NOTICE 'SUCCESS: No triggers found on rooms table';
    ELSE
        RAISE NOTICE 'WARNING: % triggers still exist on rooms table', trigger_count;
    END IF;
END $$;