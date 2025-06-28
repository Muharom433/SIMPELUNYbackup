import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { alert } from '../components/Alert/AlertHelper';
import { format } from 'date-fns';

// User schema for form validation
const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().optional(),
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
  updated_at: string;
}

interface Department {
  id: string;
  name: string;
}

interface StudyProgram {
  id: string;
  name: string;
  code: string;
  department_id: string;
}

// Searchable Dropdown Component
interface SearchableDropdownProps {
  options: { id: string; name: string; code?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
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

  const selectedOption = options.find(option => option.id === value);
  
  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.code && option.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
                className="w-full pl-8 pr-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
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
                {emptyMessage}
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
};

const UserManagement: React.FC = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'student',
    },
  });

  const watchRole = form.watch('role');
  const watchDepartmentId = form.watch('department_id');

  useEffect(() => {
    if (profile) {
      fetchUsers();
      fetchDepartments();
      fetchStudyPrograms();
    }
  }, [profile]);

  // Fetch study programs when department changes
  useEffect(() => {
    if (watchDepartmentId) {
      fetchStudyProgramsByDepartment(watchDepartmentId);
    } else if (profile?.role === 'super_admin') {
      // Reset study programs when no department selected for super admin
      setStudyPrograms([]);
      form.setValue('study_program_id', '');
    }
  }, [watchDepartmentId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let query = supabase.from('users').select(`
        *,
        department:departments(name),
        study_program:study_programs(name, code)
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
      alert.error(getText('Failed to load users', 'Gagal memuat pengguna'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      let query = supabase.from('departments').select('id, name');
      
      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('id', profile.department_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      alert.error(getText('Failed to load departments', 'Gagal memuat departemen'));
    }
  };

  const fetchStudyPrograms = async () => {
    try {
      let query = supabase.from('study_programs').select('*');
      
      // For department admin, always filter by their department
      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('department_id', profile.department_id);
      }
      // For super admin, don't load all study programs initially
      else if (profile?.role === 'super_admin') {
        return; // Don't load all study programs initially
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setStudyPrograms(data || []);
    } catch (error: any) {
      console.error('Error fetching study programs:', error);
      alert.error(getText('Failed to load study programs', 'Gagal memuat program studi'));
    }
  };

  // Fetch study programs by department
  const fetchStudyProgramsByDepartment = async (departmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('study_programs')
        .select('*')
        .eq('department_id', departmentId);
      
      if (error) throw error;
      setStudyPrograms(data || []);
      
      // Reset study program selection if current selection is not in the new department
      const currentStudyProgramId = form.getValues('study_program_id');
      const isCurrentProgramInDepartment = data?.some(program => program.id === currentStudyProgramId);
      if (!isCurrentProgramInDepartment) {
        form.setValue('study_program_id', '');
      }
    } catch (error: any) {
      console.error('Error fetching study programs by department:', error);
      alert.error(getText('Failed to load study programs', 'Gagal memuat program studi'));
    }
  };

  const handleSubmit = async (data: UserForm) => {
    try {
      setLoading(true);

      // Set department_id for department admin
      if (profile?.role === 'department_admin' && profile.department_id) {
        data.department_id = profile.department_id;
        // Department admin can only create lecturers and students
        if (!['lecturer', 'student'].includes(data.role)) {
          data.role = 'student';
        }
      }

      const userData = {
        username: data.username,
        email: data.email || null,
        full_name: data.full_name,
        identity_number: data.identity_number,
        phone_number: data.phone_number || null,
        role: data.role,
        department_id: data.department_id || null,
        study_program_id: data.study_program_id || null,
      };

      if (editingUser) {
        // Update existing user
        const updateData: any = { ...userData };
        if (data.password) {
          updateData.password = data.password;
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);
        
        if (error) throw error;
        alert.success(getText('User updated successfully', 'Pengguna berhasil diperbarui'));
      } else {
        // Create new user
        if (!data.password) {
          alert.error(getText('Password is required for new users', 'Password diperlukan untuk pengguna baru'));
          return;
        }

        const { error } = await supabase
          .from('users')
          .insert({ ...userData, password: data.password });
        
        if (error) throw error;
        alert.success(getText('User created successfully', 'Pengguna berhasil dibuat'));
      }

      setShowModal(false);
      setEditingUser(null);
      form.reset({ role: 'student' });
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      if (error.code === '23505') {
        if (error.message.includes('username')) {
          alert.error(getText('Username already exists', 'Username sudah ada'));
        } else if (error.message.includes('email')) {
          alert.error(getText('Email already exists', 'Email sudah ada'));
        } else if (error.message.includes('identity_number')) {
          alert.error(getText('Identity number already exists', 'Nomor identitas sudah ada'));
        } else {
          alert.error(getText('User with this information already exists', 'Pengguna dengan informasi ini sudah ada'));
        }
      } else {
        alert.error(error.message || getText('Failed to save user', 'Gagal menyimpan pengguna'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      email: user.email || '',
      full_name: user.full_name,
      identity_number: user.identity_number,
      phone_number: user.phone_number || '',
      role: user.role as any,
      department_id: user.department_id || undefined,
      study_program_id: user.study_program_id || undefined,
    });
    
    // Load study programs for the user's department
    if (user.department_id) {
      fetchStudyProgramsByDepartment(user.department_id);
    }
    
    setShowModal(true);
  };

  const handleDelete = async (userId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      alert.success(getText('User deleted successfully', 'Pengguna berhasil dihapus'));
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert.error(error.message || getText('Failed to delete user', 'Gagal menghapus pengguna'));
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return Shield;
      case 'department_admin': return Building;
      case 'student': return BookOpen;
      default: return User;
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin': return getText('Super Admin', 'Super Admin');
      case 'department_admin': return getText('Department Admin', 'Admin Departemen');
      case 'lecturer': return getText('Lecturer', 'Dosen');
      case 'student': return getText('Student', 'Mahasiswa');
      default: return role;
    }
  };

  // Check if user has permission
  if (!profile || (profile.role !== 'super_admin' && profile.role !== 'department_admin')) {
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
          <p className="text-sm text-gray-500 mt-2">
            {getText('Current role:', 'Peran saat ini:')} {profile?.role || 'undefined'}
          </p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.identity_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.phone_number && user.phone_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Users className="h-8 w-8" />
              <span>{getText('User Management', 'Manajemen Pengguna')}</span>
            </h1>
            <p className="mt-2 opacity-90">
              {getText('Manage system users and their roles', 'Kelola pengguna sistem dan peran mereka')}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-sm opacity-80">
              {getText('Total Users', 'Total Pengguna')}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={getText('Search users...', 'Cari pengguna...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchUsers()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setEditingUser(null);
                form.reset({
                  role: 'student',
                  department_id: profile?.role === 'department_admin' ? profile.department_id : ''
                });
                // Load study programs for department admin
                if (profile?.role === 'department_admin' && profile.department_id) {
                  fetchStudyProgramsByDepartment(profile.department_id);
                } else {
                  setStudyPrograms([]); // Clear study programs for super admin
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
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('User', 'Pengguna')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Role', 'Peran')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Contact', 'Kontak')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Department', 'Departemen')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Created', 'Dibuat')}
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
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">
                        {getText('No users found', 'Tidak ada pengguna ditemukan')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getRoleDisplayName(user.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email || '-'}</div>
                        <div className="text-sm text-gray-500">{user.phone_number || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(user as any).department?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
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
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingUser ? getText('Edit User', 'Edit Pengguna') : getText('Add New User', 'Tambah Pengguna Baru')}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    form.reset();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                {/* Username Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Username', 'Nama Pengguna')} *
                  </label>
                  <input
                    {...form.register('username')}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={getText('Enter email address', 'Masukkan alamat email')}
                  />
                  {form.formState.errors.email && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
                  )}
                </div>

                {/* Full Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Full Name', 'Nama Lengkap')} *
                  </label>
                  <input
                    {...form.register('full_name')}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {form.formState.errors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.full_name.message}</p>
                  )}
                </div>

                {/* Identity Number Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Identity Number', 'Nomor Identitas')} *
                  </label>
                  <input
                    {...form.register('identity_number')}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={getText('NIM/NIP/NIK', 'NIM/NIP/NIK')}
                  />
                  {form.formState.errors.identity_number && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.identity_number.message}</p>
                  )}
                </div>

                {/* Phone Number Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Phone Number', 'Nomor Telepon')}
                  </label>
                  <input
                    {...form.register('phone_number')}
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={getText('Enter phone number', 'Masukkan nomor telepon')}
                  />
                  {form.formState.errors.phone_number && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.phone_number.message}</p>
                  )}
                </div>

                {/* Role Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Role', 'Peran')} *
                  </label>
                  <select
                    {...form.register('role')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                {profile?.role === 'super_admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('Department', 'Departemen')}
                    </label>
                    <SearchableDropdown
                      options={departments.map(dept => ({ id: dept.id, name: dept.name }))}
                      value={form.watch('department_id') || ''}
                      onChange={(value) => {
                        form.setValue('department_id', value);
                        form.setValue('study_program_id', ''); // Reset study program when department changes
                      }}
                      placeholder={getText('Select Department (Optional)', 'Pilih Departemen (Opsional)')}
                      searchPlaceholder={getText('Search departments...', 'Cari departemen...')}
                      emptyMessage={getText('No departments found', 'Tidak ada departemen ditemukan')}
                    />
                    {form.formState.errors.department_id && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.department_id.message}</p>
                    )}
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

                {/* Study program selection - show when department is selected OR for department admin */}
                {((profile?.role === 'super_admin' && watchDepartmentId) || profile?.role === 'department_admin') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('Study Program', 'Program Studi')}
                    </label>
                    <SearchableDropdown
                      options={studyPrograms.map(program => ({ 
                        id: program.id, 
                        name: program.name, 
                        code: program.code 
                      }))}
                      value={form.watch('study_program_id') || ''}
                      onChange={(value) => form.setValue('study_program_id', value)}
                      placeholder={getText('Select Study Program (Optional)', 'Pilih Program Studi (Opsional)')}
                      searchPlaceholder={getText('Search study programs...', 'Cari program studi...')}
                      emptyMessage={getText('No study programs found', 'Tidak ada program studi ditemukan')}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Password', 'Kata Sandi')} {editingUser ? getText('(leave blank to keep current)', '(biarkan kosong untuk mempertahankan yang sekarang)') : '*'}
                  </label>
                  <input
                    {...form.register('password')}
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={editingUser ? getText('Leave blank to keep current password', 'Biarkan kosong untuk mempertahankan password saat ini') : getText('Enter password', 'Masukkan password')}
                  />
                  {form.formState.errors.password && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.password.message}</p>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingUser(null);
                      form.reset();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    {getText('Cancel', 'Batal')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                  >
                    {loading 
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
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
            <p className="text-sm text-gray-500 mb-6">
              {getText('Are you sure you want to delete this user? This action cannot be undone.', 'Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.')}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                {getText('Cancel', 'Batal')}
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
              >
                {loading ? getText('Deleting...', 'Menghapus...') : getText('Delete', 'Hapus')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;