import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import html2canvas from 'html2canvas';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  Shield,
  Building,
  BookOpen,
  User,
  X,
  RefreshCw,
  ChevronDown,
  Home,
  Clock,
  GraduationCap,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Activity,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Hash,
  Calendar,
  Settings,
  Filter,
  Download,
  Upload,
  UserPlus,
  UserCheck,
  UserX,
  Loader2,
  Info,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  ZoomIn,
  ZoomOut,
  Camera,
  ImageIcon,
  Trash,
  DollarSign,
  DoorOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';

// Zod schema - password optional/empty for edit mode
const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  full_name: z.string().min(2, 'Full name is required'),
  identity_number: z.string().min(1, 'Identity number is required'),
  phone_number: z.string().optional().or(z.literal('')),
  jabatan: z.string().optional().or(z.literal('')), // Position/Title field
  role: z.enum(['super_admin', 'department_admin', 'lecturer', 'student', 'laboratory', 'staffing', 'purchasing', 'technician', 'frontdesk', 'staff', 'finance']),
  department_id: z.string().optional().nullable(),
  study_program_id: z.string().optional().nullable(),
  // Password: optional, but if provided must be at least 6 characters
  password: z.string().optional().or(z.literal('')).refine(
    (val) => !val || val.length === 0 || val.length >= 6,
    { message: 'Password must be at least 6 characters' }
  ),
  is_homebase: z.boolean().default(true), // Default true
});

type UserForm = z.infer<typeof userSchema>;

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  identity_number: string;
  phone_number?: string;
  jabatan?: string; // Position/Title
  role: string;
  department_id?: string;
  study_program_id?: string;
  is_homebase?: boolean;
  attachments?: string | null;
  created_at: string;
  updated_at?: string;
  department?: { id: string; name: string; code?: string; };
  study_program?: { id: string; name: string; code: string; };
}

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface StudyProgram {
  id: string;
  name: string;
  code: string;
  department_id: string;
}

interface Room {
  id: string;
  name: string;
  code: string;
  capacity: number;
  assigned_at?: string;
  floor?: string;
  building?: {
    name: string;
    campus?: {
      name: string;
    };
  };
}

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  room_name?: string;
}

// Enhanced SearchableDropdown Component
interface SearchableDropdownProps {
  options: { id: string; name: string; code?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = React.memo(({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  searchPlaceholder = "Search...",
  emptyMessage = "No options found"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => {
    return options.find(option => option.id === value);
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
    onChange(optionId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between transition-all duration-200 ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'hover:border-gray-400 hover:shadow-sm'
          }`}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption
            ? `${selectedOption.name}${selectedOption.code ? ` (${selectedOption.code})` : ''}`
            : placeholder
          }
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
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {value && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100 transition-colors duration-200"
              >
                Clear selection
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                {searchTerm ? `No results for "${searchTerm}"` : emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-blue-50 hover:text-blue-900 transition-colors duration-200 ${option.id === value ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                    }`}
                >
                  {option.name}
                  {option.code && <span className="text-gray-500"> ({option.code})</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

SearchableDropdown.displayName = 'SearchableDropdown';

// Enhanced Password Input
const PasswordInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}> = ({ value, onChange, placeholder, error, required }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400'
          }`}
        required={required}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 transition-colors duration-200"
      >
        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

const UserManagement: React.FC = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();

  // State hooks
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0); // Added for server-side pagination
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [homebaseFilter, setHomebaseFilter] = useState<string>('all'); // 'all', 'homebase', 'non-homebase'
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showUserDetail, setShowUserDetail] = useState<User | null>(null);
  const [viewImageObj, setViewImageObj] = useState<{ src: string; alt: string } | null>(null);
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Image Viewer State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setViewImageObj(null);
  };

  // Photo upload handler
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(getText('Please select an image file', 'Silakan pilih file gambar'));
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(getText('Image size must be less than 5MB', 'Ukuran gambar harus kurang dari 5MB'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setPhotoPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };
  const [userActivities, setUserActivities] = useState<ActivityItem[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Room assignment states for Edit User modal
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [selectedRoomToAssign, setSelectedRoomToAssign] = useState<string>('');
  const [assigningRoom, setAssigningRoom] = useState(false);
  const [editingUserRooms, setEditingUserRooms] = useState<Room[]>([]);
  const [roomSearchTerm, setRoomSearchTerm] = useState('');

  // Download lecturer list state
  const [isDownloadingLecturers, setIsDownloadingLecturers] = useState(false);

  // Student Cleanup States
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupMonths, setCleanupMonths] = useState<2 | 3 | 6>(6);
  const [cleanupNimPrefix, setCleanupNimPrefix] = useState('');
  const [cleanupPreviewCount, setCleanupPreviewCount] = useState<number | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isExportingUsers, setIsExportingUsers] = useState(false);

  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  // Calculate startIndex for pagination display
  const startIndex = (currentPage - 1) * itemsPerPage;
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // Debounced search state

  // Form hook
  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'student',
      username: '',
      email: '',
      full_name: '',
      identity_number: '',
      phone_number: '',
      jabatan: '', // Position/Title
      department_id: '',
      study_program_id: '',
      password: '',
    },
  });

  const watchRole = form.watch('role');
  const watchDepartmentId = form.watch('department_id');

  // Helper functions
  const getRoleIcon = useCallback((role: string) => {
    switch (role) {
      case 'super_admin': return Shield;
      case 'department_admin': return Building;
      case 'lecturer': return GraduationCap;
      case 'student': return BookOpen;
      case 'laboratory': return Package;
      case 'staffing': return Users;
      case 'purchasing': return Home;
      case 'technician': return Settings;
      case 'frontdesk': return Calendar;
      case 'staff': return User;
      case 'finance': return DollarSign;
      default: return User;
    }
  }, []);

  const getRoleDisplayName = useCallback((role: string) => {
    switch (role) {
      case 'super_admin': return getText('Super Admin', 'Super Admin');
      case 'department_admin': return getText('Department Admin', 'Admin Departemen');
      case 'lecturer': return getText('Lecturer', 'Dosen');
      case 'student': return getText('Student', 'Mahasiswa');
      case 'laboratory': return getText('Laboratory', 'Laboratorium');
      case 'staffing': return getText('Staffing', 'Kepegawaian');
      case 'purchasing': return getText('Purchasing', 'Pengadaan');
      case 'technician': return getText('Technician', 'Teknisi');
      case 'frontdesk': return getText('Front Desk', 'Front Desk');
      case 'staff': return getText('Staff', 'Tenaga Kependidikan');
      case 'finance': return getText('Finance', 'Keuangan');
      default: return role;
    }
  }, [getText]);

  const getRoleBadgeColor = useCallback((role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'department_admin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'lecturer': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'student': return 'bg-green-100 text-green-800 border-green-200';
      case 'laboratory': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'staffing': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'purchasing': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'technician': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'frontdesk': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'staff': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'finance': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  // API functions (keeping the same logic but with better error handling)
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on new search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      // Start building the query
      let query = supabase.from('users').select(`
        id, username, email, full_name, identity_number, phone_number,
        role, jabatan, department_id, study_program_id, is_homebase,
        created_at, attachments,
        department:departments(id, name, code),
        study_program:study_programs(id, name, code)
      `, { count: 'exact' });

      // Apply Search Filter (Server-side)
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        // search fields: username, full_name, email, identity_number, phone_number, jabatan
        query = query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%,identity_number.ilike.%${term}%,phone_number.ilike.%${term}%,jabatan.ilike.%${term}%`);
      }

      // Apply Role Filter
      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      } else if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
        // If not admin/super_admin and no specific role filter, restricts what regular users see might be needed
        // but based on current logic, only specific roles access this page anyway.
      }


