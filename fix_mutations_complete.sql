-- ============================================
-- FIX COMPLETE: equipment_mutations table
-- Jalankan SELURUH script ini di Supabase SQL Editor
-- ============================================

-- 1. Pastikan extension uuid-ossp ada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Buat tabel jika belum ada
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

-- 3. Tambahkan kolom pic_phone jika belum ada (untuk tabel yang sudah dibuat sebelumnya)
ALTER TABLE public.equipment_mutations ADD COLUMN IF NOT EXISTS pic_phone TEXT;

-- 4. Enable RLS
ALTER TABLE public.equipment_mutations ENABLE ROW LEVEL SECURITY;

-- 5. Drop SEMUA policy lama yang mungkin conflict
DROP POLICY IF EXISTS "Super admins can manage equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Authenticated users can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Authenticated users can view equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Public users can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Anyone can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Anyone can view equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_select_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_insert_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_anon_insert_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_anon_select_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_update_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_delete_equipment_mutations" ON public.equipment_mutations;

-- 6. Buat policy baru yang BENAR (authenticated + anon terpisah)
-- SELECT policies
CREATE POLICY "mutations_select_authenticated" 
    ON public.equipment_mutations FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "mutations_select_anon" 
    ON public.equipment_mutations FOR SELECT 
    TO anon 
    USING (true);

-- INSERT policies
CREATE POLICY "mutations_insert_authenticated" 
    ON public.equipment_mutations FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "mutations_insert_anon" 
    ON public.equipment_mutations FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- UPDATE policy (authenticated only)
CREATE POLICY "mutations_update_authenticated" 
    ON public.equipment_mutations FOR UPDATE 
    TO authenticated 
    USING (true);

-- DELETE policy (super_admin & laboratory only)
CREATE POLICY "mutations_delete_authenticated" 
    ON public.equipment_mutations FOR DELETE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'laboratory')
        )
    );

-- 7. Grant permissions eksplisit
GRANT SELECT, INSERT ON public.equipment_mutations TO authenticated;
GRANT SELECT, INSERT ON public.equipment_mutations TO anon;
GRANT UPDATE, DELETE ON public.equipment_mutations TO authenticated;

-- 8. Tambah index untuk performa query
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_created_at 
    ON public.equipment_mutations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_equipment_id 
    ON public.equipment_mutations (equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_new_room_id 
    ON public.equipment_mutations (new_room_id);
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_previous_room_id 
    ON public.equipment_mutations (previous_room_id);

-- 9. Pastikan equipment table juga bisa di-update oleh anon (untuk update rooms_id)
DROP POLICY IF EXISTS "Anyone can insert equipment" ON public.equipment;
DROP POLICY IF EXISTS "Anyone can update equipment" ON public.equipment;
DROP POLICY IF EXISTS "equipment_update_anon" ON public.equipment;
DROP POLICY IF EXISTS "equipment_insert_anon" ON public.equipment;

CREATE POLICY "equipment_update_anon" 
    ON public.equipment FOR UPDATE 
    TO anon 
    USING (true);

CREATE POLICY "equipment_insert_anon" 
    ON public.equipment FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- 10. Pastikan rooms table bisa di-insert oleh anon (untuk fitur Create New Room)
DROP POLICY IF EXISTS "Anyone can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "rooms_insert_anon" ON public.rooms;

CREATE POLICY "rooms_insert_anon" 
    ON public.rooms FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- Selesai! Refresh schema cache PostgREST dengan menjalankan:
NOTIFY pgrst, 'reload schema';
