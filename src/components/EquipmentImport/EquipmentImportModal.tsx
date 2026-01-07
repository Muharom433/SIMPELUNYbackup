import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Download, Upload, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface EquipmentImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    rooms: Array<{ id: string; name: string; code: string; department_id?: string; study_program_id?: string }>;
    stocks: Array<{ id: string; nama: string; code: string; category: string; quantity: number; unit: string; spesification?: string }>;
}

interface ImportRow {
    stock_id?: string; // Made optional
    name: string;
    code: string;
    quantity: number;
    unit?: string; // Added, required if stock_id is missing
    category?: string; // Added, required if stock_id is missing
    condition: string;
    room_name: string;
    spesification?: string;
    is_available?: boolean | string;
    is_mandatory?: boolean | string;
    // Detail Equipment Columns (Semicolon separated)
    detail_names?: string;
    detail_codes?: string;
    detail_quantities?: string;
    detail_units?: string;
    detail_conditions?: string;
}

interface ParsedDetail {
    name: string;
    code: string;
    quantity: number;
    unit: string;
    condition: string;
}

interface ParsedRow extends ImportRow {
    rowIndex: number;
    matchedRoom: { id: string; name: string; department_id?: string; study_program_id?: string } | null;
    matchedStock: { id: string; nama: string; quantity: number; unit: string; category: string; spesification?: string } | null;
    parsedDetails: ParsedDetail[];
    errors: string[];
    isValid: boolean;
}

