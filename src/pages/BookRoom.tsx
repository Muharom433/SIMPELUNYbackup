import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar, Clock, Users, Building, Package, User, Search, MapPin, 
  Phone, Mail, Hash, GraduationCap, ChevronDown, Eye, Loader2,
  AlertTriangle, CheckCircle, XCircle, Zap, FileText, Upload, X,
  Filter, SortAsc, SortDesc, RefreshCw, Info
} from 'lucide-react';
import { format, addDays, parseISO, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { alert } from '../components/Alert/AlertHelper';
import { useDropzone } from 'react-dropzone';
import { useRoomData } from '../hooks/useRoomData';
import { useRealTimeRoomUpdates } from '../hooks/useRealTimeRoomUpdates';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { EnhancedRoomStatus } from '../stores/roomStore';

// Form validation schema
const bookingSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  email: z.string().email('Please enter a valid email address'),
  department_id: z.string().min(1, 'Please select a department'),
  study_program_id: z.string().min(1, 'Please select a study program'),
  purpose: z.string().min(5, 'Purpose must be at least 5 characters'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  sks: z.number().min(1).max(6),
  class_type: z.enum(['theory', 'practical']),
  equipment_requested: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

interface Department {
  id: string;
  name: string;
}

interface StudyProgram {
  id: string;
  name: string;
  code: string;
  department_id: string;
}

interface Equipment {
  id: string;
  name: string;
  code: string;
  category: string;
  is_available: boolean;
}

interface UserSearchResult {
  id: string;
  full_name: string;
  identity_number: string;
  email: string;
  phone_number: string;
  department_id: string;
  study_program_id: string;
}

// Memoized Room Card Component
const RoomCard = React.memo(({ 
  room, 
  isSelected, 
  onSelect, 
  onViewSchedule,
  targetDate 
}: {
  room: EnhancedRoomStatus;
  isSelected: boolean;
  onSelect: (room: EnhancedRoomStatus) => void;
  onViewSchedule: (room: EnhancedRoomStatus) => void;
  targetDate: string;
}) => {
  const { getText } = useLanguage();
  const isToday = targetDate === format(new Date(), 'yyyy-MM-dd');
  const displayStatus = isToday ? room.todayStatus : room.targetDateStatus;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Use': return 'bg-red-100 text-red-800 border-red-200';
      case 'Scheduled': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Available': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'In Use': return <XCircle className="h-4 w-4" />;
      case 'Scheduled': return <Clock className="h-4 w-4" />;
      case 'Available': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div
      onClick={() => onSelect(room)}
      className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-[1.02]'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
      }`}
    >
      {/* Room Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
            <Building className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{room.name}</h3>
            <p className="text-sm text-gray-500">{room.code}</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(displayStatus)}`}>
          {getStatusIcon(displayStatus)}
          <span>{displayStatus}</span>
        </div>
      </div>

      {/* Room Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">{getText('Capacity', 'Kapasitas')}</span>
          </div>
          <span className="font-medium text-gray-900">{room.capacity} {getText('seats', 'kursi')}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">{getText('Department', 'Departemen')}</span>
          </div>
          <span className="font-medium text-gray-900">{room.department?.name || 'N/A'}</span>
        </div>
      </div>

      {/* Current Booking Info (if In Use) */}
      {displayStatus === 'In Use' && room.currentBooking && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              {getText('Currently in use by', 'Sedang digunakan oleh')}
            </span>
          </div>
          <div className="text-sm text-red-700">
            <p className="font-medium">{room.currentBooking.user?.full_name || 'Unknown User'}</p>
            <p>{room.currentBooking.purpose}</p>
            <p className="text-xs">
              {format(parseISO(room.currentBooking.start_time), 'HH:mm')} - 
              {format(parseISO(room.currentBooking.end_time), 'HH:mm')}
            </p>
          </div>
        </div>
      )}

      {/* Future Bookings Indicator */}
      {room.futureBookings.count > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {getText('Future Bookings', 'Pemesanan Mendatang')}
              </span>
            </div>
            <span className="text-sm font-bold text-blue-600">
              {room.futureBookings.count}
            </span>
          </div>
          {room.futureBookings.nextBooking && (
            <div className="text-xs text-blue-700 mt-1">
              {getText('Next:', 'Selanjutnya:')} {room.futureBookings.nextBooking.date} {room.futureBookings.nextBooking.time}
            </div>
          )}
        </div>
      )}

      {/* Equipment Preview */}
      {room.equipment && room.equipment.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center space-x-2 mb-2">
            <Package className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">
              {getText('Available Equipment', 'Peralatan Tersedia')}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {room.equipment.slice(0, 3).map((eq, index) => (
              <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                {eq}
              </span>
            ))}
            {room.equipment.length > 3 && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-200 text-gray-600">
                +{room.equipment.length - 3} {getText('more', 'lainnya')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Schedule Details Button */}
      {displayStatus === 'Scheduled' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewSchedule(room);
          }}
          className="absolute top-4 right-16 p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded-lg transition-colors duration-200"
          title={getText('View Schedule Details', 'Lihat Detail Jadwal')}
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});

