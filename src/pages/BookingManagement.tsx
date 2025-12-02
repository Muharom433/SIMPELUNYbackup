import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Calendar, Clock, User, Building, CheckCircle, XCircle, AlertTriangle,
    Eye, Edit, Trash2, RefreshCw, Filter, Search, ChevronDown, ChevronUp,
    Package, Plus, Minus, X, Check, ArrowRight, FileText, Users, Info,
    AlertCircle, Phone, MapPin, BookOpen, Timer, Zap, Settings, Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, parseISO, isToday, isTomorrow, isPast, isAfter, isBefore } from 'date-fns';
import toast from 'react-hot-toast';

// ===== TYPE DEFINITIONS =====
interface Room {
    id: string;
    name: string;
    code: string;
    capacity: number;
    department_id?: string;
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
    is_available: boolean;
    rooms_id?: string;
    condition?: string;
}

interface EquipmentSelection {
    equipment_id: string;
    equipment_name: string;
    equipment_code?: string;
    equipment_unit?: string;
    quantity: number;
    is_mandatory: boolean;
    max_quantity: number;
}

interface Booking {
    id: string;
    user_id: string;
    room_id: string;
    start_time: string;
    end_time: string;
    purpose: string;
    sks?: number;
    class_type?: string;
    status: 'pending' | 'approved' | 'borrowed' | 'completed' | 'cancelled' | 'rejected';
    equipment_requested: string[];
    equipment_quantities: number[];
    notes?: string;
    user_info?: any;
    created_at: string;
    updated_at: string;
    attachments?: number;
    equipment_details?: any;
    equipment_back?: string[];
    quantities_back?: number[];
    user?: {
        id: string;
        full_name: string;
        identity_number: string;
        phone_number?: string;
        email?: string;
    };
    room?: Room;
}

interface CheckoutData {
    user_id: string;
    booking_id: string;
    room_id: string;
    checkout_date: string;
    expected_return_date: string;
    status: string;
    checkout_notes?: string;
    condition_on_checkout?: string;
    total_items: number;
    type: 'room';
    created_at: string;
}

interface CheckoutItemData {
    checkout_id: string;
    equipment_id: string;
    quantity: number;
    condition_notes?: string;
    status: string;
}

