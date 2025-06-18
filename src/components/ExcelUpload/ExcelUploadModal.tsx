import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface ExcelUploadModalProps {
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

const ExcelUploadModal: React.FC<ExcelUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<TransformedSchedule[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'], },
    maxFiles: 1,
    onDrop: (acceptedFiles) => { if (acceptedFiles.length > 0) { setFile(acceptedFiles[0]); processExcelFile(acceptedFiles[0]); } },
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
              // Lewati baris jika kolom fundamental kosong
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
                  semester: row[' Semester MK'] || null,
                  kurikulum: row[' Kurikulum'] || null,
                  academics_year: academicsYear,
                  type: (row[' Jenis'] || '').toLowerCase().includes('prak') ? 'practical' : 'theory',
                  class: row[' Rombel'] || null,
                  lecturer: row[' Pengampu'] || null,
                  day, start_time, end_time,
                  room: cleanRuang(row[' Ruang']),
                  amount: row[' Jml MHS'] || 0,
              };
              
              allTransformedData.push(transformedRow);
          }
      }

      setPreview(allTransformedData);
      setShowPreview(true);
      setCurrentPage(1);
      
      if (allTransformedData.length > 0) {
        toast.success(`Berhasil memproses ${allTransformedData.length} jadwal dari semua sheet.`);
      } else {
        toast.error("Tidak ada data yang dapat dibaca. Pastikan header kolom sudah benar di semua sheet.");
      }

    } catch (error) {
      console.error('Error processing Excel file:', error);
      toast.error('Gagal memproses file Excel.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => { if (!preview.length) { toast.error('Tidak ada data untuk diunggah.'); return; } setUploading(true); try { const scheduleData = preview.map(schedule => ({ subject_study: schedule.subject_study, course_code: schedule.course_code, course_name: schedule.course_name, semester: schedule.semester, kurikulum: schedule.kurikulum, academics_year: schedule.academics_year, type: schedule.type, class: schedule.class, lecturer: schedule.lecturer, day: schedule.day, start_time: schedule.start_time, end_time: schedule.end_time, room: schedule.room, amount: schedule.amount })); const { error } = await supabase.from('lecture_schedules').insert(scheduleData); if (error) throw error; toast.success(`Berhasil mengunggah ${scheduleData.length} jadwal kuliah`); onSuccess(); onClose(); } catch (error: any) { console.error('Error uploading schedules:', error); toast.error(error.message || 'Gagal mengunggah jadwal'); } finally { setUploading(false); } };
  const downloadSampleTemplate = () => { const sampleData = [ { 'No.': 1, ' Prodi': "Teknologi Rekayasa Perangkat Lunak - D4", ' Kode / Nama': "TI2043 - Pemrograman Web", ' Semester MK': 2, ' Kurikulum': "2022 - D4", ' TA': "2024", ' Semester': "Genap", ' Jenis': "Teori", ' Rombel': "A", ' Sks Rombel': 2, ' Pengampu': "Dr. Budi Santoso", ' Jadwal hari': "pukul:09:20:00 - 11:00:00 hari:Senin", ' Ruang': "GK 2.04, G.KULIAH I, size:50 [J.18.2.01.04]", ' Jml MHS': 50, } ]; const worksheet = XLSX.utils.json_to_sheet(sampleData); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample'); XLSX.writeFile(workbook, 'lecture_schedule_template.xlsx'); };

  const totalPages = Math.ceil(preview.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentRows = preview.slice(startIndex, endIndex);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200"> <div className="flex items-center justify-between"> <h3 className="text-xl font-semibold text-gray-900">Unggah Jadwal Kuliah</h3> <button onClick={onClose} className="text-gray-400 hover:text-gray-600"> <X className="h-6 w-6" /> </button> </div> </div>
        <div className="p-6 flex-1 overflow-y-auto">
          {!showPreview ? ( <div className="space-y-6"> <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${ isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400' }`} > <input {...getInputProps()} /> <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" /> <p className="text-lg font-medium text-gray-700 mb-1"> {isDragActive ? 'Letakkan file di sini' : 'Seret & letakkan file Excel di sini'} </p> <p className="text-sm text-gray-500 mb-4"> atau klik untuk memilih file </p> <p className="text-xs text-gray-400"> Format yang didukung: .xlsx, .xls </p> </div> <div className="bg-blue-50 border border-blue-200 rounded-lg p-4"> <div className="flex items-start space-x-3"> <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" /> <div> <h4 className="text-sm font-medium text-blue-800 mb-1">Persyaratan Format Excel</h4> <p className="text-xs text-blue-700 mb-2"> Pastikan header kolom di file Excel Anda sama persis (termasuk spasi) dengan template. </p> <ul className="text-xs text-blue-700 grid grid-cols-2 gap-x-4"> <li>No.</li> <li> Prodi</li> <li> Kode / Nama</li> <li> Semester MK</li> <li> Kurikulum</li> <li> TA</li> <li> Semester</li> <li> Jenis</li> <li> Rombel</li> <li> Sks Rombel</li> <li> Pengampu</li> <li> Jadwal hari</li> <li> Ruang</li> <li> Jml MHS</li> </ul> <div className="mt-3"> <button onClick={(e) => { e.stopPropagation(); downloadSampleTemplate(); }} className="flex items-center space-x-1 text-xs font-medium text-blue-600 hover:text-blue-800" > <Download className="h-3 w-3" /> <span>Unduh Template Contoh</span> </button> </div> </div> </div> </div> </div> )
          : ( <div className="space-y-4 flex-1 flex flex-col h-full"> <div className="flex items-center justify-between"> <h4 className="text-lg font-medium text-gray-900"> Preview ({preview.length} jadwal) </h4> <button onClick={() => { setShowPreview(false); setFile(null); setPreview([]); setValidationErrors([]); setCurrentPage(1); }} className="text-sm text-blue-600 hover:text-blue-800 font-medium" > Unggah file lain </button> </div>
              {validationErrors.length > 0 && ( <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"> <div className="flex items-start space-x-3"> <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" /> <div> <h4 className="text-sm font-medium text-red-800 mb-1">Peringatan Pemrosesan</h4> <p className="text-xs text-red-700">Beberapa baris memiliki format 'Jadwal hari' yang tidak valid dan diatur ke N/A.</p></div> </div> </div> )}
              <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 flex flex-col">
                <div className="overflow-auto flex-grow">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10"> <tr> <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Mata Kuliah</th> <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Jadwal</th> <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Ruang</th> <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Dosen</th> <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Kelas</th> <th className="p-2 text-left text-xs font-medium text-gray-500 uppercase">Prodi</th> </tr> </thead>
                    <tbody className="divide-y divide-gray-200">
                      {currentRows.map((schedule, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 whitespace-nowrap"><div className="font-medium text-gray-900">{schedule.course_name || 'N/A'}</div><div className="text-xs text-gray-500">{schedule.course_code || 'N/A'}</div></td>
                          <td className="p-2 whitespace-nowrap"><div className="text-gray-900">{schedule.day || 'N/A'}</div><div className="text-xs text-gray-500">{schedule.start_time && schedule.end_time ? `${schedule.start_time} - ${schedule.end_time}`: 'N/A'}</div></td>
                          <td className="p-2 whitespace-nowrap text-gray-900">{schedule.room || 'N/A'}</td>
                          <td className="p-2 whitespace-nowrap text-gray-900">{schedule.lecturer || 'N/A'}</td>
                          <td className="p-2 whitespace-nowrap"><div className="text-gray-900">Kelas {schedule.class || 'N/A'}</div><div className="text-xs text-gray-500">Smt {schedule.semester || 'N/A'}</div></td>
                          <td className="p-2 whitespace-nowrap text-xs text-gray-500">{schedule.subject_study || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t border-gray-200"> <span className="text-xs text-gray-600"> Menampilkan {preview.length > 0 ? startIndex + 1 : 0} sampai {Math.min(endIndex, preview.length)} dari {preview.length} data </span> <div className="flex items-center space-x-1"> <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"><ChevronLeft className="h-4 w-4"/></button> <span className="text-xs font-medium">{currentPage} / {totalPages}</span> <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"><ChevronRight className="h-4 w-4"/></button> </div> </div>
              </div>
            </div> 
          )}
        </div>
        
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"> Batal </button>
          {showPreview && ( <button onClick={handleUpload} disabled={uploading} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50" > {uploading ? ( <> <Loader2 className="h-4 w-4 animate-spin" /> <span>Mengunggah...</span> </> ) : ( <> <CheckCircle className="h-4 w-4" /> <span>Unggah Jadwal</span> </> )} </button> )}
        </div>
      </div>
    </div>
  );
};

export default ExcelUploadModal;
