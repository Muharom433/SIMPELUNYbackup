import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  GraduationCap,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Building,
  Users,
  Calendar,
  RefreshCw,
  X,
  AlertCircle,
  Filter,
  BookOpen,
  Award,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { StudyProgram, Department } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const studyProgramSchema = z.object({
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  code: z.string().min(2, 'Program code must be at least 2 characters').max(10, 'Program code must be at most 10 characters'),
  department_id: z.string().min(1, 'Please select a department'),
});

type StudyProgramForm = z.infer<typeof studyProgramSchema>;

interface StudyProgramWithDepartment extends StudyProgram {
  department?: Department;
  student_count?: number;
}

const StudyProgramManagement: React.FC = () => {
  const { profile } = useAuth();
  const [studyPrograms, setStudyPrograms] = useState<StudyProgramWithDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<StudyProgramWithDepartment | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedProgram, setSelectedProgram] = useState<StudyProgramWithDepartment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const form = useForm<StudyProgramForm>({
    resolver: zodResolver(studyProgramSchema),
  });

  useEffect(() => {
    fetchStudyPrograms();
    fetchDepartments();
  }, []);

  const fetchStudyPrograms = async () => {
    try {
      setLoading(true);
      
      // Fetch study programs with department info
      const { data: programsData, error: programsError } = await supabase
        .from('study_programs')
        .select(`
          *,
          department:departments(*)
        `)
        .order('created_at', { ascending: false });

      if (programsError) throw programsError;

      // Fetch student counts for each program
      const { data: userCounts, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('role', 'student');

      if (userError) throw userError;

      // For now, we'll simulate student counts since we don't have a direct relationship
      // In a real app, you'd have a student_program table or similar
      const programsWithStats = (programsData || []).map(program => ({
        ...program,
        student_count: Math.floor(Math.random() * 100) + 10, // Simulated data
      }));

      setStudyPrograms(programsWithStats);
    } catch (error) {
      console.error('Error fetching study programs:', error);
      toast.error('Failed to load study programs');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const handleSubmit = async (data: StudyProgramForm) => {
    try {
      setLoading(true);

      if (editingProgram) {
        // Update existing study program
        const { error } = await supabase
          .from('study_programs')
          .update({
            name: data.name,
            code: data.code.toUpperCase(),
            department_id: data.department_id,
          })
          .eq('id', editingProgram.id);

        if (error) throw error;
        toast.success('Study program updated successfully');
      } else {
        // Create new study program
        const { error } = await supabase
          .from('study_programs')
          .insert({
            name: data.name,
            code: data.code.toUpperCase(),
            department_id: data.department_id,
          });

        if (error) throw error;
        toast.success('Study program created successfully');
      }

      setShowModal(false);
      setEditingProgram(null);
      form.reset();
      fetchStudyPrograms();
    } catch (error: any) {
      console.error('Error saving study program:', error);
      if (error.code === '23505') {
        toast.error('Study program code already exists');
      } else {
        toast.error(error.message || 'Failed to save study program');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (program: StudyProgramWithDepartment) => {
    setEditingProgram(program);
    form.reset({
      name: program.name,
      code: program.code,
      department_id: program.department_id,
    });
    setShowModal(true);
  };

  const handleDelete = async (programId: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('study_programs')
        .delete()
        .eq('id', programId);

      if (error) throw error;
      toast.success('Study program deleted successfully');
      setShowDeleteConfirm(null);
      fetchStudyPrograms();
    } catch (error: any) {
      console.error('Error deleting study program:', error);
      toast.error(error.message || 'Failed to delete study program');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (program: StudyProgramWithDepartment) => {
    setSelectedProgram(program);
    setShowDetailModal(true);
  };

  const filteredPrograms = studyPrograms.filter(program => {
    const matchesSearch = 
      program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      program.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      program.department?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = departmentFilter === 'all' || program.department_id === departmentFilter;
    
    return matchesSearch && matchesDepartment;
  });

  // Check permissions
  const canManage = profile?.role === 'super_admin' || 
    (profile?.role === 'department_admin' && profile.department_id);

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to access study program management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <GraduationCap className="h-8 w-8" />
              <span>Study Program Management</span>
            </h1>
            <p className="mt-2 opacity-90">
              Manage academic study programs and curricula
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{studyPrograms.length}</div>
            <div className="text-sm opacity-80">Total Programs</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search study programs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>

              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 text-sm font-medium ${
                    viewMode === 'grid'
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-4 py-2 text-sm font-medium ${
                    viewMode === 'table'
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchStudyPrograms()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
            >
              <RefreshCw className="h-5 w-5" />
            </button>

            <button
              onClick={() => {
                setEditingProgram(null);
                form.reset();
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <Plus className="h-4 w-4" />
              <span>Add Program</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center">
            <RefreshCw className="h-6 w-6 animate-spin text-green-600 mr-2" />
            <span className="text-gray-600">Loading study programs...</span>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrograms.map((program) => (
            <div
              key={program.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{program.name}</h3>
                    <p className="text-sm text-gray-500">{program.code}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleViewDetails(program)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(program)}
                    className="p-1 text-blue-600 hover:text-blue-800 transition-colors duration-200"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(program.id)}
                    className="p-1 text-red-600 hover:text-red-800 transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Building className="h-4 w-4 mr-1" />
                  {program.department?.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{program.student_count}</div>
                  <div className="text-xs text-gray-500">Students</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">4</div>
                  <div className="text-xs text-gray-500">Years</div>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Created {format(new Date(program.created_at), 'MMM d, yyyy')}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPrograms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No study programs found</p>
                        <p>Try adjusting your search or create a new program</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPrograms.map((program) => (
                    <tr key={program.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{program.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {program.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Building className="h-4 w-4 text-gray-400 mr-1" />
                          {program.department?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-gray-400 mr-1" />
                          {program.student_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(program.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewDetails(program)}
                            className="text-gray-600 hover:text-gray-900 p-1 rounded transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(program)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors duration-200"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(program.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Study Program Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingProgram ? 'Edit Study Program' : 'Add New Study Program'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingProgram(null);
                    form.reset();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Program Name *
                  </label>
                  <input
                    {...form.register('name')}
                    type="text"
                    placeholder="e.g., Computer Science"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  {form.formState.errors.name && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Program Code *
                  </label>
                  <input
                    {...form.register('code')}
                    type="text"
                    placeholder="e.g., CS"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  {form.formState.errors.code && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department *
                  </label>
                  <select
                    {...form.register('department_id')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Select Department</option>
                    {departments
                      .filter(dept => 
                        profile?.role === 'super_admin' || 
                        dept.id === profile?.department_id
                      )
                      .map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                  </select>
                  {form.formState.errors.department_id && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.department_id.message}
                    </p>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingProgram(null);
                      form.reset();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {loading ? 'Saving...' : editingProgram ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Study Program Details Modal */}
      {showDetailModal && selectedProgram && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Study Program Details</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">{selectedProgram.name}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Code:</span>
                      <span className="ml-2 font-medium">{selectedProgram.code}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Department:</span>
                      <span className="ml-2">{selectedProgram.department?.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <span className="ml-2">{format(new Date(selectedProgram.created_at), 'MMM d, yyyy')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Students:</span>
                      <span className="ml-2 font-medium">{selectedProgram.student_count}</span>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">{selectedProgram.student_count}</div>
                    <div className="text-sm text-gray-600">Active Students</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <Award className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">4</div>
                    <div className="text-sm text-gray-600">Years Duration</div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-2">Program Information</h5>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>• Bachelor's degree program</p>
                    <p>• 144 credit hours required</p>
                    <p>• Accredited by National Accreditation Board</p>
                    <p>• Career opportunities in technology sector</p>
                  </div>
                </div>
              </div>
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
                <h3 className="text-lg font-medium text-gray-900">Delete Study Program</h3>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this study program? This action cannot be undone and will affect all associated students.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyProgramManagement;