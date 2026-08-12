-- 1. FUNGSI RPC UNTUK BULK UPDATE QUANTITY (Mengatasi N+1 Query)
CREATE OR REPLACE FUNCTION bulk_adjust_quantities(
    adjustments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    item JSONB;
    eq_record RECORD;
    results JSONB := '[]'::JSONB;
    new_qty INTEGER;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(adjustments)
    LOOP
        -- Row-level lock agar aman dari race condition
        SELECT id, quantity INTO eq_record
        FROM equipment
        WHERE id = (item->>'id')::UUID
        FOR UPDATE; 
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Equipment % not found', item->>'id';
        END IF;
        
        new_qty := eq_record.quantity + (item->>'delta')::INTEGER;
        
        IF new_qty < 0 THEN
            RAISE EXCEPTION 'Insufficient quantity for %', item->>'id';
        END IF;
        
        UPDATE equipment SET quantity = new_qty, updated_at = NOW()
        WHERE id = eq_record.id;
        
        results := results || jsonb_build_object(
            'id', eq_record.id,
            'old_qty', eq_record.quantity,
            'new_qty', new_qty
        );
    END LOOP;
    
    RETURN results;
END;
$$;

-- 2. ENABLE pg_trgm EXTENSION (Untuk optimasi pencarian ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. INDEXING UNTUK MEMPERCEPAT QUERY (Menghemat RAM & CPU Database)
-- Bookings
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_room_time ON bookings(room_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_active ON bookings(room_id, start_time)
    WHERE status IN ('approved', 'booked', 'borrowed');

-- Equipment
CREATE INDEX IF NOT EXISTS idx_equipment_dept ON equipment(department_id);
CREATE INDEX IF NOT EXISTS idx_equipment_dept_prodi_avail 
    ON equipment(department_id, study_program_id, is_available);
CREATE INDEX IF NOT EXISTS idx_equipment_name_trgm ON equipment USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_equipment_code_trgm ON equipment USING gin(code gin_trgm_ops);

-- Lecture Schedules
CREATE INDEX IF NOT EXISTS idx_lecture_day ON lecture_schedules(day);
CREATE INDEX IF NOT EXISTS idx_lecture_day_room ON lecture_schedules(day, room);

-- Equipment Mutations (Mencegah fetchLatestMutationsMap melambat)
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_latest 
    ON equipment_mutations(equipment_id, created_at DESC);

-- Lecturer Attendances
CREATE INDEX IF NOT EXISTS idx_attendance_date_status 
    ON lecturer_attendances(attendance_date, verification_status);
