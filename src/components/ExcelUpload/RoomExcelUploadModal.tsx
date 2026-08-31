import React, { useState, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Download, ChevronLeft, ChevronRight, Building2, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface RoomExcelUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    campusId: string;
    campusName: string;
}

interface ExcelRoomRow {
    'No': number;
    'Nama Gedung': string;
    'Kode Ruang': string;
    'Nama Ruang': string;
    'Kapasitas': number;
    'Jenis Ruang': string;
}

interface TransformedRoom {
    buildingName: string;
    roomCode: string;
    roomName: string;
    capacity: number;
    roomType: string;
}

interface BuildingStatus {
    name: string;
    isNew: boolean;
    existingId?: string;
    roomCount: number;
}

const RoomExcelUploadModal: React.FC<RoomExcelUploadModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    campusId,
    campusName
}) => {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<TransformedRoom[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [buildingStatuses, setBuildingStatuses] = useState<BuildingStatus[]>([]);
    const [existingRoomCodes, setExistingRoomCodes] = useState<Set<string>>(new Set());
    const rowsPerPage = 10;

    // Generate building code from name
    const generateBuildingCode = (name: string): string => {
        // Extract key words and create abbreviation
        const words = name.toUpperCase().split(' ');
        let code = '';

        // Skip common words
        const skipWords = ['GEDUNG', 'KAMPUS', 'UNY'];

        for (const word of words) {
            if (!skipWords.includes(word) && word.length > 0) {
                code += word.charAt(0);
            }
        }

        // Add campus suffix based on name
        if (name.includes('GUNUNGKIDUL') || name.includes('GUNUNG KIDUL')) {
            code += '_GK';
        }

        return code || 'BLD';
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxFiles: 1,
        onDrop: (acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                processExcelFile(acceptedFiles[0]);
            }
        },
    });

    const processExcelFile = async (file: File) => {
        try {
            setUploading(true);
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const allTransformedData: TransformedRoom[] = [];

            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: ExcelRoomRow[] = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) continue;

                for (const row of jsonData) {
                    // Skip rows without required data
                    if (!row['Nama Gedung'] || !row['Kode Ruang'] || !row['Nama Ruang']) continue;

                    const transformedRow: TransformedRoom = {
                        buildingName: String(row['Nama Gedung'] || '').trim(),
                        roomCode: String(row['Kode Ruang'] || '').trim(),
                        roomName: String(row['Nama Ruang'] || '').trim(),
                        capacity: parseInt(String(row['Kapasitas'] || '0')) || 0,
                        roomType: String(row['Jenis Ruang'] || '').trim(),
                    };
                    allTransformedData.push(transformedRow);
                }
            }

            if (allTransformedData.length > 0) {
                // Check existing buildings and rooms
                await checkExistingData(allTransformedData);
                setPreview(allTransformedData);
                setShowPreview(true);
                setCurrentPage(1);
                toast.success(`Berhasil memproses ${allTransformedData.length} ruangan.`);
            } else {
                toast.error("Tidak ada data yang dapat dibaca. Pastikan header kolom sudah benar.");
            }
        } catch (error) {
            toast.error('Gagal memproses file Excel.');
        } finally {
            setUploading(false);
        }
    };

    const checkExistingData = async (rooms: TransformedRoom[]) => {
        try {
            // Get unique building names
            const uniqueBuildings = [...new Set(rooms.map(r => r.buildingName))];

            // Fetch existing buildings for this campus
            const { data: existingBuildings } = await supabase
                .from('building')
                .select('id, name')
                .eq('campus_id', campusId);

            // Build status map
            const buildingStatusMap: BuildingStatus[] = uniqueBuildings.map(name => {
                const existing = existingBuildings?.find(b =>
                    b.name.toLowerCase().trim() === name.toLowerCase().trim()
                );
                return {
                    name,
                    isNew: !existing,
                    existingId: existing?.id,
                    roomCount: rooms.filter(r => r.buildingName === name).length
                };
            });

            setBuildingStatuses(buildingStatusMap);

            // Fetch existing room codes - normalize them
            const { data: existingRooms } = await supabase
                .from('rooms')
                .select('code');

            // Normalize existing codes: lowercase and trim whitespace
            const codes = new Set(
                existingRooms?.map(r => r.code.toLowerCase().trim().replace(/\s+/g, '')) || []
            );
            setExistingRoomCodes(codes);

        } catch (error) {
        }
    };

    const handleUpload = async () => {
        if (!preview.length) {
            toast.error('Tidak ada data untuk diunggah.');
            return;
        }

        setUploading(true);
        const loadingToast = toast.loading('Memproses data...');

        try {
            // Step 0: Fetch FRESH building data to ensure we have the latest
            toast.loading('Memeriksa data gedung...', { id: loadingToast });

            const { data: freshBuildings } = await supabase
                .from('building')
                .select('id, name')
                .eq('campus_id', campusId);

            // Create a normalized lookup map for existing buildings
            const existingBuildingMap = new Map<string, string>();
            freshBuildings?.forEach(b => {
                const normalizedName = b.name.toLowerCase().trim();
                existingBuildingMap.set(normalizedName, b.id);
            });

            // Step 1: Create ONLY NEW buildings (check by normalized name)
            toast.loading('Membuat gedung baru...', { id: loadingToast });

            const buildingIdMap: Record<string, string> = {};
            const createdBuildingNames = new Set<string>(); // Track what we create to avoid duplicates

            for (const building of buildingStatuses) {
                const normalizedName = building.name.toLowerCase().trim();

                // Check if building already exists in fresh data
                const existingId = existingBuildingMap.get(normalizedName);

                if (existingId) {
                    // Building already exists, use its ID
                    buildingIdMap[building.name] = existingId;
                } else if (!createdBuildingNames.has(normalizedName)) {
                    // Building doesn't exist and we haven't created it yet in this session
                    const { data: newBuilding, error } = await supabase
                        .from('building')
                        .insert({
                            name: building.name,
                            code: generateBuildingCode(building.name),
                            description: `Auto-created from Excel import`,
                            campus_id: campusId
                        })
                        .select('id')
                        .single();

                    if (error) {
                        // If duplicate error, try to find the existing one
                        if (error.code === '23505') {
                            const { data: existingBuilding } = await supabase
                                .from('building')
                                .select('id')
                                .ilike('name', building.name)
                                .eq('campus_id', campusId)
                                .single();
                            if (existingBuilding) {
                                buildingIdMap[building.name] = existingBuilding.id;
                                existingBuildingMap.set(normalizedName, existingBuilding.id);
                            }
                        }
                    } else {
                        buildingIdMap[building.name] = newBuilding.id;
                        existingBuildingMap.set(normalizedName, newBuilding.id);
                        createdBuildingNames.add(normalizedName);
                    }
                } else {
                    // We already created this building in this session, use its ID
                    buildingIdMap[building.name] = existingBuildingMap.get(normalizedName)!;
                }
            }

            // Step 2: Insert rooms
            toast.loading('Menambahkan ruangan...', { id: loadingToast });

            const roomsToInsert = [];
            const skippedRooms: string[] = [];
            const insertedCodes = new Set<string>(); // Track codes we're inserting to detect internal duplicates

            for (const room of preview) {
                // Normalize room code for comparison
                const normalizedCode = room.roomCode.toLowerCase().trim().replace(/\s+/g, '');

                // Skip if room code already exists in database
                if (existingRoomCodes.has(normalizedCode)) {
                    skippedRooms.push(room.roomCode);
                    continue;
                }

                // Skip if we already added this code in this batch (internal duplicate)
                if (insertedCodes.has(normalizedCode)) {
                    skippedRooms.push(room.roomCode + ' (duplicate in file)');
                    continue;
                }

                insertedCodes.add(normalizedCode);
                roomsToInsert.push({
                    name: room.roomName,
                    code: room.roomCode.trim(), // Clean the code
                    capacity: room.capacity,
                    building_id: buildingIdMap[room.buildingName],
                    floor: 'Lantai 1', // Default floor
                    department_id: null, // Will show as "Umum"
                    is_available: true,
                    equipment: []
                });
            }

            // Insert in batches using upsert with ignore to handle any remaining duplicates
            const batchSize = 100;
            let insertedCount = 0;

            for (let i = 0; i < roomsToInsert.length; i += batchSize) {
                const batch = roomsToInsert.slice(i, i + batchSize);
                const { data, error: insertError } = await supabase
                    .from('rooms')
                    .upsert(batch, {
                        onConflict: 'code',
                        ignoreDuplicates: true
                    })
                    .select();

                if (insertError) {
                    // Continue with next batch instead of failing completely
                    continue;
                }
                insertedCount += data?.length || 0;
            }

            toast.dismiss(loadingToast);

            // Show summary
            const newBuildingsCount = buildingStatuses.filter(b => b.isNew).length;
            let message = `Berhasil menambahkan ${insertedCount} ruangan`;
            if (newBuildingsCount > 0) {
                message += ` dan ${newBuildingsCount} gedung baru`;
            }
            if (skippedRooms.length > 0) {
                message += `. ${skippedRooms.length} ruangan di-skip (kode sudah ada)`;
            }

            toast.success(message);
            onSuccess();
            onClose();

        } catch (error: any) {
            toast.dismiss(loadingToast);
            toast.error(error.message || 'Gagal mengunggah data');
        } finally {
            setUploading(false);
        }
    };

    const downloadSampleTemplate = () => {
        const sampleData = [
            {
                'No': 1,
                'Nama Gedung': 'GEDUNG LABORATORIUM VOKASI KAMPUS GUNUNGKIDUL',
                'Kode Ruang': 'J.41.1.03.01',
                'Nama Ruang': 'LABORATORIUM PASTRY',
                'Kapasitas': 20,
                'Jenis Ruang': 'Ruang Laboratorium'
            },
            {
                'No': 2,
                'Nama Gedung': 'GEDUNG LAYANAN AKADEMIK KAMPUS GUNUNGKIDUL',
                'Kode Ruang': 'J.40.1.02.05',
                'Nama Ruang': 'PERPUSTAKAAN GUNUNGKIDUL',
                'Kapasitas': 50,
                'Jenis Ruang': 'Ruang Perpustakaan'
            },
        ];
        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Rooms');
        XLSX.writeFile(workbook, 'room_import_template.xlsx');
    };

    // Pagination
    const totalPages = Math.ceil(preview.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const currentRows = preview.slice(startIndex, endIndex);

    // Stats - use normalized code comparison
    const normalizeCode = (code: string) => code.toLowerCase().trim().replace(/\s+/g, '');

    const duplicateCount = useMemo(() => {
        return preview.filter(r => existingRoomCodes.has(normalizeCode(r.roomCode))).length;
    }, [preview, existingRoomCodes]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900">Import Ruangan dari Excel</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Kampus: <span className="font-medium text-blue-600">{campusName}</span>
                            </p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {!showPreview ? (
                        <div className="space-y-6">
                            {/* Dropzone */}
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                                    }`}
                            >
                                <input {...getInputProps()} />
                                <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-lg font-medium text-gray-700 mb-1">
                                    {isDragActive ? 'Letakkan file di sini' : 'Seret & letakkan file Excel di sini'}
                                </p>
                                <p className="text-sm text-gray-500 mb-4">atau klik untuk memilih file</p>
                                <p className="text-xs text-gray-400">Format yang didukung: .xlsx, .xls</p>
                            </div>

                            {/* Format Info */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-medium text-blue-800 mb-2">Format Kolom Excel</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-blue-700">
                                            <span className="bg-blue-100 px-2 py-1 rounded">No</span>
                                            <span className="bg-blue-100 px-2 py-1 rounded font-medium">Nama Gedung *</span>
                                            <span className="bg-blue-100 px-2 py-1 rounded font-medium">Kode Ruang *</span>
                                            <span className="bg-blue-100 px-2 py-1 rounded font-medium">Nama Ruang *</span>
                                            <span className="bg-blue-100 px-2 py-1 rounded">Kapasitas</span>
                                            <span className="bg-blue-100 px-2 py-1 rounded">Jenis Ruang</span>
                                        </div>
                                        <p className="text-xs text-blue-600 mt-2">* Kolom wajib</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); downloadSampleTemplate(); }}
                                            className="flex items-center space-x-1 text-xs font-medium text-blue-600 hover:text-blue-800 mt-3"
                                        >
                                            <Download className="h-3 w-3" />
                                            <span>Unduh Template Contoh</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Info about auto-create */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <Building2 className="h-5 w-5 text-green-500 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-medium text-green-800 mb-1">Auto-Create Gedung</h4>
                                        <p className="text-xs text-green-700">
                                            Jika gedung belum ada di database, akan otomatis dibuat berdasarkan kolom "Nama Gedung".
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 flex-1 flex flex-col">
                            {/* Preview Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900">
                                        Preview Data ({preview.length} ruangan)
                                    </h4>
                                    <div className="flex items-center gap-4 mt-1 text-xs">
                                        <span className="flex items-center gap-1 text-green-600">
                                            <Plus className="h-3 w-3" /> {buildingStatuses.filter(b => b.isNew).length} gedung baru
                                        </span>
                                        {duplicateCount > 0 && (
                                            <span className="flex items-center gap-1 text-orange-600">
                                                <AlertCircle className="h-3 w-3" /> {duplicateCount} ruangan duplikat (akan di-skip)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowPreview(false); setPreview([]); setBuildingStatuses([]); }}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    Unggah file lain
                                </button>
                            </div>

                            {/* Building Status Cards */}
                            <div className="flex flex-wrap gap-2">
                                {buildingStatuses.map((building, idx) => (
                                    <div
                                        key={idx}
                                        className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${building.isNew
                                            ? 'bg-green-100 text-green-800 border border-green-200'
                                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                                            }`}
                                    >
                                        <Building2 className="h-3 w-3" />
                                        <span className="font-medium truncate max-w-[200px]" title={building.name}>
                                            {building.name.length > 30 ? building.name.substring(0, 30) + '...' : building.name}
                                        </span>
                                        <span className="bg-white px-1.5 py-0.5 rounded text-[10px]">
                                            {building.roomCount} ruangan
                                        </span>
                                        {building.isNew && (
                                            <span className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                BARU
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Preview Table */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 flex flex-col">
                                <div className="overflow-auto flex-grow">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Gedung</th>
                                                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase">Kode Ruang</th>
                                                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Ruang</th>
                                                <th className="p-3 text-center text-xs font-medium text-gray-500 uppercase">Kapasitas</th>
                                                <th className="p-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {currentRows.map((room, index) => {
                                                const isDuplicate = existingRoomCodes.has(normalizeCode(room.roomCode));
                                                const buildingStatus = buildingStatuses.find(b => b.name === room.buildingName);

                                                return (
                                                    <tr key={index} className={`hover:bg-gray-50 ${isDuplicate ? 'bg-orange-50' : ''}`}>
                                                        <td className="p-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-900 truncate max-w-[200px]" title={room.buildingName}>
                                                                    {room.buildingName.length > 25 ? room.buildingName.substring(0, 25) + '...' : room.buildingName}
                                                                </span>
                                                                {buildingStatus?.isNew && (
                                                                    <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded">baru</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 whitespace-nowrap font-mono text-xs text-gray-600">
                                                            {room.roomCode}
                                                        </td>
                                                        <td className="p-3 whitespace-nowrap text-gray-900">{room.roomName}</td>
                                                        <td className="p-3 whitespace-nowrap text-center text-gray-600">{room.capacity}</td>
                                                        <td className="p-3 whitespace-nowrap text-center">
                                                            {isDuplicate ? (
                                                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
                                                                    <AlertCircle className="h-3 w-3" /> Duplikat
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                                                                    <CheckCircle className="h-3 w-3" /> OK
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t border-gray-200">
                                    <span className="text-xs text-gray-600">
                                        Menampilkan {preview.length > 0 ? startIndex + 1 : 0} - {Math.min(endIndex, preview.length)} dari {preview.length}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                        <button
                                            onClick={() => setCurrentPage(p => p - 1)}
                                            disabled={currentPage === 1}
                                            className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <span className="text-xs font-medium">{currentPage} / {totalPages || 1}</span>
                                        <button
                                            onClick={() => setCurrentPage(p => p + 1)}
                                            disabled={currentPage >= totalPages}
                                            className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        Batal
                    </button>
                    {showPreview && (
                        <button
                            onClick={handleUpload}
                            disabled={uploading || preview.length === 0}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Mengimport...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Import {preview.length - duplicateCount} Ruangan</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoomExcelUploadModal;
