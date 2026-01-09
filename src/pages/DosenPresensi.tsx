import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Camera, User, Clock, BookOpen, Users, CheckCircle, AlertCircle, ChevronDown, Loader2, ExternalLink, PartyPopper, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface Lecturer {
    id: string;
    full_name: string;
    identity_number: string;
    attachments?: string | null;
    study_program?: { id: string; name: string } | null;
}

// Extended schedule interface with full details for denormalization
interface ScheduleItem {
    id: string;
    type: 'lecture' | 'session';
    // Lecture details
    course_name?: string;
    course_code?: string;
    study_program_name?: string;
    class_group?: string; // Rombel
    semester?: string;
    // Session details
    student_name?: string;
    student_nim?: string;
    session_type?: string;
    role_in_session?: string; // supervisor/examiner/secretary
    session_schedule_id?: string;
    // Common
    room_name?: string;
    start_time?: string;
    end_time?: string;
    scheduled_date?: string;
}

interface SubmitSuccessData {
    lecturerName: string;
    scheduleInfo: string;
    purpose: string;
    time: string;
    photo: string;
    scheduleCount: number;
}

// Searchable Dropdown Component
const SearchableDropdown: React.FC<{
    options: Lecturer[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
}> = ({ options, value, onChange, placeholder, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(() => {
        return options.find(option => option.id === value);
    }, [options, value]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return options;
        const search = searchTerm.toLowerCase().trim();
        return options.filter(option =>
            option.full_name.toLowerCase().includes(search) ||
            option.identity_number?.toLowerCase().includes(search)
        );
    }, [options, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionId: string) => {
        onChange(optionId);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between transition-all duration-200 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-blue-300'}`}
            >
                <div className="flex items-center space-x-3">
                    {selectedOption?.attachments ? (
                        <img src={selectedOption.attachments} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                        </div>
                    )}
                    <span className={selectedOption ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                        {selectedOption ? selectedOption.full_name : placeholder}
                    </span>
                </div>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden">
                    <div className="p-3 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari nama dosen..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-6 text-center text-gray-500">
                                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Tidak ditemukan dosen dengan nama tersebut</p>
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelect(option.id)}
                                    className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center space-x-3 ${option.id === value ? 'bg-blue-50' : ''}`}
                                >
                                    {option.attachments ? (
                                        <img src={option.attachments} alt="" className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                            <User className="w-5 h-5 text-gray-400" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900">{option.full_name}</p>
                                        <p className="text-xs text-gray-500">{option.identity_number}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const DosenPresensi: React.FC = () => {
    const [lecturers, setLecturers] = useState<Lecturer[]>([]);
    const [selectedLecturerId, setSelectedLecturerId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'presensi' | 'uny'>('presensi');

    // Attendance limit states
    const [hasAttendedToday, setHasAttendedToday] = useState(false);
    const [checkingAttendance, setCheckingAttendance] = useState(false);
    const [lastAttendanceTime, setLastAttendanceTime] = useState<string | null>(null);

    // Camera states
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Schedule detection - now supports MULTIPLE schedules
    const [availableSchedules, setAvailableSchedules] = useState<ScheduleItem[]>([]);
    const [selectedSchedules, setSelectedSchedules] = useState<ScheduleItem[]>([]);
    const [checkingSchedule, setCheckingSchedule] = useState(false);

    // Custom purpose for non-scheduled attendance
    const [customPurpose, setCustomPurpose] = useState('');

    // Success modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successData, setSuccessData] = useState<SubmitSuccessData | null>(null);

    // Fetch lecturers on mount
    useEffect(() => {
        fetchLecturers();
    }, []);

    // Initialize camera when tab is presensi
    useEffect(() => {
        if (activeTab === 'presensi') {
            initCamera();
        }
        return () => {
            stopCamera();
        };
    }, [activeTab]);

    // Check if lecturer already attended today
    useEffect(() => {
        const checkAttendance = async () => {
            if (!selectedLecturerId) {
                setHasAttendedToday(false);
                setLastAttendanceTime(null);
                return;
            }

            setCheckingAttendance(true);
            try {
                const today = format(new Date(), 'yyyy-MM-dd');
                const { data, error } = await supabase
                    .from('lecturer_attendance')
                    .select('id, attendance_time')
                    .eq('lecturer_user_id', selectedLecturerId)
                    .eq('attendance_date', today)
                    .limit(1);

                if (error) throw error;

                if (data && data.length > 0) {
                    setHasAttendedToday(true);
                    setLastAttendanceTime(data[0].attendance_time?.substring(0, 5) || null);
                    // Clear schedules if already attended
                    setAvailableSchedules([]);
                    setSelectedSchedules([]);
                    setCustomPurpose('');
                } else {
                    setHasAttendedToday(false);
                    setLastAttendanceTime(null);
                }
            } catch (error) {
                console.error('Error checking attendance:', error);
            } finally {
                setCheckingAttendance(false);
            }
        };

        checkAttendance();
    }, [selectedLecturerId]);

    // Detect ALL schedules when lecturer is selected
    useEffect(() => {
        if (selectedLecturerId && !hasAttendedToday) {
            const lecturer = lecturers.find(l => l.id === selectedLecturerId);
            if (lecturer) {
                detectAllSchedules(lecturer.full_name);
            }
        } else {
            setAvailableSchedules([]);
            setSelectedSchedules([]);
        }
    }, [selectedLecturerId, lecturers, hasAttendedToday]);

    const fetchLecturers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, identity_number, attachments, study_program:study_programs(id, name)')
                .eq('role', 'lecturer')
                .order('full_name');

            if (error) throw error;

            // Transform data to handle Supabase's array return for single relations
            const transformedData = (data || []).map((item: any) => ({
                ...item,
                study_program: Array.isArray(item.study_program) ? item.study_program[0] || null : item.study_program
            }));
            setLecturers(transformedData);
        } catch (error) {
            console.error('Error fetching lecturers:', error);
            toast.error('Gagal memuat data dosen');
        } finally {
            setLoading(false);
        }
    };

    const initCamera = async () => {
        try {
            setCameraError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            setCameraStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error: any) {
            console.error('Camera error:', error);
            setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.');
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
    };

    const capturePhoto = (): string | null => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0);
                return canvas.toDataURL('image/jpeg', 0.8);
            }
        }
        return null;
    };

    // Detect ALL schedules for today (lectures + sessions)
    const detectAllSchedules = async (lecturerName: string) => {
        setCheckingSchedule(true);
        setAvailableSchedules([]);

        const today = new Date();
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const currentDay = dayNames[today.getDay()];
        const todayStr = format(today, 'yyyy-MM-dd');

        console.log('[detectAllSchedules] Checking for:', lecturerName, 'on day:', currentDay);

        const allSchedules: ScheduleItem[] = [];

        // 1. Fetch ALL lecture schedules for today (in separate try-catch)
        try {
            const { data: lectureData, error: lectureError } = await supabase
                .from('lecture_schedules')
                .select('id, course_name, course_code, room, start_time, end_time, class, subject_study, semester, academics_year')
                .ilike('lecturer', `%${lecturerName}%`)
                .ilike('day', currentDay);

            console.log('[detectAllSchedules] Lecture query result:', { lectureData, lectureError });

            if (lectureError) {
                console.error('Error fetching lecture schedules:', lectureError);
            } else if (lectureData && lectureData.length > 0) {
                lectureData.forEach(schedule => {
                    allSchedules.push({
                        id: `lecture-${schedule.id}`,
                        type: 'lecture',
                        course_name: schedule.course_name || 'Mata Kuliah',
                        course_code: schedule.course_code || undefined,
                        study_program_name: schedule.subject_study || undefined,
                        class_group: schedule.class || undefined,
                        semester: schedule.semester ? `Semester ${schedule.semester}` : undefined,
                        room_name: schedule.room || '-',
                        start_time: schedule.start_time || undefined,
                        end_time: schedule.end_time || undefined,
                        scheduled_date: todayStr
                    });
                });
                console.log('[detectAllSchedules] Added', lectureData.length, 'lecture schedules');
            }
        } catch (error) {
            console.error('[detectAllSchedules] Error in lecture query:', error);
        }

        // 2. Fetch ALL final sessions (sidang) for today (in separate try-catch)
        try {
            const { data: sessionData, error: sessionError } = await supabase
                .from('final_sessions')
                .select(`
                    id, 
                    student:users!final_sessions_student_id_fkey(full_name, identity_number), 
                    room:rooms!final_sessions_room_id_fkey(name), 
                    start_time, 
                    end_time, 
                    supervisor, 
                    examiner, 
                    secretary,
                    title
                `)
                .eq('date', todayStr)
                .or(`supervisor.ilike.%${lecturerName}%,examiner.ilike.%${lecturerName}%,secretary.ilike.%${lecturerName}%`);

            console.log('[detectAllSchedules] Final sessions query result:', { sessionData, sessionError });

            if (sessionError) {
                console.warn('[detectAllSchedules] Final sessions query error:', sessionError.message);
            } else if (sessionData && sessionData.length > 0) {
                sessionData.forEach((session: any) => {
                    let role = 'Dosen';
                    if (session.supervisor?.toLowerCase().includes(lecturerName.toLowerCase())) role = 'Pembimbing';
                    else if (session.examiner?.toLowerCase().includes(lecturerName.toLowerCase())) role = 'Penguji';
                    else if (session.secretary?.toLowerCase().includes(lecturerName.toLowerCase())) role = 'Sekretaris';

                    const studentData = Array.isArray(session.student) ? session.student[0] : session.student;
                    const roomData = Array.isArray(session.room) ? session.room[0] : session.room;

                    allSchedules.push({
                        id: `session-${session.id}`,
                        type: 'session',
                        session_schedule_id: session.id,
                        student_name: studentData?.full_name || 'Mahasiswa',
                        student_nim: studentData?.identity_number || undefined,
                        session_type: session.title || 'Sidang',
                        role_in_session: role,
                        room_name: roomData?.name || '-',
                        start_time: session.start_time || undefined,
                        end_time: session.end_time || undefined,
                        scheduled_date: todayStr
                    });
                });
                console.log('[detectAllSchedules] Added', sessionData.length, 'final sessions');
            }
        } catch (error) {
            console.warn('[detectAllSchedules] Session schedules query failed (table may not exist):', error);
        }

        console.log('[detectAllSchedules] Total schedules found:', allSchedules.length);
        setAvailableSchedules(allSchedules);
        setCheckingSchedule(false);
    };

    // Toggle schedule selection
    const toggleScheduleSelection = (schedule: ScheduleItem) => {
        setSelectedSchedules(prev => {
            const exists = prev.find(s => s.id === schedule.id);
            if (exists) {
                return prev.filter(s => s.id !== schedule.id);
            } else {
                return [...prev, schedule];
            }
        });
    };

    // Select all schedules
    const selectAllSchedules = () => {
        setSelectedSchedules([...availableSchedules]);
    };

    // Clear all selections
    const clearAllSelections = () => {
        setSelectedSchedules([]);
    };

    const handleSubmit = async () => {
        if (!selectedLecturerId) {
            toast.error('Silakan pilih nama dosen');
            return;
        }
        if (selectedSchedules.length === 0 && !customPurpose.trim()) {
            toast.error('Silakan pilih jadwal atau masukkan tujuan kehadiran');
            return;
        }
        if (!cameraStream) {
            toast.error('Kamera tidak tersedia');
            return;
        }

        // Capture photo automatically
        const photoData = capturePhoto();
        if (!photoData) {
            toast.error('Gagal mengambil foto, silakan coba lagi');
            return;
        }

        if (hasAttendedToday) {
            toast.error(`Anda sudah melakukan presensi hari ini pada pukul ${lastAttendanceTime}.`);
            return;
        }

        try {
            setSubmitting(true);

            // DOUBLE CHECK: Validate against database to ensure no duplicate entry exists for today
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const { data: existingCheck } = await supabase
                .from('lecturer_attendance')
                .select('id')
                .eq('lecturer_user_id', selectedLecturerId)
                .eq('attendance_date', todayStr)
                .maybeSingle();

            if (existingCheck) {
                toast.error('Gagal! Anda sudah tercatat melakukan presensi hari ini.');
                setHasAttendedToday(true);
                return;
            }

            const lecturer = lecturers.find(l => l.id === selectedLecturerId);
            if (!lecturer) throw new Error('Dosen tidak ditemukan');

            const currentTime = new Date().toISOString();

            // Determine primary purpose based on selected schedules
            let purposeValue = 'lainnya';
            let purposeDesc = customPurpose;

            if (selectedSchedules.length > 0) {
                const hasLecture = selectedSchedules.some(s => s.type === 'lecture');
                const hasSession = selectedSchedules.some(s => s.type === 'session');

                if (hasLecture && hasSession) {
                    purposeValue = 'mengajar'; // Default to mengajar if mixed
                    purposeDesc = `${selectedSchedules.length} kegiatan (Mengajar & Sidang)`;
                } else if (hasLecture) {
                    purposeValue = 'mengajar';
                    purposeDesc = selectedSchedules.length === 1
                        ? selectedSchedules[0].course_name || 'Mengajar'
                        : `${selectedSchedules.length} mata kuliah`;
                } else if (hasSession) {
                    purposeValue = 'sidang';
                    purposeDesc = selectedSchedules.length === 1
                        ? `Sidang - ${selectedSchedules[0].student_name}`
                        : `${selectedSchedules.length} sidang`;
                }
            } else if (customPurpose.toLowerCase().includes('mengajar') || customPurpose.toLowerCase().includes('kuliah')) {
                purposeValue = 'mengajar';
            } else if (customPurpose.toLowerCase().includes('sidang') || customPurpose.toLowerCase().includes('pendadaran')) {
                purposeValue = 'sidang';
            }

            // 1. Insert main attendance record
            const attendanceData = {
                lecturer_user_id: selectedLecturerId,
                lecturer_name: lecturer.full_name,
                attendance_date: todayStr,
                attendance_time: format(new Date(), 'HH:mm:ss'),
                photo_capture: photoData,
                purpose: purposeValue,
                purpose_description: purposeDesc,
                verification_status: 'pending',
                study_program_id: lecturer.study_program?.id || null
            };

            const { data: insertedAttendance, error: attendanceError } = await supabase
                .from('lecturer_attendance')
                .insert(attendanceData)
                .select('id')
                .single();

            if (attendanceError) throw attendanceError;

            // 2. Insert attendance details for each selected schedule
            if (selectedSchedules.length > 0 && insertedAttendance?.id) {
                const detailsToInsert = selectedSchedules.map(schedule => ({
                    attendance_id: insertedAttendance.id,
                    activity_type: schedule.type === 'lecture' ? 'mengajar' : 'sidang',
                    // Lecture fields (denormalized - won't be affected by lecture_schedule deletion)
                    course_name: schedule.course_name || null,
                    course_code: schedule.course_code || null,
                    study_program_name: schedule.study_program_name || null,
                    class_group: schedule.class_group || null,
                    semester: schedule.semester || null,
                    // Session fields
                    session_schedule_id: schedule.session_schedule_id || null,
                    student_name: schedule.student_name || null,
                    student_nim: schedule.student_nim || null,
                    session_type: schedule.session_type || null,
                    role_in_session: schedule.role_in_session || null,
                    // Common fields
                    scheduled_date: schedule.scheduled_date || todayStr,
                    start_time: schedule.start_time || null,
                    end_time: schedule.end_time || null,
                    room_name: schedule.room_name || null
                }));

                const { error: detailsError } = await supabase
                    .from('lecturer_attendance_details')
                    .insert(detailsToInsert);

                if (detailsError) {
                    console.error('Error inserting attendance details:', detailsError);
                    // Don't fail the whole operation, just log
                }
            }

            // Prepare success data
            let scheduleInfo = '';
            if (selectedSchedules.length > 0) {
                scheduleInfo = selectedSchedules.map(s => {
                    if (s.type === 'lecture') {
                        return `📚 ${s.course_name}${s.class_group ? ` (${s.class_group})` : ''}\n   🏫 ${s.room_name} | ⏰ ${s.start_time} - ${s.end_time}`;
                    } else {
                        return `🎓 Sidang - ${s.student_name}\n   👤 Sebagai: ${s.role_in_session} | 🏫 ${s.room_name}`;
                    }
                }).join('\n\n');
            } else {
                scheduleInfo = `📝 Tujuan: ${customPurpose}`;
            }

            setSuccessData({
                lecturerName: lecturer.full_name,
                scheduleInfo,
                purpose: purposeValue === 'mengajar' ? 'Mengajar' : purposeValue === 'sidang' ? 'Sidang' : 'Lainnya',
                time: format(new Date(), 'HH:mm'),
                photo: photoData,
                scheduleCount: selectedSchedules.length
            });
            setShowSuccessModal(true);

            // Reset form
            setSelectedLecturerId('');
            setCustomPurpose('');
            setAvailableSchedules([]);
            setSelectedSchedules([]);

        } catch (error: any) {
            console.error('Error submitting attendance:', error);
            toast.error(error.message || 'Gagal menyimpan presensi');
        } finally {
            setSubmitting(false);
        }
    };

    const closeSuccessModal = () => {
        setShowSuccessModal(false);
        setSuccessData(null);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                                <Clock className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Presensi Dosen</h1>
                                <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: localeId })}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">{format(new Date(), 'HH:mm')}</div>
                            <div className="text-xs text-gray-500">WIB</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4">
                <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100">
                    <button
                        onClick={() => setActiveTab('presensi')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'presensi' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Camera className="w-4 h-4" />
                        Presensi Transport Dosen
                    </button>
                    <button
                        onClick={() => setActiveTab('uny')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'uny' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <ExternalLink className="w-4 h-4" />
                        Presensi Wajah
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
                {activeTab === 'presensi' ? (
                    <div className="space-y-6">
                        {/* Step 1: Select Lecturer */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">1</div>
                                <h2 className="text-lg font-semibold text-gray-900">Pilih Nama Dosen</h2>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                </div>
                            ) : (
                                <SearchableDropdown
                                    options={lecturers}
                                    value={selectedLecturerId}
                                    onChange={setSelectedLecturerId}
                                    placeholder="Cari dan pilih nama dosen..."
                                />
                            )}

                            {/* Attendance Warning */}
                            {hasAttendedToday && (
                                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-fadeIn">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <Clock className="w-6 h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-amber-900">Anda sudah presensi hari ini</h3>
                                        <p className="text-sm text-amber-700">
                                            Tercatat pada pukul <span className="font-bold">{lastAttendanceTime} WIB</span>. Presensi Transport Dosen hanya dapat dilakukan 1 kali sehari.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Step 1.5: Schedule Selection (Multiple) */}
                        {selectedLecturerId && !hasAttendedToday && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                                            <BookOpen className="w-4 h-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-gray-900">Pilih Kegiatan Hari Ini</h2>
                                    </div>
                                    {selectedSchedules.length > 0 && (
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                            {selectedSchedules.length} dipilih
                                        </span>
                                    )}
                                </div>

                                {checkingSchedule ? (
                                    <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Memeriksa jadwal hari ini...
                                    </div>
                                ) : availableSchedules.length > 0 ? (
                                    <div className="space-y-3">
                                        {/* Quick actions */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <button
                                                onClick={selectAllSchedules}
                                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                Pilih Semua
                                            </button>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                onClick={clearAllSelections}
                                                className="text-sm text-gray-500 hover:text-gray-700"
                                            >
                                                Hapus Pilihan
                                            </button>
                                        </div>

                                        {/* Schedule list */}
                                        <div className="space-y-2 max-h-80 overflow-y-auto">
                                            {availableSchedules.map(schedule => {
                                                const isSelected = selectedSchedules.some(s => s.id === schedule.id);
                                                return (
                                                    <div
                                                        key={schedule.id}
                                                        onClick={() => toggleScheduleSelection(schedule)}
                                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                                            }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                                                }`}>
                                                                {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${schedule.type === 'lecture'
                                                                        ? 'bg-blue-100 text-blue-700'
                                                                        : 'bg-purple-100 text-purple-700'
                                                                        }`}>
                                                                        {schedule.type === 'lecture' ? 'Mengajar' : 'Sidang'}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">
                                                                        {schedule.start_time} - {schedule.end_time}
                                                                    </span>
                                                                </div>

                                                                {schedule.type === 'lecture' ? (
                                                                    <>
                                                                        <p className="font-medium text-gray-900">{schedule.course_name}</p>
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-600">
                                                                            {schedule.study_program_name && (
                                                                                <span className="flex items-center gap-1">
                                                                                    <GraduationCap className="w-3 h-3" /> {schedule.study_program_name}
                                                                                </span>
                                                                            )}
                                                                            {schedule.class_group && (
                                                                                <span className="flex items-center gap-1">
                                                                                    <Users className="w-3 h-3" /> Rombel {schedule.class_group}
                                                                                </span>
                                                                            )}
                                                                            {schedule.semester && (
                                                                                <span>{schedule.semester}</span>
                                                                            )}
                                                                            <span className="flex items-center gap-1">
                                                                                <BookOpen className="w-3 h-3" /> {schedule.room_name}
                                                                            </span>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <p className="font-medium text-gray-900">
                                                                            {schedule.session_type} - {schedule.student_name}
                                                                        </p>
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-600">
                                                                            <span className="flex items-center gap-1 font-medium text-purple-600">
                                                                                <User className="w-3 h-3" /> {schedule.role_in_session}
                                                                            </span>
                                                                            {schedule.student_nim && (
                                                                                <span>NIM: {schedule.student_nim}</span>
                                                                            )}
                                                                            <span className="flex items-center gap-1">
                                                                                <BookOpen className="w-3 h-3" /> {schedule.room_name}
                                                                            </span>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-medium text-amber-800">Tidak Ada Jadwal Ditemukan</p>
                                                <p className="text-sm text-amber-700 mt-1">Deskripsikan kegiatan Anda contoh : "Mengajar Kelas Susulan Matakuliah Matematika A1 program studi Manajemen semester 3"</p>
                                                <input
                                                    type="text"
                                                    value={customPurpose}
                                                    onChange={(e) => setCustomPurpose(e.target.value)}
                                                    placeholder="Contoh: Rapat, Bimbingan, Konsultasi..."
                                                    className="mt-3 w-full px-4 py-2.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Custom purpose when schedules exist but want to add other purpose */}
                                {availableSchedules.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <p className="text-sm text-gray-600 mb-2">Atau tambahkan tujuan lain:</p>
                                        <input
                                            type="text"
                                            value={customPurpose}
                                            onChange={(e) => setCustomPurpose(e.target.value)}
                                            placeholder="Contoh: Rapat, Bimbingan, Konsultasi... (opsional)"
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 2: Camera Preview */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">2</div>
                                <h2 className="text-lg font-semibold text-gray-900">Preview Kamera</h2>

                            </div>

                            <div className="relative aspect-[4/3] bg-gray-900 rounded-xl overflow-hidden">
                                {cameraError ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                                        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                                        <p className="text-center text-sm">{cameraError}</p>
                                        <button
                                            onClick={initCamera}
                                            className="mt-4 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                        >
                                            Coba Lagi
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Live indicator */}
                                        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                            <span className="text-white text-xs font-medium">LIVE</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <canvas ref={canvasRef} className="hidden" />
                        </div>

                        {/* Step 3: Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || !selectedLecturerId || (selectedSchedules.length === 0 && !customPurpose.trim()) || !cameraStream || hasAttendedToday}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Mengambil foto & menyimpan...
                                </>
                            ) : (
                                <>
                                    <Camera className="w-5 h-5" />
                                    Submit Presensi {selectedSchedules.length > 0 && `(${selectedSchedules.length} kegiatan)`}
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    /* UNY Presensi Tab - Full Frame iFrame */
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <ExternalLink className="w-5 h-5 text-blue-600" />
                                Presensi Wajah (presensi.uny.ac.id)
                            </h2>
                            <a
                                href="https://presensi.uny.ac.id"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                            >
                                Buka di Tab Baru <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                        <div className="relative" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
                            <iframe
                                src="https://presensi.uny.ac.id"
                                className="w-full h-full border-0"
                                allow="camera; microphone; geolocation"
                                title="Presensi UNY"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="py-8 text-center text-sm text-gray-400">
                SIMPEL Kuliah © {new Date().getFullYear()}
            </div>

            {/* Success Modal */}
            {showSuccessModal && successData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Success Header */}
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-center">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                                <PartyPopper className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1">Presensi Berhasil!</h3>
                            <p className="text-emerald-100 text-sm">Data kehadiran Anda telah tercatat</p>
                        </div>

                        {/* Photo & Info */}
                        <div className="p-6">
                            {/* Captured Photo */}
                            <div className="mb-4">
                                <img
                                    src={successData.photo}
                                    alt="Foto Presensi"
                                    className="w-32 h-32 rounded-2xl object-cover mx-auto border-4 border-emerald-100 shadow-lg"
                                />
                            </div>

                            {/* Lecturer Info */}
                            <div className="text-center mb-4">
                                <h4 className="text-xl font-bold text-gray-900 mb-1">{successData.lecturerName}</h4>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                    <Clock className="w-4 h-4" />
                                    {successData.time} WIB
                                </div>
                            </div>

                            {/* Schedule/Purpose Info */}
                            <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${successData.purpose === 'Mengajar' ? 'bg-blue-100 text-blue-700' :
                                        successData.purpose === 'Sidang' ? 'bg-purple-100 text-purple-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                        {successData.purpose}
                                    </span>
                                    {successData.scheduleCount > 0 && (
                                        <span className="text-xs text-gray-500">
                                            {successData.scheduleCount} kegiatan tercatat
                                        </span>
                                    )}
                                </div>
                                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                                    {successData.scheduleInfo}
                                </pre>
                            </div>

                            {/* Status */}
                            <div className="flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                                <AlertCircle className="w-4 h-4" />
                                <span>Status: Menunggu Verifikasi</span>
                            </div>
                        </div>

                        {/* Close Button */}
                        <div className="px-6 pb-6">
                            <button
                                onClick={closeSuccessModal}
                                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-5 h-5" />
                                Selesai
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DosenPresensi;
