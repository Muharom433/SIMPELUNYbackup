import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Wrench, Plus, Search, Edit, Trash2, Eye, Package, AlertCircle, RefreshCw, X, 
    Camera, Cpu, Wifi, Zap, FlaskConical, Armchair, Shield,
    MapPin, Hash, Layers, CheckCircle, XCircle, Star, AlertTriangle, Building,
    User, Phone, CreditCard, Clock, Calendar, Users, Activity, TrendingUp,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Equipment, Room, Department, User as UserType } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

// Update schema to make rooms_id required for department admins
const equipmentSchema = z.object({
  name: z.string().min(2, 'Equipment name must be at least 2 characters'),
  code: z.string().min(2, 'Equipment code must be at least 2 characters'),
  category: z.string().min(1, 'Please select a category'),
  rooms_id: z.string().min(1, 'Please select a room location'),
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

interface LendingDetail {
  id: string;
  date: string;
  borrowed_quantity: number;
  returned_quantity: number;
  missing_quantity: number;
  status: 'active' | 'returned' | 'overdue';
  created_at: string;
  user?: UserType;
  checkout?: {
    id: string;
    checkout_date: string;
    expected_return_date: string;
    status: string;
  };
  source?: 'lending_tool' | 'booking';
}

const ToolAdministration: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();
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
    const [lendingDetails, setLendingDetails] = useState<LendingDetail[]>([]);
    const [loadingLending, setLoadingLending] = useState(false);

    // Room search dropdown states
    const [roomSearchTerm, setRoomSearchTerm] = useState('');
    const [showRoomDropdown, setShowRoomDropdown] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

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
            
            let query = supabase
                .from('equipment')
                .select(`*, rooms (*, department:departments(*))`);

            // Filter equipment for department admin - only show equipment with rooms in their department
            if (profile?.role === 'department_admin' && profile.department_id) {
                // First get rooms in the department
                const { data: departmentRooms } = await supabase
                    .from('rooms')
                    .select('id')
                    .eq('department_id', profile.department_id);
                
                if (departmentRooms && departmentRooms.length > 0) {
                    const roomIds = departmentRooms.map(room => room.id);
                    query = query.in('rooms_id', roomIds);
                } else {
                    // No rooms in department, return empty
                    setEquipment([]);
                    setLoading(false);
                    return;
                }
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setEquipment(data || []);
        } catch (error) {
            console.error('Error fetching equipment:', error);
            toast.error(getText('Failed to load equipment', 'Gagal memuat peralatan'));
        } finally { 
            setLoading(false); 
        }
    };

    const fetchRooms = async () => {
        try {
            let query = supabase.from('rooms').select('*, department:departments(*)');
            
            // Filter rooms for department admin - only show rooms in their department
            if (profile?.role === 'department_admin' && profile.department_id) {
                query = query.eq('department_id', profile.department_id);
            }
            
            const { data, error } = await query.order('name');
            if (error) throw error;
            setRooms(data || []);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            toast.error(getText('Failed to load rooms', 'Gagal memuat ruangan'));
        }
    };

    const fetchLendingDetails = async (equipmentId: string) => {
        try {
            setLoadingLending(true);
            
            // Fetch all lending tool records for this equipment
            const { data: lendingData, error: lendingError } = await supabase
                .from('lending_tool')
                .select('*')
                .contains('id_equipment', [equipmentId])
                .order('created_at', { ascending: false });

            if (lendingError) throw lendingError;

            // Fetch approved bookings that include this equipment
            const { data: bookingData, error: bookingError } = await supabase
                .from('bookings')
                .select('*, user:users(id, full_name, identity_number, email, phone_number)')
                .eq('status', 'approved')
                .contains('equipment_requested', [equipmentId])
                .order('created_at', { ascending: false });

            if (bookingError) throw bookingError;

            let allLendingDetails: LendingDetail[] = [];

            // Process lending_tool records
            if (lendingData && lendingData.length > 0) {
                const detailedLendings = await Promise.all(
                    lendingData.map(async (lending) => {
                        let lendingDetail: LendingDetail = {
                            id: lending.id,
                            date: lending.date,
                            borrowed_quantity: 0,
                            returned_quantity: 0,
                            missing_quantity: 0,
                            status: 'active',
                            created_at: lending.created_at,
                            source: 'lending_tool'
                        };

                        // Find the equipment index in the arrays
                        const equipmentIndex = lending.id_equipment.findIndex((id: string) => id === equipmentId);
                        if (equipmentIndex !== -1) {
                            lendingDetail.borrowed_quantity = lending.qty[equipmentIndex] || 0;
                        }

                        // Fetch user information
                        if (lending.id_user) {
                            const { data: userData } = await supabase
                                .from('users')
                                .select('id, full_name, identity_number, email, phone_number')
                                .eq('id', lending.id_user)
                                .single();
                            
                            if (userData) {
                                lendingDetail.user = userData;
                            }
                        }

                        // Fetch checkout information to determine status and returned quantities
                        const { data: checkoutData } = await supabase
                            .from('checkouts')
                            .select('*')
                            .eq('lendingTool_id', lending.id)
                            .eq('type', 'things')
                            .order('created_at', { ascending: false })
                            .limit(1);

                        if (checkoutData && checkoutData.length > 0) {
                            const checkout = checkoutData[0];
                            lendingDetail.checkout = {
                                id: checkout.id,
                                checkout_date: checkout.checkout_date,
                                expected_return_date: checkout.expected_return_date,
                                status: checkout.status
                            };

                            // Fetch checkout items to get returned quantities
                            const { data: checkoutItems } = await supabase
                                .from('checkout_items')
                                .select('*')
                                .eq('checkout_id', checkout.id)
                                .eq('equipment_id', equipmentId);

                            if (checkoutItems && checkoutItems.length > 0) {
                                const item = checkoutItems[0];
                                lendingDetail.returned_quantity = item.quantity || 0;
                                lendingDetail.missing_quantity = lendingDetail.borrowed_quantity - lendingDetail.returned_quantity;
                                
                                if (lendingDetail.missing_quantity <= 0) {
                                    lendingDetail.status = 'returned';
                                    lendingDetail.missing_quantity = 0;
                                }
                            } else {
                                // No checkout items found, assume nothing returned yet
                                lendingDetail.returned_quantity = 0;
                                lendingDetail.missing_quantity = lendingDetail.borrowed_quantity;
                            }
                        } else {
                            // No checkout record, equipment is still borrowed
                            lendingDetail.returned_quantity = 0;
                            lendingDetail.missing_quantity = lendingDetail.borrowed_quantity;
                            lendingDetail.status = 'active';
                        }

                        return lendingDetail;
                    })
                );
                
                allLendingDetails = [...allLendingDetails, ...detailedLendings];
            }

            // Process booking records
            if (bookingData && bookingData.length > 0) {
                const bookingLendings = bookingData.map((booking) => {
                    const lendingDetail: LendingDetail = {
                        id: `booking-${booking.id}`,
                        date: booking.start_time,
                        borrowed_quantity: 1, // Default quantity for bookings
                        returned_quantity: 0, // Assume not returned for bookings
                        missing_quantity: 1, // Default missing for approved bookings
                        status: 'active',
                        created_at: booking.created_at,
                        source: 'booking',
                        user: booking.user || (booking.user_info ? {
                            id: 'temp',
                            full_name: booking.user_info.full_name,
                            identity_number: booking.user_info.identity_number,
                            email: booking.user_info.email || null,
                            phone_number: booking.user_info.phone_number || null
                        } : undefined),
                        checkout: {
                            id: `booking-checkout-${booking.id}`,
                            checkout_date: booking.start_time,
                            expected_return_date: booking.end_time,
                            status: 'active'
                        }
                    };

                    return lendingDetail;
                });

                allLendingDetails = [...allLendingDetails, ...bookingLendings];
            }

            // Filter to show only records with missing items
            const missingItemsOnly = allLendingDetails.filter(detail => detail.missing_quantity > 0);
            
            setLendingDetails(missingItemsOnly);
        } catch (error) {
            console.error('Error fetching lending details:', error);
            toast.error(getText('Failed to load lending details', 'Gagal memuat detail peminjaman'));
            setLendingDetails([]);
        } finally {
            setLoadingLending(false);
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
                rooms_id: data.rooms_id,
                Spesification: data.Spesification,
                quantity: data.quantity,
                unit: data.unit,
            };

            if (editingEquipment) {
                const { error } = await supabase.from('equipment').update(equipmentData).eq('id', editingEquipment.id);
                if (error) throw error;
                toast.success(getText('Equipment updated successfully! 🎉', 'Peralatan berhasil diperbarui! 🎉'));
            } else {
                const { error } = await supabase.from('equipment').insert([equipmentData]);
                if (error) throw error;
                toast.success(getText('Equipment created successfully! ✨', 'Peralatan berhasil dibuat! ✨'));
            }

            setShowModal(false);
            setEditingEquipment(null);
            setSelectedRoom(null);
            setRoomSearchTerm('');
            form.reset();
            fetchEquipment();
        } catch (error: any) {
            console.error('Error saving equipment:', error);
            if (error.code === '23505') { 
                toast.error(getText('Equipment code already exists! Please use a different code.', 'Kode peralatan sudah ada! Gunakan kode yang berbeda.')); 
            } else { 
                toast.error(error.message || getText('Failed to save equipment', 'Gagal menyimpan peralatan')); 
            }
        } finally { 
            setLoading(false); 
        }
    };

    const handleEdit = (eq: EquipmentWithDetails) => {
        setEditingEquipment(eq);
        setSelectedRoom(eq.rooms || null);
        setRoomSearchTerm(eq.rooms?.name || '');
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
            toast.success(getText('Equipment deleted successfully! 🗑️', 'Peralatan berhasil dihapus! 🗑️'));
            setShowDeleteConfirm(null);
            fetchEquipment();
        } catch (error: any) {
            console.error('Error deleting equipment:', error);
            toast.error(error.message || getText('Failed to delete equipment', 'Gagal menghapus peralatan'));
        } finally { 
            setLoading(false); 
        }
    };

    const handleViewDetails = (eq: EquipmentWithDetails) => {
        setSelectedEquipment(eq);
        fetchLendingDetails(eq.id);
    };

    const handleRoomSelect = (room: Room) => {
        setSelectedRoom(room);
        form.setValue('rooms_id', room.id);
        setRoomSearchTerm(room.name);
        setShowRoomDropdown(false);
    };

    const clearRoomSelection = () => {
        setSelectedRoom(null);
        form.setValue('rooms_id', '');
        setRoomSearchTerm('');
    };

    const filteredRooms = rooms.filter(room => 
        room.name.toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
        room.code.toLowerCase().includes(roomSearchTerm.toLowerCase())
    );

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
                    label: getText('GOOD', 'BAIK'),
                    className: 'bg-green-100 text-green-700 border border-green-200'
                };
            case 'BROKEN':
                return {
                    icon: XCircle,
                    label: getText('BROKEN', 'RUSAK'),
                    className: 'bg-red-100 text-red-700 border border-red-200'
                };
            case 'MAINTENANCE':
                return {
                    icon: AlertTriangle,
                    label: getText('MAINTENANCE', 'PEMELIHARAAN'),
                    className: 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                };
            default:
                return {
                    icon: AlertCircle,
                    label: getText('UNKNOWN', 'TIDAK DIKETAHUI'),
                    className: 'bg-gray-100 text-gray-700 border border-gray-200'
                };
        }
    };

    const getStatusConfig = (is_available: boolean) => {
        if (is_available) {
            return {
                icon: CheckCircle,
                label: getText('AVAILABLE', 'TERSEDIA'),
                className: 'bg-blue-50 text-blue-700 border border-blue-200'
            };
        } else {
            return {
                icon: XCircle,
                label: getText('IN USE', 'SEDANG DIGUNAKAN'),
                className: 'bg-gray-100 text-gray-600 border border-gray-200'
            };
        }
    };

    const getStatusChip = (condition: string, is_mandatory: boolean = false) => {
        const conditionConfig = getConditionConfig(condition);
        const ConditionIcon = conditionConfig.icon;
        
        return (
            <div className="flex flex-col gap-1">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${conditionConfig.className}`}>
                    <ConditionIcon className="h-3 w-3" />
                    {conditionConfig.label}
                </span>
                {is_mandatory && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Star className="h-3 w-3" />
                        {getText('REQUIRED', 'WAJIB')}
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
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {getText('Access Denied', 'Akses Ditolak')}
                    </h3>
                    <p className="text-gray-600">
                        {getText(
                            "You don't have permission to access tool administration.", 
                            'Anda tidak memiliki izin untuk mengakses administrasi alat.'
                        )}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3 mb-2">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                                <Wrench className="h-8 w-8" />
                            </div>
                            <span>{getText('Equipment Management', 'Manajemen Peralatan')}</span>
                        </h1>
                        <p className="text-lg opacity-90">
                            {getText('Manage your laboratory and classroom equipment', 'Kelola peralatan laboratorium dan ruang kelas Anda')}
                        </p>
                        <div className="mt-3 flex items-center space-x-4 text-sm">
                            <div className="flex items-center space-x-2 opacity-80">
                                <Package className="h-4 w-4" />
                                <span>{getText('Total', 'Total')}: {equipment.length}</span>
                            </div>
                            <div className="flex items-center space-x-2 opacity-80">
                                <CheckCircle className="h-4 w-4" />
                                <span>{getText('Available', 'Tersedia')}: {equipment.filter(eq => eq.is_available).length}</span>
                            </div>
                            <div className="flex items-center space-x-2 opacity-80">
                                <AlertTriangle className="h-4 w-4" />
                                <span>{getText('Good Condition', 'Kondisi Baik')}: {equipment.filter(eq => eq.condition === 'GOOD').length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="hidden lg:block text-right">
                        <div className="text-4xl font-bold opacity-90">{equipment.length}</div>
                        <div className="text-sm opacity-70">{getText('Total Equipment', 'Total Peralatan')}</div>
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
                            placeholder={getText('Search equipment...', 'Cari peralatan...')} 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                        <select 
                            value={categoryFilter} 
                            onChange={(e) => setCategoryFilter(e.target.value)} 
                            className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none bg-white text-sm"
                        >
                            <option value="all">{getText('All Categories', 'Semua Kategori')}</option>
                            {categories.map(cat => (
                                <option key={cat.name} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>

                        <select 
                            value={roomFilter} 
                            onChange={(e) => setRoomFilter(e.target.value)} 
                            className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none bg-white text-sm"
                        >
                            <option value="all">{getText('All Locations', 'Semua Lokasi')}</option>
                            {rooms.map(room => (
                                <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                        </select>

                        <button 
                            onClick={() => fetchEquipment()} 
                            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                            title={getText('Refresh', 'Segarkan')}
                        >
                            <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        <button 
                            onClick={() => { 
                                setEditingEquipment(null); 
                                setSelectedRoom(null);
                                setRoomSearchTerm('');
                                form.reset({ is_available: true, condition: 'GOOD', quantity: 1 }); 
                                setShowModal(true); 
                            }} 
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                            <Plus className="h-4 w-4" />
                            <span>{getText('Add Equipment', 'Tambah Peralatan')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Equipment Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {loading && (
                    Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 animate-pulse">
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
                        <h3 className="text-xl font-semibold mb-2">
                            {getText('No Equipment Found', 'Tidak Ada Peralatan Ditemukan')}
                        </h3>
                        <p>{getText('Try adjusting your search or filters', 'Coba sesuaikan pencarian atau filter Anda')}</p>
                    </div>
                )}

                {!loading && filteredEquipment.map(eq => {
                    const categoryConfig = getCategoryConfig(eq.category);
                    const CategoryIcon = categoryConfig.icon;
                    
                    return (
                        <div key={eq.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`p-2 rounded-lg bg-gradient-to-r ${categoryConfig.color} text-white`}>
                                        <CategoryIcon className="h-5 w-5" />
                                    </div>
                                    {getStatusChip(eq.condition, eq.is_mandatory)}
                                </div>
                                
                                <h3 className="font-semibold text-lg text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                                    {eq.name}
                                </h3>
                                
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                        {eq.code}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm mb-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">{getText('Category', 'Kategori')}</span>
                                        <span className="font-medium text-gray-900">{eq.category}</span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">{getText('Location', 'Lokasi')}</span>
                                        <span className="font-medium text-gray-900">
                                            {eq.rooms?.name || getText('Unassigned', 'Belum Ditentukan')}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">{getText('Quantity', 'Jumlah')}</span>
                                        <span className="font-medium text-gray-900">
                                            {eq.quantity} {eq.unit}
                                        </span>
                                    </div>

                                    {eq.rooms?.department?.name && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-600">{getText('Department', 'Departemen')}</span>
                                            <span className="font-medium text-gray-900">
                                                {eq.rooms.department.name}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                    <button 
                                        onClick={() => handleViewDetails(eq)} 
                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium transition-colors text-sm"
                                        title={getText('View Details & Lending', 'Lihat Detail & Peminjaman')}
                                    >
                                        <Eye className="h-4 w-4" />
                                        <span>{getText('View', 'Lihat')}</span>
                                    </button>
                                    
                                    <div className="flex items-center space-x-1">
                                        <button 
                                            onClick={() => handleEdit(eq)} 
                                            className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                                            title={getText('Edit', 'Edit')}
                                        >
                                            <Edit className="h-3 w-3" />
                                        </button>
                                        <button 
                                            onClick={() => setShowDeleteConfirm(eq.id)} 
                                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                            title={getText('Delete', 'Hapus')}
                                        >
                                            <Trash2 className="h-3 w-3" />
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
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-bold flex items-center gap-3">
                                    <Wrench className="h-6 w-6" />
                                    {editingEquipment ? 
                                        getText('Edit Equipment', 'Edit Peralatan') : 
                                        getText('Add New Equipment', 'Tambah Peralatan Baru')
                                    }
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
                                    <label className="block text-sm font-semibold text-gray-700">
                                        {getText('Equipment Name', 'Nama Peralatan')} *
                                    </label>
                                    <input 
                                        {...form.register('name')} 
                                        className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors" 
                                        placeholder={getText('Enter equipment name', 'Masukkan nama peralatan')}
                                    />
                                    {form.formState.errors.name && (
                                        <p className="text-red-500 text-sm flex items-center gap-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            {form.formState.errors.name.message}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">
                                        {getText('Equipment Code', 'Kode Peralatan')} *
                                    </label>
                                    <input 
                                        {...form.register('code')} 
                                        className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors font-mono" 
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
                                <label className="block text-sm font-semibold text-gray-700">
                                    {getText('Category', 'Kategori')} *
                                </label>
                                <select 
                                    {...form.register('category')} 
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
                                >
                                    <option value="">{getText('Select Category', 'Pilih Kategori')}</option>
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

                            {/* Room Location with Search Dropdown - MANDATORY for Department Admin */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    {getText('Room Location', 'Lokasi Ruangan')} *
                                    {profile?.role === 'department_admin' && (
                                        <span className="text-red-500 ml-1">
                                            ({getText('Required for department admin', 'Wajib untuk admin departemen')})
                                        </span>
                                    )}
                                </label>
                                <div className="relative">
                                    <div className="flex items-center">
                                        <input
                                            type="text"
                                            value={roomSearchTerm}
                                            onChange={(e) => {
                                                setRoomSearchTerm(e.target.value);
                                                setShowRoomDropdown(true);
                                            }}
                                            onFocus={() => setShowRoomDropdown(true)}
                                            placeholder={getText(
                                                profile?.role === 'department_admin' 
                                                    ? 'Search rooms in your department...' 
                                                    : 'Search for a room...', 
                                                profile?.role === 'department_admin' 
                                                    ? 'Cari ruangan di departemen Anda...' 
                                                    : 'Cari ruangan...'
                                            )}
                                            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors pr-20"
                                        />
                                        <div className="absolute right-2 flex items-center gap-1">
                                            {selectedRoom && (
                                                <button
                                                    type="button"
                                                    onClick={clearRoomSelection}
                                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                    title={getText('Clear selection', 'Hapus pilihan')}
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setShowRoomDropdown(!showRoomDropdown)}
                                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showRoomDropdown ? 
                                                    <ChevronUp className="h-4 w-4" /> : 
                                                    <ChevronDown className="h-4 w-4" />
                                                }
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Dropdown */}
                                    {showRoomDropdown && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {filteredRooms.length === 0 ? (
                                                <div className="p-3 text-gray-500 text-center">
                                                    {getText('No rooms found', 'Tidak ada ruangan ditemukan')}
                                                    {profile?.role === 'department_admin' && (
                                                        <div className="text-xs mt-1">
                                                            {getText('Only rooms in your department are shown', 'Hanya ruangan di departemen Anda yang ditampilkan')}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                filteredRooms.map((room) => (
                                                    <button
                                                        key={room.id}
                                                        type="button"
                                                        onClick={() => handleRoomSelect(room)}
                                                        className={`w-full text-left p-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                                                            selectedRoom?.id === room.id ? 'bg-blue-50 border-blue-200' : ''
                                                        }`}
                                                    >
                                                        <div className="font-medium text-gray-900">{room.name}</div>
                                                        <div className="text-sm text-gray-500">
                                                            {getText('Code', 'Kode')}: {room.code} | {getText('Capacity', 'Kapasitas')}: {room.capacity}
                                                            {room.department && (
                                                                <span className="ml-2 text-blue-600">
                                                                    ({room.department.name})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Selected Room Display */}
                                    {selectedRoom && (
                                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium text-blue-900">{selectedRoom.name}</div>
                                                    <div className="text-sm text-blue-600">
                                                        {getText('Code', 'Kode')}: {selectedRoom.code} | {getText('Capacity', 'Kapasitas')}: {selectedRoom.capacity}
                                                        {selectedRoom.department && (
                                                            <span className="ml-2">
                                                                ({selectedRoom.department.name})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={clearRoomSelection}
                                                    className="text-blue-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {form.formState.errors.rooms_id && (
                                    <p className="text-red-500 text-sm flex items-center gap-1">
                                        <AlertTriangle className="h-4 w-4" />
                                        {profile?.role === 'department_admin' 
                                            ? getText('Please select a room from your department', 'Pilih ruangan dari departemen Anda')
                                            : getText('Please select a room', 'Pilih ruangan')
                                        }
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">
                                        {getText('Quantity', 'Jumlah')} *
                                    </label>
                                    <input 
                                        type="number" 
                                        {...form.register('quantity', {valueAsNumber: true})} 
                                        className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors" 
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
                                    <label className="block text-sm font-semibold text-gray-700">
                                        {getText('Unit', 'Satuan')} *
                                    </label>
                                    <input 
                                        {...form.register('unit')} 
                                        placeholder={getText('e.g. pcs, set, unit', 'mis. pcs, set, unit')} 
                                        className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors" 
                                    />
                                    {form.formState.errors.unit && (
                                        <p className="text-red-500 text-sm flex items-center gap-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            {form.formState.errors.unit.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    {getText('Condition', 'Kondisi')} *
                                </label>
                                <select 
                                    {...form.register('condition')} 
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
                                >
                                    <option value="GOOD">{getText('Good Condition', 'Kondisi Baik')}</option>
                                    <option value="BROKEN">{getText('Broken', 'Rusak')}</option>
                                    <option value="MAINTENANCE">{getText('Under Maintenance', 'Dalam Pemeliharaan')}</option>
                                </select>
                                {form.formState.errors.condition && (
                                    <p className="text-red-500 text-sm flex items-center gap-1">
                                        <AlertTriangle className="h-4 w-4" />
                                        {form.formState.errors.condition.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    {getText('Specification', 'Spesifikasi')}
                                </label>
                                <textarea 
                                    {...form.register('Spesification')} 
                                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors" 
                                    rows={4}
                                    placeholder={getText('Enter detailed specifications...', 'Masukkan spesifikasi detail...')}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex items-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                                    <input 
                                        {...form.register('is_mandatory')} 
                                        type="checkbox" 
                                        className="h-5 w-5 text-amber-600 border-2 border-amber-300 rounded focus:ring-amber-500" 
                                    />
                                    <div className="ml-3">
                                        <label className="text-sm font-semibold text-amber-800">
                                            {getText('Mandatory Equipment', 'Peralatan Wajib')}
                                        </label>
                                        <p className="text-xs text-amber-600">
                                            {getText('Required for room bookings', 'Diperlukan untuk pemesanan ruangan')}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center p-4 bg-green-50 rounded-lg border border-green-200">
                                    <input 
                                        {...form.register('is_available')} 
                                        type="checkbox" 
                                        className="h-5 w-5 text-green-600 border-2 border-green-300 rounded focus:ring-green-500" 
                                    />
                                    <div className="ml-3">
                                        <label className="text-sm font-semibold text-green-800">
                                            {getText('Available for Lending', 'Tersedia untuk Dipinjam')}
                                        </label>
                                        <p className="text-xs text-green-600">
                                            {getText('Can be borrowed by users', 'Dapat dipinjam oleh pengguna')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)} 
                                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                                >
                                    {getText('Cancel', 'Batal')}
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={loading} 
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            {getText('Saving...', 'Menyimpan...')}
                                        </div>
                                    ) : (
                                        editingEquipment ? 
                                        getText('Update Equipment', 'Perbarui Peralatan') : 
                                        getText('Create Equipment', 'Buat Peralatan')
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Equipment Detail Modal with Enhanced Lending Tracking */}
            {selectedEquipment && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 p-6 text-white">
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
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-8 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Equipment Details */}
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <Package className="h-5 w-5 text-blue-600" />
                                            {getText('Equipment Details', 'Detail Peralatan')}
                                        </h3>
                                        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">
                                                    {getText('Category', 'Kategori')}
                                                </span>
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
                                                <span className="text-sm font-semibold text-gray-600">
                                                    {getText('Condition', 'Kondisi')}
                                                </span>
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
                                                <span className="text-sm font-semibold text-gray-600">
                                                    {getText('Status', 'Status')}
                                                </span>
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
                                                <span className="text-sm font-semibold text-gray-600">
                                                    {getText('Location', 'Lokasi')}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4 text-gray-600" />
                                                    <span className="font-semibold text-gray-900">
                                                        {selectedEquipment.rooms?.name || getText('Unassigned', 'Belum Ditentukan')}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">
                                                    {getText('Department', 'Departemen')}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Building className="h-4 w-4 text-gray-600" />
                                                    <span className="font-semibold text-gray-900">
                                                        {selectedEquipment.rooms?.department?.name || 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-semibold text-gray-600">
                                                    {getText('Quantity', 'Jumlah')}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-gray-600" />
                                                    <span className="font-bold text-lg text-gray-900">
                                                        {selectedEquipment.quantity} {selectedEquipment.unit}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
        </div>
    );
};

export default ToolAdministration;