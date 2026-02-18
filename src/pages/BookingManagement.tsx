import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Calendar, Clock, User, Building, XCircle, AlertTriangle,
    Eye, Edit, Trash2, RefreshCw, Search, ChevronDown, ChevronUp,
    Package, Plus, Minus, X, Check, ArrowRight, FileText, Info,
    AlertCircle, Save, Download, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

// ==================== HELPER COMPONENTS ====================
const PhotoPlaceholder = ({ title, subtitle, isSmall = false }: { title?: string, subtitle?: string, isSmall?: boolean }) => (
    <div className={`absolute inset-0 flex flex-col items-center justify-center bg-blue-50 text-center p-4 z-10 ${isSmall ? 'p-1' : 'p-4'}`}>
        <div className={`${isSmall ? 'w-4 h-4' : 'w-16 h-16 mb-3'} bg-blue-100 rounded-full flex items-center justify-center animate-pulse`}>
            <Loader2 className={`${isSmall ? 'w-3 h-3' : 'w-8 h-8'} text-blue-600 animate-spin`} />
        </div>
        {!isSmall && title && <h3 className="font-bold text-lg text-gray-800 animate-pulse">{title}</h3>}
        {!isSmall && subtitle && <p className="text-sm text-gray-500 mb-2 animate-pulse">{subtitle}</p>}
        {!isSmall && <p className="text-xs text-blue-600 font-medium animate-pulse">Memuat foto...</p>}
    </div>
);

const ImageWithLoader = ({ src, alt, className, title, subtitle, isSmall = false }: { src: string, alt: string, className?: string, title?: string, subtitle?: string, isSmall?: boolean }) => {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <>
            {isLoading && <PhotoPlaceholder title={title} subtitle={subtitle} isSmall={isSmall} />}
            <img
                src={src}
                alt={alt}
                className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                onLoad={() => setIsLoading(false)}
            />
        </>
    );
};

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
    status: 'pending' | 'approved' | 'borrowed' | 'returned' | 'completed' | 'cancelled' | 'rejected';
    equipment_requested: string[];
    equipment_quantities: number[];
    notes?: string;
    user_info?: any;
    created_at: string;
    updated_at: string;
    attachments?: string[];
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

// ===== UTILITY FUNCTIONS =====
const formatDateTimeForInput = (dateString: string) => {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
};

const parseInputToISO = (inputValue: string) => {
    if (!inputValue) return '';

    try {
        const date = new Date(inputValue);
        if (isNaN(date.getTime())) return '';
        return date.toISOString();
    } catch (error) {
        console.error('Error parsing input date:', error);
        return '';
    }
};

