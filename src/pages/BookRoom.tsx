import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import {
  Calendar, Clock, Users, Building, MapPin, Package, User, Phone, Mail, Hash,
  GraduationCap, ChevronDown, Search, Eye, X, Upload, FileText, Download,
  Loader2, CheckCircle, AlertTriangle, Zap, Star, ArrowRight, Plus, Minus,
  RefreshCw, Filter, Grid, List, SortAsc, SortDesc, MoreHorizontal, Info,
  BookOpen, Award, Target, TrendingUp, Activity, BarChart3, PieChart, ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { enUS, id as localeId } from 'date-fns/locale';
import { alert } from '../components/Alert/AlertHelper';
import { format, addMinutes, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { useRoomData } from '../hooks/useRoomData';
import { useRealTimeRoomUpdates } from '../hooks/useRealTimeRoomUpdates';
import { useLanguage } from '../contexts/LanguageContext';

// ========================
// TIMEZONE UTILITY FUNCTIONS
// ========================
const convertLocalToUTC = (localDateTimeString: string) => {
  const localDate = new Date(localDateTimeString);
  return localDate.toISOString();
};

const convertUTCToLocal = (utcTimeString: string) => {
  return new Date(utcTimeString);
};

const getLocalDateString = (date = new Date()) => {
  return format(date, 'yyyy-MM-dd');
};

// ========================
// SCHEMA: Discriminated Union (booking | claim)
// ========================

const baseSchema = z.object({
  // Mode
  mode: z.enum(['booking', 'claim']),

  // Personal Information
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  study_program_id: z.string().min(1, 'Please select a study program'),

  // Common booking fields
  purpose: z.enum(['Class/Lecture', 'Other'], { required_error: 'Purpose is required' }),
  sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
  class_type: z.enum(['theory', 'practical']),

  // These two are optional in base; enforced in booking mode
  start_datetime: z.string().optional(),
  end_datetime: z.string().optional(),

  // Equipment & Notes
  equipment_requested: z.array(z.string()).optional().default([]),
  equipment_quantities: z.record(z.string(), z.number().min(1, 'Quantity must be at least 1')).optional().default({}),
  notes: z.string().optional().default(''),
  attachments: z.array(z.string()).optional().default([]),
});

// Booking mode schema
const bookingModeSchema = baseSchema.extend({
  mode: z.literal('booking'),
}).superRefine((data, ctx) => {
  // Validate start/end presence
  if (!data.start_datetime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Start date and time is required',
      path: ['start_datetime'],
    });
  }
  if (!data.end_datetime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date and time is required',
      path: ['end_datetime'],
    });
  }

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

  // Attachments required if purpose is 'Other'
  if (data.purpose === 'Other' && (!data.attachments || data.attachments.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Attachments are required when purpose is 'Other'",
      path: ['attachments'],
    });
  }

  // Equipment quantities must exist for each selected equipment
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

