import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import {
    Building, Plus, Search, Edit, Trash2, Eye, Users, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Loader2, Hash, DoorClosed, Calendar as CalendarIcon, Wrench, ChevronDown, BookOpen, GraduationCap, UserCheck, UserPlus, UserMinus, AlertTriangle, Filter, ChevronUp, Maximize2, QrCode, Download, FileSpreadsheet
} from 'lucide-react';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Room, Department, Equipment, StudyProgram } from '../types';
import { format, parse, addDays } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { useRoomData } from '../hooks/useRoomData';
import { useRealTimeRoomUpdates } from '../hooks/useRealTimeRoomUpdates';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { EnhancedRoomStatus } from '../stores/roomStore';
import { useLanguage } from '../contexts/LanguageContext';
import { alert } from '../components/Alert/AlertHelper'; // Still importing for success/error alerts

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

// ========================
// TIMEZONE UTILITY FUNCTIONS
// ========================
const convertLocalToUTC = (localDateTimeString: string) => {
    const localDate = new Date(localDateTimeString);
    return localDate.toISOString();
};

const convertUTCToLocal = (utcTimeString: string) => {
    return new Date(utcTimeString);
};

const getLocalDateString = (date = new Date()) => {
    return format(date, 'yyyy-MM-dd');
};

const roomSchema = z.object({
    name: z.string().min(2, 'Room name must be at least 2 characters'),
    code: z.string().min(2, 'Room code must be at least 2 characters'),
    capacity: z.number().min(1, 'Capacity must be at least 1'),
    department_id: z.string().optional().nullable(),
    study_program_ids: z.array(z.string()).optional().nullable(),  // Changed to array
});
type RoomForm = z.infer<typeof roomSchema>;

interface RoomUser {
    id: string;
    user_id: string;
    room_id: string;
    assigned_at: string;
    user: {
        id: string;
        full_name: string;
        identity_number: string;
        role: string;
        department?: any;
    };
}

// Combined schedule interface untuk semua jenis jadwal
interface CombinedSchedule {
    id: string;
    type: 'lecture' | 'exam' | 'session' | 'booking';
    start_time: string;
    end_time: string;
    title: string;
    subtitle?: string;
    description?: string;
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
}

