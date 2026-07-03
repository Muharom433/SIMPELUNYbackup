-- Create equipment_mutations table to track item transfer history
CREATE TABLE IF NOT EXISTS public.equipment_mutations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    previous_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    new_room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    pic_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.equipment_mutations ENABLE ROW LEVEL SECURITY;

-- Create policies for equipment_mutations
-- Super admins and admins can do everything
CREATE POLICY "Super admins can manage equipment_mutations"
    ON public.equipment_mutations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND (users.role = 'super_admin' OR users.role = 'laboratory')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND (users.role = 'super_admin' OR users.role = 'laboratory')
        )
    );

-- Allow inserting for authenticated users (since the form might be accessed by any user)
CREATE POLICY "Authenticated users can insert equipment_mutations"
    ON public.equipment_mutations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow viewing for everyone just in case
CREATE POLICY "Authenticated users can view equipment_mutations"
    ON public.equipment_mutations
    FOR SELECT
    TO authenticated
    USING (true);
