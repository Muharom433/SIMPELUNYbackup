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
import { useRoomData } from '../housadyauisdyhauisoks/useRoomData';
import { useRealTimeRoomUpdates } from '../hooks/useRealTimeRoomUpdates';
import { useLanguage } from '../contexts/LanguageContext';

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

const BookRoom: React.FC = () => {
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
      attachments: [],
    },
  });

  const watchStartDateTime = form.watch('start_datetime');
  const watchEndDateTime = form.watch('end_datetime');
  const watchSks = form.watch('sks');
  const watchClassType = form.watch('class_type');
  const watchPurpose = form.watch('purpose');
  const watchAttachments = form.watch('attachments');

  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNowFeedback, setShowNowFeedback] = useState(false);

  const [targetBookingDate, setTargetBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showInUse, setShowInUse] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'capacity' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalRoom, setScheduleModalRoom] = useState<any>(null);

  const { rooms, loading: roomsLoading, error: roomsError, fetchRoomData } = useRoomData(targetBookingDate);
  
  useRealTimeRoomUpdates(targetBookingDate);

  useEffect(() => {
    fetchRoomData(targetBookingDate, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const identityInputRef = useRef<HTMLInputElement>(null);
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const studyProgramDisplayRef = useRef<HTMLInputElement>(null);
  const [identitySearchResults, setIdentitySearchResults] = useState<User[]>([]);
  const [identitySearchLoading, setIdentitySearchLoading] = useState(false);

  const [useManualEndTime, setUseManualEndTime] = useState(false);

  const handleSetToNow = () => {
    const now = new Date();
    const formattedNow = format(now, "yyyy-MM-dd'T'HH:mm");
    form.setValue('start_datetime', formattedNow, { shouldValidate: true });

    setShowNowFeedback(true);
    setTimeout(() => setShowNowFeedback(false), 2000);
  };

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

  // 🎯 FIX: Logika status ruangan yang disempurnakan untuk mendeteksi konflik waktu
  const getOptimizedRoomStatus = useCallback((room: any) => {
    // 1. Cek apakah ruangan dinonaktifkan
    if (!room.is_available) {
      return {
        status: 'Unavailable',
        reason: 'Ruangan dinonaktifkan untuk pemesanan',
        color: 'bg-gray-100 text-gray-800 border-gray-200'
      };
    }

    // 2. Cek apakah sedang digunakan TEPAT SAAT INI (hanya jika melihat hari ini)
    const isToday = targetBookingDate === format(new Date(), 'yyyy-MM-dd');
    if (isToday && room.currentBooking) {
      const now = new Date();
      const bookingStart = parseISO(room.currentBooking.start_time);
      const bookingEnd = parseISO(room.currentBooking.end_time);
      if (now >= bookingStart && now <= bookingEnd) {
        return {
          status: 'In Use',
          reason: `Sedang digunakan oleh ${room.currentBooking.user?.full_name || 'Tidak diketahui'}`,
          color: 'bg-red-100 text-red-800 border-red-200',
          detail: room.currentBooking
        };
      }
    }

    // 3. Cek KONFLIK antara waktu yang dipilih pengguna dengan jadwal yang ada
    const userStartTime = watchStartDateTime ? parseISO(watchStartDateTime) : null;
    const userEndTime = watchEndDateTime ? parseISO(watchEndDateTime) : null;

    if (userStartTime && userEndTime && room.targetDateBookings?.length > 0) {
      for (const booking of room.targetDateBookings) {
        const existingStart = parseISO(booking.start_time);
        const existingEnd = parseISO(booking.end_time);
        // Kondisi tumpang tindih: (StartA < EndB) and (EndA > StartB)
        if (userStartTime < existingEnd && userEndTime > existingStart) {
          return {
            status: 'Conflict',
            reason: `Bertabrakan dengan jadwal pukul ${format(existingStart, 'HH:mm')} - ${format(existingEnd, 'HH:mm')}`,
            color: 'bg-orange-100 text-orange-800 border-orange-200'
          };
        }
      }
    }
    
    // 4. Cek apakah ada jadwal LAINNYA di hari itu (meskipun tidak konflik)
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
        scheduleCount: (room.scheduleDetails?.lectures?.length || 0) + (room.scheduleDetails?.exams?.length || 0) + (room.scheduleDetails?.sessions?.length || 0) + (room.targetDateBookings?.length || 0)
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

  const showIdentityDropdown = useCallback((searchTerm: string) => {
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
          (dropdownContainer as HTMLElement).style.display = 'block';
          dropdownContainer.querySelectorAll('.identity-dropdown-item').forEach(item => {
            item.addEventListener('mousedown', (e) => e.preventDefault());
            item.addEventListener('click', (e) => {
              const target = e.currentTarget as HTMLElement;
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
      (dropdownContainer as HTMLElement).style.display = 'none';
    }
  }, []);

  const showStudyProgramDropdown = useCallback(() => {
    const dropdownHTML = `<div class="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden"><div class="p-3 border-b border-gray-100"><input type="text" placeholder="${getText("Search programs...", "Cari program studi...")}" class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" id="program-search-input" autocomplete="off"/></div><div class="max-h-60 overflow-y-auto" id="program-list">${studyPrograms.map(program => `<div class="program-dropdown-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150" data-program-id="${program.id}" data-program-name="${program.name}" data-program-code="${program.code || ''}"><div class="font-semibold text-gray-800">${program.name} (${program.code || ''})</div></div>`).join('')}</div></div>`;
    const dropdownContainer = document.querySelector('#study-program-dropdown');
    if (dropdownContainer) {
      dropdownContainer.innerHTML = dropdownHTML;
      (dropdownContainer as HTMLElement).style.display = 'block';
      const searchInput = dropdownContainer.querySelector('#program-search-input') as HTMLInputElement;
      const programList = dropdownContainer.querySelector('#program-list');
      if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', (e) => {
          const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
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
        const target = e.currentTarget as HTMLElement;
        const programId = target.dataset.programId;
        const programName = target.dataset.programName;
        const programCode = target.dataset.programCode;
        if (studyProgramDisplayRef.current) {
          studyProgramDisplayRef.current.value = `${programName} (${programCode})`;
        }
        form.setValue('study_program_id', programId || '');
        hideStudyProgramDropdown();
      });
    });
  }, [form]);

  const hideStudyProgramDropdown = useCallback(() => {
    const dropdownContainer = document.querySelector('#study-program-dropdown');
    if (dropdownContainer) {
      (dropdownContainer as HTMLElement).style.display = 'none';
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

  const fetchEquipmentForRoom = async (roomId: string) => {
    try {
      const { data, error } = await supabase.from('equipment').select('*').or(`rooms_id.eq.${roomId},rooms_id.is.null`).or('is_mandatory.eq.true,quantity.gt.1').order('name');
      if (error) throw error;
      setAvailableEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      setAvailableEquipment([]);
    }
  };

  const handleRoomSelect = (room: any) => {
    setSelectedRoom(room);
    fetchEquipmentForRoom(room.id);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const currentAttachments = form.getValues('attachments') || [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        form.setValue('attachments', [...currentAttachments, result], { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    const currentAttachments = form.getValues('attachments') || [];
    const updatedAttachments = currentAttachments.filter((_, i) => i !== index);
    form.setValue('attachments', updatedAttachments, { shouldValidate: true });
  };

  useEffect(() => {
    fetchStudyPrograms();
  }, []);

  const onSubmit = async (data: BookingForm) => {
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
      const bookingData = {
        start_time: data.start_datetime,
        end_time: data.end_datetime,
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
      const successMessage = roomStatus.status === 'In Use' ? getText('Late booking submitted successfully! Previous booking marked as completed.', 'Pemesanan terlambat berhasil diajukan! Pemesanan sebelumnya ditandai selesai.') : getText('Booking submitted successfully!', 'Pemesanan berhasil diajukan!');
      alert.success(successMessage);
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
    } catch (error: any) {
      console.error('Error submitting booking:', error);
      alert.error(error.message || getText('Failed to submit booking', 'Gagal mengajukan pemesanan'));
    } finally {
      setLoading(false);
    }
  };



      {showScheduleModal && scheduleModalRoom && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"><div className="p-6"><div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold text-gray-900">{getText('Schedule Details', 'Detail Jadwal')} - {scheduleModalRoom.name}</h3><button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors duration-200"><X className="h-6 w-6" /></button></div><div className="space-y-6">{scheduleModalRoom.targetDateBookings?.length > 0 && (<div><h4 className="font-medium text-gray-900 mb-3 flex items-center"><Calendar className="h-5 w-5 mr-2 text-orange-600" />{getText('Active Bookings', 'Pemesanan Aktif')}</h4><div className="space-y-2">{scheduleModalRoom.targetDateBookings.map((booking: any, index: number) => (<div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg"><p className="font-medium text-orange-900">{booking.purpose}</p><p className="text-sm text-orange-700">{booking.user?.full_name} • {booking.user?.identity_number}</p><p className="text-xs text-orange-600">{format(parseISO(booking.start_time), 'HH:mm')} - {format(parseISO(booking.end_time), 'HH:mm')}</p></div>))}</div></div>)}{scheduleModalRoom.scheduleDetails?.lectures?.length > 0 && (<div><h4 className="font-medium text-gray-900 mb-3 flex items-center"><BookOpen className="h-5 w-5 mr-2 text-blue-600" />{getText('Lecture Schedules', 'Jadwal Kuliah')}</h4><div className="space-y-2">{scheduleModalRoom.scheduleDetails.lectures.map((lecture: any, index: number) => (<div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg"><p className="font-medium text-blue-900">{lecture.course_name}</p><p className="text-sm text-blue-700">{lecture.class} • {lecture.subject_study}</p><p className="text-xs text-blue-600">{lecture.start_time} - {lecture.end_time}</p></div>))}</div></div>)}{scheduleModalRoom.scheduleDetails?.exams?.length > 0 && (<div><h4 className="font-medium text-gray-900 mb-3 flex items-center"><GraduationCap className="h-5 w-5 mr-2 text-green-600" />{getText('Exam Schedules', 'Jadwal Ujian')}</h4><div className="space-y-2">{scheduleModalRoom.scheduleDetails.exams.map((exam: any, index: number) => (<div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg"><p className="font-medium text-green-900">{exam.course_name}</p><p className="text-sm text-green-700">{exam.course_code} • {getText('Class:', 'Kelas:')} {exam.class}</p><p className="text-xs text-green-600">{exam.start_time} - {exam.end_time} • {exam.student_amount} {getText('students', 'mahasiswa')}</p></div>))}</div></div>)}{scheduleModalRoom.scheduleDetails?.sessions?.length > 0 && (<div><h4 className="font-medium text-gray-900 mb-3 flex items-center"><Users className="h-5 w-5 mr-2 text-purple-600" />{getText('Final Sessions', 'Sidang Akhir')}</h4><div className="space-y-2">{scheduleModalRoom.scheduleDetails.sessions.map((session: any, index: number) => (<div key={index} className="p-3 bg-purple-50 border border-purple-200 rounded-lg"><p className="font-medium text-purple-900">{session.title}</p><p className="text-sm text-purple-700">{session.supervisor} • {session.examiner}</p><p className="text-xs text-purple-600">{session.start_time} - {session.end_time}</p></div>))}</div></div>)}{(!scheduleModalRoom.targetDateBookings?.length && !scheduleModalRoom.scheduleDetails?.lectures?.length && !scheduleModalRoom.scheduleDetails?.exams?.length && !scheduleModalRoom.scheduleDetails?.sessions?.length) && (<div className="text-center py-8"><div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center"><Calendar className="h-8 w-8 text-gray-400" /></div><h3 className="text-lg font-semibold text-gray-800 mb-2">{getText('No Schedule for This Date', 'Tidak Ada Jadwal untuk Tanggal Ini')}</h3><p className="text-gray-500">{getText('This room is available for booking on the selected date.', 'Ruangan ini tersedia untuk dipesan pada tanggal yang dipilih.')}</p></div>)}</div></div></div></div>)}

      {roomsLoading && (<div className="fixed top-4 right-4 z-50"><div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">{getText('Loading rooms...', 'Memuat ruangan...')}</span></div></div>)}

      {React.useEffect(() => {
        return () => {
          const identityDropdown = document.querySelector('#identity-dropdown');
          const studyProgramDropdown = document.querySelector('#study-program-dropdown');
          if (identityDropdown) {
            identityDropdown.innerHTML = '';
            (identityDropdown as HTMLElement).style.display = 'none';
          }
          if (studyProgramDropdown) {
            studyProgramDropdown.innerHTML = '';
            (studyProgramDropdown as HTMLElement).style.display = 'none';
          }
        };
      }, [])}
    </div>
  );
};

export default BookRoom;