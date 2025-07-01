import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Wrench, Plus, Search, Edit, Trash2, Eye, Package, AlertCircle, RefreshCw, X, 
    Camera, Cpu, Wifi, Zap, FlaskConical, Armchair, Shield,
    MapPin, Hash, Layers, CheckCircle, XCircle, Star, AlertTriangle, Building,
    User, Phone, CreditCard, Clock, Calendar, Users, Activity, TrendingUp,
    ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Equipment, Room, Department, User as UserType } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

// Conditional schema based on user role
const createEquipmentSchema = (userRole: string) => {
  const baseSchema = {
    name: z.string().min(2, 'Equipment name must be at least 2 characters'),
    code: z.string().min(2, 'Equipment code must be at least 2 characters'),
    category: z.string().min(1, 'Please select a category'),
    is_mandatory: z.boolean().optional(),
    is_available: z.boolean().optional(),
    condition: z.enum(['GOOD', 'BROKEN', 'MAINTENANCE']).default('GOOD'),
    Spesification: z.string().optional(),
    quantity: z.number().min(0, 'Quantity cannot be negative'),
    unit: z.string().min(1, 'Unit is required (e.g., pcs, set)'),
  };

  // Conditional rooms_id validation
  if (userRole === 'super_admin') {
    return z.object({
      ...baseSchema,
      rooms_id: z.string().optional().nullable(), // Optional for super admin
    });
  } else {
    return z.object({
      ...baseSchema,
      rooms_id: z.string().min(1, 'Please select a room location'), // Required for department admin
    });
  }
};

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
    
    // Create conditional schema based on user role
    const equipmentSchema = useMemo(() => 
        createEquipmentSchema(profile?.role || 'department_admin'), 
        [profile?.role]
    );
    
    type EquipmentForm = z.infer<typeof equipmentSchema>;
    
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

    // Debug logging for department admin
    useEffect(() => {
        if (profile?.role === 'department_admin') {
            console.log('🔍 Department Admin Profile:', {
                role: profile.role,
                department_id: profile.department_id,
                full_name: profile.full_name,
                email: profile.email
            });
        }
    }, [profile]);

    useEffect(() => {
        if (profile) {
            fetchRooms();
            fetchEquipment();
        }
    }, [profile]);

    const fetchRooms = async () => {
        try {
            console.log('🏢 Fetching rooms for profile:', profile?.role, profile?.department_id);
            
            if (profile?.role === 'department_admin' && profile.department_id) {
                // For department admin, only get rooms in their department
                const { data, error } = await supabase
                    .from('rooms')
                    .select('*, department:departments(*)')
                    .eq('department_id', profile.department_id)
                    .order('name');
                
                if (error) throw error;
                console.log('🏢 Department admin rooms:', data?.length, 'rooms found');
                console.log('🏢 Rooms data:', data);
                setRooms(data || []);
                
                if (!data || data.length === 0) {
                    toast.error(getText(
                        'No rooms found in your department. Please contact administrator.',
                        'Tidak ada ruangan ditemukan di departemen Anda. Silakan hubungi administrator.'
                    ));
                }
            } else if (profile?.role === 'super_admin') {
                // For super admin, get all rooms
                const { data, error } = await supabase
                    .from('rooms')
                    .select('*, department:departments(*)')
                    .order('name');
                
                if (error) throw error;
                console.log('🏢 Super admin rooms:', data?.length, 'rooms found');
                setRooms(data || []);
            } else {
                // For other roles, no rooms
                console.log('🏢 No rooms for role:', profile?.role);
                setRooms([]);
            }
        } catch (error) {
            console.error('❌ Error fetching rooms:', error);
            toast.error(getText('Failed to load rooms', 'Gagal memuat ruangan'));
            setRooms([]);
        }
    };

    const fetchEquipment = async () => {
        try {
            setLoading(true);
            console.log('🔧 Fetching equipment for profile:', profile?.role, profile?.department_id);
            
            if (profile?.role === 'department_admin' && profile.department_id) {
                // Step 1: Get all room IDs in the department
                const { data: departmentRooms, error: roomError } = await supabase
                    .from('rooms')
                    .select('id, name, code')
                    .eq('department_id', profile.department_id);
                
                if (roomError) throw roomError;
                
                console.log('🔧 Department rooms for equipment:', departmentRooms?.length, 'rooms');
                console.log('🔧 Room IDs:', departmentRooms?.map(r => r.id));
                
                if (departmentRooms && departmentRooms.length > 0) {
                    const roomIds = departmentRooms.map(room => room.id);
                    
                    // Step 2: Get equipment only from those rooms
                    const { data, error } = await supabase
                        .from('equipment')
                        .select(`
                            *,
                            rooms (
                                id,
                                name,
                                code,
                                department_id,
                                department:departments(
                                    id,
                                    name,
                                    code
                                )
                            )
                        `)
                        .in('rooms_id', roomIds)
                        .not('rooms_id', 'is', null)
                        .order('created_at', { ascending: false });
                    
                    if (error) throw error;
                    console.log('🔧 Department admin equipment:', data?.length, 'items found');
                    console.log('🔧 Equipment data:', data);
                    setEquipment(data || []);
                    
                    if (!data || data.length === 0) {
                        toast.info(getText(
                            'No equipment found in your department rooms. Add some equipment to get started.',
                            'Tidak ada peralatan ditemukan di ruangan departemen Anda. Tambahkan peralatan untuk memulai.'
                        ));
                    }
                } else {
                    // No rooms in department, no equipment
                    console.log('🔧 No rooms in department, no equipment shown');
                    setEquipment([]);
                    toast.warning(getText(
                        'No rooms assigned to your department. Please contact administrator.',
                        'Tidak ada ruangan yang ditugaskan ke departemen Anda. Silakan hubungi administrator.'
                    ));
                }
            } else if (profile?.role === 'super_admin') {
                // For super admin, get all equipment (including those without rooms)
                const { data, error } = await supabase
                    .from('equipment')
                    .select(`
                        *,
                        rooms (
                            id,
                            name,
                            code,
                            department_id,
                            department:departments(
                                id,
                                name,
                                code
                            )
                        )
                    `)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                console.log('🔧 Super admin equipment:', data?.length, 'items found');
                setEquipment(data || []);
            } else {
                // For other roles, no equipment
                console.log('🔧 No equipment for role:', profile?.role);
                setEquipment([]);
            }
        } catch (error) {
            console.error('❌ Error fetching equipment:', error);
            toast.error(getText('Failed to load equipment', 'Gagal memuat peralatan'));
            setEquipment([]);
        } finally { 
            setLoading(false); 
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
                                lendingDetail.returned_quantity = 0;
                                lendingDetail.missing_quantity = lendingDetail.borrowed_quantity;
                            }
                        } else {
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
                        borrowed_quantity: 1,
                        returned_quantity: 0,
                        missing_quantity: 1,
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
            
            // Validate room belongs to department for department admin
            if (profile?.role === 'department_admin' && profile.department_id && data.rooms_id) {
                const selectedRoomData = rooms.find(r => r.id === data.rooms_id);
                if (!selectedRoomData || selectedRoomData.department_id !== profile.department_id) {
                    toast.error(getText(
                        'You can only assign equipment to rooms in your department.',
                        'Anda hanya dapat menugaskan peralatan ke ruangan di departemen Anda.'
                    ));
                    return;
                }
            }
            
            const equipmentData = {
                name: data.name,
                code: data.code.toUpperCase(),
                category: data.category,
                is_mandatory: data.is_mandatory,
                is_available: data.is_available,
                condition: data.condition,
                rooms_id: data.rooms_id || null, // Allow null for super admin
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
        setRoomSearchTerm(eq.rooms?.name || (eq.rooms_id ? '' : getText('No Room Assigned', 'Tanpa Ruangan')));
        form.reset({
            name: eq.name,
            code: eq.code,
            category: eq.category,
            is_mandatory: eq.is_mandatory,
            is_available: eq.is_available,
            condition: eq.condition,
            rooms_id: eq.rooms_id || '',
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

    const handleNoRoomAssignment = () => {
        setSelectedRoom(null);
        form.setValue('rooms_id', '');
        setRoomSearchTerm(getText('No Room Assigned', 'Tanpa Ruangan'));
        setShowRoomDropdown(false);
    };

    // Filter rooms for department admin
    const filteredRooms = rooms.filter(room => {
        const matchesSearch = room.name.toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
                            room.code.toLowerCase().includes(roomSearchTerm.toLowerCase());
        
        // Additional check for department admin
        if (profile?.role === 'department_admin' && profile.department_id) {
            const matchesDepartment = room.department_id === profile.department_id;
            return matchesSearch && matchesDepartment;
        }
        
        return matchesSearch;
    });

    // Filter rooms for main filter dropdown
    const availableRoomsForFilter = rooms.filter(room => {
        if (profile?.role === 'department_admin' && profile.department_id) {
            return room.department_id === profile.department_id;
        }
        return true;
    });

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

    // Show loading state while profile is being loaded
    if (!profile) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-600">
                        {getText('Loading profile...', 'Memuat profil...')}
                    </p>
                </div>
            </div>
        );
    }

    // Enhanced access control check
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
                    <div className="mt-4 text-sm text-gray-500">
                        {getText('Current role', 'Peran saat ini')}: {profile?.role || 'None'}
                    </div>
                </div>
            </div>
        );
    }

    // Check if department admin has department_id
    if (profile?.role === 'department_admin' && !profile.department_id) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {getText('Department Not Assigned', 'Departemen Belum Ditentukan')}
                    </h3>
                    <p className="text-gray-600">
                        {getText(
                            'Your account is not assigned to any department. Please contact the system administrator.',
                            'Akun Anda belum ditugaskan ke departemen manapun. Silakan hubungi administrator sistem.'
                        )}
                    </p>
                    <div className="mt-4 text-sm text-gray-500">
                        {getText('User ID', 'ID Pengguna')}: {profile.id}
                    </div>
                  </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setRoomSearchTerm('')}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                
                                {/* Conditional error message */}
                                {form.formState.errors.rooms_id && profile?.role === 'department_admin' && (
                                    <p className="text-red-500 text-sm flex items-center gap-1">
                                        <AlertTriangle className="h-4 w-4" />
                                        {getText('Please select a room location', 'Pilih lokasi ruangan')}
                                    </p>
                                )}
                                
                                {/* Warning for department admin */}
                                {rooms.length === 0 && profile?.role === 'department_admin' && (
                                    <p className="text-amber-600 text-sm flex items-center gap-1">
                                        <AlertTriangle className="h-4 w-4" />
                                        {getText('No rooms available in your department. Contact administrator.', 'Tidak ada ruangan tersedia di departemen Anda. Hubungi administrator.')}
                                    </p>
                                )}
                                
                                {/* Info for super admin */}
                                {profile?.role === 'super_admin' && (
                                    <p className="text-blue-600 text-xs flex items-center gap-1 mt-1">
                                        <Info className="h-3 w-3" />
                                        {getText(
                                            'Super admins can create equipment without room assignment for general inventory.',
                                            'Super admin dapat membuat peralatan tanpa penugasan ruangan untuk inventaris umum.'
                                        )}
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
                                    disabled={loading || (profile?.role === 'department_admin' && rooms.length === 0)} 
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
                                        {selectedEquipment.rooms?.department && (
                                            <span className="ml-4 px-2 py-1 bg-white bg-opacity-20 rounded text-sm">
                                                {selectedEquipment.rooms.department.name}
                                            </span>
                                        )}
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
                                                    <span className="font-semibold text-blue-600">
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
                                                <span className="text-sm font-semibold text-gray-600">
                                                    {getText('Created', 'Dibuat')}
                                                </span>
                                                <span className="text-sm text-gray-700">
                                                    {format(new Date(selectedEquipment.created_at), 'MMM d, yyyy')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <Wrench className="h-5 w-5 text-blue-600" />
                                            {getText('Quick Actions', 'Aksi Cepat')}
                                        </h3>
                                        <div className="grid grid-cols-1 gap-3">
                                            <button 
                                                onClick={() => {
                                                    setSelectedEquipment(null);
                                                    handleEdit(selectedEquipment);
                                                }}
                                                className="flex items-center justify-center gap-2 p-4 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors"
                                            >
                                                <Edit className="h-5 w-5" />
                                                <span className="font-semibold">
                                                    {getText('Edit Equipment', 'Edit Peralatan')}
                                                </span>
                                            </button>
                                            
                                            <button 
                                                onClick={() => {
                                                    setSelectedEquipment(null);
                                                    setShowDeleteConfirm(selectedEquipment.id);
                                                }}
                                                className="flex items-center justify-center gap-2 p-4 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                                <span className="font-semibold">
                                                    {getText('Delete Equipment', 'Hapus Peralatan')}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Enhanced Missing Items Tracking */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                            {getText('Missing Equipment Tracking', 'Pelacakan Peralatan Hilang')}
                                            {loadingLending && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
                                        </h3>
                                        
                                        {loadingLending ? (
                                            <div className="bg-gray-50 rounded-lg p-8 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
                                                <p className="text-gray-600">
                                                    {getText('Loading missing items details...', 'Memuat detail barang hilang...')}
                                                </p>
                                            </div>
                                        ) : lendingDetails.length === 0 ? (
                                            <div className="bg-green-50 rounded-lg p-8 text-center border border-green-200">
                                                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                                                <h4 className="text-lg font-medium text-green-800 mb-2">
                                                    {getText('All Equipment Returned!', 'Semua Peralatan Dikembalikan!')}
                                                </h4>
                                                <p className="text-green-600">
                                                    {getText(
                                                        'No missing items for this equipment. All borrowed items have been returned successfully.',
                                                        'Tidak ada barang hilang untuk peralatan ini. Semua barang yang dipinjam telah dikembalikan dengan sukses.'
                                                    )}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {/* Header for Missing Items */}
                                                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center">
                                                            <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
                                                            <div>
                                                                <h4 className="text-lg font-semibold text-red-800">
                                                                    {getText('Missing Equipment Alert', 'Peringatan Peralatan Hilang')}
                                                                </h4>
                                                                <p className="text-sm text-red-600">
                                                                    {getText(
                                                                        'The following records show equipment that has not been returned yet.',
                                                                        'Catatan berikut menunjukkan peralatan yang belum dikembalikan.'
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-2xl font-bold text-red-800">
                                                                {lendingDetails.reduce((sum, detail) => sum + detail.missing_quantity, 0)}
                                                            </div>
                                                            <div className="text-sm text-red-600">
                                                                {getText('Missing Items', 'Barang Hilang')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Missing Items Records */}
                                                <div className="space-y-3">
                                                    {lendingDetails.map((detail) => (
                                                        <div key={detail.id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex items-start space-x-4">
                                                                    <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${detail.source === 'booking' ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gradient-to-r from-red-500 to-pink-500'}`}>
                                                                        {detail.source === 'booking' ? <Building className="h-6 w-6 text-white" /> : <User className="h-6 w-6 text-white" />}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <h4 className="font-semibold text-gray-900">
                                                                            {detail.user?.full_name || getText('Unknown User', 'Pengguna Tidak Dikenal')}
                                                                        </h4>
                                                                        <div className="space-y-1 mt-2">
                                                                            <div className="flex items-center text-sm text-gray-600">
                                                                                <CreditCard className="h-4 w-4 mr-2" />
                                                                                ID: {detail.user?.identity_number || 'N/A'}
                                                                            </div>
                                                                            <div className="flex items-center text-sm text-gray-600">
                                                                                <Phone className="h-4 w-4 mr-2" />
                                                                                {detail.user?.phone_number || getText('No phone', 'Tidak ada telepon')}
                                                                            </div>
                                                                            <div className="flex items-center text-sm text-gray-600">
                                                                                <Calendar className="h-4 w-4 mr-2" />
                                                                                {getText('Borrowed', 'Dipinjam')}: {format(new Date(detail.date), 'MMM d, yyyy h:mm a')}
                                                                            </div>
                                                                            {detail.checkout && (
                                                                                <div className="flex items-center text-sm text-gray-600">
                                                                                    <Clock className="h-4 w-4 mr-2" />
                                                                                    {getText('Expected Return', 'Pengembalian Diharapkan')}: {format(new Date(detail.checkout.expected_return_date), 'MMM d, yyyy h:mm a')}
                                                                                </div>
                                                                            )}
                                                                            <div className={`flex items-center text-sm font-medium ${detail.source === 'booking' ? 'text-purple-600' : 'text-blue-600'}`}>
                                                                                {detail.source === 'booking' ? <Building className="h-4 w-4 mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                                                                                {getText('Source', 'Sumber')}: {detail.source === 'booking' ? getText('Room Booking', 'Pemesanan Ruangan') : getText('Lending Tool', 'Peminjaman Alat')}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="text-right">
                                                                    <div className="text-center mb-3">
                                                                        <div className="text-3xl font-bold text-red-600">{detail.missing_quantity}</div>
                                                                        <div className="text-sm text-red-600">
                                                                            {getText('Missing', 'Hilang')} {selectedEquipment.unit}
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border bg-red-100 text-red-800 border-red-200">
                                                                        {getText('NEEDS RETURN', 'PERLU DIKEMBALIKAN')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-md">
                                                                <div className="flex items-center">
                                                                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                                                                    <span className="text-sm font-medium text-red-800">
                                                                        {detail.missing_quantity} {selectedEquipment.unit} {getText('borrowed and needs to be returned', 'dipinjam dan perlu dikembalikan')}
                                                                        {detail.source === 'booking' ? 
                                                                            ` (${getText('from room booking', 'dari pemesanan ruangan')})` : 
                                                                            ` (${getText('from lending tool', 'dari peminjaman alat')})`
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
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
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center mb-6">
                            <div className="flex-shrink-0 p-3 bg-red-100 rounded-full">
                                <AlertCircle className="h-8 w-8 text-red-600" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-xl font-bold text-gray-900">
                                    {getText('Delete Equipment', 'Hapus Peralatan')}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    {getText('This action cannot be undone', 'Tindakan ini tidak dapat dibatalkan')}
                                </p>
                            </div>
                        </div>
                        
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <p className="text-sm text-red-800">
                                {getText(
                                    'Are you sure you want to delete this equipment? This action will permanently remove the equipment from the system and may affect related booking records.',
                                    'Apakah Anda yakin ingin menghapus peralatan ini? Tindakan ini akan menghapus peralatan secara permanen dari sistem dan mungkin mempengaruhi catatan pemesanan terkait.'
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
                                onClick={() => handleDelete(showDeleteConfirm)}