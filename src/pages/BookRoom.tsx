import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Clock, Users, Building, MapPin, Package, User, Phone, Mail, Hash, GraduationCap, ChevronDown, Search, Eye, X, Upload, FileText, Download, Loader2, CheckCircle, AlertTriangle, Zap, Star, ArrowRight, Plus, Minus, RefreshCw, Filter, Grid, List, SortAsc, SortDesc, MoreHorizontal, Info, BookOpen, Award, Target, TrendingUp, Activity, BarChart3, PieChart, Settings, Bell, HelpCircle, ExternalLink, Copy, Share2, Bookmark, Heart, MessageSquare, ThumbsUp, Flag, Shield, Lock, Unlock, Key, Home, Briefcase, School, Coffee, Wifi, Car, Camera, Music, Video, Headphones, Smartphone, Laptop, Monitor, Printer, Scan as Scanner, Projector, Microscope as Microphone, Speaker, Router, Cable, Battery, Power, Signal, Volume, Copyright as Brightness, Contrast, ZoomIn as Zoom, Maximize, Minimize, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Crop, Edit, Save, Trash2, Archive, FolderOpen, File, FileImage, File as FilePdf, FileSpreadsheet, FileVideo, UploadCloud as CloudUpload, DownloadCloud as CloudDownload, Cloud, Server, Database, HardDrive, Cpu, MemoryStick as Memory, Network, Globe, Link, Anchor, Navigation, Compass, Map, Route, TextSelection as Direction, Locate as Location, Pin, BookMarked as Marker, Flag as FlagIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { alert } from '../components/Alert/AlertHelper';
import { format, addMinutes, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { useRoomData } from '../hooks/useRoomData';
import { useRealTimeRoomUpdates } from '../hooks/useRealTimeRoomUpdates';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

// Form validation schema
const bookingSchema = z.object({
  // Personal Information
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  study_program_id: z.string().min(1, 'Please select a study program'),
  
  // Booking Details
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  purpose: z.string().min(5, 'Purpose must be at least 5 characters'),
  sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
  class_type: z.enum(['theory', 'practical']),
  
  // Equipment & Notes
  equipment_requested: z.array(z.string()).optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    return new Date(data.end_time) > new Date(data.start_time);
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["end_time"],
});

type BookingForm = z.infer<typeof bookingSchema>;

interface User {
  id: string;
  full_name: string;
  identity_number: string;
  email?: string;
  phone_number?: string;
  study_program_id?: string;
  study_program?: {
    id: string;
    name: string;
    code: string;
  };
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
  is_mandatory: boolean;
  is_available: boolean;
}

const BookRoom: React.FC = () => {
  const { getText } = useLanguage();
  
  // Performance monitoring
  usePerformanceMonitor();
  
  // Form management
  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      sks: 2,
      class_type: 'theory',
      equipment_requested: [],
    },
  });

  // Watch form values for auto-calculation
  const watchStartTime = form.watch('start_time');
  const watchSks = form.watch('sks');
  const watchClassType = form.watch('class_type');

  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ✅ FIXED: Only Identity search states (removed study program search states)
  const [identitySearchTerm, setIdentitySearchTerm] = useState('');
  const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
  const [identitySearchResults, setIdentitySearchResults] = useState<User[]>([]);
  const [identitySearchLoading, setIdentitySearchLoading] = useState(false);
  
  // SKS auto-calculation states
  const [useManualEndTime, setUseManualEndTime] = useState(false);
  const [calculatedEndTime, setCalculatedEndTime] = useState<Date | null>(null);
  
  // Room management with performance optimization
  const targetBookingDate = useMemo(() => {
    if (watchStartTime) {
      return format(parseISO(watchStartTime), 'yyyy-MM-dd');
    }
    return format(new Date(), 'yyyy-MM-dd');
  }, [watchStartTime]);
  
  const { rooms, loading: roomsLoading, fetchRoomData } = useRoomData(targetBookingDate);
  useRealTimeRoomUpdates(targetBookingDate);
  
  // Room filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showInUse, setShowInUse] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'capacity' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalRoom, setScheduleModalRoom] = useState<any>(null);

  // Fetch initial data
  useEffect(() => {
    fetchStudyPrograms();
  }, []);

  // Fetch rooms when date changes
  useEffect(() => {
    if (targetBookingDate) {
      fetchRoomData(targetBookingDate);
    }
  }, [targetBookingDate, fetchRoomData]);

  // Auto-calculate end time based on SKS
  useEffect(() => {
    if (!useManualEndTime && watchStartTime && watchSks > 0 && watchClassType) {
      const duration = watchClassType === 'theory' ? watchSks * 50 : watchSks * 170; // minutes
      const startDate = new Date(watchStartTime);
      const endDate = addMinutes(startDate, duration);
      setCalculatedEndTime(endDate);
      
      const formattedEndTime = format(endDate, "yyyy-MM-dd'T'HH:mm");
      form.setValue('end_time', formattedEndTime);
    }
  }, [watchStartTime, watchSks, watchClassType, useManualEndTime, form]);

  // Smart identity search
  const searchUsers = useCallback(async (term: string) => {
    if (term.length < 3) {
      setIdentitySearchResults([]);
      setShowIdentityDropdown(false);
      return;
    }

    setIdentitySearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, full_name, identity_number, email, phone_number, study_program_id,
          study_program:study_programs(id, name, code)
        `)
        .or(`full_name.ilike.%${term}%,identity_number.ilike.%${term}%`)
        .limit(10);

      if (error) throw error;
      setIdentitySearchResults(data || []);
      setShowIdentityDropdown(true);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIdentitySearchLoading(false);
    }
  }, []);

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (identitySearchTerm) {
        searchUsers(identitySearchTerm);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [identitySearchTerm, searchUsers]);

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

  const fetchEquipmentForRoom = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('rooms_id', roomId)
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      setAvailableEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      setAvailableEquipment([]);
    }
  };

  // ✅ FIXED: Simplified identity selection handler
  const handleIdentitySelect = (user: User) => {
    setIdentitySearchTerm(user.identity_number);
    form.setValue('identity_number', user.identity_number);
    form.setValue('full_name', user.full_name);
    form.setValue('phone_number', user.phone_number || '');
    
    // Auto-select study program in standard dropdown
    if (user.study_program_id) {
      form.setValue('study_program_id', user.study_program_id);
    }
    
    setShowIdentityDropdown(false);
  };

  // Handle room selection
  const handleRoomSelect = (room: any) => {
    setSelectedRoom(room);
    fetchEquipmentForRoom(room.id);
    setCurrentStep(3);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setAttachments(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Filter and sort rooms
  const filteredAndSortedRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           room.code.toLowerCase().includes(searchTerm.toLowerCase());
      
      const status = targetBookingDate === format(new Date(), 'yyyy-MM-dd') 
        ? room.todayStatus 
        : room.targetDateStatus;
      
      const matchesStatus = filterStatus === 'all' || status === filterStatus;
      const matchesVisibility = status !== 'In Use' || showInUse;
      
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
          const statusA = targetBookingDate === format(new Date(), 'yyyy-MM-dd') 
            ? a.todayStatus 
            : a.targetDateStatus;
          const statusB = targetBookingDate === format(new Date(), 'yyyy-MM-dd') 
            ? b.todayStatus 
            : b.targetDateStatus;
          comparison = statusA.localeCompare(statusB);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [rooms, searchTerm, filterStatus, showInUse, sortBy, sortOrder, targetBookingDate]);

  // Get room status for display
  const getRoomStatus = (room: any) => {
    const isToday = targetBookingDate === format(new Date(), 'yyyy-MM-dd');
    return isToday ? room.todayStatus : room.targetDateStatus;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Use': return 'bg-red-100 text-red-800 border-red-200';
      case 'Scheduled': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Available': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Handle form submission
  const onSubmit = async (data: BookingForm) => {
    if (!selectedRoom) {
      alert.error(getText('Please select a room', 'Silakan pilih ruangan'));
      return;
    }

    setLoading(true);
    try {
      // Check if room is currently in use and handle late booking
      const roomStatus = getRoomStatus(selectedRoom);
      if (roomStatus === 'In Use' && selectedRoom.currentBooking) {
        // Mark existing booking as completed
        await supabase
          .from('bookings')
          .update({ status: 'completed' })
          .eq('id', selectedRoom.currentBooking.id);
      }

      // Create new booking
      const bookingData = {
        start_time: data.start_time,
        end_time: data.end_time,
        purpose: data.purpose,
        sks: data.sks,
        class_type: data.class_type,
        room_id: selectedRoom.id,
        equipment_requested: data.equipment_requested || [],
        notes: data.notes,
        attachments: attachments,
        status: 'pending',
        user_info: {
          full_name: data.full_name,
          identity_number: data.identity_number,
          phone_number: data.phone_number,
          study_program_id: data.study_program_id,
        },
      };

      const { error } = await supabase
        .from('bookings')
        .insert(bookingData);

      if (error) throw error;

      // Show success message
      const successMessage = roomStatus === 'In Use' 
        ? getText('Late booking submitted successfully! Previous booking marked as completed.', 'Pemesanan terlambat berhasil diajukan! Pemesanan sebelumnya ditandai selesai.')
        : getText('Booking submitted successfully!', 'Pemesanan berhasil diajukan!');
      
      alert.success(successMessage);

      // Reset form
      form.reset();
      setSelectedRoom(null);
      setAttachments([]);
      setCurrentStep(1);
      setIdentitySearchTerm('');
      
      // Refresh room data
      fetchRoomData(targetBookingDate, true);

    } catch (error: any) {
      console.error('Error submitting booking:', error);
      alert.error(error.message || getText('Failed to submit booking', 'Gagal mengajukan pemesanan'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                <Calendar className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              {getText('Smart Room Booking', 'Pemesanan Ruangan Cerdas')}
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              {getText('Reserve your perfect study space', 'Pesan ruang belajar yang sempurna')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-7">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
                {/* Step 1: Personal Information */}
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {getText('Personal Information', 'Informasi Pribadi')}
                    </h3>
                  </div>

                  {/* ✅ FIXED: Identity Number with Smart Search - stopPropagation added */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('identity_number')}
                        type="text"
                        placeholder={getText("Enter or select your ID", "Masukkan atau pilih ID Anda")}
                        value={identitySearchTerm}
                        onChange={(e) => {
                          setIdentitySearchTerm(e.target.value);
                          form.setValue('identity_number', e.target.value);
                          setShowIdentityDropdown(true);
                        }}
                        onFocus={() => setShowIdentityDropdown(true)}
                        className="w-full pl-10 pr-10 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                      {identitySearchLoading && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
                      )}
                    </div>
                    
                    {/* ✅ FIXED: Identity Search Dropdown with stopPropagation */}
                    {showIdentityDropdown && identitySearchResults.length > 0 && (
                      <div 
                        className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                        onClick={(e) => e.stopPropagation()} // ✅ PREVENT overlay click
                      >
                        {identitySearchResults.map((user) => (
                          <div
                            key={user.id}
                            onClick={(e) => {
                              e.stopPropagation(); // ✅ PREVENT overlay click
                              handleIdentitySelect(user);
                            }}
                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150"
                          >
                            <div className="font-semibold text-gray-800">{user.identity_number}</div>
                            <div className="text-sm text-gray-600">{user.full_name}</div>
                            {user.study_program && (
                              <div className="text-xs text-gray-500">{user.study_program.name}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {form.formState.errors.identity_number && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.identity_number.message}
                      </p>
                    )}
                  </div>

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
                        placeholder={getText("Enter your full name", "Masukkan nama lengkap Anda")}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                    </div>
                    {form.formState.errors.full_name && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.full_name.message}
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
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.phone_number.message}
                      </p>
                    )}
                  </div>

                  {/* ✅ FIXED: Study Program - Standard HTML Select */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Study Program', 'Program Studi')} *
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        {...form.register('study_program_id')}
                        className="w-full pl-10 pr-8 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm appearance-none cursor-pointer"
                      >
                        <option value="">
                          {getText('Select Study Program', 'Pilih Program Studi')}
                        </option>
                        {studyPrograms
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((program) => (
                            <option key={program.id} value={program.id}>
                              {program.name} ({program.code})
                            </option>
                          ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    
                    {form.formState.errors.study_program_id && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.study_program_id.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 2: Booking Details */}
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {getText('Booking Details', 'Detail Pemesanan')}
                    </h3>
                  </div>

                  {/* Start Date & Time */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Start Date & Time', 'Tanggal & Waktu Mulai')} *
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('start_time')}
                        type="datetime-local"
                        min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                        max={format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm")}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                    </div>
                    {form.formState.errors.start_time && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.start_time.message}
                      </p>
                    )}
                  </div>

                  {/* SKS and Class Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('SKS (Credits)', 'SKS (Kredit)')} *
                      </label>
                      <select
                        {...form.register('sks', { valueAsNumber: true })}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      >
                        <option value={1}>1 SKS</option>
                        <option value={2}>2 SKS</option>
                        <option value={3}>3 SKS</option>
                        <option value={4}>4 SKS</option>
                        <option value={5}>5 SKS</option>
                        <option value={6}>6 SKS</option>
                      </select>
                      {form.formState.errors.sks && (
                        <p className="mt-1 text-sm text-red-600 font-medium">
                          {form.formState.errors.sks.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {getText('Class Type', 'Tipe Kelas')} *
                      </label>
                      <select
                        {...form.register('class_type')}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      >
                        <option value="theory">{getText('Theory (50 min/SKS)', 'Teori (50 menit/SKS)')}</option>
                        <option value="practical">{getText('Practical (170 min/SKS)', 'Praktik (170 menit/SKS)')}</option>
                      </select>
                      {form.formState.errors.class_type && (
                        <p className="mt-1 text-sm text-red-600 font-medium">
                          {form.formState.errors.class_type.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Duration Calculation Display */}
                  {watchStartTime && watchSks > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <Clock className="h-5 w-5 text-green-600" />
                        <div className="text-sm text-green-800">
                          <p className="font-semibold">
                            {getText('Duration', 'Durasi')}: {watchClassType === 'theory' ? watchSks * 50 : watchSks * 170} {getText('minutes', 'menit')}
                          </p>
                          {calculatedEndTime && (
                            <p>
                              {getText('End Time', 'Waktu Selesai')}: {format(calculatedEndTime, "MMM d, yyyy 'at' HH:mm")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manual vs Auto End Time Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('End Time', 'Waktu Selesai')}
                    </label>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!useManualEndTime}
                          onChange={() => setUseManualEndTime(false)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{getText('Auto Calculate', 'Otomatis')}</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={useManualEndTime}
                          onChange={() => setUseManualEndTime(true)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{getText('Manual', 'Manual')}</span>
                      </label>
                    </div>
                  </div>

                  {/* End Date & Time */}
                  {useManualEndTime ? (
                    <div>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          {...form.register('end_time')}
                          type="datetime-local"
                          min={watchStartTime || format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                          className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        />
                      </div>
                      {form.formState.errors.end_time && (
                        <p className="mt-1 text-sm text-red-600 font-medium">
                          {form.formState.errors.end_time.message}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <Info className="h-5 w-5 text-blue-600" />
                        <div className="text-sm text-blue-800">
                          {calculatedEndTime ? (
                            <span>
                              {getText('Auto-calculated', 'Dihitung otomatis')}: {format(calculatedEndTime, "MMM d, yyyy 'at' HH:mm")}
                            </span>
                          ) : (
                            <span>{getText('End time will be calculated automatically based on SKS', 'Waktu selesai akan dihitung otomatis berdasarkan SKS')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Purpose */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Purpose', 'Tujuan')} *
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <textarea
                        {...form.register('purpose')}
                        rows={3}
                        placeholder={getText("Describe the purpose of your booking", "Jelaskan tujuan pemesanan Anda")}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm resize-none"
                      />
                    </div>
                    {form.formState.errors.purpose && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.purpose.message}
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Additional Notes', 'Catatan Tambahan')}
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <textarea
                        {...form.register('notes')}
                        rows={2}
                        placeholder={getText("Any additional information or special requests", "Informasi tambahan atau permintaan khusus")}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm resize-none"
                      />
                    </div>
                  </div>

                  {/* File Attachments */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Attachments', 'Lampiran')}
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors duration-200">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">
                        {getText('Upload supporting documents', 'Unggah dokumen pendukung')}
                      </p>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors duration-200"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {getText('Choose Files', 'Pilih File')}
                      </label>
                    </div>

                    {/* Attachment Preview */}
                    {attachments.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {attachments.map((attachment, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-5 w-5 text-gray-400" />
                              <span className="text-sm text-gray-700">
                                {getText('Attachment', 'Lampiran')} {index + 1}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="text-red-600 hover:text-red-800 transition-colors duration-200"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-6 border-t border-gray-200/50">
                  <button
                    type="submit"
                    disabled={loading || !selectedRoom}
                    className="w-full flex items-center justify-center space-x-3 py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>{getText('Submitting...', 'Mengirim...')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>{getText('Submit Booking Request', 'Kirim Permintaan Pemesanan')}</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {!selectedRoom && (
                    <p className="mt-2 text-sm text-amber-600 text-center">
                      {getText('Please select a room to continue', 'Silakan pilih ruangan untuk melanjutkan')}
                    </p>
                  )}

                  {/* Late Booking Warning */}
                  {selectedRoom && getRoomStatus(selectedRoom) === 'In Use' && (
                    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <div className="text-sm text-orange-800">
                          <p className="font-semibold">
                            ⚠️ {getText('Late Booking Warning', 'Peringatan Pemesanan Terlambat')}
                          </p>
                          <p>
                            {getText('Current booking will be marked as completed', 'Pemesanan saat ini akan ditandai sebagai selesai')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right Column - Room Selection */}
          <div className="lg:col-span-5">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {getText('Available Rooms', 'Ruangan Tersedia')}
                </h3>
                <div className="text-sm text-gray-600">
                  {filteredAndSortedRooms.length} {getText('rooms', 'ruangan')}
                </div>
              </div>

              {/* Room Search and Filters */}
              <div className="space-y-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={getText("Search rooms...", "Cari ruangan...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="all">{getText('All Status', 'Semua Status')}</option>
                    <option value="Available">{getText('Available', 'Tersedia')}</option>
                    <option value="Scheduled">{getText('Scheduled', 'Terjadwal')}</option>
                    <option value="In Use">{getText('In Use', 'Sedang Digunakan')}</option>
                  </select>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    >
                      {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => fetchRoomData(targetBookingDate, true)}
                      disabled={roomsLoading}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${roomsLoading ? 'animate-spin' : ''}`} />
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

                {/* Sort Controls */}
                <div className="flex items-center space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'capacity' | 'status')}
                    className="px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="name">{getText('Sort by Name', 'Urutkan berdasarkan Nama')}</option>
                    <option value="capacity">{getText('Sort by Capacity', 'Urutkan berdasarkan Kapasitas')}</option>
                    <option value="status">{getText('Sort by Status', 'Urutkan berdasarkan Status')}</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Room Grid */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {roomsLoading && filteredAndSortedRooms.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="text-gray-600">{getText('Loading rooms...', 'Memuat ruangan...')}</span>
                    </div>
                  </div>
                ) : filteredAndSortedRooms.length === 0 ? (
                  <div className="text-center py-8">
                    <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">{getText('No rooms found', 'Tidak ada ruangan ditemukan')}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {getText('Try adjusting your search or filters', 'Coba sesuaikan pencarian atau filter')}
                    </p>
                  </div>
                ) : (
                  filteredAndSortedRooms.map((room) => {
                    const status = getRoomStatus(room);
                    const isSelected = selectedRoom?.id === room.id;
                    
                    return (
                      <div
                        key={room.id}
                        onClick={() => handleRoomSelect(room)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white/50 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-bold text-gray-900">{room.name}</h4>
                            <p className="text-sm text-gray-600">{room.code}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                            {getText(status, status)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4" />
                              <span>{room.capacity} {getText('seats', 'kursi')}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Building className="h-4 w-4" />
                              <span>{room.department?.name || getText('General', 'Umum')}</span>
                            </div>
                          </div>
                          
                          {status === 'Scheduled' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setScheduleModalRoom(room);
                                setShowScheduleModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Current Booking Info */}
                        {status === 'In Use' && room.currentBooking && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm font-medium text-red-800">
                              {getText('Currently in use by', 'Sedang digunakan oleh')}: {room.currentBooking.user?.full_name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-red-600">
                              {room.currentBooking.purpose || 'Room Booking'}
                            </p>
                            <p className="text-xs text-red-500">
                              {format(parseISO(room.currentBooking.start_time), 'HH:mm')} - {format(parseISO(room.currentBooking.end_time), 'HH:mm')}
                            </p>
                          </div>
                        )}

                        {/* Future Bookings Indicator */}
                        {room.futureBookings?.count > 0 && (
                          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-700">
                              🔮 {room.futureBookings.count} {getText('future bookings', 'pemesanan mendatang')}
                            </p>
                            {room.futureBookings.nextBooking && (
                              <p className="text-xs text-blue-600 mt-1">
                                {getText('Next:', 'Selanjutnya:')} {room.futureBookings.nextBooking.date} {room.futureBookings.nextBooking.time}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Equipment Preview */}
                        {room.equipment && room.equipment.length > 0 && (
                          <div className="mt-3 border-t border-gray-200 pt-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <Package className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-600">
                                {getText('Available Equipment', 'Peralatan Tersedia')}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {room.equipment.slice(0, 3).map((eq: string, index: number) => (
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
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected Room Equipment */}
              {selectedRoom && availableEquipment.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                    <Zap className="h-5 w-5 mr-2" />
                    {getText('Available Equipment', 'Peralatan Tersedia')}
                  </h4>
                  <div className="space-y-2">
                    {availableEquipment.map((equipment) => (
                      <label key={equipment.id} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          value={equipment.id}
                          defaultChecked={equipment.is_mandatory}
                          disabled={equipment.is_mandatory}
                          onChange={(e) => {
                            const currentEquipment = form.getValues('equipment_requested') || [];
                            if (e.target.checked) {
                              form.setValue('equipment_requested', [...currentEquipment, equipment.id]);
                            } else {
                              form.setValue('equipment_requested', currentEquipment.filter(id => id !== equipment.id));
                            }
                          }}
                          className="text-green-600 focus:ring-green-500 rounded disabled:opacity-70"
                        />
                        <div className="flex-1">
                          <span className={`text-sm font-medium ${equipment.is_mandatory ? 'text-green-900' : 'text-green-800'}`}>
                            {equipment.name}
                          </span>
                          <span className="text-xs text-green-600 ml-2">({equipment.category})</span>
                          {equipment.is_mandatory && (
                            <span className="block text-xs font-bold text-blue-600">
                              {getText('Mandatory', 'Wajib')}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Details Modal */}
      {showScheduleModal && scheduleModalRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
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
                {/* Active Bookings */}
                {scheduleModalRoom.scheduleDetails?.bookings?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-orange-600" />
                      {getText('Active Bookings', 'Pemesanan Aktif')}
                    </h4>
                    <div className="space-y-2">
                      {scheduleModalRoom.scheduleDetails.bookings.map((booking: any, index: number) => (
                        <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="font-medium text-orange-900">{booking.purpose}</p>
                          <p className="text-sm text-orange-700">{booking.user?.full_name} • {booking.user?.identity_number}</p>
                          <p className="text-xs text-orange-600">
                            {booking.start_time} - {booking.end_time}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lecture Schedules */}
                {scheduleModalRoom.scheduleDetails?.lectures?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <BookOpen className="h-5 w-5 mr-2 text-blue-600" />
                      {getText('Lecture Schedules', 'Jadwal Kuliah')}
                    </h4>
                    <div className="space-y-2">
                      {scheduleModalRoom.scheduleDetails.lectures.map((lecture: any, index: number) => (
                        <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="font-medium text-blue-900">{lecture.course_name}</p>
                          <p className="text-sm text-blue-700">{lecture.class} • {lecture.subject_study}</p>
                          <p className="text-xs text-blue-600">
                            {lecture.start_time} - {lecture.end_time}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exam Schedules */}
                {scheduleModalRoom.scheduleDetails?.exams?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <GraduationCap className="h-5 w-5 mr-2 text-green-600" />
                      {getText('Exam Schedules', 'Jadwal Ujian')}
                    </h4>
                    <div className="space-y-2">
                      {scheduleModalRoom.scheduleDetails.exams.map((exam: any, index: number) => (
                        <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="font-medium text-green-900">{exam.course_name}</p>
                          <p className="text-sm text-green-700">{exam.course_code} • {getText('Class:', 'Kelas:')} {exam.class}</p>
                          <p className="text-xs text-green-600">
                            {exam.start_time} - {exam.end_time} • {exam.student_amount} {getText('students', 'mahasiswa')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final Sessions */}
                {scheduleModalRoom.scheduleDetails?.sessions?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Users className="h-5 w-5 mr-2 text-purple-600" />
                      {getText('Final Sessions', 'Sidang Akhir')}
                    </h4>
                    <div className="space-y-2">
                      {scheduleModalRoom.scheduleDetails.sessions.map((session: any, index: number) => (
                        <div key={index} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="font-medium text-purple-900">{session.title}</p>
                          <p className="text-sm text-purple-700">{session.supervisor} • {session.examiner}</p>
                          <p className="text-xs text-purple-600">
                            {session.start_time} - {session.end_time}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Schedules */}
                {(!scheduleModalRoom.scheduleDetails?.bookings?.length && 
                  !scheduleModalRoom.scheduleDetails?.lectures?.length && 
                  !scheduleModalRoom.scheduleDetails?.exams?.length && 
                  !scheduleModalRoom.scheduleDetails?.sessions?.length) && (
                  <div className="text-center py-8">
                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {getText('No Schedule Today', 'Tidak Ada Jadwal Hari Ini')}
                    </h3>
                    <p className="text-gray-500">
                      {getText('This room is available for booking today.', 'Ruangan ini tersedia untuk dipesan hari ini.')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Loading Refresh Indicator */}
      {roomsLoading && filteredAndSortedRooms.length > 0 && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{getText('Updating rooms...', 'Memperbarui ruangan...')}</span>
          </div>
        </div>
      )}

      {/* Success/Error Toast Container - if not using external toast library */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2" id="toast-container">
        {/* Dynamic toasts will be inserted here */}
      </div>

      {/* ✅ FIXED: Simplified Click Outside Handler - Only for Identity Dropdown */}
      {showIdentityDropdown && (
        <div
          className="fixed inset-0 z-30"  // ✅ CHANGED from z-40 to z-30
          onClick={() => setShowIdentityDropdown(false)}
        />
      )}

      {/* Quick Action Buttons - Optional Enhancement */}
      <div className="fixed bottom-6 left-6 z-40">
        <div className="flex flex-col space-y-2">
          {/* Refresh All Data */}
          <button
            onClick={() => {
              fetchRoomData(targetBookingDate, true);
              fetchStudyPrograms();
            }}
            disabled={roomsLoading}
            className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
            title={getText('Refresh All Data', 'Segarkan Semua Data')}
          >
            <RefreshCw className={`h-5 w-5 ${roomsLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Back to Top */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="p-3 bg-gray-600 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors duration-200"
            title={getText('Back to Top', 'Kembali ke Atas')}
          >
            <ArrowRight className="h-5 w-5 rotate-[-90deg]" />
          </button>

          {/* Help/Info */}
          <button
            onClick={() => {
              alert.info(
                getText(
                  'Smart Room Booking Help:\n\n1. Fill personal information\n2. Set booking date & time\n3. Select available room\n4. Choose equipment if needed\n5. Submit your request\n\nYour booking will be pending approval by admin.',
                  'Bantuan Pemesanan Ruangan:\n\n1. Isi informasi pribadi\n2. Atur tanggal & waktu pemesanan\n3. Pilih ruangan yang tersedia\n4. Pilih peralatan jika diperlukan\n5. Kirim permintaan Anda\n\nPemesanan akan menunggu persetujuan admin.'
                )
              );
            }}
            className="p-3 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors duration-200"
            title={getText('Help', 'Bantuan')}
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Info - Hidden by default */}
      <div className="fixed bottom-6 right-6 z-40 opacity-0 hover:opacity-100 transition-opacity duration-300">
        <div className="bg-black/80 text-white text-xs p-3 rounded-lg max-w-xs">
          <h4 className="font-semibold mb-2">{getText('Keyboard Shortcuts', 'Pintasan Keyboard')}</h4>
          <div className="space-y-1">
            <p><kbd className="bg-white/20 px-1 rounded">Ctrl + R</kbd> - {getText('Refresh data', 'Segarkan data')}</p>
            <p><kbd className="bg-white/20 px-1 rounded">Esc</kbd> - {getText('Close modals', 'Tutup modal')}</p>
            <p><kbd className="bg-white/20 px-1 rounded">Tab</kbd> - {getText('Navigate form', 'Navigasi form')}</p>
          </div>
        </div>
      </div>

      {/* Accessibility Announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {roomsLoading && getText('Loading room data', 'Memuat data ruangan')}
        {selectedRoom && getText(`Room ${selectedRoom.name} selected`, `Ruangan ${selectedRoom.name} dipilih`)}
        {loading && getText('Submitting booking request', 'Mengirim permintaan pemesanan')}
      </div>

      {/* Performance Metrics - Development Only */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 left-4 z-50 bg-black/80 text-white text-xs p-2 rounded">
          <div>Rooms: {rooms.length}</div>
          <div>Filtered: {filteredAndSortedRooms.length}</div>
          <div>Loading: {roomsLoading ? 'Yes' : 'No'}</div>
          <div>Selected: {selectedRoom ? selectedRoom.name : 'None'}</div>
        </div>
      )}
    </div>
  );
};

export default BookRoom;