import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Camera, User, Clock, BookOpen, Users, CheckCircle, AlertCircle, ChevronDown, Loader2, ExternalLink, PartyPopper, GraduationCap, MapPin, Navigation, CalendarX, X, PenTool, QrCode, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';
import SignatureCanvas from '../components/SignatureCanvas';

// ==================== KONFIGURASI PRESENSI ====================
// Jika true, presensi tetap bisa dilakukan meski di luar lokasi (hanya warning)
// Jika false, presensi akan diblokir jika di luar lokasi
const ALLOW_OUTSIDE_LOCATION = false;

// Default radius jika tidak diset di database (dalam meter)
const DEFAULT_RADIUS_METERS = 1000; // 1km
// ============================================================

// Interface untuk lokasi kampus dari database
interface CampusLocation {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    radius_meters: number | null;
}

interface GeolocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    isWithinAllowedLocation: boolean;
    nearestLocation?: string;
    distanceToNearest?: number;
}

interface Lecturer {
    id: string;
    full_name: string;
    identity_number: string;
    attachments?: string | null;
    study_program?: { id: string; name: string } | null;
    is_homebase?: boolean;
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
    locationInfo?: string;
    additionalNotes?: string;
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
    const [activeTab, setActiveTab] = useState<'presensi' | 'uny'>('presensi');
    const [selectedLecturerId, setSelectedLecturerId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    // QR & Signature State
    const [scannedRoomId, setScannedRoomId] = useState<string | null>(null);
    const [scannedRoomName, setScannedRoomName] = useState<string | null>(null);
    const [scanRetry, setScanRetry] = useState(0);

    // Initial Day Selection (Default to Today)
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const [selectedDay, setSelectedDay] = useState<string>(dayNames[new Date().getDay()]);
    const signatureRef = useRef<any>(null);
    const [signatureError, setSignatureError] = useState<string | null>(null);
    const [hasSignatureContent, setHasSignatureContent] = useState(false);

    // Attendance limit states
    const [hasAttendedToday, setHasAttendedToday] = useState(false);
    const [checkingAttendance, setCheckingAttendance] = useState(false);
    const [lastAttendanceTime, setLastAttendanceTime] = useState<string | null>(null);

    // Weekly attendance limit (from global settings)
    const [weeklyAttendanceCount, setWeeklyAttendanceCount] = useState(0);
    const [maxWeeklyAttendance, setMaxWeeklyAttendance] = useState(3); // default for homebase
    const [hasReachedWeeklyLimit, setHasReachedWeeklyLimit] = useState(false);

    // Camera states
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Schedule detection - now supports MULTIPLE schedules
    const [availableSchedules, setAvailableSchedules] = useState<ScheduleItem[]>([]);
    const [selectedSchedules, setSelectedSchedules] = useState<ScheduleItem[]>([]);
    const [checkingSchedule, setCheckingSchedule] = useState(false);

    // Track if today's schedule is empty (for persistent notification)
    const [isTodayScheduleEmpty, setIsTodayScheduleEmpty] = useState<boolean>(false);

    // Custom purpose for non-scheduled attendance
    const [customPurpose, setCustomPurpose] = useState('');

    // Success modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successData, setSuccessData] = useState<SubmitSuccessData | null>(null);

    // Geolocation states
    const [geolocation, setGeolocation] = useState<GeolocationData | null>(null);
    const [geolocationError, setGeolocationError] = useState<string | null>(null);
    const [fetchingLocation, setFetchingLocation] = useState(false);
    const [campusLocations, setCampusLocations] = useState<CampusLocation[]>([]);

    // Realtime clock state
    const [currentTime, setCurrentTime] = useState(new Date());

    // Special date states (tanggal libur)
    const [todaySpecialDate, setTodaySpecialDate] = useState<{ date: string; reason: string } | null>(null);
    const [showSpecialDateModal, setShowSpecialDateModal] = useState(false);

    // Active week states (untuk cek apakah dalam periode minggu aktif)
    const [isWithinActiveWeek, setIsWithinActiveWeek] = useState<boolean>(true); // Default true to not block initially
    const [activeWeekInfo, setActiveWeekInfo] = useState<{ week_number: number; start_date: string; end_date: string } | null>(null);
    const [showNoActiveWeekModal, setShowNoActiveWeekModal] = useState(false);

    // Global Disable Attendance State
    const [isAttendanceDisabledGlobally, setIsAttendanceDisabledGlobally] = useState<{ isDisabled: boolean; message: string; fromDate: string | null } | null>(null);
    const [showGlobalDisableModal, setShowGlobalDisableModal] = useState(false);

    // Course required modal state
    const [showCourseRequiredModal, setShowCourseRequiredModal] = useState(false);

    // Calculate distance between two coordinates using Haversine formula
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    };

    // Fetch campus locations from database
    const fetchCampusLocations = async () => {
        try {
            const { data, error } = await supabase
                .from('campus')
                .select('id, name, latitude, longitude, radius_meters')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            if (error) {
                console.error('[Campus] Error fetching locations:', error);
                return [];
            }

            console.log('[Campus] Fetched locations:', data);
            setCampusLocations(data || []);
            return data || [];
        } catch (error) {
            console.error('[Campus] Error:', error);
            return [];
        }
    };

