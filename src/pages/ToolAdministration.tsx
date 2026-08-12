import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import EquipmentImportModal from '../components/EquipmentImport/EquipmentImportModal';
import { useDebouncedCallback } from 'use-debounce';
import logoUNY from '../assets/logouny.png';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';

export const parseEquipmentSpec = (spec: string | null) => {
    if (!spec) return { purchaseYear: '', procurementType: '', specs: '' };
    const pyMatch = spec.match(/\[Tahun Pembelian\]:\s*([^\n]*)/);
    const ptMatch = spec.match(/\[Jenis Pengadaan\]:\s*([^\n]*)/);
    const specMatch = spec.match(/\[Spesifikasi\]:\s*([\s\S]*)/);

    const purchaseYear = pyMatch && pyMatch[1] ? pyMatch[1].trim() : '';
    const procurementType = ptMatch && ptMatch[1] ? ptMatch[1].trim() : '';
    
    // For specs, we want to grab everything after [Spesifikasi]: if it exists,
    // otherwise fallback to full spec if it doesn't have our tags.
    const specs = specMatch && specMatch[1] 
        ? specMatch[1].trim() 
        : (pyMatch || ptMatch ? '' : spec.trim());

    return { purchaseYear, procurementType, specs };
};

export const fetchLatestMutationsMap = async (): Promise<Record<string, any>> => {
    const mutationMap: Record<string, any> = {};

    try {
        // 1. Fetch latest mutations from Supabase equipment_mutations
        const { data: dbMutations } = await supabase
            .from('equipment_mutations')
            .select(`
                equipment_id,
                new_room_id,
                created_at,
                equipment:equipment_id(id, name, code),
                new_room:new_room_id(id, name, code, floor, department:departments(id, name, code), building:building_id(name, campus:campus_id(name)))
            `)
            .order('created_at', { ascending: false })
            .limit(2000);

        if (dbMutations) {
            dbMutations.forEach((m: any) => {
                const roomObj = m.new_room ? {
                    id: m.new_room.id,
                    name: m.new_room.name,
                    code: m.new_room.code || '',
                    floor: m.new_room.floor || null,
                    building: m.new_room.building || null,
                    department: m.new_room.department || null
                } : null;

                if (roomObj) {
                    const override = { rooms_id: m.new_room_id, rooms: roomObj, created_at: m.created_at };
                    if (m.equipment_id && !mutationMap[m.equipment_id]) mutationMap[m.equipment_id] = override;
                    if (m.equipment?.code && !mutationMap[m.equipment.code]) mutationMap[m.equipment.code] = override;
                    if (m.equipment?.name && !mutationMap[m.equipment.name]) mutationMap[m.equipment.name] = override;
                }
            });
        }
    } catch (e) {
        console.warn('[MutationMap] Error fetching DB mutations:', e);
    }

    // 2. Merge local_equipment_mutations
    try {
        const localMutationsStr = localStorage.getItem('local_equipment_mutations');
        if (localMutationsStr) {
            const localMutations = JSON.parse(localMutationsStr);
            localMutations.forEach((m: any) => {
                const eqId = m.equipment_id || m.equipment?.id;
                const eqCode = m.equipment?.code;
                const eqName = m.equipment?.name;
                const roomObj = m.new_room ? {
                    id: m.new_room_id || m.new_room.id,
                    name: m.new_room.name,
                    code: m.new_room.code || '',
                    building: m.new_room.building || null,
                    floor: m.new_room.floor || null,
                    department: m.new_room.department || null
                } : null;

                if (roomObj) {
                    const override = { rooms_id: roomObj.id, rooms: roomObj, created_at: m.created_at };
                    const keys = [eqId, eqCode, eqName].filter(Boolean);
                    keys.forEach(k => {
                        const existing = mutationMap[k];
                        const localTime = new Date(m.created_at || 0).getTime();
                        const existingTime = existing ? new Date(existing.created_at || 0).getTime() : 0;
                        if (!existing || localTime >= existingTime) {
                            mutationMap[k] = override;
                        }
                    });
                }
            });
        }
    } catch (e) {
        console.warn('[MutationMap] Error parsing local mutations:', e);
    }

    // 3. Merge local_equipment_room_overrides
    try {
        const localOverridesStr = localStorage.getItem('local_equipment_room_overrides');
        if (localOverridesStr) {
            const overrides = JSON.parse(localOverridesStr);
            Object.keys(overrides).forEach(key => {
                if (overrides[key]) {
                    mutationMap[key] = overrides[key];
                }
            });
        }
    } catch (e) {
        console.warn('[MutationMap] Error parsing room overrides:', e);
    }

    return mutationMap;
};

export const getLatestEquipmentRoomOverride = (
    eqId?: string | null,
    eqCode?: string | null,
    eqName?: string | null
) => {
    try {
        // 1. Check explicit local_equipment_room_overrides
        const localOverridesStr = localStorage.getItem('local_equipment_room_overrides');
        if (localOverridesStr) {
            const overrides = JSON.parse(localOverridesStr);
            const ov = (eqId && overrides[eqId]) || (eqCode && overrides[eqCode]) || (eqName && overrides[eqName]);
            if (ov) return ov;
        }

        // 2. Fallback: Check local_equipment_mutations for the newest mutation matching id/code/name
        const localMutationsStr = localStorage.getItem('local_equipment_mutations');
        if (localMutationsStr) {
            const mutations = JSON.parse(localMutationsStr);
            const sorted = [...mutations].sort(
                (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            );

            const match = sorted.find((m: any) => {
                const mEqId = m.equipment_id || m.equipment?.id;
                const mEqCode = m.equipment?.code;
                const mEqName = m.equipment?.name;

                if (eqId && mEqId && String(mEqId) === String(eqId)) return true;
                if (eqCode && mEqCode && String(mEqCode).toLowerCase() === String(eqCode).toLowerCase()) return true;
                if (eqName && mEqName && String(mEqName).toLowerCase() === String(eqName).toLowerCase()) return true;
                return false;
            });

            if (match && match.new_room) {
                return {
                    rooms_id: match.new_room_id || match.new_room.id,
                    rooms: {
                        id: match.new_room_id || match.new_room.id,
                        name: match.new_room.name,
                        code: match.new_room.code || '',
                        building: match.new_room.building || null,
                        floor: match.new_room.floor || null,
                        department: match.new_room.department || null
                    }
                };
            }
        }
    } catch (e) {
        console.warn('Error computing equipment room override:', e);
    }
    return null;
};

export const formatEquipmentSpec = (purchaseYear: string, procurementType: string, specs: string) => {
    if (!purchaseYear && !procurementType && !specs) return '';
    
    let parts = [];
    if (purchaseYear) parts.push(`[Tahun Pembelian]: ${purchaseYear}`);
    if (procurementType) parts.push(`[Jenis Pengadaan]: ${procurementType}`);
    if (specs) parts.push(`[Spesifikasi]: ${specs}`);
    
    return parts.join('\n');
};

const getImageDataUrl = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// ==================== TYPES ====================
interface Stock {
    id: string;
    nama: string;
    code: string;
    category: string;
    spesification?: string;
    quantity: number;
    unit: string;
    attachments?: string;
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
        booking_id?: string;
        lendingTool_id?: string;
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

// Detail Equipment interface - for the detail_equipment table
interface DetailEquipment {
    id: string;
    equipment_id: string;
    name: string;
    code: string;
    quantity: number;
    unit: string;
    condition: string;
    attachments?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
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
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        setIsLoading(true);
        setHasError(false);

        // Check if image is already loaded (e.g. from cache or immediate data URI)
        if (imgRef.current && imgRef.current.complete) {
            setIsLoading(false);
        }
    }, [src]);

    if (hasError) {
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-500 ${className}`}>
                <AlertTriangle className="w-10 h-10 mb-2 opacity-50" />
                <span className="text-sm font-medium">Gagal memuat</span>
            </div>
        );
    }

    return (
        <>
            {isLoading && <PhotoPlaceholder title={title} subtitle={subtitle} />}
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                }}
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
    items, selectedItem, onSelect, placeholder, searchPlaceholder = 'Search...',
    disabled = false, className = '', renderItem, showCode = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const filteredItems = items.filter(item => {
        const itemName = item?.name || item?.nama || item?.description || '';
        const itemCode = item?.code || '';
        const search = searchTerm.toLowerCase();
        return itemName.toLowerCase().includes(search) || itemCode.toLowerCase().includes(search);
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
        const displayName = item?.name || item?.nama || item?.description || 'Unknown';
        const displayCode = item?.code || '';
        return (
            <div className="flex items-center justify-between p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-all">
                <div className="flex-1">
                    <div className="font-medium text-gray-900">{displayName}</div>
                    {showCode && displayCode && <div className="text-xs text-gray-500 font-mono mt-1">{displayCode}</div>}
                </div>
                {selectedItem?.id === item.id && <Check className="h-5 w-5 text-blue-600" />}
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
                className={`w-full px-4 py-3 text-left bg-white border-2 rounded-xl shadow-sm flex items-center justify-between transition-all ${disabled ? 'bg-gray-100 text-gray-400 border-gray-200' : 'border-gray-300 hover:border-blue-500 focus:border-blue-500'}`}
            >
                <div className="flex items-center space-x-3">
                    {selectedItem ? (
                        <>
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Tag className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <div className="font-medium text-gray-900">{selectedDisplayName}</div>
                                {showCode && selectedDisplayCode && <div className="text-xs text-gray-500 font-mono">{selectedDisplayCode}</div>}
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
                                <div key={item.id} onClick={() => { onSelect(item); setIsOpen(false); setSearchTerm(''); }}>
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
    return z.object({
        stock_id: z.string().min(1, 'Please select a stock item'),
        name: z.string().min(2, 'Equipment name must be at least 2 characters'),
        code: z.string().min(2, 'NUP Number must be at least 2 characters'),
        quantity: z.number().min(1, 'Minimum quantity is 1').max(maxQuantity, `Maximum available: ${maxQuantity}`),
        is_mandatory: z.boolean().optional(),
        is_available: z.boolean().optional(),
        condition: z.enum(['GOOD', 'BROKEN', 'MAINTENANCE']).default('GOOD'),
        Spesification: z.string().optional(),
        purchase_year: z.string().optional(),
        procurement_type: z.string().optional(),
        table_id: z.string().optional(),
        rack_id: z.string().optional(),
        box_id: z.string().optional(),
        rooms_id: z.string().min(1, 'Please select a room location'),
    });
};

const createEquipmentEditSchema = (userRole: string) => {
    return z.object({
        name: z.string().min(2, 'Equipment name must be at least 2 characters'),
        code: z.string().min(2, 'NUP Number must be at least 2 characters'),
        category: z.string().min(1, 'Please select a category'),
        is_mandatory: z.boolean().optional(),
        is_available: z.boolean().optional(),
        condition: z.enum(['GOOD', 'BROKEN', 'MAINTENANCE']).default('GOOD'),
        Spesification: z.string().optional(),
        purchase_year: z.string().optional(),
        procurement_type: z.string().optional(),
        quantity: z.number().min(0, 'Quantity cannot be negative'),
        unit: z.string().min(1, 'Unit is required'),
        table_id: z.string().optional(),
        rack_id: z.string().optional(),
        box_id: z.string().optional(),
        // rooms_id dibuat optional agar equipment tanpa room masih bisa di-edit
        rooms_id: z.string().optional(),
    });
};

type EquipmentClaimForm = z.infer<ReturnType<typeof createEquipmentClaimSchema>>;
type EquipmentEditForm = z.infer<ReturnType<typeof createEquipmentEditSchema>>;

// ==================== MAIN COMPONENT ====================
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new window.Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Stricter Max dimensions for performance
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 600;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Reduce quality to 0.5
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                console.log('📸 Compressed image size:', dataUrl.length, 'chars (~', Math.round(dataUrl.length / 1024), 'KB)');
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

const ToolAdministration: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();

    const [activeTab, setActiveTab] = useState<'stock' | 'equipment'>(
        profile?.role === 'laboratory' ? 'equipment' : 'stock'
    );

    // Stock states
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [loadingStocks, setLoadingStocks] = useState(true);
    const [stockSearchTerm, setStockSearchTerm] = useState('');
    const [debouncedStockSearch, setDebouncedStockSearch] = useState('');
    const [stockCategoryFilter, setStockCategoryFilter] = useState<string>('all');
    const [totalStocks, setTotalStocks] = useState(0);
    const [stockPage, setStockPage] = useState(1);
    const itemsPerPage = 10;

    // Equipment states
    const [equipment, setEquipment] = useState<EquipmentWithDetails[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tables, setTables] = useState<Tabel[]>([]);
    const [racks, setRacks] = useState<Rack[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [loadingEquipment, setLoadingEquipment] = useState(true);
    const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
    const [debouncedEquipmentSearch, setDebouncedEquipmentSearch] = useState('');
    const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState<string>('all');
    const [roomFilter, setRoomFilter] = useState<string>('all');
    const [totalEquipment, setTotalEquipment] = useState(0);
    const [equipmentPage, setEquipmentPage] = useState(1);

    // Modal states
    const [showStockModal, setShowStockModal] = useState(false);
    const [showStockDetailModal, setShowStockDetailModal] = useState(false);
    const [showStockTrackModal, setShowStockTrackModal] = useState(false);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showTrackRecordModal, setShowTrackRecordModal] = useState(false);
    const [showDirectAddModal, setShowDirectAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [loadingDetailModal, setLoadingDetailModal] = useState(false);
    const [showStockQRModal, setShowStockQRModal] = useState(false);
    const [selectedStockForQR, setSelectedStockForQR] = useState<Stock | null>(null);
    const [isDownloadingStockQR, setIsDownloadingStockQR] = useState(false);

    // Equipment QR Code State
    const [showEquipmentQRModal, setShowEquipmentQRModal] = useState(false);
    const [selectedEquipmentForQR, setSelectedEquipmentForQR] = useState<EquipmentWithDetails | null>(null);
    const [isDownloadingEquipmentQR, setIsDownloadingEquipmentQR] = useState(false);

    // Selected items
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithDetails | null>(null);
    const [editingStock, setEditingStock] = useState<Stock | null>(null);
    const [editingEquipment, setEditingEquipment] = useState<EquipmentWithDetails | null>(null);

    // Track record states
    const [lendingDetails, setLendingDetails] = useState<LendingDetail[]>([]);
    const [loadingTrack, setLoadingTrack] = useState(false);
    const [stockTrackRecords, setStockTrackRecords] = useState<StockTrackRecord[]>([]);
    const [loadingStockTrack, setLoadingStockTrack] = useState(false);

    // Image states
    const [stockImagePreview, setStockImagePreview] = useState<string>('');
    const [showStockImageFullscreen, setShowStockImageFullscreen] = useState(false);
    const [equipmentImagePreview, setEquipmentImagePreview] = useState<string>('');
    const [originalEquipmentImage, setOriginalEquipmentImage] = useState<string>('');
    const [photoExplicitlyRemoved, setPhotoExplicitlyRemoved] = useState(false);
    const [loadingImage, setLoadingImage] = useState(false);
    const [showEquipmentImageFullscreen, setShowEquipmentImageFullscreen] = useState(false);
    const [showDetailImageFullscreen, setShowDetailImageFullscreen] = useState(false);
    const [detailFullscreenImage, setDetailFullscreenImage] = useState('');

    // File input refs - prevents scroll jump when clicking upload
    const editFileInputRef = useRef<HTMLInputElement>(null);
    const addFileInputRef = useRef<HTMLInputElement>(null);
    const claimFileInputRef = useRef<HTMLInputElement>(null);

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

    // Detail Equipment states - for the detail_equipment table
    const [detailEquipments, setDetailEquipments] = useState<DetailEquipment[]>([]);
    const [loadingDetailEquipments, setLoadingDetailEquipments] = useState(false);
    const [showDetailEquipmentModal, setShowDetailEquipmentModal] = useState(false);
    const [editingDetailEquipment, setEditingDetailEquipment] = useState<DetailEquipment | null>(null);
    const [detailEquipmentForm, setDetailEquipmentForm] = useState({
        name: '',
        code: '',
        quantity: 1,
        unit: 'pcs',
        condition: 'GOOD',
        notes: '',
        attachments: ''
    });
    const [detailImagePreview, setDetailImagePreview] = useState<string>('');
    const [loadingDetailImage, setLoadingDetailImage] = useState(false);
    const detailFileInputRef = useRef<HTMLInputElement>(null);


    // Debounced Search Handlers
    const handleStockSearch = useDebouncedCallback((value: string) => {
        setDebouncedStockSearch(value);
        setStockPage(1);
    }, 500);

    const handleEquipmentSearch = useDebouncedCallback((value: string) => {
        setDebouncedEquipmentSearch(value);
        setEquipmentPage(1);
    }, 500);

    // Forms
    const stockForm = useForm<StockForm>({
        resolver: zodResolver(stockSchema),
        defaultValues: { quantity: 1 },
    });

    const maxClaimQuantity = selectedStockForClaim?.quantity || 1;
    const equipmentClaimSchema = useMemo(() => createEquipmentClaimSchema(maxClaimQuantity, profile?.role || 'student'), [maxClaimQuantity, profile?.role]);
    const equipmentEditSchema = useMemo(() => createEquipmentEditSchema(profile?.role || 'student'), [profile?.role]);

    const claimForm = useForm<EquipmentClaimForm>({
        resolver: zodResolver(equipmentClaimSchema),
        defaultValues: { is_mandatory: false, is_available: true, condition: 'GOOD', quantity: 1 },
    });

    const editForm = useForm<EquipmentEditForm>({
        resolver: zodResolver(equipmentEditSchema),
        defaultValues: { is_mandatory: false, is_available: true, condition: 'GOOD', quantity: 1 },
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
    const isTechnician = profile?.role === 'technician';
    const hasAccess = isSuperAdmin || isDepartmentAdmin || isLaboratory || isPurchasing || isTechnician;

    // ==================== INITIAL DATA LOADING ====================
    useEffect(() => {
        if (!hasAccess) return;

        const loadInitialData = async () => {
            try {
                setLoadingStocks(true); // Initial loading state
                setLoadingEquipment(true); // Initial loading state

                let roomsQuery = supabase.from('rooms').select('id, name, code, department_id, study_program_ids, department:departments(id, name, code)');
                if (isDepartmentAdmin && profile?.department_id) {
                    roomsQuery = roomsQuery.eq('department_id', profile.department_id);
                }

                const [
                    { data: roomsData, error: roomsError },
                    { data: tablesData, error: tablesError },
                    { data: racksData, error: racksError },
                    { data: boxesData, error: boxesError }
                ] = await Promise.all([
                    roomsQuery.order('name'),
                    supabase.from('table').select('id, room_id, description, rack'),
                    supabase.from('rack').select('id, name, table_id').order('name'),
                    supabase.from('box').select('id, name, description, rack_id').order('name')
                ]);

                if (roomsError) throw roomsError;
                if (tablesError) throw tablesError;
                if (racksError) throw racksError;
                if (boxesError) throw boxesError;

                // setStocks called separately via fetchStocks
                // setStocks(stocksData || []);
                setTables(tablesData || []);
                setRacks(racksData || []);
                setBoxes(boxesData || []);

                let filteredRooms = roomsData || [];
                // Laboratory filter: STRICT filtering
                // - Room must have department_id = user's department_id (NOT NULL required)
                // - If room has study_program_id (NOT NULL), must match user's study_program_id
                // - No general/shared rooms (dept or study_program is null = not shown)
                if (isLaboratory) {
                    const laborDeptId = profile?.department_id;
                    const laborStudyProgramId = profile?.study_program_id;

                    if (laborDeptId) {
                        filteredRooms = filteredRooms.filter((room: any) => {
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
                    } else {
                        // No department_id on user = no rooms
                        filteredRooms = [];
                    }
                }
                setRooms(filteredRooms as any);

                // Equipment fetching moved to fetchEquipment
                // We just set loading to false here to allow the specific fetchers to take over
                // or we can leave them true until the specific fetchers finish...
                // Actually, the specific fetchers will set loading to true/false.

            } catch (error) {
                console.error('Error loading initial data:', error);
                toast.error('Failed to load data');
            } finally {
                // We don't turn off loading here because fetchStocks/fetchEquipment will handle their own loading states
                // But we should probably turn them off if we errored out early?
                // For safety, let's leave them as controlled by the specific fetchers.
                // However, to ensure UI doesn't get stuck if this crashes:
                // setLoadingStocks(false);
                // setLoadingEquipment(false);
            }
        };

        loadInitialData();
    }, [profile, hasAccess]); // Removed fetchStocks/fetchEquipment from here to avoid loops if we added them

    // ==================== STOCK TRACK RECORD ====================
    // Note: ensure fetchStockTrackRecord is below this block or correctly placed.

    // ==================== STOCK TRACK RECORD ====================
    // ==================== FETCHING LOGIC ====================
    const fetchStocks = useCallback(async () => {
        if (!hasAccess) return;
        try {
            setLoadingStocks(true);
            let query = supabase.from('stock')
                .select('*', { count: 'exact' });

            if (debouncedStockSearch) {
                query = query.or(`nama.ilike.%${debouncedStockSearch}%,code.ilike.%${debouncedStockSearch}%`);
            }

            if (stockCategoryFilter !== 'all') {
                query = query.eq('category', stockCategoryFilter);
            }

            // Pagination
            const from = (stockPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            query = query.range(from, to).order('created_at', { ascending: false });

            const { data, count, error } = await query;

            if (error) throw error;
            setStocks(data || []);
            setTotalStocks(count || 0);
        } catch (error) {
            console.error('Error fetching stocks:', error);
            toast.error('Failed to load stocks');
        } finally {
            setLoadingStocks(false);
        }
    }, [debouncedStockSearch, stockCategoryFilter, stockPage, hasAccess, itemsPerPage]);

    // ==================== STOCK TRACK RECORD ====================
    const fetchStockTrackRecord = async (stockId: string) => {
        try {
            setLoadingStockTrack(true);
            const { data: equipmentData, error: equipmentError } = await supabase
                .from('equipment')
                .select(`id, name, code, quantity, condition, created_at, rooms:rooms_id(id, name, code, department:departments(id, name, code))`)
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

    const fetchEquipment = useCallback(async () => {
        if (!hasAccess) return;
        try {
            setLoadingEquipment(true);

            // Base query - include department_id and study_program_id from equipment table
            let query = supabase
                .from('equipment')
                .select(`id, name, code, category, quantity, unit, condition, created_at, table_id, rack_id, box_id, is_mandatory, is_available, Spesification, rooms_id, department_id, study_program_id, rooms:rooms_id(id, name, code, department_id, study_program_ids, floor, department:departments(id, name, code)), stock:stock_id(id, nama, code, category, quantity, unit)`, { count: 'exact' });

            // Search
            if (debouncedEquipmentSearch) {
                query = query.or(`name.ilike.%${debouncedEquipmentSearch}%,code.ilike.%${debouncedEquipmentSearch}%`);
            }

            // Filters
            if (equipmentCategoryFilter !== 'all') {
                query = query.eq('category', equipmentCategoryFilter);
            }

            if (roomFilter !== 'all') {
                query = query.eq('rooms_id', roomFilter);
            }

            // Role-based filtering:
            // - Super Admin & Purchasing: See ALL equipment
            // - Laboratory: Filter by department_id and study_program_id directly from equipment table
            // - Department Admin: Filter by department_id
            if (isLaboratory) {
                const laborDeptId = profile?.department_id;
                const laborStudyProgramId = profile?.study_program_id;

                console.log('========== LABORAN EQUIPMENT FILTER DEBUG ==========');
                console.log('User Profile:', profile);
                console.log('User Role:', profile?.role);
                console.log('User Dept ID:', laborDeptId);
                console.log('User Prodi ID:', laborStudyProgramId);

                if (laborDeptId) {
                    query = query.eq('department_id', laborDeptId);
                    
                    if (laborStudyProgramId) {
                        query = query.or(`study_program_id.is.null,study_program_id.eq.${laborStudyProgramId}`);
                    }
                } else {
                    console.log('WARNING: User has no department_id!');
                    setEquipment([]);
                    setTotalEquipment(0);
                    setLoadingEquipment(false);
                    return;
                }
            } else if (isDepartmentAdmin && profile?.department_id) {
                query = query.eq('department_id', profile.department_id);
            }

            // Pagination logic
            let from = (equipmentPage - 1) * itemsPerPage;
            let to = from + itemsPerPage - 1;

            // Apply pagination directly to DB query for all users
            query = query.range(from, to);

            query = query.order('created_at', { ascending: false });

            const { data, count, error } = await query;

console.log('========== QUERY RESULT ==========');
            console.log('Count (from DB):', count);

            if (error) throw error;

            let finalData = data || [];            // Apply room overrides from DB mutations + local mutations + local overrides
            try {
                const mutationMap = await fetchLatestMutationsMap();
                finalData = finalData.map((item: any) => {
                    const ov = mutationMap[item.id] || (item.code ? mutationMap[item.code] : null) || (item.name ? mutationMap[item.name] : null);
                    if (ov) {
                        return {
                            ...item,
                            rooms_id: ov.rooms_id || item.rooms_id,
                            rooms: ov.rooms || (ov.room_name ? { id: ov.rooms_id, name: ov.room_name, code: ov.room_code } : item.rooms)
                        };
                    }
                    return item;
                });
            } catch (err) {
                console.warn('Error applying room overrides to equipment in ToolAdministration:', err);
            }

            // No more in-memory filter and pagination needed!
            setTotalEquipment(count || 0);

            setEquipment(finalData);

        } catch (error) {
            console.error('Error fetching equipment:', error);
            toast.error('Failed to load equipment');
        } finally {
            setLoadingEquipment(false);
        }
    }, [debouncedEquipmentSearch, equipmentCategoryFilter, roomFilter, equipmentPage, hasAccess, itemsPerPage, isLaboratory, isDepartmentAdmin, profile?.department_id, profile?.study_program_id]);

    // Re-fetch equipment location when a mutation occurs or window comes into focus
    useEffect(() => {
        const handleUpdate = () => {
            fetchEquipment();
        };
        window.addEventListener('equipment-location-updated', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('equipment-location-updated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [fetchEquipment]);

    // Force sync activeTab for Laboran to ensure they land on Equipment tab
    useEffect(() => {
        if (profile?.role === 'laboratory' && activeTab === 'stock') {
            setActiveTab('equipment');
        }
    }, [profile, activeTab]);




    useEffect(() => {
        if (activeTab === 'stock') {
            fetchStocks();
        }
    }, [fetchStocks, activeTab]);

    useEffect(() => {
        if (activeTab === 'equipment') {
            fetchEquipment();
        }
    }, [fetchEquipment, activeTab]);


    // ==================== DETAIL EQUIPMENT CRUD ====================
    // Fetch detail equipment items for a specific equipment
    const fetchDetailEquipments = async (equipmentId: string) => {
        try {
            setLoadingDetailEquipments(true);
            const { data, error } = await supabase
                .from('detail_equipment')
                .select('*')
                .eq('equipment_id', equipmentId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDetailEquipments(data || []);
        } catch (error) {
            console.error('Error fetching detail equipment:', error);
            toast.error(getText('Failed to load detail equipment', 'Gagal memuat detail peralatan'));
            setDetailEquipments([]);
        } finally {
            setLoadingDetailEquipments(false);
        }
    };

    // Add new detail equipment
    const handleAddDetailEquipment = async () => {
        if (!selectedEquipment) return;
        try {
            setLoadingDetailEquipments(true);
            const { error } = await supabase.from('detail_equipment').insert({
                id: crypto.randomUUID(),
                equipment_id: selectedEquipment.id,
                name: detailEquipmentForm.name,
                code: detailEquipmentForm.code,
                quantity: detailEquipmentForm.quantity,
                unit: detailEquipmentForm.unit,
                condition: detailEquipmentForm.condition,
                notes: detailEquipmentForm.notes,
                attachments: detailImagePreview || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            if (error) throw error;
            toast.success(getText('Detail equipment added successfully', 'Detail peralatan berhasil ditambahkan'));
            setShowDetailEquipmentModal(false);
            setDetailEquipmentForm({ name: '', code: '', quantity: 1, unit: 'pcs', condition: 'GOOD', notes: '', attachments: '' });
            setDetailImagePreview('');
            await fetchDetailEquipments(selectedEquipment.id);
        } catch (error: any) {
            console.error('Error adding detail equipment:', error);
            toast.error(error.message || getText('Failed to add detail equipment', 'Gagal menambah detail peralatan'));
        } finally {
            setLoadingDetailEquipments(false);
        }
    };

    // Edit detail equipment
    const handleEditDetailEquipment = async () => {
        if (!editingDetailEquipment || !selectedEquipment) return;
        try {
            setLoadingDetailEquipments(true);
            const { error } = await supabase
                .from('detail_equipment')
                .update({
                    name: detailEquipmentForm.name,
                    code: detailEquipmentForm.code,
                    quantity: detailEquipmentForm.quantity,
                    unit: detailEquipmentForm.unit,
                    condition: detailEquipmentForm.condition,
                    notes: detailEquipmentForm.notes,
                    attachments: detailImagePreview || editingDetailEquipment.attachments || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingDetailEquipment.id);

            if (error) throw error;
            toast.success(getText('Detail equipment updated successfully', 'Detail peralatan berhasil diperbarui'));
            setShowDetailEquipmentModal(false);
            setEditingDetailEquipment(null);
            setDetailEquipmentForm({ name: '', code: '', quantity: 1, unit: 'pcs', condition: 'GOOD', notes: '', attachments: '' });
            setDetailImagePreview('');
            await fetchDetailEquipments(selectedEquipment.id);
        } catch (error: any) {
            console.error('Error editing detail equipment:', error);
            toast.error(error.message || getText('Failed to update detail equipment', 'Gagal memperbarui detail peralatan'));
        } finally {
            setLoadingDetailEquipments(false);
        }
    };

    // Delete detail equipment
    const handleDeleteDetailEquipment = async (detailId: string) => {
        if (!selectedEquipment) return;
        const result = await Swal.fire({
            title: getText('Delete Detail?', 'Hapus Detail?'),
            text: getText('This action cannot be undone!', 'Aksi ini tidak dapat dibatalkan!'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: getText('Yes, Delete', 'Ya, Hapus'),
            cancelButtonText: getText('Cancel', 'Batal')
        });
        if (!result.isConfirmed) return;

        try {
            setLoadingDetailEquipments(true);
            const { error } = await supabase.from('detail_equipment').delete().eq('id', detailId);
            if (error) throw error;
            toast.success(getText('Detail equipment deleted successfully', 'Detail peralatan berhasil dihapus'));
            await fetchDetailEquipments(selectedEquipment.id);
        } catch (error: any) {
            console.error('Error deleting detail equipment:', error);
            toast.error(error.message || getText('Failed to delete detail equipment', 'Gagal menghapus detail peralatan'));
        } finally {
            setLoadingDetailEquipments(false);
        }
    };

    // Open detail equipment modal for add
    const handleOpenAddDetailModal = () => {
        setEditingDetailEquipment(null);
        setDetailEquipmentForm({ name: '', code: '', quantity: 1, unit: 'pcs', condition: 'GOOD', notes: '', attachments: '' });
        setDetailImagePreview('');
        setShowDetailEquipmentModal(true);
    };

    // Open detail equipment modal for edit
    const handleOpenEditDetailModal = (detail: DetailEquipment) => {
        setEditingDetailEquipment(detail);
        setDetailEquipmentForm({
            name: detail.name,
            code: detail.code,
            quantity: detail.quantity,
            unit: detail.unit,
            condition: detail.condition,
            notes: detail.notes || '',
            attachments: detail.attachments || ''
        });
        setDetailImagePreview(detail.attachments || '');
        setShowDetailEquipmentModal(true);
    };

    // Handle detail equipment image upload
    const handleDetailImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error(getText('Please select an image file', 'Pilih file gambar'));
                return;
            }
            try {
                setLoadingDetailImage(true);
                const compressed = await compressImage(file);
                setDetailImagePreview(compressed);
            } catch (error) {
                console.error('Error compressing image:', error);
                toast.error(getText('Failed to process image', 'Gagal memproses gambar'));
            } finally {
                setLoadingDetailImage(false);
            }
        }
    };

    // Replaces the huge initial data loader logic for stocks/equipment
    // We still need loadInitialData for Rooms, Tables, Racks, Boxes within the main useEffect
    // Removing the stock/equipment fetching parts from the main useEffect below...
    const fetchGapAnalysis = async (equipmentId: string) => {
        try {
            setLoadingTrack(true);
            const allRecords: LendingDetail[] = [];

            // Fix 400 error: Query checkout_items directly instead of filtering via joined table
            const { data: checkoutItemsData, error: checkoutsError } = await supabase
                .from('checkout_items')
                .select(`
                    checkout_id, equipment_requested, equipment_quantities, equipment_back, quantities_back, status,
                    checkout:checkouts!inner (
                        id, user_id, booking_id, lendingTool_id, checkout_date, expected_return_date, actual_return_date, status, type, created_at
                    )
                `)
                .contains('equipment_requested', [equipmentId]);

            if (checkoutsError) console.error('Error fetching checkouts:', checkoutsError);

            if (checkoutItemsData && checkoutItemsData.length > 0) {
                const checkoutRecords = await Promise.all(
                    checkoutItemsData.map(async (item) => {
                        const checkout = item.checkout as any;
                        const checkoutItem = item;

                        if (!checkout) return null;

                        const eqIndex = checkoutItem.equipment_requested.findIndex((id: string) => id === equipmentId);
                        if (eqIndex === -1) return null;

                        const borrowedQty = checkoutItem.equipment_quantities[eqIndex] || 0;
                        const returnedQty = checkoutItem.quantities_back?.[eqIndex] || 0;
                        const missingQty = borrowedQty - returnedQty;

                        let userName = 'Unknown User', userEmail = 'No email', userIdentity = 'No ID', userData = null;

                        if (checkout.user_id) {
                            const { data: user } = await supabase.from('users').select('id, full_name, identity_number, email').eq('id', checkout.user_id).single();
                            if (user) { userData = user; userName = user.full_name; userEmail = user.email; userIdentity = user.identity_number; }
                        }

                        let source: 'lending_tool' | 'booking' = 'lending_tool';
                        let sourceId = checkout.lendingTool_id;
                        let dateString = checkout.checkout_date;

                        if (checkout.booking_id) {
                            source = 'booking';
                            sourceId = checkout.booking_id;
                            const { data: booking } = await supabase.from('bookings').select('start_time').eq('id', checkout.booking_id).single();
                            if (booking) dateString = booking.start_time;
                        } else if (checkout.lendingTool_id) {
                            const { data: lending } = await supabase.from('lending_tool').select('date').eq('id', checkout.lendingTool_id).single();
                            if (lending) dateString = lending.date;
                        }

                        return {
                            id: sourceId || checkout.id, date: dateString, borrowed_quantity: borrowedQty, returned_quantity: returnedQty,
                            missing_quantity: missingQty, status: checkout.status as any, created_at: checkout.checkout_date, source: source,
                            user: userData, user_name: userName, user_email: userEmail, user_identity: userIdentity,
                            checkout: {
                                id: checkout.id, checkout_date: checkout.checkout_date, expected_return_date: checkout.expected_return_date,
                                actual_return_date: checkout.actual_return_date, status: checkout.status, booking_id: checkout.booking_id, lendingTool_id: checkout.lendingTool_id
                            }
                        } as LendingDetail;
                    })
                );
                allRecords.push(...checkoutRecords.filter((r): r is LendingDetail => r !== null));
            }

            const { data: borrowedBookings, error: borrowedBookingsError } = await supabase
                .from('bookings')
                .select(`id, user_id, start_time, end_time, purpose, status, equipment_requested, equipment_quantities, created_at, user:users!user_id(id, full_name, identity_number, email)`)
                .in('status', ['borrow', 'borrowed', 'active'])
                .contains('equipment_requested', [equipmentId])
                .order('created_at', { ascending: false });

            if (borrowedBookingsError) console.error('Error fetching borrowed bookings:', borrowedBookingsError);

            if (borrowedBookings && borrowedBookings.length > 0) {
                for (const booking of borrowedBookings) {
                    const alreadyExists = allRecords.some(r => r.source === 'booking' && r.id === booking.id);
                    if (alreadyExists) continue;
                    const eqIndex = booking.equipment_requested?.findIndex((id: string) => id === equipmentId) ?? -1;
                    if (eqIndex === -1) continue;
                    const borrowedQty = booking.equipment_quantities?.[eqIndex] || 1;
                    const user = booking.user as any;
                    allRecords.push({
                        id: booking.id, date: booking.start_time, borrowed_quantity: borrowedQty, returned_quantity: 0,
                        missing_quantity: borrowedQty, status: 'borrow' as any, created_at: booking.created_at, source: 'booking',
                        user: user, user_name: user?.full_name || 'Unknown User', user_email: user?.email || 'No email',
                        user_identity: user?.identity_number || 'No ID', checkout: undefined
                    });
                }
            }

            const { data: borrowedLendings, error: borrowedLendingsError } = await supabase
                .from('lending_tool')
                .select('*')
                .in('status', ['borrow', 'borrowed', 'active'])
                .contains('id_equipment', [equipmentId])
                .order('created_at', { ascending: false });

            if (borrowedLendingsError) console.error('Error fetching borrowed lendings:', borrowedLendingsError);

            if (borrowedLendings && borrowedLendings.length > 0) {
                for (const lending of borrowedLendings) {
                    const alreadyExists = allRecords.some(r => r.source === 'lending_tool' && r.id === lending.id);
                    if (alreadyExists) continue;
                    const eqIndex = lending.id_equipment?.findIndex((id: string) => id === equipmentId) ?? -1;
                    if (eqIndex === -1) continue;
                    const borrowedQty = lending.qty?.[eqIndex] || 1;

                    // Manually fetch user since FK might not exist
                    let user: any = null;
                    // Check id_user first (standard for lending_tool), fallback to user_id
                    const userIdToFetch = lending.id_user || lending.user_id;

                    if (userIdToFetch) {
                        const { data: userData } = await supabase.from('users').select('id, full_name, identity_number, email').eq('id', userIdToFetch).single();
                        user = userData;
                    }

                    allRecords.push({
                        id: lending.id, date: lending.date, borrowed_quantity: borrowedQty, returned_quantity: 0,
                        missing_quantity: borrowedQty, status: 'borrow' as any, created_at: lending.created_at, source: 'lending_tool',
                        user: user, user_name: user?.full_name || 'Unknown User', user_email: user?.email || 'No email',
                        user_identity: user?.identity_number || 'No ID', checkout: undefined
                    });
                }
            }

            // Filter out records with 0 or negative missing quantity
            const filteredRecords = allRecords.filter(r => r.missing_quantity > 0);

            filteredRecords.sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
            setLendingDetails(filteredRecords);
        } catch (error) {
            console.error('Error in track record analysis:', error);
            toast.error('Failed to load track record');
            setLendingDetails([]);
        } finally {
            setLoadingTrack(false);
        }
    };

    // ==================== HANDLE RESOLVE GAP ====================
    // ==================== HANDLE RESOLVE GAP ====================
    const handleResolveGap = async (detail: LendingDetail) => {
        try {
            if (!selectedEquipment) return;

            // Scenario 1: Resolved via existing checkout
            if (detail.checkout) {
                const { data: currentItems, error: fetchError } = await supabase
                    .from('checkout_items').select('*').eq('checkout_id', detail.checkout.id).single();
                if (fetchError) throw fetchError;
                if (!currentItems) throw new Error('Checkout items not found');

                const eqIndex = currentItems.equipment_requested.findIndex((id: string) => id === selectedEquipment.id);
                if (eqIndex === -1) throw new Error('Equipment not found in checkout_items');

                const borrowedQty = currentItems.equipment_quantities[eqIndex];
                let quantitiesBack = currentItems.quantities_back || [];
                while (quantitiesBack.length <= eqIndex) quantitiesBack.push(0);
                quantitiesBack[eqIndex] = borrowedQty;

                const { error: updateItemsError } = await supabase
                    .from('checkout_items').update({ quantities_back: quantitiesBack, status: 'completed' }).eq('checkout_id', detail.checkout.id);
                if (updateItemsError) throw updateItemsError;

                const allReturned = currentItems.equipment_requested.every((eqId: string, idx: number) => {
                    const borrowed = currentItems.equipment_quantities[idx] || 0;
                    const returned = quantitiesBack[idx] || 0;
                    return returned >= borrowed;
                });

                if (allReturned) {
                    await supabase.from('checkouts').update({ status: 'completed', actual_return_date: new Date().toISOString() }).eq('id', detail.checkout.id);
                }

                if (detail.source === 'booking' && detail.checkout.booking_id) {
                    await supabase.from('bookings').update({ status: 'returned' }).eq('id', detail.checkout.booking_id);
                } else if (detail.source === 'lending_tool' && detail.checkout.lendingTool_id) {
                    await supabase.from('lending_tool').update({ status: 'returned', updated_at: new Date().toISOString() }).eq('id', detail.checkout.lendingTool_id);
                }

            } else {
                // Scenario 2: No checkout exists (Booking/Lending directly) - Create Checkout & Complete it
                if (!detail.id) throw new Error('Source ID missing');

                // Create checkout record
                const { data: newCheckout, error: createCheckoutError } = await supabase
                    .from('checkouts')
                    .insert({
                        user_id: detail.user?.id,
                        booking_id: detail.source === 'booking' ? detail.id : null,
                        lendingTool_id: detail.source === 'lending_tool' ? detail.id : null,
                        checkout_date: detail.created_at, // Use original borrowing date
                        expected_return_date: new Date().toISOString(), // Default to now as we are closing it
                        actual_return_date: new Date().toISOString(),
                        status: 'completed',
                        type: detail.source === 'booking' ? 'booking' : 'lending'
                    })
                    .select()
                    .single();

                if (createCheckoutError) throw createCheckoutError;

                // Create checkout items record
                const { error: createItemsError } = await supabase
                    .from('checkout_items')
                    .insert({
                        checkout_id: newCheckout.id,
                        equipment_requested: [selectedEquipment.id],
                        equipment_quantities: [detail.borrowed_quantity],
                        equipment_back: [selectedEquipment.id],
                        quantities_back: [detail.borrowed_quantity], // Returned full amount
                        status: 'completed'
                    });

                if (createItemsError) throw createItemsError;

                // Update original source status
                if (detail.source === 'booking') {
                    await supabase.from('bookings').update({ status: 'returned' }).eq('id', detail.id);
                } else if (detail.source === 'lending_tool') {
                    await supabase.from('lending_tool').update({ status: 'returned', updated_at: new Date().toISOString() }).eq('id', detail.id);
                }
            }

            // Common: Update Equipment Quantity
            const { data: currentEquipment } = await supabase.from('equipment').select('quantity').eq('id', selectedEquipment.id).single();
            if (currentEquipment) {
                const newQuantity = currentEquipment.quantity + detail.borrowed_quantity; // Add back the full borrowed amount (since missing = borrowed implies 0 returned previously) or use detail.missing_quantity
                // In Scenario 1: missing_quantity is correct.
                // In Scenario 2: missing_quantity = borrowed_quantity (since 0 returned). 
                // So using detail.missing_quantity is safer.
                await supabase.from('equipment').update({ quantity: currentEquipment.quantity + detail.missing_quantity, updated_at: new Date().toISOString() }).eq('id', selectedEquipment.id);
            }

            toast.success('Gap resolved & checkout created!');
            await fetchGapAnalysis(selectedEquipment.id);
        } catch (error: any) {
            console.error('Error resolving gap:', error);
            toast.error(error.message || 'Failed to resolve gap');
        }
    };

    // ==================== REAL-TIME UPDATES ====================
    useEffect(() => {
        if (!selectedEquipment) return;
        const checkoutSubscription = supabase
            .channel('gap_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'checkouts' }, () => fetchGapAnalysis(selectedEquipment.id))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'checkout_items' }, () => fetchGapAnalysis(selectedEquipment.id))
            .subscribe();
        return () => { checkoutSubscription.unsubscribe(); };
    }, [selectedEquipment?.id]);

    // ==================== MODAL OPEN HANDLERS ====================
    const handleOpenTrackRecordModal = async (eq: EquipmentWithDetails) => {
        setSelectedEquipment(eq);
        setShowTrackRecordModal(true);
        await fetchGapAnalysis(eq.id);
    };

    const handleOpenDetailModal = async (eq: EquipmentWithDetails) => {
        // Apply override if present
        const initialOv = getLatestEquipmentRoomOverride(eq.id, eq.code, eq.name);
        if (initialOv) {
            eq = {
                ...eq,
                rooms_id: initialOv.rooms_id || eq.rooms_id,
                rooms: initialOv.rooms || eq.rooms
            };
        }

        setSelectedEquipment(eq);
        setShowDetailModal(true);
        setLoadingDetailModal(true);
        setDetailEquipments([]); // Reset detail equipments
        try {
            const { data } = await supabase.from('equipment').select(`attachments, table_id, rack_id, box_id, is_mandatory, is_available, Spesification, rooms_id, rooms:rooms_id(id, name, code, department_id, study_program_ids, floor, department:departments(id, name, code), building:building_id(name, campus:campus_id(name)))`).eq('id', eq.id).single();
            if (data) {
                let mergedData: any = { ...data };
                const ov = getLatestEquipmentRoomOverride(eq.id, eq.code, eq.name);
                if (ov) {
                    mergedData.rooms_id = ov.rooms_id || mergedData.rooms_id;
                    mergedData.rooms = ov.rooms || mergedData.rooms;
                }
                setSelectedEquipment(prev => (prev?.id === eq.id ? { ...prev, ...mergedData } : prev));
            }
            // Fetch detail equipment items
            await fetchDetailEquipments(eq.id);
        } catch (e) { console.error('Error loading details:', e); }
        finally { setLoadingDetailModal(false); }
    };

    const handleOpenStockDetailModal = async (stock: Stock) => {
        setSelectedStock(stock);
        setShowStockDetailModal(true);
        try {
            const { data } = await supabase.from('stock').select('attachments').eq('id', stock.id).single();
            if (data) setSelectedStock(prev => (prev?.id === stock.id ? { ...prev, attachments: data.attachments } : prev));
        } catch (e) { console.error('Error loading attachment:', e); }
    };

    const handleOpenStockTrackModal = async (stock: Stock) => {
        setSelectedStock(stock);
        setShowStockTrackModal(true);
        await fetchStockTrackRecord(stock.id);
    };

    // ==================== IMAGE HANDLERS ====================
    const handleStockImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }

            try {
                // Compress image before setting state
                const compressed = await compressImage(file);
                setStockImagePreview(compressed);
                // Also update form dirty state or preview if needed
            } catch (error) {
                console.error('Error compressing image:', error);
                toast.error('Failed to process image');
            }
        }
        e.target.value = '';
    };

    const clearStockImage = () => setStockImagePreview('');

    const handleEquipmentImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }

            try {
                // Compress image before setting state
                const compressed = await compressImage(file);
                setEquipmentImagePreview(compressed);
            } catch (error) {
                console.error('Error compressing image:', error);
                toast.error('Failed to process image');
            }
        }
        e.target.value = '';
    };

    const clearEquipmentImage = () => {
        setEquipmentImagePreview('');
        setPhotoExplicitlyRemoved(true);
    };

    const handleOpenQRModal = (stock: Stock) => {
        setSelectedStockForQR(stock);
        setShowStockQRModal(true);
    };

    const downloadStockQR = async () => {
        const element = document.getElementById('stock-qr-card-element');
        if (!element || !selectedStockForQR) return;

        setIsDownloadingStockQR(true);

        setTimeout(async () => {
            try {
                const canvas = await html2canvas(element, {
                    backgroundColor: '#ffffff',
                    scale: 2
                });

                const link = document.createElement('a');
                link.download = `QR-STOK-${selectedStockForQR.nama.replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();

                toast.success(getText('QR Code downloaded successfully', 'QR Code berhasil diunduh'));
            } catch (error) {
                console.error('Error downloading QR:', error);
                toast.error(getText('Failed to download QR Code', 'Gagal mengunduh QR Code'));
            } finally {
                setIsDownloadingStockQR(false);
            }
        }, 500);
    };

    const handleOpenEquipmentQRModal = (eq: EquipmentWithDetails) => {
        setSelectedEquipmentForQR(eq);
        setShowEquipmentQRModal(true);
    };

    const downloadEquipmentQR = async () => {
        const element = document.getElementById('equipment-qr-card-element');
        if (!element || !selectedEquipmentForQR) return;

        setIsDownloadingEquipmentQR(true);

        setTimeout(async () => {
            try {
                const canvas = await html2canvas(element, {
                    backgroundColor: '#ffffff',
                    scale: 2
                });

                const link = document.createElement('a');
                link.download = `QR-ALAT-${selectedEquipmentForQR.name.replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();

                toast.success(getText('QR Code downloaded successfully', 'QR Code berhasil diunduh'));
            } catch (error) {
                console.error('Error downloading QR:', error);
                toast.error(getText('Failed to download QR Code', 'Gagal mengunduh QR Code'));
            } finally {
                setIsDownloadingEquipmentQR(false);
            }
        }, 500);
    };

    // ==================== MODAL HANDLERS ====================
    const handleOpenStockModal = async (stock?: Stock) => {
        setEditingStock(stock || null);
        if (stock) {
            stockForm.reset({ nama: stock.nama, code: stock.code, category: stock.category, spesification: stock.spesification || '', quantity: stock.quantity, unit: stock.unit });
            setStockImagePreview('');
            try {
                const { data } = await supabase.from('stock').select('attachments').eq('id', stock.id).single();
                if (data?.attachments) setStockImagePreview(data.attachments);
            } catch (e) { console.error(e); }
        } else {
            stockForm.reset({ quantity: 1 });
            setStockImagePreview('');
        }
        setShowStockModal(true);
    };

    const handleOpenClaimModal = () => {
        setSelectedStockForClaim(null);
        setSelectedRoomForClaim(null);
        setSelectedTableForClaim(null);
        setSelectedRackForClaim(null);
        setSelectedBoxForClaim(null);
        setEquipmentImagePreview('');
        claimForm.reset({ is_mandatory: false, is_available: true, condition: 'GOOD', quantity: 1 });
        setShowClaimModal(true);
    };

    const handleOpenEditModal = async (equipmentItem: EquipmentWithDetails) => {
        console.log('========================================');
        console.log('=== OPEN EDIT MODAL ===');
        console.log('========================================');
        console.log('Equipment item:', equipmentItem.id, equipmentItem.name);
        console.log('Equipment rooms_id:', equipmentItem.rooms_id);
        console.log('Equipment rooms:', equipmentItem.rooms);

        setEditingEquipment(equipmentItem);
        setSelectedRoomForEdit(equipmentItem.rooms || null);
        setEquipmentImagePreview('');
        setOriginalEquipmentImage('');
        setPhotoExplicitlyRemoved(false);
        setLoadingImage(true);

        try {
            const { data } = await supabase.from('equipment').select('attachments').eq('id', equipmentItem.id).single();
            let finalAttachment = '';

            if (data?.attachments) {
                const raw = data.attachments;

                // Decode Logic:
                // 1. Check if it is an Array
                if (Array.isArray(raw)) {
                    finalAttachment = raw[0] || '';
                }
                // 2. Check if it is a JSON String looking like an Array
                else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed) && parsed.length > 0) finalAttachment = parsed[0];
                        else finalAttachment = raw; // Fallback if parse result is not array
                    } catch (e) {
                        finalAttachment = raw; // Fallback if parse fails
                    }
                }
                // 3. Plain string
                else {
                    finalAttachment = raw as string;
                }
            }

            setEquipmentImagePreview(finalAttachment);
            setOriginalEquipmentImage(finalAttachment);
        } catch (e) { console.error(e); }
        finally { setLoadingImage(false); }

        const foundBox = boxes.find(b => b.id === equipmentItem.box_id);
        let rackId = equipmentItem.rack_id;
        if (!rackId && foundBox) rackId = foundBox.rack_id;
        const foundRack = racks.find(r => r.id === rackId);
        let tableId = equipmentItem.table_id;
        if (!tableId && foundRack) tableId = foundRack.table_id;
        const foundTable = tables.find(t => t.id === tableId);

        setSelectedBoxForEdit(foundBox || null);
        setSelectedRackForEdit(foundRack || null);
        setSelectedTableForEdit(foundTable || null);

        // Fallback: jika rooms_id tidak ada langsung, ambil dari relasi rooms.id
        const effectiveRoomsId = equipmentItem.rooms_id || equipmentItem.rooms?.id || '';
        console.log('Effective rooms_id:', effectiveRoomsId);

        const { purchaseYear, procurementType, specs } = parseEquipmentSpec(equipmentItem.Spesification || '');
        const formValues = {
            name: equipmentItem.name, code: equipmentItem.code, category: equipmentItem.category,
            is_mandatory: equipmentItem.is_mandatory ?? false, is_available: equipmentItem.is_available ?? true,
            condition: (equipmentItem.condition as any) || 'GOOD', Spesification: specs,
            purchase_year: purchaseYear,
            procurement_type: procurementType,
            quantity: equipmentItem.quantity, unit: equipmentItem.unit, rooms_id: effectiveRoomsId,
            table_id: tableId || '', rack_id: rackId || '', box_id: equipmentItem.box_id || '',
        };
        console.log('Form values to reset:', formValues);
        console.log('rooms_id value:', formValues.rooms_id);

        editForm.reset(formValues);
        setShowEditModal(true);
    };

    // ==================== FORM SUBMIT HANDLERS ====================
    const handleStockSubmit = async (data: StockForm) => {
        try {
            setLoadingStocks(true);
            const stockData = { nama: data.nama, code: data.code.toUpperCase(), category: data.category, spesification: data.spesification, quantity: data.quantity, unit: data.unit, attachments: stockImagePreview || null };

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

            const { data: newStocks } = await supabase.from('stock').select('id, nama, code, category, quantity, unit, spesification, created_at').order('created_at', { ascending: false });
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
            if (!selectedStockForClaim) { toast.error('Please select a stock item'); return; }
            if (isDepartmentAdmin && !selectedRoomForClaim) { toast.error('Room selection is required'); return; }

            setLoadingEquipment(true);
            const finalSpec = formatEquipmentSpec(data.purchase_year || '', data.procurement_type || '', data.Spesification || selectedStockForClaim.spesification || '');

            const equipmentData = {
                name: data.name, code: data.code.toUpperCase(), category: selectedStockForClaim.category,
                is_mandatory: data.is_mandatory ?? false, is_available: data.is_available ?? true, condition: data.condition,
                rooms_id: selectedRoomForClaim?.id || null, table_id: selectedTableForClaim?.id || null,
                rack_id: selectedRackForClaim?.id || null, box_id: selectedBoxForClaim?.id || null,
                Spesification: finalSpec, quantity: data.quantity,
                unit: selectedStockForClaim.unit, stock_id: selectedStockForClaim.id,
                attachments: equipmentImagePreview ? [equipmentImagePreview] : null,
                // Auto-copy department_id and study_program_id from selected room
                department_id: (selectedRoomForClaim as any)?.department_id || null,
                study_program_id: (selectedRoomForClaim as any)?.study_program_id || null,
            };

            const { error: equipmentError } = await supabase.from('equipment').insert([equipmentData]);
            if (equipmentError) throw equipmentError;

            const newStockQuantity = selectedStockForClaim.quantity - data.quantity;
            const { error: stockError } = await supabase.from('stock').update({ quantity: newStockQuantity }).eq('id', selectedStockForClaim.id);
            if (stockError) throw stockError;

            toast.success(`Successfully claimed ${data.quantity} ${selectedStockForClaim.unit}! ✨`);
            setShowClaimModal(false);
            setSelectedStockForClaim(null);
            setSelectedRoomForClaim(null);
            setEquipmentImagePreview('');
            claimForm.reset();

            await Promise.all([fetchStocks(), fetchEquipment()]);
        } catch (error: any) {
            console.error('Error claiming equipment:', error);
            toast.error(error.message || 'Failed to claim equipment');
        } finally {
            setLoadingEquipment(false);
        }
    };

    const handleEditSubmit = async (data: EquipmentEditForm) => {
        try {
            if (!editingEquipment) {
                Swal.fire('Error', 'No editingEquipment found!', 'error');
                return;
            }
            if (isDepartmentAdmin && !selectedRoomForEdit) {
                Swal.fire('Error', 'Room selection is required', 'error');
                return;
            }

            setLoadingEquipment(true);

            // Determine the attachments value:
            let attachmentsValue: string[] | null = null;
            if (equipmentImagePreview) {
                attachmentsValue = [equipmentImagePreview];
            } else if (!photoExplicitlyRemoved && originalEquipmentImage) {
                attachmentsValue = [originalEquipmentImage];
            }

            const finalSpec = formatEquipmentSpec(data.purchase_year || '', data.procurement_type || '', data.Spesification || '');

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
                Spesification: finalSpec,
                quantity: data.quantity,
                unit: data.unit,
                attachments: attachmentsValue,
                // Auto-copy department_id and study_program_id from selected room
                department_id: (selectedRoomForEdit as any)?.department_id || null,
                study_program_id: (selectedRoomForEdit as any)?.study_program_id || null,
            };

            const { error } = await supabase
                .from('equipment')
                .update(equipmentData)
                .eq('id', editingEquipment.id);

            if (error) throw error;

            Swal.fire('Success', 'Equipment updated successfully!', 'success');

            setShowEditModal(false);
            setEditingEquipment(null);
            setSelectedRoomForEdit(null);
            setEquipmentImagePreview('');
            setOriginalEquipmentImage('');
            setPhotoExplicitlyRemoved(false);
            editForm.reset();
            await fetchEquipment();
        } catch (error: any) {
            console.error('Error updating equipment:', error);
            Swal.fire('Error', error.message || 'Failed to update equipment', 'error');
        } finally {
            setLoadingEquipment(false);
        }
    };



    // ==================== DELETE HANDLERS ====================
    const handleDeleteStock = async (stockId: string) => {
        try {
            setLoadingStocks(true);
            const { data: usedEquipment } = await supabase.from('equipment').select('id').eq('stock_id', stockId).limit(1);
            if (usedEquipment && usedEquipment.length > 0) { toast.error('Cannot delete stock that is used by equipment'); return; }

            const { error } = await supabase.from('stock').delete().eq('id', stockId);
            if (error) throw error;
            toast.success('Stock deleted! 🗑️');
            fetchStocks();
        } catch (error: any) { console.error('Error deleting stock:', error); toast.error(error.message || 'Failed to delete stock'); }
        finally { setLoadingStocks(false); }
    };

    const handleDeleteEquipment = async (equipmentId: string) => {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            });

            if (!result.isConfirmed) return;

            setLoadingEquipment(true);
            const { error } = await supabase.from('equipment').delete().eq('id', equipmentId);

            if (error) {
                console.error('Supabase delete error:', error);
                throw error;
            }

            await Swal.fire(
                'Deleted!',
                'Your equipment has been deleted.',
                'success'
            );
            fetchEquipment();
        } catch (error: any) {
            console.error('Error deleting equipment:', error);
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: error.message || 'Failed to delete equipment',
            });
        } finally {
            setLoadingEquipment(false);
        }
    };

    // ==================== FILTER FUNCTIONS ====================
    // Server-side filtering handles most of this now.
    // We keep these memos to return the `stocks` and `equipment` arrays which represent the current page.
    const filteredStocks = useMemo(() => {
        return stocks;
    }, [stocks]);

    const filteredEquipment = useMemo(() => {
        return equipment;
    }, [equipment]);

    // Exclude Box and Cabinet from claimable stocks
    const availableStocks = useMemo(() => stocks.filter(stock => stock.quantity > 0 && stock.category !== 'Box' && stock.category !== 'Cabinet'), [stocks]);

    const availableRooms = useMemo(() => {
        if (isDepartmentAdmin && profile?.department_id) return rooms.filter(room => room.department_id === profile.department_id);
        return rooms;
    }, [rooms, isDepartmentAdmin, profile]);

    const canClaimEquipment = useMemo(() => {
        if (!hasAccess) return false;
        if (isSuperAdmin) return availableStocks.length > 0;
        if (isDepartmentAdmin || isLaboratory) return availableStocks.length > 0 && availableRooms.length > 0;
        return false;
    }, [hasAccess, isSuperAdmin, isDepartmentAdmin, isLaboratory, availableStocks, availableRooms]);

    // ==================== EXPORT PDF FUNCTION ====================
    // ==================== EXPORT PDF FUNCTION (ENHANCED) ====================
    const handleExportEquipmentPDF = async () => {
        try {
            if (filteredEquipment.length === 0) {
                toast.error(getText('No equipment to export', 'Tidak ada peralatan untuk diekspor'));
                return;
            }

            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const today = format(new Date(), 'dd MMM yyyy');
            const currentYear = new Date().getFullYear();

            // Load Logo
            const logoDataUrl = await getImageDataUrl(logoUNY);
            doc.addImage(logoDataUrl, 'PNG', 15, 15, 30, 30);

            // Letterhead
            let currentY = 20;
            const headerTextX = pageWidth / 2;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(14);
            doc.text("KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI", headerTextX, currentY, { align: 'center' });
            currentY += 5;
            doc.text("UNIVERSITAS NEGERI YOGYAKARTA", headerTextX, currentY, { align: 'center' });
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            currentY += 5;
            doc.text("FAKULTAS VOKASI", headerTextX, currentY, { align: 'center' });

            currentY += 5;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("Kampus I: Jalan Mandung No. 1 Pengasih, Kulon Progo Telp.(0274)774625", headerTextX, currentY, { align: 'center' });
            currentY += 4;
            doc.text("Kampus II: Pacarejo, Semanu, Gunungkidul Telp. (0274)5042222/(0274)5042255", headerTextX, currentY, { align: 'center' });
            currentY += 4;
            doc.text("Laman: https://fv.uny.ac.id E-mail: fv@uny.ac.id", headerTextX, currentY, { align: 'center' });
            currentY += 8;

            doc.setLineWidth(1);
            doc.line(10, currentY, pageWidth - 10, currentY);
            currentY += 10;

            // Title
            const title = `DAFTAR PERALATAN / EQUIPMENT LIST`;
            const subtitle = `Generated: ${today}`;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(title, headerTextX, currentY, { align: 'center' });
            currentY += 6;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(subtitle, headerTextX, currentY, { align: 'center' });
            currentY += 10;

            // Filter info if any
            if (equipmentSearchTerm || equipmentCategoryFilter !== 'all' || roomFilter !== 'all') {
                doc.setFontSize(9);
                let filterText = `${getText('Filter', 'Filter')}: `;
                const filters = [];
                if (equipmentSearchTerm) filters.push(`"${equipmentSearchTerm}"`);
                if (equipmentCategoryFilter !== 'all') filters.push(`${getText('Category', 'Kategori')}: ${equipmentCategoryFilter}`);
                if (roomFilter !== 'all') {
                    const room = rooms.find(r => r.id === roomFilter);
                    if (room) filters.push(`${getText('Room', 'Ruangan')}: ${room.name}`);
                }
                doc.text(filterText + filters.join(', '), 14, currentY);
                currentY += 6;
            }

            // Table Data
            const tableColumn = [
                'No',
                getText('Name', 'Nama'),
                getText('Code', 'Kode'),
                getText('Category', 'Kategori'),
                getText('Room', 'Ruangan'),
                getText('Condition', 'Kondisi'),
                getText('Qty', 'Jml'),
                getText('Unit', 'Satuan')
            ];

            const tableRows = filteredEquipment.map((eq, index) => [
                index + 1,
                eq.name,
                eq.code,
                eq.category,
                eq.rooms?.name || '-',
                eq.condition || '-',
                eq.quantity || 0,
                eq.unit || '-'
            ]);

            // Generate Table
            autoTable(doc, {
                startY: currentY,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    valign: 'middle',
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: [220, 220, 220],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    halign: 'center',
                    fontSize: 9
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { halign: 'left', cellWidth: 'auto' },
                    2: { halign: 'left', cellWidth: 35 },
                    3: { halign: 'left', cellWidth: 30 },
                    4: { halign: 'left', cellWidth: 40 },
                    5: { halign: 'center', cellWidth: 25 },
                    6: { halign: 'center', cellWidth: 15 },
                    7: { halign: 'center', cellWidth: 20 }
                },
                margin: { left: 14, right: 14 }
            });

            // Save
            const filenameDate = format(new Date(), 'yyyy-MM-dd');
            doc.save(`equipment_list_${filenameDate}.pdf`);

            toast.success(getText('PDF exported successfully', 'PDF berhasil diekspor'));
        } catch (error) {
            console.error('PDF Export Error:', error);
            toast.error('Gagal mengekspor PDF');
        }
    };

    // ==================== EXPORT STOCK TRACK RECORD PDF ====================
    // ==================== EXPORT STOCK TRACK RECORD PDF (ENHANCED) ====================
    const handleExportStockTrackPDF = async () => {
        try {
            if (!selectedStock || stockTrackRecords.length === 0) {
                toast.error(getText('No data to export', 'Tidak ada data untuk diekspor'));
                return;
            }

            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const today = format(new Date(), 'dd MMM yyyy');
            const totalClaimed = stockTrackRecords.reduce((sum, r) => sum + r.quantity_claimed, 0);

            // Load Logo
            const logoDataUrl = await getImageDataUrl(logoUNY);
            doc.addImage(logoDataUrl, 'PNG', 15, 15, 30, 30);

            // Letterhead
            let currentY = 20;
            const headerTextX = pageWidth / 2;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(14);
            doc.text("KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI", headerTextX, currentY, { align: 'center' });
            currentY += 5;
            doc.text("UNIVERSITAS NEGERI YOGYAKARTA", headerTextX, currentY, { align: 'center' });
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            currentY += 5;
            doc.text("FAKULTAS VOKASI", headerTextX, currentY, { align: 'center' });

            currentY += 5;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("Kampus I: Jalan Mandung No. 1 Pengasih, Kulon Progo Telp.(0274)774625", headerTextX, currentY, { align: 'center' });
            currentY += 4;
            doc.text("Kampus II: Pacarejo, Semanu, Gunungkidul Telp. (0274)5042222/(0274)5042255", headerTextX, currentY, { align: 'center' });
            currentY += 4;
            doc.text("Laman: https://fv.uny.ac.id E-mail: fv@uny.ac.id", headerTextX, currentY, { align: 'center' });
            currentY += 8;

            doc.setLineWidth(1);
            doc.line(10, currentY, pageWidth - 10, currentY);
            currentY += 10;

            // Title and Info
            const title = `REKAM JEJAK STOK / STOCK TRACK RECORD`;
            const subtitle = `Generated: ${today}`;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(title, headerTextX, currentY, { align: 'center' });
            currentY += 6;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(subtitle, headerTextX, currentY, { align: 'center' });
            currentY += 10;

            // Stock Details Block
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`${getText('Stock Name', 'Nama Stok')}: ${selectedStock.nama}`, 14, currentY);
            doc.text(`${getText('Code', 'Kode')}: ${selectedStock.code}`, 14, currentY + 5);
            doc.text(`${getText('Total Claimed', 'Total Diklaim')}: ${totalClaimed} ${selectedStock.unit}`, pageWidth / 2, currentY);
            doc.text(`${getText('Remaining Stock', 'Sisa Stok')}: ${selectedStock.quantity} ${selectedStock.unit}`, pageWidth / 2, currentY + 5);
            currentY += 12;

            // Table Data
            const tableColumn = [
                'No',
                getText('Equipment Name', 'Nama Peralatan'),
                getText('NUP Number', 'NOMOR NUP'),
                getText('Room', 'Ruangan'),
                getText('Condition', 'Kondisi'),
                getText('Qty', 'Jml')
            ];

            const tableRows = stockTrackRecords.map((record, index) => [
                index + 1,
                record.equipment_name,
                record.equipment_code,
                record.room_name || '-',
                record.condition,
                record.quantity_claimed
            ]);

            // Generate Table
            autoTable(doc, {
                startY: currentY,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    valign: 'middle',
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: [129, 90, 213], // Purple for Stock
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                    fontSize: 9
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { halign: 'left', cellWidth: 'auto' },
                    2: { halign: 'left', cellWidth: 35 },
                    3: { halign: 'left', cellWidth: 40 },
                    4: { halign: 'center', cellWidth: 25 },
                    5: { halign: 'center', cellWidth: 15 }
                },
                margin: { left: 14, right: 14 }
            });

            // Save
            const filenameDate = format(new Date(), 'yyyy-MM-dd');
            doc.save(`stock_track_${selectedStock.code}_${filenameDate}.pdf`);

            toast.success(getText('PDF exported successfully', 'PDF berhasil diekspor'));
        } catch (error) {
            console.error('PDF Export Error:', error);
            toast.error('Gagal mengekspor PDF');
        }
    };

    // ==================== HELPER FUNCTIONS ====================
    const getCategoryConfig = (categoryName: string) => categories.find(cat => cat.name === categoryName) || categories[0];

    const getConditionBadge = (condition: string) => {
        const configs = {
            GOOD: { icon: CheckCircle, label: 'Good', bg: 'bg-green-100', text: 'text-green-700' },
            BROKEN: { icon: XCircle, label: 'Broken', bg: 'bg-red-100', text: 'text-red-700' },
            MAINTENANCE: { icon: AlertTriangle, label: 'Maintenance', bg: 'bg-yellow-100', text: 'text-yellow-700' }
        };
        return configs[condition] || configs.GOOD;
    };

    const getSourceBadge = (source: string) => {
        if (source === 'booking') return { icon: Building, label: 'Booking', bg: 'bg-purple-100', text: 'text-purple-700' };
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
                    <p className="text-gray-600">{getText('Analyzing gaps...', 'Menganalisis gap...')}</p>
                </div>
            );
        }

        if (lendingDetails.length === 0) {
            return (
                <div className="text-center py-12 bg-green-50 rounded-xl border-2 border-green-200">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
                    <h4 className="text-lg font-bold text-green-800 mb-1">✅ {getText('All Clear!', 'Semua Bersih!')}</h4>
                    <p className="text-green-600">{getText('No missing items detected', 'Tidak ada barang hilang terdeteksi')}</p>
                </div>
            );
        }

        const gapsByUser = lendingDetails.reduce((acc, gap) => {
            const userName = gap.user_name || getText('Unknown User', 'Pengguna Tidak Dikenal');
            if (!acc[userName]) acc[userName] = [];
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
                                <h3 className="text-xl font-bold">{getText('Gap Detected', 'Gap Terdeteksi')}</h3>
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
                                            <p className="text-sm text-gray-600">{userGaps[0].user_identity || 'No ID'} • {userGaps[0].user_email || 'No email'}</p>
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
                                                            <SourceIcon className="h-3 w-3" />{sourceBadge.label}
                                                        </span>
                                                        {statusBadge && <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge.bg} ${statusBadge.text}`}>{statusBadge.label}</span>}
                                                        {!gap.checkout && <span className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-700">No Checkout</span>}
                                                    </div>
                                                    <div className="text-sm text-gray-600">📅 {format(new Date(gap.date), 'MMM dd, yyyy')}</div>
                                                    <div className="flex items-center gap-4 text-sm">
                                                        <span className="text-blue-600 font-medium">Borrowed: {gap.borrowed_quantity}</span>
                                                        <span className="text-green-600 font-medium">Returned: {gap.returned_quantity}</span>
                                                        <span className="text-red-600 font-bold">Missing: {gap.missing_quantity}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleResolveGap(gap)} className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm">
                                                    <CheckCircle className="h-4 w-4" />Resolve
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

    // ==================== RENDER STOCK TRACK RECORD ====================
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
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <History className="h-8 w-8" />
                            <div>
                                <h3 className="text-xl font-bold">Claim History</h3>
                                <p className="text-sm opacity-90">{stockTrackRecords.length} equipment items claimed</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold">{totalClaimed}</div>
                            <div className="text-sm opacity-90">Total {selectedStock?.unit} Claimed</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {stockTrackRecords.map((record, index) => {
                        const conditionBadge = getConditionBadge(record.condition);
                        const ConditionIcon = conditionBadge.icon;
                        return (
                            <div key={record.equipment_id} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">#{index + 1}</div>
                                                <div>
                                                    <h4 className="font-bold text-lg text-gray-900">{record.equipment_name}</h4>
                                                    <p className="text-sm text-gray-600 font-mono">{record.equipment_code}</p>
                                                </div>
                                            </div>
                                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border-2 border-green-200">
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                                                    <div className="flex-1">
                                                        <p className="text-xs font-bold text-green-700 mb-1">LOCATION</p>
                                                        {record.room_name ? (
                                                            <>
                                                                <p className="font-bold text-gray-900">{record.room_name}</p>
                                                                <p className="text-sm text-gray-600 font-mono">{record.room_code}</p>
                                                                {record.department_name && <p className="text-sm text-blue-600 mt-1">📍 {record.department_name}</p>}
                                                            </>
                                                        ) : (<p className="text-gray-500 italic">No room assigned</p>)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Clock className="h-4 w-4" />
                                                <span>Claimed on {format(new Date(record.claimed_at), 'MMM dd, yyyy HH:mm')}</span>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-2">
                                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border-2 border-blue-200">
                                                <p className="text-xs text-blue-700 mb-1">Quantity Claimed</p>
                                                <p className="text-3xl font-bold text-blue-900">{record.quantity_claimed}</p>
                                                <p className="text-xs text-blue-600">{selectedStock?.unit}</p>
                                            </div>
                                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${conditionBadge.bg} ${conditionBadge.text}`}>
                                                <ConditionIcon className="h-3 w-3" />{conditionBadge.label}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

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
                        <h3 className="text-2xl font-bold">{editingStock ? 'Edit Stock' : 'Add Stock'}</h3>
                        <button onClick={() => { setShowStockModal(false); setEditingStock(null); }} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>
                <form onSubmit={stockForm.handleSubmit(handleStockSubmit)} className="p-6 space-y-4 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Name *</label>
                            <input {...stockForm.register('nama')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors" />
                            {stockForm.formState.errors.nama && <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.nama.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Code *</label>
                            <input {...stockForm.register('code')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-mono transition-colors" />
                            {stockForm.formState.errors.code && <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.code.message}</p>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2">Category *</label>
                        <select {...stockForm.register('category')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors">
                            <option value="">Select Category</option>
                            {categories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                        </select>
                        {stockForm.formState.errors.category && <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.category.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Quantity *</label>
                            <input type="number" {...stockForm.register('quantity', { valueAsNumber: true })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors" />
                            {stockForm.formState.errors.quantity && <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.quantity.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Unit *</label>
                            <input {...stockForm.register('unit')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors" placeholder="pcs, set, box" />
                            {stockForm.formState.errors.unit && <p className="text-red-500 text-sm mt-1">{stockForm.formState.errors.unit.message}</p>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2">Specification</label>
                        <textarea {...stockForm.register('spesification')} rows={3} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2">Stock Photo</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-400 transition-colors">
                            {stockImagePreview ? (
                                <div className="space-y-3">
                                    <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                        <img src={stockImagePreview} alt="Preview" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex justify-center gap-3">
                                        <label className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-200 transition-colors">
                                            <Upload className="h-4 w-4" /><span className="text-sm font-medium">Ganti Foto</span>
                                            <input type="file" accept="image/*" onChange={handleStockImageChange} className="hidden" />
                                        </label>
                                        <button type="button" onClick={clearStockImage} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                                            <Trash2 className="h-4 w-4" /><span className="text-sm font-medium">Hapus</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center h-32 cursor-pointer">
                                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-500 font-medium">Click to upload photo</span>
                                    <span className="text-xs text-gray-400 mt-1">Max 5MB (JPG, PNG)</span>
                                    <input type="file" accept="image/*" onChange={handleStockImageChange} className="hidden" />
                                </label>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
                        <button type="button" onClick={() => { setShowStockModal(false); setEditingStock(null); }} className="px-6 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={loadingStocks} className="px-6 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors">
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
                        <button onClick={() => setShowStockDetailModal(false)} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"><X className="h-6 w-6" /></button>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {selectedStock?.attachments ? (
                        <div className="relative rounded-xl overflow-hidden shadow-lg h-64 group">
                            <ImageWithLoader src={selectedStock.attachments} alt={selectedStock.nama} className="w-full h-full object-cover" title={selectedStock.nama} subtitle={selectedStock.code} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                                <div>
                                    <h4 className="text-white font-bold text-2xl drop-shadow-md">{selectedStock.nama}</h4>
                                    <p className="text-white/80 text-sm font-mono mt-1">{selectedStock.code}</p>
                                </div>
                                <button onClick={() => { setStockImagePreview(selectedStock.attachments || ''); setShowStockImageFullscreen(true); }} className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white transition-all shadow-lg border border-white/10" title="View Fullscreen">
                                    <Maximize2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 text-center border-2 border-dashed border-blue-100">
                            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-sm"><Package className="h-10 w-10 text-indigo-400 opacity-60" /></div>
                            <h4 className="font-bold text-xl text-gray-800">{selectedStock?.nama}</h4>
                            <p className="text-indigo-400 text-sm mt-2 font-medium italic">No photo available</p>
                        </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2"><Package className="h-5 w-5" />Basic Information</h4>
                                <div className="space-y-3">
                                    <div><p className="text-xs text-blue-700 mb-1">Stock Name</p><p className="font-bold text-gray-900">{selectedStock?.nama}</p></div>
                                    <div><p className="text-xs text-blue-700 mb-1">Stock Code</p><p className="font-mono font-bold text-gray-900">{selectedStock?.code}</p></div>
                                    <div><p className="text-xs text-blue-700 mb-1">Category</p><p className="font-bold text-gray-900">{selectedStock?.category}</p></div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                                <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2"><Database className="h-5 w-5" />Inventory</h4>
                                <div className="space-y-3">
                                    <div><p className="text-xs text-purple-700 mb-1">Current Quantity</p><p className="text-3xl font-bold text-purple-900">{selectedStock?.quantity}</p></div>
                                    <div><p className="text-xs text-purple-700 mb-1">Unit</p><p className="font-bold text-gray-900">{selectedStock?.unit}</p></div>
                                    <div><p className="text-xs text-purple-700 mb-1">Stock Status</p>
                                        <div className={`inline-flex px-3 py-1 rounded-lg text-sm font-bold ${selectedStock && selectedStock.quantity > 20 ? 'bg-green-100 text-green-700' : selectedStock && selectedStock.quantity > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                            {selectedStock && selectedStock.quantity > 20 ? '✅ In Stock' : selectedStock && selectedStock.quantity > 0 ? '⚠️ Low Stock' : '❌ Out of Stock'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {selectedStock?.spesification && (
                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><FileText className="h-5 w-5" />Specifications</h4>
                                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{selectedStock.spesification}</p>
                                </div>
                            )}
                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Clock className="h-5 w-5" />Timestamps</h4>
                                {selectedStock?.created_at && <div><p className="text-xs text-slate-700 mb-1">Created At</p><p className="font-bold text-gray-900">{format(new Date(selectedStock.created_at), 'MMM dd, yyyy HH:mm')}</p></div>}
                            </div>
                            <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
                                <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2"><Info className="h-5 w-5" />Stock ID</h4>
                                <p className="font-mono text-xs text-gray-600 break-all">{selectedStock?.id}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex flex-wrap gap-3 justify-end">
                        <button onClick={() => setShowStockDetailModal(false)} className="px-5 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-white transition-colors">Close</button>
                        <button onClick={() => { setShowStockDetailModal(false); handleOpenStockTrackModal(selectedStock!); }} className="px-5 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors">View Track Record</button>
                        <button onClick={() => { setShowStockDetailModal(false); handleOpenStockModal(selectedStock!); }} className="px-5 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors">Edit Stock</button>
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
                        <button onClick={() => setShowStockTrackModal(false)} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"><X className="h-6 w-6" /></button>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1">{renderStockTrackRecord()}</div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex justify-between">
                        <button
                            onClick={handleExportStockTrackPDF}
                            disabled={stockTrackRecords.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Download className="h-4 w-4" />
                            {getText('Export PDF', 'Ekspor PDF')}
                        </button>
                        <button onClick={() => setShowStockTrackModal(false)} className="px-5 py-2 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors">Close</button>
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
                        <h3 className="text-2xl font-bold">{getText('Claim Equipment from Stock', 'Klaim Peralatan dari Stok')}</h3>
                        <button onClick={() => { setShowClaimModal(false); setSelectedStockForClaim(null); setSelectedRoomForClaim(null); setEquipmentImagePreview(''); }} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"><X className="h-6 w-6" /></button>
                    </div>
                </div>
                <form onSubmit={claimForm.handleSubmit(handleClaimSubmit)} className="p-6 space-y-4 flex-1 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-bold mb-2">{getText('Select Stock', 'Pilih Stok')} *</label>
                        <DropdownSearch
                            items={availableStocks}
                            selectedItem={selectedStockForClaim}
                            onSelect={(stock) => {
                                setSelectedStockForClaim(stock);
                                claimForm.setValue('stock_id', stock.id);
                                claimForm.setValue('quantity', 1);
                                setEquipmentImagePreview('');
                                supabase.from('stock').select('attachments').eq('id', stock.id).single().then(({ data }) => {
                                    if (data?.attachments) { setEquipmentImagePreview(data.attachments); setSelectedStockForClaim(prev => prev?.id === stock.id ? { ...prev, attachments: data.attachments } : prev); }
                                });
                            }}
                            placeholder="Search by name or code..."
                            showCode
                            renderItem={(stock) => (
                                <div className="p-3 hover:bg-purple-50 rounded-lg cursor-pointer transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div><div className="font-bold text-gray-900">{stock.nama}</div><div className="text-xs text-gray-500 font-mono">{stock.code}</div></div>
                                        <div className="text-right"><div className="font-bold text-purple-600">{stock.quantity} {stock.unit}</div><div className="text-xs text-gray-500">{stock.category}</div></div>
                                    </div>
                                </div>
                            )}
                        />
                        {claimForm.formState.errors.stock_id && <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.stock_id.message}</p>}
                    </div>

                    {selectedStockForClaim && (
                        <>
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Select Room', 'Pilih Ruangan')} *</label>
                                <DropdownSearch items={availableRooms} selectedItem={selectedRoomForClaim} onSelect={(room) => { setSelectedRoomForClaim(room); claimForm.setValue('rooms_id', room.id); }} placeholder={getText('Search rooms...', 'Cari ruangan...')} showCode
                                    renderItem={(room) => (<div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"><div className="flex items-center justify-between"><div><div className="font-bold text-gray-900">{room.name}</div><div className="text-xs text-gray-500 font-mono">{room.code}</div></div>{room.department && <div className="text-xs text-blue-600">{room.department.name}</div>}</div></div>)} />
                                {isDepartmentAdmin && claimForm.formState.errors.rooms_id && <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.rooms_id.message}</p>}
                            </div>

                            {selectedRoomForClaim && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Select Cabinet (Optional)', 'Pilih Lemari (Opsional)')}</label>
                                    <DropdownSearch items={tables.filter(t => t.room_id === selectedRoomForClaim.id)} selectedItem={selectedTableForClaim}
                                        onSelect={(table) => { setSelectedTableForClaim(table); setSelectedRackForClaim(null); setSelectedBoxForClaim(null); claimForm.setValue('table_id', table.id); claimForm.setValue('rack_id', ''); claimForm.setValue('box_id', ''); }}
                                        placeholder={getText('Select cabinet...', 'Pilih lemari...')}
                                        renderItem={(table) => (<div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"><div className="font-bold text-gray-900">{table.description}</div><div className="text-xs text-gray-500">{getText('Rack', 'Rak')}: {table.rack}</div></div>)} />
                                </div>
                            )}

                            {selectedTableForClaim && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Select Rack (Optional)', 'Pilih Rak (Opsional)')}</label>
                                    <DropdownSearch items={racks.filter(r => r.table_id === selectedTableForClaim.id)} selectedItem={selectedRackForClaim}
                                        onSelect={(rack) => { setSelectedRackForClaim(rack); setSelectedBoxForClaim(null); claimForm.setValue('rack_id', rack.id); claimForm.setValue('box_id', ''); }}
                                        placeholder={getText('Select rack...', 'Pilih rak...')}
                                        renderItem={(rack) => (<div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"><div className="font-bold text-gray-900">{rack.name}</div></div>)} />
                                </div>
                            )}

                            {selectedRackForClaim && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Select Box (Optional)', 'Pilih Box (Opsional)')}</label>
                                    <DropdownSearch items={boxes.filter(b => b.rack_id === selectedRackForClaim.id)} selectedItem={selectedBoxForClaim}
                                        onSelect={(box) => { setSelectedBoxForClaim(box); claimForm.setValue('box_id', box.id); }}
                                        placeholder={getText('Select box...', 'Pilih box...')}
                                        renderItem={(box) => (<div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"><div className="font-bold text-gray-900">{box.name}</div><div className="text-xs text-gray-500">{box.description}</div></div>)} />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Equipment Name', 'Nama Peralatan')} *</label>
                                    <input {...claimForm.register('name')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors" />
                                    {claimForm.formState.errors.name && <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.name.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Code', 'Kode')} *</label>
                                    <input {...claimForm.register('code')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none font-mono transition-colors" />
                                    {claimForm.formState.errors.code && <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.code.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Quantity', 'Jumlah')} ({getText('Max', 'Maks')}: {maxClaimQuantity}) *</label>
                                    <input type="number" {...claimForm.register('quantity', { valueAsNumber: true })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors" min="1" max={maxClaimQuantity} />
                                    {claimForm.formState.errors.quantity && <p className="text-red-500 text-sm mt-1">{claimForm.formState.errors.quantity.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Condition', 'Kondisi')} *</label>
                                    <select {...claimForm.register('condition')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors">
                                        <option value="GOOD">Good</option><option value="BROKEN">Broken</option><option value="MAINTENANCE">Maintenance</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Specifications (Optional)', 'Spesifikasi (Opsional)')}</label>
                                <textarea {...claimForm.register('Spesification')} rows={3} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors" placeholder="Add specific details..." />
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Year of Purchase', 'Tahun Pembelian')}</label>
                                <input type="number" {...claimForm.register('purchase_year')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors" placeholder="YYYY" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Procurement Type (Optional)', 'Jenis Pengadaan (Opsional)')}</label>
                                <input type="text" {...claimForm.register('procurement_type')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors" placeholder="e.g. Hibah, APBN" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Equipment Photo', 'Foto Peralatan')}</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-purple-400 transition-colors">
                                    {equipmentImagePreview ? (
                                        <div className="space-y-3">
                                            <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                                <ImageWithLoader src={equipmentImagePreview} alt="Preview" className="w-full h-full object-contain" />
                                            </div>
                                            {equipmentImagePreview === selectedStockForClaim?.attachments && <div className="text-center text-xs text-gray-500 bg-gray-100 rounded-lg py-1">📷 {getText('Using Stock Photo', 'Menggunakan Foto Stok')}</div>}
                                            <div className="flex justify-center gap-3">
                                                {/* Hidden file input */}
                                                <input
                                                    ref={claimFileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleEquipmentImageChange}
                                                    className="hidden"
                                                />
                                                {/* Change photo button */}
                                                <button
                                                    type="button"
                                                    onClick={() => claimFileInputRef.current?.click()}
                                                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg cursor-pointer hover:bg-purple-200 transition-colors"
                                                >
                                                    <Upload className="h-4 w-4" /><span className="text-sm font-medium">{getText('Change Photo', 'Ganti Foto')}</span>
                                                </button>
                                                <button type="button" onClick={clearEquipmentImage} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                                                    <Trash2 className="h-4 w-4" /><span className="text-sm font-medium">{getText('Delete', 'Hapus')}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Hidden file input for empty state */}
                                            <input
                                                ref={claimFileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleEquipmentImageChange}
                                                className="hidden"
                                            />
                                            {/* Clickable area to upload */}
                                            <div
                                                onClick={() => claimFileInputRef.current?.click()}
                                                className="flex flex-col items-center justify-center h-32 cursor-pointer"
                                            >
                                                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                                <span className="text-sm text-gray-500 font-medium">Click to upload photo</span>
                                                <span className="text-xs text-gray-400 mt-1">{getText('Max 5MB (JPG, PNG)', 'Maks 5MB (JPG, PNG)')}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" {...claimForm.register('is_mandatory')} className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-300" />
                                    <span className="text-sm font-medium">{getText('Mandatory Equipment', 'Peralatan Wajib')}</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" {...claimForm.register('is_available')} className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-300" />
                                    <span className="text-sm font-medium">{getText('Available for Lending', 'Tersedia untuk Dipinjam')}</span>
                                </label>
                            </div>
                        </>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
                        <button type="button" onClick={() => { setShowClaimModal(false); setSelectedStockForClaim(null); setSelectedRoomForClaim(null); setEquipmentImagePreview(''); }} className="px-6 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors">{getText('Cancel', 'Batal')}</button>
                        <button type="submit" disabled={loadingEquipment || !selectedStockForClaim || !selectedRoomForClaim} className="px-6 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors">
                            {loadingEquipment ? getText('Claiming...', 'Mengklaim...') : getText('Claim Equipment', 'Klaim Peralatan')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    // 5. Edit Equipment Panel - Redesigned as slide-in panel for better stability
    const EditPanel = () => {
        // Local file input handler to prevent scroll issues
        const handleFileSelect = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                    if (!file.type.startsWith('image/')) {
                        toast.error('Please select an image file');
                        return;
                    }
                    try {
                        const compressed = await compressImage(file);
                        setEquipmentImagePreview(compressed);
                    } catch (error) {
                        console.error('Error compressing image:', error);
                        toast.error('Failed to process image');
                    }
                }
            };
            input.click();
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold">{getText('Edit Equipment', 'Edit Peralatan')}</h3>
                                <p className="text-sm opacity-90 mt-1">{editingEquipment?.name}</p>
                            </div>
                            <button
                                onClick={() => { setShowEditModal(false); setEditingEquipment(null); setSelectedRoomForEdit(null); }}
                                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Form Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <form id="edit-equipment-form" onSubmit={editForm.handleSubmit(handleEditSubmit, (errors) => {
                            console.log('========================================');
                            console.log('=== FORM VALIDATION FAILED ===');
                            console.log('========================================');
                            console.log('Validation errors:', JSON.stringify(errors, null, 2));
                            alert('FORM VALIDATION GAGAL! Errors: ' + Object.keys(errors).join(', '));
                        })} className="space-y-4">
                            {/* Room Selection */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Select Room', 'Pilih Ruangan')} *</label>
                                <DropdownSearch
                                    items={availableRooms}
                                    selectedItem={selectedRoomForEdit}
                                    onSelect={(room) => {
                                        setSelectedRoomForEdit(room);
                                        setSelectedTableForEdit(null);
                                        setSelectedRackForEdit(null);
                                        setSelectedBoxForEdit(null);
                                        editForm.setValue('rooms_id', room.id);
                                    }}
                                    placeholder={getText('Search rooms...', 'Cari ruangan...')}
                                    showCode
                                />
                            </div>

                            {/* Cabinet Selection */}
                            {selectedRoomForEdit && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Select Cabinet (Optional)', 'Pilih Lemari (Opsional)')}</label>
                                    <DropdownSearch
                                        items={tables.filter(t => t.room_id === selectedRoomForEdit.id)}
                                        selectedItem={selectedTableForEdit}
                                        onSelect={(table) => {
                                            setSelectedTableForEdit(table);
                                            setSelectedRackForEdit(null);
                                            setSelectedBoxForEdit(null);
                                            editForm.setValue('table_id', table.id);
                                        }}
                                        placeholder={getText('Select cabinet...', 'Pilih lemari...')}
                                    />
                                </div>
                            )}

                            {/* Rack Selection */}
                            {selectedTableForEdit && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Select Rack (Optional)', 'Pilih Rak (Opsional)')}</label>
                                    <DropdownSearch
                                        items={racks.filter(r => r.table_id === selectedTableForEdit.id)}
                                        selectedItem={selectedRackForEdit}
                                        onSelect={(rack) => {
                                            setSelectedRackForEdit(rack);
                                            setSelectedBoxForEdit(null);
                                            editForm.setValue('rack_id', rack.id);
                                        }}
                                        placeholder={getText('Select rack...', 'Pilih rak...')}
                                    />
                                </div>
                            )}

                            {/* Box Selection */}
                            {selectedRackForEdit && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Select Box (Optional)', 'Pilih Box (Opsional)')}</label>
                                    <DropdownSearch
                                        items={boxes.filter(b => b.rack_id === selectedRackForEdit.id)}
                                        selectedItem={selectedBoxForEdit}
                                        onSelect={(box) => {
                                            setSelectedBoxForEdit(box);
                                            editForm.setValue('box_id', box.id);
                                        }}
                                        placeholder="Select box..."
                                    />
                                </div>
                            )}

                            {/* Name & Code */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Name', 'Nama')} *</label>
                                    <input
                                        {...editForm.register('name')}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                                    />
                                    {editForm.formState.errors.name && (
                                        <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.name.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Code', 'Kode')} *</label>
                                    <input
                                        {...editForm.register('code')}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none font-mono transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Category', 'Kategori')} *</label>
                                <select
                                    {...editForm.register('category')}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                                >
                                    <option value="">{getText('Select Category', 'Pilih Kategori')}</option>
                                    {categories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                                </select>
                            </div>

                            {/* Quantity, Unit, Condition */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Qty', 'Jml')} *</label>
                                    <input
                                        type="number"
                                        {...editForm.register('quantity', { valueAsNumber: true })}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Unit', 'Satuan')} *</label>
                                    <input
                                        {...editForm.register('unit')}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Condition', 'Kondisi')}</label>
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

                            {/* Specifications */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Specifications', 'Spesifikasi')}</label>
                                <textarea
                                    {...editForm.register('Spesification')}
                                    rows={2}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                                />
                            </div>

                            {/* Purchase Year and Procurement */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Year of Purchase', 'Tahun Pembelian')}</label>
                                <input
                                    type="number"
                                    {...editForm.register('purchase_year')}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                                    placeholder="YYYY"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Procurement Type (Optional)', 'Jenis Pengadaan (Opsional)')}</label>
                                <input
                                    type="text"
                                    {...editForm.register('procurement_type')}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors"
                                    placeholder="e.g. Hibah, APBN"
                                />
                            </div>

                            {/* Photo Upload - Using programmatic file input */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Equipment Photo', 'Foto Peralatan')}</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-amber-400 transition-colors">
                                    {loadingImage ? (
                                        <div className="h-40 flex flex-col items-center justify-center bg-gray-50 rounded-lg">
                                            <Loader2 className="h-8 w-8 text-amber-500 animate-spin mb-2" />
                                            <span className="text-sm text-gray-400">Loading image...</span>
                                        </div>
                                    ) : equipmentImagePreview ? (
                                        <div className="space-y-3">
                                            <div className="relative w-full h-40 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                                <img src={equipmentImagePreview} alt="Preview" className="w-full h-full object-contain" />
                                            </div>
                                            <div className="flex justify-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handleFileSelect}
                                                    className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                                                >
                                                    <Upload className="h-4 w-4" />
                                                    <span className="text-sm font-medium">Ganti Foto</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={clearEquipmentImage}
                                                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="text-sm font-medium">Hapus</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={handleFileSelect}
                                            className="flex flex-col items-center justify-center h-32 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
                                        >
                                            <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                            <span className="text-sm text-gray-500 font-medium">Click to upload photo</span>
                                            <span className="text-xs text-gray-400 mt-1">Max 5MB (JPG, PNG)</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Checkboxes */}
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" {...editForm.register('is_mandatory')} className="w-5 h-5 text-amber-600 rounded" />
                                    <span className="text-sm font-medium">{getText('Mandatory', 'Wajib')}</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" {...editForm.register('is_available')} className="w-5 h-5 text-amber-600 rounded" />
                                    <span className="text-sm font-medium">{getText('Available', 'Tersedia')}</span>
                                </label>
                            </div>
                        </form>
                    </div>

                    {/* Footer - Fixed */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setShowEditModal(false); setEditingEquipment(null); setSelectedRoomForEdit(null); }}
                                className="px-6 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-white transition-colors"
                            >
                                {getText('Cancel', 'Batal')}
                            </button>
                            <button
                                type="submit"
                                form="edit-equipment-form"
                                disabled={loadingEquipment || !selectedRoomForEdit}
                                className="px-6 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                            >
                                {loadingEquipment ? getText('Updating...', 'Memperbarui...') : getText('Update Equipment', 'Perbarui Peralatan')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 6. Equipment Detail Modal
    const EquipmentDetailModal = () => {
        // Fix for image display: parse stringified JSON arrays like handleOpenEditModal
        const attachmentSrc = useMemo(() => {
            const raw = selectedEquipment?.attachments;
            if (!raw) return '';

            let finalAttachment = '';

            // Decode Logic:
            // 1. Check if it is an Array
            if (Array.isArray(raw)) {
                finalAttachment = raw[0] || '';
            }
            // 2. Check if it is a JSON String looking like an Array
            else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) finalAttachment = parsed[0];
                    else finalAttachment = raw;
                } catch (e) {
                    finalAttachment = raw;
                }
            }
            // 3. Plain string
            else {
                finalAttachment = raw as string;
            }

            // Basic validation
            if (finalAttachment.length > 2000 && !finalAttachment.startsWith('data:') && !finalAttachment.startsWith('http')) {
                return '';
            }
            return finalAttachment;
        }, [selectedEquipment]);

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6 text-white flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold">{selectedEquipment?.name}</h3>
                                <p className="text-sm opacity-90 mt-1">{getText('Complete Equipment Information', 'Informasi Lengkap Peralatan')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Delete Button in Header */}
                                <button
                                    onClick={async () => {
                                        const result = await Swal.fire({
                                            title: getText('Delete Equipment?', 'Hapus Peralatan?'),
                                            text: getText('This action cannot be undone!', 'Aksi ini tidak dapat dibatalkan!'),
                                            icon: 'warning',
                                            showCancelButton: true,
                                            confirmButtonColor: '#ef4444',
                                            confirmButtonText: getText('Yes, Delete', 'Ya, Hapus'),
                                            cancelButtonText: getText('Cancel', 'Batal')
                                        });
                                        if (result.isConfirmed) {
                                            setShowDetailModal(false);
                                            handleDeleteEquipment(selectedEquipment!.id);
                                        }
                                    }}
                                    className="p-2 hover:bg-red-500 hover:bg-opacity-30 rounded-lg transition-colors"
                                    title={getText('Delete Equipment', 'Hapus Peralatan')}
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"><X className="h-6 w-6" /></button>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1 space-y-6">
                        {loadingDetailModal ? (
                            <div className="relative rounded-xl overflow-hidden shadow-lg h-64 bg-gradient-to-br from-purple-50 to-indigo-50">
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-3 animate-pulse"><Loader2 className="w-8 h-8 text-purple-600 animate-spin" /></div>
                                    <h4 className="font-bold text-lg text-gray-800 animate-pulse">{selectedEquipment?.name}</h4>
                                    <p className="text-sm text-gray-500 mb-2 animate-pulse">{selectedEquipment?.code}</p>
                                    <p className="text-xs text-purple-600 font-medium animate-pulse">Memuat foto...</p>
                                </div>
                            </div>
                        ) : attachmentSrc ? (
                            <div className="relative rounded-xl overflow-hidden shadow-lg h-64 group">
                                <ImageWithLoader src={attachmentSrc} alt={selectedEquipment?.name || ''} className="w-full h-full object-cover" title={selectedEquipment?.name} subtitle={selectedEquipment?.code} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                                    <div>
                                        <h4 className="text-white font-bold text-2xl drop-shadow-md">{selectedEquipment?.name}</h4>
                                        <p className="text-white/80 text-sm font-mono mt-1">{selectedEquipment?.code}</p>
                                    </div>
                                    <button onClick={() => { setEquipmentImagePreview(attachmentSrc); setShowEquipmentImageFullscreen(true); }} className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white transition-all shadow-lg border border-white/10" title="View Fullscreen">
                                        <Maximize2 className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-8 text-center border-2 border-dashed border-purple-100">
                                <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-sm"><Image className="h-10 w-10 text-purple-400 opacity-60" /></div>
                                <h4 className="font-bold text-xl text-gray-800">{selectedEquipment?.name}</h4>
                                <p className="text-purple-400 text-sm mt-2 font-medium italic">No photo available</p>
                            </div>
                        )}

                        {/* Detail Equipment Section - CRUD for detail_equipment table */}
                        <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-4 rounded-xl border border-violet-200">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-bold text-violet-900 flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    {getText('Detail Equipment', 'Detail Peralatan')}
                                    <span className="text-xs bg-violet-200 text-violet-700 px-2 py-0.5 rounded-full">
                                        {detailEquipments.length} {getText('items', 'item')}
                                    </span>
                                </h4>
                                <button
                                    onClick={handleOpenAddDetailModal}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
                                >
                                    <Plus className="h-4 w-4" />
                                    {getText('Add Detail', 'Tambah Detail')}
                                </button>
                            </div>

                            {loadingDetailEquipments ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
                                    <span className="ml-2 text-violet-600">{getText('Loading...', 'Memuat...')}</span>
                                </div>
                            ) : detailEquipments.length === 0 ? (
                                <div className="text-center py-8 bg-white rounded-xl border-2 border-dashed border-violet-200">
                                    <div className="w-14 h-14 mx-auto bg-violet-100 rounded-full flex items-center justify-center mb-3">
                                        <Package className="h-7 w-7 text-violet-400" />
                                    </div>
                                    <p className="text-gray-500 text-sm">{getText('No detail equipment yet', 'Belum ada detail peralatan')}</p>
                                    <p className="text-gray-400 text-xs mt-1">{getText('Click "Add Detail" to add sub-items', 'Klik "Tambah Detail" untuk menambah sub-item')}</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {detailEquipments.map((detail, index) => {
                                        const conditionBadge = getConditionBadge(detail.condition);
                                        const ConditionIcon = conditionBadge.icon;
                                        const hasImage = detail.attachments && detail.attachments.length > 10;

                                        return (
                                            <div
                                                key={detail.id}
                                                className="bg-white rounded-xl border border-gray-200 p-3 hover:border-violet-300 hover:shadow-sm transition-all group"
                                                style={{
                                                    animationDelay: `${index * 50}ms`,
                                                    animation: 'fadeIn 0.3s ease-out forwards'
                                                }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        {/* Image Preview or Package Icon */}
                                                        <div
                                                            className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200 bg-violet-50 transition-all ${hasImage ? 'cursor-pointer hover:opacity-80 hover:scale-105' : ''}`}
                                                            onClick={() => {
                                                                if (hasImage) {
                                                                    setDetailFullscreenImage(detail.attachments || '');
                                                                    setShowDetailImageFullscreen(true);
                                                                }
                                                            }}
                                                        >
                                                            {hasImage ? (
                                                                <img
                                                                    src={detail.attachments}
                                                                    alt={detail.name}
                                                                    loading="lazy"
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        // Fallback to icon on error
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <Package className={`h-5 w-5 text-violet-600 ${hasImage ? 'hidden' : ''}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h5 className="font-bold text-gray-900 truncate">{detail.name}</h5>
                                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded">{detail.code}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                                <span className="flex items-center gap-1">
                                                                    <Hash className="h-3 w-3" />
                                                                    {detail.quantity} {detail.unit}
                                                                </span>
                                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${conditionBadge.bg} ${conditionBadge.text}`}>
                                                                    <ConditionIcon className="h-3 w-3" />
                                                                    <span className="text-xs font-medium">{conditionBadge.label}</span>
                                                                </div>
                                                            </div>
                                                            {detail.notes && (
                                                                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{detail.notes}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                        <button
                                                            onClick={() => handleOpenEditDetailModal(detail)}
                                                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title={getText('Edit', 'Edit')}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteDetailEquipment(detail.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title={getText('Delete', 'Hapus')}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                                    <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2"><Package className="h-5 w-5" />{getText('Basic Information', 'Informasi Dasar')}</h4>
                                    <div className="space-y-3">
                                        <div><p className="text-xs text-blue-700 mb-1">{getText('Equipment Name', 'Nama Peralatan')}</p><p className="font-bold text-gray-900">{selectedEquipment?.name}</p></div>
                                        <div><p className="text-xs text-blue-700 mb-1">{getText('NUP Number', 'NOMOR NUP')}</p><p className="font-mono font-bold text-gray-900">{selectedEquipment?.code}</p></div>
                                        <div><p className="text-xs text-blue-700 mb-1">{getText('Category', 'Kategori')}</p><p className="font-bold text-gray-900">{selectedEquipment?.category}</p></div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                                    <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2"><Database className="h-5 w-5" />{getText('Quantity & Unit', 'Jumlah & Satuan')}</h4>
                                    <div className="space-y-3">
                                        <div><p className="text-xs text-purple-700 mb-1">{getText('Quantity', 'Jumlah')}</p><p className="text-2xl font-bold text-purple-900">{selectedEquipment?.quantity}</p></div>
                                        <div><p className="text-xs text-purple-700 mb-1">{getText('Unit', 'Satuan')}</p><p className="font-bold text-gray-900">{selectedEquipment?.unit}</p></div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                                    <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2"><MapPin className="h-5 w-5" />{getText('Location', 'Lokasi')}</h4>
                                    <div className="space-y-3">
                                        {(selectedEquipment?.rooms as any)?.building?.campus?.name && <div><p className="text-xs text-green-700 mb-1">{getText('Campus', 'Kampus')}</p><p className="font-bold text-gray-900">{(selectedEquipment?.rooms as any).building.campus.name}</p></div>}
                                        {(selectedEquipment?.rooms as any)?.building?.name && <div><p className="text-xs text-green-700 mb-1">{getText('Building', 'Gedung')}</p><p className="font-bold text-gray-900">{(selectedEquipment?.rooms as any).building.name}</p></div>}
                                        {(selectedEquipment?.rooms as any)?.floor && <div><p className="text-xs text-green-700 mb-1">{getText('Floor', 'Lantai')}</p><p className="font-bold text-gray-900">{getText('Floor', 'Lantai')} {(selectedEquipment?.rooms as any).floor}</p></div>}
                                        <div><p className="text-xs text-green-700 mb-1">{getText('Room', 'Ruangan')}</p><p className="font-bold text-gray-900">{selectedEquipment?.rooms?.name || getText('No room assigned', 'Tidak ada ruangan')}</p></div>
                                        {selectedEquipment?.rooms?.code && <div><p className="text-xs text-green-700 mb-1">{getText('Room Code', 'Kode Ruangan')}</p><p className="font-mono font-bold text-gray-900">{selectedEquipment.rooms.code}</p></div>}
                                        {selectedEquipment?.rooms?.department && <div><p className="text-xs text-green-700 mb-1">{getText('Department', 'Departemen')}</p><p className="font-bold text-blue-900">{selectedEquipment.rooms.department.name}</p></div>}
                                    </div>

                                    {/* Sub-Location Details: Cabinet/Table, Rack, Box */}
                                    {((selectedEquipment as any)?.table_id || (selectedEquipment as any)?.rack_id || (selectedEquipment as any)?.box_id) && (
                                        <div className="mt-4 pt-3 border-t border-green-200">
                                            <h5 className="font-semibold text-green-800 mb-2 flex items-center gap-2 text-sm">
                                                <Layers className="h-4 w-4" />
                                                {getText('Storage Location', 'Lokasi Penyimpanan')}
                                            </h5>
                                            <div className="grid grid-cols-1 gap-2">
                                                {(selectedEquipment as any)?.table_id && (() => {
                                                    const table = tables.find(t => t.id === (selectedEquipment as any).table_id);
                                                    return table ? (
                                                        <div className="flex items-center gap-2 bg-white/60 px-3 py-2 rounded-lg">
                                                            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                                                                <Archive className="h-4 w-4 text-indigo-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-green-600">{getText('Cabinet/Table', 'Kabinet/Meja')}</p>
                                                                <p className="font-semibold text-gray-900 text-sm">{table.description || `Table ${table.id.slice(0, 8)}`}</p>
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })()}
                                                {(selectedEquipment as any)?.rack_id && (() => {
                                                    const rack = racks.find(r => r.id === (selectedEquipment as any).rack_id);
                                                    return rack ? (
                                                        <div className="flex items-center gap-2 bg-white/60 px-3 py-2 rounded-lg">
                                                            <div className="w-7 h-7 bg-teal-100 rounded-lg flex items-center justify-center">
                                                                <Layers className="h-4 w-4 text-teal-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-green-600">{getText('Rack', 'Rak')}</p>
                                                                <p className="font-semibold text-gray-900 text-sm">{rack.name}</p>
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })()}
                                                {(selectedEquipment as any)?.box_id && (() => {
                                                    const box = boxes.find(b => b.id === (selectedEquipment as any).box_id);
                                                    return box ? (
                                                        <div className="flex items-center gap-2 bg-white/60 px-3 py-2 rounded-lg">
                                                            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                                                                <BoxIcon className="h-4 w-4 text-amber-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-green-600">{getText('Box', 'Kotak')}</p>
                                                                <p className="font-semibold text-gray-900 text-sm">{box.name}</p>
                                                                {box.description && <p className="text-xs text-gray-500">{box.description}</p>}
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
                                    <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5" />{getText('Status & Condition', 'Status & Kondisi')}</h4>
                                    <div className="space-y-3">
                                        <div><p className="text-xs text-amber-700 mb-1">{getText('Condition', 'Kondisi')}</p>
                                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold ${selectedEquipment && getConditionBadge(selectedEquipment.condition).bg} ${selectedEquipment && getConditionBadge(selectedEquipment.condition).text}`}>
                                                {selectedEquipment && (() => { const Badge = getConditionBadge(selectedEquipment.condition); const Icon = Badge.icon; return <><Icon className="h-4 w-4" /> {Badge.label}</>; })()}
                                            </div>
                                        </div>
                                        <div><p className="text-xs text-amber-700 mb-1">{getText('Availability', 'Ketersediaan')}</p><p className="font-bold text-gray-900">{selectedEquipment?.is_available ? getText('✅ Available for Lending', '✅ Tersedia untuk Dipinjam') : getText('❌ Not Available', '❌ Tidak Tersedia')}</p></div>
                                        <div><p className="text-xs text-amber-700 mb-1">{getText('Mandatory', 'Wajib')}</p><p className="font-bold text-gray-900">{selectedEquipment?.is_mandatory ? getText('⭐ Yes - Required Equipment', '⭐ Ya - Peralatan Wajib') : getText('No - Optional', 'Tidak - Opsional')}</p></div>
                                    </div>
                                </div>
                                {selectedEquipment?.Spesification && (() => {
                                    const { purchaseYear, procurementType, specs } = parseEquipmentSpec(selectedEquipment.Spesification);
                                    return (
                                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                                            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><FileText className="h-5 w-5" />{getText('Specifications & Details', 'Spesifikasi & Detail')}</h4>
                                            {(purchaseYear || procurementType) && (
                                                <div className="mb-3">
                                                    <p className="text-xs text-gray-500 mb-1">{getText('Purchase Year & Procurement:', 'Tahun Pembelian & Pengadaan:')}</p>
                                                    <div className="text-sm font-medium text-gray-800">
                                                        {purchaseYear && <div className="mb-1">{getText('Year:', 'Tahun:')} {purchaseYear}</div>}
                                                        {procurementType && <div>{getText('Type:', 'Jenis:')} {procurementType}</div>}
                                                    </div>
                                                </div>
                                            )}
                                            {specs && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">{getText('Details:', 'Keterangan:')}</p>
                                                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{specs}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                {selectedEquipment?.stock && (
                                    <div className="bg-gradient-to-r from-cyan-50 to-cyan-100 p-4 rounded-xl border border-cyan-200">
                                        <h4 className="font-bold text-cyan-900 mb-3 flex items-center gap-2"><Warehouse className="h-5 w-5" />{getText('Source Stock', 'Sumber Stok')}</h4>
                                        <div className="space-y-2">
                                            <div><p className="text-xs text-cyan-700 mb-1">{getText('Stock Name', 'Nama Stok')}</p><p className="font-bold text-gray-900">{selectedEquipment.stock.nama}</p></div>
                                            <div><p className="text-xs text-cyan-700 mb-1">{getText('Stock Code', 'Kode Stok')}</p><p className="font-mono font-bold text-gray-900">{selectedEquipment.stock.code}</p></div>
                                            <div><p className="text-xs text-cyan-700 mb-1">{getText('Remaining in Stock', 'Sisa di Stok')}</p><p className="font-bold text-gray-900">{selectedEquipment.stock.quantity} {selectedEquipment.stock.unit}</p></div>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Clock className="h-5 w-5" />{getText('Timestamps', 'Stempel Waktu')}</h4>
                                    {selectedEquipment?.created_at && <div><p className="text-xs text-slate-700 mb-1">{getText('Created At', 'Dibuat Pada')}</p><p className="font-bold text-gray-900">{format(new Date(selectedEquipment.created_at), 'MMM dd, yyyy HH:mm')}</p></div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <div className="flex flex-wrap gap-3 justify-between">
                            {/* Left side - Track Record */}
                            <button
                                onClick={() => {
                                    setShowDetailModal(false);
                                    handleOpenTrackRecordModal(selectedEquipment!);
                                }}
                                className="flex items-center gap-2 px-4 py-2 border-2 border-blue-300 text-blue-600 rounded-xl font-medium hover:bg-blue-50 transition-colors"
                            >
                                <History className="h-4 w-4" />
                                {getText('Track Record', 'Riwayat')}
                            </button>

                            {/* Right side - Action Buttons */}
                            <div className="flex flex-wrap gap-3">
                                <button onClick={() => setShowDetailModal(false)} className="px-5 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-white transition-colors">{getText('Close', 'Tutup')}</button>
                                <button
                                    onClick={() => { setShowDetailModal(false); handleOpenEditModal(selectedEquipment!); }}
                                    className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
                                >
                                    <Edit className="h-4 w-4" />
                                    {getText('Edit Equipment', 'Edit Peralatan')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div >
        );
    };

    // 7. Equipment Track Record Modal (Gap Analysis)
    const TrackRecordModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold">{selectedEquipment?.name}</h3>
                            <p className="text-sm opacity-90 mt-1">{getText('Gap Analysis - Missing Items Tracker', 'Analisis Gap - Pelacak Barang Hilang')}</p>
                        </div>
                        <button onClick={() => setShowTrackRecordModal(false)} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"><X className="h-6 w-6" /></button>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1">{renderSimpleGapAnalysis()}</div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex justify-end">
                        <button onClick={() => setShowTrackRecordModal(false)} className="px-5 py-2 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors">{getText('Close', 'Tutup')}</button>
                    </div>
                </div>
            </div>
        </div>
    );

    // 8. Direct Add Equipment Modal
    const handleDirectAddSubmit = async (data: EquipmentEditForm) => {
        try {
            setLoadingEquipment(true);
            const newId = crypto.randomUUID();

            const finalSpec = formatEquipmentSpec(data.purchase_year || '', data.procurement_type || '', data.Spesification || '');

            const { error } = await supabase.from('equipment').insert({
                id: newId, name: data.name, code: data.code, category: data.category, quantity: data.quantity, unit: data.unit,
                condition: data.condition, rooms_id: data.rooms_id, table_id: data.table_id || null, rack_id: data.rack_id || null,
                box_id: data.box_id || null, is_mandatory: data.is_mandatory, is_available: data.is_available,
                Spesification: finalSpec, attachments: equipmentImagePreview ? [equipmentImagePreview] : null, created_at: new Date().toISOString(),
                // Auto-copy department_id and study_program_id from selected room
                department_id: (selectedRoomForEdit as any)?.department_id || null,
                study_program_id: (selectedRoomForEdit as any)?.study_program_id || null,
            });

            if (error) throw error;
            toast.success('Equipment added successfully');
            setShowDirectAddModal(false);
            editForm.reset();
            setEquipmentImagePreview('');
            await fetchEquipment();
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
                        <h3 className="text-2xl font-bold">{getText('Add New Equipment', 'Tambah Peralatan Baru')}</h3>
                        <button onClick={() => { setShowDirectAddModal(false); editForm.reset(); setEquipmentImagePreview(''); }} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"><X className="h-6 w-6" /></button>
                    </div>
                </div>
                <form onSubmit={editForm.handleSubmit(handleDirectAddSubmit)} className="p-6 space-y-4 flex-1 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-bold mb-2">{getText('Select Room', 'Pilih Ruangan')} *</label>
                        <DropdownSearch items={isLaboratory && profile?.department_id ? rooms.filter(r => r.department_id === profile.department_id) : rooms} selectedItem={selectedRoomForEdit}
                            onSelect={(room) => { setSelectedRoomForEdit(room); setSelectedTableForEdit(null); setSelectedRackForEdit(null); setSelectedBoxForEdit(null); editForm.setValue('rooms_id', room.id); editForm.setValue('table_id', ''); editForm.setValue('rack_id', ''); editForm.setValue('box_id', ''); }}
                            placeholder={getText('Search rooms...', 'Cari ruangan...')} showCode />
                    </div>

                    {selectedRoomForEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2">{getText('Select Cabinet (Optional)', 'Pilih Lemari (Opsional)')}</label>
                            <DropdownSearch items={tables.filter(t => t.room_id === selectedRoomForEdit.id)} selectedItem={selectedTableForEdit}
                                onSelect={(table) => { setSelectedTableForEdit(table); setSelectedRackForEdit(null); setSelectedBoxForEdit(null); editForm.setValue('table_id', table.id); editForm.setValue('rack_id', ''); editForm.setValue('box_id', ''); }}
                                placeholder={getText('Select cabinet...', 'Pilih lemari...')}
                                renderItem={(table) => (<div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"><div className="font-bold text-gray-900">{table.description}</div><div className="text-xs text-gray-500">{getText('Rack', 'Rak')}: {table.rack}</div></div>)} />
                        </div>
                    )}

                    {selectedTableForEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2">Select Rack (Optional)</label>
                            <DropdownSearch items={racks.filter(r => r.table_id === selectedTableForEdit.id)} selectedItem={selectedRackForEdit}
                                onSelect={(rack) => { setSelectedRackForEdit(rack); setSelectedBoxForEdit(null); editForm.setValue('rack_id', rack.id); editForm.setValue('box_id', ''); }}
                                placeholder="Select rack..."
                                renderItem={(rack) => (<div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"><div className="font-bold text-gray-900">{rack.name}</div></div>)} />
                        </div>
                    )}

                    {selectedRackForEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2">Select Box (Optional)</label>
                            <DropdownSearch items={boxes.filter(b => b.rack_id === selectedRackForEdit.id)} selectedItem={selectedBoxForEdit}
                                onSelect={(box) => { setSelectedBoxForEdit(box); editForm.setValue('box_id', box.id); }}
                                placeholder="Select box..."
                                renderItem={(box) => (<div className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"><div className="font-bold text-gray-900">{box.name}</div><div className="text-xs text-gray-500">{box.description}</div></div>)} />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">{getText('Name', 'Nama')} *</label>
                            <input {...editForm.register('name')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors" />
                            {editForm.formState.errors.name && <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.name.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">{getText('Code', 'Kode')} *</label>
                            <input {...editForm.register('code')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none font-mono transition-colors" />
                            {editForm.formState.errors.code && <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.code.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">{getText('Category', 'Kategori')} *</label>
                        <select {...editForm.register('category')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors">
                            <option value="">{getText('Select Category', 'Pilih Kategori')}</option>
                            {categories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                        </select>
                        {editForm.formState.errors.category && <p className="text-red-500 text-sm mt-1">{editForm.formState.errors.category.message}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">{getText('Quantity', 'Jumlah')} *</label>
                            <input type="number" {...editForm.register('quantity', { valueAsNumber: true })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">{getText('Unit', 'Satuan')} *</label>
                            <input {...editForm.register('unit')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">{getText('Condition', 'Kondisi')} *</label>
                            <select {...editForm.register('condition')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors">
                                <option value="GOOD">Good</option><option value="BROKEN">Broken</option><option value="MAINTENANCE">Maintenance</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">{getText('Specifications', 'Spesifikasi')}</label>
                        <textarea {...editForm.register('Spesification')} rows={3} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">{getText('Year of Purchase', 'Tahun Pembelian')}</label>
                        <input type="number" {...editForm.register('purchase_year')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors" placeholder="YYYY" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2">{getText('Procurement Type (Optional)', 'Jenis Pengadaan (Opsional)')}</label>
                        <input type="text" {...editForm.register('procurement_type')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors" placeholder="e.g. Hibah, APBN" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2">{getText('Equipment Photo', 'Foto Peralatan')}</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-green-400 transition-colors">
                            {equipmentImagePreview ? (
                                <div className="space-y-3">
                                    <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                        <img src={equipmentImagePreview} alt="Preview" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex justify-center gap-3">
                                        {/* Hidden file input */}
                                        <input
                                            ref={addFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleEquipmentImageChange}
                                            className="hidden"
                                        />
                                        {/* Change photo button */}
                                        <button
                                            type="button"
                                            onClick={() => addFileInputRef.current?.click()}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg cursor-pointer hover:bg-green-200 transition-colors"
                                        >
                                            <Upload className="h-4 w-4" /><span className="text-sm font-medium">Ganti Foto</span>
                                        </button>
                                        <button type="button" onClick={clearEquipmentImage} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                                            <Trash2 className="h-4 w-4" /><span className="text-sm font-medium">Hapus</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Hidden file input for empty state */}
                                    <input
                                        ref={addFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleEquipmentImageChange}
                                        className="hidden"
                                    />
                                    {/* Clickable area to upload */}
                                    <div
                                        onClick={() => addFileInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center h-32 cursor-pointer"
                                    >
                                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                        <span className="text-sm text-gray-500 font-medium">{getText('Click to upload photo', 'Klik untuk unggah foto')}</span>
                                        <span className="text-xs text-gray-400 mt-1">{getText('Max 5MB (JPG, PNG)', 'Maks 5MB (JPG, PNG)')}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" {...editForm.register('is_mandatory')} className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-300" />
                            <span className="text-sm font-medium">{getText('Mandatory', 'Wajib')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" {...editForm.register('is_available')} className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-300" />
                            <span className="text-sm font-medium">{getText('Available', 'Tersedia')}</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
                        <button type="button" onClick={() => { setShowDirectAddModal(false); editForm.reset(); setEquipmentImagePreview(''); }} className="px-6 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors">{getText('Cancel', 'Batal')}</button>
                        <button type="submit" disabled={loadingEquipment || !selectedRoomForEdit} className="px-6 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-50 transition-colors">
                            {loadingEquipment ? getText('Adding...', 'Menambahkan...') : getText('Add Equipment', 'Tambah Peralatan')}
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
                        <h1 className="text-3xl font-bold mb-2">{isLaboratory ? getText('Equipment Management', 'Manajemen Peralatan') : getText('Inventory Management', 'Manajemen Inventaris')}</h1>
                        <p className="opacity-90">{isLaboratory ? getText('Manage equipment for your study program', 'Kelola peralatan program studi Anda') : getText('Manage warehouse stock and equipment', 'Kelola stok gudang dan peralatan')}</p>
                    </div>
                    <div className="flex gap-4">
                        {!isLaboratory && (
                            <div className="text-center bg-white bg-opacity-20 rounded-xl p-3">
                                <div className="text-2xl font-bold">{stocks.length}</div>
                                <div className="text-sm">{getText('Stocks', 'Stok')}</div>
                            </div>
                        )}
                        <div className="text-center bg-white bg-opacity-20 rounded-xl p-3">
                            <div className="text-2xl font-bold">{equipment.length}</div>
                            <div className="text-sm">{getText('Equipment', 'Peralatan')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs - Hidden for Laboratory (they only see Equipment) */}
            <div className="bg-white rounded-2xl shadow-lg mb-6">
                {!isLaboratory && (
                    <div className="border-b border-gray-200">
                        <nav className="flex">
                            <button onClick={() => setActiveTab('stock')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 border-b-2 transition-all ${activeTab === 'stock' ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Warehouse className="h-5 w-5" />Stock ({stocks.length})
                            </button>
                            <button onClick={() => setActiveTab('equipment')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 border-b-2 transition-all ${activeTab === 'equipment' ? 'border-purple-500 text-purple-600 bg-purple-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Package className="h-5 w-5" />Equipment ({equipment.length})
                            </button>
                        </nav>
                    </div>
                )}

                <div className="p-6">
                    {/* Stock Tab */}
                    {activeTab === 'stock' && !isLaboratory && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={getText('Search stock by name or code...', 'Cari stok berdasarkan nama atau kode...')}
                                        value={stockSearchTerm}
                                        onChange={(e) => {
                                            setStockSearchTerm(e.target.value);
                                            handleStockSearch(e.target.value);
                                        }}
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <button onClick={() => handleOpenStockModal()} className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-colors">
                                    <Plus className="h-5 w-5" />{getText('Add Stock', 'Tambah Stok')}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredStocks.map(stock => {
                                    const categoryConfig = getCategoryConfig(stock.category);
                                    const Icon = categoryConfig.icon;
                                    return (
                                        <div key={stock.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className={`p-2 rounded-lg ${categoryConfig.color === 'violet' ? 'bg-violet-100 text-violet-600' : categoryConfig.color === 'blue' ? 'bg-blue-100 text-blue-600' : categoryConfig.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : categoryConfig.color === 'amber' ? 'bg-amber-100 text-amber-600' : categoryConfig.color === 'rose' ? 'bg-rose-100 text-rose-600' : categoryConfig.color === 'slate' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-600'}`}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-sm font-bold ${stock.quantity > 20 ? 'bg-green-100 text-green-700' : stock.quantity > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                    {stock.quantity} {stock.unit}
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-lg mb-1">{stock.nama}</h3>
                                            <p className="text-sm text-gray-600 font-mono mb-3">{stock.code}</p>
                                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleOpenStockDetailModal(stock)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Details"><Eye className="h-4 w-4" /></button>
                                                    <button onClick={() => handleOpenStockTrackModal(stock)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Track Record"><History className="h-4 w-4" /></button>
                                                    <button onClick={() => handleOpenQRModal(stock)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View QR Code"><QrCode className="h-4 w-4" /></button>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleOpenStockModal(stock)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="h-4 w-4" /></button>
                                                    <button onClick={() => { if (confirm('Delete this stock?')) handleDeleteStock(stock.id); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Stock Pagination */}
                            <div className="flex items-center justify-between mt-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <div className="text-sm text-gray-500">
                                    {getText('Showing', 'Menampilkan')} <span className="font-bold">{stocks.length}</span> {getText('of', 'dari')} <span className="font-bold">{totalStocks}</span> {getText('stocks', 'stok')}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setStockPage(p => Math.max(1, p - 1))}
                                        disabled={stockPage === 1 || loadingStocks}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                    >
                                        {getText('Previous', 'Sebelumnya')}
                                    </button>
                                    <span className="px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg border border-blue-100">
                                        {stockPage}
                                    </span>
                                    <button
                                        onClick={() => setStockPage(p => {
                                            const maxPage = Math.ceil(totalStocks / itemsPerPage);
                                            return p < maxPage ? p + 1 : p;
                                        })}
                                        disabled={stockPage >= Math.ceil(totalStocks / itemsPerPage) || loadingStocks}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                    >
                                        {getText('Next', 'Selanjutnya')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Equipment Tab - Always visible for Laboratory */}
                    {(activeTab === 'equipment' || isLaboratory) && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={getText('Search equipment by name or code...', 'Cari peralatan berdasarkan nama atau kode...')}
                                        value={equipmentSearchTerm}
                                        onChange={(e) => {
                                            setEquipmentSearchTerm(e.target.value);
                                            handleEquipmentSearch(e.target.value);
                                        }}
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    {/* Export PDF Button */}
                                    <button onClick={handleExportEquipmentPDF} className="flex items-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-medium transition-colors" title={getText('Export to PDF', 'Ekspor ke PDF')}>
                                        <Download className="h-5 w-5" />
                                        <span className="hidden lg:inline">PDF</span>
                                    </button>
                                    {/* Import Excel Button */}
                                    <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-medium transition-colors" title={getText('Import from Excel', 'Impor dari Excel')}>
                                        <Upload className="h-5 w-5" />
                                        <span className="hidden lg:inline">Excel</span>
                                    </button>
                                    <button onClick={() => { editForm.reset(); editForm.setValue('quantity', 1); setEquipmentImagePreview(''); setSelectedRoomForEdit(null); setSelectedTableForEdit(null); setSelectedRackForEdit(null); setSelectedBoxForEdit(null); setShowDirectAddModal(true); }} className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 font-medium transition-colors">
                                        <Plus className="h-5 w-5" />{getText('Add Equipment', 'Tambah Peralatan')}
                                    </button>
                                    <button onClick={handleOpenClaimModal} disabled={!canClaimEquipment} className="flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 font-medium disabled:opacity-50 transition-colors">
                                        <PackagePlus className="h-5 w-5" />{isLaboratory ? getText('Claim Stock', 'Klaim Stok') : getText('Claim Equipment', 'Klaim Peralatan')}
                                    </button>
                                </div>
                            </div>

                            {/* Dropdown Filters for Rooms / Facilities and Categories */}
                            <div className="flex flex-wrap gap-4 items-center bg-gray-55 p-4 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm font-semibold text-gray-700">{getText('Filters:', 'Filter:')}</span>
                                </div>
                                
                                {/* Room/Facility Filter Dropdown */}
                                <div className="flex items-center gap-2">
                                    <select
                                        value={roomFilter}
                                        onChange={(e) => {
                                            setRoomFilter(e.target.value);
                                            setEquipmentPage(1); // reset page
                                        }}
                                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-gray-700 font-medium cursor-pointer hover:border-gray-300 transition-colors"
                                    >
                                        <option value="all">{getText('All Rooms / Facilities', 'Semua Ruangan / Fasilitas')}</option>
                                        {rooms.map(r => (
                                            <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Category Filter Dropdown */}
                                <div className="flex items-center gap-2">
                                    <select
                                        value={equipmentCategoryFilter}
                                        onChange={(e) => {
                                            setEquipmentCategoryFilter(e.target.value);
                                            setEquipmentPage(1); // reset page
                                        }}
                                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-gray-700 font-medium cursor-pointer hover:border-gray-300 transition-colors"
                                    >
                                        <option value="all">{getText('All Categories', 'Semua Kategori')}</option>
                                        {categories.map(cat => (
                                            <option key={cat.name} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Reset Filters Button */}
                                {(roomFilter !== 'all' || equipmentCategoryFilter !== 'all') && (
                                    <button
                                        onClick={() => {
                                            setRoomFilter('all');
                                            setEquipmentCategoryFilter('all');
                                            setEquipmentPage(1);
                                        }}
                                        className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-100"
                                    >
                                        {getText('Reset Filters', 'Atur Ulang Filter')}
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredEquipment.map(eq => {
                                    const categoryConfig = getCategoryConfig(eq.category);
                                    const Icon = categoryConfig.icon;
                                    const conditionBadge = getConditionBadge(eq.condition);
                                    const ConditionIcon = conditionBadge.icon;

                                    return (
                                        <div key={eq.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-purple-300 transition-all group">
                                            {/* Header */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className={`p-2 rounded-lg ${categoryConfig.color === 'violet' ? 'bg-violet-100 text-violet-600' : categoryConfig.color === 'blue' ? 'bg-blue-100 text-blue-600' : categoryConfig.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : categoryConfig.color === 'amber' ? 'bg-amber-100 text-amber-600' : categoryConfig.color === 'rose' ? 'bg-rose-100 text-rose-600' : categoryConfig.color === 'slate' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-600'}`}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                {/* Action buttons in header */}
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleOpenDetailModal(eq)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title={getText('View Details', 'Lihat Detail')}><Eye className="h-4 w-4" /></button>
                                                    <button onClick={() => handleOpenEquipmentQRModal(eq)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={getText('View QR Code', 'Lihat Kode QR')}><QrCode className="h-4 w-4" /></button>
                                                    <button onClick={() => handleOpenEditModal(eq)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title={getText('Edit', 'Edit')}><Edit className="h-4 w-4" /></button>
                                                    <button onClick={() => handleDeleteEquipment(eq.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={getText('Delete', 'Hapus')}><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            </div>

                                            {/* Title and Code */}
                                            <h3 className="font-bold text-lg mb-1 line-clamp-1">{eq.name}</h3>
                                            <div className="bg-gray-100 px-2 py-1 rounded-md inline-block mb-2">
                                                <p className="text-xs text-gray-600 font-mono">{eq.code}</p>
                                            </div>

                                            {/* Room & ID Info */}
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                                <MapPin className="h-3 w-3" />
                                                <span className="truncate">{eq.rooms?.name || getText('No room', 'Tidak ada ruangan')}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                                                <Hash className="h-3 w-3" />
                                                <span className="font-mono">{eq.id.substring(0, 8)}</span>
                                            </div>

                                            {(() => {
                                                const { purchaseYear, procurementType } = parseEquipmentSpec(eq.Spesification || '');
                                                if (!purchaseYear && !procurementType) return null;
                                                return (
                                                    <div className="mb-3 text-xs">
                                                        <label className="block text-gray-500 mb-1">{getText('Purchase Year & Procurement:', 'Tahun Pembelian & Pengadaan:')}</label>
                                                        <div className="text-sm font-medium text-gray-800">
                                                            {purchaseYear && <div className="mb-1">{getText('Year:', 'Tahun:')} {purchaseYear}</div>}
                                                            {procurementType && <div>{getText('Type:', 'Jenis:')} {procurementType}</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Quantity & Condition Badge */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-gray-400" />
                                                    <span className="text-sm font-bold text-gray-700">{eq.quantity} {eq.unit}</span>
                                                </div>
                                                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${conditionBadge.bg} ${conditionBadge.text}`}>
                                                    <ConditionIcon className="h-3 w-3" />{conditionBadge.label}
                                                </div>
                                            </div>

                                            {/* Footer - Track Record & Open Button */}
                                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                                <button onClick={() => handleOpenTrackRecordModal(eq)} className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                    <History className="h-3.5 w-3.5" />
                                                    {getText('Track', 'Riwayat')}
                                                </button>
                                                <button
                                                    onClick={() => handleOpenDetailModal(eq)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-200 transition-colors"
                                                >
                                                    <FolderOpen className="h-3.5 w-3.5" />
                                                    {getText('Open', 'Buka')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Equipment Pagination */}
                            <div className="flex items-center justify-between mt-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <div className="text-sm text-gray-500">
                                    {getText('Showing', 'Menampilkan')} <span className="font-bold">{equipment.length}</span> {getText('of', 'dari')} <span className="font-bold">{totalEquipment}</span> {getText('items', 'item')}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setEquipmentPage(p => Math.max(1, p - 1))}
                                        disabled={equipmentPage === 1 || loadingEquipment}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                    >
                                        {getText('Previous', 'Sebelumnya')}
                                    </button>
                                    <span className="px-4 py-2 bg-purple-50 text-purple-600 font-bold rounded-lg border border-purple-100">
                                        {equipmentPage}
                                    </span>
                                    <button
                                        onClick={() => setEquipmentPage(p => {
                                            const maxPage = Math.ceil(totalEquipment / itemsPerPage);
                                            return p < maxPage ? p + 1 : p;
                                        })}
                                        disabled={equipmentPage >= Math.ceil(totalEquipment / itemsPerPage) || loadingEquipment}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                    >
                                        {getText('Next', 'Selanjutnya')}
                                    </button>
                                </div>
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
            {showEditModal && editingEquipment && <EditPanel />}
            {showDetailModal && selectedEquipment && <EquipmentDetailModal />}
            {showTrackRecordModal && selectedEquipment && <TrackRecordModal />}
            {showDirectAddModal && <DirectAddModal />}

            {/* Stock QR Code Modal */}
            {showStockQRModal && selectedStockForQR && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-semibold text-lg">{getText('QR Code: ' + selectedStockForQR.nama, 'Kode QR: ' + selectedStockForQR.nama)}</h3>
                            <button
                                onClick={() => setShowStockQRModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col items-center">
                            {/* The Card to be captured */}
                            <div
                                id="stock-qr-card-element"
                                className="bg-white p-6 border-2 border-gray-900 rounded-xl flex flex-col items-center gap-4 w-64 shadow-sm"
                            >
                                <div className="text-center">
                                    <h2 className="font-bold text-lg uppercase text-gray-900 line-clamp-1">{selectedStockForQR.nama}</h2>
                                    <p className="text-xs text-gray-500 font-mono">{selectedStockForQR.code}</p>
                                </div>
                                <div className="bg-white p-2 rounded">
                                    <QRCode
                                        value={`${window.location.origin}${window.location.pathname}#/tools?stockId=${selectedStockForQR.id}`}
                                        size={180}
                                        viewBox={`0 0 256 256`}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Identitas Alat (Stock ID)</p>
                                    <p className="text-[8px] text-gray-300 mt-1">Fakultas Vokasi UNY</p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-500 mt-6 text-center">
                                Cetak dan tempel kode QR ini di alat agar mahasiswa atau dosen dapat memindai identitas alat.
                            </p>

                            <div className="flex gap-3 w-full mt-6">
                                <button
                                    onClick={() => setShowStockQRModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                                >
                                    Tutup
                                </button>
                                <button
                                    onClick={downloadStockQR}
                                    disabled={isDownloadingStockQR}
                                    className={`flex-1 px-4 py-2 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 ${isDownloadingStockQR
                                        ? 'bg-blue-400 cursor-wait opacity-80'
                                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md'
                                        }`}
                                >
                                    {isDownloadingStockQR ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>{getText('Processing...', 'Memproses...')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4" />
                                            <span>Download</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Equipment QR Code Modal */}
            {showEquipmentQRModal && selectedEquipmentForQR && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-semibold text-lg">{getText('QR Code: ' + selectedEquipmentForQR.name, 'Kode QR: ' + selectedEquipmentForQR.name)}</h3>
                            <button
                                onClick={() => setShowEquipmentQRModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col items-center">
                            {/* The Card to be captured */}
                            <div
                                id="equipment-qr-card-element"
                                className="bg-white p-6 border-2 border-gray-900 rounded-xl flex flex-col items-center gap-4 w-64 shadow-sm"
                            >
                                <div className="text-center">
                                    <h2 className="font-bold text-lg uppercase text-gray-900 line-clamp-1">{selectedEquipmentForQR.name}</h2>
                                    <p className="text-xs text-gray-500 font-mono">{selectedEquipmentForQR.code}</p>
                                </div>
                                <div className="bg-white p-2 rounded">
                                    <QRCode
                                        value={`${window.location.origin}${window.location.pathname}#/tools?id=${selectedEquipmentForQR.id}`}
                                        size={180}
                                        viewBox={`0 0 256 256`}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Identitas Alat (Equipment ID)</p>
                                    {selectedEquipmentForQR.rooms?.name && (
                                        <p className="text-[9px] text-gray-600 mt-1 font-semibold">{selectedEquipmentForQR.rooms.name}</p>
                                    )}
                                    <p className="text-[8px] text-gray-300 mt-1">Fakultas Vokasi UNY</p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-500 mt-6 text-center">
                                Cetak dan tempel kode QR ini di alat agar mahasiswa atau dosen dapat memindai identitas alat.
                            </p>

                            <div className="flex gap-3 w-full mt-6">
                                <button
                                    onClick={() => setShowEquipmentQRModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                                >
                                    Tutup
                                </button>
                                <button
                                    onClick={downloadEquipmentQR}
                                    disabled={isDownloadingEquipmentQR}
                                    className={`flex-1 px-4 py-2 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 ${isDownloadingEquipmentQR
                                        ? 'bg-blue-400 cursor-wait opacity-80'
                                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md'
                                        }`}
                                >
                                    {isDownloadingEquipmentQR ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>{getText('Processing...', 'Memproses...')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4" />
                                            <span>Download</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Equipment Add/Edit Modal */}
            {showDetailEquipmentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[55] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-6 text-white flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold">
                                        {editingDetailEquipment
                                            ? getText('Edit Detail Equipment', 'Edit Detail Peralatan')
                                            : getText('Add Detail Equipment', 'Tambah Detail Peralatan')
                                        }
                                    </h3>
                                    <p className="text-sm opacity-90 mt-1">
                                        {selectedEquipment?.name}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setShowDetailEquipmentModal(false); setEditingDetailEquipment(null); }}
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Name', 'Nama')} *</label>
                                <input
                                    type="text"
                                    value={detailEquipmentForm.name}
                                    onChange={(e) => setDetailEquipmentForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none transition-colors"
                                    placeholder={getText('Enter detail equipment name', 'Masukkan nama detail peralatan')}
                                />
                            </div>
                            {/* Code */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Code', 'Kode')} *</label>
                                <input
                                    type="text"
                                    value={detailEquipmentForm.code}
                                    onChange={(e) => setDetailEquipmentForm(prev => ({ ...prev, code: e.target.value }))}
                                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none font-mono transition-colors"
                                    placeholder={getText('Enter unique code', 'Masukkan kode unik')}
                                />
                            </div>
                            {/* Quantity & Unit */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Quantity', 'Jumlah')} *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={detailEquipmentForm.quantity}
                                        onChange={(e) => setDetailEquipmentForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">{getText('Unit', 'Satuan')} *</label>
                                    <input
                                        type="text"
                                        value={detailEquipmentForm.unit}
                                        onChange={(e) => setDetailEquipmentForm(prev => ({ ...prev, unit: e.target.value }))}
                                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none transition-colors"
                                        placeholder="pcs"
                                    />
                                </div>
                            </div>
                            {/* Condition */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Condition', 'Kondisi')}</label>
                                <select
                                    value={detailEquipmentForm.condition}
                                    onChange={(e) => setDetailEquipmentForm(prev => ({ ...prev, condition: e.target.value }))}
                                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none transition-colors"
                                >
                                    <option value="GOOD">{getText('Good', 'Baik')}</option>
                                    <option value="BROKEN">{getText('Broken', 'Rusak')}</option>
                                    <option value="MAINTENANCE">{getText('Maintenance', 'Perbaikan')}</option>
                                </select>
                            </div>
                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Notes', 'Catatan')}</label>
                                <textarea
                                    value={detailEquipmentForm.notes}
                                    onChange={(e) => setDetailEquipmentForm(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none transition-colors resize-none"
                                    placeholder={getText('Optional notes...', 'Catatan opsional...')}
                                />
                            </div>
                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Photo', 'Foto')}</label>
                                <input
                                    type="file"
                                    ref={detailFileInputRef}
                                    accept="image/*"
                                    onChange={handleDetailImageChange}
                                    className="hidden"
                                />
                                {detailImagePreview ? (
                                    <div className="relative rounded-xl overflow-hidden border-2 border-violet-200 bg-violet-50">
                                        <img
                                            src={detailImagePreview}
                                            alt="Preview"
                                            className="w-full h-40 object-cover"
                                        />
                                        <div className="absolute top-2 right-2 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => detailFileInputRef.current?.click()}
                                                className="p-2 bg-white/90 rounded-lg hover:bg-white shadow-sm transition-colors"
                                                title={getText('Change Photo', 'Ganti Foto')}
                                            >
                                                <Camera className="h-4 w-4 text-gray-600" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDetailImagePreview('')}
                                                className="p-2 bg-red-500/90 rounded-lg hover:bg-red-500 shadow-sm transition-colors"
                                                title={getText('Remove Photo', 'Hapus Foto')}
                                            >
                                                <X className="h-4 w-4 text-white" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => detailFileInputRef.current?.click()}
                                        disabled={loadingDetailImage}
                                        className="w-full py-6 border-2 border-dashed border-violet-300 rounded-xl bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loadingDetailImage ? (
                                            <>
                                                <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
                                                <span className="text-sm text-violet-600 font-medium">{getText('Processing...', 'Memproses...')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="h-8 w-8 text-violet-400" />
                                                <span className="text-sm text-violet-600 font-medium">{getText('Click to upload photo', 'Klik untuk upload foto')}</span>
                                                <span className="text-xs text-violet-400">{getText('JPG, PNG, WebP (max 5MB)', 'JPG, PNG, WebP (maks 5MB)')}</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                            <div className="flex flex-wrap gap-3 justify-end">
                                <button
                                    onClick={() => { setShowDetailEquipmentModal(false); setEditingDetailEquipment(null); }}
                                    className="px-5 py-2 border-2 border-gray-300 rounded-xl font-medium hover:bg-white transition-colors"
                                >
                                    {getText('Cancel', 'Batal')}
                                </button>
                                <button
                                    onClick={editingDetailEquipment ? handleEditDetailEquipment : handleAddDetailEquipment}
                                    disabled={!detailEquipmentForm.name || !detailEquipmentForm.code || loadingDetailEquipments}
                                    className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                                >
                                    {loadingDetailEquipments && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {editingDetailEquipment
                                        ? getText('Update', 'Perbarui')
                                        : getText('Add', 'Tambah')
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Equipment Import Modal */}
            <EquipmentImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onSuccess={() => { fetchEquipment(); fetchStocks(); }}
                rooms={rooms}
                stocks={stocks}
            />

            {/* Fullscreen Image Modals */}
            {showStockImageFullscreen && stockImagePreview && (
                <div className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4 cursor-pointer" onClick={() => setShowStockImageFullscreen(false)}>
                    <button className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors" onClick={() => setShowStockImageFullscreen(false)}><X className="h-6 w-6" /></button>
                    <img src={stockImagePreview} alt="Fullscreen Preview" className="max-w-full max-h-screen object-contain" />
                </div>
            )}

            {showEquipmentImageFullscreen && equipmentImagePreview && (
                <div className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4 cursor-pointer" onClick={() => setShowEquipmentImageFullscreen(false)}>
                    <button className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors" onClick={() => setShowEquipmentImageFullscreen(false)}><X className="h-6 w-6" /></button>
                    <img src={equipmentImagePreview} alt="Fullscreen Preview" className="max-w-full max-h-screen object-contain" />
                </div>
            )}

            {/* Detail Image Fullscreen Modal */}
            {showDetailImageFullscreen && detailFullscreenImage && (
                <div className="fixed inset-0 z-[70] bg-black bg-opacity-95 flex items-center justify-center p-4 cursor-pointer backdrop-blur-sm"
                    onClick={() => setShowDetailImageFullscreen(false)}>
                    <div className="relative max-w-4xl w-full max-h-screen flex flex-col items-center justify-center">
                        <button
                            className="absolute -top-12 right-0 p-2 text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                            onClick={(e) => { e.stopPropagation(); setShowDetailImageFullscreen(false); }}
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <img
                            src={detailFullscreenImage}
                            alt="Detail Fullscreen"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToolAdministration;