import React, { useState, useEffect, useMemo } from 'react';
import {
    ClipboardCheck, BarChart3, FileText, Search, CheckCircle, XCircle,
    AlertCircle, User, Clock, Download, RefreshCw, ChevronLeft, ChevronRight,
    Eye, X, Building, Loader2, FileSpreadsheet, Users, TrendingUp, PieChart, Trash2, ChevronDown, ChevronUp,
    BookOpen, GraduationCap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPie, Pie, LineChart, Line } from 'recharts';
import jsPDF from 'jspdf';

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

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // Modal states
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [selectedRecordDetails, setSelectedRecordDetails] = useState<AttendanceDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [verificationNotes, setVerificationNotes] = useState('');
    const [processing, setProcessing] = useState(false);

    // Expanded study programs for reports
    const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());

    // Recap chart filter
    const [recapSelectedProdi, setRecapSelectedProdi] = useState<string>('');
    const [allLecturers, setAllLecturers] = useState<{ id: string; full_name: string; study_program_id: string | null }[]>([]);

    // Fetch data on mount and filter changes
    useEffect(() => {
        fetchAttendanceRecords();
        fetchStudyPrograms();
        fetchAllLecturers();
    }, [dateRange, studyProgramFilter, statusFilter]);

    useEffect(() => {
        if (attendanceRecords.length > 0) {
            calculateStats();
        }
    }, [attendanceRecords]);

    const fetchStudyPrograms = async () => {
        try {
            const { data, error } = await supabase
                .from('study_programs')
                .select('id, name, code')
                .order('name');
            if (error) throw error;
            setStudyPrograms(data || []);
        } catch (error) {
            console.error('Error fetching study programs:', error);
        }
    };

    const fetchAttendanceRecords = async () => {
        try {
            setLoading(true);

            let query = supabase
                .from('lecturer_attendance')
                .select('*, study_program:study_programs(id, name)')
                .gte('attendance_date', dateRange.start)
                .lte('attendance_date', dateRange.end)
                .order('attendance_date', { ascending: false })
                .order('attendance_time', { ascending: false });

            if (studyProgramFilter !== 'all') {
                query = query.eq('study_program_id', studyProgramFilter);
            }

            if (statusFilter !== 'all') {
                query = query.eq('verification_status', statusFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setAttendanceRecords(data || []);
        } catch (error: any) {
            console.error('Error fetching attendance:', error);
            toast.error('Gagal memuat data presensi');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllLecturers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, study_program_id')
                .eq('role', 'lecturer')
                .order('full_name');

            if (error) throw error;
            setAllLecturers(data || []);
        } catch (error) {
            console.error('Error fetching lecturers:', error);
        }
    };

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
        const spData: Record<string, { count: number; lecturers: Record<string, number> }> = {};
        validRecords.forEach(r => {
            const spName = r.study_program?.name || 'Tidak Diketahui';
            if (!spData[spName]) {
                spData[spName] = { count: 0, lecturers: {} };
            }
            spData[spName].count += 1;
            const lecturerName = r.lecturer_name || 'Tidak Diketahui';
            spData[spName].lecturers[lecturerName] = (spData[spName].lecturers[lecturerName] || 0) + 1;
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

    // Handle selecting a record (fetch details too)
    const handleSelectRecord = async (record: AttendanceRecord) => {
        setSelectedRecord(record);
        setVerificationNotes('');
        // Fetch details for this record
        await fetchAttendanceDetails(record.id);
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

    const exportToExcel = () => {
        try {
            const verifiedRecords = attendanceRecords.filter(r => r.verification_status === 'verified');
            if (verifiedRecords.length === 0) {
                toast.error('Tidak ada data terverifikasi untuk diekspor');
                return;
            }

            // Create CSV content
            const headers = ['No', 'Nama Dosen', 'NIP', 'Program Studi', 'Tanggal', 'Waktu', 'Tujuan', 'Keterangan'];
            const rows = verifiedRecords.map((r, i) => [
                i + 1,
                r.lecturer_name,
                '-',
                r.study_program?.name || '-',
                format(new Date(r.attendance_date), 'dd/MM/yyyy'),
                r.attendance_time?.substring(0, 5) || '-',
                r.purpose === 'mengajar' ? 'Mengajar' : r.purpose === 'sidang' ? 'Sidang' : 'Lainnya',
                r.purpose_description || '-'
            ]);

            const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Rekap_Kehadiran_Dosen_${format(new Date(), 'yyyy-MM-dd')}.csv`;
            link.click();
            URL.revokeObjectURL(url);

            toast.success('Excel (CSV) berhasil diunduh');
        } catch (error) {
            console.error('Error generating Excel:', error);
            toast.error('Gagal membuat Excel');
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
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                            <tr key={record.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    {record.photo_capture ? (
                                                        <img
                                                            src={record.photo_capture}
                                                            alt=""
                                                            className="w-12 h-12 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={() => { setSelectedRecord(record); setShowImageModal(true); }}
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                                            <User className="w-5 h-5 text-gray-400" />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900">{record.lecturer_name}</div>
                                                    <div className="text-xs text-gray-500">{record.study_program?.name || '-'}</div>
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
                                            className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 rounded-lg">
                                                    <Building className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-semibold text-gray-900">{sp.name}</div>
                                                    <div className="text-sm text-gray-500">{sp.lecturers.length} dosen</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-blue-600">{sp.count}</div>
                                                    <div className="text-xs text-gray-500">kehadiran</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full"
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
                                                                            <Clock className="w-3 h-3" /> Perlu Perhatian
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
                                    <button onClick={() => { setSelectedRecord(null); setVerificationNotes(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                {selectedRecord.photo_capture && (
                                    <img src={selectedRecord.photo_capture} alt="" className="w-full h-48 object-cover rounded-xl" />
                                )}
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
                                </div>
                                {selectedRecord.purpose_description && (
                                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                        <label className="text-yellow-800 text-xs font-semibold uppercase tracking-wider">Detail Tujuan</label>
                                        <p className="mt-1 font-medium text-gray-900">{selectedRecord.purpose_description}</p>
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
                                        <div className="flex items-center gap-2 mb-3">
                                            <BookOpen className="w-4 h-4 text-blue-600" />
                                            <label className="text-blue-800 text-sm font-semibold">
                                                Detail Kegiatan ({selectedRecordDetails.length})
                                            </label>
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
        </div >
    );
};

export default FinanceAttendance;
