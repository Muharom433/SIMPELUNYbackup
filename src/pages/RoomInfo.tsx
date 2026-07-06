import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Building, Search, Eye, Users, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Loader2, Hash, DoorClosed, Calendar as CalendarIcon, Wrench, ChevronDown, GraduationCap, UserCheck, AlertTriangle, Filter, ChevronUp, FileText, Warehouse, Package, Layers, Tag, Box, ScanBarcode, Camera, Info, ExternalLink, Maximize2, Archive
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { Room, Department, Equipment, StudyProgram } from '../types';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

export const parseEquipmentSpec = (spec: string | null) => {
    if (!spec) return { purchaseYear: '', procurementType: '', specs: '' };
    const pyMatch = spec.match(/\[Tahun Pembelian\]:\s*([^\n]*)/);
    const ptMatch = spec.match(/\[Jenis Pengadaan\]:\s*([^\n]*)/);
    const specMatch = spec.match(/\[Spesifikasi\]:\s*([\s\S]*)/);

    const purchaseYear = pyMatch && pyMatch[1] ? pyMatch[1].trim() : '';
    const procurementType = ptMatch && ptMatch[1] ? ptMatch[1].trim() : '';
    
    const specs = specMatch && specMatch[1] 
        ? specMatch[1].trim() 
        : (pyMatch || ptMatch ? '' : spec.trim());

    return { purchaseYear, procurementType, specs };
};

interface EnhancedRoomStatus extends Room {
    department?: Department;
    building?: {
        id: string;
        name: string;
        campus?: {
            id: string;
            name: string;
        };
    };
    room_equipment?: {
        id: string;
        name: string;
        code: string;
        category: string;
        condition: string;
    }[];
    currentBooking?: any;
    todayStatus?: 'In Use' | 'Scheduled' | 'Available';
    targetDateStatus?: 'Scheduled' | 'Available';
}

const PhotoPlaceholder = ({ title, subtitle }: { title?: string, subtitle?: string }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-50 text-center p-4 z-10">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-3 animate-pulse">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
        {title && <h3 className="font-bold text-lg text-gray-800 animate-pulse">{title}</h3>}
        {subtitle && <p className="text-sm text-gray-500 mb-2 animate-pulse">{subtitle}</p>}
        <p className="text-xs text-indigo-600 font-medium animate-pulse">Memuat foto...</p>
    </div>
);

const ImageWithLoader = ({ src, alt, className, title, subtitle }: { src: string, alt: string, className?: string, title?: string, subtitle?: string }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        setIsLoading(true);
        setHasError(false);

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
}

interface CombinedSchedule {
    id: string;
    type: 'lecture' | 'exam' | 'session' | 'booking';
    start_time: string;
    end_time?: string;
    title: string;
    subtitle?: string;
    description?: string;
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
}

