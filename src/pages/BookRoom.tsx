import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Building, Plus, Search, Edit, Trash2, Eye, Users, User, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Zap, Tv2, Speaker, Presentation, Mic, AirVent, Loader2, Hash, DoorClosed, Calendar, Phone, Send, ChevronDown, BookOpen, GraduationCap, ArrowUpDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { Room, Department, LectureSchedule, Equipment, StudyProgram } from '../types';
import toast from 'react-hot-toast';
import { alert } from '../components/Alert/AlertHelper';
import { format, addMinutes, parse } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const bookingSchema = z.object({
    full_name: z.string().min(3, 'Full name must be at least 3 characters'),
    identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
    study_program_id: z.string().min(1, 'Please select a study program'),
    phone_number: z.string().min(10, 'Please enter a valid phone number'),
    room_id: z.string().min(1, 'Please select a room'),
    start_time: z.string().min(1, 'Please select start time'),
    end_time: z.string().optional(),
    sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
    class_type: z.enum(['theory', 'practical']),
    equipment_requested: z.array(z.string()).optional(),
    notes: z.string().optional(),
});
type BookingForm = z.infer<typeof bookingSchema>;

interface StudyProgramWithDepartment extends StudyProgram {
    department?: Department;
}

interface ExistingUser {
    id: string;
    identity_number: string;
    full_name: string;
    email: string;
    phone_number?: string;
    study_program_id?: string;
    study_program?: StudyProgram & { department?: Department };
}

interface RoomWithStatus extends Room {
    department: Department | null;
    status: 'In Use' | 'Scheduled' | 'Available' | 'Loading';
    currentBooking?: any;
    scheduleDetails?: {
        lectures: any[];
        exams: any[];
        sessions: any[];
    };
}

interface BookingConflict {
    id: string;
    start_time: string;
    end_time: string;
    purpose: string;
    user?: {
        full_name: string;
        identity_number: string;
    };
}

interface LectureConflict {
    id: string;
    start_time: string;
    end_time: string;
    course_name: string;
    class: string;
    subject_study: string;
}

interface ExamConflict {
    id: string;
    start_time: string;
    end_time: string;
    course_name: string;
    course_code: string;
    semester: number;
    class: string;
    student_amount: number;
    is_take_home: boolean;
}

