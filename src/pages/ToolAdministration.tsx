import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Wrench, Plus, Search, Edit, Trash2, Eye, Package, AlertCircle, RefreshCw, X, Loader2,
    Camera, Cpu, Wifi, Zap, FlaskConical, Armchair, Shield,
    MapPin, Hash, Layers, CheckCircle, XCircle, Star, AlertTriangle, Building,
    User, Phone, CreditCard, Clock, Calendar, Users, Activity, TrendingUp,
    ChevronDown, ChevronUp, Warehouse, ArrowRight, History, BoxIcon,
    PackagePlus, PackageMinus, ArchiveRestore, ClipboardList, Filter,
    Download, Upload, BarChart3, Home, Store, Grid, List, Check, ChevronRight, Image,
    ChevronLeft, UploadCloud, DownloadCloud, Tag, BarChart, Bell,
    FileText, Database, ShieldAlert, Battery, HardDrive, Monitor,
    Smartphone, Headphones, Printer, Router, Server, Keyboard, Mouse,
    ExternalLink, Info, AlertOctagon, CalendarDays, UserCheck,
    UserX, RotateCcw, QrCode, BatteryCharging, Power, Globe,
    BookOpen, FileCheck, ShieldCheck, Map, Navigation, Target,
    DatabaseBackup, ShieldOff, BatteryFull, BatteryLow, FolderOpen,
    Package2, Boxes, Archive, Folder, Files, LayoutGrid, Table, Maximize2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Equipment, Room, Department, User as UserType, Tabel, Rack, Box } from '../types';
import toast from 'react-hot-toast';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

// ==================== TYPES ====================
interface Stock {
    id: string;
    nama: string;
    code: string;
    category: string;
    spesification?: string;
    quantity: number;
    unit: string;
    attachments?: string; // Base64 photo string
    created_at?: string;
}

interface EquipmentWithDetails extends Equipment {
    rooms?: Room & { department: Department };
    stock?: Stock;
}

interface LendingDetail {
    id: string;
    date: string;
    borrowed_quantity: number;
    returned_quantity: number;
    missing_quantity: number;
    status: 'active' | 'returned' | 'overdue' | 'approved' | 'borrow' | 'pending' | 'cancelled';
    created_at: string;
    user?: UserType;
    checkout?: {
        id: string;
        checkout_date: string;
        expected_return_date: string;
        actual_return_date?: string;
        status: string;
    };
    source?: 'lending_tool' | 'booking';
    user_name?: string;
    user_email?: string;
    user_identity?: string;
}

interface StockTrackRecord {
    equipment_id: string;
    equipment_name: string;
    equipment_code: string;
    room_name?: string;
    room_code?: string;
    department_name?: string;
    quantity_claimed: number;
    claimed_at: string;
    condition: string;
}

// ==================== HELPER COMPONENTS ====================
const PhotoPlaceholder = ({ title, subtitle }: { title?: string, subtitle?: string }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-cyan-50 text-center p-4 z-10">
        <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mb-3 animate-pulse">
            <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
        </div>
        {title && <h3 className="font-bold text-lg text-gray-800 animate-pulse">{title}</h3>}
        {subtitle && <p className="text-sm text-gray-500 mb-2 animate-pulse">{subtitle}</p>}
        <p className="text-xs text-cyan-600 font-medium animate-pulse">Memuat foto...</p>
    </div>
);

const ImageWithLoader = ({ src, alt, className, title, subtitle }: { src: string, alt: string, className?: string, title?: string, subtitle?: string }) => {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <>
            {isLoading && <PhotoPlaceholder title={title} subtitle={subtitle} />}
            <img
                src={src}
                alt={alt}
                className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                onLoad={() => setIsLoading(false)}
            />
        </>
    );
};

interface DropdownSearchProps {
    items: Array<{ id: string; name?: string; nama?: string; code?: string;[key: string]: any }>;
    selectedItem: { id: string; name?: string; nama?: string;[key: string]: any } | null;
    onSelect: (item: any) => void;
    placeholder: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    className?: string;
    renderItem?: (item: any) => React.ReactNode;
    showCode?: boolean;
}

const DropdownSearch: React.FC<DropdownSearchProps> = ({
    items,
    selectedItem,
    onSelect,
    placeholder,
    searchPlaceholder = 'Search...',
    disabled = false,
    className = '',
    renderItem,
    showCode = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const filteredItems = items.filter(item => {
        const itemName = item?.name || item?.nama || item?.description || '';
        const itemCode = item?.code || '';
        const search = searchTerm.toLowerCase();

        return itemName.toLowerCase().includes(search) ||
            itemCode.toLowerCase().includes(search);
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const defaultRenderItem = (item: any) => {
        const displayName = item?.name || item?.nama || 'Unknown';
        const displayCode = item?.code || '';

        return (
            <div className="flex items-center justify-between p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-all">
                <div className="flex-1">
                    <div className="font-medium text-gray-900">{displayName}</div>
                    {showCode && displayCode && (
                        <div className="text-xs text-gray-500 font-mono mt-1">{displayCode}</div>
                    )}
                </div>
                {selectedItem?.id === item.id && (
                    <Check className="h-5 w-5 text-blue-600" />
                )}
            </div>
        );
    };

    const selectedDisplayName = selectedItem?.name || selectedItem?.nama || selectedItem?.description || '';
    const selectedDisplayCode = selectedItem?.code || '';

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-3 text-left bg-white border-2 rounded-xl shadow-sm flex items-center justify-between transition-all ${disabled
                    ? 'bg-gray-100 text-gray-400 border-gray-200'
                    : 'border-gray-300 hover:border-blue-500 focus:border-blue-500'
                    }`}
            >
                <div className="flex items-center space-x-3">
                    {selectedItem ? (
                        <>
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Tag className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <div className="font-medium text-gray-900">{selectedDisplayName}</div>
                                {showCode && selectedDisplayCode && (
                                    <div className="text-xs text-gray-500 font-mono">{selectedDisplayCode}</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <span className="text-gray-500">{placeholder}</span>
                        </>
                    )}
                </div>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-[500px] overflow-auto">
                    <div className="p-3 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="py-2">
                        {filteredItems.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                <AlertCircle className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm">No items found</p>
                            </div>
                        ) : (
                            filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        onSelect(item);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                >
                                    {renderItem ? renderItem(item) : defaultRenderItem(item)}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ==================== SCHEMAS ====================
const stockSchema = z.object({
    nama: z.string().min(2, 'Stock name must be at least 2 characters'),
    code: z.string().min(2, 'Stock code must be at least 2 characters'),
    category: z.string().min(1, 'Please select a category'),
    spesification: z.string().optional(),
    quantity: z.number().min(0, 'Quantity cannot be negative'),
    unit: z.string().min(1, 'Unit is required (e.g., pcs, set)'),
});

type StockForm = z.infer<typeof stockSchema>;

const createEquipmentClaimSchema = (maxQuantity: number, userRole: string) => {
    const baseSchema = {
        stock_id: z.string().min(1, 'Please select a stock item'),
        name: z.string().min(2, 'Equipment name must be at least 2 characters'),
        code: z.string().min(2, 'Equipment code must be at least 2 characters'),
        quantity: z.number().min(1, 'Minimum quantity is 1').max(maxQuantity, `Maximum available: ${maxQuantity}`),
        is_mandatory: z.boolean().optional(),
        is_available: z.boolean().optional(),
        condition: z.enum(['GOOD', 'BROKEN', 'MAINTENANCE']).default('GOOD'),
        Spesification: z.string().optional(),
        table_id: z.string().optional(),
        rack_id: z.string().optional(),
        box_id: z.string().optional(),
        rooms_id: z.string().min(1, 'Please select a room location'),
    };

    return z.object(baseSchema);
};

const createEquipmentEditSchema = (userRole: string) => {
    const baseSchema = {
        name: z.string().min(2, 'Equipment name must be at least 2 characters'),
        code: z.string().min(2, 'Equipment code must be at least 2 characters'),
        category: z.string().min(1, 'Please select a category'),
        is_mandatory: z.boolean().optional(),
        is_available: z.boolean().optional(),
        condition: z.enum(['GOOD', 'BROKEN', 'MAINTENANCE']).default('GOOD'),
        Spesification: z.string().optional(),
        quantity: z.number().min(0, 'Quantity cannot be negative'),
        unit: z.string().min(1, 'Unit is required'),
        table_id: z.string().optional(),
        rack_id: z.string().optional(),
        box_id: z.string().optional(),
        rooms_id: z.string().min(1, 'Please select a room location'),
    };

    return z.object(baseSchema);
};

type EquipmentClaimForm = z.infer<ReturnType<typeof createEquipmentClaimSchema>>;
type EquipmentEditForm = z.infer<ReturnType<typeof createEquipmentEditSchema>>;

// ==================== MAIN COMPONENT ====================
const ToolAdministration: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();

    // Tab state
    // Laboratory should default to equipment tab (no access to stock)
    const [activeTab, setActiveTab] = useState<'stock' | 'equipment'>(
        profile?.role === 'laboratory' ? 'equipment' : 'stock'
    );

    // Stock states
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [loadingStocks, setLoadingStocks] = useState(true);
    const [stockSearchTerm, setStockSearchTerm] = useState('');
    const [stockCategoryFilter, setStockCategoryFilter] = useState<string>('all');

    // Equipment states
    const [equipment, setEquipment] = useState<EquipmentWithDetails[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<Tabel[]>([]);
    const [racks, setRacks] = useState<Rack[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [loadingEquipment, setLoadingEquipment] = useState(true);
    const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
    const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState<string>('all');
    const [roomFilter, setRoomFilter] = useState<string>('all');

    // Modal states
    const [showStockModal, setShowStockModal] = useState(false);
    const [showStockDetailModal, setShowStockDetailModal] = useState(false);
    const [showStockTrackModal, setShowStockTrackModal] = useState(false);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showTrackRecordModal, setShowTrackRecordModal] = useState(false);
    const [showDirectAddModal, setShowDirectAddModal] = useState(false);

    // Selected items
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithDetails | null>(null);
    const [editingStock, setEditingStock] = useState<Stock | null>(null);
    const [editingEquipment, setEditingEquipment] = useState<EquipmentWithDetails | null>(null);

    // Track record states
    const [lendingDetails, setLendingDetails] = useState<LendingDetail[]>([]);
    const [loadingTrack, setLoadingTrack] = useState(false);

    // Stock track record states
    const [stockTrackRecords, setStockTrackRecords] = useState<StockTrackRecord[]>([]);
    const [loadingStockTrack, setLoadingStockTrack] = useState(false);

    // Stock image states
    const [stockImagePreview, setStockImagePreview] = useState<string>('');
    const [showStockImageFullscreen, setShowStockImageFullscreen] = useState(false);

    // Equipment image states
    const [equipmentImagePreview, setEquipmentImagePreview] = useState<string>('');
    const [showEquipmentImageFullscreen, setShowEquipmentImageFullscreen] = useState(false);

    // Claim form states
    const [selectedStockForClaim, setSelectedStockForClaim] = useState<Stock | null>(null);
    const [selectedRoomForClaim, setSelectedRoomForClaim] = useState<Room | null>(null);
    const [selectedTableForClaim, setSelectedTableForClaim] = useState<Tabel | null>(null);
    const [selectedRackForClaim, setSelectedRackForClaim] = useState<Rack | null>(null);
    const [selectedBoxForClaim, setSelectedBoxForClaim] = useState<Box | null>(null);

    const [selectedRoomForEdit, setSelectedRoomForEdit] = useState<Room | null>(null);
    const [selectedTableForEdit, setSelectedTableForEdit] = useState<Tabel | null>(null);
    const [selectedRackForEdit, setSelectedRackForEdit] = useState<Rack | null>(null);
    const [selectedBoxForEdit, setSelectedBoxForEdit] = useState<Box | null>(null);

    // Forms
    const stockForm = useForm<StockForm>({
        resolver: zodResolver(stockSchema),
        defaultValues: { quantity: 1 },
    });

    const maxClaimQuantity = selectedStockForClaim?.quantity || 1;
    const equipmentClaimSchema = useMemo(() => {
        return createEquipmentClaimSchema(maxClaimQuantity, profile?.role || 'student');
    }, [maxClaimQuantity, profile?.role]);

    const equipmentEditSchema = useMemo(() => {
        return createEquipmentEditSchema(profile?.role || 'student');
    }, [profile?.role]);

    const claimForm = useForm<EquipmentClaimForm>({
        resolver: zodResolver(equipmentClaimSchema),
        defaultValues: {
            is_mandatory: false,
            is_available: true,
            condition: 'GOOD',
            quantity: 1,
        },
    });

    const editForm = useForm<EquipmentEditForm>({
        resolver: zodResolver(equipmentEditSchema),
        defaultValues: {
            is_mandatory: false,
            is_available: true,
            condition: 'GOOD',
            quantity: 1,
        },
    });

    const categories = [
        { name: 'Audio Visual', icon: Camera, color: 'violet' },
        { name: 'Computing', icon: Cpu, color: 'blue' },
        { name: 'Connectivity', icon: Wifi, color: 'emerald' },
        { name: 'Power', icon: Zap, color: 'amber' },
        { name: 'Laboratory', icon: FlaskConical, color: 'rose' },
        { name: 'Furniture', icon: Armchair, color: 'slate' },
        { name: 'Safety', icon: Shield, color: 'orange' },
        { name: 'Cabinet', icon: Archive, color: 'indigo' },
        { name: 'Box', icon: Package, color: 'teal' },
    ];

    // ==================== ROLE-BASED ACCESS ====================
    const isSuperAdmin = profile?.role === 'super_admin';
    const isDepartmentAdmin = profile?.role === 'department_admin';
    const isLaboratory = profile?.role === 'laboratory';
    const isPurchasing = profile?.role === 'purchasing';
    const hasAccess = isSuperAdmin || isDepartmentAdmin || isLaboratory || isPurchasing;

    // ==================== INITIAL DATA LOADING ====================
    useEffect(() => {
        if (!hasAccess) return;

        const loadInitialData = async () => {
            try {
                setLoadingStocks(true);
                setLoadingEquipment(true);

                // Prepare rooms query
                let roomsQuery = supabase.from('rooms').select('id, name, code, department_id, study_program_id, department:departments(id, name, code)');

                if (isDepartmentAdmin && profile?.department_id) {
                    // Department admin filters by department_id
                    roomsQuery = roomsQuery.eq('department_id', profile.department_id);
                }

                // Execute independent queries in parallel using Promise.all
                const [
                    { data: stocksData, error: stocksError },
                    { data: roomsData, error: roomsError },
                    { data: tablesData, error: tablesError },
                    { data: racksData, error: racksError },
                    { data: boxesData, error: boxesError }
                ] = await Promise.all([
                    supabase.from('stock').select('id, nama, code, category, quantity, unit, spesification, created_at').order('created_at', { ascending: false }),
                    roomsQuery.order('name'),
                    supabase.from('table').select('id, room_id, description, rack'),
                    supabase.from('rack').select('id, name, table_id').order('name'),
                    supabase.from('box').select('id, name, description, rack_id').order('name')
                ]);

                if (stocksError) throw stocksError;
                if (roomsError) throw roomsError;
                if (tablesError) throw tablesError;
                if (racksError) throw racksError;
                if (boxesError) throw boxesError;

                setStocks(stocksData || []);
                setTables(tablesData || []);
                setRacks(racksData || []);
                setBoxes(boxesData || []);

                // Process rooms filter
                let filteredRooms = roomsData || [];
                if (isLaboratory && profile?.department_id) {
                    const laborDeptId = profile.department_id;
                    const laborStudyProgramId = profile.study_program_id;

                    filteredRooms = filteredRooms.filter((room: any) => {
                        // Department must match
                        if (room.department_id !== laborDeptId) return false;

                        // Study program check: null OR same as laboran
                        if (room.study_program_id === null || room.study_program_id === laborStudyProgramId) {
                            return true;
                        }

                        // Study program is different from laboran → don't show
                        return false;
                    });

                    console.log(`🔬 Laboran rooms filter: ${filteredRooms.length} rooms from ${roomsData?.length || 0}`);
                }
                setRooms(filteredRooms as any);

                let equipmentQuery = supabase
                    .from('equipment')
                    .select(`
                        id, name, code, category, quantity, unit, condition, created_at,
                        rooms:rooms_id(
                            id, name, code, department_id, study_program_id, floor,
                            department:departments(id, name, code)
                        ),
                        stock:stock_id(id, nama, code, category, quantity, unit)
                    `)
                    .order('created_at', { ascending: false });

                // Get room IDs from filtered rooms for laboran and department_admin
                const accessibleRoomIds = filteredRooms.map(room => room.id);

                if (isLaboratory && profile?.department_id) {
                    if (accessibleRoomIds.length > 0) {
                        equipmentQuery = equipmentQuery.in('rooms_id', accessibleRoomIds);
                    } else {
                        // If no rooms found for lab, show empty
                        equipmentQuery = equipmentQuery.in('rooms_id', ['nomatch']);
                    }
                } else if (isDepartmentAdmin && profile?.department_id) {
                    // Use accessibleRoomIds (which corresponds to department rooms)
                    if (accessibleRoomIds.length > 0) {
                        equipmentQuery = equipmentQuery.in('rooms_id', accessibleRoomIds);
                    }
                }

                const { data: equipmentData, error: equipmentError } = await equipmentQuery;

                if (equipmentError) throw equipmentError;

                const mappedEquipmentFn = (data: any[]) => {
                    return data.map(item => ({
                        ...item,
                        table_id: item.table_id
                    }));
                };

                setEquipment(mappedEquipmentFn(equipmentData || []));

            } catch (error) {
                console.error('Error loading initial data:', error);
                toast.error('Failed to load data');
            } finally {
                setLoadingStocks(false);
                setLoadingEquipment(false);
            }
        };

        loadInitialData();
    }, [profile, hasAccess]);

    // ==================== STOCK TRACK RECORD ====================
    const fetchStockTrackRecord = async (stockId: string) => {
        try {
            setLoadingStockTrack(true);

            const { data: equipmentData, error: equipmentError } = await supabase
                .from('equipment')
                .select(`
                    id,
                    name,
                    code,
                    quantity,
                    condition,
                    created_at,
                    rooms:rooms_id(id, name, code, department:departments(id, name, code))
                `)
                .eq('stock_id', stockId)
                .order('created_at', { ascending: false });

            if (equipmentError) throw equipmentError;

            if (!equipmentData || equipmentData.length === 0) {
                setStockTrackRecords([]);
                return;
            }

            const trackRecords: StockTrackRecord[] = equipmentData.map(eq => ({
                equipment_id: eq.id,
                equipment_name: eq.name,
                equipment_code: eq.code,
                room_name: (eq.rooms as any)?.name,
                room_code: (eq.rooms as any)?.code,
                department_name: (eq.rooms as any)?.department?.name,
                quantity_claimed: eq.quantity,
                claimed_at: eq.created_at,
                condition: eq.condition
            }));

            setStockTrackRecords(trackRecords);

        } catch (error) {
            console.error('Error fetching stock track record:', error);
            toast.error('Failed to load stock track record');
            setStockTrackRecords([]);
        } finally {
            setLoadingStockTrack(false);
        }
    };

    // ==================== GAP ANALYSIS ====================
    // ==================== ENHANCED TRACK RECORD: Checkouts + Borrowed Bookings + Borrowed Lending Tools ====================

    const fetchGapAnalysis = async (equipmentId: string) => {
        try {
            setLoadingTrack(true);
            const allRecords: LendingDetail[] = [];

            // ===== PART 1: FETCH CHECKOUTS WITH checkout_items =====
            const { data: checkoutsData, error: checkoutsError } = await supabase
                .from('checkouts')
                .select(`
                id,
                user_id,
                booking_id,
                lendingTool_id,
                checkout_date,
                expected_return_date,
                actual_return_date,
                status,
                type,
                checkout_items!inner (
                    checkout_id,
                    equipment_requested,
                    equipment_quantities,
                    equipment_back,
                    quantities_back,
                    status
                )
            `)
                .contains('checkout_items.equipment_requested', [equipmentId])
                .order('created_at', { ascending: false });

            if (checkoutsError) {
                console.error('Error fetching checkouts:', checkoutsError);
            }

            console.log('📊 Checkouts found:', checkoutsData?.length || 0);

            // Process checkouts
            if (checkoutsData && checkoutsData.length > 0) {
                const checkoutRecords = await Promise.all(
                    checkoutsData.map(async (checkout) => {
                        const checkoutItem = checkout.checkout_items[0];
                        if (!checkoutItem) return null;

                        const eqIndex = checkoutItem.equipment_requested.findIndex(
                            (id: string) => id === equipmentId
                        );
                        if (eqIndex === -1) return null;

                        const borrowedQty = checkoutItem.equipment_quantities[eqIndex] || 0;
                        const returnedQty = checkoutItem.quantities_back?.[eqIndex] || 0;
                        const missingQty = borrowedQty - returnedQty;

                        // Get user info
                        let userName = 'Unknown User';
                        let userEmail = 'No email';
                        let userIdentity = 'No ID';
                        let userData = null;

                        if (checkout.user_id) {
                            const { data: user } = await supabase
                                .from('users')
                                .select('id, full_name, identity_number, email')
                                .eq('id', checkout.user_id)
                                .single();

                            if (user) {
                                userData = user;
                                userName = user.full_name;
                                userEmail = user.email;
                                userIdentity = user.identity_number;
                            }
                        }

                        // Determine source and date
                        let source: 'lending_tool' | 'booking' = 'lending_tool';
                        let sourceId = checkout.lendingTool_id;
                        let dateString = checkout.checkout_date;

                        if (checkout.booking_id) {
                            source = 'booking';
                            sourceId = checkout.booking_id;
                            const { data: booking } = await supabase
                                .from('bookings')
                                .select('start_time')
                                .eq('id', checkout.booking_id)
                                .single();
                            if (booking) dateString = booking.start_time;
                        } else if (checkout.lendingTool_id) {
                            const { data: lending } = await supabase
                                .from('lending_tool')
                                .select('date')
                                .eq('id', checkout.lendingTool_id)
                                .single();
                            if (lending) dateString = lending.date;
                        }

                        return {
                            id: sourceId || checkout.id,
                            date: dateString,
                            borrowed_quantity: borrowedQty,
                            returned_quantity: returnedQty,
                            missing_quantity: missingQty,
                            status: checkout.status as any,
                            created_at: checkout.checkout_date,
                            source: source,
                            user: userData,
                            user_name: userName,
                            user_email: userEmail,
                            user_identity: userIdentity,
                            checkout: {
                                id: checkout.id,
                                checkout_date: checkout.checkout_date,
                                expected_return_date: checkout.expected_return_date,
                                actual_return_date: checkout.actual_return_date,
                                status: checkout.status
                            }
                        } as LendingDetail;
                    })
                );

                allRecords.push(...checkoutRecords.filter((r): r is LendingDetail => r !== null));
            }

            // ===== PART 2: FETCH BOOKINGS WITH STATUS 'borrowed' =====
            const { data: borrowedBookings, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    id,
                    user_id,
                    start_time,
                    end_time,
                    purpose,
                    status,
                    equipment_requested,
                    equipment_quantities,
                    created_at,
                    user:users!user_id(id, full_name, identity_number, email)
                `)
                .eq('status', 'borrowed')
                .contains('equipment_requested', [equipmentId])
                .order('created_at', { ascending: false });

            if (bookingsError) {
                console.error('Error fetching borrowed bookings:', bookingsError);
            }

            console.log('📋 Borrowed Bookings found:', borrowedBookings?.length || 0);

            if (borrowedBookings && borrowedBookings.length > 0) {
                for (const booking of borrowedBookings) {
                    // Check if already in checkout records
                    const alreadyExists = allRecords.some(r => r.source === 'booking' && r.id === booking.id);
                    if (alreadyExists) continue;

                    const eqIndex = booking.equipment_requested?.findIndex((id: string) => id === equipmentId) ?? -1;
                    if (eqIndex === -1) continue;

                    const borrowedQty = booking.equipment_quantities?.[eqIndex] || 1;
                    const user = booking.user as any;

                    allRecords.push({
                        id: booking.id,
                        date: booking.start_time,
                        borrowed_quantity: borrowedQty,
                        returned_quantity: 0,
                        missing_quantity: borrowedQty,
                        status: 'borrow' as any,
                        created_at: booking.created_at,
                        source: 'booking',
                        user: user,
                        user_name: user?.full_name || 'Unknown User',
                        user_email: user?.email || 'No email',
                        user_identity: user?.identity_number || 'No ID',
                        checkout: undefined
                    });
                }
            }

            // ===== PART 3: FETCH LENDING_TOOL WITH STATUS 'borrowed' =====
            const { data: borrowedLendings, error: lendingsError } = await supabase
                .from('lending_tool')
                .select(`
                    id,
                    user_id,
                    date,
                    return_date,
                    purpose,
                    status,
                    equipment_requested,
                    equipment_quantities,
                    created_at,
                    user:users!user_id(id, full_name, identity_number, email)
                `)
                .eq('status', 'borrowed')
                .contains('equipment_requested', [equipmentId])
                .order('created_at', { ascending: false });

            if (lendingsError) {
                console.error('Error fetching borrowed lendings:', lendingsError);
            }

            console.log('🔧 Borrowed Lending Tools found:', borrowedLendings?.length || 0);

            if (borrowedLendings && borrowedLendings.length > 0) {
                for (const lending of borrowedLendings) {
                    // Check if already in checkout records
                    const alreadyExists = allRecords.some(r => r.source === 'lending_tool' && r.id === lending.id);
                    if (alreadyExists) continue;

                    const eqIndex = lending.equipment_requested?.findIndex((id: string) => id === equipmentId) ?? -1;
                    if (eqIndex === -1) continue;

                    const borrowedQty = lending.equipment_quantities?.[eqIndex] || 1;
                    const user = lending.user as any;

                    allRecords.push({
                        id: lending.id,
                        date: lending.date,
                        borrowed_quantity: borrowedQty,
                        returned_quantity: 0,
                        missing_quantity: borrowedQty,
                        status: 'borrow' as any,
                        created_at: lending.created_at,
                        source: 'lending_tool',
                        user: user,
                        user_name: user?.full_name || 'Unknown User',
                        user_email: user?.email || 'No email',
                        user_identity: user?.identity_number || 'No ID',
                        checkout: undefined
                    });
                }
            }

            // Sort all records by date descending
            allRecords.sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());

            console.log(`✅ Total track records: ${allRecords.length}`);

            setLendingDetails(allRecords);

        } catch (error) {
            console.error('❌ Error in track record analysis:', error);
            toast.error('Failed to load track record');
            setLendingDetails([]);
        } finally {
            setLoadingTrack(false);
        }
    };

    // ==================== HANDLE RESOLVE GAP ====================
    // ==================== NEW HANDLE RESOLVE GAP WITH checkout_items ARRAYS ====================

    const handleResolveGap = async (detail: LendingDetail) => {
        try {
            if (!selectedEquipment || !detail.checkout) return;

            console.log('🔄 Resolving gap for equipment:', selectedEquipment.id);
            console.log('   Checkout ID:', detail.checkout.id);
            console.log('   Missing quantity:', detail.missing_quantity);

            // ===== STEP 1: GET CURRENT checkout_items =====
            const { data: currentItems, error: fetchError } = await supabase
                .from('checkout_items')
                .select('*')
                .eq('checkout_id', detail.checkout.id)
                .single();

            if (fetchError) throw fetchError;
            if (!currentItems) throw new Error('Checkout items not found');

            console.log('   Current checkout_items:', currentItems);

            // ===== STEP 2: FIND EQUIPMENT INDEX =====
            const eqIndex = currentItems.equipment_requested.findIndex(
                (id: string) => id === selectedEquipment.id
            );

            if (eqIndex === -1) {
                throw new Error('Equipment not found in checkout_items');
            }

            console.log('   Equipment index:', eqIndex);

            // ===== STEP 3: UPDATE quantities_back ARRAY =====
            const borrowedQty = currentItems.equipment_quantities[eqIndex];

            // Initialize quantities_back if not exist
            let quantitiesBack = currentItems.quantities_back || [];

            // Ensure array has enough elements
            while (quantitiesBack.length <= eqIndex) {
                quantitiesBack.push(0);
            }

            // Set returned quantity = borrowed quantity (fully returned)
            quantitiesBack[eqIndex] = borrowedQty;

            console.log('   Updated quantities_back:', quantitiesBack);

            // ===== STEP 4: UPDATE checkout_items =====
            const { error: updateItemsError } = await supabase
                .from('checkout_items')
                .update({
                    quantities_back: quantitiesBack,
                    status: 'completed'
                })
                .eq('checkout_id', detail.checkout.id);

            if (updateItemsError) throw updateItemsError;

            // ===== STEP 5: CHECK IF ALL ITEMS RETURNED =====
            // Calculate if all equipment in this checkout are fully returned
            const allReturned = currentItems.equipment_requested.every((eqId: string, idx: number) => {
                const borrowed = currentItems.equipment_quantities[idx] || 0;
                const returned = quantitiesBack[idx] || 0;
                return returned >= borrowed;
            });

            console.log('   All items returned:', allReturned);

            // ===== STEP 6: UPDATE CHECKOUT STATUS IF ALL RETURNED =====
            if (allReturned) {
                const { error: updateCheckoutError } = await supabase
                    .from('checkouts')
                    .update({
                        status: 'Active',
                        actual_return_date: new Date().toISOString()
                    })
                    .eq('id', detail.checkout.id);

                if (updateCheckoutError) throw updateCheckoutError;

                console.log('   ✅ Checkout marked as completed');
            }

            // ===== STEP 7: UPDATE SOURCE STATUS (booking/lending_tool) =====
            if (detail.source === 'booking' && detail.checkout.booking_id) {
                const { error: bookingError } = await supabase
                    .from('bookings')
                    .update({
                        status: 'returned'
                    })
                    .eq('id', detail.checkout.booking_id);

                if (bookingError) console.error('   ⚠️ Error updating booking:', bookingError);
            } else if (detail.source === 'lending_tool' && detail.checkout.lendingTool_id) {
                const { error: lendingError } = await supabase
                    .from('lending_tool')
                    .update({
                        status: 'returned',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', detail.checkout.lendingTool_id);

                if (lendingError) console.error('   ⚠️ Error updating lending:', lendingError);
            }

            // ===== STEP 8: UPDATE EQUIPMENT STOCK (RETURN TO STOCK) =====
            const { data: currentEquipment } = await supabase
                .from('equipment')
                .select('quantity')
                .eq('id', selectedEquipment.id)
                .single();

            if (currentEquipment) {
                const newQuantity = currentEquipment.quantity + detail.missing_quantity;

                await supabase
                    .from('equipment')
                    .update({
                        quantity: newQuantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', selectedEquipment.id);

                console.log(`   ✅ Equipment stock updated: ${currentEquipment.quantity} → ${newQuantity}`);
            }

            toast.success('✅ Gap resolved successfully!');

            // Refresh gap analysis
            await fetchGapAnalysis(selectedEquipment.id);

        } catch (error: any) {
            console.error('❌ Error resolving gap:', error);
            toast.error(error.message || 'Failed to resolve gap');
        }
    };

    // ==================== REAL-TIME UPDATES ====================
    useEffect(() => {
        if (!selectedEquipment) return;

        const checkoutSubscription = supabase
            .channel('gap_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'checkouts'
            }, () => {
                fetchGapAnalysis(selectedEquipment.id);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'checkout_items'
            }, () => {
                fetchGapAnalysis(selectedEquipment.id);
            })
            .subscribe();

        return () => {
            checkoutSubscription.unsubscribe();
        };
    }, [selectedEquipment?.id]);

    const handleOpenTrackRecordModal = async (eq: EquipmentWithDetails) => {
        setSelectedEquipment(eq);
        setShowTrackRecordModal(true);
        await fetchGapAnalysis(eq.id);
    };

    const handleOpenDetailModal = async (eq: EquipmentWithDetails) => {
        setSelectedEquipment(eq);
        setShowDetailModal(true);
        try {
            const { data } = await supabase
                .from('equipment')
                .select(`
                    attachments,
                    rooms:rooms_id(
                        id, name, code, department_id, study_program_id, floor,
                        department:departments(id, name, code),
                        building:building_id(name, campus:campus_id(name))
                    )
                `)
                .eq('id', eq.id)
                .single();

            if (data) {
                setSelectedEquipment(prev => (prev?.id === eq.id ? { ...prev, ...data } : prev));
            }
        } catch (e) {
            console.error('Error loading details:', e);
        }
    };

    // ==================== NEW: STOCK MODAL HANDLERS ====================
    const handleOpenStockDetailModal = async (stock: Stock) => {
        setSelectedStock(stock);
        setShowStockDetailModal(true);
        try {
            const { data } = await supabase.from('stock').select('attachments').eq('id', stock.id).single();
            if (data) {
                setSelectedStock(prev => (prev?.id === stock.id ? { ...prev, attachments: data.attachments } : prev));
            }
        } catch (e) {
            console.error('Error loading attachment:', e);
        }
    };

    const handleOpenStockTrackModal = async (stock: Stock) => {
        setSelectedStock(stock);
        setShowStockTrackModal(true);
        await fetchStockTrackRecord(stock.id);
    };

    // ==================== STOCK IMAGE HANDLERS ====================
    // Handle stock image - to base64
    const handleStockImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size must be less than 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = event.target?.result as string;
                setStockImagePreview(base64String);
            };
            reader.readAsDataURL(file);
        }
        // Allow re-selecting the same file
        e.target.value = '';
    };

    // Clear stock image
    const clearStockImage = () => {
        setStockImagePreview('');
    };

    // ==================== EQUIPMENT IMAGE HANDLERS ====================
    // Handle equipment image - to base64
    const handleEquipmentImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size must be less than 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = event.target?.result as string;
                setEquipmentImagePreview(base64String);
            };
            reader.readAsDataURL(file);
        }
        // Allow re-selecting the same file
        e.target.value = '';
    };

    // Clear equipment image
    const clearEquipmentImage = () => {
        setEquipmentImagePreview('');
    };

    // ==================== MODAL HANDLERS ====================
    const handleOpenStockModal = async (stock?: Stock) => {
        setEditingStock(stock || null);

        if (stock) {
            stockForm.reset({
                nama: stock.nama,
                code: stock.code,
                category: stock.category,
                spesification: stock.spesification || '',
                quantity: stock.quantity,
                unit: stock.unit,
            });
            setStockImagePreview('');
            try {
                const { data } = await supabase.from('stock').select('attachments').eq('id', stock.id).single();
                if (data?.attachments) setStockImagePreview(data.attachments);
            } catch (e) {
                console.error(e);
            }
        } else {
            stockForm.reset({ quantity: 1 });
            setStockImagePreview('');
        }

        setShowStockModal(true);
    };

    const handleOpenClaimModal = () => {
        setSelectedStockForClaim(null);
        setSelectedRoomForClaim(null);
        setEquipmentImagePreview('');

        claimForm.reset({
            is_mandatory: false,
            is_available: true,
            condition: 'GOOD',
            quantity: 1,
        });

        setShowClaimModal(true);
    };

    const handleOpenEditModal = async (equipmentItem: EquipmentWithDetails) => {
        setEditingEquipment(equipmentItem);
        setSelectedRoomForEdit(equipmentItem.rooms || null);
        setEquipmentImagePreview('');

        try {
            const { data } = await supabase.from('equipment').select('attachments').eq('id', equipmentItem.id).single();
            if (data?.attachments) setEquipmentImagePreview(data.attachments);
        } catch (e) {
            console.error(e);
        }

        // Resolve location objects with hierarchy inference
        const foundBox = boxes.find(b => b.id === equipmentItem.box_id);

        let rackId = equipmentItem.rack_id;
        if (!rackId && foundBox) {
            rackId = foundBox.rack_id;
        }
        const foundRack = racks.find(r => r.id === rackId);

        let tableId = equipmentItem.table_id;
        if (!tableId && foundRack) {
            tableId = foundRack.table_id;
        }
        const foundTable = tables.find(t => t.id === tableId);

        setSelectedBoxForEdit(foundBox || null);
        setSelectedRackForEdit(foundRack || null);
        setSelectedTableForEdit(foundTable || null);

        editForm.reset({
            name: equipmentItem.name,
            code: equipmentItem.code,
            category: equipmentItem.category,
            is_mandatory: equipmentItem.is_mandatory ?? false,
            is_available: equipmentItem.is_available ?? true,
            condition: (equipmentItem.condition as any) || 'GOOD',
            Spesification: equipmentItem.Spesification || '',
            quantity: equipmentItem.quantity,
            unit: equipmentItem.unit,
            rooms_id: equipmentItem.rooms_id || '',
            table_id: tableId || '',
            rack_id: rackId || '',
            box_id: equipmentItem.box_id || '',
        });

        setShowEditModal(true);
    };

    // ==================== FORM SUBMIT HANDLERS ====================
    const handleStockSubmit = async (data: StockForm) => {
        try {
            setLoadingStocks(true);

            const stockData = {
                nama: data.nama,
                code: data.code.toUpperCase(),
                category: data.category,
                spesification: data.spesification,
                quantity: data.quantity,
                unit: data.unit,
                attachments: stockImagePreview || null,
            };

            if (editingStock) {
                const { error } = await supabase.from('stock').update(stockData).eq('id', editingStock.id);
                if (error) throw error;
                toast.success('Stock updated! 🎉');
            } else {
                const { error } = await supabase.from('stock').insert([stockData]);
                if (error) throw error;
                toast.success('Stock created! ✨');
            }

            setShowStockModal(false);
            setEditingStock(null);
            setStockImagePreview('');
            stockForm.reset();

            const { data: newStocks } = await supabase
                .from('stock')
                .select('id, nama, code, category, quantity, unit, spesification, created_at')
                .order('created_at', { ascending: false });
            setStocks(newStocks || []);

        } catch (error: any) {
            console.error('Error saving stock:', error);
            toast.error(error.message || 'Failed to save stock');
        } finally {
            setLoadingStocks(false);
        }
    };

    const handleClaimSubmit = async (data: EquipmentClaimForm) => {
        try {
            if (!selectedStockForClaim) {
                toast.error('Please select a stock item');
                return;
            }

            if (isDepartmentAdmin && !selectedRoomForClaim) {
                toast.error('Room selection is required');
                return;
            }

            setLoadingEquipment(true);

            const equipmentData = {
                name: data.name,
                code: data.code.toUpperCase(),
                category: selectedStockForClaim.category,
                is_mandatory: data.is_mandatory ?? false,
                is_available: data.is_available ?? true,
                condition: data.condition,
                rooms_id: selectedRoomForClaim?.id || null,
                table_id: selectedTableForClaim?.id || null,
                rack_id: selectedRackForClaim?.id || null,
                box_id: selectedBoxForClaim?.id || null,
                Spesification: data.Spesification || selectedStockForClaim.spesification,
                quantity: data.quantity,
                unit: selectedStockForClaim.unit,
                stock_id: selectedStockForClaim.id,
                attachments: equipmentImagePreview ? [equipmentImagePreview] : null,
            };

            const { error: equipmentError } = await supabase.from('equipment').insert([equipmentData]);
            if (equipmentError) throw equipmentError;

            const newStockQuantity = selectedStockForClaim.quantity - data.quantity;
            const { error: stockError } = await supabase
                .from('stock')
                .update({ quantity: newStockQuantity })
                .eq('id', selectedStockForClaim.id);

            if (stockError) throw stockError;

            toast.success(`Successfully claimed ${data.quantity} ${selectedStockForClaim.unit}! ✨`);

            setShowClaimModal(false);
            setSelectedStockForClaim(null);
            setSelectedRoomForClaim(null);
            setEquipmentImagePreview('');
            claimForm.reset();

            await Promise.all([
                fetchStocks(),
                fetchEquipment()
            ]);

        } catch (error: any) {
            console.error('Error claiming equipment:', error);
            toast.error(error.message || 'Failed to claim equipment');
        } finally {
            setLoadingEquipment(false);
        }
    };

    const handleEditSubmit = async (data: EquipmentEditForm) => {
        try {
            if (!editingEquipment) return;

            if (isDepartmentAdmin && !selectedRoomForEdit) {
                toast.error('Room selection is required');
                return;
            }

            setLoadingEquipment(true);

            const equipmentData = {
                name: data.name,
                code: data.code.toUpperCase(),
                category: data.category,
                is_mandatory: data.is_mandatory,
                is_available: data.is_available,
                condition: data.condition,
                rooms_id: selectedRoomForEdit?.id || null,
                table_id: selectedTableForEdit?.id || null,
                rack_id: selectedRackForEdit?.id || null,
                box_id: selectedBoxForEdit?.id || null,
                Spesification: data.Spesification,
                quantity: data.quantity,
                unit: data.unit,
                attachments: equipmentImagePreview ? [equipmentImagePreview] : null,
            };

            const { error } = await supabase.from('equipment').update(equipmentData).eq('id', editingEquipment.id);
            if (error) throw error;

            toast.success('Equipment updated! 🎉');

            setShowEditModal(false);
            setEditingEquipment(null);
            setSelectedRoomForEdit(null);
            setEquipmentImagePreview('');
            editForm.reset();

            await fetchEquipment();

        } catch (error: any) {
            console.error('Error updating equipment:', error);
            toast.error(error.message || 'Failed to update equipment');
        } finally {
            setLoadingEquipment(false);
        }
    };

    // ==================== DATA FETCH FUNCTIONS ====================
    const fetchStocks = async () => {
        try {
            const { data, error } = await supabase
                .from('stock')
                .select('id, nama, code, category, quantity, unit, spesification, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStocks(data || []);
        } catch (error) {
            console.error('Error fetching stocks:', error);
            toast.error('Failed to load stocks');
        }
    };

    const fetchEquipment = async () => {
        try {
            let query = supabase
                .from('equipment')
                .select(`
                    id, name, code, category, quantity, unit, condition, created_at,
                    rooms:rooms_id(
                        id, name, code, department_id, study_program_id, floor,
                        department:departments(id, name, code)
                    ),
                    stock:stock_id(id, nama, code, category, quantity, unit)
                `)
                .order('created_at', { ascending: false });

            if ((isDepartmentAdmin || isLaboratory) && profile?.department_id) {
                const { data: departmentRooms } = await supabase
                    .from('rooms')
                    .select('id')
                    .eq('department_id', profile.department_id);

                if (departmentRooms && departmentRooms.length > 0) {
                    const roomIds = departmentRooms.map(room => room.id);
                    query = query.in('rooms_id', roomIds);
                }
            }

            const { data, error } = await query;

            if (error) throw error;
            const mappedEquipment = (data || []).map(item => ({
                ...item,
                table_id: item.table_id
            }));

            setEquipment(mappedEquipment);
        } catch (error) {
            console.error('Error fetching equipment:', error);
            toast.error('Failed to load equipment');
        }
    };

    // ==================== DELETE HANDLERS ====================
    const handleDeleteStock = async (stockId: string) => {
        try {
            setLoadingStocks(true);

            const { data: usedEquipment } = await supabase
                .from('equipment')
                .select('id')
                .eq('stock_id', stockId)
                .limit(1);

            if (usedEquipment && usedEquipment.length > 0) {
                toast.error('Cannot delete stock that is used by equipment');
                return;
            }

            const { error } = await supabase.from('stock').delete().eq('id', stockId);
            if (error) throw error;

            toast.success('Stock deleted! 🗑️');
            fetchStocks();

        } catch (error: any) {
            console.error('Error deleting stock:', error);
            toast.error(error.message || 'Failed to delete stock');
        } finally {
            setLoadingStocks(false);
        }
    };

    const handleDeleteEquipment = async (equipmentId: string) => {
        try {
            setLoadingEquipment(true);

            const { error } = await supabase.from('equipment').delete().eq('id', equipmentId);
            if (error) throw error;

            toast.success('Equipment deleted! 🗑️');
            fetchEquipment();

        } catch (error: any) {
            console.error('Error deleting equipment:', error);
            toast.error(error.message || 'Failed to delete equipment');
        } finally {
            setLoadingEquipment(false);
        }
    };

    // ==================== FILTER FUNCTIONS ====================
    const filteredStocks = useMemo(() => {
        return stocks.filter(stock => {
            const matchesSearch = stock.nama.toLowerCase().includes(stockSearchTerm.toLowerCase()) ||
                stock.code.toLowerCase().includes(stockSearchTerm.toLowerCase());
            const matchesCategory = stockCategoryFilter === 'all' || stock.category === stockCategoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [stocks, stockSearchTerm, stockCategoryFilter]);

    const filteredEquipment = useMemo(() => {
        return equipment.filter(eq => {
            const matchesSearch = eq.name.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                eq.code.toLowerCase().includes(equipmentSearchTerm.toLowerCase());
            const matchesCategory = equipmentCategoryFilter === 'all' || eq.category === equipmentCategoryFilter;
            const matchesRoom = roomFilter === 'all' || eq.rooms_id === roomFilter;
            return matchesSearch && matchesCategory && matchesRoom;
        });
    }, [equipment, equipmentSearchTerm, equipmentCategoryFilter, roomFilter]);

    const availableStocks = useMemo(() => {
        return stocks.filter(stock => stock.quantity > 0);
    }, [stocks]);

    const availableRooms = useMemo(() => {
        if (isDepartmentAdmin && profile?.department_id) {
            return rooms.filter(room => room.department_id === profile.department_id);
        }
        return rooms;
    }, [rooms, isDepartmentAdmin, profile]);

    const canClaimEquipment = useMemo(() => {
        if (!hasAccess) return false;
        if (isSuperAdmin) return availableStocks.length > 0;
        if (isDepartmentAdmin || isLaboratory) {
            return availableStocks.length > 0 && availableRooms.length > 0;
        }
        return false;
    }, [hasAccess, isSuperAdmin, isDepartmentAdmin, isLaboratory, availableStocks, availableRooms]);

    // ==================== HELPER FUNCTIONS ====================
    const getCategoryConfig = (categoryName: string) => {
        return categories.find(cat => cat.name === categoryName) || categories[0];
    };

    const getConditionBadge = (condition: string) => {
        const configs = {
            GOOD: { icon: CheckCircle, label: 'Good', bg: 'bg-green-100', text: 'text-green-700' },
            BROKEN: { icon: XCircle, label: 'Broken', bg: 'bg-red-100', text: 'text-red-700' },
            MAINTENANCE: { icon: AlertTriangle, label: 'Maintenance', bg: 'bg-yellow-100', text: 'text-yellow-700' }
        };
        return configs[condition] || configs.GOOD;
    };

    const getSourceBadge = (source: string) => {
        if (source === 'booking') {
            return { icon: Building, label: 'Booking', bg: 'bg-purple-100', text: 'text-purple-700' };
        }
        return { icon: Wrench, label: 'Lending', bg: 'bg-orange-100', text: 'text-orange-700' };
    };

    const getStatusBadge = (status: string) => {
        const configs = {
            active: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Active' },
            returned: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Returned' },
            pending: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Pending' },
            overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'Overdue' }
        };
        return configs[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    };

    // ==================== RENDER GAP ANALYSIS ====================
    const renderSimpleGapAnalysis = () => {
        if (loadingTrack) {
            return (
                <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-gray-600">Analyzing gaps...</p>
                </div>
            );
        }

        if (lendingDetails.length === 0) {
            return (
                <div className="text-center py-12 bg-green-50 rounded-xl border-2 border-green-200">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
                    <h4 className="text-lg font-bold text-green-800 mb-1">✅ All Clear!</h4>
                    <p className="text-green-600">No missing items detected</p>
                </div>
            );
        }

        const gapsByUser = lendingDetails.reduce((acc, gap) => {
            const userName = gap.user_name || 'Unknown User';
            if (!acc[userName]) {
                acc[userName] = [];
            }
            acc[userName].push(gap);
            return acc;
        }, {} as Record<string, LendingDetail[]>);

        const totalMissing = lendingDetails.reduce((sum, gap) => sum + gap.missing_quantity, 0);

        return (
            <div className="space-y-4">
                <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-xl p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-8 w-8" />
                            <div>
                                <h3 className="text-xl font-bold">Gap Detected</h3>
                                <p className="text-sm opacity-90">{Object.keys(gapsByUser).length} users with missing items</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold">{totalMissing}</div>
                            <div className="text-sm opacity-90">Missing {selectedEquipment?.unit}</div>
                        </div>
                    </div>
                </div>

                {Object.entries(gapsByUser).map(([userName, userGaps]) => {
                    const userTotalMissing = userGaps.reduce((sum, gap) => sum + gap.missing_quantity, 0);

                    return (
                        <div key={userName} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b-2 border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                            {userName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{userName}</h4>
                                            <p className="text-sm text-gray-600">
                                                {userGaps[0].user_identity || 'No ID'} • {userGaps[0].user_email || 'No email'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-red-600">{userTotalMissing}</div>
                                        <div className="text-xs text-gray-600">Missing</div>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {userGaps.map((gap) => {
                                    const sourceBadge = getSourceBadge(gap.source || 'lending_tool');
                                    const SourceIcon = sourceBadge.icon;
                                    const statusBadge = gap.checkout ? getStatusBadge(gap.checkout.status) : null;

                                    return (
                                        <div key={gap.id} className="p-4 hover:bg-gray-50">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${sourceBadge.bg} ${sourceBadge.text}`}>
                                                            <SourceIcon className="h-3 w-3" />
                                                            {sourceBadge.label}
                                                        </span>

                                                        {statusBadge && (
                                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge.bg} ${statusBadge.text}`}>
                                                                {statusBadge.label}
                                                            </span>
                                                        )}

                                                        {!gap.checkout && (
                                                            <span className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-700">
                                                                No Checkout
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="text-sm text-gray-600">
                                                        📅 {format(new Date(gap.date), 'MMM dd, yyyy')}
                                                    </div>

                                                    <div className="flex items-center gap-4 text-sm">
                                                        <span className="text-blue-600 font-medium">
                                                            Borrowed: {gap.borrowed_quantity}
                                                        </span>
                                                        <span className="text-green-600 font-medium">
                                                            Returned: {gap.returned_quantity}
                                                        </span>
                                                        <span className="text-red-600 font-bold">
                                                            Missing: {gap.missing_quantity}
                                                        </span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleResolveGap(gap)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm"
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                    Resolve
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // ==================== NEW: RENDER STOCK TRACK RECORD ====================
    const renderStockTrackRecord = () => {
        if (loadingStockTrack) {
            return (
                <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
                    <p className="text-gray-600">Loading track record...</p>
                </div>
            );
        }

        if (stockTrackRecords.length === 0) {
            return (
                <div className="text-center py-12 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <Package2 className="h-16 w-16 text-blue-500 mx-auto mb-3" />
                    <h4 className="text-lg font-bold text-blue-800 mb-1">No Claims Yet</h4>
                    <p className="text-blue-600">This stock has not been claimed as equipment</p>
                </div>
            );
        }

        const totalClaimed = stockTrackRecords.reduce((sum, record) => sum + record.quantity_claimed, 0);

        return (
            <div className="space-y-4">
                {/* Summary Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <History className="h-8 w-8" />
                            <div>
                                <h3 className="text-xl font-bold">Claim History</h3>
                                <p className="text-sm opacity-90">{stockTrackRecords.length} equipment items claimed from this stock</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold">{totalClaimed}</div>
                            <div className="text-sm opacity-90">Total {selectedStock?.unit} Claimed</div>
                        </div>
                    </div>
                </div>

                {/* Track Records List */}
                <div className="space-y-3">
                    {stockTrackRecords.map((record, index) => {
                        const conditionBadge = getConditionBadge(record.condition);
                        const ConditionIcon = conditionBadge.icon;

                        return (
                            <div key={record.equipment_id} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Left: Equipment Info */}
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                    #{index + 1}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-lg text-gray-900">{record.equipment_name}</h4>
                                                    <p className="text-sm text-gray-600 font-mono">{record.equipment_code}</p>
                                                </div>
                                            </div>

                                            {/* Location Info */}
                                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border-2 border-green-200">
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                                                    <div className="flex-1">
                                                        <p className="text-xs font-bold text-green-700 mb-1">LOCATION</p>
                                                        {record.room_name ? (
                                                            <>
                                                                <p className="font-bold text-gray-900">{record.room_name}</p>
                                                                <p className="text-sm text-gray-600 font-mono">{record.room_code}</p>
                                                                {record.department_name && (
                                                                    <p className="text-sm text-blue-600 mt-1">📍 {record.department_name}</p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="text-gray-500 italic">No room assigned</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Date Info */}
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Clock className="h-4 w-4" />
                                                <span>Claimed on {format(new Date(record.claimed_at), 'MMM dd, yyyy HH:mm')}</span>
                                            </div>
                                        </div>

                                        {/* Right: Stats */}
                                        <div className="text-right space-y-2">
                                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border-2 border-blue-200">
                                                <p className="text-xs text-blue-700 mb-1">Quantity Claimed</p>
                                                <p className="text-3xl font-bold text-blue-900">{record.quantity_claimed}</p>
                                                <p className="text-xs text-blue-600">{selectedStock?.unit}</p>
                                            </div>

                                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${conditionBadge.bg} ${conditionBadge.text}`}>
                                                <ConditionIcon className="h-3 w-3" />
                                                {conditionBadge.label}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Summary */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Database className="h-6 w-6 text-gray-600" />
                            <div>
                                <p className="text-sm text-gray-600">Remaining in Stock</p>
                                <p className="font-bold text-gray-900 text-lg">{selectedStock?.quantity} {selectedStock?.unit}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-600">Total Equipment Items</p>
                            <p className="font-bold text-gray-900 text-lg">{stockTrackRecords.length}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ==================== MODAL COMPONENTS ====================
    // 1. Stock Modal (Add/Edit)
    const StockModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold">
                            {editingStock ? 'Edit Stock' : 'Add Stock'}
                        </h3>
                        <button
                            onClick={() => {
                                setShowStockModal(false);
                                setEditingStock(null);
                            }}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <form onSubmit={stockForm.handleSubmit(handleStockSubmit)} className="p-6 space-y-4 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Name *</label>
                            <input
                                {...stockForm.register('nama')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                            />
                            {stockForm.formState.errors.nama && (
                                <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.nama.message}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Code *</label>
                            <input
                                {...stockForm.register('code')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-mono transition-colors"
                            />
                            {stockForm.formState.errors.code && (
                                <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.code.message}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Category *</label>
                        <select
                            {...stockForm.register('category')}
                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                        >
                            <option value="">Select Category</option>
                            {categories.map(cat => (
                                <option key={cat.name} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                        {stockForm.formState.errors.category && (
                            <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.category.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Quantity *</label>
                            <input
                                type="number"
                                {...stockForm.register('quantity', { valueAsNumber: true })}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                            />
                            {stockForm.formState.errors.quantity && (
                                <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.quantity.message}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Unit *</label>
                            <input
                                {...stockForm.register('unit')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder="pcs, set, box"
                            />
                            {stockForm.formState.errors.unit && (
                                <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.unit.message}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Specification</label>
                        <textarea
                            {...stockForm.register('spesification')}
                            rows={3}
                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Stock Photo</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-400 transition-colors">
                            {stockImagePreview ? (
                                <div className="relative group">
                                    <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                        <img
                                            src={stockImagePreview}
                                            alt="Preview"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={clearStockImage}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center h-32 cursor-pointer">
                                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-500 font-medium">Click to upload photo</span>
                                    <span className="text-xs text-gray-400 mt-1">Max 5MB (JPG, PNG)</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleStockImageChange}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setShowStockModal(false);
                                setEditingStock(null);
                            }}
                            className="px-6 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loadingStocks}
                            className="px-6 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                            {loadingStocks ? 'Saving...' : (editingStock ? 'Update' : 'Create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    // 2. Stock Detail Modal
    const StockDetailModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold">{selectedStock?.nama}</h3>
                            <p className="text-sm opacity-90 mt-1">Complete Stock Information</p>
                        </div>
                        <button
                            onClick={() => setShowStockDetailModal(false)}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Stock Photo Banner */}
                    {selectedStock?.attachments ? (
                        <div className="relative rounded-xl overflow-hidden shadow-lg h-64 group">
                            <ImageWithLoader
                                src={selectedStock.attachments}
                                alt={selectedStock.nama}
                                className="w-full h-full object-cover"
                                title={selectedStock.nama}
                                subtitle={selectedStock.code}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                                <div>
                                    <h4 className="text-white font-bold text-2xl drop-shadow-md">{selectedStock.nama}</h4>
                                    <p className="text-white/80 text-sm font-mono mt-1">{selectedStock.code}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setStockImagePreview(selectedStock.attachments || '');
                                        setShowStockImageFullscreen(true);
                                    }}
                                    className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white transition-all shadow-lg border border-white/10"
                                    title="View Fullscreen"
                                >
                                    <Maximize2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 text-center border-2 border-dashed border-blue-100">
                            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                                <Package className="h-10 w-10 text-indigo-400 opacity-60" />
                            </div>
                            <h4 className="font-bold text-xl text-gray-800">{selectedStock?.nama}</h4>
                            <p className="text-indigo-400 text-sm mt-2 font-medium italic">No photo available</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Basic Information
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-blue-700 mb-1">Stock Name (Nama)</p>
                                        <p className="font-bold text-gray-900">{selectedStock?.nama}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-700 mb-1">Stock Code</p>
                                        <p className="font-mono font-bold text-gray-900">{selectedStock?.code}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-700 mb-1">Category</p>
                                        <p className="font-bold text-gray-900">{selectedStock?.category}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                                <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                                    <Database className="h-5 w-5" />
                                    Inventory
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-purple-700 mb-1">Current Quantity</p>
                                        <p className="text-3xl font-bold text-purple-900">{selectedStock?.quantity}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-700 mb-1">Unit</p>
                                        <p className="font-bold text-gray-900">{selectedStock?.unit}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-700 mb-1">Stock Status</p>
                                        <div className={`inline-flex px-3 py-1 rounded-lg text-sm font-bold ${selectedStock && selectedStock.quantity > 20 ? 'bg-green-100 text-green-700'
                                            : selectedStock && selectedStock.quantity > 0 ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {selectedStock && selectedStock.quantity > 20 ? '✅ In Stock'
                                                : selectedStock && selectedStock.quantity > 0 ? '⚠️ Low Stock'
                                                    : '❌ Out of Stock'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            {selectedStock?.spesification && (
                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Specifications (Spesifikasi)
                                    </h4>
                                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedStock.spesification}
                                    </p>
                                </div>
                            )}

                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Timestamps
                                </h4>
                                <div className="space-y-2">
                                    {selectedStock?.created_at && (
                                        <div>
                                            <p className="text-xs text-slate-700 mb-1">Created At</p>
                                            <p className="font-bold text-gray-900">{format(new Date(selectedStock.created_at), 'MMM dd, yyyy HH:mm')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
                                <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                                    <Info className="h-5 w-5" />
                                    Stock ID
                                </h4>
                                <p className="font-mono text-xs text-gray-600 break-all">{selectedStock?.id}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex flex-wrap gap-3 justify-end">
                        <button
                            onClick={() => setShowStockDetailModal(false)}
                            className="px-5 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-white transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                setShowStockDetailModal(false);
                                handleOpenStockTrackModal(selectedStock!);
                            }}
                            className="px-5 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
                        >
                            View Track Record
                        </button>
                        <button
                            onClick={() => {
                                setShowStockDetailModal(false);
                                handleOpenStockModal(selectedStock!);
                            }}
                            className="px-5 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                        >
                            Edit Stock
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // 3. Stock Track Record Modal
    const StockTrackModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold">{selectedStock?.nama}</h3>
                            <p className="text-sm opacity-90 mt-1">Track Record - Equipment Claims from This Stock</p>
                        </div>
                        <button
                            onClick={() => setShowStockTrackModal(false)}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {renderStockTrackRecord()}
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowStockTrackModal(false)}
                            className="px-5 py-2 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // 4. Claim Equipment Modal
    const ClaimModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full h-[85vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold">Claim Equipment from Stock</h3>
                        <button
                            onClick={() => {
                                setShowClaimModal(false);
                                setSelectedStockForClaim(null);
                                setSelectedRoomForClaim(null);
                                setEquipmentImagePreview('');
                            }}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <form onSubmit={claimForm.handleSubmit(handleClaimSubmit)} className="p-6 space-y-4 flex-1 overflow-y-auto">
                    {/* Stock Selection */}
                    <div>
                        <label className="block text-sm font-bold mb-2">Select Stock *</label>
                        <DropdownSearch
                            items={availableStocks}
                            selectedItem={selectedStockForClaim}
                            onSelect={(stock) => {
                                setSelectedStockForClaim(stock);
                                claimForm.setValue('stock_id', stock.id);
                                claimForm.setValue('quantity', 1);
                                setEquipmentImagePreview('');
                                supabase.from('stock').select('attachments').eq('id', stock.id).single()
                                    .then(({ data }) => {
                                        if (data?.attachments) {
                                            setEquipmentImagePreview(data.attachments);
                                            // Also update selectedStockForClaim to include the attachment
                                            setSelectedStockForClaim(prev => prev?.id === stock.id ? { ...prev, attachments: data.attachments } : prev);
                                        }
                                    });
                            }}
                            placeholder="Search by name or code..."
                            showCode
                            renderItem={(stock) => (
                                <div className="p-3 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-gray-900">{stock.nama}</div>
                                            <div className="text-xs text-gray-500 font-mono">{stock.code}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-purple-600">{stock.quantity} {stock.unit}</div>
                                            <div className="text-xs text-gray-500">{stock.category}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        />
                        {claimForm.formState.errors.stock_id && (
                            <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.stock_id.message}</p>
                        )}
                    </div>

                    {selectedStockForClaim && (
                        <>
                            {/* Room Selection */}
                            <div>
                                <label className="block text-sm font-bold mb-2">
                                    Pilih Ruangan *
                                </label>
                                <DropdownSearch
                                    items={availableRooms}
                                    selectedItem={selectedRoomForClaim}
                                    onSelect={(room) => {
                                        setSelectedRoomForClaim(room);
                                        claimForm.setValue('rooms_id', room.id);
                                    }}
                                    placeholder="Search rooms by name or code..."
                                    showCode
                                    renderItem={(room) => (
                                        <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-bold text-gray-900">{room.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{room.code}</div>
                                                </div>
                                                {room.department && (
                                                    <div className="text-xs text-blue-600">{room.department.name}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                />
                                {isDepartmentAdmin && claimForm.formState.errors.rooms_id && (
                                    <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.rooms_id.message}</p>
                                )}
                            </div>

                            {/* Cabinet Selection */}
                            {selectedRoomForClaim && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">Pilih Lemari (Opsional)</label>
                                    <DropdownSearch
                                        items={tables.filter(t => t.room_id === selectedRoomForClaim.id)}
                                        selectedItem={selectedTableForClaim}
                                        onSelect={(table) => {
                                            setSelectedTableForClaim(table);
                                            setSelectedRackForClaim(null);
                                            setSelectedBoxForClaim(null);
                                            claimForm.setValue('table_id', table.id);
                                            claimForm.setValue('rack_id', '');
                                            claimForm.setValue('box_id', '');
                                        }}
                                        placeholder="Select cabinet..."
                                        renderItem={(table) => (
                                            <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                                <div className="font-bold text-gray-900">{table.description}</div>
                                                <div className="text-xs text-gray-500">Rak: {table.rack}</div>
                                            </div>
                                        )}
                                    />
                                </div>
                            )}

                            {/* Rack Selection */}
                            {selectedTableForClaim && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">Pilih Rak (Opsional)</label>
                                    <DropdownSearch
                                        items={racks.filter(r => r.table_id === selectedTableForClaim.id)}
                                        selectedItem={selectedRackForClaim}
                                        onSelect={(rack) => {
                                            setSelectedRackForClaim(rack);
                                            setSelectedBoxForClaim(null);
                                            claimForm.setValue('rack_id', rack.id);
                                            claimForm.setValue('box_id', '');
                                        }}
                                        placeholder="Select rack..."
                                        renderItem={(rack) => (
                                            <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                                <div className="font-bold text-gray-900">{rack.name}</div>
                                            </div>
                                        )}
                                    />
                                </div>
                            )}

                            {/* Box Selection */}
                            {selectedRackForClaim && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">Pilih Box (Opsional)</label>
                                    <DropdownSearch
                                        items={boxes.filter(b => b.rack_id === selectedRackForClaim.id)}
                                        selectedItem={selectedBoxForClaim}
                                        onSelect={(box) => {
                                            setSelectedBoxForClaim(box);
                                            claimForm.setValue('box_id', box.id);
                                        }}
                                        placeholder="Select box..."
                                        renderItem={(box) => (
                                            <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                                <div className="font-bold text-gray-900">{box.name}</div>
                                                <div className="text-xs text-gray-500">{box.description}</div>
                                            </div>
                                        )}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">Equipment Name *</label>
                                    <input
                                        {...claimForm.register('name')}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                                    />
                                    {claimForm.formState.errors.name && (
                                        <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.name.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">Code *</label>
                                    <input
                                        {...claimForm.register('code')}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none font-mono transition-colors"
                                    />
                                    {claimForm.formState.errors.code && (
                                        <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.code.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">Quantity (Max: {maxClaimQuantity}) *</label>
                                    <input
                                        type="number"
                                        {...claimForm.register('quantity', { valueAsNumber: true })}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                                        min="1"
                                        max={maxClaimQuantity}
                                    />
                                    {claimForm.formState.errors.quantity && (
                                        <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.quantity.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">Condition *</label>
                                    <select
                                        {...claimForm.register('condition')}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                                    >
                                        <option value="GOOD">Good</option>
                                        <option value="BROKEN">Broken</option>
                                        <option value="MAINTENANCE">Maintenance</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2">Specifications (Optional)</label>
                                <textarea
                                    {...claimForm.register('Spesification')}
                                    rows={3}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                                    placeholder="Add specific details..."
                                />
                            </div>

                            {/* Equipment Photo - Defaults to Stock Photo */}
                            <div>
                                <label className="block text-sm font-bold mb-2">Equipment Photo</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-purple-400 transition-colors">
                                    {equipmentImagePreview ? (
                                        <div className="relative group">
                                            <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center relative">
                                                <ImageWithLoader
                                                    src={equipmentImagePreview}
                                                    alt="Preview"
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={clearEquipmentImage}
                                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            {equipmentImagePreview === selectedStockForClaim?.attachments && (
                                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                                                    Using Stock Photo
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center h-32 cursor-pointer">
                                            <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                            <span className="text-sm text-gray-500 font-medium">Click to upload photo</span>
                                            <span className="text-xs text-gray-400 mt-1">Max 5MB (JPG, PNG)</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleEquipmentImageChange}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        {...claimForm.register('is_mandatory')}
                                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-300"
                                    />
                                    <span className="text-sm font-medium">Mandatory Equipment</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        {...claimForm.register('is_available')}
                                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-300"
                                    />
                                    <span className="text-sm font-medium">Available for Lending</span>
                                </label>
                            </div>
                        </>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setShowClaimModal(false);
                                setSelectedStockForClaim(null);
                                setShowClaimModal(false);
                                setSelectedStockForClaim(null);
                                setSelectedRoomForClaim(null);
                                setEquipmentImagePreview('');
                            }}
                            className="px-6 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loadingEquipment || !selectedStockForClaim || !selectedRoomForClaim}
                            className="px-6 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors"
                        >
                            {loadingEquipment ? 'Claiming...' : 'Claim Equipment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    // 5. Edit Equipment Modal
    const EditModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold">Edit Equipment</h3>
                        <button
                            onClick={() => {
                                setShowEditModal(false);
                                setEditingEquipment(null);
                                setSelectedRoomForEdit(null);
                            }}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="p-6 space-y-4 flex-1 overflow-y-auto">
                    {/* Location Selection Block */}
                    <div>
                        <label className="block text-sm font-bold mb-2">
                            Pilih Ruangan *
                        </label>
                        <DropdownSearch
                            items={availableRooms}
                            selectedItem={selectedRoomForEdit}
                            onSelect={(room) => {
                                setSelectedRoomForEdit(room);
                                setSelectedTableForEdit(null);
                                setSelectedRackForEdit(null);
                                setSelectedBoxForEdit(null);
                                editForm.setValue('rooms_id', room.id);
                                editForm.setValue('table_id', '');
                                editForm.setValue('rack_id', '');
                                editForm.setValue('box_id', '');
                            }}
                            placeholder="Search rooms..."
                            showCode
                        />
                    </div>

                    {/* Cabinet Selection */}
                    {selectedRoomForEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2">Pilih Lemari (Opsional)</label>
                            <DropdownSearch
                                items={tables.filter(t => t.room_id === selectedRoomForEdit.id)}
                                selectedItem={selectedTableForEdit}
                                onSelect={(table) => {
                                    setSelectedTableForEdit(table);
                                    setSelectedRackForEdit(null);
                                    setSelectedBoxForEdit(null);
                                    editForm.setValue('table_id', table.id);
                                    editForm.setValue('rack_id', '');
                                    editForm.setValue('box_id', '');
                                }}
                                placeholder="Select cabinet..."
                                renderItem={(table) => (
                                    <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <div className="font-bold text-gray-900">{table.description}</div>
                                        <div className="text-xs text-gray-500">Rak: {table.rack}</div>
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    {/* Rack Selection */}
                    {selectedTableForEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2">Pilih Rak (Opsional)</label>
                            <DropdownSearch
                                items={racks.filter(r => r.table_id === selectedTableForEdit.id)}
                                selectedItem={selectedRackForEdit}
                                onSelect={(rack) => {
                                    setSelectedRackForEdit(rack);
                                    setSelectedBoxForEdit(null);
                                    editForm.setValue('rack_id', rack.id);
                                    editForm.setValue('box_id', '');
                                }}
                                placeholder="Select rack..."
                                renderItem={(rack) => (
                                    <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <div className="font-bold text-gray-900">{rack.name}</div>
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    {/* Box Selection */}
                    {selectedRackForEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2">Pilih Box (Opsional)</label>
                            <DropdownSearch
                                items={boxes.filter(b => b.rack_id === selectedRackForEdit.id)}
                                selectedItem={selectedBoxForEdit}
                                onSelect={(box) => {
                                    setSelectedBoxForEdit(box);
                                    editForm.setValue('box_id', box.id);
                                }}
                                placeholder="Select box..."
                                renderItem={(box) => (
                                    <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <div className="font-bold text-gray-900">{box.name}</div>
                                        <div className="text-xs text-gray-500">{box.description}</div>
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Name *</label>
                            <input
                                {...editForm.register('name')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                            />
                            {editForm.formState.errors.name && (
                                <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.name.message}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Code *</label>
                            <input
                                {...editForm.register('code')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none font-mono transition-colors"
                            />
                            {editForm.formState.errors.code && (
                                <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.code.message}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Category *</label>
                        <select
                            {...editForm.register('category')}
                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                        >
                            <option value="">Select Category</option>
                            {categories.map(cat => (
                                <option key={cat.name} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                        {editForm.formState.errors.category && (
                            <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.category.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Quantity *</label>
                            <input
                                type="number"
                                {...editForm.register('quantity', { valueAsNumber: true })}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Unit *</label>
                            <input
                                {...editForm.register('unit')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Condition *</label>
                            <select
                                {...editForm.register('condition')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                            >
                                <option value="GOOD">Good</option>
                                <option value="BROKEN">Broken</option>
                                <option value="MAINTENANCE">Maintenance</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Specifications</label>
                        <textarea
                            {...editForm.register('Spesification')}
                            rows={3}
                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                        />
                    </div>

                    {/* Equipment Photo Upload */}
                    <div>
                        <label className="block text-sm font-bold mb-2">Equipment Photo</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-amber-400 transition-colors">
                            {equipmentImagePreview ? (
                                <div className="relative group">
                                    <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center relative">
                                        <ImageWithLoader
                                            src={equipmentImagePreview}
                                            alt="Preview"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={clearEquipmentImage}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center h-32 cursor-pointer">
                                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-500 font-medium">Click to upload photo</span>
                                    <span className="text-xs text-gray-400 mt-1">Max 5MB (JPG, PNG)</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleEquipmentImageChange}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                {...editForm.register('is_mandatory')}
                                className="w-5 h-5 text-amber-600 rounded focus:ring-2 focus:ring-amber-300"
                            />
                            <span className="text-sm font-medium">Mandatory</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                {...editForm.register('is_available')}
                                className="w-5 h-5 text-amber-600 rounded focus:ring-2 focus:ring-amber-300"
                            />
                            <span className="text-sm font-medium">Available</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setShowEditModal(false);
                                setEditingEquipment(null);
                                setSelectedRoomForEdit(null);
                            }}
                            className="px-6 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loadingEquipment || !selectedRoomForEdit}
                            className="px-6 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                        >
                            {loadingEquipment ? 'Updating...' : 'Update'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    // 6. Equipment Detail Modal
    const EquipmentDetailModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold">{selectedEquipment?.name}</h3>
                            <p className="text-sm opacity-90 mt-1">Complete Equipment Information</p>
                        </div>
                        <button
                            onClick={() => setShowDetailModal(false)}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Equipment Photo Banner */}
                    {selectedEquipment?.attachments ? (
                        <div className="relative rounded-xl overflow-hidden shadow-lg h-64 group">
                            <ImageWithLoader
                                src={selectedEquipment.attachments}
                                alt={selectedEquipment.name}
                                className="w-full h-full object-cover"
                                title={selectedEquipment.name}
                                subtitle={selectedEquipment.code}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                                <div>
                                    <h4 className="text-white font-bold text-2xl drop-shadow-md">{selectedEquipment.name}</h4>
                                    <p className="text-white/80 text-sm font-mono mt-1">{selectedEquipment.code}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setEquipmentImagePreview(selectedEquipment.attachments || '');
                                        setShowEquipmentImageFullscreen(true);
                                    }}
                                    className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white transition-all shadow-lg border border-white/10"
                                    title="View Fullscreen"
                                >
                                    <Maximize2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-8 text-center border-2 border-dashed border-purple-100">
                            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                                <Image className="h-10 w-10 text-purple-400 opacity-60" />
                            </div>
                            <h4 className="font-bold text-xl text-gray-800">{selectedEquipment?.name}</h4>
                            <p className="text-purple-400 text-sm mt-2 font-medium italic">No photo available</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Basic Information
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-blue-700 mb-1">Equipment Name</p>
                                        <p className="font-bold text-gray-900">{selectedEquipment?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-700 mb-1">Equipment Code</p>
                                        <p className="font-mono font-bold text-gray-900">{selectedEquipment?.code}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-700 mb-1">Category</p>
                                        <p className="font-bold text-gray-900">{selectedEquipment?.category}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                                <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                                    <Database className="h-5 w-5" />
                                    Quantity & Unit
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-purple-700 mb-1">Quantity</p>
                                        <p className="text-2xl font-bold text-purple-900">{selectedEquipment?.quantity}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-700 mb-1">Unit</p>
                                        <p className="font-bold text-gray-900">{selectedEquipment?.unit}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                                <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                                    <MapPin className="h-5 w-5" />
                                    Location
                                </h4>
                                <div className="space-y-3">
                                    {/* Campus */}
                                    {(selectedEquipment?.rooms as any)?.building?.campus?.name && (
                                        <div>
                                            <p className="text-xs text-green-700 mb-1">Campus</p>
                                            <p className="font-bold text-gray-900">{(selectedEquipment?.rooms as any).building.campus.name}</p>
                                        </div>
                                    )}
                                    {/* Building */}
                                    {(selectedEquipment?.rooms as any)?.building?.name && (
                                        <div>
                                            <p className="text-xs text-green-700 mb-1">Building</p>
                                            <p className="font-bold text-gray-900">{(selectedEquipment?.rooms as any).building.name}</p>
                                        </div>
                                    )}
                                    {/* Floor */}
                                    {(selectedEquipment?.rooms as any)?.floor && (
                                        <div>
                                            <p className="text-xs text-green-700 mb-1">Floor</p>
                                            <p className="font-bold text-gray-900">Lantai {(selectedEquipment?.rooms as any).floor}</p>
                                        </div>
                                    )}
                                    {/* Room */}
                                    <div>
                                        <p className="text-xs text-green-700 mb-1">Room</p>
                                        <p className="font-bold text-gray-900">{selectedEquipment?.rooms?.name || 'No room assigned'}</p>
                                    </div>
                                    {selectedEquipment?.rooms?.code && (
                                        <div>
                                            <p className="text-xs text-green-700 mb-1">Room Code</p>
                                            <p className="font-mono font-bold text-gray-900">{selectedEquipment.rooms.code}</p>
                                        </div>
                                    )}
                                    {selectedEquipment?.rooms?.department && (
                                        <div>
                                            <p className="text-xs text-green-700 mb-1">Department</p>
                                            <p className="font-bold text-blue-900">{selectedEquipment.rooms.department.name}</p>
                                        </div>
                                    )}
                                    {(() => {
                                        // Infer hierarchy for cabinet/rack/box
                                        const box = boxes.find(b => b.id === selectedEquipment?.box_id);
                                        const rackId = selectedEquipment?.rack_id || box?.rack_id;
                                        const rack = racks.find(r => r.id === rackId);
                                        const tableId = selectedEquipment?.table_id || rack?.table_id;
                                        const table = tables.find(t => t.id === tableId);

                                        return (
                                            <>
                                                {table && (
                                                    <div>
                                                        <p className="text-xs text-green-700 mb-1">Lemari/Meja</p>
                                                        <p className="font-bold text-gray-900">{table.description}</p>
                                                    </div>
                                                )}
                                                {rack && (
                                                    <div>
                                                        <p className="text-xs text-green-700 mb-1">Rak</p>
                                                        <p className="font-bold text-gray-900">{rack.name}</p>
                                                    </div>
                                                )}
                                                {box && (
                                                    <div>
                                                        <p className="text-xs text-green-700 mb-1">Box</p>
                                                        <p className="font-bold text-gray-900">{box.name}</p>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
                                <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Status & Condition
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-amber-700 mb-1">Condition</p>
                                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold ${selectedEquipment && getConditionBadge(selectedEquipment.condition).bg} ${selectedEquipment && getConditionBadge(selectedEquipment.condition).text}`}>
                                            {selectedEquipment && (() => {
                                                const Badge = getConditionBadge(selectedEquipment.condition);
                                                const Icon = Badge.icon;
                                                return <><Icon className="h-4 w-4" /> {Badge.label}</>;
                                            })()}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-amber-700 mb-1">Availability</p>
                                        <p className="font-bold text-gray-900">
                                            {selectedEquipment?.is_available ? '✅ Available for Lending' : '❌ Not Available'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-amber-700 mb-1">Mandatory</p>
                                        <p className="font-bold text-gray-900">
                                            {selectedEquipment?.is_mandatory ? '⭐ Yes - Required Equipment' : 'No - Optional'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {selectedEquipment?.Spesification && (
                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Specifications
                                    </h4>
                                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedEquipment.Spesification}
                                    </p>
                                </div>
                            )}

                            {selectedEquipment?.stock && (
                                <div className="bg-gradient-to-r from-cyan-50 to-cyan-100 p-4 rounded-xl border border-cyan-200">
                                    <h4 className="font-bold text-cyan-900 mb-3 flex items-center gap-2">
                                        <Warehouse className="h-5 w-5" />
                                        Source Stock
                                    </h4>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-cyan-700 mb-1">Stock Name</p>
                                            <p className="font-bold text-gray-900">{selectedEquipment.stock.nama}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-cyan-700 mb-1">Stock Code</p>
                                            <p className="font-mono font-bold text-gray-900">{selectedEquipment.stock.code}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-cyan-700 mb-1">Remaining in Stock</p>
                                            <p className="font-bold text-gray-900">{selectedEquipment.stock.quantity} {selectedEquipment.stock.unit}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Timestamps
                                </h4>
                                <div className="space-y-2">
                                    {selectedEquipment?.created_at && (
                                        <div>
                                            <p className="text-xs text-slate-700 mb-1">Created At</p>
                                            <p className="font-bold text-gray-900">{format(new Date(selectedEquipment.created_at), 'MMM dd, yyyy HH:mm')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex flex-wrap gap-3 justify-end">
                        <button
                            onClick={() => setShowDetailModal(false)}
                            className="px-5 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-white transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                setShowDetailModal(false);
                                handleOpenEditModal(selectedEquipment!);
                            }}
                            className="px-5 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
                        >
                            Edit Equipment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // 7. Equipment Track Record Modal (Gap Analysis)
    const TrackRecordModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold">{selectedEquipment?.name}</h3>
                            <p className="text-sm opacity-90 mt-1">Gap Analysis - Missing Items Tracker</p>
                        </div>
                        <button
                            onClick={() => setShowTrackRecordModal(false)}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {renderSimpleGapAnalysis()}
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowTrackRecordModal(false)}
                            className="px-5 py-2 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // 8. Direct Add Equipment Modal
    const handleDirectAddSubmit = async (data: EquipmentEditForm) => {
        try {
            setLoadingEquipment(true);

            // Generate UUID for new equipment
            const newId = crypto.randomUUID();

            const { error } = await supabase
                .from('equipment')
                .insert({
                    id: newId,
                    name: data.name,
                    code: data.code,
                    category: data.category,
                    quantity: data.quantity,
                    unit: data.unit,
                    condition: data.condition,
                    rooms_id: data.rooms_id,
                    table_id: data.table_id || null,
                    rack_id: data.rack_id || null,
                    box_id: data.box_id || null,
                    is_mandatory: data.is_mandatory,
                    is_available: data.is_available,
                    Spesification: data.Spesification,
                    attachments: equipmentImagePreview || null,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;

            toast.success('Equipment added successfully');
            setShowDirectAddModal(false);
            editForm.reset();

            // Reload data
            const loadData = async () => {
                // Re-using the logic from useEffect roughly, or just reloading window/component? 
                // Better to refactor loadInitialData outside useEffect but for now let's just trigger a reload or manually fetch.
                // We will trigger a manual fetch here similar to initial load
                window.location.reload(); // Simplest way to ensure everything stays in sync for now
            };
            loadData();

        } catch (error: any) {
            console.error('Error adding equipment:', error);
            toast.error(error.message || 'Failed to add equipment');
        } finally {
            setLoadingEquipment(false);
        }
    };

    const DirectAddModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold">Add New Equipment</h3>
                        <button
                            onClick={() => {
                                setShowDirectAddModal(false);
                                editForm.reset();
                            }}
                            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <form onSubmit={editForm.handleSubmit(handleDirectAddSubmit)} className="p-6 space-y-4 flex-1 overflow-y-auto">
                    {/* Reusing Edit Form Fields logic since schema is same */}
                    {/* Location Selection Block */}
                    <div>
                        <label className="block text-sm font-bold mb-2">
                            Select Room *
                        </label>
                        <DropdownSearch
                            items={isLaboratory && profile?.department_id
                                ? rooms.filter(r => r.department_id === profile.department_id)
                                : rooms
                            }
                            selectedItem={selectedRoomForEdit}
                            onSelect={(room) => {
                                setSelectedRoomForEdit(room);
                                setSelectedTableForEdit(null);
                                setSelectedRackForEdit(null);
                                setSelectedBoxForEdit(null);
                                editForm.setValue('rooms_id', room.id);
                                editForm.setValue('table_id', '');
                                editForm.setValue('rack_id', '');
                                editForm.setValue('box_id', '');
                            }}
                            placeholder="Search rooms..."
                            showCode
                        />
                    </div>

                    {/* Cabinet Selection */}
                    {selectedRoomForEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2">Select Cabinet (Optional)</label>
                            <DropdownSearch
                                items={tables.filter(t => t.room_id === selectedRoomForEdit.id)}
                                selectedItem={selectedTableForEdit}
                                onSelect={(table) => {
                                    setSelectedTableForEdit(table);
                                    setSelectedRackForEdit(null);
                                    setSelectedBoxForEdit(null);
                                    editForm.setValue('table_id', table.id);
                                    editForm.setValue('rack_id', '');
                                    editForm.setValue('box_id', '');
                                }}
                                placeholder="Select cabinet..."
                                renderItem={(table) => (
                                    <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <div className="font-bold text-gray-900">{table.description}</div>
                                        <div className="text-xs text-gray-500">Rack: {table.rack}</div>
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    {/* Rack Selection */}
                    {selectedTableForEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2">Select Rack (Optional)</label>
                            <DropdownSearch
                                items={racks.filter(r => r.table_id === selectedTableForEdit.id)}
                                selectedItem={selectedRackForEdit}
                                onSelect={(rack) => {
                                    setSelectedRackForEdit(rack);
                                    setSelectedBoxForEdit(null);
                                    editForm.setValue('rack_id', rack.id);
                                    editForm.setValue('box_id', '');
                                }}
                                placeholder="Select rack..."
                                renderItem={(rack) => (
                                    <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <div className="font-bold text-gray-900">{rack.name}</div>
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    {/* Box Selection */}
                    {selectedRackForEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2">Select Box (Optional)</label>
                            <DropdownSearch
                                items={boxes.filter(b => b.rack_id === selectedRackForEdit.id)}
                                selectedItem={selectedBoxForEdit}
                                onSelect={(box) => {
                                    setSelectedBoxForEdit(box);
                                    editForm.setValue('box_id', box.id);
                                }}
                                placeholder="Select box..."
                                renderItem={(box) => (
                                    <div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <div className="font-bold text-gray-900">{box.name}</div>
                                        <div className="text-xs text-gray-500">{box.description}</div>
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Name *</label>
                            <input
                                {...editForm.register('name')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"
                            />
                            {editForm.formState.errors.name && (
                                <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.name.message}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Code *</label>
                            <input
                                {...editForm.register('code')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none font-mono transition-colors"
                            />
                            {editForm.formState.errors.code && (
                                <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.code.message}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Category *</label>
                        <select
                            {...editForm.register('category')}
                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"
                        >
                            <option value="">Select Category</option>
                            {categories.map(cat => (
                                <option key={cat.name} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                        {editForm.formState.errors.category && (
                            <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.category.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Quantity *</label>
                            <input
                                type="number"
                                {...editForm.register('quantity', { valueAsNumber: true })}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Unit *</label>
                            <input
                                {...editForm.register('unit')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Condition *</label>
                            <select
                                {...editForm.register('condition')}
                                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"
                            >
                                <option value="GOOD">Good</option>
                                <option value="BROKEN">Broken</option>
                                <option value="MAINTENANCE">Maintenance</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">Specifications</label>
                        <textarea
                            {...editForm.register('Spesification')}
                            rows={3}
                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"
                        />
                    </div>

                    {/* Equipment Photo Upload */}
                    <div>
                        <label className="block text-sm font-bold mb-2">Equipment Photo</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-green-400 transition-colors">
                            {equipmentImagePreview ? (
                                <div className="relative group">
                                    <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                        <img
                                            src={equipmentImagePreview}
                                            alt="Preview"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={clearEquipmentImage}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center h-32 cursor-pointer">
                                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-500 font-medium">Click to upload photo</span>
                                    <span className="text-xs text-gray-400 mt-1">Max 5MB (JPG, PNG)</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleEquipmentImageChange}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                {...editForm.register('is_mandatory')}
                                className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-300"
                            />
                            <span className="text-sm font-medium">Mandatory</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                {...editForm.register('is_available')}
                                className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-300"
                            />
                            <span className="text-sm font-medium">Available</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setShowDirectAddModal(false);
                                editForm.reset();
                            }}
                            className="px-6 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loadingEquipment || !selectedRoomForEdit}
                            className="px-6 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                            {loadingEquipment ? 'Adding...' : 'Add Equipment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    // ==================== RENDER ====================
    if (!hasAccess) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h3>
                    <p className="text-gray-600">You don't have permission</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Inventory Management</h1>
                        <p className="opacity-90">Manage warehouse stock and equipment</p>
                    </div>
                    <div className="flex gap-4">
                        {/* Stock count - hidden for laboratory */}
                        {!isLaboratory && (
                            <div className="text-center bg-white bg-opacity-20 rounded-xl p-3">
                                <div className="text-2xl font-bold">{stocks.length}</div>
                                <div className="text-sm">Stocks</div>
                            </div>
                        )}
                        <div className="text-center bg-white bg-opacity-20 rounded-xl p-3">
                            <div className="text-2xl font-bold">{equipment.length}</div>
                            <div className="text-sm">Equipment</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-lg mb-6">
                <div className="border-b border-gray-200">
                    <nav className="flex">
                        {/* Stock Tab - hidden for laboratory */}
                        {!isLaboratory && (
                            <button
                                onClick={() => setActiveTab('stock')}
                                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 border-b-2 transition-all ${activeTab === 'stock'
                                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Warehouse className="h-5 w-5" />
                                Stock ({stocks.length})
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('equipment')}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 border-b-2 transition-all ${activeTab === 'equipment'
                                ? 'border-purple-500 text-purple-600 bg-purple-50'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Package className="h-5 w-5" />
                            Equipment ({equipment.length})
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {/* ==================== STOCK TAB ==================== */}
                    {/* Laboratory users cannot access stock tab */}
                    {activeTab === 'stock' && !isLaboratory && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search stock by name or code..."
                                        value={stockSearchTerm}
                                        onChange={(e) => setStockSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={() => handleOpenStockModal()}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-colors"
                                >
                                    <Plus className="h-5 w-5" />
                                    Add Stock
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredStocks.map(stock => {
                                    const categoryConfig = getCategoryConfig(stock.category);
                                    const Icon = categoryConfig.icon;

                                    return (
                                        <div key={stock.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className={`p-2 rounded-lg ${categoryConfig.color === 'violet' ? 'bg-violet-100 text-violet-600' :
                                                    categoryConfig.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                                                        categoryConfig.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                                                            categoryConfig.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                                                                categoryConfig.color === 'rose' ? 'bg-rose-100 text-rose-600' :
                                                                    categoryConfig.color === 'slate' ? 'bg-slate-100 text-slate-600' :
                                                                        'bg-orange-100 text-orange-600'
                                                    }`}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-sm font-bold ${stock.quantity > 20 ? 'bg-green-100 text-green-700'
                                                    : stock.quantity > 0 ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {stock.quantity} {stock.unit}
                                                </div>
                                            </div>

                                            <h3 className="font-bold text-lg mb-1">{stock.nama}</h3>
                                            <p className="text-sm text-gray-600 font-mono mb-3">{stock.code}</p>

                                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                                <div className="flex gap-2">
                                                    {/* Detail Button */}
                                                    <button
                                                        onClick={() => handleOpenStockDetailModal(stock)}
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    {/* Track Button */}
                                                    <button
                                                        onClick={() => handleOpenStockTrackModal(stock)}
                                                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                        title="Track Record"
                                                    >
                                                        <History className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleOpenStockModal(stock)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Delete this stock?')) {
                                                                handleDeleteStock(stock.id);
                                                            }
                                                        }}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ==================== EQUIPMENT TAB ==================== */}
                    {activeTab === 'equipment' && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search equipment by name or code..."
                                        value={equipmentSearchTerm}
                                        onChange={(e) => setEquipmentSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            editForm.reset();
                                            editForm.setValue('quantity', 1);
                                            setEquipmentImagePreview('');
                                            setShowDirectAddModal(true);
                                        }}
                                        className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium transition-colors"
                                    >
                                        <Plus className="h-5 w-5" />
                                        Add Equipment
                                    </button>
                                    <button
                                        onClick={handleOpenClaimModal}
                                        disabled={!canClaimEquipment}
                                        className="flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 font-medium disabled:opacity-50 transition-colors"
                                    >
                                        <PackagePlus className="h-5 w-5" />
                                        {isLaboratory ? 'Claim Stock' : 'Claim Equipment'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredEquipment.map(eq => {
                                    const categoryConfig = getCategoryConfig(eq.category);
                                    const Icon = categoryConfig.icon;
                                    const conditionBadge = getConditionBadge(eq.condition);
                                    const ConditionIcon = conditionBadge.icon;

                                    return (
                                        <div key={eq.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className={`p-2 rounded-lg ${categoryConfig.color === 'violet' ? 'bg-violet-100 text-violet-600' :
                                                    categoryConfig.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                                                        categoryConfig.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                                                            categoryConfig.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                                                                categoryConfig.color === 'rose' ? 'bg-rose-100 text-rose-600' :
                                                                    categoryConfig.color === 'slate' ? 'bg-slate-100 text-slate-600' :
                                                                        'bg-orange-100 text-orange-600'
                                                    }`}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${conditionBadge.bg} ${conditionBadge.text}`}>
                                                    <ConditionIcon className="h-3 w-3" />
                                                    {conditionBadge.label}
                                                </div>
                                            </div>

                                            <h3 className="font-bold text-lg mb-1">{eq.name}</h3>
                                            <p className="text-sm text-gray-600 font-mono mb-2">{eq.code}</p>
                                            <p className="text-sm text-gray-500 mb-3">{eq.rooms?.name || 'No room'}</p>

                                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleOpenDetailModal(eq)}
                                                        className="flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 rounded-lg px-2 py-1 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenTrackRecordModal(eq)}
                                                        className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-1 transition-colors"
                                                        title="Track Record"
                                                    >
                                                        <History className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleOpenEditModal(eq)}
                                                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Delete this equipment?')) {
                                                                handleDeleteEquipment(eq.id);
                                                            }
                                                        }}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Render Modals */}
            {showStockModal && <StockModal />}
            {showStockDetailModal && selectedStock && <StockDetailModal />}
            {showStockTrackModal && selectedStock && <StockTrackModal />}
            {showClaimModal && <ClaimModal />}
            {showEditModal && editingEquipment && <EditModal />}
            {showDetailModal && selectedEquipment && <EquipmentDetailModal />}
            {showTrackRecordModal && selectedEquipment && <TrackRecordModal />}
            {showDirectAddModal && <DirectAddModal />}

            {/* Fullscreen Image Modals */}
            {showStockImageFullscreen && stockImagePreview && (
                <div
                    className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setShowStockImageFullscreen(false)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
                        onClick={() => setShowStockImageFullscreen(false)}
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <img
                        src={stockImagePreview}
                        alt="Fullscreen Preview"
                        className="max-w-full max-h-screen object-contain"
                    />
                </div>
            )}

            {showEquipmentImageFullscreen && equipmentImagePreview && (
                <div
                    className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setShowEquipmentImageFullscreen(false)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
                        onClick={() => setShowEquipmentImageFullscreen(false)}
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <img
                        src={equipmentImagePreview}
                        alt="Fullscreen Preview"
                        className="max-w-full max-h-screen object-contain"
                    />
                </div>
            )}
        </div>
    );
};

export default ToolAdministration;