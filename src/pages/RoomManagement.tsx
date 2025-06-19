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

        {/* ... sisa dari komponen (grid/list/modal) tetap sama ... */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {/* ... */}
        </div>
    </div>
  );
};

export default RoomManagement;