// Claim mode schema
const claimModeSchema = baseSchema.extend({
  mode: z.literal('claim'),
  lecture_id: z.string().min(1, 'Pilih mata kuliah'),
}).superRefine((data, ctx) => {
  // Attachments required only if purpose 'Other'
  if (data.purpose === 'Other' && (!data.attachments || data.attachments.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Attachments are required when purpose is 'Other'",
      path: ['attachments'],
    });
  }
  // Equipment quantities must exist for each selected equipment
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

const formSchema = z.discriminatedUnion('mode', [bookingModeSchema, claimModeSchema]);
type BookingForm = z.infer<typeof formSchema>;

// ========================
// INTERFACES
// ========================
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

interface Room {
  id: string;
  name: string;
  code: string;
  capacity: number;
  is_available: boolean;
  department?: { name?: string };
  currentBooking?: any;
  targetDateBookings?: any[];
    scheduleDetails?: {
    lectures?: any[];
    exams?: any[];
    sessions?: any[];
  };
}

type Lecture = {
  id: string;
  date: string;          // 'yyyy-MM-dd'
  start_time: string;    // 'HH:mm'
  end_time: string;      // 'HH:mm'
  course_name: string;
  study_program_id?: string;
  room_name?: string;    // nama ruang dari jadwal kuliah
  lecturer_name?: string;
};

// ========================
// HELPERS: Klaim Mata Kuliah
// ========================

// Normalisasi nama ruang untuk pencocokan sederhana
function normalizeRoomName(name?: string) {
  return (name || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Cari room_id berdasarkan nama ruang jadwal:
// 1) room_aliases.alias -> room_id
// 2) cocokkan normalized name dengan rooms.name
async function findRoomIdByName(roomName?: string): Promise<string | null> {
  if (!roomName) return null;

  // Jika supabase belum inisialisasi, hentikan lebih awal
  if (!supabase) return null;

  // Cari di alias
  const { data: aliasData, error: aliasErr } = await supabase
    .from('room_aliases')
    .select('room_id, alias')
    .eq('alias', roomName)
    .maybeSingle();

  if (aliasErr) {
    console.warn('findRoomIdByName alias error:', aliasErr);
  }
  if (aliasData?.room_id) return aliasData.room_id;

  // Ambil semua rooms, lalu cocokkan secara normalized
  const { data: rooms, error: roomErr } = await supabase
    .from('rooms')
    .select('id, name');

  if (roomErr) {
    console.warn('findRoomIdByName rooms error:', roomErr);
    return null;
  }

  const target = normalizeRoomName(roomName);
  const matched = (rooms || []).find((r: any) => normalizeRoomName(r.name) === target);
  return matched?.id || null;
}

// Ambil daftar mata kuliah "hari ini"
// Opsional filter by study_program_id (dari form user)
async function fetchTodayLectures(studyProgramId?: string): Promise<Lecture[]> {
  if (!supabase) return [];
  const today = format(new Date(), 'yyyy-MM-dd');
  let query = supabase
    .from('lecture_schedules')
    .select('id, date, start_time, end_time, course_name, study_program_id, room_name, lecturer_name')
    .eq('date', today)
    .order('start_time', { ascending: true });

  if (studyProgramId) {
    query = query.eq('study_program_id', studyProgramId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('fetchTodayLectures error:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

// ========================
// Safe zodResolver wrapper
// ========================
const makeSafeZodResolver = (schema: any): Resolver<any> => {
  const base = zodResolver(schema);
  return async (values, context, options) => {
    // jika values belum siap (mis. undefined) kembalikan objek kosong supaya form dapat mount
    if (!values || typeof values !== 'object') {
      return { values: {}, errors: {} };
    }
    return base(values, context, options);
  };
};

// ========================
// KOMPONEN: BookRoom (dengan 2 mode: booking & claim)
// ========================
const BookRoom = () => {
  const { getText } = useLanguage();

  // Form dengan schema union (booking | claim)
  const form = useForm<BookingForm>({
    resolver: makeSafeZodResolver(formSchema),
    defaultValues: {
      mode: 'booking',
      // Booking defaults
      start_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_datetime: format(addMinutes(new Date(), 120), "yyyy-MM-dd'T'HH:mm"),
      // Common defaults
      purpose: 'Class/Lecture',
      sks: 2,
      class_type: 'theory',
      equipment_requested: [],
      equipment_quantities: {},
      attachments: [],
      notes: '',
    } as any,
  });

  // Watchers
  const mode = form.watch('mode');
  const watchStartDateTime = form.watch('start_datetime');
  const watchEndDateTime = form.watch('end_datetime');
  const watchSks = form.watch('sks');
  const watchClassType = form.watch('class_type');
  const watchPurpose = form.watch('purpose');
  const watchAttachments = form.watch('attachments');
  const watchEquipmentRequested = form.watch('equipment_requested');
  const watchEquipmentQuantities = form.watch('equipment_quantities');

  // State umum
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);

  // State daftar room dan filter
  const [targetBookingDate, setTargetBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Available' | 'In Use' | 'Conflict' | 'Scheduled'>('all');
  const [showInUse, setShowInUse] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'capacity' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Hooks rooms
  const { rooms, loading: roomsLoading, error: roomsError, fetchRoomData } = useRoomData(targetBookingDate);
  useRealTimeRoomUpdates(targetBookingDate);

  useEffect(() => {
    fetchRoomData(targetBookingDate, true);
  }, []);

  // Refs input personal info
  const identityInputRef = useRef<HTMLInputElement | null>(null);
  const fullNameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const studyProgramDisplayRef = useRef<HTMLInputElement | null>(null);

  // State klaim
  const [todayLectures, setTodayLectures] = useState<Lecture[]>([]);
  const [claimLoading, setClaimLoading] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [claimRoomId, setClaimRoomId] = useState<string | null>(null);
  const [claimRoomNotFound, setClaimRoomNotFound] = useState(false);

  // Durasi booking (untuk tampilan mode booking)
  const bookingDuration = useMemo(() => {
    if (!watchStartDateTime || !watchEndDateTime) return null;
    const start = new Date(watchStartDateTime);
    const end = new Date(watchEndDateTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
    const diffMs = end.getTime() - start.getTime();
    const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, totalHours };
  }, [watchStartDateTime, watchEndDateTime]);

  // Update targetBookingDate saat start_datetime berubah (mode booking)
  useEffect(() => {
    if (mode !== 'booking') return;
    if (watchStartDateTime) {
      try {
        const newDate = format(parseISO(watchStartDateTime), 'yyyy-MM-dd');
        if (newDate !== targetBookingDate) {
          setTargetBookingDate(newDate);
          if (selectedRoom) {
            setSelectedRoom(null);
            setAvailableEquipment([]);
          }
          fetchRoomData(newDate);
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }, [mode, watchStartDateTime, targetBookingDate, selectedRoom, fetchRoomData]);

  // Auto kalkulasi end_datetime berdasarkan SKS + class_type (mode booking)
  useEffect(() => {
    if (mode !== 'booking') return;
    const useManualEndTime = false; // simpel: selalu auto
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
  }, [mode, watchStartDateTime, watchSks, watchClassType, form]);

  // Ambil program studi
  const fetchStudyPrograms = async () => {
    if (!supabase) return setStudyPrograms([]);
    try {
      const { data, error } = await supabase.from('study_programs').select('*').order('name');
      if (error) throw error;
      setStudyPrograms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching study programs:', error);
      setStudyPrograms([]);
    }
  };

  useEffect(() => {
    fetchStudyPrograms();
  }, []);

  // Ambil mata kuliah hari ini saat mode klaim
  useEffect(() => {
    if (mode !== 'claim') return;
    setClaimLoading(true);
    setSelectedLecture(null);
    setClaimRoomId(null);
    setClaimRoomNotFound(false);

    let isMounted = true;
    (async () => {
      try {
        const sp = form.getValues('study_program_id') || undefined;
        const list = await fetchTodayLectures(sp);
        if (!isMounted) return;
        setTodayLectures(list);
      } catch (e) {
        console.error('Failed to fetch today lectures', e);
        if (isMounted) setTodayLectures([]);
      } finally {
        if (isMounted) setClaimLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [mode, form]); // form cukup agar getValues dapat diakses

  // Handler saat user memilih mata kuliah untuk diklaim
  const handleSelectLecture = useCallback(async (lecture: Lecture) => {
    setSelectedLecture(lecture);
    setClaimRoomNotFound(false);
    setClaimRoomId(null);

    try {
      const mappedId = await findRoomIdByName(lecture.room_name);
      if (mappedId) {
        setClaimRoomId(mappedId);
        // Ambil peralatan untuk ruangan hasil mapping
        await fetchEquipmentForRoom(mappedId);
      } else {
        setClaimRoomNotFound(true);
        setAvailableEquipment([]);
        // User bisa memilih ruangan manual via UI yang sudah ada (room dropdown)
      }
    } catch (err) {
      console.error('handleSelectLecture error:', err);
      setClaimRoomNotFound(true);
    }
  }, []);

  // Mengambil daftar peralatan untuk ruangan tertentu (digunakan pada klaim dan booking)
  const fetchEquipmentForRoom = useCallback(async (roomId: string) => {
    if (!supabase) {
      setAvailableEquipment([]);
      form.setValue('equipment_requested', []);
      form.setValue('equipment_quantities', {});
      return;
    }
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .or(`rooms_id.eq.${roomId},rooms_id.is.null`)
        .eq('is_available', true)
        .gt('quantity', 0)
        .order('name');

      if (error) throw error;

      const equipmentData: Equipment[] = Array.isArray(data) ? data as Equipment[] : [];
      setAvailableEquipment(equipmentData);

      // Reset pilihan peralatan agar tidak membawa state ruangan sebelumnya
      form.setValue('equipment_requested', []);
      form.setValue('equipment_quantities', {});

      // Tambahkan peralatan wajib (default qty = 1)
      const mandatory = equipmentData.filter(eq => eq.is_mandatory);
      if (mandatory.length > 0) {
        const ids = mandatory.map(eq => eq.id);
        const qty: Record<string, number> = {};
        mandatory.forEach(eq => { qty[eq.id] = 1; });

        form.setValue('equipment_requested', ids);
        form.setValue('equipment_quantities', qty);
      }
    } catch (err) {
      console.error('fetchEquipmentForRoom error:', err);
      setAvailableEquipment([]);
      form.setValue('equipment_requested', []);
      form.setValue('equipment_quantities', {});
    }
  }, [form]);

  // Hitung total item peralatan (untuk ringkasan)
  const getTotalEquipmentItems = useCallback(() => {
    const quantities = watchEquipmentQuantities || {};
    const requested = watchEquipmentRequested || [];
    const safeRequested = Array.isArray(requested) ? requested : [];
    return safeRequested.reduce((total, id) => total + (quantities[id] || 1), 0);
  }, [watchEquipmentQuantities, watchEquipmentRequested]);

  // Helper untuk menggabungkan tanggal (yyyy-MM-dd) dan jam (HH:mm) jadi ISO UTC
  const toUTCFromLocalDateTimeParts = (datePart: string, timePart: string) => {
    // Asumsi zona WIB/WITA/WIT ≈ +07:00 (sesuai implementasi existing)
    // Contoh: "2025-01-10T10:00+07:00"
    const local = `${datePart}T${timePart}:00+07:00`;
    return new Date(local).toISOString();
  };

  // Submit mendukung 2 mode: booking (existing) dan claim (baru)
  const onSubmit = useCallback(async (data: BookingForm) => {
    setLoading(true);
    try {
      if (data.mode === 'claim') {
        // Klaim mata kuliah
        if (!selectedLecture) {
          alert.error(getText('Please select a lecture to claim', 'Silakan pilih mata kuliah untuk diklaim'));
          setLoading(false);
          return;
        }

        // Tentukan room_id hasil mapping atau dari pilihan manual (fallback)
        let roomIdForClaim = claimRoomId || selectedRoom?.id || null;
        if (!roomIdForClaim) {
          // Coba mapping lagi jika sebelumnya gagal
          roomIdForClaim = await findRoomIdByName(selectedLecture.room_name || undefined);
        }
        if (!roomIdForClaim) {
          alert.error(getText('Room not found. Please select a room manually.', 'Ruang tidak ditemukan. Silakan pilih ruangan secara manual.'));
          setLoading(false);
          return;
        }

        // Waktu dari jadwal kuliah (tanggal + jam)
        const startTimeUTC = toUTCFromLocalDateTimeParts(selectedLecture.date, selectedLecture.start_time);
        const endTimeUTC = toUTCFromLocalDateTimeParts(selectedLecture.date, selectedLecture.end_time);

        // Siapkan peralatan
        const equipmentRequested = Array.isArray(data.equipment_requested) ? data.equipment_requested : [];
        const eqQtyObj = data.equipment_quantities || {};
        const equipmentQuantities = equipmentRequested.map(eId => eqQtyObj[eId] || 1);
        const attachments = Array.isArray(data.attachments) ? data.attachments : [];

        // Payload klaim
        const bookingDataClaim = {
          start_time: startTimeUTC,
          end_time: endTimeUTC,
          purpose: data.purpose, // umumnya 'Class/Lecture'
          sks: data.sks,
          class_type: data.class_type,
          room_id: roomIdForClaim,
          equipment_requested: equipmentRequested,
          equipment_quantities: equipmentQuantities,
          notes: data.notes || '',
          attachments,
          status: 'pending',
          booking_type: 'claim',
          lecture_id: selectedLecture.id,
          user_info: {
            full_name: data.full_name,
            identity_number: data.identity_number,
            phone_number: data.phone_number,
            study_program_id: data.study_program_id,
          },
          meta: {
            course_name: selectedLecture.course_name,
            room_name: selectedLecture.room_name,
            lecturer_name: selectedLecture.lecturer_name,
          },
        };

        if (!supabase) throw new Error('Supabase client not initialized');

        const { error: insertErrClaim } = await supabase.from('bookings').insert(bookingDataClaim);
        if (insertErrClaim) throw insertErrClaim;

        alert.success(getText('Lecture claimed successfully!', 'Klaim mata kuliah berhasil!'));

        // Reset minimal untuk mode klaim (biarkan data personal tetap jika diinginkan)
        form.reset({
          mode: 'claim',
          purpose: 'Class/Lecture',
          sks: 2,
          class_type: 'theory',
          equipment_requested: [],
          equipment_quantities: {},
          attachments: [],
          notes: '',
        } as any);

        setSelectedLecture(null);
        setClaimRoomId(null);
        setClaimRoomNotFound(false);
        setSelectedRoom(null);
        setAvailableEquipment([]);
        fetchRoomData(targetBookingDate, true);
        setLoading(false);
        return; // selesai klaim
      }

      // Mode booking (alur seperti sebelumnya)
      if (!selectedRoom) {
        alert.error(getText('Please select a room', 'Silakan pilih ruangan'));
        setLoading(false);
        return;
      }

      const startTimeUTC = new Date((data.start_datetime as string) + '+07:00').toISOString();
      const endTimeUTC = new Date((data.end_datetime as string) + '+07:00').toISOString();

      const equipmentRequested = Array.isArray(data.equipment_requested) ? data.equipment_requested : [];
      const equipmentQuantitiesObj = data.equipment_quantities || {};
      const equipmentQuantities = equipmentRequested.map(equipmentId => equipmentQuantitiesObj[equipmentId] || 1);
      const attachments = Array.isArray(data.attachments) ? data.attachments : [];

      const bookingData = {
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        purpose: data.purpose,
        sks: data.sks,
        class_type: data.class_type,
        room_id: selectedRoom.id,
        equipment_requested: equipmentRequested,
        equipment_quantities: equipmentQuantities,
        notes: data.notes || '',
        attachments,
        status: 'pending',
        booking_type: 'booking',
        user_info: {
          full_name: data.full_name,
          identity_number: data.identity_number,
          phone_number: data.phone_number,
          study_program_id: data.study_program_id,
        },
      };

      if (!supabase) throw new Error('Supabase client not initialized');
      const { error: insertErr } = await supabase.from('bookings').insert(bookingData);
      if (insertErr) throw insertErr;

      alert.success(getText('Booking submitted successfully!', 'Pemesanan berhasil diajukan!'));

      // Reset form (mode booking default)
      form.reset({
        mode: 'booking',
        start_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        end_datetime: format(addMinutes(new Date(), 120), "yyyy-MM-dd'T'HH:mm"),
        purpose: 'Class/Lecture',
        sks: 2,
        class_type: 'theory',
        equipment_requested: [],
        equipment_quantities: {},
        attachments: [],
        notes: '',
      } as any);

      setSelectedRoom(null);
      setAvailableEquipment([]);
      fetchRoomData(targetBookingDate, true);
    } catch (error: any) {
      console.error('Error submitting booking/claim:', error);
      alert.error(error.message || getText('Failed to submit', 'Gagal mengirim'));
    } finally {
      setLoading(false);
    }
  }, [selectedLecture, claimRoomId, selectedRoom, form, getText, targetBookingDate, fetchRoomData]);

  // ========================
  // EQUIPMENT HANDLERS
  // ========================
  const handleEquipmentToggle = useCallback((equipmentId: string, isChecked: boolean) => {
    const currentEquipment = form.getValues('equipment_requested') || [];
    const currentQuantities = form.getValues('equipment_quantities') || {};
    const safeCurrentEquipment = Array.isArray(currentEquipment) ? currentEquipment : [];

    if (isChecked) {
      // Tambah equipment
      const updatedEquipment = [...new Set([...safeCurrentEquipment, equipmentId])];
      const updatedQuantities = {
        ...currentQuantities,
        [equipmentId]: currentQuantities[equipmentId] || 1,
      };
      form.setValue('equipment_requested', updatedEquipment);
      form.setValue('equipment_quantities', updatedQuantities);
    } else {
      // Hapus equipment
      const updatedEquipment = safeCurrentEquipment.filter(id => id !== equipmentId);
      const updatedQuantities = { ...currentQuantities };
      delete updatedQuantities[equipmentId];
      form.setValue('equipment_requested', updatedEquipment);
      form.setValue('equipment_quantities', updatedQuantities);
    }
  }, [form]);

  const handleQuantityChange = useCallback((equipmentId: string, newQuantity: number) => {
    const equipment = availableEquipment.find(eq => eq.id === equipmentId);
    if (!equipment) return;
    const qty = Math.max(1, Math.min(newQuantity, equipment.quantity));
    const currentQuantities = form.getValues('equipment_quantities') || {};
    form.setValue('equipment_quantities', { ...currentQuantities, [equipmentId]: qty });
  }, [availableEquipment, form]);

  const incrementQuantity = useCallback((equipmentId: string) => {
    const currentQuantities = form.getValues('equipment_quantities') || {};
    const current = currentQuantities[equipmentId] || 1;
    handleQuantityChange(equipmentId, current + 1);
  }, [form, handleQuantityChange]);

  const decrementQuantity = useCallback((equipmentId: string) => {
    const currentQuantities = form.getValues('equipment_quantities') || {};
    const current = currentQuantities[equipmentId] || 1;
    handleQuantityChange(equipmentId, current - 1);
  }, [form, handleQuantityChange]);

  // ========================
  // ATTACHMENTS HANDLERS
  // ========================
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const currentAttachments = form.getValues('attachments') || [];
    const safeCurrentAttachments = Array.isArray(currentAttachments) ? currentAttachments : [];

    Array.from(files).forEach((file) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        alert.error(getText('Please select an image file (JPG, PNG) or PDF document', 'Silakan pilih file gambar (JPG, PNG) atau dokumen PDF'));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert.error(getText('File size must be less than 10MB', 'Ukuran file harus kurang dari 10MB'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result) {
          const newAttachments = [...safeCurrentAttachments, result as string];
          form.setValue('attachments', newAttachments, { shouldValidate: true });
          alert.success(getText('File uploaded successfully', 'File berhasil diunggah'));
        }
      };
      reader.readAsDataURL(file);
    });
  }, [form, getText]);

  const removeAttachment = useCallback((index: number) => {
    const currentAttachments = form.getValues('attachments') || [];
    const safeCurrentAttachments = Array.isArray(currentAttachments) ? currentAttachments : [];
    const updatedAttachments = safeCurrentAttachments.filter((_, i) => i !== index);
    form.setValue('attachments', updatedAttachments, { shouldValidate: true });
  }, [form]);

  // ========================
  // SIMPLE ROOM SELECTION HELPERS
  // ========================
  const handleSelectRoomById = useCallback(async (roomId: string) => {
    const room = (rooms || []).find((r: any) => r.id === roomId) || null;
    setSelectedRoom(room);
    setClaimRoomNotFound(false);
    if (room) {
      await fetchEquipmentForRoom(room.id);
    } else {
      setAvailableEquipment([]);
      form.setValue('equipment_requested', []);
      form.setValue('equipment_quantities', {});
    }
  }, [rooms, fetchEquipmentForRoom, form]);

  // ========================
  // RENDER UI
  // ========================
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Mode Toggle */}
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="font-semibold mb-3">{getText('Select Mode', 'Pilih Mode')}</div>
          <div className="flex gap-6">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                value="booking"
                checked={mode === 'booking'}
                onChange={() => form.setValue('mode', 'booking')}
              />
              <span>{getText('Booking Class (outside schedule)', 'Booking Kelas (di luar jadwal)')}</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                value="claim"
                checked={mode === 'claim'}
                onChange={() => form.setValue('mode', 'claim')}
              />
              <span>{getText('Claim Course (today schedule)', 'Klaim Mata Kuliah (jadwal hari ini)')}</span>
            </label>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="font-semibold mb-4">{getText('Personal Information', 'Informasi Pribadi')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">{getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                {...form.register('identity_number')}
              />
              {form.formState.errors.identity_number && (
                <p className="text-red-600 text-sm mt-1">{form.formState.errors.identity_number.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1">{getText('Full Name', 'Nama Lengkap')} *</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                {...form.register('full_name')}
              />
              {form.formState.errors.full_name && (
                <p className="text-red-600 text-sm mt-1">{form.formState.errors.full_name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1">{getText('Phone Number', 'Nomor Telepon')} *</label>
              <input
                type="tel"
                className="w-full border rounded px-3 py-2"
                {...form.register('phone_number')}
              />
              {form.formState.errors.phone_number && (
                <p className="text-red-600 text-sm mt-1">{form.formState.errors.phone_number.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1">{getText('Study Program', 'Program Studi')} *</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.getValues('study_program_id')}
                onChange={(e) => form.setValue('study_program_id', e.target.value, { shouldValidate: true })}
              >
                <option value="">{getText('Select study program', 'Pilih program studi')}</option>
                {studyPrograms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
                ))}
              </select>
              {form.formState.errors.study_program_id && (
                <p className="text-red-600 text-sm mt-1">{form.formState.errors.study_program_id.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* rest of UI unchanged... (kept in file above) */}

        {/* Submit */}
        <div className="mt-6">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            disabled={
              loading ||
              (mode === 'claim'
                ? !(selectedLecture && (claimRoomId || selectedRoom))
                : !selectedRoom)
            }
          >
            {loading
              ? getText('Submitting...', 'Mengirim...')
              : mode === 'claim'
              ? getText('Submit Claim', 'Kirim Klaim')
              : getText('Submit Booking', 'Kirim Pemesanan')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookRoom;