import React, { useState, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Download, ChevronLeft, ChevronRight, UserPlus, Trash2, Copy, Edit, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { SearchableDropdown } from '../UI/SearchableDropdown';

interface AppendScheduleExcelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ExcelRow {
    'No.': number;
    ' Prodi': string;
    ' Kode / Nama': string;
    ' Semester MK': number;
    ' Kurikulum': string;
    ' TA': string;
    ' Semester': string;
    ' Jenis': string;
    ' Rombel': string;
    ' Sks Rombel': number;
    ' Pengampu': string;
    ' Jadwal hari': string;
    ' Ruang': string;
    ' Jml MHS': number;
}

interface TransformedSchedule {
    subject_study: string | null;
    course_code: string | null;
    course_name: string | null;
    semester: number | null;
    kurikulum: string | null;
    academics_year: number | null;
    type: string | null;
    class: string | null;
    lecturer: string | null;
    day: string | null;
    start_time: string | null;
    end_time: string | null;
    room: string | null;
    amount: number | null;
}

const AppendScheduleExcelModal: React.FC<AppendScheduleExcelModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<TransformedSchedule[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    const [existingLecturers, setExistingLecturers] = useState<{ id: string; full_name: string }[]>([]);
    const [lecturerMapping, setLecturerMapping] = useState<Record<string, string[]>>({});

    const fetchLecturers = async () => {
        const { data } = await supabase.from('users').select('id, full_name').eq('role', 'lecturer').order('full_name');
        if (data) setExistingLecturers(data);
    };

    useEffect(() => {
        if (isOpen) {
            setLecturerMapping({});
            fetchLecturers();
        }
    }, [isOpen]);

    const findLecturerMatch = (excelName: string) => {
        if (!excelName) return null;
        if (lecturerMapping[excelName] && lecturerMapping[excelName].length > 0) {
            return { id: 'mapped', full_name: lecturerMapping[excelName].join(', ') };
        }
        const lowerExcel = excelName.toLowerCase().trim();
        let match = existingLecturers.find(l => l.full_name.toLowerCase().trim() === lowerExcel);
        if (!match) {
            match = existingLecturers.find(l =>
                l.full_name.toLowerCase().includes(lowerExcel) ||
                lowerExcel.includes(l.full_name.toLowerCase())
            );
        }
        return match;
    };

    const unregisteredNames = React.useMemo(() => {
        const unique = new Set<string>();
        preview.forEach(row => {
            const name = row.lecturer;
            if (name && !findLecturerMatch(name)) {
                unique.add(name);
            }
        });
        return Array.from(unique).sort();
    }, [preview, existingLecturers, lecturerMapping]);

    const handleMapLecturer = (excelName: string, selectedUserName: string) => {
        if (!selectedUserName) return;
        const currentList = lecturerMapping[excelName] || [];
        if (!currentList.includes(selectedUserName)) {
            setLecturerMapping(prev => ({
                ...prev,
                [excelName]: [...currentList, selectedUserName]
            }));
        }
    };

    const handleRemoveMappedUser = (excelName: string, userToRemove: string) => {
        const currentList = lecturerMapping[excelName] || [];
        const newList = currentList.filter(u => u !== userToRemove);
        if (newList.length === 0) {
            const newMap = { ...lecturerMapping };
            delete newMap[excelName];
            setLecturerMapping(newMap);
        } else {
            setLecturerMapping(prev => ({ ...prev, [excelName]: newList }));
        }
    };

    const [showUserModal, setShowUserModal] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ name: '', nip: '', isHomebase: true, excelNameReference: '' });

    const openAddUserModal = (excelName: string) => {
        setNewUserForm({ name: excelName, nip: '', isHomebase: true, excelNameReference: excelName });
        setShowUserModal(true);
    };

    const handleSaveNewUser = async () => {
        if (!newUserForm.name || !newUserForm.nip) {
            toast.error('Nama dan Nomor Identitas wajib diisi');
            return;
        }

        const toastId = toast.loading('Menyimpan user...');
        try {
            const username = newUserForm.nip.replace(/[^a-zA-Z0-9]/g, '');
            const email = `${username}@simpeluny.id`;
            const password = 'purple_password';

            const { data: existing } = await supabase.from('users').select('id').eq('username', username).single();
            if (existing) {
                throw new Error(`User dengan NIP/Username ${username} sudah ada.`);
            }

            const { data: newUser, error } = await supabase.from('users').insert({
                full_name: newUserForm.name,
                identity_number: newUserForm.nip,
                username: username,
                email: email,
                password: password,
                role: 'lecturer',
                is_homebase: newUserForm.isHomebase
            }).select().single();

            if (error) throw error;

            toast.success(`User berhasil dibuat! Login: ${username}`, { id: toastId });
            await fetchLecturers();

            if (newUserForm.excelNameReference) {
                handleMapLecturer(newUserForm.excelNameReference, newUser.full_name);
            }
            setShowUserModal(false);

        } catch (err: any) {
            toast.error(`Gagal: ${err.message}`, { id: toastId });
        }
    };

    const getFinalScheduleData = () => {
        return preview.map(schedule => {
            const mappedList = lecturerMapping[schedule.lecturer || ''];
            if (mappedList && mappedList.length > 0) {
                return { ...schedule, lecturer: mappedList.join(', ') };
            }
            return schedule;
        });
    };

    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

    const handleDuplicateRow = (index: number) => {
        const newPreview = [...preview];
        const rowToClone = { ...newPreview[index] };
        newPreview.splice(index + 1, 0, rowToClone);
        setPreview(newPreview);
        toast.success('Baris berhasil diduplikat');
    };

    const handleUpdateRowLecturer = (index: number, newLecturer: string) => {
        const newPreview = [...preview];
        newPreview[index] = { ...newPreview[index], lecturer: newLecturer };
        setPreview(newPreview);
        setEditingRowIndex(null);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'], },
        maxFiles: 1,
        onDrop: (acceptedFiles) => { if (acceptedFiles.length > 0) { processExcelFile(acceptedFiles[0]); } },
    });

    const parseTimeSchedule = (jadwalHari: string) => {
        if (!jadwalHari || typeof jadwalHari !== 'string') return { start_time: null, end_time: null, day: null };
        const lowerJadwal = jadwalHari.toLowerCase();
        const timeRegex = /pukul\s*:\s*(\d{2}:\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}:\d{2})/;
        const dayRegex = /hari\s*:\s*(\w+)/i;
        const timeMatch = lowerJadwal.match(timeRegex);
        const dayMatch = lowerJadwal.match(dayRegex);
        const startTime = timeMatch ? timeMatch[1] : null;
        const endTime = timeMatch ? timeMatch[2] : null;
        const dayName = dayMatch ? dayMatch[1] : null;
        if (startTime && endTime && dayName) {
            return { start_time: startTime, end_time: endTime, day: dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase() };
        }
        return { start_time: null, end_time: null, day: null };
    };

    const cleanProdi = (prodi: string): string => (prodi ? prodi.replace(/\s*-\s*D4\s*$/i, '').trim() : '');
    const parseKodeNama = (kodeNama: string) => { const parts = kodeNama ? kodeNama.split(' - ') : []; return { course_code: parts[0]?.trim() || '', course_name: parts.slice(1).join(' - ').trim() || '' }; };
    const cleanRuang = (ruang: string): string => { if (!ruang) return ''; const commaIndex = ruang.indexOf(','); return commaIndex !== -1 ? ruang.substring(0, commaIndex).trim() : ruang.trim(); };

    const processExcelFile = async (file: File) => {
        try {
            setUploading(true);
            setValidationErrors([]);
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const allTransformedData: TransformedSchedule[] = [];
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
                if (jsonData.length === 0) continue;
                for (const row of jsonData) {
                    if (!row[' Kode / Nama']) continue;
                    const { course_code, course_name } = parseKodeNama(row[' Kode / Nama']);
                    const { day, start_time, end_time } = parseTimeSchedule(row[' Jadwal hari']);
                    let academicsYear: number | null = null;
                    if (row[' TA']) {
                        const yearString = String(row[' TA']).split('/')[0];
                        const parsedYear = parseInt(yearString, 10);
                        if (!isNaN(parsedYear)) academicsYear = parsedYear;
                    }
                    const transformedRow: TransformedSchedule = {
                        subject_study: cleanProdi(row[' Prodi']), course_code, course_name,
                        semester: row[' Semester MK'] || null, kurikulum: row[' Kurikulum'] || null,
                        academics_year: academicsYear,
                        type: (row[' Jenis'] || '').toLowerCase().includes('prak') ? 'practical' : 'theory',
                        class: row[' Rombel'] || null, lecturer: row[' Pengampu'] || null,
                        day, start_time, end_time,
                        room: cleanRuang(row[' Ruang']), amount: row[' Jml MHS'] || 0,
                    };
                    allTransformedData.push(transformedRow);
                }
            }
            setPreview(allTransformedData);
            setShowPreview(true);
            setCurrentPage(1);
            if (allTransformedData.length > 0) {
                toast.success(`Berhasil memproses ${allTransformedData.length} jadwal untuk ditambahkan.`);
            } else {
                toast.error("Tidak ada data yang dapat dibaca. Pastikan header kolom sudah benar di semua sheet.");
            }
        } catch (error) {
toast.error('Gagal memproses file Excel.');
        } finally { setUploading(false); }
    };

    const handleUpload = async () => {
        if (!preview.length) {
            toast.error('Tidak ada data untuk ditambahkan.');
            return;
        }

        setUploading(true);
        const loadingToast = toast.loading('Menambahkan jadwal baru...');

        try {
            const finalData = getFinalScheduleData();
            const scheduleData = finalData.map(schedule => ({
                subject_study: schedule.subject_study, course_code: schedule.course_code, course_name: schedule.course_name,
                semester: schedule.semester, kurikulum: schedule.kurikulum, academics_year: schedule.academics_year,
                type: schedule.type, class: schedule.class, lecturer: schedule.lecturer,
                day: schedule.day, start_time: schedule.start_time, end_time: schedule.end_time,
                room: schedule.room, amount: schedule.amount
            }));

            const batchSize = 500;
            for (let i = 0; i < scheduleData.length; i += batchSize) {
                const batch = scheduleData.slice(i, i + batchSize);
                const { error: insertError } = await supabase.from('lecture_schedules').insert(batch);
                if (insertError) throw insertError;
            }

            toast.dismiss(loadingToast);
            toast.success(`Berhasil menambahkan ${scheduleData.length} jadwal baru ke database.`);
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.dismiss(loadingToast);
            toast.error(error.message || 'Gagal menambahkan jadwal');
        } finally {
            setUploading(false);
        }
    };

    const downloadSampleTemplate = () => {
        const sampleData = [{
            'No.': 1,
            ' Prodi': "Teknologi Rekayasa Perangkat Lunak - D4",
            ' Kode / Nama': "TI2043 - Pemrograman Web",
            ' Semester MK': 2,
            ' Kurikulum': "2022 - D4",
            ' TA': "2024",
            ' Semester': "Genap",
            ' Jenis': "Teori",
            ' Rombel': "A",
            ' Sks Rombel': 2,
            ' Pengampu': "Dr. Budi Santoso",
            ' Jadwal hari': "pukul:09:20:00 - 11:00:00 hari:Senin",
            ' Ruang': "GK 2.04, G.KULIAH I, size:50 [J.18.2.01.04]",
            ' Jml MHS': 50,
        }];
        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tambah Jadwal');
        XLSX.writeFile(workbook, 'template_tambah_jadwal_APPEND.xlsx');
    };

    const [selectedFilterLecturer, setSelectedFilterLecturer] = useState<string | null>(null);

    const filteredPreview = useMemo(() => {
        if (!selectedFilterLecturer) return preview;
        return preview.filter(s => s.lecturer === selectedFilterLecturer);
    }, [preview, selectedFilterLecturer]);

    useEffect(() => { setCurrentPage(1); }, [selectedFilterLecturer]);

    const totalPages = Math.ceil(filteredPreview.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const currentRows = filteredPreview.slice(startIndex, endIndex);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Plus className="h-6 w-6 text-white" />
                            <h3 className="text-xl font-semibold text-white">Tambah Jadwal dari Excel (Mode Append)</h3>
                        </div>
                        <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                    <p className="text-sm text-white text-opacity-90 mt-2">
                        ✓ Jadwal yang ada <strong>TIDAK AKAN DIHAPUS</strong>. Jadwal baru akan <strong>DITAMBAHKAN</strong> ke database.
                    </p>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    {!showPreview ? (
                        <div className="space-y-6">
                            <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}>
                                <input {...getInputProps()} />
                                <FileSpreadsheet className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-medium text-gray-700 mb-1">
                                    {isDragActive ? 'Letakkan file di sini' : 'Seret & letakkan file Excel di sini'}
                                </p>
                                <p className="text-sm text-gray-500 mb-4">atau klik untuk memilih file</p>
                                <p className="text-xs text-gray-400">Format yang didukung: .xlsx, .xls</p>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-medium text-green-800 mb-1">Template untuk Mode Tambah (Append)</h4>
                                        <p className="text-xs text-green-700 mb-2">
                                            Gunakan template ini untuk menambahkan jadwal baru tanpa menghapus jadwal yang sudah ada.
                                        </p>
                                        <ul className="text-xs text-green-700 grid grid-cols-2 gap-x-4">
                                            <li>No.</li>
                                            <li> Prodi</li>
                                            <li> Kode / Nama</li>
                                            <li> Semester MK</li>
                                            <li> Kurikulum</li>
                                            <li> TA</li>
                                            <li> Semester</li>
                                            <li> Jenis</li>
                                            <li> Rombel</li>
                                            <li> Sks Rombel</li>
                                            <li> Pengampu</li>
                                            <li> Jadwal hari</li>
                                            <li> Ruang</li>
                                            <li> Jml MHS</li>
                                        </ul>
                                        <div className="mt-3">
                                            <button onClick={(e) => { e.stopPropagation(); downloadSampleTemplate(); }} className="flex items-center space-x-1 text-xs font-medium text-green-600 hover:text-green-800 bg-white px-3 py-1.5 rounded-lg border border-green-200 hover:border-green-300 transition-colors">
                                                <Download className="h-3 w-3" />
                                                <span>Unduh Template Tambah Jadwal</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 flex-1 flex flex-col h-full">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900">Preview ({preview.length} jadwal akan ditambahkan)</h4>
                                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-4">
                                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Dosen Terdaftar</span>
                                        <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-red-500" /> Dosen Tidak Ditemukan</span>
                                    </p>
                                </div>
                                <button onClick={() => { setShowPreview(false); setPreview([]); setValidationErrors([]); setCurrentPage(1); }} className="text-sm text-green-600 hover:text-green-800 font-medium">Unggah file lain</button>
                            </div>
                            {validationErrors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                    <div className="flex items-start space-x-3">
                                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-medium text-red-800 mb-1">Peringatan Validasi</h4>
                                            <p className="text-xs text-red-700">{validationErrors.length} baris memiliki format 'Jadwal hari' yang tidak valid dan akan diimpor tanpa jadwal.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 flex flex-col">
                                {unregisteredNames.length > 0 && (
                                    <div className="bg-orange-50 p-4 border-b border-orange-200">
                                        <h5 className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4" />
                                            {unregisteredNames.length} Baris Dosen Tidak Ditemukan - Petakan ke satu atau lebih user:
                                        </h5>
                                        <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
                                            {unregisteredNames.map((name, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`p-3 rounded-lg border shadow-sm cursor-pointer transition-all ${selectedFilterLecturer === name
                                                        ? 'bg-orange-100 border-orange-400 ring-1 ring-orange-400'
                                                        : 'bg-white border-orange-100 hover:border-orange-300'
                                                        }`}
                                                    onClick={() => setSelectedFilterLecturer(prev => prev === name ? null : name)}
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                                                        <span className="text-sm font-bold text-gray-800 min-w-[200px]">{name}</span>
                                                        <button
                                                            onClick={() => openAddUserModal(name)}
                                                            className="flex items-center gap-1 text-xs bg-teal-600 text-white px-2 py-1.5 rounded hover:bg-teal-700 transition"
                                                        >
                                                            <UserPlus className="h-3 w-3" /> Buat User Baru Sesuai Nama
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-xs text-gray-500">MAPPING KE &rarr;</span>

                                                        {(lecturerMapping[name] || []).map(mappedUser => (
                                                            <span key={mappedUser} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full border border-blue-200">
                                                                {mappedUser}
                                                                <button
                                                                    onClick={() => handleRemoveMappedUser(name, mappedUser)}
                                                                    className="hover:bg-blue-200 rounded-full p-0.5 text-blue-600"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            </span>
                                                        ))}

                                                        <div className="min-w-[200px]">
                                                            <SearchableDropdown
                                                                options={existingLecturers}
                                                                value=""
                                                                onChange={(val) => handleMapLecturer(name, val)}
                                                                placeholder="+ Tambah User yg Ada"
                                                                searchPlaceholder="Cari Dosen..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="overflow-auto flex-grow">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Mata Kuliah</th>
                                                <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Jadwal</th>
                                                <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Ruang</th>
                                                <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Dosen</th>
                                                <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Kelas</th>
                                                <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Prodi</th>
                                                <th className="p-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {currentRows.map((schedule, index) => {
                                                const globalIndex = startIndex + index;
                                                const lecturerMatch = findLecturerMatch(schedule.lecturer || '');
                                                const isEditing = editingRowIndex === globalIndex;

                                                return (
                                                    <tr key={globalIndex} className="hover:bg-gray-50 group">
                                                        <td className="p-2 whitespace-nowrap"><div className="font-medium text-gray-900">{schedule.course_name || 'N/A'}</div><div className="text-xs text-gray-500">{schedule.course_code || 'N/A'}</div></td>
                                                        <td className="p-2 whitespace-nowrap"><div className="text-gray-900">{schedule.day || 'N/A'}</div><div className="text-xs text-gray-500">{schedule.start_time && schedule.end_time ? `${schedule.start_time} - ${schedule.end_time}` : 'N/A'}</div></td>
                                                        <td className="p-2 whitespace-nowrap text-gray-900">{schedule.room || 'N/A'}</td>

                                                        <td className="p-2 whitespace-nowrap">
                                                            {isEditing ? (
                                                                <select
                                                                    className="w-full text-sm border-teal-500 rounded focus:ring-teal-500 focus:border-teal-500"
                                                                    value={schedule.lecturer || ''}
                                                                    onChange={(e) => handleUpdateRowLecturer(globalIndex, e.target.value)}
                                                                    onBlur={() => setEditingRowIndex(null)}
                                                                    autoFocus
                                                                >
                                                                    <option value={schedule.lecturer || ''}>{schedule.lecturer} (Keep Original)</option>
                                                                    {existingLecturers.map(l => (
                                                                        <option key={l.id} value={l.full_name}>{l.full_name}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <div className="flex items-center gap-2 justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        {lecturerMatch ? (
                                                                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                                        ) : (
                                                                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                                                        )}
                                                                        <div className="flex flex-col">
                                                                            <span className={lecturerMatch ? "text-gray-900" : "text-red-700 font-medium"}>
                                                                                {schedule.lecturer || 'N/A'}
                                                                            </span>
                                                                            {lecturerMatch && lecturerMatch.full_name !== schedule.lecturer && (
                                                                                <span className="text-[10px] text-green-600">Match: {lecturerMatch.full_name}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setEditingRowIndex(globalIndex)}
                                                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-teal-600 transition-opacity"
                                                                        title="Ubah Dosen"
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="p-2 whitespace-nowrap"><div className="text-gray-900">Kelas {schedule.class || 'N/A'}</div><div className="text-xs text-gray-500">Smt {schedule.semester || 'N/A'}</div></td>
                                                        <td className="p-2 whitespace-nowrap text-xs text-gray-500">{schedule.subject_study || 'N/A'}</td>

                                                        <td className="p-2 whitespace-nowrap text-right">
                                                            <button
                                                                onClick={() => handleDuplicateRow(globalIndex)}
                                                                className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                                                title="Duplikasi Jadwal"
                                                            >
                                                                <Copy className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t border-gray-200">
                                    <span className="text-xs text-gray-600">
                                        Menampilkan {filteredPreview.length > 0 ? startIndex + 1 : 0} sampai {Math.min(endIndex, filteredPreview.length)} dari {filteredPreview.length} data
                                        {selectedFilterLecturer && <span className="ml-1 font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Filter: {selectedFilterLecturer}</span>}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                        <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"><ChevronLeft className="h-4 w-4" /></button>
                                        <span className="text-xs font-medium">{currentPage} / {totalPages}</span>
                                        <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"><ChevronRight className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Batal</button>
                    {showPreview && (
                        <button onClick={handleUpload} disabled={uploading || validationErrors.length > 0} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                            {uploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Menambahkan...</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4" />
                                    <span>Tambahkan Jadwal</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
            {showUserModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-50 font-sans">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-blue-600" />
                            Tambah User Dosen Baru
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap (Sesuai Excel)</label>
                                <input
                                    type="text"
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm px-3 py-2 border"
                                    value={newUserForm.name}
                                    onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Identitas (NIP/NIDN/Username) <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm px-3 py-2 border"
                                    value={newUserForm.nip}
                                    onChange={e => setNewUserForm({ ...newUserForm, nip: e.target.value })}
                                    placeholder="Contoh: 198001012000121001"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-500 mt-1">Nomor ini akan digunakan sebagai Username login.</p>
                            </div>
                            <div className="flex items-center bg-gray-50 p-3 rounded-md border border-gray-200">
                                <input
                                    id="is_homebase"
                                    type="checkbox"
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    checked={newUserForm.isHomebase}
                                    onChange={e => setNewUserForm({ ...newUserForm, isHomebase: e.target.checked })}
                                />
                                <label htmlFor="is_homebase" className="ml-2 block text-sm font-medium text-gray-900 cursor-pointer">
                                    Set sebagai Dosen Homebase
                                </label>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setShowUserModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSaveNewUser}
                                className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                            >
                                <CheckCircle className="h-4 w-4" />
                                Simpan User
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppendScheduleExcelModal;
