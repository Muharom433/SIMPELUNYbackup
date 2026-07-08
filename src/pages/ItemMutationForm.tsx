import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, MapPin, FileText, Send, User, Building, Phone, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import CreatableSelect from 'react-select/creatable';

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
  const [loading, setLoading] = useState(false);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [defaultDeptId, setDefaultDeptId] = useState<string>('');
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
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

      if (equipmentRes.error) throw equipmentRes.error;
      if (roomsRes.error) throw roomsRes.error;

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

  const handleCreateEquipment = async (inputValue: string) => {
    setLoading(true);
    try {
      const newEquipment = {
        name: inputValue,
        code: `NEW-${Math.floor(Date.now() / 1000)}`,
        category: 'Uncategorized',
        is_mandatory: false,
        is_available: true,
        quantity: 1,
        original_quantity: 1
      };

      const { data, error } = await supabase
        .from('equipment')
        .insert([newEquipment])
        .select()
        .single();

      if (error) throw error;

      setEquipmentList([...equipmentList, data]);
      setSelectedEquipment(data.id);
      toast.success(getText('New item added successfully', 'Barang baru berhasil ditambahkan'));
    } catch (error) {
      console.error('Error creating equipment:', error);
      toast.error(getText('Failed to create new item', 'Gagal menambahkan barang baru'));
    } finally {
      setLoading(false);
    }
  };

  const equipmentOptions = equipmentList.map(eq => ({
    value: eq.id,
    label: `${eq.name} (${eq.code})`
  }));

  const handleCreateRoom = async (inputValue: string) => {
    if (!defaultDeptId) {
      toast.error(getText('Cannot create room: No department found', 'Gagal membuat ruangan: Tidak ada departemen'));
      return;
    }

    setLoading(true);
    try {
      const newRoom = {
        name: inputValue,
        code: `R-${Math.floor(Date.now() / 1000)}`,
        capacity: 30,
        department_id: defaultDeptId,
        is_available: true
      };

      const { data, error } = await supabase
        .from('rooms')
        .insert([newRoom])
        .select()
        .single();

      if (error) throw error;

      setRoomList([...roomList, data]);
      setNewRoomId(data.id);
      toast.success(getText('New room added successfully', 'Ruangan baru berhasil ditambahkan'));
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error(getText('Failed to create new room', 'Gagal menambahkan ruangan baru'));
    } finally {
      setLoading(false);
    }
  };

  const roomOptions = roomList.map(room => ({
    value: room.id,
    label: `${room.name} (${room.code})`
  }));

  const saveToLocalStorage = () => {
    try {
      const equipment = equipmentList.find(e => e.id === selectedEquipment);
      const previousRoom = equipment?.rooms_id 
        ? roomList.find(r => r.id === equipment.rooms_id)
        : null;
      const newRoom = roomList.find(r => r.id === newRoomId);

      const newMutation = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pic_name: picName,
        pic_phone: picPhone || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
        equipment: equipment ? { name: equipment.name, code: equipment.code } : null,
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
    if (!selectedEquipment || !newRoomId || !picName) {
      toast.error(getText('Please fill all required fields', 'Harap isi semua kolom wajib'));
      return;
    }

    setLoading(true);
    setDbError(null);
    
    const fallbackToLocal = async (reason: string) => {
      console.warn(`[ItemMutation] Falling back to local storage. Reason: ${reason}`);
      const saved = saveToLocalStorage();
      
      // Try to update equipment table room on Supabase anyway
      try {
        await supabase
          .from('equipment')
          .update({ rooms_id: newRoomId })
          .eq('id', selectedEquipment);
      } catch (err) {
        console.error('Failed to update equipment location on Supabase:', err);
      }

      if (saved) {
        toast.success(getText(
          'Transfer recorded successfully (saved locally)!',
          'Transfer berhasil dicatat (tersimpan di browser lokal)!'
        ));
        
        // Reset form
        setSelectedEquipment('');
        setNewRoomId('');
        setPicName('');
        setPicPhone('');
        setNotes('');
        
        // Refresh data
        await fetchData();
      } else {
        toast.error(getText('Failed to record transfer locally', 'Gagal mencatat transfer secara lokal'));
      }
    };

    try {
      const equipment = equipmentList.find(e => e.id === selectedEquipment);
      const previousRoomId = equipment?.rooms_id || null;

      // Helper to classify errors
      const classifyError = (err: any): string => {
        const msg = (err?.message || '').toLowerCase();
        const code = (err as any)?.code || '';
        if (code === '42P01' || (msg.includes('relation') && msg.includes('does not exist'))) return 'table_not_found';
        if (code === '42703' || msg.includes('pic_phone') || (msg.includes('column') && msg.includes('does not exist'))) return 'missing_column';
        if (code === '42501' || msg.includes('row-level security') || msg.includes('insufficient_privilege') || msg.includes('permission denied')) return 'rls_denied';
        if (code === '23503' || msg.includes('foreign key') || msg.includes('violates foreign key')) return 'fk_violation';
        return 'other';
      };

      // --- Step 1: Insert mutation record ---
      let mutationInserted = false;

      // Attempt 1: Try with pic_phone
      const insertDataFull: any = {
        equipment_id: selectedEquipment,
        previous_room_id: previousRoomId,
        new_room_id: newRoomId,
        pic_name: picName,
        pic_phone: picPhone || null,
        notes: notes || null
      };

      const { error: insertError1 } = await supabase
        .from('equipment_mutations')
        .insert(insertDataFull);

      if (!insertError1) {
        mutationInserted = true;
      } else {
        const errorType1 = classifyError(insertError1);
        console.warn('[ItemMutation] Insert attempt 1 failed:', errorType1, insertError1.message);

        // Table doesn't exist
        if (errorType1 === 'table_not_found' || errorType1 === 'rls_denied') {
          await fallbackToLocal(errorType1);
          return;
        }

        // Missing column (pic_phone) - retry without it
        if (errorType1 === 'missing_column') {
          console.warn('[ItemMutation] Retrying without pic_phone...');
          const { pic_phone, ...insertDataNoPhone } = insertDataFull;
          const { error: insertError2 } = await supabase
            .from('equipment_mutations')
            .insert(insertDataNoPhone);

          if (!insertError2) {
            mutationInserted = true;
            toast.success(getText(
              'Transfer recorded (note: pic_phone column missing, please run migration)',
              'Transfer tercatat (catatan: kolom pic_phone belum ada, jalankan migrasi)'
            ));
          } else {
            const errorType2 = classifyError(insertError2);
            if (errorType2 === 'rls_denied' || errorType2 === 'table_not_found') {
              await fallbackToLocal(errorType2);
              return;
            }
            throw insertError2;
          }
        }

        // FK violation - equipment or room doesn't exist
        if (!mutationInserted && errorType1 === 'fk_violation') {
          const errDetail = getText(
            'The selected equipment or room was not found in the database. Please refresh and try again.',
            'Barang atau ruangan yang dipilih tidak ditemukan di database. Silakan refresh dan coba lagi.'
          );
          setDbError(errDetail);
          throw new Error(errDetail);
        }

        // Other error that wasn't handled
        if (!mutationInserted) {
          throw insertError1;
        }
      }

      // --- Step 2: Update equipment location ---
      if (mutationInserted) {
        const { error: updateError } = await supabase
          .from('equipment')
          .update({ rooms_id: newRoomId })
          .eq('id', selectedEquipment);

        if (updateError) {
          console.error('[ItemMutation] Failed to update equipment location:', updateError);
          // Don't throw - mutation was already recorded, just warn
          toast.error(getText(
            'Transfer recorded but failed to update equipment location. Equipment room may need manual update.',
            'Transfer tercatat tapi gagal memperbarui lokasi alat. Lokasi alat mungkin perlu diperbarui manual.'
          ));
        } else {
          toast.success(getText('Transfer recorded successfully!', 'Transfer berhasil dicatat!'));
        }
        
        // Reset form
        setSelectedEquipment('');
        setNewRoomId('');
        setPicName('');
        setPicPhone('');
        setNotes('');
        
        // Refresh data to get updated equipment locations
        await fetchData();
      }

    } catch (error: any) {
      console.error('[ItemMutation] Error recording transfer, falling back to local:', error);
      await fallbackToLocal('exception');
    } finally {
      setLoading(false);
    }
  };

  const selectedEquipmentData = equipmentList.find(e => e.id === selectedEquipment);
  const currentRoomData = selectedEquipmentData?.rooms_id 
    ? roomList.find(r => r.id === selectedEquipmentData.rooms_id)
    : null;

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
          
          {/* Error Banner with SQL Fix */}
          {dbError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-red-800 text-sm">
                    {getText('Database Error', 'Error Database')}
                  </h3>
                  <p className="text-red-700 text-xs mt-1 break-all">{dbError}</p>
                  <div className="mt-3 bg-red-100 rounded-lg p-3">
                    <p className="text-red-800 text-xs font-semibold mb-2">
                      {getText(
                        'Run this SQL in Supabase SQL Editor:',
                        'Jalankan SQL ini di Supabase SQL Editor:'
                      )}
                    </p>
                    <pre className="text-[10px] text-red-900 bg-white rounded p-2 overflow-x-auto whitespace-pre-wrap border border-red-200 select-all">
{`-- Create table & fix policies
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
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
ALTER TABLE public.equipment_mutations ADD COLUMN IF NOT EXISTS pic_phone TEXT;
ALTER TABLE public.equipment_mutations ENABLE ROW LEVEL SECURITY;
-- Drop ALL old policies
DROP POLICY IF EXISTS "Super admins can manage equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Authenticated users can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Authenticated users can view equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Anyone can insert equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "Anyone can view equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_select_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_insert_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_anon_insert_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_anon_select_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_update_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "allow_all_delete_equipment_mutations" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_select_authenticated" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_select_anon" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_insert_authenticated" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_insert_anon" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_update_authenticated" ON public.equipment_mutations;
DROP POLICY IF EXISTS "mutations_delete_authenticated" ON public.equipment_mutations;
-- Create new policies
CREATE POLICY "mutations_select_authenticated" ON public.equipment_mutations FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutations_select_anon" ON public.equipment_mutations FOR SELECT TO anon USING (true);
CREATE POLICY "mutations_insert_authenticated" ON public.equipment_mutations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mutations_insert_anon" ON public.equipment_mutations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "mutations_update_authenticated" ON public.equipment_mutations FOR UPDATE TO authenticated USING (true);
-- Grant permissions
GRANT SELECT, INSERT ON public.equipment_mutations TO authenticated;
GRANT SELECT, INSERT ON public.equipment_mutations TO anon;
GRANT UPDATE, DELETE ON public.equipment_mutations TO authenticated;
-- Reload schema cache
NOTIFY pgrst, 'reload schema';`}
                    </pre>
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
                  onChange={(newValue: any) => setSelectedEquipment(newValue ? newValue.value : '')}
                  onCreateOption={handleCreateEquipment}
                  options={equipmentOptions}
                  value={equipmentOptions.find(option => option.value === selectedEquipment) || null}
                  placeholder={getText('Search or type new item...', 'Cari atau ketik barang baru...')}
                  formatCreateLabel={(inputValue) => `${getText('Add new item', 'Tambah barang baru')}: "${inputValue}"`}
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

            {/* Current Location (Read-only) */}
            {selectedEquipment && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  {getText('Current Location', 'Lokasi Saat Ini')}
                </label>
                <div className="flex items-center text-sm text-gray-900 font-medium">
                  <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                  {currentRoomData ? `${currentRoomData.name} (${currentRoomData.code})` : getText('No specific location', 'Tidak ada lokasi spesifik')}
                </div>
              </div>
            )}

            {/* Destination Room */}
            <div>
              <label htmlFor="new_room" className="block text-sm font-medium text-gray-700">
                {getText('Destination Room', 'Ruangan Tujuan')} <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm z-40">
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
