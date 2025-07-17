import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar,
  Clock,
  Users,
  Building,
  Package,
  User,
  Search,
  MapPin,
  Phone,
  Mail,
  Hash,
  GraduationCap,
  ChevronDown,
  X,
  Eye,
  AlertTriangle,
  CheckCircle,
  Upload,
  FileText,
  Zap,
  Star,
  RefreshCw,
  Info,
  BookOpen,
  Award,
  Target,
  TrendingUp,
  Activity,
  Lightbulb,
  Shield,
  Sparkles,
  ArrowRight,
  Plus,
  Minus,
  Settings,
  Bell,
  Home,
  Camera
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { alert } from '../components/Alert/AlertHelper';
import { format, addDays, isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';

// Enhanced interfaces for 2-layer status
interface EnhancedRoomStatus {
  id: string;
  name: string;
  code: string;
  capacity: number;
  department: any;
  equipment: string[];
  is_available: boolean;
  
  // 2-LAYER STATUS
  todayStatus: 'In Use' | 'Scheduled' | 'Available';
  targetDateStatus: 'Scheduled' | 'Available';
  
  currentBooking?: {
    id: string;
    purpose: string;
    start_time: string;
    end_time: string;
    user?: {
      full_name: string;
      identity_number: string;
    };
  };
  targetDateBookings: any[];
  scheduleDetails: {
    lectures: any[];
    exams: any[];
    sessions: any[];
  };
  futureBookings: {
    count: number;
    nextBooking?: {
      date: string;
      time: string;
      purpose: string;
      user?: string;
    };
    thisWeek: number;
    thisMonth: number;
    upcoming: any[];
  };
}

interface Equipment {
  id: string;
  name: string;
  code: string;
  category: string;
  is_mandatory: boolean;
  is_available: boolean;
  quantity?: number;
  unit?: string;
  condition?: string;
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
  role: string;
  department_id?: string;
  study_program_id?: string;
}

// Form validation schema
const bookingSchema = z.object({
  // Booking Details
  targetBookingDate: z.string().min(1, 'Booking date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  purpose: z.string().min(3, 'Purpose must be at least 3 characters'),
  sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
  class_type: z.enum(['theory', 'practical']),
  notes: z.string().optional(),
  
  // Room Selection
  room_id: z.string().min(1, 'Please select a room'),
  equipment_requested: z.array(z.string()).optional(),
  
  // Personal Information
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  email: z.string().email('Please enter a valid email address').optional(),
  department_id: z.string().optional(),
  study_program_id: z.string().optional(),
  
  // Attachments
  attachments: z.array(z.string()).optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

const BookRoom: React.FC = () => {
  const { user } = useAuth();
  const { getText } = useLanguage();
  
  // Form state
  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      targetBookingDate: format(new Date(), 'yyyy-MM-dd'),
      sks: 1,
      class_type: 'theory',
      equipment_requested: [],
      attachments: [],
    },
  });

  // Component state
  const [rooms, setRooms] = useState<EnhancedRoomStatus[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<EnhancedRoomStatus | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  
  // Search states
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [studyProgramSearchTerm, setStudyProgramSearchTerm] = useState('');
  const [showStudyProgramDropdown, setShowStudyProgramDropdown] = useState(false);
  
  // Modal states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedRoomForSchedule, setSelectedRoomForSchedule] = useState<EnhancedRoomStatus | null>(null);
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  // Watch form values
  const targetBookingDate = form.watch('targetBookingDate');
  const startTime = form.watch('start_time');
  const endTime = form.watch('end_time');
  const selectedDepartmentId = form.watch('department_id');

  // Initialize form with user data if logged in
  useEffect(() => {
    if (user) {
      form.setValue('full_name', user.full_name);
      form.setValue('identity_number', user.identity_number);
      form.setValue('email', user.email || '');
      form.setValue('phone_number', user.phone_number || '');
      form.setValue('department_id', user.department_id || '');
      form.setValue('study_program_id', user.study_program_id || '');
    }
  }, [user, form]);

  // Fetch initial data
  useEffect(() => {
    fetchDepartments();
    fetchStudyPrograms();
    fetchUsers();
    fetchEquipment();
  }, []);

  // Fetch rooms when date/time changes
  useEffect(() => {
    if (targetBookingDate) {
      fetchRoomsWithStatus(targetBookingDate);
    }
  }, [targetBookingDate, startTime, endTime]);

  // Filter study programs by department
  useEffect(() => {
    if (selectedDepartmentId) {
      fetchStudyProgramsByDepartment(selectedDepartmentId);
    }
  }, [selectedDepartmentId]);

  // Enhanced room status fetching with 2-layer logic
  const fetchRoomsWithStatus = useCallback(async (date: string) => {
    try {
      setLoading(true);
      
      // Get all available rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          *,
          department:departments(*)
        `)
        .eq('is_available', true)
        .order('name');

      if (roomsError) throw roomsError;

      if (!roomsData) {
        setRooms([]);
        return;
      }

      // Process each room for 2-layer status
      const enhancedRooms = await Promise.all(
        roomsData.map(async (room) => {
          const enhancedRoom = await getEnhancedRoomStatus(room, date);
          return enhancedRoom;
        })
      );

      setRooms(enhancedRooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert.error(
        getText('Failed to load rooms', 'Gagal memuat ruangan'),
        getText('Please try again', 'Silakan coba lagi')
      );
    } finally {
      setLoading(false);
    }
  }, [getText]);

  // Get enhanced room status with 2-layer logic
  const getEnhancedRoomStatus = async (room: any, targetDate: string): Promise<EnhancedRoomStatus> => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const isToday = targetDate === today;
    
    try {
      // Layer 1: Today Status (Real-time)
      let todayStatus: 'In Use' | 'Scheduled' | 'Available' = 'Available';
      let currentBooking = null;

      if (isToday) {
        // Check current active bookings
        const now = new Date();
        const { data: activeBookings } = await supabase
          .from('bookings')
          .select(`
            *,
            user:users(full_name, identity_number)
          `)
          .eq('room_id', room.id)
          .eq('status', 'approved')
          .lte('start_time', now.toISOString())
          .gte('end_time', now.toISOString())
          .limit(1);

        if (activeBookings && activeBookings.length > 0) {
          todayStatus = 'In Use';
          currentBooking = activeBookings[0];
        } else {
          // Check if room has any scheduled events today
          const hasScheduleToday = await checkScheduledEvents(room, today);
          if (hasScheduleToday) {
            todayStatus = 'Scheduled';
          }
        }
      }

      // Layer 2: Target Date Status
      let targetDateStatus: 'Scheduled' | 'Available' = 'Available';
      let targetDateBookings = [];
      let scheduleDetails = { lectures: [], exams: [], sessions: [] };

      // Check bookings for target date
      const startOfTargetDate = startOfDay(parseISO(targetDate));
      const endOfTargetDate = endOfDay(parseISO(targetDate));

      const { data: dateBookings } = await supabase
        .from('bookings')
        .select(`
          *,
          user:users(full_name, identity_number)
        `)
        .eq('room_id', room.id)
        .eq('status', 'approved')
        .gte('start_time', startOfTargetDate.toISOString())
        .lte('start_time', endOfTargetDate.toISOString());

      if (dateBookings && dateBookings.length > 0) {
        targetDateStatus = 'Scheduled';
        targetDateBookings = dateBookings;
      }

      // Check scheduled events for target date
      const scheduleData = await getScheduleDetails(room, targetDate);
      if (scheduleData.lectures.length > 0 || scheduleData.exams.length > 0 || scheduleData.sessions.length > 0) {
        targetDateStatus = 'Scheduled';
        scheduleDetails = scheduleData;
      }

      // Get future bookings analytics
      const futureBookings = await getFutureBookingsAnalytics(room.id);

      return {
        ...room,
        todayStatus,
        targetDateStatus,
        currentBooking,
        targetDateBookings,
        scheduleDetails,
        futureBookings,
      };
    } catch (error) {
      console.error('Error getting enhanced room status:', error);
      return {
        ...room,
        todayStatus: 'Available',
        targetDateStatus: 'Available',
        targetDateBookings: [],
        scheduleDetails: { lectures: [], exams: [], sessions: [] },
        futureBookings: { count: 0, thisWeek: 0, thisMonth: 0, upcoming: [] },
      };
    }
  };

  // Check scheduled events for a room on a specific date
  const checkScheduledEvents = async (room: any, date: string): Promise<boolean> => {
    try {
      const dayName = format(parseISO(date), 'EEEE');
      
      // Check lecture schedules
      const { data: lectures } = await supabase
        .from('lecture_schedules')
        .select('*')
        .ilike('room', `%${room.name}%`)
        .eq('day', dayName);

      // Check exams
      const { data: exams } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', room.id)
        .eq('date', date);

      // Check final sessions
      const { data: sessions } = await supabase
        .from('final_sessions')
        .select('*')
        .eq('room_id', room.id)
        .eq('date', date);

      return (lectures && lectures.length > 0) || 
             (exams && exams.length > 0) || 
             (sessions && sessions.length > 0);
    } catch (error) {
      console.error('Error checking scheduled events:', error);
      return false;
    }
  };

  // Get detailed schedule information
  const getScheduleDetails = async (room: any, date: string) => {
    try {
      const dayName = format(parseISO(date), 'EEEE');
      
      // Get lecture schedules
      const { data: lectures } = await supabase
        .from('lecture_schedules')
        .select('*')
        .ilike('room', `%${room.name}%`)
        .eq('day', dayName);

      // Get exams
      const { data: exams } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', room.id)
        .eq('date', date);

      // Get final sessions
      const { data: sessions } = await supabase
        .from('final_sessions')
        .select('*')
        .eq('room_id', room.id)
        .eq('date', date);

      return {
        lectures: lectures || [],
        exams: exams || [],
        sessions: sessions || [],
      };
    } catch (error) {
      console.error('Error getting schedule details:', error);
      return { lectures: [], exams: [], sessions: [] };
    }
  };

  // Get future bookings analytics
  const getFutureBookingsAnalytics = async (roomId: string) => {
    try {
      const now = new Date();
      const oneWeekLater = addDays(now, 7);
      const oneMonthLater = addDays(now, 30);

      const { data: futureBookings } = await supabase
        .from('bookings')
        .select(`
          *,
          user:users(full_name, identity_number)
        `)
        .eq('room_id', roomId)
        .eq('status', 'approved')
        .gt('start_time', now.toISOString())
        .lte('start_time', oneMonthLater.toISOString())
        .order('start_time');

      if (!futureBookings) {
        return { count: 0, thisWeek: 0, thisMonth: 0, upcoming: [] };
      }

      const thisWeekBookings = futureBookings.filter(b => 
        parseISO(b.start_time) <= oneWeekLater
      );

      const nextBooking = futureBookings[0];

      return {
        count: futureBookings.length,
        nextBooking: nextBooking ? {
          date: format(parseISO(nextBooking.start_time), 'yyyy-MM-dd'),
          time: format(parseISO(nextBooking.start_time), 'HH:mm'),
          purpose: nextBooking.purpose,
          user: nextBooking.user?.full_name,
        } : undefined,
        thisWeek: thisWeekBookings.length,
        thisMonth: futureBookings.length,
        upcoming: futureBookings.slice(0, 5),
      };
    } catch (error) {
      console.error('Error getting future bookings analytics:', error);
      return { count: 0, thisWeek: 0, thisMonth: 0, upcoming: [] };
    }
  };

  // Fetch other data
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

  const fetchStudyPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('study_programs')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setStudyPrograms(data || []);
    } catch (error) {
      console.error('Error fetching study programs:', error);
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
      console.error('Error fetching study programs by department:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
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

  // Handle room selection and auto-detect equipment
  const handleRoomSelect = (room: EnhancedRoomStatus) => {
    setSelectedRoom(room);
    form.setValue('room_id', room.id);
    
    // Auto-detect equipment for the room
    const roomEquipment = equipment.filter(eq => 
      room.equipment.includes(eq.name) || room.equipment.includes(eq.code)
    );
    
    const autoSelectedEquipment = roomEquipment.map(eq => eq.id);
    setSelectedEquipment(autoSelectedEquipment);
    form.setValue('equipment_requested', autoSelectedEquipment);
  };

  // Handle user search and auto-fill
  const handleUserSelect = (selectedUser: User) => {
    form.setValue('full_name', selectedUser.full_name);
    form.setValue('identity_number', selectedUser.identity_number);
    form.setValue('email', selectedUser.email || '');
    form.setValue('phone_number', selectedUser.phone_number || '');
    form.setValue('department_id', selectedUser.department_id || '');
    form.setValue('study_program_id', selectedUser.study_program_id || '');
    
    setUserSearchTerm(selectedUser.full_name);
    setShowUserDropdown(false);
  };

  // Handle department selection
  const handleDepartmentSelect = (department: Department) => {
    form.setValue('department_id', department.id);
    setDepartmentSearchTerm(department.name);
    setShowDepartmentDropdown(false);
    
    // Reset study program when department changes
    form.setValue('study_program_id', '');
    setStudyProgramSearchTerm('');
  };

  // Handle study program selection
  const handleStudyProgramSelect = (program: StudyProgram) => {
    form.setValue('study_program_id', program.id);
    setStudyProgramSearchTerm(program.name);
    setShowStudyProgramDropdown(false);
  };

  // File upload handling
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 5,
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: async (acceptedFiles) => {
      try {
        const uploadPromises = acceptedFiles.map(async (file) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        });

        const uploadedFileUrls = await Promise.all(uploadPromises);
        const newFiles = [...uploadedFiles, ...uploadedFileUrls];
        setUploadedFiles(newFiles);
        form.setValue('attachments', newFiles);
      } catch (error) {
        console.error('Error uploading files:', error);
        alert.error(
          getText('Failed to upload files', 'Gagal mengunggah file'),
          getText('Please try again', 'Silakan coba lagi')
        );
      }
    },
  });

  // Remove uploaded file
  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    form.setValue('attachments', newFiles);
  };

  // Get display status based on selected date
  const getDisplayStatus = (room: EnhancedRoomStatus) => {
    const isToday = targetBookingDate === format(new Date(), 'yyyy-MM-dd');
    return isToday ? room.todayStatus : room.targetDateStatus;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Use':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Scheduled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Available':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'In Use':
        return getText('In Use', 'Sedang Digunakan');
      case 'Scheduled':
        return getText('Scheduled', 'Terjadwal');
      case 'Available':
        return getText('Available', 'Tersedia');
      default:
        return status;
    }
  };

  // Show schedule details modal
  const showScheduleDetails = (room: EnhancedRoomStatus) => {
    setSelectedRoomForSchedule(room);
    setShowScheduleModal(true);
  };

  // Check room availability before booking
  const checkRoomAvailability = async (roomId: string, startDateTime: string, endDateTime: string) => {
    try {
      // Check booking conflicts
      const { data: bookingConflicts } = await supabase
        .from('bookings')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'approved')
        .or(`start_time.lte.${endDateTime},end_time.gte.${startDateTime}`)
        .or(`start_time.gte.${startDateTime},start_time.lte.${endDateTime}`);

      return {
        available: !bookingConflicts || bookingConflicts.length === 0,
        conflicts: bookingConflicts || [],
      };
    } catch (error) {
      console.error('Error checking room availability:', error);
      return { available: false, conflicts: [] };
    }
  };

  // Form submission
  const onSubmit = async (data: BookingForm) => {
    try {
      setSubmitting(true);

      // Validate room selection
      if (!selectedRoom) {
        alert.error(
          getText('Please select a room', 'Silakan pilih ruangan'),
          getText('Room selection is required', 'Pemilihan ruangan diperlukan')
        );
        return;
      }

      // Create start and end datetime
      const startDateTime = `${data.targetBookingDate}T${data.start_time}:00`;
      const endDateTime = `${data.targetBookingDate}T${data.end_time}:00`;

      // Validate time
      if (isAfter(parseISO(startDateTime), parseISO(endDateTime))) {
        alert.error(
          getText('End time must be after start time', 'Waktu selesai harus setelah waktu mulai'),
          getText('Please check your time selection', 'Silakan periksa pemilihan waktu Anda')
        );
        return;
      }

      // Check room availability
      const availabilityCheck = await checkRoomAvailability(
        selectedRoom.id,
        startDateTime,
        endDateTime
      );

      if (!availabilityCheck.available) {
        alert.error(
          getText('Room is not available for the selected time', 'Ruangan tidak tersedia untuk waktu yang dipilih'),
          getText('Please choose a different time or room', 'Silakan pilih waktu atau ruangan lain')
        );
        return;
      }

      // Handle late booking if room is currently in use
      if (selectedRoom.todayStatus === 'In Use' && selectedRoom.currentBooking) {
        const confirmLateBooking = await new Promise((resolve) => {
          alert.confirm(
            () => resolve(true),
            getText(
              'This room is currently in use. The current booking will be marked as completed. Continue?',
              'Ruangan ini sedang digunakan. Pemesanan saat ini akan ditandai sebagai selesai. Lanjutkan?'
            ),
            getText(
              'Current booking will be completed automatically',
              'Pemesanan saat ini akan diselesaikan secara otomatis'
            )
          );
        });

        if (!confirmLateBooking) return;

        // Mark current booking as completed
        await supabase
          .from('bookings')
          .update({ status: 'completed' })
          .eq('id', selectedRoom.currentBooking.id);
      }

      // Create booking data
      const bookingData = {
        user_id: user?.id || null,
        room_id: data.room_id,
        start_time: startDateTime,
        end_time: endDateTime,
        purpose: data.purpose,
        sks: data.sks,
        class_type: data.class_type,
        status: 'pending',
        equipment_requested: data.equipment_requested || [],
        notes: data.notes || null,
        user_info: user ? null : {
          full_name: data.full_name,
          identity_number: data.identity_number,
          phone_number: data.phone_number,
          email: data.email,
          department_id: data.department_id,
          study_program_id: data.study_program_id,
        },
        attachments: data.attachments || [],
      };

      // Submit booking
      const { error } = await supabase
        .from('bookings')
        .insert(bookingData);

      if (error) throw error;

      // Show success message
      alert.success(
        getText('Booking submitted successfully!', 'Pemesanan berhasil dikirim!'),
        getText(
          'Your booking request has been submitted and is pending approval.',
          'Permintaan pemesanan Anda telah dikirim dan menunggu persetujuan.'
        )
      );

      // Reset form
      form.reset({
        targetBookingDate: format(new Date(), 'yyyy-MM-dd'),
        sks: 1,
        class_type: 'theory',
        equipment_requested: [],
        attachments: [],
      });
      setSelectedRoom(null);
      setSelectedEquipment([]);
      setUploadedFiles([]);
      setUserSearchTerm('');
      setDepartmentSearchTerm('');
      setStudyProgramSearchTerm('');

      // Refresh room status
      fetchRoomsWithStatus(data.targetBookingDate);

    } catch (error: any) {
      console.error('Error submitting booking:', error);
      alert.error(
        getText('Failed to submit booking', 'Gagal mengirim pemesanan'),
        error.message || getText('Please try again', 'Silakan coba lagi')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Filter functions for dropdowns
  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.identity_number.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(departmentSearchTerm.toLowerCase()) ||
    dept.code.toLowerCase().includes(departmentSearchTerm.toLowerCase())
  );

  const filteredStudyPrograms = studyPrograms.filter(program =>
    program.name.toLowerCase().includes(studyProgramSearchTerm.toLowerCase()) ||
    program.code.toLowerCase().includes(studyProgramSearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-xl">
                <Calendar className="h-12 w-12 text-white" />
                <div className="absolute -top-1 -right-1 h-6 w-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-yellow-800" />
                </div>
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            {getText('Smart Room Booking', 'Pemesanan Ruangan Cerdas')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {getText(
              'Reserve your perfect study space with our intelligent booking system',
              'Pesan ruang belajar yang sempurna dengan sistem pemesanan cerdas kami'
            )}
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
            {/* Left Column - Form */}
            <div className="lg:col-span-4 space-y-8">
              {/* Step 1: Booking Details */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-3 rounded-xl">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {getText('Booking Details', 'Detail Pemesanan')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getText('Select your booking date and time', 'Pilih tanggal dan waktu pemesanan')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Booking Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Booking Date', 'Tanggal Pemesanan')} *
                    </label>
                    <input
                      {...form.register('targetBookingDate')}
                      type="date"
                      min={format(new Date(), 'yyyy-MM-dd')}
                      max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                      className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    />
                    {form.formState.errors.targetBookingDate && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.targetBookingDate.message}
                      </p>
                    )}
                  </div>

                  {/* Purpose */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Purpose', 'Tujuan')} *
                    </label>
                    <input
                      {...form.register('purpose')}
                      type="text"
                      placeholder={getText('e.g., Database Systems Lecture', 'mis. Kuliah Sistem Basis Data')}
                      className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    />
                    {form.formState.errors.purpose && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.purpose.message}
                      </p>
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
                      className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    />
                    {form.formState.errors.start_time && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.start_time.message}
                      </p>
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
                      className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    />
                    {form.formState.errors.end_time && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.end_time.message}
                      </p>
                    )}
                  </div>

                  {/* SKS */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('SKS (Credits)', 'SKS (Kredit)')} *
                    </label>
                    <select
                      {...form.register('sks', { valueAsNumber: true })}
                      className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    >
                      {[1, 2, 3, 4, 5, 6].map(sks => (
                        <option key={sks} value={sks}>{sks} SKS</option>
                      ))}
                    </select>
                    {form.formState.errors.sks && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.sks.message}
                      </p>
                    )}
                  </div>

                  {/* Class Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Class Type', 'Tipe Kelas')} *
                    </label>
                    <select
                      {...form.register('class_type')}
                      className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    >
                      <option value="theory">{getText('Theory', 'Teori')}</option>
                      <option value="practical">{getText('Practical', 'Praktik')}</option>
                    </select>
                    {form.formState.errors.class_type && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.class_type.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Additional Notes', 'Catatan Tambahan')}
                  </label>
                  <textarea
                    {...form.register('notes')}
                    rows={3}
                    placeholder={getText('Any special requirements or notes...', 'Persyaratan khusus atau catatan...')}
                    className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                  />
                </div>
              </div>

              {/* Step 2: Room Selection */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 rounded-xl">
                    <Building className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {getText('Room Selection', 'Pemilihan Ruangan')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getText('Choose your preferred room', 'Pilih ruangan yang Anda inginkan')}
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center space-x-3">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                      <span className="text-gray-600">
                        {getText('Loading rooms...', 'Memuat ruangan...')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rooms.map((room) => {
                      const displayStatus = getDisplayStatus(room);
                      const isSelected = selectedRoom?.id === room.id;
                      
                      return (
                        <div
                          key={room.id}
                          onClick={() => handleRoomSelect(room)}
                          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 shadow-lg'
                              : 'border-gray-200 bg-white/50 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-gray-900">{room.name}</h4>
                              <p className="text-sm text-gray-600">{room.code}</p>
                            </div>
                            <div className="flex flex-col items-end space-y-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(displayStatus)}`}>
                                {getStatusText(displayStatus)}
                              </span>
                              {displayStatus === 'Scheduled' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showScheduleDetails(room);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>{getText('View Details', 'Lihat Detail')}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4" />
                              <span>{room.capacity} {getText('seats', 'kursi')}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-4 w-4" />
                              <span>{room.department?.name}</span>
                            </div>
                          </div>

                          {/* Current booking info for "In Use" status */}
                          {displayStatus === 'In Use' && room.currentBooking && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                              <div className="flex items-center space-x-2 mb-1">
                                <Clock className="h-4 w-4 text-red-600" />
                                <span className="text-sm font-medium text-red-800">
                                  {getText('Currently in use', 'Sedang digunakan')}
                                </span>
                              </div>
                              <p className="text-xs text-red-700">
                                {room.currentBooking.purpose} - {room.currentBooking.user?.full_name}
                              </p>
                              <p className="text-xs text-red-600">
                                {format(parseISO(room.currentBooking.start_time), 'HH:mm')} - 
                                {format(parseISO(room.currentBooking.end_time), 'HH:mm')}
                              </p>
                            </div>
                          )}

                          {/* Future bookings indicator */}
                          {room.futureBookings.count > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                              <div className="flex items-center justify-between text-xs text-blue-700">
                                <span>🔮 {room.futureBookings.count} {getText('future bookings', 'pemesanan mendatang')}</span>
                                {room.futureBookings.nextBooking && (
                                  <span>{getText('Next:', 'Berikutnya:')} {room.futureBookings.nextBooking.time}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Late booking warning */}
                          {displayStatus === 'In Use' && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-3">
                              <div className="flex items-center space-x-2">
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                                <span className="text-xs font-medium text-orange-800">
                                  {getText('Late Booking: Current booking will be marked as completed', 'Pemesanan Terlambat: Pemesanan saat ini akan ditandai selesai')}
                                </span>
                              </div>
                            </div>
                          )}

                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle className="h-5 w-5 text-blue-600" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {form.formState.errors.room_id && (
                  <p className="mt-4 text-sm text-red-600">
                    {form.formState.errors.room_id.message}
                  </p>
                )}
              </div>

              {/* Step 3: Equipment Request */}
              {selectedRoom && (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-xl">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {getText('Equipment Request', 'Permintaan Peralatan')}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {getText('Select additional equipment if needed', 'Pilih peralatan tambahan jika diperlukan')}
                      </p>
                    </div>
                  </div>

                  {/* Auto-detected equipment */}
                  {selectedEquipment.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        {getText('Auto-detected Equipment', 'Peralatan Terdeteksi Otomatis')}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {equipment
                          .filter(eq => selectedEquipment.includes(eq.id))
                          .map((eq) => (
                            <div key={eq.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <Zap className="h-5 w-5 text-green-600" />
                                <div>
                                  <p className="font-medium text-gray-900">{eq.name}</p>
                                  <p className="text-sm text-gray-600">{eq.code}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newSelected = selectedEquipment.filter(id => id !== eq.id);
                                  setSelectedEquipment(newSelected);
                                  form.setValue('equipment_requested', newSelected);
                                }}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Additional equipment */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      {getText('Additional Equipment', 'Peralatan Tambahan')}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                      {equipment
                        .filter(eq => !selectedEquipment.includes(eq.id))
                        .map((eq) => (
                          <div
                            key={eq.id}
                            onClick={() => {
                              const newSelected = [...selectedEquipment, eq.id];
                              setSelectedEquipment(newSelected);
                              form.setValue('equipment_requested', newSelected);
                            }}
                            className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                          >
                            <Package className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{eq.name}</p>
                              <p className="text-sm text-gray-600">{eq.code} • {eq.category}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Personal Information */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 rounded-xl">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {getText('Personal Information', 'Informasi Pribadi')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getText('Enter your contact details', 'Masukkan detail kontak Anda')}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* User Search */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Search Existing User', 'Cari Pengguna yang Ada')}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={userSearchTerm}
                        onChange={(e) => {
                          setUserSearchTerm(e.target.value);
                          setShowUserDropdown(true);
                        }}
                        onFocus={() => setShowUserDropdown(true)}
                        placeholder={getText('Search by name or identity number...', 'Cari berdasarkan nama atau nomor identitas...')}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                    </div>

                    {showUserDropdown && filteredUsers.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {filteredUsers.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleUserSelect(user)}
                            className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-600">{user.identity_number} • {user.role}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Full Name', 'Nama Lengkap')} *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          {...form.register('full_name')}
                          type="text"
                          placeholder={getText('Enter your full name', 'Masukkan nama lengkap Anda')}
                          className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        />
                      </div>
                      {form.formState.errors.full_name && (
                        <p className="mt-1 text-sm text-red-600">
                          {form.formState.errors.full_name.message}
                        </p>
                      )}
                    </div>

                    {/* Identity Number */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          {...form.register('identity_number')}
                          type="text"
                          placeholder={getText('Enter your student/staff ID', 'Masukkan ID mahasiswa/staff')}
                          className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        />
                      </div>
                      {form.formState.errors.identity_number && (
                        <p className="mt-1 text-sm text-red-600">
                          {form.formState.errors.identity_number.message}
                        </p>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Phone Number', 'Nomor Telepon')} *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          {...form.register('phone_number')}
                          type="tel"
                          placeholder="08xxxxxxxxxx"
                          className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        />
                      </div>
                      {form.formState.errors.phone_number && (
                        <p className="mt-1 text-sm text-red-600">
                          {form.formState.errors.phone_number.message}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Email Address', 'Alamat Email')}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          {...form.register('email')}
                          type="email"
                          placeholder={getText('Enter your email address', 'Masukkan alamat email Anda')}
                          className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        />
                      </div>
                      {form.formState.errors.email && (
                        <p className="mt-1 text-sm text-red-600">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Department */}
                    <div className="relative">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Department', 'Departemen')}
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                        <input
                          type="text"
                          value={departmentSearchTerm}
                          onChange={(e) => {
                            setDepartmentSearchTerm(e.target.value);
                            setShowDepartmentDropdown(true);
                          }}
                          onFocus={() => setShowDepartmentDropdown(true)}
                          placeholder={getText('Search department...', 'Cari departemen...')}
                          className="w-full pl-10 pr-10 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        />
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>

                      {showDepartmentDropdown && filteredDepartments.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {filteredDepartments.map((dept) => (
                            <div
                              key={dept.id}
                              onClick={() => handleDepartmentSelect(dept)}
                              className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{dept.name}</div>
                              <div className="text-sm text-gray-600">{dept.code}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Study Program */}
                    <div className="relative">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Study Program', 'Program Studi')}
                      </label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                        <input
                          type="text"
                          value={studyProgramSearchTerm}
                          onChange={(e) => {
                            setStudyProgramSearchTerm(e.target.value);
                            setShowStudyProgramDropdown(true);
                          }}
                          onFocus={() => setShowStudyProgramDropdown(true)}
                          placeholder={getText('Search study program...', 'Cari program studi...')}
                          className="w-full pl-10 pr-10 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        />
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>

                      {showStudyProgramDropdown && filteredStudyPrograms.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {filteredStudyPrograms.map((program) => (
                            <div
                              key={program.id}
                              onClick={() => handleStudyProgramSelect(program)}
                              className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{program.name}</div>
                              <div className="text-sm text-gray-600">{program.code}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* File Upload */}
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
                      <p className="text-sm text-gray-600 mb-1">
                        {getText('Drag & drop files here, or click to select', 'Seret & lepas file di sini, atau klik untuk memilih')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getText('PNG, JPG, PDF up to 5MB each', 'PNG, JPG, PDF hingga 5MB per file')}
                      </p>
                    </div>

                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-5 w-5 text-gray-600" />
                              <span className="text-sm text-gray-900">
                                {getText('Document', 'Dokumen')} {index + 1}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Physical ID Notice */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-blue-800 mb-1">
                          {getText('Physical ID Required', 'ID Fisik Diperlukan')}
                        </h4>
                        <p className="text-sm text-blue-700">
                          {getText(
                            'Please bring your physical ID card when using the room.',
                            'Harap bawa kartu identitas fisik saat menggunakan ruangan.'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SUBMIT BUTTON - MOVED HERE AFTER PERSONAL INFORMATION */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={submitting || !selectedRoom}
                    className="w-full group relative flex justify-center items-center space-x-3 py-4 px-6 border border-transparent rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
                  >
                    <Calendar className="h-6 w-6" />
                    <span>
                      {submitting
                        ? getText('Submitting Booking...', 'Mengirim Pemesanan...')
                        : getText('Submit Booking Request', 'Kirim Permintaan Pemesanan')
                      }
                    </span>
                    {!submitting && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Available Rooms Summary */}
            <div className="lg:col-span-3">
              <div className="sticky top-8 space-y-6">
                {/* Room Status Summary */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                    <Building className="h-6 w-6 text-blue-600" />
                    <span>{getText('Available Rooms', 'Ruangan Tersedia')}</span>
                  </h3>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <div className="text-2xl font-bold text-green-600">
                        {rooms.filter(r => getDisplayStatus(r) === 'Available').length}
                      </div>
                      <div className="text-sm text-green-700">{getText('Available', 'Tersedia')}</div>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-xl">
                      <div className="text-2xl font-bold text-yellow-600">
                        {rooms.filter(r => getDisplayStatus(r) === 'Scheduled').length}
                      </div>
                      <div className="text-sm text-yellow-700">{getText('Scheduled', 'Terjadwal')}</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-xl">
                      <div className="text-2xl font-bold text-red-600">
                        {rooms.filter(r => getDisplayStatus(r) === 'In Use').length}
                      </div>
                      <div className="text-sm text-red-700">{getText('In Use', 'Digunakan')}</div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p className="mb-2">
                      📅 {getText('Showing status for:', 'Menampilkan status untuk:')} {' '}
                      <span className="font-semibold">
                        {targetBookingDate === format(new Date(), 'yyyy-MM-dd')
                          ? getText('Today', 'Hari Ini')
                          : format(parseISO(targetBookingDate), 'MMM d, yyyy')
                        }
                      </span>
                    </p>
                    <p>
                      🔄 {getText('Status updates automatically when you change the date', 'Status diperbarui otomatis saat Anda mengubah tanggal')}
                    </p>
                  </div>
                </div>

                {/* Selected Room Details */}
                {selectedRoom && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <span>{getText('Selected Room', 'Ruangan Terpilih')}</span>
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-bold text-lg text-gray-900">{selectedRoom.name}</h4>
                        <p className="text-gray-600">{selectedRoom.code}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">{getText('Capacity:', 'Kapasitas:')}</span>
                          <span className="ml-2 font-semibold">{selectedRoom.capacity} {getText('seats', 'kursi')}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">{getText('Department:', 'Departemen:')}</span>
                          <span className="ml-2 font-semibold">{selectedRoom.department?.name}</span>
                        </div>
                      </div>

                      <div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(getDisplayStatus(selectedRoom))}`}>
                          {getStatusText(getDisplayStatus(selectedRoom))}
                        </span>
                      </div>

                      {selectedEquipment.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            {getText('Selected Equipment:', 'Peralatan Terpilih:')}
                          </h5>
                          <div className="space-y-2">
                            {equipment
                              .filter(eq => selectedEquipment.includes(eq.id))
                              .map((eq) => (
                                <div key={eq.id} className="flex items-center space-x-2 text-sm">
                                  <Zap className="h-4 w-4 text-green-600" />
                                  <span>{eq.name}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* What happens next */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                    <Lightbulb className="h-5 w-5 text-blue-600" />
                    <span>{getText('What happens next?', 'Apa yang terjadi selanjutnya?')}</span>
                  </h3>
                  <div className="space-y-3 text-sm text-gray-700">
                    <div className="flex items-start space-x-3">
                      <div className="h-6 w-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                      <p>{getText('Your booking will be marked as completed', 'Pemesanan Anda akan ditandai sebagai selesai')}</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="h-6 w-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                      <p>{getText('Equipment will be checked and processed for return', 'Peralatan akan diperiksa dan diproses untuk dikembalikan')}</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="h-6 w-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                      <p>{getText('Any reported issues will be forwarded to the maintenance team', 'Masalah yang dilaporkan akan diteruskan ke tim pemeliharaan')}</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="h-6 w-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                      <p>{getText("You'll receive a confirmation notification", 'Anda akan menerima notifikasi konfirmasi')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Schedule Details Modal */}
        {showScheduleModal && selectedRoomForSchedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    {getText('Schedule Details', 'Detail Jadwal')} - {selectedRoomForSchedule.name}
                  </h3>
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Current Bookings */}
                  {selectedRoomForSchedule.targetDateBookings.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <span>{getText('Bookings', 'Pemesanan')}</span>
                      </h4>
                      <div className="space-y-3">
                        {selectedRoomForSchedule.targetDateBookings.map((booking, index) => (
                          <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-semibold text-gray-900">{booking.purpose}</h5>
                              <span className="text-sm text-blue-600">
                                {format(parseISO(booking.start_time), 'HH:mm')} - {format(parseISO(booking.end_time), 'HH:mm')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {booking.user?.full_name} ({booking.user?.identity_number})
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lecture Schedules */}
                  {selectedRoomForSchedule.scheduleDetails.lectures.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <BookOpen className="h-5 w-5 text-green-600" />
                        <span>{getText('Lecture Schedules', 'Jadwal Kuliah')}</span>
                      </h4>
                      <div className="space-y-3">
                        {selectedRoomForSchedule.scheduleDetails.lectures.map((lecture, index) => (
                          <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-semibold text-gray-900">{lecture.course_name}</h5>
                              <span className="text-sm text-green-600">
                                {lecture.start_time} - {lecture.end_time}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {lecture.lecturer} • {lecture.class} • {lecture.course_code}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exams */}
                  {selectedRoomForSchedule.scheduleDetails.exams.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <Award className="h-5 w-5 text-orange-600" />
                        <span>{getText('Exams', 'Ujian')}</span>
                      </h4>
                      <div className="space-y-3">
                        {selectedRoomForSchedule.scheduleDetails.exams.map((exam, index) => (
                          <div key={index} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-semibold text-gray-900">{exam.course_name}</h5>
                              <span className="text-sm text-orange-600">
                                {exam.start_time} - {exam.end_time}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {exam.course_code} • {exam.class} • {exam.student_amount} {getText('students', 'mahasiswa')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Final Sessions */}
                  {selectedRoomForSchedule.scheduleDetails.sessions.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <Target className="h-5 w-5 text-purple-600" />
                        <span>{getText('Final Sessions', 'Sidang Akhir')}</span>
                      </h4>
                      <div className="space-y-3">
                        {selectedRoomForSchedule.scheduleDetails.sessions.map((session, index) => (
                          <div key={index} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-semibold text-gray-900">{session.title}</h5>
                              <span className="text-sm text-purple-600">
                                {session.start_time} - {session.end_time}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {session.supervisor} • {session.examiner}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Future Bookings */}
                  {selectedRoomForSchedule.futureBookings.count > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5 text-indigo-600" />
                        <span>🔮 {getText('Future Bookings', 'Pemesanan Mendatang')} ({selectedRoomForSchedule.futureBookings.count})</span>
                      </h4>
                      <div className="space-y-3">
                        {selectedRoomForSchedule.futureBookings.upcoming.map((booking, index) => (
                          <div key={index} className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-semibold text-gray-900">{booking.purpose}</h5>
                              <span className="text-sm text-indigo-600">
                                {format(parseISO(booking.start_time), 'MMM d, HH:mm')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {booking.user?.full_name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Click outside handlers for dropdowns */}
        {(showUserDropdown || showDepartmentDropdown || showStudyProgramDropdown) && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowUserDropdown(false);
              setShowDepartmentDropdown(false);
              setShowStudyProgramDropdown(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default BookRoom;