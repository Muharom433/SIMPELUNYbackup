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
  Home,
  Clock,
  GraduationCap,
  MapPin,
  Activity, // Ensure Activity is imported for the icon
  Eye, // Added Eye icon for PasswordInput
  EyeOff // Added EyeOff icon for PasswordInput
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast'; // Menggunakan toast kembali
import { format } from 'date-fns';

// Simplified schema - no complex validation
const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  full_name: z.string().min(2, 'Full name is required'),
  identity_number: z.string().min(1, 'Identity number is required'),
  phone_number: z.string().optional().or(z.literal('')),
  role: z.enum(['super_admin', 'department_admin', 'lecturer', 'student']),
  department_id: z.string().optional().nullable(),
  study_program_id: z.string().optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

type UserForm = z.infer<typeof userSchema>;

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
  updated_at?: string; // Added updated_at from the provided code
  department?: { id: string; name: string; code?: string; }; // Changed to include code for consistency
  study_program?: { id: string; name: string; code: string; };
}

interface Department {
  id: string;
  name: string;
  code?: string; // Added code for consistency
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
}

interface ActivityItem { // Renamed to avoid conflict with lucide-react Activity icon
  id: string;
  description: string;
  timestamp: string;
  room_name?: string;
}

// Searchable Dropdown Component - Moved outside to avoid re-creation
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

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between ${
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
            {value && (
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

// Password Input with toggle
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
        className={`w-full px-3 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
        required={required}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
      >
        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};


const UserManagement: React.FC = () => {
  // Semua Hooks diletakkan di bagian paling atas komponen, tanpa kondisi.
  const { profile } = useAuth();
  const { getText } = useLanguage();
  
  // State hooks
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
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [userActivities, setUserActivities] = useState<ActivityItem[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1); // Added currentPage state

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
      department_id: '',
      study_program_id: '',
      password: '',
    },
  });

  // Form watch hooks
  const watchRole = form.watch('role');
  const watchDepartmentId = form.watch('department_id');

  // Helper functions - menggunakan useCallback untuk performance
  const getRoleIcon = useCallback((role: string) => {
    switch (role) {
      case 'super_admin': return Shield;
      case 'department_admin': return Building;
      case 'lecturer': return GraduationCap;
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
      case 'super_admin': return 'bg-red-100 text-red-800';
      case 'department_admin': return 'bg-blue-100 text-blue-800';
      case 'lecturer': return 'bg-purple-100 text-purple-800';
      case 'student': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  // API functions
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('users').select(`
        *,
        department:departments(id, name, code),
        study_program:study_programs(id, name, code)
      `);
      
      if (profile?.role === 'super_admin') {
        // Super admin sees all users
      } else if (profile?.role === 'department_admin' && profile.department_id) {
        // Department admin sees only users in their department
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
      } else if (profile?.role === 'super_admin') {
        // Super admin should fetch all study programs initially if no department is selected
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
        .select('*')
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

  const fetchUserDetails = useCallback(async (userId: string) => {
    setLoadingUserDetails(true);
    try {
      // Fetch assigned rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('room_users')
        .select(`
          assigned_at,
          room:rooms(id, name, code, capacity)
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
          created_at,
          room:rooms(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!bookingsError && bookingsData) {
        const activities = bookingsData.map(booking => ({
          id: booking.id,
          description: `${getText('Booked', 'Memesan')} ${booking.room?.name} - ${booking.purpose}`,
          timestamp: booking.created_at,
          room_name: booking.room?.name
        }));
        setUserActivities(activities);
      }

    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoadingUserDetails(false);
    }
  }, [getText]);


  // useEffect hooks - semua diletakkan berurutan
  useEffect(() => {
    if (profile) {
      fetchUsers();
      fetchDepartments();
      fetchStudyPrograms();
    }
  }, [profile, fetchUsers, fetchDepartments, fetchStudyPrograms]);

  useEffect(() => {
    if (watchDepartmentId) {
      fetchStudyProgramsByDepartment(watchDepartmentId);
    } else if (profile?.role === 'super_admin') {
      setStudyPrograms([]); // Clear study programs if no department is selected for super admin
      form.setValue('study_program_id', '');
    }
  }, [watchDepartmentId, profile, fetchStudyProgramsByDepartment, form]);

  useEffect(() => {
    if (showUserDetail) {
      fetchUserDetails(showUserDetail.id);
    }
  }, [showUserDetail, fetchUserDetails]);

  // useMemo hooks - Dipindahkan ke atas sebelum early returns
  const filteredUsers = useMemo(() => {
    if (!users || users.length === 0) return [];
    
    return users.filter(user => {
      const searchLower = searchTerm.toLowerCase().trim();
      
      if (!searchLower) {
        return true;
      }
      
      const matchesSearch = 
        (user.full_name?.toLowerCase() || '').includes(searchLower) ||
        (user.username?.toLowerCase() || '').includes(searchLower) ||
        (user.email?.toLowerCase() || '').includes(searchLower) ||
        (user.identity_number?.toLowerCase() || '').includes(searchLower) ||
        (user.phone_number?.toLowerCase() || '').includes(searchLower) ||
        (user.role?.toLowerCase() || '').includes(searchLower) ||
        (user.department?.name?.toLowerCase() || '').includes(searchLower) ||
        (user.study_program?.name?.toLowerCase() || '').includes(searchLower) ||
        (user.study_program?.code?.toLowerCase() || '').includes(searchLower);
      
      return matchesSearch;
    });
  }, [users, searchTerm]);

  // Pagination (re-added for table display)
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTableData = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  // Access control check moved AFTER all hooks are declared
  const hasAccess = profile && ['super_admin', 'department_admin'].includes(profile.role);

  const handleSubmit = async (data: UserForm) => {
    try {
      setSubmitting(true);

      if (profile?.role === 'department_admin' && profile.department_id) {
        data.department_id = profile.department_id;
        // Department admin can only create lecturer or student roles
        if (!['lecturer', 'student'].includes(data.role)) {
          data.role = 'student'; // Default to student if an invalid role is selected
        }
      }

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
        const updateData: any = { ...userData };
        if (data.password?.trim()) { // Only update password if provided
          updateData.password = data.password.trim();
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);
        
        if (error) throw error;
        toast.success(getText('User updated successfully', 'Pengguna berhasil diperbarui'));
      } else {
        if (!data.password?.trim()) { // Password is required for new users
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
      form.reset({ role: 'student' }); // Reset form and default role
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      if (error.code === '23505') { // Unique constraint violation
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
      department_id: user.department_id || '', // Ensure it's an empty string for dropdown
      study_program_id: user.study_program_id || '', // Ensure it's an empty string for dropdown
      password: '', // Password should always be empty when editing
    });
    
    if (user.department_id) {
      fetchStudyProgramsByDepartment(user.department_id);
    } else if (profile?.role === 'super_admin') {
      setStudyPrograms([]); // Clear study programs if no department for super admin
    }
    
    setShowModal(true);
  }, [form, fetchStudyProgramsByDepartment, profile]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {!hasAccess ? (
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
      ) : (
        <>
          {/* Mobile-First Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="px-4 py-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    {getText('Users', 'Pengguna')}
                  </h1>
                  <p className="text-blue-100 text-sm mt-1">
                    {profile?.role === 'super_admin' 
                      ? getText('Manage all users', 'Kelola semua pengguna')
                      : getText('Manage department users', 'Kelola pengguna departemen')
                    }
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg md:text-xl font-bold">{users.length}</div>
                  <div className="text-xs text-blue-100">{getText('Total', 'Total')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile-First Controls */}
          <div className="p-4 bg-white border-b sticky top-0 z-10">
            <div className="flex gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={getText('Search...', 'Cari...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
              </div>
              
              {/* Add Button */}
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
                    setStudyPrograms([]); // Clear study programs if no department is selected for super admin
                  }
                  setShowModal(true);
                }}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">{getText('Add', 'Tambah')}</span>
              </button>
            </div>

            {/* Search Results Info */}
            {searchTerm && (
              <div className="mt-3 text-sm text-gray-600">
                {filteredUsers.length} {getText('results found', 'hasil ditemukan')}
              </div>
            )}
          </div>

          {/* Mobile-First User List */}
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : currentTableData.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? getText('No users found', 'Tidak ada pengguna') : getText('No users yet', 'Belum ada pengguna')}
                </p>
                <p className="text-gray-600 text-center">
                  {searchTerm 
                    ? getText('Try different search terms', 'Coba kata kunci lain')
                    : getText('Add your first user', 'Tambahkan pengguna pertama')
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentTableData.map((user) => {
                  const RoleIcon = getRoleIcon(user.role);
                  return (
                    <div key={user.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <RoleIcon className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{user.full_name}</h3>
                            <p className="text-sm text-gray-600">@{user.username}</p>
                            <p className="text-sm text-gray-500">{user.identity_number}</p>
                            
                            {/* Role Badge */}
                            <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                              {getRoleDisplayName(user.role)}
                            </span>
                            
                            {/* Department Info */}
                            {user.department && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                <Building className="h-3 w-3" />
                                {user.department.name}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2 ml-2">
                          <button
                            onClick={() => setShowUserDetail(user)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title={getText('View details', 'Lihat detail')}
                          >
                            <Activity className="h-4 w-4" /> {/* Changed to Activity icon for view details as per original UI */}
                          </button>
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={getText('Edit', 'Edit')}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={getText('Delete', 'Hapus')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6 px-2">
                <button
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {getText('Previous', 'Sebelum')}
                </button>
                
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {getText('Next', 'Selanjutnya')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {/* Mobile-Optimized User Detail Modal */}
          {showUserDetail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
              <div className="bg-white w-full max-w-lg mx-4 rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        {React.createElement(getRoleIcon(showUserDetail.role), {
                          className: "h-6 w-6 text-white"
                        })}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{showUserDetail.full_name}</h3>
                        <p className="text-blue-100 text-sm">@{showUserDetail.username}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUserDetail(null)}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[70vh] overflow-y-auto space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      {getText('Basic Information', 'Informasi Dasar')}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">{getText('ID Number', 'No. Identitas')}</span>
                        <span className="font-medium">{showUserDetail.identity_number}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">{getText('Role', 'Peran')}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(showUserDetail.role)}`}>
                          {getRoleDisplayName(showUserDetail.role)}
                        </span>
                      </div>
                      {showUserDetail.email && (
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600">{getText('Email', 'Email')}</span>
                          <span className="font-medium text-sm">{showUserDetail.email}</span>
                        </div>
                      )}
                      {showUserDetail.phone_number && (
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600">{getText('Phone', 'Telepon')}</span>
                          <span className="font-medium">{showUserDetail.phone_number}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">{getText('Created', 'Dibuat')}</span>
                        <span className="font-medium text-sm">{format(new Date(showUserDetail.created_at), 'dd MMM yyyy')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Academic Info */}
                  {showUserDetail.department && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Building className="h-4 w-4 text-green-600" />
                        {getText('Academic Info', 'Info Akademik')}
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-gray-600">{getText('Department', 'Departemen')}</span>
                          <span className="font-medium text-sm">{showUserDetail.department.name}</span>
                        </div>
                        {showUserDetail.study_program && (
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">{getText('Study Program', 'Program Studi')}</span>
                            <span className="font-medium text-sm">{showUserDetail.study_program.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Assigned Rooms - HANYA RUANGAN */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-orange-600" />
                      {getText('Assigned Rooms', 'Ruangan yang Ditugaskan')}
                    </h4>
                    {loadingUserDetails ? (
                      <div className="flex justify-center py-6">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      </div>
                    ) : userRooms.length > 0 ? (
                      <div className="space-y-2">
                        {userRooms.map((room) => (
                          <div key={room.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">{room.name}</div>
                              <div className="text-sm text-gray-500">{room.code} • {room.capacity} {getText('seats', 'kursi')}</div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(new Date(room.assigned_at || ''), 'dd MMM')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <Home className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{getText('No rooms assigned', 'Tidak ada ruangan')}</p>
                      </div>
                    )}
                  </div>

                  {/* Recent Activities */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-indigo-600" />
                      {getText('Recent Activities', 'Aktivitas Terbaru')}
                    </h4>
                    {loadingUserDetails ? (
                      <div className="flex justify-center py-6">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      </div>
                    ) : userActivities.length > 0 ? (
                      <div className="space-y-2">
                        {userActivities.map((activity) => (
                          <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{activity.description}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(activity.timestamp), 'dd MMM, HH:mm')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{getText('No recent activities', 'Tidak ada aktivitas')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t bg-gray-50 p-4 flex gap-3">
                  <button
                    onClick={() => {
                      setShowUserDetail(null);
                      handleEdit(showUserDetail);
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {getText('Edit User', 'Edit Pengguna')}
                  </button>
                  <button
                    onClick={() => setShowUserDetail(null)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {getText('Close', 'Tutup')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile-Optimized Add/Edit Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
              <div className="bg-white w-full max-w-lg mx-4 rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">
                      {editingUser ? getText('Edit User', 'Edit Pengguna') : getText('Add User', 'Tambah Pengguna')}
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
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                
                <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
                  {/* Basic Information */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Full Name', 'Nama Lengkap')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...form.register('full_name')}
                      type="text"
                      className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
                        form.formState.errors.full_name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder={getText('Enter full name', 'Masukkan nama lengkap')}
                      disabled={submitting}
                    />
                    {form.formState.errors.full_name && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.full_name.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Username', 'Username')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        {...form.register('username')}
                        type="text"
                        className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
                          form.formState.errors.username ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="username"
                        disabled={submitting}
                      />
                      {form.formState.errors.username && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.username.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('ID Number', 'No. Identitas')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        {...form.register('identity_number')}
                        type="text"
                        className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
                          form.formState.errors.identity_number ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="NIM/NIP"
                        disabled={submitting}
                      />
                      {form.formState.errors.identity_number && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.identity_number.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Email', 'Email')}
                      </label>
                      <input
                        {...form.register('email')}
                        type="email"
                        className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
                          form.formState.errors.email ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="user@email.com"
                        disabled={submitting}
                      />
                      {form.formState.errors.email && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Phone', 'Telepon')}
                      </label>
                      <input
                        {...form.register('phone_number')}
                        type="tel"
                        className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base ${
                          form.formState.errors.phone_number ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="08xxxxxxxxxx"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Role', 'Peran')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...form.register('role')}
                      className="w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
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

                  {/* Department selection - show for super admin */}
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
                        }}
                        placeholder={getText('Select Department (Optional)', 'Pilih Departemen (Opsional)')}
                        searchPlaceholder={getText('Search departments...', 'Cari departemen...')}
                        emptyMessage={getText('No departments found', 'Tidak ada departemen ditemukan')}
                        disabled={submitting}
                      />
                      {form.formState.errors.department_id && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.department_id.message}</p>
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
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-gray-100 text-base"
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
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.study_program_id.message}</p>
                      )}
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

                  {/* Password Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Password', 'Kata Sandi')} 
                      {!editingUser && <span className="text-red-500"> *</span>}
                      {editingUser && (
                        <span className="text-gray-500 text-sm ml-1">
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
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setEditingUser(null);
                        form.reset();
                      }}
                      className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      disabled={submitting}
                    >
                      {getText('Cancel', 'Batal')}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      {submitting 
                        ? getText('Saving...', 'Menyimpan...') 
                        : editingUser 
                          ? getText('Update', 'Perbarui') 
                          : getText('Create', 'Buat')
                      }
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Mobile-Optimized Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
              <div className="bg-white w-full max-w-sm mx-4 rounded-t-2xl sm:rounded-2xl p-6">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {getText('Delete User?', 'Hapus Pengguna?')}
                  </h3>
                  <p className="text-gray-600 text-sm mb-6">
                    {getText('This action cannot be undone', 'Tindakan ini tidak dapat dibatalkan')}
                  </p>
                  
                  {(() => {
                    const userToDelete = users.find(u => u.id === showDeleteConfirm);
                    return userToDelete && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-6">
                        <p className="font-medium text-gray-900">{userToDelete.full_name}</p>
                        <p className="text-sm text-gray-500">@{userToDelete.username}</p>
                      </div>
                    );
                  })()}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      disabled={submitting}
                    >
                      {getText('Cancel', 'Batal')}
                    </button>
                    <button
                      onClick={() => handleDelete(showDeleteConfirm)}
                      disabled={submitting}
                      className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      {submitting ? getText('Deleting...', 'Menghapus...') : getText('Delete', 'Hapus')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserManagement;
