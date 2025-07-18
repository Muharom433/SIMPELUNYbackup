/*
  # Remove Room Availability Auto-Update Triggers

  This migration removes any database triggers that automatically update 
  rooms.is_available when bookings are approved, rejected, or deleted.
  
  Room availability should ONLY be controlled manually by admins in RoomManagement.
*/

-- Drop any existing triggers that might update room availability
DROP TRIGGER IF EXISTS update_room_availability_on_booking_change ON bookings;
DROP TRIGGER IF EXISTS auto_update_room_status ON bookings;
DROP TRIGGER IF EXISTS booking_room_availability_trigger ON bookings;

-- Drop any functions related to room availability auto-update
DROP FUNCTION IF EXISTS update_room_availability_on_booking_status();
DROP FUNCTION IF EXISTS auto_update_room_status();
DROP FUNCTION IF EXISTS handle_booking_room_availability();

-- Ensure no other triggers are affecting room availability
-- List all triggers on bookings table to verify
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table, action_statement
        FROM information_schema.triggers 
        WHERE event_object_table = 'bookings'
    LOOP
        RAISE NOTICE 'Existing trigger on bookings: % - %', trigger_record.trigger_name, trigger_record.action_statement;
    END LOOP;
END $$;

-- Add a comment to document the policy
COMMENT ON TABLE rooms IS 'Room availability (is_available) should ONLY be updated manually by admins in RoomManagement. NO automatic updates based on booking status.';

-- Verify no foreign key constraints are causing cascading updates
-- (This is just for verification, not modification)
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (tc.table_name = 'bookings' OR ccu.table_name = 'rooms');