import React, { useState, useEffect, useCallback } from 'react';
import {
    Bell, Clock, CheckCircle, XCircle, AlertTriangle, User, Building, Calendar,
    Timer, Eye, Check, X, RefreshCw, Filter, Search, FileText, Zap, Users, Package,
    Flag, AlertCircle as AlertCircleIcon, Phone, Wrench
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Booking, Room, User as UserType, Department } from '../types';
import toast from 'react-hot-toast';
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, compareAsc, startOfDay, endOfDay } from 'date-fns';
import { debounce } from 'lodash';

// --- TYPE DEFINITIONS ---
interface Equipment {
    id: string;
    name: string;
    code?: string;
    category?: string;
    quantity?: number;
    is_mandatory: boolean;
    borrowed_quantity?: number;
}

interface RoomWithEquipment extends Room {
    equipment: Equipment[];
}

interface BookingWithDetails extends Booking {
    user?: UserType;
    room?: RoomWithEquipment & { department?: Department };
    equipment_requested_details?: Equipment[];
}

interface LendingTool {
    id: string;
    id_user: string;
    date: string;
    id_equipment: string[];
    qty: number[];
    status: string;
    created_at: string;
    user?: UserType;
    equipment_details?: Array<{
        id: string;
        name: string;
        code: string;
        category: string;
        quantity: number;
        borrowed_quantity?: number;
    }>;
}

interface Checkout {
    id: string;
    user_id: string;
    booking_id?: string;
    lendingTool_id?: string;
    checkout_date: string;
    expected_return_date: string;
    status: 'active' | 'returned' | 'overdue' | 'lost' | 'damaged' | 'pending';
    created_at: string;
    type: 'room' | 'things';
    user?: UserType;
    booking?: BookingWithDetails;
    lendingTool?: LendingTool;
    has_report?: boolean;
    report?: {
        id: string;
        title: string;
        description: string;
        severity: 'minor' | 'major' | 'critical';
        created_at: string;
    };
}

// --- MAIN COMPONENT ---
const ValidationQueue: React.FC = () => {
    const { profile } = useAuth();
    
    const [activeTab, setActiveTab] = useState<'room' | 'equipment'>('room');
    const [checkouts, setCheckouts] = useState<Checkout[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCheckoutId, setSelectedCheckoutId] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportTitle, setReportTitle] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [reportSeverity, setReportSeverity] = useState<'minor' | 'major' | 'critical'>('minor');
    const [sortOption, setSortOption] = useState<'priority' | 'date' | 'status'>('date');  
    const [statusFilter, setStatusFilter] = useState<'all'| 'active' | 'returned' | 'overdue' | 'lost' | 'damaged' | 'pending'>('returned');
    const [dateFilter, setDateFilter] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeFiltersCount, setActiveFiltersCount] = useState(0);
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    const [conditionNotes, setConditionNotes] = useState<Record<string, string>>({});
    const [returnedQuantities, setReturnedQuantities] = useState<Record<string, number>>({});
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [requestedEquipmentDetails, setRequestedEquipmentDetails] = useState<Equipment[]>([]);

    useEffect(() => {
        setStatusFilter('returned'); // Both tabs default to 'returned'
    }, [activeTab]);

    const getCheckoutPriority = (checkout: Checkout): string => { 
        if (checkout.status === 'overdue') return 'overdue'; 
        const returnDate = new Date(checkout.expected_return_date); 
        if (isPast(returnDate) && checkout.status === 'active') return 'overdue'; 
        if (isToday(returnDate)) return 'urgent'; 
        if (isTomorrow(returnDate)) return 'high'; 
        if (isThisWeek(returnDate, { weekStartsOn: 1 })) return 'medium'; 
        return 'low'; 
    };

    const getPriorityIcon = (priority: string) => { 
        switch (priority) { 
            case 'overdue': return AlertTriangle; 
            case 'urgent': return Clock; 
            case 'high': return Timer; 
            case 'medium': return Calendar; 
            default: return FileText; 
        } 
    };

    const getPriorityColor = (priority: string, hasReport: boolean = false) => { 
        if (hasReport) return 'border-yellow-400 bg-yellow-50'; 
        switch (priority) { 
            case 'overdue': return 'border-red-300 bg-red-50'; 
            case 'urgent': return 'border-orange-300 bg-orange-50'; 
            case 'high': return 'border-yellow-300 bg-yellow-50'; 
            case 'medium': return 'border-blue-300 bg-blue-50'; 
            default: return 'border-gray-300 bg-gray-50'; 
        } 
    };

    const getPriorityIconBgColor = (priority: string, hasReport: boolean = false) => { 
        if (hasReport) return 'bg-yellow-500'; 
        switch (priority) { 
            case 'overdue': return 'bg-red-500'; 
            case 'urgent': return 'bg-orange-500'; 
            case 'high': return 'bg-yellow-500'; 
            case 'medium': return 'bg-blue-500'; 
            default: return 'bg-gray-500'; 
        } 
    };

    const getSeverityColor = (severity: string) => { 
        switch (severity) { 
            case 'minor': return 'bg-blue-100 text-blue-800'; 
            case 'major': return 'bg-orange-100 text-orange-800'; 
            case 'critical': return 'bg-red-100 text-red-800'; 
            default: return 'bg-gray-100 text-gray-800'; 
        } 
    };

    useEffect(() => {
        let count = 0;
        if (statusFilter !== 'returned') count++;
        if (dateFilter) count++;
        setActiveFiltersCount(count);
    }, [statusFilter, dateFilter, activeTab]);

    const fetchPendingCheckouts = async () => {
        try {
            if (!loading) setLoading(true);
            
            let query;
            let processedData: any[] = [];
            
            if (activeTab === 'room') {
                // Fetch room checkouts
                query = supabase.from('checkouts')
                    .select(`*, user:users!checkouts_user_id_fkey(*, phone_number), booking:bookings(*, equipment_requested, room:rooms(*, department:departments(*), equipment:room_equipment(equipment(*))))`)
                    .eq('type', 'room');
                
                if (dateFilter) { 
                    const d = new Date(dateFilter); 
                    query = query.gte('checkout_date', startOfDay(d).toISOString()).lte('checkout_date', endOfDay(d).toISOString()); 
                }
                if (statusFilter !== 'all') { 
                    query = query.eq('status', statusFilter); 
                }
                
                const { data: checkoutData, error: checkoutError } = await query.order('created_at', { ascending: false });
                if (checkoutError) throw checkoutError;

                processedData = (checkoutData || []).map(c => ({ 
                    ...c, 
                    booking: { 
                        ...c.booking, 
                        room: { 
                            ...c.booking.room, 
                            equipment: c.booking.room.equipment.map(e => e.equipment).filter(Boolean) 
                        } 
                    } 
                }));
                
                if (profile?.role === 'department_admin' && profile.department_id) {
                    processedData = processedData.filter(c => c.booking?.room?.department?.id === profile.department_id);
                }
            } else {
                // Fetch equipment checkouts (type: 'things')
                query = supabase.from('checkouts')
                    .select(`*, user:users!checkouts_user_id_fkey(*, phone_number), lendingTool:lending_tool!checkouts_lendingTool_id_fkey(*)`)
                    .eq('type', 'things');
                
                if (dateFilter) { 
                    const d = new Date(dateFilter); 
                    query = query.gte('checkout_date', startOfDay(d).toISOString()).lte('checkout_date', endOfDay(d).toISOString()); 
                }
                if (statusFilter !== 'all') { 
                    query = query.eq('status', statusFilter); 
                }
                
                const { data: checkoutData, error: checkoutError } = await query.order('created_at', { ascending: false });
                if (checkoutError) throw checkoutError;

                // Process equipment checkouts and fetch equipment details
                processedData = await Promise.all(
                    (checkoutData || []).map(async (checkout) => {
                        if (checkout.lendingTool && checkout.lendingTool.id_equipment) {
                            try {
                                const { data: equipmentData, error: equipmentError } = await supabase
                                    .from('equipment')
                                    .select('id, name, code, category, quantity')
                                    .in('id', checkout.lendingTool.id_equipment);
                                
                                if (!equipmentError && equipmentData) {
                                    checkout.lendingTool.equipment_details = equipmentData.map((eq, index) => ({
                                        ...eq,
                                        borrowed_quantity: checkout.lendingTool.qty[index] || 1
                                    }));
                                }
                            } catch (error) {
                                console.log('Equipment not found for lending tool:', checkout.lendingTool.id);
                            }
                        }
                        return checkout;
                    })
                );
            }

            // Fetch reports for all checkouts
            const checkoutsWithReports = await Promise.all(
                processedData.map(async c => {
                    const { data: reports, error } = await supabase
                        .from('checkout_violations')
                        .select('*')
                        .eq('checkout_id', c.id)
                        .order('created_at', { ascending: false })
                        .limit(1);
                    
                    if (error) return c;
                    return reports && reports.length > 0 ? { 
                        ...c, 
                        has_report: true, 
                        report: { ...reports[0] } 
                    } : { 
                        ...c, 
                        has_report: false 
                    };
                })
            );
            
            setCheckouts(checkoutsWithReports as Checkout[]);
        } catch (err: any) {
            console.error('Error fetching pending checkouts:', err);
            toast.error(`Failed to load data: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => { 
        fetchPendingCheckouts(); 
    }, [profile, activeTab, statusFilter, dateFilter]);

    const fetchCheckoutItemState = async (checkoutId: string) => {
        setIsDetailLoading(true);
        const { data, error } = await supabase.from('checkout_items').select('*').eq('checkout_id', checkoutId);
        
        if (error) {
            toast.error("Failed to load item verification status.");
            setCheckedItems(new Set());
            setConditionNotes({});
            setReturnedQuantities({});
        } else {
            const checked = new Set<string>();
            const notes: Record<string, string> = {};
            const quantities: Record<string, number> = {};
            data.forEach(item => {
                checked.add(item.equipment_id);
                if (item.condition_notes) { notes[item.equipment_id] = item.condition_notes; }
                if (item.quantity) { quantities[item.equipment_id] = item.quantity; }
            });
            setCheckedItems(checked);
            setConditionNotes(notes);
            setReturnedQuantities(quantities);
        }
        setIsDetailLoading(false);
    };

    const fetchRequestedEquipmentDetails = async (equipmentIds: string[]) => {
        if (!equipmentIds || equipmentIds.length === 0) {
            setRequestedEquipmentDetails([]);
            return;
        }
        
        try {
            const { data, error } = await supabase
                .from('equipment')
                .select('*')
                .in('id', equipmentIds);
            
            if (error) throw error;
            
            setRequestedEquipmentDetails(data || []);
        } catch (error) {
            console.error('Error fetching equipment details:', error);
            toast.error('Failed to load equipment details');
            setRequestedEquipmentDetails([]);
        }
    };

    useEffect(() => {
        if (showDetailModal && selectedCheckoutId) {
            fetchCheckoutItemState(selectedCheckoutId);
            
            const selectedCheckout = checkouts.find(c => c.id === selectedCheckoutId);
            
            if (activeTab === 'room' && selectedCheckout?.booking?.equipment_requested) {
                fetchRequestedEquipmentDetails(selectedCheckout.booking.equipment_requested);
            } else if (activeTab === 'equipment' && selectedCheckout?.lendingTool?.id_equipment) {
                fetchRequestedEquipmentDetails(selectedCheckout.lendingTool.id_equipment);
            } else {
                setRequestedEquipmentDetails([]);
            }
        }
    }, [showDetailModal, selectedCheckoutId, checkouts, activeTab]);

    const handleCheckItem = async (checkoutId: string, equipmentId: string, isChecked: boolean) => {
        const tempCheckedItems = new Set(checkedItems);
        if (isChecked) tempCheckedItems.add(equipmentId); else tempCheckedItems.delete(equipmentId);
        setCheckedItems(tempCheckedItems);

        if (isChecked) {
            // For equipment checkouts, use the returned quantity, otherwise default to 1
            const quantity = activeTab === 'equipment' ? (returnedQuantities[equipmentId] || 1) : 1;
            
            const { error } = await supabase.from('checkout_items').upsert({ 
                checkout_id: checkoutId, 
                equipment_id: equipmentId, 
                condition_notes: conditionNotes[equipmentId] || null, 
                quantity: quantity
            }, { onConflict: 'checkout_id, equipment_id' });
            
            if (error) { 
                toast.error(`Failed to save check status.`); 
                setCheckedItems(prev => { const s = new Set(prev); s.delete(equipmentId); return s; }); 
            } else {
                // Update equipment quantity immediately when checked
                if (activeTab === 'equipment') {
                    await updateEquipmentQuantity(equipmentId, quantity);
                }
            }
        } else {
            const { error } = await supabase.from('checkout_items').delete().match({ 
                checkout_id: checkoutId, 
                equipment_id: equipmentId 
            });
            
            if (error) { 
                toast.error(`Failed to save uncheck status.`); 
                setCheckedItems(prev => { const s = new Set(prev); s.add(equipmentId); return s; }); 
            } else {
                // Revert equipment quantity when unchecked
                if (activeTab === 'equipment') {
                    const quantity = returnedQuantities[equipmentId] || 1;
                    await updateEquipmentQuantity(equipmentId, -quantity);
                }
            }
        }
    };

    const updateEquipmentQuantity = async (equipmentId: string, quantityChange: number) => {
        try {
            const { data: currentEquipment, error: getError } = await supabase
                .from('equipment')
                .select('quantity')
                .eq('id', equipmentId)
                .single();

            if (!getError && currentEquipment) {
                const newQuantity = currentEquipment.quantity + quantityChange;
                
                const { error: updateError } = await supabase
                    .from('equipment')
                    .update({ 
                        quantity: newQuantity,
                        is_available: newQuantity > 0
                    })
                    .eq('id', equipmentId);

                if (updateError) {
                    console.error('Error updating equipment quantity:', updateError);
                    toast.error('Failed to update equipment quantity');
                }
            }
        } catch (error) {
            console.error('Error updating equipment quantity:', error);
        }
    };
    
    const debouncedUpdateNote = useCallback(debounce(async (checkoutId: string, equipmentId: string, note: string) => {
        if (checkedItems.has(equipmentId)) {
            const { error } = await supabase.from('checkout_items').update({ condition_notes: note }).match({ 
                checkout_id: checkoutId, 
                equipment_id: equipmentId 
            });
            if (error) toast.error(`Failed to save note.`);
        }
    }, 500), [checkedItems]);

    const debouncedUpdateQuantity = useCallback(debounce(async (checkoutId: string, equipmentId: string, quantity: number) => {
        if (checkedItems.has(equipmentId)) {
            const { error } = await supabase.from('checkout_items').update({ quantity: quantity }).match({ 
                checkout_id: checkoutId, 
                equipment_id: equipmentId 
            });
            if (error) toast.error(`Failed to save quantity.`);
        }
    }, 500), [checkedItems]);

    const handleNoteChange = (equipmentId: string, note: string) => {
        setConditionNotes(prev => ({...prev, [equipmentId]: note }));
        if (selectedCheckoutId) { debouncedUpdateNote(selectedCheckoutId, equipmentId, note); }
    };

    const handleQuantityChange = (equipmentId: string, quantity: number) => {
        setReturnedQuantities(prev => ({...prev, [equipmentId]: quantity }));
        if (selectedCheckoutId && checkedItems.has(equipmentId)) { 
            debouncedUpdateQuantity(selectedCheckoutId, equipmentId, quantity); 
        }
    };
    
    const handleApproval = async (checkoutId: string) => {
        setProcessingIds(prev => new Set(prev).add(checkoutId));
        try {
            const checkout = checkouts.find(c => c.id === checkoutId);
            if (!checkout) throw new Error('Checkout data missing');

            // Update checkout status
            const { error: checkoutError } = await supabase.from('checkouts').update({ 
                approved_by: profile?.id, 
                status: 'active', 
                updated_at: new Date().toISOString() 
            }).eq('id', checkoutId);
            if (checkoutError) throw checkoutError;
            
            if (activeTab === 'room') {
                // For room checkouts - update room availability
                if (!checkout.booking?.room) throw new Error('Room data missing');
                
                const { error: roomError } = await supabase.from('rooms').update({ 
                    is_available: true, 
                    updated_at: new Date().toISOString() 
                }).eq('id', checkout.booking.room.id);
                
                if (roomError) console.error('Error updating room availability:', roomError);
            } else {
                // For equipment checkouts - update lending tool status
                if (!checkout.lendingTool) throw new Error('Lending tool data missing');
                
                const { error: lendingUpdateError } = await supabase
                    .from('lending_tool')
                    .update({ 
                        status: 'completed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', checkout.lendingTool.id);

                if (lendingUpdateError) {
                    console.error('Error updating lending tool status:', lendingUpdateError);
                }

                // Equipment quantities are already updated when items are checked
                // No need to update again here
            }
            
            toast.success('Checkout approved successfully!');
            fetchPendingCheckouts();
            setShowDetailModal(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to approve checkout');
        } finally {
            setProcessingIds(prev => { const s = new Set(prev); s.delete(checkoutId); return s; });
        }
    };
    
    const handleReject = async (checkoutId: string) => {
        setProcessingIds(prev => new Set(prev).add(checkoutId));
        try {
            const checkout = checkouts.find(c => c.id === checkoutId);
            
            if (activeTab === 'room') {
                const bookingId = checkout?.booking_id;
                if (!bookingId) throw new Error('Booking ID not found for this checkout');

                const { error: bookingError } = await supabase.from('bookings').update({ 
                    status: 'approved', 
                    updated_at: new Date().toISOString() 
                }).eq('id', bookingId);
                
                if (bookingError) throw bookingError;
            } else {
                const lendingToolId = checkout?.lendingTool_id;
                if (!lendingToolId) throw new Error('Lending tool ID not found for this checkout');

                const { error: lendingError } = await supabase.from('lending_tool').update({ 
                    status: 'borrow', 
                    updated_at: new Date().toISOString() 
                }).eq('id', lendingToolId);
                
                if (lendingError) throw lendingError;

                // Revert equipment quantities for checked items
                const checkoutItems = await supabase
                    .from('checkout_items')
                    .select('*')
                    .eq('checkout_id', checkoutId);

                if (checkoutItems.data) {
                    for (const item of checkoutItems.data) {
                        await updateEquipmentQuantity(item.equipment_id, -item.quantity);
                    }
                }
            }
            
            const { error: checkoutError } = await supabase.from('checkouts').delete().eq('id', checkoutId);
            if (checkoutError) throw checkoutError;
            
            toast.success('Checkout rejected and status restored.');
            fetchPendingCheckouts();
            if (selectedCheckoutId === checkoutId) setShowDetailModal(false);
            setShowDeleteConfirm(null);
        } catch (error: any) {
            toast.error(error.message || 'Failed to reject checkout');
        } finally {
            setProcessingIds(prev => { const s = new Set(prev); s.delete(checkoutId); return s; });
        }
    };
    
    const handleAddReport = async () => {
        const selectedCheckout = checkouts.find(c => c.id === selectedCheckoutId);
        if (!selectedCheckout) return;
        if (!reportTitle || !reportDescription) { toast.error('Title and description are required'); return; }

        setProcessingIds(prev => new Set(prev).add(selectedCheckout.id));
        try {
            const { error } = await supabase.from('checkout_violations').insert({ 
                checkout_id: selectedCheckout.id, 
                user_id: selectedCheckout.user_id, 
                violation_type: 'other', 
                severity: reportSeverity, 
                title: reportTitle, 
                description: reportDescription, 
                reported_by: profile?.id, 
                status: 'active' 
            });
            
            if (error) throw error;
            toast.success('Report added successfully');
            setShowReportModal(false); 
            setReportTitle(''); 
            setReportDescription(''); 
            setReportSeverity('minor');
            fetchPendingCheckouts();
        } catch (error: any) { 
            toast.error(error.message || 'Failed to add report');
        } finally { 
            if (selectedCheckout) { 
                setProcessingIds(prev => { const s = new Set(prev); s.delete(selectedCheckout.id); return s; }); 
            } 
        }
    };

    const filteredCheckouts = checkouts.filter(c => { 
        const s = searchTerm.toLowerCase(); 
        if (activeTab === 'room') {
            return !s || 
                c.user?.full_name?.toLowerCase().includes(s) || 
                c.booking?.purpose?.toLowerCase().includes(s) || 
                c.booking?.room?.name?.toLowerCase().includes(s);
        } else {
            return !s || 
                c.user?.full_name?.toLowerCase().includes(s) || 
                c.lendingTool?.equipment_details?.some(eq => 
                    eq.name.toLowerCase().includes(s) || 
                    eq.code?.toLowerCase().includes(s) ||
                    eq.category?.toLowerCase().includes(s)
                );
        }
    }).sort((a, b) => { 
        if (a.has_report && !b.has_report) return -1; 
        if (!a.has_report && b.has_report) return 1; 
        const pOrder = { overdue: 0, urgent: 1, high: 2, medium: 3, low: 4 }; 
        if (sortOption === 'priority') return pOrder[getCheckoutPriority(a)] - pOrder[getCheckoutPriority(b)]; 
        if (sortOption === 'date') { 
            const dateA = a.created_at ? parseISO(a.created_at) : 0; 
            const dateB = b.created_at ? parseISO(b.created_at) : 0; 
            if (!dateA || !dateB) return 0; 
            return compareAsc(dateB, dateA); 
        } 
        if (sortOption === 'status') { 
            const sOrder = { overdue: 0, active: 1, returned: 2, pending: 3 }; 
            const getStatus = (c: Checkout) => c.status === 'overdue' || (isPast(new Date(c.expected_return_date)) && c.status === 'active') ? 'overdue' : c.status; 
            return sOrder[getStatus(a)] - sOrder[getStatus(b)]; 
        } 
        return 0; 
    });

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3">
                            <Bell className="h-8 w-8" />
                            <span>Validation Queue</span>
                        </h1>
                        <p className="mt-2 opacity-90">Review and validate checkouts</p>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-2xl font-bold">{checkouts.length}</div>
                        <div className="text-sm opacity-80">Items in Queue</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    <button 
                        onClick={() => setActiveTab('room')} 
                        className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors duration-200 ${
                            activeTab === 'room' 
                                ? 'text-orange-600 border-b-2 border-orange-600' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Room Checkouts
                    </button>
                    <button 
                        onClick={() => setActiveTab('equipment')} 
                        className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors duration-200 ${
                            activeTab === 'equipment' 
                                ? 'text-orange-600 border-b-2 border-orange-600' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Equipment Checkouts
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="relative w-full md:w-auto md:flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder={activeTab === 'room' ? "Search by name, purpose, or room..." : "Search by name or equipment..."} 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" 
                        />
                    </div>
                    <div className="flex items-center space-x-2 w-full md:w-auto">
                        <button 
                            onClick={() => { setStatusFilter('returned'); fetchPendingCheckouts(); }} 
                            disabled={loading} 
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh Returned</span>
                        </button>
                        <button 
                            onClick={() => setShowFilters(!showFilters)} 
                            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            <Filter className="h-4 w-4" />
                            <span>Filters</span>
                            {activeFiltersCount > 0 && (
                                <span className="inline-flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold text-white bg-orange-500 rounded-full">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>
                        <select 
                            value={sortOption} 
                            onChange={(e) => setSortOption(e.target.value as any)} 
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                            <option value="date">Sort: Date (Recent)</option>
                            <option value="priority">Sort: Priority</option>
                            <option value="status">Sort: Status</option>
                        </select>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value as any)} 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="active">Active</option>
                                <option value="overdue">Overdue</option>
                                <option value="returned">Returned</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Date</label>
                            <div className="relative">
                                <input 
                                    type="date" 
                                    value={dateFilter} 
                                    onChange={(e) => setDateFilter(e.target.value)} 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                                {dateFilter && (
                                    <button 
                                        onClick={() => setDateFilter('')} 
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <button 
                                onClick={() => { setStatusFilter('returned'); setDateFilter(''); }} 
                                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Checkout List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="h-6 w-6 animate-spin text-orange-600 mr-2" />
                        <span>Loading...</span>
                    </div>
                ) : filteredCheckouts.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                        <p className="text-gray-600">No items match the current filters.</p>
                    </div>
                ) : (
                    filteredCheckouts.map((checkout) => {
                        const priority = getCheckoutPriority(checkout);
                        const PriorityIcon = getPriorityIcon(priority);
                        
                        return (
                            <div 
                                key={checkout.id} 
                                className={`bg-white rounded-xl shadow-sm border p-4 md:p-6 hover:shadow-lg transition-all duration-200 ${getPriorityColor(priority, checkout.has_report)}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-4 mb-4">
                                            <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${getPriorityIconBgColor(priority, checkout.has_report)}`}>
                                                <PriorityIcon className="h-6 w-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {activeTab === 'room' 
                                                        ? (checkout.booking?.purpose || 'Room Checkout')
                                                        : 'Equipment Checkout'
                                                    }
                                                </h3>
                                                <div className="flex items-center space-x-2">
                                                    <p className="text-sm text-gray-600 capitalize">
                                                        {priority} Priority • Status: {checkout.status}
                                                    </p>
                                                    {checkout.has_report && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                            <Flag className="h-3 w-3 mr-1" />
                                                            REPORTED
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                                            {/* User Info */}
                                            <div className="flex items-center space-x-3">
                                                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                <div>
                                                    <p className="font-medium text-gray-800">{checkout.user?.full_name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {checkout.user?.phone_number || `ID: ${checkout.user?.identity_number}`}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Location/Equipment Info */}
                                            <div className="flex items-center space-x-3">
                                                {activeTab === 'room' ? (
                                                    <>
                                                        <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                        <div>
                                                            <p className="font-medium text-gray-800">{checkout.booking?.room?.name}</p>
                                                            <p className="text-xs text-gray-500">{checkout.booking?.room?.department?.name}</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                        <div>
                                                            <p className="font-medium text-gray-800">
                                                                {checkout.lendingTool?.equipment_details?.length || 0} Item(s)
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {checkout.lendingTool?.equipment_details?.[0]?.name || 'Equipment'}
                                                                {checkout.lendingTool?.equipment_details && checkout.lendingTool.equipment_details.length > 1 && 
                                                                    ` +${checkout.lendingTool.equipment_details.length - 1} more`
                                                                }
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Date Info */}
                                            <div className="flex items-center space-x-3">
                                                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                <div>
                                                    <p className="font-medium text-gray-800">
                                                        {format(new Date(checkout.checkout_date), 'MMM d, yy')}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Return by: {format(new Date(checkout.expected_return_date), 'MMM d, yy')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Report Section */}
                                        {checkout.has_report && checkout.report && (
                                            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3">
                                                <div className="flex items-start space-x-3">
                                                    <Flag className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <p className="font-medium text-yellow-800">{checkout.report.title}</p>
                                                        <p className="text-sm text-yellow-700 mt-1">{checkout.report.description}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center space-x-1 ml-4">
                                        <button 
                                            onClick={() => { 
                                                if(checkout.id) { 
                                                    setSelectedCheckoutId(checkout.id); 
                                                    setShowDetailModal(true); 
                                                }
                                            }} 
                                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-md" 
                                            title="View Details"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedCheckoutId && (() => {
                const selectedCheckout = checkouts.find(c => c.id === selectedCheckoutId);
                if (!selectedCheckout) return null;

                // Use requested equipment details instead of room equipment
                const verificationList = requestedEquipmentDetails;
                const mandatoryEquipment = verificationList.filter(eq => eq.is_mandatory);
                const allMandatoryChecked = mandatoryEquipment.every(eq => checkedItems.has(eq.id));
                const isProcessing = processingIds.has(selectedCheckout.id);

                return (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Checkout Validation</h2>
                                </div>
                                <button 
                                    onClick={() => setShowDetailModal(false)} 
                                    className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            {isDetailLoading ? (
                                <div className="flex justify-center items-center h-64">
                                    <RefreshCw className="h-6 w-6 animate-spin text-orange-600"/>
                                </div>
                            ) : (
                                <div className="space-y-6 pt-5">
                                    {/* User & Location Info */}
                                    <div>
                                        <h4 className="text-base font-semibold text-gray-500 mb-2">
                                            {activeTab === 'room' ? 'User & Room' : 'User & Equipment'}
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* User Card */}
                                            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center space-x-4">
                                                <div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <User className="h-6 w-6 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-gray-900">{selectedCheckout.user?.full_name}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {selectedCheckout.user?.phone_number || `ID: ${selectedCheckout.user?.identity_number}`}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Location/Equipment Card */}
                                            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center space-x-4">
                                                <div className="flex-shrink-0 h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                                                    {activeTab === 'room' ? (
                                                        <Building className="h-6 w-6 text-green-600" />
                                                    ) : (
                                                        <Package className="h-6 w-6 text-green-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    {activeTab === 'room' ? (
                                                        <>
                                                            <p className="text-lg font-bold text-gray-900">{selectedCheckout.booking?.room?.name}</p>
                                                            <p className="text-sm text-gray-500">{selectedCheckout.booking?.room?.department?.name}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-lg font-bold text-gray-900">
                                                                {selectedCheckout.lendingTool?.equipment_details?.length || 0} Equipment Items
                                                            </p>
                                                            <p className="text-sm text-gray-500">
                                                                {selectedCheckout.lendingTool?.equipment_details?.[0]?.category || 'Various Categories'}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Equipment Verification */}
                                    {verificationList.length > 0 && (
                                        <div className="border rounded-xl p-4">
                                            <h4 className="text-base font-semibold text-gray-500 mb-3">Equipment Verification</h4>
                                            
                                            {!allMandatoryChecked && selectedCheckout.status === 'returned' && (
                                                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md mb-4 flex items-center space-x-2">
                                                    <AlertCircleIcon className="h-5 w-5" />
                                                    <p className="font-bold">All mandatory items must be checked to approve.</p>
                                                </div>
                                            )}
                                            
                                            <div className="space-y-3">
                                                {verificationList.map(eq => {
                                                    // Get borrowed quantity for equipment checkouts
                                                    const borrowedQty = activeTab === 'equipment' 
                                                        ? selectedCheckout.lendingTool?.equipment_details?.find(ed => ed.id === eq.id)?.borrowed_quantity || 1
                                                        : 1;
                                                    
                                                    return (
                                                        <div key={eq.id} className="grid grid-cols-[auto,1fr,auto,1fr] gap-x-4 items-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={checkedItems.has(eq.id)} 
                                                                onChange={(e) => handleCheckItem(selectedCheckout.id, eq.id, e.target.checked)} 
                                                                className="h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500" 
                                                            />
                                                            <label className="text-sm font-medium text-gray-800">
                                                                {eq.name}
                                                                {eq.code && <span className="text-gray-500 ml-1">({eq.code})</span>}
                                                                {eq.is_mandatory && <span className="text-red-500 font-bold ml-1">*</span>}
                                                                {activeTab === 'equipment' && (
                                                                    <span className="text-blue-600 ml-2 text-xs font-medium">
                                                                        Borrowed: {borrowedQty}
                                                                    </span>
                                                                )}
                                                            </label>
                                                            
                                                            {activeTab === 'equipment' ? (
                                                                <input 
                                                                    type="number" 
                                                                    min="0"
                                                                    max={borrowedQty}
                                                                    placeholder="Qty returned ?" 
                                                                    value={returnedQuantities[eq.id] || ''} 
                                                                    onChange={(e) => handleQuantityChange(eq.id, parseInt(e.target.value) || 0)} 
                                                                    className="text-sm border border-gray-300 rounded-md px-2 py-1 w-24 focus:ring-orange-500 focus:border-orange-500"
                                                                />
                                                            ) : (
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Condition notes..." 
                                                                    value={conditionNotes[eq.id] || ''} 
                                                                    onChange={(e) => handleNoteChange(eq.id, e.target.value)} 
                                                                    className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-orange-500 focus:border-orange-500"
                                                                />
                                                            )}
                                                            
                                                            {activeTab === 'equipment' && (
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Condition notes..." 
                                                                    value={conditionNotes[eq.id] || ''} 
                                                                    onChange={(e) => handleNoteChange(eq.id, e.target.value)} 
                                                                    className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full focus:ring-orange-500 focus:border-orange-500"
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="mt-8 flex justify-end items-center gap-x-3 border-t pt-4">
                                        <button 
                                            onClick={() => { 
                                                setShowDetailModal(false); 
                                                if(selectedCheckout.id) { 
                                                    setSelectedCheckoutId(selectedCheckout.id); 
                                                    setReportTitle(selectedCheckout.report?.title || ''); 
                                                    setReportDescription(selectedCheckout.report?.description || ''); 
                                                    setReportSeverity(selectedCheckout.report?.severity || 'minor'); 
                                                    setShowReportModal(true); 
                                                }
                                            }} 
                                            className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200"
                                        >
                                            <Flag className="h-4 w-4" />
                                            <span>{selectedCheckout.has_report ? 'Update Report' : 'Add Report'}</span>
                                        </button>

                                        {selectedCheckout.status === 'returned' && (
                                            <>
                                                <button 
                                                    onClick={() => handleApproval(selectedCheckout.id)} 
                                                    disabled={isProcessing || !allMandatoryChecked} 
                                                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    <Check className="h-4 w-4" />
                                                    <span>Approve Return</span>
                                                </button>
                                                <button 
                                                    onClick={() => { 
                                                        setShowDetailModal(false); 
                                                        setShowDeleteConfirm(selectedCheckout.id);
                                                    }} 
                                                    disabled={isProcessing} 
                                                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    <X className="h-4 w-4" />
                                                    <span>Reject Return</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold">Confirm Rejection</h3>
                        <p className="text-sm text-gray-600 mt-2">Are you sure you want to reject this return?</p>
                        <p className="text-sm text-gray-700 mt-2 font-medium">
                            This will delete the checkout record and restore the original {activeTab === 'room' ? 'booking' : 'lending tool'} status.
                        </p>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button 
                                onClick={() => setShowDeleteConfirm(null)} 
                                className="px-4 py-2 border rounded-lg"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => { 
                                    if(showDeleteConfirm) handleReject(showDeleteConfirm); 
                                }} 
                                disabled={processingIds.has(showDeleteConfirm || '')} 
                                className="px-4 py-2 bg-red-600 text-white rounded-lg"
                            >
                                {processingIds.has(showDeleteConfirm || '') ? 'Processing...' : 'Confirm Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {showReportModal && selectedCheckoutId && (() => {
                const selectedCheckout = checkouts.find(c => c.id === selectedCheckoutId);
                if(!selectedCheckout) return null;

                const isProcessing = processingIds.has(selectedCheckout.id);

                return (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900">
                                    {selectedCheckout.has_report ? 'Update Report' : 'Add Report'}
                                </h3>
                                <button 
                                    onClick={() => setShowReportModal(false)} 
                                    className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>
                            <div className="space-y-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Report Title *</label>
                                    <input 
                                        type="text" 
                                        value={reportTitle} 
                                        onChange={(e) => setReportTitle(e.target.value)} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                                    <select 
                                        value={reportSeverity} 
                                        onChange={(e) => setReportSeverity(e.target.value as any)} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="minor">Minor</option>
                                        <option value="major">Major</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                                    <textarea 
                                        value={reportDescription} 
                                        onChange={(e) => setReportDescription(e.target.value)} 
                                        rows={4} 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end space-x-3 pt-4 border-t">
                                <button 
                                    onClick={() => setShowReportModal(false)} 
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleAddReport} 
                                    disabled={!reportTitle || !reportDescription || isProcessing} 
                                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg disabled:opacity-50"
                                >
                                    <Flag className="h-4 w-4" />
                                    <span>
                                        {isProcessing ? 'Saving...' : (selectedCheckout.has_report ? 'Update Report' : 'Add Report')}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ValidationQueue;