// ===== MAIN COMPONENT =====
const BookingManagement: React.FC = () => {
    const { profile } = useAuth();
    
    // ===== STATE =====
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    
    // Edit Form State
    const [editFormData, setEditFormData] = useState<{
        room_id: string;
        purpose: string;
        start_time: string;
        end_time: string;
        notes: string;
    }>({
        room_id: '',
        purpose: '',
        start_time: '',
        end_time: '',
        notes: ''
    });
    
    // Equipment State for Edit
    const [rooms, setRooms] = useState<Room[]>([]);
    const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
    const [mandatoryEquipment, setMandatoryEquipment] = useState<Equipment[]>([]);
    const [optionalEquipment, setOptionalEquipment] = useState<Equipment[]>([]);
    const [equipmentSelections, setEquipmentSelections] = useState<EquipmentSelection[]>([]);
    const [showEquipmentSection, setShowEquipmentSection] = useState(false);
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const [equipmentSearch, setEquipmentSearch] = useState('');
    const [unavailableEquipment, setUnavailableEquipment] = useState<string[]>([]);

    // ===== FETCH BOOKINGS =====
    const fetchBookings = useCallback(async () => {
        try {
            setLoading(true);
            
            let query = supabase
                .from('bookings')
                .select(`
                    *,
                    user:users!bookings_user_id_fkey(
                        id, full_name, identity_number, phone_number, email
                    ),
                    room:rooms!bookings_room_id_fkey(
                        id, name, code, capacity,
                        department:departments(name)
                    )
                `)
                .order('created_at', { ascending: false });

            // Department filter for department admin
            if (profile?.role === 'department_admin' && profile.department_id) {
                query = query.eq('room.department_id', profile.department_id);
            }

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;
            
            if (error) throw error;
            setBookings(data || []);
            
        } catch (error: any) {
            console.error('Error fetching bookings:', error);
            toast.error(`Gagal memuat data booking: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [profile, statusFilter]);

    // ===== FETCH ROOMS =====
    const fetchRooms = async () => {
        try {
            let query = supabase
                .from('rooms')
                .select(`
                    id, name, code, capacity, department_id,
                    department:departments(name)
                `)
                .order('name');

            if (profile?.role === 'department_admin' && profile.department_id) {
                query = query.eq('department_id', profile.department_id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setRooms(data || []);
        } catch (error: any) {
            console.error('Error fetching rooms:', error);
        }
    };

    // ===== FETCH ALL EQUIPMENT =====
    const fetchAllEquipment = async () => {
        try {
            const { data, error } = await supabase
                .from('equipment')
                .select('*')
                .eq('is_available', true)
                .order('name');

            if (error) throw error;
            setAllEquipment(data || []);
        } catch (error: any) {
            console.error('Error fetching equipment:', error);
        }
    };

    // ===== FETCH EQUIPMENT BY ROOM =====
    const fetchEquipmentByRoom = async (roomId: string) => {
        try {
            setLoadingEquipment(true);

            // 1. Fetch MANDATORY equipment for this specific room
            const { data: mandatoryData, error: mandatoryError } = await supabase
                .from('equipment')
                .select('*')
                .eq('rooms_id', roomId)
                .eq('is_available', true)
                .eq('is_mandatory', true);

            if (mandatoryError) throw mandatoryError;

            // 2. Fetch OPTIONAL equipment (is_available=true, is_mandatory=false, quantity>0)
            const { data: optionalData, error: optionalError } = await supabase
                .from('equipment')
                .select('*')
                .eq('is_mandatory', false)
                .eq('is_available', true)
                .gt('quantity', 0)
                .order('name');

            if (optionalError) throw optionalError;

            setMandatoryEquipment(mandatoryData || []);
            setOptionalEquipment(optionalData || []);

            return {
                mandatory: mandatoryData || [],
                optional: optionalData || []
            };
            
        } catch (error: any) {
            console.error('Error fetching equipment by room:', error);
            toast.error('Gagal memuat data peralatan');
            return { mandatory: [], optional: [] };
        } finally {
            setLoadingEquipment(false);
        }
    };

    // ===== INITIALIZE EQUIPMENT SELECTIONS FROM BOOKING =====
    const initializeEquipmentSelections = async (booking: Booking, newRoomId?: string) => {
        const targetRoomId = newRoomId || booking.room_id;
        const { mandatory, optional } = await fetchEquipmentByRoom(targetRoomId);

        const selections: EquipmentSelection[] = [];
        const unavailable: string[] = [];

        // Add all mandatory equipment from the target room
        mandatory.forEach(eq => {
            // Check if this equipment was in original booking
            const originalIndex = booking.equipment_requested?.indexOf(eq.id);
            const originalQty = originalIndex !== -1 
                ? booking.equipment_quantities?.[originalIndex] || 1 
                : eq.quantity;

            // Validate availability
            if (!eq.is_available) {
                unavailable.push(eq.name);
                return;
            }

            selections.push({
                equipment_id: eq.id,
                equipment_name: eq.name,
                equipment_code: eq.code,
                equipment_unit: eq.unit || 'pcs',
                quantity: Math.min(originalQty, eq.quantity),
                is_mandatory: true,
                max_quantity: eq.quantity
            });
        });

        // If room hasn't changed, also include optional equipment from original booking
        if (!newRoomId || newRoomId === booking.room_id) {
            booking.equipment_requested?.forEach((eqId, index) => {
                // Skip if already added as mandatory
                if (selections.some(s => s.equipment_id === eqId)) return;

                const eq = [...mandatory, ...optional].find(e => e.id === eqId);
                if (eq && !eq.is_mandatory) {
                    // Validate availability for optional equipment
                    if (!eq.is_available) {
                        unavailable.push(eq.name);
                        return;
                    }

                    selections.push({
                        equipment_id: eq.id,
                        equipment_name: eq.name,
                        equipment_code: eq.code,
                        equipment_unit: eq.unit || 'pcs',
                        quantity: booking.equipment_quantities?.[index] || 1,
                        is_mandatory: false,
                        max_quantity: eq.quantity
                    });
                }
            });
        }

        setUnavailableEquipment(unavailable);
        setEquipmentSelections(selections);
    };

    // ===== HANDLE ROOM CHANGE IN EDIT =====
    const handleRoomChange = async (newRoomId: string) => {
        if (!selectedBooking) return;

        setEditFormData(prev => ({ ...prev, room_id: newRoomId }));
        setEquipmentSearch(''); // Reset search when room changes
        
        // Re-initialize equipment selections with new room
        await initializeEquipmentSelections(selectedBooking, newRoomId);
    };

    // ===== ADD OPTIONAL EQUIPMENT =====
    const addOptionalEquipment = (equipment: Equipment) => {
        // Check if already added
        if (equipmentSelections.some(s => s.equipment_id === equipment.id)) {
            toast.error('Peralatan sudah ditambahkan');
            return;
        }

        setEquipmentSelections(prev => [...prev, {
            equipment_id: equipment.id,
            equipment_name: equipment.name,
            equipment_code: equipment.code,
            equipment_unit: equipment.unit || 'pcs',
            quantity: 1,
            is_mandatory: false,
            max_quantity: equipment.quantity
        }]);
    };

    // ===== REMOVE OPTIONAL EQUIPMENT =====
    const removeOptionalEquipment = (equipmentId: string) => {
        setEquipmentSelections(prev => 
            prev.filter(s => s.equipment_id !== equipmentId || s.is_mandatory)
        );
    };

    // ===== UPDATE EQUIPMENT QUANTITY =====
    const updateEquipmentQuantity = (equipmentId: string, newQuantity: number) => {
        setEquipmentSelections(prev => 
            prev.map(s => {
                if (s.equipment_id === equipmentId) {
                    return {
                        ...s,
                        quantity: Math.max(1, Math.min(newQuantity, s.max_quantity))
                    };
                }
                return s;
            })
        );
    };

    // ===== FILTER OPTIONAL EQUIPMENT =====
    const filteredOptionalEquipment = useMemo(() => {
        const searchLower = equipmentSearch.toLowerCase();
        return optionalEquipment.filter(eq => 
            !equipmentSelections.some(s => s.equipment_id === eq.id) &&
            (eq.name.toLowerCase().includes(searchLower) || 
             eq.code?.toLowerCase().includes(searchLower) || 
             eq.category?.toLowerCase().includes(searchLower))
        );
    }, [optionalEquipment, equipmentSelections, equipmentSearch]);

    // ===== CREATE CHECKOUT FOR OLD BOOKING DATA =====
    const createCheckoutForOldData = async (
        booking: Booking,
        mandatoryEquipmentOnly: Equipment[]
    ): Promise<string | null> => {
        try {
            console.log('📦 Creating checkout for old booking data...');

            // 1. Create checkout record
            const checkoutData: CheckoutData = {
                user_id: booking.user_id,
                booking_id: booking.id,
                room_id: booking.room_id,
                checkout_date: new Date().toISOString(),
                expected_return_date: booking.end_time,
                status: 'returned',
                checkout_notes: `Auto-checkout dari edit booking. Room sebelumnya: ${booking.room?.name}`,
                condition_on_checkout: 'Baik',
                total_items: mandatoryEquipmentOnly.length,
                type: 'room',
                created_at: new Date().toISOString()
            };

            const { data: checkoutResult, error: checkoutError } = await supabase
                .from('checkouts')
                .insert(checkoutData)
                .select()
                .single();

            if (checkoutError) throw checkoutError;

            console.log('✅ Checkout created:', checkoutResult.id);

            // 2. Create checkout_items for MANDATORY equipment only
            const checkoutItems: CheckoutItemData[] = [];

            booking.equipment_requested?.forEach((eqId, index) => {
                const equipment = mandatoryEquipmentOnly.find(e => e.id === eqId);
                if (equipment && equipment.is_mandatory) {
                    checkoutItems.push({
                        checkout_id: checkoutResult.id,
                        equipment_id: eqId,
                        quantity: booking.equipment_quantities?.[index] || 1,
                        condition_notes: 'Auto dari edit booking',
                        status: 'pending_verification'
                    });
                }
            });

            if (checkoutItems.length > 0) {
                const { error: itemsError } = await supabase
                    .from('checkout_items')
                    .insert(checkoutItems);

                if (itemsError) throw itemsError;
                console.log('✅ Checkout items created:', checkoutItems.length);
            }

            return checkoutResult.id;

        } catch (error: any) {
            console.error('❌ Error creating checkout:', error);
            throw error;
        }
    };

    // ===== UPDATE EQUIPMENT QUANTITIES =====
    const updateEquipmentQuantities = async (
        oldSelections: EquipmentSelection[],
        newSelections: EquipmentSelection[],
        action: 'borrow' | 'return'
    ) => {
        try {
            console.log(`📊 Updating equipment quantities (${action})...`);

            for (const newSel of newSelections) {
                const oldSel = oldSelections.find(o => o.equipment_id === newSel.equipment_id);
                const oldQty = oldSel?.quantity || 0;
                const newQty = newSel.quantity;
                const difference = newQty - oldQty;

                if (difference !== 0) {
                    const { data: currentEq, error: fetchError } = await supabase
                        .from('equipment')
                        .select('quantity')
                        .eq('id', newSel.equipment_id)
                        .single();

                    if (fetchError) throw fetchError;

                    let newEquipmentQty: number;
                    
                    if (action === 'borrow') {
                        newEquipmentQty = currentEq.quantity - difference;
                    } else {
                        newEquipmentQty = currentEq.quantity + difference;
                    }

                    const { error: updateError } = await supabase
                        .from('equipment')
                        .update({ 
                            quantity: Math.max(0, newEquipmentQty),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', newSel.equipment_id);

                    if (updateError) throw updateError;

                    console.log(`  ✅ Equipment ${newSel.equipment_name}: ${currentEq.quantity} → ${newEquipmentQty}`);

                    // Log to equipment_quantity_logs
                    await supabase
                        .from('equipment_quantity_logs')
                        .insert({
                            equipment_id: newSel.equipment_id,
                            from_quantity: currentEq.quantity,
                            to_quantity: newEquipmentQty,
                            change_amount: Math.abs(difference),
                            transaction_type: action === 'borrow' ? 'checkout' : 'return',
                            reference_type: 'booking_edit',
                            created_at: new Date().toISOString()
                        });
                }
            }

            // Handle removed equipment (return to stock)
            for (const oldSel of oldSelections) {
                if (!newSelections.some(n => n.equipment_id === oldSel.equipment_id)) {
                    const { data: currentEq, error: fetchError } = await supabase
                        .from('equipment')
                        .select('quantity')
                        .eq('id', oldSel.equipment_id)
                        .single();

                    if (fetchError) throw fetchError;

                    const newEquipmentQty = currentEq.quantity + oldSel.quantity;

                    const { error: updateError } = await supabase
                        .from('equipment')
                        .update({ 
                            quantity: newEquipmentQty,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', oldSel.equipment_id);

                    if (updateError) throw updateError;

                    console.log(`  ✅ Equipment ${oldSel.equipment_name} returned: ${currentEq.quantity} → ${newEquipmentQty}`);
                }
            }

        } catch (error: any) {
            console.error('❌ Error updating equipment quantities:', error);
            throw error;
        }
    };

    // ===== HANDLE UPDATE BOOKING =====
    const handleUpdateBooking = async () => {
        if (!selectedBooking) return;

        try {
            setProcessingIds(prev => new Set(prev).add(selectedBooking.id));
            
            const originalStatus = selectedBooking.status;
            const roomChanged = editFormData.room_id !== selectedBooking.room_id;

            console.log('🔄 Updating booking...', {
                bookingId: selectedBooking.id,
                originalStatus,
                roomChanged,
                newRoomId: editFormData.room_id
            });

            // ===== CASE 1: STATUS = "BORROWED" =====
            if (originalStatus === 'borrowed') {
                // If room changed, create checkout for old data
                if (roomChanged) {
                    const { data: oldMandatoryEquipment } = await supabase
                        .from('equipment')
                        .select('*')
                        .eq('rooms_id', selectedBooking.room_id)
                        .eq('is_available', true)
                        .eq('is_mandatory', true);

                    await createCheckoutForOldData(
                        selectedBooking,
                        oldMandatoryEquipment || []
                    );

                    toast.success('Data checkout lama telah dibuat untuk validasi');
                }

                // Get old equipment selections for comparison
                const oldSelections: EquipmentSelection[] = [];
                selectedBooking.equipment_requested?.forEach((eqId, index) => {
                    const eq = allEquipment.find(e => e.id === eqId);
                    if (eq) {
                        oldSelections.push({
                            equipment_id: eq.id,
                            equipment_name: eq.name,
                            equipment_code: eq.code,
                            equipment_unit: eq.unit || 'pcs',
                            quantity: selectedBooking.equipment_quantities?.[index] || 1,
                            is_mandatory: eq.is_mandatory,
                            max_quantity: eq.quantity
                        });
                    }
                });

                await updateEquipmentQuantities(oldSelections, equipmentSelections, 'borrow');
            }

            // ===== BUILD UPDATE DATA =====
            const newEquipmentRequested = equipmentSelections.map(s => s.equipment_id);
            const newEquipmentQuantities = equipmentSelections.map(s => s.quantity);

            const updateData: any = {
                room_id: editFormData.room_id,
                purpose: editFormData.purpose,
                start_time: editFormData.start_time,
                end_time: editFormData.end_time,
                notes: editFormData.notes,
                equipment_requested: newEquipmentRequested,
                equipment_quantities: newEquipmentQuantities,
                updated_at: new Date().toISOString()
            };

            // Update booking
            const { error: updateError } = await supabase
                .from('bookings')
                .update(updateData)
                .eq('id', selectedBooking.id);

            if (updateError) throw updateError;

            toast.success('Booking berhasil diperbarui!');
            
            setShowEditModal(false);
            setSelectedBooking(null);
            await fetchBookings();

        } catch (error: any) {
            console.error('❌ Error updating booking:', error);
            toast.error(`Gagal memperbarui booking: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(selectedBooking?.id || '');
                return newSet;
            });
        }
    };

    // ===== HANDLE STATUS CHANGE =====
    const handleStatusChange = async (bookingId: string, newStatus: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(bookingId));
            
            const booking = bookings.find(b => b.id === bookingId);
            if (!booking) throw new Error('Booking tidak ditemukan');

            console.log(`📊 Changing status: ${booking.status} → ${newStatus}`);

            // ===== APPROVED → BORROWED: Validate and deduct equipment quantities =====
            if (booking.status === 'approved' && newStatus === 'borrowed') {
                console.log('🔍 Checking equipment availability...');
                
                // Validate equipment availability
                for (let i = 0; i < (booking.equipment_requested?.length || 0); i++) {
                    const eqId = booking.equipment_requested[i];
                    const qty = booking.equipment_quantities?.[i] || 1;

                    const { data: currentEq, error: fetchError } = await supabase
                        .from('equipment')
                        .select('quantity, name, is_available')
                        .eq('id', eqId)
                        .single();

                    if (fetchError) {
                        throw new Error(`Gagal memeriksa peralatan: ${currentEq?.name || eqId}`);
                    }

                    // Validate availability
                    if (!currentEq.is_available) {
                        throw new Error(`Peralatan "${currentEq.name}" tidak tersedia.`);
                    }

                    // Validate quantity
                    if (currentEq.quantity < qty) {
                        throw new Error(`Stok "${currentEq.name}" tidak cukup. Tersedia: ${currentEq.quantity}`);
                    }
                }

                console.log('🔻 Deducting equipment quantities...');
                
                // Deduct quantities
                for (let i = 0; i < (booking.equipment_requested?.length || 0); i++) {
                    const eqId = booking.equipment_requested[i];
                    const qty = booking.equipment_quantities?.[i] || 1;

                    const { data: currentEq, error: fetchError } = await supabase
                        .from('equipment')
                        .select('quantity, name')
                        .eq('id', eqId)
                        .single();

                    if (fetchError) continue;

                    const newQty = Math.max(0, currentEq.quantity - qty);

                    const { error: updateError } = await supabase
                        .from('equipment')
                        .update({ 
                            quantity: newQty,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', eqId);

                    if (updateError) continue;

                    console.log(`  ✅ ${currentEq.name}: ${currentEq.quantity} → ${newQty} (-${qty})`);

                    // Log the change
                    await supabase
                        .from('equipment_quantity_logs')
                        .insert({
                            equipment_id: eqId,
                            from_quantity: currentEq.quantity,
                            to_quantity: newQty,
                            change_amount: qty,
                            transaction_type: 'checkout',
                            reference_type: 'booking',
                            reference_id: bookingId,
                            created_at: new Date().toISOString()
                        });
                }
            }

            // Update booking status
            const { error: statusError } = await supabase
                .from('bookings')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingId);

            if (statusError) throw statusError;

            toast.success(`Status berhasil diubah ke ${newStatus}`);
            await fetchBookings();

        } catch (error: any) {
            console.error('❌ Error changing status:', error);
            toast.error(`Gagal mengubah status: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(bookingId);
                return newSet;
            });
        }
    };

    // ===== HANDLE DELETE BOOKING =====
    const handleDeleteBooking = async () => {
        if (!selectedBooking) return;

        try {
            setProcessingIds(prev => new Set(prev).add(selectedBooking.id));

            // If status is borrowed, return equipment quantities first
            if (selectedBooking.status === 'borrowed') {
                console.log('🔄 Returning equipment quantities before deletion...');
                
                for (let i = 0; i < (selectedBooking.equipment_requested?.length || 0); i++) {
                    const eqId = selectedBooking.equipment_requested[i];
                    const qty = selectedBooking.equipment_quantities?.[i] || 1;

                    const { data: currentEq, error: fetchError } = await supabase
                        .from('equipment')
                        .select('quantity, name')
                        .eq('id', eqId)
                        .single();

                    if (fetchError) continue;

                    const newQty = currentEq.quantity + qty;

                    const { error: updateError } = await supabase
                        .from('equipment')
                        .update({ 
                            quantity: newQty,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', eqId);

                    if (updateError) continue;

                    console.log(`  ✅ ${currentEq.name} returned: ${currentEq.quantity} → ${newQty} (+${qty})`);
                }
            }

            // Delete the booking
            const { error: deleteError } = await supabase
                .from('bookings')
                .delete()
                .eq('id', selectedBooking.id);

            if (deleteError) throw deleteError;

            toast.success('Booking berhasil dihapus!');
            setShowDeleteModal(false);
            setSelectedBooking(null);
            await fetchBookings();

        } catch (error: any) {
            console.error('❌ Error deleting booking:', error);
            toast.error(`Gagal menghapus booking: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(selectedBooking?.id || '');
                return newSet;
            });
        }
    };

    // ===== OPEN EDIT MODAL =====
    const openEditModal = async (booking: Booking) => {
        setSelectedBooking(booking);
        setEditFormData({
            room_id: booking.room_id,
            purpose: booking.purpose,
            start_time: booking.start_time,
            end_time: booking.end_time,
            notes: booking.notes || ''
        });

        await fetchRooms();
        await fetchAllEquipment();
        await initializeEquipmentSelections(booking);
        
        setShowEditModal(true);
    };

    // ===== OPEN DELETE MODAL =====
    const openDeleteModal = (booking: Booking) => {
        setSelectedBooking(booking);
        setShowDeleteModal(true);
    };

    // ===== EFFECTS =====
    useEffect(() => {
        if (profile) {
            fetchBookings();
        }
    }, [profile, fetchBookings]);

    // ===== FILTERS =====
    const filteredBookings = useMemo(() => {
        return bookings.filter(booking => {
            const searchLower = searchTerm.toLowerCase();
            return (
                booking.user?.full_name?.toLowerCase().includes(searchLower) ||
                booking.user?.identity_number?.toLowerCase().includes(searchLower) ||
                booking.room?.name?.toLowerCase().includes(searchLower) ||
                booking.purpose?.toLowerCase().includes(searchLower)
            );
        });
    }, [bookings, searchTerm]);

    // ===== STATUS BADGE =====
    const getStatusBadge = (status: string) => {
        const config: Record<string, { color: string; icon: string; label: string }> = {
            pending: { color: 'bg-yellow-100 text-yellow-800', icon: '⏳', label: 'Pending' },
            approved: { color: 'bg-blue-100 text-blue-800', icon: '✅', label: 'Approved' },
            borrowed: { color: 'bg-purple-100 text-purple-800', icon: '📦', label: 'Borrowed' },
            completed: { color: 'bg-green-100 text-green-800', icon: '✔️', label: 'Completed' },
            cancelled: { color: 'bg-gray-100 text-gray-800', icon: '❌', label: 'Cancelled' },
            rejected: { color: 'bg-red-100 text-red-800', icon: '🚫', label: 'Rejected' }
        };

        const cfg = config[status] || config.pending;
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                <span className="mr-1">{cfg.icon}</span>
                {cfg.label}
            </span>
        );
    };

    // ===== RENDER ACTIONS BASED ON STATUS =====
    const renderBookingActions = (booking: Booking) => {
        const isProcessing = processingIds.has(booking.id);

        switch (booking.status) {
            case 'pending':
                return (
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => {
                                setSelectedBooking(booking);
                                setShowDetailModal(true);
                            }}
                            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg"
                            title="Lihat Detail"
                        >
                            <Eye className="h-4 w-4" />
                        </button>
                        
                        <button 
                            onClick={() => openEditModal(booking)}
                            className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg"
                            title="Edit Booking"
                        >
                            <Edit className="h-4 w-4" />
                        </button>

                        <button 
                            onClick={() => handleStatusChange(booking.id, 'approved')}
                            disabled={isProcessing}
                            className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg disabled:opacity-50"
                            title="Approve"
                        >
                            <Check className="h-4 w-4" />
                        </button>

                        <button 
                            onClick={() => handleStatusChange(booking.id, 'borrowed')}
                            disabled={isProcessing}
                            className="p-2 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-lg disabled:opacity-50"
                            title="Set Borrowed"
                        >
                            <Package className="h-4 w-4" />
                        </button>

                        <button 
                            onClick={() => handleStatusChange(booking.id, 'rejected')}
                            disabled={isProcessing}
                            className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg disabled:opacity-50"
                            title="Reject"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <button 
                            onClick={() => openDeleteModal(booking)}
                            disabled={isProcessing}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50"
                            title="Hapus Booking"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                );

            case 'approved':
                return (
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => {
                                setSelectedBooking(booking);
                                setShowDetailModal(true);
                            }}
                            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg"
                            title="Lihat Detail"
                        >
                            <Eye className="h-4 w-4" />
                        </button>
                        
                        <button 
                            onClick={() => openEditModal(booking)}
                            className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg"
                            title="Edit Booking"
                        >
                            <Edit className="h-4 w-4" />
                        </button>

                        <button 
                            onClick={() => handleStatusChange(booking.id, 'borrowed')}
                            disabled={isProcessing}
                            className="p-2 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-lg disabled:opacity-50"
                            title="Set Borrowed"
                        >
                            <Package className="h-4 w-4" />
                        </button>

                        <button 
                            onClick={() => handleStatusChange(booking.id, 'rejected')}
                            disabled={isProcessing}
                            className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg disabled:opacity-50"
                            title="Reject"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <button 
                            onClick={() => openDeleteModal(booking)}
                            disabled={isProcessing}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50"
                            title="Hapus Booking"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                );

            case 'borrowed':
                return (
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => {
                                setSelectedBooking(booking);
                                setShowDetailModal(true);
                            }}
                            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg"
                            title="Lihat Detail"
                        >
                            <Eye className="h-4 w-4" />
                        </button>
                        
                        <button 
                            onClick={() => openEditModal(booking)}
                            className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg"
                            title="Edit Booking"
                        >
                            <Edit className="h-4 w-4" />
                        </button>
                    </div>
                );

            case 'completed':
                return (
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => {
                                setSelectedBooking(booking);
                                setShowDetailModal(true);
                            }}
                            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg"
                            title="Lihat Detail"
                        >
                            <Eye className="h-4 w-4" />
                        </button>

                        <button 
                            onClick={() => openDeleteModal(booking)}
                            disabled={isProcessing}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50"
                            title="Hapus Booking"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                );

            default:
                return (
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => {
                                setSelectedBooking(booking);
                                setShowDetailModal(true);
                            }}
                            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg"
                            title="Lihat Detail"
                        >
                            <Eye className="h-4 w-4" />
                        </button>
                    </div>
                );
        }
    };

    // ===== ACCESS CONTROL =====
    if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Akses Ditolak</h3>
                    <p className="text-gray-600">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ===== HEADER ===== */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3">
                            <Calendar className="h-8 w-8" />
                            <span>Manajemen Booking</span>
                        </h1>
                        <p className="mt-2 opacity-90">
                            Kelola dan proses permintaan peminjaman ruangan
                        </p>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-2xl font-bold">{bookings.length}</div>
                        <div className="text-sm opacity-80">Total Booking</div>
                    </div>
                </div>
            </div>

            {/* ===== SEARCH & FILTERS ===== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full lg:flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Cari berdasarkan nama, NIM, ruangan..."
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        />
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">Semua Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="borrowed">Borrowed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        
                        <button 
                            onClick={fetchBookings}
                            disabled={loading}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== BOOKING LIST ===== */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : filteredBookings.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Tidak Ada Booking</h3>
                        <p className="text-gray-600">Belum ada data booking yang sesuai filter.</p>
                    </div>
                ) : (
                    filteredBookings.map((booking) => (
                        <div 
                            key={booking.id}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    {/* Header */}
                                    <div className="flex items-center space-x-4 mb-4">
                                        <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                                            <Building className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-3">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {booking.room?.name || 'Unknown Room'}
                                                </h3>
                                                {getStatusBadge(booking.status)}
                                            </div>
                                            <p className="text-sm text-gray-600">{booking.purpose}</p>
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="flex items-center space-x-2">
                                            <User className="h-4 w-4 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">{booking.user?.full_name}</p>
                                                <p className="text-xs text-gray-500">{booking.user?.identity_number}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-2">
                                            <Clock className="h-4 w-4 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">
                                                    {format(parseISO(booking.start_time), 'dd MMM yyyy')}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {format(parseISO(booking.start_time), 'HH:mm')} - {format(parseISO(booking.end_time), 'HH:mm')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Package className="h-4 w-4 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">
                                                    {booking.equipment_requested?.length || 0} Peralatan
                                                </p>
                                                <p className="text-xs text-gray-500">Dipinjam</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Calendar className="h-4 w-4 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">
                                                    {format(parseISO(booking.created_at), 'dd MMM yyyy')}
                                                </p>
                                                <p className="text-xs text-gray-500">Dibuat</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center space-x-2 ml-4">
                                    {renderBookingActions(booking)}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* ===== DETAIL MODAL ===== */}
            {showDetailModal && selectedBooking && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Detail Booking</h2>
                                    <p className="mt-1 opacity-90">
                                        {selectedBooking.room?.name} - {selectedBooking.user?.full_name}
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

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            {/* Booking Info */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="font-medium text-gray-700 mb-2">Informasi Pemohon</h4>
                                        <p className="font-semibold">{selectedBooking.user?.full_name}</p>
                                        <p className="text-sm text-gray-600">{selectedBooking.user?.identity_number}</p>
                                        <p className="text-sm text-gray-600">{selectedBooking.user?.phone_number}</p>
                                    </div>
                                    
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="font-medium text-gray-700 mb-2">Ruangan</h4>
                                        <p className="font-semibold">{selectedBooking.room?.name}</p>
                                        <p className="text-sm text-gray-600">Kode: {selectedBooking.room?.code}</p>
                                        <p className="text-sm text-gray-600">Kapasitas: {selectedBooking.room?.capacity}</p>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-700 mb-2">Waktu Peminjaman</h4>
                                    <div className="flex items-center space-x-4">
                                        <div>
                                            <p className="text-sm text-gray-600">Mulai</p>
                                            <p className="font-semibold">
                                                {format(parseISO(selectedBooking.start_time), 'dd MMM yyyy HH:mm')}
                                            </p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-gray-400" />
                                        <div>
                                            <p className="text-sm text-gray-600">Selesai</p>
                                            <p className="font-semibold">
                                                {format(parseISO(selectedBooking.end_time), 'dd MMM yyyy HH:mm')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-700 mb-2">Tujuan</h4>
                                    <p>{selectedBooking.purpose}</p>
                                    {selectedBooking.notes && (
                                        <p className="text-sm text-gray-600 mt-2">
                                            <strong>Catatan:</strong> {selectedBooking.notes}
                                        </p>
                                    )}
                                </div>

                                {/* Equipment List */}
                                {selectedBooking.equipment_requested && selectedBooking.equipment_requested.length > 0 && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="font-medium text-gray-700 mb-3">Peralatan Dipinjam</h4>
                                        <div className="space-y-2">
                                            {selectedBooking.equipment_requested.map((eqId, index) => {
                                                const eq = allEquipment.find(e => e.id === eqId);
                                                return (
                                                    <div key={eqId} className="flex items-center justify-between bg-white p-3 rounded-lg">
                                                        <div className="flex items-center space-x-3">
                                                            <Package className="h-4 w-4 text-gray-400" />
                                                            <span>{eq?.name || eqId}</span>
                                                            {eq?.is_mandatory && (
                                                                <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                                                    Wajib
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="font-medium">
                                                            {selectedBooking.equipment_quantities?.[index] || 1} {eq?.unit || 'pcs'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Status */}
                                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                                    <div>
                                        <h4 className="font-medium text-gray-700">Status</h4>
                                        <div className="mt-1">{getStatusBadge(selectedBooking.status)}</div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-600">Dibuat pada</p>
                                        <p className="font-medium">
                                            {format(parseISO(selectedBooking.created_at), 'dd MMM yyyy HH:mm')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== EDIT MODAL ===== */}
            {showEditModal && selectedBooking && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Edit Booking</h2>
                                    <p className="mt-1 opacity-90">
                                        Status: {getStatusBadge(selectedBooking.status)}
                                        {selectedBooking.status === 'borrowed' && (
                                            <span className="ml-2 text-yellow-200 text-sm">
                                                ⚠️ Perubahan room akan membuat checkout otomatis
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setShowEditModal(false)}
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                            <div className="space-y-6">
                                {/* Warning untuk unavailable equipment */}
                                {unavailableEquipment.length > 0 && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                        <div className="flex items-start">
                                            <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-red-800">Peralatan Tidak Tersedia</p>
                                                <p className="text-sm text-red-700">
                                                    Peralatan berikut tidak tersedia dan akan dihapus: {unavailableEquipment.join(', ')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Room Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Ruangan *
                                    </label>
                                    <select
                                        value={editFormData.room_id}
                                        onChange={(e) => handleRoomChange(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {rooms.map(room => (
                                            <option key={room.id} value={room.id}>
                                                {room.name} ({room.code}) - Kapasitas: {room.capacity}
                                            </option>
                                        ))}
                                    </select>
                                    {editFormData.room_id !== selectedBooking.room_id && selectedBooking.status === 'borrowed' && (
                                        <p className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                                            ⚠️ Mengubah ruangan akan membuat checkout otomatis untuk peralatan wajib ruangan sebelumnya.
                                        </p>
                                    )}
                                </div>

                                {/* Time */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Waktu Mulai *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={editFormData.start_time?.slice(0, 16)}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, start_time: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Waktu Selesai *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={editFormData.end_time?.slice(0, 16)}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, end_time: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Purpose */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Tujuan *
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.purpose}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, purpose: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Catatan
                                    </label>
                                    <textarea
                                        value={editFormData.notes}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Equipment Section */}
                                <div className="border-t pt-6">
                                    <div 
                                        className="flex items-center justify-between cursor-pointer"
                                        onClick={() => setShowEquipmentSection(!showEquipmentSection)}
                                    >
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <Package className="h-5 w-5 mr-2 text-blue-600" />
                                            Peralatan ({equipmentSelections.length})
                                        </h3>
                                        {showEquipmentSection ? (
                                            <ChevronUp className="h-5 w-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="h-5 w-5 text-gray-400" />
                                        )}
                                    </div>

                                    {showEquipmentSection && (
                                        <div className="mt-4 space-y-4">
                                            {/* Warning for borrowed status */}
                                            {selectedBooking.status === 'borrowed' && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                                    <div className="flex items-start">
                                                        <AlertTriangle className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
                                                        <div>
                                                            <p className="font-medium text-amber-800">Status Borrowed</p>
                                                            <p className="text-sm text-amber-700">
                                                                Perubahan jumlah peralatan akan langsung mempengaruhi stok di tabel equipment.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedBooking.status === 'approved' && (
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                    <div className="flex items-start">
                                                        <Info className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                                                        <div>
                                                            <p className="font-medium text-blue-800">Status Approved</p>
                                                            <p className="text-sm text-blue-700">
                                                                Perubahan peralatan tidak akan mempengaruhi stok. Stok akan dikurangi saat status berubah ke "Borrowed".
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Loading indicator */}
                                            {loadingEquipment && (
                                                <div className="flex items-center justify-center py-4">
                                                    <RefreshCw className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                                                    <span className="text-gray-600">Memuat peralatan...</span>
                                                </div>
                                            )}

                                            {/* Mandatory Equipment */}
                                            <div>
                                                <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded mr-2">WAJIB</span>
                                                    Peralatan Wajib Ruangan
                                                </h4>
                                                <div className="space-y-2">
                                                    {equipmentSelections.filter(s => s.is_mandatory).map((selection) => (
                                                        <div 
                                                            key={selection.equipment_id}
                                                            className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-3"
                                                        >
                                                            <div>
                                                                <p className="font-medium text-gray-900">{selection.equipment_name}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    Kode: {selection.equipment_code || 'N/A'} | Max: {selection.max_quantity} {selection.equipment_unit}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <button
                                                                    onClick={() => updateEquipmentQuantity(selection.equipment_id, selection.quantity - 1)}
                                                                    disabled={selection.quantity <= 1}
                                                                    className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded disabled:opacity-50"
                                                                >
                                                                    <Minus className="h-4 w-4" />
                                                                </button>
                                                                <span className="w-12 text-center font-bold">{selection.quantity}</span>
                                                                <button
                                                                    onClick={() => updateEquipmentQuantity(selection.equipment_id, selection.quantity + 1)}
                                                                    disabled={selection.quantity >= selection.max_quantity}
                                                                    className="p-1 bg-green-100 hover:bg-green-200 text-green-600 rounded disabled:opacity-50"
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {equipmentSelections.filter(s => s.is_mandatory).length === 0 && (
                                                        <p className="text-gray-500 text-sm italic">Tidak ada peralatan wajib untuk ruangan ini</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Optional Equipment - Selected */}
                                            <div>
                                                <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded mr-2">OPSIONAL</span>
                                                    Peralatan Tambahan yang Dipilih
                                                </h4>
                                                <div className="space-y-2">
                                                    {equipmentSelections.filter(s => !s.is_mandatory).map((selection) => (
                                                        <div 
                                                            key={selection.equipment_id}
                                                            className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3"
                                                        >
                                                            <div>
                                                                <p className="font-medium text-gray-900">{selection.equipment_name}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    Kode: {selection.equipment_code || 'N/A'} | Max: {selection.max_quantity} {selection.equipment_unit}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <button
                                                                    onClick={() => updateEquipmentQuantity(selection.equipment_id, selection.quantity - 1)}
                                                                    disabled={selection.quantity <= 1}
                                                                    className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded disabled:opacity-50"
                                                                >
                                                                    <Minus className="h-4 w-4" />
                                                                </button>
                                                                <span className="w-12 text-center font-bold">{selection.quantity}</span>
                                                                <button
                                                                    onClick={() => updateEquipmentQuantity(selection.equipment_id, selection.quantity + 1)}
                                                                    disabled={selection.quantity >= selection.max_quantity}
                                                                    className="p-1 bg-green-100 hover:bg-green-200 text-green-600 rounded disabled:opacity-50"
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => removeOptionalEquipment(selection.equipment_id)}
                                                                    className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded ml-2"
                                                                    title="Hapus"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {equipmentSelections.filter(s => !s.is_mandatory).length === 0 && (
                                                        <p className="text-gray-500 text-sm italic">Tidak ada peralatan opsional yang dipilih</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Add Optional Equipment with Search */}
                                            <div>
                                                <h4 className="font-medium text-gray-700 mb-3">Tambah Peralatan Opsional</h4>
                                                
                                                {/* Search Bar */}
                                                <div className="relative mb-3">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Cari peralatan opsional..."
                                                        value={equipmentSearch}
                                                        onChange={(e) => setEquipmentSearch(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                                    {filteredOptionalEquipment.length > 0 ? (
                                                        filteredOptionalEquipment.map((eq) => (
                                                            <button
                                                                key={eq.id}
                                                                onClick={() => addOptionalEquipment(eq)}
                                                                className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors"
                                                            >
                                                                <div>
                                                                    <p className="font-medium text-gray-900 text-sm">{eq.name}</p>
                                                                    <p className="text-xs text-gray-500">
                                                                        Kode: {eq.code || 'N/A'} | Stok: {eq.quantity} {eq.unit || 'pcs'}
                                                                    </p>
                                                                </div>
                                                                <Plus className="h-4 w-4 text-green-600" />
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="col-span-2 text-center py-4 text-gray-500">
                                                            {equipmentSearch ? 
                                                                `Tidak ditemukan peralatan dengan kata kunci "${equipmentSearch}"` : 
                                                                'Tidak ada peralatan opsional yang tersedia'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="border-t px-6 py-4 bg-gray-50 flex justify-end space-x-3">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleUpdateBooking}
                                disabled={processingIds.has(selectedBooking.id)}
                                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {processingIds.has(selectedBooking.id) ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                <span>Simpan Perubahan</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DELETE MODAL ===== */}
            {showDeleteModal && selectedBooking && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-center mb-6">
                                <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="h-8 w-8 text-red-600" />
                                </div>
                            </div>
                            
                            <h3 className="text-xl font-semibold text-center mb-2">
                                Hapus Booking
                            </h3>
                            
                            <p className="text-gray-600 text-center mb-6">
                                Apakah Anda yakin ingin menghapus booking ini?
                                {selectedBooking.status === 'borrowed' && (
                                    <span className="block mt-2 text-amber-600 text-sm">
                                        ⚠️ Equipment yang dipinjam akan dikembalikan ke stok.
                                    </span>
                                )}
                            </p>

                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <p className="font-medium">{selectedBooking.room?.name}</p>
                                <p className="text-sm text-gray-600">{selectedBooking.user?.full_name}</p>
                                <p className="text-sm text-gray-600">
                                    {format(parseISO(selectedBooking.start_time), 'dd MMM yyyy HH:mm')}
                                </p>
                                <div className="mt-2">{getStatusBadge(selectedBooking.status)}</div>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleDeleteBooking}
                                    disabled={processingIds.has(selectedBooking.id)}
                                    className="flex items-center space-x-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {processingIds.has(selectedBooking.id) ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                    <span>Hapus</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingManagement;