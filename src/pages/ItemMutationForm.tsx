import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, MapPin, FileText, Send, User, Building, Phone, AlertTriangle, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import CreatableSelect from 'react-select/creatable';
import { useNavigate } from 'react-router-dom';

interface Equipment {
  id: string;
  name: string;
  code: string;
  rooms_id: string | null;
}

interface Room {
  id: string;
  name: string;
  code: string;
}

const ItemMutationForm = () => {
  const { getText } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [defaultDeptId, setDefaultDeptId] = useState<string>('');
  const [dbError, setDbError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [customEquipmentName, setCustomEquipmentName] = useState<string>('');
  const [isCustomEquipment, setIsCustomEquipment] = useState<boolean>(false);
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [newRoomId, setNewRoomId] = useState<string>('');
  const [picName, setPicName] = useState<string>('');
  const [picPhone, setPicPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [equipmentRes, roomsRes, deptRes] = await Promise.all([
        supabase.from('equipment').select('id, name, code, rooms_id').order('name'),
        supabase.from('rooms').select('id, name, code').order('name'),
        supabase.from('departments').select('id').limit(1)
      ]);

      if (equipmentRes.error) {
        console.error('[ItemMutation] Equipment fetch error:', equipmentRes.error);
        // Don't throw, still try to show partial data
      }
      if (roomsRes.error) {
        console.error('[ItemMutation] Rooms fetch error:', roomsRes.error);
      }

      setEquipmentList(equipmentRes.data || []);
      setRoomList(roomsRes.data || []);
      if (deptRes.data && deptRes.data.length > 0) {
        setDefaultDeptId(deptRes.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(getText('Failed to load data', 'Gagal memuat data'));
    }
  };

  const handleCreateEquipment = (inputValue: string) => {
    if (!inputValue || !inputValue.trim()) return;
    const cleanName = inputValue.trim();
    // Simply store the typed text as custom equipment name (no DB insert)
    setCustomEquipmentName(cleanName);
    setIsCustomEquipment(true);
    setSelectedEquipment('');
    setCurrentRoomId('');
    toast.success(getText(`Using custom item: "${cleanName}"`, `Menggunakan keterangan barang: "${cleanName}"`));
  };

  const equipmentOptions = equipmentList.map(eq => ({
    value: eq.id,
    label: `${eq.name} (${eq.code})`
  }));

  const createRoomOption = async (inputValue: string, isCurrent: boolean) => {
    if (!inputValue || !inputValue.trim()) return;
    setLoading(true);
    const cleanName = inputValue.trim();
    const generatedCode = `R-${Math.floor(Date.now() / 1000)}`;

    try {
      // 1. Try insert full room
      const fullRoom: any = {
        name: cleanName,
        code: generatedCode,
        capacity: 30,
        is_available: true
      };

      if (defaultDeptId) {
        fullRoom.department_id = defaultDeptId;
      }

      let insertedRoom: Room | null = null;
      let dbSuccess = false;

      const { data: d1, error: e1 } = await supabase
        .from('rooms')
        .insert([fullRoom])
        .select('id, name, code')
        .single();

      if (!e1 && d1) {
        insertedRoom = d1;
        dbSuccess = true;
      } else {
        console.warn('[ItemMutation] Create room attempt 1 failed:', e1);

        // 2. Try minimal room without department_id
        const minimalRoom: any = {
          name: cleanName,
          code: generatedCode,
          capacity: 30,
          is_available: true
        };

        const { data: d2, error: e2 } = await supabase
          .from('rooms')
          .insert([minimalRoom])
          .select('id, name, code')
          .single();

        if (!e2 && d2) {
          insertedRoom = d2;
          dbSuccess = true;
        } else {
          console.warn('[ItemMutation] Create room attempt 2 failed:', e2);
        }
      }

      if (dbSuccess && insertedRoom) {
        const newRoomData: Room = { id: insertedRoom.id, name: insertedRoom.name, code: insertedRoom.code };
        setRoomList(prev => [...prev, newRoomData]);
        if (isCurrent) {
          setCurrentRoomId(newRoomData.id);
        } else {
          setNewRoomId(newRoomData.id);
        }
        toast.success(getText('New room added successfully', 'Ruangan baru berhasil ditambahkan'));
      } else {
        // Fallback: local room
        const tempId = crypto.randomUUID();
        const localRoom: Room = { id: tempId, name: cleanName, code: generatedCode };
        setRoomList(prev => [...prev, localRoom]);
        if (isCurrent) {
          setCurrentRoomId(tempId);
        } else {
          setNewRoomId(tempId);
        }
        toast.success(getText('New room added', 'Ruangan baru ditambahkan'));
      }
    } catch (error) {
      console.error('Error creating room:', error);
      const tempId = crypto.randomUUID();
      const localRoom: Room = { id: tempId, name: inputValue.trim(), code: `R-${Math.floor(Date.now() / 1000)}` };
      setRoomList(prev => [...prev, localRoom]);
      if (isCurrent) {
        setCurrentRoomId(tempId);
      } else {
        setNewRoomId(tempId);
      }
      toast.success(getText('New room added', 'Ruangan baru ditambahkan'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = (inputValue: string) => createRoomOption(inputValue, false);
  const handleCreateCurrentRoom = (inputValue: string) => createRoomOption(inputValue, true);

  const roomOptions = roomList.map(room => ({
    value: room.id,
    label: `${room.name} (${room.code})`
  }));

  const saveToLocalStorage = () => {
    try {
      const equipment = isCustomEquipment ? null : equipmentList.find(e => e.id === selectedEquipment);
      const previousRoom = currentRoomId
        ? roomList.find(r => r.id === currentRoomId)
        : (equipment?.rooms_id
          ? roomList.find(r => r.id === equipment.rooms_id)
          : null);
      const newRoom = roomList.find(r => r.id === newRoomId);

      const equipmentDisplay = isCustomEquipment
        ? { name: customEquipmentName, code: 'CUSTOM' }
        : (equipment ? { name: equipment.name, code: equipment.code } : null);

      const newMutation = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pic_name: picName,
        pic_phone: picPhone || null,
        notes: isCustomEquipment
          ? (notes ? `[${customEquipmentName}] ${notes}` : customEquipmentName)
          : (notes || null),
        created_at: new Date().toISOString(),
        equipment: equipmentDisplay,
        previous_room: previousRoom ? { name: previousRoom.name, code: previousRoom.code } : null,
        new_room: newRoom ? { name: newRoom.name, code: newRoom.code } : null
      };

      const existingData = localStorage.getItem('local_equipment_mutations');
      const list = existingData ? JSON.parse(existingData) : [];
      list.unshift(newMutation);
      localStorage.setItem('local_equipment_mutations', JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('Error saving local mutation:', e);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!selectedEquipment && !isCustomEquipment) || !newRoomId || !picName) {
      toast.error(getText('Please fill all required fields', 'Harap isi semua kolom wajib'));
      return;
    }

    setLoading(true);
    setDbError(null);
    setDebugInfo(null);

    try {
      const equipment = isCustomEquipment ? null : equipmentList.find(e => e.id === selectedEquipment);
      const previousRoomId = currentRoomId || equipment?.rooms_id || null;

      // --- Step 1: Insert mutation record ---
      // Try inserting with all fields first
      const insertData: any = {
        previous_room_id: previousRoomId,
        new_room_id: newRoomId,
        pic_name: picName,
        pic_phone: picPhone || null,
        notes: isCustomEquipment
          ? (notes ? `[${customEquipmentName}] ${notes}` : customEquipmentName)
          : (notes || null)
      };

      // Only include equipment_id if we selected from the dropdown
      if (!isCustomEquipment && selectedEquipment) {
        insertData.equipment_id = selectedEquipment;
      }

      let mutationInserted = false;
      let insertError: any = null;

      // Attempt 1: Full insert with pic_phone
      const { error: err1 } = await supabase
        .from('equipment_mutations')
        .insert(insertData);

      if (!err1) {
        mutationInserted = true;
      } else {
        insertError = err1;
        console.warn('[ItemMutation] Insert attempt 1 failed:', err1.code, err1.message);

        // Attempt 2: If pic_phone column missing, try without it
        const isPicPhoneError =
          err1.code === '42703' ||
          (err1.message || '').toLowerCase().includes('pic_phone') ||
          ((err1.message || '').toLowerCase().includes('column') &&
            (err1.message || '').toLowerCase().includes('does not exist'));

        if (isPicPhoneError) {
          console.warn('[ItemMutation] Retrying without pic_phone...');
          const { pic_phone, ...insertDataNoPhone } = insertData;
          const { error: err2 } = await supabase
            .from('equipment_mutations')
            .insert(insertDataNoPhone);

          if (!err2) {
            mutationInserted = true;
            insertError = null;
          } else {
            insertError = err2;
            console.warn('[ItemMutation] Insert attempt 2 (no phone) failed:', err2.code, err2.message);
          }
        }

        // If still failing due to RLS, missing table, or FK constraint (e.g. client item/room ID), fallback to localStorage
        if (!mutationInserted) {
          const errCode = (insertError?.code || '');
          const errMsg = (insertError?.message || '').toLowerCase();
          const isTableMissing = errCode === '42P01' || (errMsg.includes('relation') && errMsg.includes('does not exist'));
          const isRLSDenied = errCode === '42501' || errMsg.includes('row-level security') || errMsg.includes('permission denied') || errMsg.includes('insufficient_privilege');
          const isFKViolation = errCode === '23503' || errMsg.includes('foreign key constraint') || errMsg.includes('violates foreign key');
          const isNotNullViolation = errCode === '23502' || errMsg.includes('null value in column') || errMsg.includes('violates not-null constraint');

          if (isTableMissing || isRLSDenied || isFKViolation || isNotNullViolation) {
            // Show the SQL fix and save to localStorage
            const debugMsg = isTableMissing
              ? `Tabel equipment_mutations belum dibuat di database. Kode error: ${errCode}`
              : isNotNullViolation
              ? `Penambahan diblokir karena kolom equipment_id wajib diisi di database (NOT NULL). Jalankan SQL Fix untuk memperbarui skema.`
              : isFKViolation
              ? `Penambahan ke database dibatasi oleh Foreign Key (menggunakan item/ruangan baru). Kode error: ${errCode}`
              : `RLS (Row Level Security) memblokir operasi insert. Kode error: ${errCode}. Pesan: ${insertError?.message}`;
            setDbError(debugMsg);
            setDebugInfo(JSON.stringify({ code: errCode, message: insertError?.message, hint: insertError?.hint }, null, 2));

            const saved = saveToLocalStorage();
            // Also try to update equipment location if possible
            try {
              await supabase
                .from('equipment')
                .update({ rooms_id: newRoomId })
                .eq('id', selectedEquipment);
            } catch (_) {}

            if (saved) {
              toast.success(getText(
                'Transfer saved locally (DB fix needed - see instructions below)',
                'Transfer disimpan lokal (perlu perbaikan DB - lihat instruksi di bawah)'
              ));
              setSelectedEquipment('');
              setCustomEquipmentName('');
              setIsCustomEquipment(false);
              setCurrentRoomId('');
              setNewRoomId('');
              setPicName('');
              setPicPhone('');
              setNotes('');
              await fetchData();
            } else {
              toast.error(getText('Failed to save transfer', 'Gagal menyimpan transfer'));
            }
            return;
          }

          // Other errors - show to user and fail
          throw insertError;
        }
      }

      // --- Step 2: Update equipment location (only if a real equipment was selected) ---
      if (mutationInserted) {
        if (!isCustomEquipment && selectedEquipment) {
          const { error: updateError } = await supabase
            .from('equipment')
            .update({ rooms_id: newRoomId })
            .eq('id', selectedEquipment);

          if (updateError) {
            console.warn('[ItemMutation] Failed to update equipment location:', updateError);
            toast.success(getText(
              'Transfer recorded! (Note: equipment location update failed, may need manual update)',
              'Transfer berhasil dicatat! (Catatan: gagal update lokasi barang, mungkin perlu update manual)'
            ));
          } else {
            toast.success(getText('Transfer recorded successfully!', 'Transfer berhasil dicatat!'));
          }
        } else {
          toast.success(getText('Transfer recorded successfully!', 'Transfer berhasil dicatat!'));
        }

        // Reset form
        setSelectedEquipment('');
        setCustomEquipmentName('');
        setIsCustomEquipment(false);
        setCurrentRoomId('');
        setNewRoomId('');
        setPicName('');
        setPicPhone('');
        setNotes('');

        // Refresh data
        await fetchData();
      }

    } catch (error: any) {
      console.error('[ItemMutation] Unexpected error:', error);
      const errMsg = error?.message || 'Unknown error';
      toast.error(getText(`Transfer failed: ${errMsg}`, `Transfer gagal: ${errMsg}`));
      setDbError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const selectedEquipmentData = isCustomEquipment ? null : equipmentList.find(e => e.id === selectedEquipment);
  const currentRoomData = selectedEquipmentData?.rooms_id
    ? roomList.find(r => r.id === selectedEquipmentData.rooms_id)
    : null;

  const SQL_FIX = `-- Jalankan SQL ini di Supabase SQL Editor untuk memperbaiki izin database
-- URL: https://supabase.com/dashboard > Project > SQL Editor > New Query

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

ALTER TABLE public.equipment_mutations ADD COLUMN IF NOT EXISTS pic_phone TEXT;
ALTER TABLE public.equipment_mutations ENABLE ROW LEVEL SECURITY;

-- Hapus semua policy lama
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies
        WHERE tablename = 'equipment_mutations' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.equipment_mutations', pol.policyname);
    END LOOP;
END $$;

-- Buat policy baru (izinkan anon karena app ini tidak pakai Supabase Auth)
CREATE POLICY "em_select_anon" ON public.equipment_mutations FOR SELECT TO anon USING (true);
CREATE POLICY "em_insert_anon" ON public.equipment_mutations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "em_update_anon" ON public.equipment_mutations FOR UPDATE TO anon USING (true);
CREATE POLICY "em_select_authenticated" ON public.equipment_mutations FOR SELECT TO authenticated USING (true);
CREATE POLICY "em_insert_authenticated" ON public.equipment_mutations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "em_update_authenticated" ON public.equipment_mutations FOR UPDATE TO authenticated USING (true);

-- Izinkan anon & authenticated untuk insert & update equipment
DROP POLICY IF EXISTS "em_equipment_insert_anon" ON public.equipment;
CREATE POLICY "em_equipment_insert_anon" ON public.equipment FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "em_equipment_update_anon" ON public.equipment;
CREATE POLICY "em_equipment_update_anon" ON public.equipment FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Izinkan anon & authenticated untuk insert rooms baru
DROP POLICY IF EXISTS "em_rooms_insert_anon" ON public.rooms;
CREATE POLICY "em_rooms_insert_anon" ON public.rooms FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE ON public.equipment_mutations TO anon;
GRANT SELECT, INSERT, UPDATE ON public.equipment_mutations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.equipment TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rooms TO anon, authenticated;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-full">
            <Package className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {getText('Item Transfer Form', 'Formulir Pemindahan Barang')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {getText('Record equipment movement between rooms', 'Catat perpindahan barang antar ruangan')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">

          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {getText('Back', 'Kembali')}
          </button>

          {/* Error Banner with SQL Fix */}
          {dbError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-red-800 text-sm">
                    {getText('Database Permission Error', 'Error Izin Database')}
                  </h3>
                  <p className="text-red-700 text-xs mt-1 break-all">{dbError}</p>
                  {debugInfo && (
                    <pre className="text-[10px] text-red-800 bg-red-100 rounded p-2 mt-2 overflow-x-auto">
                      {debugInfo}
                    </pre>
                  )}
                  <div className="mt-3 bg-red-100 rounded-lg p-3">
                    <p className="text-red-800 text-xs font-semibold mb-2">
                      {getText(
                        '⚡ Run this SQL in Supabase SQL Editor to fix the issue:',
                        '⚡ Jalankan SQL ini di Supabase SQL Editor untuk memperbaiki masalah:'
                      )}
                    </p>
                    <pre className="text-[10px] text-red-900 bg-white rounded p-2 overflow-x-auto whitespace-pre-wrap border border-red-200 select-all cursor-text">
                      {SQL_FIX}
                    </pre>
                    <p className="text-red-700 text-xs mt-2 font-medium">
                      💡 {getText(
                        'Data was saved locally in this browser. After running the SQL, the next transfer will sync to database.',
                        'Data tersimpan di browser ini. Setelah SQL dijalankan, transfer berikutnya akan tersimpan ke database.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>

            {/* Equipment Selection */}
            <div>
              <label htmlFor="equipment" className="block text-sm font-medium text-gray-700">
                {getText('Equipment', 'Barang')} <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm z-50">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
                <CreatableSelect
                  id="equipment"
                  isDisabled={loading}
                  isLoading={loading}
                  onChange={(newValue: any) => {
                    if (newValue) {
                      setSelectedEquipment(newValue.value);
                      setIsCustomEquipment(false);
                      setCustomEquipmentName('');
                      const selectedEq = equipmentList.find(e => e.id === newValue.value);
                      setCurrentRoomId(selectedEq?.rooms_id || '');
                    } else {
                      setSelectedEquipment('');
                      setIsCustomEquipment(false);
                      setCustomEquipmentName('');
                      setCurrentRoomId('');
                    }
                  }}
                  onCreateOption={handleCreateEquipment}
                  options={equipmentOptions}
                  value={
                    isCustomEquipment
                      ? { value: '__custom__', label: customEquipmentName }
                      : (equipmentOptions.find(option => option.value === selectedEquipment) || null)
                  }
                  placeholder={getText('Search or type item description...', 'Cari atau ketik keterangan barang...')}
                  formatCreateLabel={(inputValue) => `${getText('Use as description', 'Gunakan sebagai keterangan')}: "${inputValue}"`}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      paddingLeft: '2rem',
                      borderColor: '#D1D5DB',
                      boxShadow: 'none',
                      '&:hover': {
                        borderColor: '#9CA3AF'
                      }
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      paddingLeft: '0.5rem'
                    })
                  }}
                />
              </div>
            </div>

            {/* Custom Item Description Notice */}
            {isCustomEquipment && (
              <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                <div className="flex items-center text-xs text-blue-800 font-medium">
                  <Package className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
                  <span>{getText('Custom item: ', 'Barang kustom: ')} "{customEquipmentName}"</span>
                </div>
              </div>
            )}

            {/* Editable Current Location (Lokasi Saat Ini / Ruangan Asal) */}
            <div>
              <label htmlFor="current_room" className="block text-sm font-medium text-gray-700">
                {getText('Current Location (From)', 'LOKASI SAAT INI')} <span className="text-blue-600 text-xs font-normal">({getText('Editable', 'Bisa diketik / diedit')})</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm z-40">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <CreatableSelect
                  id="current_room"
                  isDisabled={loading}
                  isLoading={loading}
                  onChange={(newValue: any) => setCurrentRoomId(newValue ? newValue.value : '')}
                  onCreateOption={handleCreateCurrentRoom}
                  options={roomOptions}
                  value={roomOptions.find(option => option.value === currentRoomId) || null}
                  placeholder={getText('Search or type current location...', 'Cari atau ketik lokasi saat ini / asal barang...')}
                  formatCreateLabel={(inputValue) => `${getText('Add location', 'Set lokasi baru')}: "${inputValue}"`}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  isClearable
                  styles={{
                    control: (base) => ({
                      ...base,
                      paddingLeft: '2rem',
                      borderColor: '#D1D5DB',
                      boxShadow: 'none',
                      backgroundColor: '#F9FAFB',
                      '&:hover': {
                        borderColor: '#9CA3AF'
                      }
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      paddingLeft: '0.5rem'
                    })
                  }}
                />
              </div>
            </div>

            {/* Destination Room */}
            <div>
              <label htmlFor="new_room" className="block text-sm font-medium text-gray-700">
                {getText('Destination Room', 'Ruangan Tujuan')} <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm z-30">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <Building className="h-5 w-5 text-gray-400" />
                </div>
                <CreatableSelect
                  id="new_room"
                  isDisabled={loading}
                  isLoading={loading}
                  onChange={(newValue: any) => setNewRoomId(newValue ? newValue.value : '')}
                  onCreateOption={handleCreateRoom}
                  options={roomOptions}
                  value={roomOptions.find(option => option.value === newRoomId) || null}
                  placeholder={getText('Search or type new room...', 'Cari atau ketik ruangan baru...')}
                  formatCreateLabel={(inputValue) => `${getText('Add new room', 'Tambah ruangan baru')}: "${inputValue}"`}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      paddingLeft: '2rem',
                      borderColor: '#D1D5DB',
                      boxShadow: 'none',
                      '&:hover': {
                        borderColor: '#9CA3AF'
                      }
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      paddingLeft: '0.5rem'
                    })
                  }}
                />
              </div>
            </div>

            {/* PIC Name */}
            <div>
              <label htmlFor="pic_name" className="block text-sm font-medium text-gray-700">
                {getText('PIC Name', 'Nama Penanggung Jawab')} <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="pic_name"
                  id="pic_name"
                  required
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder={getText('Name of person moving the item', 'Nama orang yang memindahkan barang')}
                />
              </div>
            </div>

            {/* PIC Phone */}
            <div>
              <label htmlFor="pic_phone" className="block text-sm font-medium text-gray-700">
                {getText('PIC Phone Number', 'Nomor HP Penanggung Jawab')}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  name="pic_phone"
                  id="pic_phone"
                  value={picPhone}
                  onChange={(e) => setPicPhone(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder={getText('E.g. 081234567890', 'Contoh: 081234567890')}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                {getText('Notes (Optional)', 'Catatan (Opsional)')}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FileText className="h-5 w-5 text-gray-400" />
                </div>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder={getText('Reason for transfer or condition notes', 'Alasan perpindahan atau catatan kondisi')}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    {getText('Submitting...', 'Mengirim...')}
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Send className="h-4 w-4 mr-2" />
                    {getText('Submit Transfer', 'Simpan Perpindahan')}
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ItemMutationForm;
