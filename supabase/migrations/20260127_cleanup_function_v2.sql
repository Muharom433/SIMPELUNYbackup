/*
  # Admin Data Cleanup Function V2 (Time Range Support)
  
  Version 2 to bypass schema cache issues.
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
  result json;
BEGIN
  -- Check if user is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Super Admin only';
  END IF;

  -- Logic Branching
  IF cleanup_mode = 'within_period' THEN
      -- DELETE DATA FROM cutoff_date UNTIL NOW (Recent Data)
      
      -- 1. Cleanup Checkouts
      IF 'checkouts' = ANY(target_tables) THEN
        DELETE FROM checkout_violations
        WHERE checkout_id IN (
          SELECT id FROM checkouts
          WHERE created_at >= cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged')
        );
        
        WITH deleted AS (
          DELETE FROM checkouts
          WHERE created_at >= cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged')
          RETURNING id
        )
        SELECT count(*) INTO deleted_checkouts FROM deleted;
      END IF;

      -- 2. Cleanup Bookings
      IF 'bookings' = ANY(target_tables) THEN
        WITH deleted AS (
          DELETE FROM bookings
          WHERE end_time >= cutoff_date
          AND status IN ('completed', 'rejected', 'cancelled')
          RETURNING id
        )
        SELECT count(*) INTO deleted_bookings FROM deleted;
      END IF;

      -- 3. Cleanup Notifications
      IF 'notifications' = ANY(target_tables) THEN
        WITH deleted AS (
          DELETE FROM notifications
          WHERE created_at >= cutoff_date
          RETURNING id
        )
        SELECT count(*) INTO deleted_notifications FROM deleted;
      END IF;

  ELSE
      -- ORIGINAL LOGIC: DELETE DATA OLDER THAN cutoff_date (Old Data)
      -- Use this if mode is 'older_than' or anything else
      
      IF 'checkouts' = ANY(target_tables) THEN
        DELETE FROM checkout_violations
        WHERE checkout_id IN (
          SELECT id FROM checkouts
          WHERE created_at < cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged')
        );
        
        WITH deleted AS (
          DELETE FROM checkouts
          WHERE created_at < cutoff_date
          AND status IN ('returned', 'completed', 'lost', 'damaged')
          RETURNING id
        )
        SELECT count(*) INTO deleted_checkouts FROM deleted;
      END IF;

      IF 'bookings' = ANY(target_tables) THEN
        WITH deleted AS (
          DELETE FROM bookings
          WHERE end_time < cutoff_date
          AND status IN ('completed', 'rejected', 'cancelled')
          RETURNING id
        )
        SELECT count(*) INTO deleted_bookings FROM deleted;
      END IF;

      IF 'notifications' = ANY(target_tables) THEN
        WITH deleted AS (
          DELETE FROM notifications
          WHERE created_at < cutoff_date
          RETURNING id
        )
        SELECT count(*) INTO deleted_notifications FROM deleted;
      END IF;
  END IF;

  -- Return results
  result := json_build_object(
    'checkouts', deleted_checkouts,
    'bookings', deleted_bookings,
    'notifications', deleted_notifications
  );

  RETURN result;
END;
$$;
