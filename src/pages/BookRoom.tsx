import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { parseISO, format, differenceInMinutes } from "date-fns";
import { id } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Building,
  AlertTriangle,
  ChevronDown,
  Search,
  Users,
  Eye,
  User,
  CheckCircle,
  Info,
  X,
  BookOpen,
  GraduationCap,
  RefreshCw,
  CalendarIcon,
  UserCheck,
  Filter,
  ChevronUp,
  Loader2,
  ClipboardList,
  AlertCircle,
  Settings,
  Upload,
  FileText,
  Camera,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { alert } from '../components/Alert/AlertHelper';
import { useLanguage } from "../contexts/LanguageContext";

type Booking = {
  id: string;
  start_time: string;
  end_time: string;
  purpose?: string;
  status?: string;
  user_info?: any;
  attachments?: string[];
  user?: { full_name?: string; identity_number?: string };
};

type ScheduleDetails = {
  lectures?: any[];
  exams?: any[];
  sessions?: any[];
};

type Room = {
  id: string;
  name: string;
  code?: string;
  capacity?: number;
  faculty?: string;
  building?: string;
  department?: { id: string; name: string; } | null;
  targetDateBookings?: Booking[];
  scheduleDetails?: ScheduleDetails;
  inUse?: boolean;
  is_available?: boolean;
};

type FormValues = {
  start_datetime?: string;
  end_datetime?: string;
  sks?: number;
  class_type?: string;
  purpose?: string;
  identity_number?: string;
  full_name?: string;
  phone_number?: string;
  study_program_id?: string;
  room_id?: string;
  attachments?: string[];
};

type LectureSchedule = {
  id: string;
  room: string;
  day: string;
  start_time: string;
  end_time: string;
  course_name: string;
  course_code: string;
  class: string;
  subject_study: string;
  lecturer?: string;
  semester?: number;
};

interface CombinedSchedule {
  id: string;
  type: 'lecture' | 'exam' | 'session' | 'booking';
  start_time: string;
  end_time: string;
  title: string;
  subtitle?: string;
  description?: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
}