// ===== UPDATE EQUIPMENT HELPER FUNCTIONS =====
const updateEquipmentQuantities = async (
    equipmentChanges: Array<{ equipment_id: string; quantity: number; equipment_name: string }>,
    action: 'borrow' | 'return'
) => {
    try {
        console.log(`📊 Updating equipment quantities (${action})...`);

        for (const change of equipmentChanges) {
            const { data: currentEq, error: fetchError } = await supabase
                .from('equipment')
                .select('quantity')
                .eq('id', change.equipment_id)
                .single();

            if (fetchError) {
                console.error(`Error fetching equipment ${change.equipment_name}:`, fetchError);
                continue;
            }

            let newQuantity: number;
            if (action === 'borrow') {
                newQuantity = currentEq.quantity - change.quantity;
                if (newQuantity < 0) {
                    throw new Error(`Stok "${change.equipment_name}" tidak cukup. Tersedia: ${currentEq.quantity}, Diminta: ${change.quantity}`);
                }
            } else {
                newQuantity = currentEq.quantity + change.quantity;
            }

            const { error: updateError } = await supabase
                .from('equipment')
                .update({
                    quantity: newQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', change.equipment_id);

            if (updateError) {
                console.error(`Error updating equipment ${change.equipment_name}:`, updateError);
                continue;
            }

            console.log(`  ✅ ${change.equipment_name}: ${currentEq.quantity} → ${newQuantity} (${action === 'borrow' ? '-' : '+'}${change.quantity})`);

            await supabase
                .from('equipment_quantity_logs')
                .insert({
                    equipment_id: change.equipment_id,
                    from_quantity: currentEq.quantity,
                    to_quantity: newQuantity,
                    change_amount: change.quantity,
                    transaction_type: action,
                    reference_type: 'booking',
                    created_at: new Date().toISOString()
                });
        }
    } catch (error: any) {
        console.error('❌ Error updating equipment quantities:', error);
        throw error;
    }
};

const getEquipmentChanges = (
    oldSelections: EquipmentSelection[],
    newSelections: EquipmentSelection[]
) => {
    const changes: Array<{
        equipment_id: string;
        equipment_name: string;
        oldQuantity: number;
        newQuantity: number;
        difference: number;
    }> = [];

    newSelections.forEach(newSel => {
        const oldSel = oldSelections.find(o => o.equipment_id === newSel.equipment_id);
        const oldQty = oldSel?.quantity || 0;
        const difference = newSel.quantity - oldQty;

        if (difference !== 0) {
            changes.push({
                equipment_id: newSel.equipment_id,
                equipment_name: newSel.equipment_name,
                oldQuantity: oldQty,
                newQuantity: newSel.quantity,
                difference
            });
        }
    });

    oldSelections.forEach(oldSel => {
        if (!newSelections.some(n => n.equipment_id === oldSel.equipment_id)) {
            changes.push({
                equipment_id: oldSel.equipment_id,
                equipment_name: oldSel.equipment_name,
                oldQuantity: oldSel.quantity,
                newQuantity: 0,
                difference: -oldSel.quantity
            });
        }
    });

    return changes;
};

// ===== COMPONENT: ROOM SEARCH DROPDOWN =====
interface RoomSearchDropdownProps {
    rooms: Room[];
    selectedRoomId: string;
    onRoomSelect: (roomId: string) => void;
    isLoading?: boolean;
}

const RoomSearchDropdown: React.FC<RoomSearchDropdownProps> = ({
    rooms,
    selectedRoomId,
    onRoomSelect,
    isLoading = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedRoom = rooms.find(room => room.id === selectedRoomId);

    const filteredRooms = useMemo(() => {
        if (!searchTerm.trim()) return rooms;

        const searchLower = searchTerm.toLowerCase();
        return rooms.filter(room =>
            room.name.toLowerCase().includes(searchLower) ||
            room.code.toLowerCase().includes(searchLower) ||
            room.department?.name?.toLowerCase().includes(searchLower)
        );
    }, [rooms, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleRoomSelect = (room: Room) => {
        onRoomSelect(room.id);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <div className="flex items-center space-x-3">
                    <Building className="h-5 w-5 text-gray-400" />
                    {isLoading ? (
                        <span className="text-gray-500">Memuat ruangan...</span>
                    ) : selectedRoom ? (
                        <div className="text-left">
                            <span className="font-medium">{selectedRoom.name}</span>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <span>Kode: {selectedRoom.code}</span>
                                <span>•</span>
                                <span>Kapasitas: {selectedRoom.capacity}</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-gray-500">Pilih ruangan...</span>
                    )}
                </div>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-hidden">
                    <div className="p-3 border-b border-gray-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari ruangan..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-64">
                        {filteredRooms.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                                Tidak ada ruangan ditemukan
                            </div>
                        ) : (
                            <ul className="py-1">
                                {filteredRooms.map((room) => (
                                    <li key={room.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleRoomSelect(room)}
                                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${room.id === selectedRoomId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                                }`}
                                        >
                                            <span className="font-medium text-gray-900">{room.name}</span>
                                            <div className="text-sm text-gray-600">
                                                Kode: {room.code} • Kapasitas: {room.capacity}
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

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

    const [equipmentMap, setEquipmentMap] = useState<Record<string, Equipment>>({});

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

    const [originalRoomId, setOriginalRoomId] = useState<string>('');

    const [rooms, setRooms] = useState<Room[]>([]);
    const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
    const [mandatoryEquipment, setMandatoryEquipment] = useState<Equipment[]>([]);
    const [optionalEquipment, setOptionalEquipment] = useState<Equipment[]>([]);
    const [equipmentSelections, setEquipmentSelections] = useState<EquipmentSelection[]>([]);
    const [originalEquipmentSelections, setOriginalEquipmentSelections] = useState<EquipmentSelection[]>([]);
    const [showEquipmentSection, setShowEquipmentSection] = useState(false);
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const [equipmentSearch, setEquipmentSearch] = useState('');
    const [unavailableEquipment, setUnavailableEquipment] = useState<string[]>([]);

    // Reject modal states
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [bookingToReject, setBookingToReject] = useState<Booking | null>(null);


    // ===== FETCH BOOKINGS =====
    // Optimized: Select only needed columns to avoid timeout from large data
    const fetchBookings = useCallback(async () => {
        try {
            setLoading(true);

            let query = supabase
                .from('bookings')
                .select(`
                    id, user_id, room_id, start_time, end_time, purpose, sks, class_type, 
                    status, equipment_requested, equipment_quantities, notes, 
                    created_at, updated_at, user_info, equipment_details, attachments,
                    user:users!bookings_user_id_fkey(
                        id, full_name, identity_number, phone_number, email, study_program_id,
                        study_program:study_programs(id, name)
                    ),
                    room:rooms!bookings_room_id_fkey(
                        id, name, code, capacity, study_program_ids, department_id,
                        department:departments(name)
                    )
                `)
                .order('created_at', { ascending: false });

            // Filter bookings based on user role
            if (profile?.role === 'department_admin' && profile.department_id) {
                query = query.eq('room.department_id', profile.department_id);
            }
            // For laboratory, we fetch all and filter in client because of complex logic

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;

            if (error) throw error;

            let filteredData = data || [];

            // Laboratory filtering logic:
            // - Department MUST be same as laboran's department
            // - Study program can be NULL (show) OR same as laboran's study program (show)
            // - If study program is DIFFERENT from laboran's → don't show
            if (profile?.role === 'laboratory' && profile.department_id) {
                const laborDeptId = profile.department_id;
                const laborStudyProgramId = profile.study_program_id;

                filteredData = filteredData.filter((booking: any) => {
                    const room = booking.room;
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

                console.log(`🔬 Laboran filter: ${filteredData.length} bookings from ${data?.length || 0}`);
            }

            setBookings(filteredData);

        } catch (error: any) {
            console.error('Error fetching bookings:', error);
            toast.error(`Gagal memuat data booking: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [profile, statusFilter]);

    // ===== FETCH ALL EQUIPMENT =====
    // Optimized: Select only needed columns to avoid timeout from large attachments data
    const fetchAllEquipment = async () => {
        try {
            const { data, error } = await supabase
                .from('equipment')
                .select('id, name, code, category, quantity, unit, is_mandatory, is_available, rooms_id, condition')
                .order('name');

            if (error) throw error;

            const equipmentData = data || [];
            setAllEquipment(equipmentData);

            const eqMap: Record<string, Equipment> = {};
            equipmentData.forEach(eq => {
                eqMap[eq.id] = eq;
            });
            setEquipmentMap(eqMap);

        } catch (error: any) {
            console.error('Error fetching equipment:', error);
        }
    };

    // ===== FETCH ROOMS =====
    const fetchRooms = async () => {
        try {
            let query = supabase
                .from('rooms')
                .select(`
                    id, name, code, capacity, department_id, study_program_ids,
                    department:departments(name)
                `)
                .order('name');

            // Filter rooms based on user role
            if (profile?.role === 'department_admin' && profile.department_id) {
                query = query.eq('department_id', profile.department_id);
            }
            // For laboratory, we fetch by department first then filter by study_program in client

            const { data, error } = await query;
            if (error) throw error;

            let filteredData = data || [];

            // Laboratory filtering logic:
            // - Department MUST be same as laboran's department
            // - Study program can be NULL (show) OR same as laboran's study program (show)
            // - If study program is DIFFERENT from laboran's → don't show
            if (profile?.role === 'laboratory' && profile.department_id) {
                const laborDeptId = profile.department_id;
                const laborStudyProgramId = profile.study_program_id;

                filteredData = filteredData.filter((room: any) => {
                    const roomDeptId = (room as any).department_id;
                    const roomProdiIds = (room as any).study_program_ids || [];

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

                console.log(`🔬 Laboran rooms filter: ${filteredData.length} rooms from ${data?.length || 0}`);
            }

            setRooms(filteredData as any);
        } catch (error: any) {
            console.error('Error fetching rooms:', error);
        }
    };

    // ===== FETCH EQUIPMENT BY ROOM =====
    // Optimized: Select only needed columns to avoid timeout from large attachments data
    const fetchEquipmentByRoom = async (roomId: string) => {
        try {
            setLoadingEquipment(true);

            // Select only required columns (exclude attachments which can be very large)
            const equipmentColumns = 'id, name, code, category, quantity, unit, is_mandatory, is_available, rooms_id, condition';

            const { data: mandatoryData, error: mandatoryError } = await supabase
                .from('equipment')
                .select(equipmentColumns)
                .eq('rooms_id', roomId)
                .eq('is_mandatory', true)
                .eq('is_available', true);

            if (mandatoryError) throw mandatoryError;

            const { data: optionalData, error: optionalError } = await supabase
                .from('equipment')
                .select(equipmentColumns)
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
    // Konsep: equipment_requested = array ID equipment yang dipinjam
    //         equipment_quantities = array jumlah yang dipinjam (index sama dengan equipment_requested)
    const initializeEquipmentSelections = async (booking: Booking, newRoomId?: string) => {
        console.log('📦 Initialize Equipment Selections:');
        console.log('  - equipment_requested:', booking.equipment_requested);
        console.log('  - equipment_quantities:', booking.equipment_quantities);
        console.log('  - booking status:', booking.status);

        const targetRoomId = newRoomId || booking.room_id;
        const { mandatory, optional } = await fetchEquipmentByRoom(targetRoomId);

        const selections: EquipmentSelection[] = [];
        const unavailable: string[] = [];

        // Untuk equipment mandatory dari ruangan
        mandatory.forEach(eq => {
            // Cari index equipment ini di booking.equipment_requested
            const originalIndex = booking.equipment_requested?.indexOf(eq.id) ?? -1;

            // Jika equipment ada di booking, ambil jumlah dari equipment_quantities
            // Jika tidak, gunakan stok yang tersedia
            let borrowedQty = 1;
            if (originalIndex !== -1 && originalIndex !== undefined) {
                borrowedQty = booking.equipment_quantities?.[originalIndex] || 1;
            }

            if (!eq.is_available) {
                unavailable.push(eq.name);
                return;
            }

            // max_quantity = stok saat ini + jumlah yang sedang dipinjam (jika sudah borrowed)
            // Karena stok sudah dikurangi saat status borrowed, kita tambahkan kembali untuk edit
            const currentStock = eq.quantity || 0;
            const maxQty = booking.status === 'borrowed' ? currentStock + borrowedQty : currentStock;

            selections.push({
                equipment_id: eq.id,
                equipment_name: eq.name,
                equipment_code: eq.code,
                equipment_unit: eq.unit || 'pcs',
                quantity: borrowedQty,
                is_mandatory: true,
                max_quantity: maxQty > 0 ? maxQty : borrowedQty // Minimal sama dengan yang dipinjam
            });
        });

        // Untuk equipment optional yang ada di booking
        if (!newRoomId || newRoomId === booking.room_id) {
            booking.equipment_requested?.forEach((eqId, index) => {
                // Skip jika sudah ada di selections (mandatory)
                if (selections.some(s => s.equipment_id === eqId)) return;

                const eq = [...mandatory, ...optional].find(e => e.id === eqId);
                if (eq && !eq.is_mandatory) {
                    if (!eq.is_available) {
                        unavailable.push(eq.name);
                        return;
                    }

                    // Ambil jumlah dari equipment_quantities menggunakan index yang sama
                    const borrowedQty = booking.equipment_quantities?.[index] || 1;
                    const currentStock = eq.quantity || 0;
                    const maxQty = booking.status === 'borrowed' ? currentStock + borrowedQty : currentStock;

                    selections.push({
                        equipment_id: eq.id,
                        equipment_name: eq.name,
                        equipment_code: eq.code,
                        equipment_unit: eq.unit || 'pcs',
                        quantity: borrowedQty,
                        is_mandatory: false,
                        max_quantity: maxQty > 0 ? maxQty : borrowedQty
                    });
                }
            });
        }

        setUnavailableEquipment(unavailable);
        setEquipmentSelections(selections);

        return selections;
    };

    // Membangun daftar equipment selection dari booking yang ada
    // Konsep: equipment_requested[i] = ID equipment, equipment_quantities[i] = jumlah yang dipinjam
    const buildOriginalEquipmentSelections = (booking: Booking): EquipmentSelection[] => {
        const selections: EquipmentSelection[] = [];

        booking.equipment_requested?.forEach((eqId, index) => {
            const eq = allEquipment.find(e => e.id === eqId);
            if (eq) {
                // Ambil jumlah yang dipinjam dari equipment_quantities menggunakan index yang sama
                const borrowedQty = booking.equipment_quantities?.[index] || 1;
                const currentStock = eq.quantity || 0;

                // Untuk status borrowed, stok sudah dikurangi, jadi max = stok + yang dipinjam
                const maxQty = booking.status === 'borrowed' ? currentStock + borrowedQty : currentStock;

                selections.push({
                    equipment_id: eq.id,
                    equipment_name: eq.name,
                    equipment_code: eq.code,
                    equipment_unit: eq.unit || 'pcs',
                    quantity: borrowedQty,
                    is_mandatory: eq.is_mandatory,
                    max_quantity: maxQty > 0 ? maxQty : borrowedQty
                });
            }
        });

        return selections;
    };

    const handleRoomChange = async (newRoomId: string) => {
        if (!selectedBooking) return;

        setEditFormData(prev => ({ ...prev, room_id: newRoomId }));
        setEquipmentSearch('');

        await initializeEquipmentSelections(selectedBooking, newRoomId);
    };

    const addOptionalEquipment = (equipment: Equipment) => {
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

    const removeOptionalEquipment = (equipmentId: string) => {
        setEquipmentSelections(prev =>
            prev.filter(s => s.equipment_id !== equipmentId || s.is_mandatory)
        );
    };

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

    const filteredOptionalEquipment = useMemo(() => {
        const searchLower = equipmentSearch.toLowerCase();
        return optionalEquipment.filter(eq =>
            !equipmentSelections.some(s => s.equipment_id === eq.id) &&
            (eq.name.toLowerCase().includes(searchLower) ||
                eq.code?.toLowerCase().includes(searchLower) ||
                eq.category?.toLowerCase().includes(searchLower))
        );
    }, [optionalEquipment, equipmentSelections, equipmentSearch]);

    // ===== OPEN WHATSAPP =====
    const openWhatsApp = (phoneNumber?: string, message?: string) => {
        if (!phoneNumber) {
            toast.error('Nomor telepon tidak tersedia');
            return;
        }

        // Format phone number: remove leading 0 and add +62
        let formattedNumber = phoneNumber.trim();

        // Remove any non-digit characters
        formattedNumber = formattedNumber.replace(/\D/g, '');

        // If starts with 0, replace with 62
        if (formattedNumber.startsWith('0')) {
            formattedNumber = '62' + formattedNumber.substring(1);
        }

        // If doesn't start with 62, add it
        if (!formattedNumber.startsWith('62')) {
            formattedNumber = '62' + formattedNumber;
        }

        // Build WhatsApp URL with optional message
        let whatsappUrl = `https://wa.me/${formattedNumber}`;
        if (message) {
            whatsappUrl += `?text=${encodeURIComponent(message)}`;
        }

        // Open WhatsApp Web
        window.open(whatsappUrl, '_blank');
    };

    // ===== HANDLE STATUS CHANGE =====
    /**
     * ALUR STATUS DI BOOKING MANAGEMENT:
     * - pending → approved (admin menyetujui request)
     * - pending/approved → borrowed (equipment DIKURANGI dari stok)
     * - pending/approved → rejected/cancelled (tidak ada perubahan stok)
     * - borrowed → cancelled (equipment DIKEMBALIKAN ke stok, checkout dihapus)
     * 
     * TIDAK ADA:
     * - borrowed → completed (ini dilakukan di ValidationQueue setelah checkout diverifikasi)
     */
    const handleStatusChange = async (bookingId: string, newStatus: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(bookingId));

            const booking = bookings.find(b => b.id === bookingId);
            if (!booking) throw new Error('Booking tidak ditemukan');

            console.log(`📊 Changing status: ${booking.status} → ${newStatus}`);

            // ===== CASE 1: PENDING/APPROVED → BORROWED (Kurangi stok equipment) =====
            if ((booking.status === 'pending' || booking.status === 'approved') && newStatus === 'borrowed') {
                console.log('🔍 Processing change to borrowed status - deducting equipment...');

                const equipmentChanges = [];

                for (let i = 0; i < (booking.equipment_requested?.length || 0); i++) {
                    const eqId = booking.equipment_requested[i];
                    const qty = booking.equipment_quantities?.[i] || 1;

                    const { data: currentEq, error: fetchError } = await supabase
                        .from('equipment')
                        .select('quantity, name, is_available')
                        .eq('id', eqId)
                        .single();

                    if (fetchError) {
                        throw new Error(`Gagal memeriksa peralatan: ${fetchError.message}`);
                    }

                    if (!currentEq.is_available) {
                        throw new Error(`Peralatan "${currentEq.name}" tidak tersedia.`);
                    }

                    if (currentEq.quantity < qty) {
                        throw new Error(`Stok "${currentEq.name}" tidak cukup. Tersedia: ${currentEq.quantity}, Diminta: ${qty}`);
                    }

                    equipmentChanges.push({
                        equipment_id: eqId,
                        equipment_name: currentEq.name,
                        quantity: qty
                    });
                }

                // Kurangi stok equipment
                if (equipmentChanges.length > 0) {
                    await updateEquipmentQuantities(equipmentChanges, 'borrow');
                }
            }

            // ===== CASE 2: BORROWED → CANCELLED (Kembalikan stok equipment) =====
            if (booking.status === 'borrowed' && (newStatus === 'cancelled' || newStatus === 'rejected')) {
                console.log('🔄 Returning equipment quantities for cancelled booking...');

                const equipmentChanges = [];

                for (let i = 0; i < (booking.equipment_requested?.length || 0); i++) {
                    const eqId = booking.equipment_requested[i];
                    const qty = booking.equipment_quantities?.[i] || 1;

                    const { data: currentEq, error: fetchError } = await supabase
                        .from('equipment')
                        .select('name')
                        .eq('id', eqId)
                        .single();

                    if (fetchError) continue;

                    equipmentChanges.push({
                        equipment_id: eqId,
                        equipment_name: currentEq.name,
                        quantity: qty
                    });
                }

                // Kembalikan stok equipment
                if (equipmentChanges.length > 0) {
                    await updateEquipmentQuantities(equipmentChanges, 'return');
                }

                // Hapus checkout record jika ada
                await supabase
                    .from('checkouts')
                    .delete()
                    .eq('booking_id', bookingId)
                    .eq('type', 'room');
            }

            // Update status booking
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

            // Open WhatsApp after successful status change (approved, borrowed)
            // NOTE: 'rejected' is now handled separately via handleRejectWithReason with rejection reason modal
            if (newStatus === 'approved' || newStatus === 'borrowed') {
                setTimeout(() => {
                    // Build academic message based on status
                    let message = '';
                    const roomName = booking?.room?.name || 'Ruangan';
                    const startDate = booking?.start_time ? format(parseISO(booking.start_time), 'dd/MM/yyyy HH:mm') : '';
                    const endDate = booking?.end_time ? format(parseISO(booking.end_time), 'HH:mm') : '';

                    if (newStatus === 'approved') {
                        message = `Yth. ${booking?.user?.full_name || 'Bapak/Ibu'},\n\n` +
                            `Dengan hormat,\n\n` +
                            `Kami informasikan bahwa permohonan peminjaman ruangan Anda telah kami setujui dengan rincian sebagai berikut:\n\n` +
                            `📍 Ruangan: ${roomName}\n` +
                            `📅 Waktu: ${startDate} - ${endDate}\n` +
                            `📝 Keperluan: ${booking?.purpose || '-'}\n\n` +
                            `Mohon untuk menggunakan ruangan sesuai dengan waktu yang telah ditentukan dan menjaga kebersihan serta fasilitas yang ada.\n\n` +
                            `Terima kasih atas perhatian dan kerja samanya.\n\n` +
                            `Hormat kami,\n` +
                            `Tim Manajemen Fasilitas`;
                    } else if (newStatus === 'borrowed') {
                        message = `Yth. ${booking?.user?.full_name || 'Bapak/Ibu'},\n\n` +
                            `Dengan hormat,\n\n` +
                            `Peminjaman ruangan Anda telah diproses dengan rincian sebagai berikut:\n\n` +
                            `📍 Ruangan: ${roomName}\n` +
                            `📅 Waktu: ${startDate} - ${endDate}\n` +
                            `📝 Keperluan: ${booking?.purpose || '-'}\n\n` +
                            `Ruangan dan peralatan telah disiapkan. Mohon untuk:\n` +
                            `1. Menggunakan ruangan sesuai waktu yang ditentukan\n` +
                            `2. Menjaga kebersihan ruangan\n` +
                            `3. Mengembalikan peralatan dalam kondisi baik\n` +
                            `4. Melaporkan jika ada kerusakan\n\n` +
                            `Terima kasih atas perhatian dan kerja samanya.\n\n` +
                            `Hormat kami,\n` +
                            `Tim Manajemen Fasilitas`;
                    }

                    openWhatsApp(booking?.user?.phone_number, message);
                }, 500); // Small delay to ensure toast is visible first
            }


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

    // ===== HANDLE UPDATE BOOKING =====
    // ===== HANDLE UPDATE BOOKING - VERSI FINAL YANG BENAR =====
    const handleUpdateBooking = async () => {
        if (!selectedBooking) return;

        try {
            setProcessingIds(prev => new Set(prev).add(selectedBooking.id));

            const originalStatus = selectedBooking.status;
            const roomChanged = editFormData.room_id !== originalRoomId;

            console.log('🔄 Updating booking...', {
                bookingId: selectedBooking.id,
                originalStatus,
                roomChanged,
                oldRoomId: originalRoomId,
                newRoomId: editFormData.room_id
            });
            // Variabel untuk menyimpan equipment yang akan di-save ke booking
            // Menggunakan let agar bisa di-reassign jika room changed
            let finalEquipmentRequested = equipmentSelections.map(s => s.equipment_id);
            let finalEquipmentQuantities = equipmentSelections.map(s => s.quantity);

            // ===== HANDLE STATUS BORROWED =====
            if (roomChanged && originalStatus === 'borrowed') {
                console.log('🔄 Room transfer detected for borrowed booking');

                // STEP 1: Pisahkan mandatory vs optional
                const mandatoryEquipmentOld = originalEquipmentSelections.filter(e => e.is_mandatory);
                const optionalEquipmentOld = originalEquipmentSelections.filter(e => !e.is_mandatory);

                const mandatoryEquipmentNew = equipmentSelections.filter(e => e.is_mandatory);
                const optionalEquipmentNew = equipmentSelections.filter(e => !e.is_mandatory);

                console.log('📦 Equipment breakdown:', {
                    mandatoryOld: mandatoryEquipmentOld.length,
                    optionalOld: optionalEquipmentOld.length,
                    mandatoryNew: mandatoryEquipmentNew.length,
                    optionalNew: optionalEquipmentNew.length
                });

                // STEP 2: Buat checkout untuk perpindahan ruangan + MANDATORY equipment LAMA SAJA
                if (mandatoryEquipmentOld.length > 0) {
                    console.log('🏢 Creating room transfer checkout...');

                    const checkoutData = {
                        user_id: selectedBooking.user_id,
                        booking_id: selectedBooking.id,
                        room_id: originalRoomId, // ⭐ RUANGAN LAMA disimpan di checkout
                        checkout_date: new Date().toISOString(),
                        expected_return_date: selectedBooking.end_time,
                        status: 'returned',
                        type: 'room',
                        is_room_transfer: true, // ⭐ TANDAI sebagai perpindahan ruangan
                        total_items: mandatoryEquipmentOld.length,
                        checkout_notes: `AUTO-CHECKOUT: Perpindahan ruangan dari room_id ${originalRoomId} ke ${editFormData.room_id}. Equipment mandatory dari ruangan lama.`,
                        created_at: new Date().toISOString()
                    };

                    const { data: checkoutResult, error: checkoutError } = await supabase
                        .from('checkouts')
                        .insert(checkoutData)
                        .select()
                        .single();

                    if (checkoutError) throw checkoutError;

                    console.log('✅ Checkout created:', checkoutResult.id);

                    // Insert checkout_items - HANYA equipment MANDATORY LAMA
                    // Equipment ini akan divalidasi di Validation Queue untuk dikembalikan stocknya
                    const checkoutItems = mandatoryEquipmentOld.map(eq => ({
                        checkout_id: checkoutResult.id,
                        equipment_id: eq.equipment_id,
                        quantity: eq.quantity,
                        condition_notes: `Equipment mandatory dari ruangan lama (${originalRoomId})`
                    }));

                    const { error: itemsError } = await supabase
                        .from('checkout_items')
                        .insert(checkoutItems);

                    if (itemsError) throw itemsError;

                    console.log(`✅ ${checkoutItems.length} mandatory items added to checkout_items`);
                }

                // STEP 3: Kurangi stock MANDATORY BARU (dari ruang baru)
                // Equipment mandatory baru langsung dikurangi stocknya
                if (mandatoryEquipmentNew.length > 0) {
                    console.log('📦 Processing new mandatory equipment...');

                    for (const eq of mandatoryEquipmentNew) {
                        // Cek apakah ini equipment baru atau sudah ada di lama
                        const existsInOld = mandatoryEquipmentOld.some(e => e.equipment_id === eq.equipment_id);

                        if (!existsInOld) {
                            // Equipment baru dari ruang baru, kurangi stock
                            const { data: currentEq } = await supabase
                                .from('equipment')
                                .select('quantity, name')
                                .eq('id', eq.equipment_id)
                                .single();

                            if (!currentEq) {
                                throw new Error(`Equipment tidak ditemukan: ${eq.equipment_name}`);
                            }

                            if (currentEq.quantity < eq.quantity) {
                                throw new Error(`Stock "${currentEq.name}" tidak cukup. Tersedia: ${currentEq.quantity}, Dibutuhkan: ${eq.quantity}`);
                            }

                            await updateEquipmentQuantities([{
                                equipment_id: eq.equipment_id,
                                equipment_name: eq.equipment_name,
                                quantity: eq.quantity
                            }], 'borrow');

                            console.log(`✅ Borrowed new equipment: ${eq.equipment_name} (${eq.quantity})`);
                        }
                    }
                }

                // STEP 4: Handle OPTIONAL equipment changes
                // Optional equipment TETAP di equipment_requested (tidak masuk checkout_items)
                const optionalChanges = getEquipmentChanges(optionalEquipmentOld, optionalEquipmentNew);

                // Return optional yang dikurangi
                const optionalReturn = optionalChanges.filter(c => c.difference < 0);
                if (optionalReturn.length > 0) {
                    await updateEquipmentQuantities(
                        optionalReturn.map(c => ({
                            equipment_id: c.equipment_id,
                            equipment_name: c.equipment_name,
                            quantity: Math.abs(c.difference)
                        })),
                        'return'
                    );
                    console.log(`✅ Returned ${optionalReturn.length} optional equipment`);
                }

                // Borrow optional yang ditambah
                const optionalBorrow = optionalChanges.filter(c => c.difference > 0);
                if (optionalBorrow.length > 0) {
                    await updateEquipmentQuantities(
                        optionalBorrow.map(c => ({
                            equipment_id: c.equipment_id,
                            equipment_name: c.equipment_name,
                            quantity: c.difference
                        })),
                        'borrow'
                    );
                    console.log(`✅ Borrowed ${optionalBorrow.length} additional optional equipment`);
                }

                // STEP 5: Update finalEquipmentRequested
                // ⭐ HANYA optional equipment yang masuk ke bookings.equipment_requested
                // ⭐ Mandatory TIDAK masuk karena sudah masuk checkout_items
                finalEquipmentRequested = optionalEquipmentNew.map(e => e.equipment_id);
                finalEquipmentQuantities = optionalEquipmentNew.map(e => e.quantity);

                console.log('📝 Final equipment for bookings table (optional only):', {
                    count: finalEquipmentRequested.length,
                    items: optionalEquipmentNew.map(e => e.equipment_name)
                });
            }
            // ===== STATUS APPROVED + ROOM CHANGE =====
            // TIDAK perlu buat checkout karena approved belum mengurangi stok
            else if (originalStatus === 'approved' && roomChanged) {
                console.log('ℹ️ Room changed while approved - no checkout needed (equipment not deducted yet)');
            }

            // ===== FINAL STEP: UPDATE BOOKING (ROOM_ID + EQUIPMENT) =====
            // ⭐ PENTING: Status booking TIDAK berubah, tetap borrowed
            const updateData: any = {
                room_id: editFormData.room_id, // ⭐ Update ke room_id BARU
                purpose: editFormData.purpose,
                start_time: parseInputToISO(editFormData.start_time),
                end_time: parseInputToISO(editFormData.end_time),
                notes: editFormData.notes,
                equipment_requested: finalEquipmentRequested, // ⭐ Update equipment
                equipment_quantities: finalEquipmentQuantities, // ⭐ Update quantities
                updated_at: new Date().toISOString()
                // ⭐ TIDAK UPDATE STATUS - tetap borrowed
            };

            const { error: updateError } = await supabase
                .from('bookings')
                .update(updateData)
                .eq('id', selectedBooking.id);

            if (updateError) throw updateError;

            console.log('✅ Booking updated successfully');
            console.log('✅ New room_id:', editFormData.room_id);
            console.log('✅ Status remains:', originalStatus);

            const successMessage = roomChanged && originalStatus === 'borrowed'
                ? 'Booking berhasil diperbarui! Checkout otomatis dibuat untuk validasi equipment lama di Validation Queue.'
                : 'Booking berhasil diperbarui!';

            toast.success(successMessage);

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

    // ===== HANDLE DELETE BOOKING =====
    const handleDeleteBooking = async () => {
        if (!selectedBooking) return;

        try {
            setProcessingIds(prev => new Set(prev).add(selectedBooking.id));

            // Jika status borrowed, kembalikan equipment ke stok
            if (selectedBooking.status === 'borrowed') {
                console.log('🔄 Returning equipment quantities before deletion...');

                const equipmentChanges = [];

                for (let i = 0; i < (selectedBooking.equipment_requested?.length || 0); i++) {
                    const eqId = selectedBooking.equipment_requested[i];
                    const qty = selectedBooking.equipment_quantities?.[i] || 1;

                    const { data: currentEq, error: fetchError } = await supabase
                        .from('equipment')
                        .select('name')
                        .eq('id', eqId)
                        .single();

                    if (fetchError) continue;

                    equipmentChanges.push({
                        equipment_id: eqId,
                        equipment_name: currentEq.name,
                        quantity: qty
                    });
                }

                if (equipmentChanges.length > 0) {
                    await updateEquipmentQuantities(equipmentChanges, 'return');
                }

                // Hapus checkout record
                await supabase
                    .from('checkouts')
                    .delete()
                    .eq('booking_id', selectedBooking.id)
                    .eq('type', 'room');
            }

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

    const openEditModal = async (booking: Booking) => {
        setSelectedBooking(booking);
        setOriginalRoomId(booking.room_id);

        setEditFormData({
            room_id: booking.room_id,
            purpose: booking.purpose,
            start_time: formatDateTimeForInput(booking.start_time),
            end_time: formatDateTimeForInput(booking.end_time),
            notes: booking.notes || ''
        });

        await fetchRooms();
        await fetchAllEquipment();

        const origSelections = buildOriginalEquipmentSelections(booking);
        setOriginalEquipmentSelections(origSelections);

        await initializeEquipmentSelections(booking);

        setShowEditModal(true);
    };

    const openDeleteModal = (booking: Booking) => {
        setSelectedBooking(booking);
        setShowDeleteModal(true);
    };

    const openRejectModal = (booking: Booking) => {
        setBookingToReject(booking);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const handleRejectWithReason = async () => {
        if (!bookingToReject) return;

        if (!rejectReason.trim()) {
            toast.error('Mohon masukkan alasan penolakan');
            return;
        }

        setShowRejectModal(false);

        try {
            setProcessingIds(prev => new Set(prev).add(bookingToReject.id));

            // Update status to rejected
            const { error: statusError } = await supabase
                .from('bookings')
                .update({
                    status: 'rejected',
                    notes: (bookingToReject.notes || '') + `\n\n[REJECT REASON]: ${rejectReason}`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', bookingToReject.id);

            if (statusError) throw statusError;

            toast.success('Booking berhasil ditolak');
            await fetchBookings();

            // Send WhatsApp with custom rejection reason
            setTimeout(() => {
                const roomName = bookingToReject?.room?.name || 'Ruangan';
                const startDate = bookingToReject?.start_time ? format(parseISO(bookingToReject.start_time), 'dd/MM/yyyy HH:mm') : '';
                const endDate = bookingToReject?.end_time ? format(parseISO(bookingToReject.end_time), 'HH:mm') : '';

                const message = `Yth. ${bookingToReject?.user?.full_name || 'Bapak/Ibu'},\n\n` +
                    `Dengan hormat,\n\n` +
                    `Kami informasikan bahwa permohonan peminjaman ruangan Anda tidak dapat kami setujui dengan rincian sebagai berikut:\n\n` +
                    `📍 Ruangan: ${roomName}\n` +
                    `📅 Waktu: ${startDate} - ${endDate}\n` +
                    `📝 Keperluan: ${bookingToReject?.purpose || '-'}\n\n` +
                    `Alasan penolakan:\n${rejectReason}\n\n` +
                    `Kami mohon maaf atas ketidaknyamanan ini. Jika ada pertanyaan lebih lanjut, silakan hubungi kami.\n\n` +
                    `Hormat kami,\n` +
                    `Tim Manajemen Fasilitas`;

                openWhatsApp(bookingToReject?.user?.phone_number, message);
            }, 500);

        } catch (error: any) {
            console.error('❌ Error rejecting booking:', error);
            toast.error(`Gagal menolak booking: ${error.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(bookingToReject?.id || '');
                return newSet;
            });
            setBookingToReject(null);
            setRejectReason('');
        }
    };


    // ===== EFFECTS =====
    useEffect(() => {
        if (profile) {
            fetchBookings();
            fetchAllEquipment();
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
            returned: { color: 'bg-orange-100 text-orange-800', icon: '🔄', label: 'Menunggu Validasi' },
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

    const getEquipmentById = (equipmentId: string) => {
        return equipmentMap[equipmentId] || allEquipment.find(eq => eq.id === equipmentId);
    };

    // ===== RENDER ACTIONS BASED ON STATUS =====
    /**
     * AKSI YANG TERSEDIA:
     * - pending: View, Edit, Approve, Borrowed, Reject, Delete
     * - approved: View, Edit, Borrowed, Cancel
     * - borrowed: View, Edit, Cancel (TIDAK ADA COMPLETE - dilakukan di ValidationQueue)
     * - returned: View only (menunggu validasi di ValidationQueue)
     * - completed: View, Delete
     * - cancelled/rejected: View only
     */
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
                            title="Edit"
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
                            title="Langsung Pinjam (Kurangi Stok)"
                        >
                            <Package className="h-4 w-4" />
                        </button>

                        <button
                            onClick={() => openRejectModal(booking)}
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
                            title="Hapus"
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
                            title="Edit"
                        >
                            <Edit className="h-4 w-4" />
                        </button>

                        <button
                            onClick={() => handleStatusChange(booking.id, 'borrowed')}
                            disabled={isProcessing}
                            className="p-2 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-lg disabled:opacity-50"
                            title="Pinjam (Kurangi Stok)"
                        >
                            <Package className="h-4 w-4" />
                        </button>

                        <button
                            onClick={() => handleStatusChange(booking.id, 'cancelled')}
                            disabled={isProcessing}
                            className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg disabled:opacity-50"
                            title="Cancel"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    </div>
                );

            case 'borrowed':
                // TIDAK ADA TOMBOL COMPLETE di sini
                // Complete hanya dilakukan di ValidationQueue setelah user checkout
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
                            title="Edit"
                        >
                            <Edit className="h-4 w-4" />
                        </button>

                        <button
                            onClick={() => handleStatusChange(booking.id, 'cancelled')}
                            disabled={isProcessing}
                            className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg disabled:opacity-50"
                            title="Cancel (Kembalikan Stok)"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>

                        {/* Info tooltip */}
                        <div className="relative group">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg cursor-help">
                                <Info className="h-4 w-4" />
                            </div>
                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                Untuk menyelesaikan peminjaman, user harus melakukan checkout terlebih dahulu, kemudian admin memvalidasi di Validation Queue.
                            </div>
                        </div>
                    </div>
                );

            case 'returned':
                // Status returned = menunggu validasi di ValidationQueue
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

                        <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                            Menunggu Validasi
                        </span>
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
                            title="Hapus"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                );

            case 'cancelled':
            case 'rejected':
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
                            title="Hapus"
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
    if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin' && profile?.role !== 'laboratory') {
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
                            <option value="returned">Menunggu Validasi</option>
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
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="font-medium text-gray-700 mb-2">Informasi Pemohon</h4>
                                        <p className="font-semibold">{selectedBooking.user?.full_name}</p>
                                        <p className="text-sm text-gray-600">{selectedBooking.user?.identity_number}</p>
                                        <p className="text-sm text-gray-600">{selectedBooking.user?.phone_number}</p>
                                        {selectedBooking.user?.study_program?.name && (
                                            <p className="text-sm text-gray-600 mt-1">
                                                <span className="font-medium">Prodi:</span> {selectedBooking.user.study_program.name}
                                            </p>
                                        )}
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

                                {selectedBooking.equipment_requested && selectedBooking.equipment_requested.length > 0 && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h4 className="font-medium text-gray-700 mb-3">Peralatan Dipinjam</h4>
                                        <div className="space-y-2">
                                            {selectedBooking.equipment_requested.map((eqId, index) => {
                                                const equipment = getEquipmentById(eqId);
                                                const quantity = selectedBooking.equipment_quantities?.[index] || 1;

                                                return (
                                                    <div key={eqId} className="flex items-center justify-between bg-white p-3 rounded-lg">
                                                        <div className="flex items-center space-x-3">
                                                            <Package className="h-4 w-4 text-gray-400" />
                                                            <span>
                                                                {equipment?.name || eqId}
                                                                {equipment?.code && (
                                                                    <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded font-mono">
                                                                        {equipment.code}
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {equipment?.is_mandatory && (
                                                                <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                                                    Wajib
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="font-medium">
                                                            {quantity} {equipment?.unit || 'pcs'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ===== PERMIT DOCUMENTS SECTION ===== */}
                                {selectedBooking.attachments && selectedBooking.attachments.length > 0 && (
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                                        <div className="flex items-center space-x-2 mb-4">
                                            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                                <FileText className="h-4 w-4 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-blue-900">Dokumen Izin</h4>
                                                <p className="text-xs text-blue-700">{selectedBooking.attachments.length} dokumen terlampir</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {selectedBooking.attachments.map((attachment, index) => {
                                                const isPDF = attachment.startsWith('data:application/pdf') || attachment.toLowerCase().includes('.pdf');

                                                return (
                                                    <div key={index} className="relative group">
                                                        <div
                                                            onClick={() => window.open(attachment, '_blank')}
                                                            className="cursor-pointer bg-white rounded-lg border border-blue-200 p-3 hover:shadow-md transition-all duration-200 hover:scale-105"
                                                        >
                                                            {isPDF ? (
                                                                <div className="flex flex-col items-center">
                                                                    <div className="h-16 w-16 bg-red-100 rounded-lg flex items-center justify-center mb-2">
                                                                        <FileText className="h-8 w-8 text-red-600" />
                                                                    </div>
                                                                    <span className="text-xs text-center text-gray-700 font-medium">
                                                                        PDF Document
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className="relative">
                                                                    <div className="relative w-full h-16 mb-2">
                                                                        <ImageWithLoader
                                                                            src={attachment}
                                                                            alt={`Permit Document ${index + 1}`}
                                                                            className="w-full h-16 object-cover rounded-lg"
                                                                            isSmall={true}
                                                                        />
                                                                    </div>
                                                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center">
                                                                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                                                    </div>
                                                                    <span className="text-xs text-center text-gray-700 font-medium block">
                                                                        Image File
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const modal = document.createElement('div');
                                                                modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
                                                                modal.onclick = () => document.body.removeChild(modal);

                                                                if (isPDF) {
                                                                    modal.innerHTML = `
                                                                        <div class="bg-white rounded-lg p-4 max-w-4xl w-full h-full max-h-[90vh] overflow-auto">
                                                                            <div class="flex justify-between items-center mb-4">
                                                                                <h3 class="text-lg font-semibold">PDF Document</h3>
                                                                                <button onclick="document.body.removeChild(this.closest('.fixed'))" class="text-gray-500 hover:text-gray-700">
                                                                                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>
                                                                            <iframe src="${attachment}" class="w-full h-full" frameborder="0"></iframe>
                                                                        </div>
                                                                    `;
                                                                } else {
                                                                    modal.innerHTML = `
                                                                        <div class="relative max-w-4xl max-h-[90vh]">
                                                                            <img src="${attachment}" alt="Document" class="max-w-full max-h-full object-contain rounded-lg" />
                                                                            <button onclick="document.body.removeChild(this.closest('.fixed'))" class="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75">
                                                                                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                                                </svg>
                                                                            </button>
                                                                        </div>
                                                                    `;
                                                                }

                                                                document.body.appendChild(modal);
                                                            }}
                                                            className="absolute top-1 right-1 bg-blue-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-blue-700"
                                                            title="Quick View"
                                                        >
                                                            <Eye className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-blue-200">
                                            <button
                                                onClick={() => {
                                                    selectedBooking.attachments?.forEach((attachment, index) => {
                                                        const link = document.createElement('a');
                                                        link.href = attachment;
                                                        link.download = `permit_document_${index + 1}${attachment.startsWith('data:application/pdf') ? '.pdf' : '.jpg'}`;
                                                        link.click();
                                                    });
                                                    toast.success('Dokumen berhasil diunduh');
                                                }}
                                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                            >
                                                <Download className="h-4 w-4" />
                                                <span>Unduh Semua Dokumen</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

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
                                {selectedBooking.status === 'borrowed' && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                        <div className="flex items-start">
                                            <AlertTriangle className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-amber-800">Status Borrowed</p>
                                                <p className="text-sm text-amber-700">
                                                    Perubahan equipment akan langsung mempengaruhi stok.
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
                                    <RoomSearchDropdown
                                        rooms={rooms}
                                        selectedRoomId={editFormData.room_id}
                                        onRoomSelect={handleRoomChange}
                                        isLoading={loading}
                                    />
                                </div>

                                {/* Time */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Waktu Mulai *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={editFormData.start_time}
                                            onChange={(e) => setEditFormData(prev => ({
                                                ...prev,
                                                start_time: e.target.value
                                            }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Waktu Selesai *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={editFormData.end_time}
                                            onChange={(e) => setEditFormData(prev => ({
                                                ...prev,
                                                end_time: e.target.value
                                            }))}
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
                                            {/* Equipment lists... (same as before) */}
                                            <div className="space-y-2">
                                                {equipmentSelections.map((selection) => (
                                                    <div
                                                        key={selection.equipment_id}
                                                        className={`flex items-center justify-between p-3 rounded-lg ${selection.is_mandatory
                                                            ? 'bg-red-50 border border-red-200'
                                                            : 'bg-blue-50 border border-blue-200'
                                                            }`}
                                                    >
                                                        <div>
                                                            <p className="font-medium text-gray-900">
                                                                {selection.equipment_name}
                                                                {selection.equipment_code && (
                                                                    <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded font-mono">
                                                                        {selection.equipment_code}
                                                                    </span>
                                                                )}
                                                                {selection.is_mandatory && (
                                                                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                                                        Wajib
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                Max: {selection.max_quantity} {selection.equipment_unit}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateEquipmentQuantity(selection.equipment_id, selection.quantity - 1)}
                                                                disabled={selection.quantity <= 1}
                                                                className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded disabled:opacity-50"
                                                            >
                                                                <Minus className="h-4 w-4" />
                                                            </button>
                                                            <span className="w-12 text-center font-bold">{selection.quantity}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateEquipmentQuantity(selection.equipment_id, selection.quantity + 1)}
                                                                disabled={selection.quantity >= selection.max_quantity}
                                                                className="p-1 bg-green-100 hover:bg-green-200 text-green-600 rounded disabled:opacity-50"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </button>
                                                            {!selection.is_mandatory && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeOptionalEquipment(selection.equipment_id)}
                                                                    className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded ml-2"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Add Optional Equipment */}
                                            <div>
                                                <h4 className="font-medium text-gray-700 mb-3">Tambah Peralatan Opsional</h4>
                                                <div className="relative mb-3">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Cari peralatan..."
                                                        value={equipmentSearch}
                                                        onChange={(e) => setEquipmentSearch(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                                    {filteredOptionalEquipment.map((eq) => (
                                                        <button
                                                            key={eq.id}
                                                            type="button"
                                                            onClick={() => addOptionalEquipment(eq)}
                                                            className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left"
                                                        >
                                                            <div>
                                                                <p className="font-medium text-gray-900 text-sm">
                                                                    {eq.name}
                                                                    {eq.code && (
                                                                        <span className="ml-1 text-xs text-gray-500 font-mono">({eq.code})</span>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-gray-500">Stok: {eq.quantity}</p>
                                                            </div>
                                                            <Plus className="h-4 w-4 text-green-600" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

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
                                <span>Simpan</span>
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

            {/* ===== REJECT MODAL ===== */}
            {showRejectModal && bookingToReject && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
                        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">Tolak Peminjaman</h2>
                                    <p className="mt-1 opacity-90">
                                        {bookingToReject.room?.name} - {bookingToReject.user?.full_name}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false);
                                        setBookingToReject(null);
                                        setRejectReason('');
                                    }}
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Alasan Penolakan <span className="text-red-600">*</span>
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Contoh: Ruangan sedang dalam perbaikan / Waktu yang diminta bersamaan dengan kegiatan lain / dll."
                                    rows={6}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    Alasan ini akan dikirimkan ke user melalui WhatsApp dengan bahasa yang formal dan akademik.
                                </p>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <div className="flex items-start space-x-3">
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-yellow-800">
                                        <p className="font-medium mb-1">Pesan yang akan dikirim:</p>
                                        <p className="text-xs">
                                            WhatsApp akan otomatis terbuka dengan pesan penolakan yang berisi rincian booking dan alasan yang Anda masukkan di atas, menggunakan bahasa akademik yang formal.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false);
                                        setBookingToReject(null);
                                        setRejectReason('');
                                    }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleRejectWithReason}
                                    disabled={!rejectReason.trim()}
                                    className="flex items-center space-x-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <X className="h-4 w-4" />
                                    <span>Tolak & Kirim WhatsApp</span>
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