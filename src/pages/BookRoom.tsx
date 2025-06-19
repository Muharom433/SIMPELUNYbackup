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
  Eye,
  Loader2,
  Building
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Room, Department, StudyProgram, Equipment } from '../types';
import toast from 'react-hot-toast';
import { format, addMinutes, parse } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

// --- BAGIAN SKEMA & INTERFACE FORM (TIDAK BERUBAH) ---
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
// --- AKHIR DARI BAGIAN SKEMA & INTERFACE FORM ---

// --- INTERFACE BARU UNTUK STATUS RUANGAN & JADWAL ---
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
// --- AKHIR DARI INTERFACE BARU ---

const BookRoom: React.FC = () => {
  const { profile } = useAuth();
  
  const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInUse, setShowInUse] = useState(false);
  const [viewingSchedulesFor, setViewingSchedulesFor] = useState<RoomWithStatus | null>(null);
  const [schedulesForModal, setSchedulesForModal] = useState<LectureSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

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

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { class_type: 'theory', sks: 2, equipment_requested: [], },
  });

  const watchSks = form.watch('sks');
  const watchClassType = form.watch('class_type');
  const watchIdentityNumber = form.watch('identity_number');
  const watchStudyProgramId = form.watch('study_program_id');

  const normalizeRoomName = (name: string): string => name ? name.toLowerCase().replace(/[\s.&-]/g, '') : '';
  
  // --- REVISED: Fungsi utama untuk mengambil data dan menghitung status ---
  // Logika diperbarui dengan format hari dalam Bahasa Indonesia.
  const fetchRoomsWithStatus = useCallback(async () => {
    setLoading(true);
    try {
        const now = new Date();
        // KRUSIAL: Menggunakan nama hari dalam Bahasa Indonesia sesuai format database
        const todayDayName = format(now, 'EEEE', { locale: localeID }); // e.g., "Kamis"

        const [roomsResponse, schedulesResponse] = await Promise.all([
            supabase.from('rooms').select(`*, department:departments(*)`),
            supabase.from('lecture_schedules').select('*').eq('day', todayDayName)
        ]);

        const { data: roomsData, error: roomsError } = roomsResponse;
        if (roomsError) throw roomsError;

        const { data: schedulesData, error: schedulesError } = schedulesResponse;
        if (schedulesError) throw schedulesError;

        const scheduledRoomNames = new Set<string>();
        const inUseRoomNames = new Set<string>();

        schedulesData.forEach(schedule => {
            if (schedule.room && schedule.start_time && schedule.end_time) {
                const normalizedName = normalizeRoomName(schedule.room);
                scheduledRoomNames.add(normalizedName);

                try {
                    const scheduleStart = parse(schedule.start_time, 'HH:mm:ss', now);
                    const scheduleEnd = parse(schedule.end_time, 'HH:mm:ss', now);

                    if (now >= scheduleStart && now <= scheduleEnd) {
                        inUseRoomNames.add(normalizedName);
                    }
                } catch (e) {
                    console.error("Error parsing schedule time:", e);
                }
            }
        });
      
        const roomsWithStatus = roomsData.map(room => {
            const normalizedRoomName = normalizeRoomName(room.name);
            let status: RoomWithStatus['status'];

            if (inUseRoomNames.has(normalizedRoomName)) {
                status = 'In Use';
            } else if (scheduledRoomNames.has(normalizedRoomName)) {
                status = 'Scheduled';
            } else {
                status = 'Available';
            }

            return { ...room, department: room.department, status };
        });

        setRooms(roomsWithStatus as RoomWithStatus[]);
    } catch (error) {
        console.error('Error fetching rooms with status:', error);
        toast.error('Gagal memuat status ruangan.');
    } finally {
        setLoading(false);
    }
  }, []);
  // --- AKHIR DARI FUNGSI YANG DIREVISI ---

  const fetchSchedulesForRoom = async (roomName: string) => {
    setLoadingSchedules(true);
    try {
      const todayDayName = format(new Date(), 'EEEE', { locale: localeID });
      const { data, error } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', todayDayName)
        .eq('room', roomName)
        .order('start_time');
      if (error) throw error;
      setSchedulesForModal(data || []);
    } catch (error) {
      toast.error("Gagal memuat jadwal untuk ruangan ini.");
      setSchedulesForModal([]);
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    fetchRoomsWithStatus();
    fetchStudyPrograms();
    fetchEquipment();
    fetchExistingUsers();
    
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const statusRefreshTimer = setInterval(() => fetchRoomsWithStatus(), 5 * 60 * 1000);

    return () => {
      clearInterval(timer);
      clearInterval(statusRefreshTimer);
    };
  }, [fetchRoomsWithStatus]);

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

  const fetchStudyPrograms = async () => { try { const { data, error } = await supabase.from('study_programs').select(`*, department:departments(*)`); if (error) throw error; setStudyPrograms(data || []); } catch (error) { console.error('Error fetching study programs:', error); toast.error('Gagal memuat program studi.'); } };
  const fetchEquipment = async () => { try { const { data, error } = await supabase.from('equipment').select('*').eq('is_available', true); if (error) throw error; setEquipment(data || []); } catch (error) { console.error('Error fetching equipment:', error); toast.error('Gagal memuat peralatan.'); } };
  const fetchExistingUsers = async () => { try { const { data, error } = await supabase.from('users').select(`id, identity_number, full_name, email, phone_number, department_id, study_program_id, study_program:study_programs(*, department:departments(*))`).eq('role', 'student').order('full_name'); if (error) throw error; const usersWithPrograms = (data || []).map(user => ({...user, study_program: user.study_program })); setExistingUsers(usersWithPrograms); } catch (error) { console.error('Error fetching users:', error); } };
  const handleNowBooking = () => { const now = new Date(); const formattedNow = format(now, "yyyy-MM-dd'T'HH:mm"); form.setValue('start_time', formattedNow); };
  const calculateEndTime = (startTime: string, sks: number, classType: string) => { if (!startTime || !sks) return null; const duration = classType === 'theory' ? sks * 50 : sks * 170; const startDate = new Date(startTime); const endDate = addMinutes(startDate, duration); return endDate; };
  const getEquipmentIcon = (category: string) => { switch (category.toLowerCase()) { case 'audio visual': return Users; case 'connectivity': return Wifi; default: return Zap; } };
  
  const onSubmit = async (data: BookingForm) => {
    if (!selectedRoom) { toast.error('Silakan pilih ruangan'); return; }
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
      toast.success('Pemesanan ruangan berhasil diajukan! Menunggu persetujuan.');
      form.reset({ class_type: 'theory', sks: 2, equipment_requested: [], });
      setSelectedRoom(null);
      setIdentitySearchTerm('');
      setStudyProgramSearchTerm('');
      fetchRoomsWithStatus();
    } catch (error: any) { console.error('Error creating booking:', error); toast.error(error.message || 'Gagal membuat pemesanan'); } finally { setLoading(false); }
  };
  // --- AKHIR DARI BAGIAN YANG TIDAK BERUBAH ---

  const filteredIdentityNumbers = existingUsers.filter(user =>
    user.identity_number.toLowerCase().includes(identitySearchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(identitySearchTerm.toLowerCase())
  );

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
        const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              room.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = room.status !== 'In Use' || showInUse;
        return matchesSearch && matchesStatus;
    });
  }, [rooms, searchTerm, showInUse]);

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
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white"> 
    <div className="flex items-center justify-between"> 
    <div> 
    <h1 className="text-3xl font-bold flex items-center space-x-3"><Calendar className="h-8 w-8" /><span>Book a Room</span></h1> 
    <p className="mt-2 opacity-90">Reserve a room for your lecture, meeting or study session</p> 
    </div> 
    <div className="hidden md:block text-right"> 
    <div className="text-2xl font-bold">{format(currentTime, 'HH:mm')}</div> 
    <div className="text-sm opacity-80">{format(currentTime, 'EEEE, MMMM d', { locale: localeID })}</div> 
    </div> 
    </div> 
    </div> 
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> 
    <div className="lg:col-span-2 space-y-6"> 
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"> 
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center"> 
    <div className="flex-1 relative w-full sm:w-auto"> 
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /> 
    <input 
    type="text" 
    placeholder="Search for rooms by name or code..." 
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
    
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"> 
    <h2 className="text-xl font-semibold text-gray-900 mb-4">Rooms Available Today</h2> 
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
    <div className="flex items-center space-x-2 mb-3"><Users className="h-4 w-4 text-gray-400" /> <span className="text-sm text-gray-600">{room.capacity} chairs</span></div> 
    <div className="flex items-center space-x-2"><MapPin className="h-4 w-4 text-gray-400" /> <span className="text-sm text-gray-600">{room.department?.name || 'General'}</span></div> 
    {room.status === 'Scheduled' && ( 
    <button title="View Schedule" onClick={(e) => { e.stopPropagation(); setViewingSchedulesFor(room); }} className="absolute bottom-2 right-2 p-2 text-gray-400 hover:text-blue-600 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"> 
    <Eye className="h-5 w-5"/> 
    </button> 
)} 
</div> 
))} 
</div>

export default BookRoom;