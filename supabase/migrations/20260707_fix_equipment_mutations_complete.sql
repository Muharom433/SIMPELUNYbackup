-- ============================================================
-- FIX: equipment_mutations table - Complete Setup
-- Jalankan SQL ini di Supabase SQL Editor (https://supabase.com/dashboard)
-- Pilih project > SQL Editor > New Query > Paste & Run
-- ============================================================

-- 1. Create the equipment_mutations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.equipment_mutations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID REFERENCES public.equipment(id) ON DELETE CASCADE,
    previous_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    new_room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    pic_name TEXT NOT NULL,
    pic_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add pic_phone column if it was created before this column was added
ALTER TABLE public.equipment_mutations ADD COLUMN IF NOT EXISTS pic_phone TEXT;

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_created_at 
    ON public.equipment_mutations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_equipment_id 
    ON public.equipment_mutations(equipment_id);

-- 4. Enable RLS
ALTER TABLE public.equipment_mutations ENABLE ROW LEVEL SECURITY;

-- 5. Drop ALL existing policies to prevent conflicts
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'equipment_mutations' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.equipment_mutations', pol.policyname);
    END LOOP;
END $$;

-- 6. Create clean RLS policies
-- Authenticated users (super_admin, laboratory, etc.) can SELECT
CREATE POLICY "allow_authenticated_select_equipment_mutations" 
    ON public.equipment_mutations 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Authenticated users can INSERT
CREATE POLICY "allow_authenticated_insert_equipment_mutations" 
    ON public.equipment_mutations 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Anonymous users can INSERT (for public form access)
CREATE POLICY "allow_anon_insert_equipment_mutations" 
    ON public.equipment_mutations 
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- Anonymous users can SELECT (for public form access)
CREATE POLICY "allow_anon_select_equipment_mutations" 
    ON public.equipment_mutations 
    FOR SELECT 
    TO anon 
    USING (true);

-- Authenticated users can UPDATE
CREATE POLICY "allow_authenticated_update_equipment_mutations" 
    ON public.equipment_mutations 
    FOR UPDATE 
    TO authenticated 
    USING (true);

-- Only super_admin and laboratory can DELETE
CREATE POLICY "allow_admin_delete_equipment_mutations" 
    ON public.equipment_mutations 
    FOR DELETE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'laboratory')
        )
    );

-- 7. Also ensure equipment table allows updates from authenticated users
-- (needed for updating rooms_id when transferring)
DO $$
BEGIN
    -- Check if the policy exists before creating
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'equipment' 
        AND schemaname = 'public' 
        AND policyname = 'allow_authenticated_update_equipment'
    ) THEN
        CREATE POLICY "allow_authenticated_update_equipment" 
            ON public.equipment 
            FOR UPDATE 
            TO authenticated 
            USING (true);
    END IF;
END $$;

-- 8. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.equipment_mutations TO authenticated;
GRANT SELECT, INSERT ON public.equipment_mutations TO anon;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 9. Verify the table was created successfully
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'equipment_mutations' 
AND table_schema = 'public'
ORDER BY ordinal_position;
