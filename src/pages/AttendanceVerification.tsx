import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Loader2, FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AttendanceVerification: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [lecturerType, setLecturerType] = useState<'all' | 'homebase' | 'external'>('all');
    const [campuses, setCampuses] = useState<any[]>([]);
    const [selectedCampusId, setSelectedCampusId] = useState<string>('all');
    const [data, setData] = useState<any[]>([]);

    // Global attendance limits from attendance_global_settings
    const [attendanceLimits, setAttendanceLimits] = useState<{
        max_weekly_attendance_hbv: number;
        max_weekly_attendance_nhbv: number;
    }>({
        max_weekly_attendance_hbv: 3,
        max_weekly_attendance_nhbv: 2,
    });

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    useEffect(() => {
        fetchCampuses();
        fetchAttendanceLimits();
    }, []);

    useEffect(() => {
        fetchData();
    }, [selectedMonth, selectedYear, lecturerType, selectedCampusId]);

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

    /** Ambil batas kehadiran per minggu (HBV & NHBV) dari database */
    const fetchAttendanceLimits = async () => {
        try {
            const { data, error } = await supabase
                .from('attendance_global_settings')
                .select('max_weekly_attendance_hbv, max_weekly_attendance_nhbv')
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Error fetching attendance limits:', error);
                return;
            }

            if (data) {
                setAttendanceLimits({
                    max_weekly_attendance_hbv: data.max_weekly_attendance_hbv ?? 3,
                    max_weekly_attendance_nhbv: data.max_weekly_attendance_nhbv ?? 2,
                });
            }
        } catch (error) {
            console.error('Error fetching attendance limits:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const startDate = format(startOfMonth(new Date(selectedYear, selectedMonth)), 'yyyy-MM-dd');
            const endDate = format(endOfMonth(new Date(selectedYear, selectedMonth)), 'yyyy-MM-dd');

            // -------------------------------------------------------
            // Pagination untuk melewati batas default Supabase (1000 baris)
            // Ambil semua data sampai habis menggunakan .range()
            // -------------------------------------------------------
            const PAGE_SIZE = 1000;
            let allRecords: any[] = [];
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                const from = page * PAGE_SIZE;
                const to = from + PAGE_SIZE - 1;

                let query = supabase
                    .from('lecturer_attendance')
                    .select(`
                        *,
                        lecturer:users!lecturer_user_id (
                            id, full_name, identity_number, is_homebase
                        ),
                        details:lecturer_attendance_details (*),
                        scanned_room:rooms!scanned_room_id (
                            id, name, campus_id
                        )
                    `)
                    .gte('attendance_date', startDate)
                    .lte('attendance_date', endDate)
                    .order('attendance_date', { ascending: true })
                    .range(from, to);

                const { data: records, error } = await query;

                if (error) throw error;

                if (records && records.length > 0) {
                    allRecords = [...allRecords, ...records];
                    hasMore = records.length === PAGE_SIZE;
                    page++;
                } else {
                    hasMore = false;
                }
            }

            console.log(`📋 AttendanceVerification: Fetched ${allRecords.length} records (${page} page(s))`);

            // Filter by campus if selected
            let filteredRecords = allRecords;
            if (selectedCampusId !== 'all') {
                filteredRecords = filteredRecords.filter((record: any) => {
                    return record.scanned_room?.campus_id === selectedCampusId;
                });
            }

            // Filter by lecturer type (homebase / non-homebase)
            if (lecturerType === 'homebase') {
                filteredRecords = filteredRecords.filter((record: any) =>
                    record.lecturer?.is_homebase !== false
                );
            } else if (lecturerType === 'external') {
                filteredRecords = filteredRecords.filter((record: any) =>
                    record.lecturer?.is_homebase === false
                );
            }

            // Deduplicate per day per lecturer to avoid double entries
            const uniqueRecordsMap = new Map();
            for (const record of filteredRecords) {
                const lecturerId = record.lecturer_user_id || record.lecturer?.id || record.lecturer_name;
                const key = `${record.attendance_date}_${lecturerId}`;
                
                if (!uniqueRecordsMap.has(key)) {
                    // Clone record to avoid mutating original state
                    uniqueRecordsMap.set(key, { ...record, details: record.details ? [...record.details] : [] });
                } else {
                    const existing = uniqueRecordsMap.get(key);
                    // Merge details so we don't lose activities/classes from multiple check-ins
                    if (record.details && record.details.length > 0) {
                        existing.details = [...(existing.details || []), ...record.details];
                    }
                }
            }
            
            filteredRecords = Array.from(uniqueRecordsMap.values());

            setData(filteredRecords);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Gagal memuat data laporan');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Hitung jumlah presensi yang sudah dicetak per dosen dalam satu bulan.
     * Limit diambil dari database: max_weekly_attendance_hbv (homebase) dan
     * max_weekly_attendance_nhbv (non-homebase).
     * Fungsi ini mengembalikan data yang sudah di-cap sesuai limit bulanan.
     *
     * Catatan: limit di database disimpan per MINGGU (weekly).
     * Jumlah minggu dalam sebulan dihitung dari jumlah hari / 7 (dibulatkan ke atas).
     */
    const applyMonthlyLimitPerLecturer = (records: any[]): any[] => {
        const daysInMonth = eachDayOfInterval({
            start: startOfMonth(new Date(selectedYear, selectedMonth)),
            end: endOfMonth(new Date(selectedYear, selectedMonth))
        });

        // Hitung jumlah minggu dalam bulan yang dipilih
        const weeksInMonth = Math.ceil(daysInMonth.length / 7);

        // Hitung batas bulanan untuk masing-masing jenis dosen
        const monthlyLimitHBV = attendanceLimits.max_weekly_attendance_hbv * weeksInMonth;
        const monthlyLimitNHBV = attendanceLimits.max_weekly_attendance_nhbv * weeksInMonth;

        // Group records by lecturer
        const lecturerCountMap: Record<string, number> = {};
        const limitedRecords: any[] = [];

        for (const record of records) {
            const lecturerId = record.lecturer_user_id || record.lecturer?.id || record.lecturer_name;
            const isHomebase = record.lecturer?.is_homebase !== false; // default ke homebase jika tidak diketahui
            const limit = isHomebase ? monthlyLimitHBV : monthlyLimitNHBV;

            const currentCount = lecturerCountMap[lecturerId] || 0;

            if (currentCount < limit) {
                limitedRecords.push(record);
                lecturerCountMap[lecturerId] = currentCount + 1;
            }
            // Jika sudah mencapai limit, record dilewati (tidak dicetak)
        }

        return limitedRecords;
    };

    const generatePDF = () => {
        if (data.length === 0) {
            toast.error('Tidak ada data untuk dicetak');
            return;
        }

        // Terapkan limit per dosen sebelum cetak
        const limitedData = applyMonthlyLimitPerLecturer(data);

        if (limitedData.length === 0) {
            toast.error('Tidak ada data dalam batas yang diizinkan untuk dicetak');
            return;
        }

        const doc = new jsPDF();
        const daysInMonth = eachDayOfInterval({
            start: startOfMonth(new Date(selectedYear, selectedMonth)),
            end: endOfMonth(new Date(selectedYear, selectedMonth))
        });

        let isFirstPage = true;

        daysInMonth.forEach((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            // Filter records for this day (dari limitedData)
            const dailyRecords = limitedData.filter(r => r.attendance_date === dateStr);

            if (dailyRecords.length === 0) return;

            if (!isFirstPage) {
                doc.addPage();
            }
            isFirstPage = false;

            // Header
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('DAFTAR HADIR DOSEN', 105, 15, { align: 'center' });
            doc.text('FAKULTAS VOKASI UNIVERSITAS NEGERI YOGYAKARTA', 105, 22, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Hari / Tanggal : ${format(date, 'EEEE, d MMMM yyyy', { locale: localeId })}`, 14, 35);

            // Prepare Table Data
            const tableBody = dailyRecords.map((record, index) => {
                const details = record.details || [];
                const distinctCourses = Array.from(new Set(details.map((d: any) => d.course_name).filter(Boolean)));
                const distinctRombels = Array.from(new Set(details.map((d: any) => d.class_group).filter(Boolean)));
                const distinctActivity = Array.from(new Set(details.map((d: any) => d.activity_type)));

                let jobDesc = '-';
                if (distinctActivity.includes('mengajar')) jobDesc = 'Mengajar';
                if (distinctActivity.includes('sidang')) jobDesc = jobDesc === '-' ? 'Sidang' : 'Mengajar & Sidang';

                const courseText = distinctCourses.length > 0 ? distinctCourses.join(', ') : (record.purpose_description || '-');
                const rombelText = distinctRombels.length > 0 ? distinctRombels.join(', ') : '-';

                // Honor placeholder - default to homebase rate
                const honor = 'Rp 75.000';

                return [
                    index + 1,
                    record.lecturer_name + '\n' + (record.lecturer?.identity_number || '-'),
                    '-',  // Rank/Position not available in users table
                    jobDesc,
                    courseText,
                    rombelText,
                    '-', // SKS Placeholder
                    record.attendance_time,
                    honor,
                    '' // Signature placeholder
                ];
            });

            // AutoTable
            // @ts-ignore
            doc.autoTable({
                startY: 40,
                head: [[
                    'No', 'Nama / NIP', 'Gol / Jabatan', 'Tugas',
                    'Mata Kuliah / Kegiatan', 'Kelas', 'SKS', 'Jam Hadir', 'Honor', 'Tanda Tangan'
                ]],
                body: tableBody,
                theme: 'grid',
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0]
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1,
                    textColor: [0, 0, 0],
                    valign: 'middle'
                },
                columnStyles: {
                    0: { cellWidth: 8, halign: 'center' },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 15 },
                    4: { cellWidth: 35 },
                    5: { cellWidth: 12, halign: 'center' },
                    6: { cellWidth: 10, halign: 'center' },
                    7: { cellWidth: 15, halign: 'center' },
                    8: { cellWidth: 20, halign: 'right' },
                    9: { cellWidth: 20, minCellHeight: 15 }
                },
                didDrawCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 9) {
                        const record = dailyRecords[data.row.index];
                        if (record.signature_url) {
                            try {
                                doc.addImage(record.signature_url, 'PNG', data.cell.x + 1, data.cell.y + 1, 18, 13);
                            } catch (e) {
                                // Ignore image error
                            }
                        }
                    }
                }
            });

            // Footer
            const finalY = (doc as any).lastAutoTable.finalY + 10;
            // Ensure there is space for signature
            if (finalY > 250) doc.addPage();

            doc.text('Mengetahui,', 140, finalY);
            doc.text('Wakil Dekan Bidang Keuangan', 140, finalY + 5);
            doc.text('(....................................)', 140, finalY + 25);
        });

        doc.save(`Laporan_LPJ_${months[selectedMonth]}_${selectedYear}.pdf`);
        toast.success(`Laporan berhasil diunduh (${limitedData.length} dari ${data.length} data tercetak)`);
    };

    // Hitung batas bulanan untuk ditampilkan di UI
    const daysInSelectedMonth = eachDayOfInterval({
        start: startOfMonth(new Date(selectedYear, selectedMonth)),
        end: endOfMonth(new Date(selectedYear, selectedMonth))
    });
    const weeksInSelectedMonth = Math.ceil(daysInSelectedMonth.length / 7);
    const monthlyLimitHBV = attendanceLimits.max_weekly_attendance_hbv * weeksInSelectedMonth;
    const monthlyLimitNHBV = attendanceLimits.max_weekly_attendance_nhbv * weeksInSelectedMonth;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Verifikasi Kehadiran & Laporan LPJ</h1>
                    <p className="text-sm text-gray-500 mt-1">Rekapitulasi kehadiran dosen untuk keperluan LPJ</p>
                </div>
                <button
                    onClick={generatePDF}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Download Laporan LPJ
                </button>
            </div>

            {/* Info Batas Presensi */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-800 flex flex-wrap gap-4">
                <span>
                    <strong>Batas Cetak Homebase (HBV):</strong>{' '}
                    {attendanceLimits.max_weekly_attendance_hbv}x/minggu × {weeksInSelectedMonth} minggu = <strong>{monthlyLimitHBV}x/bulan</strong>
                </span>
                <span>
                    <strong>Batas Cetak Non-Homebase (NHBV):</strong>{' '}
                    {attendanceLimits.max_weekly_attendance_nhbv}x/minggu × {weeksInSelectedMonth} minggu = <strong>{monthlyLimitNHBV}x/bulan</strong>
                </span>
                <span className="text-blue-600 italic">
                    Presensi melebihi batas tidak akan dicetak dalam PDF.
                </span>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bulan</label>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {months.map((m, idx) => (
                            <option key={idx} value={idx}>{m}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status Dosen</label>
                    <select
                        value={lecturerType}
                        onChange={(e) => setLecturerType(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">Semua</option>
                        <option value="homebase">Homebase</option>
                        <option value="external">Dosen Luar Biasa (DLB)</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kampus</label>
                    <select
                        value={selectedCampusId}
                        onChange={(e) => setSelectedCampusId(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">Semua Kampus</option>
                        {campuses.map((campus) => (
                            <option key={campus.id} value={campus.id}>
                                {campus.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>Tidak ada data laporan untuk periode ini</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {/* Summary */}
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600 flex gap-6">
                            <span>Total data fetched: <strong>{data.length}</strong></span>
                            <span>Yang akan dicetak (setelah limit): <strong>{applyMonthlyLimitPerLecturer(data).length}</strong></span>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosen</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kegiatan</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruangan</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jam</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.slice(0, 10).map((record, idx) => (
                                    <tr key={idx}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {format(new Date(record.attendance_date), 'dd MMM yyyy')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {record.lecturer_name}
                                            {record.lecturer?.is_homebase === false && (
                                                <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1 rounded">DLB</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {record.details?.map((d: any) => d.course_name || d.activity_type).join(', ') || record.purpose}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {record.scanned_room?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {record.attendance_time}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                Terverifikasi
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {data.length > 10 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                                            ... dan {data.length - 10} data lainnya (total {data.length} data)
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceVerification;
