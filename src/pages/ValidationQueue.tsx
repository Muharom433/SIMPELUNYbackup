import React, { useState, useEffect, useCallback } from 'react';
import {
    Bell, Clock, CheckCircle, XCircle, AlertTriangle, User, Building, Calendar,
    Timer, Eye, Check, X, RefreshCw, Filter, Search, FileText, Zap, Users, Package,
    Flag, AlertCircle as AlertCircleIcon, Phone, Wrench, Trash2, Plus, Minus,
    ChevronDown, ChevronUp, ArrowRight, Calculator, Info, Award
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, compareAsc, startOfDay, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import EquipmentQuantityManager from '../lib/equipmentQuantityManager';

// ===== ENHANCED TYPE DEFINITIONS =====
interface Equipment {
    id: string;
    name: string;
    code?: string;
    category?: string;
    quantity?: number;
    unit?: string;
    is_mandatory: boolean;
}

interface CheckoutWithDetails {
    id: string;
    user_id: string;
    booking_id?: string;
    lendingTool_id?: string;
    checkout_date: string;
    expected_return_date: string;
    status: 'returned' | 'active' | 'overdue' | 'pending';
    type: 'room' | 'things';
    created_at: string;
    has_violations?: boolean;
    user?: {
        id: string;
        full_name: string;
        identity_number: string;
        phone_number?: string;
        email?: string;
    };
    booking?: {
        id: string;
        purpose: string;
        equipment_requested: string[];
        equipment_quantities: number[];
        room?: {
            name: string;
            code: string;
            department?: { name: string };
        };
    };
    lendingTool?: {
        id: string;
        id_equipment: string[];
        qty: number[];
        date: string;
        equipment_details?: Array<{
            id: string;
            name: string;
            code: string;
            category: string;
            borrowed_quantity: number;
        }>;
    };
    equipment_list?: Equipment[];
    verification_items?: VerificationItem[];
    has_report?: boolean;
    report?: {
        id: string;
        title: string;
        description: string;
        severity: 'minor' | 'major' | 'critical';
    };
}

interface VerificationItem {
    equipment_id: string;
    equipment_name: string;
    equipment_code?: string;
    equipment_unit?: string;
    borrowed_quantity: number;
    returned_quantity: number;
    is_verified: boolean;
    condition_notes?: string;
    is_mandatory: boolean;
}

// Tipe untuk data laporan yang sesuai dengan constraint database
type ViolationType = 'late_return' | 'damage' | 'loss' | 'misuse' | 'other';

const ValidationQueue: React.FC = () => {
    const { profile } = useAuth();
    
    const [activeTab, setActiveTab] = useState<'room' | 'equipment'>('room');
    const [checkouts, setCheckouts] = useState<CheckoutWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCheckout, setSelectedCheckout] = useState<CheckoutWithDetails | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([]);
    const [showReportModal, setShowReportModal] = useState(false);
    
    // ✅ FIXED: State untuk report disesuaikan dengan constraint baru
    const [reportData, setReportData] = useState({
        title: '',
        description: '',
        severity: 'minor' as 'minor' | 'major' | 'critical',
        violation_type: 'damage' as ViolationType // Default value
    });
    
    const [statusFilter, setStatusFilter] = useState<'all' | 'returned' | 'active' | 'overdue' | 'pending'>('returned');

    // ===== FETCH EQUIPMENT LIST FOR CHECKOUT =====
    const fetchEquipmentList = async (checkout: CheckoutWithDetails): Promise<Equipment[]> => {
        try {
            let equipmentIds: string[] = [];
            
            if (checkout.type === 'room' && checkout.booking?.equipment_requested) {
                equipmentIds = checkout.booking.equipment_requested;
            } else if (checkout.type === 'things' && checkout.lendingTool?.id_equipment) {
                equipmentIds = checkout.lendingTool.id_equipment;
            }

            if (equipmentIds.length === 0) return [];

            const { data, error } = await supabase
                .from('equipment')
                .select('id, name, code, category, unit, is_mandatory')
                .in('id', equipmentIds);

            if (error) throw error;
            return data || [];
            
        } catch (error) {
            console.error('Error fetching equipment list:', error);
            return [];
        }
    };

    // ===== FETCH VERIFICATION ITEMS =====
    const fetchVerificationItems = async (
        checkoutId: string, 
        equipmentList: Equipment[], 
        checkout: CheckoutWithDetails
    ): Promise<VerificationItem[]> => {
        try {
            const { data: checkoutItems, error } = await supabase
                .from('checkout_items')
                .select('*')
                .eq('checkout_id', checkoutId);

            if (error) throw error;

            return equipmentList.map(equipment => {
                const checkoutItem = checkoutItems?.find(item => item.equipment_id === equipment.id);
                
                let borrowedQty = 1; // Default
                
                if (checkout.type === 'room' && checkout.booking) {
                    const equipmentIndices: number[] = [];
                    checkout.booking.equipment_requested?.forEach((id: string, index: number) => {
                        if (id === equipment.id) {
                            equipmentIndices.push(index);
                        }
                    });

                    borrowedQty = equipmentIndices.reduce((total, index) => {
                        const qty = checkout.booking.equipment_quantities?.[index] || 1;
                        return total + qty;
                    }, 0);

                    if (borrowedQty === 0 && equipmentIndices.length > 0) {
                        borrowedQty = equipmentIndices.length;
                    }
                    
                } else if (checkout.type === 'things' && checkout.lendingTool) {
                    const equipmentIndices: number[] = [];
                    checkout.lendingTool.id_equipment?.forEach((id: string, index: number) => {
                        if (id === equipment.id) {
                            equipmentIndices.push(index);
                        }
                    });

                    borrowedQty = equipmentIndices.reduce((total, index) => {
                        const qty = checkout.lendingTool.qty?.[index] || 1;
                        return total + qty;
                    }, 0);

                    if (borrowedQty === 0 && equipmentIndices.length > 0) {
                        borrowedQty = equipmentIndices.length;
                    }
                }

                const verificationItem: VerificationItem = {
                    equipment_id: equipment.id,
                    equipment_name: equipment.name,
                    equipment_code: equipment.code,
                    equipment_unit: equipment.unit || 'pcs',
                    borrowed_quantity: borrowedQty,
                    returned_quantity: checkoutItem?.quantity || 0,
                    is_verified: !!checkoutItem,
                    condition_notes: checkoutItem?.condition_notes || '',
                    is_mandatory: equipment.is_mandatory
                };

                return verificationItem;
            });
            
        } catch (error) {
            console.error('Error fetching verification items:', error);
            return [];
        }
    };

    // ===== FETCH CHECKOUTS WITH VIOLATION CHECK =====
    const fetchCheckouts = useCallback(async () => {
        try {
            setLoading(true);
            
            let processedData: CheckoutWithDetails[] = [];
            
            if (activeTab === 'room') {
                let query = supabase
                    .from('checkouts')
                    .select(`
                        *,
                        user:users!checkouts_user_id_fkey(
                            id, full_name, identity_number, phone_number, email
                        ),
                        booking:bookings!checkouts_booking_id_fkey(
                            id, purpose, equipment_requested, equipment_quantities,
                            room:rooms(
                                name, code,
                                department:departments(name)
                            )
                        )
                    `)
                    .eq('type', 'room');

                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }

                query = query.order('created_at', { ascending: false });

                const { data: checkoutData, error } = await query;

                if (error) throw error;
                processedData = checkoutData || [];
                
            } else {
                let query = supabase
                    .from('checkouts')
                    .select(`
                        *,
                        user:users!checkouts_user_id_fkey(
                            id, full_name, identity_number, phone_number, email
                        ),
                        lendingTool:lending_tool!checkouts_lendingTool_id_fkey(
                            id, id_equipment, qty, date
                        )
                    `)
                    .eq('type', 'things');

                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }

                query = query.order('created_at', { ascending: false });

                const { data: checkoutData, error } = await query;

                if (error) throw error;
                
                processedData = await Promise.all(
                    (checkoutData || []).map(async (checkout) => {
                        if (checkout.lendingTool?.id_equipment) {
                            const { data: equipmentData } = await supabase
                                .from('equipment')
                                .select('id, name, code, category, unit')
                                .in('id', checkout.lendingTool.id_equipment);
                            
                            if (equipmentData) {
                                checkout.lendingTool.equipment_details = equipmentData.map((eq, index) => ({
                                    ...eq,
                                    borrowed_quantity: checkout.lendingTool.qty[index] || 1
                                }));
                            }
                        }
                        return checkout;
                    })
                );
            }

            if (profile?.role === 'department_admin' && profile.department_id) {
                if (activeTab === 'room') {
                    processedData = processedData.filter(checkout => 
                        checkout.booking?.room?.department?.name
                    );
                }
            }

            const enhancedData = await Promise.all(
                processedData.map(async (checkout) => {
                    const equipment_list = await fetchEquipmentList(checkout);
                    const verification_items = await fetchVerificationItems(
                        checkout.id, 
                        equipment_list, 
                        checkout
                    );

                    const { data: violations, error: violationError } = await supabase
                        .from('checkout_violations')
                        .select('id, severity, status')
                        .eq('checkout_id', checkout.id)
                        .eq('status', 'active');

                    if (violationError) {
                        console.error('Error checking violations:', violationError);
                    }

                    const has_violations = violations && violations.length > 0;
                    
                    return {
                        ...checkout,
                        equipment_list,
                        verification_items,
                        has_violations
                    };
                })
            );

            setCheckouts(enhancedData);
            
        } catch (error: any) {
            console.error('Error fetching checkouts:', error);
            toast.error(`Gagal memuat antrean validasi: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [activeTab, statusFilter, profile]);

    // ===== UPDATE VERIFICATION ITEM WITH EQUIPMENT QUANTITY SYNC =====
    const updateVerificationItem = async (
        checkoutId: string, 
        equipmentId: string, 
        newReturnedQuantity: number, 
        conditionNotes: string,
        isVerified: boolean
    ) => {
        try {
            const { data: currentCheckoutItems, error: fetchError } = await supabase
                .from('checkout_items')
                .select('quantity')
                .eq('checkout_id', checkoutId)
                .eq('equipment_id', equipmentId)
                .maybeSingle();

            if (fetchError) throw fetchError;

            const currentReturnedQty = currentCheckoutItems?.quantity || 0;

            if (isVerified && newReturnedQuantity > 0) {
                const { error } = await supabase
                    .from('checkout_items')
                    .upsert({
                        checkout_id: checkoutId,
                        equipment_id: equipmentId,
                        quantity: newReturnedQuantity,
                        condition_notes: conditionNotes || null
                    }, { 
                        onConflict: 'checkout_id, equipment_id' 
                    });
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('checkout_items')
                    .delete()
                    .match({ checkout_id: checkoutId, equipment_id: equipmentId });
                if (error) throw error;
            }

            const quantityDifference = newReturnedQuantity - currentReturnedQty;
            
            if (quantityDifference !== 0) {
                await updateEquipmentQuantity(equipmentId, quantityDifference);
            }

            if (selectedCheckout) {
                const newVerificationItems = await fetchVerificationItems(
                    selectedCheckout.id, 
                    selectedCheckout.equipment_list || [],
                    selectedCheckout
                );
                setVerificationItems(newVerificationItems);
            }
            
        } catch (error: any) {
            console.error('Error updating verification:', error);
            toast.error(`Gagal memperbarui verifikasi: ${error.message}`);
        }
    };

    // ===== UPDATE EQUIPMENT QUANTITY =====
    const updateEquipmentQuantity = async (equipmentId: string, quantityChange: number) => {
        try {
            const quantityManager = new EquipmentQuantityManager(supabase);
            
            if (quantityChange > 0) {
                await quantityManager.increaseQuantity(
                    equipmentId,
                    quantityChange,
                    'ValidationQueue: User returned items'
                );
            } else if (quantityChange < 0) {
                await quantityManager.decreaseQuantity(
                    equipmentId,
                    Math.abs(quantityChange),
                    'ValidationQueue: Admin reverted verification'
                );
            }
            
        } catch (error) {
            console.error('Error updating equipment quantity:', error);
            throw error;
        }
    };

    // ===== APPROVE RETURN =====
    const handleApproveReturn = async (checkoutId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(checkoutId));

            const { error } = await supabase
                .from('checkouts')
                .update({ 
                    status: 'active',
                    approved_by: profile?.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', checkoutId);

            if (error) throw error;

            const checkout = checkouts.find(c => c.id === checkoutId);
            if (checkout) {
                if (activeTab === 'room' && checkout.booking_id) {
                    await supabase
                        .from('bookings')
                        .update({ status: 'completed' })
                        .eq('id', checkout.booking_id);
                } else if (activeTab === 'equipment' && checkout.lendingTool_id) {
                    await supabase
                        .from('lending_tool')
                        .update({ status: 'completed' })
                        .eq('id', checkout.lendingTool_id);
                }
            }

            toast.success('Pengembalian disetujui! Kuantitas barang sudah diperbarui saat verifikasi.');
            
            fetchCheckouts();
            setShowDetailModal(false);
            
        } catch (error: any) {
            console.error('Error approving return:', error);
            toast.error(`Gagal menyetujui pengembalian: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(checkoutId);
                return newSet;
            });
        }
    };

    // ===== REJECT RETURN =====
    const handleRejectReturn = async (checkoutId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(checkoutId));

            const { data: verifiedItems, error: itemsError } = await supabase
                .from('checkout_items')
                .select('equipment_id, quantity')
                .eq('checkout_id', checkoutId);

            if (itemsError) throw itemsError;

            if (verifiedItems && verifiedItems.length > 0) {
                for (const item of verifiedItems) {
                    if (item.quantity > 0) {
                        await updateEquipmentQuantity(item.equipment_id, -item.quantity);
                    }
                }
            }

            await supabase.from('checkouts').delete().eq('id', checkoutId);
            
            const checkout = checkouts.find(c => c.id === checkoutId);
            if (checkout) {
                if (activeTab === 'room' && checkout.booking_id) {
                    await supabase
                        .from('bookings')
                        .update({ status: 'approved' })
                        .eq('id', checkout.booking_id);
                } else if (activeTab === 'equipment' && checkout.lendingTool_id) {
                    await supabase
                        .from('lending_tool')
                        .update({ status: 'borrow' })
                        .eq('id', checkout.lendingTool_id);
                }
            }

            toast.success('Pengembalian ditolak dan kuantitas dikembalikan.');
            
            fetchCheckouts();
            setShowDetailModal(false);
            setShowDeleteConfirm(null);
            
        } catch (error: any) {
            console.error('Error rejecting return:', error);
            toast.error(`Gagal menolak pengembalian: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(checkoutId);
                return newSet;
            });
        }
    };

    // ===== DELETE CHECKOUT =====
    const handleDeleteCheckout = async (checkoutId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(checkoutId));

            await supabase
                .from('checkout_items')
                .delete()
                .eq('checkout_id', checkoutId);

            await supabase
                .from('checkout_violations')
                .delete()
                .eq('checkout_id', checkoutId);

            await supabase
                .from('checkouts')
                .delete()
                .eq('id', checkoutId);

            toast.success('Checkout berhasil dihapus permanen.');
            
            fetchCheckouts();
            setShowDetailModal(false);
            
        } catch (error: any) {
            console.error('Error deleting checkout:', error);
            toast.error(`Gagal menghapus checkout: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(checkoutId);
                return newSet;
            });
        }
    };

    // ===== ✅ FIXED: ADD REPORT WITH SELECTABLE VIOLATION TYPE =====
    const handleAddReport = async () => {
        if (!reportData.description.trim() || !selectedCheckout) {
            toast.error('Deskripsi wajib diisi.');
            return;
        }

        try {
            const { error } = await supabase
                .from('checkout_violations')
                .insert({
                    checkout_id: selectedCheckout.id,
                    user_id: selectedCheckout.user_id,
                    violation_type: reportData.violation_type, // Menggunakan nilai dari state
                    severity: reportData.severity,
                    title: reportData.title || `Masalah Validasi Pengembalian`,
                    description: reportData.description,
                    reported_by: profile?.id,
                    status: 'active'
                });

            if (error) throw error;

            toast.success('Laporan berhasil ditambahkan.');
            setShowReportModal(false);
            // Reset state setelah berhasil
            setReportData({ title: '', description: '', severity: 'minor', violation_type: 'damage' });
            fetchCheckouts(); // Refresh data untuk menampilkan flag pelanggaran
            
        } catch (error: any) {
            console.error('Error adding report:', error);
            toast.error(`Gagal menambahkan laporan: ${error.message}`);
        }
    };

    // ===== EFFECTS =====
    useEffect(() => {
        if (profile) {
            fetchCheckouts();
        }
    }, [profile, fetchCheckouts]);

    useEffect(() => {
        if (selectedCheckout) {
            const refreshVerificationItems = async () => {
                if (selectedCheckout.equipment_list) {
                    const newVerificationItems = await fetchVerificationItems(
                        selectedCheckout.id,
                        selectedCheckout.equipment_list,
                        selectedCheckout
                    );
                    setVerificationItems(newVerificationItems);
                }
            };
            
            if (selectedCheckout.verification_items && selectedCheckout.verification_items.length > 0) {
                setVerificationItems(selectedCheckout.verification_items);
            } else {
                refreshVerificationItems();
            }
        }
    }, [selectedCheckout]);

    // ===== FILTERS =====
    const filteredCheckouts = checkouts.filter(checkout => {
        const searchLower = searchTerm.toLowerCase();
        
        return (
            checkout.user?.full_name?.toLowerCase().includes(searchLower) ||
            checkout.user?.identity_number?.toLowerCase().includes(searchLower) ||
            (activeTab === 'room' && checkout.booking?.room?.name?.toLowerCase().includes(searchLower)) ||
            (activeTab === 'equipment' && checkout.lendingTool?.equipment_details?.some(eq => 
                eq.name.toLowerCase().includes(searchLower)
            ))
        );
    });

    // ===== UTILITY FUNCTIONS =====
    const getVerificationProgress = (items: VerificationItem[]) => {
        if (!items) return { total: 0, verified: 0, mandatory: 0, verifiedMandatory: 0, percentage: 0, canApprove: false };
        const totalItems = items.length;
        const verifiedItems = items.filter(item => item.is_verified).length;
        const mandatoryItems = items.filter(item => item.is_mandatory);
        const verifiedMandatory = mandatoryItems.filter(item => item.is_verified).length;
        
        return {
            total: totalItems,
            verified: verifiedItems,
            mandatory: mandatoryItems.length,
            verifiedMandatory,
            percentage: totalItems > 0 ? Math.round((verifiedItems / totalItems) * 100) : 0,
            canApprove: mandatoryItems.length === verifiedMandatory
        };
    };

    const getTotalQuantityGap = (items: VerificationItem[]) => {
        if (!items) return 0;
        return items.reduce((total, item) => {
            const gap = Math.max(0, item.borrowed_quantity - item.returned_quantity);
            return total + gap;
        }, 0);
    };

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            'returned': { color: 'bg-blue-100 text-blue-800', icon: '📦', label: 'Dikembalikan' },
            'active': { color: 'bg-green-100 text-green-800', icon: '✅', label: 'Aktif' },
            'overdue': { color: 'bg-red-100 text-red-800', icon: '⚠️', label: 'Terlambat' },
            'pending': { color: 'bg-yellow-100 text-yellow-800', icon: '⏳', label: 'Tertunda' }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                <span className="mr-1">{config.icon}</span>
                {config.label}
            </span>
        );
    };

    // ===== ACCESS CONTROL =====
    if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Bell className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Akses Ditolak</h3>
                    <p className="text-gray-600">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
                </div>
            </div>
        );
    }

    // ===== RENDER COMPONENT =====
    return (
        <div className="space-y-6">
            {/* ===== HEADER ===== */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3">
                            <Bell className="h-8 w-8" />
                            <span>Antrean Validasi Pengembalian</span>
                        </h1>
                        <p className="mt-2 opacity-90">
                            Verifikasi dan setujui pengembalian barang dari pengguna.
                        </p>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-2xl font-bold">{checkouts.length}</div>
                        <div className="text-sm opacity-80">Total Checkout</div>
                    </div>
                </div>
            </div>

            {/* ===== TABS ===== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    <button 
                        onClick={() => setActiveTab('room')} 
                        className={`flex-1 py-4 px-6 text-center font-medium transition-colors duration-200 ${
                            activeTab === 'room' 
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Building className="h-5 w-5" />
                            <span>Pengembalian Ruangan</span>
                            <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                                {checkouts.filter(c => c.type === 'room').length}
                            </span>
                        </div>
                    </button>
                    <button 
                        onClick={() => setActiveTab('equipment')} 
                        className={`flex-1 py-4 px-6 text-center font-medium transition-colors duration-200 ${
                            activeTab === 'equipment' 
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Package className="h-5 w-5" />
                            <span>Pengembalian Barang</span>
                            <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                                {checkouts.filter(c => c.type === 'things').length}
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            {/* ===== SEARCH & FILTERS ===== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full lg:flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder={`Cari ${activeTab === 'room' ? 'berdasarkan pengguna, ruangan' : 'berdasarkan pengguna, barang'}...`}
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        />
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                            <Filter className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Status:</span>
                        </div>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                            <option value="all">Semua Status</option>
                            <option value="returned">Dikembalikan</option>
                            <option value="active">Aktif</option>
                            <option value="overdue">Terlambat</option>
                            <option value="pending">Tertunda</option>
                        </select>
                        
                        <button 
                            onClick={fetchCheckouts} 
                            disabled={loading} 
                            className="flex items-center space-x-2 px-4 py-3 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== CHECKOUT LIST ===== */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                            <p className="text-gray-600">Memuat data pengembalian...</p>
                        </div>
                    </div>
                ) : filteredCheckouts.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {statusFilter === 'all' ? 'Tidak Ada Checkout!' : `Tidak Ada Pengembalian dengan Status "${statusFilter}"`}
                        </h3>
                        <p className="text-gray-600">
                            Tidak ada data untuk ditampilkan pada tab dan filter yang dipilih.
                        </p>
                    </div>
                ) : (
                    filteredCheckouts.map((checkout) => {
                        const progress = getVerificationProgress(checkout.verification_items || []);
                        const quantityGap = getTotalQuantityGap(checkout.verification_items || []);
                        
                        return (
                            <div 
                                key={checkout.id}
                                className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
                                    checkout.has_violations 
                                        ? 'border-red-300 bg-red-50' 
                                        : 'border-gray-200'
                                }`}
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            {/* Card Header */}
                                            <div className="flex items-center space-x-4 mb-4">
                                                <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                                                    {activeTab === 'room' ? (
                                                        <Building className="h-6 w-6 text-white" />
                                                    ) : (
                                                        <Package className="h-6 w-6 text-white" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3">
                                                        <h3 className="text-lg font-semibold text-gray-900">
                                                            {activeTab === 'room' 
                                                                ? `Pengembalian ${checkout.booking?.room?.name}`
                                                                : 'Pengembalian Barang'
                                                            }
                                                        </h3>
                                                        {getStatusBadge(checkout.status)}
                                                        {checkout.has_violations && (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                <Flag className="h-3 w-3 mr-1" />
                                                                Ada Laporan
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        Pengembalian diminta pada {format(new Date(checkout.checkout_date), 'd MMM yyyy')}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* User & Details */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                <div className="flex items-center space-x-3">
                                                    <User className="h-4 w-4 text-gray-400" />
                                                    <div>
                                                        <p className="font-medium text-gray-900">{checkout.user?.full_name}</p>
                                                        <p className="text-xs text-gray-500">{checkout.user?.identity_number}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center space-x-3">
                                                    <Calendar className="h-4 w-4 text-gray-400" />
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {format(new Date(checkout.expected_return_date), 'd MMM')}
                                                        </p>
                                                        <p className="text-xs text-gray-500">Estimasi Kembali</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-3">
                                                    <Package className="h-4 w-4 text-gray-400" />
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {checkout.equipment_list?.length || 0} Barang
                                                        </p>
                                                        <p className="text-xs text-gray-500">Jumlah Peralatan</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar & Alerts */}
                                            {checkout.status === 'returned' && (
                                                <>
                                                    <div className="mb-4">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-sm font-medium text-gray-700">
                                                                Progres Verifikasi
                                                            </span>
                                                            <span className="text-sm text-gray-500">
                                                                {progress.verified}/{progress.total} terverifikasi ({progress.percentage}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                                            <div 
                                                                className={`h-2 rounded-full ${
                                                                    progress.percentage === 100 
                                                                        ? 'bg-green-500' 
                                                                        : 'bg-blue-500'
                                                                }`}
                                                                style={{ width: `${progress.percentage}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {!progress.canApprove && (
                                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center">
                                                                <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                                                                <span className="text-sm font-medium text-yellow-800">
                                                                    {progress.mandatory - progress.verifiedMandatory} barang wajib belum diverifikasi.
                                                                </span>
                                                            </div>
                                                        )}
                                                        
                                                        {quantityGap > 0 && (
                                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
                                                                <Calculator className="h-4 w-4 text-red-600 mr-2" />
                                                                <span className="text-sm font-medium text-red-800">
                                                                    {quantityGap} barang hilang (ada selisih kuantitas).
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center space-x-2 ml-4">
                                            <button 
                                                onClick={() => {
                                                    setSelectedCheckout(checkout);
                                                    setShowDetailModal(true);
                                                }}
                                                className="p-2 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 rounded-lg transition-colors"
                                                title={checkout.status === 'returned' ? "Verifikasi Barang" : "Lihat Detail"}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            
                                            {checkout.status === 'returned' && (
                                                <button 
                                                    onClick={() => setShowDeleteConfirm(checkout.id)}
                                                    className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                                                    title="Tolak Pengembalian"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ===== VERIFICATION MODAL ===== */}
            {showDetailModal && selectedCheckout && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">
                                        {selectedCheckout.status === 'returned' ? 'Verifikasi Pengembalian' : 'Detail Checkout'}
                                    </h2>
                                    <p className="mt-1 opacity-90">
                                        {`Untuk pengguna: ${selectedCheckout.user?.full_name}`}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto flex-grow">
                            {/* Equipment Verification Section */}
                            <div className="bg-gray-50 rounded-xl p-6">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center mb-6">
                                    <Package className="h-5 w-5 mr-2 text-indigo-600" />
                                    {selectedCheckout.status === 'returned' ? 'Verifikasi Peralatan' : 'Detail Peralatan'}
                                </h3>

                                {verificationItems.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-600">Tidak ada peralatan dalam checkout ini.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {verificationItems.map((item, index) => (
                                            <div 
                                                key={item.equipment_id}
                                                className={`border-2 rounded-xl p-4 transition-all duration-200 ${
                                                    selectedCheckout.status === 'returned'
                                                        ? (item.is_verified 
                                                            ? 'border-green-300 bg-green-50' 
                                                            : item.is_mandatory 
                                                                ? 'border-red-300 bg-red-50' 
                                                                : 'border-gray-200 bg-white')
                                                        : 'border-gray-200 bg-white'
                                                }`}
                                            >
                                                {/* Item details and quantity controls */}
                                                {/* ... (omitted for brevity, same as original) ... */}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Modal Footer with Actions */}
                        {selectedCheckout.status === 'returned' && (
                            <div className="p-6 bg-gray-50 border-t border-gray-200">
                                {(() => {
                                    const progress = getVerificationProgress(verificationItems);
                                    const quantityGap = getTotalQuantityGap(verificationItems);
                                    
                                    return (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <button
                                                    onClick={() => setShowReportModal(true)}
                                                    className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
                                                >
                                                    <Flag className="h-4 w-4" />
                                                    <span>Tambah Laporan</span>
                                                </button>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <button
                                                    onClick={() => setShowDeleteConfirm(selectedCheckout.id)}
                                                    disabled={processingIds.has(selectedCheckout.id)}
                                                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                    <span>Tolak</span>
                                                </button>
                                                <button
                                                    onClick={() => handleApproveReturn(selectedCheckout.id)}
                                                    disabled={!progress.canApprove || quantityGap > 0 || processingIds.has(selectedCheckout.id)}
                                                    className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                                    title={!progress.canApprove ? "Verifikasi semua barang wajib" : quantityGap > 0 ? "Ada barang yang hilang" : "Setujui Pengembalian"}
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span>Setujui Pengembalian</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== ✅ FIXED: REPORT MODAL WITH VIOLATION TYPE SELECTOR ===== */}
            {showReportModal && selectedCheckout && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Tambah Laporan Masalah</h3>
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Input Judul Laporan */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Judul Laporan
                                </label>
                                <input
                                    type="text"
                                    value={reportData.title}
                                    onChange={(e) => setReportData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Contoh: Kerusakan pada proyektor"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* ✅ ADDED: Violation Type Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Jenis Pelanggaran *
                                </label>
                                <select
                                    value={reportData.violation_type}
                                    onChange={(e) => setReportData(prev => ({ ...prev, violation_type: e.target.value as ViolationType }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="damage">Damage (Kerusakan)</option>
                                    <option value="loss">Loss (Kehilangan)</option>
                                    <option value="late_return">Late Return (Telat Kembali)</option>
                                    <option value="misuse">Misuse (Penyalahgunaan)</option>
                                    <option value="other">Other (Lainnya)</option>
                                </select>
                            </div>

                            {/* Input Deskripsi */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Deskripsi *
                                </label>
                                <textarea
                                    value={reportData.description}
                                    onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Jelaskan detail masalah di sini..."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            {/* Input Tingkat Keparahan */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tingkat Keparahan
                                </label>
                                <select
                                    value={reportData.severity}
                                    onChange={(e) => setReportData(prev => ({ ...prev, severity: e.target.value as any }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="minor">Minor - Masalah kecil</option>
                                    <option value="major">Major - Masalah signifikan</option>
                                    <option value="critical">Critical - Pelanggaran serius</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleAddReport}
                                disabled={!reportData.description.trim()}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Kirim Laporan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DELETE CONFIRMATION ===== */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Tolak Pengembalian</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            Apakah Anda yakin ingin menolak pengembalian ini? Semua barang yang terverifikasi akan dikembalikan statusnya dan pengguna harus melakukan proses pengembalian ulang.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => {
                                    if (showDeleteConfirm) {
                                        handleRejectReturn(showDeleteConfirm);
                                    }
                                }}
                                disabled={processingIds.has(showDeleteConfirm || '')}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {processingIds.has(showDeleteConfirm || '') ? 'Memproses...' : 'Ya, Tolak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ValidationQueue;
