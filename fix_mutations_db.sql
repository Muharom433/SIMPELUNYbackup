-- 1. Create equipment_mutations table (if not exists)
CREATE TABLE IF NOT EXISTS public.equipment_mutations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    previous_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    new_room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    pic_name TEXT NOT NULL,
    pic_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add pic_phone column if it was created before without it
ALTER TABLE public.equipment_mutations ADD COLUMN IF NOT EXISTS pic_phone TEXT;

-- 3. Enable RLS but allow public (anon) access for the public form
ALTER TABLE public.equipment_mutations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent conflicts
DROP POLICY IF EXISTS "Authenticated users can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Public users can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Anyone can insert equipment_mutations" ON public.equipment_mutations;

-- Allow ANYONE (including public/anon users) to insert mutation records
CREATE POLICY "Anyone can insert equipment_mutations"
    ON public.equipment_mutations
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Allow ANYONE to view mutation records
CREATE POLICY "Anyone can view equipment_mutations"
    ON public.equipment_mutations
    FOR SELECT
    TO public
    USING (true);

-- 4. Ensure equipment and rooms can be updated/inserted by public users (for the Create New feature)
-- (Assuming they have RLS enabled. If not, this won't hurt)
DROP POLICY IF EXISTS "Anyone can insert equipment" ON public.equipment;
DROP POLICY IF EXISTS "Anyone can update equipment" ON public.equipment;
DROP POLICY IF EXISTS "Anyone can insert rooms" ON public.rooms;

CREATE POLICY "Anyone can insert equipment" ON public.equipment FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update equipment" ON public.equipment FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can insert rooms" ON public.rooms FOR INSERT TO public WITH CHECK (true);
