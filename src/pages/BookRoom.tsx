import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar, Clock, Users, MapPin, Zap, CheckCircle, AlertCircle, Search, Grid, List, X, Send, RefreshCw, ChevronDown, Monitor, Wifi, Phone, User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Room, Department, StudyProgram, Equipment, LectureSchedule } from '../types';
import toast from 'react-hot-toast';
import { format, addMinutes, parse } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const bookingSchema = z.object({
  full_name: z.string().min(3, 'Full name must be at least 3 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  study_program_id: z.string().min(1, 'Please select a study program'),
  phone_number: z.string().min(10, 'Please enter a valid phone number'),
  room_id: z.string().min(1, 'Please select a room'),
  start_time: z.string().min(1, 'Please select start time'),
  sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
  class_type: z.enum(['theory', 'practical']),
  equipment_requested: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

// --- UPDATED: Interface to include dynamic status ---
interface RoomWithDetails extends Room {
  department: Department | null; // Department can be null
  status: 'In Use' | 'Scheduled' | 'Available' | 'Loading';
}

interface StudyProgramWithDepartment extends StudyProgram {
  department?: Department;
}

interface ExistingUser {
  id: string;
  identity_number: string;
  full_name: string;
  email: string;
  phone_number?: string;
  study_program_id?: string;
  study_program?: StudyProgram & { department?: Department };
}

const BookRoom: React.FC = () => {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgramWithDepartment[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCapacity, setFilterCapacity] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithDetails | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
  const [identitySearchTerm, setIdentitySearchTerm] = useState('');
  const [showStudyProgramDropdown, setShowStudyProgramDropdown] = useState(false);
  const [studyProgramSearchTerm, setStudyProgramSearchTerm] = useState('');
  const [showAllRooms, setShowAllRooms] = useState(false);

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { class_type: 'theory', sks: 2, equipment_requested: [], },
  });

  const watchSks = form.watch('sks');
  const watchClassType = form.watch('class_type');
  const watchIdentityNumber = form.watch('identity_number');
  const watchStudyProgramId = form.watch('study_program_id');

  const normalizeRoomName = (name: string): string => name ? name.toLowerCase().replace(/[\s.&-]/g, '') : '';

  // --- REFACTORED: This function now fetches schedules to determine room status ---
  const updateRoomStatuses = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setLoading(true);
    try {
      const now = new Date();
      const todayDayName = format(now, 'EEEE', { locale: localeID });

      const { data: roomsData, error: roomsError } = await supabase.from('rooms').select(`*, department:departments(*)`);
      if (roomsError) throw roomsError;

      const { data: schedulesData, error: schedulesError } = await supabase.from('lecture_schedules').select('room, start_time, end_time, day').eq('day', todayDayName);
      if (schedulesError) throw schedulesError;

      const scheduleMap = new Map<string, LectureSchedule[]>();
      schedulesData.forEach(schedule => {
        if (schedule.room) {
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
          const isCurrentlyInUse = roomSchedules.some(schedule => {
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
    } catch (error) {
      console.error('Error fetching room statuses:', error);
      toast.error('Failed to load room statuses.');
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, []);

  useEffect(() => {
    updateRoomStatuses(true);
    fetchStudyPrograms();
    fetchEquipment();
    fetchExistingUsers();

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const refreshStatusInterval = setInterval(() => updateRoomStatuses(), 5 * 60 * 1000);

    return () => {
      clearInterval(timer);
      clearInterval(refreshStatusInterval);
    };
  }, [updateRoomStatuses]);

  const fetchStudyPrograms = async () => { /* ... (no changes) ... */ };
  const fetchEquipment = async () => { /* ... (no changes) ... */ };
  const fetchExistingUsers = async () => { /* ... (no changes) ... */ };

  // --- UPDATED: Filtering now uses the dynamic `status` property ---
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCapacity = !filterCapacity || room.capacity >= filterCapacity;

      // By default, show 'Available' and 'Scheduled'. If checkbox is ticked, show all.
      const matchesAvailability = showAllRooms || room.status === 'Available' || room.status === 'Scheduled';

      return matchesSearch && matchesCapacity && matchesAvailability;
    });
  }, [rooms, searchTerm, filterCapacity, showAllRooms]);
  
  const getStatusColor = (status: RoomWithDetails['status']) => {
    switch (status) {
      case 'In Use': return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: AlertCircle, iconColor: 'text-red-500' };
      case 'Scheduled': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', icon: Clock, iconColor: 'text-yellow-600' };
      case 'Available': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', icon: CheckCircle, iconColor: 'text-green-500' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', icon: AlertCircle, iconColor: 'text-gray-500' };
    }
  };

  const onSubmit = async (data: BookingForm) => {
    if (!selectedRoom) {
      toast.error('Please select a room');
      return;
    }

    setIsSubmitting(true);
    try {
      // ... (rest of submission logic remains the same) ...
      // After submission, refresh the statuses
      await updateRoomStatuses();
      toast.success('Booking submitted successfully! Awaiting approval.');
      // ... (rest of form reset logic) ...
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ... (Other functions like calculateEndTime, handleNowBooking, etc., remain unchanged) ...

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        {/* ... (no changes) ... */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search and Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search rooms by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={filterCapacity || ''}
                  onChange={(e) => setFilterCapacity(e.target.value ? Number(e.target.value) : null)}
                  className="px-4 py-3 border border-gray-300 rounded-lg"
                >
                  <option value="">All Capacities</option>
                  <option value="20">20+ seats</option>
                  <option value="40">40+ seats</option>
                </select>
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    <button onClick={() => setViewMode('grid')} className={`p-3 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><Grid className="h-5 w-5" /></button>
                    <button onClick={() => setViewMode('list')} className={`p-3 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><List className="h-5 w-5" /></button>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex items-center">
              <div className="flex items-center">
                <input id="show-all-rooms" type="checkbox" checked={showAllRooms} onChange={() => setShowAllRooms(!showAllRooms)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
                <label htmlFor="show-all-rooms" className="ml-2 block text-sm text-gray-900">Show all rooms (including in use)</label>
              </div>
            </div>
          </div>

          {/* Room Grid/List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select a Room</h2>
            
            {loading ? (
                <div className="text-center py-8"><RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto"/></div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRooms.map((room) => {
                  const statusInfo = getStatusColor(room.status);
                  return (
                    <div
                      key={room.id}
                      onClick={() => { setSelectedRoom(room); form.setValue('room_id', room.id); }}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${selectedRoom?.id === room.id ? `border-blue-500 bg-blue-50` : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{room.name}</h3>
                          <p className="text-sm text-gray-600">{room.code}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                          {room.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mb-3">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{room.capacity} seats</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{room.department?.name || 'General'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                 {/* ... List View Rendering would go here, using the same status logic ... */}
              </div>
            )}
            
            {!loading && filteredRooms.length === 0 && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No Rooms Found</h3>
                <p className="text-gray-500">Try adjusting your search or check "Show all rooms".</p>
              </div>
            )}
          </div>
        </div>

        {/* Booking Form */}
        <div className="space-y-6">
            {/* The entire booking form column remains the same */}
        </div>
      </div>
    </div>
  );
};

export default BookRoom;