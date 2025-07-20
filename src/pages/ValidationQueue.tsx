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

const ValidationQueue: React.FC = () => {
    const { profile } = useAuth();
    
    const [activeTab, setActiveTab] = useState<'room' | 'equipment'>('room');
    const [statusFilter, setStatusFilter] = useState<'all' | 'returned' | 'active' | 'overdue' | 'pending'>('all');
    const [checkouts, setCheckouts] = useState<CheckoutWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCheckout, setSelectedCheckout] = useState<CheckoutWithDetails | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([]);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState({
        title: '',
        description: '',
        severity: 'minor' as 'minor' | 'major' | 'critical'
    });

    // ===== ✅ MOVED ALL HELPER FUNCTIONS INSIDE COMPONENT =====
    
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
                
                let borrowedQty = 1;
                
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
            console.error('❌ Error updating equipment quantity:', error);
            throw error;
        }
    };

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
            console.error('❌ Error updating verification:', error);
            toast.error(`Failed to update verification: ${error.message}`);
        }
    };

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

            toast.success('Return approved successfully!');
            fetchCheckouts();
            setShowDetailModal(false);
            
        } catch (error: any) {
            console.error('❌ Error approving return:', error);
            toast.error(`Failed to approve return: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(checkoutId);
                return newSet;
            });
        }
    };

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

            toast.success('Return rejected and quantities reverted');
            fetchCheckouts();
            setShowDetailModal(false);
            
        } catch (error: any) {
            console.error('❌ Error rejecting return:', error);
            toast.error(`Failed to reject return: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(checkoutId);
                return newSet;
            });
        }
    };

    const getVerificationProgress = (items: VerificationItem[]) => {
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
        return items.reduce((total, item) => {
            const gap = Math.max(0, item.borrowed_quantity - item.returned_quantity);
            return total + gap;
        }, 0);
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'returned':
                return {
                    icon: CheckCircle,
                    label: 'Returned',
                    className: 'bg-blue-100 text-blue-800 border-blue-200',
                    description: 'Awaiting verification',
                    actionable: true
                };
            case 'active':
                return {
                    icon: Clock,
                    label: 'Active',
                    className: 'bg-green-100 text-green-800 border-green-200',
                    description: 'Currently borrowed',
                    actionable: false
                };
            case 'overdue':
                return {
                    icon: AlertTriangle,
                    label: 'Overdue',
                    className: 'bg-red-100 text-red-800 border-red-200',
                    description: 'Past expected return date',
                    actionable: true
                };
            case 'pending':
                return {
                    icon: Timer,
                    label: 'Pending',
                    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    description: 'Waiting for approval',
                    actionable: false
                };
            default:
                return {
                    icon: AlertCircleIcon,
                    label: 'Unknown',
                    className: 'bg-gray-100 text-gray-800 border-gray-200',
                    description: 'Unknown status',
                    actionable: false
                };
        }
    };

    const getStatusStats = () => {
        return {
            returned: checkouts.filter(c => c.status === 'returned').length,
            active: checkouts.filter(c => c.status === 'active').length,
            overdue: checkouts.filter(c => c.status === 'overdue').length,
            pending: checkouts.filter(c => c.status === 'pending').length,
            total: checkouts.length
        };
    };

    // ===== ENHANCED FETCH CHECKOUTS WITH MULTI-STATUS SUPPORT =====
    const fetchCheckouts = async () => {
        try {
            setLoading(true);
            
            let processedData: CheckoutWithDetails[] = [];
            
            if (activeTab === 'room') {
                const { data: checkoutData, error } = await supabase
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
                    .eq('type', 'room')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                processedData = checkoutData || [];
                
            } else {
                const { data: checkoutData, error } = await supabase
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
                    .eq('type', 'things')
                    .order('created_at', { ascending: false });

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

            // Calculate real-time overdue status
            processedData = processedData.map(checkout => {
                const expectedReturn = new Date(checkout.expected_return_date);
                const now = new Date();
                
                if (checkout.status === 'active' && expectedReturn < now) {
                    return { ...checkout, status: 'overdue' as const };
                }
                
                return checkout;
            });

            // Department filter for department admin
            if (profile?.role === 'department_admin' && profile.department_id) {
                if (activeTab === 'room') {
                    processedData = processedData.filter(checkout => 
                        checkout.booking?.room?.department?.name
                    );
                }
            }

            // Enhanced data processing
            const enhancedData = await Promise.all(
                processedData.map(async (checkout) => {
                    const equipment_list = await fetchEquipmentList(checkout);
                    const verification_items = await fetchVerificationItems(
                        checkout.id, 
                        equipment_list, 
                        checkout
                    );
                    
                    return {
                        ...checkout,
                        equipment_list,
                        verification_items
                    };
                })
            );

            setCheckouts(enhancedData);
            
        } catch (error: any) {
            console.error('Error fetching checkouts:', error);
            toast.error(`Failed to load validation queue: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // ===== ENHANCED FILTERS WITH STATUS =====
    const filteredCheckouts = checkouts.filter(checkout => {
        const searchLower = searchTerm.toLowerCase();
        
        const matchesStatus = statusFilter === 'all' || checkout.status === statusFilter;
        
        const matchesSearch = 
            checkout.user?.full_name?.toLowerCase().includes(searchLower) ||
            checkout.user?.identity_number?.toLowerCase().includes(searchLower) ||
            (activeTab === 'room' && checkout.booking?.room?.name?.toLowerCase().includes(searchLower)) ||
            (activeTab === 'equipment' && checkout.lendingTool?.equipment_details?.some(eq => 
                eq.name.toLowerCase().includes(searchLower)
            ));
        
        return matchesStatus && matchesSearch;
    });

    // ===== EFFECTS =====
    useEffect(() => {
        if (profile) {
            fetchCheckouts();
        }
    }, [profile, activeTab]);

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

    // ===== ACCESS CONTROL =====
    if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Bell className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Access Denied</h3>
                    <p className="text-gray-600">You don't have permission to access this page.</p>
                </div>
            </div>
        );
    }

    const statusStats = getStatusStats();

    return (
        <div className="space-y-6">
            {/* ===== ENHANCED HEADER WITH STATUS OVERVIEW ===== */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3">
                            <Bell className="h-8 w-8" />
                            <span>Equipment Management Queue</span>
                        </h1>
                        <p className="mt-2 opacity-90">
                            Monitor and manage all equipment transactions and returns
                        </p>
                    </div>
                    
                    {/* Status Overview */}
                    <div className="hidden lg:grid grid-cols-4 gap-4 text-center">
                        <div className="bg-white bg-opacity-20 rounded-lg p-3">
                            <div className="text-2xl font-bold">{statusStats.returned}</div>
                            <div className="text-xs opacity-80">Awaiting Verification</div>
                        </div>
                        <div className="bg-white bg-opacity-20 rounded-lg p-3">
                            <div className="text-2xl font-bold">{statusStats.active}</div>
                            <div className="text-xs opacity-80">Currently Borrowed</div>
                        </div>
                        <div className="bg-white bg-opacity-20 rounded-lg p-3">
                            <div className="text-2xl font-bold text-red-200">{statusStats.overdue}</div>
                            <div className="text-xs opacity-80">Overdue Items</div>
                        </div>
                        <div className="bg-white bg-opacity-20 rounded-lg p-3">
                            <div className="text-2xl font-bold">{statusStats.pending}</div>
                            <div className="text-xs opacity-80">Pending Approval</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== ENHANCED TABS ===== */}
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
                            <span>Room Transactions</span>
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
                            <span>Equipment Transactions</span>
                            <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                                {checkouts.filter(c => c.type === 'things').length}
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            {/* ===== ENHANCED SEARCH & FILTERS ===== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-auto md:flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder={`Search ${activeTab === 'room' ? 'by user, room' : 'by user, equipment'}...`}
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                        />
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        {/* Status Filter */}
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value as any)} 
                            className="px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                            <option value="all">All Status ({statusStats.total})</option>
                            <option value="returned">Awaiting Verification ({statusStats.returned})</option>
                            <option value="active">Currently Borrowed ({statusStats.active})</option>
                            <option value="overdue">Overdue ({statusStats.overdue})</option>
                            <option value="pending">Pending Approval ({statusStats.pending})</option>
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
                
                {/* Quick Status Chips */}
                <div className="mt-4 flex flex-wrap gap-2">
                    {['all', 'returned', 'active', 'overdue', 'pending'].map((status) => {
                        const count = status === 'all' ? statusStats.total : statusStats[status as keyof typeof statusStats];
                        const isActive = statusFilter === status;
                        
                        return (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status as any)}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                    isActive 
                                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ===== ENHANCED CHECKOUT LIST ===== */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                            <p className="text-gray-600">Loading transactions...</p>
                        </div>
                    </div>
                ) : filteredCheckouts.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {statusFilter === 'all' ? 'No Transactions Found' : `No ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Transactions`}
                        </h3>
                        <p className="text-gray-600">
                            {statusFilter === 'all' 
                                ? 'No equipment transactions in the system yet.'
                                : `No ${statusFilter} transactions to display. Try changing the filter.`
                            }
                        </p>
                    </div>
                ) : (
                    filteredCheckouts.map((checkout) => {
                        const progress = getVerificationProgress(checkout.verification_items || []);
                        const quantityGap = getTotalQuantityGap(checkout.verification_items || []);
                        const statusConfig = getStatusConfig(checkout.status);
                        const StatusIcon = statusConfig.icon;
                        
                        return (
                            <div 
                                key={checkout.id}
                                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        {/* Enhanced Header with Status */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center space-x-4">
                                                <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                                                    {activeTab === 'room' ? (
                                                        <Building className="h-6 w-6 text-white" />
                                                    ) : (
                                                        <Package className="h-6 w-6 text-white" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        {activeTab === 'room' 
                                                            ? `${checkout.booking?.room?.name} Transaction`
                                                            : 'Equipment Transaction'
                                                        }
                                                    </h3>
                                                    <p className="text-sm text-gray-600">
                                                        Created on {format(new Date(checkout.checkout_date), 'MMM d, yyyy')}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Status Badge */}
                                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.className}`}>
                                                <StatusIcon className="h-4 w-4" />
                                                <span>{statusConfig.label}</span>
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
                                                        {format(new Date(checkout.expected_return_date), 'MMM d')}
                                                    </p>
                                                    <p className="text-xs text-gray-500">Expected Return</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-3">
                                                <Package className="h-4 w-4 text-gray-400" />
                                                <div>
                                                    <p className="font-medium text-gray-900">
                                                        {checkout.equipment_list?.length || 0} Items
                                                    </p>
                                                    <p className="text-xs text-gray-500">Equipment Count</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Conditional Progress Bar (only for returned status) */}
                                        {checkout.status === 'returned' && (
                                            <div className="mb-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-gray-700">
                                                        Verification Progress
                                                    </span>
                                                    <span className="text-sm text-gray-500">
                                                        {progress.verified}/{progress.total} verified ({progress.percentage}%)
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div 
                                                        className={`h-2 rounded-full ${
                                                            progress.percentage === 100 
                                                                ? 'bg-green-500' 
                                                                : progress.percentage > 50 
                                                                    ? 'bg-blue-500' 
                                                                    : 'bg-yellow-500'
                                                        }`}
                                                        style={{ width: `${progress.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Status-specific Alerts */}
                                        <div className="space-y-2">
                                            {checkout.status === 'returned' && (
                                                <>
                                                    {!progress.canApprove && (
                                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                            <div className="flex items-center">
                                                                <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                                                                <span className="text-sm font-medium text-red-800">
                                                                    {progress.mandatory - progress.verifiedMandatory} mandatory items need verification
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {quantityGap > 0 && (
                                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                                            <div className="flex items-center">
                                                                <Calculator className="h-4 w-4 text-orange-600 mr-2" />
                                                                <span className="text-sm font-medium text-orange-800">
                                                                    {quantityGap} items missing (quantity mismatch detected)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {progress.canApprove && quantityGap === 0 && (
                                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                            <div className="flex items-center">
                                                                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                                                <span className="text-sm font-medium text-green-800">
                                                                    Ready to approve - all items verified!
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            
                                            {checkout.status === 'overdue' && (
                                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                    <div className="flex items-center">
                                                        <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                                                        <span className="text-sm font-medium text-red-800">
                                                            Overdue by {Math.ceil((new Date().getTime() - new Date(checkout.expected_return_date).getTime()) / (1000 * 60 * 60 * 24))} days
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {checkout.status === 'active' && (
                                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                    <div className="flex items-center">
                                                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                                        <span className="text-sm font-medium text-green-800">
                                                            Currently borrowed - due {format(new Date(checkout.expected_return_date), 'MMM d, yyyy')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {checkout.status === 'pending' && (
                                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                    <div className="flex items-center">
                                                        <Timer className="h-4 w-4 text-yellow-600 mr-2" />
                                                        <span className="text-sm font-medium text-yellow-800">
                                                            Pending approval - waiting for admin action
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status-dependent Actions */}
                                    <div className="flex items-center space-x-2 ml-4">
                                        {/* View Details - Always available */}
                                        <button 
                                            onClick={() => {
                                                setSelectedCheckout(checkout);
                                                setShowDetailModal(true);
                                            }}
                                            className="p-2 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 rounded-lg transition-colors"
                                            title="View Details"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        
                                        {/* Verification Actions - Only for 'returned' status */}
                                        {checkout.status === 'returned' && (
                                            <>
                                                {progress.canApprove && quantityGap === 0 && (
                                                    <button 
                                                        onClick={() => handleApproveReturn(checkout.id)}
                                                        disabled={processingIds.has(checkout.id)}
                                                        className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Approve Return"
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                )}
                                                
                                                <button 
                                                    onClick={() => setShowDeleteConfirm(checkout.id)}
                                                    className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                                                    title="Reject Return"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                        
                                        {/* Override Actions - For overdue items */}
                                        {checkout.status === 'overdue' && (
                                            <button 
                                                onClick={() => {
                                                    toast.info('Manual return override feature coming soon');
                                                }}
                                                className="p-2 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-lg transition-colors"
                                                title="Force Return"
                                            >
                                                <Flag className="h-4 w-4" />
                                            </button>
                                        )}
                                        
                                        {/* Contact User - For active/overdue items */}
                                        {(checkout.status === 'active' || checkout.status === 'overdue') && (
                                            <button 
                                                onClick={() => {
                                                    if (checkout.user?.phone_number) {
                                                        window.open(`tel:${checkout.user.phone_number}`, '_blank');
                                                    } else {
                                                        toast.error('No phone number available for this user');
                                                    }
                                                }}
                                                className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors"
                                                title="Contact User"
                                            >
                                                <Phone className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ===== ENHANCED VERIFICATION MODAL ===== */}
            {showDetailModal && selectedCheckout && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">
                                        {selectedCheckout.status === 'returned' ? 'Return Verification' : 'Transaction Details'}
                                    </h2>
                                    <p className="mt-1 opacity-90">
                                        {selectedCheckout.status === 'returned' 
                                            ? `Verify returned items from ${selectedCheckout.user?.full_name}`
                                            : `View transaction details for ${selectedCheckout.user?.full_name}`
                                        }
                                    </p>
                                    
                                    {/* Status indicator in modal */}
                                    <div className="mt-2">
                                        {(() => {
                                            const statusConfig = getStatusConfig(selectedCheckout.status);
                                            const StatusIcon = statusConfig.icon;
                                            return (
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
                                                    <StatusIcon className="h-4 w-4" />
                                                    <span>{statusConfig.label}</span>
                                                    <span className="opacity-75">• {statusConfig.description}</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            {/* User & Context Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="bg-indigo-50 rounded-xl p-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                                            <User className="h-6 w-6 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-indigo-900">
                                                {selectedCheckout.user?.full_name}
                                            </h3>
                                            <p className="text-sm text-indigo-600">
                                                ID: {selectedCheckout.user?.identity_number}
                                            </p>
                                            <p className="text-sm text-indigo-600">
                                                📞 {selectedCheckout.user?.phone_number || 'No phone'}
                                            </p>
                                            <p className="text-sm text-indigo-600">
                                                📧 {selectedCheckout.user?.email || 'No email'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-purple-50 rounded-xl p-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                                            {activeTab === 'room' ? (
                                                <Building className="h-6 w-6 text-purple-600" />
                                            ) : (
                                                <Package className="h-6 w-6 text-purple-600" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-purple-900">
                                                {activeTab === 'room' 
                                                    ? selectedCheckout.booking?.room?.name
                                                    : 'Equipment Transaction'
                                                }
                                            </h3>
                                            <p className="text-sm text-purple-600">
                                                Created: {format(new Date(selectedCheckout.checkout_date), 'MMM d, yyyy')}
                                            </p>
                                            <p className="text-sm text-purple-600">
                                                Expected Return: {format(new Date(selectedCheckout.expected_return_date), 'MMM d, yyyy')}
                                            </p>
                                            <p className="text-sm text-purple-600">
                                                {activeTab === 'room' 
                                                    ? selectedCheckout.booking?.room?.department?.name
                                                    : `${verificationItems.length} equipment items`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Equipment Section with Status-dependent UI */}
                            <div className="bg-gray-50 rounded-xl p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                                        <Package className="h-5 w-5 mr-2 text-indigo-600" />
                                        {selectedCheckout.status === 'returned' ? 'Equipment Verification' : 'Equipment Details'}
                                    </h3>
                                    <div className="text-sm text-gray-600">
                                        {selectedCheckout.status === 'returned' 
                                            ? `${verificationItems.filter(item => item.is_verified).length}/${verificationItems.length} verified`
                                            : `${verificationItems.length} items`
                                        }
                                    </div>
                                </div>

                                {verificationItems.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-600">No equipment in this transaction</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {verificationItems.map((item, index) => (
                                            <div 
                                                key={item.equipment_id}
                                                className={`border-2 rounded-xl p-4 transition-all duration-200 ${
                                                    selectedCheckout.status === 'returned'
                                                        ? item.is_verified 
                                                            ? 'border-green-300 bg-green-50' 
                                                            : item.is_mandatory 
                                                                ? 'border-red-300 bg-red-50' 
                                                                : 'border-gray-200 bg-white'
                                                        : 'border-gray-200 bg-white'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-3 mb-3">
                                                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                                                selectedCheckout.status === 'returned'
                                                                    ? item.is_verified 
                                                                        ? 'bg-green-100' 
                                                                        : 'bg-gray-100'
                                                                    : 'bg-blue-100'
                                                            }`}>
                                                                {selectedCheckout.status === 'returned' ? (
                                                                    item.is_verified ? (
                                                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                                                    ) : (
                                                                        <Package className="h-5 w-5 text-gray-600" />
                                                                    )
                                                                ) : (
                                                                    <Package className="h-5 w-5 text-blue-600" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1">
                                                                <h4 className="font-semibold text-gray-900 flex items-center">
                                                                    {item.equipment_name}
                                                                    {item.is_mandatory && (
                                                                        <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded">
                                                                            MANDATORY
                                                                        </span>
                                                                    )}
                                                                </h4>
                                                                <p className="text-sm text-gray-600">
                                                                    Code: {item.equipment_code || 'N/A'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Quantity Display with Status Context */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                            <div className="text-center p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                                                                <div className="text-xl font-bold text-blue-600">
                                                                    {item.borrowed_quantity}
                                                                </div>
                                                                <div className="text-xs text-blue-600 font-medium">
                                                                    BORROWED
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {item.equipment_unit}
                                                                </div>
                                                            </div>

                                                            {/* Interactive returned quantity only for 'returned' status */}
                                                            {selectedCheckout.status === 'returned' ? (
                                                                <div className="text-center p-3 bg-white rounded-lg border-2 border-gray-300">
                                                                    <div className="flex items-center justify-center space-x-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                const newQty = Math.max(0, item.returned_quantity - 1);
                                                                                const newItems = [...verificationItems];
                                                                                newItems[index].returned_quantity = newQty;
                                                                                setVerificationItems(newItems);
                                                                                updateVerificationItem(
                                                                                    selectedCheckout.id,
                                                                                    item.equipment_id,
                                                                                    newQty,
                                                                                    item.condition_notes || '',
                                                                                    newQty > 0
                                                                                );
                                                                            }}
                                                                            className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                                                                        >
                                                                            <Minus className="h-3 w-3" />
                                                                        </button>
                                                                        
                                                                        <span className="text-xl font-bold text-gray-900 min-w-[3rem] text-center">
                                                                            {item.returned_quantity}
                                                                        </span>
                                                                        
                                                                        <button
                                                                            onClick={() => {
                                                                                const newQty = Math.min(item.borrowed_quantity, item.returned_quantity + 1);
                                                                                const newItems = [...verificationItems];
                                                                                newItems[index].returned_quantity = newQty;
                                                                                setVerificationItems(newItems);
                                                                                updateVerificationItem(
                                                                                    selectedCheckout.id,
                                                                                    item.equipment_id,
                                                                                    newQty,
                                                                                    item.condition_notes || '',
                                                                                    newQty > 0
                                                                                );
                                                                            }}
                                                                            className="p-1 bg-indigo-200 hover:bg-indigo-300 rounded"
                                                                        >
                                                                            <Plus className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="text-xs text-gray-600 font-medium mt-1">
                                                                        RETURNED
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                                                                    <div className="text-xl font-bold text-gray-600">
                                                                        {selectedCheckout.status === 'active' ? 'Not Yet' : 'N/A'}
                                                                    </div>
                                                                    <div className="text-xs text-gray-600 font-medium">
                                                                        RETURNED
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        {item.equipment_unit}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="text-center p-3 bg-red-50 rounded-lg border-2 border-red-200">
                                                                <div className={`text-xl font-bold ${
                                                                    selectedCheckout.status === 'returned'
                                                                        ? item.borrowed_quantity - item.returned_quantity > 0 
                                                                            ? 'text-red-600' 
                                                                            : 'text-green-600'
                                                                        : selectedCheckout.status === 'active'
                                                                            ? 'text-orange-600'
                                                                            : 'text-gray-600'
                                                                }`}>
                                                                    {selectedCheckout.status === 'returned' 
                                                                        ? Math.max(0, item.borrowed_quantity - item.returned_quantity)
                                                                        : selectedCheckout.status === 'active'
                                                                            ? item.borrowed_quantity
                                                                            : 'N/A'
                                                                    }
                                                                </div>
                                                                <div className="text-xs text-red-600 font-medium">
                                                                    {selectedCheckout.status === 'returned' ? 'MISSING' : 
                                                                     selectedCheckout.status === 'active' ? 'IN USE' : 'STATUS'}
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {item.equipment_unit}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Verification controls only for 'returned' status */}
                                                        {selectedCheckout.status === 'returned' && (
                                                            <>
                                                                {/* Condition Notes */}
                                                                <div className="mb-3">
                                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                        Condition Notes (Optional)
                                                                    </label>
                                                                  <textarea
                                                                        value={item.condition_notes || ''}
                                                                        onChange={(e) => {
                                                                            const newNotes = e.target.value;
                                                                            const newItems = [...verificationItems];
                                                                            newItems[index].condition_notes = newNotes;
                                                                            setVerificationItems(newItems);
                                                                            
                                                                            if (item.is_verified) {
                                                                                updateVerificationItem(
                                                                                    selectedCheckout.id,
                                                                                    item.equipment_id,
                                                                                    item.returned_quantity,
                                                                                    newNotes,
                                                                                    true
                                                                                );
                                                                            }
                                                                        }}
                                                                        placeholder="e.g., Good condition, minor scratches, working properly..."
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                                        rows={2}
                                                                    />
                                                                </div>

                                                                {/* Verification Toggle */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center space-x-3">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={item.is_verified}
                                                                            onChange={(e) => {
                                                                                const isChecked = e.target.checked;
                                                                                const newItems = [...verificationItems];
                                                                                newItems[index].is_verified = isChecked;
                                                                                
                                                                                if (isChecked && item.returned_quantity === 0) {
                                                                                    newItems[index].returned_quantity = item.borrowed_quantity;
                                                                                }
                                                                                
                                                                                setVerificationItems(newItems);
                                                                                
                                                                                updateVerificationItem(
                                                                                    selectedCheckout.id,
                                                                                    item.equipment_id,
                                                                                    isChecked ? newItems[index].returned_quantity : 0,
                                                                                    item.condition_notes || '',
                                                                                    isChecked
                                                                                );
                                                                            }}
                                                                            className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                                        />
                                                                        <label className="text-sm font-medium text-gray-900">
                                                                            I verify this item has been returned
                                                                        </label>
                                                                    </div>
                                                                    
                                                                    <div className="text-xs text-gray-500">
                                                                        {item.equipment_unit}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Summary & Actions only for 'returned' status */}
                            {selectedCheckout.status === 'returned' && (
                                <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Summary</h3>
                                    
                                    {(() => {
                                        const progress = getVerificationProgress(verificationItems);
                                        const quantityGap = getTotalQuantityGap(verificationItems);
                                        
                                        return (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                                                        <div className="text-2xl font-bold text-blue-600">{progress.verified}</div>
                                                        <div className="text-sm text-blue-600">Items Verified</div>
                                                        <div className="text-xs text-gray-500">out of {progress.total}</div>
                                                    </div>
                                                    
                                                    <div className="text-center p-4 bg-green-50 rounded-lg">
                                                        <div className="text-2xl font-bold text-green-600">{progress.verifiedMandatory}</div>
                                                        <div className="text-sm text-green-600">Mandatory OK</div>
                                                        <div className="text-xs text-gray-500">out of {progress.mandatory}</div>
                                                    </div>
                                                    
                                                    <div className="text-center p-4 bg-red-50 rounded-lg">
                                                        <div className="text-2xl font-bold text-red-600">{quantityGap}</div>
                                                        <div className="text-sm text-red-600">Missing Items</div>
                                                        <div className="text-xs text-gray-500">quantity gap</div>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex justify-end space-x-4 pt-4 border-t">
                                                    <button
                                                        onClick={() => setShowReportModal(true)}
                                                        className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
                                                    >
                                                        <Flag className="h-4 w-4" />
                                                        <span>Add Report</span>
                                                    </button>

                                                    <button
                                                        onClick={() => handleRejectReturn(selectedCheckout.id)}
                                                        disabled={processingIds.has(selectedCheckout.id)}
                                                        className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        <X className="h-4 w-4" />
                                                        <span>Reject Return</span>
                                                    </button>

                                                    <button
                                                        onClick={() => handleApproveReturn(selectedCheckout.id)}
                                                        disabled={!progress.canApprove || processingIds.has(selectedCheckout.id)}
                                                        className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        {processingIds.has(selectedCheckout.id) ? (
                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <CheckCircle className="h-4 w-4" />
                                                        )}
                                                        <span>Approve Return</span>
                                                    </button>
                                                </div>

                                                {/* Approval Requirements */}
                                                {!progress.canApprove && (
                                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                        <div className="flex items-center">
                                                            <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
                                                            <div>
                                                                <p className="font-medium text-red-800">Cannot approve yet</p>
                                                                <p className="text-sm text-red-600">
                                                                    Please verify all {progress.mandatory - progress.verifiedMandatory} remaining mandatory items before approval.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== REPORT MODAL ===== */}
            {showReportModal && selectedCheckout && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Add Issue Report</h3>
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Report Title
                                </label>
                                <input
                                    type="text"
                                    value={reportData.title}
                                    onChange={(e) => setReportData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Brief description of the issue"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description *
                                </label>
                                <textarea
                                    value={reportData.description}
                                    onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Detailed description of the issue..."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Severity Level
                                </label>
                                <select
                                    value={reportData.severity}
                                    onChange={(e) => setReportData(prev => ({ ...prev, severity: e.target.value as any }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="minor">Minor - Small issue</option>
                                    <option value="major">Major - Significant problem</option>
                                    <option value="critical">Critical - Serious violation</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!reportData.description.trim()) {
                                        toast.error('Description is required');
                                        return;
                                    }

                                    try {
                                        const { error } = await supabase
                                            .from('checkout_violations')
                                            .insert({
                                                checkout_id: selectedCheckout.id,
                                                user_id: selectedCheckout.user_id,
                                                violation_type: 'other',
                                                severity: reportData.severity,
                                                title: reportData.title || 'Validation Report',
                                                description: reportData.description,
                                                reported_by: profile?.id,
                                                status: 'active'
                                            });

                                        if (error) throw error;

                                        toast.success('Report added successfully');
                                        setShowReportModal(false);
                                        setReportData({ title: '', description: '', severity: 'minor' });
                                        fetchCheckouts();
                                    } catch (error: any) {
                                        console.error('Error adding report:', error);
                                        toast.error(`Failed to add report: ${error.message}`);
                                    }
                                }}
                                disabled={!reportData.description.trim()}
                                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                            >
                                Add Report
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
                            <h3 className="text-lg font-bold text-gray-900">Reject Return</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            Are you sure you want to reject this return? All verified items will be reverted and the user will need to return them again.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
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
                                {processingIds.has(showDeleteConfirm || '') ? 'Processing...' : 'Reject Return'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ValidationQueue;