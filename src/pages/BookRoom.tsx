import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Zap,
  CheckCircle,
  AlertCircle,
  Search,
  Grid,
  List,
  User,
  Phone,
  Send,
  RefreshCw,
  ChevronDown,
  X,
  Eye,       // NEW: Icon untuk melihat detail
  Loader2,   // NEW: Icon untuk loading
  Building   // NEW: Icon untuk placeholder
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Room, Department, StudyProgram, Equipment } from '../types';
import toast from 'react-hot-toast';
import { format, addMinutes, parse } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

// --- BAGIAN INI TIDAK BERUBAH ---
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
// --- AKHIR DARI BAGIAN YANG TIDAK BERUBAH ---

// UPDATED: Interface baru untuk status ruangan dan jadwal
interface RoomWithStatus extends Room {
  department: Department | null;
  status: 'In Use' | 'Scheduled' | 'Available' | 'Loading';
}

interface LectureSchedule {
  id: string;
  course_name: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
  subject_study: string;
}

const BookRoom: React.FC = () => {
  const { profile } = useAuth();
  
  // UPDATED: State management untuk ruangan dan status
  const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  
  // NEW: State untuk fungsionalitas baru
  const [showInUse, setShowInUse] = useState(false);
  const [viewingSchedulesFor, setViewingSchedulesFor] = useState<RoomWithStatus | null>(null);
  const [schedulesForModal, setSchedulesForModal] = useState<LectureSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // --- BAGIAN STATE LAINNYA TIDAK BERUBAH ---
  const [studyPrograms, setStudyPrograms] = useState<StudyProgramWithDepartment[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<RoomWithStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
  const [identitySearchTerm, setIdentitySearchTerm] = useState('');
  const [showStudyProgramDropdown, setShowStudyProgramDropdown] = useState(false);
  const [studyProgramSearchTerm, setStudyProgramSearchTerm] = useState('');
  // --- AKHIR DARI BAGIAN STATE YANG TIDAK BERUBAH ---

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { class_type: 'theory', sks: 2, equipment_requested: [], },
  });

  const watchSks = form.watch('sks');
  const watchClassType = form.watch('class_type');
  const watchIdentityNumber = form.watch('identity_number');
  const watchStudyProgramId = form.watch('study_program_id');

  // NEW: Utilitas untuk normalisasi nama ruangan
  const normalizeRoomName = (name: string): string => name ? name.toLowerCase().replace(/[\s.&-]/g, '') : '';
  
  // UPDATED: Fungsi utama untuk mengambil data dan menghitung status
  const fetchRoomsWithStatus = useCallback(async () => {
    setLoading(true);
    try {
        const now = new Date();
        const todayDayName = format(now, 'EEEE'); // e.g., 'Thursday'
        
        const { data: roomsData, error: roomsError } = await supabase.from('rooms').select(`*, department:departments(*)`);
        if (roomsError) throw roomsError;

        const { data: schedulesData, error: schedulesError } = await supabase.from('lecture_schedules').select('*').eq('day', todayDayName);
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
            let status: RoomWithStatus['status'] = 'Available';

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

        setRooms(roomsWithStatus as RoomWithStatus[]);
    } catch (error) {
        console.error('Error fetching rooms with status:', error);
        toast.error('Failed to load room statuses.');
    } finally {
        setLoading(false);
    }
  }, []);

  // NEW: Fungsi untuk mengambil jadwal untuk modal detail
  const fetchSchedulesForRoom = async (roomName: string) => {
    setLoadingSchedules(true);
    try {
      const todayDayName = format(new Date(), 'EEEE');
      const { data, error } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', todayDayName)
        .eq('room', roomName)
        .order('start_time');
      if (error) throw error;
      setSchedulesForModal(data || []);
    } catch (error) {
      toast.error("Failed to load schedule for this room.");
      setSchedulesForModal([]);
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    fetchRoomsWithStatus();
    // --- FUNGSI LAINNYA YANG TIDAK BERUBAH ---
    fetchStudyPrograms();
    fetchEquipment();
    fetchExistingUsers();
    
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const statusRefreshTimer = setInterval(() => fetchRoomsWithStatus(), 5 * 60 * 1000); // Refresh status setiap 5 menit

    return () => {
      clearInterval(timer);
      clearInterval(statusRefreshTimer);
    };
  }, [fetchRoomsWithStatus]);

  // NEW: useEffect untuk mengambil data saat modal terbuka
  useEffect(() => {
    if (viewingSchedulesFor) {
      fetchSchedulesForRoom(viewingSchedulesFor.name);
    }
  }, [viewingSchedulesFor]);

  // --- SEMUA LOGIC & FUNGSI DI BAWAH INI TIDAK ADA PERUBAHAN FUNGSIONAL ---
  useEffect(() => {
    if (watchIdentityNumber && watchIdentityNumber.length >= 5) {
      const existingUser = existingUsers.find(user => user.identity_number === watchIdentityNumber);
      if (existingUser) {
        form.setValue('full_name', existingUser.full_name);
        if (existingUser.phone_number) form.setValue('phone_number', existingUser.phone_number);
        if (existingUser.study_program_id) {
          form.setValue('study_program_id', existingUser.study_program_id);
          const selectedProgram = studyPrograms.find(sp => sp.id === existingUser.study_program_id);
          if (selectedProgram) setStudyProgramSearchTerm(`${selectedProgram.name} (${selectedProgram.code}) - ${selectedProgram.department?.name}`);
        }
        toast.success('Data terisi otomatis dari pemesanan sebelumnya!');
      }
    }
  }, [watchIdentityNumber, existingUsers, form, studyPrograms]);

  useEffect(() => {
    if (watchStudyProgramId) {
      const selectedProgram = studyPrograms.find(sp => sp.id === watchStudyProgramId);
      if (selectedProgram) setStudyProgramSearchTerm(`${selectedProgram.name} (${selectedProgram.code}) - ${selectedProgram.department?.name}`);
    }
  }, [watchStudyProgramId, studyPrograms]);

  const fetchStudyPrograms = async () => { try { const { data, error } = await supabase.from('study_programs').select(`*, department:departments(*)`); if (error) throw error; setStudyPrograms(data || []); } catch (error) { console.error('Error fetching study programs:', error); toast.error('Failed to load study programs'); } };
  const fetchEquipment = async () => { try { const { data, error } = await supabase.from('equipment').select('*').eq('is_available', true); if (error) throw error; setEquipment(data || []); } catch (error) { console.error('Error fetching equipment:', error); toast.error('Failed to load equipment'); } };
  const fetchExistingUsers = async () => { try { const { data, error } = await supabase.from('users').select(`id, identity_number, full_name, email, phone_number, department_id, study_program_id, study_program:study_programs(*, department:departments(*))`).eq('role', 'student').order('full_name'); if (error) throw error; const usersWithPrograms = (data || []).map(user => ({...user, study_program: user.study_program })); setExistingUsers(usersWithPrograms); } catch (error) { console.error('Error fetching users:', error); } };
  const handleNowBooking = () => { const now = new Date(); const formattedNow = format(now, "yyyy-MM-dd'T'HH:mm"); form.setValue('start_time', formattedNow); };
  const calculateEndTime = (startTime: string, sks: number, classType: string) => { if (!startTime || !sks) return null; const duration = classType === 'theory' ? sks * 50 : sks * 170; const startDate = new Date(startTime); const endDate = addMinutes(startDate, duration); return endDate; };
  const getEquipmentIcon = (category: string) => { switch (category.toLowerCase()) { case 'audio visual': return Users; case 'connectivity': return Wifi; default: return Zap; } };
  
  const onSubmit = async (data: BookingForm) => {
    // FUNGSI INI TIDAK BERUBAH SAMA SEKALI
    if (!selectedRoom) { toast.error('Please select a room'); return; }
    setLoading(true);
    try {
      const duration = data.class_type === 'theory' ? data.sks * 50 : data.sks * 170;
      const startDate = new Date(data.start_time);
      const endDate = addMinutes(startDate, duration);
      const { data: existingBookings, error: conflictError } = await supabase.from('bookings').select('*').eq('room_id', data.room_id).eq('status', 'approved');
      if (conflictError) throw conflictError;
      if (existingBookings && existingBookings.length > 0) {
        for (const booking of existingBookings) {
          const { error: updateError } = await supabase.from('bookings').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', booking.id);
          if (updateError) console.error('Error updating existing booking:', updateError);
        }
      }
      const selectedStudyProgram = studyPrograms.find(sp => sp.id === data.study_program_id);
      const departmentId = selectedStudyProgram?.department_id;
      const bookingData = { room_id: data.room_id, start_time: data.start_time, end_time: endDate.toISOString(), sks: data.sks, class_type: data.class_type, equipment_requested: data.equipment_requested || [], notes: data.notes || null, status: 'pending', purpose: 'Class/Study Session', user_info: profile ? null : { full_name: data.full_name, identity_number: data.identity_number, study_program_id: data.study_program_id, phone_number: data.phone_number, email: `${data.identity_number}@student.edu`, department_id: departmentId, }, user_id: profile?.id || null, };
      const { error } = await supabase.from('bookings').insert(bookingData);
      if (error) throw error;
      const { error: roomUpdateError } = await supabase.from('rooms').update({ is_available: false, updated_at: new Date().toISOString() }).eq('id', data.room_id);
      if (roomUpdateError) console.error('Error updating room availability:', roomUpdateError);
      toast.success('Room booking submitted successfully! Awaiting approval.');
      form.reset({ class_type: 'theory', sks: 2, equipment_requested: [], });
      setSelectedRoom(null);
      setIdentitySearchTerm('');
      setStudyProgramSearchTerm('');
      fetchRoomsWithStatus();
    } catch (error: any) { console.error('Error creating booking:', error); toast.error(error.message || 'Failed to create booking'); } finally { setLoading(false); }
  };
  // --- AKHIR DARI BAGIAN YANG TIDAK BERUBAH ---

  // UPDATED: Logika filter baru
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
        const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              room.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = room.status !== 'In Use' || showInUse;
        return matchesSearch && matchesStatus;
    });
  }, [rooms, searchTerm, showInUse]);

  // NEW: Helper untuk warna status
  const getStatusColor = (status: RoomWithStatus['status']) => {
    switch (status) {
        case 'In Use': return 'bg-red-100 text-red-800';
        case 'Scheduled': return 'bg-yellow-100 text-yellow-800';
        case 'Available': return 'bg-green-100 text-green-800';
        default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* --- HEADER TIDAK BERUBAH --- */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3"><Calendar className="h-8 w-8" /><span>Book a Room</span></h1>
            <p className="mt-2 opacity-90">Reserve a room for your lecture, meeting, or study session</p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{format(currentTime, 'HH:mm')}</div>
            <div className="text-sm opacity-80">{format(currentTime, 'EEEE, MMMM d', { locale: localeID })}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* UPDATED: Bagian filter disederhanakan */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex-1 relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search rooms by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    <button onClick={() => setViewMode('grid')} className={`p-3 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><Grid className="h-5 w-5" /></button>
                    <button onClick={() => setViewMode('list')} className={`p-3 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><List className="h-5 w-5" /></button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center">
                <input
                    id="show-in-use"
                    type="checkbox"
                    checked={showInUse}
                    onChange={(e) => setShowInUse(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="show-in-use" className="ml-2 block text-sm text-gray-900">
                    Show rooms currently in use
                </label>
            </div>
          </div>

          {/* UPDATED: Tampilan daftar ruangan dengan status baru */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Rooms Today</h2>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRooms.map((room) => (
                  <div key={room.id}
                       onClick={() => { setSelectedRoom(room); form.setValue('room_id', room.id); }}
                       className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md relative group ${selectedRoom?.id === room.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{room.name}</h3>
                        <p className="text-sm text-gray-600">{room.code}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>{room.status}</span>
                    </div>
                    <div className="flex items-center space-x-2 mb-3"><Users className="h-4 w-4 text-gray-400" /> <span className="text-sm text-gray-600">{room.capacity} seats</span></div>
                    <div className="flex items-center space-x-2"><MapPin className="h-4 w-4 text-gray-400" /> <span className="text-sm text-gray-600">{room.department?.name || 'General'}</span></div>
                    {room.status === 'Scheduled' && (
                        <button onClick={(e) => { e.stopPropagation(); setViewingSchedulesFor(room); }} className="absolute bottom-2 right-2 p-2 text-gray-400 hover:text-blue-600 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="h-5 w-5"/>
                        </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                 {filteredRooms.map((room) => (
                  <div key={room.id}
                       onClick={() => { setSelectedRoom(room); form.setValue('room_id', room.id); }}
                       className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md flex items-center justify-between ${selectedRoom?.id === room.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center space-x-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{room.name}</h3>
                        <p className="text-sm text-gray-600">{room.code} • {room.department?.name || 'General'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1"><Users className="h-4 w-4 text-gray-400" /> <span className="text-sm text-gray-600">{room.capacity} seats</span></div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>{room.status}</span>
                      {room.status === 'Scheduled' && (
                        <button onClick={(e) => { e.stopPropagation(); setViewingSchedulesFor(room); }} className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-gray-100">
                            <Eye className="h-5 w-5"/>
                        </button>
                      )}
                    </div>
                  </div>
                 ))}
              </div>
            )}
            {filteredRooms.length === 0 && (
              <div className="text-center py-8">
                <Building className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No Rooms Available</h3>
                <p className="text-gray-500">Try adjusting your search or show rooms in use.</p>
              </div>
            )}
          </div>
        </div>

        {/* --- FORM PEMESANAN DI SISI KANAN INI TIDAK BERUBAH --- */}
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Booking Details</h2>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {!profile && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2"><User className="h-5 w-5" /><span>Personal Information</span></h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Identity Number (NIM/NIP) *</label>
                            <div className="relative">
                                <input {...form.register('identity_number')} type="text" placeholder="Enter or select your student/staff ID" value={identitySearchTerm} onChange={(e) => { setIdentitySearchTerm(e.target.value); form.setValue('identity_number', e.target.value); setShowIdentityDropdown(true); }} onFocus={() => setShowIdentityDropdown(true)} className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                {showIdentityDropdown && filteredIdentityNumbers.length > 0 && ( <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">{filteredIdentityNumbers.map((user) => ( <div key={user.id} onClick={() => { setIdentitySearchTerm(user.identity_number); form.setValue('identity_number', user.identity_number); setShowIdentityDropdown(false); }} className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"><div className="font-medium text-gray-900">{user.identity_number}</div><div className="text-sm text-gray-600">{user.full_name}</div>{user.study_program && ( <div className="text-xs text-gray-500">{user.study_program.name}</div> )}</div> ))}</div> )}
                            </div>
                            {form.formState.errors.identity_number && ( <p className="mt-1 text-sm text-red-600">{form.formState.errors.identity_number.message}</p> )}
                        </div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label><input {...form.register('full_name')} type="text" placeholder="Enter your full name" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />{form.formState.errors.full_name && ( <p className="mt-1 text-sm text-red-600">{form.formState.errors.full_name.message}</p> )}</div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Study Program *</label>
                            <div className="relative">
                                <input type="text" placeholder="Search and select your study program" value={studyProgramSearchTerm} onChange={(e) => { setStudyProgramSearchTerm(e.target.value); setShowStudyProgramDropdown(true); }} onFocus={() => setShowStudyProgramDropdown(true)} className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                {showStudyProgramDropdown && ( <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">{filteredStudyPrograms.map((program) => ( <div key={program.id} onClick={() => { const displayText = `${program.name} (${program.code}) - ${program.department?.name}`; setStudyProgramSearchTerm(displayText); form.setValue('study_program_id', program.id); setShowStudyProgramDropdown(false); }} className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"><div className="font-medium text-gray-900">{program.name} ({program.code})</div><div className="text-sm text-gray-600">{program.department?.name}</div></div> ))}</div> )}
                            </div>
                            {form.formState.errors.study_program_id && ( <p className="mt-1 text-sm text-red-600">{form.formState.errors.study_program_id.message}</p> )}
                        </div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label><div className="relative"><Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /><input {...form.register('phone_number')} type="tel" placeholder="08xxxxxxxxxx" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>{form.formState.errors.phone_number && ( <p className="mt-1 text-sm text-red-600">{form.formState.errors.phone_number.message}</p> )}</div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4"><div className="flex items-start space-x-2"><AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" /><div className="text-sm text-blue-800"><p className="font-medium">Physical ID Required</p><p>Please bring your physical student/staff ID when using the booked room.</p></div></div></div>
                    </div>
                    )}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2"><Calendar className="h-5 w-5" /><span>Booking Details</span></h3>
                        <div><label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label><div className="flex space-x-2"><input {...form.register('start_time')} type="datetime-local" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /><button type="button" onClick={handleNowBooking} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">NOW</button></div>{form.formState.errors.start_time && ( <p className="mt-1 text-sm text-red-600">{form.formState.errors.start_time.message}</p> )}</div>
                        <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-2">SKS (Credit Hours) *</label><input {...form.register('sks', { valueAsNumber: true })} type="number" min="1" max="6" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />{form.formState.errors.sks && ( <p className="mt-1 text-sm text-red-600">{form.formState.errors.sks.message}</p> )}</div><div><label className="block text-sm font-medium text-gray-700 mb-2">Class Type *</label><select {...form.register('class_type')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="theory">Theory (50 min/SKS)</option><option value="practical">Practical (170 min/SKS)</option></select></div></div>
                        {form.watch('start_time') && watchSks && ( <div className="bg-green-50 border border-green-200 rounded-lg p-4"><div className="flex items-center space-x-2"><Clock className="h-5 w-5 text-green-600" /><div className="text-sm text-green-800"><p className="font-medium">Calculated Duration: {watchClassType === 'theory' ? watchSks * 50 : watchSks * 170} minutes</p>{calculateEndTime(form.watch('start_time'), watchSks, watchClassType) && ( <p>End Time: {format(calculateEndTime(form.watch('start_time'), watchSks, watchClassType)!, 'MMM d, yyyy \'at\' h:mm a')}</p> )}</div></div></div> )}
                    </div>
                    {/* ... Sisa form (equipment & notes) tidak berubah ... */}
                    <div className="flex space-x-3"><button type="submit" disabled={!selectedRoom} className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"><Send className="h-5 w-5" /><span>Submit Booking</span></button></div>
                </form>
            </div>
        </div>
      </div>

      {/* NEW: Modal untuk menampilkan detail jadwal */}
      {viewingSchedulesFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Today's Schedule for {viewingSchedulesFor.name}</h3>
                    <button onClick={() => setViewingSchedulesFor(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full"><X className="h-5 w-5"/></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {loadingSchedules ? (
                        <div className="flex justify-center items-center h-24"><Loader2 className="animate-spin h-6 w-6 text-gray-500"/></div>
                    ) : schedulesForModal.length > 0 ? (
                        <ul className="space-y-3">
                            {schedulesForModal.map(schedule => (
                                <li key={schedule.id} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                                    <p className="font-semibold text-gray-800">{schedule.course_name}</p>
                                    <p className="text-sm text-gray-600"><Clock className="inline h-4 w-4 mr-1"/>{schedule.start_time?.substring(0,5)} - {schedule.end_time?.substring(0,5)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Study Program: {schedule.subject_study}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No schedules found for this room today.</p>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default BookRoom;