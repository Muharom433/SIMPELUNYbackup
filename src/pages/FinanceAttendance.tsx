import React, { useState, useEffect, useMemo } from 'react';
import {
    ClipboardCheck, BarChart3, FileText, Search, CheckCircle, XCircle,
    AlertCircle, User, Clock, Download, RefreshCw, ChevronLeft, ChevronRight,
    Eye, X, Building, Loader2, FileSpreadsheet, Users, TrendingUp, PieChart, Trash2, ChevronDown, ChevronUp,
    BookOpen, GraduationCap, Settings, Calendar, DollarSign, Plus, Save, CalendarOff, SlidersHorizontal, UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withRetry, deduplicatedFetch, AbortManager, appCache } from '../lib/queryUtils';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPie, Pie, LineChart, Line } from 'recharts';
import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';

// Interface for attendance details (from lecturer_attendance_details table)
interface AttendanceDetail {
    id: string;
    attendance_id: string;
    activity_type: 'mengajar' | 'sidang' | 'lainnya';
    // Lecture fields
    course_name?: string;
    course_code?: string;
    study_program_name?: string;
    class_group?: string;
    semester?: string;
    // Session fields
    session_schedule_id?: string;
    student_name?: string;
    student_nim?: string;
    session_type?: string;
    role_in_session?: string;
    // Common fields
    scheduled_date?: string;
    start_time?: string;
    end_time?: string;
    room_name?: string;
}

interface AttendanceRecord {
    id: string;
    lecturer_user_id: string;
    lecturer_name: string;
    attendance_date: string;
    attendance_time: string;
    photo_capture?: string;
    purpose: string;
    purpose_description?: string;
    schedule_type?: string;
    schedule_id?: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    verified_by?: string;
    verified_at?: string;
    verified_notes?: string;
    is_included_in_recap: boolean;
    study_program_id?: string;
    study_program?: { id: string; name: string } | null;
    created_at: string;
    // Extended: attendance details
    details?: AttendanceDetail[];
    // Homebase status from user
    is_homebase?: boolean;
    scanned_room_id?: string | null;
    scanned_room?: {
        id: string;
        name: string;
        building?: { id: string; name: string; campus_id: string | null } | null;
    } | null;
    additional_notes?: string; // Optional additional notes from lecturer
}

interface StudyProgram {
    id: string;
    name: string;
    code: string;
}

interface AttendanceStats {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
    byPurpose: { name: string; value: number; color: string }[];
    byStudyProgram: { name: string; count: number; lecturers: { name: string; count: number }[] }[];
    byLecturer: { name: string; count: number }[];
}

// Attendance Settings Interfaces
interface WeekSetting {
    id?: string;
    month: number;
    year: number;
    week_number: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

interface SpecialDate {
    id?: string;
    date: string;
    reason: string;
    month: number;
    year: number;
}

interface PaymentRate {
    id?: string;
    lecturer_type: 'HBV' | 'NHBV';
    rate: number;
    effective_month: number;
    effective_year: number;
}

interface LectureSchedule {
    id: string;
    lecturer: string;
    lecturer_user_id: string | null;  // Added for accurate matching
    day: string;
    course_name: string;
    course_code: string;
    subject_study: string;
}

const FinanceAttendance: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();

    const [activeTab, setActiveTab] = useState<'verification' | 'recap' | 'reports'>('verification');
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AttendanceStats | null>(null);

