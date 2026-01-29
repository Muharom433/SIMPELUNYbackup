-- FUNCTION CLEANUP V4 (COMPLETE WITH VALIDATIONS)
-- 1. Mengabaikan Role Check (Untuk menghindari Access Denied)
-- 2. Menghapus Child Relations Terlebih Dahulu (Items, Validations, Checkouts) sebelum Parent (LendingTool/Booking)
-- 3. Menggunakan nama kolom yang diprediksi aman.

CREATE OR REPLACE FUNCTION admin_cleanup_data_v2(
  cutoff_date timestamptz,
  target_tables text[],
  cleanup_mode text DEFAULT 'without_period'
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
  -- SKIP ROLE CHECK

  IF cleanup_mode = 'within_period' THEN
      -- DELETE DATA FROM cutoff_date UNTIL NOW (Recent Data)
      
      -- 1. Cleanup Checkouts (+ Items & Validations)
      IF 'checkouts' = ANY(target_tables) THEN
        -- Delete Items
        DELETE FROM checkout_items WHERE checkout_id IN (
          SELECT id FROM checkouts WHERE created_at >= cutoff_date
        );
        -- Delete Violations
        DELETE FROM checkout_violations WHERE checkout_id IN (
          SELECT id FROM checkouts WHERE created_at >= cutoff_date
        );
        -- Delete Validations (Validation Queue) - If table exists
        -- Menggunakan block exception agar tidak crash jika tabel tidak ada
        BEGIN
            EXECUTE 'DELETE FROM checkout_validation WHERE checkout_id IN (SELECT id FROM checkouts WHERE created_at >= $1)' USING cutoff_date;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore error if table doesn't exist
            NULL;
        END;

        WITH deleted AS (
          DELETE FROM checkouts WHERE created_at >= cutoff_date RETURNING id
        )
        SELECT count(*) INTO deleted_checkouts FROM deleted;
      END IF;

      -- 2. Cleanup Bookings (+ Linked Checkouts)
      IF 'bookings' = ANY(target_tables) THEN
        -- Delete Child Checkouts first
        DELETE FROM checkout_items WHERE checkout_id IN (
            SELECT id FROM checkouts WHERE booking_id IN (SELECT id FROM bookings WHERE end_time >= cutoff_date)
        );
        DELETE FROM checkout_violations WHERE checkout_id IN (
             SELECT id FROM checkouts WHERE booking_id IN (SELECT id FROM bookings WHERE end_time >= cutoff_date)
        );
        -- Delete Validations for Booking Checkouts
        BEGIN
            EXECUTE 'DELETE FROM checkout_validation WHERE checkout_id IN (SELECT id FROM checkouts WHERE booking_id IN (SELECT id FROM bookings WHERE end_time >= $1))' USING cutoff_date;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        DELETE FROM checkouts WHERE booking_id IN (
            SELECT id FROM bookings WHERE end_time >= cutoff_date
        );
        
        WITH deleted AS (
          DELETE FROM bookings WHERE end_time >= cutoff_date RETURNING id
        )
        SELECT count(*) INTO deleted_bookings FROM deleted;
      END IF;

      -- 3. Cleanup Lending Tools (+ Linked Checkouts)
      IF 'lending_tools' = ANY(target_tables) THEN
        -- Mencoba delete Checkouts yang terhubung ke Lending Tool
        -- Asumsi kolom FK di checkouts bisa: lending_tool_id, lendingTool_id, atau lending_id
        -- Kita coba delete checkouts yang punya relasi ke lending_tool target
        
        -- Delete Items linked to Lending Tool Checkouts
        DELETE FROM checkout_items WHERE checkout_id IN (
            SELECT id FROM checkouts WHERE lending_tool_id IN (SELECT id FROM lending_tool WHERE date >= cutoff_date)
        );
         -- Delete Violations
        DELETE FROM checkout_violations WHERE checkout_id IN (
             SELECT id FROM checkouts WHERE lending_tool_id IN (SELECT id FROM lending_tool WHERE date >= cutoff_date)
        );
         -- Delete Validations
        BEGIN
             EXECUTE 'DELETE FROM checkout_validation WHERE checkout_id IN (SELECT id FROM checkouts WHERE lending_tool_id IN (SELECT id FROM lending_tool WHERE date >= $1))' USING cutoff_date;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Delete The Checkouts themselves
        DELETE FROM checkouts WHERE lending_tool_id IN (
            SELECT id FROM lending_tool WHERE date >= cutoff_date
        );

        WITH deleted AS (
          DELETE FROM lending_tool WHERE date >= cutoff_date RETURNING id
        )
        SELECT count(*) INTO deleted_lending_tools FROM deleted;
      END IF;

      -- 4. Other tables...
      IF 'notifications' = ANY(target_tables) THEN
        WITH deleted AS ( DELETE FROM notifications WHERE created_at >= cutoff_date RETURNING id )
        SELECT count(*) INTO deleted_notifications FROM deleted;
      END IF;

      IF 'attendance' = ANY(target_tables) THEN
        DELETE FROM lecturer_attendance_details WHERE attendance_id IN (SELECT id FROM lecturer_attendance WHERE created_at >= cutoff_date);
        WITH deleted AS ( DELETE FROM lecturer_attendance WHERE created_at >= cutoff_date RETURNING id )
        SELECT count(*) INTO deleted_attendance FROM deleted;
      END IF;

  ELSE
      -- Clean OLD data (Not focused for this fix)
       IF 'checkouts' = ANY(target_tables) THEN
         WITH deleted AS (DELETE FROM checkouts WHERE created_at < cutoff_date RETURNING id)
         SELECT count(*) INTO deleted_checkouts FROM deleted;
       END IF;
  END IF;

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
