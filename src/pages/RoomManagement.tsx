import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building, Plus, Search, Filter, Grid, List, Edit, Trash2, Copy, Eye, Users, MapPin, Zap, CheckCircle, AlertCircle, Clock, Settings, Upload, Download, MoreHorizontal, X, Save, Camera, FileText, Calendar, BarChart3, Wifi, Monitor, Volume2, Projector, Mic, AirVent, Lightbulb, ChevronDown, ChevronUp, Star, TrendingUp, Activity, RefreshCw, Package,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Room, Department, LectureSchedule } from '../types';
import toast from 'react-hot-toast';
import { format, parse } from 'date-fns';
import { id } from 'date-fns/locale';

// --- Zod Schema remains the same ---
const roomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters'),
  code: z.string().min(2, 'Room code must be at least 2 characters'),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  department_id: z.string().min(1, 'Please select a department'),
  equipment: z.array(z.string()),
  is_available: z.boolean(),
});
type RoomForm = z.infer<typeof roomSchema>;

// --- Updated Interface to hold dynamic status ---
interface RoomWithDetails extends Room {
  department: Department;
  status: 'In Use' | 'Scheduled' | 'Available' | 'Loading';
}

const RoomManagement: React.FC = () => {
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomWithDetails | null>(null);

  // --- Filter states remain the same ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('');

  const form = useForm<RoomForm>({ resolver: zodResolver(roomSchema) });

  // --- Core function to update room statuses ---
  const updateRoomStatuses = useCallback(async () => {
    console.log('Updating room statuses...');
    setIsRefreshing(true);

    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`*, department:departments(*)`);
      if (roomsError) throw roomsError;

      const now = new Date();
      const todayDayName = format(now, 'EEEE', { locale: id }); // e.g., 'Senin', 'Selasa'

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', todayDayName);
      if (schedulesError) throw schedulesError;

      const scheduleMap = new Map<string, LectureSchedule[]>();
      schedulesData.forEach(schedule => {
        if (schedule.room) {
          if (!scheduleMap.has(schedule.room)) {
            scheduleMap.set(schedule.room, []);
          }
          scheduleMap.get(schedule.room)?.push(schedule);
        }
      });
      
      const roomsWithStatus = roomsData.map(room => {
        const roomSchedules = scheduleMap.get(room.name) || [];
        let status: 'In Use' | 'Scheduled' | 'Available' = 'Available';

        if (roomSchedules.length > 0) {
          const isCurrentlyInUse = roomSchedules.some(schedule => {
            if (!schedule.start_time || !schedule.end_time) return false;
            const startTime = parse(schedule.start_time, 'HH:mm:ss', new Date());
            const endTime = parse(schedule.end_time, 'HH:mm:ss', new Date());
            return now >= startTime && now <= endTime;
          });

          if (isCurrentlyInUse) {
            status = 'In Use';
          } else {
            status = 'Scheduled';
          }
        }
        
        return { ...room, department: room.department, status };
      });

      setRooms(roomsWithStatus as RoomWithDetails[]);
      toast.success('Room statuses updated!');
    } catch (error) {
      console.error('Error updating room statuses:', error);
      toast.error('Failed to refresh room statuses.');
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);
  
  // --- Effect for initial load and periodic updates ---
  useEffect(() => {
    updateRoomStatuses();
    fetchDepartments();

    const interval = setInterval(() => {
      console.log('Periodic refresh triggered.');
      updateRoomStatuses();
    }, 15 * 60 * 1000); // 15 minutes

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [updateRoomStatuses]);

  const fetchDepartments = async () => { /* ... Function remains the same ... */ try { const { data, error } = await supabase.from('departments').select('*').order('name'); if (error) throw error; setDepartments(data || []); } catch (error) { console.error('Error fetching departments:', error); toast.error('Failed to load departments'); } };

  const onSubmit = async (data: RoomForm) => { /* ... Function remains the same, ensure it calls updateRoomStatuses on success ... */ try { setLoading(true); const roomData = { name: data.name, code: data.code, capacity: data.capacity, department_id: data.department_id, equipment: data.equipment, is_available: data.is_available, }; if (editingRoom) { const { error } = await supabase .from('rooms') .update(roomData) .eq('id', editingRoom.id); if (error) throw error; toast.success('Room updated successfully!'); } else { const { error } = await supabase .from('rooms') .insert(roomData); if (error) throw error; toast.success('Room created successfully!'); } setShowForm(false); setEditingRoom(null); form.reset(); updateRoomStatuses(); } catch (error: any) { console.error('Error saving room:', error); toast.error(error.message || 'Failed to save room'); } finally { setLoading(false); } };
  const handleEdit = (room: RoomWithDetails) => { /* ... Function remains the same ... */ setEditingRoom(room); form.reset({ name: room.name, code: room.code, capacity: room.capacity, department_id: room.department_id, equipment: room.equipment, is_available: true, // simplified from previous state }); setShowForm(true); };
  const handleDelete = async (roomId: string) => { /* ... Function remains the same, ensure it calls updateRoomStatuses on success ... */ if (!confirm('Are you sure you want to delete this room?')) return; try { const { error } = await supabase .from('rooms') .delete() .eq('id', roomId); if (error) throw error; toast.success('Room deleted successfully!'); updateRoomStatuses(); } catch (error: any) { console.error('Error deleting room:', error); toast.error(error.message || 'Failed to delete room'); } };

  // --- Logic for filtering rooms based on new status ---
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            room.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            room.department?.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || room.status.toLowerCase() === filterStatus;
      const matchesDepartment = !filterDepartment || room.department_id === filterDepartment;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [rooms, searchTerm, filterStatus, filterDepartment]);

  // --- Updated UI helper functions for dynamic status ---
  const getStatusColor = (status: RoomWithDetails['status']) => {
    switch (status) {
      case 'In Use': return 'bg-red-100 text-red-800';
      case 'Scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'Available': return 'bg-green-100 text-green-800';
      case 'Loading': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  const getStatusText = (status: RoomWithDetails['status']) => {
    return status;
  };
  const getEquipmentIcon = (equipment: string) => { /* ... Function remains the same ... */ switch (equipment.toLowerCase()) { case 'projector': return Projector; case 'air conditioning': return AirVent; case 'sound system': return Volume2; case 'whiteboard': return FileText; case 'microphone': return Mic; case 'wifi': return Wifi; case 'monitor': return Monitor; default: return Zap; } };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="text-lg text-gray-700">Loading Room Status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        {/* ... Header JSX remains the same ... */}
        <h1 className="text-3xl font-bold flex items-center space-x-3"><Building className="h-8 w-8" /><span>Room Management</span></h1>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { setEditingRoom(null); form.reset(); setShowForm(true); }} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="h-5 w-5" /> <span>Add Room</span>
            </button>
            {/* New Refresh Button */}
            <button onClick={() => updateRoomStatuses()} disabled={isRefreshing} className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} /> <span>Refresh Status</span>
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search rooms..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="scheduled">Scheduled</option>
              <option value="in use">In Use</option>
            </select>
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><Grid className="h-5 w-5" /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><List className="h-5 w-5" /></button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Room Grid/List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredRooms.map((room) => (
              <div key={room.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow duration-200">
                <div className="relative h-32 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                  <Building className="h-12 w-12 text-gray-400" />
                  <div className="absolute top-2 right-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                      {getStatusText(room.status)}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{room.name}</h3>
                    <p className="text-sm text-gray-600">{room.code}</p>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-1"><Users className="h-4 w-4" /><span>{room.capacity} seats</span></div>
                    <div className="flex items-center space-x-1"><MapPin className="h-4 w-4" /><span>{room.department?.name}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {room.equipment.slice(0, 4).map((eq, index) => {
                      const Icon = getEquipmentIcon(eq);
                      return (<div key={index} title={eq} className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded text-gray-600"><Icon className="h-3 w-3" /></div>);
                    })}
                    {room.equipment.length > 4 && <div className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded text-gray-600 text-xs">+{room.equipment.length - 4}</div>}
                  </div>
                  <div className="flex items-center justify-end pt-2 space-x-1">
                    <button onClick={() => handleEdit(room)} className="p-1 text-gray-600 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(room.id)} className="p-1 text-gray-600 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRooms.map((room) => (
              <div key={room.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg"><Building className="h-6 w-6 text-gray-500" /></div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{room.name}</h3>
                    <p className="text-sm text-gray-600">{room.code} • {room.department?.name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">{room.capacity}</div>
                    <div className="text-xs text-gray-500">Capacity</div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                    {getStatusText(room.status)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleEdit(room)} className="p-2 text-gray-600 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(room.id)} className="p-2 text-gray-600 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {filteredRooms.length === 0 && (
          <div className="text-center py-12">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No rooms found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>

      {/* Form Modal remains the same */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Form content */}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomManagement;
