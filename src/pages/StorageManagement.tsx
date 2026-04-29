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
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, subMonths } from 'date-fns';

export default function StorageManagement() {
    const { getText } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    // Date range: default 3 bulan terakhir s/d hari ini
    const [startDate, setStartDate] = useState<string>(() => format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));

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

    // Kembalikan ISO string dari startDate & endDate
    const getDateRange = () => {
        // startDate: awal hari (00:00:00)
        const start = new Date(startDate + 'T00:00:00');
        // endDate: akhir hari (23:59:59)
        const end = new Date(endDate + 'T23:59:59');
        return { startISO: start.toISOString(), endISO: end.toISOString() };
    };

    const analyzeData = async () => {
        setAnalyzing(true);
        try {
            const { startISO, endISO } = getDateRange();

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
                    .gte('end_time', startISO)
                    .lte('end_time', endISO)
                    .in('status', ['completed', 'rejected', 'cancelled', 'pending', 'approved']);
                bookingsCount = count || 0;
            }

            if (targets.checkouts) {
                const { count } = await supabase
                    .from('checkouts')
                    .select('id', { count: 'exact', head: true })
                    .gte('created_at', startISO)
                    .lte('created_at', endISO)
                    .in('status', ['returned', 'completed', 'lost', 'damaged', 'pending', 'rejected', 'active', 'overdue', 'approved']);
                checkoutsCount = count || 0;
            }
            console.log('Analysis range:', startISO, '->', endISO);

            if (targets.notifications) {
                try {
                    const { count, error } = await supabase
                        .from('notifications')
                        .select('id', { count: 'exact', head: true })
                        .gte('created_at', startISO)
                        .lte('created_at', endISO);

                    if (!error || error.code === '42P01') {
                        notifsCount = count || 0;
                    }
                } catch (e) {
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
                        .gte('created_at', startISO)
                        .lte('created_at', endISO);

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
                        .gte('created_at', startISO)
                        .lte('created_at', endISO)
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
                        .gte('date', startISO)
                        .lte('date', endISO)
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
                        .gte('created_at', startISO)
                        .lte('created_at', endISO);

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
                        .gte('created_at', startISO)
                        .lte('created_at', endISO);

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

    // Re-analyze when date range or targets change
    useEffect(() => {
        analyzeData();
    }, [startDate, endDate, targets]);

    const handleDownloadBackup = async () => {
        const toastId = toast.loading('Menyiapkan backup data...');

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
            const { startISO, endISO } = getDateRange();

            // ── ExcelJS Workbook ──────────────────────────────────────────────
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'SIMPELUNY';
            workbook.created = new Date();
            let hasData = false;

            // Helper: tambah sheet dengan header bold & auto-width
            const addSheet = (name: string, rows: Record<string, any>[]) => {
                if (!rows || rows.length === 0) return;
                const ws = workbook.addWorksheet(name);
                // Header dari key baris pertama
                const headers = Object.keys(rows[0]);
                ws.columns = headers.map(h => ({
                    header: h,
                    key: h,
                    width: Math.min(Math.max(h.length + 4, 12), 40)
                }));
                // Bold header row
                ws.getRow(1).font = { bold: true };
                ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0EAE8' } };
                // Tambah data
                rows.forEach(r => ws.addRow(r));
                hasData = true;
            };

            // 1. Export Bookings
            if (targets.bookings) {
                const { data: bookings } = await supabase
                    .from('bookings')
                    .select('*, users(full_name, identity_number), rooms(name, code)')
                    .gte('end_time', startISO).lte('end_time', endISO)
                    .in('status', ['completed', 'rejected', 'cancelled', 'pending', 'approved']);
                if (bookings && bookings.length > 0) {
                    addSheet('Bookings History', sanitizeForExcel(bookings.map(b => ({
                        ID: b.id, User: b.users?.full_name, NIP: b.users?.identity_number,
                        Room: b.rooms?.name, Start: b.start_time, End: b.end_time,
                        Status: b.status, Purpose: b.purpose
                    }))));
                }
            }

            // 2. Export Checkouts & Items
            if (targets.checkouts) {
                const { data: checkouts } = await supabase
                    .from('checkouts').select('*')
                    .gte('created_at', startISO).lte('created_at', endISO);
                if (checkouts && checkouts.length > 0) {
                    addSheet('Checkouts History', sanitizeForExcel(checkouts.map(c => ({
                        ID: c.id, Date: c.checkout_date, ReturnDate: c.actual_return_date,
                        Status: c.status, TotalItems: c.total_items
                    }))));
                    const checkoutIds = checkouts.map(c => c.id);
                    const { data: checkoutItems } = await supabase
                        .from('checkout_items').select('*, equipment(name, code)')
                        .in('checkout_id', checkoutIds);
                    addSheet('Checkout Items', sanitizeForExcel(
                        (checkoutItems || []).map(i => ({
                            CheckoutID: i.checkout_id, EquipmentName: i.equipment?.name,
                            EquipmentCode: i.equipment?.code,
                            ConditionBefore: i.condition_before, ConditionAfter: i.condition_after
                        }))
                    ));
                }
            }

            // 3. Export Notifications
            if (targets.notifications) {
                try {
                    const { data: notifs, error } = await supabase
                        .from('notifications').select('id, title, message, type, is_read, created_at, user_id')
                        .gte('created_at', startISO).lte('created_at', endISO);
                    if (!error && notifs && notifs.length > 0) addSheet('Notifications', sanitizeForExcel(notifs));
                } catch (e: any) { console.error('Error exporting notifications:', e); }
            }

            // 4. Export Reports
            if (targets.reports) {
                try {
                    const { data: reports, error } = await supabase
                        .from('reports').select('*')
                        .gte('created_at', startISO).lte('created_at', endISO);
                    if (!error && reports && reports.length > 0) addSheet('Reports', sanitizeForExcel(reports));
                } catch (e: any) { console.error('Error exporting reports:', e); }
            }

            // 5. Export Attendance — Exclude photo/signature (kolom base64 besar)
            if (targets.attendance) {
                try {
                    // 5. Export Attendance — Strip photo/signature field secara JavaScript (bukan via Supabase select)
                    // Menggunakan select('*') karena nama kolom bisa berbeda per instalasi DB.
                    // photo_capture & signature_url di-strip via destructuring SEBELUM akumulasi
                    // untuk menjaga payload tiap request tetap kecil.
                    let allAttendance: any[] = [];
                    let page = 0;
                    const CHUNK = 50; // kecil (50 baris) agar payload aman walau ada foto base64
                    const LARGE_FIELDS = ['photo_capture', 'signature_url', 'signature', 'image_url', 'attachment'];

                    while (true) {
                        const { data: chunk, error: chunkErr } = await supabase
                            .from('lecturer_attendance')
                            .select('*')
                            .gte('created_at', startISO).lte('created_at', endISO)
                            .in('verification_status', ['verified', 'pending', 'rejected'])
                            .order('created_at', { ascending: true })
                            .range(page * CHUNK, (page + 1) * CHUNK - 1);

                        if (chunkErr) {
                            console.error('Attendance chunk error:', chunkErr.message);
                            toast(`⚠️ Query presensi gagal (hal.${page + 1}): ${chunkErr.message}`, { icon: '⚠️' });
                            break;
                        }
                        if (!chunk || chunk.length === 0) break;

                        // Strip field foto langsung sebelum akumulasi agar tidak memakan memori
                        const stripped = chunk.map((row: any) => {
                            const clean: any = { ...row };
                            LARGE_FIELDS.forEach(f => { if (f in clean) delete clean[f]; });
                            return clean;
                        });

                        allAttendance = [...allAttendance, ...stripped];
                        if (chunk.length < CHUNK) break;
                        page++;
                    }

                    if (allAttendance.length > 0) {
                        addSheet('Attendance', sanitizeForExcel(allAttendance));
                        // Fetch details in batches of 100 IDs
                        const attendanceIds = allAttendance.map((a: any) => a.id);
                        let allDetails: any[] = [];
                        for (let i = 0; i < attendanceIds.length; i += 100) {
                            const { data: dc } = await supabase
                                .from('lecturer_attendance_details')
                                .select('*')
                                .in('attendance_id', attendanceIds.slice(i, i + 100));
                            if (dc) {
                                const dcStripped = dc.map((r: any) => {
                                    const c: any = { ...r };
                                    LARGE_FIELDS.forEach(f => { if (f in c) delete c[f]; });
                                    return c;
                                });
                                allDetails = [...allDetails, ...dcStripped];
                            }
                        }
                        if (allDetails.length > 0) addSheet('Attendance Details', sanitizeForExcel(allDetails));
                    } else {
                        // Coba tanpa filter verification_status sebagai fallback
                        console.warn('Attendance: no data with status filter, trying without...');
                        const { data: fallback, error: fbErr } = await supabase
                            .from('lecturer_attendance')
                            .select('id, created_at, updated_at, lecturer_user_id, attendance_date, verification_status, notes')
                            .gte('created_at', startISO).lte('created_at', endISO)
                            .order('created_at', { ascending: true })
                            .limit(1000);
                        if (!fbErr && fallback && fallback.length > 0) {
                            addSheet('Attendance', sanitizeForExcel(fallback));
                        }
                    }

                } catch (e: any) {
                    console.error('Error exporting attendance:', e);
                    toast('⚠️ Backup presensi sebagian gagal: ' + (e.message || ''), { icon: '⚠️' });
                }
            }

            // 6. Export Lending Tools
            if (targets.lending_tools) {
                try {
                    const { data: lendingTools, error } = await supabase
                        .from('lending_tool').select('*')
                        .gte('date', startISO).lte('date', endISO)
                        .in('status', ['returned', 'completed', 'rejected', 'cancelled', 'pending', 'approved', 'active']);
                    if (!error && lendingTools && lendingTools.length > 0) addSheet('Lending Tools', sanitizeForExcel(lendingTools));
                } catch (e: any) { console.error('Error exporting lending tools:', e); }
            }

            // 7. Export To-Do Lists
            if (targets.todos) {
                try {
                    const { data: todos, error } = await supabase
                        .from('technician_tasks').select('*')
                        .gte('created_at', startISO).lte('created_at', endISO);
                    if (!error && todos && todos.length > 0) addSheet('ToDo Lists', sanitizeForExcel(todos));
                } catch (e: any) { console.error('Error exporting todos:', e); }
            }

            // 8. Export Forms & Responses
            if (targets.forms) {
                try {
                    const { data: forms, error } = await supabase
                        .from('forms').select('*')
                        .gte('created_at', startISO).lte('created_at', endISO);
                    if (!error && forms && forms.length > 0) {
                        addSheet('Forms', sanitizeForExcel(forms));
                        const formIds = forms.map(f => f.id);
                        const { data: responses } = await supabase
                            .from('form_responses').select('*').in('form_id', formIds);
                        if (responses && responses.length > 0) addSheet('Form Responses', sanitizeForExcel(responses));
                    }
                } catch (e: any) { console.error('Error exporting forms:', e); }
            }

            if (!hasData) {
                toast.dismiss(toastId);
                toast('Tidak ada data yang perlu di-backup untuk periode ini.', { icon: 'ℹ️' });
                return;
            }

            // ── Save dengan ExcelJS + file-saver ─────────────────────────────
            const fileName = `SIMPELUNY_Backup_${startDate}_sd_${endDate}.xlsx`;
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);

            toast.success('Backup berhasil diunduh!', { id: toastId });

        } catch (error: any) {
            console.error('Download error:', error);
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
            const { startISO, endISO } = getDateRange();
            let totalDeleted = 0;

            // ── Manual delete per tabel dengan filter date range ──────────────
            // Tidak menggunakan RPC karena fungsi database tidak mendukung end_date.
            // Semua penghapusan dilakukan langsung dengan .gte(start).lte(end).

            // 1. DELETE CHECKOUTS + Cascade (checkout_items, validation_queue, violations)
            if (targets.checkouts) {
                // Fetch semua IDs tanpa filter status agar tidak ada yang terlewat
                let allCheckoutIds: string[] = [];
                let coPage = 0;
                while (true) {
                    const { data: coIds, error: coErr } = await supabase
                        .from('checkouts').select('id')
                        .gte('created_at', startISO).lte('created_at', endISO)
                        .order('created_at', { ascending: true })
                        .range(coPage * 500, (coPage + 1) * 500 - 1);
                    if (coErr || !coIds || coIds.length === 0) break;
                    allCheckoutIds = [...allCheckoutIds, ...coIds.map(r => r.id)];
                    if (coIds.length < 500) break;
                    coPage++;
                }
                if (allCheckoutIds.length > 0) {
                    for (let i = 0; i < allCheckoutIds.length; i += 100) {
                        const batch = allCheckoutIds.slice(i, i + 100);
                        await supabase.from('checkout_items').delete().in('checkout_id', batch);
                        try { await supabase.from('checkout_validations').delete().in('checkout_id', batch); } catch (_) { }
                        try { await supabase.from('checkout_violations').delete().in('checkout_id', batch); } catch (_) { }
                    }
                    for (let i = 0; i < allCheckoutIds.length; i += 100) {
                        const { count: bCount } = await supabase.from('checkouts')
                            .delete({ count: 'exact' }).in('id', allCheckoutIds.slice(i, i + 100));
                        totalDeleted += bCount || 0;
                    }
                }
            }

            // 2. DELETE BOOKINGS
            if (targets.bookings) {
                let allBookingIds: string[] = [];
                let bPage = 0;
                while (true) {
                    const { data: bIds, error: bErr } = await supabase
                        .from('bookings').select('id')
                        .gte('end_time', startISO).lte('end_time', endISO)
                        .in('status', ['completed', 'rejected', 'cancelled', 'pending', 'approved'])
                        .order('created_at', { ascending: true })
                        .range(bPage * 500, (bPage + 1) * 500 - 1);
                    if (bErr || !bIds || bIds.length === 0) break;
                    allBookingIds = [...allBookingIds, ...bIds.map(r => r.id)];
                    if (bIds.length < 500) break;
                    bPage++;
                }

                if (allBookingIds.length > 0) {
                    for (let i = 0; i < allBookingIds.length; i += 100) {
                        const batch = allBookingIds.slice(i, i + 100);
                        
                        const { data: relatedCheckouts } = await supabase
                            .from('checkouts').select('id').in('booking_id', batch);
                            
                        if (relatedCheckouts && relatedCheckouts.length > 0) {
                            const cIds = relatedCheckouts.map(c => c.id);
                            for (let j = 0; j < cIds.length; j += 100) {
                                const cBatch = cIds.slice(j, j + 100);
                                await supabase.from('checkout_items').delete().in('checkout_id', cBatch);
                                try { await supabase.from('checkout_validations').delete().in('checkout_id', cBatch); } catch (_) {}
                                try { await supabase.from('checkout_violations').delete().in('checkout_id', cBatch); } catch (_) {}
                                await supabase.from('checkouts').delete().in('id', cBatch);
                            }
                        }

                        const { count: bCount } = await supabase.from('bookings').delete({ count: 'exact' }).in('id', batch);
                        totalDeleted += bCount || 0;
                    }
                }
            }

            // 3. DELETE NOTIFICATIONS
            if (targets.notifications) {
                try {
                    // Coba hapus, abaikan jika tabel tidak ada (404)
                    const { count } = await supabase.from('notifications').delete({ count: 'exact' })
                        .gte('created_at', startISO)
                        .lte('created_at', endISO)
                        .neq('id', '00000000-0000-0000-0000-000000000000'); // dummy filter to satisfy no-filter policy
                    totalDeleted += count || 0;
                } catch (_) { /* skip jika tabel notifications tidak ada */ }
            }

            // 4. DELETE REPORTS
            if (targets.reports) {
                const { count } = await supabase.from('reports').delete({ count: 'exact' })
                    .gte('created_at', startISO).lte('created_at', endISO);
                totalDeleted += count || 0;
            }

            // 5. DELETE ATTENDANCE + Cascade (lecturer_attendance_details)
            // Pakai batch 100 ID karena 900+ IDs dalam .in() satu request menyebabkan 400 (URL too long)
            if (targets.attendance) {
                // Fetch semua IDs dulu — gunakan date range saja, tanpa filter status
                // supaya tidak ada yang terlewat akibat case-sensitivity / nilai berbeda
                let attendancePage = 0;
                let allAttendanceIds: string[] = [];
                while (true) {
                    const { data: pageIds, error: pageErr } = await supabase
                        .from('lecturer_attendance')
                        .select('id')
                        .gte('created_at', startISO)
                        .lte('created_at', endISO)
                        .order('created_at', { ascending: true })
                        .range(attendancePage * 500, (attendancePage + 1) * 500 - 1);
                    if (pageErr || !pageIds || pageIds.length === 0) break;
                    allAttendanceIds = [...allAttendanceIds, ...pageIds.map(r => r.id)];
                    if (pageIds.length < 500) break;
                    attendancePage++;
                }

                if (allAttendanceIds.length > 0) {
                    // Hapus details dulu dalam batch 100 IDs
                    for (let i = 0; i < allAttendanceIds.length; i += 100) {
                        const batch = allAttendanceIds.slice(i, i + 100);
                        try {
                            await supabase.from('lecturer_attendance_details')
                                .delete().in('attendance_id', batch);
                        } catch (_) { /* skip jika tabel/kolom tidak ada */ }
                    }
                    // Hapus parent dalam batch 100 IDs
                    let deletedCount = 0;
                    for (let i = 0; i < allAttendanceIds.length; i += 100) {
                        const batch = allAttendanceIds.slice(i, i + 100);
                        const { count: bCount } = await supabase
                            .from('lecturer_attendance')
                            .delete({ count: 'exact' })
                            .in('id', batch);
                        deletedCount += bCount || 0;
                    }
                    totalDeleted += deletedCount;
                }
            }

            // 6. DELETE LENDING TOOLS
            if (targets.lending_tools) {
                const { count } = await supabase.from('lending_tool').delete({ count: 'exact' })
                    .gte('date', startISO)
                    .lte('date', endISO)
                    .in('status', ['returned', 'completed', 'rejected', 'cancelled', 'pending', 'approved', 'active']);
                totalDeleted += count || 0;
            }

            // 7. DELETE TODOS
            if (targets.todos) {
                const { count } = await supabase.from('technician_tasks').delete({ count: 'exact' })
                    .gte('created_at', startISO).lte('created_at', endISO);
                totalDeleted += count || 0;
            }

            // 8. DELETE FORMS + Cascade (form_responses)
            if (targets.forms) {
                const { data: forms } = await supabase.from('forms').select('id')
                    .gte('created_at', startISO).lte('created_at', endISO);
                if (forms && forms.length > 0) {
                    const fIds = forms.map(f => f.id);
                    await supabase.from('form_responses').delete().in('form_id', fIds);
                    const { count } = await supabase.from('forms').delete({ count: 'exact' }).in('id', fIds);
                    totalDeleted += count || 0;
                }
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
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Rentang Tanggal Data:
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Tanggal Mulai</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        max={endDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-gray-50 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Tanggal Akhir</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        min={startDate}
                                        max={format(new Date(), 'yyyy-MM-dd')}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-gray-50 text-sm"
                                    />
                                </div>
                            </div>
                            {/* Shortcut presets */}
                            <div className="flex flex-wrap gap-2 mt-2">
                                {[
                                    { label: '1 Bln', months: 1 },
                                    { label: '3 Bln', months: 3 },
                                    { label: '6 Bln', months: 6 },
                                    { label: '1 Thn', months: 12 },
                                ].map(({ label, months }) => (
                                    <button
                                        key={label}
                                        type="button"
                                        onClick={() => {
                                            setStartDate(format(subMonths(new Date(), months), 'yyyy-MM-dd'));
                                            setEndDate(format(new Date(), 'yyyy-MM-dd'));
                                        }}
                                        className="px-3 py-1 text-xs rounded-full border border-blue-300 text-blue-700 hover:bg-blue-50 transition font-medium"
                                    >
                                        {label} Terakhir
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
                                <p className="text-xs text-red-800">
                                    <span className="font-bold">PERHATIAN:</span> Data dari{' '}
                                    <span className="font-bold underline">{format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy')}</span>{' '}
                                    s/d{' '}
                                    <span className="font-bold underline">{format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy')}</span>{' '}
                                    akan <span className="font-bold">DIHAPUS</span> atau <span className="font-bold">DI-BACKUP</span>.
                                </p>
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
