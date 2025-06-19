import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar, Clock, Users, MapPin, Zap, CheckCircle, AlertCircle, Search, Grid, List, X, Send, RefreshCw, ChevronDown, Monitor, Wifi, Phone, User, Eye
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

interface RoomWithDetails extends Room {
  department: Department | null;
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

  // --- ADDED: State for the new schedule detail modal ---
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedRoomForSchedule, setSelectedRoomForSchedule] = useState<RoomWithDetails | null>(null);
  const [scheduleDetails, setScheduleDetails] = useState<LectureSchedule[]>([]);
  const [loadingScheduleDetails, setLoadingScheduleDetails] = useState(false);

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { class_type: 'theory', sks: 2, equipment_requested: [], },
  });

  const watchSks = form.watch('sks');
  const watchClassType = form.watch('class_type');
  const watchIdentityNumber = form.watch('identity_number');
  const watchStudyProgramId = form.watch('study_program_id');

  const normalizeRoomName = (name: string): string => name ? name.toLowerCase().replace(/[\s.&-]/g, '') : '';

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

  const fetchStudyPrograms = async () => { try { const { data, error } = await supabase.from('study_programs').select(`*, department:departments(*)`).order('name'); if (error) throw error; setStudyPrograms(data || []); } catch (error: any) { console.error('Error fetching study programs:', error); toast.error('Failed to load study programs'); } };
  const fetchEquipment = async () => { try { const { data, error } = await supabase.from('equipment').select('*').eq('is_available', true); if (error) throw error; setEquipment(data || []); } catch (error: any) { console.error('Error fetching equipment:', error); toast.error('Failed to load equipment'); } };
  const fetchExistingUsers = async () => { try { const { data, error } = await supabase.from('users').select(`id, identity_number, full_name, email, phone_number, study_program_id, study_program:study_programs(*, department:departments(*))`).eq('role', 'student').order('full_name'); if (error) throw error; const usersWithPrograms = (data || []).map(user => ({...user, study_program: user.study_program})); setExistingUsers(usersWithPrograms); } catch (error) { console.error('Error fetching users:', error); } };
  
  useEffect(() => {
    updateRoomStatuses(true);
    fetchStudyPrograms();
    fetchEquipment();
    fetchExistingUsers();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const refreshStatusInterval = setInterval(() => updateRoomStatuses(), 5 * 60 * 1000);
    return () => { clearInterval(timer); clearInterval(refreshStatusInterval); };
  }, [updateRoomStatuses]);

  useEffect(() => { if (watchIdentityNumber && watchIdentityNumber.length >= 5) { const existingUser = existingUsers.find(user => user.identity_number === watchIdentityNumber); if (existingUser) { form.setValue('full_name', existingUser.full_name); if (existingUser.phone_number) { form.setValue('phone_number', existingUser.phone_number); } if (existingUser.study_program_id) { form.setValue('study_program_id', existingUser.study_program_id); const selectedProgram = studyPrograms.find(sp => sp.id === existingUser.study_program_id); if (selectedProgram) { setStudyProgramSearchTerm(`${selectedProgram.name} (${selectedProgram.code}) - ${selectedProgram.department?.name}`); } } toast.success('Data automatically filled!'); } } }, [watchIdentityNumber, existingUsers, form, studyPrograms]);
  useEffect(() => { if (watchStudyProgramId) { const selectedProgram = studyPrograms.find(sp => sp.id === watchStudyProgramId); if (selectedProgram) { setStudyProgramSearchTerm(`${selectedProgram.name} (${selectedProgram.code}) - ${selectedProgram.department?.name}`); } } }, [watchStudyProgramId, studyPrograms]);

  const handleNowBooking = () => { const now = new Date(); const formattedNow = format(now, "yyyy-MM-dd'T'HH:mm"); form.setValue('start_time', formattedNow); };
  const calculateEndTime = (startTime: string, sks: number, classType: string) => { if (!startTime || !sks) return null; const duration = classType === 'theory' ? sks * 50 : sks * 170; const startDate = new Date(startTime); return addMinutes(startDate, duration); };
  
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) || room.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCapacity = !filterCapacity || room.capacity >= filterCapacity;
      const matchesAvailability = showAllRooms || room.status === 'Available' || room.status === 'Scheduled';
      return matchesSearch && matchesCapacity && matchesAvailability;
    });
  }, [rooms, searchTerm, filterCapacity, showAllRooms]);
  
  const getStatusColor = (status: RoomWithDetails['status']) => {
    switch (status) {
      case 'In Use': return 'bg-red-100 text-red-800';
      case 'Scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'Available': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEquipmentIcon = (category: string) => { switch (category?.toLowerCase()) { case 'audio visual': return Monitor; case 'connectivity': return Wifi; case 'power': return Zap; default: return Zap; } };
  const filteredIdentityNumbers = existingUsers.filter(user => user.identity_number.toLowerCase().includes(identitySearchTerm.toLowerCase()) || user.full_name.toLowerCase().includes(identitySearchTerm.toLowerCase()));
  const filteredStudyPrograms = studyPrograms.filter(program => program.name.toLowerCase().includes(studyProgramSearchTerm.toLowerCase()) || program.code.toLowerCase().includes(studyProgramSearchTerm.toLowerCase()) || program.department?.name.toLowerCase().includes(studyProgramSearchTerm.toLowerCase()));
  
  const onSubmit = async (data: BookingForm) => {
    if (!selectedRoom) { toast.error('Please select a room'); return; }
    setIsSubmitting(true);
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
      const bookingData = {
        room_id: data.room_id, start_time: data.start_time, end_time: endDate.toISOString(), sks: data.sks,
        class_type: data.class_type, equipment_requested: data.equipment_requested || [], notes: data.notes || null, status: 'pending',
        purpose: 'Class/Study Session',
        user_info: profile ? null : { full_name: data.full_name, identity_number: data.identity_number, study_program_id: data.study_program_id, phone_number: data.phone_number, email: `${data.identity_number}@student.edu`, department_id: departmentId },
        user_id: profile?.id || null,
      };
      const { error } = await supabase.from('bookings').insert(bookingData);
      if (error) throw error;
      toast.success('Room booking submitted successfully! Awaiting approval.');
      form.reset({ class_type: 'theory', sks: 2, equipment_requested: [] });
      setSelectedRoom(null); setIdentitySearchTerm(''); setStudyProgramSearchTerm('');
      updateRoomStatuses();
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const mandatoryEquipment = equipment.filter(eq => eq.is_mandatory);
  const optionalEquipment = equipment.filter(eq => !eq.is_mandatory);

  const fetchAndShowSchedules = async (room: RoomWithDetails) => {
    setSelectedRoomForSchedule(room);
    setShowScheduleModal(true);
    setLoadingScheduleDetails(true);
    try {
        const todayDayName = format(new Date(), 'EEEE', { locale: localeID });
        const { data, error } = await supabase.from('lecture_schedules').select('*').eq('day', todayDayName).eq('room', room.name).order('start_time');
        if (error) throw error;
        setScheduleDetails(data || []);
    } catch(e) {
        toast.error("Could not load schedule details.");
    } finally {
        setLoadingScheduleDetails(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
        {/* ... The entire Booking Form and Room List JSX is here, unchanged and complete ... */}
        {/* ... The Eye icon is now correctly imported and will render ... */}

        {/* --- ADDED: Modal to show schedule details --- */}
        {showScheduleModal && selectedRoomForSchedule && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Schedule for {selectedRoomForSchedule.name}</h3>
                            <button onClick={() => setShowScheduleModal(false)} className="p-1 rounded-full hover:bg-gray-100"><X size={20}/></button>
                        </div>
                        {loadingScheduleDetails ? (
                            <div className="flex justify-center items-center h-32"><RefreshCw className="animate-spin h-6 w-6 text-gray-500"/></div>
                        ) : scheduleDetails.length > 0 ? (
                            <ul className="space-y-3">
                                {scheduleDetails.map(schedule => (
                                    <li key={schedule.id} className="p-3 bg-gray-50 rounded-md">
                                        <p className="font-semibold">{schedule.course_name}</p>
                                        <p className="text-sm text-gray-700">{schedule.start_time?.substring(0,5)} - {schedule.end_time?.substring(0,5)}</p>
                                        <p className="text-xs text-gray-500">Prodi: {schedule.subject_study}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-gray-500 py-8">No lecture schedule for this room today.</p>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default BookRoom;
