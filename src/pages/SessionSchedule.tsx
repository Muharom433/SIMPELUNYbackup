import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Select from 'react-select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Calendar,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  X,
  AlertCircle,
  Plus,
  User,
  Users,
  Printer,
  Building,
  BookOpen,
  Clock,
  MapPin,
  GraduationCap,
  UserCheck,
  ChevronDown,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  ChevronUp,
  EyeOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import toast from 'react-hot-toast';
import { alert } from '../components/Alert/AlertHelper';
import { useLanguage } from '../contexts/LanguageContext';
import logoUNY from '../assets/logouny.png';

const sessionSchema = z.object({
  student_id: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  room_id: z.string().min(1, 'Room is required'),
  title: z.string().min(1, 'Title is required'),
  supervisor: z.string().min(1, 'Supervisor is required'),
  examiner: z.string().min(1, 'Examiner is required'),
  secretary: z.string().min(1, 'Secretary is required'),
}).superRefine((data, ctx) => {
  if (data.start_time && data.end_time && data.start_time >= data.end_time) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_time'],
      message: 'End time must be after start time.',
    });
  }
});

type SessionFormData = z.infer<typeof sessionSchema>;

// ✅ Print Form Data Type - Simplified
type PrintFormData = {
    study_program_id: string;
};

// ✅ Helper function for image data URL
const getImageDataUrl = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// ✅ Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const SessionScheduleProgressive = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();

  // Backend data states
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [studyPrograms, setStudyPrograms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentHeads, setDepartmentHeads] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  

  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  // Calendar Modal states
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedRoomForCalendar, setSelectedRoomForCalendar] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateSessions, setSelectedDateSessions] = useState([]);
  
  // ✅ NEW: Mobile details toggle state
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  // ✅ NEW: Duplicate detection states
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Progressive form states
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Form data states
  const [formData, setFormData] = useState({
    student_name: '',
    student_nim: '',
    study_program_id: ''
  });

  // ✅ Refs untuk semua input
  const studentInputRef = useRef(null);
  const studentNameRef = useRef(null);
  const supervisorInputRef = useRef(null);
  const examinerInputRef = useRef(null);
  const secretaryInputRef = useRef(null);
  const titleInputRef = useRef(null);

  const form = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      student_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '',
      end_time: '',
      room_id: '',
      title: '',
      supervisor: '',
      examiner: '',
      secretary: '',
    },
  });

  // ✅ Print Form Schema - Simplified
  const printSchema = useMemo(() => {
    return z.object({
        study_program_id: z.string().min(1, getText('Study Program is required', 'Program Studi wajib diisi')),
    });
  }, [getText]);

  const printForm = useForm<PrintFormData>({ resolver: zodResolver(printSchema) });

  const watchDate = form.watch('date');
  const watchStartTime = form.watch('start_time');
  const watchEndTime = form.watch('end_time');

  const steps = [
    {
      id: 1,
      title: getText('Student Information', 'Informasi Mahasiswa'),
      subtitle: getText('Select student', 'Pilih mahasiswa'),
      icon: User,
      description: getText('Choose or input student data', 'Pilih atau input data mahasiswa')
    },
    {
      id: 2,
      title: getText('Schedule Information', 'Informasi Jadwal'),
      subtitle: getText('Set date & time', 'Tentukan tanggal & waktu'),
      icon: Calendar,
      description: getText('Set examination date and time', 'Tentukan tanggal dan waktu sidang')
    },
    {
      id: 3,
      title: getText('Room & Details', 'Ruangan & Detail'),
      subtitle: getText('Room, title & committee', 'Ruangan, judul & panitia'),
      icon: Building,
      description: getText('Select room, title, and examination committee', 'Pilih ruangan, judul, dan tim penguji')
    }
  ];

  // ✅ Enhanced duplicate check function with modal auto-close
  const checkExistingSession = async (studentNim, studentName) => {
    if (!studentNim.trim() && !studentName.trim()) {
      setDuplicateWarning(null);
      return { hasDuplicate: false };
    }

    setIsCheckingDuplicate(true);
    try {
      // Check by NIM first (most accurate)
      let existingSessions = [];
      
      if (studentNim.trim()) {
        // Query by student NIM
        const { data: studentData } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('identity_number', studentNim.trim())
          .maybeSingle();

        if (studentData) {
          const { data: sessionData } = await supabase
            .from('final_sessions')
            .select(`
              id,
              date,
              start_time,
              end_time,
              title,
              student:users!student_id(
                id,
                full_name,
                identity_number,
                study_program:study_programs(name)
              ),
              room:rooms(name, code)
            `)
            .eq('student_id', studentData.id);

          existingSessions = sessionData || [];
        }
      } else if (studentName.trim()) {
        // If only name provided, check by name (less accurate)
        const { data: allSessionsData } = await supabase
          .from('final_sessions')
          .select(`
            id,
            date,
            start_time,
            end_time,
            title,
            student:users!student_id(
              id,
              full_name,
              identity_number,
              study_program:study_programs(name)
            ),
            room:rooms(name, code)
          `);

        existingSessions = allSessionsData?.filter(session => 
          session.student?.full_name?.toLowerCase().includes(studentName.toLowerCase())
        ) || [];
      }

      // Filter out current editing session if exists
      const relevantSessions = existingSessions.filter(session => 
        !editingSession || session.id !== editingSession.id
      );

      if (relevantSessions.length > 0) {
        const warningData = {
          type: studentNim.trim() ? 'exact_match' : 'name_match',
          sessions: relevantSessions,
          studentName: relevantSessions[0].student?.full_name || studentName,
          studentNim: relevantSessions[0].student?.identity_number || studentNim
        };

        setDuplicateWarning(warningData);
        return { 
          hasDuplicate: true, 
          sessions: relevantSessions,
          type: warningData.type
        };
      } else {
        setDuplicateWarning(null);
        return { hasDuplicate: false };
      }
    } catch (error) {
      console.error('Error in checkExistingSession:', error);
      setDuplicateWarning(null);
      return { hasDuplicate: false };
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // ✅ Debounced check untuk performance
  const debouncedCheck = useCallback(
    debounce((nim, name) => checkExistingSession(nim, name), 500),
    [editingSession]
  );

  // ✅ Calendar Helper Functions menggunakan allSessions
  const getSessionsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return allSessions.filter(session => session.date === dateStr);
  };

  const getSessionsForRoom = (date, roomId) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return allSessions.filter(session => 
      session.date === dateStr && 
      session.room_id === roomId
    );
  };

  const hasSessionsOnDate = (date, roomId = null) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (roomId) {
      return allSessions.some(session => 
        session.date === dateStr && session.room_id === roomId
      );
    }
    return allSessions.some(session => session.date === dateStr);
  };

  const generateCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  };

  const handleDateClick = (date) => {
    if (selectedRoomForCalendar) {
      const roomSessions = getSessionsForRoom(date, selectedRoomForCalendar);
      setSelectedDateSessions(roomSessions);
    } else {
      const allSessions = getSessionsForDate(date);
      setSelectedDateSessions(allSessions);
    }
    
    // ✅ Auto show details on mobile when date is clicked
    if (window.innerWidth < 1024) { // lg breakpoint
      setShowMobileDetails(true);
    }
  };

  // ✅ Calendar Modal dengan mobile toggle untuk details
