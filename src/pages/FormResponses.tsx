import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FileText,
    ArrowLeft,
    Search,
    Filter,
    Download,
    Trash2,
    Eye,
    RefreshCw,
    Calendar,
    Users,
    Building,
    GraduationCap,
    X,
    ChevronDown,
    ChevronUp,
    Printer,
    FileDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { Form, FormField, FormResponseWithValues } from '../types/form';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Department {
    id: string;
    name: string;
}

interface StudyProgram {
    id: string;
    name: string;
}

const FormResponses: React.FC = () => {
    const { id: formId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { getText } = useLanguage();

    const [form, setForm] = useState<Form | null>(null);
    const [fields, setFields] = useState<FormField[]>([]);
    const [responses, setResponses] = useState<FormResponseWithValues[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    const [studyProgramFilter, setStudyProgramFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
    const [selectedResponse, setSelectedResponse] = useState<FormResponseWithValues | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // Load data
    useEffect(() => {
        if (formId) {
            loadData();
        }
    }, [formId]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load form
            const { data: formData, error: formError } = await supabase
                .from('forms')
                .select('*')
                .eq('id', formId)
                .single();

            if (formError) throw formError;
            setForm(formData);

            // Load fields
            const { data: fieldsData, error: fieldsError } = await supabase
                .from('form_fields')
                .select('*')
                .eq('form_id', formId)
                .order('field_order');

            if (fieldsError) throw fieldsError;
            setFields(fieldsData || []);

            // Load responses with values
            const { data: responsesData, error: responsesError } = await supabase
                .from('form_responses')
                .select(`
          *,
          values:form_response_values(*),
          respondent:users!respondent_id(full_name),
          department:departments(name),
          study_program:study_programs(name)
        `)
                .eq('form_id', formId)
                .order('submitted_at', { ascending: false });

            if (responsesError) throw responsesError;
            setResponses(responsesData || []);

            // Load departments & study programs for filters
            const { data: deptsData } = await supabase.from('departments').select('id, name');
            const { data: prodiData } = await supabase.from('study_programs').select('id, name').eq('status', 'show');
            setDepartments(deptsData || []);
            setStudyPrograms(prodiData || []);

        } catch (error: any) {
            console.error('Error loading data:', error);
            toast.error(getText('Failed to load responses', 'Gagal memuat respons'));
        } finally {
            setLoading(false);
        }
    };

    // Filter responses
    const filteredResponses = useMemo(() => {
        return responses.filter((response) => {
            // Search filter
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                response.respondent_name?.toLowerCase().includes(searchLower) ||
                response.respondent_email?.toLowerCase().includes(searchLower) ||
                response.respondent?.full_name?.toLowerCase().includes(searchLower);

            // Department filter
            const matchesDepartment = departmentFilter === 'all' || response.department_id === departmentFilter;

            // Study Program filter
            const matchesStudyProgram = studyProgramFilter === 'all' || response.study_program_id === studyProgramFilter;

            // Date filter
            const responseDate = new Date(response.submitted_at);
            const matchesDateFrom = !dateFrom || responseDate >= new Date(dateFrom);
            const matchesDateTo = !dateTo || responseDate <= new Date(dateTo + 'T23:59:59');

            return matchesSearch && matchesDepartment && matchesStudyProgram && matchesDateFrom && matchesDateTo;
        });
    }, [responses, searchTerm, departmentFilter, studyProgramFilter, dateFrom, dateTo]);

    // Get field value from response (text only, for table display)
    const getFieldValue = (response: FormResponseWithValues, fieldId: string): string => {
        const value = response.values?.find((v) => v.field_id === fieldId);
        if (!value) return '-';

        if (value.signature_data) return '__SIGNATURE__'; // Special marker for signature
        if (value.value_array && value.value_array.length > 0) return value.value_array.join(', ');
        return value.value || '-';
    };

    // Get signature data for a field
    const getSignatureData = (response: FormResponseWithValues, fieldId: string): string | null => {
        const value = response.values?.find((v) => v.field_id === fieldId);
        return value?.signature_data || null;
    };

    // Delete response
    const handleDelete = async (responseId: string) => {
        try {
            const { error } = await supabase.from('form_responses').delete().eq('id', responseId);
            if (error) throw error;

            setResponses((prev) => prev.filter((r) => r.id !== responseId));
            setShowDeleteConfirm(null);
            toast.success(getText('Response deleted', 'Respons dihapus'));
        } catch (error: any) {
            console.error('Error deleting response:', error);
            toast.error(getText('Failed to delete response', 'Gagal menghapus respons'));
        }
    };

    // Export to PDF
    const exportToPDF = async () => {
        try {
            setExporting(true);

            // Create printable content
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                toast.error(getText('Please allow popups to export PDF', 'Izinkan popup untuk export PDF'));
                return;
            }

            const displayFields = fields.filter(f => !['header', 'paragraph'].includes(f.field_type));

            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${form?.title || 'Form Responses'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 5px; }
            h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
            .filters { font-size: 12px; color: #888; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #fafafa; }
            .footer { margin-top: 20px; font-size: 11px; color: #888; text-align: center; }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <h1>${form?.title || 'Form Responses'}</h1>
          <h2>${form?.description || ''}</h2>
          <div class="filters">
            ${departmentFilter !== 'all' ? `Department: ${departments.find(d => d.id === departmentFilter)?.name || '-'} | ` : ''}
            ${studyProgramFilter !== 'all' ? `Study Program: ${studyPrograms.find(s => s.id === studyProgramFilter)?.name || '-'} | ` : ''}
            ${dateFrom ? `From: ${dateFrom} | ` : ''}
            ${dateTo ? `To: ${dateTo} | ` : ''}
            Total: ${filteredResponses.length} responses
          </div>
          <table>
            <thead>
              <tr>
                <th>No</th>
                ${displayFields.map(f => `<th>${f.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${filteredResponses.map((response, index) => `
                <tr>
                  <td>${index + 1}</td>
                  ${displayFields.map(f => {
                if (f.field_type === 'signature') {
                    const sigData = getSignatureData(response, f.id);
                    return sigData ? `<td><img src="${sigData}" style="max-height:40px;max-width:100px;" /></td>` : '<td>-</td>';
                }
                return `<td>${getFieldValue(response, f.id)}</td>`;
            }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            Exported on ${format(new Date(), 'dd MMMM yyyy HH:mm')} | SIMPEL UNY
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

            printWindow.document.write(html);
            printWindow.document.close();

            toast.success(getText('PDF export ready', 'Export PDF siap'));
        } catch (error: any) {
            console.error('Error exporting PDF:', error);
            toast.error(getText('Failed to export PDF', 'Gagal export PDF'));
        } finally {
            setExporting(false);
        }
    };

    // Export to CSV
    const exportToCSV = () => {
        try {
            const displayFields = fields.filter(f => !['header', 'paragraph'].includes(f.field_type));

            // Headers
            const headers = ['No', 'Nama', 'Email', 'Phone', 'Department', 'Study Program', 'Submitted At', ...displayFields.map(f => f.label)];

            // Rows
            const rows = filteredResponses.map((response, index) => [
                index + 1,
                response.respondent_name || response.respondent?.full_name || '',
                response.respondent_email || '',
                response.respondent_phone || '',
                response.department?.name || '',
                response.study_program?.name || '',
                format(new Date(response.submitted_at), 'yyyy-MM-dd HH:mm:ss'),
                ...displayFields.map(f => getFieldValue(response, f.id)),
            ]);

            // Convert to CSV
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${form?.title || 'responses'}_${format(new Date(), 'yyyyMMdd')}.csv`;
            link.click();

            toast.success(getText('CSV exported', 'CSV diexport'));
        } catch (error: any) {
            console.error('Error exporting CSV:', error);
            toast.error(getText('Failed to export CSV', 'Gagal export CSV'));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!form) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {getText('Form Not Found', 'Formulir Tidak Ditemukan')}
                    </h2>
                </div>
            </div>
        );
    }

    const displayFields = fields.filter(f => !['header', 'paragraph'].includes(f.field_type)).slice(0, 5);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => navigate('/forms')}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
                            <p className="text-gray-600">
                                {filteredResponses.length} {getText('responses', 'respons')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={exportToCSV}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            <FileDown className="h-5 w-5" />
                            <span>CSV</span>
                        </button>
                        <button
                            onClick={exportToPDF}
                            disabled={exporting}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            {exporting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                            <span>PDF</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6">
                    <div className="flex flex-wrap gap-4">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={getText('Search by name or email...', 'Cari nama atau email...')}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Department Filter */}
                        <div>
                            <select
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">{getText('All Departments', 'Semua Departemen')}</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Study Program Filter */}
                        <div>
                            <select
                                value={studyProgramFilter}
                                onChange={(e) => setStudyProgramFilter(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">{getText('All Study Programs', 'Semua Prodi')}</option>
                                {studyPrograms.map((prodi) => (
                                    <option key={prodi.id} value={prodi.id}>{prodi.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Refresh */}
                        <button
                            onClick={loadData}
                            className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            <RefreshCw className="h-5 w-5 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Responses Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {filteredResponses.length === 0 ? (
                        <div className="p-12 text-center">
                            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {responses.length === 0
                                    ? getText('No responses yet', 'Belum ada respons')
                                    : getText('No matching responses', 'Tidak ada respons yang cocok')}
                            </h3>
                            <p className="text-gray-600">
                                {responses.length === 0
                                    ? getText('Share your form to start collecting responses', 'Bagikan formulir Anda untuk mulai mengumpulkan respons')
                                    : getText('Try adjusting your filters', 'Coba sesuaikan filter Anda')}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">No</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">{getText('Name', 'Nama')}</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">{getText('Submitted', 'Waktu')}</th>
                                        {displayFields.map((field) => (
                                            <th key={field.id} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase truncate max-w-[150px]">
                                                {field.label}
                                            </th>
                                        ))}
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">{getText('Actions', 'Aksi')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredResponses.map((response, index) => (
                                        <tr key={response.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {response.respondent_name || response.respondent?.full_name || '-'}
                                                </div>
                                                {response.respondent_email && (
                                                    <div className="text-xs text-gray-500">{response.respondent_email}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {format(new Date(response.submitted_at), 'dd MMM yyyy, HH:mm')}
                                            </td>
                                            {displayFields.map((field) => (
                                                <td key={field.id} className="px-6 py-4 text-sm text-gray-600 max-w-[200px]">
                                                    {field.field_type === 'signature' && getSignatureData(response, field.id) ? (
                                                        <img
                                                            src={getSignatureData(response, field.id) || ''}
                                                            alt="Signature"
                                                            loading="lazy"
                                                            className="h-8 w-auto max-w-[100px] object-contain"
                                                        />
                                                    ) : (
                                                        <span className="truncate">{getFieldValue(response, field.id)}</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button
                                                        onClick={() => setSelectedResponse(response)}
                                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(response.id)}
                                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Response Detail Modal */}
                {selectedResponse && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {getText('Response Details', 'Detail Respons')}
                                </h3>
                                <button
                                    onClick={() => setSelectedResponse(null)}
                                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                                <div className="space-y-4">
                                    {fields
                                        .filter(f => !['header', 'paragraph'].includes(f.field_type))
                                        .map((field) => {
                                            const valueObj = selectedResponse.values?.find(v => v.field_id === field.id);
                                            return (
                                                <div key={field.id} className="border-b border-gray-100 pb-4">
                                                    <p className="text-sm font-medium text-gray-700 mb-1">{field.label}</p>
                                                    {field.field_type === 'signature' && valueObj?.signature_data ? (
                                                        <img
                                                            src={valueObj.signature_data}
                                                            alt="Signature"
                                                            className="max-w-xs border border-gray-200 rounded"
                                                        />
                                                    ) : (
                                                        <p className="text-gray-900">{getFieldValue(selectedResponse, field.id)}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500">
                                    <p>{getText('Submitted on', 'Dikirim pada')}: {format(new Date(selectedResponse.submitted_at), 'dd MMMM yyyy, HH:mm')}</p>
                                    {selectedResponse.department?.name && (
                                        <p>{getText('Department', 'Departemen')}: {selectedResponse.department.name}</p>
                                    )}
                                    {selectedResponse.study_program?.name && (
                                        <p>{getText('Study Program', 'Program Studi')}: {selectedResponse.study_program.name}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {getText('Delete Response?', 'Hapus Respons?')}
                            </h3>
                            <p className="text-gray-600 mb-6">
                                {getText('This action cannot be undone.', 'Tindakan ini tidak dapat dibatalkan.')}
                            </p>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    {getText('Cancel', 'Batal')}
                                </button>
                                <button
                                    onClick={() => handleDelete(showDeleteConfirm)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    {getText('Delete', 'Hapus')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FormResponses;