const RoomManagement: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();

    const [targetDate, setTargetDate] = useState(getLocalDateString());
    const [searchStartTime, setSearchStartTime] = useState('07:30');
    const [searchEndTime, setSearchEndTime] = useState('17:00');
    const [isSearchMode, setIsSearchMode] = useState(false);

    const { rooms: optimizedRooms, loading: roomsLoading, error: roomsError, fetchRoomData, cacheStats } = useRoomData(targetDate);

    useRealTimeRoomUpdates(targetDate);
    usePerformanceMonitor();

    const [allRooms, setAllRooms] = useState<EnhancedRoomStatus[]>([]);
    const [displayedRooms, setDisplayedRooms] = useState<EnhancedRoomStatus[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingRoom, setEditingRoom] = useState<EnhancedRoomStatus | null>(null);
    const [showRoomDetail, setShowRoomDetail] = useState<EnhancedRoomStatus | null>(null);

    const [combinedSchedules, setCombinedSchedules] = useState<CombinedSchedule[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);

    const [selectedRoomEquipment, setSelectedRoomEquipment] = useState<Equipment[]>([]);
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
    const [loadingRoomUsers, setLoadingRoomUsers] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [showAssignUserModal, setShowAssignUserModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedCampus, setSelectedCampus] = useState('all');
    const [selectedBuilding, setSelectedBuilding] = useState('all');
    const [buildingSearchTerm, setBuildingSearchTerm] = useState('');
    const [showBuildingDropdown, setShowBuildingDropdown] = useState(false);
    const buildingDropdownRef = useRef<HTMLDivElement>(null);
    const [campuses, setCampuses] = useState<{ id: string; name: string }[]>([]);
    const [showInUse, setShowInUse] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showAvailabilitySearch, setShowAvailabilitySearch] = useState(false);
    const [exportingRoomId, setExportingRoomId] = useState<string | null>(null);

    const [roomNameSuggestions, setRoomNameSuggestions] = useState<string[]>([]);
    const [roomNameInput, setRoomNameInput] = useState('');
    const [showRoomSuggestions, setShowRoomSuggestions] = useState(false);
    const [filteredRoomSuggestions, setFilteredRoomSuggestions] = useState<string[]>([]);

    // Room Photo State
    const [roomPhoto, setRoomPhoto] = useState<string | null>(null);
    const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

    // NEW: State for custom confirmation modal
    const [showCustomConfirmModal, setShowCustomConfirmModal] = useState(false);
    const [customConfirmModalContent, setCustomConfirmModalContent] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
    } | null>(null);
    const confirmPromiseResolve = useRef<((value: boolean) => void) | null>(null);

    // QR Code State
    const [showQRModal, setShowQRModal] = useState(false);
    const [selectedRoomForQR, setSelectedRoomForQR] = useState<EnhancedRoomStatus | null>(null);
    const [isDownloadingQR, setIsDownloadingQR] = useState(false);
    const [isDownloadingUsers, setIsDownloadingUsers] = useState(false);
    const [isPrintingEquipment, setIsPrintingEquipment] = useState(false);



    // Refs untuk dropdown manual DOM manipulation
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const userDisplayRef = useRef<HTMLInputElement>(null);

    const form = useForm<RoomForm>({ resolver: zodResolver(roomSchema) });

    const getOptimizedRoomStatus = useCallback((room: EnhancedRoomStatus) => {
        // 1. Check if room is disabled
        if (!room.is_available) {
            return {
                status: 'Unavailable' as const,
                reason: getText('Room is disabled for booking', 'Ruangan dinonaktifkan untuk pemesanan'),
                color: 'bg-gray-100 text-gray-800 border-gray-200'
            };
        }

        // 2. Check if currently in use (timezone aware)
        const isToday = targetDate === getLocalDateString();
        if (isToday && room.currentBooking) {
            const now = new Date();
            const bookingStart = convertUTCToLocal(room.currentBooking.start_time);
            const bookingEnd = convertUTCToLocal(room.currentBooking.end_time);

            if (now >= bookingStart && now <= bookingEnd) {
                return {
                    status: 'In Use' as const,
                    reason: getText(
                        `Currently used by ${room.currentBooking.user?.full_name || 'Unknown'}`,
                        `Sedang digunakan oleh ${room.currentBooking.user?.full_name || 'Tidak diketahui'}`
                    ),
                    color: 'bg-red-100 text-red-800 border-red-200',
                    detail: room.currentBooking
                };
            }
        }

        // 3. Check conflicts with search time (timezone aware)
        if (isSearchMode && searchStartTime && searchEndTime) {
            const searchStart = new Date(`${targetDate}T${searchStartTime}:00`);
            const searchEnd = new Date(`${targetDate}T${searchEndTime}:00`);

            if (Array.isArray(room.targetDateBookings) && room.targetDateBookings.length > 0) {
                for (const booking of room.targetDateBookings) {
                    const existingStart = convertUTCToLocal(booking.start_time);
                    const existingEnd = convertUTCToLocal(booking.end_time);

                    // Overlap condition with correct timezone
                    if (searchStart < existingEnd && searchEnd > existingStart) {
                        return {
                            status: 'Conflict' as const,
                            reason: getText(
                                `Conflicts with schedule at ${booking.start_time_local} - ${booking.end_time_local}`,
                                `Bertabrakan dengan jadwal pukul ${booking.start_time_local} - ${booking.end_time_local}`
                            ),
                            color: 'bg-orange-100 text-orange-800 border-orange-200'
                        };
                    }
                }
            }
        }

        // 4. Check if has other scheduled content for the day
        const hasScheduledContent =
            (Array.isArray(room.scheduleDetails?.lectures) && room.scheduleDetails.lectures.length > 0) ||
            (Array.isArray(room.scheduleDetails?.exams) && room.scheduleDetails.exams.length > 0) ||
            (Array.isArray(room.scheduleDetails?.sessions) && room.scheduleDetails.sessions.length > 0) ||
            (Array.isArray(room.targetDateBookings) && room.targetDateBookings.length > 0);

        if (hasScheduledContent) {
            return {
                status: 'Scheduled' as const,
                reason: getText('Room has scheduled activities', 'Ruangan memiliki aktivitas terjadwal'),
                color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                scheduleCount: (room.scheduleDetails?.lectures?.length || 0) +
                    (room.scheduleDetails?.exams?.length || 0) +
                    (room.scheduleDetails?.sessions?.length || 0) +
                    (room.targetDateBookings?.length || 0)
            };
        }

        // 5. If passes all checks, it's available
        return {
            status: 'Available' as const,
            reason: getText('Room is free and available for booking', 'Ruangan bebas dan tersedia untuk dipesan'),
            color: 'bg-green-100 text-green-800 border-green-200'
        };
    }, [targetDate, searchStartTime, searchEndTime, isSearchMode, getText]);

    const findAvailableRooms = async () => {
        if (!searchStartTime || !searchEndTime) {
            alert.error(getText('Please complete all search filters.', 'Mohon lengkapi semua filter pencarian.'));
            return;
        }

        setIsRefreshing(true);
        setIsSearchMode(true);

        try {

            // Force refresh data for the target date
            await fetchRoomData(targetDate, true);

            alert.success(
                getText(
                    `Found ${optimizedRooms.length} rooms for ${format(new Date(targetDate), 'MMM dd, yyyy')} ${searchStartTime}-${searchEndTime}`,
                    `Ditemukan ${optimizedRooms.length} ruangan untuk ${format(new Date(targetDate), 'dd MMM yyyy')} ${searchStartTime}-${searchEndTime}`
                )
            );

        } catch (error) {
            alert.error(getText('Failed to perform search.', 'Gagal melakukan pencarian.'));
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleBackToToday = () => {
        setIsSearchMode(false);
        const today = getLocalDateString();
        setTargetDate(today);
        fetchRoomData(today, true);
        alert.success(getText('Switched back to today\'s room status!', 'Kembali ke status ruangan hari ini!'));
    };

    useEffect(() => {
        if (optimizedRooms && optimizedRooms.length > 0) {
            let roomsToDisplay = optimizedRooms;

            // Laboratory filtering logic:
            // - Department MUST be same as laboran's department
            // - Study program can be NULL (show) OR same as laboran's study program (show)
            // - If study program is DIFFERENT from laboran's → don't show
            if (profile?.role === 'laboratory' && profile?.department_id) {
                const laborDeptId = profile.department_id;
                const laborStudyProgramId = profile.study_program_id;

                roomsToDisplay = optimizedRooms.filter((room: any) => {
                    const roomDeptId = room.department?.id;
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

            }

            setAllRooms(roomsToDisplay);
            setDisplayedRooms(roomsToDisplay);
        }
    }, [optimizedRooms, profile]);

    useEffect(() => {
        if (profile) {
            fetchRoomData(targetDate, true);
            fetchDepartments();
            fetchStudyPrograms();
            fetchCampuses();
            fetchRoomSuggestions();
            fetchAllUsers();
        }
    }, [profile, fetchRoomData, targetDate]);

    // Derive unique buildings from allRooms, filtered by selected campus
    const buildingsForCampus = useMemo(() => {
        const seen = new Set<string>();
        const result: { id: string; name: string }[] = [];
        displayedRooms.forEach(room => {
            if (!room.building?.name) return;
            // If a campus is selected, only show buildings from that campus
            if (selectedCampus !== 'all') {
                const roomCampusId = room.building?.campus?.id;
                const roomCampusName = (room.building?.campus?.name || '').toLowerCase();
                const roomBuildingName = (room.building?.name || '').toLowerCase();
                let campusMatch = false;
                if (selectedCampus === 'gunungkidul' || selectedCampus === 'gunung_kidul') {
                    campusMatch = roomCampusName.includes('gunung') || roomCampusId === selectedCampus || roomBuildingName.includes('gunung');
                } else if (selectedCampus === 'kulonprogo' || selectedCampus === 'kulon_progo') {
                    campusMatch = roomCampusName.includes('kulon') || roomCampusName.includes('wates') || roomCampusId === selectedCampus || roomBuildingName.includes('kulon');
                } else {
                    campusMatch = roomCampusId === selectedCampus || roomCampusName === selectedCampus.toLowerCase() || roomCampusName.includes(selectedCampus.toLowerCase());
                }
                if (!campusMatch) return;
            }
            const key = room.building.id || room.building.name;
            if (!seen.has(key)) {
                seen.add(key);
                result.push({ id: room.building.id || room.building.name, name: room.building.name });
            }
        });
        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [displayedRooms, selectedCampus]);

    // Reset building filter when campus changes
    useEffect(() => {
        setSelectedBuilding('all');
        setBuildingSearchTerm('');
    }, [selectedCampus]);

    // Close building dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (buildingDropdownRef.current && !buildingDropdownRef.current.contains(e.target as Node)) {
                setShowBuildingDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredAndSortedRooms = useMemo(() => {
        if (!Array.isArray(displayedRooms)) return [];

        return displayedRooms.filter(room => {
            const campusName = room.building?.campus?.name || '';
            const buildingName = room.building?.name || '';

            const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                room.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                buildingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                campusName.toLowerCase().includes(searchTerm.toLowerCase());

            const roomStatus = getOptimizedRoomStatus(room);
            const matchesStatus = filterStatus === 'all' || roomStatus.status === filterStatus;
            const matchesVisibility = roomStatus.status !== 'In Use' || showInUse;

            let matchesCampus = true;
            if (selectedCampus !== 'all') {
                const roomCampusId = room.building?.campus?.id;
                const roomCampusName = (room.building?.campus?.name || '').toLowerCase();
                const roomBuildingName = (room.building?.name || '').toLowerCase();

                if (selectedCampus === 'gunungkidul' || selectedCampus === 'gunung_kidul') {
                    if (roomCampusName) {
                        matchesCampus = roomCampusName.includes('gunung') || roomCampusId === selectedCampus;
                    } else if (roomBuildingName) {
                        matchesCampus = roomBuildingName.includes('gunung') || roomBuildingName.includes('gk_');
                    } else {
                        matchesCampus = room.code.toLowerCase().includes('gk_') || room.name.toLowerCase().includes('gunung');
                    }
                } else if (selectedCampus === 'kulonprogo' || selectedCampus === 'kulon_progo') {
                    if (roomCampusName) {
                        matchesCampus = roomCampusName.includes('kulon') || roomCampusName.includes('wates') || roomCampusId === selectedCampus;
                    } else if (roomBuildingName) {
                        matchesCampus = roomBuildingName.includes('kulon') || roomBuildingName.includes('wates') || roomBuildingName.includes('kp');
                    } else {
                        matchesCampus = room.code.toLowerCase().includes('kp') || room.name.toLowerCase().includes('kulon') || room.name.toLowerCase().includes('wates');
                    }
                } else {
                    matchesCampus = roomCampusId === selectedCampus ||
                        roomCampusName === selectedCampus.toLowerCase() ||
                        roomCampusName.includes(selectedCampus.toLowerCase());
                }
            }

            // Building filter
            let matchesBuilding = true;
            if (selectedBuilding !== 'all') {
                const roomBuildingId = room.building?.id || room.building?.name;
                matchesBuilding = roomBuildingId === selectedBuilding;
            }

            return matchesSearch && matchesStatus && matchesVisibility && matchesCampus && matchesBuilding;
        }).sort((a, b) => {
            // Priority sorting: Available > Scheduled > In Use > Unavailable
            const statusOrder = { 'Available': 0, 'Scheduled': 1, 'In Use': 2, 'Conflict': 3, 'Unavailable': 4 };
            const aStatus = getOptimizedRoomStatus(a).status;
            const bStatus = getOptimizedRoomStatus(b).status;

            const statusComparison = statusOrder[aStatus] - statusOrder[bStatus];
            if (statusComparison !== 0) return statusComparison;

            // Secondary sort by name
            return a.name.localeCompare(b.name);
        });
    }, [displayedRooms, searchTerm, filterStatus, selectedCampus, selectedBuilding, showInUse, getOptimizedRoomStatus]);

    const fetchSchedulesForRoom = async (roomName: string, roomId: string) => {
        setLoadingSchedules(true);
        try {
            const combined: CombinedSchedule[] = [];
            const targetDateObj = new Date(targetDate);

            // Get day name in Indonesian
            const dayNamesEnglish = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayNamesIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const dayNameIndonesian = dayNamesIndonesian[targetDateObj.getDay()];


            // 1. Fetch lecture schedules
            const { data: lectureData, error: lectureError } = await supabase
                .from('lecture_schedules')
                .select('id, start_time, end_time, course_name, class, subject_study, lecturer, semester')
                .eq('day', dayNameIndonesian)
                .ilike('room', `%${roomName}%`)
                .order('start_time');

            if (!lectureError && lectureData) {
                lectureData.forEach(lecture => {
                    combined.push({
                        id: lecture.id,
                        type: 'lecture',
                        start_time: lecture.start_time?.substring(0, 5) || '',
                        end_time: lecture.end_time?.substring(0, 5) || '',
                        title: lecture.course_name || getText('Lecture', 'Kuliah'),
                        subtitle: `${getText('Class', 'Kelas')} ${lecture.class} • ${lecture.subject_study}`,
                        description: `${getText('Lecturer', 'Dosen')}: ${lecture.lecturer || 'TBA'} • ${getText('Semester', 'Semester')} ${lecture.semester}`,
                        icon: BookOpen,
                        color: 'text-blue-700',
                        bgColor: 'bg-blue-50',
                        borderColor: 'border-blue-200'
                    });
                });
            }

            // 2. Fetch exam schedules
            const { data: examData, error: examError } = await supabase
                .from('exams')
                .select('id, start_time, end_time, course_name, class, student_amount, course_code, is_take_home, semester, inspector')
                .eq('room_id', roomId)
                .eq('date', targetDate)
                .order('start_time');

            if (!examError && examData) {
                examData.forEach(exam => {
                    combined.push({
                        id: exam.id,
                        type: 'exam',
                        start_time: exam.is_take_home ? getText('Take Home', 'Take Home') : exam.start_time?.substring(0, 5) || '',
                        end_time: exam.is_take_home ? '' : exam.end_time?.substring(0, 5) || '',
                        title: `${exam.course_name || getText('UAS Exam', 'Ujian UAS')}`,
                        subtitle: `${exam.student_amount} ${getText('students', 'mahasiswa')} • ${getText('Semester', 'Semester')} ${exam.semester}`,
                        description: `${getText('Class', 'Kelas')} ${exam.class} • ${getText('Inspector', 'Pengawas')}: ${exam.inspector}`,
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

            // 4. Fetch bookings with timezone handling
            // Query for ALL bookings that are active on the target date
            // Not just bookings that START on the target date
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
                .lte('start_time', endOfDay)    // Booking starts before or during target date
                .gte('end_time', startOfDay)    // Booking ends during or after target date
                .order('start_time');

            if (!bookingError && bookingData) {
                bookingData.forEach(booking => {
                    const startDate = new Date(booking.start_time);
                    const endDate = new Date(booking.end_time);

                    // Determine effective time for display on this specific date
                    const targetDateObj = new Date(targetDate);
                    const bookingStartDate = new Date(startDate.toDateString());
                    const bookingEndDate = new Date(endDate.toDateString());
                    const targetDateOnly = new Date(targetDateObj.toDateString());

                    // Calculate effective display times for this date
                    let displayStartTime: string;
                    let displayEndTime: string;

                    if (bookingStartDate.getTime() === targetDateOnly.getTime()) {
                        displayStartTime = format(startDate, 'HH:mm');
                    } else {
                        displayStartTime = '00:00';
                    }

                    if (bookingEndDate.getTime() === targetDateOnly.getTime()) {
                        displayEndTime = format(endDate, 'HH:mm');
                    } else {
                        displayEndTime = '23:59';
                    }

                    // Calculate total duration
                    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                    const isMultiDay = durationDays > 1;

                    combined.push({
                        id: booking.id,
                        type: 'booking',
                        start_time: displayStartTime,
                        end_time: displayEndTime,
                        title: `${booking.purpose || getText('Room Booking', 'Pemesanan Ruangan')}${isMultiDay ? ` (${durationDays} hari)` : ''}`,
                        subtitle: `${booking.user?.full_name} • ${booking.user?.identity_number}`,
                        description: `${getText('Status', 'Status')}: ${getText('APPROVED', 'DISETUJUI')}`,
                        icon: CalendarIcon,
                        color: 'text-orange-700',
                        bgColor: 'bg-orange-50',
                        borderColor: 'border-orange-200'
                    });
                });
            }

            // Sort by time
            combined.sort((a, b) => {
                const aTime = a.start_time === getText('Take Home', 'Take Home') ? '00:00' : a.start_time;
                const bTime = b.start_time === getText('Take Home', 'Take Home') ? '00:00' : b.start_time;
                return aTime.localeCompare(bTime);
            });

            setCombinedSchedules(combined);

        } catch (error: any) {
            alert.error(getText("Failed to load schedule for this room.", "Gagal memuat jadwal untuk ruangan ini."));
        } finally {
            setLoadingSchedules(false);
        }
    };

    const fetchRoomSuggestions = async () => {
        try {
            const { data, error } = await supabase
                .from('lecture_schedules')
                .select('room')
                .not('room', 'is', null);

            if (error) throw error;

            const uniqueRooms = [...new Set(data.map(item => item.room).filter(Boolean))].sort();
            setRoomNameSuggestions(uniqueRooms);
        } catch (error) {
        }
    };

    useEffect(() => {
        if (roomNameInput.length >= 1) {
            const filtered = roomNameSuggestions.filter(room =>
                room.toLowerCase().includes(roomNameInput.toLowerCase())
            );
            setFilteredRoomSuggestions(filtered);
            setShowRoomSuggestions(true);
        } else {
            setFilteredRoomSuggestions(roomNameSuggestions);
            setShowRoomSuggestions(false);
        }
    }, [roomNameInput, roomNameSuggestions]);

    const handleRoomNameChange = (value: string) => {
        setRoomNameInput(value);
        form.setValue('name', value);
    };

    const handleRoomNameSelect = (roomName: string) => {
        setRoomNameInput(roomName);
        form.setValue('name', roomName);
        setShowRoomSuggestions(false);
    };

    const getEquipmentConditionChip = (status: string | undefined) => {
        switch (status?.toUpperCase()) {
            case 'BROKEN':
                return <span className="text-xs font-medium text-red-800 bg-red-100 px-2 py-0.5 rounded-full">{getText('BROKEN', 'RUSAK')}</span>;
            case 'MAINTENANCE':
                return <span className="text-xs font-medium text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">{getText('MAINTENANCE', 'PERAWATAN')}</span>;
            case 'GOOD':
            default:
                return <span className="text-xs font-medium text-green-800 bg-green-100 px-2 py-0.5 rounded-full">{getText('GOOD', 'BAIK')}</span>;
        }
    };

    const fetchCampuses = async () => {
        try {
            const { data, error } = await supabase.from('campus').select('id, name').order('name');
            if (error) throw error;
            setCampuses(data || []);
        } catch (error: any) {
        }
    };

    // Export lecture schedule for a specific room to Excel
    const exportRoomScheduleExcel = async (room: EnhancedRoomStatus) => {
        setExportingRoomId(room.id);
        try {
            // Fetch all lecture schedules for this room
            const { data: lectureData, error } = await supabase
                .from('lecture_schedules')
                .select('day, start_time, end_time, course_name, class, subject_study, lecturer, semester, room')
                .ilike('room', `%${room.name}%`)
                .order('day')
                .order('start_time');

            if (error) throw error;

            const dayOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

            const rows = (lectureData || []).map((l, idx) => ({
                'No': idx + 1,
                'Hari': l.day || '',
                'Jam Mulai': l.start_time?.substring(0, 5) || '',
                'Jam Selesai': l.end_time?.substring(0, 5) || '',
                'Mata Kuliah': l.course_name || '',
                'Kelas': l.class || '',
                'Program Studi': l.subject_study || '',
                'Dosen': l.lecturer || '',
                'Semester': l.semester || '',
                'Ruangan': l.room || room.name,
            }));

            // Sort by day order then time
            rows.sort((a, b) => {
                const dayA = dayOrder.indexOf(a['Hari']);
                const dayB = dayOrder.indexOf(b['Hari']);
                if (dayA !== dayB) return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB);
                return a['Jam Mulai'].localeCompare(b['Jam Mulai']);
            });

            // Re-number after sort
            rows.forEach((r, i) => { r['No'] = i + 1; });

            const ws = XLSX.utils.json_to_sheet(rows);

            // Column widths
            ws['!cols'] = [
                { wch: 5 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
                { wch: 30 }, { wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 10 }, { wch: 20 }
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Jadwal Kuliah');

            // Header info sheet
            const infoData = [
                ['SIMPEL Kuliah - Jadwal Kuliah Ruangan'],
                [''],
                ['Ruangan', room.name],
                ['Kode', room.code],
                ['Kapasitas', `${room.capacity} kursi`],
                ['Lokasi', [room.building?.campus?.name, room.building?.name].filter(Boolean).join(' • ') || '-'],
                ['Total Jadwal', `${rows.length} sesi`],
                ['Diekspor pada', new Date().toLocaleString('id-ID')],
            ];
            const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
            wsInfo['!cols'] = [{ wch: 20 }, { wch: 40 }];
            XLSX.utils.book_append_sheet(wb, wsInfo, 'Info Ruangan');

            const fileName = `Jadwal-${room.name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);

            alert.success(getText('Schedule exported to Excel successfully!', 'Jadwal berhasil diekspor ke Excel!'));
        } catch (err: any) {
            alert.error(getText('Failed to export schedule', 'Gagal mengekspor jadwal'));
        } finally {
            setExportingRoomId(null);
        }
    };

    const fetchDepartments = async () => {
        try {
            const { data, error } = await supabase.from('departments').select('id, name').order('name');
            if (error) throw error;
            setDepartments(data || []);
        } catch (error: any) {
            alert.error(getText('Failed to load departments', 'Gagal memuat departemen'));
        }
    };

    const fetchStudyPrograms = async () => {
        try {
            const { data, error } = await supabase
                .from('study_programs')
                .select('id, name, code, department_id')
                .eq('status', 'show')
                .order('name');
            if (error) throw error;
            setStudyPrograms(data as any || []);
        } catch (error: any) {
        }
    };

    const fetchAllUsers = async () => {
        try {
            // Fetch ALL users without any limit restriction
            const { data, error } = await supabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    identity_number,
                    role,
                    department:departments(name)
                `)
                .order('full_name')
                .range(0, 10000); // Explicitly set large range to get all users

            if (error) throw error;
// Debug log
            setAllUsers(data || []);
        } catch (error) {
        }
    };

    const showUserDropdown = () => {
        const dropdownHTML = `
            <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden">
                <div class="p-3 border-b border-gray-100">
                    <div class="relative">
                        <input
                            type="text"
                            placeholder="${getText('Search by name or NIM...', 'Cari berdasarkan nama atau NIM...')}"
                            class="w-full px-3 py-2 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            id="user-search-input"
                            autocomplete="off"
                        />
                        <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </div>
                </div>
                <div class="max-h-60 overflow-y-auto" id="user-list">
                    ${allUsers.map(user => `
                        <div 
                            class="user-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                            data-user-id="${user.id}"
                            data-user-name="${user.full_name}"
                            data-user-nim="${user.identity_number}"
                            data-user-role="${user.role}"
                            data-user-dept="${user.department?.name || ''}"
                        >
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 bg-gradient-to-r ${getRoleColor(user.role)} rounded-full flex items-center justify-center text-white text-sm font-medium">
                                    ${user.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div class="font-semibold text-gray-900">${user.full_name}</div>
                                    <div class="text-sm text-gray-600">
                                        ${user.identity_number} • ${user.role}
                                        ${user.department ? ` • ${user.department.name}` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        if (userDropdownRef.current) {
            userDropdownRef.current.innerHTML = dropdownHTML;
            userDropdownRef.current.style.display = 'block';

            const searchInput = userDropdownRef.current.querySelector('#user-search-input');
            const userList = userDropdownRef.current.querySelector('#user-list');

            if (searchInput) {
                (searchInput as HTMLInputElement).focus();

                searchInput.addEventListener('input', (e) => {
                    const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();

                    const filteredUsers = allUsers.filter(user =>
                        user.full_name.toLowerCase().includes(searchTerm) ||
                        user.identity_number.toLowerCase().includes(searchTerm) ||
                        user.role.toLowerCase().includes(searchTerm)
                    );

                    if (userList) {
                        userList.innerHTML = filteredUsers.map(user => `
                            <div 
                                class="user-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                                data-user-id="${user.id}"
                                data-user-name="${user.full_name}"
                                data-user-nim="${user.identity_number}"
                                data-user-role="${user.role}"
                                data-user-dept="${user.department?.name || ''}"
                            >
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 bg-gradient-to-r ${getRoleColor(user.role)} rounded-full flex items-center justify-center text-white text-sm font-medium">
                                        ${user.full_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div class="font-semibold text-gray-900">${user.full_name}</div>
                                        <div class="text-sm text-gray-600">
                                            ${user.identity_number} • ${user.role}
                                            ${user.department ? ` • ${user.department.name}` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('');

                        addUserListeners();
                    }
                });
            }

            addUserListeners();
        }
    };

    const addUserListeners = () => {
        userDropdownRef.current?.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const userId = (e.currentTarget as HTMLElement).dataset.userId;
                const userName = (e.currentTarget as HTMLElement).dataset.userName;
                const userNim = (e.currentTarget as HTMLElement).dataset.userNim;
                const userRole = (e.currentTarget as HTMLElement).dataset.userRole;
                const userDept = (e.currentTarget as HTMLElement).dataset.userDept;

                const user = {
                    id: userId,
                    full_name: userName,
                    identity_number: userNim,
                    role: userRole,
                    department: userDept ? { name: userDept } : null
                };

                setSelectedUser(user);

                if (userDisplayRef.current) {
                    userDisplayRef.current.value = userName || '';
                }

                hideUserDropdown();
            });
        });
    };

    const hideUserDropdown = () => {
        if (userDropdownRef.current) {
            userDropdownRef.current.style.display = 'none';
        }
    };

    const handleShowQR = (room: EnhancedRoomStatus) => {
        setSelectedRoomForQR(room);
        setShowQRModal(true);
    };

    const downloadQR = async () => {
        const element = document.getElementById('qr-card-element');
        if (!element || !selectedRoomForQR) return;

        // Set loading immediately
        setIsDownloadingQR(true);

        // Give a small delay (500ms) to ensure the UI repaints and the user 
        // clearly sees the "Processing..." state and animation BEFORE
        // the heavy html2canvas operation blocks the main thread.
        setTimeout(async () => {
            try {
                const canvas = await html2canvas(element, {
                    backgroundColor: '#ffffff',
                    scale: 2 // Higher resolution
                });

                const link = document.createElement('a');
                link.download = `QR-${selectedRoomForQR.name.replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();

                alert.success(getText('QR Code downloaded successfully', 'QR Code berhasil diunduh'));
            } catch (error) {
                alert.error(getText('Failed to download QR Code', 'Gagal mengunduh QR Code'));
            } finally {
                setIsDownloadingQR(false);
            }
        }, 500);

    };

    // Helper for Grouping Users by Study Program
    const usersByProdi = useMemo(() => {
        const groups: Record<string, typeof roomUsers> = {};

        // Sort users by name first
        const sortedUsers = [...roomUsers].sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));

        sortedUsers.forEach(u => {
            // Get study program name, default to 'Umum' if null
            // Note: We need to make sure the fetchRoomUsers query joins study_program table
            const userAny = u.user as any;
            const prodiName = userAny.study_program?.name || getText('Other', 'Lainnya');

            if (!groups[prodiName]) {
                groups[prodiName] = [];
            }
            groups[prodiName].push(u);
        });
        return groups;
    }, [roomUsers, getText]);

    const downloadRoomUsersImage = async () => {
        const element = document.getElementById('room-users-card-element');
        if (!element || !showRoomDetail) return;

        setIsDownloadingUsers(true);
        setTimeout(async () => {
            try {
                const canvas = await html2canvas(element, {
                    backgroundColor: null, // Transparent, background is handled by CSS in element
                    scale: 2 // High resolution
                });

                const link = document.createElement('a');
                link.download = `Daftar-Dosen-${showRoomDetail.name.replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();

                alert.success(getText('User list downloaded successfully', 'Daftar pengguna berhasil diunduh'));
            } catch (error) {
                alert.error(getText('Failed to download user list', 'Gagal mengunduh daftar pengguna'));
            } finally {
                setIsDownloadingUsers(false);
            }
        }, 500);
    };
    const printEquipmentPDF = () => {
        if (!showRoomDetail || selectedRoomEquipment.length === 0) return;

        setIsPrintingEquipment(true);

        const room = showRoomDetail;
        const equipment = selectedRoomEquipment;
        const printDate = new Date().toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const getStatusLabel = (status: string | undefined) => {
            switch (status?.toUpperCase()) {
                case 'BROKEN': return 'RUSAK';
                case 'MAINTENANCE': return 'PERAWATAN';
                case 'GOOD':
                default: return 'BAIK';
            }
        };

        const getStatusColor = (status: string | undefined) => {
            switch (status?.toUpperCase()) {
                case 'BROKEN': return '#dc2626';
                case 'MAINTENANCE': return '#d97706';
                default: return '#16a34a';
            }
        };

        const rows = equipment.map((eq, index) => `
            <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}">
                <td style="padding: 10px 14px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #64748b;">${index + 1}</td>
                <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${eq.name}</td>
                <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #475569; font-family: monospace; font-size: 13px;">${eq.code || '-'}</td>
                <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #475569; font-size: 13px;">${eq.Spesification || '-'}</td>
                <td style="padding: 10px 14px; border: 1px solid #e2e8f0; text-align: center;">
                    <span style="
                        background: ${getStatusColor(eq.condition)}20;
                        color: ${getStatusColor(eq.condition)};
                        padding: 3px 10px;
                        border-radius: 20px;
                        font-size: 11px;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                        border: 1px solid ${getStatusColor(eq.condition)}40;
                    ">${getStatusLabel(eq.condition)}</span>
                </td>
                <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">${(eq as any).description || '-'}</td>
            </tr>
        `).join('');

        const locationText = [
            room.building?.campus?.name,
            room.building?.name
        ].filter(Boolean).join(' • ') || room.department?.name || 'Umum';

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Daftar Barang - ${room.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                    color: #1e293b;
                    background: #ffffff;
                    padding: 32px 40px;
                    font-size: 14px;
                }
                .header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    border-bottom: 3px solid #1e40af;
                    padding-bottom: 20px;
                    margin-bottom: 28px;
                }
                .header-left h1 {
                    font-size: 22px;
                    font-weight: 800;
                    color: #1e40af;
                    letter-spacing: -0.5px;
                    margin-bottom: 4px;
                }
                .header-left h2 {
                    font-size: 18px;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 6px;
                }
                .header-left .meta {
                    font-size: 12px;
                    color: #64748b;
                    line-height: 1.6;
                }
                .header-right {
                    text-align: right;
                }
                .badge {
                    display: inline-block;
                    background: #dbeafe;
                    color: #1e40af;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                    margin-bottom: 8px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 28px;
                }
                .info-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 12px 16px;
                }
                .info-card .label {
                    font-size: 11px;
                    font-weight: 600;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 4px;
                }
                .info-card .value {
                    font-size: 14px;
                    font-weight: 700;
                    color: #1e293b;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }
                thead tr {
                    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
                }
                thead th {
                    padding: 12px 14px;
                    text-align: left;
                    font-size: 12px;
                    font-weight: 700;
                    color: #ffffff;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                thead th:first-child { text-align: center; width: 50px; }
                thead th:nth-child(4) { width: 200px; }
                thead th:nth-child(5) { text-align: center; width: 110px; }
                .footer {
                    margin-top: 32px;
                    padding-top: 16px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 11px;
                    color: #94a3b8;
                }
                .summary-bar {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 20px;
                    padding: 12px 16px;
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 8px;
                }
                .summary-item { text-align: center; }
                .summary-item .num { font-size: 20px; font-weight: 800; color: #1e40af; }
                .summary-item .lbl { font-size: 11px; color: #64748b; }
                .divider { width: 1px; background: #bfdbfe; }
                @media print {
                    body { padding: 20px 28px; }
                    @page { size: A4; margin: 15mm 20mm; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-left">
                    <h1>SIMPEL Kuliah</h1>
                    <h2>Daftar Barang / Peralatan</h2>
                    <div class="meta">
                        Ruangan: <strong>${room.name}</strong> &bull; Kode: <strong>${room.code}</strong><br/>
                        Lokasi: ${locationText}
                    </div>
                </div>
                <div class="header-right">
                    <div class="badge">INVENTARIS RUANGAN</div>
                </div>
            </div>

            <div class="info-grid">
                <div class="info-card">
                    <div class="label">Kapasitas</div>
                    <div class="value">${room.capacity} kursi</div>
                </div>
                <div class="info-card">
                    <div class="label">Total Barang</div>
                    <div class="value">${equipment.length} item</div>
                </div>
            </div>

            <div class="summary-bar">
                <div class="summary-item">
                    <div class="num">${equipment.length}</div>
                    <div class="lbl">Total</div>
                </div>
                <div class="divider"></div>
                <div class="summary-item">
                    <div class="num" style="color: #16a34a;">${equipment.filter(e => !e.condition || e.condition.toUpperCase() === 'GOOD').length}</div>
                    <div class="lbl">Baik</div>
                </div>
                <div class="divider"></div>
                <div class="summary-item">
                    <div class="num" style="color: #d97706;">${equipment.filter(e => e.condition?.toUpperCase() === 'MAINTENANCE').length}</div>
                    <div class="lbl">Perawatan</div>
                </div>
                <div class="divider"></div>
                <div class="summary-item">
                    <div class="num" style="color: #dc2626;">${equipment.filter(e => e.condition?.toUpperCase() === 'BROKEN').length}</div>
                    <div class="lbl">Rusak</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Nama Barang</th>
                        <th>Kode / ID</th>
                        <th>Spesifikasi</th>
                        <th>Kondisi</th>
                        <th>Keterangan</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div class="footer">
                <span>SIMPEL Kuliah &bull; Sistem Manajemen Kampus Cerdas</span>
                <span>Fakultas Vokasi, Universitas Negeri Yogyakarta</span>
            </div>
        </body>
        </html>
        `;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    setIsPrintingEquipment(false);
                }, 800);
            };
        } else {
            alert.error(getText('Failed to open print window. Please allow popups.', 'Gagal membuka jendela cetak. Harap izinkan popup.'));
            setIsPrintingEquipment(false);
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'student': return 'from-blue-500 to-indigo-500';
            case 'lecturer': return 'from-green-500 to-teal-500';
            case 'department_admin': return 'from-purple-500 to-pink-500';
            case 'super_admin': return 'from-red-500 to-orange-500';
            default: return 'from-gray-500 to-gray-600';
        }
    };

    const fetchEquipmentForRoom = async (roomId: string) => {
        setLoadingEquipment(true);
        try {
            const { data, error } = await supabase.from('equipment').select('id, name, code, is_available, quantity, condition, image_url, category, rooms_id').eq('rooms_id', roomId);
            if (error) throw error;
            setSelectedRoomEquipment(data || []);
        } catch (error: any) {
            alert.error(getText("Failed to load room's equipment.", "Gagal memuat peralatan ruangan."));
        } finally {
            setLoadingEquipment(false);
        }
    };

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
        } catch (error) {
            alert.error(getText("Failed to load assigned users.", "Gagal memuat pengguna yang ditugaskan."));
        } finally {
            setLoadingRoomUsers(false);
        }
    };

    const handleAssignUser = async () => {
        if (!selectedUser || !showRoomDetail) return;

        try {
            const { data: existing, error: checkError } = await supabase
                .from('room_users')
                .select('id')
                .eq('user_id', selectedUser.id)
                .eq('room_id', showRoomDetail.id)
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existing) {
                alert.error(getText('User is already assigned to this room', 'Pengguna sudah ditugaskan ke ruangan ini'));
                return;
            }

            const { error } = await supabase
                .from('room_users')
                .insert({
                    user_id: selectedUser.id,
                    room_id: showRoomDetail.id,
                    assigned_at: new Date().toISOString()
                });

            if (error) throw error;

            alert.success(getText(
                `${selectedUser.full_name} assigned to room successfully`,
                `${selectedUser.full_name} berhasil ditugaskan ke ruangan`
            ));
            setSelectedUser(null);
            if (userDisplayRef.current) {
                userDisplayRef.current.value = '';
            }
            setShowAssignUserModal(false);
            fetchRoomUsers(showRoomDetail.id);
        } catch (error) {
            alert.error(getText('Failed to assign user to room', 'Gagal menugaskan pengguna ke ruangan'));
        }
    };

    const handleToggleAvailability = async (roomId: string, newStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('rooms')
                .update({ is_available: newStatus })
                .eq('id', roomId);

            if (error) throw error;

            if (showRoomDetail) {
                setShowRoomDetail({
                    ...showRoomDetail,
                    is_available: newStatus
                });
            }

            await fetchRoomData(targetDate, true);

            alert.success(getText(
                `Room ${newStatus ? 'enabled' : 'disabled'} successfully!`,
                `Ruangan berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}!`
            ));
        } catch (error) {
            alert.error(getText('Failed to update room status', 'Gagal memperbarui status ruangan'));
        }
    };

    // NEW: Function to show custom confirmation modal
    const showConfirmationModal = useCallback((title: string, message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setCustomConfirmModalContent({
                title,
                message,
                onConfirm: () => {
                    resolve(true);
                    setShowCustomConfirmModal(false);
                    setCustomConfirmModalContent(null);
                },
                onCancel: () => {
                    resolve(false);
                    setShowCustomConfirmModal(false);
                    setCustomConfirmModalContent(null);
                },
            });
            setShowCustomConfirmModal(true);
        });
    }, []);


    const handleDelete = async (roomId: string) => {
        // Use custom confirmation modal
        const confirmed = await showConfirmationModal(
            getText('Are you sure you want to delete this room?', 'Apakah Anda yakin ingin menghapus ruangan ini?'),
            getText('This action cannot be undone', 'Tindakan ini tidak dapat dibatalkan')
        );

        if (!confirmed) return;

        try {
            const { error } = await supabase.from('rooms').delete().eq('id', roomId);
            if (error) throw error;
            alert.success(getText('Room deleted successfully!', 'Ruangan berhasil dihapus!'));
            await fetchRoomData(targetDate, true);
        } catch (error: any) {
            alert.error(error.message || getText('Failed to delete room', 'Gagal menghapus ruangan'));
        }
    };

    // Unassign user from room (updated to use custom confirm)
    const handleUnassignUser = async (roomUserId: string, userName: string) => {
        const confirmed = await showConfirmationModal(
            getText('Confirm Removal', 'Konfirmasi Penghapusan'),
            getText(
                `Are you sure you want to remove ${userName} from this room? This action cannot be undone. The user will lose access to this room.`,
                `Apakah Anda yakin ingin menghapus ${userName} dari ruangan ini? Tindakan ini tidak dapat dibatalkan. Pengguna akan kehilangan akses ke ruangan ini.`
            )
        );

        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('room_users')
                .delete()
                .eq('id', roomUserId);

            if (error) throw error;

            alert.success(getText(
                `${userName} removed from room successfully`,
                `${userName} berhasil dihapus dari ruangan`
            ));
            if (showRoomDetail) { // Ensure showRoomDetail is not null before fetching
                fetchRoomUsers(showRoomDetail.id);
            }
        } catch (error) {
            alert.error(getText('Failed to remove user from room', 'Gagal menghapus pengguna dari ruangan'));
        }
    };

    useEffect(() => {
        if (showRoomDetail) {
            fetchSchedulesForRoom(showRoomDetail.name, showRoomDetail.id);
            fetchEquipmentForRoom(showRoomDetail.id);
            fetchRoomUsers(showRoomDetail.id);

            // Fetch room photo (attachments) by matching room name or code
            const fetchRoomPhoto = async () => {
                try {
                    const { data, error } = await supabase
                        .from('rooms')
                        .select('attachments')
                        .or(`name.eq.${showRoomDetail.name},code.eq.${showRoomDetail.code}`)
                        .single();

                    if (!error && data?.attachments) {
                        setRoomPhoto(data.attachments);
                    } else {
                        setRoomPhoto(null);
                    }
                } catch (err) {
                    setRoomPhoto(null);
                }
            };
            fetchRoomPhoto();
        } else {
            setRoomPhoto(null);
        }
    }, [showRoomDetail, targetDate]);

    const onSubmit = async (data: RoomForm) => {
        try {
            setLoading(true);
            const roomData = {
                name: data.name,
                code: data.code,
                capacity: data.capacity,
                department_id: data.department_id || null,
                study_program_ids: (data.study_program_ids && data.study_program_ids.length > 0) ? data.study_program_ids : null,  // Changed to array
            };
            if (editingRoom) {
                const { error } = await supabase.from('rooms').update(roomData).eq('id', editingRoom.id);
                if (error) throw error;
                alert.success(getText('Room updated successfully!', 'Ruangan berhasil diperbarui!'));
            } else {
                const { error } = await supabase.from('rooms').insert(roomData);
                if (error) throw error;
                alert.success(getText('Room created successfully!', 'Ruangan berhasil dibuat!'));
            }
            setShowForm(false);
            setEditingRoom(null);
            form.reset();
            setRoomNameInput('');
            await fetchRoomData(targetDate, true);
        } catch (error: any) {
            alert.error(error.message || getText('Failed to save room', 'Gagal menyimpan ruangan'));
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (room: EnhancedRoomStatus) => {
        setEditingRoom(room);
        setRoomNameInput(room.name);
        form.reset({
            name: room.name,
            code: room.code,
            capacity: room.capacity,
            department_id: room.department?.id,
            study_program_ids: (room as any).study_program_ids || [],  // Changed to array
        });
        setShowForm(true);
    };

    const handleAddNewRoom = () => {
        setEditingRoom(null);
        setRoomNameInput('');

        // Prepare default values based on user role
        const defaultValues: Partial<RoomForm> = {
            name: '',
            code: '',
            capacity: undefined,
            department_id: null,
            study_program_ids: [],
        };

        // Auto-set for laboratory role
        if (profile?.role === 'laboratory') {
            if (profile?.study_program_id) {
                defaultValues.study_program_ids = [profile.study_program_id];
            }
            if (profile?.department_id) {
                defaultValues.department_id = profile.department_id;
            }
        }

        // Auto-set department for department_admin role
        if (profile?.role === 'department_admin' && profile?.department_id) {
            defaultValues.department_id = profile.department_id;
        }

        // Reset form with default values
        form.reset(defaultValues);

        setShowForm(true);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'In Use': return 'bg-red-100 text-red-800 border-red-200';
            case 'Scheduled': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Available': return 'bg-green-100 text-green-800 border-green-200';
            case 'Conflict': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'Unavailable': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const CombinedScheduleSection = () => {
        const titleText = isSearchMode ?
            getText(`Schedule for ${format(new Date(targetDate), 'EEEE, MMMM d, yyyy')}`, `Jadwal untuk ${format(new Date(targetDate), 'EEEE, d MMMM yyyy')}`) :
            getText('Room Schedule', 'Jadwal Ruangan');
        const subtitleText = isSearchMode ?
            getText(`Showing all activities for the selected date`, `Menampilkan semua aktivitas untuk tanggal yang dipilih`) :
            getText(`Today's schedule and activities`, `Jadwal dan aktivitas hari ini`);

        return (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                                <Building className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold">{titleText}</h4>
                                <p className="text-blue-100 text-sm">{subtitleText}</p>
                            </div>
                        </div>
                        <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1">
                            <span className="text-sm font-semibold">
                                {combinedSchedules.length}
                            </span>
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
                                                <div className={`p-2 bg-white rounded-lg shadow-sm`}>
                                                    <IconComponent className={`h-4 w-4 ${schedule.color}`} />
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className={`text-xs font-medium ${schedule.color} bg-white px-2 py-1 rounded-full uppercase tracking-wide`}>
                                                        {schedule.type === 'lecture' ? getText('Lecture', 'Kuliah') :
                                                            schedule.type === 'exam' ? getText('Exam', 'UAS') :
                                                                schedule.type === 'session' ? getText('Session', 'Sidang') :
                                                                    getText('Booking', 'Booking')}
                                                    </span>
                                                    <span className="font-semibold text-gray-900 text-lg">
                                                        {schedule.end_time ?
                                                            `${schedule.start_time} - ${schedule.end_time}` :
                                                            schedule.start_time
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="font-semibold text-gray-900 text-lg">
                                                {schedule.title}
                                            </div>
                                            {schedule.subtitle && (
                                                <div className={`text-sm ${schedule.color} font-medium`}>
                                                    {schedule.subtitle}
                                                </div>
                                            )}
                                            {schedule.description && (
                                                <div className="text-sm text-gray-600">
                                                    {schedule.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">{getText('No schedule', 'Tidak ada jadwal')}</p>
                            <p className="text-sm">
                                {isSearchMode
                                    ? getText(
                                        `This room is empty for ${format(new Date(targetDate), 'MMM dd, yyyy')}`,
                                        `Ruangan ini kosong untuk ${format(new Date(targetDate), 'dd MMM yyyy')}`
                                    )
                                    : getText(
                                        'No schedule today or scheduled activities',
                                        'Tidak ada jadwal hari ini atau aktivitas yang terjadwal'
                                    )
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const UserSearchDropdown = () => (
        <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">{getText('Search and Select User', 'Cari dan Pilih Pengguna')}</label>
            <div className="relative">
                <input
                    ref={userDisplayRef}
                    type="text"
                    readOnly
                    placeholder={getText("Click to select user...", "Klik untuk pilih pengguna...")}
                    onClick={showUserDropdown}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer bg-white"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <div ref={userDropdownRef} style={{ display: 'none' }}></div>
            </div>

            {selectedUser && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 bg-gradient-to-r ${getRoleColor(selectedUser.role)} rounded-full flex items-center justify-center text-white font-medium`}>
                                {selectedUser.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900">{selectedUser.full_name}</div>
                                <div className="text-sm text-gray-600">
                                    {selectedUser.identity_number} • {selectedUser.role}
                                    {selectedUser.department && ` • ${selectedUser.department.name}`}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedUser(null);
                                if (userDisplayRef.current) {
                                    userDisplayRef.current.value = '';
                                }
                            }}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    if (roomsLoading && displayedRooms.length === 0) {
        return (
            <div className="flex justify-center items-center h-screen">
                <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{getText('Enhanced Room Management', 'Manajemen Ruangan Lanjutan')}</h1>
                        <p className="mt-2 opacity-90">
                            {isSearchMode
                                ? getText(
                                    `Availability search results for ${format(new Date(targetDate), 'MMM dd, yyyy')}`,
                                    `Hasil pencarian ketersediaan untuk ${format(new Date(targetDate), 'dd MMM yyyy')}`
                                )
                                : getText(
                                    'View real-time room status and manage room operations',
                                    'Lihat status ruangan real-time dan kelola operasi ruangan'
                                )
                            }
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">{filteredAndSortedRooms.length}</div>
                        <div className="text-sm opacity-90">
                            {isSearchMode ? getText('Available Rooms', 'Ruangan Tersedia') : getText('Total Rooms', 'Total Ruangan')}
                        </div>
                        <div className="text-xs opacity-75 mt-1">
                            {getText('Cache Hit', 'Cache Hit')}: {cacheStats.hitRate.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                            <Search className="h-5 w-5 text-blue-600" />
                            <span>{getText('Find Available Rooms', 'Cari Ruangan Tersedia')}</span>
                        </h3>
                        <button
                            onClick={() => setShowAvailabilitySearch(!showAvailabilitySearch)}
                            className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            <Filter className="h-4 w-4" />
                            <span>{showAvailabilitySearch ? getText('Hide', 'Sembunyikan') : getText('Show', 'Tampilkan')} {getText('Search', 'Pencarian')}</span>
                            {showAvailabilitySearch ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    </div>

                    {showAvailabilitySearch && (
                        <div className="bg-blue-50 rounded-lg p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{getText('Target Date', 'Tanggal Target')}</label>
                                    <input
                                        type="date"
                                        value={targetDate}
                                        onChange={(e) => setTargetDate(e.target.value)}
                                        min={getLocalDateString()}
                                        max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{getText('Start Time', 'Waktu Mulai')}</label>
                                    <input
                                        type="time"
                                        value={searchStartTime}
                                        onChange={(e) => setSearchStartTime(e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{getText('End Time', 'Waktu Selesai')}</label>
                                    <input
                                        type="time"
                                        value={searchEndTime}
                                        onChange={(e) => setSearchEndTime(e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={findAvailableRooms}
                                        disabled={isRefreshing}
                                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 h-10 transition-colors"
                                    >
                                        {isRefreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                                        <span>{getText('Search', 'Cari')}</span>
                                    </button>
                                    {isSearchMode && (
                                        <button
                                            onClick={handleBackToToday}
                                            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 h-10 transition-colors"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            <span>{getText('Today', 'Hari Ini')}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="text-sm text-gray-600 bg-white p-3 rounded border border-blue-200">
                                💡 {getText(
                                    'This search will check all schedules: Lectures, UAS Exams, Final Sessions, and Room Bookings for conflicts',
                                    'Pencarian ini akan memeriksa semua jadwal: Kuliah, UAS, Sidang Akhir, dan Pemesanan Ruangan untuk konflik'
                                )}
                            </div>
                        </div>
                    )}

                    <div className="border-t pt-4 flex flex-col gap-4">
                        {/* Row 1: Add button + search */}
                        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                            <div className="flex flex-wrap gap-3">
                                <button onClick={handleAddNewRoom} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                                    <Plus className="h-5 w-5" />
                                    <span>{getText('Add Room', 'Tambah Ruangan')}</span>
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={getText("Filter results by name/code...", "Filter hasil berdasarkan nama/kode...")}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Row 2: Filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Campus Filter */}
                            <select
                                value={selectedCampus}
                                onChange={(e) => setSelectedCampus(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-sm"
                            >
                                <option value="all">{getText('All Campuses', 'Semua Kampus')}</option>
                                <option value="gunungkidul">📍 Kampus Gunungkidul</option>
                                <option value="kulonprogo">📍 Kampus Kulon Progo</option>
                                {campuses.map(c => {
                                    const isGk = c.name.toLowerCase().includes('gunung');
                                    const isKp = c.name.toLowerCase().includes('kulon') || c.name.toLowerCase().includes('wates');
                                    if (isGk || isKp) return null;
                                    return (
                                        <option key={c.id} value={c.id}>
                                            📍 {c.name}
                                        </option>
                                    );
                                })}
                            </select>

                            {/* Building Filter - Searchable Dropdown */}
                            <div className="relative" ref={buildingDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowBuildingDropdown(prev => !prev)}
                                    className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-sm min-w-[170px] justify-between"
                                >
                                    <span className="flex items-center space-x-1 truncate">
                                        <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <span className="truncate max-w-[120px]">
                                            {selectedBuilding === 'all'
                                                ? getText('All Buildings', 'Semua Gedung')
                                                : buildingsForCampus.find(b => b.id === selectedBuilding)?.name || getText('All Buildings', 'Semua Gedung')
                                            }
                                        </span>
                                    </span>
                                    <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${showBuildingDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showBuildingDropdown && (
                                    <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl w-72 overflow-hidden">
                                        {/* Search input */}
                                        <div className="p-2 border-b border-gray-100">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder={getText('Search building...', 'Cari gedung...')}
                                                    value={buildingSearchTerm}
                                                    onChange={(e) => setBuildingSearchTerm(e.target.value)}
                                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        {/* Options */}
                                        <div className="max-h-60 overflow-y-auto">
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedBuilding('all'); setShowBuildingDropdown(false); setBuildingSearchTerm(''); }}
                                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center space-x-2 ${
                                                    selectedBuilding === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                                                }`}
                                            >
                                                <Building className="h-4 w-4 text-gray-400" />
                                                <span>{getText('All Buildings', 'Semua Gedung')}</span>
                                                {selectedBuilding === 'all' && <span className="ml-auto text-blue-500">✓</span>}
                                            </button>
                                            {buildingsForCampus
                                                .filter(b => b.name.toLowerCase().includes(buildingSearchTerm.toLowerCase()))
                                                .map(b => (
                                                    <button
                                                        key={b.id}
                                                        type="button"
                                                        onClick={() => { setSelectedBuilding(b.id); setShowBuildingDropdown(false); setBuildingSearchTerm(''); }}
                                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center space-x-2 ${
                                                            selectedBuilding === b.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                                                        }`}
                                                    >
                                                        <Building className="h-4 w-4 text-gray-400" />
                                                        <span>{b.name}</span>
                                                        {selectedBuilding === b.id && <span className="ml-auto text-blue-500">✓</span>}
                                                    </button>
                                                ))
                                            }
                                            {buildingsForCampus.filter(b => b.name.toLowerCase().includes(buildingSearchTerm.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                    {getText('No buildings found', 'Gedung tidak ditemukan')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Status Filter */}
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">{getText('All Statuses', 'Semua Status')}</option>
                                <option value="Available">{getText('Available', 'Tersedia')}</option>
                                <option value="Scheduled">{getText('Scheduled', 'Terjadwal')}</option>
                                <option value="In Use">{getText('In Use', 'Sedang Digunakan')}</option>
                                <option value="Conflict">{getText('Conflict', 'Konflik')}</option>
                                <option value="Unavailable">{getText('Unavailable', 'Tidak Tersedia')}</option>
                            </select>

                            {/* Show In Use checkbox */}
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showInUse}
                                    onChange={(e) => setShowInUse(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">{getText('Show In Use', 'Tampilkan Sedang Digunakan')}</span>
                            </label>

                            {/* View mode toggle */}
                            <div className="flex border border-gray-300 rounded-lg overflow-hidden ml-auto">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <Grid className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <List className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Active filter badges */}
                        {(selectedCampus !== 'all' || selectedBuilding !== 'all') && (
                            <div className="flex flex-wrap gap-2">
                                {selectedCampus !== 'all' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                        📍 {selectedCampus === 'gunungkidul' ? 'Kampus Gunungkidul' : selectedCampus === 'kulonprogo' ? 'Kampus Kulon Progo' : campuses.find(c => c.id === selectedCampus)?.name}
                                        <button onClick={() => setSelectedCampus('all')} className="ml-1 hover:text-blue-900"><X className="h-3 w-3" /></button>
                                    </span>
                                )}
                                {selectedBuilding !== 'all' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                        🏢 {buildingsForCampus.find(b => b.id === selectedBuilding)?.name}
                                        <button onClick={() => setSelectedBuilding('all')} className="ml-1 hover:text-indigo-900"><X className="h-3 w-3" /></button>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredAndSortedRooms.map((room) => {
                            const roomStatus = getOptimizedRoomStatus(room);
                            return (
                                <div key={room.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 group relative">
                                    <div className={`absolute top-2 right-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${roomStatus.color}`}>
                                        {getText(roomStatus.status, roomStatus.status)}
                                    </div>
                                    <div className="flex flex-col h-full">
                                        <div className="flex-grow">
                                            <h3 className="font-semibold text-gray-900 text-lg mt-8">{room.name}</h3>
                                            <p className="text-sm text-gray-600">{room.code}</p>
                                            <div className="flex items-center text-sm text-gray-600 mt-2">
                                                <Users className="h-4 w-4 mr-1" />
                                                <span>{room.capacity} {getText('seats', 'kursi')}</span>
                                            </div>
                                            <div className="flex items-center text-sm text-gray-600">
                                                <MapPin className="h-4 w-4 mr-1 flex-shrink-0 text-blue-600" />
                                                <span className="truncate">
                                                    {room.building?.campus?.name ? `${room.building.campus.name} • ` : ''}
                                                    {room.building?.name ? `${room.building.name} • ` : ''}
                                                    {room.department?.name || getText('General', 'Umum')}
                                                </span>
                                            </div>
                                            {room.study_program_ids && room.study_program_ids.length > 0 && (
                                                <div className="flex items-start text-xs text-gray-500 mt-1">
                                                    <GraduationCap className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                                    <span className="line-clamp-2">
                                                        {room.study_program_ids.map(id => studyPrograms.find(sp => sp.id === id)?.name || '').filter(Boolean).join(', ')}
                                                    </span>
                                                </div>
                                            )}

                                            {roomStatus.status === 'Conflict' && (
                                                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                                                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                                                    {getText('Time conflict detected', 'Konflik waktu terdeteksi')}
                                                </div>
                                            )}

                                            {roomStatus.status === 'In Use' && room.currentBooking && (
                                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                                    <Users className="h-3 w-3 inline mr-1" />
                                                    {room.currentBooking.user?.full_name || getText('In Use', 'Sedang Digunakan')}
                                                </div>
                                            )}

                                            {roomStatus.scheduleCount && roomStatus.scheduleCount > 0 && (
                                                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                                                    <CalendarIcon className="h-3 w-3 inline mr-1" />
                                                    {roomStatus.scheduleCount} {getText('activities scheduled', 'aktivitas terjadwal')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-end pt-4 mt-4 border-t border-gray-100 space-x-1">
                                            <button
                                                onClick={() => exportRoomScheduleExcel(room)}
                                                disabled={exportingRoomId === room.id}
                                                className="p-1 text-gray-500 hover:text-green-600 transition-colors disabled:opacity-50"
                                                title={getText("Export Schedule to Excel", "Ekspor Jadwal ke Excel")}
                                            >
                                                {exportingRoomId === room.id
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <FileSpreadsheet className="h-4 w-4" />
                                                }
                                            </button>
                                            <button
                                                onClick={() => handleShowQR(room)}
                                                className="p-1 text-gray-500 hover:text-purple-600 transition-colors"
                                                title={getText("View QR Code", "Lihat QR Code")}
                                            >
                                                <QrCode className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowRoomDetail(room)}
                                                className="p-1 text-gray-500 hover:text-indigo-600 transition-colors"
                                                title={getText("View Details", "Lihat Detail")}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(room)}
                                                className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                                                title={getText("Edit Room", "Edit Ruangan")}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(room.id)}
                                                className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                                                title={getText("Delete Room", "Hapus Ruangan")}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredAndSortedRooms.map((room) => {
                            const roomStatus = getOptimizedRoomStatus(room);
                            return (
                                <div key={room.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-3 h-12 rounded-full ${roomStatus.color.split(' ')[0]}`}></div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{room.name}</h3>
                                            <p className="text-sm text-gray-600">
                                                {room.code} • {room.building?.campus?.name ? `${room.building.campus.name} • ` : ''}{room.building?.name ? `${room.building.name} • ` : ''}{room.department?.name || getText('General', 'Umum')}
                                                {room.study_program_ids && room.study_program_ids.length > 0 && (
                                                    <>
                                                        <span className="mx-1">•</span>
                                                        <span className="text-xs text-gray-500">
                                                            {room.study_program_ids.map(id => studyPrograms.find(sp => sp.id === id)?.name || '').filter(Boolean).join(', ')}
                                                        </span>
                                                    </>
                                                )}
                                            </p>
                                            {roomStatus.reason && (
                                                <p className="text-xs text-gray-500 mt-1">{roomStatus.reason}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-6">
                                        <div className="text-center">
                                            <div className="text-sm font-medium text-gray-900">{room.capacity}</div>
                                            <div className="text-xs text-gray-500">{getText('Capacity', 'Kapasitas')}</div>
                                        </div>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${roomStatus.color}`}>
                                            {getText(roomStatus.status, roomStatus.status)}
                                        </span>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => exportRoomScheduleExcel(room)}
                                                disabled={exportingRoomId === room.id}
                                                className="p-2 text-gray-600 hover:text-green-600 transition-colors disabled:opacity-50"
                                                title={getText("Export Schedule to Excel", "Ekspor Jadwal ke Excel")}
                                            >
                                                {exportingRoomId === room.id
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <FileSpreadsheet className="h-4 w-4" />
                                                }
                                            </button>
                                            <button
                                                onClick={() => handleShowQR(room)}
                                                className="p-2 text-gray-600 hover:text-purple-600 transition-colors"
                                                title={getText("View QR Code", "Lihat QR Code")}
                                            >
                                                <QrCode className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowRoomDetail(room)}
                                                className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
                                                title={getText("View Details", "Lihat Detail")}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(room)}
                                                className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                                                title={getText("Edit Room", "Edit Ruangan")}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(room.id)}
                                                className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                                                title={getText("Delete Room", "Hapus Ruangan")}
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
                {filteredAndSortedRooms.length === 0 && !roomsLoading && (
                    <div className="text-center py-12">
                        <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">{getText('No Rooms Found', 'Tidak Ada Ruangan Ditemukan')}</h3>
                        <p className="text-gray-600">
                            {isSearchMode
                                ? getText('No rooms are available for the selected time period.', 'Tidak ada ruangan yang tersedia untuk periode waktu yang dipilih.')
                                : getText('Try adjusting your filter criteria.', 'Coba sesuaikan kriteria filter Anda.')
                            }
                        </p>
                        {isSearchMode && (
                            <button
                                onClick={handleBackToToday}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {getText('Back to Today\'s View', 'Kembali ke Tampilan Hari Ini')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Enhanced Add/Edit Room Form Modal with Autocomplete */}
            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998] p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col my-4">
                        <div className="p-6 border-b border-gray-200 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingRoom ? getText('Edit Room', 'Edit Ruangan') : getText('Add New Room', 'Tambah Ruangan Baru')}
                                </h3>
                                <button onClick={() => {
                                    setShowForm(false);
                                    setEditingRoom(null);
                                    setRoomNameInput('');
                                    setShowRoomSuggestions(false);
                                    form.reset();
                                }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto flex-grow">
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                {/* Enhanced Room Name Input with Autocomplete */}
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700">{getText('Room Name', 'Nama Ruangan')} *</label>
                                    <div className="relative mt-1">
                                        <input
                                            type="text"
                                            value={roomNameInput}
                                            onChange={(e) => handleRoomNameChange(e.target.value)}
                                            onFocus={() => setShowRoomSuggestions(roomNameInput.length >= 1)}
                                            onBlur={() => setTimeout(() => setShowRoomSuggestions(false), 200)}
                                            className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder={getText("Type room name or select from list...", "Ketik nama ruangan atau pilih dari daftar...")}
                                        />
                                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />

                                        {/* Dropdown Suggestions */}
                                        {showRoomSuggestions && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                                {filteredRoomSuggestions.length > 0 ? (
                                                    <>
                                                        {filteredRoomSuggestions.map((roomName, index) => (
                                                            <button
                                                                key={index}
                                                                type="button"
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onClick={() => handleRoomNameSelect(roomName)}
                                                                className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 hover:text-indigo-600 focus:bg-indigo-50 focus:text-indigo-600 transition-colors"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span>{roomName}</span>
                                                                    <span className="text-xs text-gray-400">{getText('from schedules', 'dari jadwal')}</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                        <div className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500 bg-gray-50">
                                                            {getText('Select from existing rooms or type a new name', 'Pilih dari ruangan yang ada atau ketik nama baru')}
                                                        </div>
                                                    </>
                                                ) : roomNameInput.length >= 1 ? (
                                                    <div className="px-3 py-2 text-sm text-gray-500">
                                                        <div className="flex items-center justify-between">
                                                            <span>{getText('No matching rooms found', 'Tidak ada ruangan yang cocok')}</span>
                                                            <span className="text-xs text-green-600">✓ {getText('Will create new', 'Akan membuat baru')}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-2 text-sm text-gray-500">
                                                        {getText('Start typing to see suggestions...', 'Mulai mengetik untuk melihat saran...')}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {form.formState.errors.name && (
                                        <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{getText('Code', 'Kode')} *</label>
                                    <input
                                        {...form.register('code')}
                                        type="text"
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="e.g. R101, LAB01"
                                    />
                                    {form.formState.errors.code && (
                                        <p className="text-red-500 text-xs mt-1">{form.formState.errors.code.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{getText('Capacity', 'Kapasitas')} *</label>
                                    <input
                                        {...form.register('capacity', { valueAsNumber: true })}
                                        type="number"
                                        min="1"
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="e.g. 30"
                                    />
                                    {form.formState.errors.capacity && (
                                        <p className="text-red-500 text-xs mt-1">{form.formState.errors.capacity.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{getText('Department', 'Departemen')}</label>
                                    <select
                                        {...form.register('department_id')}
                                        disabled={profile?.role === 'laboratory' || profile?.role === 'department_admin'}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                                    >
                                        <option value="">{getText('No Department / General', 'Tidak Ada Departemen / Umum')}</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">{getText('Study Programs (max 3)', 'Program Studi (maks 3)')}</label>
                                    <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto bg-gray-50">
                                        {studyPrograms.length === 0 ? (
                                            <p className="text-sm text-gray-500">{getText('No study programs available', 'Tidak ada program studi tersedia')}</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {studyPrograms.map(sp => {
                                                    const currentIds = form.watch('study_program_ids') || [];
                                                    const isChecked = currentIds.includes(sp.id);
                                                    const isDisabled = profile?.role === 'laboratory' || (!isChecked && currentIds.length >= 3);

                                                    return (
                                                        <label
                                                            key={sp.id}
                                                            className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-100'
                                                                } ${isDisabled && !isChecked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                disabled={isDisabled}
                                                                onChange={(e) => {
                                                                    const current = form.getValues('study_program_ids') || [];
                                                                    if (e.target.checked) {
                                                                        if (current.length < 3) {
                                                                            form.setValue('study_program_ids', [...current, sp.id]);
                                                                        }
                                                                    } else {
                                                                        form.setValue('study_program_ids', current.filter(id => id !== sp.id));
                                                                    }
                                                                }}
                                                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-sm font-medium text-gray-900">{sp.name}</span>
                                                                <span className="text-xs text-gray-500 ml-2">({sp.code})</span>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-xs text-gray-500">
                                            {getText('Select study programs that can access this room (leave empty for general access)', 'Pilih program studi yang dapat mengakses ruangan ini (kosongkan untuk akses umum)')}
                                        </p>
                                        <span className={`text-xs font-medium ${(form.watch('study_program_ids') || []).length >= 3 ? 'text-orange-600' : 'text-gray-400'}`}>
                                            {(form.watch('study_program_ids') || []).length}/3
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowForm(false);
                                            setRoomNameInput('');
                                            setShowRoomSuggestions(false);
                                        }}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        {getText('Cancel', 'Batal')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                        {loading ? getText('Saving...', 'Menyimpan...') : getText('Save Room', 'Simpan Ruangan')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Room Detail Modal */}
            {showRoomDetail && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-white rounded-t-2xl">
                            <div className='flex items-center space-x-3'>
                                <div className='bg-blue-100 p-2 rounded-lg'>
                                    <DoorClosed className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{showRoomDetail.name}</h2>
                                    <div className="flex items-center space-x-3 mt-1">
                                        <p className="text-sm text-gray-500">{showRoomDetail.department?.name || getText('General Use', 'Penggunaan Umum')}</p>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOptimizedRoomStatus(showRoomDetail).color}`}>
                                            {getText(getOptimizedRoomStatus(showRoomDetail).status, getOptimizedRoomStatus(showRoomDetail).status)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowRoomDetail(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column - Room Info, Equipment, Assigned Users */}
                                <div className="space-y-6">
                                    {/* Room Information */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-3">{getText('Room Information', 'Informasi Ruangan')}</h3>

                                        {/* Room Photo */}
                                        {roomPhoto && (
                                            <div className="relative rounded-xl overflow-hidden shadow-md mb-4">
                                                <img
                                                    src={roomPhoto}
                                                    alt={showRoomDetail.name}
                                                    className="w-full h-36 object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                                                <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                                                    <div>
                                                        <h4 className="text-white font-semibold text-sm drop-shadow-lg">{showRoomDetail.name}</h4>
                                                        {showRoomDetail.code && <p className="text-white/80 text-xs drop-shadow-md">{showRoomDetail.code}</p>}
                                                    </div>
                                                    <button
                                                        onClick={() => setFullscreenPhoto(roomPhoto)}
                                                        className="p-1.5 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-lg text-white transition-all shadow-lg"
                                                        title={getText('View Full Image', 'Lihat Gambar Penuh')}
                                                    >
                                                        <Maximize2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-4 text-sm">
                                            <div className="bg-white p-3 rounded-lg border flex items-center space-x-3">
                                                <Hash className="h-5 w-5 text-gray-400" />
                                                <div>
                                                    <p className="text-gray-500">{getText('Code', 'Kode')}</p>
                                                    <p className="font-semibold text-gray-800">{showRoomDetail.code}</p>
                                                </div>
                                            </div>

                                            {/* Campus & Building Info */}
                                            {(showRoomDetail.building || showRoomDetail.building?.campus) && (
                                                <div className="bg-white p-3 rounded-lg border flex items-center space-x-3">
                                                    <MapPin className="h-5 w-5 text-gray-400" />
                                                    <div>
                                                        <p className="text-gray-500">{getText('Location', 'Lokasi')}</p>
                                                        <p className="font-semibold text-gray-800">
                                                            {[
                                                                showRoomDetail.building?.campus?.name,
                                                                showRoomDetail.building?.name
                                                            ].filter(Boolean).join(' • ')}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="bg-white p-3 rounded-lg border flex items-center space-x-3">
                                                <MapPin className="h-5 w-5 text-gray-400" />
                                                <div>
                                                    <p className="text-gray-500">{getText('Location', 'Lokasi')}</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {showRoomDetail.building?.name || '-'}
                                                        {showRoomDetail.building?.campus?.name ? ` (${showRoomDetail.building.campus.name})` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border flex items-center space-x-3">
                                                <Users className="h-5 w-5 text-gray-400" />
                                                <div>
                                                    <p className="text-gray-500">{getText('Capacity', 'Kapasitas')}</p>
                                                    <p className="font-semibold text-gray-800">{showRoomDetail.capacity} {getText('seats', 'kursi')}</p>
                                                </div>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-gray-500">{getText('Official Booking Status', 'Status Pemesanan Resmi')}</p>
                                                    <button
                                                        onClick={() => handleToggleAvailability(showRoomDetail.id, !showRoomDetail.is_available)}
                                                        className={`p-1 rounded transition-colors ${showRoomDetail.is_available
                                                            ? 'text-green-600 hover:bg-green-50'
                                                            : 'text-red-600 hover:bg-red-50'
                                                            }`}
                                                        title={getText(
                                                            `Click to ${showRoomDetail.is_available ? 'disable' : 'enable'} room`,
                                                            `Klik untuk ${showRoomDetail.is_available ? 'menonaktifkan' : 'mengaktifkan'} ruangan`
                                                        )}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                </div>

                                                <div className="flex items-center space-x-3">
                                                    {showRoomDetail.is_available ? (
                                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                                    ) : (
                                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className={`font-semibold ${showRoomDetail.is_available ? 'text-green-600' : 'text-red-600'}`}>
                                                            {showRoomDetail.is_available ? getText('AVAILABLE', 'TERSEDIA') : getText('UNAVAILABLE', 'TIDAK TERSEDIA')}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {showRoomDetail.is_available
                                                                ? getText('Room can be booked officially', 'Ruangan dapat dipesan secara resmi')
                                                                : getText('Room is disabled for booking', 'Ruangan dinonaktifkan untuk pemesanan')
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Equipment in Room */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-lg font-semibold text-gray-800">{getText('Equipment in Room', 'Peralatan di Ruangan')}</h3>
                                            <button
                                                onClick={printEquipmentPDF}
                                                disabled={isPrintingEquipment || selectedRoomEquipment.length === 0}
                                                className={`flex items-center space-x-1 px-3 py-1 text-white rounded-lg transition-colors text-sm ${
                                                    isPrintingEquipment || selectedRoomEquipment.length === 0
                                                        ? 'bg-emerald-400 cursor-not-allowed'
                                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                                }`}
                                                title={getText('Print Equipment List as PDF', 'Cetak Daftar Barang sebagai PDF')}
                                            >
                                                {isPrintingEquipment
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <Download className="h-4 w-4" />
                                                }
                                                <span className="hidden sm:inline">{getText('Print PDF', 'Cetak PDF')}</span>
                                            </button>
                                        </div>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {loadingEquipment ? (
                                                <div className="flex justify-center p-4">
                                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                                </div>
                                            ) : selectedRoomEquipment.length > 0 ? (
                                                selectedRoomEquipment.map((eq) => (
                                                    <div key={eq.id} className="p-3 bg-white rounded-lg border space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="font-medium text-gray-800">{eq.name}</p>
                                                                <p className="text-xs text-gray-500">{eq.code}</p>
                                                            </div>
                                                            {getEquipmentConditionChip(eq.condition)}
                                                        </div>
                                                        {(() => {
                                                            const { purchaseYear, procurementType } = parseEquipmentSpec(eq.Spesification || '');
                                                            if (!purchaseYear && !procurementType) return null;
                                                            return (
                                                                <div className="text-[10px]">
                                                                    <span className="text-gray-400 block mb-0.5">{getText('Purchase Year & Procurement:', 'Tahun Pembelian & Pengadaan:')}</span>
                                                                    <div className="text-gray-700 font-medium bg-gray-50 p-1.5 rounded-md border border-gray-100">
                                                                        {purchaseYear && <div className="mb-0.5">{getText('Year:', 'Tahun:')} {purchaseYear}</div>}
                                                                        {procurementType && <div>{getText('Type:', 'Jenis:')} {procurementType}</div>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-gray-500 text-center py-4">{getText('No equipment assigned to this room.', 'Tidak ada peralatan yang ditugaskan ke ruangan ini.')}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Assigned Users Section */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-lg font-semibold text-gray-800">{getText('Assigned Users', 'Pengguna yang Ditugaskan')}</h3>

                                            <button
                                                onClick={downloadRoomUsersImage}
                                                disabled={isDownloadingUsers || roomUsers.length === 0}
                                                className={`flex items-center space-x-1 px-3 py-1 text-white rounded-lg transition-colors text-sm ${isDownloadingUsers || roomUsers.length === 0 ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
                                                title={getText('Download User List', 'Unduh Daftar Penghuni')}
                                            >
                                                {isDownloadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                <span className="hidden sm:inline">{getText('List', 'Daftar')}</span>
                                            </button>
                                            <button
                                                onClick={() => setShowAssignUserModal(true)}
                                                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                <span>{getText('Assign', 'Tugaskan')}</span>
                                            </button>
                                        </div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {loadingRoomUsers ? (
                                                <div className="flex justify-center p-4">
                                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                                </div>
                                            ) : roomUsers.length > 0 ? (
                                                roomUsers.map((roomUser) => (
                                                    <div key={roomUser.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                                        <div className="flex items-center space-x-3">
                                                            <div className={`w-8 h-8 bg-gradient-to-r ${getRoleColor(roomUser.user.role)} rounded-full flex items-center justify-center text-white text-sm font-medium`}>
                                                                {roomUser.user.full_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-800 text-sm">{roomUser.user.full_name}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {roomUser.user.identity_number} • {roomUser.user.role}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleUnassignUser(roomUser.id, roomUser.user.full_name)}
                                                            className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
                                                            title={getText("Remove user", "Hapus pengguna")}
                                                        >
                                                            <UserMinus className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-6 text-gray-500">
                                                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm">{getText('No users assigned', 'Tidak ada pengguna yang ditugaskan')}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Enhanced Schedule Display */}
                                <div className="lg:col-span-2">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                        {getText(
                                            `Complete Schedule for ${format(new Date(targetDate), 'EEEE, MMMM d, yyyy')}`,
                                            `Jadwal Lengkap untuk ${format(new Date(targetDate), 'EEEE, d MMMM yyyy')}`
                                        )}
                                    </h3>

                                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                                        <CombinedScheduleSection />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign User Modal */}
            {
                showAssignUserModal && showRoomDetail && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {getText(
                                            `Assign User to ${showRoomDetail.name}`,
                                            `Tugaskan Pengguna ke ${showRoomDetail.name}`
                                        )}
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setShowAssignUserModal(false);
                                            setSelectedUser(null);
                                            if (userDisplayRef.current) {
                                                userDisplayRef.current.value = '';
                                            }
                                        }}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <UserSearchDropdown />

                                <div className="flex space-x-3 pt-6">
                                    <button
                                        onClick={() => {
                                            setShowAssignUserModal(false);
                                            setSelectedUser(null);
                                            if (userDisplayRef.current) {
                                                userDisplayRef.current.value = '';
                                            }
                                        }}
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        {getText('Cancel', 'Batal')}
                                    </button>
                                    <button
                                        onClick={handleAssignUser}
                                        disabled={!selectedUser}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {getText('Assign User', 'Tugaskan Pengguna')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* NEW: Custom Confirmation Modal */}
            {
                showCustomConfirmModal && customConfirmModalContent && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001] p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {customConfirmModalContent.title}
                                    </h3>
                                    <button
                                        onClick={customConfirmModalContent.onCancel}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="mb-6">
                                    <div className="flex items-start space-x-3 p-4 bg-red-50 rounded-lg border border-red-200">
                                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-900 font-medium">
                                                {customConfirmModalContent.message}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                {getText('This action cannot be undone.', 'Tindakan ini tidak dapat dibatalkan.')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex space-x-3">
                                    <button
                                        onClick={customConfirmModalContent.onCancel}
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        {getText('Cancel', 'Batal')}
                                    </button>
                                    <button
                                        onClick={customConfirmModalContent.onConfirm}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                        {getText('Confirm', 'Konfirmasi')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Fullscreen Photo Preview Modal */}
            {
                fullscreenPhoto && (
                    <div
                        className="fixed inset-0 bg-black/95 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out"
                        onClick={() => setFullscreenPhoto(null)}
                    >
                        <button
                            onClick={() => setFullscreenPhoto(null)}
                            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white transition-all"
                            title={getText('Close', 'Tutup')}
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <img
                            src={fullscreenPhoto}
                            alt="Fullscreen preview"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )
            }
            {/* QR Code Modal */}
            {
                showQRModal && selectedRoomForQR && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-semibold text-lg">QR Code: {selectedRoomForQR.name}</h3>
                                <button
                                    onClick={() => setShowQRModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="p-6 flex flex-col items-center">
                                {/* The Card to be captured */}
                                <div
                                    id="qr-card-element"
                                    className="bg-white p-6 border-2 border-gray-900 rounded-xl flex flex-col items-center gap-4 w-64 shadow-sm"
                                >
                                    <div className="text-center">
                                        <h2 className="font-bold text-xl uppercase text-gray-900">{selectedRoomForQR.name}</h2>
                                        <p className="text-xs text-gray-500">{selectedRoomForQR.code}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded">
                                        <QRCode
                                            value={selectedRoomForQR.id}
                                            size={180}
                                            viewBox={`0 0 256 256`}
                                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Scan untuk Presensi</p>
                                        <p className="text-[8px] text-gray-300 mt-1">Fakultas Vokasi UNY</p>
                                    </div>
                                </div>

                                <p className="text-sm text-gray-500 mt-6 text-center">
                                    Cetak dan tempel kode QR ini di ruangan agar dosen dapat melakukan presensi.
                                </p>

                                <div className="flex gap-3 w-full mt-6">
                                    <button
                                        onClick={() => setShowQRModal(false)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                                    >
                                        Tutup
                                    </button>
                                    <button
                                        onClick={downloadQR}
                                        disabled={isDownloadingQR}
                                        className={`flex-1 px-4 py-2 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 ${isDownloadingQR
                                            ? 'bg-blue-400 cursor-wait opacity-80'
                                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md'
                                            }`}
                                    >
                                        {isDownloadingQR ? (
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
                )
            }

            {/* HIDDEN TEMPLATE FOR GENERATING IMAGE */}
            {/* Positioned absolute off-screen so user doesn't see it but html2canvas can capture it */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div
                    id="room-users-card-element"
                    className="relative w-[215mm] min-h-[330mm] p-12 flex flex-col items-center text-gray-700 font-sans"
                >
                    {/* Background Image Template */}
                    <img
                        src="/template_room_users.png"
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover z-0"
                    />

                    {/* Content */}
                    <div className="relative z-10 w-full flex flex-col items-center">
                        <h1 className="text-[31px] font-bold mb-1 text-center">Daftar Dosen</h1>
                        <h2 className="text-[31px] font-bold mb-12 text-center">
                            Ruang {showRoomDetail?.name || ''}
                        </h2>

                        <div className="w-full space-y-8 px-4">
                            {Object.entries(usersByProdi).map(([prodiName, users]) => (
                                <div key={prodiName} className="mb-6">
                                    <h3 className="text-[28px] font-medium mb-3 pl-2">
                                        {prodiName}
                                    </h3>
                                    <ul className="list-disc pl-8 space-y-2">
                                        {users.map((item: any) => (
                                            <li key={item.id} className="text-[28px] font-bold">
                                                <span>{item.user.full_name}</span>
                                                {item.user.jabatan && (
                                                    <span className="font-bold"> ( {item.user.jabatan} )</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default RoomManagement;