const RoomInfo: React.FC = () => {
    const { getText } = useLanguage();
    const [rooms, setRooms] = useState<EnhancedRoomStatus[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roomPageSize, setRoomPageSize] = useState(25);
    const [roomCurrentPage, setRoomCurrentPage] = useState(0);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    // Active Tab: 'rooms' or 'equipment'
    const [activeTab, setActiveTab] = useState<'rooms' | 'equipment'>('rooms');

    // All Equipment (for Keterangan Alat tab)
    const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
    const [loadingAllEquipment, setLoadingAllEquipment] = useState(false);
    const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
    // Room name filter (replaces old name filter)
    const [equipmentRoomFilter, setEquipmentRoomFilter] = useState('all');
    const [isRoomFilterDropdownOpen, setIsRoomFilterDropdownOpen] = useState(false);
    const [roomFilterSearchTerm, setRoomFilterSearchTerm] = useState('');
    // Pagination
    const [equipmentPageSize, setEquipmentPageSize] = useState(25);
    const [equipmentCurrentPage, setEquipmentCurrentPage] = useState(0);
    // Scanner (DosenPresensi style - auto start)
    const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scanProcessing, setScanProcessing] = useState(false);
    const [scanRetry, setScanRetry] = useState(0);
    const [scannerReady, setScannerReady] = useState(false);
    const [scanResult, setScanResult] = useState<{
        rawValue: string;
        equipment: Equipment | null;
        room?: any;
        department?: any;
    } | null>(null);
    const [showScanResult, setShowScanResult] = useState(false);
    const [isSpDropdownOpen, setIsSpDropdownOpen] = useState(false);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const [showEquipmentImageFullscreen, setShowEquipmentImageFullscreen] = useState(false);

    // Equipment Detail Modal States (for tab Keterangan Alat - view only)
    const [selectedEquipmentDetail, setSelectedEquipmentDetail] = useState<any | null>(null);
    const [showEquipmentDetail, setShowEquipmentDetail] = useState(false);
    const [loadingEquipmentDetail, setLoadingEquipmentDetail] = useState(false);
    const [equipmentDetailPhoto, setEquipmentDetailPhoto] = useState<string | null>(null);
    const [equipmentDetailItems, setEquipmentDetailItems] = useState<any[]>([]);

    // Room Details Modal States
    const [showRoomDetail, setShowRoomDetail] = useState<EnhancedRoomStatus | null>(null);
    const [roomPhoto, setRoomPhoto] = useState<string | null>(null);
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const [selectedRoomEquipment, setSelectedRoomEquipment] = useState<Equipment[]>([]);
    const [loadingRoomUsers, setLoadingRoomUsers] = useState(false);
    const [roomUsers, setRoomUsers] = useState<any[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [combinedSchedules, setCombinedSchedules] = useState<CombinedSchedule[]>([]);
    const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // Fetch initial directories
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                // Fetch Departments
                const { data: deptData } = await supabase.from('departments').select('*').order('name');
                setDepartments(deptData || []);

                // Fetch Study Programs
                const { data: spData } = await supabase.from('study_programs').select('*').order('name');
                setStudyPrograms(spData || []);

                await fetchRooms();
            } catch (err) {
                console.error('Error fetching initial data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Trigger details fetching when room modal is shown
    useEffect(() => {
        if (showRoomDetail) {
            fetchRoomPhoto(showRoomDetail);
            fetchEquipmentForRoom(showRoomDetail.id);
            fetchRoomUsers(showRoomDetail.id);
            fetchSchedulesForRoom(showRoomDetail.name, showRoomDetail.id);
        } else {
            setRoomPhoto(null);
            setSelectedRoomEquipment([]);
            setRoomUsers([]);
            setCombinedSchedules([]);
        }
    }, [showRoomDetail, targetDate]);

    // Fetch all equipment when equipment tab is active
    useEffect(() => {
        if (activeTab === 'equipment' && allEquipment.length === 0) {
            fetchAllEquipment();
        }
    }, [activeTab]);

    // QR Scanner Effect — DosenPresensi style (auto-start, no manual camera selection)
    useEffect(() => {
        if (!showBarcodeScanner) return;
        setCameraError(null);

        const html5QrCode = new Html5Qrcode('roominfo-qr-reader');
        html5QrCodeRef.current = html5QrCode;
        let isMounted = true;

        const startScanning = async () => {
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            const onScanSuccess = (decodedText: string) => {
                console.log('[QR RoomInfo] Scanned:', decodedText);
                html5QrCode.stop().then(() => {
                    if (isMounted) handleScanResult(decodedText);
                }).catch((err: any) => {
                    console.error('Failed to stop scanner:', err);
                    if (isMounted) handleScanResult(decodedText);
                });
            };

            const onScanError = (_err: any) => { /* ignore parse errors */ };

            // Strategy 1: enumerate cameras → prefer back camera
            try {
                const devices = await Html5Qrcode.getCameras();
                console.log('[QR RoomInfo] Cameras found:', devices.map(d => d.label));
                if (devices && devices.length > 0) {
                    const backCamera = devices.find(d =>
                        d.label.toLowerCase().includes('back') ||
                        d.label.toLowerCase().includes('rear') ||
                        d.label.toLowerCase().includes('environment') ||
                        d.label.toLowerCase().includes('belakang')
                    );
                    const selected = backCamera || devices[0];
                    await html5QrCode.start(selected.id, config, onScanSuccess, onScanError);
                    if (isMounted) {
                        setCameraError(null);
                        setScannerReady(true);
                    }
                    return;
                }
            } catch (enumErr) {
                console.warn('[QR RoomInfo] Enumerate/start failed:', enumErr);
            }

            // Strategy 2: facingMode user (fallback)
            try {
                await html5QrCode.start({ facingMode: 'user' }, config, onScanSuccess, onScanError);
                if (isMounted) {
                    setCameraError(null);
                    setScannerReady(true);
                }
                return;
            } catch (fallbackErr) {
                console.warn('[QR RoomInfo] facingMode user failed:', fallbackErr);
            }

            // All failed
            if (isMounted) setCameraError('Gagal memulai kamera. Pastikan izin kamera diberikan dan tidak ada aplikasi lain yang menggunakan kamera.');
        };

        const timeoutId = setTimeout(() => { startScanning(); }, 500);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch((err: any) => console.error('Failed to stop on cleanup', err));
            }
        };
    }, [showBarcodeScanner, scanRetry]);

    // Smart QR code parsing and equipment lookup
    const handleScanResult = async (rawValue: string) => {
        setScanProcessing(true);
        setShowBarcodeScanner(false);
        try {
            // Extract meaningful identifier from QR value
            let searchValue = rawValue.trim();

            // If it's a URL, extract code/id from query params or path segments
            if (searchValue.startsWith('http://') || searchValue.startsWith('https://')) {
                try {
                    const queryParams = ['code', 'id', 'equipment', 'tool', 'alat'];
                    let foundParam = false;
                    for (const param of queryParams) {
                        const regex = new RegExp(`[?&]${param}=([^&#]+)`);
                        const match = searchValue.match(regex);
                        if (match && match[1]) {
                            searchValue = decodeURIComponent(match[1]);
                            foundParam = true;
                            break;
                        }
                    }

                    if (!foundParam) {
                        const cleanUrl = searchValue.split('?')[0];
                        const segments = cleanUrl.split('/').filter(Boolean);
                        const lastSegment = segments[segments.length - 1];
                        if (lastSegment && lastSegment !== 'room-info' && lastSegment !== 'equipment') {
                            searchValue = decodeURIComponent(lastSegment);
                        }
                    }
                } catch (urlErr) {
                    console.warn('[QR RoomInfo] URL parsing failed, using raw value:', urlErr);
                }
            }

            console.log('[QR RoomInfo] Searching for:', searchValue);

            // Strategy 1: Try exact match by ID (UUID format)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            let foundEquipment: any = null;

            const selectStr = 'id, name, code, category, condition, quantity, unit, is_available, Spesification, attachments, table_id, rack_id, box_id, rooms_id, rooms:rooms_id(id, name, code, floor, building:building_id(name, campus:campus_id(name))), departments(name)';

            if (uuidRegex.test(searchValue)) {
                const { data } = await supabase
                    .from('equipment')
                    .select(selectStr)
                    .eq('id', searchValue)
                    .single();
                if (data) foundEquipment = data;
            }

            // Strategy 2: Try exact match by code
            if (!foundEquipment) {
                const { data } = await supabase
                    .from('equipment')
                    .select(selectStr)
                    .eq('code', searchValue)
                    .single();
                if (data) foundEquipment = data;
            }

            // Strategy 3: Try partial match by code (case-insensitive)
            if (!foundEquipment) {
                const { data } = await supabase
                    .from('equipment')
                    .select(selectStr)
                    .ilike('code', `%${searchValue}%`)
                    .limit(1);
                if (data && data.length > 0) foundEquipment = data[0];
            }

            // Strategy 4: Try partial match by name
            if (!foundEquipment) {
                const { data } = await supabase
                    .from('equipment')
                    .select(selectStr)
                    .ilike('name', `%${searchValue}%`)
                    .limit(1);
                if (data && data.length > 0) foundEquipment = data[0];
            }

            if (foundEquipment) {
                const extraLocations: any = {};
                if (foundEquipment.table_id) {
                    const { data: tableData } = await supabase.from('table').select('description').eq('id', foundEquipment.table_id).maybeSingle();
                    if (tableData) extraLocations.tableName = tableData.description;
                }
                if (foundEquipment.rack_id) {
                    const { data: rackData } = await supabase.from('rack').select('name').eq('id', foundEquipment.rack_id).maybeSingle();
                    if (rackData) extraLocations.rackName = rackData.name;
                }
                if (foundEquipment.box_id) {
                    const { data: boxData } = await supabase.from('box').select('name, description').eq('id', foundEquipment.box_id).maybeSingle();
                    if (boxData) {
                        extraLocations.boxName = boxData.name;
                        extraLocations.boxDesc = boxData.description;
                    }
                }
                foundEquipment = { ...foundEquipment, ...extraLocations };
            }

            // Parse photo
            if (foundEquipment?.attachments) {
                let att = foundEquipment.attachments as string;
                if (Array.isArray(att)) {
                    att = att[0] || '';
                } else if (typeof att === 'string' && att.trim().startsWith('[')) {
                    try {
                        const parsed = JSON.parse(att);
                        if (Array.isArray(parsed) && parsed.length > 0) att = parsed[0];
                    } catch (e) {}
                }
                if (att) {
                    if (att.startsWith('http://') || att.startsWith('https://') || att.startsWith('data:')) {
                        foundEquipment.parsedPhoto = att;
                    } else {
                        const { data } = supabase.storage.from('equipment-attachments').getPublicUrl(att);
                        foundEquipment.parsedPhoto = data.publicUrl;
                    }
                }
            }

            setScanResult({
                rawValue: rawValue,
                equipment: foundEquipment,
                room: foundEquipment?.rooms,
                department: foundEquipment?.departments,
            });
            setShowScanResult(true);
        } catch (err) {
            console.error('[QR RoomInfo] Scan result processing error:', err);
            setScanResult({
                rawValue: rawValue,
                equipment: null,
            });
            setShowScanResult(true);
        } finally {
            setScanProcessing(false);
        }
    };

    // Close scanner helper
    const closeScanner = async () => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
            } catch (err) {
                console.error('[QR RoomInfo] Failed to stop scanner on close:', err);
            }
            html5QrCodeRef.current = null;
        }
        setShowBarcodeScanner(false);
        setScannerReady(false);
        setCameraError(null);
    };

    // Handle click outside to close name filter and study program dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const container = document.getElementById('eq-name-dropdown-container');
            if (container && !container.contains(event.target as Node)) {
                setIsEqNameDropdownOpen(false);
            }
            const spContainer = document.getElementById('sp-dropdown-container');
            if (spContainer && !spContainer.contains(event.target as Node)) {
                setIsSpDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fetch all rooms with details
    const fetchRooms = async () => {
        try {
            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select(`
                    id,
                    name,
                    code,
                    capacity,
                    is_available,
                    equipment,
                    study_program_ids,
                    department:departments(id, name),
                    building:building(
                        id,
                        name,
                        campus:campus(
                            id,
                            name
                        )
                    ),
                    room_equipment:equipment(id, name, code, category, condition)
                `)
                .order('name');

            if (roomsError) throw roomsError;

            // Enhance rooms status (simple logic for public page)
            const enhanced: EnhancedRoomStatus[] = (roomsData || []).map(room => {
                const castedRoom = room as any;
                return {
                    id: castedRoom.id,
                    name: castedRoom.name,
                    code: castedRoom.code,
                    capacity: castedRoom.capacity,
                    is_available: castedRoom.is_available,
                    equipment: castedRoom.equipment || [],
                    room_equipment: castedRoom.room_equipment || [],
                    study_program_ids: castedRoom.study_program_ids,
                    department: castedRoom.department,
                    building: Array.isArray(castedRoom.building) ? (castedRoom.building[0] ? {
                        id: castedRoom.building[0].id,
                        name: castedRoom.building[0].name,
                        campus: Array.isArray(castedRoom.building[0].campus) ? castedRoom.building[0].campus[0] : castedRoom.building[0].campus
                    } : undefined) : castedRoom.building,
                    todayStatus: castedRoom.is_available ? 'Available' : 'Available', // fallback
                };
            });

            setRooms(enhanced);
        } catch (err) {
            console.error('Error fetching rooms:', err);
        }
    };

    // Fetch Equipment Detail for modal (view-only)
    const openEquipmentDetail = async (eq: any) => {
        setSelectedEquipmentDetail(eq);
        setShowEquipmentDetail(true);
        setEquipmentDetailPhoto(null);
        setEquipmentDetailItems([]);
        setLoadingEquipmentDetail(true);
        try {
            // Fetch full equipment data: rooms + building + campus + departments + table + rack + box
            const { data: fullEq } = await supabase
                .from('equipment')
                .select(`
                    id, name, code, category, quantity, unit, condition, is_available, is_mandatory,
                    Spesification, attachments, created_at, table_id, rack_id, box_id,
                    rooms:rooms_id(id, name, code, floor, building:building(name, campus:campus(name)), department:departments(name)),
                    departments(name)
                `)
                .eq('id', eq.id)
                .single();
            if (fullEq) setSelectedEquipmentDetail(fullEq);

            // Fetch photo — handle JSON string array, full URL, or Supabase storage path
            if (fullEq?.attachments) {
                let att = fullEq.attachments as string;
                
                // Pengecekan aman untuk JSON parsing dan Array (Sama seperti ToolAdministration)
                if (Array.isArray(att)) {
                    att = att[0] || '';
                } else if (typeof att === 'string' && att.trim().startsWith('[')) {
                    try {
                        const parsed = JSON.parse(att);
                        if (Array.isArray(parsed) && parsed.length > 0) att = parsed[0];
                    } catch (e) {
                        // ignore and use raw string
                    }
                }

                if (!att) {
                    setEquipmentDetailPhoto(null);
                } else if (att.startsWith('http://') || att.startsWith('https://') || att.startsWith('data:')) {
                    setEquipmentDetailPhoto(att);
                } else {
                    // Try as Supabase storage public URL
                    const { data: urlData } = supabase.storage.from('equipment-photos').getPublicUrl(att);
                    setEquipmentDetailPhoto(urlData?.publicUrl || att);
                }
            }

            // Fetch cabinet/table, rack, box names if IDs present
            const extraLocations: any = {};
            if (fullEq?.table_id) {
                const { data: tableData } = await supabase.from('table').select('description').eq('id', fullEq.table_id).maybeSingle();
                if (tableData) extraLocations.tableName = tableData.description;
            }
            if (fullEq?.rack_id) {
                const { data: rackData } = await supabase.from('rack').select('name').eq('id', fullEq.rack_id).maybeSingle();
                if (rackData) extraLocations.rackName = rackData.name;
            }
            if (fullEq?.box_id) {
                const { data: boxData } = await supabase.from('box').select('name, description').eq('id', fullEq.box_id).maybeSingle();
                if (boxData) {
                    extraLocations.boxName = boxData.name;
                    extraLocations.boxDesc = boxData.description;
                }
            }
            if (Object.keys(extraLocations).length > 0) {
                setSelectedEquipmentDetail((prev: any) => prev ? { ...prev, ...extraLocations } : null);
            }
            
            // Fetch detail_equipment sub-items
            const { data: details } = await supabase
                .from('detail_equipment')
                .select('id, name, code, quantity, unit, condition, attachments, notes')
                .eq('equipment_id', eq.id)
                .order('created_at', { ascending: true });
            setEquipmentDetailItems(details || []);
        } catch (err) {
            console.error('Error fetching equipment detail:', err);
        } finally {
            setLoadingEquipmentDetail(false);
        }
    };

    // Fetch all equipment for the Keterangan Alat tab
    const [equipmentPage, setEquipmentPage] = useState(0);
    const [hasMoreEquipment, setHasMoreEquipment] = useState(false);
    const fetchAllEquipment = async (page = 0) => {
        setLoadingAllEquipment(true);
        try {
            const limit = 2000;
            const { data, error } = await supabase
                .from('equipment')
                .select('id, name, code, category, condition, quantity, is_available, unit, Spesification, rooms(name, building:building(name)), departments(name)')
                .order('name')
                .range(page * limit, (page + 1) * limit - 1);

            if (error) throw error;
            
            const newData = data || [];
            setAllEquipment(prev => page === 0 ? newData : [...prev, ...newData]);
            setHasMoreEquipment(newData.length === limit);
            setEquipmentPage(page);
        } catch (err) {
            console.error('Error fetching all equipment:', err);
        } finally {
            setLoadingAllEquipment(false);
        }
    };

    // Load initial equipment data on component mount
    useEffect(() => {
        fetchAllEquipment(0);
    }, []);

    // Fetch room photo (attachments)
    const fetchRoomPhoto = async (room: EnhancedRoomStatus) => {
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('attachments')
                .or(`name.eq.${room.name},code.eq.${room.code}`)
                .single();

            if (!error && data?.attachments) {
                setRoomPhoto(data.attachments);
            } else {
                setRoomPhoto(null);
            }
        } catch (err) {
            console.error('Error fetching room photo:', err);
            setRoomPhoto(null);
        }
    };

    // Fetch Equipment for Room
    const fetchEquipmentForRoom = async (roomId: string) => {
        setLoadingEquipment(true);
        try {
            const limit = 100;
            const { data, error } = await supabase
                .from('equipment')
                .select('id, name, code, category, condition')
                .eq('rooms_id', roomId)
                .order('name')
                .limit(limit);

            if (error) throw error;
            setSelectedRoomEquipment(data || []);
        } catch (err) {
            console.error('Error fetching room equipment:', err);
        } finally {
            setLoadingEquipment(false);
        }
    };

    // Fetch Room Users (Assigned lecturers/staff)
    const fetchRoomUsers = async (roomId: string) => {
        setLoadingRoomUsers(true);
        try {
            const { data, error } = await supabase
                .from('room_users')
                .select(`
                    *,
                    user:users(
                        id,
                        full_name,
                        identity_number,
                        role,
                        jabatan,
                        department:departments(name),
                        study_program:study_programs(name)
                    )
                `)
                .eq('room_id', roomId)
                .order('assigned_at', { ascending: false });

            if (error) throw error;
            setRoomUsers(data || []);
        } catch (err) {
            console.error('Error fetching room users:', err);
        } finally {
            setLoadingRoomUsers(false);
        }
    };

    // Fetch Room Schedules (bookings, lectures, exams, sessions)
    const fetchSchedulesForRoom = async (roomName: string, roomId: string) => {
        setLoadingSchedules(true);
        const combined: CombinedSchedule[] = [];
        try {
            // 1. Fetch lectures for current day name of targetDate
            const dateObj = new Date(targetDate);
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const dayName = dayNames[dateObj.getDay()];

            const { data: lectureData, error: lectureError } = await supabase
                .from('lecture_schedules')
                .select('*')
                .eq('day', dayName)
                .eq('room', roomName)
                .order('start_time');

            if (!lectureError && lectureData) {
                lectureData.forEach(lecture => {
                    combined.push({
                        id: lecture.id,
                        type: 'lecture',
                        start_time: lecture.start_time?.substring(0, 5) || '',
                        end_time: lecture.end_time?.substring(0, 5) || '',
                        title: lecture.course_name,
                        subtitle: `${lecture.course_code} • ${getText('Class', 'Kelas')} ${lecture.class}`,
                        description: `${getText('Lecturer', 'Dosen')}: ${lecture.lecturer} • ${getText('Semester', 'Semester')} ${lecture.semester}`,
                        icon: GraduationCap,
                        color: 'text-blue-700',
                        bgColor: 'bg-blue-50',
                        borderColor: 'border-blue-200'
                    });
                });
            }

            // 2. Fetch exams
            const { data: examData, error: examError } = await supabase
                .from('exams')
                .select('*')
                .eq('room_id', roomId)
                .eq('date', targetDate)
                .order('start_time');

            if (!examError && examData) {
                examData.forEach(exam => {
                    combined.push({
                        id: exam.id,
                        type: 'exam',
                        start_time: exam.start_time?.substring(0, 5) || '',
                        end_time: exam.end_time?.substring(0, 5) || '',
                        title: exam.course_name,
                        subtitle: `${exam.student_amount} ${getText('students', 'mahasiswa')} • ${getText('Semester', 'Semester')} ${exam.semester}`,
                        description: `${getText('Class', 'Kelas')} ${exam.class}`,
                        icon: GraduationCap,
                        color: 'text-green-700',
                        bgColor: 'bg-green-50',
                        borderColor: 'border-green-200'
                    });
                });
            }

            // 3. Fetch final sessions
            const { data: sessionData, error: sessionError } = await supabase
                .from('final_sessions')
                .select(`
                    *,
                    student:users!student_id(full_name, identity_number)
                `)
                .eq('room_id', roomId)
                .eq('date', targetDate)
                .order('start_time');

            if (!sessionError && sessionData) {
                sessionData.forEach(session => {
                    combined.push({
                        id: session.id,
                        type: 'session',
                        start_time: session.start_time?.substring(0, 5) || '',
                        end_time: session.end_time?.substring(0, 5) || '',
                        title: `${session.student?.full_name || getText('Final Session', 'Sidang Akhir')}`,
                        subtitle: `ID: ${session.student?.identity_number}`,
                        description: `${getText('Supervisor', 'Pembimbing')}: ${session.supervisor} • ${getText('Examiner', 'Penguji')}: ${session.examiner}`,
                        icon: UserCheck,
                        color: 'text-purple-700',
                        bgColor: 'bg-purple-50',
                        borderColor: 'border-purple-200'
                    });
                });
            }

            // 4. Fetch bookings
            const startOfDay = `${targetDate}T00:00:00Z`;
            const endOfDay = `${targetDate}T23:59:59Z`;

            const { data: bookingData, error: bookingError } = await supabase
                .from('bookings')
                .select(`
                    *,
                    user:users!user_id(full_name, identity_number)
                `)
                .eq('room_id', roomId)
                .in('status', ['approved', 'borrowed'])
                .lte('start_time', endOfDay)
                .gte('end_time', startOfDay)
                .order('start_time');

            if (!bookingError && bookingData) {
                bookingData.forEach(booking => {
                    const startDate = new Date(booking.start_time);
                    const endDate = new Date(booking.end_time);
                    const displayStartTime = format(startDate, 'HH:mm');
                    const displayEndTime = format(endDate, 'HH:mm');

                    combined.push({
                        id: booking.id,
                        type: 'booking',
                        start_time: displayStartTime,
                        end_time: displayEndTime,
                        title: `${booking.purpose || getText('Room Booking', 'Pemesanan Ruangan')}`,
                        subtitle: `${booking.user?.full_name} • ${booking.user?.identity_number}`,
                        description: `${getText('Status', 'Status')}: ${getText('APPROVED', 'DISETUJUI')}`,
                        icon: CalendarIcon,
                        color: 'text-orange-700',
                        bgColor: 'bg-orange-55',
                        borderColor: 'border-orange-200'
                    });
                });
            }

            // Sort combined schedules by start time
            combined.sort((a, b) => a.start_time.localeCompare(b.start_time));
            setCombinedSchedules(combined);

        } catch (err) {
            console.error('Error fetching schedules:', err);
        } finally {
            setLoadingSchedules(false);
        }
    };

    // Filter and search logic for rooms
    const filteredRooms = rooms.filter(room => {
        const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            room.code.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const totalRoomPages = Math.max(1, Math.ceil(filteredRooms.length / roomPageSize));
    const paginatedRooms = filteredRooms.slice(
        roomCurrentPage * roomPageSize,
        (roomCurrentPage + 1) * roomPageSize
    );
    const resetRoomPage = () => setRoomCurrentPage(0);

    // Filter logic for equipment
    // Unique room names from loaded equipment for the room filter dropdown
    const equipmentRoomNames = [...new Set(
        allEquipment.map(eq => (eq as any).rooms?.name).filter(Boolean)
    )].sort() as string[];
    const filteredRoomDropdownNames = equipmentRoomNames.filter(name =>
        name.toLowerCase().includes(roomFilterSearchTerm.toLowerCase())
    );
    const filteredEquipment = allEquipment.filter(eq => {
        const term = equipmentSearchTerm.toLowerCase();
        const matchesSearch = !term || eq.name.toLowerCase().includes(term) || eq.code.toLowerCase().includes(term);
        const matchesRoom = equipmentRoomFilter === 'all' || (eq as any).rooms?.name === equipmentRoomFilter;
        return matchesSearch && matchesRoom;
    });
    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredEquipment.length / equipmentPageSize));
    const paginatedEquipment = filteredEquipment.slice(
        equipmentCurrentPage * equipmentPageSize,
        (equipmentCurrentPage + 1) * equipmentPageSize
    );
    const resetEquipmentPage = () => setEquipmentCurrentPage(0);

    const getEquipmentConditionChip = (condition: string | null) => {
        const text = condition || 'GOOD';
        switch (text) {
            case 'GOOD':
                return <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wide">BAIK</span>;
            case 'BROKEN':
                return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase tracking-wide">RUSAK</span>;
            case 'MAINTENANCE':
                return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wide">PERAWATAN</span>;
            default:
                return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold uppercase tracking-wide">{text}</span>;
        }
    };

    const CombinedScheduleSection = () => {
        const titleText = getText(`Schedule for ${format(new Date(targetDate), 'EEEE, MMMM d, yyyy')}`, `Jadwal untuk ${format(new Date(targetDate), 'EEEE, d MMMM yyyy')}`);
        const subtitleText = getText(`Showing all activities for the selected date`, `Menampilkan semua aktivitas untuk tanggal yang dipilih`);

        return (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                                <Building className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-base font-semibold">{titleText}</h4>
                                <p className="text-blue-100 text-xs">{subtitleText}</p>
                            </div>
                        </div>
                        <div className="bg-white bg-opacity-20 rounded-lg px-2.5 py-0.5">
                            <span className="text-sm font-semibold">{combinedSchedules.length}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    {loadingSchedules ? (
                        <div className="flex justify-center items-center h-32">
                            <RefreshCw className="animate-spin h-6 w-6 text-gray-500" />
                        </div>
                    ) : combinedSchedules.length > 0 ? (
                        <div className="space-y-3">
                            {combinedSchedules.map((schedule, index) => {
                                const IconComponent = schedule.icon;
                                return (
                                    <div
                                        key={`${schedule.type}-${schedule.id}-${index}`}
                                        className={`${schedule.bgColor} rounded-lg p-4 border ${schedule.borderColor} hover:shadow-sm transition-shadow`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                                    <IconComponent className={`h-4 w-4 ${schedule.color}`} />
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className={`text-[10px] font-bold ${schedule.color} bg-white px-2 py-0.5 rounded-full uppercase tracking-wide`}>
                                                        {schedule.type === 'lecture' ? getText('Lecture', 'Kuliah') :
                                                            schedule.type === 'exam' ? getText('Exam', 'UAS') :
                                                                schedule.type === 'session' ? getText('Session', 'Sidang') :
                                                                    getText('Booking', 'Booking')}
                                                    </span>
                                                    <span className="font-semibold text-gray-900 text-sm">
                                                        {schedule.end_time ? `${schedule.start_time} - ${schedule.end_time}` : schedule.start_time}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="font-semibold text-gray-900 text-sm">{schedule.title}</div>
                                            {schedule.subtitle && (
                                                <div className={`text-xs ${schedule.color} font-medium`}>{schedule.subtitle}</div>
                                            )}
                                            {schedule.description && (
                                                <div className="text-xs text-gray-500">{schedule.description}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-base font-medium mb-1">{getText('No schedule', 'Tidak ada jadwal')}</p>
                            <p className="text-xs text-gray-400">
                                {getText(`This room is empty for ${format(new Date(targetDate), 'MMM dd, yyyy')}`, `Ruangan ini kosong untuk ${format(new Date(targetDate), 'dd MMM yyyy')}`)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                                <Info className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    {getText('Facilities & Infrastructure Info', 'Informasi Sarana Prasarana')}
                                </h1>
                                <p className="text-gray-600 mt-1 text-sm max-w-2xl">
                                    {getText('View room details, capacity, facilities, equipment inventory, and daily schedule info.', 'Lihat informasi ruangan, kapasitas, fasilitas, inventaris alat, serta jadwal penggunaan ruangan harian.')}
                                </p>
                            </div>
                        </div>
                        <div className="hidden md:block">
                            <div className="px-4 py-2 bg-blue-100 rounded-xl text-xs font-bold uppercase tracking-widest text-blue-700">
                                {getText('Public Access', 'Akses Publik')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 space-y-6">

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 flex gap-2 w-full">
                <button
                    onClick={() => setActiveTab('rooms')}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        activeTab === 'rooms'
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-200/50 transform scale-[1.01]'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                    <Building className="h-5 w-5" />
                    {getText('Room Information', 'Keterangan Ruang')}
                </button>
                <button
                    onClick={() => setActiveTab('equipment')}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        activeTab === 'equipment'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200/50 transform scale-[1.01]'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                    <Wrench className="h-5 w-5" />
                    {getText('Equipment Information', 'Keterangan Alat')}
                </button>
            </div>


            

            {/* ======================== TAB: KETERANGAN RUANG ======================== */}
            {activeTab === 'rooms' && (
                <>
                    {/* Filters section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder={getText('Search rooms by name or code...', 'Cari ruangan berdasarkan nama atau kode...')}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); resetRoomPage(); }}
                                className="w-full pl-11 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-sm"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Per-page selector */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-gray-500 whitespace-nowrap">{getText('Show', 'Tampil')}</span>
                                <select
                                    value={roomPageSize}
                                    onChange={(e) => { setRoomPageSize(Number(e.target.value)); resetRoomPage(); }}
                                    className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-blue-500 bg-white"
                                >
                                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>

                            {/* Grid/List View Toggles */}
                            <div className="flex border border-gray-200 rounded-xl overflow-hidden p-0.5 bg-gray-55 flex-shrink-0">
                                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}><Grid className="h-4 w-4" /></button>
                                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}><List className="h-4 w-4" /></button>
                            </div>
                        </div>
                    </div>

                    {/* Room Content List/Grid - Compact View */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                            <p className="text-gray-500 text-sm font-semibold">{getText('Loading rooms list...', 'Memuat daftar ruangan...')}</p>
                        </div>
                    ) : filteredRooms.length > 0 ? (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 gap-4">
                                {paginatedRooms.map(room => (
                                    <div key={room.id} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 hover:shadow-md hover:border-blue-100 transition-all duration-300 group flex flex-col gap-3">
                                        {/* Top Section: Info & Action Button */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                            {/* Left Side: Room Name & Code */}
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-normal text-gray-800 text-base leading-snug truncate">{room.name}</h3>
                                                <p className="text-[11px] text-gray-400 tracking-wide mt-0.5">{room.code}</p>
                                            </div>

                                            {/* Right Side: Action Button */}
                                            <div className="w-full sm:w-auto flex-shrink-0">
                                                <button
                                                    onClick={() => setShowRoomDetail(room)}
                                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-xs transition-all duration-200 w-full sm:w-auto"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    {getText('View Details', 'Lihat Detail')}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Middle: Capacity, Department, Building */}
                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5 text-blue-400" />
                                                <span>{room.capacity} {getText('seats', 'kursi')}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                                <span className="truncate max-w-[120px]">{room.department?.name || getText('General', 'Umum')}</span>
                                            </div>
                                            {room.building?.name && (
                                                <div className="flex items-center gap-1.5">
                                                    <Building className="h-3.5 w-3.5 text-indigo-300 flex-shrink-0" />
                                                    <span className="truncate max-w-[140px]">{room.building.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Room Name', 'Nama Ruangan')}</th>
                                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Code', 'Kode')}</th>
                                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Capacity', 'Kapasitas')}</th>
                                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Department', 'Departemen')}</th>
                                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Building', 'Gedung')}</th>
                                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap text-right">{getText('Actions', 'Aksi')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedRooms.map(room => (
                                            <tr key={room.id} className="border-b border-gray-100 hover:bg-gray-50 transition-all duration-200">
                                                <td className="px-6 py-4 font-normal text-gray-700 text-sm whitespace-nowrap">{room.name}</td>
                                                <td className="px-6 py-4 text-sm font-normal text-gray-500 whitespace-nowrap">{room.code}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{room.capacity} {getText('seats', 'kursi')}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{room.department?.name || getText('General', 'Umum')}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{room.building?.name || '-'}</td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <button onClick={() => setShowRoomDetail(room)} className="inline-flex items-center justify-center p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-all ml-auto" title={getText('View Details', 'Lihat Detail')}>
                                                        <Eye className="h-5 w-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : (
                        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
                            <DoorClosed className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-bold text-gray-700">{getText('No Rooms Found', 'Tidak Ada Ruangan Ditemukan')}</p>
                            <p className="text-gray-400 text-sm mt-1">{getText('Try adjusting your search or filter keywords.', 'Coba sesuaikan kata kunci pencarian atau filter Anda.')}</p>
                        </div>
                    )}

                    {/* Room Pagination Controls */}
                    {!loading && filteredRooms.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                            <div className="text-sm text-gray-500">
                                {getText(
                                    `Showing ${roomCurrentPage * roomPageSize + 1}-${Math.min((roomCurrentPage + 1) * roomPageSize, filteredRooms.length)} of ${filteredRooms.length} rooms`,
                                    `Menampilkan ${roomCurrentPage * roomPageSize + 1}-${Math.min((roomCurrentPage + 1) * roomPageSize, filteredRooms.length)} dari ${filteredRooms.length} ruangan`
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setRoomCurrentPage(0)}
                                    disabled={roomCurrentPage === 0}
                                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                >{'<<'}</button>
                                <button
                                    onClick={() => setRoomCurrentPage(p => Math.max(0, p - 1))}
                                    disabled={roomCurrentPage === 0}
                                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                >{getText('Prev', 'Sebelum')}</button>
                                {Array.from({ length: Math.min(5, totalRoomPages) }, (_, i) => {
                                    const start = Math.max(0, Math.min(roomCurrentPage - 2, totalRoomPages - 5));
                                    const page = start + i;
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setRoomCurrentPage(page)}
                                            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                                                roomCurrentPage === page
                                                    ? 'bg-blue-600 border-blue-600 text-white font-medium'
                                                    : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            {page + 1}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setRoomCurrentPage(p => Math.min(totalRoomPages - 1, p + 1))}
                                    disabled={roomCurrentPage >= totalRoomPages - 1}
                                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                >{getText('Next', 'Berikut')}</button>
                                <button
                                    onClick={() => setRoomCurrentPage(totalRoomPages - 1)}
                                    disabled={roomCurrentPage >= totalRoomPages - 1}
                                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                >{'>>'}</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ======================== TAB: KETERANGAN ALAT ======================== */}
            {activeTab === 'equipment' && (
                <>
                    {/* Equipment Filters */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
                        {/* Row 1: Search text + Scan + Room Filter Dropdown + Per-page */}
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            {/* Text search */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={getText('Search by name or code...', 'Ketik nama atau kode alat...')}
                                    value={equipmentSearchTerm}
                                    onChange={(e) => { setEquipmentSearchTerm(e.target.value); resetEquipmentPage(); }}
                                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors text-sm"
                                />
                                {equipmentSearchTerm && (
                                    <button onClick={() => { setEquipmentSearchTerm(''); resetEquipmentPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Scan barcode button */}
                            <button
                                onClick={() => setShowBarcodeScanner(true)}
                                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all flex-shrink-0"
                                title={getText('Scan Barcode / QR Code', 'Scan Barcode / QR Code')}
                            >
                                <ScanBarcode className="h-5 w-5" />
                                <span className="hidden sm:inline">{getText('Scan', 'Scan')}</span>
                            </button>

                            {/* Room filter dropdown */}
                            <div className="relative flex-shrink-0" id="room-filter-dropdown">
                                <button
                                    onClick={() => setIsRoomFilterDropdownOpen(!isRoomFilterDropdownOpen)}
                                    className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-gray-700 bg-white min-w-[200px] flex items-center justify-between gap-2 cursor-pointer shadow-sm"
                                >
                                    <span className="truncate flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                        {equipmentRoomFilter === 'all' ? getText('All Rooms', 'Semua Ruangan') : equipmentRoomFilter}
                                    </span>
                                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isRoomFilterDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isRoomFilterDropdownOpen && (
                                    <div className="absolute top-full right-0 sm:left-0 mt-1 w-[260px] bg-white border border-gray-200 rounded-xl shadow-xl z-[100] max-h-[300px] flex flex-col overflow-hidden">
                                        <div className="p-2 border-b border-gray-100 flex items-center gap-1.5 bg-gray-50/50">
                                            <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                            <input
                                                type="text"
                                                placeholder={getText('Filter rooms...', 'Cari nama ruangan...')}
                                                value={roomFilterSearchTerm}
                                                onChange={(e) => setRoomFilterSearchTerm(e.target.value)}
                                                className="w-full bg-transparent text-xs focus:outline-none text-gray-700 placeholder-gray-400 py-1"
                                                autoFocus
                                            />
                                            {roomFilterSearchTerm && (
                                                <button onClick={() => setRoomFilterSearchTerm('')} className="p-0.5 text-gray-400 hover:text-gray-600 rounded"><X className="h-3 w-3" /></button>
                                            )}
                                        </div>
                                        <div className="overflow-y-auto flex-1 py-1">
                                            <button
                                                onClick={() => { setEquipmentRoomFilter('all'); setIsRoomFilterDropdownOpen(false); setRoomFilterSearchTerm(''); resetEquipmentPage(); }}
                                                className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors ${equipmentRoomFilter === 'all' ? 'text-emerald-600 font-medium bg-emerald-50/50' : 'text-gray-700'}`}
                                            >
                                                {getText('All Rooms', 'Semua Ruangan')}
                                            </button>
                                            {filteredRoomDropdownNames.length > 0 ? filteredRoomDropdownNames.map(name => (
                                                <button
                                                    key={name}
                                                    onClick={() => { setEquipmentRoomFilter(name); setIsRoomFilterDropdownOpen(false); setRoomFilterSearchTerm(''); resetEquipmentPage(); }}
                                                    className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors truncate ${equipmentRoomFilter === name ? 'text-emerald-600 font-medium bg-emerald-50/50' : 'text-gray-700'}`}
                                                    title={name}
                                                >
                                                    {name}
                                                </button>
                                            )) : (
                                                <div className="px-4 py-3 text-xs text-gray-400 italic text-center">{getText('No rooms match', 'Tidak ada ruangan cocok')}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Per-page selector */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-gray-500 whitespace-nowrap">{getText('Show', 'Tampil')}</span>
                                <select
                                    value={equipmentPageSize}
                                    onChange={(e) => { setEquipmentPageSize(Number(e.target.value)); resetEquipmentPage(); }}
                                    className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-emerald-500 bg-white"
                                >
                                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Active filter chips */}
                        {(equipmentSearchTerm || equipmentRoomFilter !== 'all') && (
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-xs text-gray-400">{getText('Active filters:', 'Filter aktif:')}</span>
                                {equipmentSearchTerm && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-200">
                                        <Search className="h-3 w-3" />"{equipmentSearchTerm}"
                                        <button onClick={() => { setEquipmentSearchTerm(''); resetEquipmentPage(); }} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
                                    </span>
                                )}
                                {equipmentRoomFilter !== 'all' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200">
                                        <MapPin className="h-3 w-3" />{equipmentRoomFilter}
                                        <button onClick={() => { setEquipmentRoomFilter('all'); resetEquipmentPage(); }} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
                                    </span>
                                )}
                                <button
                                    onClick={() => { setEquipmentSearchTerm(''); setEquipmentRoomFilter('all'); resetEquipmentPage(); }}
                                    className="text-xs text-red-500 hover:text-red-700 underline"
                                >
                                    {getText('Reset all', 'Reset semua')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Equipment Stats Summary Removed */}

                    {/* Equipment Table */}
                    {loadingAllEquipment && allEquipment.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                            <p className="text-gray-500 text-sm">{getText('Loading equipment list...', 'Memuat daftar alat...')}</p>
                        </div>
                    ) : filteredEquipment.length > 0 ? (
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
                            {/* Info bar */}
                            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between flex-wrap gap-2">
                                <span className="text-xs text-gray-500">
                                    {getText(
                                        `Showing ${equipmentCurrentPage * equipmentPageSize + 1}–${Math.min((equipmentCurrentPage + 1) * equipmentPageSize, filteredEquipment.length)} of ${filteredEquipment.length} items`,
                                        `Menampilkan ${equipmentCurrentPage * equipmentPageSize + 1}–${Math.min((equipmentCurrentPage + 1) * equipmentPageSize, filteredEquipment.length)} dari ${filteredEquipment.length} alat`
                                    )}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {filteredEquipment.filter(e => !e.is_available).length} {getText('currently in use', 'sedang dipakai')}
                                </span>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">No</th>
                                        <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Equipment Name', 'Nama Alat')}</th>
                                        <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Code', 'Kode')}</th>
                                        <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Qty', 'Jumlah')}</th>
                                        <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Room Location', 'Lokasi')}</th>
                                        <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap text-right">{getText('Detail', 'Detail')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedEquipment.map((eq, idx) => {
                                        const eqRoom = (eq as any).rooms;
                                        const isInUse = !eq.is_available;
                                        const rowNum = equipmentCurrentPage * equipmentPageSize + idx + 1;
                                        return (
                                            <tr key={eq.id} className={`border-b border-gray-100 transition-all duration-150 ${ isInUse ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-emerald-50/20' }`}>
                                                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{rowNum}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-gray-800">{eq.name}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="text-xs text-gray-400 font-mono">{eq.code}</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                    {eq.quantity != null ? `${eq.quantity} ${eq.unit || ''}`.trim() : '—'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {eqRoom ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <DoorClosed className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                                                <span className="text-sm text-gray-700">{eqRoom.name}</span>
                                                            </div>
                                                            {eqRoom.building && (
                                                                <div className="flex items-center gap-1.5 pl-5">
                                                                    <Building className="h-3 w-3 text-gray-300 flex-shrink-0" />
                                                                    <span className="text-xs text-gray-400">{eqRoom.building?.name || eqRoom.building}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 italic text-xs">{getText('Not assigned', 'Belum ada ruangan')}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => openEquipmentDetail(eq)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-medium transition-all duration-200 border border-emerald-200 hover:border-emerald-600"
                                                        title={getText('View Equipment Detail', 'Lihat Detail Alat')}
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        {getText('Detail', 'Detail')}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {/* Pagination controls */}
                            {totalPages > 1 && (
                                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-xs text-gray-500">
                                        {getText(`Page ${equipmentCurrentPage + 1} of ${totalPages}`, `Halaman ${equipmentCurrentPage + 1} dari ${totalPages}`)}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setEquipmentCurrentPage(0)}
                                            disabled={equipmentCurrentPage === 0}
                                            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                        >«</button>
                                        <button
                                            onClick={() => setEquipmentCurrentPage(p => Math.max(0, p - 1))}
                                            disabled={equipmentCurrentPage === 0}
                                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                        >{getText('Prev', 'Sebelum')}</button>
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            const start = Math.max(0, Math.min(equipmentCurrentPage - 2, totalPages - 5));
                                            const page = start + i;
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setEquipmentCurrentPage(page)}
                                                    className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                                                        page === equipmentCurrentPage
                                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                                            : 'border-gray-200 hover:bg-gray-100'
                                                    }`}
                                                >{page + 1}</button>
                                            );
                                        })}
                                        <button
                                            onClick={() => setEquipmentCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                                            disabled={equipmentCurrentPage >= totalPages - 1}
                                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                        >{getText('Next', 'Berikut')}</button>
                                        <button
                                            onClick={() => setEquipmentCurrentPage(totalPages - 1)}
                                            disabled={equipmentCurrentPage >= totalPages - 1}
                                            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                        >»</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
                            <Wrench className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg text-gray-700">{getText('No Equipment Found', 'Tidak Ada Alat Ditemukan')}</p>
                            <p className="text-gray-400 text-sm mt-1">{getText('Try adjusting your search or filter keywords.', 'Coba sesuaikan kata kunci pencarian atau filter Anda.')}</p>
                        </div>
                    )}
                </>
            )}

            {/* ======================== Equipment Detail Modal (View-Only) ======================== */}
            {showEquipmentDetail && selectedEquipmentDetail && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6 text-white flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold">{selectedEquipmentDetail.name}</h3>
                                    <p className="text-indigo-200 text-sm mt-0.5">{getText('Complete Equipment Information', 'Informasi Lengkap Peralatan')}</p>
                                </div>
                                <button
                                    onClick={() => { setShowEquipmentDetail(false); setSelectedEquipmentDetail(null); }}
                                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {loadingEquipmentDetail ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
                                    <p className="text-gray-500 text-sm">{getText('Loading equipment details...', 'Memuat detail peralatan...')}</p>
                                </div>
                            ) : (
                                <>
                                    {/* Equipment Photo */}
                                    {equipmentDetailPhoto ? (
                                        <div className="relative rounded-xl overflow-hidden shadow-md h-56">
                                            <ImageWithLoader
                                                src={equipmentDetailPhoto}
                                                alt={selectedEquipmentDetail.name}
                                                className="w-full h-full object-cover"
                                                title={selectedEquipmentDetail.name}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                            <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                                                <div>
                                                    <h4 className="text-white font-bold text-2xl drop-shadow-md">{selectedEquipmentDetail.name}</h4>
                                                    <p className="text-white/80 text-sm font-mono mt-1">{selectedEquipmentDetail.code}</p>
                                                </div>
                                                <button onClick={() => setShowEquipmentImageFullscreen(true)} className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white transition-all shadow-lg border border-white/10" title="View Fullscreen">
                                                    <Maximize2 className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-8 text-center border-2 border-dashed border-indigo-100">
                                            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                                                <Wrench className="h-10 w-10 text-indigo-400 opacity-60" />
                                            </div>
                                            <h4 className="font-bold text-xl text-gray-800">{selectedEquipmentDetail.name}</h4>
                                            <p className="text-indigo-400 text-sm mt-1 italic">{getText('No photo available', 'Tidak ada foto')}</p>
                                        </div>
                                    )}

                                    {/* Detail Equipment Sub-items */}
                                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-4 rounded-xl border border-violet-200">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Package className="h-5 w-5 text-violet-600" />
                                            <h4 className="font-bold text-violet-900">
                                                {getText('Detail Equipment', 'Detail Peralatan')}
                                            </h4>
                                            <span className="text-xs bg-violet-200 text-violet-700 px-2 py-0.5 rounded-full">
                                                {equipmentDetailItems.length} {getText('items', 'item')}
                                            </span>
                                        </div>
                                        {equipmentDetailItems.length === 0 ? (
                                            <div className="text-center py-6 bg-white rounded-xl border-2 border-dashed border-violet-200">
                                                <div className="w-12 h-12 mx-auto bg-violet-100 rounded-full flex items-center justify-center mb-2">
                                                    <Package className="h-6 w-6 text-violet-400" />
                                                </div>
                                                <p className="text-gray-400 text-sm">{getText('No detail items', 'Tidak ada detail item')}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-52 overflow-y-auto">
                                                {equipmentDetailItems.map((detail, idx) => (
                                                    <div key={detail.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden border border-gray-200 bg-violet-50 flex items-center justify-center">
                                                            {detail.attachments ? (
                                                                <img src={detail.attachments} alt={detail.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Package className="h-5 w-5 text-violet-400" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-gray-900 text-sm truncate">{detail.name}</span>
                                                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs font-mono rounded">{detail.code}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                                <span>{detail.quantity} {detail.unit}</span>
                                                                {getEquipmentConditionChip(detail.condition)}
                                                            </div>
                                                            {detail.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{detail.notes}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info Grid */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                        {/* Left Column */}
                                        <div className="space-y-4">
                                            {/* Basic Info */}
                                            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                                                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                                                    <Package className="h-5 w-5" />
                                                    {getText('Basic Information', 'Informasi Dasar')}
                                                </h4>
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-xs text-blue-700 mb-0.5">{getText('Equipment Name', 'Nama Peralatan')}</p>
                                                        <p className="font-bold text-gray-900">{selectedEquipmentDetail.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-blue-700 mb-0.5">{getText('NUP / Code', 'NUP / Kode')}</p>
                                                        <p className="font-mono font-bold text-gray-900">{selectedEquipmentDetail.code}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-blue-700 mb-0.5">{getText('Category', 'Kategori')}</p>
                                                        <p className="font-bold text-gray-900">{selectedEquipmentDetail.category || '—'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quantity */}
                                            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                                                <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                                                    <Hash className="h-5 w-5" />
                                                    {getText('Quantity & Unit', 'Jumlah & Satuan')}
                                                </h4>
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-xs text-purple-700 mb-0.5">{getText('Quantity', 'Jumlah')}</p>
                                                        <p className="text-2xl font-bold text-purple-900">{selectedEquipmentDetail.quantity ?? '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-purple-700 mb-0.5">{getText('Unit', 'Satuan')}</p>
                                                        <p className="font-bold text-gray-900">{selectedEquipmentDetail.unit || '—'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Location */}
                                            <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                                                <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                                                    <MapPin className="h-5 w-5" />
                                                    {getText('Location', 'Lokasi')}
                                                </h4>
                                                <div className="space-y-2">
                                                    {selectedEquipmentDetail.rooms?.building?.campus?.name && (
                                                        <div>
                                                            <p className="text-xs text-green-700 mb-0.5">{getText('Campus', 'Kampus')}</p>
                                                            <p className="font-bold text-gray-900">{selectedEquipmentDetail.rooms.building.campus.name}</p>
                                                        </div>
                                                    )}
                                                    {selectedEquipmentDetail.rooms?.building?.name && (
                                                        <div>
                                                            <p className="text-xs text-green-700 mb-0.5">{getText('Building', 'Gedung')}</p>
                                                            <p className="font-bold text-gray-900">{selectedEquipmentDetail.rooms.building.name}</p>
                                                        </div>
                                                    )}
                                                    {selectedEquipmentDetail.rooms?.floor && (
                                                        <div>
                                                            <p className="text-xs text-green-700 mb-0.5">{getText('Floor', 'Lantai')}</p>
                                                            <p className="font-bold text-gray-900">{getText('Floor', 'Lantai')} {selectedEquipmentDetail.rooms.floor}</p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-xs text-green-700 mb-0.5">{getText('Room', 'Ruangan')}</p>
                                                        <p className="font-bold text-gray-900">{selectedEquipmentDetail.rooms?.name || getText('Not assigned', 'Belum ada ruangan')}</p>
                                                    </div>
                                                    {selectedEquipmentDetail.rooms?.code && (
                                                        <div>
                                                            <p className="text-xs text-green-700 mb-0.5">{getText('Room Code', 'Kode Ruangan')}</p>
                                                            <p className="font-mono font-bold text-gray-900">{selectedEquipmentDetail.rooms.code}</p>
                                                        </div>
                                                    )}
                                                    {selectedEquipmentDetail.rooms?.department?.name && (
                                                        <div>
                                                            <p className="text-xs text-green-700 mb-0.5">{getText('Department', 'Departemen')}</p>
                                                            <p className="font-bold text-blue-900">{selectedEquipmentDetail.rooms.department.name}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sub-Location Details: Cabinet/Table, Rack, Box */}
                                            {(selectedEquipmentDetail.table_id || selectedEquipmentDetail.rack_id || selectedEquipmentDetail.box_id) && (
                                                <div className="mt-4 pt-3 border-t border-green-200">
                                                    <h5 className="font-semibold text-green-800 mb-2 flex items-center gap-2 text-sm">
                                                        <Layers className="h-4 w-4" />
                                                        {getText('Storage Location', 'Lokasi Penyimpanan')}
                                                    </h5>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {selectedEquipmentDetail.table_id && selectedEquipmentDetail.tableName && (
                                                            <div className="flex items-center gap-2 bg-white/60 px-3 py-2 rounded-lg border border-indigo-100">
                                                                <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                                                                    <Archive className="h-4 w-4 text-indigo-600" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-green-600">{getText('Cabinet/Table', 'Kabinet/Meja')}</p>
                                                                    <p className="font-semibold text-gray-900 text-sm">{selectedEquipmentDetail.tableName}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {selectedEquipmentDetail.rack_id && selectedEquipmentDetail.rackName && (
                                                            <div className="flex items-center gap-2 bg-white/60 px-3 py-2 rounded-lg border border-teal-100">
                                                                <div className="w-7 h-7 bg-teal-100 rounded-lg flex items-center justify-center">
                                                                    <Layers className="h-4 w-4 text-teal-600" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-green-600">{getText('Rack', 'Rak')}</p>
                                                                    <p className="font-semibold text-gray-900 text-sm">{selectedEquipmentDetail.rackName}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {selectedEquipmentDetail.box_id && selectedEquipmentDetail.boxName && (
                                                            <div className="flex items-center gap-2 bg-white/60 px-3 py-2 rounded-lg border border-amber-100">
                                                                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                                                                    <Box className="h-4 w-4 text-amber-600" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-green-600">{getText('Box', 'Kotak')}</p>
                                                                    <p className="font-semibold text-gray-900 text-sm">{selectedEquipmentDetail.boxName}</p>
                                                                    {selectedEquipmentDetail.boxDesc && <p className="text-xs text-gray-500">{selectedEquipmentDetail.boxDesc}</p>}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Column */}
                                        <div className="space-y-4">
                                            {/* Status & Condition */}
                                            <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
                                                <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                                                    <AlertCircle className="h-5 w-5" />
                                                    {getText('Status & Condition', 'Status & Kondisi')}
                                                </h4>
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-xs text-amber-700 mb-1">{getText('Condition', 'Kondisi')}</p>
                                                        {getEquipmentConditionChip(selectedEquipmentDetail.condition)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-amber-700 mb-0.5">{getText('Availability', 'Ketersediaan')}</p>
                                                        <p className="font-bold text-gray-900 text-sm">
                                                            {selectedEquipmentDetail.is_available
                                                                ? getText('✅ Available for Lending', '✅ Tersedia untuk Dipinjam')
                                                                : getText('❌ Not Available', '❌ Tidak Tersedia')}
                                                        </p>
                                                    </div>
                                                    {selectedEquipmentDetail.is_mandatory !== undefined && (
                                                        <div>
                                                            <p className="text-xs text-amber-700 mb-0.5">{getText('Mandatory', 'Wajib')}</p>
                                                            <p className="font-bold text-gray-900 text-sm">
                                                                {selectedEquipmentDetail.is_mandatory
                                                                    ? getText('⭐ Yes - Required Equipment', '⭐ Ya - Peralatan Wajib')
                                                                    : getText('No - Optional', 'Tidak - Opsional')}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Specifications */}
                                            {selectedEquipmentDetail.Spesification && (() => {
                                                const { purchaseYear, procurementType, specs } = parseEquipmentSpec(selectedEquipmentDetail.Spesification);
                                                if (!purchaseYear && !procurementType && !specs) return null;
                                                return (
                                                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                                                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                                                            <FileText className="h-5 w-5" />
                                                            {getText('Specifications & Details', 'Spesifikasi & Detail')}
                                                        </h4>
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

                                            {/* Timestamps */}
                                            {selectedEquipmentDetail.created_at && (
                                                <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                                                    <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                                        <Clock className="h-5 w-5" />
                                                        {getText('Timestamps', 'Stempel Waktu')}
                                                    </h4>
                                                    <div>
                                                        <p className="text-xs text-slate-600 mb-0.5">{getText('Created At', 'Dibuat Pada')}</p>
                                                        <p className="font-bold text-gray-900 text-sm">{format(new Date(selectedEquipmentDetail.created_at), 'dd MMM yyyy, HH:mm')}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end flex-shrink-0">
                            <button
                                onClick={() => { setShowEquipmentDetail(false); setSelectedEquipmentDetail(null); }}
                                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl text-sm transition-all"
                            >
                                {getText('Close', 'Tutup')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Room Details Modal */}
            {showRoomDetail && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-blue-55 to-indigo-50">
                            <div>
                                <h2 className="text-2xl font-extrabold text-gray-900">{showRoomDetail.name}</h2>
                                <p className="text-xs text-gray-500 font-mono tracking-widest uppercase mt-0.5">{showRoomDetail.code}</p>
                            </div>
                            <button
                                onClick={() => setShowRoomDetail(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
                            <div className="flex flex-col gap-6">
                                {/* Top Section: Info & Schedule (Prioritized) */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Left: Room Details & Image */}
                                    <div className="space-y-6">
                                        {/* Room Photo Card */}
                                        <div className="relative rounded-2xl overflow-hidden shadow-md h-56 bg-gradient-to-r from-blue-50 to-indigo-50 border border-gray-100">
                                            {roomPhoto ? (
                                                <img src={roomPhoto} alt={showRoomDetail.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-30">
                                                    <DoorClosed className="h-16 w-16 text-blue-600" />
                                                    <span className="text-xs font-extrabold font-mono tracking-widest">{showRoomDetail.code}</span>
                                                </div>
                                            )}
                                            <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm border border-white/50">
                                                <span className="text-sm font-bold text-gray-800">{showRoomDetail.name}</span>
                                            </div>
                                        </div>

                                        {/* Room Metadata Card */}
                                        <div className="bg-gradient-to-br from-blue-55 to-indigo-50/50 p-6 rounded-2xl border border-blue-100 shadow-sm space-y-4">
                                            <h4 className="font-extrabold text-blue-900 flex items-center gap-2 text-base"><Building className="h-5 w-5 text-blue-600" />{getText('Room Information', 'Keterangan Ruangan')}</h4>
                                            <div className="space-y-4 pt-1">
                                                <div>
                                                    <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mb-1">{getText('Department', 'Departemen')}</p>
                                                    <p className="font-bold text-gray-900 text-sm">{showRoomDetail.department?.name || getText('General', 'Umum')}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mb-1">{getText('Campus Location', 'Lokasi Kampus')}</p>
                                                    <p className="font-bold text-gray-900 text-sm">{showRoomDetail.building?.campus?.name || '-'} • Gedung {showRoomDetail.building?.name || '-'}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mb-1">{getText('Capacity', 'Kapasitas')}</p>
                                                        <p className="font-bold text-gray-900 text-sm">{showRoomDetail.capacity} {getText('seats', 'kursi')}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mb-1">{getText('Status', 'Status')}</p>
                                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border mt-0.5 ${showRoomDetail.is_available ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-red-50 text-red-700 border-red-200 shadow-sm'}`}>
                                                            {showRoomDetail.is_available ? getText('Available', 'Tersedia') : getText('Not Available', 'Tidak Tersedia')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Room Schedule */}
                                    <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-5 flex flex-col h-full">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-extrabold text-gray-900 flex items-center gap-2 text-base"><CalendarIcon className="h-5 w-5 text-gray-500" />{getText('Room Schedule', 'Jadwal Ruangan')}</h4>
                                            <input
                                                type="date"
                                                value={targetDate}
                                                onChange={(e) => setTargetDate(e.target.value)}
                                                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-gray-700 shadow-sm"
                                            />
                                        </div>
                                        <div className="flex-1 overflow-y-auto pr-2 min-h-[300px]">
                                            <CombinedScheduleSection />
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Section: Users & Equipment (Secondary) */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
                                    {/* Left: Assigned Staff */}
                                    <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4">
                                        <h4 className="font-extrabold text-gray-900 flex items-center gap-2 text-base"><UserCheck className="h-5 w-5 text-gray-500" />{getText('Assigned Users', 'Pengguna yang Ditugaskan')}</h4>

                                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                                            {loadingRoomUsers ? (
                                                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-gray-500" /></div>
                                            ) : roomUsers.length > 0 ? (
                                                roomUsers.map(ru => (
                                                    <div key={ru.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors">
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-extrabold flex items-center justify-center text-sm shadow-sm">
                                                            {ru.user?.full_name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-gray-900 text-sm truncate">{ru.user?.full_name}</p>
                                                            <p className="text-[11px] text-gray-500 truncate mt-0.5">{ru.user?.jabatan || ru.user?.role}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-8">
                                                    <p className="text-sm text-gray-400 font-semibold">{getText('No users assigned.', 'Tidak ada pengguna yang ditugaskan.')}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Equipment in Room */}
                                    <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4">
                                        <h4 className="font-extrabold text-gray-900 flex items-center gap-2 text-base"><Wrench className="h-5 w-5 text-gray-500" />{getText('Equipment in Room', 'Peralatan di Ruangan')}</h4>
                                        
                                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                                            {loadingEquipment ? (
                                                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-gray-500" /></div>
                                            ) : selectedRoomEquipment.length > 0 ? (
                                                selectedRoomEquipment.map(eq => {
                                                    const { purchaseYear, procurementType } = parseEquipmentSpec(eq.Spesification || '');
                                                    return (
                                                        <div key={eq.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-2 hover:border-blue-200 transition-colors">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-gray-900 text-sm leading-snug truncate">{eq.name}</p>
                                                                    <p className="text-[10px] text-gray-400 font-mono tracking-wider mt-0.5 uppercase truncate">{eq.code}</p>
                                                                </div>
                                                                <div className="flex-shrink-0">
                                                                    {getEquipmentConditionChip(eq.condition)}
                                                                </div>
                                                            </div>
                                                            {/* Details */}
                                                            {(purchaseYear || procurementType) && (
                                                                <div className="mt-1 text-[11px] bg-white p-2 rounded-lg border border-gray-50">
                                                                    <p className="text-gray-500 font-semibold mb-1">{getText('Purchase Year & Procurement:', 'Tahun Pembelian & Pengadaan:')}</p>
                                                                    <div className="text-gray-800 font-medium">
                                                                        {purchaseYear && <div>{getText('Year:', 'Tahun:')} {purchaseYear}</div>}
                                                                        {procurementType && <div>{getText('Type:', 'Jenis:')} {procurementType}</div>}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="text-center py-8">
                                                    <p className="text-sm text-gray-400 font-semibold">{getText('No equipment assigned to this room.', 'Tidak ada peralatan yang ditugaskan ke ruangan ini.')}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 flex justify-end flex-shrink-0 bg-gray-50">
                            <button
                                onClick={() => setShowRoomDetail(null)}
                                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl text-xs transition-all"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barcode Scanner Modal */}
            {showBarcodeScanner && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
                            <div className="flex items-center gap-2">
                                <ScanBarcode className="h-5 w-5 text-emerald-600" />
                                <h3 className="text-sm font-medium text-gray-800">{getText('Scan Equipment Barcode', 'Scan Barcode Alat')}</h3>
                            </div>
                            <button
                                onClick={closeScanner}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Camera View */}
                        <div className="p-4 space-y-4">
                            <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
                                <div id="roominfo-qr-reader" className="w-full h-full"></div>
                                
                                {!scannerReady && !cameraError && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white gap-3 z-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                                        <span className="text-xs font-semibold">{getText('Starting camera...', 'Memulai kamera...')}</span>
                                    </div>
                                )}
                                
                                {cameraError && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center gap-3 z-10">
                                        <AlertTriangle className="h-8 w-8 text-rose-500" />
                                        <span className="text-xs text-rose-300 font-semibold">{cameraError}</span>
                                    </div>
                                )}

                                {/* Scan overlay */}
                                {scannerReady && !cameraError && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                        <div className="w-56 h-56 border-2 border-emerald-400 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
                                            {/* Scanning line animation */}
                                            <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 opacity-75 animate-pulse shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]" style={{ top: '50%' }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>


                            <p className="text-xs text-gray-400 text-center">
                                {getText('Point your camera at the equipment barcode/QR code', 'Arahkan kamera ke barcode/QR code alat')}
                            </p>


                        </div>
                    </div>
                </div>
            )}

            {/* Scan Result Modal */}
            {showScanResult && scanResult && (
                <div className="fixed inset-0 bg-black bg-opacity-65 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Header: Blue to Indigo gradient */}
                        {scanResult.equipment ? (
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative flex-shrink-0">
                                <button
                                    onClick={() => {
                                        setShowScanResult(false);
                                        setScanResult(null);
                                    }}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-all cursor-pointer text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                                        <Wrench className="h-8 w-8 text-white" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="text-xl font-bold leading-tight truncate">{scanResult.equipment.name}</h2>
                                        <p className="opacity-90 font-mono text-sm tracking-wider mt-0.5 truncate">{scanResult.equipment.code}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gradient-to-r from-rose-600 to-red-600 p-6 text-white relative flex-shrink-0">
                                <button
                                    onClick={() => {
                                        setShowScanResult(false);
                                        setScanResult(null);
                                    }}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-all cursor-pointer text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                                        <AlertTriangle className="h-8 w-8 text-white" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="text-xl font-bold leading-tight">{getText('Equipment Not Found', 'Alat Tidak Ditemukan')}</h2>
                                        <p className="opacity-90 font-mono text-sm truncate mt-0.5">{scanResult.rawValue}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modal Body */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            {scanResult.equipment ? (
                                <>
                                    {/* Photo Viewer */}
                                    {scanResult.equipment.parsedPhoto && (
                                        <div className="relative rounded-xl overflow-hidden shadow-md h-56 group -mt-2">
                                            <img
                                                src={scanResult.equipment.parsedPhoto}
                                                alt={scanResult.equipment.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
                                                <div className="min-w-0 pr-4">
                                                    <h4 className="text-white font-bold text-xl drop-shadow-md truncate">{scanResult.equipment.name}</h4>
                                                    <p className="text-white/80 text-xs font-mono mt-0.5 truncate">{scanResult.equipment.code}</p>
                                                </div>
                                                <button onClick={() => { setEquipmentDetailPhoto(scanResult.equipment.parsedPhoto); setShowEquipmentImageFullscreen(true); }} className="p-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white transition-all shadow-lg border border-white/10 shrink-0" title="View Fullscreen">
                                                    <Maximize2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {/* Grid: Category & Quantity */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 p-4 rounded-2xl">
                                            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-1">
                                                {getText('Category', 'Kategori')}
                                            </p>
                                            <p className="font-bold text-blue-900 text-sm md:text-base truncate">
                                                {scanResult.equipment.category || getText('General', 'Umum')}
                                            </p>
                                        </div>
                                        <div className="bg-purple-50 p-4 rounded-2xl">
                                            <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wide mb-1">
                                                {getText('Available Quantity', 'Jumlah Tersedia')}
                                            </p>
                                            <p className="font-bold text-purple-900 text-sm md:text-base truncate">
                                                {scanResult.equipment.quantity != null 
                                                    ? `${scanResult.equipment.quantity} ${scanResult.equipment.unit || 'buah'}` 
                                                    : '—'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Condition */}
                                    <div className={`p-4 rounded-2xl ${
                                        scanResult.equipment.condition === 'GOOD' 
                                            ? 'bg-green-50' 
                                            : scanResult.equipment.condition === 'MAINTENANCE' 
                                                ? 'bg-amber-50' 
                                                : 'bg-red-50'
                                    }`}>
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                                            {getText('Condition', 'Kondisi')}
                                        </p>
                                        <p className={`font-extrabold flex items-center gap-1.5 text-sm md:text-base ${
                                            scanResult.equipment.condition === 'GOOD' 
                                                ? 'text-green-700' 
                                                : scanResult.equipment.condition === 'MAINTENANCE' 
                                                    ? 'text-amber-700' 
                                                    : 'text-red-700'
                                        }`}>
                                            {scanResult.equipment.condition === 'GOOD' && '✓ BAGUS'}
                                            {scanResult.equipment.condition === 'MAINTENANCE' && '🔧 PERAWATAN'}
                                            {scanResult.equipment.condition === 'BROKEN' && '⚠️ RUSAK'}
                                            {!scanResult.equipment.condition && '✓ BAGUS'}
                                        </p>
                                    </div>

                                    {/* Location Info */}
                                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                        <h3 className="font-bold text-blue-800 text-sm mb-3 flex items-center gap-2">
                                            <MapPin className="h-4.5 w-4.5 text-blue-600" />
                                            {getText('Location', 'Lokasi')}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
                                            <div>
                                                <span className="text-blue-600/70 text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                                                    {getText('Campus', 'Kampus')}
                                                </span>
                                                <p className="font-semibold text-gray-900 truncate">
                                                    {scanResult.room?.building?.campus?.name || '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-blue-600/70 text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                                                    {getText('Building', 'Gedung')}
                                                </span>
                                                <p className="font-semibold text-gray-900 truncate">
                                                    {scanResult.room?.building?.name || '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-blue-600/70 text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                                                    {getText('Floor', 'Lantai')}
                                                </span>
                                                <p className="font-semibold text-gray-900 truncate">
                                                    {scanResult.room?.floor ? `Lantai ${scanResult.room.floor}` : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-blue-600/70 text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                                                    {getText('Room', 'Ruangan')}
                                                </span>
                                                <p className="font-semibold text-gray-900 truncate">
                                                    {scanResult.room?.name || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Sub-Location Details: Cabinet/Table, Rack, Box */}
                                        {(scanResult.equipment.table_id || scanResult.equipment.rack_id || scanResult.equipment.box_id) && (
                                            <div className="mt-4 pt-4 border-t border-blue-100">
                                                <h5 className="font-bold text-blue-900 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                                                    <Layers className="h-4 w-4" />
                                                    {getText('Storage Location', 'Lokasi Penyimpanan')}
                                                </h5>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {scanResult.equipment.table_id && scanResult.equipment.tableName && (
                                                        <div className="flex items-center gap-3 bg-indigo-50/50 px-4 py-3 rounded-xl border border-indigo-100">
                                                            <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                                                                <Archive className="h-4 w-4 text-indigo-600" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-600">{getText('Cabinet/Table', 'Kabinet/Meja')}</p>
                                                                <p className="font-bold text-gray-900 text-sm truncate">{scanResult.equipment.tableName}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {scanResult.equipment.rack_id && scanResult.equipment.rackName && (
                                                        <div className="flex items-center gap-3 bg-teal-50/50 px-4 py-3 rounded-xl border border-teal-100">
                                                            <div className="w-8 h-8 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
                                                                <Layers className="h-4 w-4 text-teal-600" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] uppercase tracking-wider font-bold text-teal-600">{getText('Rack', 'Rak')}</p>
                                                                <p className="font-bold text-gray-900 text-sm truncate">{scanResult.equipment.rackName}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {scanResult.equipment.box_id && scanResult.equipment.boxName && (
                                                        <div className="flex items-center gap-3 bg-amber-50/50 px-4 py-3 rounded-xl border border-amber-100">
                                                            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                                                                <Box className="h-4 w-4 text-amber-600" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] uppercase tracking-wider font-bold text-amber-600">{getText('Box', 'Kotak')}</p>
                                                                <p className="font-bold text-gray-900 text-sm truncate">{scanResult.equipment.boxName}</p>
                                                                {scanResult.equipment.boxDesc && <p className="text-[11px] text-gray-500 truncate">{scanResult.equipment.boxDesc}</p>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Specifications & Serials */}
                                    {scanResult.equipment.Spesification && (() => {
                                        const { purchaseYear, procurementType, specs } = parseEquipmentSpec(scanResult.equipment.Spesification);
                                        return (
                                            <div className="space-y-4">
                                                {(purchaseYear || procurementType) && (
                                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                        <h3 className="font-bold text-gray-800 text-xs mb-2">
                                                            {getText('Purchase Year & Procurement', 'Tahun Pembelian & Pengadaan')}
                                                        </h3>
                                                        <div className="text-sm font-medium text-gray-800">
                                                            {purchaseYear && <div className="mb-1">{getText('Year:', 'Tahun:')} {purchaseYear}</div>}
                                                            {procurementType && <div>{getText('Type:', 'Jenis:')} {procurementType}</div>}
                                                        </div>
                                                    </div>
                                                )}
                                                {specs && (
                                                    <div className="bg-gray-55/70 p-4 rounded-2xl border border-gray-100">
                                                        <h3 className="font-bold text-gray-800 text-xs mb-2">
                                                            {getText('Specifications', 'Spesifikasi')}
                                                        </h3>
                                                        <p className="text-gray-600 text-xs whitespace-pre-wrap leading-relaxed">
                                                            {specs}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-gray-500 text-sm leading-relaxed mb-4">
                                        {getText(
                                            'No equipment matched this scanned code/URL in SIMPEL database.',
                                            'Tidak ada alat yang cocok dengan kode/URL hasil scan ini di database SIMPEL.'
                                        )}
                                    </p>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                                            {getText('Scanned Value:', 'Hasil Scan:')}
                                        </p>
                                        <p className="font-mono text-xs text-gray-700 break-all select-all font-semibold">
                                            {scanResult.rawValue}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer / Action buttons */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 flex-shrink-0">
                            <button
                                onClick={() => {
                                    setShowScanResult(false);
                                    setScanResult(null);
                                    setShowBarcodeScanner(true);
                                }}
                                className="flex-1 py-3 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-gray-700 font-bold rounded-2xl text-xs md:text-sm transition-all flex items-center justify-center gap-1.5"
                            >
                                <ScanBarcode className="h-4.5 w-4.5" />
                                {getText('Scan Again', 'Scan Lagi')}
                            </button>
                            {scanResult.equipment ? (
                                <button
                                    onClick={() => {
                                        // Set filters to locate it in the list
                                        setEquipmentSearchTerm(scanResult.equipment!.code);
                                        setEquipmentNameFilter('all');
                                        setActiveTab('equipment');
                                        setShowScanResult(false);
                                        setScanResult(null);
                                    }}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs md:text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <Search className="h-4.5 w-4.5" />
                                    {getText('Locate in List', 'Cari di Daftar')}
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        setShowScanResult(false);
                                        setScanResult(null);
                                    }}
                                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-2xl text-xs md:text-sm transition-all"
                                >
                                    {getText('Close', 'Tutup')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Image Preview Modal */}
            {showEquipmentImageFullscreen && equipmentDetailPhoto && (
                <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="absolute top-4 right-4 z-10 flex items-center gap-4">
                        <button
                            onClick={() => setShowEquipmentImageFullscreen(false)}
                            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all shadow-lg border border-white/20 group"
                        >
                            <X className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                    
                    <div className="relative max-w-7xl max-h-[90vh] w-full flex items-center justify-center animate-in zoom-in-95 duration-300">
                        <img 
                            src={equipmentDetailPhoto} 
                            alt="Full Preview" 
                            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-white/10"
                        />
                        <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                            <h4 className="text-white font-bold text-lg">{selectedEquipmentDetail?.name}</h4>
                            <p className="text-white/70 font-mono text-sm">{selectedEquipmentDetail?.code}</p>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default RoomInfo;
