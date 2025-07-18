import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar, Clock, Users, Building, MapPin, Package, User, Phone, Mail, Hash,
  GraduationCap, ChevronDown, Search, Eye, X, Upload, FileText, Download,
  Loader2, CheckCircle, AlertTriangle, Zap, Star, ArrowRight, Plus, Minus,
  RefreshCw, Filter, Grid, List, SortAsc, SortDesc, MoreHorizontal, Info,
  BookOpen, Award, Target, TrendingUp, Activity, BarChart3, PieChart
} from 'lucide-react';

// Mock functions to replace supabase and other dependencies
const mockSupabase = {
  from: (table) => ({
    select: () => ({
      eq: () => ({
        order: () => ({ data: [], error: null })
      }),
      order: () => ({ data: [], error: null }),
      or: () => ({
        limit: () => Promise.resolve({ data: [], error: null })
      }),
      is: () => ({
        gt: () => ({
          order: () => ({ data: [], error: null })
        })
      }),
      in: () => ({ data: [], error: null })
    }),
    insert: () => ({ error: null }),
    update: () => ({
      eq: () => ({ error: null })
    })
  })
};

const mockAlert = {
  error: (msg) => console.log('Error:', msg),
  success: (msg) => console.log('Success:', msg)
};

const mockGetText = (en, id) => en;

const mockFormat = (date, formatString) => {
  return new Date(date).toLocaleDateString();
};

const mockAddMinutes = (date, minutes) => {
  const newDate = new Date(date);
  newDate.setMinutes(newDate.getMinutes() + minutes);
  return newDate;
};

const mockParseISO = (dateString) => new Date(dateString);

const mockIsAfter = (date1, date2) => new Date(date1) > new Date(date2);

const mockIsBefore = (date1, date2) => new Date(date1) < new Date(date2);

const mockAddDays = (date, days) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

// ========================
// TIMEZONE UTILITY FUNCTIONS
// ========================
const convertLocalToUTC = (localDateTimeString) => {
  const localDate = new Date(localDateTimeString);
  return localDate.toISOString();
};

const convertUTCToLocal = (utcTimeString) => {
  return new Date(utcTimeString);
};

const getLocalDateString = (date = new Date()) => {
  return mockFormat(date, 'yyyy-MM-dd');
};

// Form validation schema
const bookingSchema = z.object({
  // Personal Information
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  study_program_id: z.string().min(1, 'Please select a study program'),

  // Booking Details
  start_datetime: z.string().min(1, 'Start date and time is required'),
  end_datetime: z.string().min(1, 'End date and time is required'),
  purpose: z.enum(['Class/Lecture', 'Other'], { required_error: 'Purpose is required' }),
  sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
  class_type: z.enum(['theory', 'practical']),

  // Equipment & Notes
  equipment_requested: z.array(z.string()).optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  // Validate end_datetime is after start_datetime
  if (data.start_datetime && data.end_datetime) {
    const startDate = new Date(data.start_datetime);
    const endDate = new Date(data.end_datetime);
    
    if (endDate <= startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date and time must be after start date and time",
        path: ["end_datetime"],
      });
    }

    // Validate maksimal 7 hari
    const daysDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDifference > 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Booking duration cannot exceed 7 days",
        path: ["end_datetime"],
      });
    }
  }

  // Validate attachments are required if purpose is 'Other'
  if (data.purpose === 'Other' && (!data.attachments || data.attachments.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Attachments are required when purpose is 'Other'",
      path: ['attachments'],
    });
  }
});

type BookingForm = z.infer<typeof bookingSchema>;

const BookRoom = () => {
  const form = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      start_datetime: mockFormat(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_datetime: mockFormat(mockAddMinutes(new Date(), 120), "yyyy-MM-dd'T'HH:mm"),
      sks: 2,
      class_type: 'theory',
      purpose: 'Class/Lecture',
      equipment_requested: [],
      attachments: [],
    },
  });

  const watchStartDateTime = form.watch('start_datetime');
  const watchEndDateTime = form.watch('end_datetime');
  const watchSks = form.watch('sks');
  const watchClassType = form.watch('class_type');
  const watchPurpose = form.watch('purpose');
  const watchAttachments = form.watch('attachments');

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [studyPrograms, setStudyPrograms] = useState([]);
  const [availableEquipment, setAvailableEquipment] = useState([]);
  const [loading, setLoading] = useState(false);

  const [targetBookingDate, setTargetBookingDate] = useState(mockFormat(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showInUse, setShowInUse] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalRoom, setScheduleModalRoom] = useState(null);

  // Mock room data
  const [rooms] = useState([
    {
      id: '1',
      name: 'Lab Komputer 1',
      code: 'LK-101',
      capacity: 30,
      is_available: true,
      department: { name: 'Teknik Informatika' },
      currentBooking: null,
      targetDateBookings: [],
      scheduleDetails: { lectures: [], exams: [], sessions: [] },
      futureBookings: { count: 0 }
    },
    {
      id: '2',
      name: 'Ruang Kelas A-201',
      code: 'A-201',
      capacity: 40,
      is_available: true,
      department: { name: 'Fakultas Teknik' },
      currentBooking: null,
      targetDateBookings: [],
      scheduleDetails: { lectures: [], exams: [], sessions: [] },
      futureBookings: { count: 1, nextBooking: { date: '2024-01-15', time: '10:00' } }
    },
    {
      id: '3',
      name: 'Lab Fisika',
      code: 'LF-101',
      capacity: 25,
      is_available: false,
      department: { name: 'Fisika' },
      currentBooking: {
        user: { full_name: 'Dr. Ahmad' },
        purpose: 'Praktikum',
        start_time: new Date().toISOString(),
        end_time: mockAddMinutes(new Date(), 60).toISOString()
      },
      targetDateBookings: [],
      scheduleDetails: { lectures: [], exams: [], sessions: [] },
      futureBookings: { count: 0 }
    }
  ]);

  const roomsLoading = false;
  const roomsError = null;

  const identityInputRef = useRef(null);
  const fullNameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const studyProgramDisplayRef = useRef(null);
  const [identitySearchResults, setIdentitySearchResults] = useState([]);
  const [identitySearchLoading, setIdentitySearchLoading] = useState(false);

  const [useManualEndTime, setUseManualEndTime] = useState(false);

  const bookingDuration = useMemo(() => {
    if (!watchStartDateTime || !watchEndDateTime) return null;
    const start = new Date(watchStartDateTime);
    const end = new Date(watchEndDateTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
    const diffMs = end.getTime() - start.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    return { days, hours, minutes, totalHours };
  }, [watchStartDateTime, watchEndDateTime]);

  useEffect(() => {
    if (!useManualEndTime && watchStartDateTime && watchSks > 0 && watchClassType) {
      const duration = watchClassType === 'theory' ? watchSks * 50 : watchSks * 170;
      const startDateTime = new Date(watchStartDateTime);
      if (!isNaN(startDateTime.getTime())) {
        const endDateTime = mockAddMinutes(startDateTime, duration);
        const formattedEndDateTime = mockFormat(endDateTime, "yyyy-MM-dd'T'HH:mm");
        if (form.getValues('end_datetime') !== formattedEndDateTime) {
          form.setValue('end_datetime', formattedEndDateTime);
        }
      }
    }
  }, [watchStartDateTime, watchSks, watchClassType, useManualEndTime, form]);

  // Room status logic
  const getOptimizedRoomStatus = useCallback((room) => {
    if (!room.is_available) {
      return {
        status: 'Unavailable',
        reason: 'Room disabled for booking',
        color: 'bg-gray-100 text-gray-800 border-gray-200'
      };
    }

    const isToday = targetBookingDate === getLocalDateString();
    if (isToday && room.currentBooking) {
      const now = new Date();
      const bookingStart = convertUTCToLocal(room.currentBooking.start_time);
      const bookingEnd = convertUTCToLocal(room.currentBooking.end_time);
      
      if (now >= bookingStart && now <= bookingEnd) {
        return {
          status: 'In Use',
          reason: `Currently in use by ${room.currentBooking.user?.full_name || 'Unknown'}`,
          color: 'bg-red-100 text-red-800 border-red-200',
          detail: room.currentBooking
        };
      }
    }

    const userStartTime = watchStartDateTime ? new Date(watchStartDateTime) : null;
    const userEndTime = watchEndDateTime ? new Date(watchEndDateTime) : null;

    if (userStartTime && userEndTime && room.targetDateBookings?.length > 0) {
      for (const booking of room.targetDateBookings) {
        const existingStart = convertUTCToLocal(booking.start_time);
        const existingEnd = convertUTCToLocal(booking.end_time);
        
        if (userStartTime < existingEnd && userEndTime > existingStart) {
          return {
            status: 'Conflict',
            reason: `Conflicts with schedule at ${booking.start_time_local} - ${booking.end_time_local}`,
            color: 'bg-orange-100 text-orange-800 border-orange-200'
          };
        }
      }
    }
    
    const hasScheduledContent =
      (room.scheduleDetails?.lectures?.length > 0) ||
      (room.scheduleDetails?.exams?.length > 0) ||
      (room.scheduleDetails?.sessions?.length > 0) ||
      (room.targetDateBookings?.length > 0);

    if (hasScheduledContent) {
      return {
        status: 'Scheduled',
        reason: 'Room has scheduled activities',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        scheduleCount: (room.scheduleDetails?.lectures?.length || 0) + 
                       (room.scheduleDetails?.exams?.length || 0) + 
                       (room.scheduleDetails?.sessions?.length || 0) + 
                       (room.targetDateBookings?.length || 0)
      };
    }

    return {
      status: 'Available',
      reason: 'Room is free and available for booking',
      color: 'bg-green-100 text-green-800 border-green-200'
    };
  }, [targetBookingDate, watchStartDateTime, watchEndDateTime]);

  const filteredAndSortedRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.code.toLowerCase().includes(searchTerm.toLowerCase());

      const roomStatus = getOptimizedRoomStatus(room);
      const matchesStatus = filterStatus === 'all' || roomStatus.status === filterStatus;
      const matchesVisibility = roomStatus.status !== 'In Use' || showInUse;

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
          const statusA = getOptimizedRoomStatus(a).status;
          const statusB = getOptimizedRoomStatus(b).status;
          comparison = statusA.localeCompare(statusB);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [rooms, searchTerm, filterStatus, showInUse, sortBy, sortOrder, getOptimizedRoomStatus]);

  const handleRoomSelect = (room) => {
    setSelectedRoom(room);
    // Mock equipment fetch
    setAvailableEquipment([
      { id: '1', name: 'Projector', category: 'Electronics', is_mandatory: true, is_available: true, quantity: 1 },
      { id: '2', name: 'Whiteboard', category: 'Furniture', is_mandatory: false, is_available: true, quantity: 1 },
      { id: '3', name: 'Microphone', category: 'Audio', is_mandatory: false, is_available: true, quantity: 2 }
    ]);
  };

  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (!files) return;
    const currentAttachments = form.getValues('attachments') || [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        form.setValue('attachments', [...currentAttachments, result], { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index) => {
    const currentAttachments = form.getValues('attachments') || [];
    const updatedAttachments = currentAttachments.filter((_, i) => i !== index);
    form.setValue('attachments', updatedAttachments, { shouldValidate: true });
  };

  const onSubmit = async (data) => {
    if (!selectedRoom) {
      mockAlert.error('Please select a room');
      return;
    }
    
    setLoading(true);
    try {
      // Mock submission logic
      console.log('Submitting booking:', data);
      
      setTimeout(() => {
        mockAlert.success('Booking submitted successfully!');
        
        // Reset form
        form.reset({
          start_datetime: mockFormat(new Date(), "yyyy-MM-dd'T'HH:mm"),
          end_datetime: mockFormat(mockAddMinutes(new Date(), 120), "yyyy-MM-dd'T'HH:mm"),
          sks: 2,
          class_type: 'theory',
          purpose: 'Class/Lecture',
          equipment_requested: [],
          attachments: [],
        });
        
        setSelectedRoom(null);
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error submitting booking:', error);
      mockAlert.error('Failed to submit booking');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Smart Room Booking
                </h1>
                <p className="text-gray-600 mt-1">
                  Reserve your perfect study space
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{filteredAndSortedRooms.length}</div>
                <div className="text-sm text-gray-500">
                  Available Rooms
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Room Selection (7/12 width) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Search and Filter Controls */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex flex-col space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search rooms..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-1 sm:flex-none"
                    >
                      <option value="all">All Status</option>
                      <option value="Available">Available</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Conflict">Conflict</option>
                      <option value="In Use">In Use</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-1 sm:flex-none"
                    >
                      <option value="name">Sort by Name</option>
                      <option value="capacity">Sort by Capacity</option>
                      <option value="status">Sort by Status</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    >
                      {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    {roomsLoading && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Updating...</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showInUse"
                    checked={showInUse}
                    onChange={(e) => setShowInUse(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="showInUse" className="text-sm text-gray-700">
                    Show rooms currently in use
                  </label>
                </div>
              </div>
            </div>

            {/* Room Grid */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Available Rooms
                </h2>
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {filteredAndSortedRooms.length} rooms
                </div>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {roomsLoading && filteredAndSortedRooms.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="text-gray-600">Loading rooms...</span>
                    </div>
                  </div>
                ) : filteredAndSortedRooms.length === 0 ? (
                  <div className="text-center py-8">
                    <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No rooms found</p>
                    <p className="text-sm text-gray-500 mt-2">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredAndSortedRooms.map((room) => {
                      const roomStatus = getOptimizedRoomStatus(room);
                      const isSelected = selectedRoom?.id === room.id;
                      return (
                        <div
                          key={room.id}
                          onClick={() => roomStatus.status !== 'Conflict' && roomStatus.status !== 'In Use' && roomStatus.status !== 'Unavailable' && handleRoomSelect(room)}
                          className={`p-4 rounded-xl border-2 transition-all duration-200 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white/50'} ${roomStatus.status === 'Conflict' || roomStatus.status === 'In Use' || roomStatus.status === 'Unavailable' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-md hover:border-blue-300'}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900">{room.name}</h4>
                              <p className="text-sm text-gray-600">{room.code}</p>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${roomStatus.color}`}>
                                {roomStatus.status}
                              </span>
                              {roomStatus.scheduleCount && (
                                <span className="text-xs text-gray-500">
                                  {roomStatus.scheduleCount} activities
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-1">
                                <Users className="h-4 w-4" />
                                <span>{room.capacity} seats</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Building className="h-4 w-4" />
                                <span>{room.department?.name || 'General'}</span>
                              </div>
                            </div>
                            {(roomStatus.status === 'Scheduled' || roomStatus.status === 'In Use' || roomStatus.status === 'Conflict') && (
                              <button
                                type="button"
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
                          
                          {roomStatus.status === 'In Use' && roomStatus.detail && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-sm font-medium text-red-800">
                                Currently in use by: {roomStatus.detail.user?.full_name || 'Unknown User'}
                              </p>
                              <p className="text-xs text-red-600">{roomStatus.detail.purpose || 'Room Booking'}</p>
                              <p className="text-xs text-red-500">
                                {mockFormat(convertUTCToLocal(roomStatus.detail.start_time), 'HH:mm')} - {mockFormat(convertUTCToLocal(roomStatus.detail.end_time), 'HH:mm')}
                              </p>
                            </div>
                          )}
                          
                          {roomStatus.status === 'Conflict' && (
                            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <p className="text-sm font-medium text-orange-800">⚠️ Time Conflict</p>
                              <p className="text-xs text-orange-700 mt-1">{roomStatus.reason}</p>
                            </div>
                          )}
                          
                          {roomStatus.status === 'Scheduled' && roomStatus.scheduleCount && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <p className="text-xs text-yellow-800 font-semibold">
                                📅 Schedule for Today:
                              </p>
                              <p className="text-xs text-yellow-700 mt-1 border-t border-yellow-200 pt-1">
                                Click the eye icon to see all details
                              </p>
                            </div>
                          )}

                          {roomStatus.status === 'Unavailable' && (
                            <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                              <p className="text-xs text-gray-600">🚫 Room disabled for booking</p>
                            </div>
                          )}
                          
                          {room.futureBookings?.count > 0 && roomStatus.status === 'Available' && (
                            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs text-blue-700">
                                🔮 {room.futureBookings.count} future bookings
                              </p>
                              {room.futureBookings.nextBooking && (
                                <p className="text-xs text-blue-600 mt-1">
                                  Next: {room.futureBookings.nextBooking.date} {room.futureBookings.nextBooking.time}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Room Details */}
            {selectedRoom && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <h3 className="text-xl font-bold text-gray-800">Selected Room</h3>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-green-900">{selectedRoom.name}</p>
                      <p className="text-sm text-green-700">{selectedRoom.code}</p>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-green-600">
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{selectedRoom.capacity} seats</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Building className="h-4 w-4" />
                          <span>{selectedRoom.department?.name || 'General'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRoom(null)}
                      className="text-green-600 hover:text-green-800 transition-colors duration-200"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Available Equipment */}
                {availableEquipment.length > 0 && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                      <Zap className="h-5 w-5 mr-2" />
                      Available Equipment in Selected Room
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
                            className="text-blue-600 focus:ring-blue-500 rounded disabled:opacity-70"
                          />
                          <div className="flex-1">
                            <span className={`text-sm font-medium ${equipment.is_mandatory ? 'text-blue-900' : 'text-blue-800'}`}>
                              {equipment.name}
                            </span>
                            <span className="text-xs text-blue-600 ml-2">({equipment.category})</span>
                            {equipment.is_mandatory && (
                              <span className="block text-xs font-bold text-green-600">Mandatory</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Booking Form (5/12 width) */}
          <div className="lg:col-span-5">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 sticky top-24">
              <div className="flex items-center space-x-3 mb-8">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Booking Request
                </h2>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Booking Details Section */}
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</div>
                    <h3 className="text-xl font-bold text-gray-900">Booking Details</h3>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date & Time *
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('start_datetime')}
                        type="datetime-local"
                        min={new Date().toISOString().slice(0, 16)}
                        max={mockFormat(mockAddDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm")}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                    </div>
                    {form.formState.errors.start_datetime && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.start_datetime.message}
                      </p>
                    )}
                    {watchStartDateTime && (
                      <div className="mt-2 text-sm text-gray-600">
                        {mockFormat(new Date(watchStartDateTime), 'EEEE, MMMM d, yyyy \'at\' HH:mm')}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        SKS (Credits) *
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
                        Class Type *
                      </label>
                      <select
                        {...form.register('class_type')}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      >
                        <option value="theory">Theory (50 min/SKS)</option>
                        <option value="practical">Practical (170 min/SKS)</option>
                      </select>
                      {form.formState.errors.class_type && (
                        <p className="mt-1 text-sm text-red-600 font-medium">
                          {form.formState.errors.class_type.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      End Date & Time
                    </label>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!useManualEndTime}
                          onChange={() => setUseManualEndTime(false)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Auto Calculate</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={useManualEndTime}
                          onChange={() => setUseManualEndTime(true)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Manual</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('end_datetime')}
                        type="datetime-local"
                        min={watchStartDateTime}
                        disabled={!useManualEndTime}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm disabled:opacity-60"
                      />
                    </div>
                    {form.formState.errors.end_datetime && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.end_datetime.message}
                      </p>
                    )}
                    {watchEndDateTime && (
                      <div className="mt-2 text-sm text-gray-600">
                        {mockFormat(new Date(watchEndDateTime), 'EEEE, MMMM d, yyyy \'at\' HH:mm')}
                      </div>
                    )}
                  </div>

                  {bookingDuration && (
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <Clock className="h-5 w-5 text-green-600" />
                        <div className="text-sm">
                          <p className="font-semibold text-green-800">Booking Duration:</p>
                          <div className="flex items-center space-x-4 mt-1">
                            {bookingDuration.days > 0 && (
                              <span className="text-green-700">{bookingDuration.days} days</span>
                            )}
                            {bookingDuration.hours > 0 && (
                              <span className="text-green-700">{bookingDuration.hours} hours</span>
                            )}
                            {bookingDuration.minutes > 0 && (
                              <span className="text-green-700">{bookingDuration.minutes} minutes</span>
                            )}
                          </div>
                          <p className="text-xs text-green-600 mt-1">
                            Total: {bookingDuration.totalHours} hours
                            {bookingDuration.days > 0 && ` (${bookingDuration.days} days)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose *</label>
                    <div className="relative">
                      <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        {...form.register('purpose')}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm appearance-none"
                      >
                        <option value="Class/Lecture">Class/Lecture</option>
                        <option value="Other">Other</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    {form.formState.errors.purpose && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.purpose.message}
                      </p>
                    )}
                  </div>

                  {watchPurpose === 'Other' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Additional Notes
                        </label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                          <textarea
                            {...form.register('notes')}
                            rows={2}
                            placeholder="Any additional information or special requests"
                            className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm resize-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Attachments *
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors duration-200">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-2">Upload supporting documents</p>
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
                            Choose Files
                          </label>
                        </div>
                        {watchAttachments && watchAttachments.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {watchAttachments.map((attachment, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3 overflow-hidden">
                                  <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 truncate">
                                    Attachment {index + 1}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAttachment(index)}
                                  className="text-red-600 hover:text-red-800 transition-colors duration-200 flex-shrink-0 ml-2"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {form.formState.errors.attachments && (
                          <p className="mt-1 text-sm text-red-600 font-medium">
                            {form.formState.errors.attachments.message}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Personal Information Section */}
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</div>
                    <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Identity Number (NIM/NIP) *
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('identity_number')}
                        ref={identityInputRef}
                        type="text"
                        placeholder="Enter or search your ID"
                        className="w-full pl-10 pr-10 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        autoComplete="off"
                      />
                      {identitySearchLoading && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
                      )}
                    </div>
                    {form.formState.errors.identity_number && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.identity_number.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('full_name')}
                        ref={fullNameInputRef}
                        type="text"
                        placeholder="Enter your full name"
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                    </div>
                    {form.formState.errors.full_name && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.full_name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('phone_number')}
                        ref={phoneInputRef}
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

                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Study Program *
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        ref={studyProgramDisplayRef}
                        type="text"
                        placeholder="Click or type to select study program"
                        className="w-full pl-10 pr-8 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm cursor-pointer"
                      />
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    {form.formState.errors.study_program_id && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.study_program_id.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Submit Section */}
                <div className="pt-6 border-t border-gray-200/50">
                  {!selectedRoom && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <div className="text-sm text-amber-800">
                          <p className="font-semibold">Room Selection Required</p>
                          <p>Please select a room from the list to continue</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !selectedRoom}
                    className="w-full flex items-center justify-center space-x-3 py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>Submit Booking Request</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {selectedRoom && (() => {
                    const roomStatus = getOptimizedRoomStatus(selectedRoom);
                    if (roomStatus.status === 'Conflict') {
                      return (
                        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
                          <div className="flex items-center space-x-3">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                            <div className="text-sm text-orange-800">
                              <p className="font-semibold">⚠️ Time Conflict Warning</p>
                              <p>The selected time conflicts with an existing schedule.</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (roomStatus.status === 'In Use') {
                      return (
                        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
                          <div className="flex items-center space-x-3">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                            <div className="text-sm text-orange-800">
                              <p className="font-semibold">⚠️ Late Booking Warning</p>
                              <p>Current booking will be marked as completed</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (roomStatus.status === 'Scheduled' && roomStatus.scheduleCount) {
                      return (
                        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                          <div className="flex items-center space-x-3">
                            <Info className="h-5 w-5 text-yellow-600" />
                            <div className="text-sm text-yellow-800">
                              <p className="font-semibold">📅 Room Has Schedule</p>
                              <p>Please check the schedule details before booking to avoid conflicts.</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (roomStatus.status === 'Unavailable') {
                      return (
                        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                          <div className="flex items-center space-x-3">
                            <X className="h-5 w-5 text-gray-600" />
                            <div className="text-sm text-gray-700">
                              <p className="font-semibold">🚫 Room Unavailable</p>
                              <p>This room is currently disabled for booking</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && scheduleModalRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Schedule Details - {scheduleModalRoom.name}
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
                {scheduleModalRoom.targetDateBookings?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-orange-600" />
                      Active Bookings
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.targetDateBookings.map((booking, index) => (
                        <div key={index} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-orange-900 text-lg">
                              {booking.start_time_local || mockFormat(convertUTCToLocal(booking.start_time), 'HH:mm')} - {booking.end_time_local || mockFormat(convertUTCToLocal(booking.end_time), 'HH:mm')}
                            </span>
                            <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                              Booking
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-orange-700">
                              <GraduationCap className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {booking.user?.study_program?.name || 'No Study Program'}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-orange-700">
                              <User className="h-4 w-4 mr-2" />
                              <span>{booking.user?.full_name || 'No User Info'}</span>
                            </div>
                          </div>
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
                      Lecture Schedules
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.scheduleDetails.lectures.map((lecture, index) => (
                        <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-blue-900 text-lg">
                              {lecture.start_time} - {lecture.end_time}
                            </span>
                            <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              Lecture
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-blue-700">
                              <GraduationCap className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {lecture.subject_study || 'No Study Program'}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-blue-700">
                              <BookOpen className="h-4 w-4 mr-2" />
                              <span>{lecture.course_name || 'No Course Name'}</span>
                            </div>
                          </div>
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
                      Final Sessions
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.scheduleDetails.sessions.map((session, index) => (
                        <div key={index} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-purple-900 text-lg">
                              {session.start_time_local || session.start_time} - {session.end_time_local || session.end_time}
                            </span>
                            <span className="bg-purple-200 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                              Session
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-purple-700">
                              <GraduationCap className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {session.student?.study_program?.name || 'No Study Program'}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-purple-700">
                              <User className="h-4 w-4 mr-2" />
                              <span>{session.student?.full_name || 'No Student Info'}</span>
                            </div>
                          </div>
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
                      Exam Schedules
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.scheduleDetails.exams.map((exam, index) => (
                        <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-green-900 text-lg">
                              {exam.start_time} - {exam.end_time}
                            </span>
                            <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              Exam
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-green-700">
                              <GraduationCap className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {exam.class || 'No Class Info'}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-green-700">
                              <BookOpen className="h-4 w-4 mr-2" />
                              <span>{exam.course_name || 'No Exam Name'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Schedule Message */}
                {(!scheduleModalRoom.targetDateBookings?.length && 
                  !scheduleModalRoom.scheduleDetails?.lectures?.length && 
                  !scheduleModalRoom.scheduleDetails?.exams?.length && 
                  !scheduleModalRoom.scheduleDetails?.sessions?.length) && (
                  <div className="text-center py-8">
                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      No Schedule for This Date
                    </h3>
                    <p className="text-gray-500">
                      This room is available for booking on the selected date.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {roomsLoading && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading rooms...</span>
          </div>
        </div>
      )}

      {/* Additional Information Section */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-2xl p-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Info className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                How to Book a Room
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-blue-800">
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                  <div>
                    <div className="font-semibold">Select Room</div>
                    <div className="text-blue-700">Choose from available rooms on the left</div>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                  <div>
                    <div className="font-semibold">Set Schedule</div>
                    <div className="text-blue-700">Choose your date, time, and duration</div>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                  <div>
                    <div className="font-semibold">Fill Details</div>
                    <div className="text-blue-700">Complete your personal information</div>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</div>
                  <div>
                    <div className="font-semibold">Submit</div>
                    <div className="text-blue-700">Send your booking request for approval</div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Important Notes:</h4>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>Bookings are subject to approval by admin</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>Maximum booking duration is 7 days</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>Check room schedules to avoid conflicts</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>Supporting documents required for "Other" purposes</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookRoom;