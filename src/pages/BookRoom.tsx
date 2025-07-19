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
import { supabase } from '../lib/supabase';
import { enUS, id } from 'date-fns/locale';
import { alert } from '../components/Alert/AlertHelper';
import { format, addMinutes, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { useRoomData } from '../hooks/useRoomData';
import { useRealTimeRoomUpdates } from '../hooks/useRealTimeRoomUpdates';
import { useLanguage } from '../contexts/LanguageContext';

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
  return format(date, 'yyyy-MM-dd');
};

// Form validation schema dengan datetime yang direvisi
const bookingSchema = z.object({
  // Personal Information
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  study_program_id: z.string().min(1, 'Please select a study program'),

  // Booking Details - REVISED: Combined datetime fields
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
  quantity: number;
}

const BookRoom = () => {
  const { getText } = useLanguage();
  
  const form = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      start_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_datetime: format(addMinutes(new Date(), 120), "yyyy-MM-dd'T'HH:mm"),
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

  const [targetBookingDate, setTargetBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showInUse, setShowInUse] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalRoom, setScheduleModalRoom] = useState(null);

  const { rooms, loading: roomsLoading, error: roomsError, fetchRoomData } = useRoomData(targetBookingDate);
  
  useRealTimeRoomUpdates(targetBookingDate);

  useEffect(() => {
    fetchRoomData(targetBookingDate, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (watchStartDateTime) {
      const newDate = format(parseISO(watchStartDateTime), 'yyyy-MM-dd');
      if (newDate !== targetBookingDate) {
        setTargetBookingDate(newDate);
        if (selectedRoom) {
          setSelectedRoom(null);
          setAvailableEquipment([]);
        }
        fetchRoomData(newDate);
      }
    }
  }, [watchStartDateTime, targetBookingDate, selectedRoom, fetchRoomData]);

  useEffect(() => {
    if (!useManualEndTime && watchStartDateTime && watchSks > 0 && watchClassType) {
      const duration = watchClassType === 'theory' ? watchSks * 50 : watchSks * 170;
      const startDateTime = new Date(watchStartDateTime);
      if (!isNaN(startDateTime.getTime())) {
        const endDateTime = addMinutes(startDateTime, duration);
        const formattedEndDateTime = format(endDateTime, "yyyy-MM-dd'T'HH:mm");
        if (form.getValues('end_datetime') !== formattedEndDateTime) {
          form.setValue('end_datetime', formattedEndDateTime);
        }
      }
    }
  }, [watchStartDateTime, watchSks, watchClassType, useManualEndTime, form]);

  // 🎯 FIXED: Logika status ruangan dengan timezone yang benar
  const getOptimizedRoomStatus = useCallback((room) => {
    // 1. Cek apakah ruangan dinonaktifkan
    if (!room.is_available) {
      return {
        status: 'Unavailable',
        reason: 'Ruangan dinonaktifkan untuk pemesanan',
        color: 'bg-gray-100 text-gray-800 border-gray-200'
      };
    }

    // 2. Cek apakah sedang digunakan TEPAT SAAT INI (timezone aware)
    const isToday = targetBookingDate === getLocalDateString();
    if (isToday && room.currentBooking) {
      const now = new Date();
      const bookingStart = convertUTCToLocal(room.currentBooking.start_time);
      const bookingEnd = convertUTCToLocal(room.currentBooking.end_time);
      
      if (now >= bookingStart && now <= bookingEnd) {
        return {
          status: 'In Use',
          reason: `Sedang digunakan oleh ${room.currentBooking.user?.full_name || 'Tidak diketahui'}`,
          color: 'bg-red-100 text-red-800 border-red-200',
          detail: room.currentBooking
        };
      }
    }

    // 3. Cek KONFLIK dengan user input time (timezone aware)
    const userStartTime = watchStartDateTime ? new Date(watchStartDateTime) : null;
    const userEndTime = watchEndDateTime ? new Date(watchEndDateTime) : null;

    if (userStartTime && userEndTime && room.targetDateBookings?.length > 0) {
      for (const booking of room.targetDateBookings) {
        const existingStart = convertUTCToLocal(booking.start_time);
        const existingEnd = convertUTCToLocal(booking.end_time);
        
        // Kondisi tumpang tindih dengan timezone yang benar
        if (userStartTime < existingEnd && userEndTime > existingStart) {
          return {
            status: 'Conflict',
            reason: `Bertabrakan dengan jadwal pukul ${booking.start_time_local} - ${booking.end_time_local}`,
            color: 'bg-orange-100 text-orange-800 border-orange-200'
          };
        }
      }
    }
    
    // 4. Cek apakah ada jadwal LAINNYA di hari itu
    const hasScheduledContent =
      (room.scheduleDetails?.lectures?.length > 0) ||
      (room.scheduleDetails?.exams?.length > 0) ||
      (room.scheduleDetails?.sessions?.length > 0) ||
      (room.targetDateBookings?.length > 0);

    if (hasScheduledContent) {
      return {
        status: 'Scheduled',
        reason: 'Ruangan memiliki aktivitas terjadwal',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        scheduleCount: (room.scheduleDetails?.lectures?.length || 0) + 
                       (room.scheduleDetails?.exams?.length || 0) + 
                       (room.scheduleDetails?.sessions?.length || 0) + 
                       (room.targetDateBookings?.length || 0)
      };
    }

    // 5. Jika lolos semua, berarti tersedia
    return {
      status: 'Available',
      reason: 'Ruangan bebas dan tersedia untuk dipesan',
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

  const showIdentityDropdown = useCallback((searchTerm) => {
    if (!searchTerm.trim()) {
      hideIdentityDropdown();
      return;
    }
    setIdentitySearchLoading(true);
    supabase
      .from('users')
      .select(`id, full_name, identity_number, email, phone_number, study_program_id, study_program:study_programs(id, name, code)`)
      .or(`full_name.ilike.%${searchTerm}%,identity_number.ilike.%${searchTerm}%`)
      .limit(10)
      .then(({ data, error }) => {
        setIdentitySearchLoading(false);
        if (error) {
          console.error('Error searching users:', error);
          hideIdentityDropdown();
          return;
        }
        const filteredUsers = data || [];
        if (filteredUsers.length === 0) {
          hideIdentityDropdown();
          return;
        }
        const dropdownHTML = `<div class="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">${filteredUsers.map(user => `<div class="identity-dropdown-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150" data-user-id="${user.id}" data-user-nim="${user.identity_number}" data-user-name="${user.full_name}" data-user-email="${user.email || ''}" data-user-phone="${user.phone_number || ''}" data-program-id="${user.study_program_id || ''}"><div class="font-semibold text-gray-800">${user.identity_number}</div><div class="text-sm text-gray-600">${user.full_name}</div>${user.study_program ? `<div class="text-xs text-gray-500">${user.study_program.name}</div>` : ''}</div>`).join('')}</div>`;
        const dropdownContainer = document.querySelector('#identity-dropdown');
        if (dropdownContainer) {
          dropdownContainer.innerHTML = dropdownHTML;
          dropdownContainer.style.display = 'block';
          dropdownContainer.querySelectorAll('.identity-dropdown-item').forEach(item => {
            item.addEventListener('mousedown', (e) => e.preventDefault());
            item.addEventListener('click', (e) => {
              const target = e.currentTarget;
              const userNim = target.dataset.userNim;
              const userName = target.dataset.userName;
              const userPhone = target.dataset.userPhone;
              const programId = target.dataset.programId;
              if (identityInputRef.current) identityInputRef.current.value = userNim || '';
              if (fullNameInputRef.current) fullNameInputRef.current.value = userName || '';
              if (phoneInputRef.current) phoneInputRef.current.value = userPhone || '';
              form.setValue('identity_number', userNim || '');
              form.setValue('full_name', userName || '');
              form.setValue('phone_number', userPhone || '');
              if (programId) {
                form.setValue('study_program_id', programId);
                const program = studyPrograms.find(p => p.id === programId);
                if (program && studyProgramDisplayRef.current) {
                  studyProgramDisplayRef.current.value = `${program.name} (${program.code})`;
                }
              }
              hideIdentityDropdown();
              identityInputRef.current?.focus();
            });
          });
        }
      });
  }, [form, studyPrograms]);

  const hideIdentityDropdown = useCallback(() => {
    const dropdownContainer = document.querySelector('#identity-dropdown');
    if (dropdownContainer) {
      dropdownContainer.style.display = 'none';
    }
  }, []);

  const showStudyProgramDropdown = useCallback(() => {
    const dropdownHTML = `<div class="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden"><div class="p-3 border-b border-gray-100"><input type="text" placeholder="${getText("Search programs...", "Cari program studi...")}" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" id="program-search-input" autocomplete="off"/></div><div class="max-h-60 overflow-y-auto" id="program-list">${studyPrograms.map(program => `<div class="program-dropdown-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150" data-program-id="${program.id}" data-program-name="${program.name}" data-program-code="${program.code || ''}"><div class="font-semibold text-gray-800">${program.name} (${program.code || ''})</div></div>`).join('')}</div></div>`;
    const dropdownContainer = document.querySelector('#study-program-dropdown');
    if (dropdownContainer) {
      dropdownContainer.innerHTML = dropdownHTML;
      dropdownContainer.style.display = 'block';
      const searchInput = dropdownContainer.querySelector('#program-search-input');
      const programList = dropdownContainer.querySelector('#program-list');
      if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', (e) => {
          const searchTerm = e.target.value.toLowerCase();
          const filteredPrograms = studyPrograms.filter(p => p.name.toLowerCase().includes(searchTerm) || (p.code && p.code.toLowerCase().includes(searchTerm)));
          if (programList) {
            programList.innerHTML = filteredPrograms.map(program => `<div class="program-dropdown-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150" data-program-id="${program.id}" data-program-name="${program.name}" data-program-code="${program.code || ''}"><div class="font-semibold text-gray-800">${program.name} (${program.code || ''})</div></div>`).join('');
            addStudyProgramListeners();
          }
        });
      }
      addStudyProgramListeners();
    }
  }, [getText, studyPrograms]);

  const addStudyProgramListeners = useCallback(() => {
    document.querySelectorAll('.program-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const programId = target.dataset.programId;
        const programName = target.dataset.programName;
        const programCode = target.dataset.programCode;
        if (studyProgramDisplayRef.current) {
          studyProgramDisplayRef.current.value = `${programName} (${programCode})`;
        }
        form.setValue('study_program_id', programId || '', { shouldValidate: true });
        hideStudyProgramDropdown();
      });
    });
  }, [form]);

  const hideStudyProgramDropdown = useCallback(() => {
    const dropdownContainer = document.querySelector('#study-program-dropdown');
    if (dropdownContainer) {
      dropdownContainer.style.display = 'none';
    }
  }, []);

  const fetchStudyPrograms = async () => {
    try {
      const { data, error } = await supabase.from('study_programs').select('*').order('name');
      if (error) throw error;
      setStudyPrograms(data || []);
    } catch (error) {
      console.error('Error fetching study programs:', error);
    }
  };

  const fetchEquipmentForRoom = async (roomId) => {
    try {
      const { data, error } = await supabase.from('equipment').select('*').or(`rooms_id.eq.${roomId},rooms_id.is.null`).or('is_mandatory.eq.true,quantity.gt.1').order('name');
      if (error) throw error;
      setAvailableEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      setAvailableEquipment([]);
    }
  };

  const handleRoomSelect = (room) => {
    setSelectedRoom(room);
    fetchEquipmentForRoom(room.id);
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

  useEffect(() => {
    fetchStudyPrograms();
  }, []);

  // 🎯 FIXED: Submit function dengan timezone yang benar
  const onSubmit = async (data) => {
    if (!selectedRoom) {
      alert.error(getText('Please select a room', 'Silakan pilih ruangan'));
      return;
    }
    
    setLoading(true);
    try {
      const roomStatus = getOptimizedRoomStatus(selectedRoom);
      if (roomStatus.status === 'In Use' && selectedRoom.currentBooking) {
        await supabase.from('bookings').update({ status: 'completed' }).eq('id', selectedRoom.currentBooking.id);
      }

      // ✅ FIX: Explicit timezone untuk Indonesia (WIB/UTC+7)
      const startTimeUTC = new Date(data.start_datetime + '+07:00').toISOString();
      const endTimeUTC = new Date(data.end_datetime + '+07:00').toISOString();

      console.log('🕐 Input:', data.start_datetime);
      console.log('🕐 UTC:', startTimeUTC);

      const bookingData = {
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        purpose: data.purpose,
        sks: data.sks,
        class_type: data.class_type,
        room_id: selectedRoom.id,
        equipment_requested: data.equipment_requested || [],
        notes: data.notes,
        attachments: data.attachments || [],
        status: 'pending',
        user_info: {
          full_name: data.full_name,
          identity_number: data.identity_number,
          phone_number: data.phone_number,
          study_program_id: data.study_program_id,
        },
      };

      const { error } = await supabase.from('bookings').insert(bookingData);
      if (error) throw error;

      const successMessage = roomStatus.status === 'In Use' 
        ? getText('Late booking submitted successfully! Previous booking marked as completed.', 'Pemesanan terlambat berhasil diajukan! Pemesanan sebelumnya ditandai selesai.') 
        : getText('Booking submitted successfully!', 'Pemesanan berhasil diajukan!');
        
      alert.success(successMessage);

      // Reset form
      form.reset({
        start_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        end_datetime: format(addMinutes(new Date(), 120), "yyyy-MM-dd'T'HH:mm"),
        sks: 2,
        class_type: 'theory',
        purpose: 'Class/Lecture',
        equipment_requested: [],
        attachments: [],
      });
      
      setSelectedRoom(null);
      if (identityInputRef.current) identityInputRef.current.value = '';
      if (fullNameInputRef.current) fullNameInputRef.current.value = '';
      if (phoneInputRef.current) phoneInputRef.current.value = '';
      if (studyProgramDisplayRef.current) studyProgramDisplayRef.current.value = '';
      fetchRoomData(targetBookingDate, true);
      
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert.error(error.message || getText('Failed to submit booking', 'Gagal mengajukan pemesanan'));
    } finally {
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
                  {getText('Smart Room Booking', 'Pemesanan Ruangan Cerdas')}
                </h1>
                <p className="text-gray-600 mt-1">
                  {getText('Reserve your perfect study space', 'Pesan ruang belajar yang sempurna')}
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{filteredAndSortedRooms.length}</div>
                <div className="text-sm text-gray-500">
                  {getText('Available Rooms', 'Ruangan Tersedia')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* MAIN CONTENT - Desktop: 2 kolom, Mobile: 1 kolom */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* LEFT COLUMN - BOOKING DETAILS & ROOM SELECTION */}
            <div className="space-y-8">
              
              {/* 1. BOOKING DETAILS SECTION */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {getText('Booking Details', 'Detail Pemesanan')}
                  </h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Start Date & Time', 'Tanggal & Waktu Mulai')} *
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('start_datetime')}
                        type="datetime-local"
                        min={new Date().toISOString().slice(0, 16)}
                        max={format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm")}
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
                        {format(parseISO(watchStartDateTime), 'EEEE, MMMM d, yyyy \'at\' HH:mm', { locale: enUS })}
                      </div>
                    )}
                  </div>

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

                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('End Date & Time', 'Tanggal & Waktu Selesai')}
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
                        {format(parseISO(watchEndDateTime), 'EEEE, MMMM d, yyyy \'at\' HH:mm', { locale: enUS })}
                      </div>
                    )}
                  </div>

                  {bookingDuration && (
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <Clock className="h-5 w-5 text-green-600" />
                        <div className="text-sm">
                          <p className="font-semibold text-green-800">{getText('Booking Duration', 'Durasi Pemesanan')}:</p>
                          <div className="flex items-center space-x-4 mt-1">
                            {bookingDuration.days > 0 && (
                              <span className="text-green-700">{bookingDuration.days} {getText('days', 'hari')}</span>
                            )}
                            {bookingDuration.hours > 0 && (
                              <span className="text-green-700">{bookingDuration.hours} {getText('hours', 'jam')}</span>
                            )}
                            {bookingDuration.minutes > 0 && (
                              <span className="text-green-700">{bookingDuration.minutes} {getText('minutes', 'menit')}</span>
                            )}
                          </div>
                          <p className="text-xs text-green-600 mt-1">
                            {getText('Total', 'Total')}: {bookingDuration.totalHours} {getText('hours', 'jam')}
                            {bookingDuration.days > 0 && ` (${bookingDuration.days} ${getText('days', 'hari')})`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Purpose', 'Tujuan')} *
                    </label>
                    <div className="relative">
                      <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        {...form.register('purpose')}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm appearance-none"
                      >
                        <option value="Class/Lecture">{getText('Class/Lecture', 'Kuliah')}</option>
                        <option value="Other">{getText('Other', 'Lainnya')}</option>
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
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {getText('Attachments', 'Lampiran')} *
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors duration-200">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-2">{getText('Upload supporting documents', 'Unggah dokumen pendukung')}</p>
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
                        {watchAttachments && watchAttachments.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {watchAttachments.map((attachment, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3 overflow-hidden">
                                  <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-700 truncate">
                                    {getText('Attachment', 'Lampiran')} {index + 1}
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
              </div>

              {/* 2. ROOM SELECTION SECTION */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                    <Building className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {getText('Room Selection', 'Pilih Ruangan')}
                  </h2>
                </div>

                {/* Selected Room Display */}
                {selectedRoom ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-green-800 flex items-center">
                          <CheckCircle className="h-5 w-5 mr-2" />
                          {getText('Selected Room', 'Ruangan Terpilih')}
                        </h4>
                        <div className="mt-2">
                          <p className="font-bold text-green-900">{selectedRoom.name}</p>
                          <p className="text-sm text-green-700">{selectedRoom.code}</p>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-green-600">
                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4" />
                              <span>{selectedRoom.capacity} {getText('seats', 'kursi')}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Building className="h-4 w-4" />
                              <span>{selectedRoom.department?.name || getText('General', 'Umum')}</span>
                            </div>
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
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <div className="text-sm text-amber-800">
                        <p className="font-semibold">{getText('Room Selection Required', 'Pilih Ruangan Diperlukan')}</p>
                        <p>{getText('Please select a room from the list below to continue', 'Silakan pilih ruangan dari daftar di bawah untuk melanjutkan')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Search and Filter Controls */}
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
                  
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-1 sm:flex-none"
                      >
                        <option value="all">{getText('All Status', 'Semua Status')}</option>
                        <option value="Available">{getText('Available', 'Tersedia')}</option>
                        <option value="Scheduled">{getText('Scheduled', 'Terjadwal')}</option>
                        <option value="Conflict">{getText('Conflict', 'Konflik')}</option>
                        <option value="In Use">{getText('In Use', 'Sedang Digunakan')}</option>
                      </select>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex-1 sm:flex-none"
                      >
                        <option value="name">{getText('Sort by Name', 'Urutkan berdasarkan Nama')}</option>
                        <option value="capacity">{getText('Sort by Capacity', 'Urutkan berdasarkan Kapasitas')}</option>
                        <option value="status">{getText('Sort by Status', 'Urutkan berdasarkan Status')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                      >
                        {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      {roomsLoading && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{getText('Updating...', 'Memperbarui...')}</span>
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
                      {getText('Show rooms currently in use', 'Tampilkan ruangan yang sedang digunakan')}
                    </label>
                  </div>
                </div>

                {/* Room List */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
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
                      <p className="text-sm text-gray-500 mt-2">{getText('Try adjusting your search or filters', 'Coba sesuaikan pencarian atau filter')}</p>
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
                                  {getText(roomStatus.status, roomStatus.status)}
                                </span>
                                {roomStatus.scheduleCount && (
                                  <span className="text-xs text-gray-500">
                                    {roomStatus.scheduleCount} {getText('activities', 'aktivitas')}
                                  </span>
                                )}
                              </div>
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
                            
                            {/* Room Status Details */}
                            {roomStatus.status === 'In Use' && roomStatus.detail && (
                              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm font-medium text-red-800">
                                  {getText('Currently in use by', 'Sedang digunakan oleh')}: {roomStatus.detail.user?.full_name || 'Unknown User'}
                                </p>
                                <p className="text-xs text-red-600">{roomStatus.detail.purpose || 'Room Booking'}</p>
                                <p className="text-xs text-red-500">
                                  {roomStatus.detail.start_time_local || format(convertUTCToLocal(roomStatus.detail.start_time), 'HH:mm')} - {roomStatus.detail.end_time_local || format(convertUTCToLocal(roomStatus.detail.end_time), 'HH:mm')}
                                </p>
                              </div>
                            )}
                            
                            {roomStatus.status === 'Conflict' && (
                              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                <p className="text-sm font-medium text-orange-800">⚠️ {getText('Time Conflict', 'Konflik Waktu')}</p>
                                <p className="text-xs text-orange-700 mt-1">{roomStatus.reason}</p>
                              </div>
                            )}
                            
                            {roomStatus.status === 'Scheduled' && roomStatus.scheduleCount && (
                              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                                <p className="text-xs text-yellow-800 font-semibold">
                                  📅 {getText('Jadwal di Hari Ini:', 'Jadwal di Hari Ini:')}
                                </p>
                                {room.targetDateBookings && room.targetDateBookings.length > 0 && (
                                  <div className="space-y-1 max-h-20 overflow-y-auto">
                                    {room.targetDateBookings.map((booking, index) => (
                                      <div key={index} className="text-xs text-yellow-900 border-t border-yellow-200 pt-1 first:pt-0 first:border-t-0">
                                        <p className="font-medium truncate">{booking.purpose}</p>
                                        <p>
                                          {booking.start_time_local || format(convertUTCToLocal(booking.start_time), 'HH:mm')} - {booking.end_time_local || format(convertUTCToLocal(booking.end_time), 'HH:mm')}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <p className="text-xs text-yellow-700 mt-1 border-t border-yellow-200 pt-1">
                                  {getText('Klik ikon mata untuk lihat semua detail', 'Klik ikon mata untuk lihat semua detail')}
                                </p>
                              </div>
                            )}

                            {roomStatus.status === 'Unavailable' && (
                              <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-xs text-gray-600">🚫 {getText('Room disabled for booking', 'Ruangan dinonaktifkan untuk pemesanan')}</p>
                              </div>
                            )}
                            
                            {room.futureBookings?.count > 0 && roomStatus.status === 'Available' && (
                              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-700">🔮 {room.futureBookings.count} {getText('future bookings', 'pemesanan mendatang')}</p>
                                {room.futureBookings.nextBooking && (
                                  <p className="text-xs text-blue-600 mt-1">
                                  {getText('Next:', 'Selanjutnya:')} {room.futureBookings.nextBooking.date} {room.futureBookings.nextBooking.time}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Available Equipment */}
                {selectedRoom && availableEquipment.length > 0 && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                      <Zap className="h-5 w-5 mr-2" />
                      {getText('Available Equipment in Selected Room', 'Peralatan Tersedia di Ruangan Terpilih')}
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
                              <span className="block text-xs font-bold text-green-600">{getText('Mandatory', 'Wajib')}</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN - PERSONAL INFORMATION & SUBMIT */}
            <div className="space-y-8">
              
              {/* 3. PERSONAL INFORMATION SECTION */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {getText('Personal Information', 'Informasi Pribadi')}
                  </h2>
                </div>

                <div className="space-y-6">
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('identity_number')}
                        ref={identityInputRef}
                        type="text"
                        placeholder={getText("Enter or search your ID", "Masukkan atau cari ID Anda")}
                        onChange={(e) => {
                          const value = e.target.value;
                          form.setValue('identity_number', value, { shouldValidate: true });
                          showIdentityDropdown(value);
                        }}
                        onFocus={(e) => { showIdentityDropdown(e.target.value); }}
                        onBlur={() => { setTimeout(() => hideIdentityDropdown(), 200); }}
                        className="w-full pl-10 pr-10 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                      />
                      {identitySearchLoading && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
                      )}
                      <div id="identity-dropdown" style={{ display: 'none' }}></div>
                    </div>
                    {form.formState.errors.identity_number && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.identity_number.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Full Name', 'Nama Lengkap')} *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('full_name')}
                        ref={fullNameInputRef}
                        type="text"
                        placeholder={getText("Enter your full name", "Masukkan nama lengkap Anda")}
                        onChange={(e) => form.setValue('full_name', e.target.value, { shouldValidate: true })}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="words"
                        spellCheck="false"
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
                      {getText('Phone Number', 'Nomor Telepon')} *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...form.register('phone_number')}
                        ref={phoneInputRef}
                        type="tel"
                        placeholder="08xxxxxxxxxx"
                        onChange={(e) => form.setValue('phone_number', e.target.value, { shouldValidate: true })}
                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
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
                      {getText('Study Program', 'Program Studi')} *
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        ref={studyProgramDisplayRef}
                        type="text"
                        placeholder={getText("Click or type to select study program", "Klik atau ketik untuk pilih program studi")}
                        onClick={showStudyProgramDropdown}
                        onFocus={showStudyProgramDropdown}
                        onBlur={() => setTimeout(hideStudyProgramDropdown, 200)}
                        onKeyDown={(e) => {
                          // Prevent typing, only allow tab, enter, escape
                          if (!['Tab', 'Enter', 'Escape'].includes(e.key)) {
                            e.preventDefault();
                          }
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            showStudyProgramDropdown();
                          }
                        }}
                        className="w-full pl-10 pr-8 py-3 bg-white/50 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm cursor-pointer"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        readOnly
                      />
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <div id="study-program-dropdown" style={{ display: 'none' }}></div>
                    </div>
                    {form.formState.errors.study_program_id && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {form.formState.errors.study_program_id.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* SUBMIT SECTION - Moved inside Personal Information card */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  {!selectedRoom && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <div className="text-sm text-amber-800">
                          <p className="font-semibold">{getText('Room Selection Required', 'Pilih Ruangan Diperlukan')}</p>
                          <p>{getText('Please select a room to continue', 'Silakan pilih ruangan untuk melanjutkan')}</p>
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

                  {selectedRoom && (() => {
                    const roomStatus = getOptimizedRoomStatus(selectedRoom);
                    if (roomStatus.status === 'Conflict') {
                      return (
                        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
                          <div className="flex items-center space-x-3">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                            <div className="text-sm text-orange-800">
                              <p className="font-semibold">⚠️ {getText('Time Conflict Warning', 'Peringatan Konflik Waktu')}</p>
                              <p>{getText('The selected time conflicts with an existing schedule.', 'Waktu yang dipilih bertabrakan dengan jadwal yang ada.')}</p>
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
                              <p className="font-semibold">⚠️ {getText('Late Booking Warning', 'Peringatan Pemesanan Terlambat')}</p>
                              <p>{getText('Current booking will be marked as completed', 'Pemesanan saat ini akan ditandai sebagai selesai')}</p>
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
                              <p className="font-semibold">📅 {getText('Room Has Schedule', 'Ruangan Terjadwal')}</p>
                              <p>{getText('Please check the schedule details before booking to avoid conflicts.', 'Silakan periksa detail jadwal sebelum memesan untuk menghindari konflik.')}</p>
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
                              <p className="font-semibold">🚫 {getText('Room Unavailable', 'Ruangan Tidak Tersedia')}</p>
                              <p>{getText('This room is currently disabled for booking', 'Ruangan ini saat ini dinonaktifkan untuk pemesanan')}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* SCHEDULE MODAL */}
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
                {scheduleModalRoom.targetDateBookings?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-orange-600" />
                      {getText('Active Bookings', 'Pemesanan Aktif')}
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.targetDateBookings.map((booking, index) => (
                        <div key={index} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-orange-900 text-lg">
                              {booking.start_time_local || format(convertUTCToLocal(booking.start_time), 'HH:mm')} - {booking.end_time_local || format(convertUTCToLocal(booking.end_time), 'HH:mm')}
                            </span>
                            <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                              {getText('Booking', 'Pemesanan')}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-orange-700">
                              <GraduationCap className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {booking.user?.study_program?.name || getText('No Study Program', 'Tidak Ada Program Studi')}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-orange-700">
                              <User className="h-4 w-4 mr-2" />
                              <span>{booking.user?.full_name || getText('No User Info', 'Info Pengguna Tidak Ada')}</span>
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
                      {getText('Lecture Schedules', 'Jadwal Kuliah')}
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.scheduleDetails.lectures.map((lecture, index) => (
                        <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-blue-900 text-lg">
                              {lecture.start_time} - {lecture.end_time}
                            </span>
                            <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              {getText('Lecture', 'Kuliah')}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-blue-700">
                              <GraduationCap className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {lecture.subject_study || getText('No Study Program', 'Tidak Ada Program Studi')}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-blue-700">
                              <BookOpen className="h-4 w-4 mr-2" />
                              <span>{lecture.course_name || getText('No Course Name', 'Tidak Ada Nama Mata Kuliah')}</span>
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
                      {getText('Final Sessions', 'Sidang Akhir')}
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.scheduleDetails.sessions.map((session, index) => (
                        <div key={index} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-purple-900 text-lg">
                              {session.start_time_local || session.start_time} - {session.end_time_local || session.end_time}
                            </span>
                            <span className="bg-purple-200 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                              {getText('Session', 'Sidang')}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-purple-700">
                              <GraduationCap className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {session.student?.study_program?.name || getText('No Study Program', 'Tidak Ada Program Studi')}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-purple-700">
                              <User className="h-4 w-4 mr-2" />
                              <span>{session.student?.full_name || getText('No Student Info', 'Info Mahasiswa Tidak Ada')}</span>
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
                      {getText('Exam Schedules', 'Jadwal Ujian')}
                    </h4>
                    <div className="space-y-3">
                      {scheduleModalRoom.scheduleDetails.exams.map((exam, index) => (
                        <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-green-900 text-lg">
                              {exam.start_time} - {exam.end_time}
                            </span>
                            <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              {getText('Exam', 'Ujian')}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-green-700">
                              <GraduationCap className="h-4 w-4 mr-2" />
                              <span className="font-medium">
                                {exam.class || getText('No Class Info', 'Tidak Ada Info Kelas')}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-green-700">
                              <BookOpen className="h-4 w-4 mr-2" />
                              <span>{exam.course_name || getText('No Exam Name', 'Tidak Ada Nama Ujian')}</span>
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
                      {getText('No Schedule for This Date', 'Tidak Ada Jadwal untuk Tanggal Ini')}
                    </h3>
                    <p className="text-gray-500">
                      {getText('This room is available for booking on the selected date.', 'Ruangan ini tersedia untuk dipesan pada tanggal yang dipilih.')}
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
            <span className="text-sm">{getText('Loading rooms...', 'Memuat ruangan...')}</span>
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
                {getText('How to Book a Room', 'Cara Memesan Ruangan')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                  <div>
                    <div className="font-semibold">{getText('Set Schedule', 'Atur Jadwal')}</div>
                    <div className="text-blue-700">{getText('Choose your date, time, and duration', 'Pilih tanggal, waktu, dan durasi')}</div>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                  <div>
                    <div className="font-semibold">{getText('Select Room', 'Pilih Ruangan')}</div>
                    <div className="text-blue-700">{getText('Choose from available rooms', 'Pilih dari ruangan yang tersedia')}</div>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                  <div>
                    <div className="font-semibold">{getText('Fill Details', 'Isi Detail')}</div>
                    <div className="text-blue-700">{getText('Complete your personal information', 'Lengkapi informasi pribadi Anda')}</div>
                  </div>
                </div>
                </div>
              
              <div className="mt-4 pt-4 border-t border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">{getText('Important Notes:', 'Catatan Penting:')}</h4>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>{getText('Bookings are subject to approval by admin', 'Pemesanan memerlukan persetujuan admin')}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>{getText('Maximum booking duration is 7 days', 'Durasi pemesanan maksimal 7 hari')}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>{getText('Check room schedules to avoid conflicts', 'Periksa jadwal ruangan untuk menghindari konflik')}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>{getText('Supporting documents required for "Other" purposes', 'Dokumen pendukung diperlukan untuk tujuan "Lainnya"')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {React.useEffect(() => {
        return () => {
          const identityDropdown = document.querySelector('#identity-dropdown');
          const studyProgramDropdown = document.querySelector('#study-program-dropdown');
          if (identityDropdown) {
            identityDropdown.innerHTML = '';
            identityDropdown.style.display = 'none';
          }
          if (studyProgramDropdown) {
            studyProgramDropdown.innerHTML = '';
            studyProgramDropdown.style.display = 'none';
          }
        };
      }, [])}
    </div>
  );
};

export default BookRoom;