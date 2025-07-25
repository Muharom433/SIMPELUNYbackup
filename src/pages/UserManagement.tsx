import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  MapPin,
  Clock,
  Mail,
  Phone,
  UserCheck,
  Filter,
  Download,
  Upload,
  FileText,
  Activity,
  Home,
  School,
  Briefcase
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { alert } from '../components/Alert/AlertHelper';
import { format } from 'date-fns';

// Enhanced User schema with better validation
const userSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore, and dash'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  full_name: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters'),
  identity_number: z.string()
    .min(5, 'Identity number must be at least 5 characters')
    .max(50, 'Identity number must be less than 50 characters'),
  phone_number: z.string()
    .regex(/^[\+]?[0-9\-\s\(\)]*$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  role: z.enum(['super_admin', 'department_admin', 'lecturer', 'student']),
  department_id: z.string().optional().nullable(),
  study_program_id: z.string().optional().nullable(),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be less than 100 characters')
    .optional(),
}).superRefine((data, ctx) => {
  // Advanced validation rules
  if (data.role === 'student' && !data.study_program_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Study program is required for students',
      path: ['study_program_id'],
    });
  }
  
  if ((data.role === 'department_admin' || data.role === 'lecturer') && !data.department_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Department is required for this role',
      path: ['department_id'],
    });
  }
});

type UserForm = z.infer<typeof userSchema>;

// Enhanced User interface with relations
interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  identity_number: string;
  phone_number?: string;
  role: string;
  department_id?: string;
  study_program_id?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  study_program?: {
    id: string;
    name: string;
    code: string;
  };
  // Additional data for detail modal
  assigned_rooms?: Room[];
  bookings_count?: number;
  recent_activities?: Activity[];
}

interface Department {
  id: string;
  name: string;
  code: string;
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
  is_available: boolean;
  assigned_at?: string;
}

interface Activity {
  id: string;
  type: 'booking' | 'login' | 'assignment';
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
  required?: boolean;
  error?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = React.memo(({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  searchPlaceholder = "Search...",
  emptyMessage = "No options found",
  required = false,
  error
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

  const handleSelect = useCallback((optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between ${
          error 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300'
        } ${
          disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'hover:border-gray-400'
        }`}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption 
            ? `${selectedOption.name}${selectedOption.code ? ` (${selectedOption.code})` : ''}`
            : placeholder
          }
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-8 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {!required && value && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
              >
                Clear selection
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                {searchTerm ? `No results for "${searchTerm}"` : emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-900 ${
                    option.id === value ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
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

// Password Input Component with show/hide toggle
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
        className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
        }`}
        required={required}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

const UserManagement: React.FC = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();
  
  // Enhanced state management
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showUserDetail, setShowUserDetail] = useState<User | null>(null);
  
  // Enhanced filtering and pagination
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'ascending' | 'descending' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Detail modal data
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [userActivities, setUserActivities] = useState<Activity[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  // Form with better default values
  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'student',
      username: '',
      email: '',
      full_name: '',
      identity_number: '',
      phone_number: '',
      department_id: '',
      study_program_id: '',
      password: '',
    },
    mode: 'onChange'
  });

  const watchRole = form.watch('role');
  const watchDepartmentId = form.watch('department_id');

  // Enhanced filtering with multiple criteria
  const filteredUsers = useMemo(() => {
    if (!users || users.length === 0) return [];
    
    return users.filter(user => {
      const searchLower = searchTerm.toLowerCase().trim();
      
      // Search filter
      const matchesSearch = !searchLower || 
        (user.full_name?.toLowerCase() || '').includes(searchLower) ||
        (user.username?.toLowerCase() || '').includes(searchLower) ||
        (user.email?.toLowerCase() || '').includes(searchLower) ||
        (user.identity_number?.toLowerCase() || '').includes(searchLower) ||
        (user.phone_number?.toLowerCase() || '').includes(searchLower) ||
        (user.department?.name?.toLowerCase() || '').includes(searchLower) ||
        (user.study_program?.name?.toLowerCase() || '').includes(searchLower) ||
        (user.study_program?.code?.toLowerCase() || '').includes(searchLower);
      
      // Role filter
      const matchesRole = !filterRole || user.role === filterRole;
      
      // Department filter
      const matchesDepartment = !filterDepartment || user.department_id === filterDepartment;
      
      // Status filter
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && user.is_active) ||
        (filterStatus === 'inactive' && !user.is_active);
      
      return matchesSearch && matchesRole && matchesDepartment && matchesStatus;
    });
  }, [users, searchTerm, filterRole, filterDepartment, filterStatus]);

