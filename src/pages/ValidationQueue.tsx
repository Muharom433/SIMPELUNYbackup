import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Bell, CheckCircle, XCircle, AlertTriangle, User, Building, Calendar,
    Timer, Eye, Check, X, RefreshCw, Filter, Search, FileText, Package,
    Flag, Phone, Wrench, Trash2, Plus, Minus,
    ChevronDown, TrendingDown, BarChart2, ArrowRight, Home, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

// ===== TYPE DEFINITIONS =====
interface Room {
    id: string;
    name: string;
    code: string;
    capacity?: number;
    department?: { name: string };
}

interface Equipment {
    id: string;
    name: string;
    code?: string;
    category?: string;
    quantity: number;
    unit?: string;
    is_mandatory: boolean;
}

// ⭐⭐ CHECKOUT ITEM DARI DATABASE - STRUKTUR YANG BENAR
interface CheckoutItem {
    id: string;
    checkout_id: string;
    equipment_requested: string[]; // ⭐ Array equipment_id
    equipment_quantities: number[]; // ⭐ Array quantities
    equipment_back?: string[]; // ⭐ Equipment yang sudah kembali
    quantities_back?: number[]; // ⭐ Quantities yang sudah kembali
    status?: string;
    created_at: string;
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
    actual_return_date?: string;
    status: 'returned' | 'active' | 'overdue' | 'pending';
    type: 'room' | 'things';
    room_id?: string;
    created_at: string;
    has_violations?: boolean;
    violation_reports?: ViolationReport[];
    has_room_changed?: boolean;
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
        room_id: string;
        room?: Room;
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
    old_room?: Room;
    checkout_items?: CheckoutItem[]; // ⭐⭐ ITEMS DARI CHECKOUT_ITEMS TABLE
}

