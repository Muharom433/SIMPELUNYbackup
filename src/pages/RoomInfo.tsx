import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Building, Search, Eye, Users, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Loader2, Hash, DoorClosed, Calendar as CalendarIcon, Wrench, ChevronDown, GraduationCap, UserCheck, AlertTriangle, Filter, ChevronUp, FileText, Warehouse, Package, Layers, Tag, Box, ScanBarcode, Camera, Info, ExternalLink
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { Room, Department, Equipment, StudyProgram } from '../types';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';
import { parseEquipmentSpec } from './ToolAdministration'; // Import our helper from ToolAdministration!

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
    const [deptFilter, setDeptFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [spFilter, setSpFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    // Active Tab: 'rooms' or 'equipment'
    const [activeTab, setActiveTab] = useState<'rooms' | 'equipment'>('rooms');

    // All Equipment (for Keterangan Alat tab)
    const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
    const [loadingAllEquipment, setLoadingAllEquipment] = useState(false);
    const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
    const [equipmentNameFilter, setEquipmentNameFilter] = useState('all');
    const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState('all');
    const [equipmentConditionFilter, setEquipmentConditionFilter] = useState('all');
    const [equipmentUsageFilter, setEquipmentUsageFilter] = useState('all'); // 'all' | 'available' | 'inuse'
    const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
    const [scannerReady, setScannerReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scanProcessing, setScanProcessing] = useState(false);
    const [scanResult, setScanResult] = useState<{
        rawValue: string;
        equipment: Equipment | null;
        room?: any;
        department?: any;
    } | null>(null);
    const [showScanResult, setShowScanResult] = useState(false);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const [cameras, setCameras] = useState<any[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [isEqNameDropdownOpen, setIsEqNameDropdownOpen] = useState(false);
    const [eqDropdownSearchTerm, setEqDropdownSearchTerm] = useState('');
    const [isSpDropdownOpen, setIsSpDropdownOpen] = useState(false);

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

    // html5-qrcode scanner effect
    useEffect(() => {
        if (!showBarcodeScanner) return;
        let isMounted = true;
        setScannerReady(false);
        setCameraError(null);

        // Small delay to ensure DOM container is ready
        const timeoutId = setTimeout(async () => {
            try {
                const qrScannerId = 'roominfo-qr-reader';
                const container = document.getElementById(qrScannerId);
                if (!container || !isMounted) return;

                const html5QrCode = new Html5Qrcode(qrScannerId);
                html5QrCodeRef.current = html5QrCode;

                const config = { fps: 10, qrbox: { width: 250, height: 250 } };

                let hasScanned = false;
                const onScanSuccess = (decodedText: string) => {
                    if (hasScanned) return;
                    hasScanned = true;
                    console.log('[QR RoomInfo] Scanned:', decodedText);
                    
                    html5QrCode.stop().then(() => {
                        if (isMounted) {
                            handleScanResult(decodedText);
                        }
                    }).catch((err: any) => {
                        console.error('Failed to stop scanner on success:', err);
                        if (isMounted) {
                            handleScanResult(decodedText);
                        }
                    });
                };

                const onScanError = (_errorMessage: any) => {
                    // Ignore parse errors
                };

                // Get cameras
                let devices: any[] = [];
                try {
                    devices = await Html5Qrcode.getCameras();
                    if (!isMounted) return;
                    setCameras(devices);
                } catch (enumErr) {
                    console.warn('[QR RoomInfo] Camera enumeration failed:', enumErr);
                }

                // Determine which camera to start with
                let activeId = selectedCameraId;
                if (!activeId && devices.length > 0) {
                    const backCamera = devices.find(d =>
                        d.label.toLowerCase().includes('back') ||
                        d.label.toLowerCase().includes('rear') ||
                        d.label.toLowerCase().includes('environment') ||
                        d.label.toLowerCase().includes('belakang')
                    );
                    const initialCamera = backCamera || devices[0];
                    activeId = initialCamera.id;
                    setSelectedCameraId(activeId);
                }

                if (!isMounted) return;

                if (activeId) {
                    try {
                        await html5QrCode.start(
                            activeId,
                            config,
                            onScanSuccess,
                            onScanError
                        );
                        if (isMounted) {
                            setScannerReady(true);
                            setCameraError(null);
                        }
                        return;
                    } catch (err) {
                        console.warn(`[QR RoomInfo] Failed to start with camera ID ${activeId}:`, err);
                    }
                }

                if (!isMounted) return;

                // Fallback to facingMode environment
                try {
                    console.log('[QR RoomInfo] Fallback: trying facingMode environment...');
                    await html5QrCode.start(
                        { facingMode: 'environment' },
                        config,
                        onScanSuccess,
                        onScanError
                    );
                    if (isMounted) {
                        setScannerReady(true);
                        setCameraError(null);
                    }
                    return;
                } catch (envErr) {
                    console.warn('[QR RoomInfo] Fallback environment failed:', envErr);
                }

                if (!isMounted) return;

                // Fallback to facingMode user
                try {
                    console.log('[QR RoomInfo] Fallback: trying facingMode user...');
                    await html5QrCode.start(
                        { facingMode: 'user' },
                        config,
                        onScanSuccess,
                        onScanError
                    );
                    if (isMounted) {
                        setScannerReady(true);
                        setCameraError(null);
                    }
                    return;
                } catch (userErr) {
                    console.warn('[QR RoomInfo] Fallback user failed:', userErr);
                }

                // All camera strategies failed
                if (isMounted) {
                    setCameraError('Gagal memulai kamera. Pastikan izin kamera diberikan.');
                }

            } catch (err) {
                console.error('[QR RoomInfo] Scanner init error:', err);
                if (isMounted) {
                    setCameraError('Gagal menginisialisasi scanner. Coba refresh halaman.');
                }
            }
        }, 450);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            if (html5QrCodeRef.current) {
                if (html5QrCodeRef.current.isScanning) {
                    html5QrCodeRef.current.stop().catch(() => {});
                }
                html5QrCodeRef.current = null;
            }
        };
    }, [showBarcodeScanner, selectedCameraId]);

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

            const selectStr = 'id, name, code, category, condition, quantity, unit, is_available, Spesification, rooms_id, rooms:rooms_id(id, name, code, floor, building:building_id(name, campus:campus_id(name))), departments(name)';

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
        const matchesDept = deptFilter === 'all' || room.department?.id === deptFilter;
        const matchesSp = spFilter === 'all' || (room.study_program_ids && room.study_program_ids.includes(spFilter));
        
        let matchesStatus = true;
        if (statusFilter === 'available') {
            matchesStatus = room.is_available;
        } else if (statusFilter === 'unavailable') {
            matchesStatus = !room.is_available;
        }

        return matchesSearch && matchesDept && matchesSp && matchesStatus;
    });

    // Filter logic for equipment
    const equipmentCategories = [...new Set(allEquipment.map(eq => eq.category).filter(Boolean))];
    const equipmentNames = [...new Set(allEquipment.map(eq => eq.name).filter(Boolean))].sort();
    const filteredDropdownNames = equipmentNames.filter(name =>
        name.toLowerCase().includes(eqDropdownSearchTerm.toLowerCase())
    );
    const filteredEquipment = allEquipment.filter(eq => {
        const term = equipmentSearchTerm.toLowerCase();
        const matchesSearch = !term || eq.name.toLowerCase().includes(term) || eq.code.toLowerCase().includes(term);
        const matchesName = equipmentNameFilter === 'all' || eq.name === equipmentNameFilter;
        const matchesCategory = equipmentCategoryFilter === 'all' || eq.category === equipmentCategoryFilter;
        const matchesCondition = equipmentConditionFilter === 'all' || eq.condition === equipmentConditionFilter;
        const matchesUsage = equipmentUsageFilter === 'all' ||
            (equipmentUsageFilter === 'available' && eq.is_available) ||
            (equipmentUsageFilter === 'inuse' && !eq.is_available);
        return matchesSearch && matchesName && matchesCategory && matchesCondition && matchesUsage;
    });

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
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
            {/* Header section with abstract dynamic styling */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full -mr-16 -mt-16 pointer-events-none" />
                <div className="space-y-2 relative z-10">
                    <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">{getText('Facilities & Infrastructure Info', 'Informasi Sarana Prasarana')}</h2>
                    <p className="text-blue-100 max-w-xl text-sm leading-relaxed">
                        {getText('View room details, capacity, facilities, equipment inventory, and daily schedule info.', 'Lihat informasi ruangan, kapasitas, fasilitas, inventaris alat, serta jadwal penggunaan ruangan harian.')}
                    </p>
                </div>
                <div className="flex items-center gap-3 relative z-10 flex-shrink-0">
                    <div className="px-4 py-2 bg-white bg-opacity-25 backdrop-blur-md rounded-xl text-xs font-bold uppercase tracking-widest">{getText('Public Access', 'Akses Publik')}</div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 flex gap-2 max-w-md">
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
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-sm"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Department filter */}
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <select
                                    value={deptFilter}
                                    onChange={(e) => setDeptFilter(e.target.value)}
                                    className="px-4 py-2.5 bg-gray-55 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-gray-700 font-medium"
                                >
                                    <option value="all">{getText('All Departments', 'Semua Departemen')}</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Study Program custom dropdown */}
                            <div className="relative text-left" id="sp-dropdown-container">
                                <button
                                    onClick={() => setIsSpDropdownOpen(!isSpDropdownOpen)}
                                    className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 text-gray-700 bg-white min-w-[200px] flex items-center justify-between gap-2 cursor-pointer shadow-sm font-normal"
                                >
                                    <span className="truncate">
                                        {spFilter === 'all' 
                                            ? getText('All Study Programs', 'Semua Program Studi') 
                                            : studyPrograms.find(sp => sp.id === spFilter)?.name || spFilter}
                                    </span>
                                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isSpDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {isSpDropdownOpen && (
                                    <div className="absolute bottom-full left-0 mb-1 w-full min-w-[280px] bg-white border border-gray-200 rounded-xl shadow-xl z-[100] max-h-[300px] overflow-y-auto py-1 animate-in fade-in slide-in-from-bottom-1 duration-100">
                                        <button
                                            onClick={() => {
                                                setSpFilter('all');
                                                setIsSpDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-base hover:bg-gray-100 hover:text-gray-900 transition-colors ${
                                                spFilter === 'all' ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-gray-800 font-normal'
                                            }`}
                                        >
                                            {getText('All Study Programs', 'Semua Program Studi')}
                                        </button>
                                        {studyPrograms.map(sp => (
                                            <button
                                                key={sp.id}
                                                onClick={() => {
                                                    setSpFilter(sp.id);
                                                    setIsSpDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-base hover:bg-gray-100 hover:text-gray-900 transition-colors truncate ${
                                                    spFilter === sp.id ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-gray-800 font-normal'
                                                }`}
                                                title={sp.name}
                                            >
                                                {sp.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Status filter */}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2.5 bg-gray-55 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-gray-700 font-medium"
                            >
                                <option value="all">{getText('All Status', 'Semua Status')}</option>
                                <option value="available">{getText('Available', 'Tersedia')}</option>
                                <option value="unavailable">{getText('Not Available', 'Tidak Tersedia')}</option>
                            </select>

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
                                {filteredRooms.map(room => (
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
                                        {filteredRooms.map(room => (
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
                </>
            )}

            {/* ======================== TAB: KETERANGAN ALAT ======================== */}
            {activeTab === 'equipment' && (
                <>
                    {/* Equipment Filters */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
                        {/* Row 1: Search text + Scan Barcode + Dropdown nama alat */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            {/* Text search + Scan button */}
                            <div className="relative flex-1 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={getText('Search by name or code... e.g. HDMI, Projector', 'Ketik nama alat... cth: Kabel HDMI, Proyektor')}
                                        value={equipmentSearchTerm}
                                        onChange={(e) => { setEquipmentSearchTerm(e.target.value); setEquipmentNameFilter('all'); }}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors text-sm"
                                    />
                                </div>
                                {/* Scan barcode button */}
                                <button
                                    onClick={() => setShowBarcodeScanner(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all flex-shrink-0"
                                    title={getText('Scan Barcode', 'Scan Barcode')}
                                >
                                    <ScanBarcode className="h-5 w-5" />
                                    <span className="hidden sm:inline">{getText('Scan', 'Scan')}</span>
                                </button>
                            </div>
                            
                            {/* Dropdown nama alat */}
                            <div className="relative" id="eq-name-dropdown-container">
                                <button
                                    onClick={() => setIsEqNameDropdownOpen(!isEqNameDropdownOpen)}
                                    className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-gray-700 bg-white min-w-[240px] flex items-center justify-between gap-2 cursor-pointer shadow-sm"
                                >
                                    <span className="truncate">
                                        {equipmentNameFilter === 'all' 
                                            ? getText('All Equipment Names', 'Semua Nama Alat') 
                                            : equipmentNameFilter}
                                    </span>
                                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isEqNameDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {isEqNameDropdownOpen && (
                                    <div className="absolute top-full right-0 sm:left-0 mt-1 w-[280px] bg-white border border-gray-200 rounded-xl shadow-xl z-[100] max-h-[320px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                                        {/* Dropdown Search Input */}
                                        <div className="p-2 border-b border-gray-100 flex items-center gap-1.5 bg-gray-50/50">
                                            <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                            <input
                                                type="text"
                                                placeholder={getText('Filter names...', 'Ketik nama alat...')}
                                                value={eqDropdownSearchTerm}
                                                onChange={(e) => setEqDropdownSearchTerm(e.target.value)}
                                                className="w-full bg-transparent text-xs focus:outline-none text-gray-700 placeholder-gray-400 py-1"
                                                autoFocus
                                            />
                                            {eqDropdownSearchTerm && (
                                                <button 
                                                    onClick={() => setEqDropdownSearchTerm('')}
                                                    className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded animate-in fade-in duration-100"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                        {/* Dropdown Items */}
                                        <div className="overflow-y-auto flex-1 py-1">
                                            <button
                                                onClick={() => {
                                                    setEquipmentNameFilter('all');
                                                    setIsEqNameDropdownOpen(false);
                                                    setEqDropdownSearchTerm('');
                                                }}
                                                className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors ${
                                                    equipmentNameFilter === 'all' ? 'text-emerald-600 font-medium bg-emerald-50/50' : 'text-gray-700'
                                                }`}
                                            >
                                                {getText('All Equipment Names', 'Semua Nama Alat')}
                                            </button>
                                            {filteredDropdownNames.length > 0 ? (
                                                filteredDropdownNames.map(name => (
                                                    <button
                                                        key={name}
                                                        onClick={() => {
                                                            setEquipmentNameFilter(name);
                                                            setEquipmentSearchTerm('');
                                                            setIsEqNameDropdownOpen(false);
                                                            setEqDropdownSearchTerm('');
                                                        }}
                                                        className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors truncate ${
                                                            equipmentNameFilter === name ? 'text-emerald-600 font-medium bg-emerald-50/50' : 'text-gray-700'
                                                        }`}
                                                    >
                                                        {name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-xs text-gray-400 italic text-center">
                                                    {getText('No names match', 'Tidak ada nama cocok')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Row 2: Category + Condition + Usage Status filters */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-400 mr-1">{getText('Filter:', 'Filter:')}</span>
                            {/* Category */}
                            <div className="flex items-center gap-1.5">
                                <Tag className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                <select
                                    value={equipmentCategoryFilter}
                                    onChange={(e) => setEquipmentCategoryFilter(e.target.value)}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 text-gray-600 bg-white"
                                >
                                    <option value="all">{getText('All Categories', 'Semua Kategori')}</option>
                                    {equipmentCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Condition */}
                            <select
                                value={equipmentConditionFilter}
                                onChange={(e) => setEquipmentConditionFilter(e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 text-gray-600 bg-white"
                            >
                                <option value="all">{getText('All Conditions', 'Semua Kondisi')}</option>
                                <option value="GOOD">{getText('Good', 'Baik')}</option>
                                <option value="BROKEN">{getText('Broken', 'Rusak')}</option>
                                <option value="MAINTENANCE">{getText('Maintenance', 'Perawatan')}</option>
                            </select>
                            {/* Usage Status */}
                            <select
                                value={equipmentUsageFilter}
                                onChange={(e) => setEquipmentUsageFilter(e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 text-gray-600 bg-white"
                            >
                                <option value="all">{getText('All Status', 'Semua Status')}</option>
                                <option value="available">{getText('Available', 'Tersedia')}</option>
                                <option value="inuse">{getText('In Use', 'Sedang Dipakai')}</option>
                            </select>
                            {/* Reset filters */}
                            {(equipmentSearchTerm || equipmentNameFilter !== 'all' || equipmentCategoryFilter !== 'all' || equipmentConditionFilter !== 'all' || equipmentUsageFilter !== 'all') && (
                                <button
                                    onClick={() => { setEquipmentSearchTerm(''); setEquipmentNameFilter('all'); setEquipmentCategoryFilter('all'); setEquipmentConditionFilter('all'); setEquipmentUsageFilter('all'); }}
                                    className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    {getText('Reset', 'Reset Filter')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Equipment Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 rounded-xl">
                                <Package className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-extrabold text-gray-900">{allEquipment.length}</p>
                                <p className="text-xs text-gray-500 font-semibold">{getText('Total Equipment', 'Total Alat')}</p>
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-green-50 rounded-xl">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-extrabold text-gray-900">{allEquipment.filter(eq => eq.condition === 'GOOD' || !eq.condition).length}</p>
                                <p className="text-xs text-gray-500 font-semibold">{getText('Good Condition', 'Kondisi Baik')}</p>
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-red-50 rounded-xl">
                                <AlertCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-extrabold text-gray-900">{allEquipment.filter(eq => eq.condition === 'BROKEN').length}</p>
                                <p className="text-xs text-gray-500 font-semibold">{getText('Broken', 'Rusak')}</p>
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-amber-50 rounded-xl">
                                <Wrench className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-extrabold text-gray-900">{allEquipment.filter(eq => eq.condition === 'MAINTENANCE').length}</p>
                                <p className="text-xs text-gray-500 font-semibold">{getText('Maintenance', 'Perawatan')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Equipment Table — horizontal, 1 row per item */}
                    {loadingAllEquipment && allEquipment.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                            <p className="text-gray-500 text-sm">{getText('Loading equipment list...', 'Memuat daftar alat...')}</p>
                        </div>
                    ) : filteredEquipment.length > 0 ? (
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
                            {/* Info bar */}
                            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    {getText(`Showing ${filteredEquipment.length} of ${allEquipment.length} items`, `Menampilkan ${filteredEquipment.length} dari ${allEquipment.length} alat`)}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {filteredEquipment.filter(e => !e.is_available).length} {getText('currently in use', 'sedang dipakai')}
                                </span>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">No</th>
                                        <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Equipment Name', 'Nama Alat')}</th>
                                        <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Code', 'Kode')}</th>
                                        <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Category', 'Kategori')}</th>
                                        <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Qty', 'Jumlah')}</th>
                                        <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Condition', 'Kondisi')}</th>
                                        <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Room Location', 'Lokasi Ruangan')}</th>
                                        <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Department', 'Departemen')}</th>
                                        <th className="px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{getText('Usage Status', 'Status Pemakaian')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEquipment.map((eq, idx) => {
                                        const eqRoom = (eq as any).rooms;
                                        const eqDept = (eq as any).departments;
                                        const isInUse = !eq.is_available;
                                        return (
                                            <tr key={eq.id} className={`border-b border-gray-100 transition-all duration-150 ${ isInUse ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-emerald-50/20' }`}>
                                                <td className="px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap">{idx + 1}</td>
                                                {/* Nama alat */}
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <span className="text-sm text-gray-700">{eq.name}</span>
                                                </td>
                                                {/* Kode */}
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <span className="text-xs text-gray-400 font-mono">{eq.code}</span>
                                                </td>
                                                {/* Kategori */}
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    {eq.category
                                                        ? <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs">{eq.category}</span>
                                                        : <span className="text-gray-300 text-xs">—</span>}
                                                </td>
                                                {/* Jumlah */}
                                                <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                                                    {eq.quantity != null ? `${eq.quantity} ${eq.unit || ''}`.trim() : '—'}
                                                </td>
                                                {/* Kondisi */}
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    {getEquipmentConditionChip(eq.condition)}
                                                </td>
                                                {/* Lokasi Ruangan — detail */}
                                                <td className="px-5 py-3.5 whitespace-nowrap">
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
                                                {/* Departemen */}
                                                <td className="px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                                                    {eqDept ? eqDept.name : <span className="text-gray-300 text-xs">—</span>}
                                                </td>
                                                {/* Status pemakaian */}
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    {isInUse ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="relative flex h-2 w-2 flex-shrink-0">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                                </span>
                                                                <span className="text-xs text-red-600 font-medium">{getText('In Use', 'Sedang Dipakai')}</span>
                                                            </div>
                                                            {eqRoom && (
                                                                <span className="text-[11px] text-red-400 pl-3.5">di {eqRoom.name}</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                                                            <span className="text-xs text-emerald-600">{getText('Available', 'Tersedia')}</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
                            <Wrench className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg text-gray-700">{getText('No Equipment Found', 'Tidak Ada Alat Ditemukan')}</p>
                            <p className="text-gray-400 text-sm mt-1">{getText('Try adjusting your search or filter keywords.', 'Coba sesuaikan kata kunci pencarian atau filter Anda.')}</p>
                        </div>
                    )}
                    {hasMoreEquipment && !loadingAllEquipment && (
                        <div className="flex justify-center mt-4">
                            <button onClick={() => fetchAllEquipment(equipmentPage + 1)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition text-sm">
                                {getText('Load More', 'Muat Lebih')}
                            </button>
                        </div>
                    )}
                </>
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
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Columns - Info & Equipment */}
                                <div className="lg:col-span-1 space-y-6">
                                    {/* Room Photo Card */}
                                    <div className="relative rounded-2xl overflow-hidden shadow-md h-52 bg-gradient-to-r from-blue-50 to-indigo-50 border border-gray-100">
                                        {roomPhoto ? (
                                            <img src={roomPhoto} alt={showRoomDetail.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-30">
                                                <DoorClosed className="h-16 w-16 text-blue-600" />
                                                <span className="text-xs font-extrabold font-mono tracking-widest">{showRoomDetail.code}</span>
                                            </div>
                                        )}
                                        <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-xl shadow-sm">
                                            <span className="text-xs font-bold text-gray-800">{showRoomDetail.name}</span>
                                        </div>
                                    </div>

                                    {/* Room Metadata Card */}
                                    <div className="bg-gradient-to-br from-blue-55 to-indigo-50/50 p-5 rounded-2xl border border-blue-100 space-y-4">
                                        <h4 className="font-extrabold text-blue-900 flex items-center gap-2 text-base"><Building className="h-5 w-5 text-blue-600" />{getText('Room Information', 'Keterangan Ruangan')}</h4>
                                        <div className="space-y-3 pt-1">
                                            <div>
                                                <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">{getText('Department', 'Departemen')}</p>
                                                <p className="font-bold text-gray-900 text-sm">{showRoomDetail.department?.name || getText('General', 'Umum')}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">{getText('Campus Location', 'Lokasi Kampus')}</p>
                                                <p className="font-bold text-gray-900 text-sm">{showRoomDetail.building?.campus?.name || '-'} • Gedung {showRoomDetail.building?.name || '-'}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">{getText('Capacity', 'Kapasitas')}</p>
                                                    <p className="font-bold text-gray-900 text-sm">{showRoomDetail.capacity} {getText('seats', 'kursi')}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">{getText('Status', 'Status')}</p>
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border mt-0.5 ${showRoomDetail.is_available ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                        {showRoomDetail.is_available ? getText('Available', 'Tersedia') : getText('Not Available', 'Tidak Tersedia')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Center Column - Equipment in Room */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-4">
                                        <h4 className="font-extrabold text-gray-900 flex items-center gap-2 text-base"><Wrench className="h-5 w-5 text-gray-500" />{getText('Equipment in Room', 'Peralatan di Ruangan')}</h4>
                                        
                                        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                                            {loadingEquipment ? (
                                                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-gray-500" /></div>
                                            ) : selectedRoomEquipment.length > 0 ? (
                                                selectedRoomEquipment.map(eq => {
                                                    const { serials } = parseEquipmentSpec(eq.Spesification || '');
                                                    return (
                                                        <div key={eq.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-2 hover:border-blue-200 transition-colors">
                                                            <div className="flex items-start justify-between">
                                                                <div>
                                                                    <p className="font-bold text-gray-900 text-sm leading-snug">{eq.name}</p>
                                                                    <p className="text-[10px] text-gray-400 font-mono tracking-wider mt-0.5 uppercase">{eq.code}</p>
                                                                </div>
                                                                {getEquipmentConditionChip(eq.condition)}
                                                            </div>
                                                            {/* Dropdown of Serial Numbers */}
                                                            {serials.length > 0 && (
                                                                <div className="mt-1 text-[11px]">
                                                                    <p className="text-gray-500 font-semibold mb-1">{getText('Serial Numbers:', 'Nomor Seri:')}</p>
                                                                    <select className="w-full bg-white border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:border-blue-500 font-mono text-[10px] text-gray-700 cursor-pointer">
                                                                        {serials.map((sn, idx) => (
                                                                            <option key={idx} value={sn}>{sn}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="text-xs text-gray-400 text-center py-10 font-semibold">{getText('No equipment assigned to this room.', 'Tidak ada peralatan yang ditugaskan ke ruangan ini.')}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Assigned Staff & Schedules */}
                                <div className="lg:col-span-1 space-y-6">
                                    {/* Assigned Staff */}
                                    <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-4">
                                        <h4 className="font-extrabold text-gray-900 flex items-center gap-2 text-base"><UserCheck className="h-5 w-5 text-gray-500" />{getText('Assigned Users', 'Pengguna yang Ditugaskan')}</h4>

                                        <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                                            {loadingRoomUsers ? (
                                                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-gray-500" /></div>
                                            ) : roomUsers.length > 0 ? (
                                                roomUsers.map(ru => (
                                                    <div key={ru.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-extrabold flex items-center justify-center text-xs">
                                                            {ru.user?.full_name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-gray-900 text-xs truncate">{ru.user?.full_name}</p>
                                                            <p className="text-[10px] text-gray-400 truncate">{ru.user?.jabatan || ru.user?.role}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-gray-400 text-center py-6 font-semibold">{getText('No users assigned.', 'Tidak ada pengguna yang ditugaskan.')}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Target Date Picker & Day Schedule view */}
                                    <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-extrabold text-gray-900 flex items-center gap-2 text-base"><CalendarIcon className="h-5 w-5 text-gray-500" />{getText('Room Schedule', 'Jadwal Ruangan')}</h4>
                                            <input
                                                type="date"
                                                value={targetDate}
                                                onChange={(e) => setTargetDate(e.target.value)}
                                                className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-gray-700"
                                            />
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto pr-1">
                                            <CombinedScheduleSection />
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
                                        <div className="w-56 h-32 border-2 border-emerald-400 rounded-xl relative">
                                            <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg"></div>
                                            <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg"></div>
                                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg"></div>
                                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-emerald-400 rounded-br-lg"></div>
                                            {/* Scanning line animation */}
                                            <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 opacity-75 animate-pulse" style={{ top: '50%' }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Camera selection dropdown if multiple cameras found */}
                            {cameras.length > 1 && (
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block">
                                        {getText('Select Camera', 'Pilih Kamera')}
                                    </label>
                                    <select
                                        value={selectedCameraId}
                                        onChange={(e) => setSelectedCameraId(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-gray-700 focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
                                    >
                                        {cameras.map((camera, index) => (
                                            <option key={camera.id} value={camera.id}>
                                                {camera.label || `${getText('Camera', 'Kamera')} ${index + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <p className="text-xs text-gray-400 text-center">
                                {getText('Point your camera at the equipment barcode/QR code', 'Arahkan kamera ke barcode/QR code alat')}
                            </p>

                            {/* Manual input alternative */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={getText('Or type barcode manually...', 'Atau ketik kode barcode...')}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-emerald-500 focus:outline-none barcode-manual-input"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = (e.target as HTMLInputElement).value.trim();
                                            if (val) {
                                                handleScanResult(val);
                                            }
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const input = document.querySelector('.barcode-manual-input') as HTMLInputElement;
                                        if (input?.value.trim()) {
                                            handleScanResult(input.value.trim());
                                        }
                                    }}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm hover:bg-emerald-600 transition-colors"
                                >
                                    {getText('Search', 'Cari')}
                                </button>
                            </div>
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
                                    </div>

                                    {/* Specifications & Serials */}
                                    {scanResult.equipment.Spesification && (() => {
                                        const { serials, specs } = parseEquipmentSpec(scanResult.equipment.Spesification);
                                        return (
                                            <div className="space-y-4">
                                                {serials.length > 0 && (
                                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                        <h3 className="font-bold text-gray-800 text-xs mb-2">
                                                            {getText('Serial Numbers', 'Nomor Seri')}
                                                        </h3>
                                                        <select className="w-full bg-white border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-mono text-xs text-gray-700 cursor-pointer shadow-sm">
                                                            {serials.map((sn, idx) => (
                                                                <option key={idx} value={sn}>{sn}</option>
                                                            ))}
                                                        </select>
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
        </div>
    );
};

export default RoomInfo;