const EquipmentImportModal: React.FC<EquipmentImportModalProps> = ({ isOpen, onClose, onSuccess, rooms, stocks }) => {
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            processExcelFile(acceptedFiles[0]);
        }
    }, [rooms, stocks]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
        },
        maxFiles: 1,
    });

    const matchRoom = (roomName: string) => {
        if (!roomName) return null;
        const normalizedInput = roomName.trim().toLowerCase();
        return rooms.find(room => room.name.toLowerCase() === normalizedInput) || null;
    };

    const matchStock = (stockId: string) => {
        if (!stockId) return null;
        return stocks.find(stock => stock.id === stockId.trim()) || null;
    };

    const processExcelFile = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: ImportRow[] = XLSX.utils.sheet_to_json(worksheet);

            const parsed: ParsedRow[] = jsonData.map((row, index) => {
                const errors: string[] = [];

                // Match room by name
                const matchedRoom = matchRoom(row.room_name);
                if (!matchedRoom && row.room_name) {
                    errors.push(`Ruangan "${row.room_name}" tidak ditemukan`);
                }
                if (!row.room_name) {
                    errors.push('Nama ruangan wajib diisi');
                }

                // Match stock by ID (Optional now)
                let matchedStock = null;
                if (row.stock_id) {
                    matchedStock = matchStock(row.stock_id);
                    if (!matchedStock) {
                        errors.push(`Stock ID "${row.stock_id}" tidak ditemukan`);
                    }
                }

                // If no stock, ensure category and unit are present
                if (!matchedStock) {
                    if (!row.category) errors.push('Category wajib diisi (jika tanpa Stock ID)');
                    if (!row.unit) errors.push('Unit wajib diisi (jika tanpa Stock ID)');
                }

                // Validate quantity
                const quantity = Number(row.quantity);
                if (isNaN(quantity) || quantity <= 0) {
                    errors.push('Quantity harus angka positif');
                }
                if (matchedStock && quantity > matchedStock.quantity) {
                    errors.push(`Quantity melebihi stok tersedia (${matchedStock.quantity})`);
                }

                // Validate required fields
                if (!row.name?.trim()) errors.push('Nama equipment wajib diisi');
                if (!row.code?.trim()) errors.push('Kode equipment wajib diisi');

                // Validate condition
                const validConditions = ['GOOD', 'BROKEN', 'MAINTENANCE'];
                if (!validConditions.includes(row.condition?.toUpperCase())) {
                    errors.push('Condition harus GOOD, BROKEN, atau MAINTENANCE');
                }

                // Parse Detail Equipment (if any)
                const parsedDetails: ParsedDetail[] = [];
                if (row.detail_names) {
                    const names = row.detail_names.split(';');
                    const codes = row.detail_codes ? row.detail_codes.split(';') : [];
                    const quantities = row.detail_quantities ? row.detail_quantities.split(';') : [];
                    const units = row.detail_units ? row.detail_units.split(';') : [];
                    const conditions = row.detail_conditions ? row.detail_conditions.split(';') : [];

                    if (names.length !== codes.length) errors.push('Jumlah detail_names dan detail_codes tidak sama');

                    names.forEach((name, i) => {
                        parsedDetails.push({
                            name: name.trim(),
                            code: codes[i]?.trim() || '',
                            quantity: Number(quantities[i]) || 1,
                            unit: units[i]?.trim() || row.unit || 'pcs',
                            condition: conditions[i]?.trim().toUpperCase() || 'GOOD'
                        });
                    });
                }

                return {
                    ...row,
                    rowIndex: index + 2, // Excel row number (1-indexed + header)
                    matchedRoom,
                    matchedStock,
                    parsedDetails,
                    errors,
                    isValid: errors.length === 0
                };
            });

            setParsedData(parsed);
            setShowPreview(true);
        } catch (error) {
            console.error('Error parsing Excel:', error);
            toast.error('Gagal membaca file Excel');
        }
    };

    const handleImport = async () => {
        const validRows = parsedData.filter(row => row.isValid);
        if (validRows.length === 0) {
            toast.error('Tidak ada data valid untuk diimport');
            return;
        }

        setIsUploading(true);
        setUploadProgress({ current: 0, total: validRows.length });

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            try {
                // Determine Category and Unit
                const category = row.matchedStock ? row.matchedStock.category : row.category!;
                const unit = row.matchedStock ? row.matchedStock.unit : row.unit!;

                const equipmentData = {
                    name: row.name.trim(),
                    code: row.code.trim().toUpperCase(),
                    category: category,
                    quantity: Number(row.quantity),
                    unit: unit,
                    condition: row.condition.toUpperCase(),
                    rooms_id: row.matchedRoom!.id,
                    stock_id: row.matchedStock ? row.matchedStock.id : null,
                    Spesification: row.spesification || (row.matchedStock ? row.matchedStock.spesification : null),
                    is_mandatory: row.is_mandatory === true || row.is_mandatory === 'true' || row.is_mandatory === 'TRUE' || row.is_mandatory === 'Ya' || row.is_mandatory === 'yes' || row.is_mandatory === 'YES',
                    is_available: row.is_available !== false && row.is_available !== 'false' && row.is_available !== 'FALSE' && row.is_available !== 'Tidak' && row.is_available !== 'no' && row.is_available !== 'NO',
                    department_id: row.matchedRoom!.department_id || null,
                    study_program_id: row.matchedRoom!.study_program_id || null,
                };

                // Insert Equipment
                const { data: insertedEquip, error: insertError } = await supabase
                    .from('equipment')
                    .insert([equipmentData])
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Update stock quantity ONLY if stock_id exists
                if (row.matchedStock) {
                    const newStockQty = row.matchedStock.quantity - Number(row.quantity);
                    const { error: stockError } = await supabase
                        .from('stock')
                        .update({ quantity: newStockQty })
                        .eq('id', row.matchedStock.id);
                    if (stockError) throw stockError;
                }

                // Insert Detail Equipment
                if (row.parsedDetails.length > 0 && insertedEquip) {
                    const detailsToInsert = row.parsedDetails.map(detail => ({
                        equipment_id: insertedEquip.id,
                        name: detail.name,
                        code: detail.code,
                        quantity: detail.quantity,
                        unit: detail.unit,
                        condition: detail.condition,
                        notes: 'Imported from Excel'
                    }));

                    const { error: detailError } = await supabase
                        .from('detail_equipment')
                        .insert(detailsToInsert);

                    if (detailError) {
                        console.error('Error inserting details:', detailError);
                        // We don't throw here to avoid failing the whole row import if just details fail, 
                        // but ideally we should probably warn. For now let's just log.
                        toast.error(`Gagal menyimpan detail untuk ${row.name}`);
                    }
                }

                successCount++;
            } catch (error) {
                console.error(`Error importing row ${row.rowIndex}:`, error);
                errorCount++;
            }
            setUploadProgress({ current: i + 1, total: validRows.length });
        }

        setIsUploading(false);

        if (successCount > 0) {
            toast.success(`Berhasil import ${successCount} equipment`);
            if (errorCount > 0) {
                toast.error(`${errorCount} data gagal diimport`);
            }
            onSuccess();
            handleClose();
        } else {
            toast.error('Gagal import semua data');
        }
    };

    const handleClose = () => {
        setParsedData([]);
        setShowPreview(false);
        setIsUploading(false);
        setUploadProgress({ current: 0, total: 0 });
        onClose();
    };

    const downloadTemplate = () => {
        const templateData = [
            {
                stock_id: '(Opsional) UUID Stock',
                name: 'Toolkit Set A',
                code: 'TK-A-001',
                category: 'Equipment',
                quantity: 1,
                unit: 'set',
                condition: 'GOOD',
                room_name: 'Workshop 1',
                spesification: 'Toolkit lengkap',
                is_available: 'true',
                is_mandatory: 'false',
                detail_names: 'Obeng Plus; Obeng Minus; Tang',
                detail_codes: 'OB-01; OB-02; TG-01',
                detail_quantities: '1; 1; 1',
                detail_units: 'pcs; pcs; pcs',
                detail_conditions: 'GOOD; GOOD; GOOD'
            },
            {
                stock_id: '',
                name: 'Multimeter Digital',
                code: 'MM-001',
                category: 'Electronics',
                quantity: 5,
                unit: 'unit',
                condition: 'GOOD',
                room_name: 'Lab Elektro',
                spesification: '',
                is_available: 'true',
                is_mandatory: 'false',
                detail_names: '',
                detail_codes: '',
                detail_quantities: '',
                detail_units: '',
                detail_conditions: ''
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);

        // Set column widths
        worksheet['!cols'] = [
            { wch: 30 }, // stock_id
            { wch: 25 }, // name
            { wch: 15 }, // code
            { wch: 15 }, // quantity
            { wch: 10 }, // unit
            { wch: 15 }, // category
            { wch: 15 }, // condition
            { wch: 20 }, // room_name
            { wch: 20 }, // spesification
            { wch: 10 }, // is_available
            { wch: 10 }, // is_mandatory
            { wch: 30 }, // detail_names
            { wch: 20 }, // detail_codes
            { wch: 15 }, // detail_quantities
            { wch: 10 }, // detail_units
            { wch: 15 }, // detail_conditions
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Equipment Import');

        // Use the library's writeFile function directly as requested
        XLSX.writeFile(workbook, 'equipment_import_template_v2.xlsx', { compression: true });

        toast.success('Template berhasil didownload');
    };

    if (!isOpen) return null;

    const validCount = parsedData.filter(r => r.isValid).length;
    const invalidCount = parsedData.filter(r => !r.isValid).length;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-emerald-600 to-teal-600">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <Upload className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Import Equipment dari Excel</h2>
                            <p className="text-emerald-100 text-sm">Upload file Excel untuk menambah equipment secara massal, termasuk Detail Equipment (Toolkit)</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                        <X className="h-6 w-6 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {!showPreview ? (
                        <div className="space-y-6">
                            {/* Dropzone */}
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
                                    }`}
                            >
                                <input {...getInputProps()} />
                                <FileSpreadsheet className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                                <p className="text-lg font-medium text-gray-700 mb-1">
                                    {isDragActive ? 'Letakkan file di sini' : 'Seret & letakkan file Excel di sini'}
                                </p>
                                <p className="text-sm text-gray-500 mb-4">atau klik untuk memilih file</p>
                                <p className="text-xs text-gray-400">Format: .xlsx, .xls</p>
                            </div>

                            {/* Template Download */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <div className="flex items-start space-x-3">
                                    <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-blue-800 mb-2">Panduan Format Excel</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-700 mb-3">
                                            <div>
                                                <p className="font-bold mb-1">Kolom Wajib:</p>
                                                <ul className="list-disc pl-4 space-y-1">
                                                    <li>name, code, quantity, condition, room_name</li>
                                                    <li>stock_id (Jika kosong, maka category & unit WAJIB diisi)</li>
                                                    <li>category & unit (Wajib jika stock_id kosong)</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <p className="font-bold mb-1">Detail Equipment (Toolkit):</p>
                                                <p className="mb-1">Gunakan pemisah titik koma (;) untuk banyak item.</p>
                                                <ul className="list-disc pl-4 space-y-1">
                                                    <li>detail_names: "Obeng +; Obeng -"</li>
                                                    <li>detail_codes: "OB1; OB2"</li>
                                                    <li>detail_quantities: "1; 1"</li>
                                                </ul>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span>Download Template Excel V2</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2 text-emerald-600">
                                        <CheckCircle className="h-5 w-5" />
                                        <span className="font-medium">{validCount} valid</span>
                                    </div>
                                    {invalidCount > 0 && (
                                        <div className="flex items-center space-x-2 text-red-600">
                                            <AlertTriangle className="h-5 w-5" />
                                            <span className="font-medium">{invalidCount} error</span>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setShowPreview(false); setParsedData([]); }}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Ganti File
                                </button>
                            </div>

                            {/* Data Preview Table */}
                            <div className="border rounded-xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto max-h-[60vh]">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-3 text-left font-medium text-gray-600 border-b">Row</th>
                                                <th className="px-3 py-3 text-left font-medium text-gray-600 border-b">Nama</th>
                                                <th className="px-3 py-3 text-left font-medium text-gray-600 border-b">Kode</th>
                                                <th className="px-3 py-3 text-left font-medium text-gray-600 border-b">Source</th>
                                                <th className="px-3 py-3 text-left font-medium text-gray-600 border-b">Details</th>
                                                <th className="px-3 py-3 text-left font-medium text-gray-600 border-b">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {parsedData.map((row) => (
                                                <tr key={row.rowIndex} className={`hover:bg-gray-50 ${!row.isValid ? 'bg-red-50' : ''}`}>
                                                    <td className="px-3 py-3 text-gray-500">{row.rowIndex}</td>
                                                    <td className="px-3 py-3 font-medium">
                                                        <div>{row.name}</div>
                                                        <div className="text-xs text-gray-500">{row.quantity} {row.unit || row.matchedStock?.unit}</div>
                                                    </td>
                                                    <td className="px-3 py-3 font-mono text-xs">{row.code}</td>
                                                    <td className="px-3 py-3 text-xs">
                                                        {row.matchedStock ? (
                                                            <span className="text-blue-600 font-medium">Stock: {row.matchedStock.nama}</span>
                                                        ) : (
                                                            <span className="text-gray-500">Manual Input</span>
                                                        )}
                                                        <div className="mt-1">
                                                            Room: {row.matchedRoom ? (
                                                                <span className="text-emerald-600">{row.matchedRoom.name}</span>
                                                            ) : (
                                                                <span className="text-red-600">{row.room_name || 'Missing'}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-xs">
                                                        {row.parsedDetails.length > 0 ? (
                                                            <div className="space-y-1">
                                                                <span className="font-semibold text-purple-600">{row.parsedDetails.length} Sub-items:</span>
                                                                <ul className="list-disc pl-3 text-gray-600 max-h-20 overflow-y-auto">
                                                                    {row.parsedDetails.map((d, i) => (
                                                                        <li key={i}>{d.name} ({d.code})</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        {row.isValid ? (
                                                            <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                                                <CheckCircle className="h-3 w-3 mr-1" /> Valid
                                                            </span>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                {row.errors.map((err, i) => (
                                                                    <div key={i} className="text-xs text-red-600 flex items-start bg-red-100 p-1.5 rounded">
                                                                        <AlertTriangle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                                                        <span>{err}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Upload Progress */}
                            {isUploading && (
                                <div className="bg-emerald-50 rounded-xl p-4">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                                        <span className="font-medium text-emerald-800">
                                            Mengimport... {uploadProgress.current}/{uploadProgress.total}
                                        </span>
                                    </div>
                                    <div className="w-full bg-emerald-200 rounded-full h-2">
                                        <div
                                            className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={handleClose}
                        disabled={isUploading}
                        className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors disabled:opacity-50"
                    >
                        Batal
                    </button>
                    {showPreview && validCount > 0 && (
                        <button
                            onClick={handleImport}
                            disabled={isUploading}
                            className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Mengimport...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-5 w-5" />
                                    <span>Import {validCount} Equipment</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EquipmentImportModal;
