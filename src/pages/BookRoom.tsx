import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Building, Plus, Search, Edit, Trash2, Eye, Users, User, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Zap, Tv2, Speaker, Presentation, Mic, AirVent, Loader2, Hash, DoorClosed, Calendar, Phone, Send, ChevronDown
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

interface PreloadedData {
    lectureSchedules: LectureSchedule[];
    exams: any[];
    approvedBookings: any[];
    lastUpdated: Date;
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
}

interface BookingConflict {
    id: string;
    start_time: string;
    end_time: string;
    purpose: string;
    user?: any;
}

interface ScheduleConflict {
    id: string;
    start_time: string;
    end_time: string;
    course_name: string;
    class?: string;
    subject_study?: string;
    type: 'lecture' | 'exam';
}

const BookRoom: React.FC = () => {
    const { profile } = useAuth();
    const { getText, formatTime, formatDate } = useLanguage();
    const [allRooms, setAllRooms] = useState<Room[]>([]);
    const [filteredRooms, setFilteredRooms] = useState<RoomWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [viewingSchedulesFor, setViewingSchedulesFor] = useState<RoomWithStatus | null>(null);
    const [schedulesForModal, setSchedulesForModal] = useState<ScheduleConflict[]>([]);
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
    const [calculatingRoomStatus, setCalculatingRoomStatus] = useState(false);
    const [preloadedData, setPreloadedData] = useState<PreloadedData | null>(null);
    const [dataLoading, setDataLoading] = useState(true);

    const form = useForm<BookingForm>({
        resolver: zodResolver(bookingSchema),
        defaultValues: { class_type: 'theory', sks: 2, equipment_requested: [] },
    });

    const watchSks = form.watch('sks');
    const watchClassType = form.watch('class_type');
    const watchIdentityNumber = form.watch('identity_number');
    const watchStudyProgramId = form.watch('study_program_id');
    const watchStartTime = form.watch('start_time');
    const watchEndTime = form.watch('end_time');

    const normalizeRoomName = (name: string): string => name ? name.toLowerCase().replace(/[\s.&-]/g, '') : '';

    // Calculate end time helper
    const calculateEndTime = (startTime: string, sks: number, classType: string) => {
        if (!startTime || !sks) return null;
        const duration = classType === 'theory' ? sks * 50 : sks * 170;
        const startDate = new Date(startTime);
        const endDate = addMinutes(startDate, duration);
        return endDate;
    };

    // Get effective end time (manual or calculated)
    const getEffectiveEndTime = useCallback(() => {
        if (useManualEndTime && watchEndTime) {
            return new Date(watchEndTime);
        } else if (watchStartTime && watchSks > 0 && watchClassType) {
            return calculateEndTime(watchStartTime, watchSks, watchClassType);
        }
        return null;
    }, [useManualEndTime, watchEndTime, watchStartTime, watchSks, watchClassType]);

    // Check booking conflicts
    const checkBookingConflicts = async (roomId: string, startTime: Date, endTime: Date): Promise<BookingConflict[]> => {
    try {
        console.log(`🔍 Checking booking conflicts for room ${roomId}`);
        console.log(`⏰ Time range: ${startTime.toISOString()} - ${endTime.toISOString()}`);

        const { data, error } = await supabase
            .from('bookings')
            .select(`
                id, start_time, end_time, purpose,
                user:users(full_name, identity_number)
            `)
            .eq('room_id', roomId)
            .eq('status', 'approved')
            .lt('start_time', endTime.toISOString())
            .gt('end_time', startTime.toISOString());

        if (error) {
            console.error('Booking conflicts error:', error);
            throw error;
        }

        console.log(`✅ Found ${data?.length || 0} booking conflicts`);
        return data || [];
        
    } catch (error) {
        console.error('Error checking booking conflicts:', error);
        return [];
    }
};

    // Check schedule conflicts (lectures and exams)
    const checkScheduleConflicts = (roomName: string, roomId: string, startTime: Date, endTime: Date): ScheduleConflict[] => {
    if (!preloadedData) return [];
    
    const conflicts: ScheduleConflict[] = [];
    const dayName = format(startTime, 'EEEE', { locale: localeID });
    const dateString = format(startTime, 'yyyy-MM-dd');
    const searchStartTime = format(startTime, 'HH:mm');
    const searchEndTime = format(endTime, 'HH:mm');

    // Check lecture schedules (in-memory filtering)
    const relevantLectures = preloadedData.lectureSchedules.filter(lecture => 
        lecture.day === dayName && 
        lecture.room && 
        normalizeRoomName(lecture.room) === normalizeRoomName(roomName)
    );

    relevantLectures.forEach(lecture => {
        if (lecture.start_time && lecture.end_time) {
            const lectureStart = lecture.start_time.substring(0, 5);
            const lectureEnd = lecture.end_time.substring(0, 5);
            
            if (lectureStart < searchEndTime && lectureEnd > searchStartTime) {
                conflicts.push({
                    id: lecture.id,
                    start_time: lectureStart,
                    end_time: lectureEnd,
                    course_name: lecture.course_name || 'Lecture',
                    class: lecture.class,
                    subject_study: lecture.subject_study,
                    type: 'lecture'
                });
            }
        }
    });

    // Check exam schedules (in-memory filtering)
    const relevantExams = preloadedData.exams.filter(exam => 
        exam.room_id === roomId && 
        exam.date === dateString && 
        !exam.is_take_home
    );

    relevantExams.forEach(exam => {
        if (exam.start_time && exam.end_time) {
            const examStart = exam.start_time.substring(0, 5);
            const examEnd = exam.end_time.substring(0, 5);
            
            if (examStart < searchEndTime && examEnd > searchStartTime) {
                conflicts.push({
                    id: exam.id,
                    start_time: examStart,
                    end_time: examEnd,
                    course_name: exam.course_name || 'UAS Exam',
                    class: exam.class,
                    subject_study: `Semester ${exam.semester}`,
                    type: 'exam'
                });
            }
        }
    });

    return conflicts;
};

    // Calculate room status for specific time
    const calculateRoomStatus = async (room: Room, startTime: Date, endTime: Date): Promise<RoomWithStatus> => {
        // Stage 1: Check if room is available in database
        if (!room.is_available) {
            return {
                ...room,
                department: room.department,
                status: 'In Use' // This room won't be shown anyway
            };
        }

        // Stage 2: Check active bookings
        const bookingConflicts = await checkBookingConflicts(room.id, startTime, endTime);
        if (bookingConflicts.length > 0) {
            return {
                ...room,
                department: room.department,
                status: 'In Use'
            };
        }

        // Stage 3: Check scheduled activities (lectures and exams)
        const scheduleConflicts = await checkScheduleConflicts(room.name, room.id, startTime, endTime);
        if (scheduleConflicts.length > 0) {
            return {
                ...room,
                department: room.department,
                status: 'Scheduled'
            };
        }

        // Stage 4: Available
        return {
            ...room,
            department: room.department,
            status: 'Available'
        };
    };

    // Filter and calculate room statuses based on booking details
    const filterRoomsWithStatus = useCallback(async () => {
        if (!watchStartTime || !watchSks || !watchClassType) {
            setFilteredRooms([]);
            return;
        }

        setCalculatingRoomStatus(true);
        try {
            const startTime = new Date(watchStartTime);
            const endTime = getEffectiveEndTime();
            
            if (!endTime) {
                setFilteredRooms([]);
                return;
            }

            const roomsWithStatus: RoomWithStatus[] = [];

            for (const room of allRooms) {
                // Only process rooms that are available in database
                if (room.is_available) {
                    const roomWithStatus = await calculateRoomStatus(room, startTime, endTime);
                    roomsWithStatus.push(roomWithStatus);
                }
                // Skip rooms where is_available = false (don't show them at all)
            }

            setFilteredRooms(roomsWithStatus);
        } catch (error) {
            console.error('Error filtering rooms with status:', error);
            alert.error(getText('Failed to calculate room availability.', 'Gagal menghitung ketersediaan ruangan.'));
        } finally {
            setCalculatingRoomStatus(false);
        }
    }, [allRooms, watchStartTime, watchSks, watchClassType, getEffectiveEndTime, getText]);

    // Fetch schedules for modal (when clicking on Scheduled room)
    const fetchSchedulesForRoom = async (roomName: string, roomId: string) => {
        if (!watchStartTime) return;
        
        setLoadingSchedules(true);
        try {
            const startTime = new Date(watchStartTime);
            const endTime = getEffectiveEndTime();
            
            if (!endTime) return;

            const conflicts = await checkScheduleConflicts(roomName, roomId, startTime, endTime);
            setSchedulesForModal(conflicts);
        } catch (error) {
            alert.error(getText("Failed to load schedule for this room.", "Gagal memuat jadwal untuk ruangan ini."));
            setSchedulesForModal([]);
        } finally {
            setLoadingSchedules(false);
        }
    };

    // Fetch initial data
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchRooms(),
                    fetchStudyPrograms(),
                    fetchEquipment(),
                    fetchExistingUsers()
                ]);
            } catch (error) {
                console.error('Error fetching initial data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
        
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Trigger room filtering when booking details change
    useEffect(() => {
        filterRoomsWithStatus();
    }, [filterRoomsWithStatus]);

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

    // Auto-fill user data when identity number is entered
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

    // Update study program search term when selection changes
    useEffect(() => {
        if (watchStudyProgramId) {
            const selectedProgram = studyPrograms.find(sp => sp.id === watchStudyProgramId);
            if (selectedProgram) setStudyProgramSearchTerm(`${selectedProgram.name} (${selectedProgram.code}) - ${selectedProgram.department?.name}`);
        }
    }, [watchStudyProgramId, studyPrograms]);

    // Update equipment when room is selected
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

    // Fetch schedules when viewing scheduled room
    useEffect(() => {
        if (viewingSchedulesFor) {
            fetchSchedulesForRoom(viewingSchedulesFor.name, viewingSchedulesFor.id);
        }
    }, [viewingSchedulesFor]);

    const fetchRooms = async () => {
        try {
            const { data, error } = await supabase.from('rooms').select(`*, department:departments(*)`).order('name');
            if (error) throw error;
            setAllRooms(data || []);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            alert.error(getText('Failed to load rooms.', 'Gagal memuat ruangan.'));
        }
    };

    const fetchStudyPrograms = async () => {
        try {
            const { data, error } = await supabase.from('study_programs').select(`*, department:departments(*)`);
            if (error) throw error;
            setStudyPrograms(data || []);
        } catch (error) {
            console.error('Error fetching study programs:', error);
            alert.error(getText('Failed to load study programs.', 'Gagal memuat program studi.'));
        }
    };

    const fetchEquipment = async () => {
        try {
            const { data, error } = await supabase.from('equipment').select('*').eq('is_available', true);
            if (error) throw error;
            setMasterEquipmentList(data || []);
        } catch (error) {
            console.error('Error fetching equipment:', error);
            alert.error(getText('Failed to load equipment.', 'Gagal memuat peralatan.'));
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

    const handleBookingSuccess = (data: BookingForm, selectedRoom: RoomWithStatus) => {
        const roomName = selectedRoom.name;
        const startTime = format(new Date(data.start_time), 'MMM d, yyyy HH:mm');
        const equipmentCount = checkedEquipment.size;
        
        alert.success(
            getText(
                `✅ Booking submitted successfully!\n🏢 Room: ${roomName}\n⏰ Time: ${startTime}${equipmentCount > 0 ? `\n⚡ Equipment: ${equipmentCount} items` : ''}\n📝 Status: Pending approval`,
                `✅ Pemesanan berhasil dikirim!\n🏢 Ruangan: ${roomName}\n⏰ Waktu: ${startTime}${equipmentCount > 0 ? `\n⚡ Peralatan: ${equipmentCount} item` : ''}\n📝 Status: Menunggu persetujuan`
            )
        );

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

    const onSubmit = async (data: BookingForm) => {
        if (!selectedRoom) {
            alert.error(getText('Please select a room', 'Silakan pilih ruangan'));
            return;
        }

        setSubmitting(true);
        try {
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

            // DON'T UPDATE rooms.is_available - this was the key instruction!
            
            handleBookingSuccess(data, selectedRoom);
            
            form.reset({ class_type: 'theory', sks: 2, equipment_requested: [] });
            setSelectedRoom(null);
            setIdentitySearchTerm('');
            setStudyProgramSearchTerm('');
            setUseManualEndTime(false);
            setCheckedEquipment(new Set());
            
            // Re-filter rooms to update status
            filterRoomsWithStatus();
            
        } catch (error: any) {
            console.error('Error creating booking:', error);
            alert.error(error.message || getText('Failed to create booking', 'Gagal membuat pemesanan'));
        } finally {
            setSubmitting(false);
        }
    };

    const filteredIdentityNumbers = existingUsers.filter(user => 
        user.identity_number.toLowerCase().includes(identitySearchTerm.toLowerCase()) || 
        user.full_name.toLowerCase().includes(identitySearchTerm.toLowerCase())
    );

    const searchFilteredRooms = useMemo(() => {
        return filteredRooms.filter(room => {
            const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                room.code.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [filteredRooms, searchTerm]);

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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Booking Details & Room Selection */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* Step 1: Booking Details */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                            <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50 mb-6">
                                <Calendar className="h-5 w-5 text-blue-500" />
                                <h3 className="text-lg font-semibold text-gray-800">
                                    {getText('1. Booking Details', '1. Detail Pemesanan')}
                                </h3>
                            </div>
                            
                            <div className="space-y-4">
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
                            </div>
                        </div>

                        {/* Step 2: Room Selection */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-3">
                                    <Building className="h-5 w-5 text-blue-500" />
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        {getText('2. Select Room', '2. Pilih Ruangan')}
                                    </h3>
                                </div>
                                {(watchStartTime && watchSks > 0 && watchClassType) && (
                                    <div className="flex items-center space-x-3">
                                        {calculatingRoomStatus && (
                                            <div className="flex items-center space-x-2 text-blue-600">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="text-sm">Calculating...</span>
                                            </div>
                                        )}
                                        <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                            {searchFilteredRooms.length} {getText('available', 'tersedia')}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Search and View Controls */}
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
                                <div className="flex-1 relative w-full sm:w-auto">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={getText("Search rooms by name or code...", "Cari ruangan berdasarkan nama atau kode...")}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                                    />
                                </div>
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

                            {/* Room Availability Status */}
                            {!(watchStartTime && watchSks > 0 && watchClassType) ? (
                                <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50">
                                    <Calendar className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                        {getText('Complete Booking Details First', 'Lengkapi Detail Pemesanan Dulu')}
                                    </h3>
                                    <p className="text-gray-600">
                                        {getText('Please fill in start time, SKS, and class type to see available rooms', 'Harap isi waktu mulai, SKS, dan tipe kelas untuk melihat ruangan yang tersedia')}
                                    </p>
                                </div>
                            ) : searchFilteredRooms.length === 0 && !calculatingRoomStatus ? (
                                <div className="text-center py-12">
                                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                        <Building className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                        {getText('No Rooms Available', 'Tidak Ada Ruangan Tersedia')}
                                    </h3>
                                    <p className="text-gray-500">
                                        {getText('All rooms are busy during your selected time. Please try a different time.', 'Semua ruangan sedang sibuk pada waktu yang dipilih. Silakan coba waktu lain.')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Rooms Grid/List */}
                                    {viewMode === 'grid' ? (
                                        <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto pr-2">
                                            {searchFilteredRooms.map((room) => (
                                                <div
                                                    key={room.id}
                                                    onClick={() => {
                                                        setSelectedRoom(room);
                                                        form.setValue('room_id', room.id);
                                                    }}
                                                    className={`group relative p-6 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${selectedRoom?.id === room.id
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
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 ${selectedRoom?.id === room.id
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
                                                    </div>

                                                    {room.status === 'Scheduled' && (
                                                        <button
                                                            title={getText("View Schedule", "Lihat Jadwal")}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewingSchedulesFor(room);
                                                            }}
                                                            className={`absolute bottom-4 right-4 p-2 rounded-full transition-all duration-200 ${selectedRoom?.id === room.id
                                                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                                                    : 'bg-gray-100 text-gray-400 hover:bg-blue-500 hover:text-white'
                                                                } opacity-0 group-hover:opacity-100`}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                            {searchFilteredRooms.map((room) => (
                                                <div
                                                    key={room.id}
                                                    onClick={() => {
                                                        setSelectedRoom(room);
                                                        form.setValue('room_id', room.id);
                                                    }}
                                                    className={`group p-5 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg flex items-center justify-between ${selectedRoom?.id === room.id
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
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-4">
                                                        <div className="flex items-center space-x-2">
                                                            <Users className={`h-4 w-4 ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-400'}`} />
                                                            <span className={`text-sm ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-600'}`}>
                                                                {room.capacity} {getText('seats', 'kursi')}
                                                            </span>
                                                        </div>
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${selectedRoom?.id === room.id
                                                                ? 'bg-white/20 text-white'
                                                                : getStatusColor(room.status)
                                                            }`}>
                                                            {getStatusText(room.status)}
                                                        </span>
                                                        {room.status === 'Scheduled' && (
                                                            <button
                                                                title={getText("View Schedule", "Lihat Jadwal")}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setViewingSchedulesFor(room);
                                                                }}
                                                                className={`p-2 rounded-full transition-all duration-200 ${selectedRoom?.id === room.id
                                                                        ? 'bg-white/20 text-white hover:bg-white/30'
                                                                        : 'bg-gray-100 text-gray-400 hover:bg-blue-500 hover:text-white'
                                                                    }`}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Personal Information & Equipment (Only show if room selected) */}
                    <div className="lg:col-span-7">
                        {!selectedRoom ? (
                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-8 text-center">
                                <div className="p-4 bg-blue-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                                    <Building className="h-10 w-10 text-blue-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800 mb-4">
                                    {getText('Select a Room First', 'Pilih Ruangan Terlebih Dahulu')}
                                </h3>
                                <p className="text-gray-600 text-lg">
                                    {getText('Please complete booking details and select a room to continue with your booking.', 'Harap lengkapi detail pemesanan dan pilih ruangan untuk melanjutkan pemesanan Anda.')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Step 3: Personal Information (Only for non-logged in users) */}
                                {!profile && (
                                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                                        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50 mb-6">
                                            <User className="h-5 w-5 text-blue-500" />
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {getText('3. Personal Information', '3. Informasi Pribadi')}
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
                                                    {showIdentityDropdown && (
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

                                {/* Equipment Section */}
                                {selectedRoom && availableEquipment.length > 0 && (
                                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                                        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50 mb-6">
                                            <Zap className="h-5 w-5 text-blue-500" />
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {getText(`${profile ? '3' : '4'}. Request Equipment`, `${profile ? '3' : '4'}. Permintaan Peralatan`)}
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

                                {/* Notes Section */}
                                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                                    <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50 mb-6">
                                        <Edit className="h-5 w-5 text-blue-500" />
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {getText(`${profile ? (availableEquipment.length > 0 ? '4' : '3') : (availableEquipment.length > 0 ? '5' : '4')}. Additional Notes`, `${profile ? (availableEquipment.length > 0 ? '4' : '3') : (availableEquipment.length > 0 ? '5' : '4')}. Catatan Tambahan`)}
                                        </h3>
                                    </div>
                                    <textarea
                                        {...form.register('notes')}
                                        rows={4}
                                        placeholder={getText('Any additional notes for your booking...', 'Catatan tambahan untuk pemesanan Anda...')}
                                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 resize-none"
                                    />
                                </div>

                                {/* Submit Section */}
                                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                                            <Send className="h-5 w-5 text-white" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {getText('Confirm Booking', 'Konfirmasi Pemesanan')}
                                        </h3>
                                    </div>

                                    {/* Booking Summary */}
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl p-4 mb-6">
                                        <h4 className="font-semibold text-gray-800 mb-3">
                                            {getText('Booking Summary', 'Ringkasan Pemesanan')}
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">{getText('Room:', 'Ruangan:')}</span>
                                                <span className="font-medium text-gray-800">{selectedRoom.name} ({selectedRoom.code})</span>
                                            </div>
                                            {watchStartTime && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">{getText('Time:', 'Waktu:')}</span>
                                                    <span className="font-medium text-gray-800">
                                                        {format(new Date(watchStartTime), 'MMM d, yyyy HH:mm')}
                                                        {getEffectiveEndTime() && ` - ${format(getEffectiveEndTime()!, 'HH:mm')}`}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">{getText('Duration:', 'Durasi:')}</span>
                                                <span className="font-medium text-gray-800">
                                                    {watchClassType === 'theory' ? watchSks * 50 : watchSks * 170} {getText('minutes', 'menit')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">{getText('Class Type:', 'Tipe Kelas:')}</span>
                                                <span className="font-medium text-gray-800">
                                                    {watchClassType === 'theory' ? getText('Theory', 'Teori') : getText('Practical', 'Praktik')}
                                                </span>
                                            </div>
                                            {checkedEquipment.size > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">{getText('Equipment:', 'Peralatan:')}</span>
                                                    <span className="font-medium text-gray-800">
                                                        {checkedEquipment.size} {getText('items', 'item')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <form onSubmit={form.handleSubmit(onSubmit)}>
                                        <button
                                            type="submit"
                                            disabled={submitting}
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
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Schedule Modal */}
            {viewingSchedulesFor && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col border border-white/20">
                        <div className="p-6 border-b border-gray-200/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    {getText("Schedule Conflicts", "Konflik Jadwal")}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">{viewingSchedulesFor.name}</p>
                                {watchStartTime && getEffectiveEndTime() && (
                                    <p className="text-xs text-blue-600 mt-1">
                                        {format(new Date(watchStartTime), 'MMM d, yyyy HH:mm')} - {format(getEffectiveEndTime()!, 'HH:mm')}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setViewingSchedulesFor(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all duration-200"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {loadingSchedules ? (
                                <div className="flex justify-center items-center h-24">
                                    <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
                                </div>
                            ) : schedulesForModal.length > 0 ? (
                                <div className="space-y-4">
                                    {schedulesForModal.map(schedule => (
                                        <div key={schedule.id} className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200/50">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <div className={`p-2 rounded-lg ${schedule.type === 'lecture' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                                    {schedule.type === 'lecture' ? <Building className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{schedule.course_name}</p>
                                                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                                                        <Clock className="h-4 w-4" />
                                                        <span>{schedule.start_time} - {schedule.end_time}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {schedule.class && (
                                                <p className="text-sm text-gray-600">
                                                    {getText('Class:', 'Kelas:')} {schedule.class}
                                                </p>
                                            )}
                                            {schedule.subject_study && (
                                                <p className="text-xs text-gray-500">
                                                    {schedule.subject_study}
                                                </p>
                                            )}
                                            <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${schedule.type === 'lecture' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                {schedule.type === 'lecture' ? getText('LECTURE', 'KULIAH') : getText('EXAM', 'UJIAN')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="p-3 bg-gray-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                                        <Calendar className="h-6 w-6 text-gray-400" />
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {getText('No conflicting schedules found.', 'Tidak ada jadwal yang konflik.')}
                                    </p>
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