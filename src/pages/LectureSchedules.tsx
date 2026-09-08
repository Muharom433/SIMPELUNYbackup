import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Clock,
  Plus,
  Search,
  Edit,
  Trash2,
  Upload,
  RefreshCw,
  X,
  AlertCircle,
  User,
  BookOpen,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Activity,
  TrendingUp,
  FileText,
  Calendar,
  Send,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock3,
  Filter,
  CalendarCheck,
  ChevronDown,
  MapPin,
  Link,
  Check,
  Copy,
  UserPlus,
  Printer
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { alert } from '../components/Alert/AlertHelper';
import ExcelUploadModal from '../components/ExcelUpload/ExcelUploadModal';
import AppendScheduleExcelModal from '../components/ExcelUpload/AppendScheduleExcelModal';
import { useLanguage } from '../contexts/LanguageContext';
import jsPDF from 'jspdf';

// ── Interface: Room ───────────────────────────────────────────────────────────
interface Room {
  id: string;
  name: string;
  code: string;
  capacity: number;
  department_id: string | null;
  is_available: boolean;
}

// Reusable Searchable Dropdown Component (returns name)
const SearchableDropdown = ({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  disabled = false
}: {
  options: { id: string; name: string; code?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => {
    return options.find(option => option.name === value); // Match by name because value is lecturer name string
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const searchLower = searchTerm.toLowerCase().trim();
    return options.filter(option =>
      (option.name?.toLowerCase() || '').includes(searchLower) ||
      (option.code?.toLowerCase() || '').includes(searchLower)
    );
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionName: string) => {
    onChange(optionName); // Pass name back
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-left flex items-center justify-between transition-colors ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'hover:border-teal-500 focus:border-teal-500 bg-white'
          }`}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                {searchTerm ? emptyMessage : 'No options'}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.name)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-teal-50 hover:text-teal-900 transition-colors ${option.name === value ? 'bg-teal-100 text-teal-900' : 'text-gray-900'
                    }`}
                >
                  <div className="font-medium">{option.name}</div>
                  {option.code && <div className="text-xs text-gray-500">{option.code}</div>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ✅ RoomFilterDropdown: Searchable dropdown untuk filter ruangan (returns room name)
const RoomFilterDropdown = ({
  rooms,
  value,
  onChange,
}: {
  rooms: Room[];
  value: string; // 'all' or room name
  onChange: (roomName: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return rooms;
    const s = search.toLowerCase();
    return rooms.filter(r =>
      r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s)
    );
  }, [rooms, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = value === 'all'
    ? 'Semua Ruangan'
    : (rooms.find(r => r.name === value)?.name || value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white min-w-[160px] max-w-[220px] transition-colors"
      >
        <MapPin className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
        <span className="flex-1 text-left truncate text-gray-800">{selectedLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-64 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari ruangan..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
                autoFocus
              />
            </div>
          </div>
          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange('all'); setIsOpen(false); setSearch(''); }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${value === 'all' ? 'bg-teal-50 text-teal-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
            >
              <span className="w-4 text-center">{value === 'all' && <Check className="h-3.5 w-3.5 inline text-teal-600" />}</span>
              Semua Ruangan
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">Ruangan tidak ditemukan</div>
            ) : (
              filtered.map(room => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => { onChange(room.name); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${value === room.name ? 'bg-teal-50 text-teal-700 font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  <span className="w-4 text-center">{value === room.name && <Check className="h-3.5 w-3.5 inline text-teal-600" />}</span>
                  <div>
                    <div className="font-medium text-sm">{room.name}</div>
                    <div className="text-xs text-gray-400">{room.code} · Kapasitas {room.capacity}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Searchable Dropdown Component that returns ID (for user selection)
const SearchableDropdownById = ({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  disabled = false
}: {
  options: { id: string; name: string; code?: string }[];
  value: string; // This is the ID
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => {
    return options.find(option => option.id === value); // Match by ID
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const searchLower = searchTerm.toLowerCase().trim();
    return options.filter(option =>
      (option.name?.toLowerCase() || '').includes(searchLower) ||
      (option.code?.toLowerCase() || '').includes(searchLower)
    );
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionId: string) => {
    onChange(optionId); // Pass ID back
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between transition-colors text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'hover:border-purple-500 focus:border-purple-500 bg-white'
          }`}
      >
        <span className={selectedOption ? 'text-gray-900 truncate' : 'text-gray-500'}>
          {selectedOption ? `${selectedOption.name}${selectedOption.code ? ` (${selectedOption.code})` : ''}` : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                {searchTerm ? emptyMessage : 'No options'}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-purple-50 hover:text-purple-900 transition-colors ${option.id === value ? 'bg-purple-100 text-purple-900' : 'text-gray-900'
                    }`}
                >
                  <div className="font-medium">{option.name}</div>
                  {option.code && <div className="text-xs text-gray-500">{option.code}</div>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ✅ Update schema validation
const scheduleSchema = z.object({
  course_name: z.string().min(2, 'Course name is required'),
  course_code: z.string().min(2, 'Course code is required'),
  lecturer: z.string().min(1, 'Lecturer name is required'),
  room: z.string().min(1, 'Room name is required'), // Ganti dari room_id ke room
  subject_study: z.string().min(1, 'Study program is required'),
  day: z.string().min(1, 'Day is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  semester: z.number().min(1).max(8),
  academics_year: z.number().min(1),
  type: z.enum(['theory', 'practical']),
  class: z.string().min(1, 'Class/Rombel is required'),
  amount: z.number().min(0),
  kurikulum: z.string().optional(),
});

const rescheduleSchema = z.object({
  course_code: z.string().min(2, 'Course code is required'),
  day: z.string().min(1, 'Day is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  room: z.string().min(1, 'Room is required'),
  class: z.string().min(1, 'Class/Rombel is required'),
});

type ScheduleForm = z.infer<typeof scheduleSchema>;
type RescheduleForm = z.infer<typeof rescheduleSchema>;

// ✅ Update interface
interface LectureSchedule {
  id: string;
  subject_study: string | null;
  course_code: string | null;
  course_name: string | null;
  semester: number | null;
  kurikulum: string | null;
  academics_year: number | null;
  type: 'theory' | 'practical';
  class: string | null;
  lecturer: string | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null; // Pastikan ini string, bukan room_id
  amount: number | null;
  created_at: string;
  updated_at: string;
}


interface RescheduleRequest {
  course_code: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
  class: string;
  is_done: boolean | null;
}

const LectureSchedules: React.FC = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();

  // Lecturers State for Dropdown
  const [lecturers, setLecturers] = useState<{ id: string; full_name: string; identity_number?: string }[]>([]);

  // Departments and Study Programs State for Add New User Modal
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<{ id: string; name: string; code: string; department_id: string }[]>([]);

  useEffect(() => {
    const fetchLecturers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, identity_number')
          .eq('role', 'lecturer')
          .order('full_name');

        if (error) throw error;
        setLecturers(data || []);
      } catch (err) {
      }
    };

    const fetchDepartments = async () => {
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('id, name, code')
          .order('name');

        if (error) throw error;
        setDepartments(data || []);
      } catch (err) {
      }
    };

    const fetchStudyPrograms = async () => {
      try {
        const { data, error } = await supabase
          .from('study_programs')
          .select('id, name, code, department_id')
          .order('name');

        if (error) throw error;
        setStudyPrograms(data || []);
      } catch (err) {
      }
    };

    // Fetch once on mount or when modal opens
    fetchLecturers();
    fetchDepartments();
    fetchStudyPrograms();
  }, []);
  const [schedules, setSchedules] = useState<LectureSchedule[]>([]);
  const [totalSchedules, setTotalSchedules] = useState(0); // Server-side pagination
  const [statsMap, setStatsMap] = useState<Record<string, number>>({}); // For chart
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [addScheduleTab, setAddScheduleTab] = useState<'manual' | 'import'>('manual'); // Tab for Add Schedule modal
  const [showAppendExcelModal, setShowAppendExcelModal] = useState(false); // For append mode Excel upload
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showRescheduleRequestsModal, setShowRescheduleRequestsModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LectureSchedule | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [rescheduleFilter, setRescheduleFilter] = useState<string>('pending');
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);

  // Data Matching State
  const [showMatchingModal, setShowMatchingModal] = useState(false);
  const [unmatchedRooms, setUnmatchedRooms] = useState<string[]>([]);
  const [unmatchedLecturers, setUnmatchedLecturers] = useState<string[]>([]);
  const [roomMappings, setRoomMappings] = useState<Record<string, string>>({});
  const [lecturerMappings, setLecturerMappings] = useState<Record<string, string>>({});
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Tab state for matching modal
  const [matchingTab, setMatchingTab] = useState<'rooms' | 'lecturers'>('rooms');

  // State for Add New User Modal in Matching
  const [showAddUserInMatching, setShowAddUserInMatching] = useState(false);
  const [newUserScheduleName, setNewUserScheduleName] = useState('');

  // State for showing lecturer schedules when selected in matching
  const [selectedLecturerForSchedule, setSelectedLecturerForSchedule] = useState<string>(''); // lecturer name from schedule
  const [lecturerSchedules, setLecturerSchedules] = useState<LectureSchedule[]>([]);
  const [loadingLecturerSchedules, setLoadingLecturerSchedules] = useState(false);

  // State for tracking edited schedules
  const [editedScheduleIds, setEditedScheduleIds] = useState<Set<string>>(new Set());
  const [duplicatedScheduleIds, setDuplicatedScheduleIds] = useState<Set<string>>(new Set()); // Original schedules that were duplicated
  const [newScheduleIds, setNewScheduleIds] = useState<Set<string>>(new Set()); // New schedules created from duplication

  // State for duplicate feature
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [scheduleToDuplicate, setScheduleToDuplicate] = useState<LectureSchedule | null>(null);

  // State for split feature (1 jadwal 2 dosen → 2 jadwal)
  const [showSplitConfirm, setShowSplitConfirm] = useState(false);
  const [scheduleToSplitInMatching, setScheduleToSplitInMatching] = useState<LectureSchedule | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: keyof LectureSchedule; direction: 'ascending' | 'descending' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const form = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      semester: 1,
      academics_year: new Date().getFullYear(),
      type: 'theory',
      amount: 0
    }
  });

  const rescheduleForm = useForm<RescheduleForm>({
    resolver: zodResolver(rescheduleSchema),
  });

  // Get unique rooms from schedules for filter dropdown
  const uniqueRooms = useMemo(() => {
    const roomsFromSchedules = schedules
      .map(schedule => schedule.room)
      .filter((room): room is string => Boolean(room))
      .filter((room, index, arr) => arr.indexOf(room) === index)
      .sort();
    return roomsFromSchedules;
  }, [schedules]);

  // Filter rooms for dropdown with search
  const filteredRooms = useMemo(() => {
    return rooms.filter(room =>
      room.is_available &&
      (room.name.toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
        room.code.toLowerCase().includes(roomSearchTerm.toLowerCase()))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms, roomSearchTerm]);

  // Get selected room details
  // ✅ Update selectedRoom computation
  const selectedRoom = useMemo(() => {
    const roomValue = form.watch('room');
    return rooms.find(room => room.id === roomValue);
  }, [rooms, form.watch('room')]);

  const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  useEffect(() => {
    fetchSchedules();
  }, [debouncedSearchTerm, roomFilter, dayFilter, currentPage]);

  useEffect(() => {
    fetchRooms();
    fetchRescheduleRequests();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch schedule stats when profile is loaded (for super_admin only)
  useEffect(() => {
    if (profile?.role === 'super_admin') {
      fetchScheduleStats();
    }
  }, [profile?.role]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchRooms = async () => {
    try {
      // Only select needed columns to optimize query performance
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, code, capacity, department_id, is_available')
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      setRooms(data || []);
    } catch (error: any) {
      alert.error(error.message || 'Failed to load rooms');
    }
  };

  const fetchScheduleStats = async () => {
    try {
      // Fetch lightweight day counts for the chart
      const { data, error } = await supabase
        .from('lecture_schedules')
        .select('day');

      if (error) throw error;


      const counts: Record<string, number> = {};
      data?.forEach((row: { day: string | null }) => {
        if (row.day) {
          const key = row.day.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        }
      });

      setStatsMap(counts);

    } catch (error) {
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);

      let query = supabase.from('lecture_schedules').select('*', { count: 'exact' });

      // Search
      if (debouncedSearchTerm) {
        // Use asterisk wildcards for PostgREST (% doesn't work well with special chars)
        // Escape special characters: comma, parentheses, asterisks, backslash
        const escapedTerm = debouncedSearchTerm
          .replace(/\\/g, '\\\\')  // Escape backslash first
          .replace(/,/g, '\\,')    // Escape comma
          .replace(/\(/g, '\\(')   // Escape opening parenthesis
          .replace(/\)/g, '\\)')   // Escape closing parenthesis
          .replace(/\*/g, '\\*');  // Escape asterisk

        const term = `*${escapedTerm}*`;

        // Search across multiple fields (course_name, course_code, lecturer, room)
        query = query.or(
          `course_name.ilike.${term},` +
          `course_code.ilike.${term},` +
          `lecturer.ilike.${term},` +
          `room.ilike.${term}`
        );
      }

      // Filters
      if (roomFilter !== 'all') {
        query = query.ilike('room', roomFilter); // Case-insensitive match for room name
      }
      if (dayFilter !== 'all') {
        query = query.eq('day', dayFilter); // Exact match usually fine for day dropdown
      }

      // Pagination
      const from = (currentPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to);

      // Order
      query = query.order('day', { ascending: true })
        .order('start_time', { ascending: true });

      const { data, count, error } = await query;
      if (error) throw error;

      setSchedules(data || []);
      setTotalSchedules(count || 0);

    } catch (error: any) {
      alert.error(error.message || 'Failed to load lecture schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchRescheduleRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('reschedule')
        .select('id, schedule_id, new_date, new_start_time, new_end_time, new_room_id, reason, status, requester_id, created_at');

      if (error) throw error;
      setRescheduleRequests(data || []);
    } catch (error: any) {
    }
  };

  // ✅ Update handleSubmit
  const handleSubmit = async (data: ScheduleForm) => {
    try {
      setLoading(true);

      // Dapatkan nama room dari rooms berdasarkan room_id yang dipilih
      const selectedRoomData = rooms.find(r => r.id === data.room);

      const scheduleData = {
        course_name: data.course_name,
        course_code: data.course_code,
        lecturer: data.lecturer,
        room: selectedRoomData?.name || data.room, // Simpan nama room, bukan ID
        subject_study: data.subject_study,
        day: data.day,
        start_time: data.start_time,
        end_time: data.end_time,
        semester: data.semester,
        academics_year: data.academics_year,
        type: data.type,
        class: data.class,
        amount: data.amount,
        kurikulum: data.kurikulum,
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('lecture_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);
        if (error) throw error;

        // Add to edited schedules set
        setEditedScheduleIds(prev => new Set(prev).add(editingSchedule.id));

        // Refresh lecturer schedules if we're viewing them
        if (selectedLecturerForSchedule) {
          fetchLecturerSchedules(selectedLecturerForSchedule);
        }

        alert.success(getText('Schedule updated successfully!', 'Jadwal berhasil diperbarui!'));
      } else {
        const { error } = await supabase
          .from('lecture_schedules')
          .insert(scheduleData);
        if (error) throw error;
        alert.success(getText('Schedule created successfully!', 'Jadwal berhasil dibuat!'));
      }

      setShowModal(false);
      setEditingSchedule(null);
      form.reset();
      fetchSchedules();
    } catch (error: any) {
      alert.error(error.message || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleSubmit = async (data: RescheduleForm) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('reschedule')
        .insert({
          course_code: data.course_code,
          day: data.day,
          start_time: data.start_time,
          end_time: data.end_time,
          room: data.room,
          class: data.class,
          is_done: null
        });

      if (error) throw error;

      alert.success(getText('Reschedule request submitted successfully!', 'Permintaan reschedule berhasil dikirim!'));

      setShowRescheduleModal(false);
      rescheduleForm.reset();
      fetchRescheduleRequests();
    } catch (error: any) {
      alert.error(error.message || 'Failed to submit reschedule request');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule: LectureSchedule) => {
    setEditingSchedule(schedule);

    // Find room ID based on room name
    const room = rooms.find(r => r.name === schedule.room);

    form.reset({
      course_name: schedule.course_name || '',
      course_code: schedule.course_code || '',
      lecturer: schedule.lecturer || '',
      room: room?.id || '',
      subject_study: schedule.subject_study || '',
      day: schedule.day || '',
      start_time: schedule.start_time || '',
      end_time: schedule.end_time || '',
      semester: schedule.semester || 1,
      academics_year: schedule.academics_year || new Date().getFullYear(),
      type: (schedule.type as 'theory' | 'practical') || 'theory',
      class: schedule.class || '',
      amount: schedule.amount || 0,
      kurikulum: schedule.kurikulum || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('lecture_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;
      alert.success(getText('Schedule deleted successfully!', 'Jadwal berhasil dihapus!'));
      setShowDeleteConfirm(null);
      fetchSchedules();
    } catch (error: any) {
      alert.error(error.message || 'Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setLoading(true);

      // Delete all records from lecture_schedules table
      const { error } = await supabase
        .from('lecture_schedules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // This will match all rows

      if (error) throw error;

      alert.success(getText(
        `All ${schedules.length} schedules deleted successfully!`,
        `Semua ${schedules.length} jadwal berhasil dihapus!`
      ));
      setShowDeleteAllConfirm(false);
      fetchSchedules();
    } catch (error: any) {
      alert.error(error.message || getText('Failed to delete all schedules', 'Gagal menghapus semua jadwal'));
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleAction = async (request: RescheduleRequest, isDone: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('reschedule')
        .update({ is_done: isDone })
        .eq('course_code', request.course_code)
        .eq('day', request.day)
        .eq('start_time', request.start_time)
        .eq('end_time', request.end_time)
        .eq('room', request.room)
        .eq('class', request.class);

      if (error) throw error;

      alert.success(getText(
        `Reschedule request ${isDone ? 'completed' : 'unchecked'} successfully!`,
        `Permintaan reschedule berhasil ${isDone ? 'diselesaikan' : 'dibatalkan'}!`
      ));
      fetchRescheduleRequests();
    } catch (error: any) {
      alert.error(error.message || 'Failed to process reschedule request');
    } finally {
      setLoading(false);
    }
  };

  // Data Matching Functions
  const analyzeUnmatchedData = async () => {
    try {
      setMatchingLoading(true);

      // Fetch all unique room and lecturer values from lecture_schedules (fetch ALL, handling 1000 limit)
      let allScheduleData: { room: string | null; lecturer: string | null }[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('lecture_schedules')
          .select('room, lecturer')
          .range(from, from + step - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allScheduleData = [...allScheduleData, ...data];
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      const scheduleData = allScheduleData;

      // Get unique values
      const scheduleRooms = [...new Set((scheduleData || []).map(s => s.room).filter(Boolean))] as string[];
      const scheduleLecturers = [...new Set((scheduleData || []).map(s => s.lecturer).filter(Boolean))] as string[];

      // Compare with master data (rooms)
      const roomNames = rooms.map(r => r.name.toLowerCase());
      const unmatchedRoomsList = scheduleRooms.filter(
        sr => !roomNames.includes(sr.toLowerCase())
      );

      // Compare with master data (lecturers)
      const lecturerNames = lecturers.map(l => l.full_name.toLowerCase());
      const unmatchedLecturersList = scheduleLecturers.filter(
        sl => !lecturerNames.includes(sl.toLowerCase())
      );

      setUnmatchedRooms(unmatchedRoomsList);
      setUnmatchedLecturers(unmatchedLecturersList);

      // Initialize mappings
      setRoomMappings({});
      setLecturerMappings({});

    } catch (error: any) {
      alert.error(getText('Failed to analyze data', 'Gagal menganalisis data'));
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleBulkUpdateRoom = async (oldValue: string, newValue: string) => {
    try {
      setMatchingLoading(true);

      const { error } = await supabase
        .from('lecture_schedules')
        .update({ room: newValue })
        .eq('room', oldValue);

      if (error) throw error;

      alert.success(getText(
        `Successfully updated all schedules with room "${oldValue}" to "${newValue}"`,
        `Berhasil memperbarui semua jadwal dengan ruangan "${oldValue}" ke "${newValue}"`
      ));

      // Re-analyze data and refresh schedules
      await analyzeUnmatchedData();
      fetchSchedules();

    } catch (error: any) {
      alert.error(error.message || getText('Failed to update rooms', 'Gagal memperbarui ruangan'));
    } finally {
      setMatchingLoading(false);
    }
  };

  // ✅ BARU: UPDATE lecture_schedules.lecturer agar cocok dengan users.full_name
  // Tabel users TIDAK DIUBAH — users adalah master data yang dilindungi
  const handleBulkUpdateLecturer = async (scheduleLecturerName: string, selectedUserId: string) => {
    try {
      setMatchingLoading(true);

      const selectedUser = lecturers.find(l => l.id === selectedUserId);
      if (!selectedUser) throw new Error('User not found');

      // Update lecture_schedules: ganti nama di jadwal → nama resmi user, dan set lecturer_user_id
      const { data: updatedSchedules, error: scheduleError } = await supabase
        .from('lecture_schedules')
        .update({
          lecturer: selectedUser.full_name,       // nama resmi dari tabel users
          lecturer_user_id: selectedUserId         // link ke user
        })
        .eq('lecturer', scheduleLecturerName)      // cari berdasarkan nama lama di jadwal
        .select('id');

      if (scheduleError) throw scheduleError;

      const countUpdated = updatedSchedules?.length || 0;

      alert.success(getText(
        `Updated ${countUpdated} schedule(s): lecturer name changed from "${scheduleLecturerName}" to "${selectedUser.full_name}" (users table unchanged)`,
        `Berhasil memperbarui ${countUpdated} jadwal: nama dosen diubah dari "${scheduleLecturerName}" menjadi "${selectedUser.full_name}" (tabel user tidak diubah)`
      ));

      await analyzeUnmatchedData();
      fetchSchedules();

    } catch (error: any) {
      alert.error(error.message || getText('Failed to update lecturer', 'Gagal memperbarui dosen'));
    } finally {
      setMatchingLoading(false);
    }
  };

  // Deteksi apakah nama dosen di jadwal mengandung 2 dosen (separator: /, &, ' dan ', ' and ')
  const detectDualLecturer = (lecturerName: string): string[] => {
    const separators = [' / ', '/', ' & ', '&', ' dan ', ' and ', ' , ', ', '];
    for (const sep of separators) {
      if (lecturerName.includes(sep)) {
        const parts = lecturerName.split(sep).map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) return parts;
      }
    }
    return [];
  };

  // Split jadwal 1 baris (2 dosen) menjadi 2 baris masing-masing 1 dosen
  const handleSplitScheduleInMatching = async (schedule: LectureSchedule, lecturer1: string, lecturer2: string) => {
    try {
      setMatchingLoading(true);

      // Update baris asli → dosen pertama
      const { error: updateError } = await supabase
        .from('lecture_schedules')
        .update({ lecturer: lecturer1, lecturer_user_id: null })
        .eq('id', schedule.id);

      if (updateError) throw updateError;

      // Duplikat baris → dosen kedua
      const { lecturer_user_id: _luid, ...scheduleWithoutLUID } = schedule as any;
      const { error: insertError } = await supabase
        .from('lecture_schedules')
        .insert({
          course_name: schedule.course_name,
          course_code: schedule.course_code,
          subject_study: schedule.subject_study,
          day: schedule.day,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          semester: schedule.semester,
          academics_year: schedule.academics_year,
          type: schedule.type,
          class: schedule.class,
          room: schedule.room,
          amount: schedule.amount,
          kurikulum: schedule.kurikulum,
          lecturer: lecturer2,
          lecturer_user_id: null
        });

      if (insertError) throw insertError;

      alert.success(getText(
        `Schedule split into 2 rows: "${lecturer1}" and "${lecturer2}"`,
        `Jadwal berhasil dipisah menjadi 2 baris: "${lecturer1}" dan "${lecturer2}"`
      ));

      setShowSplitConfirm(false);
      setScheduleToSplitInMatching(null);

      await analyzeUnmatchedData();
      if (selectedLecturerForSchedule) {
        fetchLecturerSchedules(selectedLecturerForSchedule);
      }
      fetchSchedules();

    } catch (error: any) {
      alert.error(error.message || getText('Failed to split schedule', 'Gagal memisahkan jadwal'));
    } finally {
      setMatchingLoading(false);
    }
  };

  // Batch update all rooms that have mappings defined
  const handleBatchUpdateAllRooms = async () => {
    // Get all rooms that have a mapping defined
    const roomsWithMappings = Object.entries(roomMappings).filter(([_, target]) => target);

    if (roomsWithMappings.length === 0) {
      alert.error(getText('Please select target room for at least one item', 'Pilih ruangan target untuk minimal satu item'));
      return;
    }

    try {
      setMatchingLoading(true);

      // Update each room that has a mapping
      for (const [oldRoom, newRoom] of roomsWithMappings) {
        const { error } = await supabase
          .from('lecture_schedules')
          .update({ room: newRoom })
          .eq('room', oldRoom);

        if (error) throw error;
      }

      alert.success(getText(
        `Successfully updated ${roomsWithMappings.length} room mappings`,
        `Berhasil memperbarui ${roomsWithMappings.length} pemetaan ruangan`
      ));

      // Reset mappings and refresh
      setRoomMappings({});
      await analyzeUnmatchedData();
      fetchSchedules();

    } catch (error: any) {
      alert.error(error.message || getText('Failed to update rooms', 'Gagal memperbarui ruangan'));
    } finally {
      setMatchingLoading(false);
    }
  };

  // ✅ BARU: Batch update — update lecture_schedules.lecturer agar cocok dengan users.full_name
  // Tabel users TIDAK DIUBAH
  const handleBatchUpdateAllLecturers = async () => {
    const lecturersWithMappings = Object.entries(lecturerMappings).filter(([_, target]) => target);

    if (lecturersWithMappings.length === 0) {
      alert.error(getText('Please select target user for at least one item', 'Pilih user target untuk minimal satu item'));
      return;
    }

    try {
      setMatchingLoading(true);
      let totalSchedulesUpdated = 0;

      for (const [scheduleLecturerName, userId] of lecturersWithMappings) {
        const selectedUser = lecturers.find(l => l.id === userId);
        if (!selectedUser) continue;

        // Update lecture_schedules: ganti nama lama di jadwal → nama resmi dari users
        const { data: updatedSchedules, error: scheduleError } = await supabase
          .from('lecture_schedules')
          .update({
            lecturer: selectedUser.full_name,
            lecturer_user_id: userId
          })
          .eq('lecturer', scheduleLecturerName)
          .select('id');

        if (scheduleError) throw scheduleError;
        totalSchedulesUpdated += updatedSchedules?.length || 0;
      }

      alert.success(getText(
        `Successfully updated ${totalSchedulesUpdated} schedule(s) across ${lecturersWithMappings.length} mapping(s). Users table was NOT modified.`,
        `Berhasil memperbarui ${totalSchedulesUpdated} jadwal dari ${lecturersWithMappings.length} pemetaan. Tabel user tidak diubah.`
      ));

      setLecturerMappings({});
      await analyzeUnmatchedData();
      fetchSchedules();

    } catch (error: any) {
      alert.error(error.message || getText('Failed to update lecturers', 'Gagal memperbarui dosen'));
    } finally {
      setMatchingLoading(false);
    }
  };

  // Count how many mappings are defined
  const roomMappingsCount = Object.values(roomMappings).filter(v => v).length;
  const lecturerMappingsCount = Object.values(lecturerMappings).filter(v => v).length;

  const openMatchingModal = async () => {
    setShowMatchingModal(true);
    setMatchingTab('rooms');
    setRoomMappings({});
    setLecturerMappings({});
    setSelectedLecturerForSchedule('');
    setLecturerSchedules([]);
    setEditedScheduleIds(new Set()); // Reset edited schedules
    setDuplicatedScheduleIds(new Set()); // Reset duplicated schedules
    setNewScheduleIds(new Set()); // Reset new schedules
    await analyzeUnmatchedData();
  };

  // Confirm all edited and duplicated schedules and refresh data
  const handleConfirmAllEdits = async () => {
    const totalChanges = editedScheduleIds.size + duplicatedScheduleIds.size + newScheduleIds.size;

    if (totalChanges === 0) {
      alert.error(getText('No schedules have been edited or duplicated', 'Tidak ada jadwal yang diedit atau diduplikat'));
      return;
    }

    try {
      setMatchingLoading(true);

      // Refresh all data
      await Promise.all([
        fetchSchedules(),
        analyzeUnmatchedData(),
        selectedLecturerForSchedule ? fetchLecturerSchedules(selectedLecturerForSchedule) : Promise.resolve()
      ]);

      alert.success(getText(
        `Successfully confirmed ${totalChanges} change(s) (${editedScheduleIds.size} edited, ${duplicatedScheduleIds.size} duplicated)`,
        `Berhasil mengkonfirmasi ${totalChanges} perubahan (${editedScheduleIds.size} diedit, ${duplicatedScheduleIds.size} diduplikat)`
      ));

      // Clear edited, duplicated and new schedules
      setEditedScheduleIds(new Set());
      setDuplicatedScheduleIds(new Set());
      setNewScheduleIds(new Set());

    } catch (error: any) {
      alert.error(error.message || getText('Failed to confirm edits', 'Gagal mengkonfirmasi perubahan'));
    } finally {
      setMatchingLoading(false);
    }
  };

  // Fetch schedules for selected lecturer in matching modal
  const fetchLecturerSchedules = async (lecturerName: string) => {
    if (!lecturerName) {
      setLecturerSchedules([]);
      return;
    }

    try {
      setLoadingLecturerSchedules(true);
      const { data, error } = await supabase
        .from('lecture_schedules')
        .select('id, day, start_time, end_time, course_name, course_code, class, room, lecturer, semester, academics_year, type, subject_study, lecturer_user_id')
        .eq('lecturer', lecturerName)
        .order('day', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setLecturerSchedules(data || []);
    } catch (error: any) {
      setLecturerSchedules([]);
    } finally {
      setLoadingLecturerSchedules(false);
    }
  };

  // Handle adding new user from matching modal
  const handleAddNewUserInMatching = async (userData: {
    full_name: string;
    identity_number: string;
    email: string;
    phone_number: string;
    department_id?: string;
    study_program_id?: string;
    is_homebase?: boolean;
  }) => {
    try {
      setMatchingLoading(true);

      // Create new user with lecturer role
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          full_name: userData.full_name,
          identity_number: userData.identity_number,
          email: userData.email,
          phone_number: userData.phone_number,
          department_id: userData.department_id || null,
          study_program_id: userData.study_program_id || null,

          role: 'lecturer',
          is_homebase: userData.is_homebase,
        })
        .select()
        .single();

      if (userError) throw userError;

      alert.success(getText(
        `User "${userData.full_name}" created successfully!`,
        `User "${userData.full_name}" berhasil dibuat!`
      ));

      // Refresh lecturers list
      const { data: updatedLecturers } = await supabase
        .from('users')
        .select('id, full_name, identity_number')
        .eq('role', 'lecturer')
        .order('full_name');

      setLecturers(updatedLecturers || []);

      // Auto-select the newly created user for the current unmatched lecturer
      if (newUserScheduleName) {
        setLecturerMappings(prev => ({ ...prev, [newUserScheduleName]: newUser.id }));
      }

      setShowAddUserInMatching(false);
      setNewUserScheduleName('');

      // Re-analyze to update unmatched list
      await analyzeUnmatchedData();

    } catch (error: any) {
      alert.error(error.message || getText('Failed to add user', 'Gagal menambahkan user'));
    } finally {
      setMatchingLoading(false);
    }
  };

  // Handle duplicate schedule
  const handleDuplicateSchedule = async (duplicateData: Partial<ScheduleForm>) => {
    if (!scheduleToDuplicate) return;

    try {
      setLoading(true);

      // Get room name from room ID
      const selectedRoomData = rooms.find(r => r.id === duplicateData.room);

      const scheduleData = {
        course_name: duplicateData.course_name || scheduleToDuplicate.course_name,
        course_code: duplicateData.course_code || scheduleToDuplicate.course_code,
        lecturer: duplicateData.lecturer || scheduleToDuplicate.lecturer,
        room: selectedRoomData?.name || duplicateData.room || scheduleToDuplicate.room,
        subject_study: duplicateData.subject_study || scheduleToDuplicate.subject_study,
        day: duplicateData.day || scheduleToDuplicate.day,
        start_time: duplicateData.start_time || scheduleToDuplicate.start_time,
        end_time: duplicateData.end_time || scheduleToDuplicate.end_time,
        semester: duplicateData.semester || scheduleToDuplicate.semester,
        academics_year: duplicateData.academics_year || scheduleToDuplicate.academics_year,
        type: duplicateData.type || scheduleToDuplicate.type,
        class: duplicateData.class || scheduleToDuplicate.class,
        amount: duplicateData.amount || scheduleToDuplicate.amount,
        kurikulum: duplicateData.kurikulum || scheduleToDuplicate.kurikulum,
      };

      const { data: newSchedule, error } = await supabase
        .from('lecture_schedules')
        .insert(scheduleData)
        .select()
        .single();

      if (error) throw error;

      // Add original schedule to duplicated set (source)
      setDuplicatedScheduleIds(prev => new Set(prev).add(scheduleToDuplicate.id));

      // Add new schedule to new schedules set (result)
      if (newSchedule) {
        setNewScheduleIds(prev => new Set(prev).add(newSchedule.id));
      }

      // Refresh lecturer schedules if we're viewing them
      if (selectedLecturerForSchedule) {
        fetchLecturerSchedules(selectedLecturerForSchedule);
      }

      alert.success(getText('Schedule duplicated successfully!', 'Jadwal berhasil diduplikat!'));
      setShowDuplicateModal(false);
      setScheduleToDuplicate(null);
      fetchSchedules();
    } catch (error: any) {
      alert.error(error.message || getText('Failed to duplicate schedule', 'Gagal menduplikat jadwal'));
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    try {
      const pendingRequests = rescheduleRequests.filter(request => request.is_done !== true);

      if (pendingRequests.length === 0) {
        alert.error(getText('No pending reschedule requests to export', 'Tidak ada permintaan reschedule yang belum selesai untuk diekspor'));
        return;
      }

      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(getText('Reschedule Requests Report', 'Laporan Permintaan Reschedule'), 20, 30);

      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      const currentDate = new Date().toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.text(getText(`Generated on: ${currentDate}`, `Dibuat pada: ${currentDate}`), 20, 45);
      doc.text(getText(`Total Pending Requests: ${pendingRequests.length}`, `Total Permintaan Belum Selesai: ${pendingRequests.length}`), 20, 55);

      let yPosition = 75;
      const columnWidths = [15, 35, 25, 45, 35, 25];
      const columnPositions = [20, 35, 70, 95, 140, 175];

      doc.setFillColor(59, 130, 246);
      doc.rect(20, yPosition - 8, 180, 15, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');

      const headers = [
        getText('No', 'No'),
        getText('Course Code', 'Kode MK'),
        getText('Day', 'Hari'),
        getText('Time', 'Waktu'),
        getText('Room', 'Ruangan'),
        getText('Class', 'Kelas')
      ];

      headers.forEach((header, index) => {
        doc.text(header, columnPositions[index] + 2, yPosition);
      });

      yPosition += 20;

      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      pendingRequests.forEach((request, index) => {
        if (index % 2 === 0) {
          doc.setFillColor(245, 247, 250);
          doc.rect(20, yPosition - 8, 180, 12, 'F');
        }

        const rowData = [
          (index + 1).toString(),
          request.course_code,
          request.day,
          `${request.start_time} - ${request.end_time}`,
          request.room,
          request.class
        ];

        rowData.forEach((data, colIndex) => {
          doc.text(data, columnPositions[colIndex] + 2, yPosition);
        });

        yPosition += 12;

        if (yPosition > 270) {
          doc.addPage();
          yPosition = 30;
        }
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          getText(
            `Page ${i} of ${pageCount} - SIMPEL Kuliah System`,
            `Halaman ${i} dari ${pageCount} - Sistem SIMPEL Kuliah`
          ),
          20,
          280
        );
      }

      const fileName = getText(
        `Reschedule_Requests_${new Date().toISOString().split('T')[0]}.pdf`,
        `Permintaan_Reschedule_${new Date().toISOString().split('T')[0]}.pdf`
      );

      doc.save(fileName);

      alert.success(getText(
        `PDF exported successfully! (${pendingRequests.length} pending requests)`,
        `PDF berhasil diekspor! (${pendingRequests.length} permintaan belum selesai)`
      ));

    } catch (error) {
      alert.error(getText('Failed to generate PDF', 'Gagal membuat PDF'));
    }
  };

  // ✅ Cetak Jadwal Kuliah ke PDF
  const handlePrintSchedulePDF = async () => {
    const toastId = toast.loading('Menyiapkan PDF jadwal kuliah...');
    try {
      // Fetch ALL schedules for the current filter (no pagination)
      let query = supabase.from('lecture_schedules').select('id, day, start_time, end_time, course_name, course_code, class, room, lecturer, semester, academics_year, type, subject_study');

      if (debouncedSearchTerm) {
        const escapedTerm = debouncedSearchTerm
          .replace(/\\/g, '\\\\')
          .replace(/,/g, '\\,')
          .replace(/\(/g, '\\(')
          .replace(/\)/g, '\\)')
          .replace(/\*/g, '\\*');
        const term = `*${escapedTerm}*`;
        query = query.or(
          `course_name.ilike.${term},course_code.ilike.${term},lecturer.ilike.${term},room.ilike.${term}`
        );
      }
      if (roomFilter !== 'all') {
        query = query.ilike('room', roomFilter);
      }
      if (dayFilter !== 'all') {
        query = query.eq('day', dayFilter);
      }
      query = query.order('day', { ascending: true }).order('start_time', { ascending: true });

      const { data: allSchedules, error } = await query;
      if (error) throw error;

      if (!allSchedules || allSchedules.length === 0) {
        toast.dismiss(toastId);
        toast('Tidak ada jadwal untuk dicetak.', { icon: 'ℹ️' });
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape' });
      const pageW = doc.internal.pageSize.getWidth();

      // ── Header ──────────────────────────────────────────────────────
      doc.setFillColor(13, 148, 136); // teal-600
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('SIMPELUNY - Jadwal Kuliah', 14, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const filterDesc = [
        roomFilter !== 'all' ? `Ruangan: ${roomFilter}` : 'Semua Ruangan',
        dayFilter !== 'all' ? `Hari: ${dayFilter}` : 'Semua Hari',
        debouncedSearchTerm ? `Pencarian: "${debouncedSearchTerm}"` : '',
      ].filter(Boolean).join('  |  ');
      doc.text(filterDesc, 14, 17);
      const nowStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      doc.text(`Dicetak: ${nowStr}`, pageW - 14, 17, { align: 'right' });

      // ── Table header ─────────────────────────────────────────────────
      let y = 32;
      const cols = [
        { label: 'No', x: 14, w: 9 },
        { label: 'Mata Kuliah', x: 23, w: 48 },
        { label: 'Program Studi', x: 71, w: 35 },
        { label: 'Dosen', x: 106, w: 40 },
        { label: 'Ruangan', x: 146, w: 35 },
        { label: 'Hari', x: 181, w: 16 },
        { label: 'Waktu', x: 197, w: 24 },
        { label: 'Kelas', x: 221, w: 14 },
        { label: 'Smt', x: 235, w: 10 },
        { label: 'Tipe', x: 245, w: 15 },
        { label: 'Jml. Mhs', x: 260, w: 18 },
      ];
      const rowH = 8;

      doc.setFillColor(13, 148, 136);
      doc.rect(14, y - 5, pageW - 28, rowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      cols.forEach(col => doc.text(col.label, col.x + 1, y));

      // ── Rows ─────────────────────────────────────────────────────────
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      allSchedules.forEach((s, idx) => {
        y += rowH;
        if (y > doc.internal.pageSize.getHeight() - 18) {
          doc.addPage();
          y = 15;
          // Repeat header on new page
          doc.setFillColor(13, 148, 136);
          doc.rect(14, y - 5, pageW - 28, rowH, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          cols.forEach(col => doc.text(col.label, col.x + 1, y));
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          y += rowH;
        }

        if (idx % 2 === 0) {
          doc.setFillColor(240, 253, 250);
          doc.rect(14, y - 5, pageW - 28, rowH, 'F');
        }
        doc.setTextColor(30, 30, 30);

        const truncate = (str: string | null, maxW: number) => {
          if (!str) return '-';
          // Rough truncation by character width (~1.6px/char at 7pt)
          const maxChars = Math.floor(maxW / 1.55);
          return str.length > maxChars ? str.substring(0, maxChars - 1) + '…' : str;
        };

        const rows: [string, number, number][] = [
          [(idx + 1).toString(), cols[0].x + 1, y],
          [truncate(s.course_name, cols[1].w - 2), cols[1].x + 1, y],
          [truncate(s.subject_study, cols[2].w - 2), cols[2].x + 1, y],
          [truncate(s.lecturer, cols[3].w - 2), cols[3].x + 1, y],
          [truncate(s.room, cols[4].w - 2), cols[4].x + 1, y],
          [s.day || '-', cols[5].x + 1, y],
          [`${s.start_time?.substring(0, 5) || ''}-${s.end_time?.substring(0, 5) || ''}`, cols[6].x + 1, y],
          [s.class || '-', cols[7].x + 1, y],
          [(s.semester?.toString()) || '-', cols[8].x + 1, y],
          [s.type === 'theory' ? 'Teori' : 'Praktik', cols[9].x + 1, y],
          [(s.amount !== null && s.amount !== undefined ? s.amount.toString() : '-'), cols[10].x + 1, y],
        ];
        rows.forEach(([text, x, yy]) => doc.text(text, x, yy));

        // Separator line
        doc.setDrawColor(220, 220, 220);
        doc.line(14, y + 2, pageW - 14, y + 2);
      });

      // ── Footer ──────────────────────────────────────────────────────
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Halaman ${i} dari ${pageCount}  •  Total ${allSchedules.length} jadwal  •  SIMPELUNY`,
          pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' }
        );
      }

      const roomLabel = roomFilter !== 'all' ? `_${roomFilter.replace(/\s+/g, '_')}` : '';
      const dayLabel = dayFilter !== 'all' ? `_${dayFilter}` : '';
      doc.save(`JadwalKuliah${roomLabel}${dayLabel}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(`PDF berhasil dibuat! (${allSchedules.length} jadwal)`, { id: toastId });
    } catch (error: any) {
      toast.error('Gagal membuat PDF: ' + (error.message || 'Unknown error'), { id: toastId });
    }
  };

  // Server-side pagination calculation
  const totalPages = Math.ceil(totalSchedules / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;

  const requestSort = (key: keyof LectureSchedule) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    // setCurrentPage(1); // No need to reset page on sort for current page sorting
  };

  const filteredRescheduleRequests = useMemo(() => {
    return rescheduleRequests.filter(request => {
      if (rescheduleFilter === 'all') return true;
      if (rescheduleFilter === 'pending') return request.is_done === null;
      if (rescheduleFilter === 'completed') return request.is_done === true;
      return true;
    });
  }, [rescheduleRequests, rescheduleFilter]);
  // Filtering is now server-side, so current data is just 'schedules'
  // However, we still have client-side sorting if applied to the current page.
  // Ideally, sorting should be server-side too, but for now we can sort the current page.
  const currentTableData = useMemo(() => {
    let data = [...schedules];
    if (sortConfig !== null) {
      data.sort((a, b) => {
        const valA = a[sortConfig.key] || '';
        const valB = b[sortConfig.key] || '';
        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return data;
  }, [schedules, sortConfig]);

  const dayIntensityStats = useMemo(() => {
    if (profile?.role !== 'super_admin') return [];

    // Calculate total schedules across all days
    const totalSchedules = dayNames.reduce((sum, day) => {
      return sum + (statsMap[day.toLowerCase()] || 0);
    }, 0);

    const stats = dayNames.map(day => {
      // Use the statsMap fetched separately
      const count = statsMap[day.toLowerCase()] || 0;

      // Calculate percentage
      const percentage = totalSchedules > 0 ? (count / totalSchedules) * 100 : 0;

      // Determine intensity based on percentage
      let intensity, color;
      if (percentage === 0) {
        intensity = 'Kosong';
        color = '#9CA3AF';
      } else if (percentage < 10) {
        intensity = 'Sangat Sepi';
        color = '#10B981';
      } else if (percentage < 15) {
        intensity = 'Sepi';
        color = '#22C55E';
      } else if (percentage < 20) {
        intensity = 'Normal';
        color = '#3B82F6';
      } else if (percentage < 25) {
        intensity = 'Ramai';
        color = '#F59E0B';
      } else {
        intensity = 'Sangat Padat';
        color = '#EF4444';
      }

      return {
        day,
        count,
        percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
        intensity,
        color,
        fullDay: day
      };
    });
    return stats;
  }, [statsMap, profile?.role]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{`${data.fullDay}`}</p>
          <p className="text-lg font-bold" style={{ color: data.color }}>{`${data.percentage}%`}</p>
          <p className="text-sm text-gray-600">{`${data.count} jadwal`}</p>
          <p className="text-xs mt-1" style={{ color: data.color }}>{`${data.intensity}`}</p>
        </div>
      );
    }
    return null;
  };

  const isScheduleActive = (schedule: LectureSchedule) => {
    const currentDayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
    const dayMapping: { [key: string]: string } = {
      'Monday': 'Senin', 'Tuesday': 'Selasa', 'Wednesday': 'Rabu',
      'Thursday': 'Kamis', 'Friday': 'Jumat', 'Saturday': 'Sabtu'
    };

    const currentIndonesianDay = dayMapping[currentDayName];

    if (schedule.day?.toLowerCase() !== currentIndonesianDay?.toLowerCase() || !schedule.start_time || !schedule.end_time) {
      return false;
    }

    try {
      const now = currentTime;
      const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
      const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
      const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
      return now >= startTime && now <= endTime;
    } catch (e) {
      return false;
    }
  };

  if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {getText('Access Denied', 'Akses Ditolak')}
          </h3>
          <p className="text-gray-600">
            {getText(
              "You don't have permission to access lecture schedules.",
              "Anda tidak memiliki izin untuk mengakses jadwal kuliah."
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 mb-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                <Clock className="h-6 md:h-8 w-6 md:w-8" />
              </div>
              <span>{getText('Lecture Schedules', 'Jadwal Kuliah')}</span>
            </h1>
            <p className="text-sm md:text-lg opacity-90">
              {getText('Manage academic schedules and timetables', 'Kelola jadwal akademik dan timetable')}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 opacity-80">
                <BookOpen className="h-4 w-4" />
                <span>{getText('Total', 'Total')}: {schedules.length}</span>
              </div>
              <div className="flex items-center gap-2 opacity-80">
                <User className="h-4 w-4" />
                <span>{getText('Active', 'Aktif')}: {schedules.filter(s => isScheduleActive(s)).length}</span>
              </div>
              {profile?.role === 'super_admin' && (
                <div className="flex items-center gap-2 opacity-80">
                  <Calendar className="h-4 w-4" />
                  <span>{getText('Reschedule Requests', 'Permintaan Reschedule')}: {rescheduleRequests.filter(r => r.is_done === null).length}</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl md:text-4xl font-bold opacity-90">{schedules.length}</div>
            <div className="text-xs md:text-sm opacity-70">
              {getText('Total Schedules', 'Total Jadwal')}
            </div>
          </div>
        </div>
      </div>

      {/* Day Intensity Chart - Super Admin Only */}
      {profile?.role === 'super_admin' && dayIntensityStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {getText('Daily Schedule Intensity', 'Intensitas Jadwal Harian')}
                </h3>
                <p className="text-sm text-gray-600">
                  {getText('Weekly schedule distribution analysis', 'Analisis distribusi jadwal mingguan')}
                </p>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dayIntensityStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  stroke="#64748b"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#64748b"
                  tickFormatter={(value) => `${value}%`}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  stroke="#0d9488"
                  strokeWidth={3}
                  dot={{ fill: '#0d9488', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, fill: '#0f766e' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-gray-400"></div>
              <span className="text-gray-600">Kosong (0%)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-gray-600">Sangat Sepi (&lt;10%)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-emerald-500"></div>
              <span className="text-gray-600">Sepi (10-15%)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-gray-600">Normal (15-20%)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span className="text-gray-600">Ramai (20-25%)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-gray-600">Sangat Padat (&gt;25%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={getText('Search schedules...', 'Cari jadwal...')}
                aria-label={getText('Search schedules', 'Cari jadwal')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Searchable Room Filter Dropdown dari tabel rooms */}
              <div className="relative" ref={(el) => {
                if (el) el.dataset.roomDropdown = 'true';
              }}>
                <RoomFilterDropdown
                  rooms={rooms}
                  value={roomFilter}
                  onChange={(val) => { setRoomFilter(val); setCurrentPage(1); }}
                />
              </div>
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                aria-label={getText('Filter by day', 'Filter berdasarkan hari')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="all">{getText('All Days', 'Semua Hari')}</option>
                {dayNames.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchSchedules()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title={getText('Refresh', 'Muat Ulang')}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Cetak PDF Jadwal */}
            <button
              onClick={handlePrintSchedulePDF}
              disabled={loading || totalSchedules === 0}
              className="flex items-center gap-2 px-3 py-2 text-indigo-700 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cetak jadwal kuliah saat ini ke PDF"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Cetak PDF</span>
            </button>

            {/* Department Admin Actions */}
            {profile?.role === 'department_admin' && (
              <button
                onClick={() => setShowRescheduleModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors text-sm"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">{getText('Request Reschedule', 'Minta Reschedule')}</span>
              </button>
            )}

            {/* Super Admin Actions */}
            {profile?.role === 'super_admin' && (
              <>
                <button
                  onClick={() => setShowRescheduleRequestsModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors text-sm relative"
                >
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">{getText('View Requests', 'Lihat Permintaan')}</span>
                  {rescheduleRequests.filter(r => r.is_done === null).length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {rescheduleRequests.filter(r => r.is_done === null).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">{getText('Import Excel', 'Impor Excel')}</span>
                </button>
                <button
                  onClick={openMatchingModal}
                  className="flex items-center gap-2 px-3 py-2 text-cyan-700 border border-cyan-300 rounded-lg hover:bg-cyan-50 transition-colors text-sm"
                >
                  <Link className="h-4 w-4" />
                  <span className="hidden sm:inline">{getText('Data Matching', 'Pencocokan Data')}</span>
                </button>
                <button
                  onClick={() => setShowDeleteAllConfirm(true)}
                  disabled={schedules.length === 0}
                  className="flex items-center gap-2 px-3 py-2 text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{getText('Delete All', 'Hapus Semua')}</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                setEditingSchedule(null);
                form.reset({
                  semester: 1,
                  academics_year: new Date().getFullYear(),
                  type: 'theory',
                  amount: 0
                });
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>{getText('Add Schedule', 'Tambah Jadwal')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('course_name')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('Subject', 'Mata Kuliah')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('subject_study')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('Study Program', 'Program Studi')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('room')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('Room', 'Ruangan')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('day')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('Schedule', 'Jadwal')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Details', 'Detail')}
                </th>
                <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Actions', 'Aksi')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-teal-600 mr-2" />
                      <span className="text-gray-600">{getText('Loading schedules...', 'Memuat jadwal...')}</span>
                    </div>
                  </td>
                </tr>
              ) : currentTableData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">{getText('No schedules found', 'Tidak ada jadwal ditemukan')}</p>
                      <p className="text-sm">{getText('Try adjusting your search or create a new schedule', 'Coba sesuaikan pencarian atau buat jadwal baru')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentTableData.map((schedule) => {
                  const isActive = isScheduleActive(schedule);
                  return (
                    <tr key={schedule.id} className={`hover:bg-gray-50 transition-colors ${isActive ? 'bg-green-50 border-l-4 border-green-500' : ''}`}>
                      <td className="px-3 md:px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isActive && <Activity className="h-4 w-4 text-green-500 animate-pulse" />}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{schedule.course_name}</div>
                            <div className="text-xs text-gray-500">{schedule.course_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{schedule.subject_study}</div>
                      </td>
                      <td className="px-3 md:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div className="text-sm font-medium text-gray-900">{schedule.room}</div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{schedule.day}</div>
                          <div className="text-xs text-gray-500">
                            {schedule.start_time?.substring(0, 5)} - {schedule.end_time?.substring(0, 5)}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4">
                        <div>
                          <div className="text-sm text-gray-900">
                            <span className="font-medium">{getText('Class', 'Kelas')}: </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {schedule.class}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {getText('Semester', 'Semester')} {schedule.semester} • {getText(schedule.type === 'theory' ? 'Theory' : 'Practical', schedule.type === 'theory' ? 'Teori' : 'Praktik')}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(schedule)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title={getText('Edit', 'Edit')}
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => {
                              setScheduleToDuplicate(schedule);
                              setShowDuplicateModal(true);
                            }}
                            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                            title={getText('Duplicate', 'Duplikat')}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(schedule.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title={getText('Delete', 'Hapus')}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-3 bg-gray-50 border-t border-gray-200 gap-3">
            <span className="text-sm text-gray-600">
              {getText(
                `Showing ${totalSchedules > 0 ? startIndex + 1 : 0} to ${Math.min(startIndex + rowsPerPage, totalSchedules)} of ${totalSchedules} entries`,
                `Menampilkan ${totalSchedules > 0 ? startIndex + 1 : 0} sampai ${Math.min(startIndex + rowsPerPage, totalSchedules)} dari ${totalSchedules} entri`
              )}
            </span>
            <nav className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium px-3 py-1">
                {getText(`Page ${currentPage} of ${totalPages}`, `Halaman ${currentPage} dari ${totalPages}`)}
              </span>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Add/Edit Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Clock className="h-6 w-6" />
                  {editingSchedule ? getText('Edit Schedule', 'Edit Jadwal') : getText('Add New Schedule', 'Tambah Jadwal Baru')}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingSchedule(null);
                    setAddScheduleTab('manual');
                    form.reset();
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Only show tabs when adding new schedule (not editing) */}
              {!editingSchedule && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddScheduleTab('manual')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${addScheduleTab === 'manual'
                      ? 'bg-white text-teal-600 shadow-md'
                      : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                      }`}
                  >
                    {getText('Manual Entry', 'Input Manual')}
                  </button>
                  <button
                    onClick={() => setAddScheduleTab('import')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${addScheduleTab === 'import'
                      ? 'bg-white text-teal-600 shadow-md'
                      : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                      }`}
                  >
                    {getText('Import Excel', 'Import Excel')}
                  </button>
                </div>
              )}
            </div>


            {/* Manual Entry Tab - Always show when editing, conditional when adding */}
            {(editingSchedule || addScheduleTab === 'manual') && (
              <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* All form fields stay the same - keep existing form content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Course Name', 'Nama Mata Kuliah')} *</label>
                    <input
                      {...form.register('course_name')}
                      type="text"
                      autoComplete="off"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                      placeholder={getText('Enter course name', 'Masukkan nama mata kuliah')}
                    />
                    {form.formState.errors.course_name && (
                      <p className="text-red-500 text-sm">{form.formState.errors.course_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Course Code', 'Kode Mata Kuliah')} *</label>
                    <input
                      {...form.register('course_code')}
                      type="text"
                      autoComplete="off"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                      placeholder="e.g. MKL6305"
                    />
                    {form.formState.errors.course_code && (
                      <p className="text-red-500 text-sm">{form.formState.errors.course_code.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Lecturer', 'Dosen')} *</label>
                    <input
                      type="text"
                      {...form.register('lecturer')}
                      placeholder={getText('Enter lecturer name', 'Masukkan nama dosen')}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:ring-0 transition-colors"
                    />
                    {form.formState.errors.lecturer && (
                      <p className="text-red-500 text-sm">{form.formState.errors.lecturer.message}</p>
                    )}
                  </div>

                  {/* Room Dropdown with Search */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Room', 'Ruangan')} *</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowRoomDropdown(!showRoomDropdown)}
                        className="w-full border-2 border-gray-200 rounded-lg p-3 text-left focus:border-teal-500 focus:ring-0 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className={selectedRoom ? 'text-gray-900' : 'text-gray-500'}>
                            {selectedRoom
                              ? `${selectedRoom.name} (${selectedRoom.code}) - ${selectedRoom.capacity} ${getText('seats', 'kursi')}`
                              : getText('Select room', 'Pilih ruangan')
                            }
                          </span>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showRoomDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showRoomDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                          <div className="p-3 border-b border-gray-200">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder={getText('Search rooms...', 'Cari ruangan...')}
                                aria-label={getText('Search rooms', 'Cari ruangan')}
                                autoComplete="off"
                                value={roomSearchTerm}
                                onChange={(e) => setRoomSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                              />
                            </div>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {filteredRooms.length === 0 ? (
                              <div className="p-3 text-sm text-gray-500 text-center">
                                {getText('No rooms found', 'Tidak ada ruangan ditemukan')}
                              </div>
                            ) : (
                              filteredRooms.map((room) => (
                                <button
                                  key={room.id}
                                  type="button"
                                  onClick={() => {
                                    form.setValue('room', room.id); // Simpan ID untuk sementara, nanti di-convert ke nama
                                    setShowRoomDropdown(false);
                                    setRoomSearchTerm('');
                                  }}
                                  className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{room.name}</div>
                                      <div className="text-xs text-gray-500">{room.code}</div>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {room.capacity} {getText('seats', 'kursi')}
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {form.formState.errors.room && (
                      <p className="text-red-500 text-sm">{form.formState.errors.room.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Study Program', 'Program Studi')} *</label>
                  <input
                    {...form.register('subject_study')}
                    type="text"
                    autoComplete="off"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder={getText('Enter study program', 'Masukkan program studi')}
                  />
                  {form.formState.errors.subject_study && (
                    <p className="text-red-500 text-sm">{form.formState.errors.subject_study.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Day', 'Hari')} *</label>
                    <select
                      {...form.register('day')}
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    >
                      <option value="">{getText('Select Day', 'Pilih Hari')}</option>
                      {dayNames.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    {form.formState.errors.day && (
                      <p className="text-red-500 text-sm">{form.formState.errors.day.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Start Time', 'Waktu Mulai')} *</label>
                    <input
                      {...form.register('start_time')}
                      type="time"
                      autoComplete="off"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    />
                    {form.formState.errors.start_time && (
                      <p className="text-red-500 text-sm">{form.formState.errors.start_time.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('End Time', 'Waktu Selesai')} *</label>
                    <input
                      {...form.register('end_time')}
                      type="time"
                      autoComplete="off"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    />
                    {form.formState.errors.end_time && (
                      <p className="text-red-500 text-sm">{form.formState.errors.end_time.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Semester', 'Semester')} *</label>
                    <select
                      {...form.register('semester', { valueAsNumber: true })}
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                        <option key={sem} value={sem}>Semester {sem}</option>
                      ))}
                    </select>
                    {form.formState.errors.semester && (
                      <p className="text-red-500 text-sm">{form.formState.errors.semester.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Academic Year', 'Tahun Akademik')} *</label>
                    <input
                      {...form.register('academics_year', { valueAsNumber: true })}
                      type="number"
                      placeholder="2024"
                      autoComplete="off"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    />
                    {form.formState.errors.academics_year && (
                      <p className="text-red-500 text-sm">{form.formState.errors.academics_year.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Class Type', 'Tipe Kelas')} *</label>
                    <select
                      {...form.register('type')}
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    >
                      <option value="theory">{getText('Theory', 'Teori')}</option>
                      <option value="practical">{getText('Practical', 'Praktik')}</option>
                    </select>
                    {form.formState.errors.type && (
                      <p className="text-red-500 text-sm">{form.formState.errors.type.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Class/Rombel', 'Kelas/Rombel')} *</label>
                    <input
                      {...form.register('class')}
                      type="text"
                      autoComplete="off"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                      placeholder="e.g. A, B, C"
                    />
                    {form.formState.errors.class && (
                      <p className="text-red-500 text-sm">{form.formState.errors.class.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Amount', 'Jumlah')}</label>
                    <input
                      {...form.register('amount', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      autoComplete="off"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                      placeholder="0"
                    />
                    {form.formState.errors.amount && (
                      <p className="text-red-500 text-sm">{form.formState.errors.amount.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Curriculum', 'Kurikulum')}</label>
                    <input
                      {...form.register('kurikulum')}
                      type="text"
                      autoComplete="off"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                      placeholder={getText('Optional', 'Opsional')}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingSchedule(null);
                      form.reset();
                    }}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                  >
                    {getText('Cancel', 'Batal')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {getText('Saving...', 'Menyimpan...')}
                      </div>
                    ) : (
                      editingSchedule ? getText('Update Schedule', 'Perbarui Jadwal') : getText('Create Schedule', 'Buat Jadwal')
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Import Excel Tab */}
            {!editingSchedule && addScheduleTab === 'import' && (
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="text-center space-y-4">
                  <FileText className="h-16 w-16 text-green-500 mx-auto" />
                  <h4 className="text-lg font-semibold text-gray-900">
                    {getText('Import Schedules from Excel', 'Import Jadwal dari Excel')}
                  </h4>
                  <p className="text-sm text-gray-600 max-w-md mx-auto">
                    {getText(
                      'Upload an Excel file to add multiple schedules at once. This will ADD to existing schedules, not replace them.',
                      'Unggah file Excel untuk menambahkan banyak jadwal sekaligus. Ini akan MENAMBAHKAN ke jadwal yang ada, tidak mengganti.'
                    )}
                  </p>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-green-800 mb-1">
                          {getText('Append Mode', 'Mode Tambah')}
                        </p>
                        <p className="text-xs text-green-700">
                          {getText(
                            'Existing schedules will not be deleted. New schedules from Excel will be added to the database.',
                            'Jadwal yang ada tidak akan dihapus. Jadwal baru dari Excel akan ditambahkan ke database.'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowAppendExcelModal(true);
                    }}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-all shadow-lg inline-flex items-center gap-2"
                  >
                    <Upload className="h-5 w-5" />
                    {getText('Choose Excel File to Add', 'Pilih File Excel untuk Ditambahkan')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )
      }

      {/* Reschedule Request Modal - Department Admin */}
      {
        showRescheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Calendar className="h-6 w-6" />
                    {getText('Request Schedule Reschedule', 'Permintaan Reschedule Jadwal')}
                  </h3>
                  <button
                    onClick={() => {
                      setShowRescheduleModal(false);
                      rescheduleForm.reset();
                    }}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={rescheduleForm.handleSubmit(handleRescheduleSubmit)} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Course Code', 'Kode Mata Kuliah')} *</label>
                    <input
                      {...rescheduleForm.register('course_code')}
                      type="text"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                      placeholder="e.g. TIF001"
                    />
                    {rescheduleForm.formState.errors.course_code && (
                      <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.course_code.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Day', 'Hari')} *</label>
                    <select
                      {...rescheduleForm.register('day')}
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                    >
                      <option value="">{getText('Select Day', 'Pilih Hari')}</option>
                      {dayNames.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    {rescheduleForm.formState.errors.day && (
                      <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.day.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Start Time', 'Waktu Mulai')} *</label>
                    <input
                      {...rescheduleForm.register('start_time')}
                      type="time"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                    />
                    {rescheduleForm.formState.errors.start_time && (
                      <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.start_time.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('End Time', 'Waktu Selesai')} *</label>
                    <input
                      {...rescheduleForm.register('end_time')}
                      type="time"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                    />
                    {rescheduleForm.formState.errors.end_time && (
                      <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.end_time.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Room', 'Ruangan')} *</label>
                    <input
                      {...rescheduleForm.register('room')}
                      type="text"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                      placeholder="e.g. Lab Komputer 1"
                    />
                    {rescheduleForm.formState.errors.room && (
                      <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.room.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">{getText('Class/Rombel', 'Kelas/Rombel')} *</label>
                    <input
                      {...rescheduleForm.register('class')}
                      type="text"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                      placeholder="e.g. A, B, C"
                    />
                    {rescheduleForm.formState.errors.class && (
                      <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.class.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRescheduleModal(false);
                      rescheduleForm.reset();
                    }}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                  >
                    {getText('Cancel', 'Batal')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {getText('Submitting...', 'Mengirim...')}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        {getText('Submit Request', 'Kirim Permintaan')}
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Reschedule Requests Modal - Super Admin */}
      {
        showRescheduleRequestsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Eye className="h-6 w-6" />
                    {getText('Reschedule Requests Management', 'Manajemen Permintaan Reschedule')}
                  </h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={generatePDF}
                      className="flex items-center gap-2 px-3 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors text-sm"
                    >
                      <Download className="h-4 w-4" />
                      {getText('Export PDF', 'Ekspor PDF')}
                    </button>
                    <button
                      onClick={() => {
                        setShowRescheduleRequestsModal(false);
                      }}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 max-h-[80vh] overflow-y-auto">
                {/* Filter */}
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <select
                      value={rescheduleFilter}
                      onChange={(e) => setRescheduleFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    >
                      <option value="all">{getText('All Requests', 'Semua Permintaan')}</option>
                      <option value="pending">{getText('Pending', 'Menunggu')}</option>
                      <option value="completed">{getText('Completed', 'Selesai')}</option>
                    </select>
                  </div>
                  <div className="text-sm text-gray-600">
                    {getText(
                      `Total: ${filteredRescheduleRequests.length} requests`,
                      `Total: ${filteredRescheduleRequests.length} permintaan`
                    )}
                  </div>
                </div>

                {/* Requests List */}
                <div className="space-y-4">
                  {filteredRescheduleRequests.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        {getText('No reschedule requests found', 'Tidak ada permintaan reschedule ditemukan')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {getText('All reschedule requests will appear here', 'Semua permintaan reschedule akan muncul di sini')}
                      </p>
                    </div>
                  ) : (
                    filteredRescheduleRequests.map((request, index) => (
                      <div key={`${request.course_code}-${request.day}-${request.start_time}-${request.end_time}`} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold text-gray-900">{request.course_code}</h4>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${request.is_done === null ? 'bg-yellow-100 text-yellow-800' :
                                request.is_done === true ? 'bg-green-100 text-green-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                {getText(
                                  request.is_done === null ? 'Pending' : request.is_done === true ? 'Completed' : 'Unchecked',
                                  request.is_done === null ? 'Menunggu' : request.is_done === true ? 'Selesai' : 'Belum Selesai'
                                )}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">{getText('Day', 'Hari')}:</span>
                                <div className="font-medium">{request.day}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">{getText('Time', 'Waktu')}:</span>
                                <div className="font-medium">{request.start_time} - {request.end_time}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">{getText('Room', 'Ruangan')}:</span>
                                <div className="font-medium">{request.room}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">{getText('Class', 'Kelas')}:</span>
                                <div className="font-medium">{request.class}</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 ml-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={request.is_done === true}
                                onChange={(e) => handleRescheduleAction(request, e.target.checked)}
                                className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                {getText('Mark as Done', 'Tandai Selesai')}
                              </span>
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-200">
                          <div className="text-sm text-gray-600">
                            {getText('Course Code', 'Kode Mata Kuliah')}: <span className="font-medium">{request.course_code}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Delete Confirmation Modal */}
      {
        showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center mb-6">
                <div className="flex-shrink-0 p-3 bg-red-100 rounded-full">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-gray-900">{getText('Delete Schedule', 'Hapus Jadwal')}</h3>
                  <p className="text-sm text-gray-600 mt-1">{getText('This action cannot be undone', 'Tindakan ini tidak dapat dibatalkan')}</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800">
                  {getText(
                    'Are you sure you want to delete this lecture schedule? This action will permanently remove the schedule from the system.',
                    'Apakah Anda yakin ingin menghapus jadwal kuliah ini? Tindakan ini akan menghapus jadwal secara permanen dari sistem.'
                  )}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                >
                  {getText('Cancel', 'Batal')}
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm as string)}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold transition-colors shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {getText('Deleting...', 'Menghapus...')}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      {getText('Delete Schedule', 'Hapus Jadwal')}
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Delete All Confirmation Modal */}
      {
        showDeleteAllConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {getText('Delete All Schedules?', 'Hapus Semua Jadwal?')}
                </h3>
                <p className="text-gray-500 mb-2">
                  {getText(
                    `You are about to delete ALL ${schedules.length} lecture schedules.`,
                    `Anda akan menghapus SEMUA ${schedules.length} jadwal kuliah.`
                  )}
                </p>
                <p className="text-red-600 font-semibold mb-6">
                  {getText(
                    'This action cannot be undone!',
                    'Aksi ini tidak dapat dibatalkan!'
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                >
                  {getText('Cancel', 'Batal')}
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold transition-colors shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {getText('Deleting...', 'Menghapus...')}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      {getText('Delete All', 'Hapus Semua')}
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Data Matching Modal - Redesigned with Tabs and Batch Selection */}
      {
        showMatchingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Link className="h-6 w-6" />
                    {getText('Data Matching', 'Pencocokan Data')}
                  </h3>
                  <button
                    onClick={() => setShowMatchingModal(false)}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <p className="mt-2 text-sm opacity-90">
                  {getText(
                    'Match schedule room and lecturer names with master data. You can select multiple items and set them all at once.',
                    'Cocokkan nama ruangan dan dosen jadwal dengan data master. Anda bisa memilih beberapa item dan set sekaligus.'
                  )}
                </p>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setMatchingTab('rooms')}
                    className={`flex-1 py-4 px-6 text-center font-medium transition-colors relative ${matchingTab === 'rooms'
                      ? 'text-cyan-600 bg-cyan-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <MapPin className="h-5 w-5" />
                      <span>{getText('Room Matching', 'Pencocokan Ruangan')}</span>
                      {unmatchedRooms.length > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {unmatchedRooms.length}
                        </span>
                      )}
                    </div>
                    {matchingTab === 'rooms' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-600" />
                    )}
                  </button>
                  <button
                    onClick={() => setMatchingTab('lecturers')}
                    className={`flex-1 py-4 px-6 text-center font-medium transition-colors relative ${matchingTab === 'lecturers'
                      ? 'text-purple-600 bg-purple-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <User className="h-5 w-5" />
                      <span>{getText('Lecturer Matching', 'Pencocokan Dosen')}</span>
                      {unmatchedLecturers.length > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {unmatchedLecturers.length}
                        </span>
                      )}
                    </div>
                    {matchingTab === 'lecturers' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                {matchingLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-teal-600 mr-3" />
                    <span className="text-gray-600">{getText('Processing...', 'Memproses...')}</span>
                  </div>
                ) : (
                  <>
                    {/* Room Tab Content */}
                    {matchingTab === 'rooms' && (
                      <div className="space-y-4">
                        {unmatchedRooms.length === 0 ? (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex flex-col items-center justify-center gap-3">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <span className="text-green-700 font-medium text-lg">{getText('All rooms are matched!', 'Semua ruangan sudah cocok!')}</span>
                          </div>
                        ) : (
                          <>
                            {/* Action Bar - Set All Button */}
                            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="text-sm text-cyan-800">
                                  <strong>{getText('Instructions:', 'Petunjuk:')}</strong>{' '}
                                  {getText(
                                    'Select target room for each item below, then click "Set All" to apply all at once.',
                                    'Pilih ruangan target untuk setiap item di bawah, lalu klik "Set Semua" untuk menerapkan sekaligus.'
                                  )}
                                </div>
                                <button
                                  onClick={handleBatchUpdateAllRooms}
                                  disabled={roomMappingsCount === 0 || matchingLoading}
                                  className="px-5 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2 shadow-md whitespace-nowrap"
                                >
                                  <Check className="h-4 w-4" />
                                  {getText(`Set All (${roomMappingsCount})`, `Set Semua (${roomMappingsCount})`)}
                                </button>
                              </div>
                            </div>

                            {/* Room List - Dropdowns only */}
                            <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3">
                              {unmatchedRooms.map((room, index) => (
                                <div
                                  key={`room-${index}`}
                                  className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${roomMappings[room]
                                    ? 'bg-cyan-50 border border-cyan-300'
                                    : 'bg-gray-50 border border-gray-200'
                                    }`}
                                >
                                  {/* Source room name */}
                                  <div className="w-1/3 min-w-[150px]">
                                    <span className="text-sm font-medium text-red-600">{room}</span>
                                  </div>

                                  <span className="text-gray-400">→</span>

                                  {/* Target dropdown */}
                                  <div className="flex-1">
                                    <SearchableDropdown
                                      options={rooms.map(r => ({ id: r.id, name: r.name, code: r.code }))}
                                      value={roomMappings[room] || ''}
                                      onChange={(val) => setRoomMappings(prev => ({ ...prev, [room]: val }))}
                                      placeholder={getText('Select target room...', 'Pilih ruangan target...')}
                                      searchPlaceholder={getText('Search room...', 'Cari ruangan...')}
                                      emptyMessage={getText('No room found', 'Ruangan tidak ditemukan')}
                                    />
                                  </div>

                                  {/* Mapped indicator */}
                                  {roomMappings[room] && (
                                    <CheckCircle className="h-5 w-5 text-cyan-600 flex-shrink-0" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Lecturer Tab Content */}
                    {matchingTab === 'lecturers' && (
                      <div className="space-y-4">
                        {unmatchedLecturers.length === 0 ? (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex flex-col items-center justify-center gap-3">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                            <span className="text-green-700 font-medium text-lg">{getText('All lecturer names are synced!', 'Semua nama dosen sudah tersinkron!')}</span>
                          </div>
                        ) : (
                          <>
                            {/* Info Box — logika baru: jadwal mengikuti users */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                              <strong>{getText('Note:', 'Catatan:')}</strong> {getText(
                                'Clicking "Set" will update the lecturer name in the SCHEDULE to match the official user name. The users table will NOT be modified.',
                                'Klik "Set" akan mengubah nama dosen di JADWAL agar sesuai dengan nama resmi di data user. Tabel user tidak akan diubah.'
                              )}
                                <div className="mt-1 text-xs text-blue-600">
                                  {getText(
                                    'If a lecturer name is not in the user list, you can add them directly by clicking the + icon next to their name.',
                                    'Jika nama dosen belum ada di daftar user, Anda bisa menambahkannya langsung dengan mengklik tombol + di sebelah namanya.'
                                  )}
                                </div>
                            </div>

                            {/* Action Bar - Set All Button and Confirm Edits */}
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="text-sm text-purple-800">
                                  <strong>{getText('Instructions:', 'Petunjuk:')}</strong>{' '}
                                  {getText(
                                    'Select target user for each item below, then click "Set All" to apply all at once.',
                                    'Pilih user target untuk setiap item di bawah, lalu klik "Set Semua" untuk menerapkan sekaligus.'
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* Confirm Edits Button */}
                                  {(editedScheduleIds.size > 0 || duplicatedScheduleIds.size > 0 || newScheduleIds.size > 0) && (
                                    <button
                                      onClick={handleConfirmAllEdits}
                                      disabled={matchingLoading}
                                      className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2 shadow-md whitespace-nowrap"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                      {getText(
                                        `Confirm All (${editedScheduleIds.size} edit, ${duplicatedScheduleIds.size + newScheduleIds.size} dup)`,
                                        `Konfirmasi (${editedScheduleIds.size} edit, ${duplicatedScheduleIds.size + newScheduleIds.size} dup)`
                                      )}
                                    </button>
                                  )}
                                  {/* Set All Button */}
                                  <button
                                    onClick={handleBatchUpdateAllLecturers}
                                    disabled={lecturerMappingsCount === 0 || matchingLoading}
                                    className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2 shadow-md whitespace-nowrap"
                                  >
                                    <Check className="h-4 w-4" />
                                    {getText(`Set All (${lecturerMappingsCount})`, `Set Semua (${lecturerMappingsCount})`)}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Lecturer List - Dropdowns with schedule preview */}
                            <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3">
                              {unmatchedLecturers.map((lecturer, index) => (
                                <div key={`lecturer-${index}`} className="space-y-2">
                                  <div
                                    className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${lecturerMappings[lecturer]
                                      ? 'bg-purple-50 border border-purple-300'
                                      : 'bg-gray-50 border border-gray-200'
                                      }`}
                                  >
                                    {/* Source lecturer name - CLICKABLE untuk toggle jadwal */}
                                    <div className="w-1/3 min-w-[180px] flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          if (selectedLecturerForSchedule === lecturer) {
                                            setSelectedLecturerForSchedule('');
                                            setLecturerSchedules([]);
                                          } else {
                                            setSelectedLecturerForSchedule(lecturer);
                                            fetchLecturerSchedules(lecturer);
                                          }
                                        }}
                                        className="flex-1 text-left p-2 rounded hover:bg-purple-100 transition-colors"
                                      >
                                        <span className="text-sm font-medium text-red-600 flex items-center gap-1">
                                          {selectedLecturerForSchedule === lecturer ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                          {lecturer}
                                        </span>
                                        <span className="text-xs text-gray-500 block ml-5">{getText('(Name in schedule — will be updated)', '(Nama di jadwal — akan diperbarui)')}</span>
                                      </button>

                                      {/* Tombol + untuk tambah user baru */}
                                      <button
                                        onClick={() => {
                                          setNewUserScheduleName(lecturer);
                                          setShowAddUserInMatching(true);
                                        }}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                                        title={getText('Add as new user', 'Tambahkan sebagai user baru')}
                                      >
                                        <UserPlus className="h-4 w-4" />
                                      </button>
                                    </div>

                                    <span className="text-gray-400" title={getText('Schedule name will be updated to match user name', 'Nama di jadwal akan diubah menjadi nama resmi user')}>→</span>

                                    {/* Target dropdown — pilih user resmi; nama user inilah yang akan menggantikan nama di jadwal */}
                                    <div className="flex-1">
                                      <SearchableDropdownById
                                        options={lecturers.map(l => ({ id: l.id, name: l.full_name, code: l.identity_number }))}
                                        value={lecturerMappings[lecturer] || ''}
                                        onChange={(id) => {
                                          setLecturerMappings(prev => ({ ...prev, [lecturer]: id }));
                                        }}
                                        placeholder={getText('Select official user (schedule will use this name)...', 'Pilih user resmi (jadwal akan pakai nama ini)...')}
                                        searchPlaceholder={getText('Search by name or ID...', 'Cari nama atau NIP...')}
                                        emptyMessage={getText('No user found. Add user first via User Management.', 'User tidak ditemukan. Tambahkan dulu via Manajemen User.')}
                                      />
                                    </div>

                                    {/* Mapped indicator only */}
                                    {lecturerMappings[lecturer] && (
                                      <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                                    )}
                                  </div>

                                  {/* Lecturer Schedules Panel */}
                                  {selectedLecturerForSchedule === lecturer && (
                                    <div className="ml-8 bg-white border border-purple-200 rounded-lg p-4">
                                      <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        {getText(`Schedules for ${lecturer}`, `Jadwal untuk ${lecturer}`)}
                                      </h4>
                                      {loadingLecturerSchedules ? (
                                        <div className="flex items-center justify-center py-4">
                                          <RefreshCw className="h-5 w-5 animate-spin text-purple-600" />
                                        </div>
                                      ) : lecturerSchedules.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">
                                          {getText('No schedules found', 'Tidak ada jadwal ditemukan')}
                                        </p>
                                      ) : (
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                          {lecturerSchedules.map((sched, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg text-sm border border-purple-100">
                                              <div className="flex-1">
                                                <div className="font-medium text-gray-900">{sched.course_name}</div>
                                                <div className="text-xs text-gray-600 mt-0.5">
                                                  <span className="font-medium">{sched.day}</span> • {sched.start_time?.substring(0, 5)} - {sched.end_time?.substring(0, 5)} • <span className="text-purple-700">{sched.room}</span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2 ml-2">
                                                <span className="text-xs px-2 py-1 bg-purple-200 text-purple-800 rounded font-medium">
                                                  {sched.class}
                                                </span>
                                                {/* Tombol Split — muncul jika nama dosen mengandung 2 dosen */}
                                                {sched.lecturer && detectDualLecturer(sched.lecturer).length >= 2 && (
                                                  <button
                                                    onClick={() => {
                                                      setScheduleToSplitInMatching(sched);
                                                      setShowSplitConfirm(true);
                                                    }}
                                                    className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                                    title={getText('Split: This schedule has 2 lecturers — click to split into 2 rows', 'Split: Jadwal ini punya 2 dosen — klik untuk pisah menjadi 2 baris')}
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                      <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" /><path d="M12 22v-8.3a4 4 0 0 1 1.172-2.872L21 3" />
                                                    </svg>
                                                  </button>
                                                )}
                                                {/* Tombol Edit */}
                                                <button
                                                  onClick={() => {
                                                    handleEdit(sched);
                                                  }}
                                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                  title={getText('Edit this schedule', 'Edit jadwal ini')}
                                                >
                                                  <Edit className="h-3.5 w-3.5" />
                                                </button>
                                                {/* Edited indicator */}
                                                {editedScheduleIds.has(sched.id) && (
                                                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3" />
                                                    {getText('Edited', 'Diedit')}
                                                  </span>
                                                )}
                                                {/* Tombol Duplicate */}
                                                <button
                                                  onClick={() => {
                                                    setScheduleToDuplicate(sched);
                                                    setShowDuplicateModal(true);
                                                  }}
                                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                  title={getText('Duplicate this schedule', 'Duplikat jadwal ini')}
                                                >
                                                  <Copy className="h-3.5 w-3.5" />
                                                </button>
                                                {/* Source indicator (original that was duplicated) */}
                                                {duplicatedScheduleIds.has(sched.id) && (
                                                  <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-medium flex items-center gap-1">
                                                    <Copy className="h-3 w-3" />
                                                    {getText('Source', 'Sumber')}
                                                  </span>
                                                )}
                                                {/* New schedule indicator (duplicate result) */}
                                                {newScheduleIds.has(sched.id) && (
                                                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium flex items-center gap-1">
                                                    <span className="text-xs">✨</span>
                                                    {getText('New', 'Baru')}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {getText(
                    `Total unmatched: ${unmatchedRooms.length} rooms, ${unmatchedLecturers.length} lecturers`,
                    `Total tidak cocok: ${unmatchedRooms.length} ruangan, ${unmatchedLecturers.length} dosen`
                  )}
                </span>
                <button
                  onClick={analyzeUnmatchedData}
                  disabled={matchingLoading}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${matchingLoading ? 'animate-spin' : ''}`} />
                  {getText('Refresh Data', 'Muat Ulang Data')}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Split Confirm Modal — untuk memisahkan jadwal 2 dosen menjadi 2 baris */}
      {showSplitConfirm && scheduleToSplitInMatching && (() => {
        const parts = detectDualLecturer(scheduleToSplitInMatching.lecturer || '');
        const lecturer1 = parts[0] || '';
        const lecturer2 = parts[1] || '';
        return (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white rounded-t-xl">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" /><path d="M12 22v-8.3a4 4 0 0 1 1.172-2.872L21 3" />
                  </svg>
                  {getText('Split Schedule for 2 Lecturers', 'Pisah Jadwal untuk 2 Dosen')}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-800">
                  <p className="font-medium mb-2">{getText('Current lecturer name in schedule:', 'Nama dosen saat ini di jadwal:')}</p>
                  <p className="font-bold text-orange-900 bg-white px-3 py-2 rounded border border-orange-200">{scheduleToSplitInMatching.lecturer}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                  <p className="font-medium mb-3">{getText('This schedule will be split into 2 rows:', 'Jadwal ini akan dipisah menjadi 2 baris:')}</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                      <span className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded text-blue-800 font-medium flex-1">{lecturer1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                      <span className="bg-green-50 border border-green-200 px-3 py-1.5 rounded text-green-800 font-medium flex-1">{lecturer2}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    {getText(
                      'Both rows will have the same course, room, day, and time. lecturer_user_id will be cleared and needs to be re-matched.',
                      'Kedua baris akan punya mata kuliah, ruangan, hari, dan waktu yang sama. lecturer_user_id akan dikosongkan dan perlu di-match ulang.'
                    )}
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setShowSplitConfirm(false); setScheduleToSplitInMatching(null); }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {getText('Cancel', 'Batal')}
                  </button>
                  <button
                    onClick={() => handleSplitScheduleInMatching(scheduleToSplitInMatching, lecturer1, lecturer2)}
                    disabled={matchingLoading}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {matchingLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {getText('Yes, Split into 2 Rows', 'Ya, Pisah Menjadi 2 Baris')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ExcelUploadModal - Super Admin Only */}
      {
        profile?.role === 'super_admin' && (
          <ExcelUploadModal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            onSuccess={() => {
              fetchSchedules();
            }}
          />
        )
      }

      {/* Add New User Modal in Matching */}
      {
        showAddUserInMatching && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <UserPlus className="h-6 w-6" />
                    {getText('Add New User', 'Tambah Pengguna Baru')}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddUserInMatching(false);
                      setNewUserScheduleName('');
                    }}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <p className="mt-2 text-sm opacity-90">
                  {getText('Create new user', 'Buat akun pengguna baru')}
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleAddNewUserInMatching({
                    full_name: formData.get('full_name') as string,
                    identity_number: formData.get('identity_number') as string,
                    email: formData.get('email') as string,
                    phone_number: formData.get('phone_number') as string,
                    department_id: formData.get('department_id') as string || '',
                    study_program_id: formData.get('study_program_id') as string || '',
                    is_homebase: formData.get('is_homebase') === 'true',
                  });
                }}
                className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
              >
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {getText('Full Name', 'Nama Lengkap')} *
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    defaultValue={newUserScheduleName}
                    required
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
                    placeholder={getText('Enter full name', 'Masukkan nama lengkap')}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('ID Number', 'NIM/NIP')} *
                    </label>
                    <input
                      type="text"
                      name="identity_number"
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
                      placeholder="NIM/NIP"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Email', 'Email')} *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
                      placeholder="user@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {getText('Phone', 'Telepon')}
                  </label>
                  <input
                    type="tel"
                    name="phone_number"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      name="is_homebase"
                      value="true"
                      // Default unchecked as requested
                      className="mt-1 h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="block text-sm font-semibold text-gray-900">
                        {getText('Homebase Lecturer?', 'Dosen Homebase?')}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {getText(
                          'Uncheck if this is an external lecturer without department/study program.',
                          'Hapus centang jika ini adalah dosen eksternal tanpa departemen/prodi.'
                        )}
                      </span>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Department', 'Departemen')}
                    </label>
                    <select
                      name="department_id"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
                    >
                      <option value="">{getText('Select Department', 'Pilih Departemen')}</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Study Program', 'Program Studi')}
                    </label>
                    <select
                      name="study_program_id"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
                    >
                      <option value="">{getText('Select Study Program', 'Pilih Program Studi')}</option>
                      {studyPrograms.map(sp => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name} ({sp.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUserInMatching(false);
                      setNewUserScheduleName('');
                    }}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                  >
                    {getText('Cancel', 'Batal')}
                  </button>
                  <button
                    type="submit"
                    disabled={matchingLoading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
                  >
                    {matchingLoading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {getText('Creating...', 'Membuat...')}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        {getText('Create User', 'Buat Pengguna')}
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Duplicate Schedule Modal */}
      {
        showDuplicateModal && scheduleToDuplicate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Copy className="h-6 w-6" />
                    {getText('Duplicate Schedule', 'Duplikat Jadwal')}
                  </h3>
                  <button
                    onClick={() => {
                      setShowDuplicateModal(false);
                      setScheduleToDuplicate(null);
                    }}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <p className="mt-2 text-sm opacity-90">
                  {getText(
                    'Modify the schedule details below before creating the duplicate',
                    'Ubah detail jadwal di bawah sebelum membuat duplikat'
                  )}
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleDuplicateSchedule({
                    course_name: formData.get('course_name') as string,
                    course_code: formData.get('course_code') as string,
                    lecturer: formData.get('lecturer') as string,
                    room: formData.get('room') as string,
                    subject_study: formData.get('subject_study') as string,
                    day: formData.get('day') as string,
                    start_time: formData.get('start_time') as string,
                    end_time: formData.get('end_time') as string,
                    semester: parseInt(formData.get('semester') as string),
                    academics_year: parseInt(formData.get('academics_year') as string),
                    type: formData.get('type') as 'theory' | 'practical',
                    class: formData.get('class') as string,
                    amount: parseInt(formData.get('amount') as string || '0'),
                    kurikulum: formData.get('kurikulum') as string,
                  });
                }}
                className="p-6 space-y-6 max-h-[70vh] overflow-y-auto"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Course Name', 'Nama Mata Kuliah')} *
                    </label>
                    <input
                      type="text"
                      name="course_name"
                      defaultValue={scheduleToDuplicate.course_name || ''}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Course Code', 'Kode Mata Kuliah')} *
                    </label>
                    <input
                      type="text"
                      name="course_code"
                      defaultValue={scheduleToDuplicate.course_code || ''}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Lecturer', 'Dosen')} *
                    </label>
                    <input
                      type="text"
                      name="lecturer"
                      defaultValue={scheduleToDuplicate.lecturer || ''}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Room', 'Ruangan')} *
                    </label>
                    <select
                      name="room"
                      defaultValue={rooms.find(r => r.name === scheduleToDuplicate.room)?.id || ''}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    >
                      <option value="">{getText('Select room', 'Pilih ruangan')}</option>
                      {rooms.map(room => (
                        <option key={room.id} value={room.id}>
                          {room.name} ({room.code}) - {room.capacity} {getText('seats', 'kursi')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {getText('Study Program', 'Program Studi')} *
                  </label>
                  <input
                    type="text"
                    name="subject_study"
                    defaultValue={scheduleToDuplicate.subject_study || ''}
                    required
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Day', 'Hari')} *
                    </label>
                    <select
                      name="day"
                      defaultValue={scheduleToDuplicate.day || ''}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    >
                      <option value="">{getText('Select Day', 'Pilih Hari')}</option>
                      {dayNames.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Start Time', 'Waktu Mulai')} *
                    </label>
                    <input
                      type="time"
                      name="start_time"
                      defaultValue={scheduleToDuplicate.start_time || ''}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('End Time', 'Waktu Selesai')} *
                    </label>
                    <input
                      type="time"
                      name="end_time"
                      defaultValue={scheduleToDuplicate.end_time || ''}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Semester', 'Semester')} *
                    </label>
                    <select
                      name="semester"
                      defaultValue={scheduleToDuplicate.semester?.toString() || '1'}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                        <option key={sem} value={sem}>Semester {sem}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Academic Year', 'Tahun Akademik')} *
                    </label>
                    <input
                      type="number"
                      name="academics_year"
                      defaultValue={scheduleToDuplicate.academics_year || new Date().getFullYear()}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Class Type', 'Tipe Kelas')} *
                    </label>
                    <select
                      name="type"
                      defaultValue={scheduleToDuplicate.type || 'theory'}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    >
                      <option value="theory">{getText('Theory', 'Teori')}</option>
                      <option value="practical">{getText('Practical', 'Praktik')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Class/Rombel', 'Kelas/Rombel')} *
                    </label>
                    <input
                      type="text"
                      name="class"
                      defaultValue={scheduleToDuplicate.class || ''}
                      required
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Amount', 'Jumlah')}
                    </label>
                    <input
                      type="number"
                      name="amount"
                      min="0"
                      defaultValue={scheduleToDuplicate.amount || 0}
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getText('Curriculum', 'Kurikulum')}
                    </label>
                    <input
                      type="text"
                      name="kurikulum"
                      defaultValue={scheduleToDuplicate.kurikulum || ''}
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDuplicateModal(false);
                      setScheduleToDuplicate(null);
                    }}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                  >
                    {getText('Cancel', 'Batal')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {getText('Duplicating...', 'Menduplikat...')}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Copy className="h-4 w-4" />
                        {getText('Create Duplicate', 'Buat Duplikat')}
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* Append Excel Upload Modal */}
      <AppendScheduleExcelModal
        isOpen={showAppendExcelModal}
        onClose={() => {
          setShowAppendExcelModal(false);
          setShowModal(false);
          setAddScheduleTab('manual');
        }}
        onSuccess={() => {
          fetchSchedules();
          alert.success(getText('Schedules added successfully!', 'Jadwal berhasil ditambahkan!'));
          setShowAppendExcelModal(false);
          setShowModal(false);
          setAddScheduleTab('manual');
        }}
      />
    </div>
  );
};

export default LectureSchedules;