-- Migration: Cascade Delete User Trigger
-- This trigger automatically deletes all related records when a user is deleted
-- Tables affected: bookings, checkouts, checkout_items, lending_tool, reports

-- Step 1: Create the function to delete related records
CREATE OR REPLACE FUNCTION delete_user_cascade()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the deletion
    RAISE NOTICE 'Cascade deleting records for user: %', OLD.id;
    
    -- 1. Delete checkout_items (via checkouts)
    DELETE FROM checkout_items 
    WHERE checkout_id IN (
        SELECT id FROM checkouts WHERE user_id = OLD.id
    );
    
    -- 2. Delete checkouts
    DELETE FROM checkouts WHERE user_id = OLD.id;
    
    -- 3. Delete bookings
    DELETE FROM bookings WHERE user_id = OLD.id;
    
    -- 4. Delete lending_tool records
    DELETE FROM lending_tool WHERE id_user = OLD.id;
    
    -- 5. Delete reports (if user_id column exists)
    BEGIN
        DELETE FROM reports WHERE user_id = OLD.id;
    EXCEPTION WHEN undefined_column THEN
        -- Column doesn't exist, skip
        NULL;
    END;
    
    -- 6. Delete exam_schedules if user is an examiner
    BEGIN
        DELETE FROM exam_schedules WHERE examiner_id = OLD.id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
    END;
    
    -- 7. Delete session_schedules if user is a lecturer
    BEGIN
        DELETE FROM session_schedules WHERE lecturer_id = OLD.id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL;
    END;
    
    RAISE NOTICE 'Cascade delete completed for user: %', OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the trigger
DROP TRIGGER IF EXISTS trigger_delete_user_cascade ON users;

CREATE TRIGGER trigger_delete_user_cascade
    BEFORE DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION delete_user_cascade();

-- Step 3: Grant necessary permissions
GRANT EXECUTE ON FUNCTION delete_user_cascade() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_cascade() TO service_role;

-- Optional: Create a helper RPC function for frontend use
CREATE OR REPLACE FUNCTION delete_user_with_cascade(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
    deleted_counts JSON;
    bookings_count INTEGER;
    checkouts_count INTEGER;
    lending_count INTEGER;
BEGIN
    -- Count records before deletion
    SELECT COUNT(*) INTO bookings_count FROM bookings WHERE user_id = target_user_id;
    SELECT COUNT(*) INTO checkouts_count FROM checkouts WHERE user_id = target_user_id;
    SELECT COUNT(*) INTO lending_count FROM lending_tool WHERE id_user = target_user_id;
    
    -- Delete the user (trigger will cascade)
    DELETE FROM users WHERE id = target_user_id;
    
    -- Return summary
    deleted_counts := json_build_object(
        'success', true,
        'user_id', target_user_id,
        'deleted_bookings', bookings_count,
        'deleted_checkouts', checkouts_count,
        'deleted_lending_records', lending_count
    );
    
    RETURN deleted_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_user_with_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_with_cascade(UUID) TO service_role;