  // Enhanced sorting
  const sortedUsers = useMemo(() => {
    let sortableItems = [...filteredUsers];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
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
    return sortableItems;
  }, [filteredUsers, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTableData = sortedUsers.slice(startIndex, startIndex + itemsPerPage);

  // Helper functions
  const getRoleIcon = useCallback((role: string) => {
    switch (role) {
      case 'super_admin': return Shield;
      case 'department_admin': return Building;
      case 'lecturer': return User;
      case 'student': return BookOpen;
      default: return User;
    }
  }, []);

  const getRoleDisplayName = useCallback((role: string) => {
    switch (role) {
      case 'super_admin': return getText('Super Admin', 'Super Admin');
      case 'department_admin': return getText('Department Admin', 'Admin Departemen');
      case 'lecturer': return getText('Lecturer', 'Dosen');
      case 'student': return getText('Student', 'Mahasiswa');
      default: return role;
    }
  }, [getText]);

  const getRoleBadgeColor = useCallback((role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'department_admin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'lecturer': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'student': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  const requestSort = (key: keyof User) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  // API functions
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('users').select(`
        *,
        department:departments(id, name, code),
        study_program:study_programs(id, name, code)
      `);
      
      // Apply role-based filtering
      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('department_id', profile.department_id);
      }
      
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(getText('Failed to load users', 'Gagal memuat pengguna'));
    } finally {
      setLoading(false);
    }
  }, [profile, getText]);

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
      let query = supabase.from('study_programs').select('*');
      
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
    if (!departmentId) {
      setStudyPrograms([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('study_programs')
        .select('*')
        .eq('department_id', departmentId);
      
      if (error) throw error;
      setStudyPrograms(data || []);
      
      // Clear study program if it's not in the new department
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

  // Fetch user details for modal
  const fetchUserDetails = useCallback(async (userId: string) => {
    setLoadingUserDetails(true);
    try {
      // Fetch assigned rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('room_users')
        .select(`
          assigned_at,
          room:rooms(id, name, code, capacity, is_available)
        `)
        .eq('user_id', userId)
        .order('assigned_at', { ascending: false });

      if (!roomsError && roomsData) {
        const rooms = roomsData.map(item => ({
          ...item.room,
          assigned_at: item.assigned_at
        }));
        setUserRooms(rooms);
      }

      // Fetch recent activities (bookings)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          purpose,
          status,
          created_at,
          start_time,
          room:rooms(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!bookingsError && bookingsData) {
        const activities = bookingsData.map(booking => ({
          id: booking.id,
          type: 'booking' as const,
          description: `${getText('Booked', 'Memesan')} ${booking.room?.name} - ${booking.purpose}`,
          timestamp: booking.created_at,
          room_name: booking.room?.name
        }));
        setUserActivities(activities);
      }

    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error(getText('Failed to load user details', 'Gagal memuat detail pengguna'));
    } finally {
      setLoadingUserDetails(false);
    }
  }, [getText]);

  // Effects
  useEffect(() => {
    if (profile) {
      fetchUsers();
      fetchDepartments();
      fetchStudyPrograms();
    }
  }, [profile, fetchUsers, fetchDepartments, fetchStudyPrograms]);

  useEffect(() => {
    fetchStudyProgramsByDepartment(watchDepartmentId || '');
  }, [watchDepartmentId, fetchStudyProgramsByDepartment]);

  useEffect(() => {
    if (showUserDetail) {
      fetchUserDetails(showUserDetail.id);
    }
  }, [showUserDetail, fetchUserDetails]);

  // Access control check
  if (!profile || !['super_admin', 'department_admin'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {getText('Access Denied', 'Akses Ditolak')}
          </h3>
          <p className="text-gray-600">
            {getText("You don't have permission to access user management.", 'Anda tidak memiliki izin untuk mengakses manajemen pengguna.')}
          </p>
        </div>
      </div>
    );
  }

  // Form submission
  const handleSubmit = async (data: UserForm) => {
    try {
      setSubmitting(true);

      // Apply role-based restrictions
      if (profile?.role === 'department_admin') {
        data.department_id = profile.department_id!;
        if (!['lecturer', 'student'].includes(data.role)) {
          data.role = 'student';
        }
      }

      // Prepare user data
      const userData = {
        username: data.username.trim(),
        email: data.email?.trim() || null,
        full_name: data.full_name.trim(),
        identity_number: data.identity_number.trim(),
        phone_number: data.phone_number?.trim() || null,
        role: data.role,
        department_id: data.department_id || null,
        study_program_id: data.study_program_id || null,
      };

      if (editingUser) {
        // Update existing user
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
        // Create new user
        if (!data.password?.trim()) {
          throw new Error(getText('Password is required for new users', 'Password diperlukan untuk pengguna baru'));
        }

        const { error } = await supabase
          .from('users')
          .insert({ ...userData, password: data.password.trim() });
        
        if (error) throw error;
        toast.success(getText('User created successfully', 'Pengguna berhasil dibuat'));
      }

      // Reset form and close modal
      setShowModal(false);
      setEditingUser(null);
      form.reset({
        role: 'student',
        username: '',
        email: '',
        full_name: '',
        identity_number: '',
        phone_number: '',
        department_id: profile?.role === 'department_admin' ? profile.department_id : '',
        study_program_id: '',
        password: '',
      });
      
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      
      // Handle specific database errors
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
      role: user.role as any,
      department_id: user.department_id || '',
      study_program_id: user.study_program_id || '',
      password: '', // Always empty for security
    });
    
    if (user.department_id) {
      fetchStudyProgramsByDepartment(user.department_id);
    }
    
    setShowModal(true);
  }, [form, fetchStudyProgramsByDepartment]);

  const handleDelete = async (userId: string) => {
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      toast.success(getText('User deleted successfully', 'Pengguna berhasil dihapus'));
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || getText('Failed to delete user', 'Gagal menghapus pengguna'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = useCallback((user: User) => {
    setShowUserDetail(user);
  }, []);

  // Clear filters function
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterRole('');
    setFilterDepartment('');
    setFilterStatus('all');
    setCurrentPage(1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Users className="h-8 w-8" />
              <span>{getText('User Management', 'Manajemen Pengguna')}</span>
            </h1>
            <p className="mt-2 opacity-90">
              {getText('Manage system users, roles, and their relationships', 'Kelola pengguna sistem, peran, dan hubungannya')}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{users.length}</div>
                <div className="text-sm opacity-80">{getText('Total Users', 'Total Pengguna')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{filteredUsers.length}</div>
                <div className="text-sm opacity-80">{getText('Filtered', 'Terfilter')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={getText('Search users...', 'Cari pengguna...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {/* Role Filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{getText('All Roles', 'Semua Peran')}</option>
                <option value="student">{getText('Student', 'Mahasiswa')}</option>
                <option value="lecturer">{getText('Lecturer', 'Dosen')}</option>
                <option value="department_admin">{getText('Department Admin', 'Admin Departemen')}</option>
                {profile?.role === 'super_admin' && (
                  <option value="super_admin">{getText('Super Admin', 'Super Admin')}</option>
                )}
              </select>

              {/* Department Filter for Super Admin */}
              {profile?.role === 'super_admin' && (
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{getText('All Departments', 'Semua Departemen')}</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} {dept.code && `(${dept.code})`}
                    </option>
                  ))}
                </select>
              )}

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{getText('All Status', 'Semua Status')}</option>
                <option value="active">{getText('Active', 'Aktif')}</option>
                <option value="inactive">{getText('Inactive', 'Tidak Aktif')}</option>
              </select>

              {/* Clear filters button */}
              {(searchTerm || filterRole || filterDepartment || filterStatus !== 'all') && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {getText('Clear Filters', 'Hapus Filter')}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 disabled:opacity-50"
              title={getText('Refresh', 'Muat Ulang')}
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
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
                  department_id: profile?.role === 'department_admin' ? profile.department_id : '',
                  study_program_id: '',
                  password: '',
                });
                if (profile?.role === 'department_admin' && profile.department_id) {
                  fetchStudyProgramsByDepartment(profile.department_id);
                } else {
                  setStudyPrograms([]);
                }
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-4 w-4" />
              <span>{getText('Add User', 'Tambah Pengguna')}</span>
            </button>
          </div>
        </div>
        
        {/* Filter summary */}
        {(searchTerm || filterRole || filterDepartment || filterStatus !== 'all') && (
          <div className="mt-4 text-sm text-gray-600">
            {getText('Showing', 'Menampilkan')} <strong>{filteredUsers.length}</strong> {getText('of', 'dari')} <strong>{users.length}</strong> {getText('users', 'pengguna')}
            {searchTerm && (
              <span> {getText('matching', 'yang cocok dengan')} "<strong>{searchTerm}</strong>"</span>
            )}
            {filterRole && (
              <span> • {getText('Role:', 'Peran:')} <strong>{getRoleDisplayName(filterRole)}</strong></span>
            )}
            {filterDepartment && (
              <span> • {getText('Department:', 'Departemen:')} <strong>{departments.find(d => d.id === filterDepartment)?.name}</strong></span>
            )}
            {filterStatus !== 'all' && (
              <span> • {getText('Status:', 'Status:')} <strong>{filterStatus === 'active' ? getText('Active', 'Aktif') : getText('Inactive', 'Tidak Aktif')}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Users Table with Pagination */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('full_name')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('User', 'Pengguna')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('role')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('Role', 'Peran')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Contact', 'Kontak')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Department', 'Departemen')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('created_at')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('Status', 'Status')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Actions', 'Aksi')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                      <span className="text-gray-600">
                        {getText('Loading users...', 'Memuat pengguna...')}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : currentTableData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">
                        {(searchTerm || filterRole || filterDepartment || filterStatus !== 'all') 
                          ? getText('No users found', 'Tidak ada pengguna ditemukan')
                          : getText('No users available', 'Tidak ada pengguna tersedia')
                        }
                      </p>
                      {(searchTerm || filterRole || filterDepartment || filterStatus !== 'all') && (
                        <div className="space-y-2">
                          <p className="text-sm">
                            {getText('Try adjusting your search or filters', 'Coba sesuaikan pencarian atau filter Anda')}
                          </p>
                          <button
                            onClick={clearFilters}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {getText('Clear all filters', 'Hapus semua filter')}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentTableData.map((user) => {
                  const RoleIcon = getRoleIcon(user.role);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                            <RoleIcon className="h-5 w-5 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-500">@{user.username} • {user.identity_number}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getRoleBadgeColor(user.role)}`}>
                          {getRoleDisplayName(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          {user.email && (
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 text-gray-400 mr-1" />
                              <span>{user.email}</span>
                            </div>
                          )}
                          {!user.email && <span className="text-gray-400">-</span>}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center mt-1">
                          {user.phone_number && (
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 text-gray-400 mr-1" />
                              <span>{user.phone_number}</span>
                            </div>
                          )}
                          {!user.phone_number && <span className="text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <Building className="h-4 w-4 text-gray-400 mr-1" />
                          <span>{user.department?.name || '-'}</span>
                        </div>
                        {user.study_program && (
                          <div className="text-xs text-gray-500 flex items-center mt-1">
                            <School className="h-3 w-3 text-gray-400 mr-1" />
                            <span>{user.study_program.name} ({user.study_program.code})</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            user.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active 
                              ? getText('Active', 'Aktif')
                              : getText('Inactive', 'Tidak Aktif')
                            }
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {getText('Created:', 'Dibuat:')} {format(new Date(user.created_at), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewDetails(user)}
                            className="text-green-600 hover:text-green-900 p-1 rounded transition-colors duration-200"
                            title={getText('View details', 'Lihat detail')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors duration-200"
                            title={getText('Edit user', 'Edit pengguna')}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(user.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-200"
                            title={getText('Delete user', 'Hapus pengguna')}
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
          <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-3 bg-gray-50 border-t border-gray-200 gap-3">
            <div className="text-sm text-gray-600">
              {getText(
                `Showing ${currentTableData.length > 0 ? startIndex + 1 : 0} to ${Math.min(startIndex + itemsPerPage, sortedUsers.length)} of ${sortedUsers.length} entries`,
                `Menampilkan ${currentTableData.length > 0 ? startIndex + 1 : 0} sampai ${Math.min(startIndex + itemsPerPage, sortedUsers.length)} dari ${sortedUsers.length} entri`
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
              >
                {getText('First', 'Pertama')}
              </button>
              
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = Math.max(1, currentPage - 2) + i;
                  if (pageNumber > totalPages) return null;
                  
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        currentPage === pageNumber
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
              >
                {getText('Last', 'Terakhir')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced User Detail Modal */}
      {showUserDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    {React.createElement(getRoleIcon(showUserDetail.role), {
                      className: "h-8 w-8 text-white"
                    })}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{showUserDetail.full_name}</h3>
                    <p className="text-blue-100">@{showUserDetail.username} • {showUserDetail.identity_number}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-white bg-opacity-20 text-white`}>
                        {getRoleDisplayName(showUserDetail.role)}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        showUserDetail.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {showUserDetail.is_active ? getText('Active', 'Aktif') : getText('Inactive', 'Tidak Aktif')}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserDetail(null)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - User Information */}
                <div className="space-y-6">
                  {/* Contact Information */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-blue-600" />
                      {getText('Contact Information', 'Informasi Kontak')}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-500">{getText('Email', 'Email')}</div>
                          <div className="font-medium">{showUserDetail.email || '-'}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-500">{getText('Phone', 'Telepon')}</div>
                          <div className="font-medium">{showUserDetail.phone_number || '-'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <School className="h-5 w-5 mr-2 text-green-600" />
                      {getText('Academic Information', 'Informasi Akademik')}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Building className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-500">{getText('Department', 'Departemen')}</div>
                          <div className="font-medium">{showUserDetail.department?.name || '-'}</div>
                        </div>
                      </div>
                      {showUserDetail.study_program && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <BookOpen className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-500">{getText('Study Program', 'Program Studi')}</div>
                            <div className="font-medium">{showUserDetail.study_program.name} ({showUserDetail.study_program.code})</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Account Information */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <UserCheck className="h-5 w-5 mr-2 text-purple-600" />
                      {getText('Account Information', 'Informasi Akun')}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-500">{getText('Created', 'Dibuat')}</div>
                          <div className="font-medium">{format(new Date(showUserDetail.created_at), 'PPP')}</div>
                        </div>
                      </div>
                      {showUserDetail.last_login && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <Activity className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-500">{getText('Last Login', 'Login Terakhir')}</div>
                            <div className="font-medium">{format(new Date(showUserDetail.last_login), 'PPp')}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Assigned Rooms & Activities */}
                <div className="space-y-6">
                  {/* Assigned Rooms */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <MapPin className="h-5 w-5 mr-2 text-orange-600" />
                      {getText('Assigned Rooms', 'Ruangan yang Ditugaskan')}
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {loadingUserDetails ? (
                        <div className="flex justify-center p-4">
                          <RefreshCw className="h-5 w-5 animate-spin" />
                        </div>
                      ) : userRooms.length > 0 ? (
                        userRooms.map((room) => (
                          <div key={room.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center space-x-3">
                              <div className={`w-3 h-3 rounded-full ${room.is_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <div>
                                <div className="font-medium text-gray-900">{room.name}</div>
                                <div className="text-sm text-gray-500">{room.code} • {room.capacity} {getText('seats', 'kursi')}</div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {getText('Assigned:', 'Ditugaskan:')} {format(new Date(room.assigned_at || ''), 'MMM d')}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-gray-500">
                          <Home className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">{getText('No rooms assigned', 'Tidak ada ruangan yang ditugaskan')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Activities */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-indigo-600" />
                      {getText('Recent Activities', 'Aktivitas Terbaru')}
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {loadingUserDetails ? (
                        <div className="flex justify-center p-4">
                          <RefreshCw className="h-5 w-5 animate-spin" />
                        </div>
                      ) : userActivities.length > 0 ? (
                        userActivities.map((activity) => (
                          <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{activity.description}</div>
                              <div className="text-xs text-gray-500 flex items-center mt-1">
                                <Clock className="h-3 w-3 mr-1" />
                                {format(new Date(activity.timestamp), 'MMM d, HH:mm')}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-gray-500">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">{getText('No recent activities', 'Tidak ada aktivitas terbaru')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t bg-gray-50 px-6 py-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {getText('User ID:', 'ID Pengguna:')} {showUserDetail.id}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowUserDetail(null);
                    handleEdit(showUserDetail);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  <span>{getText('Edit User', 'Edit Pengguna')}</span>
                </button>
                <button
                  onClick={() => setShowUserDetail(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {getText('Close', 'Tutup')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Users className="h-6 w-6" />
                  {editingUser ? getText('Edit User', 'Edit Pengguna') : getText('Add New User', 'Tambah Pengguna Baru')}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    form.reset();
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  disabled={submitting}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900 border-b border-gray-200 pb-2">
                  {getText('Basic Information', 'Informasi Dasar')}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Username Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('Username', 'Nama Pengguna')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...form.register('username')}
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        form.formState.errors.username 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-300'
                      }`}
                      placeholder={getText('Enter username', 'Masukkan username')}
                      disabled={submitting}
                    />
                    {form.formState.errors.username && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.username.message}</p>
                    )}
                  </div>

                  {/* Email Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('Email', 'Email')}
                    </label>
                    <input
                      {...form.register('email')}
                      type="email"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        form.formState.errors.email 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-300'
                      }`}
                      placeholder={getText('Enter email address', 'Masukkan alamat email')}
                      disabled={submitting}
                    />
                    {form.formState.errors.email && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('Full Name', 'Nama Lengkap')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...form.register('full_name')}
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        form.formState.errors.full_name 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-300'
                      }`}
                      placeholder={getText('Enter full name', 'Masukkan nama lengkap')}
                      disabled={submitting}
                    />
                    {form.formState.errors.full_name && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.full_name.message}</p>
                    )}
                  </div>

                  {/* Identity Number Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('Identity Number', 'Nomor Identitas')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...form.register('identity_number')}
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        form.formState.errors.identity_number 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-300'
                      }`}
                      placeholder={getText('NIM/NIP/NIK', 'NIM/NIP/NIK')}
                      disabled={submitting}
                    />
                    {form.formState.errors.identity_number && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.identity_number.message}</p>
                    )}
                  </div>
                </div>

                {/* Phone Number Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Phone Number', 'Nomor Telepon')}
                  </label>
                  <input
                    {...form.register('phone_number')}
                    type="tel"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      form.formState.errors.phone_number 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300'
                    }`}
                    placeholder={getText('Enter phone number', 'Masukkan nomor telepon')}
                    disabled={submitting}
                  />
                  {form.formState.errors.phone_number && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.phone_number.message}</p>
                  )}
                </div>
              </div>

              {/* Role and Organization Section */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900 border-b border-gray-200 pb-2">
                  {getText('Role & Organization', 'Peran & Organisasi')}
                </h4>

                {/* Role Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Role', 'Peran')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...form.register('role')}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      form.formState.errors.role 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300'
                    }`}
                    disabled={submitting}
                  >
                    <option value="student">{getText('Student', 'Mahasiswa')}</option>
                    <option value="lecturer">{getText('Lecturer', 'Dosen')}</option>
                    {profile?.role === 'super_admin' && (
                      <>
                        <option value="department_admin">{getText('Department Admin', 'Admin Departemen')}</option>
                        <option value="super_admin">{getText('Super Admin', 'Super Admin')}</option>
                      </>
                    )}
                  </select>
                  {form.formState.errors.role && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.role.message}</p>
                  )}
                </div>

                {/* Department selection for super admin */}
                {profile?.role === 'super_admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('Department', 'Departemen')}
                      {(watchRole === 'department_admin' || watchRole === 'lecturer') && (
                        <span className="text-red-500"> *</span>
                      )}
                    </label>
                    <SearchableDropdown
                      options={departments.map(dept => ({ 
                        id: dept.id, 
                        name: dept.name,
                        code: dept.code 
                      }))}
                      value={form.watch('department_id') || ''}
                      onChange={(value) => {
                        form.setValue('department_id', value);
                        form.setValue('study_program_id', '');
                      }}
                      placeholder={getText('Select Department', 'Pilih Departemen')}
                      searchPlaceholder={getText('Search departments...', 'Cari departemen...')}
                      emptyMessage={getText('No departments found', 'Tidak ada departemen ditemukan')}
                      required={watchRole === 'department_admin' || watchRole === 'lecturer'}
                      error={form.formState.errors.department_id?.message}
                      disabled={submitting}
                    />
                  </div>
                )}

                {/* Department display for department admin */}
                {profile?.role === 'department_admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('Department', 'Departemen')}
                    </label>
                    <input
                      type="text"
                      value={departments.find(d => d.id === profile.department_id)?.name || getText('Loading...', 'Memuat...')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                      disabled
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {getText('Department is automatically set based on your role', 'Departemen diatur otomatis berdasarkan peran Anda')}
                    </p>
                  </div>
                )}

                {/* Study program selection */}
                {((profile?.role === 'super_admin' && watchDepartmentId) || profile?.role === 'department_admin') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('Study Program', 'Program Studi')}
                      {watchRole === 'student' && (
                        <span className="text-red-500"> *</span>
                      )}
                    </label>
                    <SearchableDropdown
                      options={studyPrograms.map(program => ({ 
                        id: program.id, 
                        name: program.name, 
                        code: program.code 
                      }))}
                      value={form.watch('study_program_id') || ''}
                      onChange={(value) => form.setValue('study_program_id', value)}
                      placeholder={getText('Select Study Program', 'Pilih Program Studi')}
                      searchPlaceholder={getText('Search study programs...', 'Cari program studi...')}
                      emptyMessage={getText('No study programs found', 'Tidak ada program studi ditemukan')}
                      required={watchRole === 'student'}
                      error={form.formState.errors.study_program_id?.message}
                      disabled={submitting}
                    />
                  </div>
                )}

                {/* Message for super admin when no department selected */}
                {profile?.role === 'super_admin' && !watchDepartmentId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      💡 {getText('Select a department to see available study programs, or leave empty for general users', 'Pilih departemen untuk melihat program studi yang tersedia, atau biarkan kosong untuk pengguna umum')}
                    </p>
                  </div>
                )}
              </div>

              {/* Security Section */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900 border-b border-gray-200 pb-2">
                  {getText('Security', 'Keamanan')}
                </h4>

                {/* Password Field with enhanced component */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Password', 'Kata Sandi')} 
                    {!editingUser && <span className="text-red-500"> *</span>}
                    {editingUser && (
                      <span className="text-gray-500 text-sm ml-1">
                        {getText('(leave blank to keep current)', '(biarkan kosong untuk mempertahankan yang sekarang)')}
                      </span>
                    )}
                  </label>
                  <PasswordInput
                    value={form.watch('password') || ''}
                    onChange={(value) => form.setValue('password', value)}
                    placeholder={editingUser 
                      ? getText('Leave blank to keep current password', 'Biarkan kosong untuk mempertahankan password saat ini') 
                      : getText('Enter password', 'Masukkan password')
                    }
                    error={form.formState.errors.password?.message}
                    required={!editingUser}
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    form.reset();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  disabled={submitting}
                >
                  {getText('Cancel', 'Batal')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !form.formState.isValid}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center justify-center"
                >
                  {submitting && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                  {submitting 
                    ? getText('Saving...', 'Menyimpan...') 
                    : editingUser 
                      ? getText('Update User', 'Perbarui Pengguna') 
                      : getText('Create User', 'Buat Pengguna')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {getText('Delete User', 'Hapus Pengguna')}
                </h3>
              </div>
            </div>
            
            {(() => {
              const userToDelete = users.find(u => u.id === showDeleteConfirm);
              return (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-4">
                    {getText('Are you sure you want to delete this user? This action cannot be undone.', 'Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.')}
                  </p>
                  {userToDelete && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900">{userToDelete.full_name}</p>
                      <p className="text-sm text-gray-500">@{userToDelete.username} • {userToDelete.identity_number}</p>
                      <p className="text-sm text-gray-500">{getRoleDisplayName(userToDelete.role)}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                disabled={submitting}
              >
                {getText('Cancel', 'Batal')}
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors duration-200 flex items-center justify-center"
              >
                {submitting && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                {submitting ? getText('Deleting...', 'Menghapus...') : getText('Delete', 'Hapus')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;