    // Fetch today's special date if any (tanggal libur)
    const fetchTodaySpecialDate = async () => {
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const { data, error } = await supabase
                .from('attendance_special_dates')
                .select('date, reason')
                .eq('date', todayStr)
                .maybeSingle();

            if (error) {
                console.error('[SpecialDate] Error:', error);
                return;
            }

            if (data) {
                console.log('[SpecialDate] Today is a special date:', data.reason);
                setTodaySpecialDate(data);
                setShowSpecialDateModal(true); // Show warning modal
            } else {
                setTodaySpecialDate(null);
            }
        } catch (error) {
            console.error('[SpecialDate] Error:', error);
        }
    };

    // Check if today is within an active teaching week
    const checkActiveWeek = async () => {
        try {
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear();

            // Fetch week settings for current month
            const { data, error } = await supabase
                .from('attendance_week_settings')
                .select('*')
                .eq('month', currentMonth)
                .eq('year', currentYear)
                .eq('is_active', true);

            if (error) {
                console.error('[ActiveWeek] Error:', error);
                return;
            }

            console.log('[ActiveWeek] Week settings for this month:', data);

            // If no week settings configured, allow attendance (default behavior)
            if (!data || data.length === 0) {
                console.log('[ActiveWeek] No week settings configured, allowing attendance');
                setIsWithinActiveWeek(true);
                setActiveWeekInfo(null);
                return;
            }

            // Check if today falls within any active week
            const todayDate = new Date(todayStr);
            const activeWeek = data.find(week => {
                const startDate = new Date(week.start_date);
                const endDate = new Date(week.end_date);
                return todayDate >= startDate && todayDate <= endDate;
            });

            if (activeWeek) {
                console.log('[ActiveWeek] Today is within active week:', activeWeek.week_number);
                setIsWithinActiveWeek(true);
                setActiveWeekInfo({
                    week_number: activeWeek.week_number,
                    start_date: activeWeek.start_date,
                    end_date: activeWeek.end_date
                });
            } else {
                console.log('[ActiveWeek] Today is NOT within any active week - blocking attendance');
                setIsWithinActiveWeek(false);
                setActiveWeekInfo(null);
                setShowNoActiveWeekModal(true);
            }
        } catch (error) {
            console.error('[ActiveWeek] Error:', error);
        }
    };

    // Check global attendance settings (disable attendance toggle)
    const checkGlobalSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('attendance_global_settings')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('[GlobalSettings] Error:', error);
                return;
            }

            if (data && data.is_attendance_disabled) {
                // Check if we passed the disable start date (if set)
                let shouldDisable = true;
                if (data.disabled_from_date) {
                    const today = new Date();
                    const fromDate = new Date(data.disabled_from_date);
                    today.setHours(0, 0, 0, 0);
                    fromDate.setHours(0, 0, 0, 0);

                    if (today < fromDate) {
                        shouldDisable = false;
                    }
                }

                if (shouldDisable) {
                    setIsAttendanceDisabledGlobally({
                        isDisabled: true,
                        message: data.disabled_message || 'Presensi transport sedang ditutup.',
                        fromDate: data.disabled_from_date
                    });
                    setShowGlobalDisableModal(true);
                } else {
                    setIsAttendanceDisabledGlobally(null);
                }
            } else {
                setIsAttendanceDisabledGlobally(null);
            }
        } catch (error) {
            console.error('[GlobalSettings] Error:', error);
        }
    };
    const fetchGeolocation = async () => {
        if (!navigator.geolocation) {
            setGeolocationError('Browser tidak mendukung geolokasi');
            return;
        }

        setFetchingLocation(true);
        setGeolocationError(null);

        try {
            // Fetch campus locations if not already loaded
            let locations = campusLocations;
            if (locations.length === 0) {
                locations = await fetchCampusLocations();
            }

            // Get user's position
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                });
            });

            const { latitude, longitude, accuracy } = position.coords;
            console.log('[Geolocation] Got position:', { latitude, longitude, accuracy });

            // Check if there are any campus locations configured
            if (locations.length === 0) {
                console.warn('[Geolocation] No campus locations configured in database');
                setGeolocation({
                    latitude,
                    longitude,
                    accuracy,
                    isWithinAllowedLocation: true, // Allow if no locations configured
                    nearestLocation: 'Belum dikonfigurasi',
                    distanceToNearest: 0
                });
                return;
            }

            // Check distance to all campus locations from database
            let nearestLocation = locations[0]?.name || 'Unknown';
            let minDistance = Infinity;
            let isWithinAny = false;

            for (const campus of locations) {
                if (campus.latitude && campus.longitude) {
                    const distance = calculateDistance(latitude, longitude, campus.latitude, campus.longitude);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestLocation = campus.name;
                    }
                    // Use campus-specific radius or default 1km
                    const radius = campus.radius_meters || DEFAULT_RADIUS_METERS;
                    if (distance <= radius) {
                        isWithinAny = true;
                    }
                }
            }

            setGeolocation({
                latitude,
                longitude,
                accuracy,
                isWithinAllowedLocation: isWithinAny,
                nearestLocation,
                distanceToNearest: Math.round(minDistance)
            });

        } catch (error: any) {
            console.error('[Geolocation] Error:', error);
            if (error.code === 1) {
                setGeolocationError('Izin lokasi ditolak. Aktifkan GPS dan izinkan akses lokasi.');
            } else if (error.code === 2) {
                setGeolocationError('Lokasi tidak tersedia. Pastikan GPS aktif.');
            } else if (error.code === 3) {
                setGeolocationError('Timeout saat mengambil lokasi. Coba lagi.');
            } else {
                setGeolocationError('Gagal mengambil lokasi: ' + error.message);
            }
        } finally {
            setFetchingLocation(false);
        }
    };

    // Fetch lecturers and campus locations on mount
    useEffect(() => {
        fetchLecturers();
        fetchCampusLocations();
        fetchTodaySpecialDate(); // Check if today is special date
        checkActiveWeek(); // Check if today is within active teaching week
        checkGlobalSettings(); // Check if attendance is disabled globally
        // Also fetch geolocation on mount
        fetchGeolocation();
    }, []);

    // Realtime clock update every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000); // Update every second

        return () => clearInterval(timer);
    }, []);

    // Initialize camera when tab is presensi AND room is scanned
    useEffect(() => {
        if (activeTab === 'presensi' && scannedRoomId) {
            initCamera();
        }
        return () => {
            stopCamera();
        };
    }, [activeTab, scannedRoomId]);

    // Check if lecturer already attended today AND weekly limit
    useEffect(() => {
        const checkAttendance = async () => {
            if (!selectedLecturerId) {
                setHasAttendedToday(false);
                setLastAttendanceTime(null);
                setWeeklyAttendanceCount(0);
                setHasReachedWeeklyLimit(false);
                return;
            }

            setCheckingAttendance(true);
            try {
                const today = new Date();
                const todayStr = format(today, 'yyyy-MM-dd');

                // Get the selected lecturer's homebase status
                const lecturer = lecturers.find(l => l.id === selectedLecturerId);
                const isHomebase = lecturer?.is_homebase ?? true;

                // Fetch max weekly attendance from global settings
                const { data: globalData } = await supabase
                    .from('attendance_global_settings')
                    .select('max_weekly_attendance_hbv, max_weekly_attendance_nhbv')
                    .limit(1)
                    .maybeSingle();

                const maxWeekly = isHomebase
                    ? (globalData?.max_weekly_attendance_hbv ?? 3)
                    : (globalData?.max_weekly_attendance_nhbv ?? 2);
                setMaxWeeklyAttendance(maxWeekly);

                // Check today's attendance
                const { data: todayData, error: todayError } = await supabase
                    .from('lecturer_attendance')
                    .select('id, attendance_time')
                    .eq('lecturer_user_id', selectedLecturerId)
                    .eq('attendance_date', todayStr)
                    .limit(1);

                if (todayError) throw todayError;

                if (todayData && todayData.length > 0) {
                    setHasAttendedToday(true);
                    setLastAttendanceTime(todayData[0].attendance_time?.substring(0, 5) || null);
                    setAvailableSchedules([]);
                    setSelectedSchedules([]);
                    setCustomPurpose('');
                } else {
                    setHasAttendedToday(false);
                    setLastAttendanceTime(null);
                }

                // Check this week's attendance count (Monday to Sunday)
                const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const monday = new Date(today);
                monday.setDate(today.getDate() + mondayOffset);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);

                const weekStart = format(monday, 'yyyy-MM-dd');
                const weekEnd = format(sunday, 'yyyy-MM-dd');

                const { data: weekData, error: weekError } = await supabase
                    .from('lecturer_attendance')
                    .select('id')
                    .eq('lecturer_user_id', selectedLecturerId)
                    .gte('attendance_date', weekStart)
                    .lte('attendance_date', weekEnd);

                if (weekError) throw weekError;

                const weekCount = weekData?.length || 0;
                setWeeklyAttendanceCount(weekCount);
                setHasReachedWeeklyLimit(weekCount >= maxWeekly);

                console.log(`[Attendance] Lecturer: ${lecturer?.full_name}, Homebase: ${isHomebase}, Weekly: ${weekCount}/${maxWeekly}`);

            } catch (error) {
                console.error('Error checking attendance:', error);
            } finally {
                setCheckingAttendance(false);
            }
        };

        checkAttendance();
    }, [selectedLecturerId, lecturers]);

    // Detect ALL schedules when lecturer OR selectedDay changes
    useEffect(() => {
        if (selectedLecturerId && !hasAttendedToday) {
            const lecturer = lecturers.find(l => l.id === selectedLecturerId);
            if (lecturer) {
                // Pass both ID and name for flexible matching
                detectAllSchedules(selectedLecturerId, lecturer.full_name, selectedDay);
            }
        } else {
            setAvailableSchedules([]);
            setSelectedSchedules([]);
        }
    }, [selectedLecturerId, lecturers, hasAttendedToday, selectedDay]);

    // QR Scanner Effect - AUTO START, WITH CAMERA FALLBACK
    useEffect(() => {
        if (activeTab === 'presensi' && !scannedRoomId && !showSpecialDateModal && !showNoActiveWeekModal && !showGlobalDisableModal) {

            const html5QrCode = new Html5Qrcode("qr-reader");
            let isMounted = true;

            const startScanning = async () => {
                const config = { fps: 10, qrbox: { width: 250, height: 250 } };

                // Callback saat QR berhasil dibaca
                const onScanSuccess = (decodedText: string) => {
                    console.log("Scanned:", decodedText);
                    html5QrCode.stop().then(async () => {
                        const toastId = toast.loading('Memverifikasi QR Code...');
                        try {
                            const { data, error } = await supabase
                                .from('rooms')
                                .select('id, name')
                                .eq('id', decodedText)
                                .single();

                            if (error || !data) {
                                console.error("Invalid Room QR:", decodedText, error);
                                toast.error('QR Code TIDAK VALID! Ini bukan QR Ruangan.', { id: toastId });
                                setTimeout(() => {
                                    if (isMounted) setScanRetry(prev => prev + 1);
                                }, 2000);
                            } else {
                                if (isMounted) {
                                    setScannedRoomId(data.id);
                                    setScannedRoomName(data.name);
                                }
                                toast.success(`Terverifikasi: ${data.name}`, { id: toastId });
                            }
                        } catch (err) {
                            console.error("Validation error:", err);
                            toast.error('Terjadi kesalahan verifikasi.', { id: toastId });
                            setTimeout(() => {
                                if (isMounted) setScanRetry(prev => prev + 1);
                            }, 2000);
                        }
                    }).catch((err: any) => console.error("Failed to stop scanner", err));
                };

                const onScanError = (_errorMessage: any) => {
                    // parse error, ignore to avoid spamming console
                };

                // STRATEGY: Detect cameras first, then pick the best one directly
                // This avoids long timeouts from requesting facingMode that doesn't exist
                try {
                    const devices = await Html5Qrcode.getCameras();
                    console.log('[QR] Available cameras:', devices.map(d => d.label));

                    if (devices && devices.length > 0) {
                        // Pick camera: prefer back/environment camera, fallback to any
                        const backCamera = devices.find(d =>
                            d.label.toLowerCase().includes('back') ||
                            d.label.toLowerCase().includes('rear') ||
                            d.label.toLowerCase().includes('environment') ||
                            d.label.toLowerCase().includes('belakang')
                        );

                        const selectedCamera = backCamera || devices[0];
                        console.log(`[QR] Using camera: ${selectedCamera.label || selectedCamera.id}`);

                        await html5QrCode.start(
                            selectedCamera.id,
                            config,
                            onScanSuccess,
                            onScanError
                        );
                        console.log('[QR] Camera started successfully');
                        if (isMounted) setCameraError(null);
                        return;
                    }
                } catch (enumErr) {
                    console.warn('[QR] Camera enumeration/start by ID failed:', enumErr);
                }

                // Fallback: if enumeration failed, try facingMode generically
                try {
                    console.log('[QR] Fallback: trying facingMode user...');
                    await html5QrCode.start(
                        { facingMode: "user" },
                        config,
                        onScanSuccess,
                        onScanError
                    );
                    console.log('[QR] Fallback camera started successfully');
                    if (isMounted) setCameraError(null);
                    return;
                } catch (fallbackErr) {
                    console.warn('[QR] Fallback facingMode user failed:', fallbackErr);
                }

                // All failed
                console.error("[QR] All camera strategies failed");
                if (isMounted) {
                    setCameraError("Gagal memulai kamera. Pastikan izin kamera diberikan dan tidak ada aplikasi lain yang menggunakan kamera.");
                }
            };

            // Small delay to ensure DOM is ready
            const timeoutId = setTimeout(() => {
                startScanning();
            }, 500);

            // Cleanup
            return () => {
                isMounted = false;
                clearTimeout(timeoutId);
                if (html5QrCode && html5QrCode.isScanning) {
                    html5QrCode.stop().catch((err: any) => console.error("Failed to stop on cleanup", err));
                }
            };
        }
    }, [activeTab, scannedRoomId, showSpecialDateModal, showNoActiveWeekModal, showGlobalDisableModal, scanRetry]);

    const fetchLecturers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, identity_number, is_homebase, study_program:study_programs(id, name)')
                .eq('role', 'lecturer')
                .order('full_name');

            if (error) throw error;

            // Transform data to handle Supabase's array return for single relations
            const transformedData = (data || []).map((item: any) => ({
                ...item,
                is_homebase: item.is_homebase ?? true, // Default to homebase if not set
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
                // Mirror the captured photo to match the mirrored preview (front camera selfie)
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0);
                ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
                return canvas.toDataURL('image/jpeg', 0.8);
            }
        }
        return null;
    };

    // Handle lecturer selection change - reset related states
    const handleLecturerChange = (lecturerId: string) => {
        setSelectedLecturerId(lecturerId);
        // Reset selected schedules and custom purpose when changing lecturer
        setSelectedSchedules([]);
        setCustomPurpose('');
    };

    // Detect ALL schedules for SELECTED DAY (lectures + sessions)
    const detectAllSchedules = async (lecturerId: string, lecturerName: string, day: string) => {
        setCheckingSchedule(true);
        setAvailableSchedules([]);

        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');

        console.log('[detectAllSchedules] Checking for:', lecturerName, '(ID:', lecturerId, ') on day:', day);

        const allSchedules: ScheduleItem[] = [];

        // 1. Fetch lecture schedules using EXACT lecturer_user_id match (more accurate than name)
        try {
            const { data: lectureData, error: lectureError } = await supabase
                .from('lecture_schedules')
                .select('id, course_name, course_code, room, start_time, end_time, class, subject_study, semester, academics_year')
                .eq('lecturer_user_id', lecturerId)  // Use exact ID match, not name
                .ilike('day', day); // Use SELECTED DAY

            console.log('[detectAllSchedules] Lecture query (by ID) result:', { lectureData, lectureError });

            // If query by ID fails OR returns empty, fallback to name-based search
            if (lectureError || !lectureData || lectureData.length === 0) {
                if (lectureError) {
                    console.error('Error fetching lecture schedules by ID:', lectureError);
                } else {
                    console.log('[detectAllSchedules] No results by ID, trying name-based search...');
                }

                // Fallback to name-based search
                const { data: lectureDataByName, error: lectureErrorByName } = await supabase
                    .from('lecture_schedules')
                    .select('id, course_name, course_code, room, start_time, end_time, class, subject_study, semester, academics_year')
                    .ilike('lecturer', `%${lecturerName}%`)
                    .ilike('day', day); // Use SELECTED DAY

                console.log('[detectAllSchedules] Lecture query (by name fallback) result:', { lectureDataByName, lectureErrorByName });

                if (lectureDataByName && lectureDataByName.length > 0) {
                    lectureDataByName.forEach(schedule => {
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
                    console.log('[detectAllSchedules] Added', lectureDataByName.length, 'lecture schedules (by name)');
                }
            } else {
                // Query by ID succeeded with results
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
                console.log('[detectAllSchedules] Added', lectureData.length, 'lecture schedules (by ID)');
            }
        } catch (error) {
            console.error('[detectAllSchedules] Error in lecture query:', error);
        }

        // 2. DISABLED: Final sessions (sidang) are no longer displayed in the schedule list
        // Only lecture schedules (mengajar) are shown to lecturers
        // If sidang needs to be re-enabled in the future, uncomment the block below
        /*
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
                .or(`supervisor.ilike."%${lecturerName}%",examiner.ilike."%${lecturerName}%",secretary.ilike."%${lecturerName}%"`);

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
        */

        console.log('[detectAllSchedules] Total schedules found:', allSchedules.length);
        setAvailableSchedules(allSchedules);

        // Track if TODAY'S schedule is empty (for persistent notification)
        const todayDayName = dayNames[today.getDay()];
        if (day === todayDayName) {
            // We're checking today's schedule
            setIsTodayScheduleEmpty(allSchedules.length === 0);
        }

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
        // Block submission on special dates (holidays)
        if (todaySpecialDate) {
            setShowSpecialDateModal(true);
            return;
        }

        // Block submission if not within active teaching week
        if (!isWithinActiveWeek) {
            setShowNoActiveWeekModal(true);
            return;
        }

        // Block submission if attendance is disabled globally
        if (isAttendanceDisabledGlobally?.isDisabled) {
            setShowGlobalDisableModal(true);
            return;
        }

        if (!selectedLecturerId) {
            toast.error('Silakan pilih nama dosen');
            return;
        }
        if (selectedSchedules.length === 0 && !customPurpose.trim()) {
            toast.error('Silakan pilih jadwal atau masukkan tujuan kehadiran');
            return;
        }

        // Wajib pilih minimal 1 jadwal mengajar (lecture) jika ada jadwal lecture tersedia
        const availableLectures = availableSchedules.filter(s => s.type === 'lecture');
        const selectedLectures = selectedSchedules.filter(s => s.type === 'lecture');
        if (availableLectures.length > 0 && selectedLectures.length === 0) {
            setShowCourseRequiredModal(true);
            return;
        }
        if (!cameraStream) {
            toast.error('Kamera tidak tersedia');
            return;
        }

        // Validate Signature
        if (!signatureRef.current || signatureRef.current.isEmpty()) {
            setSignatureError('Tanda tangan wajib diisi');
            toast.error('Mohon tanda tangan terlebih dahulu');
            const signatureElement = document.querySelector('canvas');
            signatureElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setSubmitting(true);

        try {
            // Upload Signature
            // Use Data URL directly for signature (stored as text in DB, consistent with photo_capture)
            // This avoids "Bucket not found" error if the attendance_signatures bucket is missing
            const signatureUrl = signatureRef.current.toDataURL();

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

            // Check geolocation if required
            if (!ALLOW_OUTSIDE_LOCATION && geolocation && !geolocation.isWithinAllowedLocation) {
                toast.error(`Anda berada di luar area yang diizinkan. Jarak ke ${geolocation.nearestLocation}: ${geolocation.distanceToNearest}m`);
                return;
            }



            // Refresh geolocation before submit
            if (!geolocation) {
                await fetchGeolocation();
            }

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

            // Determine primary purpose based on selected schedules
            let purposeValue = 'lainnya';
            let purposeDesc = customPurpose;

            if (selectedSchedules.length > 0) {
                const lectureSchedules = selectedSchedules.filter(s => s.type === 'lecture');
                const sessionSchedules = selectedSchedules.filter(s => s.type === 'session');
                const hasLecture = lectureSchedules.length > 0;
                const hasSession = sessionSchedules.length > 0;

                // Build lecture names list
                const lectureNames = lectureSchedules.map(s => s.course_name || 'Mata Kuliah').join(', ');

                if (hasLecture && hasSession) {
                    purposeValue = 'mengajar'; // Default to mengajar if mixed
                    // Always include course names in description
                    const isToday = selectedDay === dayNames[currentTime.getDay()];
                    if (isToday) {
                        purposeDesc = `Mengajar: ${lectureNames}`;
                        if (sessionSchedules.length > 0) {
                            purposeDesc += ` + ${sessionSchedules.length} sidang`;
                        }
                    } else {
                        // Kelas pengganti
                        purposeDesc = `Kelas pengganti: ${lectureNames}`;
                        if (sessionSchedules.length > 0) {
                            purposeDesc += ` + ${sessionSchedules.length} sidang`;
                        }
                    }
                } else if (hasLecture) {
                    purposeValue = 'mengajar';
                    // GENERATE PURPOSE DESCRIPTION - Always include course names
                    const isToday = selectedDay === dayNames[currentTime.getDay()];

                    if (isToday) {
                        // Regular Schedule - Always include course names
                        purposeDesc = lectureSchedules.length === 1
                            ? (lectureSchedules[0].course_name || 'Mengajar')
                            : `Mengajar: ${lectureNames}`;
                    } else {
                        // Substitute Schedule - Include course names
                        if (lectureSchedules.length === 1) {
                            const s = lectureSchedules[0];
                            purposeDesc = `Saya mengajar kelas pengganti mata kuliah ${s.course_name} kelas ${s.class_group || '-'} semester ${s.semester?.replace('Semester ', '') || '-'}`;
                        } else {
                            purposeDesc = `Kelas pengganti: ${lectureNames}`;
                        }
                    }
                } else if (hasSession) {
                    purposeValue = 'sidang';
                    purposeDesc = sessionSchedules.length === 1
                        ? `Sidang - ${sessionSchedules[0].student_name}`
                        : `${sessionSchedules.length} sidang (${sessionSchedules.map(s => s.student_name || 'Mahasiswa').join(', ')})`;
                }
            } else if (customPurpose.toLowerCase().includes('mengajar') || customPurpose.toLowerCase().includes('kuliah')) {
                purposeValue = 'mengajar';
            } else if (customPurpose.toLowerCase().includes('sidang') || customPurpose.toLowerCase().includes('pendadaran')) {
                purposeValue = 'sidang';
            }

            // 1. Insert main attendance record
            const attendanceData: any = {
                lecturer_user_id: selectedLecturerId,
                lecturer_name: lecturer.full_name,
                attendance_date: todayStr,
                attendance_time: format(new Date(), 'HH:mm:ss'),
                photo_capture: photoData,
                purpose: purposeValue,
                purpose_description: purposeDesc,
                verification_status: 'pending',
                study_program_id: lecturer.study_program?.id || null,
                scanned_room_id: scannedRoomId || null,
                signature_url: signatureUrl || null,
                additional_notes: customPurpose.trim() || null
                // Note: Geolocation columns will be added later via migration
                // location_latitude, location_longitude, location_accuracy, location_name, is_within_allowed_location
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

            // Build location info for success modal
            let locationInfo = '';
            if (geolocation) {
                if (geolocation.isWithinAllowedLocation) {
                    locationInfo = `📍 ${geolocation.nearestLocation} (${geolocation.distanceToNearest}m)`;
                } else {
                    locationInfo = `⚠️ Di luar area: ${geolocation.distanceToNearest}m dari ${geolocation.nearestLocation}`;
                }
            }

            setSuccessData({
                lecturerName: lecturer.full_name,
                scheduleInfo,
                purpose: purposeValue === 'mengajar' ? 'Mengajar' : purposeValue === 'sidang' ? 'Sidang' : 'Lainnya',
                time: format(new Date(), 'HH:mm'),
                photo: photoData,
                scheduleCount: selectedSchedules.length,
                locationInfo,
                additionalNotes: customPurpose.trim() || undefined
            });
            setShowSuccessModal(true);

            // Reset form
            setSelectedLecturerId('');
            setCustomPurpose('');
            setAvailableSchedules([]);
            setSelectedSchedules([]);
            // Clear signature canvas
            signatureRef.current?.clear();
            setHasSignatureContent(false);

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
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-500/20">
                                <Clock className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Presensi Dosen</h1>
                                <p className="text-xs font-medium text-gray-500">{format(currentTime, 'EEEE, d MMMM yyyy', { locale: localeId })}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600 tracking-tight">{format(currentTime, 'HH:mm')}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">WIB</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                {/* Tabs */}
                <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100 mb-6 max-w-md mx-auto sm:max-w-none sm:justify-start">
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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                {activeTab === 'presensi' && !scannedRoomId ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center animate-fadeIn">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <QrCode className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">Scan QR Code Ruangan</h2>
                        <p className="text-gray-600 mb-8 max-w-md mx-auto">
                            Sebelum melakukan presensi, Anda wajib memindai QR Code yang tertempel di dinding ruangan untuk verifikasi lokasi.
                        </p>
                        <div className="max-w-sm mx-auto bg-gray-900 rounded-2xl overflow-hidden shadow-lg border-4 border-white mb-6">
                            <div id="qr-reader" className="w-full"></div>
                        </div>
                        {cameraError ? (
                            <div className="space-y-3">
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-sm mx-auto">
                                    <div className="flex items-center gap-2 text-red-700 mb-2">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <p className="font-medium text-sm">Kamera Tidak Tersedia</p>
                                    </div>
                                    <p className="text-xs text-red-600">{cameraError}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setCameraError(null);
                                        setScanRetry(prev => prev + 1);
                                    }}
                                    className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Coba Lagi
                                </button>
                                <p className="text-xs text-gray-400">
                                    Pastikan izin kamera sudah diberikan dan tidak ada aplikasi lain yang menggunakan kamera.
                                </p>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400">
                                Arahkan kamera ke kode QR ruangan
                            </div>
                        )}
                    </div>
                ) : activeTab === 'presensi' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            {/* Scanned Room Indicator */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                        <MapPin className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-emerald-900">Terverifikasi di Ruangan</h3>
                                        <p className="text-sm text-emerald-700">{scannedRoomName || 'Ruangan Valid'} (ID: {scannedRoomId?.substring(0, 8)}...)</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setScannedRoomId(null)}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 underline"
                                >
                                    Scan Ulang
                                </button>
                            </div>
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
                                        onChange={handleLecturerChange}
                                        placeholder="Cari dan pilih nama dosen..."
                                    />
                                )}

                                {/* Attendance Info/Warning */}
                                {checkingAttendance ? (
                                    <div className="mt-4 flex items-center justify-center p-4 text-gray-500 gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span className="text-sm">Memeriksa status presensi...</span>
                                    </div>
                                ) : hasAttendedToday ? (
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
                                ) : null}
                            </div>

                            {/* Step 1.5: Schedule Selection (Multiple) - Auto Day */}
                            {selectedLecturerId && !hasAttendedToday && (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                                            <BookOpen className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-900">Pilih Jadwal Kegiatan</h2>
                                            <p className="text-xs text-gray-500">Pilih hari untuk menampilkan jadwal mata kuliah</p>
                                        </div>
                                    </div>

                                    {/* Notification when TODAY's schedule is not found (persists across day changes) */}
                                    {!checkingSchedule && isTodayScheduleEmpty && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 animate-fadeIn">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="font-medium text-blue-900">Jadwal hari ini tidak ditemukan</p>
                                                    <p className="text-sm text-blue-700 mt-1">
                                                        Silahkan pilih kelas pengganti yang anda ajar. Pilih hari sesuai jadwal asli anda.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Day Selector - Hidden if schedules found on current day */}
                                    {!(selectedDay === dayNames[currentTime.getDay()] && availableSchedules.length > 0) && (
                                        <div className="flex flex-wrap gap-2 mb-6 animate-fadeIn">
                                            {dayNames.filter(d => d !== 'Minggu').map((day) => (
                                                <button
                                                    key={day}
                                                    onClick={() => setSelectedDay(day)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${selectedDay === day
                                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {checkingSchedule ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-600" />
                                            <p className="text-sm">Mencari jadwal {selectedDay}...</p>
                                        </div>
                                    ) : availableSchedules.length > 0 ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-sm text-gray-600">Ditemukan {availableSchedules.length} jadwal:</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={selectAllSchedules}
                                                        className="text-xs text-blue-600 hover:underline"
                                                    >
                                                        Pilih Semua
                                                    </button>
                                                    <button
                                                        onClick={clearAllSelections}
                                                        className="text-xs text-gray-500 hover:underline"
                                                    >
                                                        Reset
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
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
                                            <p className="text-sm text-gray-600 mb-2">Opsi Keterangan Tambahan:</p>
                                            <input
                                                type="text"
                                                value={customPurpose}
                                                onChange={(e) => setCustomPurpose(e.target.value)}
                                                placeholder="Isikan alasan / keterangan"
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Geolocation Status */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                            <MapPin className="w-4 h-4 text-green-600" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-gray-900">Status Lokasi</h2>
                                    </div>
                                    <button
                                        onClick={fetchGeolocation}
                                        disabled={fetchingLocation}
                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        {fetchingLocation ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Navigation className="w-4 h-4" />
                                        )}
                                        Refresh Lokasi
                                    </button>
                                </div>

                                {fetchingLocation ? (
                                    <div className="flex items-center gap-2 text-gray-500 py-3">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span className="text-sm">Mengambil lokasi GPS...</span>
                                    </div>
                                ) : geolocationError ? (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-red-800">{geolocationError}</p>
                                            <button
                                                onClick={fetchGeolocation}
                                                className="mt-2 text-sm text-red-600 hover:underline"
                                            >
                                                Coba ambil lokasi lagi
                                            </button>
                                        </div>
                                    </div>
                                ) : geolocation ? (
                                    <div className={`rounded-xl p-4 ${geolocation.isWithinAllowedLocation
                                        ? 'bg-emerald-50 border border-emerald-200'
                                        : 'bg-amber-50 border border-amber-200'
                                        }`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {geolocation.isWithinAllowedLocation ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                            )}
                                            <span className={`font-medium ${geolocation.isWithinAllowedLocation ? 'text-emerald-800' : 'text-amber-800'}`}>
                                                {geolocation.isWithinAllowedLocation
                                                    ? 'Lokasi Valid ✓'
                                                    : 'Di Luar Area yang Diizinkan'
                                                }
                                            </span>
                                        </div>
                                        <div className="text-sm">
                                            <p className={geolocation.isWithinAllowedLocation ? 'text-emerald-700' : 'text-amber-700'}>
                                                📍 Kampus: <strong>{geolocation.nearestLocation}</strong>
                                            </p>
                                        </div>
                                        {!geolocation.isWithinAllowedLocation && !ALLOW_OUTSIDE_LOCATION && (
                                            <p className="mt-2 text-red-600 text-sm font-medium">
                                                ⚠️ Presensi tidak dapat dilakukan dari lokasi ini
                                            </p>
                                        )}
                                        {!geolocation.isWithinAllowedLocation && ALLOW_OUTSIDE_LOCATION && (
                                            <p className="mt-2 text-amber-600 text-sm">
                                                ⚠️ Tetap bisa presensi, tapi lokasi akan dicatat
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-gray-500 text-sm py-2">
                                        Klik "Refresh Lokasi" untuk mengambil posisi GPS Anda
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Show location warning if outside allowed area */}
                            {geolocation && !geolocation.isWithinAllowedLocation && !ALLOW_OUTSIDE_LOCATION && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                                    <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-red-800">Lokasi Tidak Valid</p>
                                        <p className="text-sm text-red-600">Anda berada di luar area kampus yang diizinkan. Presensi hanya dapat dilakukan dari lokasi kampus.</p>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Camera Preview */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">2</div>
                                    <h2 className="text-lg font-semibold text-gray-900">Preview Kamera</h2>
                                </div>

                                <div className="relative bg-gray-900 rounded-xl overflow-hidden" style={{ minHeight: '300px' }}>
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
                                                className="w-full object-cover"
                                                style={{ transform: 'scaleX(-1)', minHeight: '300px' }}
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

                            {/* Signature Section */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <PenTool className="w-5 h-5 text-blue-600" />
                                    Tanda Tangan Digital
                                </h2>
                                <div className={`border-2 rounded-xl overflow-hidden ${signatureError ? 'border-red-300' : 'border-gray-200 border-dashed'}`}>
                                    <SignatureCanvas
                                        ref={signatureRef}
                                        penColor="#000000"
                                        backgroundColor="white"
                                        onChange={(dataUrl: string) => {
                                            setSignatureError(null);
                                            // dataUrl kosong berarti canvas di-clear, ada isi berarti ada coretan
                                            setHasSignatureContent(!!dataUrl);
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <p className="text-xs text-gray-500">
                                        {hasSignatureContent
                                            ? <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Tanda tangan terisi</span>
                                            : <span className="text-amber-600">⚠️ Wajib — tanda tangan pada area di atas</span>
                                        }
                                    </p>
                                    <button
                                        onClick={() => {
                                            signatureRef.current?.clear();
                                            setHasSignatureContent(false);
                                        }}
                                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                                    >
                                        Hapus & Ulangi
                                    </button>
                                </div>
                                {signatureError && (
                                    <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        {signatureError}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={
                                    submitting ||
                                    !selectedLecturerId ||
                                    (selectedSchedules.length === 0 && !customPurpose.trim()) ||
                                    !cameraStream ||
                                    hasAttendedToday ||
                                    !hasSignatureContent ||
                                    (!ALLOW_OUTSIDE_LOCATION && geolocation && !geolocation.isWithinAllowedLocation) ||
                                    (!ALLOW_OUTSIDE_LOCATION && !geolocation)
                                }
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Mengambil foto & menyimpan...
                                    </>
                                ) : !geolocation && !ALLOW_OUTSIDE_LOCATION ? (
                                    <>
                                        <MapPin className="w-5 h-5" />
                                        Menunggu Lokasi GPS...
                                    </>
                                ) : geolocation && !geolocation.isWithinAllowedLocation && !ALLOW_OUTSIDE_LOCATION ? (
                                    <>
                                        <AlertCircle className="w-5 h-5" />
                                        Lokasi Di Luar Area Kampus
                                    </>
                                ) : !hasSignatureContent ? (
                                    <>
                                        <PenTool className="w-5 h-5" />
                                        Tanda Tangan Belum Diisi
                                    </>
                                ) : hasReachedWeeklyLimit ? (
                                    <>
                                        <Camera className="w-5 h-5" />
                                        Submit Presensi {selectedSchedules.length > 0 && `(${selectedSchedules.length} kegiatan)`}
                                    </>
                                ) : (
                                    <>
                                        <Camera className="w-5 h-5" />
                                        Submit Presensi {selectedSchedules.length > 0 && `(${selectedSchedules.length} kegiatan)`}
                                    </>
                                )}
                            </button>

                        </div>
                    </div >
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
            </div >

            {/* Footer */}
            < div className="py-8 text-center text-sm text-gray-400" >
                SIMPEL Kuliah © {new Date().getFullYear()}
            </div >

            {/* Success Modal */}
            {
                showSuccessModal && successData && (
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

                                {/* Location Info */}
                                {successData.locationInfo && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600 bg-gray-100 rounded-lg p-2 mb-3">
                                        <MapPin className="w-4 h-4" />
                                        <span>{successData.locationInfo}</span>
                                    </div>
                                )}

                                {/* Additional Notes */}
                                {successData.additionalNotes && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
                                        <p className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide">Keterangan Tambahan</p>
                                        <p className="text-sm text-blue-800">
                                            {successData.additionalNotes}
                                        </p>
                                    </div>
                                )}

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
                )
            }

            {/* Special Date Warning Modal */}
            {
                showSpecialDateModal && todaySpecialDate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowSpecialDateModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-center">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CalendarX className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Tanggal Libur</h2>
                                <p className="text-white/80 text-sm mt-1">
                                    {format(new Date(todaySpecialDate.date), 'EEEE, d MMMM yyyy', { locale: localeId })}
                                </p>
                            </div>
                            {/* Content */}
                            <div className="p-6">
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                                    <p className="text-red-800 font-medium text-center">{todaySpecialDate.reason}</p>
                                </div>
                                <p className="text-gray-600 text-center text-sm">
                                    Presensi tidak dapat dilakukan pada tanggal ini. Silakan hubungi bagian Keuangan jika ada pertanyaan.
                                </p>
                            </div>
                            {/* Footer */}
                            <div className="px-6 pb-6">
                                <button
                                    onClick={() => setShowSpecialDateModal(false)}
                                    className="w-full py-3 bg-gray-600 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <X className="w-5 h-5" />
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* No Active Week Modal */}
            {
                showNoActiveWeekModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowNoActiveWeekModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CalendarX className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Di Luar Minggu Kuliah</h2>
                                <p className="text-white/80 text-sm mt-1">
                                    {format(new Date(), 'EEEE, d MMMM yyyy', { locale: localeId })}
                                </p>
                            </div>
                            {/* Content */}
                            <div className="p-6">
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                                    <p className="text-amber-800 font-medium text-center">
                                        Periode Minggu Kuliah belum aktif atau sudah berakhir
                                    </p>
                                </div>
                                <p className="text-gray-600 text-center text-sm">
                                    Presensi hanya dapat dilakukan pada periode minggu kuliah yang sudah diaktifkan oleh bagian Keuangan.
                                    Hubungi bagian Keuangan jika Anda yakin periode kuliah seharusnya masih aktif.
                                </p>
                                {activeWeekInfo && (
                                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-sm text-green-700 text-center">
                                            Minggu aktif terakhir: <br />
                                            <span className="font-semibold">Minggu Ke-{activeWeekInfo.week_number}</span>
                                            <br />
                                            ({format(new Date(activeWeekInfo.start_date), 'd MMM', { locale: localeId })} - {format(new Date(activeWeekInfo.end_date), 'd MMM yyyy', { locale: localeId })})
                                        </p>
                                    </div>
                                )}
                            </div>
                            {/* Footer */}
                            <div className="px-6 pb-6">
                                <button
                                    onClick={() => setShowNoActiveWeekModal(false)}
                                    className="w-full py-3 bg-gray-600 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <X className="w-5 h-5" />
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Global Disable Attendance Modal */}
            {
                showGlobalDisableModal && isAttendanceDisabledGlobally && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowGlobalDisableModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-red-600 to-pink-600 p-6 text-center">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CalendarX className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Presensi Ditutup</h2>
                                <p className="text-white/80 text-sm mt-1">
                                    Akses presensi dinonaktifkan sementara
                                </p>
                            </div>
                            {/* Content */}
                            <div className="p-6">
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                                    <p className="text-red-800 font-medium text-center">
                                        Mohon Maaf, Presensi Dosen Saat Ini Tidak Dapat Diakses.
                                    </p>
                                </div>
                                <p className="text-gray-600 text-center text-sm">
                                    Sistem sedang dalam pemeliharaan atau ditutup oleh administrator.
                                    Silakan hubungi bagian Admin/Keuangan untuk informasi lebih lanjut.
                                </p>
                                {isAttendanceDisabledGlobally.fromDate && (
                                    <p className="text-gray-500 text-center text-xs mt-4">
                                        Ditutup sejak: {format(new Date(isAttendanceDisabledGlobally.fromDate), 'd MMMM yyyy', { locale: localeId })}
                                    </p>
                                )}
                            </div>
                            {/* Footer */}
                            <div className="px-6 pb-6">
                                <button
                                    onClick={() => setShowGlobalDisableModal(false)}
                                    className="w-full py-3 bg-gray-600 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <X className="w-5 h-5" />
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Course Required Modal - Wajib pilih minimal 1 mata kuliah */}
            {
                showCourseRequiredModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCourseRequiredModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-6 text-center">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <BookOpen className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Pilih Mata Kuliah</h2>
                                <p className="text-white/80 text-sm mt-1">
                                    Wajib memilih minimal 1 mata kuliah
                                </p>
                            </div>
                            {/* Content */}
                            <div className="p-6">
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                                    <p className="text-amber-800 font-medium text-center">
                                        Anda belum memilih jadwal mata kuliah yang diampu.
                                    </p>
                                </div>
                                <p className="text-gray-600 text-center text-sm mb-4">
                                    Silakan kembali dan pilih minimal <span className="font-bold text-amber-700">1 jadwal mata kuliah</span> dari daftar jadwal yang tersedia sebelum melakukan presensi.
                                </p>
                                {/* Show available lecture schedules */}
                                {availableSchedules.filter(s => s.type === 'lecture').length > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">Mata Kuliah Tersedia:</p>
                                        <div className="space-y-1">
                                            {availableSchedules.filter(s => s.type === 'lecture').map((s, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-sm text-blue-700">
                                                    <BookOpen className="w-3 h-3 flex-shrink-0" />
                                                    <span className="font-medium">{s.course_name}</span>
                                                    {s.class_group && <span className="text-xs text-blue-500">({s.class_group})</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Footer */}
                            <div className="px-6 pb-6">
                                <button
                                    onClick={() => setShowCourseRequiredModal(false)}
                                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Kembali Pilih Mata Kuliah
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DosenPresensi;
