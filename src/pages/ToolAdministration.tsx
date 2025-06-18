import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  X,
  QrCode,
  Zap,
  Monitor,
  Wifi,
  Volume2,
  Camera,
  Projector,
  Mic,
  Building,
  User,
  Calendar,
  Download,
  Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Equipment, Department } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const equipmentSchema = z.object({
  name: z.string().min(2, 'Equipment name must be at least 2 characters'),
  code: z.string().min(2, 'Equipment code must be at least 2 characters'),
  category: z.string().min(1, 'Please select a category'),
  department_id: z.string().optional(),
  is_mandatory: z.boolean().optional(),
  is_available: z.boolean().optional(),
  description: z.string().optional(),
  specifications: z.string().optional(),
  purchase_date: z.string().optional(),
  warranty_until: z.string().optional(),
  maintenance_schedule: z.string().optional(),
});

type EquipmentForm = z.infer<typeof equipmentSchema>;

interface EquipmentWithDetails extends Equipment {
  department?: Department;
  current_borrower?: string;
  last_maintenance?: string;
  next_maintenance?: string;
}

const ToolAdministration: React.FC = () => {
  const { profile } = useAuth();
  const [equipment, setEquipment] = useState<EquipmentWithDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentWithDetails | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const form = useForm<EquipmentForm>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      is_mandatory: false,
      is_available: true,
    },
  });

  const categories = [
    'Audio Visual',
    'Computing',
    'Connectivity',
    'Power',
    'Laboratory',
    'Furniture',
    'Safety',
    'Maintenance',
  ];

  useEffect(() => {
    fetchEquipment();
    fetchDepartments();
  }, []);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          department:departments(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Add mock additional data
      const equipmentWithDetails = (data || []).map(eq => ({
        ...eq,
        current_borrower: eq.is_available ? null : 'John Doe',
        last_maintenance: '2024-11-15',
        next_maintenance: '2025-02-15',
      }));
      
      setEquipment(equipmentWithDetails);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast.error('Failed to load equipment');
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

  const handleSubmit = async (data: EquipmentForm) => {
    try {
      setLoading(true);

      if (editingEquipment) {
        // Update existing equipment
        const { error } = await supabase
          .from('equipment')
          .update({
            name: data.name,
            code: data.code.toUpperCase(),
            category: data.category,
            department_id: data.department_id || null,
            is_mandatory: data.is_mandatory || false,
            is_available: data.is_available !== false,
          })
          .eq('id', editingEquipment.id);

        if (error) throw error;
        toast.success('Equipment updated successfully');
      } else {
        // Create new equipment
        const { error } = await supabase
          .from('equipment')
          .insert({
            name: data.name,
            code: data.code.toUpperCase(),
            category: data.category,
            department_id: data.department_id || null,
            is_mandatory: data.is_mandatory || false,
            is_available: data.is_available !== false,
          });

        if (error) throw error;
        toast.success('Equipment created successfully');
      }

      setShowModal(false);
      setEditingEquipment(null);
      form.reset();
      fetchEquipment();
    } catch (error: any) {
      console.error('Error saving equipment:', error);
      if (error.code === '23505') {
        toast.error('Equipment code already exists');
      } else {
        toast.error(error.message || 'Failed to save equipment');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (equipment: EquipmentWithDetails) => {
    setEditingEquipment(equipment);
    form.reset({
      name: equipment.name,
      code: equipment.code,
      category: equipment.category,
      department_id: equipment.department_id || undefined,
      is_mandatory: equipment.is_mandatory,
      is_available: equipment.is_available,
    });
    setShowModal(true);
  };

  const handleDelete = async (equipmentId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', equipmentId);

      if (error) throw error;
      toast.success('Equipment deleted successfully');
      setShowDeleteConfirm(null);
      fetchEquipment();
    } catch (error: any) {
      console.error('Error deleting equipment:', error);
      toast.error(error.message || 'Failed to delete equipment');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (equipmentId: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('equipment')
        .update({ is_available: !currentStatus })
        .eq('id', equipmentId);

      if (error) throw error;
      toast.success(`Equipment ${!currentStatus ? 'marked as available' : 'marked as unavailable'}`);
      fetchEquipment();
    } catch (error: any) {
      console.error('Error updating equipment status:', error);
      toast.error(error.message || 'Failed to update equipment status');
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipment = equipment.filter(eq => {
    const matchesSearch = 
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || eq.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'available' && eq.is_available) ||
      (statusFilter === 'unavailable' && !eq.is_available) ||
      (statusFilter === 'mandatory' && eq.is_mandatory);
    const matchesDepartment = departmentFilter === 'all' || eq.department_id === departmentFilter;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesDepartment;
  });

  const getEquipmentIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'audio visual': return Monitor;
      case 'computing': return Monitor;
      case 'connectivity': return Wifi;
      case 'power': return Zap;
      case 'laboratory': return Package;
      case 'furniture': return Building;
      case 'safety': return AlertCircle;
      case 'maintenance': return Wrench;
      default: return Package;
    }
  };

  const getStatusColor = (equipment: EquipmentWithDetails) => {
    if (!equipment.is_available) return 'bg-red-100 text-red-800 border-red-200';
    if (equipment.is_mandatory) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusText = (equipment: EquipmentWithDetails) => {
    if (!equipment.is_available) return 'Unavailable';
    if (equipment.is_mandatory) return 'Mandatory';
    return 'Available';
  };

  if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to access tool administration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Wrench className="h-8 w-8" />
              <span>Tool Administration</span>
            </h1>
            <p className="mt-2 opacity-90">
              Manage equipment inventory and lending system
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{equipment.length}</div>
            <div className="text-sm opacity-80">Total Equipment</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Available', count: equipment.filter(e => e.is_available).length, color: 'bg-green-500', icon: CheckCircle },
          { label: 'In Use', count: equipment.filter(e => !e.is_available).length, color: 'bg-yellow-500', icon: Clock },
          { label: 'Mandatory', count: equipment.filter(e => e.is_mandatory).length, color: 'bg-blue-500', icon: AlertCircle },
          { label: 'Categories', count: new Set(equipment.map(e => e.category)).size, color: 'bg-purple-500', icon: Package },
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search equipment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="unavailable">In Use</option>
                <option value="mandatory">Mandatory</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-4 py-2 text-sm font-medium ${
                    viewMode === 'table'
                      ? 'bg-emerald-500 text-white'
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
              onClick={() => fetchEquipment()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            
            <button className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200">
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>

            <button className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>

            <button
              onClick={() => {
                setEditingEquipment(null);
                form.reset();
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-200"
            >
              <Plus className="h-4 w-4" />
              <span>Add Equipment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600 mr-2" />
            <span className="text-gray-600">Loading equipment...</span>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEquipment.map((eq) => {
            const IconComponent = getEquipmentIcon(eq.category);
            return (
              <div
                key={eq.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{eq.name}</h3>
                      <p className="text-sm text-gray-500">{eq.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        setSelectedEquipment(eq);
                        setShowDetailModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(eq)}
                      className="p-1 text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(eq.id)}
                      className="p-1 text-red-600 hover:text-red-800 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Category:</span>
                    <span className="font-medium">{eq.category}</span>
                  </div>
                  {eq.department && (
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Department:</span>
                      <span className="font-medium">{eq.department.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(eq)}`}>
                    {getStatusText(eq)}
                  </span>
                  <button
                    onClick={() => handleStatusToggle(eq.id, eq.is_available)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors duration-200 ${
                      eq.is_available
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {eq.is_available ? 'Mark Unavailable' : 'Mark Available'}
                  </button>
                </div>

                {!eq.is_available && eq.current_borrower && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-1" />
                      <span>Borrowed by: {eq.current_borrower}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Equipment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current User
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEquipment.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No equipment found</p>
                        <p>Try adjusting your search or create new equipment</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEquipment.map((eq) => {
                    const IconComponent = getEquipmentIcon(eq.category);
                    return (
                      <tr key={eq.id} className="hover:bg-gray-50 transition-colors duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{eq.name}</div>
                              <div className="text-sm text-gray-500">{eq.code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {eq.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {eq.department?.name || 'No Department'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(eq)}`}>
                            {getStatusText(eq)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {eq.current_borrower || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setSelectedEquipment(eq);
                                setShowDetailModal(true);
                              }}
                              className="text-gray-600 hover:text-gray-900 p-1 rounded transition-colors duration-200"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(eq)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors duration-200"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(eq.id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-200"
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
      )}

      {/* Add/Edit Equipment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingEquipment(null);
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
                    Equipment Name *
                  </label>
                  <input
                    {...form.register('name')}
                    type="text"
                    placeholder="e.g., Projector"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  {form.formState.errors.name && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Equipment Code *
                  </label>
                  <input
                    {...form.register('code')}
                    type="text"
                    placeholder="e.g., PROJ-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  {form.formState.errors.code && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    {...form.register('category')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.category && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.category.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <select
                    {...form.register('department_id')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">No Department</option>
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
                </div>

                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      {...form.register('is_mandatory')}
                      type="checkbox"
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Mandatory equipment (auto-selected for bookings)
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...form.register('is_available')}
                      type="checkbox"
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Available for lending
                    </label>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingEquipment(null);
                      form.reset();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {loading ? 'Saving...' : editingEquipment ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Detail Modal */}
      {showDetailModal && selectedEquipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Equipment Details</h3>
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
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="h-16 w-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                      {getEquipmentIcon(selectedEquipment.category)({ className: "h-8 w-8 text-white" })}
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-900">{selectedEquipment.name}</h4>
                      <p className="text-gray-600">{selectedEquipment.code}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedEquipment)}`}>
                        {getStatusText(selectedEquipment)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Category:</span>
                      <span className="ml-2 font-medium">{selectedEquipment.category}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Department:</span>
                      <span className="ml-2 font-medium">{selectedEquipment.department?.name || 'No Department'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <span className="ml-2">{format(new Date(selectedEquipment.created_at), 'MMM d, yyyy')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Last Updated:</span>
                      <span className="ml-2">{format(new Date(selectedEquipment.updated_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>

                {/* Current Status */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Current Status</h5>
                  <div className="bg-blue-50 rounded-lg p-4">
                    {selectedEquipment.is_available ? (
                      <div className="flex items-center text-green-700">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span>Available for lending</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center text-red-700 mb-2">
                          <XCircle className="h-5 w-5 mr-2" />
                          <span>Currently in use</span>
                        </div>
                        {selectedEquipment.current_borrower && (
                          <div className="text-sm text-gray-600">
                            Borrowed by: {selectedEquipment.current_borrower}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Maintenance Info */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Maintenance Schedule</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600">Last Maintenance</div>
                      <div className="font-medium">{selectedEquipment.last_maintenance ? format(new Date(selectedEquipment.last_maintenance), 'MMM d, yyyy') : 'Not recorded'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600">Next Maintenance</div>
                      <div className="font-medium">{selectedEquipment.next_maintenance ? format(new Date(selectedEquipment.next_maintenance), 'MMM d, yyyy') : 'Not scheduled'}</div>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">QR Code</h5>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <QrCode className="h-24 w-24 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">QR Code for {selectedEquipment.code}</p>
                    <button className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-200">
                      Generate QR Code
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      handleStatusToggle(selectedEquipment.id, selectedEquipment.is_available);
                      setShowDetailModal(false);
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors duration-200 ${
                      selectedEquipment.is_available
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {selectedEquipment.is_available ? 'Mark as Unavailable' : 'Mark as Available'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleEdit(selectedEquipment);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Edit Equipment
                  </button>
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
                <h3 className="text-lg font-medium text-gray-900">Delete Equipment</h3>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this equipment? This action cannot be undone and will affect all related lending records.
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

export default ToolAdministration;