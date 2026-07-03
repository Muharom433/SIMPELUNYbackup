import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, MapPin, FileText, Send, User, Building, Phone } from 'lucide-react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment || !newRoomId || !picName) {
      toast.error(getText('Please fill all required fields', 'Harap isi semua kolom wajib'));
      return;
    }

    setLoading(true);
    try {
      const equipment = equipmentList.find(e => e.id === selectedEquipment);
      const previousRoomId = equipment?.rooms_id || null;

      // Insert mutation record
      const { error: mutationError } = await supabase
        .from('equipment_mutations')
        .insert({
          equipment_id: selectedEquipment,
          previous_room_id: previousRoomId,
          new_room_id: newRoomId,
          pic_name: picName,
          pic_phone: picPhone || null,
          notes: notes || null
        });

      if (mutationError) throw mutationError;

      // Update equipment location
      const { error: updateError } = await supabase
        .from('equipment')
        .update({ rooms_id: newRoomId })
        .eq('id', selectedEquipment);

      if (updateError) throw updateError;

      toast.success(getText('Transfer recorded successfully', 'Transfer berhasil dicatat'));
      
      // Reset form
      setSelectedEquipment('');
      setNewRoomId('');
      setPicName('');
      setPicPhone('');
      setNotes('');
      
      // Refresh data to get updated equipment locations
      await fetchData();

    } catch (error) {
      console.error('Error recording transfer:', error);
      toast.error(getText('Failed to record transfer', 'Gagal mencatat transfer'));
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
