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
    stock_id: string;
    name: string;
    code: string;
    quantity: number;
    condition: string;
    room_name: string;
    spesification?: string;
    is_available?: boolean | string;
    is_mandatory?: boolean | string;
}

interface ParsedRow extends ImportRow {
    rowIndex: number;
    matchedRoom: { id: string; name: string; department_id?: string; study_program_id?: string } | null;
    matchedStock: { id: string; nama: string; quantity: number; unit: string; category: string; spesification?: string } | null;
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

                // Match stock by ID
                const matchedStock = matchStock(row.stock_id);
                if (!matchedStock && row.stock_id) {
                    errors.push(`Stock ID "${row.stock_id}" tidak ditemukan`);
                }
                if (!row.stock_id) {
                    errors.push('Stock ID wajib diisi');
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

                return {
                    ...row,
                    rowIndex: index + 2, // Excel row number (1-indexed + header)
                    matchedRoom,
                    matchedStock,
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
                const equipmentData = {
                    name: row.name.trim(),
                    code: row.code.trim().toUpperCase(),
                    category: row.matchedStock!.category,
                    quantity: Number(row.quantity),
                    unit: row.matchedStock!.unit,
                    condition: row.condition.toUpperCase(),
                    rooms_id: row.matchedRoom!.id,
                    stock_id: row.matchedStock!.id,
                    Spesification: row.spesification || row.matchedStock!.spesification || null,
                    is_mandatory: row.is_mandatory === true || row.is_mandatory === 'true' || row.is_mandatory === 'TRUE' || row.is_mandatory === 'Ya' || row.is_mandatory === 'yes' || row.is_mandatory === 'YES',
                    is_available: row.is_available !== false && row.is_available !== 'false' && row.is_available !== 'FALSE' && row.is_available !== 'Tidak' && row.is_available !== 'no' && row.is_available !== 'NO',
                    department_id: row.matchedRoom!.department_id || null,
                    study_program_id: row.matchedRoom!.study_program_id || null,
                };

                const { error: insertError } = await supabase.from('equipment').insert([equipmentData]);
                if (insertError) throw insertError;

                // Update stock quantity
                const newStockQty = row.matchedStock!.quantity - Number(row.quantity);
                const { error: stockError } = await supabase
                    .from('stock')
                    .update({ quantity: newStockQty })
                    .eq('id', row.matchedStock!.id);
                if (stockError) throw stockError;

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
                stock_id: '(UUID dari Stock - lihat di tab Stock)',
                name: 'Nama Equipment',
                code: 'EQ001',
                quantity: 5,
                condition: 'GOOD',
                room_name: 'Nama Ruangan (harus sama persis)',
                spesification: 'Spesifikasi opsional',
                is_available: 'true',
                is_mandatory: 'false'
            },
            {
                stock_id: 'contoh-uuid-12345',
                name: 'Laptop ASUS',
                code: 'LAPTOP001',
                quantity: 10,
                condition: 'GOOD',
                room_name: 'Lab Komputer 1',
                spesification: 'Intel i5, 8GB RAM',
                is_available: 'true',
                is_mandatory: 'false'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);

        // Set column widths
        worksheet['!cols'] = [
            { wch: 40 }, // stock_id
            { wch: 25 }, // name
            { wch: 15 }, // code
            { wch: 10 }, // quantity
            { wch: 15 }, // condition
            { wch: 30 }, // room_name
            { wch: 30 }, // spesification
            { wch: 12 }, // is_available
            { wch: 12 }, // is_mandatory
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Equipment Import');
        XLSX.writeFile(workbook, 'equipment_import_template.xlsx');
        toast.success('Template berhasil didownload');
    };

    if (!isOpen) return null;

    const validCount = parsedData.filter(r => r.isValid).length;
    const invalidCount = parsedData.filter(r => !r.isValid).length;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-emerald-600 to-teal-600">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <Upload className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Import Equipment dari Excel</h2>
                            <p className="text-emerald-100 text-sm">Upload file Excel untuk menambah equipment secara massal</p>
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
                                        <h4 className="text-sm font-medium text-blue-800 mb-2">Format Kolom Excel</h4>
                                        <div className="grid grid-cols-2 gap-1 text-xs text-blue-700 mb-3">
                                            <span>• stock_id (wajib)</span>
                                            <span>• name (wajib)</span>
                                            <span>• code (wajib)</span>
                                            <span>• quantity (wajib)</span>
                                            <span>• condition (wajib)</span>
                                            <span>• room_name (wajib)</span>
                                            <span>• spesification (opsional)</span>
                                            <span>• is_available (true/false)</span>
                                            <span>• is_mandatory (true/false)</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span>Download Template Excel</span>
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
                            <div className="border rounded-xl overflow-hidden">
                                <div className="overflow-x-auto max-h-96">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Nama</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Kode</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Qty</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Ruangan</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {parsedData.map((row) => (
                                                <tr key={row.rowIndex} className={row.isValid ? 'bg-white' : 'bg-red-50'}>
                                                    <td className="px-3 py-2 text-gray-500">{row.rowIndex}</td>
                                                    <td className="px-3 py-2 font-medium">{row.name}</td>
                                                    <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                                                    <td className="px-3 py-2">{row.quantity}</td>
                                                    <td className="px-3 py-2">
                                                        {row.matchedRoom ? (
                                                            <span className="text-emerald-600">{row.matchedRoom.name}</span>
                                                        ) : (
                                                            <span className="text-red-600">{row.room_name || '-'}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {row.isValid ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                                                                <CheckCircle className="h-3 w-3 mr-1" /> Valid
                                                            </span>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                {row.errors.map((err, i) => (
                                                                    <div key={i} className="text-xs text-red-600 flex items-start">
                                                                        <AlertTriangle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                                                        {err}
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
                            className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-medium transition-all disabled:opacity-50"
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
