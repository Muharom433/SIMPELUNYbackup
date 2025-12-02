import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Bell, CheckCircle, XCircle, AlertTriangle, User, Building, Calendar,
    Timer, Eye, Check, X, RefreshCw, Filter, Search, FileText, Package,
    Flag, Phone, Wrench, Trash2, Plus, Minus,
    ChevronDown, TrendingDown, BarChart2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// ===== TYPE DEFINITIONS =====
interface Equipment {
    id: string;
    name: string;
    code?: string;
    category?: string;
    quantity: number;
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
}

interface VerificationItem {
    equipment_id: string;
    equipment_name: string;
    equipment_code?: string;
    equipment_unit?: string;
    borrowed_quantity: number;
    returned_quantity: number;
    previously_returned: number;
    is_verified: boolean;
    condition_notes?: string;
    is_mandatory: boolean;
}

type ViolationType = 'late_return' | 'damage' | 'loss' | 'misuse' | 'other';

// ===== VIOLATION REPORTS DISPLAY COMPONENT =====
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

    return (
        <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 flex items-center">
                <Flag className="h-5 w-5 mr-2 text-red-500" />
                Laporan Pelanggaran ({reports.length})
            </h4>
            
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

// ===== GAP ANALYSIS COMPONENT =====
const GapAnalysisDisplay: React.FC<{
    items: VerificationItem[];
}> = ({ items }) => {
    const totalBorrowed = items.reduce((sum, item) => sum + item.borrowed_quantity, 0);
    const totalPreviouslyReturned = items.reduce((sum, item) => sum + item.previously_returned, 0);
    const totalCurrentReturn = items.reduce((sum, item) => sum + item.returned_quantity, 0);
    const totalGap = totalBorrowed - totalPreviouslyReturned - totalCurrentReturn;

    return (
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-900 flex items-center mb-4">
                <BarChart2 className="h-5 w-5 mr-2 text-indigo-600" />
                Analisis Gap Kuantitas
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{totalBorrowed}</div>
                    <div className="text-xs text-blue-700">Total Dipinjam</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{totalPreviouslyReturned}</div>
                    <div className="text-xs text-green-700">Sudah Kembali</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">{totalCurrentReturn}</div>
                    <div className="text-xs text-purple-700">Dikembalikan Sekarang</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${totalGap > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    <div className={`text-2xl font-bold ${totalGap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {totalGap}
                    </div>
                    <div className={`text-xs ${totalGap > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {totalGap > 0 ? 'Masih Kurang' : 'Lengkap'}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ===== MAIN COMPONENT =====
const ValidationQueue: React.FC = () => {
    const { profile } = useAuth();
    
    const [activeTab, setActiveTab] = useState<'room' | 'equipment'>('room');
    const [checkouts, setCheckouts] = useState<CheckoutWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCheckout, setSelectedCheckout] = useState<CheckoutWithDetails | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([]);
    const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
    
    // Report Modal State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportCheckoutId, setReportCheckoutId] = useState<string | null>(null);
    const [reportData, setReportData] = useState({
        title: '',
        description: '',
        severity: 'minor' as 'minor' | 'major' | 'critical',
        violation_type: 'damage' as ViolationType
    });
    
    const [statusFilter, setStatusFilter] = useState<'all' | 'returned' | 'active' | 'overdue' | 'pending'>('returned');

    // ===== FETCH ALL EQUIPMENT =====
    const fetchAllEquipment = async () => {
        try {
            const { data, error } = await supabase
                .from('equipment')
                .select('id, name, code, category, quantity, unit, is_mandatory');
            
            if (error) throw error;
            setAllEquipment(data || []);
        } catch (error) {
            console.error('Error fetching equipment:', error);
        }
    };

    // ===== BUILD VERIFICATION ITEMS =====
    const buildVerificationItems = useCallback((checkout: CheckoutWithDetails): VerificationItem[] => {
        const items: VerificationItem[] = [];

        if (checkout.type === 'room' && checkout.booking) {
            const { equipment_requested, equipment_quantities } = checkout.booking;

            // Build map of previously returned quantities (from checkout_items if any)
            const previouslyReturnedMap = new Map<string, number>();
            if (checkout.verification_items) {
                checkout.verification_items.forEach(item => {
                    previouslyReturnedMap.set(item.equipment_id, item.previously_returned);
                });
            }

            // Build verification items from equipment_requested
            if (equipment_requested && equipment_quantities) {
                // Group by equipment ID to handle duplicates
                const equipmentMap = new Map<string, number>();
                equipment_requested.forEach((eqId, index) => {
                    const existingQty = equipmentMap.get(eqId) || 0;
                    equipmentMap.set(eqId, existingQty + (equipment_quantities[index] || 1));
                });

                equipmentMap.forEach((borrowedQty, eqId) => {
                    const equipment = allEquipment.find(e => e.id === eqId);
                    const previouslyReturned = previouslyReturnedMap.get(eqId) || 0;
                    // Assume all borrowed quantity is returned by user, but admin will verify actual
                    const returnedQty = borrowedQty - previouslyReturned;

                    items.push({
                        equipment_id: eqId,
                        equipment_name: equipment?.name || `Equipment ${eqId.slice(0, 8)}`,
                        equipment_code: equipment?.code,
                        equipment_unit: equipment?.unit || 'pcs',
                        borrowed_quantity: borrowedQty,
                        returned_quantity: returnedQty > 0 ? returnedQty : 0,
                        previously_returned: previouslyReturned,
                        is_verified: false,
                        condition_notes: '',
                        is_mandatory: equipment?.is_mandatory || false
                    });
                });
            }
        } else if (checkout.type === 'things' && checkout.lendingTool) {
            const { id_equipment, qty } = checkout.lendingTool;

            if (id_equipment && qty) {
                const equipmentMap = new Map<string, number>();
                id_equipment.forEach((eqId, index) => {
                    const existingQty = equipmentMap.get(eqId) || 0;
                    equipmentMap.set(eqId, existingQty + (qty[index] || 1));
                });

                equipmentMap.forEach((borrowedQty, eqId) => {
                    const equipment = allEquipment.find(e => e.id === eqId);
                    // For lending tools, we don't track previously returned, so set to 0
                    items.push({
                        equipment_id: eqId,
                        equipment_name: equipment?.name || `Equipment ${eqId.slice(0, 8)}`,
                        equipment_code: equipment?.code,
                        equipment_unit: equipment?.unit || 'pcs',
                        borrowed_quantity: borrowedQty,
                        returned_quantity: borrowedQty, // Assume all returned
                        previously_returned: 0,
                        is_verified: false,
                        condition_notes: '',
                        is_mandatory: equipment?.is_mandatory || false
                    });
                });
            }
        }

        return items;
    }, [allEquipment]);

    // ===== FETCH CHECKOUTS =====
    const fetchCheckouts = useCallback(async () => {
        try {
            setLoading(true);
            
            let processedData: CheckoutWithDetails[] = [];
            
            if (activeTab === 'room') {
                // Query for room checkouts (booking-based)
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

                const { data, error } = await query;
                if (error) throw error;
                processedData = data || [];
                
            } else {
                // Query for equipment checkouts (lending tool-based)
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

                const { data, error } = await query;
                if (error) throw error;
                
                // Enrich with equipment details
                processedData = await Promise.all(
                    (data || []).map(async (checkout) => {
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

            // Fetch violation reports for each checkout
            const enhancedData = await Promise.all(
                processedData.map(async (checkout) => {
                    const { data: violations } = await supabase
                        .from('checkout_violations')
                        .select(`
                            id, title, description, severity, violation_type, status,
                            created_at, reported_by,
                            reporter:users!checkout_violations_reported_by_fkey(full_name)
                        `)
                        .eq('checkout_id', checkout.id)
                        .eq('status', 'active')
                        .order('created_at', { ascending: false });

                    return {
                        ...checkout,
                        has_violations: violations && violations.length > 0,
                        violation_reports: violations || []
                    };
                })
            );

            setCheckouts(enhancedData);
            
        } catch (error: any) {
            console.error('Error fetching checkouts:', error);
            toast.error(`Gagal memuat data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [activeTab, statusFilter]);

    // ===== APPROVE RETURN =====
    const handleApproveReturn = async (checkoutId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(checkoutId));

            const checkout = checkouts.find(c => c.id === checkoutId);
            if (!checkout) throw new Error('Checkout tidak ditemukan');

            console.log('🔥 Starting approval process for checkout:', checkoutId);

            // 1. Update equipment quantities based on returned items
            for (const item of verificationItems) {
                if (item.is_verified && item.returned_quantity > 0) {
                    // Get current quantity
                    const { data: currentEq } = await supabase
                        .from('equipment')
                        .select('quantity, name')
                        .eq('id', item.equipment_id)
                        .single();

                    if (currentEq) {
                        const newQuantity = currentEq.quantity + item.returned_quantity;

                        // Update equipment quantity
                        await supabase
                            .from('equipment')
                            .update({ 
                                quantity: newQuantity,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', item.equipment_id);

                        console.log(`✅ ${currentEq.name}: ${currentEq.quantity} → ${newQuantity} (+${item.returned_quantity})`);
                    }
                }
            }

            // 2. Update checkout status and notes
            const { error: checkoutError } = await supabase
                .from('checkouts')
                .update({
                    status: 'active',
                    return_notes: `Diverifikasi oleh admin. ${verificationItems.filter(i => i.is_verified).length} item dikembalikan.`,
                    approved_by: profile?.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', checkoutId);

            if (checkoutError) throw checkoutError;

            // 3. Update booking/lending status to completed
            if (checkout.type === 'room' && checkout.booking_id) {
                await supabase
                    .from('bookings')
                    .update({ status: 'completed' })
                    .eq('id', checkout.booking_id);
            } else if (checkout.type === 'things' && checkout.lendingTool_id) {
                await supabase
                    .from('lending_tool')
                    .update({ status: 'completed' })
                    .eq('id', checkout.lendingTool_id);
            }

            toast.success('Pengembalian berhasil diverifikasi! Stok equipment telah diperbarui.');
            
            setShowDetailModal(false);
            setSelectedCheckout(null);
            await fetchCheckouts();

        } catch (error: any) {
            console.error('❌ Error approving return:', error);
            toast.error(`Gagal memverifikasi: ${error.message}`);
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

            const checkout = checkouts.find(c => c.id === checkoutId);
            if (!checkout) throw new Error('Checkout tidak ditemukan');

            // Delete checkout record
            await supabase.from('checkouts').delete().eq('id', checkoutId);

            // Revert booking/lending status back to borrowed
            if (checkout.type === 'room' && checkout.booking_id) {
                await supabase
                    .from('bookings')
                    .update({ status: 'borrowed' })
                    .eq('id', checkout.booking_id);
            } else if (checkout.type === 'things' && checkout.lendingTool_id) {
                await supabase
                    .from('lending_tool')
                    .update({ status: 'borrow' })
                    .eq('id', checkout.lendingTool_id);
            }

            toast.success('Pengembalian ditolak. Status dikembalikan ke borrowed.');
            
            setShowDetailModal(false);
            await fetchCheckouts();

        } catch (error: any) {
            console.error('❌ Error rejecting return:', error);
            toast.error(`Gagal menolak: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(checkoutId);
                return newSet;
            });
        }
    };

    // ===== ADD VIOLATION REPORT =====
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
                    title: reportData.title || `Laporan ${reportData.violation_type}`,
                    description: reportData.description,
                    reported_by: profile?.id,
                    status: 'active'
                });

            if (error) throw error;

            toast.success('Laporan berhasil ditambahkan.');
            setShowReportModal(false);
            setReportCheckoutId(null);
            setReportData({ title: '', description: '', severity: 'minor', violation_type: 'damage' });
            
            await fetchCheckouts();
            
        } catch (error: any) {
            console.error('Error adding report:', error);
            toast.error(`Gagal menambahkan laporan: ${error.message}`);
        }
    };

    // ===== EFFECTS =====
    useEffect(() => {
        if (profile) {
            fetchAllEquipment();
            fetchCheckouts();
        }
    }, [profile, fetchCheckouts]);

    useEffect(() => {
        if (selectedCheckout && allEquipment.length > 0) {
            const items = buildVerificationItems(selectedCheckout);
            setVerificationItems(items);
        }
    }, [selectedCheckout, allEquipment, buildVerificationItems]);

    // ===== HELPER: Get Room Name from booking.room =====
    const getRoomName = (checkout: CheckoutWithDetails): string => {
        // Nama ruangan diambil dari booking.room, bukan checkout.room_id
        return checkout.booking?.room?.name || 'Unknown Room';
    };

    // ===== FILTERS =====
    const filteredCheckouts = useMemo(() => {
        return checkouts.filter(checkout => {
            const searchLower = searchTerm.toLowerCase();
            const roomName = getRoomName(checkout).toLowerCase();
            return (
                checkout.user?.full_name?.toLowerCase().includes(searchLower) ||
                checkout.user?.identity_number?.toLowerCase().includes(searchLower) ||
                (activeTab === 'room' && roomName.includes(searchLower))
            );
        });
    }, [checkouts, searchTerm, activeTab]);

    // ===== STATUS BADGE =====
    const getStatusBadge = (status: string) => {
        const config: Record<string, { color: string; icon: string; label: string }> = {
            'returned': { color: 'bg-blue-100 text-blue-800', icon: '📦', label: 'Menunggu Verifikasi' },
            'active': { color: 'bg-green-100 text-green-800', icon: '✅', label: 'Terverifikasi' },
            'overdue': { color: 'bg-red-100 text-red-800', icon: '⚠️', label: 'Terlambat' },
            'pending': { color: 'bg-yellow-100 text-yellow-800', icon: '⏳', label: 'Pending' }
        };

        const cfg = config[status] || config.pending;
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                <span className="mr-1">{cfg.icon}</span>
                {cfg.label}
            </span>
        );
    };

    // ===== VERIFICATION PROGRESS =====
    const getVerificationProgress = useCallback((items: VerificationItem[]) => {
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
            canApprove: verifiedItems > 0 && verifiedMandatory === mandatoryItems.length
        };
    }, []);

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
            {/* HEADER */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3">
                            <Bell className="h-8 w-8" />
                            <span>Antrean Validasi Pengembalian</span>
                        </h1>
                        <p className="mt-2 opacity-90">
                            Verifikasi dan setujui pengembalian barang dari pengguna
                        </p>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-2xl font-bold">{checkouts.length}</div>
                        <div className="text-sm opacity-80">Total Checkout</div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    <button 
                        onClick={() => setActiveTab('room')} 
                        className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                            activeTab === 'room' 
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Building className="h-5 w-5" />
                            <span>Pengembalian Ruangan</span>
                        </div>
                    </button>
                    <button 
                        onClick={() => setActiveTab('equipment')} 
                        className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                            activeTab === 'equipment' 
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Package className="h-5 w-5" />
                            <span>Pengembalian Barang</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full lg:flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Cari berdasarkan nama, NIM, ruangan..."
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                        />
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">Semua Status</option>
                            <option value="returned">Menunggu Verifikasi</option>
                            <option value="active">Terverifikasi</option>
                            <option value="overdue">Terlambat</option>
                        </select>
                        
                        <button 
                            onClick={fetchCheckouts}
                            disabled={loading}
                            className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* CHECKOUT LIST */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                    </div>
                ) : filteredCheckouts.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Tidak Ada Data</h3>
                        <p className="text-gray-600">Tidak ada pengembalian yang perlu diverifikasi.</p>
                    </div>
                ) : (
                    filteredCheckouts.map((checkout) => {
                        const items = buildVerificationItems(checkout);
                        const progress = getVerificationProgress(items);
                        const totalGap = items.reduce((sum, item) => 
                            sum + Math.max(0, item.borrowed_quantity - item.previously_returned - item.returned_quantity), 0
                        );

                        return (
                            <div 
                                key={checkout.id}
                                className={`bg-white rounded-xl shadow-sm border-2 hover:shadow-md transition-all ${
                                    checkout.has_violations ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                }`}
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            {/* Header */}
                                            <div className="flex items-center space-x-4 mb-4">
                                                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                                                    activeTab === 'room' 
                                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500' 
                                                        : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                                }`}>
                                                    {activeTab === 'room' ? (
                                                        <Building className="h-6 w-6 text-white" />
                                                    ) : (
                                                        <Package className="h-6 w-6 text-white" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center space-x-3">
                                                        <h3 className="text-lg font-semibold text-gray-900">
                                                            {activeTab === 'room' 
                                                                ? getRoomName(checkout)
                                                                : 'Peminjaman Peralatan'
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
                                                        Checkout: {format(new Date(checkout.checkout_date), 'dd MMM yyyy HH:mm')}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                                <div className="flex items-center space-x-2">
                                                    <User className="h-4 w-4 text-gray-400" />
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm">{checkout.user?.full_name}</p>
                                                        <p className="text-xs text-gray-500">{checkout.user?.identity_number}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center space-x-2">
                                                    <Package className="h-4 w-4 text-gray-400" />
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm">{items.length} Jenis</p>
                                                        <p className="text-xs text-gray-500">Peralatan</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <TrendingDown className="h-4 w-4 text-blue-500" />
                                                    <div>
                                                        <p className="font-medium text-blue-600 text-sm">
                                                            {items.reduce((sum, i) => sum + i.borrowed_quantity, 0)}
                                                        </p>
                                                        <p className="text-xs text-gray-500">Total Dipinjam</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    {totalGap > 0 ? (
                                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                                    ) : (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    )}
                                                    <div>
                                                        <p className={`font-medium text-sm ${totalGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {totalGap > 0 ? `${totalGap} Kurang` : 'Lengkap'}
                                                        </p>
                                                        <p className="text-xs text-gray-500">Status Gap</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Violation Reports */}
                                            {checkout.violation_reports && checkout.violation_reports.length > 0 && (
                                                <ViolationReportsDisplay reports={checkout.violation_reports} compact={true} />
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center space-x-2 ml-4">
                                            <button 
                                                onClick={() => {
                                                    setSelectedCheckout(checkout);
                                                    setShowDetailModal(true);
                                                }}
                                                className="p-2 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 rounded-lg"
                                                title="Verifikasi"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            
                                            <button 
                                                onClick={() => {
                                                    setReportCheckoutId(checkout.id);
                                                    setShowReportModal(true);
                                                }}
                                                className="p-2 bg-yellow-100 text-yellow-600 hover:bg-yellow-200 rounded-lg"
                                                title="Tambah Laporan"
                                            >
                                                <Flag className="h-4 w-4" />
                                            </button>

                                            <button 
                                                onClick={() => {
                                                    if (window.confirm('Hapus checkout ini?')) {
                                                        handleRejectReturn(checkout.id);
                                                    }
                                                }}
                                                disabled={processingIds.has(checkout.id)}
                                                className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                                                title="Hapus"
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

            {/* VERIFICATION MODAL */}
            {showDetailModal && selectedCheckout && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Verifikasi Pengembalian</h2>
                                    <p className="mt-1 opacity-90">
                                        {selectedCheckout.user?.full_name} - {
                                            activeTab === 'room' 
                                                ? getRoomName(selectedCheckout)
                                                : 'Peminjaman Peralatan'
                                        }
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button 
                                        onClick={() => {
                                            setReportCheckoutId(selectedCheckout.id);
                                            setShowReportModal(true);
                                        }}
                                        className="flex items-center space-x-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg"
                                    >
                                        <Flag className="h-4 w-4" />
                                        <span>Laporan</span>
                                    </button>
                                    <button 
                                        onClick={() => setShowDetailModal(false)}
                                        className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                            {/* User & Booking Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="bg-indigo-50 rounded-xl p-4">
                                    <h4 className="font-semibold text-indigo-900 mb-2">Informasi Peminjam</h4>
                                    <p className="font-medium">{selectedCheckout.user?.full_name}</p>
                                    <p className="text-sm text-indigo-700">{selectedCheckout.user?.identity_number}</p>
                                    <p className="text-sm text-indigo-700">{selectedCheckout.user?.phone_number}</p>
                                </div>
                                
                                <div className="bg-purple-50 rounded-xl p-4">
                                    <h4 className="font-semibold text-purple-900 mb-2">Informasi Checkout</h4>
                                    <p className="text-sm">
                                        <strong>Tanggal:</strong> {format(new Date(selectedCheckout.checkout_date), 'dd MMM yyyy HH:mm')}
                                    </p>
                                    <p className="text-sm">
                                        <strong>Status:</strong> {getStatusBadge(selectedCheckout.status)}
                                    </p>
                                </div>
                            </div>

                            {/* Violation Reports */}
                            {selectedCheckout.violation_reports && selectedCheckout.violation_reports.length > 0 && (
                                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6">
                                    <ViolationReportsDisplay reports={selectedCheckout.violation_reports} compact={false} />
                                </div>
                            )}

                            {/* Gap Analysis */}
                            <div className="mb-6">
                                <GapAnalysisDisplay items={verificationItems} />
                            </div>

                            {/* Equipment Verification List */}
                            <div className="bg-gray-50 rounded-xl p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                    <Package className="h-5 w-5 mr-2 text-indigo-600" />
                                    Verifikasi Peralatan
                                </h3>

                                <div className="space-y-4">
                                    {verificationItems.map((item, index) => {
                                        const gap = item.borrowed_quantity - item.previously_returned - item.returned_quantity;
                                        
                                        return (
                                            <div 
                                                key={item.equipment_id}
                                                className={`border-2 rounded-xl p-4 ${
                                                    item.is_verified 
                                                        ? 'border-green-300 bg-green-50' 
                                                        : 'border-gray-200 bg-white'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                                            item.is_verified ? 'bg-green-100' : 'bg-gray-100'
                                                        }`}>
                                                            {item.is_verified ? (
                                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                                            ) : (
                                                                <Package className="h-5 w-5 text-gray-600" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-gray-900 flex items-center">
                                                                {item.equipment_name}
                                                                {item.is_mandatory && (
                                                                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                                                        WAJIB
                                                                    </span>
                                                                )}
                                                            </h4>
                                                            <p className="text-sm text-gray-600">Kode: {item.equipment_code || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Quantity Grid */}
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                                                    <div className="text-center p-2 bg-blue-50 rounded-lg">
                                                        <div className="text-lg font-bold text-blue-600">{item.borrowed_quantity}</div>
                                                        <div className="text-xs text-blue-700">Dipinjam</div>
                                                    </div>
                                                    
                                                    <div className="text-center p-2 bg-green-50 rounded-lg">
                                                        <div className="text-lg font-bold text-green-600">{item.previously_returned}</div>
                                                        <div className="text-xs text-green-700">Sudah Kembali</div>
                                                    </div>

                                                    <div className="text-center p-2 bg-white rounded-lg border-2 border-gray-300">
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <button
                                                                onClick={() => {
                                                                    const newItems = [...verificationItems];
                                                                    newItems[index].returned_quantity = Math.max(0, item.returned_quantity - 1);
                                                                    newItems[index].is_verified = newItems[index].returned_quantity > 0;
                                                                    setVerificationItems(newItems);
                                                                }}
                                                                disabled={item.returned_quantity <= 0}
                                                                className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded disabled:opacity-50"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <span className="text-lg font-bold text-gray-900 w-8 text-center">
                                                                {item.returned_quantity}
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    const maxReturn = item.borrowed_quantity - item.previously_returned;
                                                                    const newItems = [...verificationItems];
                                                                    newItems[index].returned_quantity = Math.min(maxReturn, item.returned_quantity + 1);
                                                                    newItems[index].is_verified = newItems[index].returned_quantity > 0;
                                                                    setVerificationItems(newItems);
                                                                }}
                                                                disabled={item.returned_quantity >= item.borrowed_quantity - item.previously_returned}
                                                                className="p-1 bg-green-100 hover:bg-green-200 text-green-600 rounded disabled:opacity-50"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                        <div className="text-xs text-gray-600 mt-1">Dikembalikan</div>
                                                    </div>

                                                    <div className={`text-center p-2 rounded-lg ${gap > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                                        <div className={`text-lg font-bold ${gap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {gap}
                                                        </div>
                                                        <div className={`text-xs ${gap > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                                            {gap > 0 ? 'Kurang' : 'OK'}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-center">
                                                        <button
                                                            onClick={() => {
                                                                const maxReturn = item.borrowed_quantity - item.previously_returned;
                                                                const newItems = [...verificationItems];
                                                                newItems[index].returned_quantity = maxReturn;
                                                                newItems[index].is_verified = true;
                                                                setVerificationItems(newItems);
                                                            }}
                                                            className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-xs font-medium"
                                                        >
                                                            Semua
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Condition Notes */}
                                                <div className="mb-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Catatan kondisi (opsional)..."
                                                        value={item.condition_notes || ''}
                                                        onChange={(e) => {
                                                            const newItems = [...verificationItems];
                                                            newItems[index].condition_notes = e.target.value;
                                                            setVerificationItems(newItems);
                                                        }}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                    />
                                                </div>

                                                {/* Verification Checkbox */}
                                                <div className="flex items-center space-x-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.is_verified}
                                                        onChange={(e) => {
                                                            const newItems = [...verificationItems];
                                                            newItems[index].is_verified = e.target.checked;
                                                            if (e.target.checked && newItems[index].returned_quantity === 0) {
                                                                newItems[index].returned_quantity = item.borrowed_quantity - item.previously_returned;
                                                            }
                                                            setVerificationItems(newItems);
                                                        }}
                                                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                    />
                                                    <label className="text-sm font-medium text-gray-900">
                                                        Verifikasi barang ini telah dikembalikan
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="border-t px-6 py-4 bg-gray-50 flex justify-between items-center">
                            <div className="text-sm text-gray-600">
                                {verificationItems.filter(i => i.is_verified).length} dari {verificationItems.length} item diverifikasi
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => handleRejectReturn(selectedCheckout.id)}
                                    disabled={processingIds.has(selectedCheckout.id)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    <X className="h-4 w-4" />
                                    <span>Tolak</span>
                                </button>
                                <button
                                    onClick={() => handleApproveReturn(selectedCheckout.id)}
                                    disabled={!verificationItems.some(i => i.is_verified) || processingIds.has(selectedCheckout.id)}
                                    className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {processingIds.has(selectedCheckout.id) ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="h-4 w-4" />
                                    )}
                                    <span>Setujui Pengembalian</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* REPORT MODAL */}
            {showReportModal && reportCheckoutId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Tambah Laporan Pelanggaran</h3>
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">Judul Laporan</label>
                                <input
                                    type="text"
                                    value={reportData.title}
                                    onChange={(e) => setReportData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Judul singkat..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Pelanggaran</label>
                                <select
                                    value={reportData.violation_type}
                                    onChange={(e) => setReportData(prev => ({ ...prev, violation_type: e.target.value as ViolationType }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="damage">Kerusakan</option>
                                    <option value="loss">Kehilangan</option>
                                    <option value="late_return">Keterlambatan</option>
                                    <option value="misuse">Penyalahgunaan</option>
                                    <option value="other">Lainnya</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi *</label>
                                <textarea
                                    value={reportData.description}
                                    onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Jelaskan detail pelanggaran..."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tingkat Keparahan</label>
                                <select
                                    value={reportData.severity}
                                    onChange={(e) => setReportData(prev => ({ ...prev, severity: e.target.value as any }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="minor">Minor</option>
                                    <option value="major">Major</option>
                                    <option value="critical">Critical</option>
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
        </div>
    );
};

export default ValidationQueue;