      // Apply Department Filter
      if (departmentFilter !== 'all') {
        query = query.eq('department_id', departmentFilter);
      } else if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('department_id', profile.department_id);
      }

      // Apply Homebase Filter
      if (homebaseFilter === 'homebase') {
        query = query.eq('is_homebase', true);
      } else if (homebaseFilter === 'non-homebase') {
        query = query.eq('is_homebase', false);
      }

      // Apply Pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      query = query.order('created_at', { ascending: false });

      const { data, count, error } = await query;
      if (error) throw error;

      setUsers(data || []);
      setTotalUsers(count || 0);

    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(getText('Failed to load users', 'Gagal memuat pengguna'));
    } finally {
      setLoading(false);
    }
  }, [profile, getText, debouncedSearchTerm, roleFilter, departmentFilter, homebaseFilter, currentPage]);

  const fetchDepartments = useCallback(async () => {
    try {
      let query = supabase.from('departments').select('id, name, code');

      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('id', profile.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      toast.error(getText('Failed to load departments', 'Gagal memuat departemen'));
    }
  }, [profile, getText]);

  const fetchStudyPrograms = useCallback(async () => {
    try {
      let query = supabase.from('study_programs').select('id, name, code, department_id, status');

      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('department_id', profile.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStudyPrograms(data || []);
    } catch (error: any) {
      console.error('Error fetching study programs:', error);
      toast.error(getText('Failed to load study programs', 'Gagal memuat program studi'));
    }
  }, [profile, getText]);

  const fetchStudyProgramsByDepartment = useCallback(async (departmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('study_programs')
        .select('id, name, code, department_id, status')
        .eq('department_id', departmentId);

      if (error) throw error;
      setStudyPrograms(data || []);

      const currentStudyProgramId = form.getValues('study_program_id');
      const isCurrentProgramInDepartment = data?.some(program => program.id === currentStudyProgramId);
      if (!isCurrentProgramInDepartment) {
        form.setValue('study_program_id', '');
      }
    } catch (error: any) {
      console.error('Error fetching study programs by department:', error);
      toast.error(getText('Failed to load study programs', 'Gagal memuat program studi'));
    }
  }, [form, getText]);

  // Fetch ALL study programs (both show and hide) for non-homebase users
  const fetchAllStudyPrograms = useCallback(async (departmentId?: string) => {
    try {
      let query = supabase.from('study_programs').select('id, name, code, department_id, status'); // All programs (show and hide)

      if (departmentId) {
        query = query.eq('department_id', departmentId);
      } else if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('department_id', profile.department_id);
      }

      // NO status filter - fetch ALL programs including hidden ones
      const { data, error } = await query;
      if (error) throw error;
      setStudyPrograms(data || []);

      const currentStudyProgramId = form.getValues('study_program_id');
      const isCurrentProgramInDepartment = data?.some(program => program.id === currentStudyProgramId);
      if (!isCurrentProgramInDepartment) {
        form.setValue('study_program_id', '');
      }
    } catch (error: any) {
      console.error('Error fetching all study programs:', error);
      toast.error(getText('Failed to load study programs', 'Gagal memuat program studi'));
    }
  }, [profile, form, getText]);

  const fetchUserDetails = useCallback(async (userId: string) => {
    setLoadingUserDetails(true);
    try {
      // Fetch assigned rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('room_users')
        .select(`
          assigned_at,
          room:rooms(
            id, 
            name, 
            code, 
            capacity, 
            floor,
            building:building_id(
              name,
              campus:campus_id(name)
            )
          )
        `)
        .eq('user_id', userId)
        .order('assigned_at', { ascending: false });

      if (!roomsError && roomsData) {
        const rooms = roomsData.map(item => ({
          ...(item.room as any),
          assigned_at: item.assigned_at
        }));
        setUserRooms(rooms as Room[]);
      }

      // Fetch recent activities
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          purpose,
          created_at,
          room:rooms(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!bookingsError && bookingsData) {
        const activities = bookingsData.map(booking => ({
          id: booking.id,
          description: `${getText('Booked', 'Memesan')} ${(booking.room as any)?.name} - ${booking.purpose}`,
          timestamp: booking.created_at,
          room_name: (booking.room as any)?.name
        }));
        setUserActivities(activities);
      }

    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoadingUserDetails(false);
    }
  }, [getText]);

  // Fetch all rooms for assignment dropdown
  const fetchAllRooms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          id,
          name,
          code,
          capacity,
          floor,
          building:building_id(
            name,
            campus:campus_id(name)
          )
        `)
        .order('name')
        .range(0, 10000); // Get all rooms

      if (error) throw error;
      setAllRooms((data as unknown as Room[]) || []);
    } catch (error) {
      console.error('Error fetching all rooms:', error);
    }
  }, []);

  // Fetch rooms assigned to the user being edited
  const fetchEditingUserRooms = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('room_users')
        .select(`
          assigned_at,
          room:rooms(
            id, 
            name, 
            code, 
            capacity, 
            floor,
            building:building_id(
              name,
              campus:campus_id(name)
            )
          )
        `)
        .eq('user_id', userId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      const rooms = data?.map(item => ({
        ...(item.room as any),
        assigned_at: item.assigned_at
      })) || [];
      setEditingUserRooms(rooms as Room[]);
    } catch (error) {
      console.error('Error fetching user rooms:', error);
    }
  }, []);

  // Assign room to user from Edit User modal
  const handleAssignRoomToUser = async () => {
    if (!selectedRoomToAssign || !editingUser) return;

    try {
      setAssigningRoom(true);

      // Check if already assigned
      const { data: existing } = await supabase
        .from('room_users')
        .select('id')
        .eq('user_id', editingUser.id)
        .eq('room_id', selectedRoomToAssign)
        .maybeSingle();

      if (existing) {
        toast.error(getText('User is already assigned to this room', 'Pengguna sudah ditugaskan ke ruangan ini'));
        return;
      }

      // Assign user to room
      const { error } = await supabase
        .from('room_users')
        .insert({
          user_id: editingUser.id,
          room_id: selectedRoomToAssign,
          assigned_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success(getText('User assigned to room successfully', 'Pengguna berhasil ditugaskan ke ruangan'));
      setSelectedRoomToAssign('');
      setRoomSearchTerm('');
      fetchEditingUserRooms(editingUser.id);
    } catch (error: any) {
      console.error('Error assigning room:', error);
      toast.error(error.message || getText('Failed to assign room', 'Gagal menugaskan ruangan'));
    } finally {
      setAssigningRoom(false);
    }
  };

  // Unassign room from user in Edit User modal
  const handleUnassignRoomFromUser = async (roomId: string, roomName: string) => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('room_users')
        .delete()
        .eq('user_id', editingUser.id)
        .eq('room_id', roomId);

      if (error) throw error;

      toast.success(getText(`Removed from ${roomName}`, `Dihapus dari ${roomName}`));
      fetchEditingUserRooms(editingUser.id);
    } catch (error: any) {
      console.error('Error unassigning room:', error);
      toast.error(getText('Failed to remove from room', 'Gagal menghapus dari ruangan'));
    }
  };

  // Download individual lecturer nametag
  const downloadLecturerNametag = async () => {
    if (!editingUser) return;

    const element = document.getElementById('lecturer-nametag-element');
    if (!element) return;

    setIsDownloadingLecturers(true);
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(element, {
          backgroundColor: null,
          scale: 2
        });

        const link = document.createElement('a');
        link.download = `Nametag-${editingUser.full_name.replace(/\s+/g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        toast.success(getText('Nametag downloaded successfully', 'Nametag berhasil diunduh'));
      } catch (error) {
        console.error('Error downloading nametag:', error);
        toast.error(getText('Failed to download nametag', 'Gagal mengunduh nametag'));
      } finally {
        setIsDownloadingLecturers(false);
      }
    }, 500);
  };

  // ==========================================
  // STUDENT CLEANUP FEATURE
  // ==========================================

  // Check how many students would be deleted
  const checkCleanupCount = useCallback(async (months: number) => {
    setIsCleaning(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .lt('created_at', cutoffDate.toISOString()); // Older than cutoff

      if (error) throw error;
      setCleanupPreviewCount(count || 0);
    } catch (error) {
      console.error('Error checking cleanup count:', error);
      toast.error(getText('Failed to check student count', 'Gagal memeriksa jumlah mahasiswa'));
    } finally {
      setIsCleaning(false);
    }
  }, [getText]);

  // Update preview when months change
  useEffect(() => {
    if (showCleanupModal) {
      checkCleanupCount(cleanupMonths);
    }
  }, [showCleanupModal, cleanupMonths, checkCleanupCount]);

  // Execute Cleanup with Manual Cascade
  const handleExecuteCleanup = async () => {
    if (cleanupPreviewCount === 0) return;

    try {
      setIsCleaning(true);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - cleanupMonths);
      const cutoffISO = cutoffDate.toISOString();

      let totalDeleted = 0;
      let hasMore = true;
      const BATCH_SIZE = 50;

      toast.loading(getText('Starting cleanup process...', 'Memulai proses pembersihan...'), { id: 'cleanup-toast' });

      while (hasMore) {
        // 1. Get Batch of User IDs
        const { data: usersToDelete, error: fetchError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'student')
          .lt('created_at', cutoffISO)
          .limit(BATCH_SIZE);

        if (fetchError) throw fetchError;

        if (!usersToDelete || usersToDelete.length === 0) {
          hasMore = false;
          break;
        }

        const userIds = usersToDelete.map(u => u.id);
        console.log(`Processing batch cleanup for ${userIds.length} users...`);

        // 2. DELETE RELATED DATA (MANUAL CASCADE)

        // A. Checkouts & Items
        const { data: checkouts } = await supabase.from('checkouts').select('id').in('user_id', userIds);
        if (checkouts && checkouts.length > 0) {
          const checkoutIds = checkouts.map(c => c.id);
          await supabase.from('checkout_items').delete().in('checkout_id', checkoutIds);
          await supabase.from('checkouts').delete().in('user_id', userIds);
        }

        // B. Independent Child Tables (Parallel)
        await Promise.all([
          supabase.from('bookings').delete().in('user_id', userIds),
          supabase.from('lending_tool').delete().in('id_user', userIds),
          supabase.from('room_users').delete().in('user_id', userIds),
          supabase.from('reports').delete().in('reporter_id', userIds),
          supabase.from('final_sessions').delete().in('student_id', userIds),
          supabase.from('exam_schedules').delete().in('examiner_id', userIds),
        ]);

        // 3. DELETE USERS
        const { error: deleteError, count } = await supabase
          .from('users')
          .delete({ count: 'exact' })
          .in('id', userIds);

        if (deleteError) throw deleteError;

        totalDeleted += count || 0;
      }

      toast.dismiss('cleanup-toast');
      toast.success(getText(
        `Successfully deleted ${totalDeleted} student data older than ${cleanupMonths} months`,
        `Berhasil menghapus ${totalDeleted} data mahasiswa yang lebih lama dari ${cleanupMonths} bulan`
      ));

      setShowCleanupModal(false);
      fetchUsers();
      setCleanupPreviewCount(0);

    } catch (error: any) {
      console.error('Error executing cleanup:', error);
      toast.dismiss('cleanup-toast');
      toast.error(error.message || getText('Failed to delete students', 'Gagal menghapus data mahasiswa'));
    } finally {
      setIsCleaning(false);
    }
  };

  // Export filtered users to Excel using ExcelJS
  const handleExportUsers = async () => {
    try {
      setIsExportingUsers(true);
      const toastId = toast.loading(getText('Exporting users...', 'Mengekspor pengguna...'));

      // Build query without pagination to get ALL filtered users
      let query = supabase.from('users').select(`
        *,
        department:departments(id, name, code),
        study_program:study_programs(id, name, code)
      `);

      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        query = query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%,identity_number.ilike.%${term}%,phone_number.ilike.%${term}%,jabatan.ilike.%${term}%`);
      }
      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      } else if (profile?.role === 'department_admin' && profile.department_id) {
        // already filtered by department below
      }
      if (departmentFilter !== 'all') {
        query = query.eq('department_id', departmentFilter);
      } else if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('department_id', profile.department_id);
      }
      if (homebaseFilter === 'homebase') {
        query = query.eq('is_homebase', true);
      } else if (homebaseFilter === 'non-homebase') {
        query = query.eq('is_homebase', false);
      }
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const exportData = data || [];

      // Create ExcelJS workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'SIMPELUNY';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Data Pengguna', {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
      });

      // ---- Header info rows ----
      const filterInfo: string[] = [];
      if (roleFilter !== 'all') filterInfo.push(`Role: ${getRoleDisplayName(roleFilter)}`);
      if (departmentFilter !== 'all') {
        const dept = departments.find(d => d.id === departmentFilter);
        if (dept) filterInfo.push(`Departemen: ${dept.name}`);
      }
      if (homebaseFilter === 'homebase') filterInfo.push('Status: Homebase');
      if (homebaseFilter === 'non-homebase') filterInfo.push('Status: Non-Homebase');
      if (debouncedSearchTerm) filterInfo.push(`Pencarian: "${debouncedSearchTerm}"`);

      sheet.addRow(['LAPORAN DATA PENGGUNA - SIMPELUNY']);
      sheet.addRow([`Tanggal Export: ${format(new Date(), 'dd MMMM yyyy HH:mm')}`]);
      sheet.addRow([filterInfo.length > 0 ? `Filter: ${filterInfo.join(' | ')}` : 'Filter: Semua Pengguna']);
      sheet.addRow([`Total: ${exportData.length} pengguna`]);
      sheet.addRow([]);

      // Style title rows
      const titleRow = sheet.getRow(1);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B5998' } };
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
      titleRow.height = 24;

      [2, 3, 4].forEach(rowNum => {
        const r = sheet.getRow(rowNum);
        r.font = { italic: true, size: 10, color: { argb: 'FF444444' } };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
      });

      // ---- Column headers ----
      const headers = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'Nama Lengkap', key: 'full_name', width: 28 },
        { header: 'Username', key: 'username', width: 18 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'No. Identitas', key: 'identity_number', width: 18 },
        { header: 'No. HP', key: 'phone_number', width: 16 },
        { header: 'Jabatan', key: 'jabatan', width: 20 },
        { header: 'Peran', key: 'role', width: 18 },
        { header: 'Departemen', key: 'department', width: 24 },
        { header: 'Program Studi', key: 'study_program', width: 28 },
        { header: 'Homebase', key: 'is_homebase', width: 12 },
        { header: 'Terdaftar', key: 'created_at', width: 18 },
      ];

      sheet.columns = headers;

      const headerRow = sheet.getRow(6);
      headerRow.values = headers.map(h => h.header);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 22;
      headers.forEach((h, i) => {
        sheet.getColumn(i + 1).width = h.width;
      });

      // Merge title across all columns
      sheet.mergeCells(1, 1, 1, headers.length);
      sheet.mergeCells(2, 1, 2, headers.length);
      sheet.mergeCells(3, 1, 3, headers.length);
      sheet.mergeCells(4, 1, 4, headers.length);

      // ---- Data rows ----
      exportData.forEach((user, idx) => {
        const rowData = [
          idx + 1,
          user.full_name || '',
          user.username || '',
          user.email || '',
          user.identity_number || '',
          user.phone_number || '',
          user.jabatan || '',
          getRoleDisplayName(user.role),
          (user.department as any)?.name || '',
          (user.study_program as any)?.name || '',
          user.is_homebase ? 'Homebase' : 'Non-Homebase',
          user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy') : '',
        ];

        const dataRow = sheet.getRow(6 + idx + 1);
        dataRow.values = rowData;
        dataRow.alignment = { vertical: 'middle', wrapText: false };
        dataRow.height = 18;

        // Alternating row color
        const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF5F7FF';
        dataRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
        });

        // Center 'No' and 'Homebase' columns
        dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Border on header row
      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF3730A3' } },
          left: { style: 'thin', color: { argb: 'FF3730A3' } },
          bottom: { style: 'medium', color: { argb: 'FF3730A3' } },
          right: { style: 'thin', color: { argb: 'FF3730A3' } },
        };
      });

      // ---- Write file ----
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const rolePart = roleFilter !== 'all' ? `_${roleFilter}` : '';
      link.download = `SIMPELUNY_Users${rolePart}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success(getText(`Exported ${exportData.length} users successfully`, `Berhasil mengekspor ${exportData.length} pengguna`));
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(getText('Failed to export users', 'Gagal mengekspor pengguna'));
    } finally {
      setIsExportingUsers(false);
    }
  };

  // useEffect hooks
  useEffect(() => {
    if (profile) {
      fetchUsers();
    }
  }, [fetchUsers]); // fetchUsers now depends on filters/search/page, so it re-runs automatically

  useEffect(() => {
    if (profile) {
      fetchDepartments();
      fetchStudyPrograms();
    }
  }, [profile, fetchDepartments, fetchStudyPrograms]);

  useEffect(() => {
    if (watchDepartmentId) {
      fetchStudyProgramsByDepartment(watchDepartmentId);
    } else if (profile?.role === 'super_admin') {
      setStudyPrograms([]);
      form.setValue('study_program_id', '');
    }
  }, [watchDepartmentId, profile, fetchStudyProgramsByDepartment, form]);

  useEffect(() => {
    if (showUserDetail) {
      fetchUserDetails(showUserDetail.id);
    }
  }, [showUserDetail, fetchUserDetails]);

  // Fetch all rooms when modal opens and user's assigned rooms when editing
  useEffect(() => {
    if (showModal && editingUser) {
      fetchAllRooms();
      fetchEditingUserRooms(editingUser.id);
    }
  }, [showModal, editingUser, fetchAllRooms, fetchEditingUserRooms]);

  // Calculate total pages based on server count
  const totalPages = Math.ceil(totalUsers / itemsPerPage);

  // NOTE: filtering is now done server-side, so displayed users are just 'users'
  const currentTableData = users;

  // Access control check
  const hasAccess = profile && ['super_admin', 'department_admin', 'staffing', 'finance'].includes(profile.role);

  const handleSubmit = async (data: UserForm) => {
    try {
      setSubmitting(true);
      setProcessingIds(prev => new Set(prev).add('form'));

      if (profile?.role === 'department_admin' && profile.department_id) {
        data.department_id = profile.department_id;
        if (!['lecturer', 'student'].includes(data.role)) {
          data.role = 'student';
        }
      }

      const userData: any = {
        username: data.username.trim(),
        email: data.email?.trim() || null,
        full_name: data.full_name.trim(),
        identity_number: data.identity_number.trim(),
        phone_number: data.phone_number?.trim() || null,
        jabatan: data.jabatan?.trim() || null, // Position/Title
        role: data.role,
        department_id: data.department_id || null,
        study_program_id: data.study_program_id || null,
        is_homebase: data.is_homebase,
      };

      // Add photo if provided
      if (photoPreview) {
        userData.attachments = photoPreview;
      }

      if (editingUser) {
        const updateData: any = { ...userData };
        if (data.password?.trim()) {
          updateData.password = data.password.trim();
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;
        toast.success(getText('User updated successfully', 'Pengguna berhasil diperbarui'));
      } else {
        if (!data.password?.trim()) {
          toast.error(getText('Password is required for new users', 'Password diperlukan untuk pengguna baru'));
          return;
        }

        const { error } = await supabase
          .from('users')
          .insert({ ...userData, password: data.password.trim() });

        if (error) throw error;
        toast.success(getText('User created successfully', 'Pengguna berhasil dibuat'));
      }

      setShowModal(false);
      setEditingUser(null);
      form.reset({ role: 'student' });
      setPhotoPreview(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      if (error.code === '23505') {
        if (error.message.includes('username')) {
          toast.error(getText('Username already exists', 'Username sudah ada'));
        } else if (error.message.includes('email')) {
          toast.error(getText('Email already exists', 'Email sudah ada'));
        } else if (error.message.includes('identity_number')) {
          toast.error(getText('Identity number already exists', 'Nomor identitas sudah ada'));
        } else {
          toast.error(getText('User with this information already exists', 'Pengguna dengan informasi ini sudah ada'));
        }
      } else {
        toast.error(error.message || getText('Failed to save user', 'Gagal menyimpan pengguna'));
      }
    } finally {
      setSubmitting(false);
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete('form');
        return newSet;
      });
    }
  };

  const handleEdit = useCallback((user: User) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      email: user.email || '',
      full_name: user.full_name,
      identity_number: user.identity_number,
      phone_number: user.phone_number || '',
      jabatan: user.jabatan || '', // Position/Title
      role: user.role as any,
      department_id: user.department_id || '',
      study_program_id: user.study_program_id || '',
      password: '',
      is_homebase: user.is_homebase ?? true,
    });

    // Set photo preview if user has attachments (photo)
    if (user.attachments) {
      setPhotoPreview(user.attachments);
    } else {
      setPhotoPreview(null);
    }

    if (user.department_id) {
      // Use fetchAllStudyPrograms for non-homebase users to show ALL programs (including hidden)
      if (!user.is_homebase) {
        fetchAllStudyPrograms(user.department_id);
      } else {
        fetchStudyProgramsByDepartment(user.department_id);
      }
    } else if (profile?.role === 'super_admin') {
      setStudyPrograms([]);
    }

    setShowModal(true);
  }, [form, fetchStudyProgramsByDepartment, fetchAllStudyPrograms, profile]);

  const handleDelete = async (userId: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(userId));

      // Try cascade delete via RPC first
      console.log('🗑️ Attempting cascade delete for user:', userId);

      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('delete_user_with_cascade', { target_user_id: userId });

      if (rpcError) {
        console.warn('⚠️ RPC cascade delete failed, trying fallback:', rpcError.message);

        // Fallback: manually delete related records then user
        // 1. Delete checkout_items (via checkouts)
        const { data: checkouts } = await supabase
          .from('checkouts')
          .select('id')
          .eq('user_id', userId);

        if (checkouts && checkouts.length > 0) {
          const checkoutIds = checkouts.map(c => c.id);
          await supabase.from('checkout_items').delete().in('checkout_id', checkoutIds);
          await supabase.from('checkouts').delete().eq('user_id', userId);
        }

        // 2. Delete bookings
        await supabase.from('bookings').delete().eq('user_id', userId);

        // 3. Delete lending_tool
        await supabase.from('lending_tool').delete().eq('id_user', userId);

        // 4. Delete room_users
        await supabase.from('room_users').delete().eq('user_id', userId);

        // 5. Delete reports (reporter_id)
        await supabase.from('reports').delete().eq('reporter_id', userId);

        // 6. Delete exam_schedules (if user is examiner)
        await supabase.from('exam_schedules').delete().eq('examiner_id', userId);

        // 7. Delete session_schedules (if user is lecturer) 
        await supabase.from('session_schedules').delete().eq('lecturer_id', userId);

        // 8. Finally delete user
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (deleteError) throw deleteError;

        console.log('✅ Fallback delete completed');
      } else {
        console.log('✅ RPC cascade delete completed:', rpcResult);
      }

      toast.success(getText('User and all related data deleted successfully', 'Pengguna dan semua data terkait berhasil dihapus'));
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || getText('Failed to delete user', 'Gagal menghapus pengguna'));
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {getText('Access Denied', 'Akses Ditolak')}
          </h3>
          <p className="text-gray-600 text-center max-w-md">
            {getText("You don't have permission to access user management.", 'Anda tidak memiliki izin untuk mengakses manajemen pengguna.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modern Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Users className="h-8 w-8" />
              <span>{getText('User Management', 'Manajemen Pengguna')}</span>
            </h1>
            <p className="mt-2 opacity-90">
              {profile?.role === 'super_admin'
                ? getText('Manage all system users and their permissions', 'Kelola semua pengguna sistem dan izin mereka')
                : getText('Manage department users and access', 'Kelola pengguna departemen dan akses')
              }
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-sm opacity-80">{getText('Total Users', 'Total Pengguna')}</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            label: getText('Students', 'Mahasiswa'),
            count: users.filter(u => u.role === 'student').length,
            color: 'bg-green-500',
            icon: BookOpen
          },
          {
            label: getText('Lecturers', 'Dosen'),
            count: users.filter(u => u.role === 'lecturer').length,
            color: 'bg-purple-500',
            icon: GraduationCap
          },
          {
            label: getText('Dept. Admins', 'Admin Dept.'),
            count: users.filter(u => u.role === 'department_admin').length,
            color: 'bg-blue-500',
            icon: Building
          },
          {
            label: getText('Super Admins', 'Super Admin'),
            count: users.filter(u => u.role === 'super_admin').length,
            color: 'bg-red-500',
            icon: Shield
          },
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.count}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-xl`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Enhanced Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative w-full sm:w-80 lg:w-[350px] shrink-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={getText('Search users...', 'Cari pengguna...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            >
              <option value="all">{getText('All Roles', 'Semua Peran')}</option>
              <option value="student">{getText('Students', 'Mahasiswa')}</option>
              <option value="lecturer">{getText('Lecturers', 'Dosen')}</option>
              <option value="department_admin">{getText('Dept. Admins', 'Admin Dept.')}</option>
              <option value="laboratory">{getText('Laboratory', 'Laboratorium')}</option>
              <option value="staffing">{getText('Staffing', 'Kepegawaian')}</option>
              <option value="purchasing">{getText('Purchasing', 'Pengadaan')}</option>
              <option value="technician">{getText('Technician', 'Teknisi')}</option>
              <option value="frontdesk">{getText('Front Desk', 'Front Desk')}</option>
              <option value="staff">{getText('Staff', 'Tenaga Kependidikan')}</option>
              <option value="finance">{getText('Finance', 'Keuangan')}</option>
              {profile?.role === 'super_admin' && (
                <option value="super_admin">{getText('Super Admins', 'Super Admin')}</option>
              )}
            </select>

            {/* Department Filter */}
            {profile?.role === 'super_admin' && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              >
                <option value="all">{getText('All Departments', 'Semua Departemen')}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} {dept.code && `(${dept.code})`}
                  </option>
                ))}
              </select>
            )}

            {/* Homebase Filter */}
            <select
              value={homebaseFilter}
              onChange={(e) => {
                setHomebaseFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            >
              <option value="all">{getText('All Users', 'Semua Pengguna')}</option>
              <option value="homebase">{getText('Homebase Only', 'Homebase Saja')}</option>
              <option value="non-homebase">{getText('Non-Homebase Only', 'Non-Homebase Saja')}</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                fetchUsers();
                setCurrentPage(1);
              }}
              disabled={loading}
              className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50"
              title={getText('Refresh', 'Refresh')}
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Export Button */}
            <button
              onClick={handleExportUsers}
              disabled={isExportingUsers || loading}
              className="flex items-center space-x-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title={getText('Export filtered users to Excel', 'Ekspor pengguna terfilter ke Excel')}
            >
              {isExportingUsers ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              <span className="hidden sm:inline">
                {isExportingUsers
                  ? getText('Exporting...', 'Mengekspor...')
                  : getText('Export Excel', 'Ekspor Excel')
                }
              </span>
            </button>

            {/* Cleanup Button (Admin Only) */}
            {(profile?.role === 'super_admin' || profile?.role === 'department_admin') && (
              <button
                onClick={() => setShowCleanupModal(true)}
                className="p-3 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors duration-200"
                title={getText('Cleanup Old Students', 'Hapus Mahasiswa Lama')}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}

            <button
              onClick={() => {
                setEditingUser(null);
                form.reset({
                  role: 'student',
                  username: '',
                  email: '',
                  full_name: '',
                  identity_number: '',
                  phone_number: '',
                  jabatan: '', // Position/Title
                  department_id: profile?.role === 'department_admin' ? profile.department_id : '',
                  study_program_id: '',
                  password: '',
                });
                setPhotoPreview(null);
                if (profile?.role === 'department_admin' && profile.department_id) {
                  fetchStudyProgramsByDepartment(profile.department_id);
                } else {
                  setStudyPrograms([]);
                }
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">{getText('Add User', 'Tambah Pengguna')}</span>
            </button>
          </div>
        </div>

        {/* Search Results Info */}
        {(searchTerm || roleFilter !== 'all' || departmentFilter !== 'all') && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-gray-600">
              {totalUsers} {getText('users found', 'pengguna ditemukan')}
            </div>
            {(searchTerm || roleFilter !== 'all' || departmentFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('all');
                  setDepartmentFilter('all');
                  setCurrentPage(1);
                }}
                className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
              >
                {getText('Clear filters', 'Hapus filter')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('User Info', 'Info Pengguna')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Contact & Role', 'Kontak & Peran')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Academic Info', 'Info Akademik')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Created', 'Dibuat')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Actions', 'Aksi')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-3" />
                      <span className="text-gray-600">{getText('Loading users...', 'Memuat pengguna...')}</span>
                    </div>
                  </td>
                </tr>
              ) : currentTableData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Users className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {totalUsers === 0 && (searchTerm || roleFilter !== 'all' || departmentFilter !== 'all')
                        ? getText('No users match your filters', 'Tidak ada pengguna yang cocok dengan filter')
                        : getText('No users found', 'Tidak ada pengguna ditemukan')
                      }
                    </h3>
                    <p className="text-gray-600">
                      {totalUsers === 0 && (searchTerm || roleFilter !== 'all' || departmentFilter !== 'all')
                        ? getText('Try adjusting your search criteria', 'Coba sesuaikan kriteria pencarian')
                        : getText('Add your first user to get started', 'Tambahkan pengguna pertama untuk memulai')
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                currentTableData.map((user) => {
                  const RoleIcon = getRoleIcon(user.role);

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div className="flex items-start space-x-4">
                          <div
                            className="flex-shrink-0 h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => {
                              if (user.attachments) {
                                setViewImageObj({ src: user.attachments, alt: user.full_name });
                              }
                            }}
                          >
                            {user.attachments ? (
                              <img
                                src={user.attachments}
                                alt={user.full_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <RoleIcon className="h-6 w-6 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {user.full_name}
                              </p>
                            </div>
                            <p className="text-sm text-blue-600 truncate">@{user.username}</p>
                            <p className="text-sm text-gray-500 truncate flex items-center mt-1">
                              <Hash className="h-3 w-3 mr-1" />
                              {user.identity_number}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {user.email && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              <span className="truncate">{user.email}</span>
                            </div>
                          )}
                          {user.phone_number && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              <span>{user.phone_number}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                              {getRoleDisplayName(user.role)}
                            </span>
                          </div>
                          {user.jabatan && (
                            <div className="text-xs text-gray-500 mt-1 italic">
                              {user.jabatan}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {user.department && (
                            <div className="flex items-center text-sm text-gray-900">
                              <Building className="h-4 w-4 mr-2 text-gray-400" />
                              <span className="font-medium truncate">{user.department.name}</span>
                            </div>
                          )}
                          {user.study_program && (
                            <div className="flex items-center text-sm text-gray-600">
                              <GraduationCap className="h-4 w-4 mr-2 text-gray-400" />
                              <span className="truncate">{user.study_program.name}</span>
                            </div>
                          )}
                          {!user.department && !user.study_program && (
                            <div className="text-sm text-gray-400 italic">
                              {getText('No academic info', 'Tidak ada info akademik')}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{format(new Date(user.created_at), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {format(new Date(user.created_at), 'HH:mm')}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setShowUserDetail(user)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                            title={getText('View Details', 'Lihat Detail')}
                          >
                            <Activity className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleEdit(user)}
                            disabled={processingIds.has(user.id)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                            title={getText('Edit User', 'Edit Pengguna')}
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => setShowDeleteConfirm(user.id)}
                            disabled={processingIds.has(user.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                            title={getText('Delete User', 'Hapus Pengguna')}
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Enhanced Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  {getText('Showing', 'Menampilkan')} {totalUsers > 0 ? startIndex + 1 : 0} - {Math.min(startIndex + itemsPerPage, totalUsers)} {getText('of', 'dari')} {totalUsers} {getText('users', 'pengguna')}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors duration-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{getText('Previous', 'Sebelum')}</span>
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= totalPages}
                  className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors duration-200"
                >
                  <span className="hidden sm:inline">{getText('Next', 'Selanjutnya')}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced User Detail Modal */}
      {showUserDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                    {React.createElement(getRoleIcon(showUserDetail.role), {
                      className: "h-8 w-8 text-white"
                    })}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{showUserDetail.full_name}</h2>
                    <p className="text-blue-100">@{showUserDetail.username}</p>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-white bg-opacity-20 text-white border border-white border-opacity-30`}>
                      {getRoleDisplayName(showUserDetail.role)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserDetail(null)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-4 flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      {getText('Basic Information', 'Informasi Dasar')}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-blue-200 last:border-b-0">
                        <span className="text-sm text-blue-700">{getText('ID Number', 'No. Identitas')}</span>
                        <span className="font-medium text-blue-900">{showUserDetail.identity_number}</span>
                      </div>
                      {showUserDetail.email && (
                        <div className="flex justify-between items-center py-2 border-b border-blue-200 last:border-b-0">
                          <span className="text-sm text-blue-700">{getText('Email', 'Email')}</span>
                          <span className="font-medium text-blue-900 text-sm">{showUserDetail.email}</span>
                        </div>
                      )}
                      {showUserDetail.phone_number && (
                        <div className="flex justify-between items-center py-2 border-b border-blue-200 last:border-b-0">
                          <span className="text-sm text-blue-700">{getText('Phone', 'Telepon')}</span>
                          <span className="font-medium text-blue-900">{showUserDetail.phone_number}</span>
                        </div>
                      )}
                      {showUserDetail.jabatan && (
                        <div className="flex justify-between items-center py-2 border-b border-blue-200 last:border-b-0">
                          <span className="text-sm text-blue-700">{getText('Position/Title', 'Jabatan')}</span>
                          <span className="font-medium text-blue-900">{showUserDetail.jabatan}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 border-b border-blue-200 last:border-b-0">
                        <span className="text-sm text-blue-700">{getText('Created', 'Dibuat')}</span>
                        <span className="font-medium text-blue-900 text-sm">{format(new Date(showUserDetail.created_at), 'dd MMM yyyy, HH:mm')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  {(showUserDetail.department || showUserDetail.study_program) && (
                    <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-4 flex items-center">
                        <Building className="h-5 w-5 mr-2" />
                        {getText('Academic Information', 'Informasi Akademik')}
                      </h4>
                      <div className="space-y-3">
                        {showUserDetail.department && (
                          <div className="flex justify-between items-center py-2 border-b border-green-200 last:border-b-0">
                            <span className="text-sm text-green-700">{getText('Department', 'Departemen')}</span>
                            <span className="font-medium text-green-900 text-sm">{showUserDetail.department.name}</span>
                          </div>
                        )}
                        {showUserDetail.study_program && (
                          <div className="flex justify-between items-center py-2 border-b border-green-200 last:border-b-0">
                            <span className="text-sm text-green-700">{getText('Study Program', 'Program Studi')}</span>
                            <span className="font-medium text-green-900 text-sm">{showUserDetail.study_program.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Assigned Rooms */}
                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                    <h4 className="font-semibold text-orange-900 mb-4 flex items-center">
                      <MapPin className="h-5 w-5 mr-2" />
                      {getText('Assigned Rooms', 'Ruangan')}
                    </h4>
                    {loadingUserDetails ? (
                      <div className="flex justify-center py-6">
                        <RefreshCw className="h-5 w-5 animate-spin text-orange-600" />
                      </div>
                    ) : userRooms.length > 0 ? (
                      <div className="space-y-3">
                        {userRooms.map((room) => {
                          // Build location path with dash separator
                          const locationParts = [
                            room.building?.campus?.name,
                            room.building?.name,
                            room.floor ? `Lt.${room.floor}` : null,
                            room.name
                          ].filter(Boolean);
                          const locationPath = locationParts.join(' - ');

                          return (
                            <div key={room.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-orange-900">{room.name}</div>
                                <div className="flex items-center gap-1 text-sm text-orange-700 mt-1">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate" title={locationPath}>
                                    {locationPath || room.code}
                                  </span>
                                </div>
                                <div className="text-xs text-orange-600 mt-1">
                                  {room.capacity} {getText('seats', 'kursi')}
                                </div>
                              </div>
                              <div className="text-xs text-orange-600 shrink-0 ml-2">
                                {format(new Date(room.assigned_at || ''), 'dd MMM')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-orange-600">
                        <Home className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{getText('No rooms assigned', 'Tidak ada ruangan')}</p>
                      </div>
                    )}
                  </div>

                  {/* Recent Activities */}
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-4 flex items-center">
                      <Activity className="h-5 w-5 mr-2" />
                      {getText('Recent Activities', 'Aktivitas Terbaru')}
                    </h4>
                    {loadingUserDetails ? (
                      <div className="flex justify-center py-6">
                        <RefreshCw className="h-5 w-5 animate-spin text-purple-600" />
                      </div>
                    ) : userActivities.length > 0 ? (
                      <div className="space-y-3">
                        {userActivities.map((activity) => (
                          <div key={activity.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-purple-200">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-purple-900 truncate">{activity.description}</div>
                              <div className="text-xs text-purple-600 flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(activity.timestamp), 'dd MMM, HH:mm')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-purple-600">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{getText('No recent activities', 'Tidak ada aktivitas')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t bg-gray-50 p-6 flex gap-3">
              <button
                onClick={() => {
                  setShowUserDetail(null);
                  handleEdit(showUserDetail);
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium flex items-center justify-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>{getText('Edit User', 'Edit Pengguna')}</span>
              </button>
              <button
                onClick={() => setShowUserDetail(null)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                {getText('Close', 'Tutup')}
              </button>
            </div>
          </div>
        </div>

      )}

      {/* Image Viewer Modal */}
      {/* Image Viewer Modal */}
      {viewImageObj && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-90 transition-opacity duration-300">
          <div className="absolute top-4 right-4 z-[70] flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-1 backdrop-blur-sm">
              <button
                onClick={handleZoomOut}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="h-6 w-6" />
              </button>
              <span className="text-white font-medium min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="h-6 w-6" />
              </button>
            </div>
            <button
              onClick={resetZoom}
              className="p-3 text-white hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
          </div>

          <div
            className="relative w-full h-full flex items-center justify-center overflow-hidden p-4"
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <img
              src={viewImageObj.src}
              alt={viewImageObj.alt}
              draggable={false}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
              className="max-w-full max-h-full object-contain select-none"
            />
          </div>
        </div>
      )}
      {/* Enhanced Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                    {editingUser ? <Edit className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      {editingUser ? getText('Edit User', 'Edit Pengguna') : getText('Add New User', 'Tambah Pengguna Baru')}
                    </h3>
                    <p className="text-blue-100 text-sm">
                      {editingUser
                        ? getText('Update user information and permissions', 'Perbarui informasi dan izin pengguna')
                        : getText('Create a new user account', 'Buat akun pengguna baru')
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    form.reset();
                    setPhotoPreview(null);
                  }}
                  disabled={submitting}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-6">
                {/* Basic Information Section */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    {getText('Basic Information', 'Informasi Dasar')}
                  </h4>

                  {/* Photo Upload Section */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Profile Photo', 'Foto Profil')}
                    </label>
                    <div className="flex items-start space-x-4">
                      {/* Photo Preview */}
                      <div className="relative">
                        {photoPreview ? (
                          <div className="relative">
                            <img
                              src={photoPreview}
                              alt="Profile Preview"
                              className="h-24 w-24 rounded-xl object-cover border-2 border-blue-300 shadow-md"
                            />
                            <button
                              type="button"
                              onClick={clearPhoto}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                              title={getText('Remove photo', 'Hapus foto')}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="h-24 w-24 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <User className="h-10 w-10 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Upload Controls */}
                      <div className="flex-1">
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                          id="user-photo-upload"
                          disabled={submitting}
                        />
                        <label
                          htmlFor="user-photo-upload"
                          className={`inline-flex items-center space-x-2 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors ${submitting ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                          <Camera className="h-4 w-4" />
                          <span>{photoPreview ? getText('Change Photo', 'Ganti Foto') : getText('Upload Photo', 'Unggah Foto')}</span>
                        </label>
                        <p className="mt-2 text-xs text-gray-500">
                          {getText('Max 5MB. Formats: JPG, PNG, GIF', 'Maks 5MB. Format: JPG, PNG, GIF')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Full Name', 'Nama Lengkap')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        {...form.register('full_name')}
                        type="text"
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${form.formState.errors.full_name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400'
                          }`}
                        placeholder={getText('Enter full name', 'Masukkan nama lengkap')}
                        disabled={submitting}
                      />
                      {form.formState.errors.full_name && (
                        <p className="mt-1 text-sm text-red-600 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {form.formState.errors.full_name.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Username */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Username', 'Username')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...form.register('username')}
                          type="text"
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${form.formState.errors.username ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400'
                            }`}
                          placeholder="username"
                          disabled={submitting}
                        />
                        {form.formState.errors.username && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {form.formState.errors.username.message}
                          </p>
                        )}
                      </div>

                      {/* Identity Number */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('ID Number', 'No. Identitas')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          {...form.register('identity_number')}
                          type="text"
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${form.formState.errors.identity_number ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400'
                            }`}
                          placeholder="NIM/NIP"
                          disabled={submitting}
                        />
                        {form.formState.errors.identity_number && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {form.formState.errors.identity_number.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Email', 'Email')}
                        </label>
                        <input
                          {...form.register('email')}
                          type="email"
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${form.formState.errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400'
                            }`}
                          placeholder="user@email.com"
                          disabled={submitting}
                        />
                        {form.formState.errors.email && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {form.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Phone', 'Telepon')}
                        </label>
                        <input
                          {...form.register('phone_number')}
                          type="tel"
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${form.formState.errors.phone_number ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400'
                            }`}
                          placeholder="08xxxxxxxxxx"
                          disabled={submitting}
                        />
                      </div>
                    </div>

                    {/* Jabatan (Position/Title) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Position/Title', 'Jabatan')}
                      </label>
                      <input
                        {...form.register('jabatan')}
                        type="text"
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${form.formState.errors.jabatan ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400'
                          }`}
                        placeholder={getText('e.g. Assistant Professor, Lab Assistant', 'cth. Asisten Ahli, Laboran')}
                        disabled={submitting}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {getText('Enter the user\'s job title or position', 'Masukkan jabatan atau posisi pengguna')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Role & Permissions Section */}
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <h4 className="font-semibold text-purple-900 mb-4 flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    {getText('Role & Permissions', 'Peran & Izin')}
                  </h4>

                  {/* Role Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Role', 'Peran')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...form.register('role')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                      disabled={submitting}
                    >
                      <option value="student">{getText('Student', 'Mahasiswa')}</option>
                      <option value="lecturer">{getText('Lecturer', 'Dosen')}</option>
                      {(profile?.role === 'super_admin' || profile?.role === 'staffing') && (
                        <>
                          <option value="department_admin">{getText('Department Admin', 'Admin Departemen')}</option>
                          <option value="laboratory">{getText('Laboratory', 'Laboratorium')}</option>
                          <option value="staffing">{getText('Staffing', 'Kepegawaian')}</option>
                          <option value="purchasing">{getText('Purchasing', 'Pengadaan')}</option>
                          <option value="technician">{getText('Technician', 'Teknisi')}</option>
                          <option value="frontdesk">{getText('Front Desk', 'Front Desk')}</option>
                          <option value="staff">{getText('Staff', 'Tenaga Kependidikan')}</option>
                          <option value="finance">{getText('Finance', 'Keuangan')}</option>
                        </>
                      )}
                      {profile?.role === 'super_admin' && (
                        <option value="super_admin">{getText('Super Admin', 'Super Admin')}</option>
                      )}
                    </select>
                    {form.formState.errors.role && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {form.formState.errors.role.message}
                      </p>
                    )}
                  </div>

                  {/* Homebase Toggle for Lecturer */}
                  {watchRole === 'lecturer' && (
                    <div className="mb-4 flex items-center p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          {...form.register('is_homebase')}
                          id="is_homebase"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="is_homebase" className="font-medium text-gray-700">
                          {getText('Homebase Lecturer?', 'Dosen Homebase?')}
                        </label>
                        <p className="text-gray-500 text-xs">
                          {getText('Uncheck if this is an external lecturer without department/study program.', 'Hapus centang jika ini adalah dosen luar biasa tanpa departemen/program studi.')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Role Description */}
                  <div className="bg-white rounded-lg p-3 border border-purple-200">
                    <div className="text-sm text-purple-700">
                      <strong>{getText('Selected Role', 'Peran Terpilih')}:</strong> {getRoleDisplayName(watchRole)}
                    </div>
                    <div className="text-xs text-purple-600 mt-1">
                      {watchRole === 'super_admin' && getText('Full system access and user management', 'Akses penuh sistem dan manajemen pengguna')}
                      {watchRole === 'department_admin' && getText('Department-level management and oversight', 'Manajemen dan pengawasan tingkat departemen')}
                      {watchRole === 'lecturer' && getText('Room booking and class management', 'Pemesanan ruangan dan manajemen kelas')}
                      {watchRole === 'student' && getText('Basic room booking access', 'Akses dasar pemesanan ruangan')}
                      {watchRole === 'laboratory' && getText('Lab room and equipment management per department', 'Manajemen ruangan lab dan peralatan per departemen')}
                      {watchRole === 'staffing' && getText('User and room management across all departments', 'Manajemen pengguna dan ruangan lintas departemen')}
                      {watchRole === 'purchasing' && getText('Equipment stock and location management', 'Manajemen stok peralatan dan lokasi')}
                      {watchRole === 'technician' && getText('View reports and maintenance tasks', 'Melihat laporan dan tugas pemeliharaan')}
                      {watchRole === 'frontdesk' && getText('View schedules and room booking', 'Melihat jadwal dan pemesanan ruangan')}
                      {watchRole === 'staff' && getText('Profile access only', 'Hanya akses profil')}
                      {watchRole === 'finance' && getText('Attendance verification and reporting', 'Verifikasi presensi dan pelaporan')}
                    </div>
                  </div>
                </div>

                {/* Academic Information Section */}
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-4 flex items-center">
                    <GraduationCap className="h-5 w-5 mr-2" />
                    {getText('Academic Information', 'Informasi Akademik')}
                  </h4>

                  {/* Non-homebase info box */}
                  {editingUser && !editingUser.is_homebase && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">
                        {getText(
                          'Non-homebase lecturer: All study programs (including hidden ones) are available for selection.',
                          'Dosen non-homebase: Semua program studi (termasuk yang disembunyikan) tersedia untuk dipilih.'
                        )}
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Department Selection */}
                    {profile?.role === 'super_admin' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Department', 'Departemen')}
                        </label>
                        <SearchableDropdown
                          options={departments.map(dept => ({ id: dept.id, name: dept.name, code: dept.code }))}
                          value={form.watch('department_id') || ''}
                          onChange={(value) => {
                            form.setValue('department_id', value);
                            form.setValue('study_program_id', '');
                            // Use fetchAllStudyPrograms for non-homebase users
                            if (editingUser && !editingUser.is_homebase) {
                              fetchAllStudyPrograms(value);
                            } else if (value) {
                              fetchStudyProgramsByDepartment(value);
                            }
                          }}
                          placeholder={getText('Select Department (Optional)', 'Pilih Departemen (Opsional)')}
                          searchPlaceholder={getText('Search departments...', 'Cari departemen...')}
                          emptyMessage={getText('No departments found', 'Tidak ada departemen ditemukan')}
                          disabled={submitting}
                        />
                        {form.formState.errors.department_id && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {form.formState.errors.department_id.message}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Department', 'Departemen')}
                        </label>
                        <input
                          type="text"
                          value={departments.find(d => d.id === profile?.department_id)?.name || getText('Your Department', 'Departemen Anda')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 transition-all duration-200"
                          disabled
                        />
                        <p className="mt-1 text-sm text-gray-500 flex items-center">
                          <Info className="h-4 w-4 mr-1" />
                          {getText('Department is automatically set based on your role', 'Departemen diatur otomatis berdasarkan peran Anda')}
                        </p>
                      </div>
                    )}

                    {/* Study Program Selection */}
                    {((profile?.role === 'super_admin' && watchDepartmentId) || profile?.role === 'department_admin') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Study Program', 'Program Studi')}
                        </label>
                        <SearchableDropdown
                          options={studyPrograms.filter(sp =>
                            profile?.role === 'department_admin'
                              ? sp.department_id === profile.department_id
                              : sp.department_id === watchDepartmentId
                          ).map(program => ({
                            id: program.id,
                            name: program.name,
                            code: program.code
                          }))}
                          value={form.watch('study_program_id') || ''}
                          onChange={(value) => form.setValue('study_program_id', value)}
                          placeholder={getText('Select Study Program (Optional)', 'Pilih Program Studi (Opsional)')}
                          searchPlaceholder={getText('Search study programs...', 'Cari program studi...')}
                          emptyMessage={getText('No study programs found', 'Tidak ada program studi ditemukan')}
                          disabled={submitting}
                        />
                        {form.formState.errors.study_program_id && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {form.formState.errors.study_program_id.message}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Info Message for Super Admin */}
                    {profile?.role === 'super_admin' && !watchDepartmentId && (
                      <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                        <div className="flex items-center">
                          <Info className="h-5 w-5 text-blue-600 mr-2" />
                          <p className="text-sm text-blue-700">
                            {getText('Select a department to see available study programs, or leave empty for general users', 'Pilih departemen untuk melihat program studi yang tersedia, atau biarkan kosong untuk pengguna umum')}
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Security Section */}
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <h4 className="font-semibold text-red-900 mb-4 flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    {getText('Security', 'Keamanan')}
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Password', 'Kata Sandi')}
                      {!editingUser && <span className="text-red-500"> *</span>}
                      {editingUser && (
                        <span className="text-gray-500 text-sm ml-2">
                          {getText('(leave blank to keep current)', '(kosongkan jika tidak diubah)')}
                        </span>
                      )}
                    </label>
                    <PasswordInput
                      value={form.watch('password') || ''}
                      onChange={(value) => form.setValue('password', value)}
                      placeholder={editingUser ? getText('Leave blank to keep current password', 'Biarkan kosong untuk mempertahankan password saat ini') : getText('Enter password', 'Masukkan password')}
                      error={form.formState.errors.password?.message}
                      required={!editingUser}
                    />

                    {/* Password Requirements */}
                    {!editingUser && (
                      <div className="mt-2 p-3 bg-white rounded-lg border border-red-200">
                        <p className="text-xs text-red-700 mb-2 font-medium">
                          {getText('Password Requirements:', 'Persyaratan Password:')}
                        </p>
                        <ul className="text-xs text-red-600 space-y-1">
                          <li>• {getText('Minimum 6 characters', 'Minimal 6 karakter')}</li>
                          <li>• {getText('Mix of letters and numbers recommended', 'Kombinasi huruf dan angka direkomendasikan')}</li>
                          <li>• {getText('Avoid common passwords', 'Hindari password umum')}</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Room Assignment Section - Only show when editing */}
                {editingUser && (
                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-orange-900 flex items-center">
                        <DoorOpen className="h-5 w-5 mr-2" />
                        {getText('Room Assignment', 'Penugasan Ruangan')}
                      </h4>

                      {/* Download Nametag Button - Only for lecturers */}
                      {editingUser.role === 'lecturer' && (
                        <button
                          type="button"
                          onClick={downloadLecturerNametag}
                          disabled={isDownloadingLecturers}
                          className={`flex items-center space-x-2 px-3 py-2 text-white rounded-lg transition-colors text-sm ${isDownloadingLecturers ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
                          title={getText('Download Nametag', 'Unduh Nametag')}
                        >
                          {isDownloadingLecturers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          <span>{getText('Nametag', 'Nametag')}</span>
                        </button>
                      )}
                    </div>

                    {/* Add Room to User */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Assign to Room', 'Tugaskan ke Ruangan')}
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder={getText('Search room...', 'Cari ruangan...')}
                            value={roomSearchTerm}
                            onChange={(e) => setRoomSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                          {roomSearchTerm && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {allRooms
                                .filter(room =>
                                  room.name.toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
                                  room.code.toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
                                  (room.building?.name?.toLowerCase().includes(roomSearchTerm.toLowerCase()))
                                )
                                .slice(0, 20)
                                .map(room => {
                                  const isAlreadyAssigned = editingUserRooms.some(r => r.id === room.id);
                                  return (
                                    <button
                                      key={room.id}
                                      type="button"
                                      onClick={() => {
                                        if (!isAlreadyAssigned) {
                                          setSelectedRoomToAssign(room.id);
                                          setRoomSearchTerm(room.name);
                                        }
                                      }}
                                      disabled={isAlreadyAssigned}
                                      className={`w-full px-4 py-2 text-left text-sm hover:bg-orange-50 border-b last:border-b-0 ${isAlreadyAssigned ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                                        } ${selectedRoomToAssign === room.id ? 'bg-orange-100' : ''}`}
                                    >
                                      <div className="font-medium">{room.name}</div>
                                      <div className="text-xs text-gray-500">
                                        {room.code} • {room.building?.campus?.name} - {room.building?.name}
                                        {isAlreadyAssigned && ' • (Already assigned)'}
                                      </div>
                                    </button>
                                  );
                                })}
                              {allRooms.filter(room =>
                                room.name.toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
                                room.code.toLowerCase().includes(roomSearchTerm.toLowerCase())
                              ).length === 0 && (
                                  <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                    {getText('No rooms found', 'Ruangan tidak ditemukan')}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleAssignRoomToUser}
                          disabled={!selectedRoomToAssign || assigningRoom}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                          {assigningRoom ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          {getText('Assign', 'Tugaskan')}
                        </button>
                      </div>
                    </div>

                    {/* Current Assigned Rooms */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Assigned Rooms', 'Ruangan yang Ditugaskan')} ({editingUserRooms.length})
                      </label>
                      {editingUserRooms.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {editingUserRooms.map(room => (
                            <div key={room.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-200">
                              <div>
                                <div className="font-medium text-gray-900 text-sm">{room.name}</div>
                                <div className="text-xs text-gray-500">
                                  {room.code} • {room.building?.campus?.name} - {room.building?.name}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUnassignRoomFromUser(room.id, room.name)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title={getText('Remove from room', 'Hapus dari ruangan')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 text-center py-4 bg-white rounded-lg border border-dashed border-orange-300">
                          {getText('No rooms assigned yet', 'Belum ada ruangan yang ditugaskan')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Modal Footer */}
            <div className="border-t bg-gray-50 p-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingUser(null);
                  form.reset();
                  setPhotoPreview(null);
                }}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors duration-200 font-medium disabled:opacity-50"
                disabled={submitting}
              >
                {getText('Cancel', 'Batal')}
              </button>
              <button
                type="submit"
                onClick={() => {
                  console.log('🔵 Submit button clicked');
                  console.log('   submitting:', submitting);
                  console.log('   processingIds.has(form):', processingIds.has('form'));
                  console.log('   form.formState:', form.formState);
                  console.log('   form.formState.isValid:', form.formState.isValid);
                  console.log('   form.formState.errors:', form.formState.errors);
                  form.handleSubmit(handleSubmit)();
                }}
                disabled={submitting || processingIds.has('form')}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 font-medium flex items-center justify-center gap-2"
              >
                {submitting || processingIds.has('form') ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {getText('Saving...', 'Menyimpan...')}
                  </>
                ) : (
                  <>
                    {editingUser ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingUser ? getText('Update User', 'Perbarui Pengguna') : getText('Create User', 'Buat Pengguna')}
                  </>
                )}
              </button>
            </div>
          </div >
        </div >
      )}

      {/* Enhanced Delete Confirmation Modal */}
      {
        showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">
                      {getText('Delete User', 'Hapus Pengguna')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getText('This action cannot be undone', 'Tindakan ini tidak dapat dibatalkan')}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-gray-700 mb-4">
                    {getText(
                      'Are you sure you want to delete this user? All associated data will be permanently removed.',
                      'Apakah Anda yakin ingin menghapus pengguna ini? Semua data terkait akan dihapus secara permanen.'
                    )}
                  </p>

                  {(() => {
                    const userToDelete = users.find(u => u.id === showDeleteConfirm);
                    return userToDelete && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                            {React.createElement(getRoleIcon(userToDelete.role), {
                              className: "h-5 w-5 text-white"
                            })}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{userToDelete.full_name}</p>
                            <p className="text-sm text-gray-500">@{userToDelete.username}</p>
                            <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(userToDelete.role)}`}>
                              {getRoleDisplayName(userToDelete.role)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium"
                    disabled={processingIds.has(showDeleteConfirm || '')}
                  >
                    {getText('Cancel', 'Batal')}
                  </button>
                  <button
                    onClick={() => {
                      if (showDeleteConfirm) {
                        handleDelete(showDeleteConfirm);
                      }
                    }}
                    disabled={processingIds.has(showDeleteConfirm || '')}
                    className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors duration-200 font-medium flex items-center justify-center gap-2"
                  >
                    {processingIds.has(showDeleteConfirm || '') ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {getText('Deleting...', 'Menghapus...')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        {getText('Delete User', 'Hapus Pengguna')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Student Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {getText('Cleanup Old Students', 'Hapus Mahasiswa Lama')}
                </h3>
                <p className="text-sm text-gray-500">
                  {getText('Delete student accounts based on inactive duration', 'Hapus akun mahasiswa berdasarkan waktu pendaftaran')}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getText('Delete students registered more than:', 'Hapus mahasiswa yang terdaftar lebih dari:')}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[2, 3, 6].map((months) => (
                    <button
                      key={months}
                      onClick={() => setCleanupMonths(months as 2 | 3 | 6)}
                      className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${cleanupMonths === months
                        ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-200'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50/50'
                        }`}
                    >
                      {months} {getText('Months', 'Bulan')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getText('Filter by Identity Number (Start with):', 'Filter berdasarkan NIM (Diawali dengan):')}
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={cleanupNimPrefix}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                      setCleanupNimPrefix(val);
                    }}
                    placeholder={getText('e.g. 20, 21', 'cth. 20, 21')}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {getText('Leave empty to select regardless of NIM.', 'Biarkan kosong untuk memilih semua NIM.')}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800">
                    {getText('Attention', 'Perhatian')}
                  </p>
                  <p className="text-sm text-amber-700">
                    {getText(
                      `This action will permanently delete ${cleanupPreviewCount === null ? '...' : cleanupPreviewCount} student account(s) registered before ${new Date(new Date().setMonth(new Date().getMonth() - cleanupMonths)).toLocaleDateString()}${cleanupNimPrefix ? ` with NIM starting with '${cleanupNimPrefix}'` : ''}.`,
                      `Tindakan ini akan menghapus permanen ${cleanupPreviewCount === null ? '...' : cleanupPreviewCount} akun mahasiswa yang terdaftar sebelum ${new Date(new Date().setMonth(new Date().getMonth() - cleanupMonths)).toLocaleDateString('id-ID')}${cleanupNimPrefix ? ` dengan NIM diawali '${cleanupNimPrefix}'` : ''}.`
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowCleanupModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isCleaning}
              >
                {getText('Cancel', 'Batal')}
              </button>
              <button
                onClick={handleExecuteCleanup}
                disabled={isCleaning || cleanupPreviewCount === 0}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isCleaning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{getText('Deleting...', 'Menghapus...')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>{getText('Confirm Delete', 'Konfirmasi Hapus')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN TEMPLATE FOR GENERATING INDIVIDUAL NAMETAG */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div
          id="lecturer-nametag-element"
          style={{
            width: '25cm',
            height: '6.8cm',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Background Image Template */}
          <img
            src="/template_nametag.png"
            alt="Nametag Background"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />

          {/* Content Overlay */}
          {editingUser && (
            <>
              {/* Name - Positioned with exact coordinates */}
              <div style={{
                position: 'absolute',
                left: '0.32cm',
                top: '2.76cm',
                width: '24cm',
                height: '1.27cm',
                fontSize: '30.1pt',
                fontWeight: 'bold',
                fontFamily: "'League Spartan', sans-serif",
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}>
                {editingUser.full_name}
              </div>

              {/* Program Studi - Positioned with exact coordinates */}
              <div style={{
                position: 'absolute',
                left: '8.59cm',
                top: '5.0cm',
                width: '7.83cm',
                height: '0.63cm',
                fontSize: '15pt',
                fontWeight: '600',
                fontFamily: "'League Spartan', sans-serif",
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}>
                {editingUser.study_program?.name || getText('General', 'Umum')}
              </div>
            </>
          )}
        </div>
      </div>
    </div >
  );
};

export default UserManagement;