// Custom DateTime Picker Modal Component
const DateTimePickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (datetime: string) => void;
  value?: string;
  label: string;
}> = ({ isOpen, onClose, onSelect, value, label }) => {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const { getText } = useLanguage();

  useEffect(() => {
    if (value) {
      try {
        const datetime = new Date(value);
        setDate(format(datetime, 'yyyy-MM-dd'));
        setTime(format(datetime, 'HH:mm'));
      } catch {
        const now = new Date();
        setDate(format(now, 'yyyy-MM-dd'));
        setTime(format(now, 'HH:mm'));
      }
    } else {
      const now = new Date();
      setDate(format(now, 'yyyy-MM-dd'));
      setTime(format(now, 'HH:mm'));
    }
  }, [value, isOpen]);

  const handleConfirm = () => {
    if (date && time) {
      const datetime = `${date}T${time}`;
      onSelect(datetime);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">{label}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('Date', 'Tanggal')}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('Time (24 Hour Format)', 'Waktu (Format 24 Jam)')}
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              step="60"
            />
            <p className="text-xs text-gray-500 mt-1">
              {getText('Format: 00:00 - 23:59', 'Format: 00:00 - 23:59')}
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {getText('Cancel', 'Batal')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
          >
            {getText('Confirm', 'Konfirmasi')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions
const getLocalDateString = (date = new Date()) => {
  return format(date, 'yyyy-MM-dd');
};

const formatDateTime = (iso?: string) => {
  const { getText } = useLanguage();
  if (!iso) return getText("Not set", "Belum diatur");
  try {
    const date = parseISO(iso);
    return format(date, 'dd/MM/yyyy HH:mm', { locale: id });
  } catch {
    return getText("Not set", "Belum diatur");
  }
};

const formatTime = (iso?: string) => {
  if (!iso) return "-";
  try {
    return format(parseISO(iso), "HH:mm");
  } catch {
    return iso;
  }
};

const BookRoom: React.FC = () => {
  const { getText } = useLanguage();
  const { register, handleSubmit, setValue, getValues, watch, formState: { errors }, reset } = useForm<FormValues>({
    defaultValues: {
      sks: 3,
      class_type: "theory",
      purpose: "Class/Lecture",
      attachments: [],
    },
  });

  const [activeTab, setActiveTab] = useState<'course' | 'normal'>('course');
  const [showSKSField, setShowSKSField] = useState(false);
  const [todaySchedules, setTodaySchedules] = useState<LectureSchedule[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<LectureSchedule | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [showPendingBookings, setShowPendingBookings] = useState(false);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [loadingPendingBookings, setLoadingPendingBookings] = useState(false);
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInUse, setShowInUse] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalRoom, setScheduleModalRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [identitySuggestions, setIdentitySuggestions] = useState<any[]>([]);
  const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
  const [combinedSchedules, setCombinedSchedules] = useState<CombinedSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [targetDate, setTargetDate] = useState(getLocalDateString());
  
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [studyPrograms, setStudyPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const identityInputRef = useRef<HTMLInputElement | null>(null);
  const fullNameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const startDateTime = watch("start_datetime");
  const endDateTime = watch("end_datetime");
  const sks = watch("sks");
  const classType = watch("class_type");
  const watchPurpose = watch("purpose");
  const watchAttachments = watch("attachments");

  // Get today's day name in Indonesian
  const getTodayDayName = () => {
    const today = new Date();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return dayNames[today.getDay()];
  };

  // File handling functions
  const getFileTypeIcon = (attachment: string) => {
    if (attachment.startsWith('data:application/pdf')) {
      return <FileText className="h-4 w-4 text-red-600" />;
    } else if (attachment.startsWith('data:image/')) {
      return <Camera className="h-4 w-4 text-amber-600" />;
    } else {
      return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getFileName = (attachment: string, index: number) => {
    if (attachment.startsWith('data:application/pdf')) {
      return `Document_${index + 1}.pdf`;
    } else if (attachment.startsWith('data:image/')) {
      return `Image_${index + 1}.jpg`;
    } else {
      return `File_${index + 1}`;
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    const currentAttachments = getValues('attachments') || [];
    
    Array.from(files).forEach((file) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        alert.error(
          getText('Please select an image or PDF file', 'Silakan pilih file gambar atau PDF'),
          ""
        );
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert.error(
          getText('File size must be less than 10MB', 'Ukuran file harus kurang dari 10MB'),
          ""
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          const newAttachments = [...currentAttachments, result];
          setValue('attachments', newAttachments);
          alert.success(
            getText('File uploaded successfully', 'File berhasil diunggah'),
            ""
          );
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    const currentAttachments = getValues('attachments') || [];
    const updatedAttachments = currentAttachments.filter((_, i) => i !== index);
    setValue('attachments', updatedAttachments);
  };

  // Fetch today's lecture schedules
  const fetchTodayLectures = async () => {
    setLoadingCourses(true);
    try {
      const todayDay = getTodayDayName();
      
      const { data, error } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', todayDay)
        .order('start_time');

      if (error) throw error;
      
      setTodaySchedules(data || []);
    } catch (error) {
      console.error("Error fetching today's lectures:", error);
      alert.error(getText("Failed to load today's lecture schedule", "Gagal memuat jadwal kuliah hari ini"), "");
    } finally {
      setLoadingCourses(false);
    }
  };

  // Fetch pending bookings for current user
  const fetchPendingBookings = async () => {
    const identityNumber = getValues("identity_number");
    if (!identityNumber) return;

    setLoadingPendingBookings(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('identity_number', identityNumber)
        .single();

      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id,
          start_time,
          end_time,
          purpose,
          status,
          room_id,
          user_info,
          attachments,
          rooms (
            name,
            code
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (userData) {
        bookingsQuery = bookingsQuery.eq('user_id', userData.id);
      } else {
        bookingsQuery = bookingsQuery.contains('user_info', { identity_number: identityNumber });
      }

      const { data, error } = await bookingsQuery;

      if (error) throw error;

      setPendingBookings(data || []);
    } catch (error) {
      console.error("Error fetching pending bookings:", error);
    } finally {
      setLoadingPendingBookings(false);
    }
  };

  // Fetch study programs
  useEffect(() => {
    fetchStudyPrograms();
    fetchTodayLectures();
  }, []);

  async function fetchStudyPrograms() {
    try {
      const { data, error } = await supabase
        .from('study_programs')
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setStudyPrograms(data || []);
    } catch (err) {
      console.error("Error fetching study programs:", err);
    }
  }

  // Enhanced room fetching with complete schedule checking
  async function fetchRooms(selectedDate: string) {
    setLoadingRooms(true);
    try {
      const { data: roomsData, error } = await supabase
        .from('rooms')
        .select(`
          id,
          name,
          code,
          capacity,
          is_available,
          department_id,
          departments (
            id,
            name,
            code
          )
        `)
        .eq('is_available', true)
        .order('name', { ascending: true });

      if (error) throw error;

      if (!roomsData || roomsData.length === 0) {
        setRooms([]);
        return;
      }

      const mappedRooms: Room[] = roomsData.map((room: any) => ({
        id: room.id,
        name: room.name,
        code: room.code,
        capacity: room.capacity,
        is_available: room.is_available,
        faculty: room.departments?.name || getText("General", "Umum"),
        building: room.departments?.name || "",
        department: room.departments ? {
          id: room.departments.id,
          name: room.departments.name
        } : null,
        inUse: false,
        targetDateBookings: [],
        scheduleDetails: {
          lectures: [],
          exams: [],
          sessions: []
        },
      }));

      // Fetch all schedule data
      await Promise.all([
        fetchRoomBookings(mappedRooms, selectedDate),
        fetchLectureSchedules(mappedRooms, selectedDate),
        fetchExamSchedules(mappedRooms, selectedDate),
        fetchSessionSchedules(mappedRooms, selectedDate)
      ]);

    } catch (err) {
      console.error("Error loading rooms:", err);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }

  // Fetch lecture schedules
  async function fetchLectureSchedules(roomsList: Room[], selectedDate: string) {
    try {
      const targetDateObj = new Date(selectedDate);
      const dayNamesIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayNameIndonesian = dayNamesIndonesian[targetDateObj.getDay()];

      const { data: lectureData, error } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', dayNameIndonesian);

      if (error) throw error;
      if (!lectureData) return;

      const updatedRooms = roomsList.map(room => {
        const roomLectures = lectureData.filter(lecture => 
          lecture.room && lecture.room.toLowerCase().includes(room.name.toLowerCase())
        );
        
        return {
          ...room,
          scheduleDetails: {
            ...room.scheduleDetails,
            lectures: roomLectures
          }
        };
      });

      setRooms(updatedRooms);
    } catch (err) {
      console.error("Error fetching lecture schedules:", err);
    }
  }

  // Fetch exam schedules
  async function fetchExamSchedules(roomsList: Room[], selectedDate: string) {
    try {
      const { data: examData, error } = await supabase
        .from('exams')
        .select('*')
        .eq('date', selectedDate);

      if (error) throw error;
      if (!examData) return;

      const examsByRoom: { [key: string]: any[] } = {};
      examData.forEach(exam => {
        if (!examsByRoom[exam.room_id]) {
          examsByRoom[exam.room_id] = [];
        }
        examsByRoom[exam.room_id].push(exam);
      });

      setRooms(prev => prev.map(room => ({
        ...room,
        scheduleDetails: {
          ...room.scheduleDetails,
          exams: examsByRoom[room.id] || []
        }
      })));
    } catch (err) {
      console.error("Error fetching exam schedules:", err);
    }
  }

  // Fetch session schedules (final sessions)
  async function fetchSessionSchedules(roomsList: Room[], selectedDate: string) {
    try {
      const { data: sessionData, error } = await supabase
        .from('final_sessions')
        .select('*')
        .eq('date', selectedDate);

      if (error) throw error;
      if (!sessionData) return;

      const sessionsByRoom: { [key: string]: any[] } = {};
      sessionData.forEach(session => {
        if (!sessionsByRoom[session.room_id]) {
          sessionsByRoom[session.room_id] = [];
        }
        sessionsByRoom[session.room_id].push(session);
      });

      setRooms(prev => prev.map(room => ({
        ...room,
        scheduleDetails: {
          ...room.scheduleDetails,
          sessions: sessionsByRoom[room.id] || []
        }
      })));
    } catch (err) {
      console.error("Error fetching session schedules:", err);
    }
  }

  // Fetch bookings for rooms on selected date
  async function fetchRoomBookings(roomsList: Room[], selectedDate: string) {
    try {
      const date = new Date(selectedDate);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(date.setHours(23, 59, 59, 999)).toISOString();

      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select(`
          id,
          start_time,
          end_time,
          purpose,
          room_id,
          status,
          users (
            full_name,
            identity_number
          )
        `)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .in('status', ['approved', 'pending', 'borrowed']);

      if (error) throw error;
      if (!bookingsData) return;

      const bookingsByRoom: { [key: string]: Booking[] } = {};
      bookingsData.forEach((booking: any) => {
        const mappedBooking: Booking = {
          id: booking.id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          purpose: booking.purpose,
          user: {
            full_name: booking.users?.full_name || getText("Unknown", "Tidak diketahui"),
            identity_number: booking.users?.identity_number || "",
          },
        };

        if (!bookingsByRoom[booking.room_id]) {
          bookingsByRoom[booking.room_id] = [];
        }
        bookingsByRoom[booking.room_id].push(mappedBooking);
      });

      const updatedRooms = roomsList.map(room => ({
        ...room,
        targetDateBookings: bookingsByRoom[room.id] || [],
        inUse: (bookingsByRoom[room.id] || []).length > 0,
      }));

      setRooms(updatedRooms);

    } catch (err) {
      console.error("Error fetching room bookings:", err);
      setRooms(roomsList);
    }
  }

  // Fetch schedules for room detail modal
  const fetchSchedulesForRoom = async (roomName: string, roomId: string, selectedDate: string) => {
    setLoadingSchedules(true);
    try {
      const combined: CombinedSchedule[] = [];
      const targetDateObj = new Date(selectedDate);
      
      const dayNamesIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayNameIndonesian = dayNamesIndonesian[targetDateObj.getDay()];

      // 1. Fetch lecture schedules
      const { data: lectureData, error: lectureError } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', dayNameIndonesian)
        .ilike('room', `%${roomName}%`)
        .order('start_time');

      if (!lectureError && lectureData) {
        lectureData.forEach(lecture => {
          combined.push({
            id: lecture.id,
            type: 'lecture',
            start_time: lecture.start_time?.substring(0, 5) || '',
            end_time: lecture.end_time?.substring(0, 5) || '',
            title: lecture.course_name || getText('Lecture', 'Kuliah'),
            subtitle: `${getText('Class', 'Kelas')} ${lecture.class} • ${lecture.subject_study}`,
            description: `${getText('Lecturer', 'Dosen')}: ${lecture.lecturer || 'TBA'} • ${getText('Semester', 'Semester')} ${lecture.semester}`,
            icon: BookOpen,
            color: 'text-blue-700',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
          });
        });
      }

      // 2. Fetch exam schedules
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', selectedDate)
        .order('start_time');

      if (!examError && examData) {
        examData.forEach(exam => {
          combined.push({
            id: exam.id,
            type: 'exam',
            start_time: exam.is_take_home ? getText('Take Home', 'Take Home') : exam.start_time?.substring(0, 5) || '',
            end_time: exam.is_take_home ? '' : exam.end_time?.substring(0, 5) || '',
            title: `${exam.course_name || getText('UAS Exam', 'Ujian UAS')}`,
            subtitle: `${exam.student_amount} ${getText('students', 'mahasiswa')} • ${getText('Semester', 'Semester')} ${exam.semester}`,
            description: `${getText('Class', 'Kelas')} ${exam.class} • ${getText('Inspector', 'Pengawas')}: ${exam.inspector}`,
            icon: GraduationCap,
            color: 'text-green-700',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
          });
        });
      }

      // 3. Fetch final sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('final_sessions')
        .select(`
          *,
          student:users!student_id(full_name, identity_number)
        `)
        .eq('room_id', roomId)
        .eq('date', selectedDate)
        .order('start_time');

      if (!sessionError && sessionData) {
        sessionData.forEach(session => {
          combined.push({
            id: session.id,
            type: 'session',
            start_time: session.start_time?.substring(0, 5) || '',
            end_time: session.end_time?.substring(0, 5) || '',
            title: `${session.student?.full_name || getText('Final Session', 'Sidang Akhir')}`,
            subtitle: `ID: ${session.student?.identity_number}`,
            description: `${getText('Supervisor', 'Pembimbing')}: ${session.supervisor} • ${getText('Examiner', 'Penguji')}: ${session.examiner}`,
            icon: UserCheck,
            color: 'text-purple-700',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
          });
        });
      }

      // 4. Fetch bookings
      const startOfDay = `${selectedDate}T00:00:00Z`;
      const endOfDay = `${selectedDate}T23:59:59Z`;

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          user:users!user_id(full_name, identity_number)
        `)
        .eq('room_id', roomId)
        .in('status', ['approved', 'borrowed'])
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time');

      if (!bookingError && bookingData) {
        bookingData.forEach(booking => {
          const startDate = new Date(booking.start_time);
          const endDate = new Date(booking.end_time);

          combined.push({
            id: booking.id,
            type: 'booking',
            start_time: format(startDate, 'HH:mm'),
            end_time: format(endDate, 'HH:mm'),
            title: `${booking.purpose || getText('Room Booking', 'Pemesanan Ruangan')}`,
            subtitle: `${booking.user?.full_name} • ${booking.user?.identity_number}`,
            description: `${getText('Status', 'Status')}: ${getText('APPROVED', 'DISETUJUI')}`,
            icon: CalendarIcon,
            color: 'text-orange-700',
            bgColor: 'bg-orange-50',
            borderColor: 'border-orange-200'
          });
        });
      }

      combined.sort((a, b) => {
        const aTime = a.start_time === getText('Take Home', 'Take Home') ? '00:00' : a.start_time;
        const bTime = b.start_time === getText('Take Home', 'Take Home') ? '00:00' : b.start_time;
        return aTime.localeCompare(bTime);
      });
      setCombinedSchedules(combined);

    } catch (error) {
      console.error('Error fetching schedules:', error);
      alert.error(getText("Failed to load schedule for this room.", "Gagal memuat jadwal untuk ruangan ini."));
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'normal') {
      fetchRooms(targetDate);
    }
  }, [targetDate, activeTab]);

  useEffect(() => {
    if (scheduleModalRoom) {
      fetchSchedulesForRoom(scheduleModalRoom.name, scheduleModalRoom.id, targetDate);
    }
  }, [scheduleModalRoom, targetDate]);

  // Auto-calculate end time when SKS is shown
  useEffect(() => {
    if (activeTab === 'normal' && showSKSField && startDateTime && sks && classType) {
      try {
        const start = new Date(startDateTime);
        if (!isNaN(start.getTime())) {
          const minutesPerSKS = classType === "theory" ? 50 : 170;
          const totalMinutes = sks * minutesPerSKS;
          const endTime = new Date(start.getTime() + totalMinutes * 60000);
          const formattedEndTime = format(endTime, "yyyy-MM-dd'T'HH:mm");
          setValue("end_datetime", formattedEndTime);
          
          const newDate = format(start, 'yyyy-MM-dd');
          if (newDate !== targetDate) {
            setTargetDate(newDate);
          }
        }
      } catch (err) {
        console.error("Error calculating end time:", err);
      }
    }
  }, [startDateTime, sks, classType, setValue, activeTab, showSKSField]);

  const bookingDuration = useMemo(() => {
    const s = getValues("start_datetime");
    const e = getValues("end_datetime");
    if (!s || !e) return null;
    try {
      const start = new Date(s);
      const end = new Date(e);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
      const minutes = differenceInMinutes(end, start);
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return { totalMinutes: minutes, totalHours: hrs, remainderMinutes: mins };
    } catch {
      return null;
    }
  }, [startDateTime, endDateTime]);

  // ENHANCED: Improved room status checking with complete schedule validation
  function getOptimizedRoomStatus(room: Room) {
    if (!room.is_available) {
      return { 
        status: "Unavailable", 
        reason: getText("Room is disabled", "Ruangan dinonaktifkan"), 
        color: "bg-gray-100 text-gray-800 border-gray-200",
        hasSchedule: false,
        isAvailable: false
      };
    }

    const s = getValues("start_datetime");
    const e = getValues("end_datetime");
    
    const hasScheduledContent = (room.targetDateBookings && room.targetDateBookings.length > 0) ||
                                (room.scheduleDetails?.lectures && room.scheduleDetails.lectures.length > 0) ||
                                (room.scheduleDetails?.exams && room.scheduleDetails.exams.length > 0) ||
                                (room.scheduleDetails?.sessions && room.scheduleDetails.sessions.length > 0);
    
    if (!s || !e) {
      if (hasScheduledContent) {
        return { 
          status: "Scheduled", 
          reason: getText("Room has scheduled activities", "Ruangan memiliki aktivitas terjadwal"),
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          hasSchedule: true,
          isAvailable: false
        };
      }
      return { 
        status: "Available", 
        reason: "",
        color: "bg-green-100 text-green-800 border-green-200",
        hasSchedule: false,
        isAvailable: true
      };
    }

    try {
      const start = new Date(s);
      const end = new Date(e);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return { 
          status: "Unavailable", 
          reason: getText("Invalid date/time", "Tanggal/waktu tidak valid"), 
          color: "bg-gray-100 text-gray-800 border-gray-200",
          hasSchedule: false,
          isAvailable: false
        };
      }

      // Check if room is available for the selected time slot
      const isAvailable = isRoomAvailableForTimeSlot(room, s, e);
      
      if (!isAvailable) {
        return { 
          status: "Conflict", 
          reason: getText("Time conflict with existing schedule", "Bentrok dengan jadwal yang ada"),
          color: "bg-red-100 text-red-800 border-red-200",
          hasSchedule: true,
          isAvailable: false
        };
      }

      return { 
        status: "Available", 
        reason: "",
        color: "bg-green-100 text-green-800 border-green-200",
        hasSchedule: hasScheduledContent,
        isAvailable: true
      };
    } catch {
      return { 
        status: "Unavailable", 
        reason: getText("Error processing schedule", "Error memproses jadwal"), 
        color: "bg-gray-100 text-gray-800 border-gray-200",
        hasSchedule: false,
        isAvailable: false
      };
    }
  }

  async function searchIdentity(value: string) {
    if (value.length < 3) {
      setIdentitySuggestions([]);
      setShowIdentityDropdown(false);
      setIsManualEntry(true);
      return;
    }

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id,
          identity_number,
          full_name,
          phone_number,
          study_program_id,
          study_programs (
            id,
            name,
            code
          )
        `)
        .or(`identity_number.ilike.%${value}%,full_name.ilike.%${value}%`)
        .limit(10);

      if (error) throw error;

      if (!users || users.length === 0) {
        setIdentitySuggestions([]);
        setShowIdentityDropdown(false);
        setIsManualEntry(true);
        
        if (fullNameInputRef.current) fullNameInputRef.current.disabled = false;
        if (phoneInputRef.current) phoneInputRef.current.disabled = false;
        
        return;
      }

      const mappedUsers = users.map((user: any) => ({
        id: user.id,
        identity_number: user.identity_number,
        full_name: user.full_name,
        phone_number: user.phone_number || "",
        study_program: user.study_programs?.name || "",
        study_program_id: user.study_program_id || "",
      }));

      setIdentitySuggestions(mappedUsers);
      setShowIdentityDropdown(true);
      setIsManualEntry(false);

    } catch (err) {
      console.error("Error fetching identity suggestions:", err);
      setIdentitySuggestions([]);
      setShowIdentityDropdown(false);
      setIsManualEntry(true);
    }
  }

  function selectIdentity(user: any) {
    setValue("identity_number", user.identity_number);
    setValue("full_name", user.full_name);
    setValue("phone_number", user.phone_number);
    setValue("study_program_id", user.study_program_id);

    if (identityInputRef.current) identityInputRef.current.value = user.identity_number;
    if (fullNameInputRef.current) {
      fullNameInputRef.current.value = user.full_name;
      fullNameInputRef.current.disabled = true;
    }
    if (phoneInputRef.current) {
      phoneInputRef.current.value = user.phone_number;
      phoneInputRef.current.disabled = true;
    }

    setSelectedProgram(user.study_program);
    setShowIdentityDropdown(false);
    setIdentitySuggestions([]);
    setIsManualEntry(false);
    
    setTimeout(() => {
      fetchPendingBookings();
    }, 100);
  }

  // ENHANCED: Complete room availability check
  function isRoomAvailableForTimeSlot(room: Room, startTime: string, endTime: string): boolean {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return false;
      }

      // Adjust for timezone (subtract 7 hours for database check)
      const dbStart = new Date(start);
      const dbEnd = new Date(end);
      dbStart.setHours(dbStart.getHours() - 7);
      dbEnd.setHours(dbEnd.getHours() - 7);

      // 1. Check booking conflicts (these are already in UTC in database)
      if (room.targetDateBookings && room.targetDateBookings.length > 0) {
        const hasConflict = room.targetDateBookings.some((booking) => {
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);
          
          // Add 7 hours to convert from database UTC to local time
          bookingStart.setHours(bookingStart.getHours() + 7);
          bookingEnd.setHours(bookingEnd.getHours() + 7);
          
          return !(end <= bookingStart || start >= bookingEnd);
        });
        if (hasConflict) return false;
      }

      // 2. Check lecture schedule conflicts
      if (room.scheduleDetails?.lectures && room.scheduleDetails.lectures.length > 0) {
        const hasConflict = room.scheduleDetails.lectures.some((lecture) => {
          try {
            // Parse lecture times (format: "HH:mm:ss")
            const [lectureStartHour, lectureStartMin] = lecture.start_time.split(':').map(Number);
            const [lectureEndHour, lectureEndMin] = lecture.end_time.split(':').map(Number);
            
            // Create date objects for today with lecture times
            const lectureStart = new Date(start);
            lectureStart.setHours(lectureStartHour, lectureStartMin, 0, 0);
            
            const lectureEnd = new Date(start);
            lectureEnd.setHours(lectureEndHour, lectureEndMin, 0, 0);
            
            return !(end <= lectureStart || start >= lectureEnd);
          } catch {
            return false;
          }
        });
        if (hasConflict) return false;
      }

      // 3. Check exam schedule conflicts
      if (room.scheduleDetails?.exams && room.scheduleDetails.exams.length > 0) {
        const hasConflict = room.scheduleDetails.exams.some((exam) => {
          try {
            // Parse exam times (format: "HH:mm:ss")
            const [examStartHour, examStartMin] = exam.start_time.split(':').map(Number);
            const [examEndHour, examEndMin] = exam.end_time.split(':').map(Number);
            
            // Create date objects for today with exam times
            const examStart = new Date(start);
            examStart.setHours(examStartHour, examStartMin, 0, 0);
            
            const examEnd = new Date(start);
            examEnd.setHours(examEndHour, examEndMin, 0, 0);
            
            return !(end <= examStart || start >= examEnd);
          } catch {
            return false;
          }
        });
        if (hasConflict) return false;
      }

      // 4. Check session schedule conflicts (final sessions)
      if (room.scheduleDetails?.sessions && room.scheduleDetails.sessions.length > 0) {
        const hasConflict = room.scheduleDetails.sessions.some((session) => {
          try {
            // Parse session times (format: "HH:mm:ss")
            const [sessionStartHour, sessionStartMin] = session.start_time.split(':').map(Number);
            const [sessionEndHour, sessionEndMin] = session.end_time.split(':').map(Number);
            
            // Create date objects for today with session times
            const sessionStart = new Date(start);
            sessionStart.setHours(sessionStartHour, sessionStartMin, 0, 0);
            
            const sessionEnd = new Date(start);
            sessionEnd.setHours(sessionEndHour, sessionEndMin, 0, 0);
            
            return !(end <= sessionStart || start >= sessionEnd);
          } catch {
            return false;
          }
        });
        if (hasConflict) return false;
      }

      return true;
    } catch (error) {
      console.error("Error checking room availability:", error);
      return false;
    }
  }

  // Helper function untuk ambil tipe ruangan dari nama ruangan
  function getRoomType(roomName: string): string {
    const name = roomName.toUpperCase();
    if (name.includes('GK')) return 'GK';
    if (name.includes('GLA')) return 'GLA';
    if (name.includes('LAB')) return 'Lab';
    if (name.includes('KULIAH') || name.includes('KELAS')) return 'Kuliah';
    return 'Other';
  }

  // Helper function untuk dapatkan prioritas tipe ruangan
  function getRoomTypePriority(roomType: string): number {
    const priorityMap: { [key: string]: number } = {
      'GK': 1,
      'GLA': 2,
      'Kuliah': 3,
      'Lab': 4,
      'Other': 5
    };
    return priorityMap[roomType] || 5;
  }

  // ENHANCED: Filtered rooms untuk tab normal - hanya tampilkan yang available
  const filteredAndSortedRooms = useMemo(() => {
    let filtered = rooms;

    // Apply search filter
    if (searchTerm && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(room => {
        const roomName = (room.name || '').toLowerCase();
        const roomCode = (room.code || '').toLowerCase();
        const deptName = (room.department?.name || '').toLowerCase();
        const building = (room.building || '').toLowerCase();
        
        return roomName.includes(searchLower) || 
               roomCode.includes(searchLower) || 
               deptName.includes(searchLower) ||
               building.includes(searchLower);
      });
    }

    // Filter by in-use status
    if (!showInUse) {
      filtered = filtered.filter(room => !room.inUse);
    }

    // IMPORTANT: For "normal" tab with selected time, only show available rooms
    if (activeTab === 'normal' && startDateTime && endDateTime) {
      // Filter to only show available rooms
      filtered = filtered.filter(room => {
        const status = getOptimizedRoomStatus(room);
        return status.isAvailable === true;
      });

      // Sort available rooms by type and capacity
      filtered.sort((a, b) => {
        // Priority 1: Room type (GK > GLA > Kuliah > Lab)
        const aType = getRoomType(a.name);
        const bType = getRoomType(b.name);
        const aTypePriority = getRoomTypePriority(aType);
        const bTypePriority = getRoomTypePriority(bType);
        
        if (aTypePriority !== bTypePriority) {
          return aTypePriority - bTypePriority;
        }

        // Priority 2: Capacity (large to small)
        return (b.capacity ?? 0) - (a.capacity ?? 0);
      });
    } else {
      // Default sorting when time is not selected
      filtered.sort((a, b) => {
        const statusA = getOptimizedRoomStatus(a).status;
        const statusB = getOptimizedRoomStatus(b).status;
        
        if (statusA === statusB) {
          return (b.capacity ?? 0) - (a.capacity ?? 0);
        }
        
        const priority: { [key: string]: number } = {
          'Available': 1,
          'Scheduled': 2, 
          'Conflict': 3,
          'Unavailable': 4
        };
        
        return (priority[statusA] || 5) - (priority[statusB] || 5);
      });
    }

    return filtered;
  }, [rooms, searchTerm, showInUse, startDateTime, endDateTime, activeTab]);

  const filteredCourses = useMemo(() => {
    if (!courseSearch) return todaySchedules;
    
    const searchLower = courseSearch.toLowerCase();
    return todaySchedules.filter(schedule => 
      schedule.course_name?.toLowerCase().includes(searchLower) ||
      schedule.course_code?.toLowerCase().includes(searchLower) ||
      schedule.lecturer?.toLowerCase().includes(searchLower) ||
      schedule.subject_study?.toLowerCase().includes(searchLower)
    );
  }, [todaySchedules, courseSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowIdentityDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleIdentityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setValue("identity_number", value);
    
    if (value.length === 0) {
      setValue("full_name", "");
      setValue("phone_number", "");
      setValue("study_program_id", "");
      if (fullNameInputRef.current) {
        fullNameInputRef.current.value = "";
        fullNameInputRef.current.disabled = false;
      }
      if (phoneInputRef.current) {
        phoneInputRef.current.value = "";
        phoneInputRef.current.disabled = false;
      }
      setSelectedProgram(null);
      setIsManualEntry(false);
      setPendingBookings([]);
    } else {
      searchIdentity(value);
    }
  }

  function handleRoomSelect(room: Room) {
    // Check if room is available before selecting
    const status = getOptimizedRoomStatus(room);
    if (!status.isAvailable) {
      alert.error(
        getText("This room is not available for the selected time", "Ruangan ini tidak tersedia untuk waktu yang dipilih"),
        ""
      );
      return;
    }
    
    setSelectedRoom(room);
    setValue("room_id", room.id);
  }

  function handleCourseSelect(course: LectureSchedule) {
    setSelectedCourse(course);
    
    const today = getLocalDateString();
    const startTime = `${today}T${course.start_time}`;
    const endTime = `${today}T${course.end_time}`;
    
    setValue("start_datetime", startTime);
    setValue("end_datetime", endTime);
    setValue("purpose", `${course.course_name} - ${course.class}`);
    
    const matchedRoom = rooms.find(room => 
      room.name.toLowerCase().includes(course.room.toLowerCase())
    );
    
    if (matchedRoom) {
      setSelectedRoom(matchedRoom);
      setValue("room_id", matchedRoom.id);
    }
  }

  // Submit handler dengan pengurangan 7 jam untuk database
  const onSubmit = async (data: FormValues) => {
    // Validation for 'Other' purpose
    if (data.purpose === 'Other' && (!data.attachments || data.attachments.length === 0)) {
      alert.error(
        getText("Please attach supporting documents for 'Other' purpose", "Silakan lampirkan dokumen pendukung untuk tujuan 'Lainnya'"),
        ""
      );
      return;
    }
    
    if (activeTab === 'course' && !selectedCourse) {
      alert.error(getText("Please select a course first", "Pilih mata kuliah terlebih dahulu"), "");
      return;
    }
    
    if (activeTab === 'normal' && !selectedRoom) {
      alert.error(getText("Please select a room first", "Pilih ruangan terlebih dahulu"), "");
      return;
    }
    
    setLoading(true);
    try {
      let userId = null;
      let roomId = data.room_id;
      
      if (activeTab === 'course' && selectedCourse) {
        const matchedRoom = rooms.find(room => 
          room.name.toLowerCase().includes(selectedCourse.room.toLowerCase())
        );
        if (!matchedRoom) {
          throw new Error(getText("Room for the course not found", "Ruangan untuk mata kuliah tidak ditemukan"));
        }
        roomId = matchedRoom.id;
      }
      
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('identity_number', data.identity_number)
        .single();

      userId = existingUser?.id || null;

      // Kurangi 7 jam dari waktu input sebelum kirim ke DB
      const adjustMinus7Hours = (dateStr: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        // Kurangi 7 jam
        date.setHours(date.getHours() - 7);
        return format(date, "yyyy-MM-dd'T'HH:mm:ss'+00'");
      };

      const startTimeISO = data.start_datetime ? adjustMinus7Hours(data.start_datetime) : null;
      const endTimeISO = data.end_datetime ? adjustMinus7Hours(data.end_datetime) : null;

      const bookingData = {
        room_id: roomId,
        user_id: userId,
        start_time: startTimeISO,
        end_time: endTimeISO,
        purpose: data.purpose,
        sks: showSKSField ? data.sks : null,
        class_type: showSKSField ? data.class_type : null,
        status: 'pending',
        attachments: data.attachments || [],
        user_info: {
          identity_number: data.identity_number,
          full_name: data.full_name,
          phone_number: data.phone_number,
          study_program_id: data.study_program_id
        }
      };
      
      const { error } = await supabase.from('bookings').insert(bookingData);
      if (error) throw error;
      
      alert.success(getText("Booking request sent successfully!", "Pemesanan berhasil dikirim!"), "");
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err: any) {
      console.error("Booking error:", err);
      alert.error(err.message || getText("Failed to send booking", "Gagal mengirim pemesanan"), "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
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
                  <div className="text-2xl font-bold text-gray-800">
                    {activeTab === 'course' ? filteredCourses.length : filteredAndSortedRooms.length}
                  </div>
                  <div className="text-sm text-gray-500">
                    {activeTab === 'course' 
                      ? getText("Today's Courses", 'Mata Kuliah Hari Ini') 
                      : getText('Available Rooms', 'Ruangan Tersedia')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-lg border border-white/20 mb-6">
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => setActiveTab('course')}
                className={`flex-1 px-6 py-4 text-center font-medium transition-all ${
                  activeTab === 'course'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <BookOpen className="h-5 w-5" />
                  <span>{getText("Same as SIAKAD Schedule", 'Sesuai Jadwal SIAKAD')}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('normal')}
                className={`flex-1 px-6 py-4 text-center font-medium transition-all ${
                  activeTab === 'normal'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <CalendarIcon className="h-5 w-5" />
                  <span>{getText('Booking for a new schedule', 'Booking Diluar Jadwal')}</span>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 relative z-20">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 space-y-8">
                  {/* Course Selection Tab */}
                  {activeTab === 'course' && (
                    <>
                      <div>
                        <div className="flex items-center space-x-3 mb-6">
                          <BookOpen className="h-6 w-6 text-blue-600" />
                          <h2 className="text-xl font-bold text-gray-800">
                            {getText(`Select Today's Course (${getTodayDayName()})`, `Pilih Mata Kuliah Hari Ini (${getTodayDayName()})`)}
                          </h2>
                        </div>

                        <div className="mb-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder={getText("Search course name, code, or lecturer...", "Cari nama mata kuliah, kode, atau dosen...")}
                              className="w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              value={courseSearch}
                              onChange={(e) => setCourseSearch(e.target.value)}
                            />
                          </div>
                        </div>

                        {selectedCourse && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-blue-800 font-medium">
                                  {getText('Selected Course:', 'Mata Kuliah Dipilih:')} {selectedCourse.course_name}
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                  {selectedCourse.course_code} • {getText('Class', 'Kelas')} {selectedCourse.class} • {selectedCourse.room}
                                </p>
                                <p className="text-xs text-blue-600">
                                  {getText('Time:', 'Jam:')} {selectedCourse.start_time} - {selectedCourse.end_time} • 
                                  {getText('Lecturer:', 'Dosen:')} {selectedCourse.lecturer || 'TBA'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCourse(null);
                                  setValue("start_datetime", "");
                                  setValue("end_datetime", "");
                                  setValue("purpose", "");
                                  setSelectedRoom(null);
                                  setValue("room_id", "");
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {loadingCourses ? (
                            <div className="text-center py-8">
                              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                              <p className="text-gray-600">{getText('Loading course schedule...', 'Memuat jadwal kuliah...')}</p>
                            </div>
                          ) : filteredCourses.length === 0 ? (
                            <div className="text-center py-8">
                              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600">
                                {courseSearch 
                                  ? getText('No courses match your search', 'Tidak ada mata kuliah yang cocok dengan pencarian')
                                  : getText('No courses today', 'Tidak ada mata kuliah hari ini')}
                              </p>
                            </div>
                          ) : (
                            filteredCourses.map((course) => {
                              const isSelected = selectedCourse?.id === course.id;
                              const cardClasses = `p-4 rounded-lg border-2 transition-all duration-200 ${
                                isSelected 
                                  ? "border-blue-500 bg-blue-50" 
                                  : "cursor-pointer hover:shadow-md hover:border-blue-300 border-gray-200 bg-white/50"
                              }`;
                              
                              return (
                                <div 
                                  key={course.id} 
                                  className={cardClasses} 
                                  onClick={() => handleCourseSelect(course)}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-gray-900">
                                        {course.course_name}
                                      </h4>
                                      <p className="text-sm text-gray-600 mt-1">
                                        {course.course_code} • {getText('Class', 'Kelas')} {course.class}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        {course.subject_study} • {getText('Semester', 'Semester')} {course.semester}
                                      </p>
                                      <div className="flex items-center space-x-4 mt-2 text-sm">
                                        <div className="flex items-center space-x-1">
                                          <Clock className="h-4 w-4 text-gray-400" />
                                          <span className="text-gray-600">
                                            {course.start_time} - {course.end_time}
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                          <Building className="h-4 w-4 text-gray-400" />
                                          <span className="text-gray-600">{course.room}</span>
                                        </div>
                                      </div>
                                      {course.lecturer && (
                                        <p className="text-sm text-gray-500 mt-1">
                                          {getText('Lecturer:', 'Dosen:')} {course.lecturer}
                                        </p>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <div className="ml-2">
                                        <CheckCircle className="h-6 w-6 text-blue-600" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center space-x-2 text-sm text-yellow-800">
                            <AlertCircle className="h-4 w-4" />
                            <span>{getText("Booking only for today's courses. Room will be automatically selected according to the schedule.", "Booking hanya untuk mata kuliah hari ini. Ruangan akan otomatis dipilih sesuai jadwal.")}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Normal Booking Tab */}
                  {activeTab === 'normal' && (
                    <>
                      <div>
                        <div className="flex items-center space-x-3 mb-6">
                          <Calendar className="h-6 w-6 text-blue-600" />
                          <h2 className="text-xl font-bold text-gray-800">{getText('Booking Details', 'Detail Pemesanan')}</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {getText('Date & Start Time', 'Tanggal & Waktu Mulai')} *
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowStartDatePicker(true)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <CalendarIcon className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-700">
                                  {formatDateTime(startDateTime)}
                                </span>
                              </div>
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            </button>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {getText('Date & End Time', 'Tanggal & Waktu Selesai')} *
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowEndDatePicker(true)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <CalendarIcon className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-700">
                                  {formatDateTime(endDateTime)}
                                </span>
                              </div>
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            </button>
                          </div>

                          {/* SKS Toggle Button */}
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={() => setShowSKSField(!showSKSField)}
                              className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Settings className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {showSKSField 
                                  ? getText('Hide SKS Settings', 'Sembunyikan Pengaturan SKS')
                                  : getText('Show SKS Settings (Optional)', 'Tampilkan Pengaturan SKS (Opsional)')}
                              </span>
                              {showSKSField ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>

                          {/* SKS Fields - Only shown when toggled */}
                          {showSKSField && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  {getText('SKS (Credits)', 'SKS (Kredit)')} *
                                </label>
                                <select 
                                  {...register("sks" as any)} 
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
                                  {...register("class_type" as any)} 
                                  className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                  <option value="theory">{getText('Theory (50 minutes/SKS)', 'Teori (50 menit/SKS)')}</option>
                                  <option value="practical">{getText('Practical (170 minutes/SKS)', 'Praktik (170 menit/SKS)')}</option>
                                </select>
                              </div>
                            </>
                          )}

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {getText('Purpose', 'Tujuan')} *
                            </label>
                            <select {...register("purpose" as any)} className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                              <option value="Class/Lecture">{getText('Lecture', 'Kuliah')}</option>
                              <option value="Other">{getText('Other', 'Lainnya')}</option>
                            </select>
                          </div>

                          {/* Document Attachment for "Other" purpose */}
                          {watchPurpose === 'Other' && (
                            <div className="md:col-span-2">
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-4">
                                <div className="flex items-center space-x-2">
                                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                  <h3 className="font-medium text-yellow-900">
                                    {getText('Supporting Documents Required', 'Dokumen Pendukung Diperlukan')}
                                  </h3>
                                </div>
                                
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*,.pdf"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="file-upload"
                                  />
                                  <label htmlFor="file-upload" className="cursor-pointer">
                                    <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                                      {getText('Upload Files', 'Unggah File')}
                                    </span>
                                  </label>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {getText('PDF, JPG, PNG up to 10MB', 'PDF, JPG, PNG hingga 10MB')}
                                  </p>
                                </div>

                                {watchAttachments && watchAttachments.length > 0 && (
                                  <div className="space-y-2">
                                    {watchAttachments.map((attachment, index) => (
                                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                                        <div className="flex items-center space-x-2">
                                          {getFileTypeIcon(attachment)}
                                          <span className="text-sm">{getFileName(attachment, index)}</span>
                                        </div>
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

                        {/* Info: Only available rooms will be shown */}
                        {startDateTime && endDateTime && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center space-x-2 text-sm text-blue-800">
                              <Info className="h-4 w-4" />
                              <span>
                                {getText(
                                  'Only rooms without schedule conflicts will be displayed below',
                                  'Hanya ruangan tanpa bentrok jadwal yang akan ditampilkan di bawah'
                                )}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center space-x-2 text-sm text-green-800">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">
                              {getText('Duration:', 'Durasi:')} {bookingDuration?.totalHours ? `${bookingDuration.totalHours} ${getText('hours', 'jam')} ${bookingDuration.remainderMinutes} ${getText('minutes', 'menit')}` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-gray-200/50 pt-8">
                        <div className="flex items-center space-x-3 mb-6">
                          <Building className="h-6 w-6 text-green-600" />
                          <h2 className="text-xl font-bold text-gray-800">{getText('Select Room', 'Pilih Ruangan')}</h2>
                          {startDateTime && endDateTime && (
                            <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium">
                              {filteredAndSortedRooms.length} {getText('available', 'tersedia')}
                            </span>
                          )}
                        </div>

                        {selectedRoom && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-blue-800 font-medium">
                                  {getText('Selected Room:', 'Ruangan Dipilih:')} {selectedRoom.name} ({selectedRoom.code})
                                </p>
                                <p className="text-xs text-blue-600">
                                  {getText('Capacity:', 'Kapasitas:')} {selectedRoom.capacity} {getText('seats', 'kursi')}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRoom(null);
                                  setValue("room_id", "");
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {!selectedRoom && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className="h-5 w-5 text-amber-600" />
                              <p className="text-sm text-amber-800 font-medium">
                                {getText('Please select a room to continue', 'Silakan pilih ruangan untuk melanjutkan')}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="relative mb-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder={getText("Search room (name, code, or building)...", "Cari ruangan (nama, kode, atau gedung)...")}
                              className="w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                          {searchTerm && (
                            <p className="text-xs text-gray-500 mt-1">
                              {getText('Found', 'Ditemukan')} {filteredAndSortedRooms.length} {getText('rooms', 'ruangan')}
                            </p>
                          )}
                        </div>

                        {/* Room list - only showing available rooms when time is selected */}
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {loadingRooms ? (
                            <div className="text-center py-8">
                              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                              <p className="text-gray-600">{getText('Loading rooms...', 'Memuat ruangan...')}</p>
                            </div>
                          ) : filteredAndSortedRooms.length === 0 ? (
                            <div className="text-center py-8">
                              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600">
                                {startDateTime && endDateTime
                                  ? getText('No available rooms for the selected time', 'Tidak ada ruangan tersedia untuk waktu yang dipilih')
                                  : searchTerm 
                                    ? getText('No rooms match your search', 'Tidak ada ruangan yang cocok dengan pencarian')
                                    : getText('Please select date and time first', 'Silakan pilih tanggal dan waktu terlebih dahulu')}
                              </p>
                            </div>
                          ) : (
                            filteredAndSortedRooms.map((room) => {
                              const status = getOptimizedRoomStatus(room);
                              const isAvailable = status.isAvailable;
                              const isSelected = selectedRoom?.id === room.id;
                              const cardClasses = `p-4 rounded-lg border-2 transition-all duration-200 ${
                                isSelected ? "border-blue-500 bg-blue-50" : 
                                !isAvailable ? "opacity-60 cursor-not-allowed border-gray-200" : 
                                "cursor-pointer hover:shadow-md hover:border-blue-300 border-gray-200"
                              } bg-white/50`;
                              
                              return (
                                <div key={room.id} className={cardClasses} onClick={() => isAvailable && handleRoomSelect(room)}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <h4 className="font-semibold text-gray-900">{room.name}</h4>
                                      <p className="text-sm text-gray-600">
                                        {room.code ? `${getText('Code:', 'Kode:')} ${room.code}` : ''} 
                                        {room.department?.name ? ` • ${room.department.name}` : ''}
                                      </p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                                      {getText(status.status, status.status)}
                                    </span>
                                  </div>

                                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                                    <div className="flex items-center space-x-1">
                                      <Users className="h-4 w-4" />
                                      <span>{room.capacity ?? 0} {getText('seats', 'kursi')}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Building className="h-4 w-4" />
                                      <span>{room.department?.name || getText('General', 'Umum')}</span>
                                    </div>
                                    {status.hasSchedule && (
                                      <button 
                                        type="button" 
                                        className="text-blue-600 hover:text-blue-800 flex items-center space-x-1" 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setScheduleModalRoom(room); 
                                          setShowScheduleModal(true); 
                                        }}
                                        title={getText("View Schedule", "Lihat Jadwal")}
                                      >
                                        <Eye className="h-4 w-4" />
                                        <span className="text-xs">{getText('Schedule', 'Jadwal')}</span>
                                      </button>
                                    )}
                                  </div>

                                  {status.reason && (
                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                      <p className="text-xs text-yellow-800">
                                        <Calendar className="h-3 w-3 inline mr-1" />
                                        {status.reason}
                                      </p>
                                    </div>
                                  )}

                                  {isSelected && (
                                    <div className="mt-2 p-2 bg-blue-100 border border-blue-300 rounded">
                                      <p className="text-xs text-blue-800 font-medium">
                                        ✓ {getText('Room selected', 'Ruangan dipilih')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="lg:col-span-1 relative z-10">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 space-y-6">
                  <div>
                    <div className="flex items-center space-x-3 mb-6">
                      <User className="h-6 w-6 text-purple-600" />
                      <h2 className="text-xl font-bold text-gray-800">{getText('Personal Information', 'Informasi Pribadi')}</h2>
                    </div>

                    <div className="space-y-4">
                      <div className="relative" ref={dropdownRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                        </label>
                        <input
                          ref={identityInputRef}
                          type="text"
                          defaultValue=""
                          onChange={handleIdentityChange}
                          placeholder={getText("Enter your ID", "Masukkan ID Anda")}
                          autoComplete="off"
                          className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                        
                        {showIdentityDropdown && identitySuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {identitySuggestions.map((user, idx) => (
                              <div
                                key={idx}
                                onClick={() => selectIdentity(user)}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{user.full_name}</div>
                                <div className="text-sm text-gray-600">{user.identity_number}</div>
                                <div className="text-xs text-gray-500">{user.study_program}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {isManualEntry && (
                          <p className="mt-1 text-xs text-blue-600">
                            {getText('Data not found. Please fill manually.', 'Data tidak ditemukan. Silakan isi manual.')}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Full Name', 'Nama Lengkap')} *
                        </label>
                        <input
                          ref={fullNameInputRef}
                          type="text"
                          defaultValue=""
                          onChange={(e) => setValue("full_name", e.target.value)}
                          placeholder={getText("Enter your full name", "Masukkan nama lengkap")}
                          className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Phone Number', 'Nomor Telepon')} *
                        </label>
                        <input
                          ref={phoneInputRef}
                          type="tel"
                          defaultValue=""
                          onChange={(e) => setValue("phone_number", e.target.value)}
                          placeholder="08xxxxxxxxxx"
                          className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Study Program', 'Program Studi')} *
                        </label>
                        {isManualEntry ? (
                          <select
                            onChange={(e) => setValue("study_program_id", e.target.value)}
                            className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <option value="">{getText('Select Study Program', 'Pilih Program Studi')}</option>
                            {studyPrograms.map((program) => (
                              <option key={program.id} value={program.id}>
                                {program.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            readOnly
                            value={selectedProgram || ""}
                            placeholder={getText("Study program will be filled automatically", "Program studi akan terisi otomatis")}
                            className="w-full px-3 py-2 bg-gray-100 border border-gray-200/50 rounded-lg shadow-sm cursor-not-allowed"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Show Pending Bookings Toggle */}
                  {getValues("identity_number") && (
                    <div className="border-t border-gray-200/50 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPendingBookings(!showPendingBookings);
                          if (!showPendingBookings) {
                            fetchPendingBookings();
                          }
                        }}
                        className="w-full flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <ClipboardList className="h-5 w-5 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-800">
                            {getText('View Pending Bookings', 'Lihat Booking Pending')}
                          </span>
                        </div>
                        {showPendingBookings ? <ChevronUp className="h-4 w-4 text-yellow-600" /> : <ChevronDown className="h-4 w-4 text-yellow-600" />}
                      </button>

                      {showPendingBookings && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                          {loadingPendingBookings ? (
                            <div className="text-center py-4">
                              <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                            </div>
                          ) : pendingBookings.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                              {getText('No pending bookings', 'Tidak ada booking pending')}
                            </p>
                          ) : (
                            pendingBookings.map((booking: any) => (
                              <div key={booking.id} className="p-3 bg-white border border-gray-200 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-medium text-gray-800">
                                    {booking.rooms?.name || getText('Room', 'Ruangan')}
                                  </p>
                                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                    {getText('PENDING', 'PENDING')}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600">
                                  {format(new Date(booking.start_time), 'dd/MM/yyyy HH:mm')} - 
                                  {format(new Date(booking.end_time), 'HH:mm')}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {booking.purpose}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-gray-200/50 pt-6">
                    <button
                      type="submit"
                      disabled={
                        loading || 
                        (activeTab === 'course' && !selectedCourse) ||
                        (activeTab === 'normal' && !selectedRoom) ||
                        (watchPurpose === 'Other' && (!watchAttachments || watchAttachments.length === 0))
                      }
                      className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          <span>{getText('Sending...', 'Mengirim...')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5" />
                          <span>{getText('Submit Booking', 'Kirim Pemesanan')}</span>
                        </>
                      )}
                    </button>

                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-semibold mb-2">{getText('Notice', 'Perhatian')}</p>
                          <ul className="space-y-1 text-xs">
                            <li>• {getText('Leave your ID card like KTP/Student Card to Admin', 'Tinggalkan Kartu Identitas seperti KTP/KTM ke Admin')}</li>
                            <li>• {getText('Follow existing procedures', 'Ikuti Prosedur yang sudah ada')}</li>
                            <li>• {getText('Book before taking the room key', 'Lakukan Booking Sebelum Mengambil Kunci Ruangan')}</li>
                          </ul>
                          <div className="mt-2"><hr /></div>
                           <div className="mt-3 pt-3 border-t border-blue-300">
                            <button
                              type="button"
                              onClick={() => window.open('https://wa.me/6285869554147', '_blank')}
                              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors shadow-sm"
                            >
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                              </svg>
                              <span>{getText('Contact Person: 085869554147', 'Contact Person: 085869554147')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* DateTime Picker Modals */}
        <DateTimePickerModal
          isOpen={showStartDatePicker}
          onClose={() => setShowStartDatePicker(false)}
          onSelect={(datetime) => setValue("start_datetime", datetime)}
          value={startDateTime}
          label={getText('Select Start Date & Time', 'Pilih Tanggal & Waktu Mulai')}
        />

        <DateTimePickerModal
          isOpen={showEndDatePicker}
          onClose={() => setShowEndDatePicker(false)}
          onSelect={(datetime) => setValue("end_datetime", datetime)}
          value={endDateTime}
          label={getText('Select End Date & Time', 'Pilih Tanggal & Waktu Selesai')}
        />

        {/* Schedule Modal */}
        {showScheduleModal && scheduleModalRoom && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{scheduleModalRoom.name}</h3>
                    <p className="text-blue-100 text-sm">{scheduleModalRoom.code || getText('No code', 'Tidak ada kode')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors flex-shrink-0"
                  title={getText('Close', 'Tutup')}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                {loadingSchedules ? (
                  <div className="flex justify-center items-center h-48">
                    <div className="text-center">
                      <RefreshCw className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">{getText('Loading schedule...', 'Memuat jadwal...')}</p>
                    </div>
                  </div>
                ) : combinedSchedules.length > 0 ? (
                  <div className="space-y-4">
                    {combinedSchedules.map((schedule, index) => {
                      const IconComponent = schedule.icon;
                      return (
                        <div
                          key={`${schedule.type}-${schedule.id}-${index}`}
                          className={`${schedule.bgColor} rounded-lg p-4 border-2 ${schedule.borderColor} hover:shadow-md transition-all duration-200`}
                        >
                          <div className="flex items-start space-x-3 mb-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm flex-shrink-0">
                              <IconComponent className={`h-5 w-5 ${schedule.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1 flex-wrap gap-2">
                                <span className={`text-xs font-bold ${schedule.color} bg-white px-2.5 py-1 rounded-full uppercase tracking-wider flex-shrink-0`}>
                                  {schedule.type === 'lecture' ? getText('Lecture', 'Kuliah') :
                                    schedule.type === 'exam' ? getText('Exam', 'UAS') :
                                      schedule.type === 'session' ? getText('Session', 'Sidang') :
                                        getText('Booking', 'Booking')}
                                </span>
                                <span className="font-bold text-gray-800 text-sm">
                                  {schedule.end_time ?
                                    `${schedule.start_time} - ${schedule.end_time}` :
                                    schedule.start_time
                                  }
                                </span>
                              </div>
                              <div className="font-bold text-gray-900 text-base leading-snug">
                                {schedule.title}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1 ml-11">
                            {schedule.subtitle && (
                              <div className={`text-sm ${schedule.color} font-semibold`}>
                                {schedule.subtitle}
                              </div>
                            )}
                            {schedule.description && (
                              <div className="text-sm text-gray-700">
                                {schedule.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-500">
                    <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-semibold mb-2">{getText('No schedule', 'Tidak ada jadwal')}</p>
                    <p className="text-sm text-gray-600">
                      {getText('This room has no activities scheduled for this date', 'Ruangan ini tidak memiliki aktivitas terjadwal untuk tanggal ini')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default BookRoom;