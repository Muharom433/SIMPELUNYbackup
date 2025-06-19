import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building, Plus, Search, Edit, Trash2, Eye, Users, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Zap, Tv2, Speaker, Presentation, Mic, AirVent, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Room, Department, LectureSchedule } from '../types';
import toast from 'react-hot-toast';
import { format, parse } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const roomSchema = z.object({
  name: z.string().min(2, 'Nama ruangan minimal 2 karakter'),
  code: z.string().min(2, 'Kode ruangan minimal 2 karakter'),
  capacity: z.number().min(1, 'Kapasitas minimal 1'),
  department_id: z.string().min(1, 'Silakan pilih departemen'),
});
type RoomForm = z.infer<typeof roomSchema>;

interface RoomWithDetails extends Room {
  department: Department;
  status: 'In Use' | 'Scheduled' | 'Available' | 'Loading';
}

const RoomManagement: React.FC = () => {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [showRoomDetail, setShowRoomDetail] = useState<RoomWithDetails | null>(null);
  const [roomSchedules, setRoomSchedules] = useState<LectureSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  
  const [masterEquipmentList, setMasterEquipmentList] = useState<any[]>([]);
  const [roomEquipmentLinks, setRoomEquipmentLinks] = useState<any[]>([]);
  const [isUpdatingEquipment, setIsUpdatingEquipment] = useState<string | null>(null);

  // --- ADDED: State for new search filters ---
  const [searchDay, setSearchDay] = useState(format(new Date(), 'EEEE', { locale: localeID }));
  const [searchStartTime, setSearchStartTime] = useState('07:30');
  const [searchEndTime, setSearchEndTime] = useState('17:00');

  const form = useForm<RoomForm>({ resolver: zodResolver(roomSchema) });
  const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const normalizeRoomName = (name: string): string => name ? name.toLowerCase().replace(/[\s.&-]/g, '') : '';

  const updateRoomStatuses = useCallback(async (day: string, startTimeStr: string, endTimeStr: string, isManual = false) => {
    setIsRefreshing(true);
    try {
      const { data: roomsData, error: roomsError } = await supabase.from('rooms').select(`*, department:departments(*)`);
      if (roomsError) throw roomsError;
      const now = new Date();
      const { data: schedulesData, error: schedulesError } = await supabase.from('lecture_schedules').select('room, start_time, end_time, day').eq('day', day);
      if (schedulesError) throw schedulesError;
      const scheduleMap = new Map<string, LectureSchedule[]>();
      schedulesData.forEach(schedule => {
        const scheduleStart = parse(schedule.start_time, 'HH:mm:ss', new Date());
        const scheduleEnd = parse(schedule.end_time, 'HH:mm:ss', new Date());
        const searchStart = parse(startTimeStr, 'HH:mm', new Date());
        const searchEnd = parse(endTimeStr, 'HH:mm', new Date());
        const isOverlapping = scheduleStart < searchEnd && scheduleEnd > searchStart;
        if (schedule.room && isOverlapping) {
          const normalizedName = normalizeRoomName(schedule.room);
          if (!scheduleMap.has(normalizedName)) scheduleMap.set(normalizedName, []);
          scheduleMap.get(normalizedName)?.push(schedule);
        }
      });
      const roomsWithStatus = roomsData.map(room => {
        const normalizedRoomName = normalizeRoomName(room.name);
        const roomSchedules = scheduleMap.get(normalizedRoomName) || [];
        let status: RoomWithDetails['status'] = 'Available';
        if (roomSchedules.length > 0) {
          const isToday = day.toLowerCase() === format(now, 'EEEE', { locale: localeID }).toLowerCase();
          const isCurrentlyInUse = isToday && roomSchedules.some(schedule => {
            if (!schedule.start_time || !schedule.end_time) return false;
            try {
              const startTime = parse(schedule.start_time, 'HH:mm:ss', new Date());
              const endTime = parse(schedule.end_time, 'HH:mm:ss', new Date());
              return now >= startTime && now <= endTime;
            } catch (e) { return false; }
          });
          status = isCurrentlyInUse ? 'In Use' : 'Scheduled';
        }
        return { ...room, department: room.department, status };
      });
      setRooms(roomsWithStatus as RoomWithDetails[]);
      if(isManual) toast.success('Room statuses updated!');
    } catch (error) { console.error('Error updating room statuses:', error); toast.error('Failed to refresh room statuses.');
    } finally { setIsRefreshing(false); setLoading(false); }
  }, [profile]);
  
  useEffect(() => {
    if (profile) {
      handleSearch(); // Initial search for today
      fetchDepartments();
      fetchMasterEquipment();
      const interval = setInterval(() => handleSearch(), 10 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [profile]);

  const handleSearch = () => {
      if (!searchDay || !searchStartTime || !searchEndTime) {
          toast.error("Please complete all search filters.");
          return;
      }
      updateRoomStatuses(searchDay, searchStartTime, searchEndTime, true);
  };
  
  const fetchDepartments = async () => { /* ... */ };
  const fetchMasterEquipment = async () => { /* ... */ };
  const fetchSchedulesForRoom = async (roomName: string) => { /* ... */ };
  const handleEquipmentChange = async (equipmentId: string, isChecked: boolean) => { /* ... */ };
  const onSubmit = async (data: RoomForm) => { /* ... */ };
  const handleEdit = (room: RoomWithDetails) => { /* ... */ };
  const handleDelete = async (roomId: string) => { /* ... */ };
  const filteredRooms = useMemo(() => { /* ... */ }, [rooms, searchTerm, filterStatus]);
  const getStatusColor = (status: RoomWithDetails['status']) => { /* ... */ };
  
  if (loading) { return <div className="flex justify-center items-center h-screen"><RefreshCw className="h-12 w-12 animate-spin text-blue-600" /></div>; }

  return (
    <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white"> <div className="flex items-center justify-between"> <div> <h1 className="text-3xl font-bold flex items-center space-x-3"> <Building className="h-8 w-8" /> <span>Pencarian & Status Ruangan</span> </h1> <p className="mt-2 opacity-90"> Cari ketersediaan ruangan berdasarkan hari dan waktu </p> </div> <div className="hidden md:block text-right"> <div className="text-2xl font-bold">{rooms.length}</div> <div className="text-sm opacity-80">Total Ruangan</div> </div> </div> </div>
        
        {/* --- UPDATED: Search and Filter Bar --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div><label className="block text-sm font-medium text-gray-700">Hari</label><select value={searchDay} onChange={(e) => setSearchDay(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">{dayNames.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700">Waktu Mulai</label><input type="time" value={searchStartTime} onChange={(e) => setSearchStartTime(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/></div>
                <div><label className="block text-sm font-medium text-gray-700">Waktu Selesai</label><input type="time" value={searchEndTime} onChange={(e) => setSearchEndTime(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/></div>
                <div><label className="block text-sm font-medium text-gray-700">Status</label><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="all">Semua Status</option><option value="available">Available</option><option value="scheduled">Scheduled</option><option value="in_use">In Use</option></select></div>
                
                {/* Tombol Search BARU */}
                <button onClick={handleSearch} disabled={isRefreshing} className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {isRefreshing ? <Loader2 className="h-5 w-5 animate-spin"/> : <Search className="h-5 w-5" />} <span>Cari</span>
                </button>
                
                {/* Tombol Refresh LAMA (tetap ada) */}
                 <button onClick={() => updateRoomStatuses(format(new Date(), 'EEEE', { locale: localeID }), '07:30', '17:00', true)} disabled={isRefreshing} className="flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} /> <span>Refresh Hari Ini</span>
                </button>
            </div>
        </div>

  return (
    <div className="space-y-6">
        {/* ... (Main page JSX remains the same) ... */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white"> <div className="flex items-center justify-between"> <div> <h1 className="text-3xl font-bold flex items-center space-x-3"> <Building className="h-8 w-8" /> <span>Room Status Dashboard</span> </h1> <p className="mt-2 opacity-90"> Real-time room availability based on lecture schedules </p> </div> <div className="hidden md:block text-right"> <div className="text-2xl font-bold">{rooms.length}</div> <div className="text-sm opacity-80">Total Rooms</div> </div> </div> </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"> <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"> <div className="flex flex-wrap gap-3"> <button onClick={() => { setEditingRoom(null); form.reset(); setShowForm(true); }} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"> <Plus className="h-5 w-5" /> <span>Add Room</span> </button> <button onClick={handleManualRefresh} disabled={isRefreshing} className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"> <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} /> <span>Refresh</span> </button> </div> <div className="flex items-center space-x-3"> <div className="relative"> <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /> <input type="text" placeholder="Search rooms..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64" /> </div> <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg"> <option value="all">All Statuses</option> <option value="available">Available</option> <option value="scheduled">Scheduled</option> <option value="in_use">In Use</option> </select> <div className="flex border border-gray-300 rounded-lg overflow-hidden"> <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><Grid className="h-5 w-5" /></button> <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><List className="h-5 w-5" /></button> </div> </div> </div> </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"> {viewMode === 'grid' ? ( <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"> {filteredRooms.map((room) => ( <div key={room.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow group relative"> <div className={`absolute top-2 right-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>{room.status}</div> <div className="flex flex-col h-full"> <div className="flex-grow"> <h3 className="font-semibold text-gray-900 text-lg mt-8">{room.name}</h3> <p className="text-sm text-gray-600">{room.code}</p> <div className="flex items-center text-sm text-gray-600 mt-2"><Users className="h-4 w-4 mr-1"/><span>{room.capacity} seats</span></div> <div className="flex items-center text-sm text-gray-600"><MapPin className="h-4 w-4 mr-1"/><span>{room.department?.name || 'Umum'}</span></div> </div> <div className="flex items-center justify-end pt-4 mt-4 border-t border-gray-100 space-x-1"> <button onClick={() => setShowRoomDetail(room)} className="p-1 text-gray-500 hover:text-indigo-600"><Eye className="h-4 w-4" /></button> <button onClick={() => handleEdit(room)} className="p-1 text-gray-500 hover:text-blue-600"><Edit className="h-4 w-4" /></button> <button onClick={() => handleDelete(room.id)} className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button> </div> </div> </div> ))} </div> ) : ( <div className="space-y-3"> {filteredRooms.map((room) => ( <div key={room.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"> <div className="flex items-center space-x-4"> <div className={`w-3 h-12 rounded-full ${getStatusColor(room.status).split(' ')[0]}`}></div> <div> <h3 className="font-semibold text-gray-900">{room.name}</h3> <p className="text-sm text-gray-600">{room.code} • {room.department?.name || 'Umum'}</p> </div> </div> <div className="flex items-center space-x-6"> <div className="text-center"><div className="text-sm font-medium text-gray-900">{room.capacity}</div><div className="text-xs text-gray-500">Capacity</div></div> <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(room.status)}`}>{room.status}</span> <div className="flex items-center space-x-2"> <button onClick={() => handleEdit(room)} className="p-2 text-gray-600 hover:text-blue-600"><Edit className="h-4 w-4" /></button> <button onClick={() => handleDelete(room.id)} className="p-2 text-gray-600 hover:text-red-600"><Trash2 className="h-4 w-4" /></button> </div> </div> </div> ))} </div> )} {filteredRooms.length === 0 && (<div className="text-center py-12"><Building className="h-12 w-12 text-gray-400 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">No rooms found</h3><p className="text-gray-600">Try adjusting your filter criteria.</p></div>)} </div>
        {showForm && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-xl shadow-xl max-w-lg w-full"> <div className="p-6"> <div className="flex items-center justify-between mb-6"> <h3 className="text-lg font-semibold text-gray-900">{editingRoom ? 'Edit Room' : 'Add New Room'}</h3> <button onClick={() => { setShowForm(false); setEditingRoom(null); form.reset(); }} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button> </div> <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"> <div><label className="block text-sm font-medium text-gray-700">Name *</label><input {...form.register('name')} type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>{form.formState.errors.name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>}</div> <div><label className="block text-sm font-medium text-gray-700">Code *</label><input {...form.register('code')} type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>{form.formState.errors.code && <p className="text-red-500 text-xs mt-1">{form.formState.errors.code.message}</p>}</div> <div><label className="block text-sm font-medium text-gray-700">Capacity *</label><input {...form.register('capacity', {valueAsNumber: true})} type="number" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>{form.formState.errors.capacity && <p className="text-red-500 text-xs mt-1">{form.formState.errors.capacity.message}</p>}</div> <div><label className="block text-sm font-medium text-gray-700">Department *</label><select {...form.register('department_id')} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">Select Department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{form.formState.errors.department_id && <p className="text-red-500 text-xs mt-1">{form.formState.errors.department_id.message}</p>}</div> <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md">Cancel</button><button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">{loading ? 'Saving...' : 'Save Room'}</button></div> </form> </div> </div> </div> )}
        
        {/* --- Room Detail Modal with new checklist logic --- */}
        {showRoomDetail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b flex justify-between items-center"> <h2 className="text-2xl font-bold text-gray-900">{showRoomDetail.name} ({showRoomDetail.code})</h2> <button onClick={() => setShowRoomDetail(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full"><X/></button> </div>
                    <div className="p-6 grid md:grid-cols-2 gap-6 overflow-y-auto">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-800">Manage Equipment</h3>
                            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                                {masterEquipmentList.map((eq) => {
                                    const Icon = iconMap[eq.icon_name] || Zap;
                                    const isChecked = roomEquipmentLinks.some(link => link.equipment_id === eq.id);
                                    const isProcessing = isUpdatingEquipment === eq.id;
                                    return (
                                        <label key={eq.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                                            <div className="flex items-center space-x-3">
                                                <Icon className="h-5 w-5 text-gray-500" />
                                                <div><span className="font-medium text-gray-800">{eq.name}</span><span className="block text-xs text-gray-500">{eq.category}</span></div>
                                            </div>
                                            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin text-gray-400"/> :
                                                <input type="checkbox" checked={isChecked} onChange={(e) => handleEquipmentChange(eq.id, e.target.checked)} className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"/>
                                            }
                                        </label>
                                    );
                                })}
                                {masterEquipmentList.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No master equipment data found.</p>}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-800">Today's Schedule ({format(new Date(), 'EEEE, d MMM')})</h3>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                {loadingSchedules ? <div className="flex justify-center items-center h-24"><RefreshCw className="animate-spin h-6 w-6 text-gray-500"/></div>
                                : roomSchedules.length > 0 ? (
                                    <ul className="space-y-2">
                                        {roomSchedules.map(schedule => (
                                            <li key={schedule.id} className="p-3 bg-white rounded-md shadow-sm">
                                                <p className="font-semibold">{schedule.course_name}</p>
                                                <p className="text-sm text-gray-600">{schedule.start_time?.substring(0,5)} - {schedule.end_time?.substring(0,5)}</p>
                                                <p className="text-xs text-gray-500">Prodi: {schedule.subject_study}</p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : ( <p className="text-sm text-gray-500 text-center py-4">No schedules for this room today.</p> )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default RoomManagement;