    // Filters
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });
    const [studyProgramFilter, setStudyProgramFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [campuses, setCampuses] = useState<{ id: string; name: string }[]>([]);
    const [campusFilter, setCampusFilter] = useState('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    const [totalCount, setTotalCount] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars

    // Modal states
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [selectedRecordDetails, setSelectedRecordDetails] = useState<AttendanceDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [loadingPhoto, setLoadingPhoto] = useState(false); // Lazy load photo state
    const [showImageModal, setShowImageModal] = useState(false);
    const [verificationNotes, setVerificationNotes] = useState('');
    const [processing, setProcessing] = useState(false);

    // Expanded study programs for reports
    const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());

    // Recap chart filter
    const [recapSelectedProdi, setRecapSelectedProdi] = useState<string>('');
    const [allLecturers, setAllLecturers] = useState<{ id: string; full_name: string; study_program_id: string | null; is_homebase?: boolean }[]>([]);

    // Attendance Settings States
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'weeks' | 'holidays' | 'rates' | 'limits'>('weeks');
    const [weekSettings, setWeekSettings] = useState<WeekSetting[]>([]);
    const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
    const [paymentRates, setPaymentRates] = useState<PaymentRate[]>([]);
    const [lectureSchedules, setLectureSchedules] = useState<LectureSchedule[]>([]);
    const [settingsMonth, setSettingsMonth] = useState(new Date().getMonth() + 1);
    const [settingsYear, setSettingsYear] = useState(new Date().getFullYear());
    const [savingSettings, setSavingSettings] = useState(false);

    // New Special Date form
    const [newSpecialDate, setNewSpecialDate] = useState({ date: '', reason: '' });

    // LPJ Date Selection - for single day LPJ report
    const [lpjDate, setLpjDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // New Week Setting form
    const [newWeekSetting, setNewWeekSetting] = useState<WeekSetting>({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        week_number: 1,
        start_date: '',
        end_date: '',
        is_active: true
    });

    // Global settings for disable attendance
    const [globalSettings, setGlobalSettings] = useState<{
        is_attendance_disabled: boolean;
        disabled_from_date: string | null;
        disabled_message: string;
        max_weekly_attendance_hbv: number;
        max_weekly_attendance_nhbv: number;
    }>({
        is_attendance_disabled: false,
        disabled_from_date: null,
        disabled_message: 'Presensi transport sedang ditutup',
        max_weekly_attendance_hbv: 3,
        max_weekly_attendance_nhbv: 2
    });

    // Manual Attendance Modal
    const [showManualAttendanceModal, setShowManualAttendanceModal] = useState(false);
    const [manualAttendance, setManualAttendance] = useState({
        lecturer_user_id: '',
        attendance_date: format(new Date(), 'yyyy-MM-dd'),
        attendance_time: format(new Date(), 'HH:mm'),
        purpose: 'mengajar' as 'mengajar' | 'sidang' | 'lainnya',
        purpose_description: '',
        additional_notes: ''
    });
    const [savingManualAttendance, setSavingManualAttendance] = useState(false);
    const [lecturerSearchTerm, setLecturerSearchTerm] = useState('');
    const [showLecturerDropdown, setShowLecturerDropdown] = useState(false);
    const lecturerDropdownRef = React.useRef<HTMLDivElement>(null);
    // AbortManager: cancel stale requests saat filter berubah sebelum response tiba
    const abortManager = React.useRef(new AbortManager()).current;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (lecturerDropdownRef.current && !lecturerDropdownRef.current.contains(e.target as Node)) {
                setShowLecturerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    // Fetch data on mount and filter changes
    useEffect(() => {
        fetchAttendanceRecords();
        fetchStudyPrograms();
        fetchAllLecturers();
        fetchLectureSchedules();
        fetchWeekSettings();
        fetchPaymentRates();
        fetchCampuses();
    }, [dateRange, studyProgramFilter, statusFilter, campusFilter]);

    const fetchCampuses = async () => {
        try {
            const { data, error } = await supabase
                .from('campus')
                .select('id, name')
                .order('name');

            if (error) throw error;
            setCampuses(data || []);
        } catch (error) {
            console.error('Error fetching campuses:', error);
        }
    };

    useEffect(() => {
        if (attendanceRecords.length > 0) {
            calculateStats();
        }
    }, [attendanceRecords]);

    const fetchStudyPrograms = async () => {
        // Cek cache dulu (TTL 10 menit) — list prodi jarang berubah
        const cached = appCache.get<StudyProgram[]>('study_programs');
        if (cached) { setStudyPrograms(cached); return; }
        try {
            const { data, error } = await withRetry(() =>
                supabase.from('study_programs').select('id, name, code').order('name')
            );
            if (error) throw error;
            appCache.set('study_programs', data || [], 10 * 60 * 1000); // cache 10 menit
            setStudyPrograms(data || []);
        } catch (error) {
            console.error('Error fetching study programs:', error);
        }
    };

    const fetchAttendanceRecords = async () => {
        // Cancel request sebelumnya jika ada (cegah race condition)
        abortManager.abort('fetchAttendance');

        try {
            setLoading(true);

            // deduplicatedFetch: bila dipanggil 2x bersamaan, hanya 1 request yg jalan
            const cacheKey = `attendance_${dateRange.start}_${dateRange.end}_${studyProgramFilter}_${statusFilter}_${campusFilter}`;

            const { data, count } = await deduplicatedFetch(cacheKey, () =>
                withRetry(
                    async () => {
                        let query = supabase
                            .from('lecturer_attendance')
                            .select(`
                                id,
                                lecturer_user_id,
                                lecturer_name,
                                attendance_date,
                                attendance_time,
                                purpose,
                                purpose_description,
                                schedule_type,
                                schedule_id,
                                verification_status,
                                verified_by,
                                verified_at,
                                verified_notes,
                                is_included_in_recap,
                                study_program_id,
                                scanned_room_id,
                                additional_notes,
                                created_at,
                                study_program:study_programs(id, name),
                                scanned_room:rooms(
                                    id,
                                    name,
                                    building:building(id, name, campus_id)
                                )
                            `)
                            .gte('attendance_date', dateRange.start)
                            .lte('attendance_date', dateRange.end)
                            .order('attendance_date', { ascending: false })
                            .order('attendance_time', { ascending: false });
                        // TIDAK ADA .range() — semua data dalam rentang tanggal diambil
                        // Paginasi 10/hal hanya untuk tampilan tabel, bukan batasan pengambilan

                        if (studyProgramFilter !== 'all' && studyProgramFilter !== 'non_homebase') {
                            query = query.eq('study_program_id', studyProgramFilter);
                        }
                        if (statusFilter !== 'all') {
                            query = query.eq('verification_status', statusFilter);
                        }

                        const result = await query;
                        if (result.error) throw result.error;
                        return { data: result.data };
                    },
                    {
                        maxRetries: 2,
                        baseDelayMs: 1500,
                        onRetry: (attempt, err) => {
                            console.warn(`[Attendance] Retry ${attempt} karena:`, (err as any)?.message || err);
                            toast.loading(`Mencoba ulang... (${attempt}/2)`, { id: 'retry-toast' });
                        },
                    }
                )
            ) as { data: any[] | null };

            toast.dismiss('retry-toast');

            // Fetch is_homebase untuk unique lecturer IDs
            const lecturerIds = [...new Set((data || []).map(r => r.lecturer_user_id).filter(Boolean))];
            let homebaseMap: Record<string, boolean> = {};

            if (lecturerIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, is_homebase')
                    .in('id', lecturerIds);

                if (usersData) {
                    usersData.forEach(u => {
                        homebaseMap[u.id] = u.is_homebase ?? true;
                    });
                }
            }

            let enrichedData = (data || []).map(r => ({
                ...r,
                is_homebase: homebaseMap[r.lecturer_user_id] ?? true
            }));

            if (studyProgramFilter === 'non_homebase') {
                enrichedData = enrichedData.filter(r => r.is_homebase === false);
            }

            if (campusFilter !== 'all') {
                enrichedData = enrichedData.filter(r => {
                    const scannedRoom = r.scanned_room as any;
                    return scannedRoom?.building?.campus_id === campusFilter;
                });
            }

            setAttendanceRecords(enrichedData as unknown as AttendanceRecord[]);
            setTotalCount(enrichedData.length); // eslint-disable-line @typescript-eslint/no-unused-vars
            setCurrentPage(1);
        } catch (error: any) {
            toast.dismiss('retry-toast');
            // Abaikan error AbortError (request di-cancel karena filter berubah)
            if (error?.name === 'AbortError') return;
            console.error('Error fetching attendance:', error);
            toast.error(
                error?.code === '57014'
                    ? 'Query timeout — coba perkecil rentang tanggal atau gunakan filter'
                    : 'Gagal memuat data presensi'
            );
        } finally {
            setLoading(false);
        }
    };

    const fetchAllLecturers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, study_program_id, is_homebase')
                .eq('role', 'lecturer')
                .order('full_name');

            if (error) throw error;
            setAllLecturers(data || []);
        } catch (error) {
            console.error('Error fetching lecturers:', error);
        }
    };

    // Fetch Attendance Settings
    const fetchWeekSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('attendance_week_settings')
                .select('*')
                .eq('month', settingsMonth)
                .eq('year', settingsYear)
                .order('week_number');

            if (error) throw error;
            setWeekSettings(data || []);
        } catch (error) {
            console.error('Error fetching week settings:', error);
        }
    };

    const fetchSpecialDates = async () => {
        try {
            const { data, error } = await supabase
                .from('attendance_special_dates')
                .select('*')
                .eq('month', settingsMonth)
                .eq('year', settingsYear)
                .order('date');

            if (error) throw error;
            setSpecialDates(data || []);
        } catch (error) {
            console.error('Error fetching special dates:', error);
        }
    };

    const fetchPaymentRates = async () => {
        try {
            const { data, error } = await supabase
                .from('attendance_payment_rates')
                .select('*')
                .eq('effective_month', settingsMonth)
                .eq('effective_year', settingsYear);

            if (error) throw error;
            setPaymentRates(data || []);
        } catch (error) {
            console.error('Error fetching payment rates:', error);
        }
    };

    const fetchLectureSchedules = async () => {
        try {
            // Supabase defaults to max 1000 rows per query
            // We need to paginate to get ALL lecture schedules
            const PAGE_SIZE = 1000;
            let allData: LectureSchedule[] = [];
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                const from = page * PAGE_SIZE;
                const to = from + PAGE_SIZE - 1;

                const { data, error } = await supabase
                    .from('lecture_schedules')
                    .select('id, lecturer, lecturer_user_id, day, course_name, course_code, subject_study')
                    .range(from, to);

                if (error) throw error;

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    // If we got less than PAGE_SIZE, we've reached the end
                    hasMore = data.length === PAGE_SIZE;
                    page++;
                } else {
                    hasMore = false;
                }
            }

            console.log('📅 Fetched ALL lecture schedules:', allData.length, 'records (in', page, 'pages)');
            setLectureSchedules(allData);
        } catch (error) {
            console.error('Error fetching lecture schedules:', error);
        }
    };

    // Save Week Setting
    const handleSaveWeekSetting = async () => {
        if (!newWeekSetting.start_date || !newWeekSetting.end_date) {
            toast.error('Tanggal mulai dan akhir harus diisi');
            return;
        }
        try {
            setSavingSettings(true);
            const { error } = await supabase
                .from('attendance_week_settings')
                .upsert({
                    ...newWeekSetting,
                    month: settingsMonth,
                    year: settingsYear,
                    created_by: profile?.id
                }, { onConflict: 'month,year,week_number' });

            if (error) throw error;
            toast.success('Pengaturan minggu berhasil disimpan');
            fetchWeekSettings();
            setNewWeekSetting({ ...newWeekSetting, start_date: '', end_date: '' });
        } catch (error) {
            console.error('Error saving week setting:', error);
            toast.error('Gagal menyimpan pengaturan minggu');
        } finally {
            setSavingSettings(false);
        }
    };

    // Save Special Date
    const handleSaveSpecialDate = async () => {
        if (!newSpecialDate.date || !newSpecialDate.reason) {
            toast.error('Tanggal dan alasan harus diisi');
            return;
        }
        try {
            setSavingSettings(true);
            const dateObj = new Date(newSpecialDate.date);
            const { error } = await supabase
                .from('attendance_special_dates')
                .insert({
                    date: newSpecialDate.date,
                    reason: newSpecialDate.reason,
                    month: dateObj.getMonth() + 1,
                    year: dateObj.getFullYear(),
                    created_by: profile?.id
                });

            if (error) throw error;
            toast.success('Tanggal khusus berhasil ditambahkan');
            fetchSpecialDates();
            setNewSpecialDate({ date: '', reason: '' });
        } catch (error) {
            console.error('Error saving special date:', error);
            toast.error('Gagal menyimpan tanggal khusus');
        } finally {
            setSavingSettings(false);
        }
    };

    // Delete Special Date
    const handleDeleteSpecialDate = async (id: string) => {
        try {
            const { error } = await supabase
                .from('attendance_special_dates')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Tanggal khusus berhasil dihapus');
            fetchSpecialDates();
        } catch (error) {
            console.error('Error deleting special date:', error);
            toast.error('Gagal menghapus tanggal khusus');
        }
    };

    // Save Payment Rate
    const handleSavePaymentRate = async (type: 'HBV' | 'NHBV', rate: number) => {
        try {
            setSavingSettings(true);
            const { error } = await supabase
                .from('attendance_payment_rates')
                .upsert({
                    lecturer_type: type,
                    rate: rate,
                    effective_month: settingsMonth,
                    effective_year: settingsYear,
                    created_by: profile?.id
                }, { onConflict: 'lecturer_type,effective_month,effective_year' });

            if (error) throw error;
            toast.success(`Tarif ${type} berhasil disimpan`);
            fetchPaymentRates();
        } catch (error) {
            console.error('Error saving payment rate:', error);
            toast.error('Gagal menyimpan tarif');
        } finally {
            setSavingSettings(false);
        }
    };

    // Fetch global settings
    const fetchGlobalSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('attendance_global_settings')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Error fetching global settings:', error);
                return;
            }

            if (data) {
                setGlobalSettings({
                    is_attendance_disabled: data.is_attendance_disabled || false,
                    disabled_from_date: data.disabled_from_date || null,
                    disabled_message: data.disabled_message || 'Presensi transport sedang ditutup',
                    max_weekly_attendance_hbv: data.max_weekly_attendance_hbv ?? 3,
                    max_weekly_attendance_nhbv: data.max_weekly_attendance_nhbv ?? 2
                });
            }
        } catch (error) {
            console.error('Error fetching global settings:', error);
        }
    };

    // Save global settings (disable attendance)
    const handleSaveGlobalSettings = async () => {
        try {
            setSavingSettings(true);

            // Check if row exists
            const { data: existing } = await supabase
                .from('attendance_global_settings')
                .select('id')
                .limit(1)
                .maybeSingle();

            if (existing) {
                // Update existing row
                const { error } = await supabase
                    .from('attendance_global_settings')
                    .update({
                        is_attendance_disabled: globalSettings.is_attendance_disabled,
                        disabled_from_date: globalSettings.disabled_from_date,
                        disabled_message: globalSettings.disabled_message,
                        max_weekly_attendance_hbv: globalSettings.max_weekly_attendance_hbv,
                        max_weekly_attendance_nhbv: globalSettings.max_weekly_attendance_nhbv,
                        updated_by: profile?.id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                // Insert new row
                const { error } = await supabase
                    .from('attendance_global_settings')
                    .insert({
                        is_attendance_disabled: globalSettings.is_attendance_disabled,
                        disabled_from_date: globalSettings.disabled_from_date,
                        disabled_message: globalSettings.disabled_message,
                        max_weekly_attendance_hbv: globalSettings.max_weekly_attendance_hbv,
                        max_weekly_attendance_nhbv: globalSettings.max_weekly_attendance_nhbv,
                        updated_by: profile?.id
                    });

                if (error) throw error;
            }

            toast.success('Pengaturan presensi berhasil disimpan');
        } catch (error) {
            console.error('Error saving global settings:', error);
            toast.error('Gagal menyimpan pengaturan');
        } finally {
            setSavingSettings(false);
        }
    };

    // Handle Manual Attendance Save
    const handleSaveManualAttendance = async () => {
        if (!manualAttendance.lecturer_user_id) {
            toast.error('Pilih dosen terlebih dahulu');
            return;
        }
        if (!manualAttendance.attendance_date || !manualAttendance.attendance_time) {
            toast.error('Tanggal dan waktu harus diisi');
            return;
        }

        try {
            setSavingManualAttendance(true);

            // Find selected lecturer info
            const selectedLecturer = allLecturers.find(l => l.id === manualAttendance.lecturer_user_id);
            if (!selectedLecturer) {
                toast.error('Dosen tidak ditemukan');
                return;
            }

            const { error } = await supabase
                .from('lecturer_attendance')
                .insert({
                    lecturer_user_id: manualAttendance.lecturer_user_id,
                    lecturer_name: selectedLecturer.full_name,
                    attendance_date: manualAttendance.attendance_date,
                    attendance_time: manualAttendance.attendance_time + ':00',
                    purpose: manualAttendance.purpose,
                    purpose_description: manualAttendance.purpose_description || null,
                    additional_notes: manualAttendance.additional_notes
                        ? `[Input Manual oleh Admin] ${manualAttendance.additional_notes}`
                        : '[Input Manual oleh Admin]',
                    study_program_id: selectedLecturer.study_program_id || null,
                    verification_status: 'verified',
                    verified_by: profile?.id,
                    verified_at: new Date().toISOString(),
                    verified_notes: 'Input manual oleh admin',
                    is_included_in_recap: true,
                    schedule_type: 'manual'
                });

            if (error) throw error;

            toast.success(`Presensi ${selectedLecturer.full_name} berhasil ditambahkan`);
            setShowManualAttendanceModal(false);
            setLecturerSearchTerm('');
            setManualAttendance({
                lecturer_user_id: '',
                attendance_date: format(new Date(), 'yyyy-MM-dd'),
                attendance_time: format(new Date(), 'HH:mm'),
                purpose: 'mengajar',
                purpose_description: '',
                additional_notes: ''
            });
            fetchAttendanceRecords();
        } catch (error: any) {
            console.error('Error saving manual attendance:', error);
            toast.error('Gagal menyimpan presensi manual');
        } finally {
            setSavingManualAttendance(false);
        }
    };

    // Fetch settings when modal opens or month/year changes
    useEffect(() => {
        if (showSettingsModal) {
            fetchWeekSettings();
            fetchSpecialDates();
            fetchPaymentRates();
            fetchLectureSchedules();
            fetchGlobalSettings();
        }
    }, [showSettingsModal, settingsMonth, settingsYear]);

    const calculateStats = () => {
        const total = attendanceRecords.length;
        const verified = attendanceRecords.filter(r => r.verification_status === 'verified').length;
        const pending = attendanceRecords.filter(r => r.verification_status === 'pending').length;
        const rejected = attendanceRecords.filter(r => r.verification_status === 'rejected').length;

        // FILTER: Only use APPROVED/VERIFIED records for charts and breakdown
        const validRecords = attendanceRecords.filter(r => r.verification_status === 'verified');

        // By purpose
        const purposeCounts: Record<string, number> = {};
        validRecords.forEach(r => {
            const purpose = r.purpose || 'lainnya';
            purposeCounts[purpose] = (purposeCounts[purpose] || 0) + 1;
        });
        const byPurpose = Object.entries(purposeCounts).map(([name, value]) => ({
            name: name === 'mengajar' ? 'Mengajar' : name === 'sidang' ? 'Sidang' : 'Lainnya',
            value,
            color: name === 'mengajar' ? '#3B82F6' : name === 'sidang' ? '#10B981' : '#F59E0B'
        }));

        // By study program with per-lecturer breakdown
        // Non-homebase lecturers are grouped separately as "Dosen Non Homebase"
        const spData: Record<string, { count: number; lecturers: Record<string, number>; isNonHomebase?: boolean }> = {};
        validRecords.forEach(r => {
            // Check if lecturer is non-homebase
            if (r.is_homebase === false) {
                const key = '🏠 Dosen Non Homebase';
                if (!spData[key]) {
                    spData[key] = { count: 0, lecturers: {}, isNonHomebase: true };
                }
                spData[key].count += 1;
                const lecturerName = r.lecturer_name || 'Tidak Diketahui';
                spData[key].lecturers[lecturerName] = (spData[key].lecturers[lecturerName] || 0) + 1;
            } else {
                const spName = r.study_program?.name || 'Tidak Diketahui';
                if (!spData[spName]) {
                    spData[spName] = { count: 0, lecturers: {} };
                }
                spData[spName].count += 1;
                const lecturerName = r.lecturer_name || 'Tidak Diketahui';
                spData[spName].lecturers[lecturerName] = (spData[spName].lecturers[lecturerName] || 0) + 1;
            }
        });

        const byStudyProgram = Object.entries(spData)
            .map(([name, data]) => ({
                name,
                count: data.count,
                lecturers: Object.entries(data.lecturers)
                    .map(([lecName, lecCount]) => ({ name: lecName, count: lecCount }))
                    .sort((a, b) => b.count - a.count)
            }))
            .sort((a, b) => b.count - a.count);

        // By lecturer (top 10)
        const lecturerCounts: Record<string, number> = {};
        validRecords.forEach(r => {
            const name = r.lecturer_name || 'Tidak Diketahui';
            lecturerCounts[name] = (lecturerCounts[name] || 0) + 1;
        });
        const byLecturer = Object.entries(lecturerCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        setStats({ total, verified, pending, rejected, byPurpose, byStudyProgram, byLecturer });
    };

    // Lecturer chart data filtered by selected study program AND verified status
    const lecturerChartData = useMemo(() => {
        const validRecords = attendanceRecords.filter(r => r.verification_status === 'verified');

        if (!recapSelectedProdi) {
            // If no prodi selected, show top 10 overall
            const lecturerCounts: Record<string, number> = {};
            validRecords.forEach(r => {
                const name = r.lecturer_name || 'Tidak Diketahui';
                lecturerCounts[name] = (lecturerCounts[name] || 0) + 1;
            });
            return Object.entries(lecturerCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
        }

        // Handle non-homebase filter
        if (recapSelectedProdi === 'non_homebase') {
            // Get all non-homebase lecturers
            const nonHomebaseLecturers = allLecturers.filter((l: any) => l.is_homebase === false);

            // Count attendance for non-homebase lecturers
            const lecturerCounts: Record<string, number> = {};
            validRecords
                .filter(r => r.is_homebase === false)
                .forEach(r => {
                    const name = r.lecturer_name || 'Tidak Diketahui';
                    lecturerCounts[name] = (lecturerCounts[name] || 0) + 1;
                });

            // Create data with ALL non-homebase lecturers (including those with 0 attendance)
            return nonHomebaseLecturers
                .map(l => ({
                    name: l.full_name,
                    count: lecturerCounts[l.full_name] || 0
                }))
                .sort((a, b) => b.count - a.count);
        }

        // Get all lecturers from selected prodi
        const prodiLecturers = allLecturers.filter(l => l.study_program_id === recapSelectedProdi);

        // Count attendance for each lecturer
        const lecturerCounts: Record<string, number> = {};
        validRecords
            .filter(r => r.study_program_id === recapSelectedProdi)
            .forEach(r => {
                const name = r.lecturer_name || 'Tidak Diketahui';
                lecturerCounts[name] = (lecturerCounts[name] || 0) + 1;
            });

        // Create data with ALL lecturers (including those with 0 attendance)
        return prodiLecturers
            .map(l => ({
                name: l.full_name,
                count: lecturerCounts[l.full_name] || 0
            }))
            .sort((a, b) => b.count - a.count);
    }, [recapSelectedProdi, attendanceRecords, allLecturers]);

    // Fetch attendance details when a record is selected
    const fetchAttendanceDetails = async (attendanceId: string) => {
        try {
            setLoadingDetails(true);
            setSelectedRecordDetails([]);

            const { data, error } = await supabase
                .from('lecturer_attendance_details')
                .select('*')
                .eq('attendance_id', attendanceId)
                .order('start_time', { ascending: true });

            if (error) {
                console.warn('Error fetching attendance details:', error);
                // Table might not exist yet, don't show error
                return;
            }

            setSelectedRecordDetails(data || []);
        } catch (error) {
            console.warn('Error fetching attendance details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    // Handle selecting a record (fetch details + photo lazily)
    const handleSelectRecord = async (record: AttendanceRecord) => {
        setSelectedRecord(record);
        setVerificationNotes(record.verified_notes || '');
        setLoadingPhoto(true); // Mulai skeleton foto

        // Fetch details dan photo secara parallel — keduanya lazy
        await Promise.all([
            fetchAttendanceDetails(record.id),

            // Lazy fetch photo_capture — hanya dipanggil saat modal dibuka
            supabase
                .from('lecturer_attendance')
                .select('id, photo_capture')
                .eq('id', record.id)
                .maybeSingle()
                .then(({ data: photoData }) => {
                    if (photoData?.photo_capture) {
                        setSelectedRecord(prev =>
                            prev ? { ...prev, photo_capture: photoData.photo_capture } : prev
                        );
                    }
                })
                .finally(() => setLoadingPhoto(false))
        ]);
    };

    const handleVerify = async (status: 'verified' | 'rejected') => {
        if (!selectedRecord) return;

        try {
            setProcessing(true);
            const { error } = await supabase
                .from('lecturer_attendance')
                .update({
                    verification_status: status,
                    verified_by: profile?.id,
                    verified_at: new Date().toISOString(),
                    verified_notes: verificationNotes,
                    is_included_in_recap: status === 'verified'
                })
                .eq('id', selectedRecord.id);

            if (error) throw error;

            toast.success(status === 'verified' ? 'Presensi berhasil diverifikasi' : 'Presensi ditolak');
            setSelectedRecord(null);
            setVerificationNotes('');
            fetchAttendanceRecords();
        } catch (error: any) {
            console.error('Error updating verification:', error);
            toast.error('Gagal memproses verifikasi');
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (recordId: string, lecturerName: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus data presensi ${lecturerName}?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('lecturer_attendance')
                .delete()
                .eq('id', recordId);

            if (error) throw error;

            toast.success('Data presensi berhasil dihapus');
            fetchAttendanceRecords();
        } catch (error: any) {
            console.error('Error deleting attendance:', error);
            toast.error('Gagal menghapus data presensi');
        }
    };

    const exportToPDF = () => {
        try {
            const verifiedRecords = attendanceRecords.filter(r => r.verification_status === 'verified');
            if (verifiedRecords.length === 0) {
                toast.error('Tidak ada data terverifikasi untuk diekspor');
                return;
            }

            const doc = new jsPDF();

            // Header
            doc.setFontSize(18);
            doc.setTextColor(40, 40, 40);
            doc.text('Rekap Kehadiran Dosen', 20, 20);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Periode: ${format(new Date(dateRange.start), 'd MMM yyyy', { locale: localeId })} - ${format(new Date(dateRange.end), 'd MMM yyyy', { locale: localeId })}`, 20, 30);
            doc.text(`Dibuat: ${format(new Date(), 'd MMMM yyyy HH:mm', { locale: localeId })}`, 20, 36);
            doc.text(`Total: ${verifiedRecords.length} kehadiran terverifikasi`, 20, 42);

            // Table header
            let y = 55;
            doc.setFillColor(59, 130, 246);
            doc.rect(20, y - 6, 170, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('No', 25, y);
            doc.text('Nama Dosen', 35, y);
            doc.text('Tanggal', 95, y);
            doc.text('Waktu', 125, y);
            doc.text('Tujuan', 150, y);

            y += 10;
            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);

            verifiedRecords.forEach((record, index) => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }

                if (index % 2 === 0) {
                    doc.setFillColor(245, 247, 250);
                    doc.rect(20, y - 5, 170, 8, 'F');
                }

                doc.text((index + 1).toString(), 25, y);
                doc.text(record.lecturer_name.substring(0, 30), 35, y);
                doc.text(format(new Date(record.attendance_date), 'dd/MM/yyyy'), 95, y);
                doc.text(record.attendance_time?.substring(0, 5) || '-', 125, y);
                doc.text(record.purpose === 'mengajar' ? 'Mengajar' : record.purpose === 'sidang' ? 'Sidang' : 'Lainnya', 150, y);

                y += 8;
            });

            // Footer
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(`Halaman ${i} dari ${pageCount} - SIMPEL Kuliah`, 20, 285);
            }

            doc.save(`Rekap_Kehadiran_Dosen_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast.success('PDF berhasil diunduh');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Gagal membuat PDF');
        }
    };

    // ==========================================
    // LAMPIRAN LPJ PDF GENERATOR
    // Format: DAFTAR HADIR DOSEN (HOME BASE / NON HOME BASE)
    // Per-day report (single date)
    // ==========================================
    // ==========================================
    // LAMPIRAN LPJ PDF GENERATOR (REFINED)
    // ==========================================
    const generateLPJPDF = async (type: 'homebase' | 'non_homebase', selectedDate: string) => {
        console.log(`Starting generateLPJPDF for ${type} on ${selectedDate}`);
        try {
            const recordsForDate = attendanceRecords.filter(r =>
                r.verification_status === 'verified' &&
                r.attendance_date === selectedDate
            );

            console.log(`Found ${recordsForDate.length} verified records for date ${selectedDate}`);

            if (recordsForDate.length === 0) {
                toast.error(`Tidak ada data terverifikasi untuk tanggal ${format(new Date(selectedDate), 'd MMMM yyyy', { locale: localeId })}`);
                return;
            }

            // Group records
            const lecturerMap = new Map<string, {
                lecturerId: string;
                lecturerName: string;
                prodi: string;
                courses: string[];
                classes: string[];
                signatureUrl: string | null;
                isHomebase: boolean;
            }>();

            recordsForDate.forEach(record => {
                const isHomebase = record.is_homebase ?? true;
                if (type === 'homebase' && !isHomebase) return;
                if (type === 'non_homebase' && isHomebase) return;

                const key = record.lecturer_user_id;
                const details = record.details || [];

                let courses = details.map((d: any) => d?.course_name).filter(Boolean);
                // Deduplicate courses immediately
                courses = [...new Set(courses)];

                // Fallback to purpose if no courses
                if (courses.length === 0) {
                    const purpose = record.purpose_description || record.purpose;
                    if (purpose) courses = [purpose];
                }

                let classesRaw = details.map((d: any) => d?.class_group).filter(Boolean);
                // Format and Dedupe classes
                let classes = [...new Set(classesRaw.map((c: string) => {
                    const s = String(c);
                    return s.toLowerCase().includes('rombel') ? s : `rombel ${s}`;
                }))];

                if (classes.length === 0) classes = ['-'];

                let prodi = '';
                if (details.length > 0) {
                    // Extract unique prodis from details
                    const prodis = details.map((d: any) => d?.study_program_name).filter(Boolean);
                    const uniqueProdis = [...new Set(prodis)];

                    if (uniqueProdis.length > 0) {
                        prodi = uniqueProdis.join(', ');
                    } else {
                        prodi = record.study_program?.name || '-';
                    }
                } else {
                    prodi = record.study_program?.name || '-';
                }

                if (lecturerMap.has(key)) {
                    const existing = lecturerMap.get(key)!;
                    courses.forEach(c => { if (!existing.courses.includes(c)) existing.courses.push(c); });
                    classes.forEach(c => { if (!existing.classes.includes(c)) existing.classes.push(c); });
                } else {
                    lecturerMap.set(key, {
                        lecturerId: record.lecturer_user_id,
                        lecturerName: record.lecturer_name || 'Unknown',
                        prodi: prodi,
                        courses: courses,
                        classes: classes,
                        signatureUrl: (record as any).signature_url || null,
                        isHomebase: isHomebase
                    });
                }
            });

            const entries = Array.from(lecturerMap.values());
            if (entries.length === 0) {
                toast.error(`Tidak ada data dosen ${type === 'homebase' ? 'homebase' : 'non-homebase'} untuk tanggal tersebut`);
                return;
            }

            const doc = new jsPDF();
            const dateObj = new Date(selectedDate);

            // Header
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`DAFTAR HADIR DOSEN (${type === 'homebase' ? 'HOME BASE' : 'NON HOME BASE'}) FAKULTAS VOKASI`, 105, 15, { align: 'center' });
            doc.setFontSize(10);
            doc.text('SEMESTER GENAP TAHUN 2025/2026', 105, 22, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(`HARI         : ${format(dateObj, 'EEEE', { locale: localeId }).toUpperCase()}`, 14, 35);
            doc.text(`TANGGAL   : ${format(dateObj, 'd MMMM yyyy', { locale: localeId })}`, 14, 42);

            // Table Config - Adjusted widths for font size 11
            const tableStartY = 50;
            // NO(10), NAMA(42), PRODI(32), MATA KULIAH(45), KELAS(25), TTD(28) = 182mm total
            const colWidths = [10, 42, 32, 45, 25, 28];
            const headers = ['NO', 'NAMA', 'PRODI', 'MATA KULIAH', 'KELAS', 'TTD'];
            const tableWidth = colWidths.reduce((a, b) => a + b, 0);

            // Draw Header
            let x = 14;
            doc.setFillColor(240, 240, 240);
            doc.rect(14, tableStartY, tableWidth, 10, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);

            headers.forEach((header, i) => {
                doc.text(header, x + 2, tableStartY + 7);
                x += colWidths[i];
            });

            // Draw Rows with font size 11
            doc.setFont('helvetica', 'normal');
            let currentY = tableStartY + 10;
            const maxRowHeight = 14; // Increased for font size 11

            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];

                // Check if we need a new page (leave space for potential QR)
                if (currentY + maxRowHeight > 270) {
                    doc.addPage();
                    currentY = 20;

                    // Redraw header on new page
                    doc.setFillColor(240, 240, 240);
                    doc.rect(14, currentY, tableWidth, 10, 'FD');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    x = 14;
                    headers.forEach((header, idx) => {
                        doc.text(header, x + 2, currentY + 7);
                        x += colWidths[idx];
                    });
                    doc.setFont('helvetica', 'normal');
                    currentY += 10;
                }

                x = 14;
                doc.setFontSize(11);

                // Draw row borders
                let tempX = x;
                colWidths.forEach(width => {
                    doc.rect(tempX, currentY, width, maxRowHeight);
                    tempX += width;
                });

                // NO
                doc.text((i + 1).toString(), x + 3, currentY + 9);
                x += colWidths[0];

                // NAME - use smaller font if text is too long
                doc.setFontSize(10);
                let nameLines = doc.splitTextToSize(entry.lecturerName, colWidths[1] - 4);
                if (nameLines.length > 2) {
                    doc.setFontSize(8);
                    nameLines = doc.splitTextToSize(entry.lecturerName, colWidths[1] - 4);
                    if (nameLines.length > 2) {
                        nameLines = nameLines.slice(0, 2);
                        nameLines[1] = nameLines[1]?.substring(0, nameLines[1].length - 3) + '...';
                    }
                }
                doc.text(nameLines, x + 2, currentY + 6);
                doc.setFontSize(11);
                x += colWidths[1];

                // PRODI
                doc.setFontSize(10);
                let prodiLines = doc.splitTextToSize(entry.prodi, colWidths[2] - 4);
                if (prodiLines.length > 2) {
                    doc.setFontSize(8);
                    prodiLines = doc.splitTextToSize(entry.prodi, colWidths[2] - 4);
                    if (prodiLines.length > 2) {
                        prodiLines = prodiLines.slice(0, 2);
                        prodiLines[1] = prodiLines[1]?.substring(0, prodiLines[1].length - 3) + '...';
                    }
                }
                doc.text(prodiLines, x + 2, currentY + 6);
                doc.setFontSize(11);
                x += colWidths[2];

                // MATA KULIAH
                doc.setFontSize(10);
                let mkText = entry.courses.join(', ');
                let mkLines = doc.splitTextToSize(mkText, colWidths[3] - 4);
                if (mkLines.length > 2) {
                    doc.setFontSize(8);
                    mkLines = doc.splitTextToSize(mkText, colWidths[3] - 4);
                    if (mkLines.length > 2) {
                        mkLines = mkLines.slice(0, 2);
                        mkLines[1] = mkLines[1]?.substring(0, mkLines[1].length - 3) + '...';
                    }
                }
                doc.text(mkLines, x + 2, currentY + 6);
                doc.setFontSize(11);
                x += colWidths[3];

                // KELAS
                doc.setFontSize(10);
                const kelasText = entry.classes.join(', ');
                let kelasLines = doc.splitTextToSize(kelasText, colWidths[4] - 4);
                if (kelasLines.length > 2) {
                    doc.setFontSize(8);
                    kelasLines = doc.splitTextToSize(kelasText, colWidths[4] - 4);
                    if (kelasLines.length > 2) {
                        kelasLines = kelasLines.slice(0, 2);
                        kelasLines[1] = kelasLines[1]?.substring(0, kelasLines[1].length - 3) + '...';
                    }
                }
                doc.text(kelasLines, x + 2, currentY + 6);
                doc.setFontSize(11);
                x += colWidths[4];

                // TTD (Signature)
                if (entry.signatureUrl) {
                    try {
                        doc.addImage(entry.signatureUrl, 'PNG', x + 2, currentY + 2, 24, 10);
                    } catch (e) {
                        doc.text('-', x + colWidths[5] / 2, currentY + 9, { align: 'center' });
                    }
                } else {
                    doc.text('-', x + colWidths[5] / 2, currentY + 9, { align: 'center' });
                }

                currentY += maxRowHeight;
            }

            // ============================================
            // QR CODE POSITIONED BELOW TABLE (DYNAMIC)
            // Following the table rows, right-aligned
            // ============================================
            const qrSize = 30; // QR code size (30mm x 30mm)
            const qrX = 14 + tableWidth - qrSize; // Right side of table
            let qrY = currentY + 10; // 10mm below the last row

            // If QR would go off page, add new page
            if (qrY + qrSize + 10 > 280) {
                doc.addPage();
                qrY = 30;
            }

            // QR code URL pointing to the new daily attendance detail page
            const detailUrl = `${window.location.origin}/#/attendance-daily-detail?date=${selectedDate}&type=${type}`;

            try {
                const qrDataUrl = await QRCode.toDataURL(detailUrl, { margin: 1, width: 200, errorCorrectionLevel: 'M' });

                // Draw label above QR
                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                doc.text('Scan untuk verifikasi:', qrX, qrY - 3);

                // Draw QR code
                doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

                // Draw border around QR
                doc.setDrawColor(180, 180, 180);
                doc.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2);

            } catch (qrErr) {
                console.error('QR generation error:', qrErr);
            }

            // Page Numbers
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(10);
                doc.text(`Halaman ${i} dari ${pageCount}`, 105, 290, { align: 'center' });
            }

            const typeLabel = type === 'homebase' ? 'Homebase' : 'Non_Homebase';
            const filename = `Lampiran_LPJ_${typeLabel}_${format(new Date(selectedDate), 'yyyy-MM-dd')}.pdf`;
            doc.save(filename);
            toast.success(`Lampiran LPJ berhasil diunduh`);

        } catch (error) {
            console.error('Error generating LPJ PDF:', error);
            if (error instanceof Error) console.error('Stack:', error.stack);
            toast.error('Gagal membuat PDF');
        }
    };

    const exportToExcel = async () => {
        try {
            const verifiedRecords = attendanceRecords.filter(r => r.verification_status === 'verified');
            if (verifiedRecords.length === 0) {
                toast.error('Tidak ada data terverifikasi untuk diekspor');
                return;
            }

            // ─── FETCH BATAS MINGGUAN LANGSUNG DARI DATABASE ──────────────
            // Jangan pakai state globalSettings — mungkin belum ter-load
            // jika admin belum buka modal settings sebelum export.
            const { data: dbSettings, error: settingsError } = await supabase
                .from('attendance_global_settings')
                .select('max_weekly_attendance_hbv, max_weekly_attendance_nhbv')
                .limit(1)
                .maybeSingle();

            if (settingsError) {
                console.error('Gagal fetch batas mingguan dari DB:', settingsError);
            }

            // Gunakan nilai DB, fallback ke 3/2 jika belum ada setting
            const maxWeeklyHBV: number = dbSettings?.max_weekly_attendance_hbv ?? 3;
            const maxWeeklyNHBV: number = dbSettings?.max_weekly_attendance_nhbv ?? 2;

            console.log(`📋 Batas minggu dari DB: HBV=${maxWeeklyHBV}x, NHBV=${maxWeeklyNHBV}x`);

            // ─── FETCH HARI LIBUR (SPECIAL DATES) ─────────────────────────
            const exportMonth = dateRange.start ? new Date(dateRange.start).getMonth() + 1 : new Date().getMonth() + 1;
            const exportYear = dateRange.start ? new Date(dateRange.start).getFullYear() : new Date().getFullYear();

            const { data: holidayData } = await supabase
                .from('attendance_special_dates')
                .select('*')
                .eq('month', exportMonth)
                .eq('year', exportYear)
                .order('date');

            const currentSpecialDates = holidayData || [];

            // ─── FETCH WEEK SETTINGS LANGSUNG DARI DB (berdasarkan bulan export) ──
            // PENTING: Jangan pakai state weekSettings — state itu mengikuti settingsMonth
            // yang defaultnya = bulan saat ini. Saat export bulan lalu, weekSettings state
            // akan berisi data bulan ini → kolom tanggal tidak muncul / salah bulan.
            const { data: weekSettingsData, error: weekSettingsError } = await supabase
                .from('attendance_week_settings')
                .select('*')
                .eq('month', exportMonth)
                .eq('year', exportYear)
                .order('week_number');

            if (weekSettingsError) {
                console.error('Gagal fetch week settings dari DB:', weekSettingsError);
            }

            const exportWeekSettings: WeekSetting[] = weekSettingsData || [];
            console.log(`📅 Week settings dari DB untuk ${exportMonth}/${exportYear}:`, exportWeekSettings.length, 'minggu');

            if (exportWeekSettings.length === 0) {
                toast.error(`Tidak ada pengaturan minggu untuk bulan ${exportMonth}/${exportYear}. Silakan atur di menu Pengaturan terlebih dahulu.`);
                return;
            }

            // ─── FETCH PAYMENT RATES LANGSUNG DARI DB (berdasarkan bulan export) ──
            // Sama seperti weekSettings, paymentRates state bisa berisi data bulan lain.
            const { data: paymentRatesData } = await supabase
                .from('attendance_payment_rates')
                .select('*')
                .eq('effective_month', exportMonth)
                .eq('effective_year', exportYear);

            const exportPaymentRates: PaymentRate[] = paymentRatesData || [];
            console.log(`💰 Payment rates dari DB untuk ${exportMonth}/${exportYear}:`, exportPaymentRates);

            // 🔍 DEBUG: Comprehensive logging
            console.log('📊 Export Excel Debug:');
            console.log('- Lecture Schedules Count:', lectureSchedules.length);
            console.log('- Week Settings Count (DB):', exportWeekSettings.length);
            console.log('- Week Settings (DB):', exportWeekSettings);
            console.log('- Special Dates Count:', currentSpecialDates.length);
            console.log('- Special Dates:', currentSpecialDates);
            console.log('- Verified Records Count:', verifiedRecords.length);
            console.log('- Sample Verified Records:', verifiedRecords.slice(0, 3).map(r => ({ name: r.lecturer_name, date: r.attendance_date })));

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Rekap Kehadiran');


            // --- DATA PREPARATION ---
            // Helper to get day abbreviation
            const getDayAbbr = (dayName: string): string => {
                const abbrs: Record<string, string> = {
                    'senin': 'SN', 'selasa': 'SL', 'rabu': 'R', 'kamis': 'K', 'jumat': 'J',
                    'monday': 'SN', 'tuesday': 'SL', 'wednesday': 'R', 'thursday': 'K', 'friday': 'J'
                };
                return abbrs[dayName.toLowerCase()] || '';
            };

            // Helper to get Roman numeral
            const toRoman = (num: number): string => {
                const romans = ['I', 'II', 'III', 'IV', 'V', 'VI'];
                return romans[num - 1] || num.toString();
            };

            // Sort week settings — gunakan data dari DB langsung (exportWeekSettings)
            const sortedWeeks = [...exportWeekSettings].sort((a, b) => a.week_number - b.week_number);

            // If no weeks defined, create a default structure (not ideal but fallback)
            // But user said "Based on Finance Settings", so we rely on sortedWeeks being populated.


            const lecturerMap = new Map<string, {
                name: string;
                prodiSet: Set<string>; // For Homebase (User's prodi)
                teachingProdisSet: Set<string>; // For Teaching Prodi (From Details)
                is_homebase: boolean;
                dates: string[];
                lecturer_user_id: string | null;
            }>();

            verifiedRecords.forEach(r => {
                const key = r.lecturer_name;
                const homebaseProdiName = r.study_program?.name || '-';

                if (!lecturerMap.has(key)) {
                    lecturerMap.set(key, {
                        name: r.lecturer_name,
                        prodiSet: new Set([homebaseProdiName]),
                        teachingProdisSet: new Set(), // Init empty
                        is_homebase: r.is_homebase ?? true,
                        dates: [],
                        lecturer_user_id: r.lecturer_user_id || null
                    });
                } else {
                    lecturerMap.get(key)!.prodiSet.add(homebaseProdiName);
                }

                // Collect Teaching Prodis from details
                if (r.details && r.details.length > 0) {
                    r.details.forEach(d => {
                        if (d.study_program_name) {
                            lecturerMap.get(key)!.teachingProdisSet.add(d.study_program_name);
                        }
                    });
                }

                lecturerMap.get(key)!.dates.push(r.attendance_date);
            });

            // Helper: Calculate paid attendance per week
            // maxPerWeek: dari global settings (3 untuk HBV, 2 untuk NHBV)
            const calculatePaidAttendancePerWeek = (dates: string[], weeks: WeekSetting[], maxPerWeek: number): {
                paidDatesPerWeek: Map<number, string[]>;  // weekNumber -> paid dates
                unpaidDates: string[];  // dates beyond maxPerWeek per week
                totalPaidDays: number;
            } => {
                const paidDatesPerWeek = new Map<number, string[]>();
                const unpaidDates: string[] = [];
                let totalPaidDays = 0;

                // Initialize weeks
                weeks.forEach(w => paidDatesPerWeek.set(w.week_number, []));

                // Sort dates chronologically
                const sortedDates = [...dates].sort();

                sortedDates.forEach(dateStr => {
                    const date = new Date(dateStr);

                    // Find which week this date belongs to
                    const weekIdx = weeks.findIndex(w => {
                        const start = new Date(w.start_date);
                        const end = new Date(w.end_date);
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                        const d = new Date(date);
                        d.setHours(12, 0, 0, 0);
                        return d >= start && d <= end;
                    });

                    if (weekIdx !== -1) {
                        const week = weeks[weekIdx];
                        const weekDates = paidDatesPerWeek.get(week.week_number) || [];

                        if (weekDates.length < maxPerWeek) {
                            // Masih dalam batas maxPerWeek — dihitung bayar
                            weekDates.push(dateStr);
                            paidDatesPerWeek.set(week.week_number, weekDates);
                            totalPaidDays++;
                        } else {
                            // Melebihi batas — tidak dibayar (tapi tetap tercatat / ditandai merah)
                            unpaidDates.push(dateStr);
                        }
                    }
                });

                return { paidDatesPerWeek, unpaidDates, totalPaidDays };
            };

            // Gunakan payment rates dari DB (exportPaymentRates), fallback ke state jika kosong
            const hbvRate = exportPaymentRates.find(r => r.lecturer_type === 'HBV')?.rate
                ?? paymentRates.find(r => r.lecturer_type === 'HBV')?.rate
                ?? 75000;
            const nhbvRate = exportPaymentRates.find(r => r.lecturer_type === 'NHBV')?.rate
                ?? paymentRates.find(r => r.lecturer_type === 'NHBV')?.rate
                ?? 75000;

            // --- HEADER CONSTRUCTION ---

            // Row 1: Title
            // Merge A1 to end column. Calculate end column index.
            // Cols: NO(1) + NAMA(2) + HOMEBASE(3) + PRODI(4) + (Weeks * 5) + KET + JML + SATUAN + JML + JADWAL(5)
            // Fixed cols count = 4 (Start) + 4 (Stats) + 5 (Schedule) = 13
            // Total width = 13 + (Weeks * 5)
            const totalWidth = 13 + ((sortedWeeks.length || 3) * 5);

            worksheet.mergeCells(1, 1, 1, totalWidth);
            const titleRow = worksheet.getRow(1);
            titleRow.getCell(1).value = 'PENERIMAAN TRANSPORT MENGAJAR DOSEN FAKULTAS VOKASI UNY';
            titleRow.getCell(1).font = { bold: true, size: 14 };
            titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

            // Row 2: Subtitle
            worksheet.mergeCells(2, 1, 2, totalWidth);
            const subtitleRow = worksheet.getRow(2);
            subtitleRow.getCell(1).value = `KEHADIRAN BULAN ${dateRange.start ? format(new Date(dateRange.start), 'MMMM yyyy', { locale: (window as any).dateFnsLocaleID || localeId }).toUpperCase() : ''}`;
            subtitleRow.getCell(1).font = { bold: true, size: 12 };
            subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

            // Row 3-4: Headers
            const headerRow3 = worksheet.getRow(3);

            // Fixed Headers
            worksheet.mergeCells(3, 1, 4, 1); // NO
            headerRow3.getCell(1).value = 'NO';
            worksheet.getColumn(1).width = 5;

            worksheet.mergeCells(3, 2, 4, 2); // NAMA DOSEN
            headerRow3.getCell(2).value = 'NAMA DOSEN';
            worksheet.getColumn(2).width = 35;

            worksheet.mergeCells(3, 3, 4, 3); // HOMEBASE
            headerRow3.getCell(3).value = 'HOMEBASE'; // New Column
            worksheet.getColumn(3).width = 10;

            worksheet.mergeCells(3, 4, 4, 4); // PRODI
            headerRow3.getCell(4).value = 'PRODI'; // Shifted Column
            worksheet.getColumn(4).width = 25;

            // Date Columns (Weeks)
            let colCursor = 5; // Start after PRODI
            const holidayCols = new Set<number>();

            sortedWeeks.forEach(week => {
                const weekLabel = toRoman(week.week_number);
                worksheet.mergeCells(3, colCursor, 3, colCursor + 4);
                headerRow3.getCell(colCursor).value = weekLabel; // Week Num (I, II, III...)

                // Days headers (Strict Mon-Fri Alignment)
                const weekStart = new Date(week.start_date);
                const weekEnd = new Date(week.end_date);
                weekStart.setHours(0, 0, 0, 0);
                weekEnd.setHours(23, 59, 59, 999);

                for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
                    // dayOffset 0 = Monday, ..., 4 = Friday
                    const targetDay = dayOffset + 1; // 1=Mon, 5=Fri (JS GetDay)

                    let matchedDate: Date | null = null;

                    // Find the date in range [start, end] that matches targetDay
                    const temp = new Date(weekStart);
                    // Safety break to prevent infinite loop
                    let safety = 0;
                    while (temp <= weekEnd && safety < 14) {
                        if (temp.getDay() === targetDay) {
                            matchedDate = new Date(temp);
                            break;
                        }
                        temp.setDate(temp.getDate() + 1);
                        safety++;
                    }

                    const cell = worksheet.getRow(4).getCell(colCursor + dayOffset);

                    if (matchedDate) {
                        cell.value = matchedDate.getDate(); // Show Date (e.g. 1, 2, 12...)

                        // Check Holiday
                        const dateStr = format(matchedDate, 'yyyy-MM-dd');
                        const isHoliday = currentSpecialDates.some(sd => sd.date === dateStr);

                        if (isHoliday) {
                            holidayCols.add(colCursor + dayOffset);
                            // Highlight Header Yellow
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                        }
                    } else {
                        cell.value = '';
                    }

                    cell.alignment = { horizontal: 'center' };
                }

                colCursor += 5;
            });

            // Debug: Log holiday columns
            console.log('🎨 Holiday Columns (Yellow):', Array.from(holidayCols));

            // Stats Columns
            const statsStartCol = colCursor;

            worksheet.mergeCells(3, statsStartCol, 4, statsStartCol);
            headerRow3.getCell(statsStartCol).value = 'KET';
            worksheet.getColumn(statsStartCol).width = 8;

            worksheet.mergeCells(3, statsStartCol + 1, 4, statsStartCol + 1);
            headerRow3.getCell(statsStartCol + 1).value = 'JML HDR';
            worksheet.getColumn(statsStartCol + 1).width = 8;

            worksheet.mergeCells(3, statsStartCol + 2, 4, statsStartCol + 2);
            headerRow3.getCell(statsStartCol + 2).value = 'SATUAN';
            worksheet.getColumn(statsStartCol + 2).width = 12;

            worksheet.mergeCells(3, statsStartCol + 3, 4, statsStartCol + 3);
            headerRow3.getCell(statsStartCol + 3).value = 'JUMLAH';
            worksheet.getColumn(statsStartCol + 3).width = 15;

            // Schedule Columns
            const scheduleStartCol = statsStartCol + 4;
            worksheet.mergeCells(3, scheduleStartCol, 3, scheduleStartCol + 4);
            headerRow3.getCell(scheduleStartCol).value = 'JADWAL';

            ['SN', 'SL', 'R', 'K', 'J'].forEach((day, i) => {
                worksheet.getRow(4).getCell(scheduleStartCol + i).value = day;
                worksheet.getColumn(scheduleStartCol + i).width = 4;
            });

            // Styling
            const headerRow4 = worksheet.getRow(4);
            [headerRow3, headerRow4].forEach(row => {
                row.font = { bold: true };
                row.alignment = { vertical: 'middle', horizontal: 'center' };
                row.eachCell((cell) => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                });
            });

            // --- DATA ROWS ---
            let rowIndex = 5;
            let counter = 1;

            lecturerMap.forEach((lecturer) => {
                const row = worksheet.getRow(rowIndex);

                // Tentukan batas maksimal per minggu berdasarkan tipe dosen
                // Nilai diambil langsung dari database (bukan state)
                const maxPerWeek = lecturer.is_homebase ? maxWeeklyHBV : maxWeeklyNHBV;

                // Calculate paid vs unpaid dates berdasarkan maxPerWeek dosen ini
                const { paidDatesPerWeek, unpaidDates, totalPaidDays } = calculatePaidAttendancePerWeek(
                    lecturer.dates,
                    sortedWeeks,
                    maxPerWeek
                );
                const unpaidDatesSet = new Set(unpaidDates);

                // Debug logging for first few lecturers
                if (counter <= 3) {
                    console.log(`🔍 Lecturer: ${lecturer.name}`);
                    console.log(`   Total dates: ${lecturer.dates.length}`, lecturer.dates);
                    console.log(`   Paid dates per week:`, Object.fromEntries(paidDatesPerWeek));
                    console.log(`   Total paid days: ${totalPaidDays}`);
                    console.log(`   Unpaid dates (>3/week):`, unpaidDates);
                }

                // Process Study Programs

                // 1. HOMEBASE: From User's Study Program (prodiSet) - Code
                const homebaseNames = Array.from(lecturer.prodiSet).filter(Boolean);
                const homebaseCodes = homebaseNames.map(name => {
                    const sp = studyPrograms.find(s => s.name === name);
                    return sp?.code || '-';
                });
                const homebaseDisplay = homebaseCodes.length > 0 ? homebaseCodes[0] : '-'; // Primary homebase

                // 2. PRODI: From Teaching Details (teachingProdisSet)
                let teachingProdiNames = Array.from(lecturer.teachingProdisSet).filter(Boolean);

                // FALLBACK: If no teaching prodi found in details (e.g. old records), try matching with Schedule
                if (teachingProdiNames.length === 0) {
                    console.warn(`⚠️ No teaching prodi in details for ${lecturer.name}, trying schedule fallback...`);

                    // Match lecturer to schedules
                    let schedulesForProdi: LectureSchedule[] = [];
                    const sanitizeName = (name: string) => name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

                    if (lecturer.lecturer_user_id) {
                        schedulesForProdi = lectureSchedules.filter(s => s.lecturer_user_id === lecturer.lecturer_user_id);
                    }

                    if (schedulesForProdi.length === 0) {
                        const cleanTargetName = sanitizeName(lecturer.name);
                        schedulesForProdi = lectureSchedules.filter(s => {
                            if (!s.lecturer) return false;
                            const cleanScheduleName = sanitizeName(s.lecturer);
                            return cleanScheduleName === cleanTargetName ||
                                cleanScheduleName.includes(cleanTargetName) ||
                                cleanTargetName.includes(cleanScheduleName);
                        });
                    }

                    // Extract unique subjects
                    const scheduleProdis = new Set<string>();
                    schedulesForProdi.forEach(s => {
                        if (s.subject_study) scheduleProdis.add(s.subject_study);
                    });

                    if (scheduleProdis.size > 0) {
                        teachingProdiNames = Array.from(scheduleProdis);
                        console.log(`✅ Found fallback prodis for ${lecturer.name}:`, teachingProdiNames);
                    }
                }

                const prodiDisplay = teachingProdiNames.length > 0
                    ? teachingProdiNames.join('; ')
                    : '-';

                // Fixed start columns
                row.getCell(1).value = counter++;
                row.getCell(2).value = lecturer.name;
                row.getCell(3).value = homebaseDisplay; // HOMEBASE (Code)
                row.getCell(4).value = prodiDisplay;    // PRODI (Teaching Names joined)

                // Dynamic Week Columns
                // Col Index = 5 (Start) + (WeekIndex * 5) + (DayOfWeek 0-4)

                // 1. First, apply Holiday Highlights (Yellow) to this row for ALL holiday columns
                holidayCols.forEach(colIdx => {
                    const cell = row.getCell(colIdx);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                });

                // 2. Fill Attendance Data & Apply Red for Unpaid
                lecturer.dates.forEach(dateStr => {
                    const date = new Date(dateStr);
                    const dayOfWeek = date.getDay(); // 0-6
                    if (dayOfWeek === 0 || dayOfWeek === 6) return; // Skip weekends

                    const dayIndex = dayOfWeek - 1; // 0=Mon, 4=Fri

                    // Find which configured week this date belongs to
                    const weekIdx = sortedWeeks.findIndex(w => {
                        const start = new Date(w.start_date);
                        const end = new Date(w.end_date);
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                        const d = new Date(date);
                        d.setHours(12, 0, 0, 0);
                        return d >= start && d <= end;
                    });

                    if (weekIdx !== -1 && dayIndex >= 0 && dayIndex <= 4) {
                        const colIdx = 5 + (weekIdx * 5) + dayIndex; // Start at 5 now
                        const dayAbbrs = ['SN', 'SL', 'R', 'K', 'J'];

                        const cell = row.getCell(colIdx);
                        cell.value = dayAbbrs[dayIndex];
                        cell.alignment = { horizontal: 'center' };

                        if (unpaidDatesSet.has(dateStr)) {
                            // Highlight RED for unpaid (>3 per week) - Overwrites Yellow if collision
                            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; // White text
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Red Fill
                        } else {
                            // Paid (Normal)
                            // If it matches a holiday column (Yellow), do we keep it Yellow or make it White?
                            // User request: "maksimal 3 kali seminggu lebih dari itu tidak dihitung tapi tetap di tulis beri higligh merah"
                            // User request: "beri highlight kuning pada tanggal yang libur"
                            // If attendance is on a holiday (and paid <= 3), let's keep it Yellow to show it's a holiday attendance?
                            // OR reset to white to show "Valid Attendance"?
                            // Typically, "Holiday" highlight is mainly for empty cells to show why it's empty.
                            // If there is attendance, usually the attendance status (Paid/Unpaid) is more important.
                            // BUT, let's keep Yellow if it's holiday to be safe, unless unpaid red overrides.

                            // If cell.fill is ALREADY yellow (from step 1), we don't change it to white.
                            // But Font color should be black.
                            if (!holidayCols.has(colIdx)) {
                                // Reset to white/clean if NOT a holiday
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                            }
                            cell.font = { color: { argb: 'FF000000' } }; // Black text
                        }
                    }
                });

                // Highlight Holiday Columns in this row
                holidayCols.forEach(colIdx => {
                    const cell = row.getCell(colIdx);
                    cell.value = '';
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                });

                // End Stats Columns
                const statsColsStart = 5 + (sortedWeeks.length * 5); // Start after dates

                const ket = lecturer.is_homebase ? 'HBV' : 'NHBV';
                row.getCell(statsColsStart).value = ket;

                // JML HDR - Total attendance (ALL, including unpaid)
                const totalAttendance = lecturer.dates.length;
                row.getCell(statsColsStart + 1).value = totalAttendance;

                // Catatan jika melebihi batas
                if (unpaidDates.length > 0) {
                    row.getCell(statsColsStart + 1).note = `Melebihi ${maxPerWeek}x/minggu: ${unpaidDates.length} hari tidak dibayar (${lecturer.is_homebase ? 'HBV' : 'NHBV'})`;
                }

                const rate = lecturer.is_homebase ? hbvRate : nhbvRate;
                row.getCell(statsColsStart + 2).value = rate;
                row.getCell(statsColsStart + 2).numFmt = '#,##0';

                // JUMLAH - Only count PAID days (max per week sesuai tipe dosen)
                const totalPayment = totalPaidDays * rate;
                row.getCell(statsColsStart + 3).value = totalPayment;
                row.getCell(statsColsStart + 3).numFmt = '#,##0';

                // Catatan jika ada hari yang tidak dibayar
                if (unpaidDates.length > 0) {
                    row.getCell(statsColsStart + 3).note = `Dibayar ${totalPaidDays} dari ${totalAttendance} hari (maks ${maxPerWeek}x/minggu — ${lecturer.is_homebase ? 'HBV' : 'NHBV'})`;
                }

                // JADWAL Columns - Robust name matching
                const scheduleColStart = statsColsStart + 4;

                // ... (Schedule matching logic remains same) ...
                // Re-using the logic block below but adjusting column indices in the final write loop

                let schedules: LectureSchedule[] = [];
                const sanitizeName = (name: string) => name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

                if (lecturer.lecturer_user_id) {
                    schedules = lectureSchedules.filter(s => s.lecturer_user_id === lecturer.lecturer_user_id);
                }

                if (schedules.length === 0) {
                    const cleanTargetName = sanitizeName(lecturer.name);
                    schedules = lectureSchedules.filter(s => {
                        if (!s.lecturer) return false;
                        const cleanScheduleName = sanitizeName(s.lecturer);
                        return cleanScheduleName === cleanTargetName ||
                            cleanScheduleName.includes(cleanTargetName) ||
                            cleanTargetName.includes(cleanScheduleName);
                    });
                }

                const scheduleDays = new Set(schedules.map(s => getDayAbbr(s.day || '')));

                ['SN', 'SL', 'R', 'K', 'J'].forEach((day, idx) => {
                    if (scheduleDays.has(day)) {
                        row.getCell(scheduleColStart + idx).value = day;
                        row.getCell(scheduleColStart + idx).alignment = { horizontal: 'center' };
                    }
                });

                // Style the row
                const totalCols = scheduleColStart + 5;
                for (let c = 1; c < totalCols; c++) {
                    const cell = row.getCell(c);
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    if (c === 2 || c === 4) { // Name and PRODI (Name) left aligned
                        cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    } else if (!cell.alignment) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                }

                rowIndex++;
            });

            // --- FOOTER & SIGNATURE ---
            const lastRowIdx = rowIndex;
            // Re-calculate statsStartCol safely based on new layout
            // Start Col for dates is 5.
            const footStatsStartCol = 5 + (sortedWeeks.length * 5);

            // Grand Total Row
            worksheet.mergeCells(lastRowIdx, 1, lastRowIdx, footStatsStartCol + 2); // Merge from A to SATUAN column
            const totalLabelCell = worksheet.getCell(lastRowIdx, 1);
            totalLabelCell.value = 'JUMLAH';
            totalLabelCell.font = { bold: true };
            totalLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };

            // Calculate Grand Total Sum (berdasarkan maxPerWeek tiap tipe dosen)
            let totalAmount = 0;
            let totalPaidDaysAll = 0;
            let totalUnpaidDaysAll = 0;

            lecturerMap.forEach(l => {
                // Tiap dosen punya batas berbeda: HBV/NHBV dari DB
                const maxPerWeekL = l.is_homebase ? maxWeeklyHBV : maxWeeklyNHBV;

                const { totalPaidDays: paidDays, unpaidDates } = calculatePaidAttendancePerWeek(
                    l.dates,
                    sortedWeeks,
                    maxPerWeekL
                );
                const rate = l.is_homebase ? hbvRate : nhbvRate;
                totalAmount += paidDays * rate;
                totalPaidDaysAll += paidDays;
                totalUnpaidDaysAll += unpaidDates.length;
            });

            // Log ringkasan
            if (totalUnpaidDaysAll > 0) {
                console.log(`📊 Grand Total: ${totalPaidDaysAll} hari dibayar, ${totalUnpaidDaysAll} hari melebihi batas (HBV:${maxWeeklyHBV}x | NHBV:${maxWeeklyNHBV}x per minggu)`);
            }

            const totalValueCell = worksheet.getCell(lastRowIdx, footStatsStartCol + 3);
            totalValueCell.value = totalAmount;
            totalValueCell.numFmt = '#,##0';
            totalValueCell.font = { bold: true };
            totalValueCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            // Apply border to the merged label cell too
            // Note: In ExcelJS, styling a merged cell requires styling the top-left cell mainly, 
            // but sometimes borders need careful handling. The mergeCells above works, 
            // we just need to ensure the right border is drawn at the end of the merge? 
            // ExcelJS handles borders on merged cells if set on the master cell usually.
            totalLabelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            // Signature Block
            // Per screenshot: "Menyetujui:", "Dekan Fakultas Vokasi", Name "Prof. Dr. Komarudin, S.Pd., M.A.", "NIP..."
            // Placed aligned to the right side, maybe 3-4 rows below Grand Total.

            const signStartRow = lastRowIdx + 2;
            // Align signature block to the right side of the sheet (near JUMLAH column)
            // Let's use the stats columns area for the signature.
            const signCol = footStatsStartCol + 1; // Align roughly with stats area

            worksheet.getCell(signStartRow, signCol).value = 'Menyetujui:';
            worksheet.getCell(signStartRow + 1, signCol).value = 'Dekan Fakultas Vokasi';
            worksheet.getCell(signStartRow + 1, signCol).font = { bold: true };

            const nameRow = signStartRow + 5; // Space for signature
            worksheet.getCell(nameRow, signCol).value = 'Prof. Dr. Komarudin, S.Pd., M.A.';
            worksheet.getCell(nameRow, signCol).font = { bold: true, underline: true };

            worksheet.getCell(nameRow + 1, signCol).value = 'NIP. 197409282003121002'; // From screenshot

            // Column Widths
            worksheet.getColumn(1).width = 5;  // NO
            worksheet.getColumn(2).width = 30; // NAMA
            worksheet.getColumn(3).width = 10; // HOMEBASE (Code)
            worksheet.getColumn(4).width = 25; // PRODI (Name)

            // Week Cols start at 5
            for (let i = 0; i < sortedWeeks.length * 5; i++) {
                worksheet.getColumn(5 + i).width = 4;
            }
            // Stats Cols
            worksheet.getColumn(footStatsStartCol).width = 8;     // KET
            worksheet.getColumn(footStatsStartCol + 1).width = 8; // JML HDR
            worksheet.getColumn(footStatsStartCol + 2).width = 12; // SATUAN
            worksheet.getColumn(footStatsStartCol + 3).width = 15; // JUMLAH
            // Schedule Cols
            for (let i = 0; i < 5; i++) {
                worksheet.getColumn(footStatsStartCol + 4 + i).width = 4;
            }

            // Write File
            console.log('Writing Excel buffer...');
            const buffer = await workbook.xlsx.writeBuffer();
            console.log('Buffer created, size:', buffer.byteLength);

            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const filename = `Rekap_Kehadiran_Vokasi_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
            console.log('Saving as:', filename);

            saveAs(blob, filename);
            console.log('SaveAs called');

            toast.success('Excel berhasil dibuat dan diunduh');
        } catch (error) {
            console.error('Error exporting Excel:', error);
            if (error instanceof Error) {
                console.error('Stack:', error.stack);
            }
            toast.error('Gagal membuat file Excel');
        }
    };

    // Filtered records for display
    const filteredRecords = useMemo(() => {
        if (!searchTerm.trim()) return attendanceRecords;
        const search = searchTerm.toLowerCase();
        return attendanceRecords.filter(r =>
            r.lecturer_name.toLowerCase().includes(search)
        );
    }, [attendanceRecords, searchTerm]);

    // Paginated records
    const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
    const paginatedRecords = filteredRecords.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    // Access check
    if (!profile || (profile.role !== 'finance' && profile.role !== 'super_admin')) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Akses Ditolak</h3>
                    <p className="text-gray-600">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-xl p-6 text-white">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                                <ClipboardCheck className="h-6 md:h-8 w-6 md:w-8" />
                            </div>
                            <span>{getText('Attendance Management', 'Manajemen Presensi')}</span>
                        </h1>
                        <p className="text-sm md:text-lg opacity-90">
                            {getText('Verify and recap lecturer attendance', 'Verifikasi dan rekap kehadiran dosen')}
                        </p>
                    </div>
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                                <div className="text-2xl font-bold">{stats.total}</div>
                                <div className="text-xs opacity-80">Total</div>
                            </div>
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                                <div className="text-2xl font-bold">{stats.verified}</div>
                                <div className="text-xs opacity-80">Terverifikasi</div>
                            </div>
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                                <div className="text-2xl font-bold">{stats.pending}</div>
                                <div className="text-xs opacity-80">Menunggu</div>
                            </div>
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                                <div className="text-2xl font-bold">{stats.rejected}</div>
                                <div className="text-xs opacity-80">Ditolak</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('verification')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'verification' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <ClipboardCheck className="w-4 h-4" />
                        {getText('Verification', 'Verifikasi')}
                    </button>
                    <button
                        onClick={() => setActiveTab('recap')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'recap' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        {getText('Recap', 'Rekap')}
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <FileText className="w-4 h-4" />
                        {getText('Reports', 'Laporan')}
                    </button>
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50"
                    >
                        <Settings className="w-4 h-4" />
                        {getText('Settings', 'Pengaturan')}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Date Range */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Start Date', 'Tanggal Mulai')}</label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{getText('End Date', 'Tanggal Akhir')}</label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Study Program Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Study Program', 'Program Studi')}</label>
                        <select
                            value={studyProgramFilter}
                            onChange={(e) => setStudyProgramFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">{getText('All Study Programs', 'Semua Program Studi')}</option>
                            <option value="non_homebase" className="bg-orange-100 text-orange-800">🏠 {getText('Non Homebase Lecturers', 'Dosen Non Homebase')}</option>
                            {studyPrograms.map(sp => (
                                <option key={sp.id} value={sp.id}>{sp.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Status', 'Status')}</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">{getText('All Status', 'Semua Status')}</option>
                            <option value="pending">{getText('Pending', 'Menunggu')}</option>
                            <option value="verified">{getText('Verified', 'Terverifikasi')}</option>
                            <option value="rejected">{getText('Rejected', 'Ditolak')}</option>
                        </select>
                    </div>

                    {/* Campus Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Campus', 'Kampus')}</label>
                        <select
                            value={campusFilter}
                            onChange={(e) => setCampusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">{getText('All Campuses', 'Semua Kampus')}</option>
                            {campuses.map(campus => (
                                <option key={campus.id} value={campus.id}>
                                    {campus.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-4 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={getText('Search by lecturer name...', 'Cari nama dosen...')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowManualAttendanceModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" />
                            {getText('Add Attendance', 'Tambah Presensi')}
                        </button>
                        <button
                            onClick={fetchAttendanceRecords}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {getText('Refresh', 'Refresh')}
                        </button>
                        {activeTab !== 'verification' && (
                            <>
                                <button
                                    onClick={exportToPDF}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    PDF
                                </button>
                                <button
                                    onClick={exportToExcel}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Excel
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'verification' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>{getText('No attendance records found', 'Tidak ada data presensi')}</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Foto</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Dosen</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tujuan</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {paginatedRecords.map((record) => (
                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.is_homebase === false ? 'bg-orange-50/50' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs text-gray-500">
                                                        {(() => {
                                                            const scannedRoom = record.scanned_room as any;
                                                            return scannedRoom?.name
                                                                ? `📍 ${scannedRoom.name}`
                                                                : '📍 Lokasi tidak tercatat';
                                                        })()}
                                                    </span>
                                                    {/* Foto thumbnail — lazy loaded saat klik buka modal */}
                                                    <button
                                                        onClick={() => handleSelectRecord(record)}
                                                        className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-blue-50 hover:ring-2 hover:ring-blue-300 transition-all group"
                                                        title="Klik untuk lihat detail & foto"
                                                    >
                                                        <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-gray-900">{record.lecturer_name}</span>
                                                        {record.is_homebase === false && (
                                                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded-full border border-orange-200">Non HB</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{record.study_program?.name || '-'}</div>
                                                    <div className="text-xs text-gray-400 font-mono">ID: #{record.id.substring(0, 8)}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {format(new Date(record.attendance_date), 'dd MMM yyyy', { locale: localeId })}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {record.attendance_time?.substring(0, 5)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${record.purpose === 'mengajar' ? 'bg-blue-100 text-blue-800' : record.purpose === 'sidang' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                                            {record.purpose === 'mengajar' ? 'Mengajar' : record.purpose === 'sidang' ? 'Sidang' : 'Lainnya'}
                                                        </span>
                                                        {record.purpose === 'lainnya' && record.purpose_description && (
                                                            <span className="text-xs text-gray-500 italic max-w-[150px] truncate" title={record.purpose_description}>
                                                                "{record.purpose_description}"
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${record.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-800' : record.verification_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {record.verification_status === 'verified' ? 'Terverifikasi' : record.verification_status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleSelectRecord(record)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title={record.verification_status === 'pending' ? "Verifikasi" : "Lihat Detail"}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(record.id, record.lecturer_name)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Hapus"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                                    <div className="text-sm text-gray-500">
                                        {getText('Showing', 'Menampilkan')} {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, filteredRecords.length)} {getText('of', 'dari')} {filteredRecords.length}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-sm font-medium">{currentPage} / {totalPages}</span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {activeTab === 'recap' && stats && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Purpose Chart */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-blue-600" />
                            {getText('Attendance by Purpose', 'Kehadiran Berdasarkan Tujuan')}
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPie>
                                    <Pie
                                        data={stats.byPurpose}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    >
                                        {stats.byPurpose.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </RechartsPie>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Study Program Chart */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Building className="w-5 h-5 text-blue-600" />
                            {getText('Attendance by Study Program', 'Kehadiran Berdasarkan Program Studi')}
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.byStudyProgram.slice(0, 6)} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Lecturer Attendance Chart - Line Chart */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Users className="w-5 h-5 text-emerald-600" />
                                {getText('Lecturer Attendance Intensity', 'Intensitas Kehadiran Dosen')}
                            </h3>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600">Program Studi:</label>
                                <select
                                    value={recapSelectedProdi}
                                    onChange={(e) => setRecapSelectedProdi(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Semua (Top 10)</option>
                                    <option value="non_homebase">🏠 Dosen Non Homebase</option>
                                    {studyPrograms.map(sp => (
                                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {lecturerChartData.length === 0 ? (
                            <div className="h-80 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Tidak ada data dosen untuk program studi ini</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={lecturerChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 9 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={100}
                                            tickFormatter={(value) => value.length > 12 ? value.substring(0, 12) + '...' : value}
                                        />
                                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                        <Tooltip
                                            formatter={(value: number) => [`${value} kali`, 'Kehadiran']}
                                            labelFormatter={(label) => `Dosen: ${label}`}
                                            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            stroke="#10B981"
                                            strokeWidth={3}
                                            dot={{ fill: '#10B981', strokeWidth: 2, r: 5 }}
                                            activeDot={{ r: 8, fill: '#059669' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                            <p className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-blue-500" />
                                {recapSelectedProdi
                                    ? `Menampilkan ${lecturerChartData.length} dosen dari program studi yang dipilih. Dosen dengan 0 kehadiran juga ditampilkan.`
                                    : 'Pilih program studi untuk melihat semua dosen (termasuk yang belum presensi).'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Lampiran LPJ Download Section - Shown in Reports tab regardless of stats */}
            {activeTab === 'reports' && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-sm p-6 text-white">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Cetak Lampiran LPJ (Per Hari)
                    </h3>
                    <p className="text-blue-100 text-sm mb-4">
                        Pilih tanggal kemudian download lampiran LPJ. Format: DAFTAR HADIR DOSEN untuk tanggal yang dipilih dengan tanda tangan.
                    </p>

                    <div className="flex flex-wrap items-end gap-4">
                        {/* Date Picker */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-blue-100 mb-1">
                                Pilih Tanggal
                            </label>
                            <input
                                type="date"
                                value={lpjDate}
                                onChange={(e) => setLpjDate(e.target.value)}
                                className="px-4 py-2 rounded-lg border-0 text-gray-900 focus:ring-2 focus:ring-white"
                            />
                        </div>

                        {/* Download Buttons */}
                        <button
                            onClick={() => generateLPJPDF('homebase', lpjDate)}
                            className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download LPJ (Homebase)
                        </button>
                        <button
                            onClick={() => generateLPJPDF('non_homebase', lpjDate)}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download LPJ (Non Homebase)
                        </button>
                    </div>

                    <p className="text-blue-200 text-xs mt-3">
                        📅 Tanggal terpilih: {format(new Date(lpjDate), 'EEEE, d MMMM yyyy', { locale: localeId })}
                    </p>
                </div>
            )}

            {activeTab === 'reports' && stats && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                                    <div className="text-sm text-gray-500">{getText('Total Attendance', 'Total Kehadiran')}</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-100 rounded-xl">
                                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{stats.verified}</div>
                                    <div className="text-sm text-gray-500">{getText('Verified', 'Terverifikasi')}</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-yellow-100 rounded-xl">
                                    <Clock className="w-6 h-6 text-yellow-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
                                    <div className="text-sm text-gray-500">{getText('Pending', 'Menunggu')}</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-100 rounded-xl">
                                    <XCircle className="w-6 h-6 text-red-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{stats.rejected}</div>
                                    <div className="text-sm text-gray-500">{getText('Rejected', 'Ditolak')}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Study Program Breakdown with Lecturer Details */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                {getText('Breakdown by Study Program', 'Rincian Per Program Studi & Dosen')}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Klik program studi untuk melihat detail kehadiran per dosen</p>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {stats.byStudyProgram.map((sp, index) => {
                                const isExpanded = expandedPrograms.has(sp.name);
                                const toggleExpand = () => {
                                    const newSet = new Set(expandedPrograms);
                                    if (isExpanded) {
                                        newSet.delete(sp.name);
                                    } else {
                                        newSet.add(sp.name);
                                    }
                                    setExpandedPrograms(newSet);
                                };

                                return (
                                    <div key={index}>
                                        {/* Study Program Header */}
                                        <button
                                            onClick={toggleExpand}
                                            className={`w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${sp.name.includes('Non Homebase') ? 'bg-orange-50/50' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${sp.name.includes('Non Homebase') ? 'bg-orange-100' : 'bg-blue-100'}`}>
                                                    <Building className={`w-5 h-5 ${sp.name.includes('Non Homebase') ? 'text-orange-600' : 'text-blue-600'}`} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-semibold text-gray-900">{sp.name}</div>
                                                    <div className="text-sm text-gray-500">{sp.lecturers.length} dosen</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className={`text-lg font-bold ${sp.name.includes('Non Homebase') ? 'text-orange-600' : 'text-blue-600'}`}>{sp.count}</div>
                                                    <div className="text-xs text-gray-500">kehadiran</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className={`h-2 rounded-full ${sp.name.includes('Non Homebase') ? 'bg-orange-500' : 'bg-blue-600'}`}
                                                            style={{ width: `${(sp.count / stats.total) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm text-gray-600 w-12">{((sp.count / stats.total) * 100).toFixed(1)}%</span>
                                                </div>
                                                {isExpanded ? (
                                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                                )}
                                            </div>
                                        </button>

                                        {/* Lecturer Details (Collapsible) */}
                                        {isExpanded && (
                                            <div className="bg-gray-50 border-t border-gray-200">
                                                <table className="min-w-full">
                                                    <thead className="bg-gray-100">
                                                        <tr>
                                                            <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                                                            <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nama Dosen</th>
                                                            <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jumlah Kehadiran</th>
                                                            <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {sp.lecturers.map((lecturer, lecIndex) => (
                                                            <tr key={lecIndex} className="hover:bg-gray-100">
                                                                <td className="px-6 py-3 text-sm text-gray-600">{lecIndex + 1}</td>
                                                                <td className="px-6 py-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                                            <User className="w-4 h-4 text-blue-600" />
                                                                        </div>
                                                                        <span className="font-medium text-gray-900">{lecturer.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                                                                        {lecturer.count} kali
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    {lecturer.count >= 10 ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                                            <CheckCircle className="w-3 h-3" /> Aktif
                                                                        </span>
                                                                    ) : lecturer.count >= 5 ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                                                            <AlertCircle className="w-3 h-3" /> Cukup
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                                            <Clock className="w-3 h-3" /> Perlu Pertimbangan
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Modal */}
            {
                selectedRecord && !showImageModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {selectedRecord.verification_status === 'pending'
                                            ? getText('Verify Attendance', 'Verifikasi Presensi')
                                            : getText('Attendance Detail', 'Detail Presensi')}
                                    </h3>
                                    <button onClick={() => { setSelectedRecord(null); setVerificationNotes(''); setLoadingPhoto(false); }} className="p-2 hover:bg-gray-100 rounded-lg">
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Foto — Lazy Loaded (hanya saat modal dibuka) */}
                                <div className="relative w-full h-48 rounded-xl overflow-hidden bg-gray-100">
                                    {loadingPhoto ? (
                                        /* Skeleton loader saat foto sedang di-fetch */
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 animate-pulse">
                                            <div className="w-12 h-12 bg-gray-300 rounded-full" />
                                            <div className="w-24 h-3 bg-gray-300 rounded" />
                                            <p className="text-xs text-gray-400 mt-1">Memuat foto...</p>
                                        </div>
                                    ) : selectedRecord.photo_capture ? (
                                        /* Foto sudah tersedia */
                                        <img
                                            src={selectedRecord.photo_capture}
                                            alt="Foto presensi"
                                            className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300"
                                            onClick={() => setShowImageModal(true)}
                                            title="Klik untuk perbesar"
                                        />
                                    ) : (
                                        /* Tidak ada foto */
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="text-xs">Tidak ada foto</span>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <label className="text-gray-500">Nama Dosen</label>
                                        <p className="font-medium text-gray-900">{selectedRecord.lecturer_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-gray-500">Program Studi</label>
                                        <p className="font-medium text-gray-900">{selectedRecord.study_program?.name || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-gray-500">Tanggal & Waktu</label>
                                        <p className="font-medium text-gray-900">
                                            {format(new Date(selectedRecord.attendance_date), 'dd MMM yyyy', { locale: localeId })} {selectedRecord.attendance_time?.substring(0, 5)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-gray-500">Tujuan</label>
                                        <p className="font-medium text-gray-900 capitalize">{selectedRecord.purpose}</p>
                                    </div>
                                    <div>
                                        <label className="text-gray-500">Ruangan Scan</label>
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 bg-blue-50 rounded">
                                                <Building className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <p className="font-medium text-gray-900">
                                                {(() => {
                                                    const scannedRoom = selectedRecord.scanned_room as any;
                                                    if (scannedRoom?.name) {
                                                        return scannedRoom.name;
                                                    } else if (selectedRecord.scanned_room_id) {
                                                        return <span className="text-xs text-gray-500 font-mono">{selectedRecord.scanned_room_id.substring(0, 8)}...</span>;
                                                    } else {
                                                        return <span className="text-gray-400 italic text-sm">Tidak ada data scan</span>;
                                                    }
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {selectedRecord.purpose_description && (
                                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                        <label className="text-yellow-800 text-xs font-semibold uppercase tracking-wider">Detail Tujuan</label>
                                        <p className="mt-1 font-medium text-gray-900">{selectedRecord.purpose_description}</p>
                                    </div>
                                )}

                                {selectedRecord.additional_notes && (
                                    selectedRecord.purpose === 'mengajar' ||
                                    selectedRecord.additional_notes !== selectedRecord.purpose_description
                                ) && (
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                            <label className="text-blue-800 text-xs font-semibold uppercase tracking-wider">Opsi Keterangan Tambahan</label>
                                            <p className="mt-1 font-medium text-gray-900">{selectedRecord.additional_notes}</p>
                                        </div>
                                    )}

                                {/* Attendance Details Section - Multi-jadwal */}
                                {loadingDetails ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                        <span className="ml-2 text-sm text-gray-500">Memuat detail kegiatan...</span>
                                    </div>
                                ) : selectedRecordDetails.length > 0 && (
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-blue-600" />
                                                <label className="text-blue-800 text-sm font-semibold">
                                                    Detail Kegiatan ({selectedRecordDetails.length})
                                                </label>
                                            </div>
                                            <span className="text-xs text-gray-400" title={`ID Presensi: ${selectedRecord.id}`}>
                                                #{selectedRecord.id.substring(0, 8)}
                                            </span>
                                        </div>
                                        <div className="space-y-3 max-h-60 overflow-y-auto">
                                            {selectedRecordDetails.map((detail, idx) => (
                                                <div key={detail.id || idx} className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${detail.activity_type === 'mengajar'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : detail.activity_type === 'sidang'
                                                                ? 'bg-purple-100 text-purple-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {detail.activity_type === 'mengajar' ? 'Mengajar' :
                                                                detail.activity_type === 'sidang' ? 'Sidang' : 'Lainnya'}
                                                        </span>
                                                        {detail.start_time && detail.end_time && (
                                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {detail.start_time?.substring(0, 5)} - {detail.end_time?.substring(0, 5)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {detail.activity_type === 'mengajar' ? (
                                                        <div className="space-y-1">
                                                            <p className="font-medium text-gray-900">{detail.course_name || 'Mata Kuliah'}</p>
                                                            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                                                                {detail.study_program_name && (
                                                                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                                                                        <GraduationCap className="w-3 h-3" /> {detail.study_program_name}
                                                                    </span>
                                                                )}
                                                                {detail.class_group && (
                                                                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                                                                        <Users className="w-3 h-3" /> Rombel {detail.class_group}
                                                                    </span>
                                                                )}
                                                                {detail.semester && (
                                                                    <span className="bg-gray-100 px-2 py-0.5 rounded">{detail.semester}</span>
                                                                )}
                                                                {detail.room_name && (
                                                                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                                                                        <Building className="w-3 h-3" /> {detail.room_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : detail.activity_type === 'sidang' ? (
                                                        <div className="space-y-1">
                                                            <p className="font-medium text-gray-900">
                                                                {detail.session_type || 'Sidang'} - {detail.student_name || 'Mahasiswa'}
                                                            </p>
                                                            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                                                                {detail.role_in_session && (
                                                                    <span className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                                                                        <User className="w-3 h-3" /> {detail.role_in_session}
                                                                    </span>
                                                                )}
                                                                {detail.student_nim && (
                                                                    <span className="bg-gray-100 px-2 py-0.5 rounded">NIM: {detail.student_nim}</span>
                                                                )}
                                                                {detail.room_name && (
                                                                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                                                                        <Building className="w-3 h-3" /> {detail.room_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Notes', 'Catatan')}</label>
                                    <textarea
                                        value={verificationNotes}
                                        onChange={(e) => setVerificationNotes(e.target.value)}
                                        placeholder={getText('Add verification notes (optional)...', 'Tambahkan catatan verifikasi (opsional)...')}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-200 flex gap-3">
                                <button
                                    onClick={() => handleVerify('rejected')}
                                    disabled={processing}
                                    className="flex-1 py-3 px-4 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <XCircle className="w-4 h-4" />
                                    {getText('Reject', 'Tolak')}
                                </button>
                                <button
                                    onClick={() => handleVerify('verified')}
                                    disabled={processing}
                                    className="flex-1 py-3 px-4 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    {getText('Verify', 'Verifikasi')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Image Modal */}
            {
                showImageModal && selectedRecord?.photo_capture && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90" onClick={() => setShowImageModal(false)}>
                        <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full" onClick={() => setShowImageModal(false)}>
                            <X className="w-8 h-8" />
                        </button>
                        <img src={selectedRecord.photo_capture} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                )
            }

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
                        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowSettingsModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Settings className="w-6 h-6" />
                                        {getText('Attendance Settings', 'Pengaturan Presensi')}
                                    </h2>
                                    <button onClick={() => setShowSettingsModal(false)} className="p-2 text-white hover:bg-white/20 rounded-full">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                {/* Month/Year Selector */}
                                <div className="flex items-center gap-3 mt-3">
                                    <select
                                        value={settingsMonth}
                                        onChange={(e) => setSettingsMonth(parseInt(e.target.value))}
                                        className="px-3 py-1.5 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                            <option key={m} value={m} className="text-gray-900">
                                                {format(new Date(2024, m - 1, 1), 'MMMM', { locale: localeId })}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={settingsYear}
                                        onChange={(e) => setSettingsYear(parseInt(e.target.value))}
                                        className="px-3 py-1.5 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none"
                                    >
                                        {[2024, 2025, 2026, 2027].map(y => (
                                            <option key={y} value={y} className="text-gray-900">{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="border-b border-gray-200">
                                <div className="flex">
                                    <button
                                        onClick={() => setSettingsTab('weeks')}
                                        className={`flex-1 py-3 px-4 font-medium text-sm border-b-2 transition-colors flex items-center justify-center gap-2 ${settingsTab === 'weeks' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <Calendar className="w-4 h-4" />
                                        {getText('Week Settings', 'Pengaturan Minggu')}
                                    </button>
                                    <button
                                        onClick={() => setSettingsTab('holidays')}
                                        className={`flex-1 py-3 px-4 font-medium text-sm border-b-2 transition-colors flex items-center justify-center gap-2 ${settingsTab === 'holidays' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <CalendarOff className="w-4 h-4" />
                                        {getText('Special Dates', 'Tanggal Libur')}
                                    </button>
                                    <button
                                        onClick={() => setSettingsTab('rates')}
                                        className={`flex-1 py-3 px-4 font-medium text-sm border-b-2 transition-colors flex items-center justify-center gap-2 ${settingsTab === 'rates' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <DollarSign className="w-4 h-4" />
                                        {getText('Payment Rates', 'Tarif Pembayaran')}
                                    </button>
                                    <button
                                        onClick={() => setSettingsTab('limits')}
                                        className={`flex-1 py-3 px-4 font-medium text-sm border-b-2 transition-colors flex items-center justify-center gap-2 ${settingsTab === 'limits' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <SlidersHorizontal className="w-4 h-4" />
                                        {getText('Attendance Limits', 'Batas Presensi')}
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 overflow-y-auto max-h-[60vh]">
                                {/* Week Settings Tab */}
                                {settingsTab === 'weeks' && (
                                    <div className="space-y-4">
                                        {/* Disable Attendance Section */}
                                        <div className={`p-4 rounded-xl border-2 ${globalSettings.is_attendance_disabled ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${globalSettings.is_attendance_disabled ? 'bg-red-200' : 'bg-green-200'}`}>
                                                        <CalendarOff className={`w-5 h-5 ${globalSettings.is_attendance_disabled ? 'text-red-600' : 'text-green-600'}`} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900">Status Presensi</h4>
                                                        <p className={`text-sm ${globalSettings.is_attendance_disabled ? 'text-red-600' : 'text-green-600'}`}>
                                                            {globalSettings.is_attendance_disabled ? 'Presensi DITUTUP' : 'Presensi AKTIF'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={globalSettings.is_attendance_disabled}
                                                        onChange={(e) => setGlobalSettings({ ...globalSettings, is_attendance_disabled: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500"></div>
                                                    <span className="ml-3 text-sm font-medium text-gray-700">Tutup</span>
                                                </label>
                                            </div>

                                            {globalSettings.is_attendance_disabled && (
                                                <div className="space-y-3 pt-3 border-t border-red-200">
                                                    <div>
                                                        <label className="block text-xs text-gray-600 mb-1">Mulai Tanggal (Opsional)</label>
                                                        <input
                                                            type="date"
                                                            value={globalSettings.disabled_from_date || ''}
                                                            onChange={(e) => setGlobalSettings({ ...globalSettings, disabled_from_date: e.target.value || null })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-600 mb-1">Pesan untuk Dosen</label>
                                                        <textarea
                                                            value={globalSettings.disabled_message}
                                                            onChange={(e) => setGlobalSettings({ ...globalSettings, disabled_message: e.target.value })}
                                                            placeholder="Mohon maaf presensi transport ditutup karena..."
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                                                            rows={2}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <button
                                                onClick={handleSaveGlobalSettings}
                                                disabled={savingSettings}
                                                className={`mt-4 w-full py-2 font-medium rounded-lg flex items-center justify-center gap-2 ${globalSettings.is_attendance_disabled ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'} disabled:opacity-50`}
                                            >
                                                <Save className="w-4 h-4" />
                                                Simpan Pengaturan
                                            </button>
                                        </div>

                                        <hr className="border-gray-200" />

                                        <p className="text-sm text-gray-500">
                                            {getText('Configure active weeks for the selected month. Saturdays and Sundays are always off.', 'Atur minggu aktif untuk bulan yang dipilih. Sabtu dan Minggu selalu libur.')}
                                        </p>

                                        {/* Add New Week */}
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                                <Plus className="w-4 h-4" />
                                                {getText('Add Week', 'Tambah Minggu')}
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">{getText('Week Number', 'Minggu Ke')}</label>
                                                    <select
                                                        value={newWeekSetting.week_number}
                                                        onChange={(e) => setNewWeekSetting({ ...newWeekSetting, week_number: parseInt(e.target.value) })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                    >
                                                        {[1, 2, 3, 4, 5].map(w => (
                                                            <option key={w} value={w}>Minggu {w}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">{getText('Start Date', 'Tanggal Mulai')}</label>
                                                    <input
                                                        type="date"
                                                        value={newWeekSetting.start_date}
                                                        onChange={(e) => setNewWeekSetting({ ...newWeekSetting, start_date: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">{getText('End Date', 'Tanggal Akhir')}</label>
                                                    <input
                                                        type="date"
                                                        value={newWeekSetting.end_date}
                                                        onChange={(e) => setNewWeekSetting({ ...newWeekSetting, end_date: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <button
                                                        onClick={handleSaveWeekSetting}
                                                        disabled={savingSettings}
                                                        className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        {getText('Save', 'Simpan')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Existing Week Settings */}
                                        <div className="space-y-2">
                                            {weekSettings.length === 0 ? (
                                                <p className="text-center text-gray-500 py-4">{getText('No week settings for this month', 'Belum ada pengaturan minggu untuk bulan ini')}</p>
                                            ) : (
                                                weekSettings.map((week) => (
                                                    <div key={week.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                                                <span className="font-bold text-teal-600">{week.week_number}</span>
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900">Minggu {week.week_number}</p>
                                                                <p className="text-sm text-gray-500">
                                                                    {format(new Date(week.start_date), 'd MMM', { locale: localeId })} - {format(new Date(week.end_date), 'd MMM yyyy', { locale: localeId })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${week.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                            {week.is_active ? 'Aktif' : 'Non-Aktif'}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Special Dates Tab */}
                                {settingsTab === 'holidays' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-500 mb-4">
                                            {getText('Mark special dates when lecturers cannot submit attendance. Add a reason that will be shown to lecturers.', 'Tandai tanggal khusus dimana dosen tidak bisa melakukan presensi. Tambahkan alasan yang akan ditampilkan ke dosen.')}
                                        </p>

                                        {/* Add New Special Date */}
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                                            <h4 className="font-medium text-red-900 mb-3 flex items-center gap-2">
                                                <Plus className="w-4 h-4" />
                                                {getText('Add Special Date', 'Tambah Tanggal Khusus')}
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">{getText('Date', 'Tanggal')}</label>
                                                    <input
                                                        type="date"
                                                        value={newSpecialDate.date}
                                                        onChange={(e) => setNewSpecialDate({ ...newSpecialDate, date: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">{getText('Reason', 'Alasan')}</label>
                                                    <input
                                                        type="text"
                                                        value={newSpecialDate.reason}
                                                        onChange={(e) => setNewSpecialDate({ ...newSpecialDate, reason: e.target.value })}
                                                        placeholder={getText('e.g. National Holiday', 'cth: Hari Libur Nasional')}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <button
                                                        onClick={handleSaveSpecialDate}
                                                        disabled={savingSettings}
                                                        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        {getText('Save', 'Simpan')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Existing Special Dates */}
                                        <div className="space-y-2">
                                            {specialDates.length === 0 ? (
                                                <p className="text-center text-gray-500 py-4">{getText('No special dates for this month', 'Belum ada tanggal khusus untuk bulan ini')}</p>
                                            ) : (
                                                specialDates.map((sd) => (
                                                    <div key={sd.id} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                                                <CalendarOff className="w-5 h-5 text-red-600" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900">
                                                                    {format(new Date(sd.date), 'EEEE, d MMMM yyyy', { locale: localeId })}
                                                                </p>
                                                                <p className="text-sm text-red-600">{sd.reason}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteSpecialDate(sd.id!)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Payment Rates Tab */}
                                {settingsTab === 'rates' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-500 mb-4">
                                            {getText('Set payment rates for HBV (Homebase Vokasi) and NHBV (Non Homebase Vokasi) lecturers.', 'Atur tarif pembayaran untuk dosen HBV (Homebase Vokasi) dan NHBV (Non Homebase Vokasi).')}
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* HBV Rate */}
                                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                                <h4 className="font-medium text-blue-900 mb-3">HBV (Homebase Vokasi)</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-600">Rp</span>
                                                    <input
                                                        id="hbv-rate-input"
                                                        type="number"
                                                        defaultValue={paymentRates.find(r => r.lecturer_type === 'HBV')?.rate || 75000}
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Per kehadiran terverifikasi</p>
                                                <button
                                                    onClick={() => {
                                                        const input = document.getElementById('hbv-rate-input') as HTMLInputElement;
                                                        handleSavePaymentRate('HBV', parseFloat(input.value));
                                                    }}
                                                    disabled={savingSettings}
                                                    className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    Simpan HBV
                                                </button>
                                            </div>

                                            {/* NHBV Rate */}
                                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                                                <h4 className="font-medium text-orange-900 mb-3">NHBV (Non Homebase Vokasi)</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-600">Rp</span>
                                                    <input
                                                        id="nhbv-rate-input"
                                                        type="number"
                                                        defaultValue={paymentRates.find(r => r.lecturer_type === 'NHBV')?.rate || 75000}
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Per kehadiran terverifikasi</p>
                                                <button
                                                    onClick={() => {
                                                        const input = document.getElementById('nhbv-rate-input') as HTMLInputElement;
                                                        handleSavePaymentRate('NHBV', parseFloat(input.value));
                                                    }}
                                                    disabled={savingSettings}
                                                    className="mt-3 w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    Simpan NHBV
                                                </button>
                                            </div>
                                        </div>

                                    </div>
                                )}

                                {/* Attendance Limits Tab */}
                                {settingsTab === 'limits' && (
                                    <div className="space-y-6">
                                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-200">
                                            <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
                                                <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
                                                {getText('Maximum Weekly Attendance Limits', 'Batas Maksimal Presensi Per Minggu')}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {getText(
                                                    'Set the maximum number of attendance submissions per week for each lecturer type. This limit is applied separately for homebase and non-homebase lecturers.',
                                                    'Atur jumlah maksimal presensi per minggu untuk masing-masing tipe dosen. Batas ini berlaku terpisah untuk dosen homebase dan non-homebase.'
                                                )}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* HBV Max Weekly */}
                                            <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                                                        <Users className="w-5 h-5 text-blue-700" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-blue-900">HBV (Homebase Vokasi)</h4>
                                                        <p className="text-xs text-blue-600">Dosen tetap / homebase</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-600 text-sm font-medium">Maksimal:</span>
                                                    <select
                                                        value={globalSettings.max_weekly_attendance_hbv}
                                                        onChange={(e) => setGlobalSettings(prev => ({
                                                            ...prev,
                                                            max_weekly_attendance_hbv: parseInt(e.target.value)
                                                        }))}
                                                        className="flex-1 px-3 py-2.5 border border-blue-300 rounded-lg bg-white text-blue-900 font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                                                    >
                                                        {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                                            <option key={n} value={n}>{n}x per minggu</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="mt-3 p-2 bg-blue-100 rounded-lg">
                                                    <p className="text-xs text-blue-700 text-center">
                                                        ✅ Dosen homebase dapat presensi maksimal <strong>{globalSettings.max_weekly_attendance_hbv}x</strong> per minggu
                                                    </p>
                                                </div>
                                            </div>

                                            {/* NHBV Max Weekly */}
                                            <div className="bg-orange-50 p-5 rounded-xl border border-orange-200">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
                                                        <Users className="w-5 h-5 text-orange-700" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-orange-900">NHBV (Non Homebase Vokasi)</h4>
                                                        <p className="text-xs text-orange-600">Dosen luar biasa / non-homebase</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-600 text-sm font-medium">Maksimal:</span>
                                                    <select
                                                        value={globalSettings.max_weekly_attendance_nhbv}
                                                        onChange={(e) => setGlobalSettings(prev => ({
                                                            ...prev,
                                                            max_weekly_attendance_nhbv: parseInt(e.target.value)
                                                        }))}
                                                        className="flex-1 px-3 py-2.5 border border-orange-300 rounded-lg bg-white text-orange-900 font-medium focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                                                    >
                                                        {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                                            <option key={n} value={n}>{n}x per minggu</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="mt-3 p-2 bg-orange-100 rounded-lg">
                                                    <p className="text-xs text-orange-700 text-center">
                                                        ✅ Dosen non-homebase dapat presensi maksimal <strong>{globalSettings.max_weekly_attendance_nhbv}x</strong> per minggu
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Summary & Info */}
                                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                                <div className="text-sm text-amber-800">
                                                    <p className="font-medium mb-1">Informasi Penting:</p>
                                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                                        <li>Batas ini dihitung berdasarkan minggu aktif yang sudah diatur di tab "Pengaturan Minggu"</li>
                                                        <li>Dosen yang sudah mencapai batas tidak akan bisa melakukan presensi lagi di minggu tersebut</li>
                                                        <li>Perubahan berlaku segera setelah disimpan</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSaveGlobalSettings}
                                            disabled={savingSettings}
                                            className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-lg shadow-indigo-200 transition-all"
                                        >
                                            <Save className="w-4 h-4" />
                                            {savingSettings ? 'Menyimpan...' : 'Simpan Batas Presensi Mingguan'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Attendance Modal */}
            {showManualAttendanceModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
                        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowManualAttendanceModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <UserPlus className="w-5 h-5" />
                                        {getText('Manual Attendance Input', 'Input Presensi Manual')}
                                    </h2>
                                    <button onClick={() => setShowManualAttendanceModal(false)} className="p-2 text-white hover:bg-white/20 rounded-full">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-blue-100 text-sm mt-1">Untuk backup - otomatis terverifikasi</p>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 space-y-4">
                                {/* Lecturer Selection - Searchable Dropdown */}
                                <div ref={lecturerDropdownRef} className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {getText('Lecturer', 'Dosen')} <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={lecturerSearchTerm}
                                            onChange={(e) => {
                                                setLecturerSearchTerm(e.target.value);
                                                setShowLecturerDropdown(true);
                                                if (e.target.value === '') {
                                                    setManualAttendance(prev => ({ ...prev, lecturer_user_id: '' }));
                                                }
                                            }}
                                            onFocus={() => setShowLecturerDropdown(true)}
                                            placeholder="Ketik nama dosen untuk mencari..."
                                            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        {manualAttendance.lecturer_user_id && (
                                            <button
                                                onClick={() => {
                                                    setLecturerSearchTerm('');
                                                    setManualAttendance(prev => ({ ...prev, lecturer_user_id: '' }));
                                                    setShowLecturerDropdown(false);
                                                }}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {showLecturerDropdown && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                                            {allLecturers
                                                .filter(l => {
                                                    if (!lecturerSearchTerm) return true;
                                                    return l.full_name.toLowerCase().includes(lecturerSearchTerm.toLowerCase());
                                                })
                                                .map(l => (
                                                    <button
                                                        key={l.id}
                                                        onClick={() => {
                                                            setManualAttendance(prev => ({ ...prev, lecturer_user_id: l.id }));
                                                            setLecturerSearchTerm(l.full_name + (l.is_homebase === false ? ' (Non-HB)' : ''));
                                                            setShowLecturerDropdown(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between ${manualAttendance.lecturer_user_id === l.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                                                            }`}
                                                    >
                                                        <span>{l.full_name}</span>
                                                        {l.is_homebase === false && (
                                                            <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Non-HB</span>
                                                        )}
                                                    </button>
                                                ))}
                                            {allLecturers.filter(l => !lecturerSearchTerm || l.full_name.toLowerCase().includes(lecturerSearchTerm.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                    Tidak ada dosen ditemukan
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Date & Time */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {getText('Date', 'Tanggal')} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={manualAttendance.attendance_date}
                                            onChange={(e) => setManualAttendance(prev => ({ ...prev, attendance_date: e.target.value }))}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {getText('Time', 'Waktu')} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={manualAttendance.attendance_time}
                                            onChange={(e) => setManualAttendance(prev => ({ ...prev, attendance_time: e.target.value }))}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Purpose */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {getText('Purpose', 'Tujuan')}
                                    </label>
                                    <select
                                        value={manualAttendance.purpose}
                                        onChange={(e) => setManualAttendance(prev => ({ ...prev, purpose: e.target.value as any }))}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="mengajar">Mengajar</option>
                                        <option value="sidang">Sidang</option>
                                        <option value="lainnya">Lainnya</option>
                                    </select>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {getText('Notes', 'Catatan')} <span className="text-gray-400 text-xs">(Opsional)</span>
                                    </label>
                                    <textarea
                                        value={manualAttendance.additional_notes}
                                        onChange={(e) => setManualAttendance(prev => ({ ...prev, additional_notes: e.target.value }))}
                                        placeholder="Catatan tambahan..."
                                        rows={2}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    />
                                </div>

                                {/* Info Box */}
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div className="text-xs text-blue-700">
                                            <p>Presensi manual otomatis berstatus <strong>Terverifikasi</strong> dan akan ditandai sebagai input admin.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                                <button
                                    onClick={() => setShowManualAttendanceModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                                >
                                    {getText('Cancel', 'Batal')}
                                </button>
                                <button
                                    onClick={handleSaveManualAttendance}
                                    disabled={savingManualAttendance || !manualAttendance.lecturer_user_id}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium"
                                >
                                    {savingManualAttendance ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {savingManualAttendance ? 'Menyimpan...' : getText('Save', 'Simpan')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default FinanceAttendance;
