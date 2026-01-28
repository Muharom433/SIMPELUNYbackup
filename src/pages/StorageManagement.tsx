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
    const { t, language } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [cutoffOption, setCutoffOption] = useState('3_months'); // 1_month, 3_months, 6_months, 1_year

    // Stats
    const [stats, setStats] = useState({
        bookings: 0,
        checkouts: 0,
        notifications: 0
    });

    // Selection
    const [targets, setTargets] = useState({
        bookings: true,
        checkouts: true,
        notifications: true
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

            if (targets.bookings) {
                const { count } = await supabase
                    .from('bookings')
                    .select('id', { count: 'exact', head: true })
                    .gte('end_time', cutoff) // CHANGED to gte
                    .in('status', ['completed', 'rejected', 'cancelled']);
                bookingsCount = count || 0;
            }

            if (targets.checkouts) {
                const { count } = await supabase
                    .from('checkouts')
                    .select('id', { count: 'exact', head: true })
                    .gte('created_at', cutoff) // CHANGED to gte
                    .in('status', ['returned', 'completed', 'lost', 'damaged']);
                checkoutsCount = count || 0;
            }

            if (targets.notifications) {
                try {
                    const { count, error } = await supabase
                        .from('notifications')
                        .select('id', { count: 'exact', head: true })
                        .gte('created_at', cutoff); // CHANGED to gte

                    if (!error || error.code === '42P01') {
                        notifsCount = count || 0;
                    }
                } catch (e) {
                    // Tabel notifications tidak ada, skip
                    console.warn('Tabel notifications tidak ditemukan');
                    notifsCount = 0;
                }
            }

            setStats({
                bookings: bookingsCount,
                checkouts: checkoutsCount,
                notifications: notifsCount
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
                    .gte('end_time', cutoff) // CHANGED to gte
                    .in('status', ['completed', 'rejected', 'cancelled']);

                if (bookings && bookings.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(bookings.map(b => ({
                        ID: b.id,
                        User: b.users?.full_name,
                        NIP: b.users?.identity_number,
                        Room: b.rooms?.name,
                        Start: b.start_time,
                        End: b.end_time,
                        Status: b.status,
                        Purpose: b.purpose
                    })));
                    XLSX.utils.book_append_sheet(wb, ws, "Bookings History");
                    hasData = true;
                }
            }

            // 2. Export Checkouts
            if (targets.checkouts) {
                const { data: checkouts } = await supabase
                    .from('checkouts')
                    .select(`
            *,
            users (full_name, identity_number)
          `)
                    .gte('created_at', cutoff) // CHANGED to gte
                    .in('status', ['returned', 'completed', 'lost', 'damaged']);

                if (checkouts && checkouts.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(checkouts.map(c => ({
                        ID: c.id,
                        User: c.users?.full_name,
                        Date: c.checkout_date,
                        ReturnDate: c.actual_return_date,
                        Status: c.status,
                        TotalItems: c.total_items
                    })));
                    XLSX.utils.book_append_sheet(wb, ws, "Checkouts History");
                    hasData = true;
                }
            }

            // 3. Export Notifications
            if (targets.notifications) {
                try {
                    const { data: notifs, error } = await supabase
                        .from('notifications')
                        .select('*')
                        .gte('created_at', cutoff); // CHANGED to gte

                    if (!error && notifs && notifs.length > 0) {
                        const ws = XLSX.utils.json_to_sheet(notifs);
                        XLSX.utils.book_append_sheet(wb, ws, "Notifications");
                        hasData = true;
                    }
                } catch (e: any) {
                    // Tabel notifications tidak ada, skip
                    if (e.code !== '42P01') {
                        console.error('Error exporting notifications:', e);
                    }
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

        } catch (error) {
            console.error('Download error:', error);
            toast.error('Gagal mengunduh backup', { id: toastId });
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

            // URUTAN PENTING: Hapus dari child ke parent untuk menghindari foreign key constraint

            // 1. DELETE CHECKOUTS (dan violations-nya) - HARUS DULU sebelum bookings
            if (targets.checkouts) {
                toast.loading('Menghapus data peminjaman...', { id: toastId });

                const { data: checkoutsToDelete } = await supabase
                    .from('checkouts')
                    .select('id')
                    .gte('created_at', cutoff)
                    .in('status', ['returned', 'completed', 'lost', 'damaged']);

                if (checkoutsToDelete && checkoutsToDelete.length > 0) {
                    const ids = checkoutsToDelete.map(c => c.id);

                    // Delete violations terlebih dahulu
                    await supabase
                        .from('checkout_violations')
                        .delete()
                        .in('checkout_id', ids);

                    // Delete checkout_items terlebih dahulu
                    await supabase
                        .from('checkout_items')
                        .delete()
                        .in('checkout_id', ids);

                    // Baru delete checkouts
                    const { count, error } = await supabase
                        .from('checkouts')
                        .delete({ count: 'exact' })
                        .in('id', ids);

                    if (error) throw error;
                    totalDeleted += count || 0;
                }
            }

            // 2. DELETE BOOKINGS - Setelah checkouts dihapus
            if (targets.bookings) {
                toast.loading('Menghapus data bookings...', { id: toastId });

                // Ambil daftar bookings yang akan dihapus
                const { data: bookingsToDelete } = await supabase
                    .from('bookings')
                    .select('id')
                    .gte('end_time', cutoff)
                    .in('status', ['completed', 'rejected', 'cancelled']);

                if (bookingsToDelete && bookingsToDelete.length > 0) {
                    const bookingIds = bookingsToDelete.map(b => b.id);

                    // Hapus checkouts yang terkait dengan bookings ini (yang mungkin belum terhapus)
                    await supabase
                        .from('checkouts')
                        .delete()
                        .in('booking_id', bookingIds);

                    // Baru hapus bookings
                    const { count, error } = await supabase
                        .from('bookings')
                        .delete({ count: 'exact' })
                        .in('id', bookingIds);

                    if (error) throw error;
                    totalDeleted += count || 0;
                }
            }

            // 3. DELETE NOTIFICATIONS - Independent, bisa kapan saja
            if (targets.notifications) {
                try {
                    toast.loading('Menghapus notifikasi lama...', { id: toastId });
                    const { count, error } = await supabase
                        .from('notifications')
                        .delete({ count: 'exact' })
                        .gte('created_at', cutoff);

                    if (error) {
                        // Jika tabel tidak ada, skip saja
                        if (error.code === '42P01') {
                            console.warn('Tabel notifications tidak ditemukan, dilewati.');
                        } else {
                            throw error;
                        }
                    } else {
                        totalDeleted += count || 0;
                    }
                } catch (notifError: any) {
                    // Log error tapi jangan stop proses
                    console.error('Error menghapus notifications:', notifError);
                    if (notifError.code !== '42P01') {
                        throw notifError; // Re-throw jika bukan error "table not found"
                    }
                }
            }

            toast.success(`Berhasil menghapus ${totalDeleted} item!`, { id: toastId });
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

    const totalRecords = stats.bookings + stats.checkouts + stats.notifications;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Database className="h-8 w-8 text-blue-600" />
                    Manajemen Penyimpanan Data
                </h1>
                <p className="text-gray-500 mt-2">
                    Kelola penggunaan penyimpanan dengan menghapus riwayat data lama (Booking, Peminjaman, Notifikasi).
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
                                        <span className="font-bold">PERHATIAN:</span> Anda memilih data dari <span className="font-bold underline">{format(getCutoffDate(), 'dd MMMM yyyy')}</span> sampai <span className="font-bold">HARI INI</span>.
                                    </p>
                                    <p className="text-xs text-red-600 mt-1">
                                        Data DALAM rentang waktu tersebut akan <span className="font-bold">DIHAPUS (DIBERSIHKAN)</span> atau <span className="font-bold">DI-BACKUP</span>.
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
                                    <p className="text-xs text-gray-500">Termasuk item detail dan pelanggaran terkait</p>
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

                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
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