// ⭐⭐ VERIFICATION ITEM - UPDATED
interface VerificationItem {
    equipment_id: string;
    equipment_name: string;
    equipment_code?: string;
    equipment_unit?: string;
    borrowed_quantity: number; // Total dipinjam (dari checkout_items)
    returned_quantity: number; // Yang dikembalikan sekarang (input admin)
    previously_returned: number; // Sudah kembali sebelumnya (dari equipment_back)
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

// ===== ROOM INFO COMPONENT =====
const RoomInfoDisplay: React.FC<{
    checkout: CheckoutWithDetails;
}> = ({ checkout }) => {
    const hasRoomChanged = checkout.room_id && checkout.old_room;
    const originalRoom = hasRoomChanged ? checkout.old_room : checkout.booking?.room;
    const currentRoom = checkout.booking?.room;

    if (hasRoomChanged) {
        return (
            <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                        <Home className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-medium text-amber-700">Ruangan Lama (Yang Divalidasi)</span>
                    </div>
                    <p className="font-semibold text-amber-900">{originalRoom?.name || 'Unknown'}</p>
                    <p className="text-xs text-amber-700">Kode: {originalRoom?.code || 'N/A'}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                        <Building className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Ruangan Saat Ini</span>
                    </div>
                    <p className="font-semibold text-blue-900">{currentRoom?.name || 'Unknown'}</p>
                    <p className="text-xs text-blue-700">Kode: {currentRoom?.code || 'N/A'}</p>
                </div>

                <div className="flex items-center justify-center text-amber-600 bg-amber-50 rounded-lg p-2">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    <span className="text-xs font-medium">Ada Perpindahan Ruangan</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
                <Building className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-medium text-indigo-700">Ruangan</span>
            </div>
            <p className="font-semibold text-indigo-900">{originalRoom?.name || 'Unknown'}</p>
            <p className="text-xs text-indigo-700">Kode: {originalRoom?.code || 'N/A'}</p>
        </div>
    );
};

// ===== MAIN COMPONENT =====
const ValidationQueue: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();
    const [activeTab, setActiveTab] = useState<'room' | 'equipment'>('room');
    const [checkouts, setCheckouts] = useState<CheckoutWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCheckout, setSelectedCheckout] = useState<CheckoutWithDetails | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([]);
    const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);

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

    // ===== FETCH ROOM BY ID =====
    const fetchRoomById = async (roomId: string): Promise<Room | null> => {
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select(`
                    id, name, code, capacity,
                    department:departments(name)
                `)
                .eq('id', roomId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching room:', error);
            return null;
        }
    };

    // ⭐⭐ BUILD VERIFICATION ITEMS - DARI CHECKOUT_ITEMS ARRAYS
    const buildVerificationItems = useCallback((checkout: CheckoutWithDetails): VerificationItem[] => {
        const items: VerificationItem[] = [];

        console.log('📦 Building verification items for checkout:', checkout.id);
        console.log('   Checkout items count:', checkout.checkout_items?.length || 0);

        // ⭐⭐ WAJIB DARI CHECKOUT_ITEMS
        if (!checkout.checkout_items || checkout.checkout_items.length === 0) {
            console.warn('⚠️ No checkout_items found for checkout:', checkout.id);
            toast.error('Data checkout_items tidak ditemukan. Pastikan checkout dibuat dengan benar.');
            return [];
        }

        // ⭐ Ambil checkout_item pertama (biasanya hanya ada 1 record per checkout)
        const checkoutItem = checkout.checkout_items[0];

        if (!checkoutItem.equipment_requested || !checkoutItem.equipment_quantities) {
            console.warn('⚠️ No equipment_requested in checkout_items');
            return [];
        }

        console.log('   Equipment requested:', checkoutItem.equipment_requested.length);
        console.log('   Equipment back:', checkoutItem.equipment_back?.length || 0);
        console.log('   🔍 DEBUG - equipment_requested:', checkoutItem.equipment_requested);
        console.log('   🔍 DEBUG - equipment_quantities:', checkoutItem.equipment_quantities);
        console.log('   🔍 DEBUG - equipment_back:', checkoutItem.equipment_back);
        console.log('   🔍 DEBUG - quantities_back:', checkoutItem.quantities_back);

        // ⭐ Loop langsung tanpa grouping (supaya angka tidak dijumlahkan)
        checkoutItem.equipment_requested.forEach((eqId, index) => {
            const equipment = allEquipment.find(e => e.id === eqId);

            // ⭐⭐ PENTING: Konversi eksplisit ke NUMBER untuk hindari string concatenation
            const borrowedQty = Number(checkoutItem.equipment_quantities[index]) || 1;

            console.log(`   🔍 DEBUG - equipment_quantities[${index}]:`, checkoutItem.equipment_quantities[index], 'type:', typeof checkoutItem.equipment_quantities[index]);

            // ⭐⭐ LOGIKA BARU: Cari sudah kembali dari quantities_back (bukan equipment_back)
            // quantities_back = total kumulatif yang sudah dikembalikan
            let alreadyReturned = 0;
            if (checkoutItem.equipment_back && checkoutItem.quantities_back) {
                const backIndex = checkoutItem.equipment_back.indexOf(eqId);
                if (backIndex !== -1) {
                    // ⭐⭐ Konversi eksplisit ke NUMBER
                    alreadyReturned = Number(checkoutItem.quantities_back[backIndex]) || 0;
                    console.log(`   🔍 DEBUG - quantities_back[${backIndex}]:`, checkoutItem.quantities_back[backIndex], 'type:', typeof checkoutItem.quantities_back[backIndex]);
                }
            }

            // ⭐⭐ GAP = dipinjam - sudah kembali
            const gap = borrowedQty - alreadyReturned;

            console.log(`   📦 ${equipment?.name || eqId}: dipinjam=${borrowedQty}, sudah_kembali=${alreadyReturned}, gap=${gap}`);

            items.push({
                equipment_id: eqId,
                equipment_name: equipment?.name || `Equipment ${eqId.slice(0, 8)}`,
                equipment_code: equipment?.code,
                equipment_unit: equipment?.unit || 'pcs',
                borrowed_quantity: borrowedQty, // ⭐ Total dipinjam
                returned_quantity: gap > 0 ? gap : 0, // ⭐ Default input admin = sisa gap
                previously_returned: alreadyReturned, // ⭐ Sudah kembali (dari quantities_back)
                is_verified: false,
                condition_notes: '',
                is_mandatory: equipment?.is_mandatory || false
            });
        });

        console.log('✅ Built', items.length, 'verification items');
        return items;
    }, [allEquipment]);

    // ⭐⭐ FETCH CHECKOUTS - LANGSUNG FETCH CHECKOUT_ITEMS
    const fetchCheckouts = useCallback(async () => {
        try {
            setLoading(true);

            console.log('🔍 Fetching checkouts for tab:', activeTab, 'status:', statusFilter);

            // Check if user is laboratory and has department_id
            const isLaboratory = profile?.role === 'laboratory';
            const laborDeptId = profile?.department_id;
            const laborStudyProgramId = profile?.study_program_id;

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
                            id, purpose, room_id,
                            room:rooms(
                                id, name, code, capacity, study_program_ids, department_id,
                                department:departments(name)
                            )
                        ),
                        checkout_items!checkout_items_checkout_id_fkey(
                            id, 
                            equipment_requested, 
                            equipment_quantities, 
                            equipment_back, 
                            quantities_back,
                            status,
                            created_at
                        )
                    `)
                    .eq('type', 'room');

                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }

                query = query.order('created_at', { ascending: false });

                const { data, error } = await query;
                if (error) {
                    console.error('❌ Error fetching room checkouts:', error);
                    throw error;
                }

                console.log(`✅ Fetched ${data?.length || 0} room checkouts`);

                // Laboratory filtering logic:
                // - Department MUST be same as laboran's department
                // - Study program can be NULL (show) OR same as laboran's study program (show)
                // - If study program is DIFFERENT from laboran's → don't show
                let filteredData = data || [];
                if (isLaboratory && laborDeptId) {
                    filteredData = filteredData.filter((checkout: any) => {
                        const room = checkout.booking?.room;
                        if (!room) return false;

                        const roomDeptId = room.department_id;
                        const roomProdiIds = room.study_program_ids || [];

                        // Case 1: Department exists and matches user's department -> SHOW
                        if (roomDeptId && roomDeptId === laborDeptId) {
                            return true;
                        }

                        // Case 2: Department is null/general BUT study_program_ids includes user's prodi -> SHOW
                        if (!roomDeptId && laborStudyProgramId && roomProdiIds.includes(laborStudyProgramId)) {
                            return true;
                        }

                        // Otherwise -> HIDE
                        return false;
                    });
                    console.log(`🔬 Filtered to ${filteredData.length} checkouts for laboran`);
                }

                // Process room data
                processedData = await Promise.all(
                    filteredData.map(async (checkout) => {
                        let old_room: Room | null = null;
                        let hasRoomChanged = false;

                        // Fetch old room if room_id exists
                        if (checkout.room_id) {
                            old_room = await fetchRoomById(checkout.room_id);
                            hasRoomChanged = true;
                            console.log(`🏠 Room change detected for checkout ${checkout.id}`);
                        }

                        console.log(`📦 Checkout ${checkout.id} has ${checkout.checkout_items?.length || 0} items`);

                        return {
                            ...checkout,
                            old_room,
                            has_room_changed: hasRoomChanged
                        };
                    })
                );

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
                        ),
                        checkout_items!checkout_items_checkout_id_fkey(
                            id, 
                            equipment_requested, 
                            equipment_quantities, 
                            equipment_back, 
                            quantities_back,
                            status,
                            created_at
                        )
                    `)
                    .eq('type', 'things');

                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }

                query = query.order('created_at', { ascending: false });

                const { data, error } = await query;
                if (error) {
                    console.error('❌ Error fetching equipment checkouts:', error);
                    throw error;
                }

                console.log(`✅ Fetched ${data?.length || 0} equipment checkouts`);

                // Get all rooms that laboran can access (for filtering equipment)
                // Laboratory filtering logic:
                // - Department MUST be same as laboran's department
                // - Study program can be NULL (show) OR same as laboran's study program (show)
                let labRoomIds: string[] = [];
                if (isLaboratory && laborDeptId) {
                    const { data: labRooms } = await supabase
                        .from('rooms')
                        .select('id, study_program_id')
                        .eq('department_id', laborDeptId);

                    // Filter rooms: study_program null OR same as laboran
                    labRoomIds = (labRooms || [])
                        .filter(r => r.study_program_id === null || r.study_program_id === laborStudyProgramId)
                        .map(r => r.id);
                    console.log(`🔬 Lab has ${labRoomIds.length} accessible rooms`);
                }

                processedData = await Promise.all(
                    (data || []).map(async (checkout) => {
                        // Enrich lending tool with equipment details
                        if (checkout.lendingTool?.id_equipment) {
                            const { data: equipmentData } = await supabase
                                .from('equipment')
                                .select('id, name, code, category, unit, rooms_id')
                                .in('id', checkout.lendingTool.id_equipment);

                            if (equipmentData) {
                                checkout.lendingTool.equipment_details = equipmentData.map((eq, index) => ({
                                    ...eq,
                                    borrowed_quantity: checkout.lendingTool.qty[index] || 1
                                }));
                                // Store room info for filtering
                                checkout._equipment_room_ids = equipmentData.map(eq => eq.rooms_id).filter(Boolean);
                            }
                        }

                        console.log(`📦 Checkout ${checkout.id} has ${checkout.checkout_items?.length || 0} items`);

                        return {
                            ...checkout,
                            has_room_changed: false
                        };
                    })
                );

                // Filter for laboratory role based on equipment's room
                if (isLaboratory && laborDeptId && labRoomIds.length > 0) {
                    processedData = processedData.filter((checkout: any) => {
                        // Check if any equipment in this checkout belongs to lab's accessible rooms
                        const equipmentRoomIds = checkout._equipment_room_ids || [];
                        const hasLabEquipment = equipmentRoomIds.some((rid: string) => labRoomIds.includes(rid));
                        return hasLabEquipment;
                    });
                    console.log(`🔬 Filtered to ${processedData.length} equipment checkouts for laboran`);
                }
            }

            // Fetch violations for all checkouts
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

            console.log(`✅ Final processed checkouts: ${enhancedData.length}`);
            setCheckouts(enhancedData);

        } catch (error: any) {
            console.error('❌ Error fetching checkouts:', error);
            toast.error(`Gagal memuat data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [activeTab, statusFilter, profile]);

    // ===== GET DISPLAY ROOM NAME =====
    const getDisplayRoomName = (checkout: CheckoutWithDetails): string => {
        if (checkout.room_id && checkout.old_room) {
            return checkout.old_room.name;
        }
        return checkout.booking?.room?.name || 'Unknown Room';
    };

    // ===== CHECK IF ROOM CHANGED =====
    const hasRoomChanged = (checkout: CheckoutWithDetails): boolean => {
        return !!(checkout.room_id && checkout.old_room);
    };

    // ⭐⭐ APPROVE RETURN - UPDATE EQUIPMENT_BACK DI CHECKOUT_ITEMS
    const handleApproveReturn = async (checkoutId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(checkoutId));

            const checkout = checkouts.find(c => c.id === checkoutId);
            if (!checkout) throw new Error('Checkout tidak ditemukan');

            console.log('🔥 Starting approval process for checkout:', checkoutId);
            console.log('📦 Verification items:', verificationItems);

            // ⭐⭐ CEK APAKAH ADA EQUIPMENT
            const hasEquipment = verificationItems.length > 0;
            const verifiedItems = verificationItems.filter(i => i.is_verified);
            const hasVerifiedItems = verifiedItems.length > 0;

            if (!hasEquipment) {
                console.log('ℹ️ No equipment in this checkout (room-only booking)');
            }

            // ⭐⭐ CEK GAP - Hitung total gap (hanya untuk item yang diverifikasi)
            let totalGap = 0;
            const itemsWithGap: string[] = [];

            verifiedItems.forEach(item => {
                const gap = item.borrowed_quantity - item.previously_returned - item.returned_quantity;
                if (gap > 0) {
                    totalGap += gap;
                    itemsWithGap.push(`${item.equipment_name} (kurang ${gap} ${item.equipment_unit || 'unit'})`);
                }
            });

            // Warning jika ada gap (tapi tetap lanjut approve)
            if (totalGap > 0) {
                console.warn(`⚠️ Gap detected: ${totalGap} items missing`);
                console.warn('   Items:', itemsWithGap);
                toast.warning(
                    `Perhatian: Ada ${totalGap} item yang belum dikembalikan. Akan dicatat sebagai kehilangan.`,
                    { duration: 5000 }
                );
            }

            // ⭐⭐ STEP 1: Kembalikan equipment ke stok (hanya jika ada yang diverifikasi)
            if (hasVerifiedItems) {
                for (const item of verifiedItems) {
                    if (item.returned_quantity > 0) {
                        const { data: currentEq, error: fetchError } = await supabase
                            .from('equipment')
                            .select('quantity, name')
                            .eq('id', item.equipment_id)
                            .single();

                        if (fetchError) {
                            console.error(`Error fetching equipment ${item.equipment_name}:`, fetchError);
                            continue;
                        }

                        // ⭐ Tambahkan yang BARU dikembalikan sekarang
                        const newQuantity = currentEq.quantity + item.returned_quantity;

                        const { error: updateError } = await supabase
                            .from('equipment')
                            .update({
                                quantity: newQuantity,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', item.equipment_id);

                        if (updateError) {
                            console.error(`Error updating equipment ${item.equipment_name}:`, updateError);
                            continue;
                        }

                        console.log(`✅ ${currentEq.name}: ${currentEq.quantity} → ${newQuantity} (+${item.returned_quantity} baru dikembalikan)`);

                        await supabase
                            .from('equipment_quantity_logs')
                            .insert({
                                equipment_id: item.equipment_id,
                                from_quantity: currentEq.quantity,
                                to_quantity: newQuantity,
                                change_amount: item.returned_quantity,
                                transaction_type: 'return',
                                reference_type: checkout.type === 'room' ? 'booking' : 'lending',
                                created_at: new Date().toISOString()
                            });
                    }
                }
            } else {
                console.log('ℹ️ No items returned to stock (no verified items or empty return)');
            }

            // ⭐⭐ STEP 2: Update equipment_back & quantities_back di CHECKOUT_ITEMS
            // PENTING: quantities_back adalah TOTAL KUMULATIF yang sudah kembali
            if (hasEquipment && checkout.checkout_items && checkout.checkout_items.length > 0) {
                const checkoutItem = checkout.checkout_items[0];

                // Build equipment_back dan quantities_back
                const equipmentBackMap = new Map<string, number>();

                // ⭐⭐ LOGIKA BARU: quantities_back = total sudah kembali (bukan increment)
                // Ambil dari data lama dulu
                if (checkoutItem.equipment_back && checkoutItem.quantities_back) {
                    checkoutItem.equipment_back.forEach((eqId, index) => {
                        equipmentBackMap.set(eqId, Number(checkoutItem.quantities_back![index]) || 0);
                    });
                }

                // ⭐⭐ UPDATE: Simpan SEMUA equipment yang diverifikasi (termasuk yang gap)
                verifiedItems.forEach((item) => {
                    const currentBack = equipmentBackMap.get(item.equipment_id) || 0;
                    // ⭐⭐ Total kumulatif = yang sudah ada + yang baru dikembalikan
                    const newTotal = currentBack + item.returned_quantity;
                    equipmentBackMap.set(item.equipment_id, newTotal);

                    console.log(`   📝 ${item.equipment_name}: quantities_back ${currentBack} → ${newTotal} (+${item.returned_quantity})`);

                    // ⭐⭐ CEK GAP untuk equipment ini
                    const gap = item.borrowed_quantity - newTotal;
                    if (gap > 0) {
                        console.warn(`   ⚠️ ${item.equipment_name} masih kurang ${gap} ${item.equipment_unit || 'unit'}`);
                    }
                });

                const equipmentBack: string[] = [];
                const quantitiesBack: number[] = [];

                equipmentBackMap.forEach((qty, eqId) => {
                    equipmentBack.push(eqId);
                    quantitiesBack.push(qty);
                });

                console.log('📝 Updating checkout_items with equipment_back:', {
                    checkout_item_id: checkoutItem.id,
                    equipment_back: equipmentBack,
                    quantities_back: quantitiesBack
                });

                const { error: checkoutItemUpdateError } = await supabase
                    .from('checkout_items')
                    .update({
                        equipment_back: equipmentBack,
                        quantities_back: quantitiesBack,
                        status: 'returned',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', checkoutItem.id);

                if (checkoutItemUpdateError) {
                    console.error('Error updating checkout_items:', checkoutItemUpdateError);
                    throw checkoutItemUpdateError;
                }

                console.log('✅ checkout_items updated with equipment_back (cumulative)');
            }

            // ⭐⭐ STEP 3: Update checkout status
            const roomChangeNote = checkout.room_id
                ? `Perpindahan ruangan dari ${checkout.old_room?.name} ke ${checkout.booking?.room?.name}. `
                : '';

            const { error: checkoutError } = await supabase
                .from('checkouts')
                .update({
                    status: 'active',
                    actual_return_date: new Date().toISOString(),
                    return_notes: `${roomChangeNote}Diverifikasi oleh admin. ${verificationItems.filter(i => i.is_verified).length} item dikembalikan ke stok.`,
                    approved_by: profile?.id,
                    condition_on_return: 'good',
                    updated_at: new Date().toISOString()
                })
                .eq('id', checkoutId);

            if (checkoutError) throw checkoutError;

            // ⭐⭐ STEP 4: Create violation report jika ada gap
            if (totalGap > 0 && itemsWithGap.length > 0) {
                console.log('📝 Creating violation report for missing items...');

                const violationDescription = `User tidak mengembalikan equipment secara lengkap:\n${itemsWithGap.join('\n')}`;

                const { error: violationError } = await supabase
                    .from('checkout_violations')
                    .insert({
                        checkout_id: checkoutId,
                        user_id: checkout.user_id,
                        violation_type: 'loss',
                        severity: totalGap > 5 ? 'major' : 'minor',
                        title: `Equipment Tidak Lengkap (${totalGap} item)`,
                        description: violationDescription,
                        reported_by: profile?.id,
                        status: 'active',
                        created_at: new Date().toISOString()
                    });

                if (violationError) {
                    console.error('Error creating violation report:', violationError);
                    // Don't throw, just log
                } else {
                    console.log('✅ Violation report created for missing items');
                }
            }

            // ⭐⭐ STEP 5: Update booking/lending status HANYA jika room_id NULL
            if (!checkout.room_id) {
                if (checkout.type === 'room' && checkout.booking_id) {
                    const { error: bookingError } = await supabase
                        .from('bookings')
                        .update({
                            status: 'completed',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', checkout.booking_id);

                    if (bookingError) {
                        console.error('Error updating booking status:', bookingError);
                    } else {
                        console.log('✅ Booking status updated to "completed"');
                    }
                } else if (checkout.type === 'things' && checkout.lendingTool_id) {
                    const { error: lendingError } = await supabase
                        .from('lending_tool')
                        .update({
                            status: 'completed',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', checkout.lendingTool_id);

                    if (lendingError) {
                        console.error('Error updating lending tool status:', lendingError);
                    } else {
                        console.log('✅ Lending tool status updated to "completed"');
                    }
                }
            } else {
                console.log('ℹ️ Booking/lending status not updated - room change detected');
            }

            const successMessage = checkout.room_id
                ? 'Perpindahan ruangan divalidasi! Equipment dikembalikan ke stok dan disimpan di equipment_back (checkout_items).'
                : !hasEquipment
                    ? 'Pengembalian diverifikasi! Booking ini tidak memiliki equipment.'
                    : !hasVerifiedItems
                        ? 'Pengembalian diverifikasi! Tidak ada equipment yang dikembalikan (full gap dicatat).'
                        : totalGap > 0
                            ? `Pengembalian diverifikasi! ${verifiedItems.length} item diproses, ${totalGap} item belum dikembalikan dan dicatat.`
                            : `Pengembalian berhasil diverifikasi! ${verifiedItems.length} item dikembalikan dengan lengkap.`;

            toast.success(successMessage);

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

            console.log('🔄 Rejecting checkout:', checkoutId);

            const { error: deleteError } = await supabase
                .from('checkouts')
                .delete()
                .eq('id', checkoutId);

            if (deleteError) throw deleteError;

            if (checkout.type === 'room' && checkout.booking_id) {
                await supabase
                    .from('bookings')
                    .update({
                        status: 'borrowed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', checkout.booking_id);

                console.log('✅ Booking status reverted to "borrowed"');

            } else if (checkout.type === 'things' && checkout.lendingTool_id) {
                await supabase
                    .from('lending_tool')
                    .update({
                        status: 'borrow',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', checkout.lendingTool_id);

                console.log('✅ Lending tool status reverted to "borrow"');
            }

            toast.success('Pengembalian ditolak. Status dikembalikan ke "borrowed".');

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

    // ===== FILTERS =====
    const filteredCheckouts = useMemo(() => {
        return checkouts.filter(checkout => {
            const searchLower = searchTerm.toLowerCase();
            const roomName = getDisplayRoomName(checkout).toLowerCase();
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
            'returned': { color: 'bg-orange-100 text-orange-800', icon: '🔄', label: 'Menunggu Validasi' },
            'active': { color: 'bg-green-100 text-green-800', icon: '✅', label: 'Selesai Divalidasi' },
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

    // ===== ACCESS CONTROL =====
    if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin' && profile?.role !== 'laboratory') {
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
                            <span>{getText('Return Validation', 'Validasi Pengembalian')}</span>
                        </h1>
                        <p className="mt-2 opacity-90">
                            {getText('Verify and approve returns from users', 'Verifikasi dan setujui pengembalian dari pengguna')}
                        </p>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-2xl font-bold">{checkouts.filter(c => c.status === 'returned').length}</div>
                        <div className="text-sm opacity-80">{getText('Awaiting Validation', 'Menunggu Validasi')}</div>
                    </div>
                </div>
            </div>


            {/* TABS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('room')}
                        className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${activeTab === 'room'
                            ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Building className="h-5 w-5" />
                            <span>{getText('Room Returns', 'Pengembalian Ruangan')}</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('equipment')}
                        className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${activeTab === 'equipment'
                            ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <Package className="h-5 w-5" />
                            <span>{getText('Equipment Returns', 'Pengembalian Peralatan')}</span>
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
                            placeholder={getText('Search by name, ID, room...', 'Cari berdasarkan nama, NIM, ruangan...')}
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
                            <option value="all">{getText('All Status', 'Semua Status')}</option>
                            <option value="returned">{getText('Awaiting Validation', 'Menunggu Validasi')}</option>
                            <option value="active">{getText('Validated', 'Selesai Divalidasi')}</option>
                            <option value="overdue">{getText('Overdue', 'Terlambat')}</option>
                        </select>

                        <button
                            onClick={fetchCheckouts}
                            disabled={loading}
                            className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span>{getText('Refresh', 'Refresh')}</span>
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
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{getText('No Data', 'Tidak Ada Data')}</h3>
                        <p className="text-gray-600">{getText('No returns need validation.', 'Tidak ada pengembalian yang perlu divalidasi.')}</p>
                    </div>
                ) : (
                    filteredCheckouts.map((checkout) => {
                        const items = buildVerificationItems(checkout);
                        const totalBorrowed = items.reduce((sum, i) => sum + i.borrowed_quantity, 0);
                        const roomChanged = hasRoomChanged(checkout);

                        return (
                            <div
                                key={checkout.id}
                                className={`bg-white rounded-xl shadow-sm border-2 hover:shadow-md transition-all ${checkout.has_violations ? 'border-red-300 bg-red-50' :
                                    roomChanged ? 'border-amber-300 bg-amber-50' :
                                        checkout.status === 'returned' ? 'border-orange-300' : 'border-gray-200'
                                    }`}
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-4 mb-4">
                                                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${activeTab === 'room'
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
                                                                ? getDisplayRoomName(checkout)
                                                                : 'Peminjaman Peralatan'
                                                            }
                                                        </h3>
                                                        {getStatusBadge(checkout.status)}
                                                        {roomChanged && (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                                <ArrowRight className="h-3 w-3 mr-1" />
                                                                Perpindahan Ruangan
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        Checkout: {format(new Date(checkout.checkout_date), 'dd MMM yyyy HH:mm')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                                        <p className="font-medium text-gray-900 text-sm">
                                                            {checkout.checkout_items?.length || 0} Items
                                                        </p>
                                                        <p className="text-xs text-gray-500">Equipment</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <TrendingDown className="h-4 w-4 text-blue-500" />
                                                    <div>
                                                        <p className="font-medium text-blue-600 text-sm">{totalBorrowed}</p>
                                                        <p className="text-xs text-gray-500">Total Dipinjam</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {roomChanged && (
                                                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                    <div className="flex items-start space-x-2">
                                                        <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                                                        <div className="text-sm text-amber-800">
                                                            <strong>Perpindahan Ruangan:</strong>
                                                            <p>Dari: <strong>{checkout.old_room?.name}</strong> → Ke: <strong>{checkout.booking?.room?.name}</strong></p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {checkout.violation_reports && checkout.violation_reports.length > 0 && (
                                                <ViolationReportsDisplay reports={checkout.violation_reports} compact={true} />
                                            )}
                                        </div>

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
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* VERIFICATION MODAL */}
            {
                showDetailModal && selectedCheckout && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold">Verifikasi Pengembalian</h2>
                                        <p className="mt-1 opacity-90">
                                            {selectedCheckout.user?.full_name} - {
                                                activeTab === 'room'
                                                    ? getDisplayRoomName(selectedCheckout)
                                                    : 'Peminjaman Peralatan'
                                            }
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                                {/* User & Room Info */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    <div className="bg-indigo-50 rounded-xl p-4">
                                        <h4 className="font-semibold text-indigo-900 mb-2">Informasi Peminjam</h4>
                                        <p className="font-medium">{selectedCheckout.user?.full_name}</p>
                                        <p className="text-sm text-indigo-700">{selectedCheckout.user?.identity_number}</p>
                                        <p className="text-sm text-indigo-700">{selectedCheckout.user?.phone_number}</p>
                                    </div>

                                    {activeTab === 'room' && (
                                        <RoomInfoDisplay checkout={selectedCheckout} />
                                    )}

                                    <div className="bg-purple-50 rounded-xl p-4">
                                        <h4 className="font-semibold text-purple-900 mb-2">Info Checkout</h4>
                                        <p className="text-sm">
                                            <strong>Tanggal:</strong> {format(new Date(selectedCheckout.checkout_date), 'dd MMM yyyy HH:mm')}
                                        </p>
                                        <p className="text-sm mt-1">
                                            <strong>Status:</strong> {getStatusBadge(selectedCheckout.status)}
                                        </p>
                                        <p className="text-sm mt-1">
                                            <strong>Items:</strong> {selectedCheckout.checkout_items?.length || 0}
                                        </p>
                                    </div>
                                </div>

                                {/* Warning jika ruangan berubah */}
                                {hasRoomChanged(selectedCheckout) && (
                                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                        <div className="flex items-start">
                                            <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 mt-0.5" />
                                            <div>
                                                <h4 className="font-semibold text-amber-800">Perpindahan Ruangan Terdeteksi</h4>
                                                <p className="text-sm text-amber-700 mt-1">
                                                    Equipment yang divalidasi adalah equipment LAMA dari ruangan sebelumnya.
                                                    Data diambil dari <code className="bg-amber-100 px-1 rounded">checkout_items</code> table.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

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
                                                    className={`border-2 rounded-xl p-4 ${item.is_verified
                                                        ? 'border-green-300 bg-green-50'
                                                        : 'border-gray-200 bg-white'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center space-x-3">
                                                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${item.is_verified ? 'bg-green-100' : 'bg-gray-100'
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
                                                            Verifikasi dan kembalikan ke stok + simpan di equipment_back
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
                                    {verificationItems.filter(i => i.is_verified).length > 0
                                        ? `${verificationItems.filter(i => i.is_verified).length} dari ${verificationItems.length} item akan dikembalikan`
                                        : verificationItems.length > 0
                                            ? `Tidak ada item yang diverifikasi (approve untuk full gap)`
                                            : `Tidak ada equipment dalam checkout ini`
                                    }
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
                                        disabled={processingIds.has(selectedCheckout.id)}
                                        className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {processingIds.has(selectedCheckout.id) ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCircle className="h-4 w-4" />
                                        )}
                                        <span>Setujui & Update Stock</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* REPORT MODAL */}
            {
                showReportModal && reportCheckoutId && (
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
                )
            }
        </div >
    );
};

export default ValidationQueue;