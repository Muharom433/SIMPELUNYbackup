import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { User, Calendar, Clock, BookOpen, GraduationCap, MapPin, FileSignature, Camera, Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface AttendanceDetail {
    id: string;
    attendance_id: string;
    activity_type: 'mengajar' | 'sidang' | 'lainnya';
    course_name?: string;
    course_code?: string;
    study_program_name?: string;
    class_group?: string;
    semester?: string;
    session_schedule_id?: string;
    student_name?: string;
    student_nim?: string;
    session_type?: string;
    role_in_session?: string;
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
    verification_status: 'pending' | 'verified' | 'rejected';
    signature_url?: string;
    study_program?: { id: string; name: string } | null;
    details?: AttendanceDetail[];
    is_homebase?: boolean;
}

const AttendanceDailyDetail: React.FC = () => {
    const [searchParams] = useSearchParams();
    const dateParam = searchParams.get('date');
    const typeParam = searchParams.get('type'); // 'homebase' or 'non_homebase'

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    useEffect(() => {
        if (dateParam) {
            setSelectedDate(dateParam);
            fetchAttendanceRecords(dateParam);
        } else {
            setError('Parameter tanggal tidak ditemukan');
            setLoading(false);
        }
    }, [dateParam, typeParam]);

    const fetchAttendanceRecords = async (date: string) => {
        try {
            setLoading(true);
            setError(null);

            // Fetch attendance records for the specific date
            const { data, error: fetchError } = await supabase
                .from('lecturer_attendance')
                .select(`
                    *,
                    study_program:study_programs(id, name),
                    details:lecturer_attendance_details(*)
                `)
                .eq('attendance_date', date)
                .eq('verification_status', 'verified')
                .order('attendance_time', { ascending: true });

            if (fetchError) throw fetchError;

            // Fetch homebase status for lecturers
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

            // Enrich with homebase status
            let enrichedData = (data || []).map(r => ({
                ...r,
                is_homebase: homebaseMap[r.lecturer_user_id] ?? true
            }));

            // Filter by type if specified
            if (typeParam === 'homebase') {
                enrichedData = enrichedData.filter(r => r.is_homebase === true);
            } else if (typeParam === 'non_homebase') {
                enrichedData = enrichedData.filter(r => r.is_homebase === false);
            }

            setRecords(enrichedData);
        } catch (err: any) {
            setError('Gagal memuat data presensi');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'verified':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Terverifikasi
                    </span>
                );
            case 'pending':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        Pending
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        Ditolak
                    </span>
                );
            default:
                return null;
        }
    };

    const getPurposeLabel = (purpose: string) => {
        switch (purpose) {
            case 'mengajar':
                return 'Mengajar';
            case 'sidang':
                return 'Sidang';
            default:
                return 'Lainnya';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Memuat data presensi...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Terjadi Kesalahan</h2>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <GraduationCap className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-2">
                        Daftar Hadir Dosen {typeParam === 'homebase' ? '(Home Base)' : typeParam === 'non_homebase' ? '(Non Home Base)' : ''}
                    </h1>
                    <h2 className="text-lg font-semibold text-center text-blue-600 mb-1">
                        Fakultas Vokasi
                    </h2>
                    <p className="text-sm text-gray-500 text-center">
                        Semester Genap Tahun 2025/2026
                    </p>

                    {selectedDate && (
                        <div className="mt-4 flex items-center justify-center gap-4 text-gray-600">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-500" />
                                <span className="font-medium">
                                    {format(new Date(selectedDate), 'EEEE, d MMMM yyyy', { locale: localeId })}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 text-center">
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                            <User className="w-4 h-4" />
                            Total: {records.length} Dosen Hadir
                        </span>
                    </div>
                </div>

                {/* Attendance Cards */}
                {records.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <User className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Tidak Ada Data</h3>
                        <p className="text-gray-500">Tidak ada presensi dosen pada tanggal ini</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:gap-6">
                        {records.map((record, index) => (
                            <div
                                key={record.id}
                                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
                            >
                                <div className="p-4 md:p-6">
                                    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                                        {/* Photo Section */}
                                        <div className="flex-shrink-0">
                                            <div className="relative">
                                                {record.photo_capture ? (
                                                    <img
                                                        src={record.photo_capture}
                                                        alt={`Foto ${record.lecturer_name}`}
                                                        className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-xl shadow-md mx-auto md:mx-0"
                                                    />
                                                ) : (
                                                    <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center mx-auto md:mx-0">
                                                        <Camera className="w-10 h-10 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                                                    {index + 1}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info Section */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                                                <div>
                                                    <h3 className="text-lg md:text-xl font-bold text-gray-800">
                                                        {record.lecturer_name}
                                                    </h3>
                                                    <p className="text-sm text-gray-500">
                                                        {record.study_program?.name || '-'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {getStatusBadge(record.verification_status)}
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${record.is_homebase
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-purple-100 text-purple-700'
                                                        }`}>
                                                        {record.is_homebase ? 'Home Base' : 'Non Home Base'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                                    <span className="text-sm">
                                                        Jam Hadir: <strong>{record.attendance_time?.substring(0, 5) || '-'}</strong>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <BookOpen className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                    <span className="text-sm">
                                                        Tujuan: <strong>{getPurposeLabel(record.purpose)}</strong>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Purpose Description */}
                                            {record.purpose_description && (
                                                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                                    <p className="text-sm text-gray-700">
                                                        <span className="font-medium">Keterangan:</span> {record.purpose_description}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Activity Details */}
                                            {record.details && record.details.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                                        <GraduationCap className="w-4 h-4" />
                                                        Detail Kegiatan:
                                                    </h4>
                                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 space-y-2">
                                                        {record.details.map((detail, idx) => (
                                                            <div key={detail.id || idx} className="text-sm">
                                                                <div className="flex items-start gap-2">
                                                                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <div>
                                                                        <p className="font-medium text-gray-800">
                                                                            {detail.course_name || detail.session_type || 'Kegiatan'}
                                                                        </p>
                                                                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                                                                            {detail.class_group && (
                                                                                <span className="bg-white px-2 py-0.5 rounded">
                                                                                    Kelas: {detail.class_group}
                                                                                </span>
                                                                            )}
                                                                            {detail.study_program_name && (
                                                                                <span className="bg-white px-2 py-0.5 rounded">
                                                                                    {detail.study_program_name}
                                                                                </span>
                                                                            )}
                                                                            {detail.room_name && (
                                                                                <span className="bg-white px-2 py-0.5 rounded flex items-center gap-1">
                                                                                    <MapPin className="w-3 h-3" />
                                                                                    {detail.room_name}
                                                                                </span>
                                                                            )}
                                                                            {detail.start_time && detail.end_time && (
                                                                                <span className="bg-white px-2 py-0.5 rounded">
                                                                                    {detail.start_time.substring(0, 5)} - {detail.end_time.substring(0, 5)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Signature Section */}
                                        <div className="flex-shrink-0 flex flex-col items-center md:items-end">
                                            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                <FileSignature className="w-3.5 h-3.5" />
                                                Tanda Tangan
                                            </p>
                                            {record.signature_url ? (
                                                <div className="bg-white border-2 border-gray-200 rounded-lg p-2">
                                                    <img
                                                        src={record.signature_url}
                                                        alt="Tanda tangan"
                                                        className="w-24 h-16 md:w-32 md:h-20 object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-24 h-16 md:w-32 md:h-20 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                                                    <span className="text-xs text-gray-400">Tidak ada TTD</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>Dokumen ini merupakan bukti kehadiran dosen yang terverifikasi</p>
                    <p className="mt-1">
                        Dicetak pada: {format(new Date(), "d MMMM yyyy 'pukul' HH:mm", { locale: localeId })}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AttendanceDailyDetail;