const CalendarModal = () => {
  const calendarDays = generateCalendarDays();
  
  const monthNames = getText('en') === 'en' ? [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ] : [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const dayNames = getText('en') === 'en' ? 
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] :
    ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const roomDropdownRef = useRef(null);
  const roomDisplayRef = useRef(null);

  // Function untuk mengelompokkan sessions berdasarkan ruangan
  const groupSessionsByRoom = (sessions) => {
    const grouped = {};
    
    sessions.forEach(session => {
      const roomKey = session.room?.id || 'unknown';
      const roomName = session.room?.name || 'Unknown Room';
      
      if (!grouped[roomKey]) {
        grouped[roomKey] = {
          room: {
            id: roomKey,
            name: roomName,
            display: roomName
          },
          sessions: []
        };
      }
      
      grouped[roomKey].sessions.push(session);
    });
    
    // Sort sessions dalam setiap ruangan berdasarkan waktu
    Object.keys(grouped).forEach(roomKey => {
      grouped[roomKey].sessions.sort((a, b) => {
        return a.start_time.localeCompare(b.start_time);
      });
    });
    
    return grouped;
  };

  // Function untuk mendapatkan rentang waktu total per ruangan (tanpa detik)
  const getRoomTimeRange = (sessions) => {
    if (sessions.length === 0) return '';
    
    const startTimes = sessions.map(s => s.start_time.substring(0, 5)); // HH:MM only
    const endTimes = sessions.map(s => s.end_time.substring(0, 5)); // HH:MM only
    
    const earliestStart = startTimes.sort()[0];
    const latestEnd = endTimes.sort().reverse()[0];
    
    return `${earliestStart} - ${latestEnd}`;
  };

  const showRoomDropdown = () => {
    const dropdownHTML = `
      <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden">
        <div class="p-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="${getText("Search rooms...", "Cari ruangan...")}"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            id="calendar-room-search-input"
            autocomplete="off"
          />
        </div>
        <div class="max-h-60 overflow-y-auto" id="calendar-room-list">
          <div 
            class="calendar-room-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 transition-colors duration-150"
            data-room-id=""
          >
            <div class="font-semibold text-gray-800">${getText('All Rooms', 'Semua Ruangan')}</div>
          </div>
          ${rooms.map(room => `
            <div 
              class="calendar-room-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
              data-room-id="${room.id}"
              data-room-name="${room.name}"
              data-room-code="${room.code}"
            >
              <div class="font-semibold text-gray-800">${room.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (roomDropdownRef.current) {
      roomDropdownRef.current.innerHTML = dropdownHTML;
      roomDropdownRef.current.style.display = 'block';
      
      const searchInput = roomDropdownRef.current.querySelector('#calendar-room-search-input');
      const roomList = roomDropdownRef.current.querySelector('#calendar-room-list');
      
      if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', (e) => {
          const searchTerm = e.target.value.toLowerCase();
          
          const allRoomsOption = `
            <div 
              class="calendar-room-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 transition-colors duration-150"
              data-room-id=""
            >
              <div class="font-semibold text-gray-800">${getText('All Rooms', 'Semua Ruangan')}</div>
            </div>
          `;
          
          const filteredRooms = rooms.filter(room =>
            room.name.toLowerCase().includes(searchTerm) ||
            room.code.toLowerCase().includes(searchTerm)
          );
          
          roomList.innerHTML = allRoomsOption + filteredRooms.map(room => `
            <div 
              class="calendar-room-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
              data-room-id="${room.id}"
              data-room-name="${room.name}"
              data-room-code="${room.code}"
            >
              <div class="font-semibold text-gray-800">${room.name}</div>
            </div>
          `).join('');
          
          addCalendarRoomListeners();
        });
      }
      
      addCalendarRoomListeners();
    }
  };

  const addCalendarRoomListeners = () => {
    roomDropdownRef.current?.querySelectorAll('.calendar-room-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const roomId = e.currentTarget.dataset.roomId;
        const roomName = e.currentTarget.dataset.roomName;
        
        if (roomId) {
          if (roomDisplayRef.current) {
            roomDisplayRef.current.value = roomName;
          }
          setSelectedRoomForCalendar(roomId);
        } else {
          if (roomDisplayRef.current) {
            roomDisplayRef.current.value = getText('All Rooms', 'Semua Ruangan');
          }
          setSelectedRoomForCalendar('');
        }
        
        setSelectedDateSessions([]);
        // ✅ Hide mobile details when filter changes
        setShowMobileDetails(false);
        hideRoomDropdown();
      });
    });
  };

  const hideRoomDropdown = () => {
    if (roomDropdownRef.current) {
      roomDropdownRef.current.style.display = 'none';
    }
  };

  const getSessionCountForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (selectedRoomForCalendar) {
      return allSessions.filter(session => 
        session.date === dateStr && session.room_id === selectedRoomForCalendar
      ).length;
    }
    return allSessions.filter(session => session.date === dateStr).length;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowCalendarModal(false);
          setSelectedRoomForCalendar('');
          setSelectedDateSessions([]);
          setShowMobileDetails(false);
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {getText('Session Calendar', 'Kalender Jadwal Sidang')}
              </h3>
              <p className="text-sm text-gray-600">
                {getText('View room schedules by date', 'Lihat jadwal ruangan per tanggal')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowCalendarModal(false);
              setSelectedRoomForCalendar('');
              setSelectedDateSessions([]);
              setShowMobileDetails(false);
            }}
            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Calendar Section */}
          <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
            {/* Room Filter */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <span>{getText('Filter by Room', 'Filter berdasarkan Ruangan')}</span>
                </div>
              </label>
              <div className="relative">
                <input
                  ref={roomDisplayRef}
                  type="text"
                  readOnly
                  placeholder={getText("Click to select room...", "Klik untuk pilih ruangan...")}
                  onClick={showRoomDropdown}
                  defaultValue={getText('All Rooms', 'Semua Ruangan')}
                  className="w-full px-4 py-3 pr-10 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer text-sm font-medium transition-all duration-200 hover:border-gray-300"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <div ref={roomDropdownRef} style={{ display: 'none' }}></div>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="flex items-center justify-center w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600 group-hover:text-gray-800" />
              </button>
              
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {getText('Click dates with sessions', 'Klik tanggal dengan sidang')}
                </p>
              </div>
              
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="flex items-center justify-center w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
              >
                <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-gray-800" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                {dayNames.map(day => (
                  <div key={day} className="p-4 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());
                  const sessionCount = getSessionCountForDate(day);
                  const hasSessions = sessionCount > 0;
                  
                  return (
                    <button
                      key={day.toString()}
                      onClick={() => isCurrentMonth && handleDateClick(day)}
                      disabled={!isCurrentMonth}
                      className={`
                        h-16 p-2 text-sm border-r border-b border-gray-200 last:border-r-0 transition-all duration-200 relative group
                        ${!isCurrentMonth 
                          ? 'bg-gray-50 text-gray-300 cursor-not-allowed' 
                          : isToday
                            ? 'bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-200'
                            : hasSessions 
                              ? 'bg-red-50 hover:bg-red-100 text-red-900 font-semibold cursor-pointer' 
                              : 'bg-white hover:bg-gray-50 text-gray-700 cursor-pointer'
                        }
                      `}
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        <span className={`
                          ${isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs' : ''}
                        `}>
                          {format(day, 'd')}
                        </span>
                        
                        {hasSessions && isCurrentMonth && (
                          <div className="mt-1 flex items-center space-x-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-xs font-bold text-red-700">
                              {sessionCount}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ✅ Mobile Toggle Button - Only visible on small screens */}
          {selectedDateSessions.length > 0 && (
            <div className="lg:hidden border-t border-gray-200 bg-white p-4 flex-shrink-0">
              <button
                onClick={() => setShowMobileDetails(!showMobileDetails)}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors duration-200"
              >
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-semibold text-blue-900">
                      {getText('Room Schedule Details', 'Detail Jadwal Ruangan')}
                    </div>
                    <div className="text-sm text-blue-700">
                      {format(new Date(selectedDateSessions[0].date), 'EEEE, MMMM d, yyyy')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    {Object.keys(groupSessionsByRoom(selectedDateSessions)).length}
                  </span>
                  {showMobileDetails ? (
                    <ChevronUp className="h-5 w-5 text-blue-600" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-blue-600" />
                  )}
                </div>
              </button>
            </div>
          )}
          {/* Room-Based Session Details Sidebar */}
          <div className={`
            w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white overflow-y-auto
            ${showMobileDetails ? 'block' : 'hidden lg:block'}
          `}>
            <div className="p-6 border-b border-gray-200 bg-gray-50 lg:block">
              <div className="flex items-center justify-between lg:block">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <div className="p-1 bg-blue-100 rounded">
                    <Building className="h-4 w-4 text-blue-600" />
                  </div>
                  <span>{getText('Room Schedule', 'Jadwal Ruangan')}</span>
                </h4>
                {selectedDateSessions.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1 lg:mt-1">
                    {format(new Date(selectedDateSessions[0].date), 'EEEE, MMMM d, yyyy')}
                  </p>
                )}
                
                {/* ✅ Close button for mobile */}
                <button
                  onClick={() => setShowMobileDetails(false)}
                  className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {selectedDateSessions.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(groupSessionsByRoom(selectedDateSessions)).map(([roomId, roomData]) => (
                    <div key={roomId} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                              <Building className="h-4 w-4" />
                            </div>
                            <div>
                              <h5 className="font-bold text-lg">{roomData.room.display}</h5>
                              <p className="text-blue-100 text-sm">
                                {getRoomTimeRange(roomData.sessions)}
                              </p>
                            </div>
                          </div>
                          <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1">
                            <span className="text-sm font-semibold">
                              {roomData.sessions.length}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        {roomData.sessions.map((session, sessionIndex) => (
                          <div key={session.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-sm transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                  {sessionIndex + 1}
                                </div>
                                <span className="font-semibold text-gray-900 text-lg">
                                  {session.start_time.substring(0, 5)} - {session.end_time.substring(0, 5)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="mb-2">
                              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                                {session.student?.study_program?.name}
                              </span>
                            </div>
                            
                            <div className="text-sm text-gray-700">
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-gray-500" />
                                <span className="font-medium">{session.student?.full_name}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Building className="h-8 w-8 text-gray-400" />
                  </div>
                  <h5 className="font-semibold text-gray-700 mb-2">
                    {getText('No sessions selected', 'Tidak ada sidang dipilih')}
                  </h5>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {getText(
                      'Click on a highlighted date to view room schedules.',
                      'Klik pada tanggal yang diberi tanda untuk melihat jadwal ruangan.'
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

  const DeleteConfirmationModal = () => {
  if (!sessionToDelete) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900">
                {getText('Delete Session', 'Hapus Jadwal Sidang')}
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {getText('This action cannot be undone', 'Tindakan ini tidak dapat dibatalkan')}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-gray-700 text-lg mb-4">
              {getText('Are you sure you want to delete this session?', 'Apakah Anda yakin ingin menghapus jadwal sidang ini?')}
            </p>
          </div>

          {/* Session Details */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="font-semibold text-gray-900">
                    {sessionToDelete.student?.full_name || 'Unknown Student'}
                  </div>
                  <div className="text-sm text-gray-600 font-mono">
                    {sessionToDelete.student?.identity_number || 'No NIM'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {format(parseISO(sessionToDelete.date), 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="text-sm text-gray-600">
                    {sessionToDelete.start_time} - {sessionToDelete.end_time}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-gray-500" />
                <div className="text-sm text-gray-900">
                  {sessionToDelete.room?.name || 'No Room'} - {sessionToDelete.room?.code || 'No Code'}
                </div>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  {getText(
                    'This will permanently delete the session and all related data. This action cannot be undone.',
                    'Ini akan menghapus jadwal sidang dan semua data terkait secara permanen. Tindakan ini tidak dapat dibatalkan.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
          <button
            onClick={handleCancelDelete}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50"
          >
            {getText('Cancel', 'Batal')}
          </button>
          <button
            onClick={handleConfirmDelete}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>{getText('Deleting...', 'Menghapus...')}</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>{getText('Delete Session', 'Hapus Sidang')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

  // ✅ Fetch Sessions Universal
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const query = supabase
        .from('final_sessions')
        .select(`
          *,
          student:users!student_id(
            id,
            full_name,
            identity_number,
            study_program:study_programs(
              id,
              name,
              department_id,
              department:departments(name)
            )
          ),
          room:rooms(
            id,
            name,
            code,
            department_id
          )
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      const { data } = await query;
      
      // Simpan semua data untuk kalender
      setAllSessions(data || []);
      
      // Filter untuk tabel utama berdasarkan departemen admin
      if (profile?.role === 'department_admin' && profile?.department_id) {
        const filtered = data?.filter(session => 
          session.student?.study_program?.department_id === profile.department_id
        );
        setSessions(filtered || []);
      } else {
        setSessions(data || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      alert.error(getText('Failed to load sessions.', 'Gagal memuat jadwal sidang.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      let query = supabase
        .from('users')
        .select(`*, study_program:study_programs(id, name, department_id)`)
        .eq('role', 'student')
        .order('full_name');

      const { data } = await query;
      let filtered = data || [];

      if (profile?.role === 'department_admin' && profile?.department_id) {
        filtered = (data || []).filter(student => 
          student.study_program?.department_id === profile.department_id
        );
      }
      setStudents(filtered);
    } catch (error) {
      console.error('Error fetching students:', error);
      alert.error(getText('Failed to load students.', 'Gagal memuat mahasiswa.'));
    }
  };

  const fetchLecturers = async () => {
    try {
      let query = supabase
        .from('users')
        .select(`*, study_program:study_programs(id, name, department_id)`)
        .eq('role', 'lecturer')
        .order('full_name');

      const { data } = await query;
      let filtered = data || [];

      if (profile?.role === 'department_admin' && profile?.department_id) {
        filtered = (data || []).filter(lecturer => 
          lecturer.study_program?.department_id === profile.department_id
        );
      }
      setLecturers(filtered);
    } catch (error) {
      console.error('Error fetching lecturers:', error);
      alert.error(getText('Failed to load lecturers.', 'Gagal memuat dosen.'));
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('name');
      if (error) throw error;
      setRooms(data || []);
      setAvailableRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert.error(getText('Failed to load rooms.', 'Gagal memuat ruangan.'));
    }
  };

  const fetchStudyPrograms = async () => {
    try {
      // ✅ Fetch ALL study programs untuk print (tidak terbatas departemen)
      const { data } = await supabase.from('study_programs').select('*, department:departments(name)').order('name');
      setStudyPrograms(data || []);
    } catch (error) {
      console.error('Error fetching study programs:', error);
      alert.error(getText('Failed to load study programs.', 'Gagal memuat program studi.'));
    }
  };

  // ✅ NEW: Fetch Departments untuk Print
  const fetchDepartments = async () => {
    try {
      let query = supabase.from('departments').select('id, name');
      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('id', profile.department_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      alert.error(getText('Failed to load departments.', 'Gagal memuat departemen.'));
    }
  };

  // ✅ NEW: Fetch Department Heads untuk Print
  const fetchDepartmentHeads = async () => {
    try {
      let query = supabase
        .from('users')
        .select('id, full_name, identity_number, department_id')
        .eq('role', 'lecturer');

      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('department_id', profile.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDepartmentHeads(data || []);
    } catch (error) {
      console.error('Error fetching department heads:', error);
      alert.error(getText('Failed to load department heads.', 'Gagal memuat kepala departemen.'));
    }
  };

  useEffect(() => {
    if (profile) {
      fetchSessions();
      fetchStudents();
      fetchLecturers();
      fetchRooms();
      fetchStudyPrograms();
      fetchDepartments();
      fetchDepartmentHeads();
    }
  }, [profile]);

  useEffect(() => {
    if (watchDate && watchStartTime && watchEndTime) {
      checkAvailableRooms(watchDate, watchStartTime, watchEndTime);
    } else {
      setAvailableRooms(rooms);
    }
  }, [watchDate, watchStartTime, watchEndTime, rooms]);

  // ✅ checkAvailableRooms menggunakan allSessions
  const checkAvailableRooms = async (date, startTime, endTime) => {
    try {
      const dateObj = new Date(date);
      const dayNamesIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNamesIndonesian[dateObj.getDay()];
      
      const finalSessionConflicts = allSessions
        .filter(session => session.date === date && session.room_id)
        .filter(session => {
          if (editingSession && session.id === editingSession.id) return false;
          const hasOverlap = startTime < session.end_time && endTime > session.start_time;
          return hasOverlap;
        })
        .map(session => session.room_id);

      const { data: lectureSchedules, error } = await supabase
        .from('lecture_schedules')
        .select('room, start_time, end_time')
        .eq('day', dayName);

      if (error) throw error;
      
      const lectureScheduleConflicts = (lectureSchedules || [])
        .filter(schedule => {
          const hasOverlap = startTime < schedule.end_time && endTime > schedule.start_time;
          return hasOverlap;
        });

      const lectureRoomIds = [];
      for (const conflictSchedule of lectureScheduleConflicts) {
        const matchingRoom = rooms.find(room => room.name.toLowerCase() === conflictSchedule.room.toLowerCase());
        if (matchingRoom) {
          lectureRoomIds.push(matchingRoom.id);
        }
      }
      
      const allConflictingRoomIds = [...finalSessionConflicts, ...lectureRoomIds];
      const available = rooms.filter(room => !allConflictingRoomIds.includes(room.id));
      setAvailableRooms(available);

    } catch (error) {
      console.error('Error checking available rooms:', error);
      setAvailableRooms(rooms);
    }
  };

  // Mobile Progress Indicator
  const MobileProgressIndicator = () => (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id);
        const isCurrent = currentStep === step.id;
        
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                isCompleted
                  ? 'bg-blue-500 text-white'
                  : isCurrent
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {isCompleted ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <div className={`text-xs mt-1 text-center max-w-16 ${
                isCurrent || isCompleted ? 'text-blue-600 font-medium' : 'text-gray-400'
              }`}>
                {step.title.split(' ')[0]}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${
                isCompleted ? 'bg-blue-500' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // ✅ Enhanced validateStep dengan duplicate warning consideration
  const validateStep = useCallback((step) => {
    switch (step) {
      case 1:
        let studentNim = formData.student_nim || 
                        (studentInputRef.current?.value) || '';
        let studentName = formData.student_name || 
                         (studentNameRef.current?.value) || '';
        let studyProgramId = formData.study_program_id || '';
        
        return !!(studentNim.trim() && studentName.trim() && studyProgramId);
        
      case 2:
        return !!(form.getValues('date') && form.getValues('start_time') && form.getValues('end_time'));
        
      case 3:
        const roomId = form.getValues('room_id');
        
        let title = form.getValues('title') || 
                   (titleInputRef.current?.value) || '';
        let supervisor = form.getValues('supervisor') || 
                        (supervisorInputRef.current?.value) || '';
        let examiner = form.getValues('examiner') || 
                      (examinerInputRef.current?.value) || '';
        let secretary = form.getValues('secretary') || 
                       (secretaryInputRef.current?.value) || '';
        
        return !!(roomId && title.trim() && supervisor.trim() && examiner.trim() && secretary.trim());
        
      default:
        return false;
    }
  }, [form, formData]);
  
  // ✅ Enhanced handleStepComplete dengan duplicate check dan auto-close modal
  const handleStepComplete = useCallback(async (step) => {
    if (step === 1) {
      const nimValue = studentInputRef.current?.value || '';
      const nameValue = studentNameRef.current?.value || '';
      const programValue = formData.study_program_id || '';
      
      if (!nimValue.trim() || !nameValue.trim() || !programValue) {
        alert.error(getText('Please fill all required fields', 'Silakan isi semua field yang diperlukan'));
        return;
      }
      
      // ✅ Check for existing sessions before proceeding to step 2
      const duplicateCheck = await checkExistingSession(nimValue, nameValue);
      
      if (duplicateCheck.hasDuplicate && duplicateCheck.type === 'exact_match') {
        const sessionCount = duplicateCheck.sessions.length;
        const latestSession = duplicateCheck.sessions[0];
        
        alert.error(
          getText(
            `Student "${nameValue}" already has ${sessionCount} examination session(s).\n\nLatest session: ${format(parseISO(latestSession.date), 'MMM d, yyyy')} at ${latestSession.start_time}\n\nModal will be closed to prevent duplicate entries.`,
            `Mahasiswa "${nameValue}" sudah memiliki ${sessionCount} jadwal sidang.\n\nSidang terakhir: ${format(parseISO(latestSession.date), 'MMM d, yyyy')} pukul ${latestSession.start_time}\n\nModal akan ditutup untuk mencegah duplikasi data.`
          )
        );
        
        // ✅ Auto-close modal after showing the alert
        setTimeout(() => {
          setShowModal(false);
          resetForm();
        }, 1000);
        
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        student_nim: nimValue,
        student_name: nameValue,
        study_program_id: programValue
      }));
      
    } else if (step === 3) {
      const supervisorValue = supervisorInputRef.current?.value || '';
      const examinerValue = examinerInputRef.current?.value || '';
      const secretaryValue = secretaryInputRef.current?.value || '';
      const titleValue = titleInputRef.current?.value || '';
      
      if (supervisorValue) form.setValue('supervisor', supervisorValue);
      if (examinerValue) form.setValue('examiner', examinerValue);
      if (secretaryValue) form.setValue('secretary', secretaryValue);
      if (titleValue) form.setValue('title', titleValue);
    }
    
    if (!validateStep(step)) {
      alert.error(getText('Please fill all required fields', 'Silakan isi semua field yang diperlukan'));
      return;
    }
    
    setCompletedSteps(prev => new Set([...prev, step]));
    if (step < 3) {
      setCurrentStep(step + 1);
    }
  }, [validateStep, getText, form, formData, checkExistingSession]);

  const handleStepBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

const validateAllFields = () => {
  const errors = [];
  
  // Step 1 validation
  const studentNim = formData.student_nim || (studentInputRef.current?.value) || '';
  const studentName = formData.student_name || (studentNameRef.current?.value) || '';
  const studyProgramId = formData.study_program_id || '';
  
  if (!studentNim.trim()) {
    errors.push(getText('Student NIM is required', 'NIM Mahasiswa wajib diisi'));
  }
  if (!studentName.trim()) {
    errors.push(getText('Student Name is required', 'Nama Mahasiswa wajib diisi'));
  }
  if (!studyProgramId) {
    errors.push(getText('Study Program is required', 'Program Studi wajib dipilih'));
  }
  
  // Step 2 validation
  const date = form.getValues('date');
  const startTime = form.getValues('start_time');
  const endTime = form.getValues('end_time');
  
  if (!date) {
    errors.push(getText('Date is required', 'Tanggal wajib diisi'));
  }
  if (!startTime) {
    errors.push(getText('Start time is required', 'Waktu mulai wajib diisi'));
  }
  if (!endTime) {
    errors.push(getText('End time is required', 'Waktu selesai wajib diisi'));
  }
  if (startTime && endTime && startTime >= endTime) {
    errors.push(getText('End time must be after start time', 'Waktu selesai harus setelah waktu mulai'));
  }
  
  // Step 3 validation
  const roomId = form.getValues('room_id');
  const title = form.getValues('title') || (titleInputRef.current?.value) || '';
  const supervisor = form.getValues('supervisor') || (supervisorInputRef.current?.value) || '';
  const examiner = form.getValues('examiner') || (examinerInputRef.current?.value) || '';
  const secretary = form.getValues('secretary') || (secretaryInputRef.current?.value) || '';
  
  if (!roomId) {
    errors.push(getText('Room is required', 'Ruangan wajib dipilih'));
  }
  if (!title.trim()) {
    errors.push(getText('Thesis title is required', 'Judul skripsi/tesis wajib diisi'));
  }
  if (!supervisor.trim()) {
    errors.push(getText('Supervisor is required', 'Pembimbing wajib diisi'));
  }
  if (!examiner.trim()) {
    errors.push(getText('Examiner is required', 'Penguji wajib diisi'));
  }
  if (!secretary.trim()) {
    errors.push(getText('Secretary is required', 'Sekretaris wajib diisi'));
  }
  
  return errors;
};

// ✅ Enhanced Submit dengan comprehensive duplicate prevention
const handleSubmitWithValidation = async () => {
  // Sync semua nilai dari DOM ke React state
  const supervisorValue = supervisorInputRef.current?.value || '';
  const examinerValue = examinerInputRef.current?.value || '';
  const secretaryValue = secretaryInputRef.current?.value || '';
  const titleValue = titleInputRef.current?.value || '';
  
  if (supervisorValue) form.setValue('supervisor', supervisorValue);
  if (examinerValue) form.setValue('examiner', examinerValue);
  if (secretaryValue) form.setValue('secretary', secretaryValue);
  if (titleValue) form.setValue('title', titleValue);
  
  // Sync student data
  const nimValue = studentInputRef.current?.value || '';
  const nameValue = studentNameRef.current?.value || '';
  
  if (nimValue && nimValue !== formData.student_nim) {
    setFormData(prev => ({ ...prev, student_nim: nimValue }));
  }
  if (nameValue && nameValue !== formData.student_name) {
    setFormData(prev => ({ ...prev, student_name: nameValue }));
  }
  
  // Wait for state updates
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // ✅ Final duplicate check before submission
  if (!editingSession) {
    const finalDuplicateCheck = await checkExistingSession(nimValue, nameValue);
    if (finalDuplicateCheck.hasDuplicate && finalDuplicateCheck.type === 'exact_match') {
     const proceed = confirm(getText(
        `FINAL WARNING: Student "${nameValue}" already has ${finalDuplicateCheck.sessions.length} examination session(s).\n\nAre you absolutely sure you want to create another session for this student?`,
        `PERINGATAN AKHIR: Mahasiswa "${nameValue}" sudah memiliki ${finalDuplicateCheck.sessions.length} jadwal sidang.\n\nApakah Anda benar-benar yakin ingin membuat sidang lain untuk mahasiswa ini?`
      ));
      
      if (!proceed) {
        return;
      }
    }
  }
  
  // Validate all fields
  const validationErrors = validateAllFields();
  
  if (validationErrors.length > 0) {
    // Show detailed error message
    const errorMessage = getText(
      `Please complete the following fields:\n• ${validationErrors.join('\n• ')}`,
      `Silakan lengkapi field berikut:\n• ${validationErrors.join('\n• ')}`
    );
    
    alert.error(errorMessage);
    
    // Navigate to first incomplete step
    if (!formData.student_nim || !formData.student_name || !formData.study_program_id) {
      setCurrentStep(1);
    } else if (!form.getValues('date') || !form.getValues('start_time') || !form.getValues('end_time')) {
      setCurrentStep(2);
    } else {
      setCurrentStep(3);
    }
    
    return;
  }
  
  // If all validation passes, submit the form
  form.handleSubmit(handleSubmit)();
};

  // ✅ Enhanced StudentInformationStep dengan duplicate detection
  const StudentInformationStep = () => {
    const dropdownRef = useRef(null);
    const programDisplayRef = useRef(null);
    const programDropdownRef = useRef(null);
    
    const localData = useRef({
      studentSearch: '',
      studentName: '',
      studentNim: '',
      studyProgramId: '',
      selectedProgramDisplay: ''
    });

    const updateParentFormData = (field, value) => {
      localData.current[field] = value;
    };

    const syncToParentForm = () => {
      setFormData(prev => ({
        ...prev,
        student_name: localData.current.studentName,
        student_nim: localData.current.studentNim,
        study_program_id: localData.current.studyProgramId
      }));
    };

    // ✅ Enhanced student dropdown dengan duplicate info
    const showStudentDropdown = (searchTerm) => {
      if (!searchTerm.trim()) {
        hideStudentDropdown();
        return;
      }

      const filteredStudents = students.filter(student => 
        student && 
        student.identity_number && 
        student.full_name &&
        (
          student.identity_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.full_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );

      if (filteredStudents.length === 0) {
        hideStudentDropdown();
        return;
      }

      // ✅ Check which students already have sessions
      const studentsWithSessionStatus = filteredStudents.map(student => {
        const hasExistingSession = allSessions.some(session => 
          session.student_id === student.id && 
          (!editingSession || session.id !== editingSession.id)
        );
        return { ...student, hasExistingSession };
      });

      const dropdownHTML = `
        <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          ${studentsWithSessionStatus.map(student => `
            <div 
              class="dropdown-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150 ${student.hasExistingSession ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}"
              data-student-id="${student.id}"
              data-student-nim="${student.identity_number}"
              data-student-name="${student.full_name}"
              data-program-id="${student.study_program_id || ''}"
              data-has-session="${student.hasExistingSession}"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="font-semibold text-gray-800">${student.identity_number}</div>
                  <div class="text-sm text-gray-600">${student.full_name}</div>
                  ${student.study_program ? `<div class="text-xs text-gray-500">${student.study_program.name}</div>` : ''}
                </div>
                ${student.hasExistingSession ? `
                  <div class="ml-2 flex-shrink-0">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                      </svg>
                      ${getText('Has Session', 'Ada Sidang')}
                    </span>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;

      if (dropdownRef.current) {
        dropdownRef.current.innerHTML = dropdownHTML;
        dropdownRef.current.style.display = 'block';
        
        dropdownRef.current.querySelectorAll('.dropdown-item').forEach(item => {
          item.addEventListener('mousedown', (e) => e.preventDefault());
          item.addEventListener('click', (e) => {
            const studentId = e.currentTarget.dataset.studentId;
            const studentNim = e.currentTarget.dataset.studentNim;
            const studentName = e.currentTarget.dataset.studentName;
            const programId = e.currentTarget.dataset.programId;
            const hasSession = e.currentTarget.dataset.hasSession === 'true';
            
            studentInputRef.current.value = studentNim;
            studentNameRef.current.value = studentName;
            
            localData.current.studentNim = studentNim;
            localData.current.studentName = studentName;
            localData.current.studyProgramId = programId;
            
            form.setValue('student_id', studentId);
            syncToParentForm();
            
            // ✅ Trigger duplicate check when student is selected
            if (hasSession) {
              debouncedCheck(studentNim, studentName);
            } else {
              setDuplicateWarning(null);
            }
            
            if (programId) {
              const program = studyPrograms.find(p => p.id === programId);
              if (program) {
                const display = `${program.name} (${program.code})`;
                localData.current.selectedProgramDisplay = display;
                if (programDisplayRef.current) {
                  programDisplayRef.current.value = display;
                }
              }
            }
            
            hideStudentDropdown();
            studentInputRef.current.focus();
          });
        });
      }
    };

    const hideStudentDropdown = () => {
      if (dropdownRef.current) {
        dropdownRef.current.style.display = 'none';
      }
    };

    // ✅ Enhanced input handlers dengan duplicate check
    const handleStudentInputChange = (e) => {
      const value = e.target.value;
      localData.current.studentNim = value;
      showStudentDropdown(value);
      
      // Trigger duplicate check
      if (value.trim().length >= 3) {
        debouncedCheck(value, localData.current.studentName);
      } else {
        setDuplicateWarning(null);
      }
    };

    const handleStudentNameChange = (e) => {
      const value = e.target.value;
      localData.current.studentName = value;
      
      // Trigger duplicate check if NIM is not available
      if (!localData.current.studentNim.trim() && value.trim().length >= 3) {
        debouncedCheck('', value);
      }
    };

    const showProgramDropdown = () => {
      const dropdownHTML = `
        <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden">
          <div class="p-3 border-b border-gray-100">
            <input
              type="text"
              placeholder="${getText("Search programs...", "Cari program studi...")}"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              id="program-search-input"
              autocomplete="off"
            />
          </div>
          <div class="max-h-60 overflow-y-auto" id="program-list">
            ${studyPrograms.map(program => `
              <div 
                class="program-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                data-program-id="${program.id}"
                data-program-name="${program.name}"
                data-program-code="${program.code || ''}"
              >
                <div class="font-semibold text-gray-800">${program.name} (${program.code || ''})</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      if (programDropdownRef.current) {
        programDropdownRef.current.innerHTML = dropdownHTML;
        programDropdownRef.current.style.display = 'block';
        
        const searchInput = programDropdownRef.current.querySelector('#program-search-input');
        const programList = programDropdownRef.current.querySelector('#program-list');
        
        if (searchInput) {
          searchInput.focus();
          searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredPrograms = studyPrograms.filter(program =>
              program.name.toLowerCase().includes(searchTerm) ||
              (program.code && program.code.toLowerCase().includes(searchTerm))
            );
            
            programList.innerHTML = filteredPrograms.map(program => `
              <div 
                class="program-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                data-program-id="${program.id}"
                data-program-name="${program.name}"
                data-program-code="${program.code || ''}"
              >
                <div class="font-semibold text-gray-800">${program.name} (${program.code || ''})</div>
              </div>
            `).join('');
            
            addProgramListeners();
          });
        }
        
        addProgramListeners();
      }
    };

    const addProgramListeners = () => {
      programDropdownRef.current?.querySelectorAll('.program-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const programId = e.currentTarget.dataset.programId;
          const programName = e.currentTarget.dataset.programName;
          const programCode = e.currentTarget.dataset.programCode;
          
          const display = `${programName} (${programCode})`;
          localData.current.selectedProgramDisplay = display;
          localData.current.studyProgramId = programId;
          
          if (programDisplayRef.current) {
            programDisplayRef.current.value = display;
          }
          
          syncToParentForm();
          hideProgramDropdown();
        });
      });
    };

    const hideProgramDropdown = () => {
      if (programDropdownRef.current) {
        programDropdownRef.current.style.display = 'none';
      }
    };

    // ✅ Duplicate Warning Component
    const DuplicateWarningCard = () => {
      if (!duplicateWarning) return null;

      const isExactMatch = duplicateWarning.type === 'exact_match';
      
      return (
        <div className={`rounded-xl border p-4 mb-6 ${
          isExactMatch 
            ? 'bg-red-50 border-red-300' 
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 mt-0.5 ${
              isExactMatch ? 'text-red-600' : 'text-yellow-600'
            }`}>
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className={`font-semibold text-lg ${
                isExactMatch ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {isExactMatch 
                  ? getText('⚠️ Duplicate Session Detected', '⚠️ Sidang Duplikat Terdeteksi')
                  : getText('🔍 Similar Name Found', '🔍 Nama Serupa Ditemukan')
                }
              </h4>
              <p className={`text-sm mt-2 ${
                isExactMatch ? 'text-red-700' : 'text-yellow-700'
              }`}>
                {isExactMatch 
                  ? getText(
                      `Student "${duplicateWarning.studentName}" already has ${duplicateWarning.sessions.length} examination session(s). Creating another session will result in duplicate entries.`,
                      `Mahasiswa "${duplicateWarning.studentName}" sudah memiliki ${duplicateWarning.sessions.length} jadwal sidang. Membuat sidang lain akan mengakibatkan duplikasi data.`
                    )
                  : getText(
                      `Found ${duplicateWarning.sessions.length} session(s) with similar name. Please verify this is a different student.`,
                      `Ditemukan ${duplicateWarning.sessions.length} sidang dengan nama serupa. Pastikan ini mahasiswa yang berbeda.`
                    )
                }
              </p>
              
              {/* ✅ Show existing sessions with enhanced styling */}
              <div className="mt-4 space-y-3">
                <h5 className={`text-sm font-semibold ${
                  isExactMatch ? 'text-red-800' : 'text-yellow-800'
                }`}>
                  {getText('Existing Sessions:', 'Sidang yang Ada:')}
                </h5>
                
                {duplicateWarning.sessions.slice(0, 3).map((session, index) => (
                  <div key={session.id} className={`text-xs p-3 rounded-lg border ${
                    isExactMatch 
                      ? 'bg-red-100 border-red-200' 
                      : 'bg-yellow-100 border-yellow-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-gray-800">
                        #{index + 1} - {session.student?.full_name} ({session.student?.identity_number})
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isExactMatch 
                          ? 'bg-red-200 text-red-800' 
                          : 'bg-yellow-200 text-yellow-800'
                      }`}>
                        {session.student?.study_program?.name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-gray-600">
                      <div>
                        <span className="font-medium">📅 Date:</span> {format(parseISO(session.date), 'MMM d, yyyy')}
                      </div>
                      <div>
                        <span className="font-medium">⏰ Time:</span> {session.start_time} - {session.end_time}
                      </div>
                      <div>
                        <span className="font-medium">🏢 Room:</span> {session.room?.name}
                      </div>
                      <div>
                        <span className="font-medium">📝 Title:</span> {session.title?.substring(0, 30)}...
                      </div>
                    </div>
                  </div>
                ))}
                
                {duplicateWarning.sessions.length > 3 && (
                  <div className="text-xs text-gray-500 text-center py-2">
                    {getText(
                      `+ ${duplicateWarning.sessions.length - 3} more sessions`,
                      `+ ${duplicateWarning.sessions.length - 3} sidang lainnya`
                    )}
                  </div>
                )}
              </div>
              
              {/* ✅ Action recommendation */}
              {isExactMatch && (
                <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800 font-medium">
                    💡 {getText(
                      'Recommendation: Please verify the student information. If this is correct, the system will require confirmation before creating another session.',
                      'Rekomendasi: Silakan verifikasi informasi mahasiswa. Jika ini benar, sistem akan meminta konfirmasi sebelum membuat sidang lain.'
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    useEffect(() => {
      if (formData.student_nim && studentInputRef.current && !localData.current.studentNim) {
        studentInputRef.current.value = formData.student_nim;
        localData.current.studentNim = formData.student_nim;
      }
      
      if (formData.student_name && studentNameRef.current && !localData.current.studentName) {
        studentNameRef.current.value = formData.student_name;
        localData.current.studentName = formData.student_name;
      }
      
      if (formData.study_program_id && !localData.current.studyProgramId) {
        const selectedProgram = studyPrograms.find(sp => sp.id === formData.study_program_id);
        if (selectedProgram && programDisplayRef.current) {
          const display = `${selectedProgram.name} (${selectedProgram.code})`;
          programDisplayRef.current.value = display;
          localData.current.selectedProgramDisplay = display;
          localData.current.studyProgramId = formData.study_program_id;
        }
      }
    }, []);

    return (
      <div className="space-y-4 md:space-y-6">
        <div className="text-center mb-4 md:mb-8">
          <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
            {getText('Student Information', 'Informasi Mahasiswa')}
          </h3>
          <p className="text-sm md:text-base text-gray-600">
            {getText('Please select or enter student details for the examination', 'Silakan pilih atau masukkan detail mahasiswa untuk sidang')}
          </p>
        </div>

        {/* ✅ Duplicate Warning Display */}
        <DuplicateWarningCard />
        
        <div className="space-y-4 md:grid md:grid-cols-1 lg:grid-cols-3 md:gap-6 md:space-y-0">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText("Student NIM", "NIM Mahasiswa")} *
              {isCheckingDuplicate && (
                <span className="ml-2 text-blue-600">
                  <RefreshCw className="h-3 w-3 animate-spin inline" />
                </span>
              )}
            </label>
            <div className="relative">
              <input
                ref={studentInputRef}
                type="text"
                placeholder={getText("Search student by NIM or name...", "Cari mahasiswa berdasarkan NIM atau nama...")}
                onInput={handleStudentInputChange}
                onFocus={(e) => {
                  showStudentDropdown(e.target.value);
                }}
                onBlur={() => {
                  syncToParentForm();
                  setTimeout(() => hideStudentDropdown(), 150);
                }}
                className={`w-full px-4 py-3 pr-10 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                  duplicateWarning?.type === 'exact_match' 
                    ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                    : duplicateWarning?.type === 'name_match'
                    ? 'border-yellow-300 focus:ring-yellow-500 bg-yellow-50'
                    : 'border-gray-300 focus:ring-blue-500 bg-white'
                }`}
                autoComplete="off"
              />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <div ref={dropdownRef} style={{ display: 'none' }}></div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText("Student Name", "Nama Mahasiswa")} *
            </label>
            <input
              ref={studentNameRef}
              type="text"
              placeholder={getText("Enter student name...", "Masukkan nama mahasiswa...")}
              onInput={handleStudentNameChange}
              onBlur={() => {
                syncToParentForm();
              }}
              className={`w-full px-3 md:px-4 py-2 md:py-3 border rounded-lg md:rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 text-sm md:text-base ${
                duplicateWarning?.type === 'exact_match' 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50' 
                  : duplicateWarning?.type === 'name_match'
                  ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-yellow-50'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-white'
              }`}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText("Study Program", "Program Studi")} *
            </label>
            <div className="relative">
              <input
                ref={programDisplayRef}
                type="text"
                readOnly
                placeholder={getText("Click to select program...", "Klik untuk pilih program...")}
                onClick={showProgramDropdown}
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 cursor-pointer bg-white"
              />
             <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <div ref={programDropdownRef} style={{ display: 'none' }}></div>
            </div>
          </div>
        </div>
        
        {formData.student_nim && !form.getValues('student_id') && !duplicateWarning && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg md:rounded-xl p-3 md:p-4">
            <div className="flex items-start space-x-2 md:space-x-3">
              <User className="h-4 w-4 md:h-5 md:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs md:text-sm text-blue-800">
                <p className="font-semibold">
                  {getText('New Student Registration', 'Pendaftaran Mahasiswa Baru')}
                </p>
                <p className="mt-1">
                  {getText('Student not found in database. A new student account will be automatically created when you save this session.', 'Mahasiswa tidak ditemukan di database. Akun mahasiswa baru akan otomatis dibuat saat Anda menyimpan jadwal sidang ini.')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ✅ ScheduleInformationStep
  const ScheduleInformationStep = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="text-center mb-4 md:mb-6">
        <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
          {getText('When will the examination be?', 'Kapan sidang akan dilaksanakan?')}
        </h3>
        <p className="text-sm md:text-base text-gray-600">
          {getText('Please set the date and time for the examination', 'Silakan tentukan tanggal dan waktu sidang')}
        </p>
      </div>
      
      <div className="space-y-4 md:grid md:grid-cols-3 md:gap-6 md:space-y-0 max-w-2xl mx-auto">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Date", "Tanggal")} *
          </label>
         <input
            {...form.register('date')}
            type="date"
            className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm md:text-base"
          />
          {form.formState.errors.date && (
            <p className="mt-1 text-xs md:text-sm text-red-600">{form.formState.errors.date.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Start Time", "Waktu Mulai")} *
          </label>
          <input
            {...form.register('start_time')}
            type="time"
            className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm md:text-base"
          />
          {form.formState.errors.start_time && (
            <p className="mt-1 text-xs md:text-sm text-red-600">{form.formState.errors.start_time.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("End Time", "Waktu Selesai")} *
          </label>
          <input
            {...form.register('end_time')}
            type="time"
            className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm md:text-base"
          />
          {form.formState.errors.end_time && (
            <p className="mt-1 text-xs md:text-sm text-red-600">{form.formState.errors.end_time.message}</p>
          )}
        </div>
      </div>

     {watchDate && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg md:rounded-xl p-3 md:p-4 max-w-md mx-auto">
          <div className="flex items-center space-x-2 md:space-x-3">
            <Calendar className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
            <div className="text-xs md:text-sm text-green-800">
              <p className="font-semibold">
                {getText('Selected Date', 'Tanggal Terpilih')}
              </p>
              <p className="mt-1">
                {format(new Date(watchDate), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  {/* Sessions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{getText("Registered Sessions", "Jadwal Sidang Terdaftar")}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText("Student", "Mahasiswa")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText("Schedule", "Jadwal")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText("Room", "Ruangan")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText("Committee", "Panitia")}
                </th>
                {profile?.role === 'department_admin' && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {getText("Actions", "Aksi")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={profile?.role === 'department_admin' ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">{getText("No sessions found", "Tidak ada jadwal sidang ditemukan")}</p>
                      <p>{getText("Create your first examination session", "Buat jadwal sidang pertama Anda")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((session: any) => (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">{session.student?.full_name}</div>
                         <div className="text-sm text-gray-600 font-mono">{session.student?.identity_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{format(parseISO(session.date), 'MMM d, yyyy')}</div>
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full inline-block mt-1">
                          {session.start_time} - {session.end_time}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-white" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{session.room?.name || 'N/A'}</div>
                          <div className="text-sm text-gray-600">{session.room?.code || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        <div><span className="font-medium text-blue-600">{getText('Supervisor', 'Pembimbing')}:</span> {session.supervisor}</div>
                        <div><span className="font-medium text-green-600">{getText('Examiner', 'Penguji')}:</span> {session.examiner}</div>
                        <div><span className="font-medium text-purple-600">{getText('Secretary', 'Sekretaris')}:</span> {session.secretary}</div>
                      </div>
                    </td>
                    {profile?.role === 'department_admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(session)}
                            className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(session)}
                            className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Progressive Form Modal */}
      {showModal && profile?.role === 'department_admin' && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
              resetForm();
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl flex flex-col overflow-hidden" 
            style={{ 
              height: 'calc(100vh - 16px)',
              maxHeight: '95vh'
            }}
          >
            
            <div className="md:hidden bg-white border-b border-gray-200 p-3 flex-shrink-0">
              <MobileProgressIndicator />
            </div>
            
            <div className="flex flex-1 min-h-0">
              <div className="hidden md:block flex-shrink-0">
                <ProgressSidebar />
              </div>
              
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between p-3 md:p-6 border-b border-gray-200 bg-white flex-shrink-0">
                  <h3 className="text-base md:text-xl font-bold text-gray-900 flex items-center space-x-2">
                    <UserCheck className="h-4 w-4 md:h-6 md:w-6 text-blue-600" />
                    <span className="hidden sm:inline">
                      {editingSession ? getText('Edit Session', 'Edit Sidang') : getText('Create Session', 'Buat Sidang')}
                    </span>
                    <span className="sm:hidden text-sm">
                      {editingSession ? getText('Edit', 'Edit') : getText('Create', 'Buat')}
                    </span>
                  </h3>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl flex-shrink-0"
                  >
                    <X className="h-4 w-4 md:h-5 md:w-5" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 md:p-8 bg-gray-50 min-h-0">
                  <div className="max-w-4xl mx-auto">
                    {renderCurrentStep()}
                  </div>
                </div>
                
                <div className="border-t border-gray-200 p-3 md:p-6 bg-white flex-shrink-0">
                  <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4 max-w-4xl mx-auto">
                    <div className="flex w-full sm:w-auto space-x-3 sm:space-x-0">
                      {currentStep > 1 && (
                        <button
                          type="button"
                          onClick={handleStepBack}
                          className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 md:px-4 py-2 md:py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span className="hidden sm:inline">{getText('Back', 'Kembali')}</span>
                          <span className="sm:hidden">Back</span>
                        </button>
                      )}
                    </div>

                    <div className="w-full sm:w-auto">
                      {currentStep < 3 ? (
                        <button
                          type="button"
                          onClick={() => handleStepComplete(currentStep)}
                          className="w-full flex items-center justify-center space-x-2 px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 text-sm"
                        >
                          <span>{getText('Continue', 'Lanjutkan')}</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSubmitWithValidation}
                          disabled={submitting}
                          className="w-full flex items-center justify-center space-x-2 px-4 md:px-6 py-2 md:py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>{getText('Saving...', 'Menyimpan...')}</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              <span className="hidden sm:inline">
                                {editingSession ? getText('Update Session', 'Perbarui Sidang') : getText('Create Session', 'Buat Sidang')}
                              </span>
                              <span className="sm:hidden">
                                {editingSession ? getText('Update', 'Perbarui') : getText('Create', 'Buat')}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendarModal && (
        <CalendarModal />
      )}

      {/* ✅ Print Modal - Simplified */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <Printer className="h-6 w-6 text-blue-600" />
                  <span>{getText("Print Session Schedule", "Cetak Jadwal Sidang")}</span>
                </h3>
                <button 
                  onClick={() => setShowPrintModal(false)} 
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors" 
                > 
                  <X className="h-6 w-6" /> 
                </button>
              </div>
              <form onSubmit={printForm.handleSubmit(handlePrint)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{getText("Study Program", "Program Studi")} *</label>
                  <Controller 
                    name="study_program_id" 
                    control={printForm.control} 
                    render={({ field }) => { 
                      const options = studyPrograms.map(p => ({ 
                        value: p.id, 
                        label: `${p.name} - ${p.department?.name || 'Unknown Dept'}` 
                      })); 
                      const currentValue = options.find(o => o.value === field.value); 
                      return ( 
                        <Select 
                          {...field} 
                          options={options} 
                          value={currentValue} 
                          onChange={option => field.onChange(option ? option.value : '')} 
                          placeholder={getText("Select study program...", "Pilih program studi...")} 
                          isClearable 
                        /> 
                      )
                    }} 
                  />
                  {printForm.formState.errors.study_program_id && (
                    <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.study_program_id.message}</p>
                  )}
                </div>
                <div className="flex space-x-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowPrintModal(false)} 
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                  >
                    {getText("Cancel", "Batal")}
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
                  >
                    <Printer className="h-4 w-4" />
                    <span>{getText("Generate PDF", "Buat PDF")}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && <DeleteConfirmationModal />}
    </div>
  );
};

export default SessionScheduleProgressive;