const BookRoom: React.FC = () => {
    const { profile } = useAuth();
    const { getText, formatTime, formatDate } = useLanguage();
    
    // State declarations
    const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showInUse, setShowInUse] = useState(false);
    const [viewingSchedulesFor, setViewingSchedulesFor] = useState<RoomWithStatus | null>(null);
    const [schedulesForModal, setSchedulesForModal] = useState<{
        bookings: BookingConflict[];
        lectures: LectureConflict[];
        exams: ExamConflict[];
    }>({
        bookings: [],
        lectures: [],
        exams: []
    });
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [studyPrograms, setStudyPrograms] = useState<StudyProgramWithDepartment[]>([]);
    const [masterEquipmentList, setMasterEquipmentList] = useState<Equipment[]>([]);
    const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoom, setSelectedRoom] = useState<RoomWithStatus | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
    const [identitySearchTerm, setIdentitySearchTerm] = useState('');
    const [showStudyProgramDropdown, setShowStudyProgramDropdown] = useState(false);
    const [studyProgramSearchTerm, setStudyProgramSearchTerm] = useState('');
    const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
    const [checkedEquipment, setCheckedEquipment] = useState<Set<string>>(new Set());
    const [useManualEndTime, setUseManualEndTime] = useState(false);

    // ✅ NEW: Sorting states
    const [sortBy, setSortBy] = useState<'name' | 'capacity' | 'status'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [filterStatus, setFilterStatus] = useState<'all' | 'Available' | 'Scheduled' | 'In Use'>('all');

    const form = useForm<BookingForm>({
        resolver: zodResolver(bookingSchema),
        defaultValues: { 
            class_type: 'theory', 
            sks: 2, 
            equipment_requested: [],
            full_name: '',
            identity_number: '',
            study_program_id: '',
            phone_number: '',
            room_id: '',
            start_time: '',
            end_time: '',
            notes: ''
        },
    });

    const watchSks = form.watch('sks');
    const watchClassType = form.watch('class_type');
    const watchIdentityNumber = form.watch('identity_number');
    const watchStudyProgramId = form.watch('study_program_id');
    const watchStartTime = form.watch('start_time');
    const watchEndTime = form.watch('end_time');

    const normalizeRoomName = (name: string): string => {
        if (!name) return '';
        return name.toLowerCase().replace(/[\s.&-]/g, '');
    };
    
    // ✅ IMPROVED: Enhanced room status logic dengan prioritas yang benar
    const fetchRoomsWithStatus = useCallback(async () => {
        try {
            const now = new Date();
            const todayDayName = format(now, 'EEEE', { locale: localeID });
            const todayDateString = format(now, 'yyyy-MM-dd');
            
            // 1. Fetch ONLY AVAILABLE rooms (is_available = true)
            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select(`*, department:departments(*)`)
                .eq('is_available', true) // ✅ ONLY available rooms dapat di-book
                .order('name', { ascending: true });
                
            if (roomsError) throw roomsError;

            // 2. Fetch current approved bookings untuk TODAY
            const startOfDay = `${todayDateString}T00:00:00Z`;
            const endOfDay = `${todayDateString}T23:59:59Z`;
            
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select('room_id, start_time, end_time, purpose, user:users(full_name, identity_number)')
                .eq('status', 'approved')
                .gte('start_time', startOfDay)
                .lte('start_time', endOfDay);
                
            if (bookingsError) throw bookingsError;

            // 3. Fetch lecture schedules untuk TODAY
            const { data: lecturesData, error: lecturesError } = await supabase
                .from('lecture_schedules')
                .select('room, start_time, end_time, course_name, class, subject_study, day')
                .eq('day', todayDayName);
                
            if (lecturesError) throw lecturesError;

            // 4. Fetch exam schedules untuk TODAY
            const { data: examsData, error: examsError } = await supabase
                .from('exams')
                .select('room_id, start_time, end_time, course_name, course_code, semester, class, student_amount, is_take_home, date')
                .eq('date', todayDateString);
                
            if (examsError) throw examsError;

            // 5. Fetch final sessions untuk TODAY
            const { data: sessionsData, error: sessionsError } = await supabase
                .from('final_sessions')
                .select('room_id, start_time, end_time, title, supervisor, examiner, secretary, date')
                .eq('date', todayDateString);
                
            if (sessionsError) throw sessionsError;

            // 6. Process room status dengan priority logic yang benar
            const roomsWithStatus = (roomsData || []).map(room => {
                let status: RoomWithStatus['status'] = 'Available';
                let currentBooking = null;
                let scheduleDetails = {
                    lectures: [] as any[],
                    exams: [] as any[],
                    sessions: [] as any[]
                };

                // PRIORITY 1: Check for CURRENT active bookings (IN USE)
                const activeBooking = bookingsData?.find(booking => {
                    if (booking.room_id !== room.id) return false;
                    const startTime = new Date(booking.start_time);
                    const endTime = new Date(booking.end_time);
                    return now >= startTime && now <= endTime;
                });

                if (activeBooking) {
                    status = 'In Use';
                    currentBooking = activeBooking;
                }

                // PRIORITY 2: Check for SCHEDULED events untuk hari ini
                if (status === 'Available') {
                    // Check lectures by room name
                    const roomLectures = lecturesData?.filter(lecture => 
                        lecture.room && normalizeRoomName(lecture.room) === normalizeRoomName(room.name)
                    ) || [];

                    // Check exams by room_id
                    const roomExams = examsData?.filter(exam => 
                        exam.room_id === room.id && !exam.is_take_home
                    ) || [];

                    // Check final sessions by room_id
                    const roomSessions = sessionsData?.filter(session => 
                        session.room_id === room.id
                    ) || [];

                    // Check if ada jadwal hari ini
                    const hasScheduleToday = roomLectures.length > 0 || roomExams.length > 0 || roomSessions.length > 0;
                    
                    if (hasScheduleToday) {
                        status = 'Scheduled';
                        scheduleDetails = {
                            lectures: roomLectures,
                            exams: roomExams,
                            sessions: roomSessions
                        };
                    }
                }

                return { 
                    ...room, 
                    department: room.department, 
                    status,
                    currentBooking,
                    scheduleDetails
                };
            });

            setRooms(roomsWithStatus as RoomWithStatus[]);
            
        } catch (error) { 
            console.error('Error fetching rooms with status:', error); 
            if (alert && alert.error) {
                alert.error(getText('Failed to load room status.', 'Gagal memuat status ruangan.'));
            }
        } finally { 
            setLoading(false); 
        }
    }, [getText]);

    // ✅ IMPROVED: Enhanced schedules fetch dengan detail lengkap
    const fetchSchedulesForRoom = async (roomName: string, roomId: string) => {
        setLoadingSchedules(true);
        try {
            const todayDayName = format(new Date(), 'EEEE', { locale: localeID });
            const todayDateString = format(new Date(), 'yyyy-MM-dd');
            const startOfDay = `${todayDateString}T00:00:00Z`;
            const endOfDay = `${todayDateString}T23:59:59Z`;

            // Fetch bookings untuk hari ini
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    id, start_time, end_time, purpose, status,
                    user:users(full_name, identity_number)
                `)
                .eq('room_id', roomId)
                .eq('status', 'approved')
                .gte('start_time', startOfDay)
                .lte('start_time', endOfDay)
                .order('start_time');

            // Fetch lecture schedules untuk hari ini
            const { data: lecturesData, error: lecturesError } = await supabase
                .from('lecture_schedules')
                .select('*')
                .eq('day', todayDayName)
                .ilike('room', `%${roomName}%`)
                .order('start_time');

            // Fetch exam schedules untuk hari ini
            const { data: examsData, error: examsError } = await supabase
                .from('exams')
                .select('*')
                .eq('room_id', roomId)
                .eq('date', todayDateString)
                .order('start_time');

            // Fetch final sessions untuk hari ini
            const { data: sessionsData, error: sessionsError } = await supabase
                .from('final_sessions')
                .select('*')
                .eq('room_id', roomId)
                .eq('date', todayDateString)
                .order('start_time');

            if (bookingsError) throw bookingsError;
            if (lecturesError) throw lecturesError;
            if (examsError) throw examsError;
            if (sessionsError) throw sessionsError;

            // Transform data untuk modal
            const bookings: BookingConflict[] = (bookingsData || []).map(booking => ({
                id: booking.id,
                start_time: format(new Date(booking.start_time), 'HH:mm'),
                end_time: format(new Date(booking.end_time), 'HH:mm'),
                purpose: booking.purpose || 'Room Booking',
                user: booking.user
            }));

            const lectures: LectureConflict[] = (lecturesData || []).map(lecture => ({
                id: lecture.id,
                start_time: lecture.start_time?.substring(0, 5) || '',
                end_time: lecture.end_time?.substring(0, 5) || '',
                course_name: lecture.course_name || 'Lecture',
                class: lecture.class || '',
                subject_study: lecture.subject_study || ''
            }));

            const exams: ExamConflict[] = (examsData || []).filter(exam => !exam.is_take_home).map(exam => ({
                id: exam.id,
                start_time: exam.start_time?.substring(0, 5) || '',
                end_time: exam.end_time?.substring(0, 5) || '',
                course_name: exam.course_name || 'Exam',
                course_code: exam.course_code || '',
                semester: exam.semester || 0,
                class: exam.class || '',
                student_amount: exam.student_amount || 0,
                is_take_home: exam.is_take_home || false
            }));

            setSchedulesForModal({ bookings, lectures, exams });

        } catch (error) { 
            if (alert && alert.error) {
                alert.error(getText("Failed to load schedule for this room.", "Gagal memuat jadwal untuk ruangan ini."));
            }
            setSchedulesForModal({ bookings: [], lectures: [], exams: [] });
        } finally { 
            setLoadingSchedules(false); 
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchRoomsWithStatus();
        fetchStudyPrograms();
        fetchEquipment();
        fetchExistingUsers();
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        const statusRefreshTimer = setInterval(() => fetchRoomsWithStatus(), 5 * 60 * 1000);
        return () => { clearInterval(timer); clearInterval(statusRefreshTimer); };
    }, [fetchRoomsWithStatus]);

    useEffect(() => { 
        if (viewingSchedulesFor) { 
            fetchSchedulesForRoom(viewingSchedulesFor.name, viewingSchedulesFor.id); 
        } 
    }, [viewingSchedulesFor]);
    
    useEffect(() => {
        if (selectedRoom) {
            const roomSpecificEquipment = masterEquipmentList.filter(eq => eq.rooms_id === selectedRoom.id);
            const generalEquipment = masterEquipmentList.filter(eq => eq.rooms_id === null);
            const combinedEquipment = [...roomSpecificEquipment, ...generalEquipment];
            setAvailableEquipment(combinedEquipment);
            const mandatoryIds = new Set(combinedEquipment.filter(eq => eq.is_mandatory).map(eq => eq.id));
            setCheckedEquipment(mandatoryIds);
        } else {
            setAvailableEquipment([]);
            setCheckedEquipment(new Set());
        }
    }, [selectedRoom, masterEquipmentList]);

    useEffect(() => { 
        if (watchIdentityNumber && watchIdentityNumber.length >= 5) { 
            const existingUser = existingUsers.find(user => user.identity_number === watchIdentityNumber); 
            if (existingUser) { 
                form.setValue('full_name', existingUser.full_name); 
                if (existingUser.phone_number) form.setValue('phone_number', existingUser.phone_number); 
                if (existingUser.study_program_id) { 
                    form.setValue('study_program_id', existingUser.study_program_id); 
                    const selectedProgram = studyPrograms.find(sp => sp.id === existingUser.study_program_id); 
                    if (selectedProgram) setStudyProgramSearchTerm(`${selectedProgram.name} (${selectedProgram.code}) - ${selectedProgram.department?.name}`); 
                }  
            } 
        } 
    }, [watchIdentityNumber, existingUsers, form, studyPrograms]);

    useEffect(() => { 
        if (watchStudyProgramId) { 
            const selectedProgram = studyPrograms.find(sp => sp.id === watchStudyProgramId); 
            if (selectedProgram) setStudyProgramSearchTerm(`${selectedProgram.name} (${selectedProgram.code}) - ${selectedProgram.department?.name}`); 
        } 
    }, [watchStudyProgramId, studyPrograms]);

    const fetchStudyPrograms = async () => { 
        try { 
            const { data, error } = await supabase.from('study_programs').select(`*, department:departments(*)`); 
            if (error) throw error; 
            setStudyPrograms(data || []); 
        } catch (error) { 
            console.error('Error fetching study programs:', error); 
            if (alert && alert.error) {
                alert.error(getText('Failed to load study programs.', 'Gagal memuat program studi.')); 
            }
        } 
    };

    const fetchEquipment = async () => { 
        try { 
            const { data, error } = await supabase.from('equipment').select('*').eq('is_available', true); 
            if (error) throw error; 
            setMasterEquipmentList(data || []); 
        } catch (error) { 
            console.error('Error fetching equipment:', error); 
            if (alert && alert.error) {
                alert.error(getText('Failed to load equipment.', 'Gagal memuat peralatan.')); 
            }
        } 
    };

    const fetchExistingUsers = async () => { 
        try { 
            const { data, error } = await supabase.from('users').select(`id, identity_number, full_name, email, phone_number, department_id, study_program_id, study_program:study_programs(*, department:departments(*))`).order('full_name'); 
            if (error) throw error; 
            const usersWithPrograms = (data || []).map(user => ({...user, study_program: user.study_program })); 
            setExistingUsers(usersWithPrograms); 
        } catch (error) { 
            console.error('Error fetching users:', error); 
        } 
    };

    const handleNowBooking = () => { 
        const now = new Date(); 
        const formattedNow = format(now, "yyyy-MM-dd'T'HH:mm"); 
        form.setValue('start_time', formattedNow); 
    };

    const calculateEndTime = (startTime: string, sks: number, classType: string) => { 
        if (!startTime || !sks) return null; 
        const duration = classType === 'theory' ? sks * 50 : sks * 170; 
        const startDate = new Date(startTime); 
        const endDate = addMinutes(startDate, duration); 
        return endDate; 
    };

    // Auto-update end time when not in manual mode
    useEffect(() => {
        if (!useManualEndTime && watchStartTime && watchSks > 0 && watchClassType) {
            const calculatedEndTime = calculateEndTime(watchStartTime, watchSks, watchClassType);
            if (calculatedEndTime) {
                const formattedEndTime = format(calculatedEndTime, "yyyy-MM-dd'T'HH:mm");
                form.setValue('end_time', formattedEndTime);
            }
        }
    }, [watchStartTime, watchSks, watchClassType, useManualEndTime, form]);

    // Enhanced success handler with detailed toast message
    const handleBookingSuccess = (data: BookingForm, selectedRoom: RoomWithStatus) => {
        const roomName = selectedRoom.name;
        const startTime = format(new Date(data.start_time), 'MMM d, yyyy HH:mm');
        const equipmentCount = checkedEquipment.size;
        
        // Show detailed success toast
        if (alert && alert.success) {
            alert.success(
                getText(
                    `✅ Booking submitted successfully!\n🏢 Room: ${roomName}\n⏰ Time: ${startTime}${equipmentCount > 0 ? `\n⚡ Equipment: ${equipmentCount} items` : ''}\n📝 Status: Pending approval`,
                    `✅ Pemesanan berhasil dikirim!\n🏢 Ruangan: ${roomName}\n⏰ Waktu: ${startTime}${equipmentCount > 0 ? `\n⚡ Peralatan: ${equipmentCount} item` : ''}\n📝 Status: Menunggu persetujuan`
                )
            );
        }

        // Show additional info toast
        setTimeout(() => {
            toast(
                getText(
                    '📧 You will receive notification once your booking is approved by admin.',
                    '📧 Anda akan menerima notifikasi setelah pemesanan disetujui oleh admin.'
                ),
                {
                    duration: 4000,
                    style: {
                        background: '#3B82F6',
                        color: '#FFFFFF',
                        borderRadius: '12px',
                        padding: '12px',
                        fontSize: '13px',
                    },
                }
            );
        }, 1000);
    };
    
    // ✅ IMPROVED: Enhanced submit function dengan late booking logic
    const onSubmit = async (data: BookingForm) => {
        if (!selectedRoom) { 
            if (alert && alert.error) {
                alert.error(getText('Please select a room', 'Silakan pilih ruangan')); 
            }
            return; 
        }
        
        setSubmitting(true);
        try {
            // ✅ Handle late booking: Mark existing approved bookings as completed
            if (selectedRoom.status === 'In Use' && selectedRoom.currentBooking) {
                await supabase
                    .from('bookings')
                    .update({ status: 'completed' })
                    .eq('id', selectedRoom.currentBooking.id);
            }
            
            // Use manual end time if set, otherwise calculate automatically
            let endTime;
            if (useManualEndTime && data.end_time) {
                endTime = new Date(data.end_time).toISOString();
            } else {
                const duration = data.class_type === 'theory' ? data.sks * 50 : data.sks * 170;
                const startDate = new Date(data.start_time);
                const endDate = addMinutes(startDate, duration);
                endTime = endDate.toISOString();
            }
            
            const selectedStudyProgram = studyPrograms.find(sp => sp.id === data.study_program_id);
            const departmentId = selectedStudyProgram?.department_id;
            const bookingData = { 
                room_id: data.room_id, 
                start_time: data.start_time, 
                end_time: endTime, 
                sks: data.sks, 
                class_type: data.class_type, 
                equipment_requested: Array.from(checkedEquipment), 
                notes: data.notes || null, 
                status: 'pending', 
                purpose: 'Class/Study Session', 
                user_info: profile ? null : { 
                    full_name: data.full_name, 
                    identity_number: data.identity_number, 
                    study_program_id: data.study_program_id, 
                    phone_number: data.phone_number, 
                    email: `${data.identity_number}@student.edu`, 
                    department_id: departmentId, 
                }, 
                user_id: profile?.id || null, 
            };
            const { error } = await supabase.from('bookings').insert(bookingData);
            if (error) throw error;
            
            // Call the enhanced success handler
            handleBookingSuccess(data, selectedRoom);
            
            form.reset({ 
                class_type: 'theory', 
                sks: 2, 
                equipment_requested: [],
                full_name: '',
                identity_number: '',
                study_program_id: '',
                phone_number: '',
                room_id: '',
                start_time: '',
                end_time: '',
                notes: ''
            });
            setSelectedRoom(null);
            setIdentitySearchTerm('');
            setStudyProgramSearchTerm('');
            setUseManualEndTime(false);
            fetchRoomsWithStatus();
            
        } catch (error: any) { 
            console.error('Error creating booking:', error); 
            if (alert && alert.error) {
                alert.error(
                    error.message || getText('Failed to create booking', 'Gagal membuat pemesanan')
                ); 
            }
        } finally { 
            setSubmitting(false); 
        }
    };

    const filteredIdentityNumbers = existingUsers.filter(user => 
        user.identity_number.toLowerCase().includes(identitySearchTerm.toLowerCase()) || 
        user.full_name.toLowerCase().includes(identitySearchTerm.toLowerCase())
    );

    // ✅ NEW: Enhanced room filtering dengan sorting
    const filteredAndSortedRooms = useMemo(() => { 
        let filtered = rooms.filter(room => { 
            const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                room.code.toLowerCase().includes(searchTerm.toLowerCase()); 
            const matchesStatus = filterStatus === 'all' || room.status === filterStatus;
            const matchesVisibility = room.status !== 'In Use' || showInUse; 
            return matchesSearch && matchesStatus && matchesVisibility; 
        });

        // Apply sorting
        filtered.sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'capacity':
                    comparison = a.capacity - b.capacity;
                    break;
                case 'status':
                    // Custom status order: Available -> Scheduled -> In Use
                    const statusOrder = { 'Available': 1, 'Scheduled': 2, 'In Use': 3 };
                    comparison = statusOrder[a.status] - statusOrder[b.status];
                    break;
                default:
                    comparison = 0;
            }
            
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [rooms, searchTerm, filterStatus, showInUse, sortBy, sortOrder]);

    const getStatusColor = (status: RoomWithStatus['status']) => { 
        switch (status) { 
            case 'In Use': return 'bg-red-100 text-red-800'; 
            case 'Scheduled': return 'bg-yellow-100 text-yellow-800'; 
            case 'Available': return 'bg-green-100 text-green-800'; 
            default: return 'bg-gray-100 text-gray-800'; 
        } 
    };

    const getStatusText = (status: RoomWithStatus['status']) => {
        switch (status) {
            case 'In Use': return getText('In Use', 'Sedang Digunakan');
            case 'Scheduled': return getText('Scheduled', 'Terjadwal');
            case 'Available': return getText('Available', 'Tersedia');
            default: return status;
        }
    };

    // ✅ NEW: Handle sorting change
    const handleSortChange = (newSortBy: 'name' | 'capacity' | 'status') => {
        if (sortBy === newSortBy) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('asc');
        }
    };

    if (loading) { 
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
        ); 
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header Section */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                                <Calendar className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    {getText('Book Room', 'Pesan Ruangan')}
                                </h1>
                                <p className="text-gray-600 mt-1">
                                    {getText('Reserve your perfect study space', 'Pesan ruang belajar yang sempurna')}
                                </p>
                            </div>
                        </div>
                        <div className="hidden md:block">
                            <div className="text-right">
                                <div className="text-2xl font-bold text-gray-800">{formatTime(currentTime)}</div>
                                <div className="text-sm text-gray-500">{formatDate(currentTime).split(',')[0]}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* ✅ FIXED: Layout 7:5 - Form di kiri, Room selection di kanan */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Booking Form (7/12 width) */}
                    <div className="lg:col-span-7">
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 sticky top-24">
                            <div className="flex items-center space-x-3 mb-8">
                                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                                    <Calendar className="h-5 w-5 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {getText('Book Your Room', 'Pesan Ruangan Anda')}
                                </h2>
                            </div>
                            
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                {/* ✅ STEP 1: Booking Details - PERTAMA */}
                                <div className="space-y-6">
                                    <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                                        <Calendar className="h-5 w-5 text-blue-500" />
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {getText('1. Booking Details', '1. Detail Pemesanan')}
                                        </h3>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            {getText('Start Time', 'Waktu Mulai')} *
                                        </label>
                                        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                                            <input 
                                                {...form.register('start_time')} 
                                                type="datetime-local" 
                                                className="flex-1 px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200" 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={handleNowBooking} 
                                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                                            >
                                                {getText('NOW', 'SEKARANG')}
                                            </button>
                                        </div>
                                        {form.formState.errors.start_time && (
                                            <p className="mt-2 text-sm text-red-600 font-medium">
                                                {form.formState.errors.start_time.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                {getText('SKS (Credits)', 'SKS (Kredit)')} *
                                            </label>
                                            <input 
                                                {...form.register('sks', { valueAsNumber: true })} 
                                                type="number" 
                                                min="1" 
                                                max="6" 
                                                className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200" 
                                            />
                                            {form.formState.errors.sks && (
                                                <p className="mt-2 text-sm text-red-600 font-medium">
                                                    {form.formState.errors.sks.message}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                {getText('Class Type', 'Tipe Kelas')} *
                                            </label>
                                            <select 
                                                {...form.register('class_type')} 
                                                className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                                            >
                                                <option value="theory">
                                                    {getText('Theory (50 min/SKS)', 'Teori (50 menit/SKS)')}
                                                </option>
                                                <option value="practical">
                                                    {getText('Practical (170 min/SKS)', 'Praktik (170 menit/SKS)')}
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    {/* End Time Section */}
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="block text-sm font-semibold text-gray-700">
                                                {getText('End Time', 'Waktu Selesai')}
                                            </label>
                                            <div className="flex items-center space-x-3">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        checked={!useManualEndTime} 
                                                        onChange={() => setUseManualEndTime(false)}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    />
                                                    <span className="text-sm font-medium text-gray-700">
                                                        {getText('Auto Calculate', 'Otomatis')}
                                                    </span>
                                                </label>
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        checked={useManualEndTime} 
                                                        onChange={() => setUseManualEndTime(true)}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                    />
                                                    <span className="text-sm font-medium text-gray-700">
                                                        {getText('Manual', 'Manual')}
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                        
                                        {useManualEndTime ? (
                                            <input 
                                                {...form.register('end_time')} 
                                                type="datetime-local" 
                                                className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200" 
                                            />
                                        ) : (
                                            <div className="px-4 py-3 bg-gray-50/50 border border-gray-200/50 rounded-xl text-gray-600">
                                                {watchStartTime && watchSks > 0 && watchClassType ? (
                                                    `${getText('Auto-calculated:', 'Otomatis dihitung:')} ${calculateEndTime(watchStartTime, watchSks, watchClassType) ? 
                                                        format(calculateEndTime(watchStartTime, watchSks, watchClassType)!, "MMM d, yyyy 'at' HH:mm") : 
                                                        getText('Invalid calculation', 'Perhitungan tidak valid')
                                                    }`
                                                ) : (
                                                    getText('End time will be calculated automatically based on SKS and class type', 'Waktu selesai akan dihitung otomatis berdasarkan SKS dan tipe kelas')
                                                )}
                                            </div>
                                        )}
                                        {form.formState.errors.end_time && (
                                            <p className="mt-2 text-sm text-red-600 font-medium">
                                                {form.formState.errors.end_time.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    {watchStartTime && watchSks > 0 && (
                                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-xl p-4">
                                            <div className="flex items-start space-x-3">
                                                <Clock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                                                <div className="text-sm text-green-800">
                                                    <p className="font-semibold">
                                                        {getText('Duration:', 'Durasi:')} {watchClassType === 'theory' ? watchSks * 50 : watchSks * 170} {getText('minutes', 'menit')}
                                                    </p>
                                                    {useManualEndTime && watchEndTime && watchStartTime ? (
                                                        <p className="mt-1">
                                                            {getText('Custom Duration:', 'Durasi Kustom:')} {Math.round((new Date(watchEndTime).getTime() - new Date(watchStartTime).getTime()) / (1000 * 60))} {getText('minutes', 'menit')}
                                                        </p>
                                                    ) : (
                                                        calculateEndTime(watchStartTime, watchSks, watchClassType) && (
                                                            <p className="mt-1">
                                                                {getText('End Time:', 'Waktu Selesai:')} {format(calculateEndTime(watchStartTime, watchSks, watchClassType)!, "MMM d, yyyy 'at' HH:mm")}
                                                            </p>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Additional Notes */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            {getText('Additional Notes (Optional)', 'Catatan Tambahan (Opsional)')}
                                        </label>
                                        <textarea 
                                            {...form.register('notes')} 
                                            rows={3}
                                            placeholder={getText("Any special requirements or notes...", "Persyaratan khusus atau catatan...")}
                                            className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 resize-none" 
                                        />
                                    </div>
                                </div>

                                {/* ✅ STEP 2: Room Selection - KEDUA (diisi otomatis saat pilih room) */}
                                <div className="space-y-6">
                                    <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                                        <Building className="h-5 w-5 text-blue-500" />
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {getText('2. Room Selection', '2. Pilih Ruangan')}
                                        </h3>
                                    </div>
                                    
                                    {selectedRoom ? (
                                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl p-4">
                                            <div className="flex items-start space-x-3">
                                                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="font-semibold text-blue-800 text-lg">
                                                        {selectedRoom.name} ({selectedRoom.code})
                                                    </p>
                                                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-blue-600 font-medium">
                                                                {getText('Capacity:', 'Kapasitas:')}
                                                            </span>
                                                            <span className="ml-2 text-blue-800">
                                                                {selectedRoom.capacity} {getText('seats', 'kursi')}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-blue-600 font-medium">
                                                                {getText('Department:', 'Departemen:')}
                                                            </span>
                                                            <span className="ml-2 text-blue-800">
                                                                {selectedRoom.department?.name || getText('General', 'Umum')}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-blue-600 font-medium">
                                                                {getText('Status:', 'Status:')}
                                                            </span>
                                                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(selectedRoom.status)}`}>
                                                                {getStatusText(selectedRoom.status)}
                                                            </span>
                                                        </div>
                                                        {selectedRoom.status === 'In Use' && (
                                                            <div className="col-span-2">
                                                                <span className="text-orange-600 font-medium">
                                                                    ⚠️ {getText('Late Booking:', 'Peminjaman Terlambat:')}
                                                                </span>
                                                                <span className="ml-2 text-orange-800 text-xs">
                                                                    {getText('Current booking will be marked as completed', 'Pemesanan saat ini akan ditandai selesai')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedRoom(null);
                                                            form.setValue('room_id', '');
                                                        }}
                                                        className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                        {getText('Change Room', 'Ganti Ruangan')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200/50 rounded-xl p-4">
                                            <div className="flex items-start space-x-3">
                                                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                                <div className="text-sm text-yellow-800">
                                                    <p className="font-semibold">
                                                        {getText('Room Selection Required', 'Pilih Ruangan Terlebih Dahulu')}
                                                    </p>
                                                    <p className="mt-1">
                                                        {getText('Please select a room from the right panel to continue.', 'Silakan pilih ruangan dari panel sebelah kanan untuk melanjutkan.')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ✅ STEP 3: Equipment Request - KETIGA (hanya muncul jika room terpilih) */}
                                {selectedRoom && availableEquipment.length > 0 && (
                                    <div className="space-y-6">
                                        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                                            <Zap className="h-5 w-5 text-blue-500" />
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {getText('3. Equipment Request', '3. Permintaan Peralatan')}
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
                                            {availableEquipment.map(eq => (
                                                <label 
                                                    key={eq.id} 
                                                    className="flex items-center p-4 bg-white/50 rounded-xl cursor-pointer hover:bg-white/70 border border-gray-200/50 transition-all duration-200"
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={checkedEquipment.has(eq.id)} 
                                                        disabled={eq.is_mandatory} 
                                                        onChange={(e) => { 
                                                            setCheckedEquipment(prev => { 
                                                                const newSet = new Set(prev); 
                                                                if (e.target.checked) { 
                                                                    newSet.add(eq.id); 
                                                                } else { 
                                                                    newSet.delete(eq.id); 
                                                                } 
                                                                return newSet; 
                                                            }) 
                                                        }} 
                                                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed" 
                                                    />
                                                    <div className="ml-4 flex-1">
                                                        <span className={`text-sm font-medium ${eq.is_mandatory ? 'text-gray-900' : 'text-gray-700'}`}>
                                                            {eq.name}
                                                        </span>
                                                        {eq.is_mandatory && (
                                                            <span className="block mt-1 text-xs font-bold text-blue-600">
                                                                {getText('Mandatory', 'Wajib')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ✅ STEP 4: Personal Information - KEEMPAT (hanya muncul jika bukan profile dan room terpilih) */}
                                {selectedRoom && !profile && (
                                    <div className="space-y-6">
                                        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                                            <User className="h-5 w-5 text-blue-500" />
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {getText('4. Personal Information', '4. Informasi Pribadi')}
                                            </h3>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        {...form.register('identity_number')} 
                                                        type="text" 
                                                        placeholder={getText("Enter or select your ID", "Masukkan atau pilih ID Anda")} 
                                                        value={identitySearchTerm} 
                                                        onChange={(e) => { 
                                                            setIdentitySearchTerm(e.target.value); 
                                                            form.setValue('identity_number', e.target.value); 
                                                            setShowIdentityDropdown(true); 
                                                        }} 
                                                        onFocus={() => setShowIdentityDropdown(true)} 
                                                        className="w-full px-4 py-3 pr-10 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200" 
                                                    />
                                                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    {showIdentityDropdown && filteredIdentityNumbers.length > 0 && (
                                                        <div 
                                                            onMouseLeave={() => setShowIdentityDropdown(false)} 
                                                            className="absolute z-10 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                                                        >
                                                            {filteredIdentityNumbers.map((user) => (
                                                                <div 
                                                                    key={user.id} 
                                                                    onClick={() => { 
                                                                        setIdentitySearchTerm(user.identity_number); 
                                                                        form.setValue('identity_number', user.identity_number); 
                                                                        setShowIdentityDropdown(false); 
                                                                    }} 
                                                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150"
                                                                >
                                                                    <div className="font-semibold text-gray-800">{user.identity_number}</div>
                                                                    <div className="text-sm text-gray-600">{user.full_name}</div>
                                                                    {user.study_program && (
                                                                        <div className="text-xs text-gray-500">{user.study_program.name}</div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {form.formState.errors.identity_number && (
                                                    <p className="mt-2 text-sm text-red-600 font-medium">
                                                        {form.formState.errors.identity_number.message}
                                                    </p>
                                                )}
                                            </div>
                                            
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    {getText('Full Name', 'Nama Lengkap')} *
                                                </label>
                                                <input 
                                                    {...form.register('full_name')} 
                                                    type="text" 
                                                    placeholder={getText("Enter your full name", "Masukkan nama lengkap Anda")} 
                                                    className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200" 
                                                />
                                                {form.formState.errors.full_name && (
                                                    <p className="mt-2 text-sm text-red-600 font-medium">
                                                        {form.formState.errors.full_name.message}
                                                    </p>
                                                )}
                                            </div>
                                            
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    {getText('Phone Number', 'Nomor Telepon')} *
                                                </label>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                                    <input 
                                                        {...form.register('phone_number')} 
                                                        type="tel" 
                                                        placeholder="08xxxxxxxxxx" 
                                                        className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200" 
                                                    />
                                                </div>
                                                {form.formState.errors.phone_number && (
                                                    <p className="mt-2 text-sm text-red-600 font-medium">
                                                        {form.formState.errors.phone_number.message}
                                                    </p>
                                                )}
                                            </div>
                                            
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    {getText('Study Program', 'Program Studi')} *
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="text" 
                                                        placeholder={getText("Search and select your study program", "Cari dan pilih program studi Anda")} 
                                                        value={studyProgramSearchTerm} 
                                                        onChange={(e) => { 
                                                            setStudyProgramSearchTerm(e.target.value); 
                                                            setShowStudyProgramDropdown(true); 
                                                        }} 
                                                        onFocus={() => setShowStudyProgramDropdown(true)} 
                                                        className="w-full px-4 py-3 pr-10 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200" 
                                                    />
                                                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    {showStudyProgramDropdown && (
                                                        <div 
                                                            onMouseLeave={() => setShowStudyProgramDropdown(false)} 
                                                            className="absolute z-10 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                                                        >
                                                           {studyPrograms.filter(p => p.name.toLowerCase().includes(studyProgramSearchTerm.toLowerCase())).map((program) => (
                                                                <div 
                                                                    key={program.id} 
                                                                    onClick={() => { 
                                                                        const displayText = `${program.name} (${program.code}) - ${program.department?.name}`; 
                                                                        setStudyProgramSearchTerm(displayText); 
                                                                        form.setValue('study_program_id', program.id); 
                                                                        setShowStudyProgramDropdown(false); 
                                                                    }} 
                                                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150"
                                                                >
                                                                    <div className="font-semibold text-gray-800">{program.name} ({program.code})</div>
                                                                    <div className="text-sm text-gray-600">{program.department?.name}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {form.formState.errors.study_program_id && (
                                                    <p className="mt-2 text-sm text-red-600 font-medium">
                                                        {form.formState.errors.study_program_id.message}
                                                    </p>
                                                )}
                                            </div>
                                            
                                            <div className="md:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl p-4">
                                                <div className="flex items-start space-x-3">
                                                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                                    <div className="text-sm text-blue-800">
                                                        <p className="font-semibold">
                                                            {getText('Physical ID Required', 'ID Fisik Diperlukan')}
                                                        </p>
                                                        <p className="mt-1">
                                                            {getText('Please bring your physical ID card when using the room.', 'Harap bawa kartu identitas fisik saat menggunakan ruangan.')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Submit Button */}
                                <div className="pt-6 border-t border-gray-200/50">
                                    <button 
                                        type="submit" 
                                        disabled={!selectedRoom || submitting || (!profile && !form.watch('identity_number'))} 
                                       className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                <span>{getText('Submitting...', 'Mengirim...')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-5 w-5" />
                                                <span>{getText('Submit Booking', 'Kirim Pemesanan')}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Right Column - Room Selection (5/12 width) */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* ✅ IMPROVED: Enhanced Search and Filter Controls */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
                                <div className="flex-1 relative w-full sm:w-auto">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder={getText("Search rooms by name or code...", "Cari ruangan berdasarkan nama atau kode...")} 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="w-full pl-12 pr-4 py-4 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400" 
                                    />
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="flex bg-white/50 border border-gray-200/50 rounded-xl overflow-hidden shadow-sm">
                                        <button 
                                            onClick={() => setViewMode('grid')} 
                                            className={`p-3 transition-all duration-200 ${viewMode === 'grid' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100/50'}`}
                                        >
                                            <Grid className="h-5 w-5" />
                                        </button>
                                        <button 
                                            onClick={() => setViewMode('list')} 
                                            className={`p-3 transition-all duration-200 ${viewMode === 'list' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100/50'}`}
                                        >
                                            <List className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ NEW: Enhanced Filter and Sort Controls */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {getText('Filter by Status', 'Filter berdasarkan Status')}
                                    </label>
                                    <select 
                                        value={filterStatus} 
                                        onChange={(e) => setFilterStatus(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                                    >
                                        <option value="all">{getText('All Status', 'Semua Status')}</option>
                                        <option value="Available">{getText('Available', 'Tersedia')}</option>
                                        <option value="Scheduled">{getText('Scheduled', 'Terjadwal')}</option>
                                        <option value="In Use">{getText('In Use', 'Sedang Digunakan')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {getText('Sort by', 'Urutkan berdasarkan')}
                                    </label>
                                    <div className="flex space-x-2">
                                        <select 
                                            value={sortBy} 
                                            onChange={(e) => handleSortChange(e.target.value as any)}
                                            className="flex-1 px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                                        >
                                            <option value="name">{getText('Name', 'Nama')}</option>
                                            <option value="capacity">{getText('Capacity', 'Kapasitas')}</option>
                                            <option value="status">{getText('Status', 'Status')}</option>
                                        </select>
                                        <button
                                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                            className="px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg hover:bg-gray-100/50 transition-colors"
                                            title={getText(`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`, `Urutkan ${sortOrder === 'asc' ? 'Menurun' : 'Menaik'}`)}
                                        >
                                            <ArrowUpDown className={`h-4 w-4 text-gray-600 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center">
                                <div className="flex items-center space-x-3">
                                    <input 
                                        id="show-in-use" 
                                        type="checkbox" 
                                        checked={showInUse} 
                                        onChange={(e) => setShowInUse(e.target.checked)} 
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200" 
                                    />
                                    <label htmlFor="show-in-use" className="text-sm font-medium text-gray-700">
                                        {getText('Show rooms currently in use', 'Tampilkan ruangan yang sedang digunakan')}
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* ✅ IMPROVED: Enhanced Rooms Display */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {getText('Available Rooms', 'Ruangan Tersedia')}
                                </h2>
                                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                    {filteredAndSortedRooms.length} {getText('rooms', 'ruangan')}
                                </div>
                            </div>
                            
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto pr-2">
                                    {filteredAndSortedRooms.map((room) => (
                                        <div 
                                            key={room.id} 
                                            onClick={() => { 
                                                setSelectedRoom(room); 
                                                form.setValue('room_id', room.id); 
                                            }} 
                                            className={`group relative p-6 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
                                                selectedRoom?.id === room.id 
                                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' 
                                                    : 'bg-white/80 hover:bg-white border border-gray-200/50'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className={`font-bold text-lg ${selectedRoom?.id === room.id ? 'text-white' : 'text-gray-800'}`}>
                                                        {room.name}
                                                    </h3>
                                                    <p className={`text-sm ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                                        {room.code}
                                                    </p>
                                                </div>
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 ${
                                                    selectedRoom?.id === room.id 
                                                        ? 'bg-white/20 text-white' 
                                                        : getStatusColor(room.status)
                                                }`}>
                                                    {getStatusText(room.status)}
                                                </span>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                <div className="flex items-center space-x-2">
                                                    <Users className={`h-4 w-4 ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-400'}`} />
                                                    <span className={`text-sm ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-600'}`}>
                                                        {room.capacity} {getText('seats', 'kursi')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <MapPin className={`h-4 w-4 ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-400'}`} />
                                                    <span className={`text-sm ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-600'}`}>
                                                        {room.department?.name || getText('General', 'Umum')}
                                                    </span>
                                                </div>

                                                {/* ✅ NEW: Enhanced Status Details */}
                                                {room.status === 'In Use' && room.currentBooking && (
                                                    <div className={`text-xs ${selectedRoom?.id === room.id ? 'text-orange-200' : 'text-orange-600'}`}>
                                                        <p className="font-medium">
                                                            🔄 {getText('Late booking available', 'Bisa dipinjam terlambat')}
                                                        </p>
                                                        <p className="mt-1">
                                                            {getText('Current:', 'Saat ini:')} {room.currentBooking.user?.full_name}
                                                        </p>
                                                    </div>
                                                )}

                                                {room.status === 'Scheduled' && room.scheduleDetails && (
                                                    <div className={`text-xs ${selectedRoom?.id === room.id ? 'text-yellow-200' : 'text-yellow-600'}`}>
                                                        <p className="font-medium">
                                                            📅 {getText('Has scheduled events today', 'Ada jadwal hari ini')}
                                                        </p>
                                                        <div className="mt-1 space-y-1">
                                                            {room.scheduleDetails.lectures.length > 0 && (
                                                                <p>📚 {room.scheduleDetails.lectures.length} {getText('lectures', 'kuliah')}</p>
                                                            )}
                                                            {room.scheduleDetails.exams.length > 0 && (
                                                                <p>📝 {room.scheduleDetails.exams.length} {getText('exams', 'ujian')}</p>
                                                            )}
                                                            {room.scheduleDetails.sessions.length > 0 && (
                                                                <p>🎓 {room.scheduleDetails.sessions.length} {getText('sessions', 'sidang')}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {(room.status === 'Scheduled' || room.status === 'In Use') && (
                                                <button 
                                                    title={getText("View Schedule", "Lihat Jadwal")} 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setViewingSchedulesFor(room); 
                                                    }} 
                                                    className={`absolute bottom-4 right-4 p-2 rounded-full transition-all duration-200 ${
                                                        selectedRoom?.id === room.id 
                                                            ? 'bg-white/20 text-white hover:bg-white/30' 
                                                            : 'bg-gray-100 text-gray-400 hover:bg-blue-500 hover:text-white'
                                                    } opacity-0 group-hover:opacity-100`}
                                                >
                                                    <Eye className="h-4 w-4"/>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredAndSortedRooms.map((room) => (
                                        <div 
                                            key={room.id} 
                                            onClick={() => { 
                                                setSelectedRoom(room); 
                                                form.setValue('room_id', room.id); 
                                            }} 
                                            className={`group p-5 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg flex items-center justify-between ${
                                                selectedRoom?.id === room.id 
                                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' 
                                                    : 'bg-white/80 hover:bg-white border border-gray-200/50'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-4">
                                                <div>
                                                    <h3 className={`font-bold ${selectedRoom?.id === room.id ? 'text-white' : 'text-gray-800'}`}>
                                                        {room.name}
                                                    </h3>
                                                    <p className={`text-sm ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                                        {room.code} • {room.department?.name || getText('General', 'Umum')}
                                                    </p>
                                                    {/* ✅ NEW: Status details in list view */}
                                                    {room.status === 'In Use' && room.currentBooking && (
                                                        <p className={`text-xs mt-1 ${selectedRoom?.id === room.id ? 'text-orange-200' : 'text-orange-600'}`}>
                                                            🔄 {getText('Current user:', 'Pengguna saat ini:')} {room.currentBooking.user?.full_name}
                                                        </p>
                                                    )}
                                                    {room.status === 'Scheduled' && room.scheduleDetails && (
                                                        <p className={`text-xs mt-1 ${selectedRoom?.id === room.id ? 'text-yellow-200' : 'text-yellow-600'}`}>
                                                            📅 {room.scheduleDetails.lectures.length + room.scheduleDetails.exams.length + room.scheduleDetails.sessions.length} {getText('events today', 'jadwal hari ini')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <div className="flex items-center space-x-2">
                                                    <Users className={`h-4 w-4 ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-400'}`} />
                                                    <span className={`text-sm ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-600'}`}>
                                                        {room.capacity} {getText('seats', 'kursi')}
                                                    </span>
                                                </div>
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                                    selectedRoom?.id === room.id 
                                                        ? 'bg-white/20 text-white' 
                                                        : getStatusColor(room.status)
                                                }`}>
                                                    {getStatusText(room.status)}
                                                </span>
                                                {(room.status === 'Scheduled' || room.status === 'In Use') && (
                                                    <button 
                                                        title={getText("View Schedule", "Lihat Jadwal")} 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setViewingSchedulesFor(room); 
                                                        }} 
                                                        className={`p-2 rounded-full transition-all duration-200 ${
                                                            selectedRoom?.id === room.id 
                                                                ? 'bg-white/20 text-white hover:bg-white/30' 
                                                                : 'bg-gray-100 text-gray-400 hover:bg-blue-500 hover:text-white'
                                                        }`}
                                                    >
                                                        <Eye className="h-4 w-4"/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {filteredAndSortedRooms.length === 0 && !loading && (
                                <div className="text-center py-12">
                                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                        <Building className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                        {getText('No Rooms Available', 'Tidak Ada Ruangan Tersedia')}
                                    </h3>
                                    <p className="text-gray-500">
                                        {getText('Try adjusting your search or filters.', 'Coba sesuaikan pencarian atau filter Anda.')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Enhanced Schedule Modal */}
            {viewingSchedulesFor && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-white/20">
                        <div className="p-6 border-b border-gray-200/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    {getText("Today's Schedule", "Jadwal Hari Ini")}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">{viewingSchedulesFor.name}</p>
                            </div>
                            <button 
                                onClick={() => setViewingSchedulesFor(null)} 
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all duration-200"
                            >
                                <X className="h-5 w-5"/>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {loadingSchedules ? (
                                <div className="flex justify-center items-center h-24">
                                    <Loader2 className="animate-spin h-6 w-6 text-gray-500"/>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Active Bookings */}
                                    {schedulesForModal.bookings.length > 0 && (
                                        <div>
                                            <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                                                <Calendar className="h-5 w-5 mr-2 text-orange-600" />
                                                {getText('Active Bookings', 'Pemesanan Aktif')}
                                            </h4>
                                            <div className="space-y-3">
                                                {schedulesForModal.bookings.map(booking => (
                                                    <div key={booking.id} className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200/50">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="font-bold text-orange-800">{booking.purpose}</p>
                                                            <span className="text-sm font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                                                                {booking.start_time} - {booking.end_time}
                                                            </span>
                                                        </div>
                                                        {booking.user && (
                                                            <div className="text-sm text-orange-700">
                                                                <p>{booking.user.full_name} • {booking.user.identity_number}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Lecture Schedules */}
                                    {schedulesForModal.lectures.length > 0 && (
                                        <div>
                                            <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                                                <BookOpen className="h-5 w-5 mr-2 text-blue-600" />
                                                {getText('Lecture Schedules', 'Jadwal Kuliah')}
                                            </h4>
                                            <div className="space-y-3">
                                                {schedulesForModal.lectures.map(lecture => (
                                                    <div key={lecture.id} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="font-bold text-blue-800">{lecture.course_name}</p>
                                                            <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                                                                {lecture.start_time} - {lecture.end_time}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-blue-700">
                                                            <p>{getText('Class:', 'Kelas:')} {lecture.class} • {lecture.subject_study}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Exam Schedules */}
                                    {schedulesForModal.exams.length > 0 && (
                                        <div>
                                            <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                                                <GraduationCap className="h-5 w-5 mr-2 text-green-600" />
                                                {getText('Exam Schedules', 'Jadwal Ujian')}
                                            </h4>
                                            <div className="space-y-3">
                                                {schedulesForModal.exams.map(exam => (
                                                    <div key={exam.id} className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200/50">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="font-bold text-green-800">{exam.course_name}</p>
                                                            <span className="text-sm font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                                                {exam.start_time} - {exam.end_time}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-green-700">
                                                            <p>{exam.course_code} • {getText('Class:', 'Kelas:')} {exam.class}</p>
                                                            <p>{exam.student_amount} {getText('students', 'mahasiswa')} • {getText('Semester', 'Semester')} {exam.semester}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* No Schedules */}
                                    {schedulesForModal.bookings.length === 0 && 
                                     schedulesForModal.lectures.length === 0 && 
                                     schedulesForModal.exams.length === 0 && (
                                        <div className="text-center py-12">
                                            <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                                <Calendar className="h-8 w-8 text-gray-400" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                                {getText('No Schedule Today', 'Tidak Ada Jadwal Hari Ini')}
                                            </h3>
                                            <p className="text-gray-500">
                                                {getText('This room is available for booking today.', 'Ruangan ini tersedia untuk dipesan hari ini.')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    ); 
};

export default BookRoom;