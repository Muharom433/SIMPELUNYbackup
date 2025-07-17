import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar,
  Clock,
  Users,
  Building,
  MapPin,
  CheckCircle,
  AlertCircle,
  User,
  Hash,
  Phone,
  GraduationCap,
  Package,
  Plus,
  Minus,
  X,
  Eye,
  BookOpen,
  FileText,
  Zap,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { format, addMinutes, isSameDay, isAfter, isBefore, parseISO } from 'date-fns';

// Schemas
const bookingDetailsSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  purpose: z.string().min(3, 'Purpose must be at least 3 characters'),
  sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
  class_type: z.enum(['theory', 'practical']),
  equipment_requested: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const userInfoSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  email: z.string().email('Invalid email address').optional(),
  study_program_id: z.string().min(1, 'Please select a study program'),
});

type BookingDetailsForm = z.infer<typeof bookingDetailsSchema>;
type UserInfoForm = z.infer<typeof userInfoSchema>;

interface Room {
  id: string;
  name: string;
  code: string;
  capacity: number;
  department_id: string;
  equipment: string[];
  is_available: boolean;
  department?: {
    name: string;
  };
}

interface RoomWithStatus extends Room {
  status: 'available' | 'in_use' | 'scheduled';
  schedule_details?: any;
}

interface Equipment {
  id: string;
  name: string;
  code: string;
  category: string;
  is_available: boolean;
}

interface StudyProgram {
  id: string;
  name: string;
  code: string;
  department_id: string;
}

interface Department {
  id: string;
  name: string;
}

