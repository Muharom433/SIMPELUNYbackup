import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Package,
  User,
  Building,
  CheckCircle,
  AlertCircle,
  Search,
  Plus,
  X,
  Upload,
  FileText,
  Phone,
  Mail,
  Hash,
  GraduationCap,
  ChevronDown,
  Eye,
  Zap,
  BookOpen,
  UserCheck,
  RefreshCw,
  Info,
  Star,
  Award,
  Target,
  Lightbulb,
  Shield,
  Globe
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { alert } from '../components/Alert/AlertHelper';
import { format, isAfter, isBefore, parseISO, addMinutes, startOfDay, endOfDay } from 'date-fns';

// Validation schemas
const bookingSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  purpose: z.string().min(3, 'Purpose must be at least 3 characters'),
  sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
  class_type: z.enum(['theory', 'practical']),
  equipment_requested: z.array(z.string()).optional(),
  notes: z.string().optional(),
  room_id: z.string().min(1, 'Please select a room'),
  // User information
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  email: z.string().email('Invalid email address').optional(),
  department_id: z.string().optional(),
  study_program_id: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

interface Room {
  id: string;
  name: string;
  code: string;
  capacity: number;
  equipment: string[];
  department_id: string;
  is_available: boolean;
  department?: {
    name: string;
  };
}

