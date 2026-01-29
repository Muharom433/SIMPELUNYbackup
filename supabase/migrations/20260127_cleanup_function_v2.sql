/*
  # Admin Data Cleanup Function V2 (Time Range Support)
  
  Version 2.2: robust handling of dependencies for bookings and lending_tools.
*/

CREATE OR REPLACE FUNCTION admin_cleanup_data_v2(
  cutoff_date timestamptz,
  target_tables text[],
  cleanup_mode text DEFAULT 'without_period' -- 'older_than' or 'within_period'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_checkouts int := 0;
  deleted_bookings int := 0;
  deleted_notifications int := 0;
  deleted_attendance int := 0;
  deleted_lending_tools int := 0;
  result json;
BEGIN
  -- Check if user is super_admin (Flexible check)
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND (
      role = 'super_admin' 
      OR role = 'super admin' 
      OR role = 'Super Admin'
      OR role = 'admin' -- Fallback if simple admin is allowed
    )
  ) THEN
    -- Debugging: You can remove this or keep it.
    -- RAISE NOTICE 'User Role: %', (SELECT role FROM users WHERE id = auth.uid());
    
    -- If you want strictly NO access:
    RAISE EXCEPTION 'Access denied: Super Admin only. Your role seems to be non-matching.';
  END IF;

  -- Logic Branching
  IF cleanup_mode = 'within_period' THEN
      -- DELETE DATA FROM cutoff_date UNTIL NOW (Recent Data)
      
      -- 1. Cleanup Checkouts (Direct Selection)
      -- Include 'pending', 'active' (if old), 'approved' to clean ALL history
      IF 'checkouts' = ANY(target_tables) THEN
        DELETE FROM checkout_items
        WHERE checkout_id IN (
          SELECT id FROM checkouts
          WHERE created_at >= cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged', 'rejected', 'cancelled', 'pending', 'active', 'overdue')
        );

        DELETE FROM checkout_violations
        WHERE checkout_id IN (
          SELECT id FROM checkouts
          WHERE created_at >= cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged', 'rejected', 'cancelled', 'pending', 'active', 'overdue')
        );
        
        WITH deleted AS (
          DELETE FROM checkouts
          WHERE created_at >= cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged', 'rejected', 'cancelled', 'pending', 'active', 'overdue')
          RETURNING id
        )
        SELECT count(*) INTO deleted_checkouts FROM deleted;
      END IF;

      -- 2. Cleanup Bookings (and their Checkouts)
      IF 'bookings' = ANY(target_tables) THEN
        -- Delete checkouts related to these bookings first
        DELETE FROM checkout_items WHERE checkout_id IN (
            SELECT id FROM checkouts WHERE booking_id IN (
                SELECT id FROM bookings WHERE end_time >= cutoff_date AND status IN ('completed', 'rejected', 'cancelled', 'pending', 'approved')
            )
        );
        DELETE FROM checkout_violations WHERE checkout_id IN (
             SELECT id FROM checkouts WHERE booking_id IN (
                SELECT id FROM bookings WHERE end_time >= cutoff_date AND status IN ('completed', 'rejected', 'cancelled', 'pending', 'approved')
             )
        );
        DELETE FROM checkouts WHERE booking_id IN (
            SELECT id FROM bookings WHERE end_time >= cutoff_date AND status IN ('completed', 'rejected', 'cancelled', 'pending', 'approved')
        );

        WITH deleted AS (
          DELETE FROM bookings
          WHERE end_time >= cutoff_date
          AND status IN ('completed', 'rejected', 'cancelled', 'pending', 'approved')
          RETURNING id
        )
        SELECT count(*) INTO deleted_bookings FROM deleted;
      END IF;

      -- 3. Cleanup Lending Tools (and their Checkouts)
      IF 'lending_tools' = ANY(target_tables) THEN
        -- Delete checkouts related to these lending tools first
        DELETE FROM checkout_items WHERE checkout_id IN (
            SELECT id FROM checkouts WHERE lendingTool_id IN (
                SELECT id FROM lending_tool WHERE date >= cutoff_date AND status IN ('returned', 'completed', 'rejected', 'cancelled', 'pending', 'approved', 'active')
            )
        );
        DELETE FROM checkout_violations WHERE checkout_id IN (
             SELECT id FROM checkouts WHERE lendingTool_id IN (
                SELECT id FROM lending_tool WHERE date >= cutoff_date AND status IN ('returned', 'completed', 'rejected', 'cancelled', 'pending', 'approved', 'active')
             )
        );
        DELETE FROM checkouts WHERE lendingTool_id IN (
            SELECT id FROM lending_tool WHERE date >= cutoff_date AND status IN ('returned', 'completed', 'rejected', 'cancelled', 'pending', 'approved', 'active')
        );

        WITH deleted AS (
          DELETE FROM lending_tool
          WHERE date >= cutoff_date
          AND status IN ('returned', 'completed', 'rejected', 'cancelled', 'pending', 'approved', 'active')
          RETURNING id
        )
        SELECT count(*) INTO deleted_lending_tools FROM deleted;
      END IF;

      -- 4. Cleanup Notifications
      IF 'notifications' = ANY(target_tables) THEN
        WITH deleted AS (
          DELETE FROM notifications
          WHERE created_at >= cutoff_date
          RETURNING id
        )
        SELECT count(*) INTO deleted_notifications FROM deleted;
      END IF;

      -- 5. Cleanup Attendance
      IF 'attendance' = ANY(target_tables) THEN
        DELETE FROM lecturer_attendance_details
        WHERE attendance_id IN (
          SELECT id FROM lecturer_attendance
          WHERE created_at >= cutoff_date
          AND verification_status IN ('verified', 'pending', 'rejected')
        );

        WITH deleted AS (
          DELETE FROM lecturer_attendance
          WHERE created_at >= cutoff_date
          AND verification_status IN ('verified', 'pending', 'rejected')
          RETURNING id
        )
        SELECT count(*) INTO deleted_attendance FROM deleted;
      END IF;

  ELSE
      -- ORIGINAL LOGIC: DELETE DATA OLDER THAN cutoff_date (Old Data)
      
      -- 1. Cleanup Checkouts
      IF 'checkouts' = ANY(target_tables) THEN
        DELETE FROM checkout_items
        WHERE checkout_id IN (
          SELECT id FROM checkouts
          WHERE created_at < cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged', 'rejected', 'cancelled')
        );

        DELETE FROM checkout_violations
        WHERE checkout_id IN (
          SELECT id FROM checkouts
          WHERE created_at < cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged', 'rejected', 'cancelled')
        );
        
        WITH deleted AS (
          DELETE FROM checkouts
          WHERE created_at < cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged', 'rejected', 'cancelled')
          RETURNING id
        )
        SELECT count(*) INTO deleted_checkouts FROM deleted;
      END IF;

      -- 2. Cleanup Bookings
      IF 'bookings' = ANY(target_tables) THEN
        DELETE FROM checkout_items WHERE checkout_id IN (
            SELECT id FROM checkouts WHERE booking_id IN (
                SELECT id FROM bookings WHERE end_time < cutoff_date AND status IN ('completed', 'rejected', 'cancelled')
            )
        );
        DELETE FROM checkout_violations WHERE checkout_id IN (
             SELECT id FROM checkouts WHERE booking_id IN (
                SELECT id FROM bookings WHERE end_time < cutoff_date AND status IN ('completed', 'rejected', 'cancelled')
             )
        );
        DELETE FROM checkouts WHERE booking_id IN (
            SELECT id FROM bookings WHERE end_time < cutoff_date AND status IN ('completed', 'rejected', 'cancelled')
        );

        WITH deleted AS (
          DELETE FROM bookings
          WHERE end_time < cutoff_date
          AND status IN ('completed', 'rejected', 'cancelled')
          RETURNING id
        )
        SELECT count(*) INTO deleted_bookings FROM deleted;
      END IF;

      -- 3. Cleanup Lending Tools
      IF 'lending_tools' = ANY(target_tables) THEN
        DELETE FROM checkout_items WHERE checkout_id IN (
            SELECT id FROM checkouts WHERE lendingTool_id IN (
                SELECT id FROM lending_tool WHERE date < cutoff_date AND status IN ('returned', 'completed', 'rejected', 'cancelled')
            )
        );
        DELETE FROM checkout_violations WHERE checkout_id IN (
             SELECT id FROM checkouts WHERE lendingTool_id IN (
                SELECT id FROM lending_tool WHERE date < cutoff_date AND status IN ('returned', 'completed', 'rejected', 'cancelled')
             )
        );
        DELETE FROM checkouts WHERE lendingTool_id IN (
            SELECT id FROM lending_tool WHERE date < cutoff_date AND status IN ('returned', 'completed', 'rejected', 'cancelled')
        );

        WITH deleted AS (
          DELETE FROM lending_tool
          WHERE date < cutoff_date
          AND status IN ('returned', 'completed', 'rejected', 'cancelled')
          RETURNING id
        )
        SELECT count(*) INTO deleted_lending_tools FROM deleted;
      END IF;

      -- 4. Cleanup Notifications
      IF 'notifications' = ANY(target_tables) THEN
        WITH deleted AS (
          DELETE FROM notifications
          WHERE created_at < cutoff_date
          RETURNING id
        )
        SELECT count(*) INTO deleted_notifications FROM deleted;
      END IF;

      -- 5. Cleanup Attendance
      IF 'attendance' = ANY(target_tables) THEN
        DELETE FROM lecturer_attendance_details
        WHERE attendance_id IN (
          SELECT id FROM lecturer_attendance
          WHERE created_at < cutoff_date
          AND verification_status IN ('verified', 'pending', 'rejected')
        );

        WITH deleted AS (
          DELETE FROM lecturer_attendance
          WHERE created_at < cutoff_date
          AND verification_status IN ('verified', 'pending', 'rejected')
          RETURNING id
        )
        SELECT count(*) INTO deleted_attendance FROM deleted;
      END IF;
  END IF;

  -- Return results
  result := json_build_object(
    'checkouts', deleted_checkouts,
    'bookings', deleted_bookings,
    'lending_tools', deleted_lending_tools,
    'notifications', deleted_notifications,
    'attendance', deleted_attendance
  );

  RETURN result;
END;
$$;