const BookRoom: React.FC = () => {
  const { getText } = useLanguage();
  
  // Performance monitoring
  usePerformanceMonitor();
  
  // State management
  const [targetBookingDate, setTargetBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRoom, setSelectedRoom] = useState<EnhancedRoomStatus | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchingUser, setSearchingUser] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalRoom, setScheduleModalRoom] = useState<EnhancedRoomStatus | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showInUse, setShowInUse] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'capacity' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Smart data fetching with caching
  const { rooms, loading, error, fetchRoomData } = useRoomData(targetBookingDate);
  
  // Real-time updates with debouncing
  useRealTimeRoomUpdates(targetBookingDate);
  
  // Form management
  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      sks: 1,
      class_type: 'theory',
      equipment_requested: [],
    },
  });

  // Only fetch on mount and date change - NO aggressive timers
  useEffect(() => {
    fetchRoomData(targetBookingDate);
  }, [targetBookingDate, fetchRoomData]);

  // Fetch departments and study programs on mount
  useEffect(() => {
    fetchDepartments();
    fetchStudyPrograms();
    fetchAvailableEquipment();
  }, []);

  // Memoized filtered and sorted rooms
  const memoizedRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           room.code.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isToday = targetBookingDate === format(new Date(), 'yyyy-MM-dd');
      const displayStatus = isToday ? room.todayStatus : room.targetDateStatus;
      
      const matchesStatus = filterStatus === 'all' || displayStatus === filterStatus;
      const matchesVisibility = displayStatus !== 'In Use' || showInUse;
      
      return matchesSearch && matchesStatus && matchesVisibility;
    }).sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'capacity':
          comparison = a.capacity - b.capacity;
          break;
        case 'status':
          const isToday = targetBookingDate === format(new Date(), 'yyyy-MM-dd');
          const aStatus = isToday ? a.todayStatus : a.targetDateStatus;
          const bStatus = isToday ? b.todayStatus : b.targetDateStatus;
          comparison = aStatus.localeCompare(bStatus);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [rooms, searchTerm, filterStatus, showInUse, sortBy, sortOrder, targetBookingDate]);

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

  const fetchAvailableEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('is_available', true)
        .order('name');
      
      if (error) throw error;
      setAvailableEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  };

  const searchUsers = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setUserSearchResults([]);
      setShowUserDropdown(false);
      return;
    }

    setSearchingUser(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, identity_number, email, phone_number, department_id, study_program_id')
        .or(`full_name.ilike.%${searchTerm}%,identity_number.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      setUserSearchResults(data || []);
      setShowUserDropdown(true);
    } catch (error) {
      console.error('Error searching users:', error);
      setUserSearchResults([]);
    } finally {
      setSearchingUser(false);
    }
  };

  const selectUser = (user: UserSearchResult) => {
    form.setValue('full_name', user.full_name);
    form.setValue('identity_number', user.identity_number);
    form.setValue('email', user.email);
    form.setValue('phone_number', user.phone_number);
    form.setValue('department_id', user.department_id);
    form.setValue('study_program_id', user.study_program_id);
    setShowUserDropdown(false);
  };

  const handleRoomSelect = (room: EnhancedRoomStatus) => {
    setSelectedRoom(room);
    
    // Auto-select equipment for the room
    if (room.equipment && room.equipment.length > 0) {
      const roomEquipmentIds = availableEquipment
        .filter(eq => room.equipment.includes(eq.name))
        .map(eq => eq.id);
      form.setValue('equipment_requested', roomEquipmentIds);
    }
  };

  const handleViewSchedule = (room: EnhancedRoomStatus) => {
    setScheduleModalRoom(room);
    setShowScheduleModal(true);
  };

  // File upload handling
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'], 'application/pdf': ['.pdf'] },
    maxFiles: 5,
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    },
  });

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: BookingForm) => {
    if (!selectedRoom) {
      alert.error(getText('Please select a room', 'Silakan pilih ruangan'));
      return;
    }

    setSubmitting(true);
    try {
      // Check if room is currently in use and handle late booking
      if (selectedRoom.todayStatus === 'In Use' && selectedRoom.currentBooking) {
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'completed' })
          .eq('id', selectedRoom.currentBooking.id);

        if (updateError) throw updateError;
      }

      // Create booking
      const startDateTime = `${targetBookingDate}T${data.start_time}:00`;
      const endDateTime = `${targetBookingDate}T${data.end_time}:00`;

      const bookingData = {
        room_id: selectedRoom.id,
        start_time: startDateTime,
        end_time: endDateTime,
        purpose: data.purpose,
        sks: data.sks,
        class_type: data.class_type,
        equipment_requested: data.equipment_requested || [],
        notes: data.notes,
        attachments: attachments,
        status: 'pending',
        user_info: {
          full_name: data.full_name,
          identity_number: data.identity_number,
          email: data.email,
          phone_number: data.phone_number,
          department_id: data.department_id,
          study_program_id: data.study_program_id,
        },
      };

      const { error } = await supabase
        .from('bookings')
        .insert(bookingData);

      if (error) throw error;

      alert.success(
        getText('Booking request submitted successfully!', 'Permintaan pemesanan berhasil dikirim!'),
        getText('Your booking is pending approval', 'Pemesanan Anda menunggu persetujuan')
      );

      // Reset form
      form.reset();
      setSelectedRoom(null);
      setAttachments([]);
      
      // Refresh room data
      fetchRoomData(targetBookingDate, true);

    } catch (error: any) {
      console.error('Error submitting booking:', error);
      alert.error(
        getText('Failed to submit booking', 'Gagal mengirim pemesanan'),
        error.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading only on initial load
  const showMainLoading = loading && rooms.length === 0;
  const showRefreshIndicator = loading && rooms.length > 0;

  if (showMainLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">{getText('Loading rooms...', 'Memuat ruangan...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Refresh Indicator */}
      {showRefreshIndicator && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{getText('Updating...', 'Memperbarui...')}</span>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            <Calendar className="w-4 h-4 mr-2" />
            {getText('Self Service Lecture', 'Sistem Pelayanan Kuliah')}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {getText('Smart Room Booking', 'Pemesanan Ruangan Cerdas')}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {getText('Reserve your perfect study space', 'Pesan ruang belajar yang sempurna')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel - Room Selection */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Date & Time Selection */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">1</div>
                {getText('Date & Time Selection', 'Pilih Tanggal & Waktu')}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Booking Date', 'Tanggal Pemesanan')} *
                  </label>
                  <input 
                    type="date" 
                    value={targetBookingDate}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                    onChange={(e) => {
                      setTargetBookingDate(e.target.value);
                      setSelectedRoom(null);
                    }}
                    className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                  />
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
                    className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                  />
                  {form.formState.errors.end_time && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.end_time.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: Room Selection */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</div>
                  {getText('Available Rooms', 'Ruangan Tersedia')}
                </h2>
                <div className="text-sm text-gray-500">
                  {memoizedRooms.length} {getText('rooms', 'ruangan')}
                </div>
              </div>

              {/* Filters and Search */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={getText('Search rooms...', 'Cari ruangan...')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">{getText('All Status', 'Semua Status')}</option>
                    <option value="Available">{getText('Available', 'Tersedia')}</option>
                    <option value="Scheduled">{getText('Scheduled', 'Terjadwal')}</option>
                    <option value="In Use">{getText('In Use', 'Sedang Digunakan')}</option>
                  </select>

                  {/* Sort */}
                  <div className="flex items-center space-x-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'capacity' | 'status')}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="name">{getText('Name', 'Nama')}</option>
                      <option value="capacity">{getText('Capacity', 'Kapasitas')}</option>
                      <option value="status">{getText('Status', 'Status')}</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Show In Use Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showInUse"
                    checked={showInUse}
                    onChange={(e) => setShowInUse(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="showInUse" className="text-sm text-gray-700">
                    {getText('Show rooms currently in use', 'Tampilkan ruangan yang sedang digunakan')}
                  </label>
                </div>
              </div>

              {/* Room Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {memoizedRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    isSelected={selectedRoom?.id === room.id}
                    onSelect={handleRoomSelect}
                    onViewSchedule={handleViewSchedule}
                    targetDate={targetBookingDate}
                  />
                ))}
              </div>

              {memoizedRooms.length === 0 && (
                <div className="text-center py-12">
                  <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg font-medium">
                    {getText('No rooms found', 'Tidak ada ruangan ditemukan')}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {getText('Try adjusting your search or filters', 'Coba sesuaikan pencarian atau filter')}
                  </p>
                </div>
              )}
            </div>

            {/* Step 3: Equipment Request */}
            {selectedRoom && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">3</div>
                  {getText('Request Equipment', 'Permintaan Peralatan')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableEquipment.map((equipment) => (
                    <label key={equipment.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        value={equipment.id}
                        {...form.register('equipment_requested')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{equipment.name}</div>
                        <div className="text-sm text-gray-500">{equipment.code} • {equipment.category}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Booking Form */}
          <div className="lg:col-span-5">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 4: Personal Information */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">4</div>
                  {getText('Personal Information', 'Informasi Pribadi')}
                </h2>

                <div className="space-y-4">
                  {/* User Search */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Search by Name or ID', 'Cari berdasarkan Nama atau ID')}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder={getText('Type name or identity number...', 'Ketik nama atau nomor identitas...')}
                        onChange={(e) => searchUsers(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                      {searchingUser && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
                      )}
                    </div>

                    {/* User Search Results */}
                    {showUserDropdown && userSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {userSearchResults.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => selectUser(user)}
                            className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-500">{user.identity_number} • {user.email}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manual Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Full Name', 'Nama Lengkap')} *
                      </label>
                      <input
                        {...form.register('full_name')}
                        type="text"
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                      {form.formState.errors.full_name && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.full_name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Identity Number', 'Nomor Identitas')} *
                      </label>
                      <input
                        {...form.register('identity_number')}
                        type="text"
                        placeholder="NIM/NIP"
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                      {form.formState.errors.identity_number && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.identity_number.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Email', 'Email')} *
                      </label>
                      <input
                        {...form.register('email')}
                        type="email"
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                      {form.formState.errors.email && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Phone Number', 'Nomor Telepon')} *
                      </label>
                      <input
                        {...form.register('phone_number')}
                        type="tel"
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                      {form.formState.errors.phone_number && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.phone_number.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Department and Study Program */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Department', 'Departemen')} *
                      </label>
                      <select
                        {...form.register('department_id')}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      >
                        <option value="">{getText('Select Department', 'Pilih Departemen')}</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                      {form.formState.errors.department_id && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.department_id.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Study Program', 'Program Studi')} *
                      </label>
                      <select
                        {...form.register('study_program_id')}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      >
                        <option value="">{getText('Select Study Program', 'Pilih Program Studi')}</option>
                        {studyPrograms
                          .filter(sp => !form.watch('department_id') || sp.department_id === form.watch('department_id'))
                          .map((sp) => (
                            <option key={sp.id} value={sp.id}>{sp.name} ({sp.code})</option>
                          ))}
                      </select>
                      {form.formState.errors.study_program_id && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.study_program_id.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Booking Details */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Purpose', 'Tujuan')} *
                    </label>
                    <textarea
                      {...form.register('purpose')}
                      rows={3}
                      placeholder={getText('Describe the purpose of your booking...', 'Jelaskan tujuan pemesanan Anda...')}
                      className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    />
                    {form.formState.errors.purpose && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.purpose.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('SKS (Credits)', 'SKS (Kredit)')} *
                      </label>
                      <select
                        {...form.register('sks', { valueAsNumber: true })}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      >
                        {[1, 2, 3, 4, 5, 6].map((sks) => (
                          <option key={sks} value={sks}>{sks} SKS</option>
                        ))}
                      </select>
                    </div>

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
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Additional Notes', 'Catatan Tambahan')}
                    </label>
                    <textarea
                      {...form.register('notes')}
                      rows={2}
                      placeholder={getText('Any additional information...', 'Informasi tambahan...')}
                      className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    />
                  </div>

                  {/* File Attachments */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Attachments', 'Lampiran')} ({getText('Optional', 'Opsional')})
                    </label>
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                        isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {isDragActive
                          ? getText('Drop files here', 'Letakkan file di sini')
                          : getText('Drag & drop files or click to browse', 'Seret & lepas file atau klik untuk memilih')
                        }
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {getText('Supports: Images, PDF (Max 5 files)', 'Mendukung: Gambar, PDF (Maks 5 file)')}
                      </p>
                    </div>

                    {/* Attachment Preview */}
                    {attachments.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {attachments.map((attachment, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-700">
                                {getText('Attachment', 'Lampiran')} {index + 1}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button - MOVED HERE AFTER PERSONAL INFORMATION */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  {/* Late Booking Warning */}
                  {selectedRoom?.todayStatus === 'In Use' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <span className="text-orange-800 font-medium">
                          {getText('Late Booking Warning', 'Peringatan Pemesanan Terlambat')}
                        </span>
                      </div>
                      <p className="text-orange-700 text-sm mt-1">
                        {getText('Current booking will be marked as completed', 'Pemesanan saat ini akan ditandai sebagai selesai')}
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!selectedRoom || submitting}
                    className="w-full flex items-center justify-center space-x-3 py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] disabled:hover:scale-100"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>{getText('Submitting...', 'Mengirim...')}</span>
                      </>
                    ) : (
                      <>
                        <Calendar className="h-5 w-5" />
                        <span>{getText('Submit Booking Request', 'Kirim Permintaan Pemesanan')}</span>
                      </>
                    )}
                  </button>

                  {!selectedRoom && (
                    <p className="text-center text-sm text-gray-500 mt-2">
                      {getText('Please select a room to continue', 'Silakan pilih ruangan untuk melanjutkan')}
                    </p>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Schedule Details Modal */}
      {showScheduleModal && scheduleModalRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {getText('Schedule Details', 'Detail Jadwal')} - {scheduleModalRoom.name}
                </h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Lectures */}
                {scheduleModalRoom.scheduleDetails.lectures.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <GraduationCap className="h-5 w-5 mr-2 text-blue-600" />
                      {getText('Regular Classes', 'Kelas Reguler')}
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.scheduleDetails.lectures.map((lecture, index) => (
                        <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="font-medium text-blue-900">{lecture.course_name}</div>
                          <div className="text-sm text-blue-700">
                            {lecture.course_code} • {lecture.lecturer}
                          </div>
                          <div className="text-sm text-blue-600">
                            {lecture.start_time} - {lecture.end_time} • {lecture.class}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exams */}
                {scheduleModalRoom.scheduleDetails.exams.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-red-600" />
                      {getText('Examinations', 'Ujian')}
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.scheduleDetails.exams.map((exam, index) => (
                        <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="font-medium text-red-900">{exam.course_name}</div>
                          <div className="text-sm text-red-700">
                            {exam.course_code} • {exam.class}
                          </div>
                          <div className="text-sm text-red-600">
                            {exam.start_time} - {exam.end_time} • {exam.student_amount} students
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final Sessions */}
                {scheduleModalRoom.scheduleDetails.sessions.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <Users className="h-5 w-5 mr-2 text-green-600" />
                      {getText('Final Sessions', 'Sidang Akhir')}
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.scheduleDetails.sessions.map((session, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="font-medium text-green-900">{session.title}</div>
                          <div className="text-sm text-green-700">
                            {session.supervisor} • {session.examiner}
                          </div>
                          <div className="text-sm text-green-600">
                            {session.start_time} - {session.end_time}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Future Bookings */}
                {scheduleModalRoom.futureBookings.count > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-purple-600" />
                      {getText('Future Bookings', 'Pemesanan Mendatang')} ({scheduleModalRoom.futureBookings.count})
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.futureBookings.upcoming.slice(0, 5).map((booking, index) => (
                        <div key={index} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="font-medium text-purple-900">{booking.purpose}</div>
                          <div className="text-sm text-purple-700">
                            {booking.user_name} • {booking.user_identity}
                          </div>
                          <div className="text-sm text-purple-600">
                            {booking.relative_date} • {format(parseISO(booking.start_time), 'HH:mm')} - {format(parseISO(booking.end_time), 'HH:mm')}
                          </div>
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
    </div>
  );
};

export default BookRoom;