// Debugging backup failure - Investigating status mapping
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import {
    Trash2,
    AlertTriangle,
    Database,
    Calendar,
    CheckCircle,
    Download,
    FileSpreadsheet,
    HardDrive
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { format, subMonths, subYears } from 'date-fns';

export default function StorageManagement() {
    const { getText } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [cutoffOption, setCutoffOption] = useState('3_months'); // 1_month, 3_months, 6_months, 1_year

    // Stats
    const [stats, setStats] = useState({
        bookings: 0,
        checkouts: 0,
        notifications: 0,
        reports: 0,
        attendance: 0,
        lending_tools: 0,
        todos: 0,
        forms: 0
    });

    // Selection
    const [targets, setTargets] = useState({
        bookings: true,
        checkouts: true,
        notifications: true,
        reports: true,
        attendance: true,
        lending_tools: true,
        todos: true,
        forms: true
    });

    // Confirmation
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const getCutoffDate = () => {
        const now = new Date();
        switch (cutoffOption) {
            case '1_month': return subMonths(now, 1);
            case '3_months': return subMonths(now, 3);
            case '6_months': return subMonths(now, 6);
            case '1_year': return subYears(now, 1);
            case '2_years': return subYears(now, 2);
            default: return subMonths(now, 3);
        }
    };

    const analyzeData = async () => {
        setAnalyzing(true);
        try {
            const cutoff = getCutoffDate().toISOString();

            // We can't use the secure RPC for analysis (it deletes), so we run count queries
            // Note: This matches the logic in the RPC function

            let bookingsCount = 0;
            let checkoutsCount = 0;
            let notifsCount = 0;

            // DEBUG: Check total unlabeled checkouts to see if DB connection works
            const { count: totalAll } = await supabase.from('checkouts').select('id', { count: 'exact', head: true });
            console.log('DEBUG: Total Checkouts in DB (Unfiltered):', totalAll);
            if (totalAll === 0) {
                // toast('Info: Tabel Checkouts tampak kosong (0 data). Pastikan Anda terhubung ke database yang benar.', { icon: '🔍' });
            } else {
                // toast.success(`Debug: Terdeteksi ${totalAll} total checkout di database.`);
            }

            if (targets.bookings) {
                const { count } = await supabase
                    .from('bookings')
                    .select('id', { count: 'exact', head: true })
                    .gte('end_time', cutoff) // Data DARI cutoff SAMPAI SEKARANG
                    .in('status', ['completed', 'rejected', 'cancelled', 'pending', 'approved']);
                bookingsCount = count || 0;
            }

            if (targets.checkouts) {
                const { count } = await supabase
                    .from('checkouts')
                    .select('id', { count: 'exact', head: true })
                    .gte('created_at', cutoff) // Data DARI cutoff SAMPAI SEKARANG
                    .in('status', ['returned', 'completed', 'lost', 'damaged', 'pending', 'rejected', 'active', 'overdue', 'approved']);
                checkoutsCount = count || 0;
            }
            console.log('Analysis cutoff:', cutoff);

            if (targets.notifications) {
                try {
                    const { count, error } = await supabase
                        .from('notifications')
                        .select('id', { count: 'exact', head: true })
                        .gte('created_at', cutoff); // Data DARI cutoff SAMPAI SEKARANG

                    if (!error || error.code === '42P01') {
                        notifsCount = count || 0;
                    }
                } catch (e) {
                    // Tabel notifications tidak ada, skip
                    console.warn('Tabel notifications tidak ditemukan');
                    notifsCount = 0;
                }
            }

            // 4. Count Reports
            let reportsCount = 0;
            if (targets.reports) {
                try {
                    const { count, error } = await supabase
                        .from('reports')
                        .select('id', { count: 'exact', head: true })
                        .gte('created_at', cutoff);

                    if (!error || error.code === '42P01') {
                        reportsCount = count || 0;
                    }
                } catch (e) {
                    console.warn('Tabel reports tidak ditemukan');
                    reportsCount = 0;
                }
            }

            // 5. Count Attendance Records
            let attendanceCount = 0;
            if (targets.attendance) {
                try {
                    const { count, error } = await supabase
                        .from('lecturer_attendance')
                        .select('id', { count: 'exact', head: true })
                        .gte('created_at', cutoff)
                        .in('verification_status', ['verified', 'pending', 'rejected']);

                    if (!error || error.code === '42P01') {
                        attendanceCount = count || 0;
                    }
                } catch (e) {
                    console.warn('Tabel lecturer_attendance tidak ditemukan');
                    attendanceCount = 0;
                }
            }

            // 6. Count Lending Tools
            let lendingToolsCount = 0;
            if (targets.lending_tools) {
                try {
                    const { count, error } = await supabase
                        .from('lending_tool')
                        .select('id', { count: 'exact', head: true })
                        .gte('date', cutoff)
                        .in('status', ['returned', 'completed', 'rejected', 'cancelled', 'pending', 'approved', 'active']);

                    if (!error) {
                        lendingToolsCount = count || 0;
                    }
                } catch (e) {
                    console.warn('Tabel lending_tool error', e);
                    lendingToolsCount = 0;
                }
            }

            // 6. Count To-Do Lists
            let todosCount = 0;
            if (targets.todos) {
                try {
                    const { count, error } = await supabase
                        .from('technician_tasks')
                        .select('id', { count: 'exact', head: true })
                        .gte('created_at', cutoff);
                    // .eq('status', 'completed'); // Count ALL tasks for debug/broadening

                    if (!error || error.code === '42P01') {
                        todosCount = count || 0;
                    }
                } catch (e) {
                    console.warn('Tabel technician_tasks tidak ditemukan');
                    todosCount = 0;
                }
            }

            // 7. Count Forms
            let formsCount = 0;
            if (targets.forms) {
                try {
                    const { count, error } = await supabase
                        .from('forms')
                        .select('id', { count: 'exact', head: true })
                        .gte('created_at', cutoff);

                    if (!error || error.code === '42P01') {
                        formsCount = count || 0;
                    }
                } catch (e) {
                    console.warn('Tabel forms tidak ditemukan');
                    formsCount = 0;
                }
            }

            setStats({
                bookings: bookingsCount,
                checkouts: checkoutsCount,
                notifications: notifsCount,
                reports: reportsCount,
                attendance: attendanceCount,
                lending_tools: lendingToolsCount,
                todos: todosCount,
                forms: formsCount
            });

        } catch (error) {
            console.error('Error analyzing data:', error);
            toast.error('Gagal menganalisis data');
        } finally {
            setAnalyzing(false);
        }
    };

    // Re-analyze when options change
    useEffect(() => {
        analyzeData();
    }, [cutoffOption, targets]);

    const handleDownloadBackup = async () => {
        const toastId = toast.loading('Menyiapkan backup data...');

        // DEBUG: Inspect checkouts table structure
        const { data: debugCheckouts } = await supabase.from('checkouts').select('*').limit(1);
        if (debugCheckouts && debugCheckouts.length > 0) {
            console.log('DEBUG: Checkouts Columns:', Object.keys(debugCheckouts[0]));
        }
        const sanitizeForExcel = (data: any[]) => {
            return data.map(item => {
                const newItem: any = { ...item };
                Object.keys(newItem).forEach(key => {
                    const value = newItem[key];
                    if (typeof value === 'string') {
                        // Truncate jika terlalu panjang
                        if (value.length > 32000) {
                            newItem[key] = value.substring(0, 32000) + '... [TRUNCATED]';
                        }
                        // Hapus data base64 gambar yang biasanya sangat panjang
                        if ((key === 'photo_capture' || key === 'signature_url' || key === 'image_url' || key === 'signature' || key === 'attachment') && value.length > 1000) {
                            newItem[key] = '[IMAGE/DATA REMOVED FOR EXCEL COMPATIBILITY]';
                        }
                    }
                });
                return newItem;
            });
        };

        try {
            const cutoff = getCutoffDate().toISOString();
            const wb = XLSX.utils.book_new();
            let hasData = false;

            // 1. Export Bookings
            if (targets.bookings) {
                const { data: bookings } = await supabase
                    .from('bookings')
                    .select(`
            *,
            users (full_name, identity_number),
            rooms (name, code)
          `)
                    .gte('end_time', cutoff) // Data DARI cutoff SAMPAI SEKARANG
                    .in('status', ['completed', 'rejected', 'cancelled', 'pending', 'approved']);

                if (bookings && bookings.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(sanitizeForExcel(bookings.map(b => ({
                        ID: b.id,
                        User: b.users?.full_name,
                        NIP: b.users?.identity_number,
                        Room: b.rooms?.name,
                        Start: b.start_time,
                        End: b.end_time,
                        Status: b.status,
                        Purpose: b.purpose
                    }))));
                    XLSX.utils.book_append_sheet(wb, ws, "Bookings History");
                    hasData = true;
                }
            }

            // 2. Export Checkouts & Items
            if (targets.checkouts) {
                const { data: checkouts } = await supabase
                    .from('checkouts')
                    .select(`
            *
          `); // Filter REMOVED, Join REMOVED for debug

                if (checkouts && checkouts.length > 0) {
                    console.log('Checkouts found for backup:', checkouts.length);
                    const ws = XLSX.utils.json_to_sheet(sanitizeForExcel(checkouts.map(c => ({
                        ID: c.id,
                        User: c.users?.full_name,
                        Date: c.checkout_date,
                        ReturnDate: c.actual_return_date,
                        Status: c.status,
                        TotalItems: c.total_items
                    }))));
                    XLSX.utils.book_append_sheet(wb, ws, "Checkouts History");
                    hasData = true;

                    // Export Checkout Items (Child)
                    const checkoutIds = checkouts.map(c => c.id);
                    const { data: checkoutItems } = await supabase
                        .from('checkout_items')
                        .select('*, equipment(name, code)')
                        .in('checkout_id', checkoutIds);

                    // Always create sheet for items
                    const itemsData = checkoutItems && checkoutItems.length > 0
                        ? sanitizeForExcel(checkoutItems.map(i => ({
                            CheckoutID: i.checkout_id,
                            EquipmentName: i.equipment?.name,
                            EquipmentCode: i.equipment?.code,
                            ConditionBefore: i.condition_before,
                            ConditionAfter: i.condition_after
                        })))
                        : [{ Status: "Tidak ada data detail item" }];

                    const wsItems = XLSX.utils.json_to_sheet(itemsData);
                    XLSX.utils.book_append_sheet(wb, wsItems, "Checkout Items");
                }
            }

            // 3. Export Notifications
            if (targets.notifications) {
                try {
                    const { data: notifs, error } = await supabase
                        .from('notifications')
                        .select('*')
                        .gte('created_at', cutoff);

                    if (!error && notifs && notifs.length > 0) {
                        const ws = XLSX.utils.json_to_sheet(sanitizeForExcel(notifs));
                        XLSX.utils.book_append_sheet(wb, ws, "Notifications");
                        hasData = true;
                    }
                } catch (e: any) {
                    if (e.code !== '42P01') console.error('Error exporting notifications:', e);
                }
            }

            // 4. Export Reports
            if (targets.reports) {
                try {
                    const { data: reports, error } = await supabase
                        .from('reports')
                        .select('*')
                        .gte('created_at', cutoff);

                    if (!error && reports && reports.length > 0) {
                        const ws = XLSX.utils.json_to_sheet(sanitizeForExcel(reports));
                        XLSX.utils.book_append_sheet(wb, ws, "Reports");
                        hasData = true;
                    }
                } catch (e: any) {
                    if (e.code !== '42P01') console.error('Error exporting reports:', e);
                }
            }

            // 5. Export Attendance & Details
            if (targets.attendance) {
                try {
                    const { data: attendance, error } = await supabase
                        .from('lecturer_attendance')
                        .select('*')
                        .gte('created_at', cutoff)
                        .in('verification_status', ['verified', 'pending', 'rejected']);

                    if (!error && attendance && attendance.length > 0) {
                        const ws = XLSX.utils.json_to_sheet(sanitizeForExcel(attendance));
                        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
                        hasData = true;

                        // Export Attendance Details (Child)
                        const attendanceIds = attendance.map(a => a.id);
                        const { data: attendanceDetails } = await supabase
                            .from('lecturer_attendance_details')
                            .select('*')
                            .in('attendance_id', attendanceIds);

                        // Always create sheet for details
                        const detailsData = attendanceDetails && attendanceDetails.length > 0
                            ? sanitizeForExcel(attendanceDetails)
                            : [{ Status: "Tidak ada data detail presensi (Mata Kuliah/Sidang) untuk data terpilih" }];

                        const wsDetails = XLSX.utils.json_to_sheet(detailsData);
                        XLSX.utils.book_append_sheet(wb, wsDetails, "Attendance Details");
                    }
                } catch (e: any) {
                    if (e.code !== '42P01') console.error('Error exporting attendance:', e);
                }
            }

            // 6. Export Lending Tools
            if (targets.lending_tools) {
                try {
                    const { data: lendingTools, error } = await supabase
                        .from('lending_tool')
                        .select('*')
                        .gte('date', cutoff)
                        .in('status', ['returned', 'completed', 'rejected', 'cancelled', 'pending', 'approved', 'active']);

                    if (!error && lendingTools && lendingTools.length > 0) {
                        const ws = XLSX.utils.json_to_sheet(sanitizeForExcel(lendingTools));
                        XLSX.utils.book_append_sheet(wb, ws, "Lending Tools");
                        hasData = true;
                    }
                } catch (e: any) {
                    console.error('Error exporting lending tools:', e);
                }
            }

            // 6. Export To-Do Lists
            if (targets.todos) {
                try {
                    const { data: todos, error } = await supabase
                        .from('technician_tasks')
                        .select('*')
                        .gte('created_at', cutoff);
                    // .eq('status', 'completed');

                    if (!error && todos && todos.length > 0) {
                        const ws = XLSX.utils.json_to_sheet(sanitizeForExcel(todos));
                        XLSX.utils.book_append_sheet(wb, ws, "ToDo Lists");
                        hasData = true;
                    }
                } catch (e: any) {
                    if (e.code !== '42P01') console.error('Error exporting todos:', e);
                }
            }

            // 7. Export Forms & Responses
            if (targets.forms) {
                try {
                    const { data: forms, error } = await supabase
                        .from('forms')
                        .select('*')
                        .gte('created_at', cutoff);

                    if (!error && forms && forms.length > 0) {
                        const ws = XLSX.utils.json_to_sheet(sanitizeForExcel(forms));
                        XLSX.utils.book_append_sheet(wb, ws, "Forms");
                        hasData = true;

                        // Export Form Responses (Child)
                        const formIds = forms.map(f => f.id);
                        const { data: responses } = await supabase
                            .from('form_responses')
                            .select('*')
                            .in('form_id', formIds);

                        // Always create sheet for responses
                        const responsesData = responses && responses.length > 0
                            ? sanitizeForExcel(responses)
                            : [{ Status: "Tidak ada data respon di form terpilih" }];

                        const wsResponses = XLSX.utils.json_to_sheet(responsesData);
                        XLSX.utils.book_append_sheet(wb, wsResponses, "Form Responses");
                    }
                } catch (e: any) {
                    if (e.code !== '42P01') console.error('Error exporting forms:', e);
                }
            }

            if (!hasData) {
                toast.dismiss(toastId);
                toast('Tidak ada data yang perlu di-backup untuk periode ini.', { icon: 'ℹ️' });
                return;
            }

            // Save file
            const fileName = `SIMPELUNY_Backup_${format(new Date(), 'yyyy-MM-dd')}_older_than_${cutoffOption}.xlsx`;
            XLSX.writeFile(wb, fileName);

            toast.success('Backup berhasil diunduh!', { id: toastId });

        } catch (error: any) {
            console.error('Download error:', error);
            // Show detailed error if available
            toast.error(`Gagal mengunduh backup: ${error.message || 'Unknown error'}`, { id: toastId });
        }
    };

    const handleCleanup = async () => {
        if (confirmText !== 'HAPUS' && confirmText !== 'DELETE') {
            toast.error('Kata konfirmasi salah');
            return;
        }

        setLoading(true);
        const toastId = toast.loading('Sedang membersihkan data...');

        try {
            const cutoff = getCutoffDate().toISOString();
            let totalDeleted = 0;

            // USE RPC FUNCTION FOR ROBUST CLEANUP
            const targetTables: string[] = [];
            if (targets.checkouts) targetTables.push('checkouts');
            if (targets.bookings) targetTables.push('bookings');
            if (targets.notifications) targetTables.push('notifications');
            if (targets.reports) targetTables.push('reports'); // Note: RPC might not handle reports yet, but good to add if updated
            if (targets.attendance) targetTables.push('attendance');
            if (targets.lending_tools) targetTables.push('lending_tools'); // Changed Key for RPC
            if (targets.todos) targetTables.push('todos'); // Note: RPC might not handle todos

            // NOTE: admin_cleanup_data_v2 handles dependencies (checkout_items, duplicates, violations) automatically.
            // We use 'within_period' mode to match the .gte logic used in this component.
            const { data: cleanupResult, error: cleanupError } = await supabase.rpc('admin_cleanup_data_v2', {
                cutoff_date: cutoff,
                target_tables: targetTables,
                cleanup_mode: 'within_period'
            });

            if (cleanupError) throw cleanupError;

            // Handle non-RPC cleanup manually if needed (e.g. reports, todos, forms if RPC doesn't cover them yet)
            // But for now we trust the RPC or accept that some might not be covered if not in RPC params.
            // Based on migration, RPC handles: checkouts, bookings, notifications, attendance, lending_tools.

            // Manual fallback for tables NOT in RPC yet:

            // DELETE REPORTS (Manual)
            if (targets.reports) {
                const { count } = await supabase.from('reports').delete({ count: 'exact' }).gte('created_at', cutoff);
                totalDeleted += count || 0;
            }
            // DELETE TODOS (Manual)
            if (targets.todos) {
                const { count } = await supabase.from('technician_tasks').delete({ count: 'exact' }).gte('created_at', cutoff); // Remove status check to clean ALL
                totalDeleted += count || 0;
            }
            // DELETE FORMS (Manual)
            if (targets.forms) {
                // Forms cleanup needs dependency handling, best done manually here if not in RPC
                const { data: forms } = await supabase.from('forms').select('id').gte('created_at', cutoff);
                if (forms && forms.length > 0) {
                    const fIds = forms.map(f => f.id);
                    await supabase.from('form_responses').delete().in('form_id', fIds);
                    const { count } = await supabase.from('forms').delete({ count: 'exact' }).in('id', fIds);
                    totalDeleted += count || 0;
                }
            }

            if (cleanupResult) {
                // Sum up RPC results
                const res = cleanupResult as any;
                totalDeleted += (res.checkouts || 0) + (res.bookings || 0) + (res.lending_tools || 0) + (res.notifications || 0) + (res.attendance || 0);
            }

            toast.success(`Berhasil menghapus data!`, { id: toastId });

            setShowConfirm(false);
            setConfirmText('');

            // Refresh stats
            analyzeData();

        } catch (error: any) {
            console.error('Cleanup error:', error);
            toast.error('Gagal: ' + error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const totalRecords = stats.bookings + stats.checkouts + stats.notifications + stats.reports + stats.attendance + stats.lending_tools + stats.todos + stats.forms;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Database className="h-8 w-8 text-blue-600" />
                    Manajemen Penyimpanan Data
                </h1>
                <p className="text-gray-500 mt-2">
                    Kelola penggunaan penyimpanan dengan menghapus riwayat data lama (Booking, Peminjaman, Notifikasi, Reports, Presensi, To-Do List, Forms).
                </p>
            </div>

            {/* Configuration Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    Konfigurasi Pembersihan
                </h2>

                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pilih Periode Data (Terhitung Mundur):
                                </label>
                                <select
                                    value={cutoffOption}
                                    onChange={(e) => setCutoffOption(e.target.value)}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-gray-50"
                                >
                                    <option value="1_month">1 Bulan Terakhir</option>
                                    <option value="3_months">3 Bulan Terakhir</option>
                                    <option value="6_months">6 Bulan Terakhir</option>
                                    <option value="1_year">1 Tahun Terakhir</option>
                                    <option value="2_years">2 Tahun Terakhir</option>
                                </select>
                                <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-100">
                                    <p className="text-xs text-red-800">
                                        <span className="font-bold">PERHATIAN:</span> Anda akan menghapus data <span className="font-bold">DARI</span> <span className="font-bold underline">{format(getCutoffDate(), 'dd MMMM yyyy')}</span> <span className="font-bold">SAMPAI HARI INI</span>.
                                    </p>
                                    <p className="text-xs text-red-600 mt-1">
                                        Data <span className="font-bold">DALAM RENTANG WAKTU TERSEBUT</span> akan <span className="font-bold">DIHAPUS (DIBERSIHKAN)</span> atau <span className="font-bold">DI-BACKUP</span>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">Target Data:</label>

                            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                                <input
                                    type="checkbox"
                                    checked={targets.checkouts}
                                    onChange={(e) => setTargets({ ...targets, checkouts: e.target.checked })}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900">Riwayat Peminjaman Barang</span>
                                    <p className="text-xs text-gray-500">Termasuk data Validation Queue (Antrian Validasi), item detail, dan pelanggaran</p>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                                <input
                                    type="checkbox"
                                    checked={targets.bookings}
                                    onChange={(e) => setTargets({ ...targets, bookings: e.target.checked })}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900">Riwayat Booking Ruangan</span>
                                    <p className="text-xs text-gray-500">Hanya status Completed, Rejected, Cancelled</p>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                                <input
                                    type="checkbox"
                                    checked={targets.notifications}
                                    onChange={(e) => setTargets({ ...targets, notifications: e.target.checked })}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900">Notifikasi Lama</span>
                                    <p className="text-xs text-gray-500">Log notifikasi sistem</p>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                                <input
                                    type="checkbox"
                                    checked={targets.reports}
                                    onChange={(e) => setTargets({ ...targets, reports: e.target.checked })}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900">Data Reports</span>
                                    <p className="text-xs text-gray-500">Laporan dan report yang telah dibuat</p>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                                <input
                                    type="checkbox"
                                    checked={targets.attendance}
                                    onChange={(e) => setTargets({ ...targets, attendance: e.target.checked })}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900">Data Presensi</span>
                                    <p className="text-xs text-gray-500">Riwayat kehadiran (Verified & Pending)</p>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                                <input
                                    type="checkbox"
                                    checked={targets.lending_tools}
                                    onChange={(e) => setTargets({ ...targets, lending_tools: e.target.checked })}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900">Tool Lending Administration</span>
                                    <p className="text-xs text-gray-500">Peminjaman alat (Completed/Returned)</p>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                                <input
                                    type="checkbox"
                                    checked={targets.todos}
                                    onChange={(e) => setTargets({ ...targets, todos: e.target.checked })}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900">To-Do List (Selesai)</span>
                                    <p className="text-xs text-gray-500">Tugas teknisi yang sudah selesai</p>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
                                <input
                                    type="checkbox"
                                    checked={targets.forms}
                                    onChange={(e) => setTargets({ ...targets, forms: e.target.checked })}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900">Data Forms</span>
                                    <p className="text-xs text-gray-500">Form builder dan responses</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 flex flex-col justify-center">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 text-center">Estimasi Data Dihapus</h3>

                        {analyzing ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-gray-900">{totalRecords}</div>
                                    <div className="text-sm text-gray-500">Total Item</div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="font-bold text-blue-600">{stats.checkouts}</div>
                                        <div className="text-gray-500">Peminjaman</div>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="font-bold text-green-600">{stats.bookings}</div>
                                        <div className="text-gray-500">Booking</div>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="font-bold text-purple-600">{stats.notifications}</div>
                                        <div className="text-gray-500">Notifikasi</div>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="font-bold text-orange-600">{stats.reports}</div>
                                        <div className="text-gray-500">Reports</div>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="font-bold text-teal-600">{stats.attendance}</div>
                                        <div className="text-gray-500">Presensi</div>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="font-bold text-cyan-600">{stats.lending_tools}</div>
                                        <div className="text-gray-500">Alat</div>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="font-bold text-pink-600">{stats.todos}</div>
                                        <div className="text-gray-500">To-Do</div>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm">
                                        <div className="font-bold text-indigo-600">{stats.forms}</div>
                                        <div className="text-gray-500">Forms</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 space-y-3">
                            <button
                                onClick={handleDownloadBackup}
                                disabled={analyzing || totalRecords === 0}
                                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-blue-600 text-blue-700 py-2.5 rounded-lg hover:bg-blue-50 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FileSpreadsheet className="h-5 w-5" />
                                Backup / Download CSV
                            </button>

                            <button
                                onClick={() => setShowConfirm(true)}
                                disabled={analyzing || totalRecords === 0}
                                className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 font-semibold transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="h-5 w-5" />
                                Bersihkan Data Sekarang
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Warning Box */}
            <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                <AlertTriangle className="h-6 w-6 flex-shrink-0" />
                <div>
                    <h4 className="font-bold">Perhatian: Tindakan Permanen</h4>
                    <p className="text-sm mt-1">
                        Data yang telah dihapus tidak dapat dikembalikan. Sangat disarankan untuk melakukan
                        <b> Download Backup</b> terlebih dahulu sebelum melakukan pembersihan data sistem.
                    </p>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="h-8 w-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Konfirmasi Penghapusan</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                Anda akan menghapus secara permanen <b>{totalRecords} data</b> dari database.
                                Pastikan Anda sudah membackup data penting.
                            </p>

                            <div className="mb-6">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                                    Ketik "HAPUS" untuk konfirmasi
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                                    placeholder="HAPUS"
                                    className="w-full text-center border-2 border-red-200 rounded-lg p-2 focus:border-red-500 focus:ring-0 font-bold tracking-widest"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowConfirm(false);
                                        setConfirmText('');
                                    }}
                                    className="flex-1 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleCleanup}
                                    disabled={loading || (confirmText !== 'HAPUS' && confirmText !== 'DELETE')}
                                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    {loading ? 'Memproses...' : 'Ya, Hapus Data'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
