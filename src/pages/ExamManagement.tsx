import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  UserPlus,
  Shield,
  Building,
  Mail,
  Phone,
  Calendar,
  MoreVertical,
  Download,
  Upload,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  User,
  Lock,
  GraduationCap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { User as UserType, Department } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// --- UPDATED: Schema to allow all roles and conditional validation ---
const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  role: z.enum(['super_admin', 'department_admin', 'lecturer']),
  department_id: z.string().optional().nullable(),
  study_program_id: z.string().optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
}).superRefine((data, ctx) => {
    // If the role is lecturer, study_program_id becomes required.
    if (data.role === 'lecturer' && !data.study_program_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['study_program_id'],
            message: 'Study Program is required for lecturers.',
        });
    }
});

type UserForm = z.infer<typeof userSchema>;

interface UserWithDepartment extends UserType {
  department?: Department;
}

const UserManagement: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserWithDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithDepartment | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: 'lecturer',
      department_id: '',
      study_program_id: '',
    },
  });

  const watchRole = form.watch('role');
  const watchDepartmentId = form.watch('department_id');

  useEffect(() => {
    if (profile) {
        fetchUsers();
        fetchDepartments();
    }
  }, [profile]);

  useEffect(() => {
    if(watchDepartmentId) {
        fetchStudyPrograms(watchDepartmentId);
    } else {
        setStudyPrograms([]);
    }
  }, [watchDepartmentId]);

  // --- UPDATED: fetchUsers logic is now role-dependent ---
  const fetchUsers = async () => {
    try {
      setLoading(true);
      let query = supabase.from('users').select(`*, department:departments(*)`);
      
      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('role', 'lecturer').eq('department_id', profile.department_id);
      }
      
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase.from('departments').select('id, name');
      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const fetchStudyPrograms = async (departmentId: string) => {
    try {
        let query = supabase.from('study_programs').select('*').eq('department_id', departmentId);
        const { data, error } = await query;
        if (error) throw error;
        setStudyPrograms(data || []);
    } catch (error: any) {
        console.error('Error fetching study programs:', error);
        toast.error('Failed to load study programs');
    }
  };

  const handleSubmit = async (data: UserForm) => {
    try {
      setLoading(true);

      if (profile?.role === 'department_admin' && profile.department_id) {
        data.department_id = profile.department_id;
        data.role = 'lecturer';
      }

      const userData = {
        username: data.username,
        email: data.email,
        full_name: data.full_name,
        identity_number: data.identity_number,
        role: data.role,
        department_id: (data.role === 'lecturer' || data.role === 'department_admin') ? data.department_id : null,
        study_program_id: data.role === 'lecturer' ? data.study_program_id : null, 
      };

      if (editingUser) {
        const updateData: any = { ...userData };
        if (data.password) {
          updateData.password = data.password;
        }
        const { error } = await supabase.from('users').update(updateData).eq('id', editingUser.id);
        if (error) throw error;
        toast.success('User updated successfully');
      } else {
        if (!data.password) {
            toast.error("Password is required for new users.");
            setLoading(false);
            return;
        }
        const { error } = await supabase.from('users').insert([{ ...userData, password: data.password }]);
        if (error) throw error;
        toast.success('User created successfully');
      }

      setShowModal(false);
      setEditingUser(null);
      form.reset({ role: 'lecturer', department_id: '', study_program_id: '' });
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };
  
  const handleEdit = (user: UserWithDepartment) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      identity_number: user.identity_number,
      role: user.role as 'lecturer' | 'department_admin' | 'super_admin',
      department_id: user.department_id || '',
      study_program_id: user.study_program_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (userId: string) => { try { setLoading(true); const { error } = await supabase.from('users').delete().eq('id', userId); if (error) throw error; toast.success('User deleted successfully'); setShowDeleteConfirm(null); fetchUsers(); } catch (error: any) { console.error('Error deleting user:', error); toast.error(error.message || 'Failed to delete user'); } finally { setLoading(false); } };
  const filteredUsers = users.filter(user => { const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || user.username.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase()) || user.identity_number.toLowerCase().includes(searchTerm.toLowerCase()); const matchesDepartment = departmentFilter === 'all' || user.department_id === departmentFilter; return matchesSearch && matchesDepartment; });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return Shield;
      case 'department_admin': return Building;
      case 'lecturer': return GraduationCap;
      default: return User;
    }
  };

  if (!profile || (profile.role !== 'super_admin' && profile.role !== 'department_admin')) {
    return ( <div className="flex items-center justify-center h-64"> <div className="text-center"> <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" /> <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3> <p className="text-gray-600">You do not have permission to access this page.</p> </div> </div> );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white"> <div className="flex items-center justify-between"> <div> <h1 className="text-3xl font-bold flex items-center space-x-3"> <Users className="h-8 w-8" /> <span>{profile?.role === 'super_admin' ? 'User Management' : 'Lecturer Management'}</span> </h1> <p className="mt-2 opacity-90"> Manage system users and their roles </p> </div> <div className="hidden md:block text-right"> <div className="text-2xl font-bold">{users.length}</div> <div className="text-sm opacity-80">Total Users</div> </div> </div> </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"> <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"> <div className="flex flex-col sm:flex-row gap-4 flex-1"> <div className="relative flex-1 max-w-md"> <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /> <input type="text" placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /> </div> {profile?.role === 'super_admin' && ( <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" > <option value="all">All Departments</option> {departments.map((dept) => ( <option key={dept.id} value={dept.id}> {dept.name} </option> ))} </select> )} </div> <div className="flex items-center space-x-2"> <button onClick={() => fetchUsers()} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" > <RefreshCw className="h-5 w-5" /> </button> <button onClick={() => { setEditingUser(null); form.reset({ role: 'lecturer', department_id: profile?.role === 'department_admin' ? profile.department_id : '' }); setShowModal(true); }} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" > <UserPlus className="h-4 w-4" /> <span>{profile?.role === 'super_admin' ? 'Add User' : 'Add Lecturer'}</span> </button> </div> </div> </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"> <div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50 border-b border-gray-200"> <tr> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> User </th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Role </th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Department </th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Created </th> <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"> Actions </th> </tr> </thead> <tbody className="bg-white divide-y divide-gray-200"> {loading ? ( <tr> <td colSpan={5} className="px-6 py-12 text-center"> <div className="flex items-center justify-center"> <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" /> <span className="text-gray-600">Loading users...</span> </div> </td> </tr> ) : filteredUsers.length === 0 ? ( <tr> <td colSpan={5} className="px-6 py-12 text-center"> <div className="text-gray-500"> <Users className="h-12 w-12 mx-auto mb-4 opacity-50" /> <p className="text-lg font-medium mb-2">No users found</p> </div> </td> </tr> ) : ( filteredUsers.map((user) => { const RoleIcon = getRoleIcon(user.role); return ( <tr key={user.id} className="hover:bg-gray-50"><td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center"><RoleIcon className="h-5 w-5 text-white" /></div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{user.full_name}</div><div className="text-sm text-gray-500">@{user.username}</div></div></div></td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.role.replace('_', ' ')}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.department?.name || 'N/A'}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{format(new Date(user.created_at), 'MMM d, yyyy')}</td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><div className="flex items-center justify-end space-x-2"><button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors"><Edit className="h-4 w-4" /></button><button onClick={() => setShowDeleteConfirm(user.id)} className="text-red-600 hover:text-red-900 p-1 rounded transition-colors"><Trash2 className="h-4 w-4" /></button></div></td></tr> ); }) )} </tbody> </table> </div> </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                <button onClick={() => { setShowModal(false); setEditingUser(null); form.reset(); }} className="text-gray-400 hover:text-gray-600 transition-colors" > <X className="h-6 w-6" /> </button>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Username *</label><input {...form.register('username')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />{form.formState.errors.username && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.username.message}</p>)}</div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input {...form.register('email')} type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />{form.formState.errors.email && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>)}</div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label><input {...form.register('full_name')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />{form.formState.errors.full_name && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.full_name.message}</p>)}</div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Identity Number *</label><input {...form.register('identity_number')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />{form.formState.errors.identity_number && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.identity_number.message}</p>)}</div>
                
                {profile?.role === 'super_admin' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                        <select {...form.register('role')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="lecturer">Lecturer</option>
                            <option value="department_admin">Department Admin</option>
                            <option value="super_admin">Super Admin</option>
                        </select>
                    </div>
                )}
                
                {profile?.role === 'department_admin' && <input type="hidden" {...form.register('role')} value="lecturer" />}
                
                {(watchRole === 'lecturer' || watchRole === 'department_admin') && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <select {...form.register('department_id')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Select Department</option>
                            {departments.map((dept) => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
                        </select>
                    </div>
                )}

                {watchRole === 'lecturer' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Study Program *</label>
                        <select {...form.register('study_program_id')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={!watchDepartmentId}>
                            <option value="">Select Study Program</option>
                            {studyPrograms.map((program) => (<option key={program.id} value={program.id}>{program.name} ({program.code})</option>))}
                        </select>
                        {form.formState.errors.study_program_id && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.study_program_id.message}</p>)}
                    </div>
                )}

                <div><label className="block text-sm font-medium text-gray-700 mb-1">Password {editingUser ? '(leave blank to keep current)' : '*'}</label><input {...form.register('password')} type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />{form.formState.errors.password && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.password.message}</p>)}</div>
                <div className="flex space-x-3 pt-4"><button type="button" onClick={() => { setShowModal(false); setEditingUser(null); form.reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Saving...' : editingUser ? 'Update' : 'Create'}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"> <div className="flex items-center mb-4"> <div className="flex-shrink-0"> <AlertCircle className="h-6 w-6 text-red-600" /> </div> <div className="ml-3"> <h3 className="text-lg font-medium text-gray-900">Delete User</h3> </div> </div> <p className="text-sm text-gray-500 mb-6"> Are you sure you want to delete this user? This action cannot be undone. </p> <div className="flex space-x-3"> <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50" > Cancel </button> <button onClick={() => handleDelete(showDeleteConfirm)} disabled={loading} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50" > {loading ? 'Deleting...' : 'Delete'} </button> </div> </div> </div> )}
    </div>
  );
};

export default UserManagement;
