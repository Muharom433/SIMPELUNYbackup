import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Wrench, Plus, Search, Edit, Trash2, Eye, Package, AlertCircle, RefreshCw, X, 
    QrCode, Building, Monitor, Wifi, Zap, FlaskConical, Armchair, Shield,
    Camera, Headphones, Cpu, Router, Battery, Microscope, ChevronDown,
    MapPin, Hash, Layers, CheckCircle, XCircle, Star, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Equipment, Room, Department } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const equipmentSchema = z.object({
  name: z.string().min(2, 'Equipment name must be at least 2 characters'),
  code: z.string().min(2, 'Equipment code must be at least 2 characters'),
  category: z.string().min(1, 'Please select a category'),
  rooms_id: z.string().optional().nullable(),
  is_mandatory: z.boolean().optional(),
  is_available: z.boolean().optional(),
  condition: z.enum(['GOOD', 'BROKEN', 'MAINTENANCE']).default('GOOD'),
  Spesification: z.string().optional(),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  unit: z.string().min(1, 'Unit is required (e.g., pcs, set)'),
});

type EquipmentForm = z.infer<typeof equipmentSchema>;

interface EquipmentWithDetails extends Equipment {
  rooms?: Room & { department: Department };
}

const ToolAdministration: React.FC = () => {
    const { profile } = useAuth();
    const [equipment, setEquipment] = useState<EquipmentWithDetails[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [roomFilter, setRoomFilter] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState<EquipmentWithDetails | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithDetails | null>(null);

    const form = useForm<EquipmentForm>({
        resolver: zodResolver(equipmentSchema),
        defaultValues: { is_mandatory: false, is_available: true, condition: 'GOOD', quantity: 1 },
    });

    const categories = [
        { name: 'Audio Visual', icon: Camera, color: 'from-violet-400 to-purple-400', bgColor: 'bg-violet-50', textColor: 'text-violet-600' },
        { name: 'Computing', icon: Cpu, color: 'from-blue-400 to-indigo-400', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
        { name: 'Connectivity', icon: Wifi, color: 'from-emerald-400 to-green-400', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600' },
        { name: 'Power', icon: Zap, color: 'from-amber-400 to-yellow-400', bgColor: 'bg-amber-50', textColor: 'text-amber-600' },
        { name: 'Laboratory', icon: FlaskConical, color: 'from-rose-400 to-pink-400', bgColor: 'bg-rose-50', textColor: 'text-rose-600' },
        { name: 'Furniture', icon: Armchair, color: 'from-slate-400 to-gray-400', bgColor: 'bg-slate-50', textColor: 'text-slate-600' },
        { name: 'Safety', icon: Shield, color: 'from-orange-400 to-red-400', bgColor: 'bg-orange-50', textColor: 'text-orange-600' }
    ];

    useEffect(() => {
        fetchEquipment();
        fetchRooms();
    }, []);

    const fetchEquipment = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('equipment')
                .select(`*, rooms (*, department:departments(*))`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setEquipment(data || []);
        } catch (error) {
            console.error('Error fetching equipment:', error);
            toast.error('Failed to load equipment');
        } finally { setLoading(false); }
    };

    const fetchRooms = async () => {
        try {
            const { data, error } = await supabase.from('rooms').select('*').order('name');
            if (error) throw error;
            setRooms(data || []);
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    };

    const handleSubmit = async (data: EquipmentForm) => {
        try {
            setLoading(true);
            const equipmentData = {
                name: data.name,
                code: data.code.toUpperCase(),
                category: data.category,
                is_mandatory: data.is_mandatory,
                is_available: data.is_available,
                condition: data.condition,
                rooms_id: data.rooms_id || null,
                Spesification: data.Spesification,
                quantity: data.quantity,
                unit: data.unit,
            };

            if (editingEquipment) {
                const { error } = await supabase.from('equipment').update(equipmentData).eq('id', editingEquipment.id);
                if (error) throw error;
                toast.success('Equipment updated successfully! 🎉');
            } else {
                const { error } = await supabase.from('equipment').insert([equipmentData]);
                if (error) throw error;
                toast.success('Equipment created successfully! ✨');
            }

            setShowModal(false);
            setEditingEquipment(null);
            form.reset();
            fetchEquipment();
        } catch (error: any) {
            console.error('Error saving equipment:', error);
            if (error.code === '23505') { 
                toast.error('Equipment code already exists! Please use a different code.'); 
            } else { 
                toast.error(error.message || 'Failed to save equipment'); 
            }
        } finally { setLoading(false); }
    };

    const handleEdit = (eq: EquipmentWithDetails) => {
        setEditingEquipment(eq);
        form.reset({
            name: eq.name,
            code: eq.code,
            category: eq.category,
            is_mandatory: eq.is_mandatory,
            is_available: eq.is_available,
            condition: eq.condition,
            rooms_id: eq.rooms_id,
            Spesification: eq.Spesification || '',
            quantity: eq.quantity,
            unit: eq.unit,
        });
        setShowModal(true);
    };

    const handleDelete = async (equipmentId: string) => {
        try {
            setLoading(true);
            const { error } = await supabase.from('equipment').delete().eq('id', equipmentId);
            if (error) throw error;
            toast.success('Equipment deleted successfully! 🗑️');
            setShowDeleteConfirm(null);
            fetchEquipment();
        } catch (error: any) {
            console.error('Error deleting equipment:', error);
            toast.error(error.message || 'Failed to delete equipment');
        } finally { setLoading(false); }
    };

    const filteredEquipment = equipment.filter(eq => {
        const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            eq.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || eq.category === categoryFilter;
        const matchesRoom = roomFilter === 'all' || eq.rooms_id === roomFilter;
        return matchesSearch && matchesCategory && matchesRoom;
    });

    const getCategoryConfig = (categoryName: string) => {
        return categories.find(cat => cat.name === categoryName) || categories[0];
    };

    const getConditionConfig = (condition: string) => {
        switch (condition) {
            case 'GOOD':
                return {
                    icon: CheckCircle,
                    label: 'GOOD',
                    className: 'bg-green-100 text-green-700 border border-green-200'
                };
            case 'BROKEN':
                return {
                    icon: XCircle,
                    label: 'BROKEN',
                    className: 'bg-red-100 text-red-700 border border-red-200'
                };
            case 'MAINTENANCE':
                return {
                    icon: AlertTriangle,
                    label: 'MAINTENANCE',
                    className: 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                };
            default:
                return {
                    icon: AlertCircle,
                    label: 'UNKNOWN',
                    className: 'bg-gray-100 text-gray-700 border border-gray-200'
                };
        }
    };

    const getStatusConfig = (is_available: boolean) => {
        if (is_available) {
            return {
                icon: CheckCircle,
                label: 'AVAILABLE',
                className: 'bg-blue-50 text-blue-700 border border-blue-200'
            };
        } else {
            return {
                icon: XCircle,
                label: 'IN USE',
                className: 'bg-gray-100 text-gray-600 border border-gray-200'
            };
        }
    };

    const getStatusChip = (is_available: boolean, condition: string, is_mandatory: boolean = false) => {
        const conditionConfig = getConditionConfig(condition);
        const statusConfig = getStatusConfig(is_available);
        const ConditionIcon = conditionConfig.icon;
        const StatusIcon = statusConfig.icon;
        
        return (
            <div className="flex flex-col gap-1">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${conditionConfig.className}`}>
                    <ConditionIcon className="h-3 w-3" />
                    {conditionConfig.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${statusConfig.className}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                </span>
                {is_mandatory && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Star className="h-3 w-3" />
                        REQUIRED
                    </span>
                )}
            </div>
        );
    };

    if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h3>
                    <p className="text-gray-600">You don't have permission to access tool administration.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-slate-600 via-gray-700 to-slate-800 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3 mb-2">
                            <div className="p-2 bg-white bg-opacity-15 rounded-lg">
                                <Wrench className="h-8 w-8" />
                            </div>
                            <span>Equipment Management</span>
                        </h1>
                        <p className="text-lg opacity-90">Manage your laboratory and classroom equipment</p>
                        <div className="mt-3 flex items-center space-x-4 text-sm">
                            <div className="flex items-center space-x-2 opacity-80">
                                <Package className="h-4 w-4" />
                                <span>Total: {equipment.length}</span>
                            </div>
                            <div className="flex items-center space-x-2 opacity-80">
                                <CheckCircle className="h-4 w-4" />
                                <span>Available: {equipment.filter(eq => eq.is_available).length}</span>
                            </div>
                            <div className="flex items-center space-x-2 opacity-80">
                                <AlertTriangle className="h-4 w-4" />
                                <span>Good Condition: {equipment.filter(eq => eq.condition === 'GOOD').length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="hidden lg:block text-right">
                        <div className="text-4xl font-bold opacity-90">{equipment.length}</div>
                        <div className="text-sm opacity-70">Total Equipment</div>
                    </div>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search equipment..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <select 
                                value={categoryFilter} 
                                onChange={(e) => setCategoryFilter(e.target.value)} 
                                className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none bg-white text-sm"
                            >
                                <option value="all">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative">
                            <select 
                                value={roomFilter} 
                                onChange={(e) => setRoomFilter(e.target.value)} 
                                className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none bg-white text-sm"
                            >
                                <option value="all">All Locations</option>
                                {rooms.map(room => (
                                    <option key={room.id} value={room.id}>{room.name}</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            onClick={() => fetchEquipment()} 
                            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        <button 
                            onClick={() => { 
                                setEditingEquipment(null); 
                                form.reset({ is_available: true, condition: 'GOOD', quantity: 1 }); 
                                setShowModal(true); 
                            }} 
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add Equipment</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Equipment Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {loading && (
                    Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div className="space-y-2">
                                <div className="h-3 bg-gray-200 rounded"></div>
                                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                            </div>
                        </div>
                    ))
                )}

                {!loading && filteredEquipment.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500">
                        <Package className="h-16 w-16 mb-4 opacity-50" />
                        <h3 className="text-xl font-semibold mb-2">No Equipment Found</h3>
                        <p>Try adjusting your search or filters</p>
                    </div>
                )}

                {!loading && filteredEquipment.map(eq => {
                    const categoryConfig = getCategoryConfig(eq.category);
                    const CategoryIcon = categoryConfig.icon;
                    
                    return (
                        <div key={eq.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 group">
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`p-2 rounded-lg bg-gradient-to-r ${categoryConfig.color} text-white`}>
                                        <CategoryIcon className="h-5 w-5" />
                                    </div>
                                    {getStatusChip(eq.is_available, eq.condition, eq.is_mandatory)}
                                </div>
                                
                                <h3 className="font-semibold text-lg text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                                    {eq.name}
                                </h3>
                                
                                <div className="flex items-center gap-2 mb-3">
                                    <Hash className="h-3 w-3 text-gray-400" />
                                    <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                        {eq.code}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className={`flex items-center gap-2 p-2 rounded ${categoryConfig.bgColor}`}>
                                        <Layers className="h-3 w-3 text-gray-500" />
                                        <span className={`font-medium ${categoryConfig.textColor} text-xs`}>{eq.category}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 p-2 rounded bg-slate-50">
                                        <MapPin className="h-3 w-3 text-gray-500" />
                                        <span className="text-slate-700 font-medium text-xs">
                                            {eq.rooms?.name || 'Unassigned'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 p-2 rounded bg-blue-50">
                                        <Package className="h-3 w-3 text-gray-500" />
                                        <span className="text-blue-700 font-medium text-xs">
                                            {eq.quantity} {eq.unit}
                                        </span>
                                    </div>

                                    {eq.rooms?.department?.name && (
                                        <div className="flex items-center gap-2 p-2 rounded bg-gray-50">
                                            <Building className="h-3 w-3 text-gray-500" />
                                            <span className="text-gray-600 font-medium text-xs">
                                                {eq.rooms.department.name}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                                    <button 
                                        onClick={() => setSelectedEquipment(eq)} 
                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium transition-colors text-sm"
                                        title="View Details"
                                    >
                                        <Eye className="h-4 w-4" />
                                        <span>View</span>
                                    </button>
                                    
                                    <div className="flex items-center space-x-1">
                                        <button 
                                            onClick={() => handleEdit(eq)} 
                                            className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                                            title="Edit"
                                        >
                                            <Edit className="h-3 w-3" />
                                        </button>
                                        <button 
                                            onClick={() => setShowDeleteConfirm(eq.id)} 
                                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}-4 w-4 text-gray-500" />
                                        <span className="text-blue-700 font-medium">
                                            {eq.rooms?.name || 'Unassigned'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
                                        <Package className="h-4 w-4 text-gray-500" />
                                        <span className="text-green-700 font-semibold">
                                            {eq.quantity} {eq.unit}
                                        </span>
                                    </div>

                                    {eq.rooms?.department?.name && (
                                        <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-50">
                                            <Building className="h-4 w-4 text-gray-500" />
                                            <span className="text-purple-700 font-medium text-xs">
                                                {eq.rooms.department.name}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 pb-6">
                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                    <button 
                                        onClick={() => setSelectedEquipment(eq)} 
                                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                                        title="View Details"
                                    >
                                        <Eye className="h-4 w-4" />
                                        <span className="text-sm">View</span>
                                    </button>
                                    
                                    <div className="flex items-center space-x-2">
                                        <button 
                                            onClick={() => handleEdit(eq)} 
                                            className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                                            title="Edit Equipment"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button 
                                            onClick={() => setShowDeleteConfirm(eq.id)} 
                                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Equipment"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-bold flex items-center gap-3">
                                    <Wrench className="h-6 w-6" />
                                    {editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}
                                </h3>
                                <button 
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                        
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Equipment Name *</label>
                                    <input 
                                        {...form.register('name')} 
                                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors" 
                                        placeholder="Enter equipment name"
                                    />
                                    {form.formState.errors.name && (
                                        <p className="text-red-500 text-sm flex items-center gap-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            {form.formState.errors.name.message}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Equipment Code *</label>
                                    <input 
                                        {...form.register('code')} 
                                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors font-mono" 
                                        placeholder="e.g. LAB-001"
                                    />
                                    {form.formState.errors.code && (
                                        <p className="text-red-500 text-sm flex items-center gap-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            {form.formState.errors.code.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">Category *</label>
                                <select 
                                    {...form.register('category')} 
                                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors"
                                >
                                    <option value="">Select Category</option>
                                    {categories.map(cat => (
                                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>
                                {form.formState.errors.category && (
                                    <p className="text-red-500 text-sm flex items-center gap-1">
                                        <AlertTriangle className="h-4 w-4" />
                                        {form.formState.errors.category.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">Room Location</label>
                                <select 
                                    {...form.register('rooms_id')} 
                                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors"
                                >
                                    <option value="">Not Assigned</option>
                                    {rooms.map(room => (
                                        <option key={room.id} value={room.id}>{room.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Quantity *</label>
                                    <input 
                                        type="number" 
                                        {...form.register('quantity', {valueAsNumber: true})} 
                                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors" 
                                        min="0"
                                    />
                                    {form.formState.errors.quantity && (
                                        <p className="text-red-500 text-sm flex items-center gap-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            {form.formState.errors.quantity.message}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Unit *</label>
                                    <input 
                                        {...form.register('unit')} 
                                        placeholder="e.g. pcs, set, unit" 
                                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors" 
                                    />
                                    {form.formState.errors.unit && (
                                        <p className="text-red-500 text-sm flex items-center gap-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            {form.formState.errors.unit.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">Condition *</label>
                                    <select 
                                        {...form.register('condition')} 
                                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors"
                                    >
                                        <option value="GOOD">Good Condition</option>
                                        <option value="BROKEN">Broken</option>
                                        <option value="MAINTENANCE">Under Maintenance</option>
                                    </select>
                                    {form.formState.errors.condition && (
                                        <p className="text-red-500 text-sm flex items-center gap-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            {form.formState.errors.condition.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">Specification</label>
                                <textarea 
                                    {...form.register('Spesification')} 
                                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors" 
                                    rows={4}
                                    placeholder="Enter detailed specifications..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex items-center p-4 bg-amber-50 rounded-xl border border-amber-200">
                                    <input 
                                        {...form.register('is_mandatory')} 
                                        type="checkbox" 
                                        className="h-5 w-5 text-amber-600 border-2 border-amber-300 rounded focus:ring-amber-500" 
                                    />
                                    <div className="ml-3">
                                        <label className="text-sm font-semibold text-amber-800">Mandatory Equipment</label>
                                        <p className="text-xs text-amber-600">Required for room bookings</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center p-4 bg-green-50 rounded-xl border border-green-200">
                                    <input 
                                        {...form.register('is_available')} 
                                        type="checkbox" 
                                        className="h-5 w-5 text-green-600 border-2 border-green-300 rounded focus:ring-green-500" 
                                    />
                                    <div className="ml-3">
                                        <label className="text-sm font-semibold text-green-800">Available for Lending</label>
                                        <p className="text-xs text-green-600">Can be borrowed by users</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)} 
                                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={loading} 
                                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            Saving...
                                        </div>
                                    ) : (
                                        editingEquipment ? 'Update Equipment' : 'Create Equipment'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Equipment Detail Modal */}
            {selectedEquipment && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2">{selectedEquipment.name}</h2>
                                    <div className="flex items-center gap-2">
                                        <Hash className="h-4 w-4 opacity-80" />
                                        <span className="font-mono text-lg opacity-90">{selectedEquipment.code}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedEquipment(null)} 
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-xl transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-8 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Equipment Details */}
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <Package className="h-5 w-5 text-indigo-600" />
                                            Equipment Details
                                        </h3>
                                        <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Category</span>
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const config = getCategoryConfig(selectedEquipment.category);
                                                        const CategoryIcon = config.icon;
                                                        return (
                                                            <>
                                                                <CategoryIcon className="h-4 w-4 text-gray-600" />
                                                                <span className="font-semibold text-gray-900">{selectedEquipment.category}</span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Condition</span>
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const config = getConditionConfig(selectedEquipment.condition);
                                                        const ConditionIcon = config.icon;
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config.className}`}>
                                                                <ConditionIcon className="h-3 w-3" />
                                                                {config.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Status</span>
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const config = getStatusConfig(selectedEquipment.is_available);
                                                        const StatusIcon = config.icon;
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config.className}`}>
                                                                <StatusIcon className="h-3 w-3" />
                                                                {config.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Location</span>
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4 text-gray-600" />
                                                    <span className="font-semibold text-gray-900">
                                                        {selectedEquipment.rooms?.name || 'Unassigned'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Department</span>
                                                <div className="flex items-center gap-2">
                                                    <Building className="h-4 w-4 text-gray-600" />
                                                    <span className="font-semibold text-gray-900">
                                                        {selectedEquipment.rooms?.department?.name || 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Quantity</span>
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-gray-600" />
                                                    <span className="font-bold text-lg text-gray-900">
                                                        {selectedEquipment.quantity} {selectedEquipment.unit}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">Created</span>
                                                <span className="text-sm text-gray-700">
                                                    {format(new Date(selectedEquipment.created_at), 'MMM d, yyyy')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Specifications */}
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <FlaskConical className="h-5 w-5 text-indigo-600" />
                                            Specifications
                                        </h3>
                                        <div className="bg-gray-50 rounded-2xl p-6 h-64 overflow-y-auto">
                                            {selectedEquipment.Spesification ? (
                                                <div className="prose prose-sm max-w-none">
                                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                        {selectedEquipment.Spesification}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                                    <AlertCircle className="h-12 w-12 mb-3 opacity-50" />
                                                    <p className="text-center">No specification details available.</p>
                                                    <p className="text-sm text-center mt-1">Consider adding specifications for better equipment management.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <Wrench className="h-5 w-5 text-indigo-600" />
                                            Quick Actions
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => {
                                                    setSelectedEquipment(null);
                                                    handleEdit(selectedEquipment);
                                                }}
                                                className="flex items-center justify-center gap-2 p-4 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl transition-colors"
                                            >
                                                <Edit className="h-5 w-5" />
                                                <span className="font-semibold">Edit</span>
                                            </button>
                                            
                                            <button 
                                                onClick={() => {
                                                    setSelectedEquipment(null);
                                                    setShowDeleteConfirm(selectedEquipment.id);
                                                }}
                                                className="flex items-center justify-center gap-2 p-4 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl transition-colors"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                                <span className="font-semibold">Delete</span>
                                            </button>
                                        </div>
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
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center mb-6">
                            <div className="flex-shrink-0 p-3 bg-red-100 rounded-full">
                                <AlertCircle className="h-8 w-8 text-red-600" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-xl font-bold text-gray-900">Delete Equipment</h3>
                                <p className="text-sm text-gray-600 mt-1">This action cannot be undone</p>
                            </div>
                        </div>
                        
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                            <p className="text-sm text-red-800">
                                Are you sure you want to delete this equipment? This action will permanently remove 
                                the equipment from the system and may affect related booking records.
                            </p>
                        </div>
                        
                        <div className="flex space-x-3">
                            <button 
                                onClick={() => setShowDeleteConfirm(null)} 
                                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleDelete(showDeleteConfirm)} 
                                disabled={loading} 
                                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold transition-colors shadow-lg"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Deleting...
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <Trash2 className="h-4 w-4" />
                                        Delete Equipment
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToolAdministration;