import React, { useState, useEffect, useCallback } from 'react';
import {
    Building, Search, Eye, Users, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Loader2, Hash, DoorClosed, Calendar as CalendarIcon, Wrench, ChevronDown, GraduationCap, UserCheck, AlertTriangle, Filter, ChevronUp, FileText, Warehouse, Package, Layers, Tag, Box
} from 'lucide-react';
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
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Active Tab: 'rooms' or 'equipment'
    const [activeTab, setActiveTab] = useState<'rooms' | 'equipment'>('rooms');

    // All Equipment (for Keterangan Alat tab)
    const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
    const [loadingAllEquipment, setLoadingAllEquipment] = useState(false);
    const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
    const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState('all');
    const [equipmentConditionFilter, setEquipmentConditionFilter] = useState('all');

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

    // Fetch all equipment when equipment tab is active
    useEffect(() => {
        if (activeTab === 'equipment' && allEquipment.length === 0) {
            fetchAllEquipment();
        }
    }, [activeTab]);

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
                    )
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
    const fetchAllEquipment = async () => {
        setLoadingAllEquipment(true);
        try {
            const { data, error } = await supabase
                .from('equipment')
                .select(`
                    *,
                    room:rooms!rooms_id(id, name, code),
                    department:departments!department_id(id, name)
                `)
                .order('name');

            if (error) throw error;
            setAllEquipment(data || []);
        } catch (err) {
            console.error('Error fetching all equipment:', err);
        } finally {
            setLoadingAllEquipment(false);
        }
    };

    // Load Room Details when modal opens or targetDate changes
    useEffect(() => {
        if (showRoomDetail) {
            fetchEquipmentForRoom(showRoomDetail.id);
            fetchRoomUsers(showRoomDetail.id);
            fetchRoomPhoto(showRoomDetail);
            fetchSchedulesForRoom(showRoomDetail.name, showRoomDetail.id);
        } else {
            setRoomPhoto(null);
            setSelectedRoomEquipment([]);
            setRoomUsers([]);
            setCombinedSchedules([]);
        }
    }, [showRoomDetail, targetDate]);

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
            const { data, error } = await supabase
                .from('equipment')
                .select('*')
                .eq('rooms_id', roomId)
                .order('name');

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
        
        let matchesStatus = true;
        if (statusFilter === 'available') {
            matchesStatus = room.is_available;
        } else if (statusFilter === 'unavailable') {
            matchesStatus = !room.is_available;
        }

        return matchesSearch && matchesDept && matchesStatus;
    });

    // Filter logic for equipment
    const equipmentCategories = [...new Set(allEquipment.map(eq => eq.category).filter(Boolean))];
    const filteredEquipment = allEquipment.filter(eq => {
        const matchesSearch = eq.name.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
            eq.code.toLowerCase().includes(equipmentSearchTerm.toLowerCase());
        const matchesCategory = equipmentCategoryFilter === 'all' || eq.category === equipmentCategoryFilter;
        const matchesCondition = equipmentConditionFilter === 'all' || eq.condition === equipmentConditionFilter;
        return matchesSearch && matchesCategory && matchesCondition;
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
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{getText('Room & Equipment Info', 'Keterangan Ruang dan Alat')}</h2>
                    <p className="text-blue-100 max-w-xl text-sm leading-relaxed">
                        {getText('View room details, capacity, facilities, equipment inventory, and daily schedule info.', 'Lihat informasi ruangan, kapasitas, fasilitas, inventaris alat, serta jadwal penggunaan ruangan harian.')}
                    </p>
                </div>
                <div className="flex items-center gap-3 relative z-10 flex-shrink-0">
                    <div className="px-4 py-2 bg-white bg-opacity-25 backdrop-blur-md rounded-xl text-xs font-bold uppercase tracking-widest">{getText('Public Access', 'Akses Publik')}</div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 flex gap-1">
                <button
                    onClick={() => setActiveTab('rooms')}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                        activeTab === 'rooms'
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-200/50 transform scale-[1.02]'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                    <Building className="h-5 w-5" />
                    {getText('Room Information', 'Keterangan Ruang')}
                </button>
                <button
                    onClick={() => setActiveTab('equipment')}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                        activeTab === 'equipment'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200/50 transform scale-[1.02]'
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredRooms.map(room => (
                                    <div key={room.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group flex flex-col justify-between gap-3">
                                        {/* Compact Room Info */}
                                        <div className="space-y-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-extrabold text-gray-900 text-base leading-snug line-clamp-1">{room.name}</h3>
                                                    <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase mt-0.5">{room.code}</p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider flex-shrink-0 ${room.is_available ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                    {room.is_available ? getText('Available', 'Tersedia') : getText('Not Available', 'Tidak Tersedia')}
                                                </span>
                                            </div>

                                            {/* Compact Info Row */}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                                                <div className="flex items-center text-xs text-gray-600 gap-1.5">
                                                    <Users className="h-3.5 w-3.5 text-blue-500" />
                                                    <span className="font-semibold">{room.capacity} {getText('seats', 'kursi')}</span>
                                                </div>
                                                <div className="flex items-center text-xs text-gray-600 gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                                    <span className="truncate font-semibold">{room.department?.name || getText('General', 'Umum')}</span>
                                                </div>
                                                {room.building?.name && (
                                                    <div className="flex items-center text-xs text-gray-500 gap-1.5">
                                                        <Building className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                                                        <span className="truncate font-medium">{room.building.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Lihat Detail Button with Eye Icon */}
                                        <button
                                            onClick={() => setShowRoomDetail(room)}
                                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 w-full group-hover:shadow-md"
                                        >
                                            <Eye className="h-4 w-4" />
                                            {getText('View Details', 'Lihat Detail')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-widest">{getText('Room Name', 'Nama Ruangan')}</th>
                                            <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-widest">{getText('Code', 'Kode')}</th>
                                            <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-widest">{getText('Capacity', 'Kapasitas')}</th>
                                            <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-widest">{getText('Department', 'Departemen')}</th>
                                            <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-widest">{getText('Status', 'Status')}</th>
                                            <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-widest text-right">{getText('Actions', 'Aksi')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRooms.map(room => (
                                            <tr key={room.id} className="border-b border-gray-100 hover:bg-gray-55 transition-colors">
                                                <td className="px-6 py-4 font-bold text-gray-900 text-sm">{room.name}</td>
                                                <td className="px-6 py-4 text-xs font-mono text-gray-500 tracking-wider">{room.code}</td>
                                                <td className="px-6 py-4 text-sm font-semibold text-gray-700">{room.capacity} {getText('seats', 'kursi')}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-[200px]">{room.department?.name || getText('General', 'Umum')}</td>
                                                <td className="px-6 py-4 text-xs">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${room.is_available ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                        {room.is_available ? getText('Available', 'Tersedia') : getText('Not Available', 'Tidak Tersedia')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setShowRoomDetail(room)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-bold"
                                                        title={getText('View Details', 'Lihat Detail')}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        {getText('Detail', 'Detail')}
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
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder={getText('Search equipment by name or code...', 'Cari alat berdasarkan nama atau kode...')}
                                value={equipmentSearchTerm}
                                onChange={(e) => setEquipmentSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors text-sm"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Category filter */}
                            <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <select
                                    value={equipmentCategoryFilter}
                                    onChange={(e) => setEquipmentCategoryFilter(e.target.value)}
                                    className="px-4 py-2.5 bg-gray-55 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-gray-700 font-medium"
                                >
                                    <option value="all">{getText('All Categories', 'Semua Kategori')}</option>
                                    {equipmentCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Condition filter */}
                            <select
                                value={equipmentConditionFilter}
                                onChange={(e) => setEquipmentConditionFilter(e.target.value)}
                                className="px-4 py-2.5 bg-gray-55 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-gray-700 font-medium"
                            >
                                <option value="all">{getText('All Conditions', 'Semua Kondisi')}</option>
                                <option value="GOOD">{getText('Good', 'Baik')}</option>
                                <option value="BROKEN">{getText('Broken', 'Rusak')}</option>
                                <option value="MAINTENANCE">{getText('Maintenance', 'Perawatan')}</option>
                            </select>
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

                    {/* Equipment List */}
                    {loadingAllEquipment ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                            <p className="text-gray-500 text-sm font-semibold">{getText('Loading equipment list...', 'Memuat daftar alat...')}</p>
                        </div>
                    ) : filteredEquipment.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredEquipment.map(eq => {
                                const { serials } = parseEquipmentSpec(eq.Spesification || '');
                                const eqRoom = (eq as any).room;
                                const eqDept = (eq as any).department;
                                return (
                                    <div key={eq.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-lg hover:border-emerald-200 transition-all duration-300 flex flex-col gap-3">
                                        {/* Equipment Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-extrabold text-gray-900 text-sm leading-snug line-clamp-2">{eq.name}</h3>
                                                <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase mt-0.5">{eq.code}</p>
                                            </div>
                                            {getEquipmentConditionChip(eq.condition)}
                                        </div>

                                        {/* Equipment Details */}
                                        <div className="space-y-1.5">
                                            {eq.category && (
                                                <div className="flex items-center text-xs text-gray-600 gap-1.5">
                                                    <Tag className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="font-semibold">{eq.category}</span>
                                                </div>
                                            )}
                                            {eq.quantity != null && (
                                                <div className="flex items-center text-xs text-gray-600 gap-1.5">
                                                    <Layers className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="font-semibold">{getText('Qty', 'Jumlah')}: {eq.quantity} {eq.unit || ''}</span>
                                                </div>
                                            )}
                                            {eqRoom && (
                                                <div className="flex items-center text-xs text-gray-600 gap-1.5">
                                                    <DoorClosed className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                                    <span className="font-semibold truncate">{eqRoom.name}</span>
                                                </div>
                                            )}
                                            {eqDept && (
                                                <div className="flex items-center text-xs text-gray-500 gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                                                    <span className="font-medium truncate">{eqDept.name}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Serial Numbers */}
                                        {serials.length > 0 && (
                                            <div className="pt-1 border-t border-gray-100">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">{getText('Serial Numbers', 'Nomor Seri')}</p>
                                                <select className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:border-emerald-500 font-mono text-[10px] text-gray-700 cursor-pointer">
                                                    {serials.map((sn, idx) => (
                                                        <option key={idx} value={sn}>{sn}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Availability Badge */}
                                        <div className="mt-auto pt-1">
                                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${eq.is_available ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                {eq.is_available ? getText('Available', 'Tersedia') : getText('In Use', 'Sedang Digunakan')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
                            <Wrench className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-bold text-gray-700">{getText('No Equipment Found', 'Tidak Ada Alat Ditemukan')}</p>
                            <p className="text-gray-400 text-sm mt-1">{getText('Try adjusting your search or filter keywords.', 'Coba sesuaikan kata kunci pencarian atau filter Anda.')}</p>
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
        </div>
    );
};

export default RoomInfo;
