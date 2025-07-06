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

  // Calendar Modal states
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedRoomForCalendar, setSelectedRoomForCalendar] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateSessions, setSelectedDateSessions] = useState([]);
  
  // ✅ NEW: Mobile details toggle state
  const [showMobileDetails, setShowMobileDetails] = useState(false);

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

  // ✅ validateStep yang membaca nilai DOM dan React state
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
  
  // ✅ handleStepComplete yang sinkronisasi DOM -> React state
  const handleStepComplete = useCallback((step) => {
    if (step === 1) {
      const nimValue = studentInputRef.current?.value || '';
      const nameValue = studentNameRef.current?.value || '';
      const programValue = formData.study_program_id || '';
      
      if (!nimValue.trim() || !nameValue.trim() || !programValue) {
        alert.error(getText('Please fill all required fields', 'Silakan isi semua field yang diperlukan'));
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
  }, [validateStep, getText, form, formData]);

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

// ✅ TAMBAH FUNCTION BARU - Submit dengan validasi
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
  // ✅ StudentInformationStep
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

      const dropdownHTML = `
        <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          ${filteredStudents.map(student => `
            <div 
              class="dropdown-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
              data-student-id="${student.id}"
              data-student-nim="${student.identity_number}"
              data-student-name="${student.full_name}"
              data-program-id="${student.study_program_id || ''}"
            >
              <div class="font-semibold text-gray-800">${student.identity_number}</div>
              <div class="text-sm text-gray-600">${student.full_name}</div>
              ${student.study_program ? `<div class="text-xs text-gray-500">${student.study_program.name}</div>` : ''}
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
            
            studentInputRef.current.value = studentNim;
            studentNameRef.current.value = studentName;
            
            localData.current.studentNim = studentNim;
            localData.current.studentName = studentName;
            localData.current.studyProgramId = programId;
            
            form.setValue('student_id', studentId);
            syncToParentForm();
            
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
        
        <div className="space-y-4 md:grid md:grid-cols-1 lg:grid-cols-3 md:gap-6 md:space-y-0">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText("Student NIM", "NIM Mahasiswa")} *
            </label>
            <div className="relative">
              <input
                ref={studentInputRef}
                type="text"
                placeholder={getText("Search student by NIM or name...", "Cari mahasiswa berdasarkan NIM atau nama...")}
                onInput={(e) => {
                  localData.current.studentNim = e.target.value;
                  showStudentDropdown(e.target.value);
                }}
                onFocus={(e) => {
                  showStudentDropdown(e.target.value);
                }}
                onBlur={() => {
                  syncToParentForm();
                  setTimeout(() => hideStudentDropdown(), 150);
                }}
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
              onInput={(e) => {
                localData.current.studentName = e.target.value;
              }}
              onBlur={() => {
                syncToParentForm();
              }}
              className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm md:text-base"
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
        
        {formData.student_nim && !form.getValues('student_id') && (
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

  // ✅ RoomAndDetailsStep dengan DOM manipulation
  const RoomAndDetailsStep = () => {
    const roomDisplayRef = useRef(null);

    const dosenData = useRef({
      supervisorSearch: '',
      examinerSearch: '',
      secretarySearch: '',
      roomSearch: '',
      selectedRoomDisplay: '',
      showSupervisorDropdown: false,
      showExaminerDropdown: false,
      showSecretaryDropdown: false,
      showRoomDropdown: false
    });

    const showLecturerDropdown = (type, searchTerm) => {
      if (!searchTerm.trim()) {
        hideLecturerDropdown(type);
        return;
      }

      const filteredLecturers = lecturers.filter(lecturer =>
        lecturer && 
        lecturer.full_name &&
        lecturer.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (filteredLecturers.length === 0) {
        hideLecturerDropdown(type);
        return;
      }

      const dropdownHTML = `
        <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          ${filteredLecturers.map(lecturer => `
            <div 
              class="lecturer-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
              data-lecturer-name="${lecturer.full_name}"
            >
              <div class="font-semibold text-gray-800">${lecturer.full_name}</div>
            </div>
          `).join('')}
        </div>
      `;

      const dropdownContainer = document.querySelector(`#${type}-dropdown`);
      if (dropdownContainer) {
        dropdownContainer.innerHTML = dropdownHTML;
        dropdownContainer.style.display = 'block';
        
        dropdownContainer.querySelectorAll('.lecturer-item').forEach(item => {
          item.addEventListener('mousedown', (e) => e.preventDefault());
          item.addEventListener('click', (e) => {
            const lecturerName = e.currentTarget.dataset.lecturerName;
            
            const inputRef = type === 'supervisor' ? supervisorInputRef : 
                            type === 'examiner' ? examinerInputRef : secretaryInputRef;
            
            if (inputRef.current) {
              inputRef.current.value = lecturerName;
            }
            
            form.setValue(type, lecturerName);
            dosenData.current[`${type}Search`] = lecturerName;
            
            hideLecturerDropdown(type);
            inputRef.current?.focus();
          });
        });
      }
    };

    const hideLecturerDropdown = (type) => {
      const dropdownContainer = document.querySelector(`#${type}-dropdown`);
      if (dropdownContainer) {
        dropdownContainer.style.display = 'none';
      }
    };

    const showRoomDropdown = () => {
      const dropdownHTML = `
        <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden">
          <div class="p-3 border-b border-gray-100">
            <input
              type="text"
              placeholder="${getText("Search rooms...", "Cari ruangan...")}"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              id="room-search-input"
              autocomplete="off"
            />
          </div>
          <div class="max-h-60 overflow-y-auto" id="room-list">
            ${availableRooms.map(room => `
              <div 
                class="room-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                data-room-id="${room.id}"
                data-room-name="${room.name}"
                data-room-code="${room.code}"
              >
                <div class="font-semibold text-gray-800">${room.name} - ${room.code}</div>
                <div class="text-sm text-gray-600">Kapasitas: ${room.capacity || 'N/A'}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      const roomDropdownContainer = document.querySelector('#room-dropdown');
      if (roomDropdownContainer) {
        roomDropdownContainer.innerHTML = dropdownHTML;
        roomDropdownContainer.style.display = 'block';
        
        const searchInput = roomDropdownContainer.querySelector('#room-search-input');
        const roomList = roomDropdownContainer.querySelector('#room-list');
        
        if (searchInput) {
          searchInput.focus();
          searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredRooms = availableRooms.filter(room =>
              room.name.toLowerCase().includes(searchTerm) ||
              room.code.toLowerCase().includes(searchTerm)
            );
            
            roomList.innerHTML = filteredRooms.map(room => `
              <div 
                class="room-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                data-room-id="${room.id}"
                data-room-name="${room.name}"
                data-room-code="${room.code}"
              >
                <div class="font-semibold text-gray-800">${room.name} - ${room.code}</div>
                <div class="text-sm text-gray-600">Kapasitas: ${room.capacity || 'N/A'}</div>
              </div>
            `).join('');
            
            addRoomListeners();
          });
        }
        
        addRoomListeners();
      }
    };

    const addRoomListeners = () => {
      document.querySelectorAll('.room-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const roomId = e.currentTarget.dataset.roomId;
          const roomName = e.currentTarget.dataset.roomName;
          const roomCode = e.currentTarget.dataset.roomCode;
          
          const display = `${roomName} - ${roomCode}`;
          dosenData.current.selectedRoomDisplay = display;
          
          if (roomDisplayRef.current) {
            roomDisplayRef.current.value = display;
          }
          
          form.setValue('room_id', roomId);
          hideRoomDropdown();
        });
      });
    };

    const hideRoomDropdown = () => {
      const roomDropdownContainer = document.querySelector('#room-dropdown');
      if (roomDropdownContainer) {
        roomDropdownContainer.style.display = 'none';
      }
    };

    useEffect(() => {
      const supervisorValue = form.getValues('supervisor');
      if (supervisorValue && supervisorInputRef.current) {
        supervisorInputRef.current.value = supervisorValue;
        dosenData.current.supervisorSearch = supervisorValue;
      }
      
      const examinerValue = form.getValues('examiner');
      if (examinerValue && examinerInputRef.current) {
        examinerInputRef.current.value = examinerValue;
        dosenData.current.examinerSearch = examinerValue;
      }
      
      const secretaryValue = form.getValues('secretary');
      if (secretaryValue && secretaryInputRef.current) {
        secretaryInputRef.current.value = secretaryValue;
        dosenData.current.secretarySearch = secretaryValue;
      }
      
      const roomId = form.getValues('room_id');
      if (roomId && roomDisplayRef.current) {
        const room = availableRooms.find(r => r.id === roomId);
        if (room) {
          const display = `${room.name} - ${room.code}`;
          roomDisplayRef.current.value = display;
          dosenData.current.selectedRoomDisplay = display;
        }
      }
      
      const titleValue = form.getValues('title');
      if (titleValue && titleInputRef.current) {
        titleInputRef.current.value = titleValue;
      }
    }, [currentStep]);

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
            {getText('Room & Examination Details', 'Ruangan & Detail Sidang')}
          </h3>
          <p className="text-sm md:text-base text-gray-600">
            {getText('Complete the examination setup with room, title and committee', 'Lengkapi pengaturan sidang dengan ruangan, judul dan panitia')}
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-base font-semibold text-gray-800 flex items-center space-x-2">
            <Building className="h-4 w-4 text-blue-500" />
            <span>{getText('Room', 'Ruangan')}</span>
          </h4>
          <div className="relative">
            <input
              ref={roomDisplayRef}
              type="text"
              readOnly
              placeholder={getText("Click to select room...", "Klik untuk pilih ruangan...")}
              onClick={showRoomDropdown}
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 cursor-pointer bg-white"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <div id="room-dropdown" style={{ display: 'none' }}></div>
          </div>
          
          {form.formState.errors.room_id && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.room_id.message}</p>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-base font-semibold text-gray-800 flex items-center space-x-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span>{getText('Thesis Title', 'Judul Skripsi/Tesis')}</span>
          </h4>
          <textarea
            ref={titleInputRef}
            rows={3}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm resize-none"
            placeholder={getText("Enter the complete thesis title...", "Masukkan judul lengkap skripsi/tesis...")}
            onInput={(e) => {
              form.setValue('title', e.target.value);
            }}
            onBlur={(e) => {
              form.setValue('title', e.target.value);
            }}
          />
          {form.formState.errors.title && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-base font-semibold text-gray-800 flex items-center space-x-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span>{getText('Examination Committee', 'Panitia Sidang')}</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getText("Supervisor", "Pembimbing")} *
              </label>
              <div className="relative">
                <input
                  ref={supervisorInputRef}
                  type="text"
                  placeholder={getText("Search supervisor...", "Cari pembimbing...")}
                  onInput={(e) => {
                    dosenData.current.supervisorSearch = e.target.value;
                    showLecturerDropdown('supervisor', e.target.value);
                  }}
                  onFocus={(e) => {
                    showLecturerDropdown('supervisor', e.target.value);
                  }}
                  onBlur={(e) => {
                    form.setValue('supervisor', e.target.value);
                    setTimeout(() => hideLecturerDropdown('supervisor'), 150);
                  }}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  autoComplete="off"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <div id="supervisor-dropdown" style={{ display: 'none' }}></div>
              </div>
              {form.formState.errors.supervisor && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.supervisor.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getText("Examiner", "Penguji")} *
              </label>
              <div className="relative">
                <input
                  ref={examinerInputRef}
                  type="text"
                  placeholder={getText("Search examiner...", "Cari penguji...")}
                  onInput={(e) => {
                    dosenData.current.examinerSearch = e.target.value;
                    showLecturerDropdown('examiner', e.target.value);
                  }}
                  onFocus={(e) => {
                    showLecturerDropdown('examiner', e.target.value);
                  }}
                  onBlur={(e) => {
                    form.setValue('examiner', e.target.value);
                    setTimeout(() => hideLecturerDropdown('examiner'), 150);
                  }}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  autoComplete="off"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <div id="examiner-dropdown" style={{ display: 'none' }}></div>
              </div>
              {form.formState.errors.examiner && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.examiner.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getText("Secretary", "Sekretaris")} *
              </label>
              <div className="relative">
                <input
                  ref={secretaryInputRef}
                  type="text"
                  placeholder={getText("Search secretary...", "Cari sekretaris...")}
                  onInput={(e) => {
                    dosenData.current.secretarySearch = e.target.value;
                    showLecturerDropdown('secretary', e.target.value);
                  }}
                  onFocus={(e) => {
                    showLecturerDropdown('secretary', e.target.value);
                  }}
                  onBlur={(e) => {
                    form.setValue('secretary', e.target.value);
                    setTimeout(() => hideLecturerDropdown('secretary'), 150);
                  }}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  autoComplete="off"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <div id="secretary-dropdown" style={{ display: 'none' }}></div>
              </div>
              {form.formState.errors.secretary && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.secretary.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ✅ ProgressSidebar
  const ProgressSidebar = () => (
    <div className="w-72 bg-white border-r-2 border-blue-100 p-6">
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900">Session Creation</h3>
        <p className="text-sm text-gray-500 mt-1">Follow the steps below</p>
      </div>

      <div className="space-y-6">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = currentStep === step.id;
          
          return (
            <div key={step.id} className="relative flex items-start">
              {index < steps.length - 1 && (
                <div className={`absolute left-6 top-12 w-0.5 h-16 ${
                  isCompleted ? 'bg-blue-500' : 'bg-gray-200'
                }`} />
              )}
              
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 relative z-10 ${
                isCompleted
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : isCurrent
                  ? 'bg-white border-blue-500 text-blue-500 ring-4 ring-blue-100'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}>
                {isCompleted ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              
              <div className="ml-4">
                <div className={`text-sm font-medium ${isCurrent || isCompleted ? 'text-blue-600' : 'text-gray-400'}`}>
                  Step {step.id}
                </div>
                <div className={`font-semibold ${isCurrent || isCompleted ? 'text-gray-900' : 'text-gray-500'}`}>
                  {step.title}
                </div>
                <div className="text-sm text-gray-500 mt-1">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <StudentInformationStep />;
      case 2:
        return <ScheduleInformationStep />;
      case 3:
        return <RoomAndDetailsStep />;
      default:
        return null;
    }
  };

  // ✅ handleSubmit menggunakan BookRoom pattern
  const handleSubmit = async (data: SessionFormData) => {
    try {
      setSubmitting(true);

      let finalStudentId = data.student_id;
      
      if (!finalStudentId && formData.student_nim && formData.student_name) {
        const { data: existingUser, error: findError } = await supabase
          .from('users')
          .select('id')
          .eq('identity_number', formData.student_nim)
          .maybeSingle();
        
        if (findError) {
          console.error('Error finding user:', findError);
          throw new Error(`Failed to check existing user: ${findError.message}`);
        }

        if (existingUser) {
          finalStudentId = existingUser.id;
        } else {
          const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id);
          
          if (!selectedProgram) {
            throw new Error(getText('Study program not found. Please select a valid study program.', 'Program studi tidak ditemukan. Silakan pilih program studi yang valid.'));
          }
          
          const newUserData = {
            identity_number: formData.student_nim,
            full_name: formData.student_name,
            username: formData.student_nim,
            email: `${formData.student_nim}@student.edu`,
            role: 'student',
            password: formData.student_nim,
            study_program_id: formData.study_program_id,
            department_id: selectedProgram.department_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([newUserData])
            .select('id')
            .single();

          if (createError) {
            console.error('Error creating user:', createError);
            throw new Error(`Failed to create user: ${createError.message}`);
          }

          finalStudentId = newUser.id;
        }
      }

      if (!finalStudentId) {
        throw new Error(getText('Student information is required. Please select or enter student details.', 'Informasi mahasiswa diperlukan. Silakan pilih atau masukkan detail mahasiswa.'));
      }

      const sessionData = {
        student_id: finalStudentId,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        room_id: data.room_id,
        title: data.title.trim(),
        supervisor: data.supervisor.trim(),
        examiner: data.examiner.trim(),
        secretary: data.secretary.trim(),
      };

      if (editingSession) {
        const { error } = await supabase
          .from('final_sessions')
          .update(sessionData)
          .eq('id', editingSession.id);
        
        if (error) {
          console.error('Error updating session:', error);
          throw new Error(`Failed to update session: ${error.message}`);
        }
        alert.success(getText('Session updated successfully', 'Jadwal sidang berhasil diperbarui'));
      } else {
        const { data: newSession, error } = await supabase
          .from('final_sessions')
          .insert([sessionData])
          .select('*, student:users(full_name, identity_number), room:rooms(name)')
          .single();
        
        if (error) {
          console.error('Error creating session:', error);
          throw new Error(`Failed to create session: ${error.message}`);
        }

        const studentName = newSession.student?.full_name || formData.student_name;
        const studentNim = newSession.student?.identity_number || formData.student_nim;
        const roomName = newSession.room?.name || 'Selected Room';
        
        alert.success(
          getText(
            `✅ Session created successfully!\n👨‍🎓 Student: ${studentName} (${studentNim})\n🏢 Room: ${roomName}\n📅 Date: ${format(new Date(data.date), 'MMM d, yyyy')}\n⏰ Time: ${data.start_time} - ${data.end_time}`,
            `✅ Jadwal sidang berhasil dibuat!\n👨‍🎓 Mahasiswa: ${studentName} (${studentNim})\n🏢 Ruangan: ${roomName}\n📅 Tanggal: ${format(new Date(data.date), 'MMM d, yyyy')}\n⏰ Waktu: ${data.start_time} - ${data.end_time}`
          )
        );
      }

      setShowModal(false);
      setEditingSession(null);
      resetForm();
      fetchSessions();
    } catch (error) {
      console.error('Error saving session:', error);
      
      let errorMessage = getText('Failed to save session', 'Gagal menyimpan jadwal sidang');
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code === '23505') {
        errorMessage = getText('Duplicate entry detected. Please check your data.', 'Data duplikat terdeteksi. Silakan periksa data Anda.');
      } else if (error.code === '23503') {
        errorMessage = getText('Related data not found. Please refresh and try again.', 'Data terkait tidak ditemukan. Silakan refresh dan coba lagi.');
      }
      
      alert.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ resetForm
  const resetForm = () => {
    form.reset({
      student_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '',
      end_time: '',
      room_id: '',
      title: '',
      supervisor: '',
      examiner: '',
      secretary: '',
    });
    setFormData({ student_name: '', student_nim: '', study_program_id: '' });
    setCurrentStep(1);
    setCompletedSteps(new Set());
  };

  // ✅ handleEdit
  const handleEdit = (session: any) => {
    setEditingSession(session);
    
    form.reset({
      student_id: session.student_id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      room_id: session.room_id,
      title: session.title,
      supervisor: session.supervisor,
      examiner: session.examiner,
      secretary: session.secretary,
    });
    
    setFormData({
      student_name: session.student?.full_name || '',
      student_nim: session.student?.identity_number || '',
      study_program_id: session.student?.study_program?.id || ''
    });
    
    setShowModal(true);
  };

  // ✅ handleDelete
  const handleDelete = async (id: string) => {
    try {
      setSubmitting(true);
      const { error } = await supabase.from('final_sessions').delete().eq('id', id);
      if (error) throw error;
      alert.success(getText('Session deleted successfully', 'Jadwal sidang berhasil dihapus'));
      fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert.error(error.message || getText('Failed to delete session', 'Gagal menghapus jadwal sidang'));
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ NEW: Handle Print PDF Function - Simplified dengan Fixed Layout
  const handlePrint = async (formData: PrintFormData) => {
    try {
      const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id);
      
      if (!selectedProgram) {
        alert.error(getText("Please ensure study program is selected.", "Pastikan program studi telah dipilih."));
        return;
      }

      // ✅ Filter sessions by study program only (tidak terbatas departemen)
      const sessionsToPrint = allSessions.filter(session => 
        session.student?.study_program?.id === formData.study_program_id
      );

      if (sessionsToPrint.length === 0) {
        alert.error(getText("No sessions found for the selected study program.", "Tidak ditemukan jadwal sidang untuk program studi yang dipilih."));
        return;
      }

      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      const logoDataUrl = await getImageDataUrl(logoUNY);

      // ✅ Logo positioning untuk landscape
      doc.addImage(logoDataUrl, 'PNG', 15, 15, 30, 30);
      
      let currentY = 20;
      const headerTextX = pageWidth / 2;

      // ✅ Header text dengan spacing yang baik
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.text("KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI", headerTextX, currentY, { align: 'center' });
      currentY += 5;
      doc.text("UNIVERSITAS NEGERI YOGYAKARTA", headerTextX, currentY, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      currentY += 5;
      doc.text("FAKULTAS VOKASI", headerTextX, currentY, { align: 'center' });
      
      // ✅ Contact info dengan font lebih kecil
      currentY += 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text("Kampus I: Jalan Mandung No. 1 Pengasih, Kulon Progo Telp.(0274)774625", headerTextX, currentY, { align: 'center' });
      currentY += 4;
      doc.text("Kampus II: Pacarejo, Semanu, Gunungkidul Telp. (0274)5042222/(0274)5042255", headerTextX, currentY, { align: 'center' });
      currentY += 4;
      doc.text("Laman: https://fv.uny.ac.id E-mail: fv@uny.ac.id", headerTextX, currentY, { align: 'center' });
      currentY += 8;

      // ✅ Garis pemisah yang tepat untuk landscape dengan margin yang cukup
      doc.setLineWidth(1);
      doc.line(10, currentY, pageWidth - 10, currentY);
      currentY += 10;

      // ✅ Judul sederhana dengan font yang lebih besar
      const subtitle = `JADWAL SIDANG PROGRAM STUDI ${selectedProgram.name.toUpperCase()}`;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const titleMaxWidth = pageWidth - 40;
      const titleLines = doc.splitTextToSize(subtitle, titleMaxWidth);
      doc.text(titleLines, headerTextX, currentY, { align: 'center' });
      currentY += (titleLines.length * 6);

      // ✅ Kolom tabel yang disesuaikan dengan landscape
      const tableColumn = [
        getText("No.", "No."),
        getText("DATE", "TANGGAL"),
        getText("TIME", "WAKTU"),
        getText("STUDENT NAME", "NAMA MAHASISWA"),
        getText("NIM", "NIM"),
        getText("THESIS TITLE", "JUDUL SKRIPSI"),
        getText("ROOM", "RUANG"),
        getText("SUPERVISOR", "PEMBIMBING"),
        getText("EXAMINER", "PENGUJI"),
        getText("SECRETARY", "SEKRETARIS")
      ];

      const tableRows: any[] = [];
      sessionsToPrint.forEach((session, index) => {
        const timeDisplay = `${session.start_time.substring(0, 5)}-${session.end_time.substring(0, 5)}`;
        
        tableRows.push([
          index + 1,
          format(parseISO(session.date), 'dd-MM-yyyy'),
          timeDisplay,
          session.student?.full_name || '-',
          session.student?.identity_number || '-',
          session.title || '-',
          session.room?.name || '-',
          session.supervisor || '-',
          session.examiner || '-',
          session.secretary || '-'
        ]);
      });

      // ✅ Tabel dengan ukuran yang disesuaikan untuk landscape dan font yang lebih besar
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        styles: { 
          fontSize: 8,        // ✅ Font size dikembalikan ke 8 untuk menghemat ruang
          cellPadding: 2,     // ✅ Padding dikembalikan ke 2 untuk menghemat ruang
          valign: 'middle',
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          overflow: 'linebreak',  // ✅ Tambahan untuk text wrapping yang lebih baik
          cellWidth: 'wrap'       // ✅ Auto width calculation
        },
        headStyles: { 
          fillColor: [220, 220, 220], 
          textColor: [0, 0, 0], 
          fontStyle: 'bold', 
          halign: 'center',
          fontSize: 9,       // ✅ Header font size disesuaikan
          cellPadding: 2     // ✅ Header padding disesuaikan
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },    // ✅ No - lebih kecil
          1: { halign: 'center', cellWidth: 22 },    // ✅ Tanggal - sedikit dikurangi
          2: { halign: 'center', cellWidth: 18 },    // ✅ Waktu - dikurangi
          3: { halign: 'left', cellWidth: 42 },      // ✅ Nama Mahasiswa - dikurangi
          4: { halign: 'center', cellWidth: 22 },    // ✅ NIM - dikurangi
          5: { halign: 'left', cellWidth: 58 },      // ✅ Judul Skripsi - diperkecil dari 80 ke 58
          6: { halign: 'center', cellWidth: 18 },    // ✅ Ruang - dikurangi
          7: { halign: 'left', cellWidth: 30 },      // ✅ Pembimbing - dikurangi
          8: { halign: 'left', cellWidth: 30 },      // ✅ Penguji - dikurangi
          9: { halign: 'left', cellWidth: 30 }       // ✅ Sekretaris - dikurangi
        },
        // ✅ Total width = 280mm (pas untuk landscape A4)
        tableWidth: 'auto',
        margin: { left: 10, right: 10 },
        // ✅ Hapus didDrawPage yang menyebabkan halaman kosong
        showHead: 'everyPage',
        pageBreak: 'auto'
      });

      // ✅ Tidak ada tanda tangan, langsung save dengan nama yang bersih
      const fileName = `Jadwal_Sidang_${selectedProgram.code || selectedProgram.name.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
      setShowPrintModal(false);
    } catch (e: any) {
      console.error("PDF Generation Error:", e);
      alert.error(getText("An unexpected error occurred while generating the PDF.", "Terjadi kesalahan tak terduga saat membuat PDF."));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <UserCheck className="h-8 w-8" />
              <span>{getText("Session Schedule", "Jadwal Sidang")}</span>
            </h1>
            <p className="mt-2 opacity-90">{getText("Manage final examination sessions with progressive workflow", "Kelola jadwal sidang akhir dengan alur kerja progresif")}</p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{sessions.length}</div>
            <div className="text-sm opacity-80">{getText("Total Sessions", "Total Sidang")}</div>
          </div>
        </div>
      </div>

      {/* Action Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">         
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setShowCalendarModal(true);
                setShowMobileDetails(false); // ✅ Reset mobile details when opening calendar
              }}
              className="flex items-center space-x-2 px-4 md:px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Calendar className="h-5 w-5" />
              <span className="hidden sm:inline">{getText("View Calendar", "Lihat Kalender")}</span>
            </button>

            {/* ✅ Print Button - Mobile Responsive */}
            <button
              onClick={() => {
                setShowPrintModal(true);
                printForm.reset();
              }}
              className="flex items-center space-x-2 px-4 md:px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Printer className="h-5 w-5" />
              <span className="hidden sm:inline">{getText("Print", "Cetak")}</span>
            </button>
            
            {profile?.role === 'department_admin' && (
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="flex items-center space-x-2 px-4 md:px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">{getText("Create Session", "Buat Sidang")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

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
                            onClick={() => handleDelete(session.id)}
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
    </div>
  );
};

export default SessionScheduleProgressive;