interface Equipment {
  id: string;
  name: string;
  code: string;
  category: string;
  is_available: boolean;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface StudyProgram {
  id: string;
  name: string;
  code: string;
  department_id: string;
}

interface User {
  id: string;
  full_name: string;
  identity_number: string;
  email?: string;
  phone_number?: string;
  department_id?: string;
  study_program_id?: string;
  role: string;
}

interface RoomStatus {
  status: 'available' | 'in_use' | 'scheduled';
  details?: any;
  conflictType?: 'booking' | 'lecture' | 'exam' | 'session';
}

const BookRoom: React.FC = () => {
  const { user } = useAuth();
  const { getText, currentLanguage } = useLanguage();
  
  // State management
  const [rooms, setRooms] = useState<Room[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomStatuses, setRoomStatuses] = useState<Record<string, RoomStatus>>({});
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDetails, setScheduleDetails] = useState<any>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isManualEntry, setIsManualEntry] = useState(false);

  // Form management
  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      sks: 1,
      class_type: 'theory',
      equipment_requested: [],
      attachments: [],
    },
  });

  const watchedDate = form.watch('date');
  const watchedStartTime = form.watch('start_time');
  const watchedEndTime = form.watch('end_time');
  const watchedDepartmentId = form.watch('department_id');

  // Fetch initial data
  useEffect(() => {
    fetchRooms();
    fetchEquipment();
    fetchDepartments();
    fetchUsers();
  }, []);

  // Update room statuses when date/time changes
  useEffect(() => {
    if (watchedDate && watchedStartTime && watchedEndTime) {
      updateRoomStatuses();
    }
  }, [watchedDate, watchedStartTime, watchedEndTime]);

  // Filter study programs by department
  useEffect(() => {
    if (watchedDepartmentId) {
      fetchStudyProgramsByDepartment(watchedDepartmentId);
    } else {
      setStudyPrograms([]);
    }
  }, [watchedDepartmentId]);

  // Auto-fill user data if logged in
  useEffect(() => {
    if (user && !isManualEntry) {
      form.setValue('full_name', user.full_name || '');
      form.setValue('identity_number', user.identity_number || '');
      form.setValue('phone_number', user.phone_number || '');
      form.setValue('email', user.email || '');
      form.setValue('department_id', user.department_id || '');
      form.setValue('study_program_id', user.study_program_id || '');
    }
  }, [user, form, isManualEntry]);

  // Fetch functions
  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          department:departments(name)
        `)
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert.error(
        getText('Failed to load rooms', 'Gagal memuat ruangan'),
        getText('Please try again later', 'Silakan coba lagi nanti')
      );
    }
  };

  const fetchEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchStudyProgramsByDepartment = async (departmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('study_programs')
        .select('*')
        .eq('department_id', departmentId)
        .order('name');

      if (error) throw error;
      setStudyPrograms(data || []);
    } catch (error) {
      console.error('Error fetching study programs:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, identity_number, email, phone_number, department_id, study_program_id, role')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Real-time room status checking
  const getRoomStatus = async (roomId: string, date: string, startTime: string, endTime: string): Promise<RoomStatus> => {
    try {
      const selectedDate = new Date(date);
      const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      // 1. Check current bookings (IN USE)
      const { data: bookings, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'approved')
        .gte('start_time', startOfDay(selectedDate).toISOString())
        .lte('end_time', endOfDay(selectedDate).toISOString());

      if (bookingError) throw bookingError;

      if (bookings && bookings.length > 0) {
        for (const booking of bookings) {
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);
          const requestStart = new Date(`${date}T${startTime}`);
          const requestEnd = new Date(`${date}T${endTime}`);

          // Check for time overlap
          if (
            (requestStart >= bookingStart && requestStart < bookingEnd) ||
            (requestEnd > bookingStart && requestEnd <= bookingEnd) ||
            (requestStart <= bookingStart && requestEnd >= bookingEnd)
          ) {
            return {
              status: 'in_use',
              details: booking,
              conflictType: 'booking'
            };
          }
        }
      }

      // 2. Check lecture schedules (SCHEDULED)
      const { data: lectures, error: lectureError } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('room', rooms.find(r => r.id === roomId)?.name || '')
        .eq('day', dayName);

      if (lectureError) throw lectureError;

      if (lectures && lectures.length > 0) {
        for (const lecture of lectures) {
          if (lecture.start_time && lecture.end_time) {
            const lectureStart = `${lecture.start_time}`;
            const lectureEnd = `${lecture.end_time}`;

            // Check for time overlap
            if (
              (startTime >= lectureStart && startTime < lectureEnd) ||
              (endTime > lectureStart && endTime <= lectureEnd) ||
              (startTime <= lectureStart && endTime >= lectureEnd)
            ) {
              return {
                status: 'scheduled',
                details: lecture,
                conflictType: 'lecture'
              };
            }
          }
        }
      }

      // 3. Check exam schedules (SCHEDULED)
      const { data: exams, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', date);

      if (examError) throw examError;

      if (exams && exams.length > 0) {
        for (const exam of exams) {
          if (exam.start_time && exam.end_time) {
            const examStart = exam.start_time;
            const examEnd = exam.end_time;

            // Check for time overlap
            if (
              (startTime >= examStart && startTime < examEnd) ||
              (endTime > examStart && endTime <= examEnd) ||
              (startTime <= examStart && endTime >= examEnd)
            ) {
              return {
                status: 'scheduled',
                details: exam,
                conflictType: 'exam'
              };
            }
          }
        }
      }

      // 4. Check final session schedules (SCHEDULED)
      const { data: sessions, error: sessionError } = await supabase
        .from('final_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', date);

      if (sessionError) throw sessionError;

      if (sessions && sessions.length > 0) {
        for (const session of sessions) {
          if (session.start_time && session.end_time) {
            const sessionStart = session.start_time;
            const sessionEnd = session.end_time;

            // Check for time overlap
            if (
              (startTime >= sessionStart && startTime < sessionEnd) ||
              (endTime > sessionStart && endTime <= sessionEnd) ||
              (startTime <= sessionStart && endTime >= sessionEnd)
            ) {
              return {
                status: 'scheduled',
                details: session,
                conflictType: 'session'
              };
            }
          }
        }
      }

      // 5. Default: AVAILABLE
      return { status: 'available' };

    } catch (error) {
      console.error('Error checking room status:', error);
      return { status: 'available' };
    }
  };

  const updateRoomStatuses = async () => {
    if (!watchedDate || !watchedStartTime || !watchedEndTime) return;

    const statuses: Record<string, RoomStatus> = {};
    
    for (const room of rooms) {
      const status = await getRoomStatus(room.id, watchedDate, watchedStartTime, watchedEndTime);
      statuses[room.id] = status;
    }
    
    setRoomStatuses(statuses);
  };

  // Room selection and equipment auto-detection
  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    form.setValue('room_id', room.id);
    
    // Auto-detect equipment for chosen room
    if (room.equipment && room.equipment.length > 0) {
      const availableRoomEquipment = equipment.filter(eq => 
        room.equipment.includes(eq.name) || room.equipment.includes(eq.id)
      );
      
      const equipmentIds = availableRoomEquipment.map(eq => eq.id);
      form.setValue('equipment_requested', equipmentIds);
      
      if (availableRoomEquipment.length > 0) {
        alert.success(
          getText('Equipment auto-detected', 'Peralatan terdeteksi otomatis'),
          getText(`${availableRoomEquipment.length} equipment items have been automatically selected for this room`, `${availableRoomEquipment.length} peralatan telah dipilih otomatis untuk ruangan ini`)
        );
      }
    }
  };

  // User search and auto-fill
  const handleUserSelect = (selectedUser: User) => {
    form.setValue('full_name', selectedUser.full_name);
    form.setValue('identity_number', selectedUser.identity_number);
    form.setValue('phone_number', selectedUser.phone_number || '');
    form.setValue('email', selectedUser.email || '');
    form.setValue('department_id', selectedUser.department_id || '');
    form.setValue('study_program_id', selectedUser.study_program_id || '');
    setShowUserSearch(false);
    setUserSearchTerm('');
    setIsManualEntry(false);
  };

  // File upload handling
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 5,
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setAttachments(prev => [...prev, base64]);
          form.setValue('attachments', [...attachments, base64]);
        };
        reader.readAsDataURL(file);
      });
    },
  });

  // Form submission
  const handleSubmit = async (data: BookingForm) => {
    try {
      setLoading(true);

      // Check if room is in use and handle accordingly
      const roomStatus = roomStatuses[data.room_id];
      if (roomStatus?.status === 'in_use') {
        // Mark existing booking as completed
        const existingBooking = roomStatus.details;
        if (existingBooking) {
          await supabase
            .from('bookings')
            .update({ status: 'completed' })
            .eq('id', existingBooking.id);
        }
      }

      // Prepare booking data
      const bookingData = {
        user_id: user?.id || null,
        room_id: data.room_id,
        start_time: new Date(`${data.date}T${data.start_time}`).toISOString(),
        end_time: new Date(`${data.date}T${data.end_time}`).toISOString(),
        purpose: data.purpose,
        sks: data.sks,
        class_type: data.class_type,
        equipment_requested: data.equipment_requested || [],
        notes: data.notes || null,
        status: 'pending',
        attachments: data.attachments || [],
        user_info: user ? null : {
          full_name: data.full_name,
          identity_number: data.identity_number,
          phone_number: data.phone_number,
          email: data.email,
          department_id: data.department_id,
          study_program_id: data.study_program_id,
        },
      };

      const { error } = await supabase
        .from('bookings')
        .insert(bookingData);

      if (error) throw error;

      alert.success(
        getText('Booking submitted successfully!', 'Pemesanan berhasil dikirim!'),
        getText('Your booking request has been submitted and is pending approval.', 'Permintaan pemesanan Anda telah dikirim dan menunggu persetujuan.')
      );

      // Reset form
      form.reset({
        sks: 1,
        class_type: 'theory',
        equipment_requested: [],
        attachments: [],
      });
      setSelectedRoom(null);
      setAttachments([]);
      setIsManualEntry(false);

    } catch (error: any) {
      console.error('Error submitting booking:', error);
      alert.error(
        getText('Failed to submit booking', 'Gagal mengirim pemesanan'),
        error.message || getText('Please try again later', 'Silakan coba lagi nanti')
      );
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_use': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return CheckCircle;
      case 'in_use': return Clock;
      case 'scheduled': return Calendar;
      default: return AlertCircle;
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.identity_number.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const showScheduleDetails = (details: any, type: string) => {
    setScheduleDetails({ ...details, type });
    setShowScheduleModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 sm:p-8 text-white mb-8 shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold">
                    {getText('Smart Room Booking', 'Pemesanan Ruangan Cerdas')}
                  </h1>
                  <p className="text-blue-100 text-lg">
                    {getText('Reserve your perfect study space', 'Pesan ruang belajar yang sempurna')}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{rooms.length}</div>
                <div className="text-blue-200 text-sm">
                  {getText('Available Rooms', 'Ruangan Tersedia')}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{equipment.length}</div>
                <div className="text-blue-200 text-sm">
                  {getText('Equipment Items', 'Peralatan')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {/* Step 1: Booking Details */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Clock className="h-6 w-6" />
                <span>{getText('Booking Details', 'Detail Pemesanan')}</span>
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Date', 'Tanggal')} *
                  </label>
                  <input
                    {...form.register('date')}
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  {form.formState.errors.date && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.date.message}</p>
                  )}
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Start Time', 'Waktu Mulai')} *
                  </label>
                  <input
                    {...form.register('start_time')}
                    type="time"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  {form.formState.errors.start_time && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.start_time.message}</p>
                  )}
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('End Time', 'Waktu Selesai')} *
                  </label>
                  <input
                    {...form.register('end_time')}
                    type="time"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  {form.formState.errors.end_time && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.end_time.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Purpose */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Purpose', 'Tujuan')} *
                  </label>
                  <input
                    {...form.register('purpose')}
                    type="text"
                    placeholder={getText('e.g., Database Systems Lecture', 'mis. Kuliah Sistem Basis Data')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  {form.formState.errors.purpose && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.purpose.message}</p>
                  )}
                </div>

                {/* SKS */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('SKS (Credits)', 'SKS (Kredit)')} *
                  </label>
                  <select
                    {...form.register('sks', { valueAsNumber: true })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  >
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num}>{num} SKS</option>
                    ))}
                  </select>
                  {form.formState.errors.sks && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.sks.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Class Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Class Type', 'Tipe Kelas')} *
                  </label>
                  <select
                    {...form.register('class_type')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  >
                    <option value="theory">{getText('Theory', 'Teori')}</option>
                    <option value="practical">{getText('Practical', 'Praktik')}</option>
                  </select>
                  {form.formState.errors.class_type && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.class_type.message}</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Notes', 'Catatan')}
                  </label>
                  <textarea
                    {...form.register('notes')}
                    rows={3}
                    placeholder={getText('Additional notes or requirements...', 'Catatan tambahan atau persyaratan...')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Room & Equipment Selection */}
          {watchedDate && watchedStartTime && watchedEndTime && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Building className="h-6 w-6" />
                  <span>{getText('Room & Equipment Selection', 'Pilih Ruangan & Peralatan')}</span>
                </h2>
              </div>
              
              <div className="p-6">
                {/* Room Selection */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {getText('Available Rooms', 'Ruangan Tersedia')}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rooms.map((room) => {
                      const status = roomStatuses[room.id] || { status: 'available' };
                      const StatusIcon = getStatusIcon(status.status);
                      const isSelected = selectedRoom?.id === room.id;
                      const canSelect = status.status === 'available' || status.status === 'in_use';
                      
                      return (
                        <div
                          key={room.id}
                          className={`relative p-4 border-2 rounded-xl transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                              : canSelect
                                ? 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                                : 'border-gray-200 opacity-75'
                          }`}
                          onClick={() => {
                            if (canSelect) {
                              handleRoomSelect(room);
                            } else if (status.status === 'scheduled') {
                              showScheduleDetails(status.details, status.conflictType || 'unknown');
                            }
                          }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{room.name}</h4>
                              <p className="text-sm text-gray-600">{room.code}</p>
                              <p className="text-xs text-gray-500">{room.department?.name}</p>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(status.status)}`}>
                              <StatusIcon className="h-3 w-3 inline mr-1" />
                              {status.status === 'available' && getText('Available', 'Tersedia')}
                              {status.status === 'in_use' && getText('In Use', 'Sedang Digunakan')}
                              {status.status === 'scheduled' && getText('Scheduled', 'Terjadwal')}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span>{room.capacity} {getText('seats', 'kursi')}</span>
                            </div>
                            {status.status === 'scheduled' && (
                              <button
                                type="button"
                                className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showScheduleDetails(status.details, status.conflictType || 'unknown');
                                }}
                              >
                                <Eye className="h-4 w-4" />
                                <span>{getText('View Details', 'Lihat Detail')}</span>
                              </button>
                            )}
                          </div>
                          
                          {room.equipment && room.equipment.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {room.equipment.slice(0, 3).map((eq, index) => (
                                <span key={index} className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                                  {eq}
                                </span>
                              ))}
                              {room.equipment.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-xs rounded-full">
                                  +{room.equipment.length - 3} {getText('more', 'lainnya')}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1">
                              <CheckCircle className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {form.formState.errors.room_id && (
                    <p className="mt-2 text-sm text-red-600">{form.formState.errors.room_id.message}</p>
                  )}
                </div>

                {/* Equipment Selection */}
                {selectedRoom && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {getText('Request Equipment', 'Permintaan Peralatan')}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {equipment.map((eq) => {
                        const isSelected = form.watch('equipment_requested')?.includes(eq.id) || false;
                        const isAutoSelected = selectedRoom.equipment.includes(eq.name) || selectedRoom.equipment.includes(eq.id);
                        
                        return (
                          <div
                            key={eq.id}
                            className={`p-4 border-2 rounded-xl transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-green-300'
                            } ${isAutoSelected ? 'ring-2 ring-blue-200' : ''}`}
                            onClick={() => {
                              const current = form.getValues('equipment_requested') || [];
                              if (isSelected) {
                                form.setValue('equipment_requested', current.filter(id => id !== eq.id));
                              } else {
                                form.setValue('equipment_requested', [...current, eq.id]);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">{eq.name}</h4>
                                <p className="text-sm text-gray-600">{eq.code}</p>
                                <p className="text-xs text-gray-500">{eq.category}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                {isAutoSelected && (
                                  <div className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    {getText('Auto', 'Otomatis')}
                                  </div>
                                )}
                                {isSelected && (
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: User Information */}
          {selectedRoom && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <User className="h-6 w-6" />
                  <span>{getText('User Information', 'Informasi Pengguna')}</span>
                </h2>
              </div>
              
              <div className="p-6 space-y-6">
                {/* User Search or Manual Entry Toggle */}
                {!user && (
                  <div className="flex items-center justify-center space-x-4 mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualEntry(false);
                        setShowUserSearch(true);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        !isManualEntry
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {getText('Search Existing User', 'Cari Pengguna Terdaftar')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualEntry(true);
                        setShowUserSearch(false);
                        form.reset({
                          ...form.getValues(),
                          full_name: '',
                          identity_number: '',
                          phone_number: '',
                          email: '',
                          department_id: '',
                          study_program_id: '',
                        });
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        isManualEntry
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {getText('Manual Entry', 'Input Manual')}
                    </button>
                  </div>
                )}

                {/* User Search */}
                {showUserSearch && !user && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Search by Name or NIM/NIP', 'Cari berdasarkan Nama atau NIM/NIP')}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        placeholder={getText('Enter name or identity number...', 'Masukkan nama atau nomor identitas...')}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      />
                    </div>
                    
                    {userSearchTerm && filteredUsers.length > 0 && (
                      <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-xl">
                        {filteredUsers.slice(0, 10).map((user) => (
                          <div
                            key={user.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleUserSelect(user)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{user.full_name}</p>
                                <p className="text-sm text-gray-600">{user.identity_number}</p>
                                <p className="text-xs text-gray-500">{user.role}</p>
                              </div>
                              <UserCheck className="h-5 w-5 text-green-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* User Information Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Full Name', 'Nama Lengkap')} *
                    </label>
                    <input
                      {...form.register('full_name')}
                      type="text"
                      readOnly={!!user && !isManualEntry}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                        !!user && !isManualEntry ? 'bg-gray-50' : ''
                      }`}
                    />
                    {form.formState.errors.full_name && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.full_name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                    </label>
                    <input
                      {...form.register('identity_number')}
                      type="text"
                      readOnly={!!user && !isManualEntry}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                        !!user && !isManualEntry ? 'bg-gray-50' : ''
                      }`}
                    />
                    {form.formState.errors.identity_number && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.identity_number.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Phone Number', 'Nomor Telepon')} *
                    </label>
                    <input
                      {...form.register('phone_number')}
                      type="tel"
                      readOnly={!!user && !isManualEntry}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                        !!user && !isManualEntry ? 'bg-gray-50' : ''
                      }`}
                    />
                    {form.formState.errors.phone_number && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.phone_number.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Email', 'Email')}
                    </label>
                    <input
                      {...form.register('email')}
                      type="email"
                      readOnly={!!user && !isManualEntry}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                        !!user && !isManualEntry ? 'bg-gray-50' : ''
                      }`}
                    />
                    {form.formState.errors.email && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Department', 'Departemen')}
                    </label>
                    <select
                      {...form.register('department_id')}
                      disabled={!!user && !isManualEntry}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                        !!user && !isManualEntry ? 'bg-gray-50' : ''
                      }`}
                    >
                      <option value="">{getText('Select Department', 'Pilih Departemen')}</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Study Program', 'Program Studi')}
                    </label>
                    <select
                      {...form.register('study_program_id')}
                      disabled={!!user && !isManualEntry}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                        !!user && !isManualEntry ? 'bg-gray-50' : ''
                      }`}
                    >
                      <option value="">{getText('Select Study Program', 'Pilih Program Studi')}</option>
                      {studyPrograms.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* File Attachments */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Attach Documents (Optional)', 'Lampirkan Dokumen (Opsional)')}
                  </label>
                  <div
                    {...getRootProps()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors duration-200"
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      {getText('Drag & drop files here, or click to select', 'Seret & lepas file di sini, atau klik untuk memilih')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {getText('Supports: Images, PDF (Max 5 files)', 'Mendukung: Gambar, PDF (Maks 5 file)')}
                    </p>
                  </div>
                  
                  {attachments.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            {attachment.startsWith('data:image') ? (
                              <img
                                src={attachment}
                                alt={`Attachment ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FileText className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newAttachments = attachments.filter((_, i) => i !== index);
                              setAttachments(newAttachments);
                              form.setValue('attachments', newAttachments);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Physical ID Requirement Notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-800">
                        {getText('Physical ID Required', 'ID Fisik Diperlukan')}
                      </h4>
                      <p className="text-sm text-amber-700 mt-1">
                        {getText('Please bring your physical ID card when using the room.', 'Harap bawa kartu identitas fisik saat menggunakan ruangan.')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>{getText('Submitting...', 'Mengirim...')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>{getText('Submit Booking Request', 'Kirim Permintaan Pemesanan')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Schedule Details Modal */}
        {showScheduleModal && scheduleDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {getText('Schedule Details', 'Detail Jadwal')}
                  </h3>
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {scheduleDetails.type === 'lecture' && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {getText('Course', 'Mata Kuliah')}
                        </label>
                        <p className="text-gray-900">{scheduleDetails.course_name || scheduleDetails.course_code}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {getText('Lecturer', 'Dosen')}
                        </label>
                        <p className="text-gray-900">{scheduleDetails.lecturer}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {getText('Time', 'Waktu')}
                        </label>
                        <p className="text-gray-900">
                          {scheduleDetails.start_time} - {scheduleDetails.end_time}
                        </p>
                      </div>
                    </>
                  )}
                  
                  {scheduleDetails.type === 'exam' && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {getText('Exam', 'Ujian')}
                        </label>
                        <p className="text-gray-900">{scheduleDetails.course_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {getText('Date', 'Tanggal')}
                        </label>
                        <p className="text-gray-900">{scheduleDetails.date}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {getText('Students', 'Mahasiswa')}
                        </label>
                        <p className="text-gray-900">{scheduleDetails.student_amount}</p>
                      </div>
                    </>
                  )}
                  
                  {scheduleDetails.type === 'session' && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {getText('Final Session', 'Sidang Akhir')}
                        </label>
                        <p className="text-gray-900">{scheduleDetails.title}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {getText('Supervisor', 'Pembimbing')}
                        </label>
                        <p className="text-gray-900">{scheduleDetails.supervisor}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {getText('Time', 'Waktu')}
                        </label>
                        <p className="text-gray-900">
                          {scheduleDetails.start_time} - {scheduleDetails.end_time}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                  >
                    {getText('Close', 'Tutup')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookRoom;