import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar, Clock, Users, Building, MapPin, Package, User, Phone, Mail, Hash,
  GraduationCap, ChevronDown, Search, Eye, X, Upload, FileText, Download,
  Loader2, CheckCircle, AlertTriangle, Zap, Star, ArrowRight, Plus, Minus,
  RefreshCw, Filter, Grid, List, SortAsc, SortDesc, MoreHorizontal, Info,
  BookOpen, Award, Target, TrendingUp, Activity, BarChart3, PieChart, ChevronUp
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

// ✅ ENHANCED: Form validation schema with equipment quantity validation
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

  // Equipment & Notes with proper validation
  equipment_requested: z.array(z.string()).optional().default([]),
  equipment_quantities: z.record(z.string(), z.number().min(1, 'Quantity must be at least 1')).optional().default({}),
  notes: z.string().optional().default(''),
  attachments: z.array(z.string()).optional().default([]),
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

    // Validate max 7 days
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

  // Validate equipment quantities for each selected equipment
  if (data.equipment_requested && data.equipment_requested.length > 0) {
    for (const equipmentId of data.equipment_requested) {
      const quantity = data.equipment_quantities?.[equipmentId];
      if (!quantity || quantity < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Please specify quantity for selected equipment`,
          path: ["equipment_quantities", equipmentId],
        });
      }
    }
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
  unit?: string;
}

const BookRoom = () => {
  const { getText } = useLanguage();
  
  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      start_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_datetime: format(addMinutes(new Date(), 120), "yyyy-MM-dd'T'HH:mm"),
      sks: 2,
      class_type: 'theory',
      purpose: 'Class/Lecture',
      equipment_requested: [],
      equipment_quantities: {},
      attachments: [],
      notes: '',
    },
  });

  const watchStartDateTime = form.watch('start_datetime');
  const watchEndDateTime = form.watch('end_datetime');
  const watchSks = form.watch('sks');
  const watchClassType = form.watch('class_type');
  const watchPurpose = form.watch('purpose');
  const watchAttachments = form.watch('attachments');
  const watchEquipmentRequested = form.watch('equipment_requested');
  const watchEquipmentQuantities = form.watch('equipment_quantities');

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
  }, []);

  // ✅ FIXED: Improved dropdown refs and states
  const identityInputRef = useRef(null);
  const fullNameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const studyProgramDisplayRef = useRef(null);
  const identityDropdownRef = useRef(null);
  const studyProgramDropdownRef = useRef(null);

  // ✅ FIXED: Better state management
  const [identitySearchLoading, setIdentitySearchLoading] = useState(false);
  const [isIdentityDropdownOpen, setIsIdentityDropdownOpen] = useState(false);
  const [isStudyProgramDropdownOpen, setIsStudyProgramDropdownOpen] = useState(false);
  const [useManualEndTime, setUseManualEndTime] = useState(false);

  // ✅ Room selection states
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const roomDisplayRef = useRef(null);
  const roomDropdownRef = useRef(null);
  const roomSearchInputRef = useRef(null);

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

  // Room status logic with timezone handling
  const getOptimizedRoomStatus = useCallback((room) => {
    // 1. Check if room is disabled
    if (!room.is_available) {
      return {
        status: 'Unavailable',
        reason: 'Ruangan dinonaktifkan untuk pemesanan',
        color: 'bg-gray-100 text-gray-800 border-gray-200'
      };
    }

    // 2. Check if currently in use (timezone aware)
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

    // 3. Check conflicts with user input time (timezone aware)
    const userStartTime = watchStartDateTime ? new Date(watchStartDateTime) : null;
    const userEndTime = watchEndDateTime ? new Date(watchEndDateTime) : null;

    if (userStartTime && userEndTime && Array.isArray(room.targetDateBookings) && room.targetDateBookings.length > 0) {
      for (const booking of room.targetDateBookings) {
        const existingStart = convertUTCToLocal(booking.start_time);
        const existingEnd = convertUTCToLocal(booking.end_time);
        
        // Overlap condition with correct timezone
        if (userStartTime < existingEnd && userEndTime > existingStart) {
          return {
            status: 'Conflict',
            reason: `Bertabrakan dengan jadwal pukul ${booking.start_time_local} - ${booking.end_time_local}`,
            color: 'bg-orange-100 text-orange-800 border-orange-200'
          };
        }
      }
    }
    
    // 4. Check if has other scheduled content for the day
    const hasScheduledContent =
      (Array.isArray(room.scheduleDetails?.lectures) && room.scheduleDetails.lectures.length > 0) ||
      (Array.isArray(room.scheduleDetails?.exams) && room.scheduleDetails.exams.length > 0) ||
      (Array.isArray(room.scheduleDetails?.sessions) && room.scheduleDetails.sessions.length > 0) ||
      (Array.isArray(room.targetDateBookings) && room.targetDateBookings.length > 0);

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

    // 5. If passes all checks, it's available
    return {
      status: 'Available',
      reason: 'Ruangan bebas dan tersedia untuk dipesan',
      color: 'bg-green-100 text-green-800 border-green-200'
    };
  }, [targetBookingDate, watchStartDateTime, watchEndDateTime]);

  const filteredAndSortedRooms = useMemo(() => {
    if (!Array.isArray(rooms)) return [];
    
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

  // ✅ FIXED: Improved Room Selection with SessionSchedule pattern
  const filteredRooms = useMemo(() => {
    if (!roomSearchTerm.trim()) return filteredAndSortedRooms;
    
    const searchLower = roomSearchTerm.toLowerCase();
    return filteredAndSortedRooms.filter(room => 
      room.name.toLowerCase().includes(searchLower) ||
      room.code.toLowerCase().includes(searchLower) ||
      room.department?.name?.toLowerCase().includes(searchLower)
    );
  }, [roomSearchTerm, filteredAndSortedRooms]);

  // ✅ FIXED: Room dropdown functions
  const showRoomDropdown = useCallback(() => {
    setIsRoomDropdownOpen(true);
    setRoomSearchTerm('');
    
    setTimeout(() => {
      if (roomSearchInputRef.current) {
        roomSearchInputRef.current.focus();
      }
    }, 100);
  }, []);

  const hideRoomDropdown = useCallback(() => {
    setIsRoomDropdownOpen(false);
    setRoomSearchTerm('');
  }, []);

  const handleRoomSelect = useCallback((room) => {
    setSelectedRoom(room);
    fetchEquipmentForRoom(room.id);
    
    if (roomDisplayRef.current) {
      roomDisplayRef.current.value = `${room.name} (${room.code})`;
    }
    
    hideRoomDropdown();
  }, []);

  // ✅ FIXED: Click outside handling for room dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(event.target)) {
        hideRoomDropdown();
      }
    };

    if (isRoomDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isRoomDropdownOpen, hideRoomDropdown]);

  // ✅ FIXED: Identity dropdown functions using SessionSchedule pattern
  const showIdentityDropdown = useCallback((searchTerm) => {
    if (!searchTerm.trim()) {
      setIsIdentityDropdownOpen(false);
      return;
    }
    
    setIdentitySearchLoading(true);
    setIsIdentityDropdownOpen(true);
    
    supabase
      .from('users')
      .select(`id, full_name, identity_number, email, phone_number, study_program_id, study_program:study_programs(id, name, code)`)
      .or(`full_name.ilike.%${searchTerm}%,identity_number.ilike.%${searchTerm}%`)
      .limit(10)
      .then(({ data, error }) => {
        setIdentitySearchLoading(false);
        if (error) {
          console.error('Error searching users:', error);
          setIsIdentityDropdownOpen(false);
          return;
        }
        const filteredUsers = Array.isArray(data) ? data : [];
        if (filteredUsers.length === 0) {
          setIsIdentityDropdownOpen(false);
          return;
        }
        
        // Create dropdown content (keeping the existing structure but using React state)
        const dropdownHTML = `<div class="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">${filteredUsers.map(user => `<div class="identity-dropdown-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150" data-user-id="${user.id}" data-user-nim="${user.identity_number}" data-user-name="${user.full_name}" data-user-email="${user.email || ''}" data-user-phone="${user.phone_number || ''}" data-program-id="${user.study_program_id || ''}"><div class="font-semibold text-gray-800">${user.identity_number}</div><div class="text-sm text-gray-600">${user.full_name}</div>${user.study_program ? `<div class="text-xs text-gray-500">${user.study_program.name}</div>` : ''}</div>`).join('')}</div>`;
        
        const dropdownContainer = document.querySelector('#identity-dropdown');
        if (dropdownContainer) {
          dropdownContainer.innerHTML = dropdownHTML;
          dropdownContainer.style.display = 'block';
          dropdownContainer.querySelectorAll('.identity-dropdown-item').forEach(item => {
            // ✅ FIXED: Add mousedown preventDefault
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
              
              setIsIdentityDropdownOpen(false);
              identityInputRef.current?.focus();
            });
          });
        }
      });
  }, [form, studyPrograms]);

  const hideIdentityDropdown = useCallback(() => {
    setIsIdentityDropdownOpen(false);
    const dropdownContainer = document.querySelector('#identity-dropdown');
    if (dropdownContainer) {
      dropdownContainer.style.display = 'none';
    }
  }, []);

  // ✅ FIXED: Study program dropdown functions
  const showStudyProgramDropdown = useCallback(() => {
    setIsStudyProgramDropdownOpen(true);
    
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
      // ✅ FIXED: Add mousedown preventDefault
      item.addEventListener('mousedown', (e) => e.preventDefault());
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
    setIsStudyProgramDropdownOpen(false);
    const dropdownContainer = document.querySelector('#study-program-dropdown');
    if (dropdownContainer) {
      dropdownContainer.style.display = 'none';
    }
  }, []);

  // ✅ FIXED: Click outside handling for identity dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      const identityDropdown = document.querySelector('#identity-dropdown');
      if (identityDropdown && !identityDropdown.contains(event.target) && !identityInputRef.current?.contains(event.target)) {
        hideIdentityDropdown();
      }
    };

    if (isIdentityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isIdentityDropdownOpen, hideIdentityDropdown]);

  // ✅ FIXED: Click outside handling for study program dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      const programDropdown = document.querySelector('#study-program-dropdown');
      if (programDropdown && !programDropdown.contains(event.target) && !studyProgramDisplayRef.current?.contains(event.target)) {
        hideStudyProgramDropdown();
      }
    };

    if (isStudyProgramDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isStudyProgramDropdownOpen, hideStudyProgramDropdown]);

  const fetchStudyPrograms = async () => {
    try {
      const { data, error } = await supabase.from('study_programs').select('*').order('name');
      if (error) throw error;
      setStudyPrograms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching study programs:', error);
      setStudyPrograms([]);
    }
  };

  // Equipment fetching with proper quantity handling
  // ✅ FIXED: Equipment fetching with proper reset
const fetchEquipmentForRoom = async (roomId) => {
  try {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .or(`rooms_id.eq.${roomId},rooms_id.is.null`)
      .eq('is_available', true)
      .gt('quantity', 0)
      .order('name');

    if (error) throw error;
    
    const equipmentData = Array.isArray(data) ? data : [];
    setAvailableEquipment(equipmentData);
    
    // 🔥 RESET EQUIPMENT ARRAYS FIRST - Clear previous room equipment
    form.setValue('equipment_requested', []);
    form.setValue('equipment_quantities', {});
    
    // Then add mandatory equipment for NEW room only
    const mandatoryEquipment = equipmentData.filter(eq => eq.is_mandatory);
    
    if (mandatoryEquipment.length > 0) {
      const mandatoryIds = mandatoryEquipment.map(eq => eq.id);
      
      // Set quantities for mandatory equipment (always 1)
      const mandatoryQuantities = {};
      mandatoryEquipment.forEach(eq => {
        mandatoryQuantities[eq.id] = 1;
      });
      
      // Update form with ONLY new room's mandatory equipment
      form.setValue('equipment_requested', mandatoryIds);
      form.setValue('equipment_quantities', mandatoryQuantities);
    }
    
    console.log('✅ Equipment reset and set for new room:', {
      roomId,
      mandatoryCount: mandatoryEquipment.length,
      totalAvailable: equipmentData.length
    });
    
  } catch (error) {
    console.error('Error fetching equipment:', error);
    setAvailableEquipment([]);
    // Reset to empty arrays on error
    form.setValue('equipment_requested', []);
    form.setValue('equipment_quantities', {});
  }
};

  // Equipment quantity management functions
  const handleEquipmentToggle = (equipmentId: string, isChecked: boolean) => {
    const currentEquipment = form.getValues('equipment_requested') || [];
    const currentQuantities = form.getValues('equipment_quantities') || {};
    
    // Ensure currentEquipment is an array
    const safeCurrentEquipment = Array.isArray(currentEquipment) ? currentEquipment : [];
    
    if (isChecked) {
      // Add equipment
      const updatedEquipment = [...safeCurrentEquipment, equipmentId];
      const updatedQuantities = { 
        ...currentQuantities, 
        [equipmentId]: 1 // Default quantity 1
      };
      
      form.setValue('equipment_requested', updatedEquipment);
      form.setValue('equipment_quantities', updatedQuantities);
    } else {
      // Remove equipment
      const updatedEquipment = safeCurrentEquipment.filter(id => id !== equipmentId);
      const updatedQuantities = { ...currentQuantities };
      delete updatedQuantities[equipmentId];
      
      form.setValue('equipment_requested', updatedEquipment);
      form.setValue('equipment_quantities', updatedQuantities);
    }
  };

  const handleQuantityChange = (equipmentId: string, newQuantity: number) => {
    const equipment = availableEquipment.find(eq => eq.id === equipmentId);
    if (!equipment) return;

    // Validate quantity bounds
    const quantity = Math.max(1, Math.min(newQuantity, equipment.quantity));
    
    const currentQuantities = form.getValues('equipment_quantities') || {};
    const updatedQuantities = {
      ...currentQuantities,
      [equipmentId]: quantity
    };
    
    form.setValue('equipment_quantities', updatedQuantities);
  };

  const incrementQuantity = (equipmentId: string) => {
    const currentQuantities = form.getValues('equipment_quantities') || {};
    const currentQty = currentQuantities[equipmentId] || 1;
    handleQuantityChange(equipmentId, currentQty + 1);
  };

  const decrementQuantity = (equipmentId: string) => {
    const currentQuantities = form.getValues('equipment_quantities') || {};
    const currentQty = currentQuantities[equipmentId] || 1;
    handleQuantityChange(equipmentId, currentQty - 1);
  };

  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (!files) return;
    const currentAttachments = form.getValues('attachments') || [];
    const safeCurrentAttachments = Array.isArray(currentAttachments) ? currentAttachments : [];
    
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result) {
          form.setValue('attachments', [...safeCurrentAttachments, result], { shouldValidate: true });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index) => {
    const currentAttachments = form.getValues('attachments') || [];
    const safeCurrentAttachments = Array.isArray(currentAttachments) ? currentAttachments : [];
    const updatedAttachments = safeCurrentAttachments.filter((_, i) => i !== index);
    form.setValue('attachments', updatedAttachments, { shouldValidate: true });
  };

  useEffect(() => {
    fetchStudyPrograms();
  }, []);

  // Enhanced submit function with proper equipment handling
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

      const startTimeUTC = new Date(data.start_datetime + '+07:00').toISOString();
      const endTimeUTC = new Date(data.end_datetime + '+07:00').toISOString();

      const equipmentRequested = Array.isArray(data.equipment_requested) ? data.equipment_requested : [];
      const equipmentQuantitiesObj = data.equipment_quantities || {};
      
      // ✅ FIX: Convert to simple array of numbers (quantities only)
      // This assumes equipment_quantities column is bigint[] or integer[]
      const equipmentQuantities = equipmentRequested.map(equipmentId => 
        equipmentQuantitiesObj[equipmentId] || 1
      );

      const attachments = Array.isArray(data.attachments) ? data.attachments : [];

      const bookingData = {
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        purpose: data.purpose,
        sks: data.sks,
        class_type: data.class_type,
        room_id: selectedRoom.id,
        equipment_requested: equipmentRequested,
        equipment_quantities: equipmentQuantities, // Now sending [2, 1, 3] instead of objects
        notes: data.notes || '',
        attachments: attachments,
        status: 'pending',
        user_info: {
          full_name: data.full_name,
          identity_number: data.identity_number,
          phone_number: data.phone_number,
          study_program_id: data.study_program_id,
        },
      };

      console.log('✅ Equipment data format:');
      console.log('equipment_requested:', equipmentRequested);
      console.log('equipment_quantities:', equipmentQuantities);

      const { error } = await supabase.from('bookings').insert(bookingData);
      if (error) throw error;

      alert.success(getText('Booking submitted successfully!', 'Pemesanan berhasil diajukan!'));

      // Reset form...
      form.reset({
        start_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        end_datetime: format(addMinutes(new Date(), 120), "yyyy-MM-dd'T'HH:mm"),
        sks: 2,
        class_type: 'theory',
        purpose: 'Class/Lecture',
        equipment_requested: [],
        equipment_quantities: {},
        attachments: [],
        notes: '',
      });
      
      setSelectedRoom(null);
      setAvailableEquipment([]);
      if (identityInputRef.current) identityInputRef.current.value = '';
      if (fullNameInputRef.current) fullNameInputRef.current.value = '';
      if (phoneInputRef.current) phoneInputRef.current.value = '';
      if (studyProgramDisplayRef.current) studyProgramDisplayRef.current.value = '';
      if (roomDisplayRef.current) roomDisplayRef.current.value = '';
      fetchRoomData(targetBookingDate, true);
      
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert.error(error.message || getText('Failed to submit booking', 'Gagal mengajukan pemesanan'));
    } finally {
      setLoading(false);
    }
  };

  // Calculate total equipment items for display
  const getTotalEquipmentItems = () => {
    const quantities = watchEquipmentQuantities || {};
    const requested = watchEquipmentRequested || [];
    
    // Ensure requested is an array
    const safeRequested = Array.isArray(requested) ? requested : [];
    
    return safeRequested.reduce((total, equipmentId) => {
      return total + (quantities[equipmentId] || 1);
    }, 0);
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
          {/* SIMPLIFIED LAYOUT: 2 CARDS ONLY */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* CARD 1: BOOKING DETAILS & ROOM SELECTION */}
            <div className="lg:col-span-2 relative z-20">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 space-y-8">
                
                {/* SECTION 1: BOOKING DETAILS */}
                <div>
                  <div className="flex items-center space-x-3 mb-6">
                    <Calendar className="h-6 w-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-800">
                      {getText('Booking Details', 'Detail Pemesanan')}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Start Date & Time', 'Tanggal & Waktu Mulai')} *
                      </label>
                      <input
                        {...form.register('start_datetime')}
                        type="datetime-local"
                        min={new Date().toISOString().slice(0, 16)}
                        max={format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm")}
                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                      />
                      {form.formState.errors.start_datetime && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.start_datetime.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('End Date & Time', 'Tanggal & Waktu Selesai')} *
                      </label>
                      <input
                        {...form.register('end_datetime')}
                        type="datetime-local"
                        min={watchStartDateTime}
                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 disabled:opacity-60"
                      />
                      {form.formState.errors.end_datetime && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.end_datetime.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('SKS (Credits)', 'SKS (Kredit)')} *
                      </label>
                      <select
                        {...form.register('sks', { valueAsNumber: true })}
                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value={1}>1 SKS</option>
                        <option value={2}>2 SKS</option>
                        <option value={3}>3 SKS</option>
                        <option value={4}>4 SKS</option>
                        <option value={5}>5 SKS</option>
                        <option value={6}>6 SKS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Class Type', 'Tipe Kelas')} *
                      </label>
                      <select
                        {...form.register('class_type')}
                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="theory">{getText('Theory (50 min/SKS)', 'Teori (50 menit/SKS)')}</option>
                        <option value="practical">{getText('Practical (170 min/SKS)', 'Praktik (170 menit/SKS)')}</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Purpose', 'Tujuan')} *
                      </label>
                      <select
                        {...form.register('purpose')}
                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="Class/Lecture">{getText('Class/Lecture', 'Kuliah')}</option>
                        <option value="Other">{getText('Other', 'Lainnya')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Duration Display */}
                  {bookingDuration && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2 text-sm text-green-800">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">{getText('Duration', 'Durasi')}: {bookingDuration.totalHours} {getText('hours', 'jam')}</span>
                      </div>
                    </div>
                  )}

                  {/* Additional fields for "Other" purpose */}
                  {watchPurpose === 'Other' && (
                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Notes', 'Catatan')}
                        </label>
                        <textarea
                          {...form.register('notes')}
                          rows={3}
                          className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          placeholder={getText("Additional information", "Informasi tambahan")}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Attachments', 'Lampiran')} *
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                          <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                          />
                          <label htmlFor="file-upload" className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                            {getText('Upload Files', 'Unggah File')}
                          </label>
                        </div>
                        {watchAttachments && watchAttachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {watchAttachments.map((_, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-sm text-gray-700">Attachment {index + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => removeAttachment(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION 2: ROOM SELECTION */}
                <div className="border-t border-gray-200/50 pt-8">
                  <div className="flex items-center space-x-3 mb-6">
                    <Building className="h-6 w-6 text-green-600" />
                    <h2 className="text-xl font-bold text-gray-800">
                      {getText('Room Selection', 'Pilih Ruangan')}
                    </h2>
                  </div>

                  {/* Selected Room Display */}
                  {selectedRoom ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-green-800">{selectedRoom.name}</h4>
                          <p className="text-sm text-green-600">{selectedRoom.code} • {selectedRoom.capacity} seats</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoom(null);
                            setAvailableEquipment([]);
                            // Clear equipment selections when room is deselected
                            form.setValue('equipment_requested', []);
                            form.setValue('equipment_quantities', {});
                            if (roomDisplayRef.current) {
                              roomDisplayRef.current.value = '';
                            }
                          }}
                          className="text-green-600 hover:text-green-800"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <p className="text-sm text-amber-800 font-medium">
                          {getText('Please select a room to continue', 'Silakan pilih ruangan untuk melanjutkan')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ✅ FIXED: Improved Room Selection Dropdown */}
                  <div className="relative mb-4" ref={roomDropdownRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Select Room', 'Pilih Ruangan')} *
                    </label>
                    
                    <div className="relative">
                      <input
                        ref={roomDisplayRef}
                        type="text"
                        readOnly
                        placeholder={getText("Click to select room...", "Klik untuk pilih ruangan...")}
                        value={selectedRoom ? `${selectedRoom.name} (${selectedRoom.code})` : ''}
                        onClick={showRoomDropdown}
                        onFocus={showRoomDropdown}
                        className="w-full px-4 py-3 pr-10 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-all duration-200 hover:border-gray-300"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        {isRoomDropdownOpen ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* ✅ FIXED: Room Dropdown Content */}
                    {isRoomDropdownOpen && (
                      <div className="absolute z-[9999] w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-96 overflow-hidden">
                        {/* Search Input */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              ref={roomSearchInputRef}
                              type="text"
                              placeholder={getText("Search rooms...", "Cari ruangan...")}
                              value={roomSearchTerm}
                              onChange={(e) => setRoomSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              autoComplete="off"
                            />
                          </div>
                          
                          {/* Quick Stats */}
                          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                            <span>{getText('Available rooms', 'Ruangan tersedia')}: {filteredRooms.length}</span>
                            <div className="flex items-center space-x-3">
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={showInUse}
                                  onChange={(e) => setShowInUse(e.target.checked)}
                                  className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span>{getText('Show in-use', 'Tampilkan terpakai')}</span>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Rooms List */}
                        <div className="max-h-80 overflow-y-auto">
                          {filteredRooms.length === 0 ? (
                            <div className="p-6 text-center">
                              <Building className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-600 text-sm">
                                {roomSearchTerm ? 
                                  getText('No rooms match your search', 'Tidak ada ruangan yang cocok') :
                                  getText('No rooms available', 'Tidak ada ruangan tersedia')
                                }
                              </p>
                              {roomSearchTerm && (
                                <button
                                  onClick={() => setRoomSearchTerm('')}
                                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
                                >
                                  {getText('Clear search', 'Hapus pencarian')}
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {filteredRooms.map((room) => {
                                const roomStatus = getOptimizedRoomStatus(room);
                                const canSelect = roomStatus.status !== 'Conflict' && 
                                                roomStatus.status !== 'In Use' && 
                                                roomStatus.status !== 'Unavailable';
                                
                                return (
                                  <div
                                    key={room.id}
                                    onClick={() => canSelect && handleRoomSelect(room)}
                                    onMouseDown={(e) => e.preventDefault()} // ✅ Prevent blur
                                    className={`p-4 transition-all duration-200 ${
                                      canSelect 
                                        ? 'cursor-pointer hover:bg-blue-50 hover:border-l-4 hover:border-blue-500' 
                                        : 'opacity-60 cursor-not-allowed bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                            canSelect ? 'bg-blue-100' : 'bg-gray-100'
                                          }`}>
                                            <Building className={`h-5 w-5 ${
                                              canSelect ? 'text-blue-600' : 'text-gray-400'
                                            }`} />
                                          </div>
                                          
                                          <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-900 truncate">
                                              {room.name}
                                            </h4>
                                            <div className="flex items-center space-x-3 mt-1">
                                              <span className="text-sm text-gray-600 font-mono">
                                                {room.code}
                                              </span>
                                              <span className="text-sm text-gray-500">
                                                {room.capacity} seats
                                              </span>
                                              {room.department?.name && (
                                                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                                                  {room.department.name}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Status Badge */}
                                      <div className="ml-3 flex flex-col items-end space-y-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${roomStatus.color}`}>
                                          {getText(roomStatus.status, roomStatus.status)}
                                        </span>
                                        
                                        {/* Action Buttons */}
                                        <div className="flex items-center space-x-1">
                                          {(roomStatus.status === 'Scheduled' || 
                                            roomStatus.status === 'In Use' || 
                                            roomStatus.status === 'Conflict') && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setScheduleModalRoom(room);
                                                setShowScheduleModal(true);
                                                hideRoomDropdown();
                                              }}
                                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                                              title={getText('View schedule', 'Lihat jadwal')}
                                            >
                                              <Eye className="h-4 w-4" />
                                            </button>
                                          )}
                                          
                                          {canSelect && (
                                            <div className="p-1 text-green-600">
                                              <CheckCircle className="h-4 w-4" />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Conflict/Status Details */}
                                    {roomStatus.status === 'Conflict' && (
                                      <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                                       <p className="text-xs text-orange-800 flex items-center">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          {roomStatus.reason}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {roomStatus.status === 'Scheduled' && roomStatus.scheduleCount && (
                                      <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <p className="text-xs text-yellow-800 flex items-center">
                                          <Calendar className="h-3 w-3 mr-1" />
                                          {roomStatus.scheduleCount} {getText('activities scheduled', 'kegiatan terjadwal')}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-3 border-t border-gray-200 bg-gray-50">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                              {getText('Use ↑↓ arrows to navigate, Enter to select, Esc to close', 
                                       'Gunakan ↑↓ untuk navigasi, Enter untuk pilih, Esc untuk tutup')}
                            </span>
                            <button
                              onClick={hideRoomDropdown}
                              className="text-gray-600 hover:text-gray-800 p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Room Search (fallback for mobile) */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={getText("Search rooms...", "Cari ruangan...")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        id="showInUse"
                        checked={showInUse}
                        onChange={(e) => setShowInUse(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        {getText('Show rooms currently in use', 'Tampilkan ruangan yang sedang digunakan')}
                      </span>
                    </label>
                  </div>

                  {/* Room List (fallback for mobile) */}
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {roomsLoading && filteredAndSortedRooms.length === 0 ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                        <span className="text-gray-600">{getText('Loading rooms...', 'Memuat ruangan...')}</span>
                      </div>
                    ) : filteredAndSortedRooms.length === 0 ? (
                      <div className="text-center py-8">
                        <Building className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">{getText('No rooms found', 'Tidak ada ruangan ditemukan')}</p>
                      </div>
                    ) : (
                      filteredAndSortedRooms.map((room) => {
                        const roomStatus = getOptimizedRoomStatus(room);
                        const isSelected = selectedRoom?.id === room.id;
                        const canSelect = roomStatus.status !== 'Conflict' && roomStatus.status !== 'In Use' && roomStatus.status !== 'Unavailable';
                        
                        return (
                          <div
                            key={room.id}
                            onClick={() => canSelect && handleRoomSelect(room)}
                            className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white/50'
                            } ${canSelect ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : 'opacity-60 cursor-not-allowed'}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-900">{room.name}</h4>
                                <p className="text-sm text-gray-600">{room.code}</p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${roomStatus.color}`}>
                                {getText(roomStatus.status, roomStatus.status)}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Users className="h-4 w-4" />
                                <span>{room.capacity} seats</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Building className="h-4 w-4" />
                                <span>{room.department?.name || 'General'}</span>
                              </div>
                              {(roomStatus.status === 'Scheduled' || roomStatus.status === 'In Use' || roomStatus.status === 'Conflict') && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setScheduleModalRoom(room);
                                    setShowScheduleModal(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              )}
                            </div>

                            {roomStatus.status === 'Conflict' && (
                              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                                <p className="text-xs text-orange-800">⚠️ {roomStatus.reason}</p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Available Equipment with Quantity Management */}
                  {selectedRoom && availableEquipment.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-blue-800 flex items-center">
                          <Zap className="h-4 w-4 mr-2" />
                          {getText('Available Equipment', 'Peralatan Tersedia')}
                        </h4>
                        {(watchEquipmentRequested?.length > 0) && (
                          <div className="text-sm text-blue-700 font-medium">
                            {getText('Selected', 'Dipilih')}: {watchEquipmentRequested.length} {getText('types', 'jenis')} 
                            ({getTotalEquipmentItems()} {getText('items', 'item')})
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        {availableEquipment.map((equipment) => {
                          const isSelected = watchEquipmentRequested?.includes(equipment.id);
                          const currentQuantity = watchEquipmentQuantities?.[equipment.id] || 1;
                          const isMandatory = equipment.is_mandatory;
                          
                          return (
                            <div key={equipment.id} className={`p-3 rounded-lg border transition-all duration-200 ${
                              isSelected ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isMandatory}
                                    onChange={(e) => handleEquipmentToggle(equipment.id, e.target.checked)}
                                    className="text-blue-600 focus:ring-blue-500 rounded disabled:opacity-50"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-blue-800">{equipment.name}</span>
                                      {isMandatory && (
                                        <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded">
                                          {getText('Required', 'Wajib')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-blue-600 mt-1">
                                      {equipment.code} • {getText('Available', 'Tersedia')}: {equipment.quantity} {equipment.unit || 'pcs'}
                                    </div>
                                  </div>
                                </div>

                                {/* Quantity Controls */}
                                {isSelected && (
                                  <div className="flex items-center space-x-2 ml-4">
                                    {!isMandatory && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => decrementQuantity(equipment.id)}
                                          disabled={currentQuantity <= 1}
                                          className="p-1 bg-blue-200 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors duration-200"
                                        >
                                          <Minus className="h-3 w-3 text-blue-800" />
                                        </button>
                                        <span className="font-bold text-blue-900 min-w-[2rem] text-center bg-white px-2 py-1 rounded">
                                          {currentQuantity}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => incrementQuantity(equipment.id)}
                                          disabled={currentQuantity >= equipment.quantity}
                                          className="p-1 bg-blue-200 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors duration-200"
                                        >
                                          <Plus className="h-3 w-3 text-blue-800" />
                                        </button>
                                      </>
                                    )}
                                    
                                    {isMandatory && (
                                      <span className="font-bold text-green-700 bg-green-100 px-3 py-1 rounded text-sm">
                                        1 {equipment.unit || 'pcs'}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Quantity Validation Error */}
                              {form.formState.errors.equipment_quantities?.[equipment.id] && (
                                <p className="mt-2 text-xs text-red-600 flex items-center">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {form.formState.errors.equipment_quantities[equipment.id]?.message}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Equipment Summary */}
                      {watchEquipmentRequested && watchEquipmentRequested.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
                          <div className="text-sm text-blue-800">
                            <div className="font-medium flex items-center">
                              <Package className="h-4 w-4 mr-2" />
                              {getText('Equipment Summary', 'Ringkasan Peralatan')}
                            </div>
                            <div className="mt-2 space-y-1">
                              {watchEquipmentRequested.map(equipmentId => {
                                const equipment = availableEquipment.find(eq => eq.id === equipmentId);
                                const quantity = watchEquipmentQuantities?.[equipmentId] || 1;
                                return (
                                  <div key={equipmentId} className="flex justify-between items-center text-xs">
                                    <span>{equipment?.name || 'Unknown'}</span>
                                    <span className="font-medium">{quantity} {equipment?.unit || 'pcs'}</span>
                                  </div>
                                );
                              })}
                              <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between items-center font-semibold">
                                <span>{getText('Total Items', 'Total Item')}</span>
                                <span>{getTotalEquipmentItems()} {getText('items', 'item')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CARD 2: PERSONAL INFORMATION & SUBMIT */}
            <div className="lg:col-span-1 relative z-10">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 space-y-6">
                
                {/* PERSONAL INFORMATION */}
                <div>
                  <div className="flex items-center space-x-3 mb-6">
                    <User className="h-6 w-6 text-purple-600" />
                    <h2 className="text-xl font-bold text-gray-800">
                      {getText('Personal Information', 'Informasi Pribadi')}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {/* ✅ FIXED: Identity Number Input */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                      </label>
                      <input
                        {...form.register('identity_number')}
                        ref={identityInputRef}
                        type="text"
                        placeholder={getText("Enter your ID", "Masukkan ID Anda")}
                        onChange={(e) => {
                          const value = e.target.value;
                          form.setValue('identity_number', value, { shouldValidate: true });
                          showIdentityDropdown(value);
                        }}
                        onFocus={(e) => showIdentityDropdown(e.target.value)}
                        onBlur={() => setTimeout(() => hideIdentityDropdown(), 300)} // ✅ Increased delay
                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        autoComplete="off"
                      />
                      {identitySearchLoading && (
                        <Loader2 className="absolute right-3 top-9 h-4 w-4 text-gray-400 animate-spin" />
                      )}
                      <div id="identity-dropdown" style={{ display: 'none' }}></div>
                      {form.formState.errors.identity_number && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.identity_number.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Full Name', 'Nama Lengkap')} *
                      </label>
                      <input
                        {...form.register('full_name')}
                        ref={fullNameInputRef}
                        type="text"
                        placeholder={getText("Enter your name", "Masukkan nama Anda")}
                        onChange={(e) => form.setValue('full_name', e.target.value, { shouldValidate: true })}
                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      {form.formState.errors.full_name && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.full_name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Phone Number', 'Nomor Telepon')} *
                      </label>
                      <input
                        {...form.register('phone_number')}
                        ref={phoneInputRef}
                        type="tel"
                        placeholder="08xxxxxxxxxx"
                        onChange={(e) => form.setValue('phone_number', e.target.value, { shouldValidate: true })}
                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      {form.formState.errors.phone_number && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.phone_number.message}</p>
                      )}
                    </div>

                    {/* ✅ FIXED: Study Program Dropdown */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Study Program', 'Program Studi')} *
                      </label>
                      <input
                        ref={studyProgramDisplayRef}
                        type="text"
                        placeholder={getText("Select study program", "Pilih program studi")}
                        onClick={showStudyProgramDropdown}
                        onFocus={showStudyProgramDropdown}
                        // ✅ Increased delay
                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                        readOnly
                      />
                      <ChevronDown className="absolute right-3 top-9 h-4 w-4 text-gray-400 pointer-events-none" />
                      <div id="study-program-dropdown" style={{ display: 'none' }}></div>
                      {form.formState.errors.study_program_id && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.study_program_id.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Equipment Summary in Sidebar */}
                {selectedRoom && watchEquipmentRequested && watchEquipmentRequested.length > 0 && (
                  <div className="border-t border-gray-200/50 pt-6">
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/50 rounded-lg p-4">
                      <h3 className="font-medium text-purple-800 mb-3 flex items-center">
                        <Package className="h-4 w-4 mr-2" />
                        {getText('Selected Equipment', 'Peralatan Dipilih')}
                      </h3>
                      <div className="space-y-2">
                        {watchEquipmentRequested.map(equipmentId => {
                          const equipment = availableEquipment.find(eq => eq.id === equipmentId);
                          const quantity = watchEquipmentQuantities?.[equipmentId] || 1;
                          const isMandatory = equipment?.is_mandatory;
                          
                          return (
                            <div key={equipmentId} className="flex items-center justify-between p-2 bg-white/80 rounded border border-purple-200/30">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-purple-900">{equipment?.name || 'Unknown'}</span>
                                {isMandatory && (
                                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                    {getText('Required', 'Wajib')}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm font-bold text-purple-800">
                                {quantity} {equipment?.unit || 'pcs'}
                              </span>
                            </div>
                          );
                        })}
                        <div className="border-t border-purple-200 pt-2 mt-2 flex justify-between items-center font-semibold text-purple-800">
                          <span>{getText('Total Items', 'Total Item')}</span>
                          <span>{getTotalEquipmentItems()} {getText('items', 'item')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUBMIT SECTION */}
                <div className="border-t border-gray-200/50 pt-6">
                  {!selectedRoom && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <p className="text-sm text-amber-800">{getText('Select a room first', 'Pilih ruangan terlebih dahulu')}</p>
                      </div>
                    </div>
                  )}

                  {/* Equipment Quantity Validation Errors */}
                  {watchEquipmentRequested && watchEquipmentRequested.length > 0 && (
                    <div className="mb-4">
                      {watchEquipmentRequested.map(equipmentId => {
                        const error = form.formState.errors.equipment_quantities?.[equipmentId];
                        if (!error) return null;
                        const equipment = availableEquipment.find(eq => eq.id === equipmentId);
                        return (
                          <div key={equipmentId} className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <p className="text-sm text-red-800">
                                <span className="font-medium">{equipment?.name}</span>: {error.message}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !selectedRoom}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>{getText('Submitting...', 'Mengirim...')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>{getText('Submit Booking', 'Kirim Pemesanan')}</span>
                      </>
                    )}
                  </button>

                  {/* Status Messages */}
                  {selectedRoom && (() => {
                    const roomStatus = getOptimizedRoomStatus(selectedRoom);
                    if (roomStatus.status === 'Conflict') {
                      return (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-sm text-orange-800">⚠️ {getText('Time conflict detected', 'Konflik waktu terdeteksi')}</p>
                        </div>
                      );
                    }
                    if (roomStatus.status === 'Scheduled') {
                      return (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">📅 {getText('Room has scheduled activities', 'Ruangan memiliki kegiatan terjadwal')}</p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Booking Process Information */}
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-2">
                          {getText('Attention!', 'Perhatian')}
                        </p>
                        <ul className="space-y-1 text-xs">
                          <li>• {getText('Leave Your ID Card Like Student ID or Citizenship ID to Admin', 'Tinggalkan Kartu Identitas keperti KTP/ KTM ke Admin ')}</li>
                          <li>• {getText('Follow The existing Procedure', 'Ikuti Prosedur yang sudah ada')}</li>
                          <li>• {getText('Do Your Booking Before get the Rooms Key', 'Lakukan Booking Sebelum Mengambil Kunci Ruangan')}</li>
                        </ul>
                        <div></div>
                        <hr></hr>
                        <h3><b>Contact Person  : 089604819029 (Muharom)</b></h3>
                      </div>
                    </div>
                  </div>
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
                {Array.isArray(scheduleModalRoom.targetDateBookings) && scheduleModalRoom.targetDateBookings.length > 0 && (
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
                            <div className="flex items-center text-sm text-orange-700">
                              <Target className="h-4 w-4 mr-2" />
                              <span>{booking.purpose || getText('No Purpose', 'Tidak Ada Tujuan')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lecture Schedules */}
                {Array.isArray(scheduleModalRoom.scheduleDetails?.lectures) && scheduleModalRoom.scheduleDetails.lectures.length > 0 && (
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
                            {lecture.lecturer_name && (
                              <div className="flex items-center text-sm text-blue-700">
                                <User className="h-4 w-4 mr-2" />
                                <span>{lecture.lecturer_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final Sessions */}
                {Array.isArray(scheduleModalRoom.scheduleDetails?.sessions) && scheduleModalRoom.scheduleDetails.sessions.length > 0 && (
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
                            {session.title && (
                              <div className="flex items-center text-sm text-purple-700">
                                <FileText className="h-4 w-4 mr-2" />
                                <span>{session.title}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exam Schedules */}
                {Array.isArray(scheduleModalRoom.scheduleDetails?.exams) && scheduleModalRoom.scheduleDetails.exams.length > 0 && (
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
                            {exam.exam_type && (
                              <div className="flex items-center text-sm text-green-700">
                                <FileText className="h-4 w-4 mr-2" />
                                <span>{exam.exam_type}</span>
                              </div>
                            )}
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

      {/* ✅ FIXED: Enhanced Cleanup Effect */}
      {React.useEffect(() => {
        return () => {
          // Cleanup identity dropdown
          const identityDropdown = document.querySelector('#identity-dropdown');
          if (identityDropdown) {
            identityDropdown.innerHTML = '';
            identityDropdown.style.display = 'none';
          }
          
          // Cleanup study program dropdown
          const studyProgramDropdown = document.querySelector('#study-program-dropdown');
          if (studyProgramDropdown) {
            studyProgramDropdown.innerHTML = '';
            studyProgramDropdown.style.display = 'none';
          }
          
          // ✅ Reset all state
          setIsIdentityDropdownOpen(false);
          setIsStudyProgramDropdownOpen(false);
          setIsRoomDropdownOpen(false);
          setRoomSearchTerm('');
          setSearchTerm('');
        };
      }, [])}

      {/* ✅ FIXED: Keyboard Navigation */}
      {React.useEffect(() => {
        const handleKeyDown = (e) => {
          // ESC to close dropdowns
          if (e.key === 'Escape') {
            if (isRoomDropdownOpen) {
              hideRoomDropdown();
            }
            if (isIdentityDropdownOpen) {
              hideIdentityDropdown();
            }
            if (isStudyProgramDropdownOpen) {
              hideStudyProgramDropdown();
            }
          }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
          document.removeEventListener('keydown', handleKeyDown);
        };
      }, [isRoomDropdownOpen, isIdentityDropdownOpen, isStudyProgramDropdownOpen, hideRoomDropdown, hideIdentityDropdown, hideStudyProgramDropdown])}
    </div>
  );
};

export default BookRoom;