const BookRoom: React.FC = () => {
  const { user } = useAuth();
  const { getText } = useLanguage();
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingDetails, setBookingDetails] = useState<BookingDetailsForm | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithStatus | null>(null);
  
  // Data states
  const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDetails, setScheduleDetails] = useState<any>(null);
  
  // Forms
  const bookingForm = useForm<BookingDetailsForm>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: format(new Date(), 'HH:mm'),
      end_time: format(addMinutes(new Date(), 120), 'HH:mm'),
      purpose: '',
      sks: 2,
      class_type: 'theory',
      equipment_requested: [],
      notes: '',
    },
  });

  const userForm = useForm<UserInfoForm>({
    resolver: zodResolver(userInfoSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      identity_number: user?.identity_number || '',
      phone_number: user?.phone_number || '',
      email: user?.email || '',
      study_program_id: user?.study_program_id || '',
    },
  });

  // Watch form values for real-time updates
  const watchedDate = bookingForm.watch('date');
  const watchedStartTime = bookingForm.watch('start_time');
  const watchedEndTime = bookingForm.watch('end_time');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (bookingDetails && watchedDate && watchedStartTime && watchedEndTime) {
      fetchRoomsWithStatus();
    }
  }, [bookingDetails, watchedDate, watchedStartTime, watchedEndTime]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Fetch equipment
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment')
        .select('*')
        .eq('is_available', true)
        .order('name');
      
      if (equipmentError) throw equipmentError;
      setEquipment(equipmentData || []);

      // Fetch study programs
      const { data: programsData, error: programsError } = await supabase
        .from('study_programs')
        .select('*, department:departments(name)')
        .order('name');
      
      if (programsError) throw programsError;
      setStudyPrograms(programsData || []);

      // Fetch departments
      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (departmentsError) throw departmentsError;
      setDepartments(departmentsData || []);

    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast.error(getText('Failed to load data', 'Gagal memuat data'));
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomsWithStatus = async () => {
    if (!bookingDetails) return;
    
    try {
      setLoading(true);
      
      // Fetch rooms that are available
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          *,
          department:departments(name)
        `)
        .eq('is_available', true)
        .order('name');
      
      if (roomsError) throw roomsError;
      
      // Check status for each room
      const roomsWithStatus = await Promise.all(
        (roomsData || []).map(async (room) => {
          const status = await getRoomStatus(
            room.id,
            bookingDetails.date,
            bookingDetails.start_time,
            bookingDetails.end_time
          );
          return {
            ...room,
            ...status
          };
        })
      );
      
      setRooms(roomsWithStatus);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error(getText('Failed to load rooms', 'Gagal memuat ruangan'));
    } finally {
      setLoading(false);
    }
  };

  const getRoomStatus = async (
    roomId: string,
    selectedDate: string,
    startTime: string,
    endTime: string
  ): Promise<{ status: 'available' | 'in_use' | 'scheduled'; schedule_details?: any }> => {
    try {
      const selectedDateTime = new Date(`${selectedDate}T${startTime}`);
      const endDateTime = new Date(`${selectedDate}T${endTime}`);
      
      // 1. Check for existing bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('room_id', roomId)
        .in('status', ['pending', 'approved'])
        .gte('end_time', selectedDateTime.toISOString())
        .lte('start_time', endDateTime.toISOString());
      
      if (bookingsError) throw bookingsError;
      
      if (bookings && bookings.length > 0) {
        return {
          status: 'in_use',
          schedule_details: {
            type: 'booking',
            data: bookings[0]
          }
        };
      }
      
      // 2. Check for lecture schedules
      const dayName = format(selectedDateTime, 'EEEE'); // Get day name (Monday, Tuesday, etc.)
      
      const { data: lectures, error: lecturesError } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('room', roomId)
        .eq('day', dayName);
      
      if (lecturesError) throw lecturesError;
      
      if (lectures && lectures.length > 0) {
        // Check time overlap
        for (const lecture of lectures) {
          if (lecture.start_time && lecture.end_time) {
            const lectureStart = new Date(`${selectedDate}T${lecture.start_time}`);
            const lectureEnd = new Date(`${selectedDate}T${lecture.end_time}`);
            
            // Check if times overlap
            if (
              (selectedDateTime >= lectureStart && selectedDateTime < lectureEnd) ||
              (endDateTime > lectureStart && endDateTime <= lectureEnd) ||
              (selectedDateTime <= lectureStart && endDateTime >= lectureEnd)
            ) {
              return {
                status: 'scheduled',
                schedule_details: {
                  type: 'lecture',
                  data: lecture
                }
              };
            }
          }
        }
      }
      
      // 3. Check for exams
      const { data: exams, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', selectedDate);
      
      if (examsError) throw examsError;
      
      if (exams && exams.length > 0) {
        // Check time overlap
        for (const exam of exams) {
          if (exam.start_time && exam.end_time) {
            const examStart = new Date(`${selectedDate}T${exam.start_time}`);
            const examEnd = new Date(`${selectedDate}T${exam.end_time}`);
            
            // Check if times overlap
            if (
              (selectedDateTime >= examStart && selectedDateTime < examEnd) ||
              (endDateTime > examStart && endDateTime <= examEnd) ||
              (selectedDateTime <= examStart && endDateTime >= examEnd)
            ) {
              return {
                status: 'scheduled',
                schedule_details: {
                  type: 'exam',
                  data: exam
                }
              };
            }
          }
        }
      }
      
      // 4. If no conflicts found, room is available
      return { status: 'available' };
      
    } catch (error) {
      console.error('Error checking room status:', error);
      return { status: 'available' }; // Default to available on error
    }
  };

  const handleBookingDetailsSubmit = (data: BookingDetailsForm) => {
    setBookingDetails(data);
    setCurrentStep(2);
  };

  const handleRoomSelect = (room: RoomWithStatus) => {
    if (room.status === 'scheduled') {
      setScheduleDetails(room.schedule_details);
      setShowScheduleModal(true);
      return;
    }
    
    if (room.status === 'in_use') {
      toast.error(getText('This room is currently in use', 'Ruangan ini sedang digunakan'));
      return;
    }
    
    setSelectedRoom(room);
    setCurrentStep(3);
  };

  const handleFinalSubmit = async (userInfo: UserInfoForm) => {
    if (!bookingDetails || !selectedRoom) return;
    
    try {
      setSubmitting(true);
      
      const startDateTime = new Date(`${bookingDetails.date}T${bookingDetails.start_time}`);
      const endDateTime = new Date(`${bookingDetails.date}T${bookingDetails.end_time}`);
      
      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          room_id: selectedRoom.id,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          purpose: bookingDetails.purpose,
          sks: bookingDetails.sks,
          class_type: bookingDetails.class_type,
          equipment_requested: bookingDetails.equipment_requested || [],
          notes: bookingDetails.notes,
          user_info: {
            full_name: userInfo.full_name,
            identity_number: userInfo.identity_number,
            phone_number: userInfo.phone_number,
            email: userInfo.email,
            study_program_id: userInfo.study_program_id,
          },
          status: 'pending'
        })
        .select()
        .single();
      
      if (bookingError) throw bookingError;
      
      toast.success(getText('Booking request submitted successfully!', 'Permintaan pemesanan berhasil dikirim!'));
      
      // Reset form
      setCurrentStep(1);
      setBookingDetails(null);
      setSelectedRoom(null);
      bookingForm.reset();
      userForm.reset();
      
    } catch (error: any) {
      console.error('Error submitting booking:', error);
      toast.error(error.message || getText('Failed to submit booking', 'Gagal mengirim pemesanan'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_use': return 'bg-red-100 text-red-800 border-red-200';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return CheckCircle;
      case 'in_use': return AlertCircle;
      case 'scheduled': return Clock;
      default: return AlertCircle;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return getText('Available', 'Tersedia');
      case 'in_use': return getText('In Use', 'Sedang Digunakan');
      case 'scheduled': return getText('Scheduled', 'Terjadwal');
      default: return getText('Unknown', 'Tidak Diketahui');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-xl">
              <Calendar className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {getText('Smart Room Booking', 'Pemesanan Ruangan Cerdas')}
          </h1>
          <p className="text-xl text-gray-600">
            {getText('Reserve your perfect study space', 'Pesan ruang belajar yang sempurna')}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[
              { step: 1, title: getText('Booking Details', 'Detail Pemesanan'), icon: FileText },
              { step: 2, title: getText('Select Room', 'Pilih Ruangan'), icon: Building },
              { step: 3, title: getText('User Information', 'Informasi Pengguna'), icon: User },
            ].map(({ step, title, icon: Icon }) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                  currentStep >= step 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-400'
                }`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={`text-sm font-medium ${
                    currentStep >= step ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {title}
                  </p>
                </div>
                {step < 3 && (
                  <ChevronRight className="h-5 w-5 text-gray-400 mx-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Booking Details */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {getText('Booking Details', 'Detail Pemesanan')}
            </h2>
            
            <form onSubmit={bookingForm.handleSubmit(handleBookingDetailsSubmit)} className="space-y-6">
              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Date', 'Tanggal')} *
                  </label>
                  <input
                    {...bookingForm.register('date')}
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {bookingForm.formState.errors.date && (
                    <p className="mt-1 text-sm text-red-600">{bookingForm.formState.errors.date.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Start Time', 'Waktu Mulai')} *
                  </label>
                  <input
                    {...bookingForm.register('start_time')}
                    type="time"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {bookingForm.formState.errors.start_time && (
                    <p className="mt-1 text-sm text-red-600">{bookingForm.formState.errors.start_time.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('End Time', 'Waktu Selesai')} *
                  </label>
                  <input
                    {...bookingForm.register('end_time')}
                    type="time"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {bookingForm.formState.errors.end_time && (
                    <p className="mt-1 text-sm text-red-600">{bookingForm.formState.errors.end_time.message}</p>
                  )}
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getText('Purpose', 'Tujuan')} *
                </label>
                <input
                  {...bookingForm.register('purpose')}
                  type="text"
                  placeholder={getText('e.g., Database Systems Lecture', 'mis. Kuliah Sistem Basis Data')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {bookingForm.formState.errors.purpose && (
                  <p className="mt-1 text-sm text-red-600">{bookingForm.formState.errors.purpose.message}</p>
                )}
              </div>

              {/* SKS and Class Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('SKS (Credits)', 'SKS (Kredit)')} *
                  </label>
                  <input
                    {...bookingForm.register('sks', { valueAsNumber: true })}
                    type="number"
                    min="1"
                    max="6"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {bookingForm.formState.errors.sks && (
                    <p className="mt-1 text-sm text-red-600">{bookingForm.formState.errors.sks.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Class Type', 'Tipe Kelas')} *
                  </label>
                  <select
                    {...bookingForm.register('class_type')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="theory">{getText('Theory', 'Teori')}</option>
                    <option value="practical">{getText('Practical', 'Praktik')}</option>
                  </select>
                </div>
              </div>

              {/* Equipment Request */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getText('Request Equipment', 'Permintaan Peralatan')}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {equipment.map((item) => (
                    <label key={item.id} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        value={item.id}
                        {...bookingForm.register('equipment_requested')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getText('Additional Notes', 'Catatan Tambahan')}
                </label>
                <textarea
                  {...bookingForm.register('notes')}
                  rows={3}
                  placeholder={getText('Any additional information...', 'Informasi tambahan...')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <span>{getText('Next: Select Room', 'Selanjutnya: Pilih Ruangan')}</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>