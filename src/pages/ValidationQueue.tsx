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

interface ViolationReport {
    id: string;
    title: string;
    description: string;
    severity: 'minor' | 'major' | 'critical';
    violation_type: ViolationType;
    status: string;
    created_at: string;
    reported_by: string;
    reporter?: {
        full_name: string;
    };
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
    violation_reports?: ViolationReport[];
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
    original_returned_quantity: number;
    is_verified: boolean;
    condition_notes?: string;
    is_mandatory: boolean;
}

type ViolationType = 'late_return' | 'damage' | 'loss' | 'misuse' | 'other';

// ✅ VIOLATION REPORTS DISPLAY COMPONENT
const ViolationReportsDisplay: React.FC<{
    reports: ViolationReport[];
    compact?: boolean;
}> = ({ reports, compact = false }) => {
    if (!reports || reports.length === 0) return null;

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-100 text-red-800 border-red-200';
            case 'major': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'minor': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getViolationTypeIcon = (type: string) => {
        switch (type) {
            case 'damage': return '🔧';
            case 'loss': return '❌';
            case 'late_return': return '⏰';
            case 'misuse': return '⚠️';
            default: return '📝';
        }
    };

    if (compact) {
        // Compact view for card
        return (
            <div className="mt-3 space-y-2">
                <div className="flex items-center space-x-2">
                    <Flag className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">
                        {reports.length} Laporan Aktif
                    </span>
                </div>
                {reports.slice(0, 2).map((report) => (
                    <div key={report.id} className={`p-2 rounded-lg border text-xs ${getSeverityColor(report.severity)}`}>
                        <div className="flex items-start space-x-2">
                            <span>{getViolationTypeIcon(report.violation_type)}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{report.title}</p>
                                <p className="text-xs opacity-75 truncate">{report.description}</p>
                                <p className="text-xs opacity-60 mt-1">
                                    {format(new Date(report.created_at), 'MMM d, HH:mm')} • {report.reporter?.full_name}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
                {reports.length > 2 && (
                    <div className="text-xs text-gray-500 text-center">
                        +{reports.length - 2} laporan lainnya
                    </div>
                )}
            </div>
        );
    }

    // Full view for modal
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 flex items-center">
                    <Flag className="h-5 w-5 mr-2 text-red-500" />
                    Laporan Pelanggaran ({reports.length})
                </h4>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
                {reports.map((report) => (
                    <div key={report.id} className={`p-4 rounded-lg border-2 ${getSeverityColor(report.severity)}`}>
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <span className="text-lg">{getViolationTypeIcon(report.violation_type)}</span>
                                <div>
                                    <h5 className="font-medium">{report.title}</h5>
                                    <div className="flex items-center space-x-2 text-xs opacity-75">
                                        <span className="capitalize">{report.violation_type.replace('_', ' ')}</span>
                                        <span>•</span>
                                        <span className="capitalize">{report.severity}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <p className="text-sm mb-2">{report.description}</p>
                        
                        <div className="flex items-center justify-between text-xs opacity-60">
                            <span>Dilaporkan oleh: {report.reporter?.full_name || 'Unknown'}</span>
                            <span>{format(new Date(report.created_at), 'MMM d, yyyy HH:mm')}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

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
    const [reportCheckoutId, setReportCheckoutId] = useState<string | null>(null);
    
    const [reportData, setReportData] = useState({
        title: '',
        description: '',
        severity: 'minor' as 'minor' | 'major' | 'critical',
        violation_type: 'damage' as ViolationType
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

    // ===== FETCH VERIFICATION ITEMS WITH ORIGINAL VALUES =====
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

                const returnedQty = checkoutItem?.quantity || 0;

                const verificationItem: VerificationItem = {
                    equipment_id: equipment.id,
                    equipment_name: equipment.name,
                    equipment_code: equipment.code,
                    equipment_unit: equipment.unit || 'pcs',
                    borrowed_quantity: borrowedQty,
                    returned_quantity: returnedQty,
                    original_returned_quantity: returnedQty,
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

    // ===== ENHANCED FETCH CHECKOUTS WITH VIOLATION REPORTS =====
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

            // Department filter for department admin
            if (profile?.role === 'department_admin' && profile.department_id) {
                if (activeTab === 'room') {
                    processedData = processedData.filter(checkout => 
                        checkout.booking?.room?.department?.name
                    );
                }
            }

            // ✅ ENHANCED: Fetch violation reports with details
            const enhancedData = await Promise.all(
                processedData.map(async (checkout) => {
                    const equipment_list = await fetchEquipmentList(checkout);
                    const verification_items = await fetchVerificationItems(
                        checkout.id, 
                        equipment_list, 
                        checkout
                    );

                    // ✅ FETCH VIOLATION REPORTS WITH DETAILS
                    const { data: violations, error: violationError } = await supabase
                        .from('checkout_violations')
                        .select(`
                            id, 
                            title, 
                            description, 
                            severity, 
                            violation_type, 
                            status,
                            created_at,
                            reported_by,
                            reporter:users!checkout_violations_reported_by_fkey(full_name)
                        `)
                        .eq('checkout_id', checkout.id)
                        .eq('status', 'active')
                        .order('created_at', { ascending: false });

                    if (violationError) {
                        console.error('Error checking violations:', violationError);
                    }

                    const has_violations = violations && violations.length > 0;
                    
                    return {
                        ...checkout,
                        equipment_list,
                        verification_items,
                        has_violations,
                        violation_reports: violations || []
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

    // ===== UPDATE VERIFICATION ITEM (LOCAL ONLY) =====
    const updateVerificationItem = async (
        checkoutId: string, 
        equipmentId: string, 
        newReturnedQuantity: number, 
        conditionNotes: string,
        isVerified: boolean
    ) => {
        try {
            console.log('🔧 ValidationQueue: updateVerificationItem called (LOCAL ONLY)', {
                checkoutId,
                equipmentId,
                newReturnedQuantity,
                isVerified
            });
            
        } catch (error: any) {
            console.error('❌ Error updating verification:', error);
            toast.error(`Gagal memperbarui verifikasi: ${error.message}`);
        }
    };

    // ===== APPROVE RETURN - BATCH UPDATE QUANTITIES =====
    const handleApproveReturn = async (checkoutId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(checkoutId));

            console.log('🔥 Starting approval process for checkout:', checkoutId);

            const quantityManager = new EquipmentQuantityManager(supabase);
            
            for (const item of verificationItems) {
                const quantityDifference = item.returned_quantity - item.original_returned_quantity;
                
                console.log(`📊 Processing ${item.equipment_name}:`, {
                    original: item.original_returned_quantity,
                    current: item.returned_quantity,
                    difference: quantityDifference
                });

                // UPDATE CHECKOUT_ITEMS
                if (item.is_verified && item.returned_quantity > 0) {
                    await supabase
                        .from('checkout_items')
                        .upsert({
                            checkout_id: checkoutId,
                            equipment_id: item.equipment_id,
                            quantity: item.returned_quantity,
                            condition_notes: item.condition_notes || null
                        }, { 
                            onConflict: 'checkout_id, equipment_id' 
                        });
                } else {
                    await supabase
                        .from('checkout_items')
                        .delete()
                        .match({ checkout_id: checkoutId, equipment_id: item.equipment_id });
                }

                // UPDATE EQUIPMENT QUANTITY BASED ON DIFFERENCE ONLY
                if (quantityDifference !== 0) {
                    if (quantityDifference > 0) {
                        console.log(`✅ INCREASING equipment ${item.equipment_id} by ${quantityDifference}`);
                        await quantityManager.increaseQuantity(
                            item.equipment_id,
                            quantityDifference,
                            `ValidationQueue: User returned ${quantityDifference} items`
                        );
                        
                    } else {
                        console.log(`⬇️ DECREASING equipment ${item.equipment_id} by ${Math.abs(quantityDifference)}`);
                        await quantityManager.decreaseQuantity(
                            item.equipment_id,
                            Math.abs(quantityDifference),
                            `ValidationQueue: Admin reduced verification by ${Math.abs(quantityDifference)}`
                        );
                    }
                }
            }

            // Update checkout status to approved/completed
            const { error } = await supabase
                .from('checkouts')
                .update({ 
                    status: 'active',
                    approved_by: profile?.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', checkoutId);

            if (error) throw error;

            // Update related booking/lending status
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

            toast.success('Pengembalian disetujui! Kuantitas barang telah diperbarui.');
            
            await fetchCheckouts();
            setShowDetailModal(false);
            
        } catch (error: any) {
            console.error('❌ Error approving return:', error);
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

            toast.success('Pengembalian ditolak.');
            
            await fetchCheckouts();
            setShowDetailModal(false);
            setShowDeleteConfirm(null);
            
        } catch (error: any) {
            console.error('❌ Error rejecting return:', error);
            toast.error(`Gagal menolak pengembalian: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(checkoutId);
                return newSet;
            });
        }
    };

    // ===== DELETE CHECKOUT WITH CASCADE DELETE =====
    const handleDeleteCheckout = async (checkoutId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(checkoutId));

            const { error: itemsError } = await supabase
                .from('checkout_items')
                .delete()
                .eq('checkout_id', checkoutId);

            if (itemsError) {
                console.error('Error deleting checkout_items:', itemsError);
                throw itemsError;
            }

            const { error: violationsError } = await supabase
                .from('checkout_violations')
                .delete()
                .eq('checkout_id', checkoutId);

            if (violationsError) {
                console.error('Error deleting checkout_violations:', violationsError);
                throw violationsError;
            }

            const { error: checkoutError } = await supabase
                .from('checkouts')
                .delete()
                .eq('id', checkoutId);

            if (checkoutError) {
                console.error('Error deleting checkout:', checkoutError);
                throw checkoutError;
            }

            toast.success('Checkout berhasil dihapus permanen.');
            
            await fetchCheckouts();
            setShowDetailModal(false);
            
        } catch (error: any) {
            console.error('❌ Error deleting checkout:', error);
            toast.error(`Gagal menghapus checkout: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(checkoutId);
                return newSet;
            });
        }
    };

    // ===== ADD REPORT FOR ANY CHECKOUT =====
    const handleAddReport = async () => {
        if (!reportData.description.trim() || !reportCheckoutId) {
            toast.error('Deskripsi wajib diisi.');
            return;
        }

        try {
            const targetCheckout = checkouts.find(c => c.id === reportCheckoutId);
            if (!targetCheckout) {
                toast.error('Checkout tidak ditemukan.');
                return;
            }

            const { error } = await supabase
                .from('checkout_violations')
                .insert({
                    checkout_id: reportCheckoutId,
                    user_id: targetCheckout.user_id,
                    violation_type: reportData.violation_type,
                    severity: reportData.severity,
                    title: reportData.title || 'Laporan dari Validasi',
                    description: reportData.description,
                    reported_by: profile?.id,
                    status: 'active'
                });

            if (error) throw error;

            toast.success('Laporan berhasil ditambahkan.');
            setShowReportModal(false);
            setReportCheckoutId(null);
            
            setReportData({ 
                title: '', 
                description: '', 
                severity: 'minor', 
                violation_type: 'damage' 
            });
            
            // ✅ REFRESH DATA TO SHOW NEW REPORT
            await fetchCheckouts();
            
            // ✅ UPDATE SELECTED CHECKOUT IF MODAL IS OPEN
            if (selectedCheckout?.id === reportCheckoutId) {
                const updatedCheckout = checkouts.find(c => c.id === reportCheckoutId);
                if (updatedCheckout) {
                    setSelectedCheckout(updatedCheckout);
                }
            }
            
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
        
        const matchesSearch = 
            checkout.user?.full_name?.toLowerCase().includes(searchLower) ||
            checkout.user?.identity_number?.toLowerCase().includes(searchLower) ||
            (activeTab === 'room' && checkout.booking?.room?.name?.toLowerCase().includes(searchLower)) ||
            (activeTab === 'equipment' && checkout.lendingTool?.equipment_details?.some(eq => 
                eq.name.toLowerCase().includes(searchLower)
            ));
        
        return matchesSearch;
    });

    // ===== UTILITY FUNCTIONS =====
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
        const totalGap = items.reduce((total, item) => {
            const gap = Math.max(0, item.borrowed_quantity - item.returned_quantity);
            return total + gap;
        }, 0);
        
        return totalGap;
    };

    // ===== GET STATUS BADGE =====
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

            {/* ===== ENHANCED SEARCH & FILTERS ===== */}
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
                            {statusFilter === 'all' 
                                ? 'Tidak ada checkout untuk tab ini.' 
                                : `Tidak ada pengembalian dengan status ${statusFilter} untuk ditampilkan.`
                            }
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
                                            {/* Header */}
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
                                                                ? `${checkout.booking?.room?.name} Return`
                                                                : 'Equipment Return'
                                                            }
                                                        </h3>
                                                        {getStatusBadge(checkout.status)}
                                                        {checkout.has_violations && (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                <Flag className="h-3 w-3 mr-1" />
                                                                {checkout.violation_reports?.length || 0} Laporan
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        Pengembalian diminta pada {format(new Date(checkout.checkout_date), 'MMM d, yyyy')}
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
                                                            {format(new Date(checkout.expected_return_date), 'MMM d')}
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

                                            {/* Show progress only for 'returned' status */}
                                            {checkout.status === 'returned' && (
                                                <>
                                                    {/* Progress Bar */}
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
                                                                        : progress.percentage > 50 
                                                                            ? 'bg-blue-500' 
                                                                            : 'bg-yellow-500'
                                                                }`}
                                                                style={{ width: `${progress.percentage}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>

                                                    {/* Alerts */}
                                                    <div className="space-y-2">
                                                        {!progress.canApprove && (
                                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                                <div className="flex items-center">
                                                                    <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                                                                    <span className="text-sm font-medium text-red-800">
                                                                        {progress.mandatory - progress.verifiedMandatory} barang wajib belum diverifikasi
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {quantityGap > 0 && (
                                                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                                                <div className="flex items-center">
                                                                    <Calculator className="h-4 w-4 text-orange-600 mr-2" />
                                                                    <span className="text-sm font-medium text-orange-800">
                                                                        {quantityGap} barang hilang (ada selisih kuantitas)
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {progress.canApprove && quantityGap === 0 && (
                                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                                <div className="flex items-center">
                                                                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                                                    <span className="text-sm font-medium text-green-800">
                                                                        Siap disetujui - semua barang sudah terverifikasi!
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* ✅ VIOLATION REPORTS DISPLAY */}
                                            {checkout.violation_reports && checkout.violation_reports.length > 0 && (
                                                <ViolationReportsDisplay 
                                                    reports={checkout.violation_reports} 
                                                    compact={true} 
                                                />
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
                                            
                                            <button 
                                                onClick={() => {
                                                    setReportCheckoutId(checkout.id);
                                                    setShowReportModal(true);
                                                }}
                                                className="p-2 bg-yellow-100 text-yellow-600 hover:bg-yellow-200 rounded-lg transition-colors"
                                                title="Tambah Laporan"
                                            >
                                                <Flag className="h-4 w-4" />
                                            </button>

                                            <button 
                                                onClick={() => {
                                                    if (window.confirm('Anda yakin ingin menghapus checkout ini secara permanen? Aksi ini tidak dapat dibatalkan.')) {
                                                        handleDeleteCheckout(checkout.id);
                                                    }
                                                }}
                                                disabled={processingIds.has(checkout.id)}
                                                className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                                                title="Hapus Checkout"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ===== ✅ UPDATED VERIFICATION MODAL WITH REPORT BUTTON ===== */}
            {showDetailModal && selectedCheckout && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">
                                        {selectedCheckout.status === 'returned' ? 'Verifikasi Pengembalian' : 'Detail Checkout'}
                                    </h2>
                                    <p className="mt-1 opacity-90">
                                        {selectedCheckout.status === 'returned' 
                                            ? `Verifikasi barang yang dikembalikan dari ${selectedCheckout.user?.full_name}`
                                            : `Lihat detail checkout untuk ${selectedCheckout.user?.full_name}`
                                        }
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {/* ✅ ADD REPORT BUTTON IN MODAL HEADER */}
                                    <button 
                                        onClick={() => {
                                            setReportCheckoutId(selectedCheckout.id);
                                            setShowReportModal(true);
                                        }}
                                        className="flex items-center space-x-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                                        title="Tambah Laporan"
                                    >
                                        <Flag className="h-4 w-4" />
                                        <span>Laporan</span>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setShowDetailModal(false)}
                                        className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
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
                                                    : 'Peminjaman Barang'
                                                }
                                            </h3>
                                            <p className="text-sm text-purple-600">
                                                Estimasi Kembali: {format(new Date(selectedCheckout.expected_return_date), 'MMM d, yyyy')}
                                            </p>
                                            <div className="text-sm text-purple-600">
                                                Status: {getStatusBadge(selectedCheckout.status)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ VIOLATION REPORTS SECTION IN MODAL */}
                            {selectedCheckout.violation_reports && selectedCheckout.violation_reports.length > 0 && (
                                <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-6">
                                    <ViolationReportsDisplay 
                                        reports={selectedCheckout.violation_reports} 
                                        compact={false} 
                                    />
                                </div>
                            )}

                            {/* Equipment Verification Section */}
                            <div className="bg-gray-50 rounded-xl p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                                        <Package className="h-5 w-5 mr-2 text-indigo-600" />
                                        {selectedCheckout.status === 'returned' ? 'Verifikasi Peralatan' : 'Detail Peralatan'}
                                    </h3>
                                    {selectedCheckout.status === 'returned' && (
                                        <div className="text-sm text-gray-600">
                                            {verificationItems.filter(item => item.is_verified).length}/{verificationItems.length} terverifikasi
                                        </div>
                                    )}
                                </div>

                                {verificationItems.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-600">Tidak ada peralatan untuk ditampilkan</p>
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
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        {/* Equipment Header */}
                                                        <div className="flex items-center space-x-3 mb-3">
                                                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                                                selectedCheckout.status === 'returned'
                                                                ? (item.is_verified 
                                                                    ? 'bg-green-100' 
                                                                    : 'bg-gray-100')
                                                                : 'bg-blue-100'
                                                            }`}>
                                                                {selectedCheckout.status === 'returned' && item.is_verified ? (
                                                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                                                ) : (
                                                                    <Package className={`h-5 w-5 ${selectedCheckout.status === 'returned' ? 'text-gray-600' : 'text-blue-600'}`} />
                                                                )}
                                                            </div>
                                                            <div className="flex-1">
                                                                <h4 className="font-semibold text-gray-900 flex items-center">
                                                                    {item.equipment_name}
                                                                    {item.is_mandatory && (
                                                                        <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded">
                                                                            WAJIB
                                                                        </span>
                                                                    )}
                                                                </h4>
                                                                <p className="text-sm text-gray-600">
                                                                    Kode: {item.equipment_code || 'N/A'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Quantity Display with Local +/- Controls */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                            {/* BORROWED (READONLY) */}
                                                            <div className="text-center p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                                                                <div className="text-xl font-bold text-blue-600">
                                                                    {item.borrowed_quantity}
                                                                </div>
                                                                <div className="text-xs text-blue-600 font-medium">
                                                                    DIPINJAM
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {item.equipment_unit}
                                                                </div>
                                                            </div>

                                                            {/* RETURNED (WITH LOCAL +/- CONTROLS) */}
                                                            {selectedCheckout.status === 'returned' ? (
                                                                <div className="text-center p-3 bg-white rounded-lg border-2 border-gray-300">
                                                                    <div className="flex items-center justify-center space-x-2 mb-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                const newQty = Math.max(0, item.returned_quantity - 1);
                                                                                const newItems = [...verificationItems];
                                                                                newItems[index].returned_quantity = newQty;
                                                                                newItems[index].is_verified = newQty > 0;
                                                                                setVerificationItems(newItems);
                                                                            }}
                                                                            disabled={item.returned_quantity <= 0}
                                                                            className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                            title="Kurangi jumlah dikembalikan"
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
                                                                                newItems[index].is_verified = newQty > 0;
                                                                                setVerificationItems(newItems);
                                                                            }}
                                                                            disabled={item.returned_quantity >= item.borrowed_quantity}
                                                                            className="p-1 bg-green-100 hover:bg-green-200 text-green-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                            title="Tambah jumlah dikembalikan"
                                                                        >
                                                                            <Plus className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="text-xs text-gray-600 font-medium">
                                                                        DIKEMBALIKAN
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        Max: {item.borrowed_quantity} {item.equipment_unit}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                                                                    <div className="text-xl font-bold text-gray-600">
                                                                        {item.returned_quantity}
                                                                    </div>
                                                                    <div className="text-xs text-gray-600 font-medium">
                                                                        DIKEMBALIKAN
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        {item.equipment_unit}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* MISSING (CALCULATED) */}
                                                            <div className="text-center p-3 bg-red-50 rounded-lg border-2 border-red-200">
                                                                <div className={`text-xl font-bold ${
                                                                    item.borrowed_quantity - item.returned_quantity > 0 
                                                                        ? 'text-red-600' 
                                                                        : 'text-green-600'
                                                                }`}>
                                                                    {Math.max(0, item.borrowed_quantity - item.returned_quantity)}
                                                                </div>
                                                                <div className="text-xs text-red-600 font-medium">
                                                                    KURANG
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {item.equipment_unit}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Quick Action Buttons - Only for returned status */}
                                                        {selectedCheckout.status === 'returned' && (
                                                            <div className="flex items-center space-x-2 mb-4">
                                                                <button
                                                                    onClick={() => {
                                                                        const newItems = [...verificationItems];
                                                                        newItems[index].returned_quantity = item.borrowed_quantity;
                                                                        newItems[index].is_verified = true;
                                                                        setVerificationItems(newItems);
                                                                    }}
                                                                    disabled={item.returned_quantity === item.borrowed_quantity}
                                                                    className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                                                                >
                                                                    <CheckCircle className="h-3 w-3" />
                                                                    <span>Semua Kembali</span>
                                                                </button>
                                                                
                                                                <button onClick={() => {
                                                                        const newItems = [...verificationItems];
                                                                        newItems[index].returned_quantity = 0;
                                                                        newItems[index].is_verified = false;
                                                                        setVerificationItems(newItems);
                                                                    }}
                                                                    disabled={item.returned_quantity === 0}
                                                                    className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                                                                >
                                                                    <XCircle className="h-3 w-3" />
                                                                    <span>Reset</span>
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Condition Notes */}
                                                        {selectedCheckout.status === 'returned' && (
                                                            <div className="mb-3">
                                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                    Catatan Kondisi (Opsional)
                                                                </label>
                                                                <textarea
                                                                    value={item.condition_notes || ''}
                                                                    onChange={(e) => {
                                                                        const newNotes = e.target.value;
                                                                        const newItems = [...verificationItems];
                                                                        newItems[index].condition_notes = newNotes;
                                                                        setVerificationItems(newItems);
                                                                    }}
                                                                    placeholder="Contoh: Kondisi baik, ada goresan kecil..."
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                                    rows={2}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Show condition notes for non-returned status */}
                                                        {selectedCheckout.status !== 'returned' && item.condition_notes && (
                                                            <div className="mb-3">
                                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                    Catatan Kondisi
                                                                </label>
                                                                <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-800">
                                                                    {item.condition_notes}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Verification Checkbox - Only for returned status */}
                                                        {selectedCheckout.status === 'returned' && (
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center space-x-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.is_verified}
                                                                        onChange={(e) => {
                                                                            const isChecked = e.target.checked;
                                                                            const newItems = [...verificationItems];
                                                                            newItems[index].is_verified = isChecked;
                                                                            
                                                                            if (isChecked && newItems[index].returned_quantity === 0) {
                                                                                newItems[index].returned_quantity = item.borrowed_quantity;
                                                                            } else if (!isChecked) {
                                                                                newItems[index].returned_quantity = 0;
                                                                            }
                                                                            
                                                                            setVerificationItems(newItems);
                                                                        }}
                                                                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                                    />
                                                                    <label className="text-sm font-medium text-gray-900">
                                                                        Saya verifikasi barang ini telah dikembalikan
                                                                    </label>
                                                                </div>
                                                                
                                                                <div className="flex items-center space-x-2">
                                                                    {item.returned_quantity === item.borrowed_quantity ? (
                                                                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                                                                            ✅ Lengkap
                                                                        </span>
                                                                    ) : item.returned_quantity > 0 ? (
                                                                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                                                                            ⚠️ Sebagian
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                                                                            ❌ Belum
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Show verification status for non-returned status */}
                                                        {selectedCheckout.status !== 'returned' && (
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center space-x-3">
                                                                    <div className={`h-5 w-5 rounded flex items-center justify-center ${
                                                                        item.is_verified ? 'bg-green-100' : 'bg-gray-100'
                                                                    }`}>
                                                                        {item.is_verified ? (
                                                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                                                        ) : (
                                                                            <X className="h-4 w-4 text-gray-400" />
                                                                        )}
                                                                    </div>
                                                                    <span className="text-sm font-medium text-gray-900">
                                                                        {item.is_verified ? 'Terverifikasi' : 'Belum Diverifikasi'}
                                                                    </span>
                                                                </div>
                                                                
                                                                <div className="text-right">
                                                                    <div className="text-sm text-gray-600">
                                                                        {item.returned_quantity}/{item.borrowed_quantity} {item.equipment_unit}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {item.returned_quantity === item.borrowed_quantity ? 'Lengkap' : 'Sebagian/Belum'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Summary & Actions - Only for returned status */}
                            {selectedCheckout.status === 'returned' && (
                                <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Verifikasi</h3>
                                    
                                    {(() => {
                                        const progress = getVerificationProgress(verificationItems);
                                        const quantityGap = getTotalQuantityGap(verificationItems);
                                        
                                        return (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                                                        <div className="text-2xl font-bold text-blue-600">{progress.verified}</div>
                                                        <div className="text-sm text-blue-600">Barang Terverifikasi</div>
                                                        <div className="text-xs text-gray-500">dari {progress.total}</div>
                                                    </div>
                                                    
                                                    <div className="text-center p-4 bg-green-50 rounded-lg">
                                                        <div className="text-2xl font-bold text-green-600">{progress.verifiedMandatory}</div>
                                                        <div className="text-sm text-green-600">Wajib OK</div>
                                                        <div className="text-xs text-gray-500">dari {progress.mandatory}</div>
                                                    </div>
                                                    
                                                    <div className="text-center p-4 bg-red-50 rounded-lg">
                                                        <div className="text-2xl font-bold text-red-600">{quantityGap}</div>
                                                        <div className="text-sm text-red-600">Barang Hilang</div>
                                                        <div className="text-xs text-gray-500">selisih kuantitas</div>
                                                    </div>
                                                </div>

                                                {/* Action Buttons INSIDE MODAL */}
                                                <div className="flex justify-end space-x-4 pt-4 border-t">
                                                    <button
                                                        onClick={() => handleRejectReturn(selectedCheckout.id)}
                                                        disabled={processingIds.has(selectedCheckout.id)}
                                                        className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        <X className="h-4 w-4" />
                                                        <span>Tolak Pengembalian</span>
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
                                                        <span>Setujui Pengembalian</span>
                                                    </button>
                                                </div>

                                                {/* Approval Requirements */}
                                                {!progress.canApprove && (
                                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                        <div className="flex items-center">
                                                            <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
                                                            <div>
                                                                <p className="font-medium text-red-800">Belum bisa disetujui</p>
                                                                <p className="text-sm text-red-600">
                                                                    Harap verifikasi {progress.mandatory - progress.verifiedMandatory} sisa barang wajib sebelum menyetujui.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Changes Warning */}
                                                {verificationItems.some(item => item.returned_quantity !== item.original_returned_quantity) && (
                                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                                        <div className="flex items-center">
                                                            <Info className="h-5 w-5 text-yellow-600 mr-3" />
                                                            <div>
                                                                <p className="font-medium text-yellow-800">Ada Perubahan Kuantitas</p>
                                                                <p className="text-sm text-yellow-600">
                                                                    Kuantitas equipment akan diperbarui saat Anda menyetujui pengembalian.
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

                            {/* Summary for non-returned status */}
                            {selectedCheckout.status !== 'returned' && (
                                <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Checkout</h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {verificationItems.length}
                                            </div>
                                            <div className="text-sm text-blue-600">Total Barang</div>
                                        </div>
                                        
                                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                                            <div className="text-2xl font-bold text-gray-600">
                                                {getStatusBadge(selectedCheckout.status)}
                                            </div>
                                            <div className="text-sm text-gray-600">Status Saat Ini</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== ✅ UPDATED REPORT MODAL - Works for any checkout ===== */}
            {showReportModal && reportCheckoutId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Tambah Laporan Masalah</h3>
                            <button
                                onClick={() => {
                                    setShowReportModal(false);
                                    setReportCheckoutId(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Judul Laporan *
                                </label>
                                <input
                                    type="text"
                                    value={reportData.title}
                                    onChange={(e) => setReportData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Deskripsi singkat masalah (wajib)"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Wajib diisi. Jika kosong, judul default akan digunakan.
                                </p>
                            </div>

                            {/* Violation Type Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Deskripsi *
                                </label>
                                <textarea
                                    value={reportData.description}
                                    onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Deskripsi detail masalah..."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tingkat Keparahan
                                </label>
                                <select
                                    value={reportData.severity}
                                    onChange={(e) => setReportData(prev => ({ ...prev, severity: e.target.value as any }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="minor">Minor - Masalah kecil</option>
                                    <option value="major">Major - Masalah signifikan</option>
                                    <option value="critical">Critical - Pelanggaran serius</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowReportModal(false);
                                    setReportCheckoutId(null);
                                }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleAddReport}
                                disabled={!reportData.description.trim()}
                                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                            >
                                Tambah Laporan
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
                            Apakah Anda yakin ingin menolak pengembalian ini? Checkout akan dihapus dan status booking/lending akan dikembalikan.
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