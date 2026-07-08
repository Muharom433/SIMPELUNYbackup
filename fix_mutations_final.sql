-- ============================================================
-- SQL MIGRATION: Perbaikan Tabel Histori & Mutasi Barang
-- Jalankan query ini di Supabase SQL Editor (https://supabase.com/dashboard)
-- Pilih project Anda > klik SQL Editor di menu kiri > New Query > Paste & Run
-- ============================================================

-- 1. Pastikan ekstensi uuid-ossp aktif
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Buat tabel equipment_mutations jika belum ada
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

-- 3. Pastikan kolom pic_phone ada (antisipasi jika tabel lama belum memiliki kolom ini)
ALTER TABLE public.equipment_mutations ADD COLUMN IF NOT EXISTS pic_phone TEXT;

-- 4. Aktifkan Row Level Security (RLS)
ALTER TABLE public.equipment_mutations ENABLE ROW LEVEL SECURITY;

-- 5. Hapus semua policy lama untuk menghindari konflik
DO $$
DECLARE
    pol RECORD;
END;
$$;
-- Note: Policy drop block handled below individually to avoid errors on schema queries.
DROP POLICY IF EXISTS "allow_select_all" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_insert_all" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_update_authenticated" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_delete_authenticated" ON public.equipment_mutations;
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

-- 6. Buat RLS Policy Baru yang Sesuai
-- A. Policy SELECT (Siapa saja bisa melihat data mutasi)
CREATE POLICY "allow_select_all" ON public.equipment_mutations
    FOR SELECT USING (true);

-- B. Policy INSERT (Siapa saja bisa mencatat mutasi baru, termasuk dari form publik)
CREATE POLICY "allow_insert_all" ON public.equipment_mutations
    FOR INSERT WITH CHECK (true);

-- C. Policy UPDATE (Hanya user terautentikasi / admin yang bisa update data histori)
CREATE POLICY "allow_update_authenticated" ON public.equipment_mutations
    FOR UPDATE TO authenticated USING (true);

-- D. Policy DELETE (Hanya user terautentikasi / admin yang bisa hapus data histori)
CREATE POLICY "allow_delete_authenticated" ON public.equipment_mutations
    FOR DELETE TO authenticated USING (true);

-- 7. Pastikan policy tabel 'equipment' mengizinkan update lokasi barang (rooms_id)
-- Ini diperlukan saat memindahkan barang lewat form publik maupun admin
DROP POLICY IF EXISTS "Anyone can update equipment" ON public.equipment;
DROP POLICY IF EXISTS "equipment_update_anon" ON public.equipment;
DROP POLICY IF EXISTS "allow_update_all_equipment" ON public.equipment;

CREATE POLICY "allow_update_all_equipment" ON public.equipment
    FOR UPDATE USING (true);

-- 8. Pastikan policy tabel 'rooms' mengizinkan pembacaan oleh publik (jika ada pembatasan)
DROP POLICY IF EXISTS "allow_select_all_rooms" ON public.rooms;
CREATE POLICY "allow_select_all_rooms" ON public.rooms
    FOR SELECT USING (true);

-- 9. Berikan izin akses (Grant Permissions) ke roles
GRANT ALL ON public.equipment_mutations TO authenticated;
GRANT ALL ON public.equipment_mutations TO anon;
GRANT ALL ON public.equipment_mutations TO service_role;

GRANT ALL ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO anon;
GRANT ALL ON public.equipment TO service_role;

-- 10. Buat index untuk mempercepat query pencarian
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_created_at ON public.equipment_mutations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_equipment_id ON public.equipment_mutations(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_mutations_new_room_id ON public.equipment_mutations(new_room_id);

-- 11. Muat ulang cache PostgREST agar mengenali struktur tabel baru
NOTIFY pgrst, 'reload schema';
