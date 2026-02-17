/*
  # Admin Data Cleanup Function (Time Range Support)

  Updated to support deleting data WITHIN a specific time range (e.g., last 1 year),
  instead of just "older than X".
  
  Logic Update:
  - Input: period_start (timestamptz), target_tables (text[])
  - Operation: DELETE WHERE created_at >= period_start
  - Meaning: Cleans data from 'period_start' until NOW.
*/

CREATE OR REPLACE FUNCTION admin_cleanup_data(
  cutoff_date timestamptz,
  target_tables text[],
  cleanup_mode text DEFAULT 'older_than' -- 'older_than' or 'within_period'
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
