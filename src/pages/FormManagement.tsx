import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    FileText,
    Plus,
    Search,
    Edit,
    Trash2,
    Eye,
    Copy,
    ToggleLeft,
    ToggleRight,
    Calendar,
    Users,
    BarChart2,
    ExternalLink,
    RefreshCw,
    Filter,
    MoreVertical,
    ChevronDown,
    Share2,
    Settings,
    Palette,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { Form } from '../types/form';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface FormWithStats extends Form {
    response_count?: number;
    creator?: {
        full_name: string;
    };
    department?: {
        name: string;
    };
    study_program?: {
        name: string;
    };
}

const FormManagement: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();
    const navigate = useNavigate();

    const [forms, setForms] = useState<FormWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Fetch forms
    const fetchForms = useCallback(async () => {
        try {
            setLoading(true);

            let query = supabase
                .from('forms')
                .select(`
          *,
          creator:users!created_by(full_name),
          department:departments(name),
          study_program:study_programs(name)
        `)
                .order('created_at', { ascending: false });

            // Filter by department for department_admin
            if (profile?.role === 'department_admin' && profile.department_id) {
                query = query.eq('department_id', profile.department_id);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Fetch response counts
            const formsWithCounts = await Promise.all(
                (data || []).map(async (form) => {
                    const { count } = await supabase
                        .from('form_responses')
                        .select('id', { count: 'exact', head: true })
                        .eq('form_id', form.id);

                    return {
                        ...form,
                        response_count: count || 0,
                    };
                })
            );

            setForms(formsWithCounts);
        } catch (error: any) {
            toast.error(getText('Failed to load forms', 'Gagal memuat formulir'));
        } finally {
            setLoading(false);
        }
    }, [profile, getText]);

    useEffect(() => {
        if (profile) {
            fetchForms();
        }
    }, [profile, fetchForms]);

    // Filter forms
    const filteredForms = useMemo(() => {
        return forms.filter((form) => {
            const matchesSearch =
                form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                form.description?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && form.is_active) ||
                (statusFilter === 'inactive' && !form.is_active);

            return matchesSearch && matchesStatus;
        });
    }, [forms, searchTerm, statusFilter]);

    // Toggle form active status
    const handleToggleActive = async (formId: string, currentStatus: boolean) => {
        try {
            setProcessingId(formId);

            const { error } = await supabase
                .from('forms')
                .update({ is_active: !currentStatus })
                .eq('id', formId);

            if (error) throw error;

            setForms((prev) =>
                prev.map((f) => (f.id === formId ? { ...f, is_active: !currentStatus } : f))
            );

            toast.success(
                !currentStatus
                    ? getText('Form activated', 'Formulir diaktifkan')
                    : getText('Form deactivated', 'Formulir dinonaktifkan')
            );
        } catch (error: any) {
            toast.error(getText('Failed to update form', 'Gagal memperbarui formulir'));
        } finally {
            setProcessingId(null);
        }
    };

    // Delete form
    const handleDelete = async (formId: string) => {
        try {
            setProcessingId(formId);

            const { error } = await supabase.from('forms').delete().eq('id', formId);

            if (error) throw error;

            setForms((prev) => prev.filter((f) => f.id !== formId));
            setShowDeleteConfirm(null);
            toast.success(getText('Form deleted', 'Formulir dihapus'));
        } catch (error: any) {
            toast.error(getText('Failed to delete form', 'Gagal menghapus formulir'));
        } finally {
            setProcessingId(null);
        }
    };

    // Duplicate form
    const handleDuplicate = async (form: FormWithStats) => {
        try {
            setProcessingId(form.id);

            // Create new form
            const { data: newForm, error: formError } = await supabase
                .from('forms')
                .insert({
                    title: `${form.title} (Copy)`,
                    description: form.description,
                    header_image: form.header_image,
                    theme_color: form.theme_color,
                    is_active: false,
                    is_public: form.is_public,
                    created_by: profile?.id,
                    department_id: form.department_id,
                    study_program_id: form.study_program_id,
                    settings: form.settings,
                })
                .select()
                .single();

            if (formError) throw formError;

            // Copy fields
            const { data: fields } = await supabase
                .from('form_fields')
                .select('*')
                .eq('form_id', form.id)
                .order('field_order');

            if (fields && fields.length > 0) {
                const newFields = fields.map(({ id, form_id, created_at, ...field }) => ({
                    ...field,
                    form_id: newForm.id,
                }));

                await supabase.from('form_fields').insert(newFields);
            }

            toast.success(getText('Form duplicated', 'Formulir diduplikasi'));
            fetchForms();
        } catch (error: any) {
            toast.error(getText('Failed to duplicate form', 'Gagal menduplikasi formulir'));
        } finally {
            setProcessingId(null);
        }
    };

    // Copy share link
    const copyShareLink = (form: FormWithStats) => {
        const code = form.code || form.id;
        const url = `${window.location.origin}/#/form/${code}`;
        navigator.clipboard.writeText(url);
        toast.success(getText('Link copied to clipboard', 'Link disalin ke clipboard'));
    };

    // Access control
    const hasAccess = profile && ['super_admin', 'department_admin'].includes(profile.role);

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {getText('Access Denied', 'Akses Ditolak')}
                    </h2>
                    <p className="text-gray-600">
                        {getText(
                            'You do not have permission to access this page.',
                            'Anda tidak memiliki izin untuk mengakses halaman ini.'
                        )}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
                            <FileText className="h-8 w-8 mr-3 text-blue-600" />
                            {getText('Form Management', 'Manajemen Formulir')}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {getText('Create and manage dynamic forms', 'Buat dan kelola formulir dinamis')}
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/form-builder')}
                        className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        <Plus className="h-5 w-5" />
                        <span>{getText('Create Form', 'Buat Formulir')}</span>
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{getText('Total Forms', 'Total Formulir')}</p>
                                <p className="text-2xl font-bold text-gray-900">{forms.length}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-xl">
                                <FileText className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{getText('Active Forms', 'Formulir Aktif')}</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {forms.filter((f) => f.is_active).length}
                                </p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-xl">
                                <ToggleRight className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">{getText('Total Responses', 'Total Respons')}</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {forms.reduce((sum, f) => sum + (f.response_count || 0), 0)}
                                </p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-xl">
                                <Users className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={getText('Search forms...', 'Cari formulir...')}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center space-x-2">
                            <Filter className="h-5 w-5 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">{getText('All Status', 'Semua Status')}</option>
                                <option value="active">{getText('Active', 'Aktif')}</option>
                                <option value="inactive">{getText('Inactive', 'Nonaktif')}</option>
                            </select>
                        </div>

                        {/* Refresh */}
                        <button
                            onClick={fetchForms}
                            disabled={loading}
                            className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <RefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Forms List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : filteredForms.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {forms.length === 0
                                ? getText('No forms yet', 'Belum ada formulir')
                                : getText('No forms found', 'Formulir tidak ditemukan')}
                        </h3>
                        <p className="text-gray-600 mb-6">
                            {forms.length === 0
                                ? getText('Create your first form to get started', 'Buat formulir pertama Anda untuk memulai')
                                : getText('Try adjusting your search or filters', 'Coba sesuaikan pencarian atau filter')}
                        </p>
                        {forms.length === 0 && (
                            <button
                                onClick={() => navigate('/form-builder')}
                                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="h-5 w-5" />
                                <span>{getText('Create Form', 'Buat Formulir')}</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredForms.map((form) => (
                            <div
                                key={form.id}
                                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                            >
                                {/* Theme Color Bar */}
                                <div
                                    className="h-2"
                                    style={{ backgroundColor: form.theme_color || '#3b82f6' }}
                                />

                                {/* Card Content */}
                                <div className="p-5">
                                    {/* Title & Status */}
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
                                            {form.title}
                                        </h3>
                                        <span
                                            className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${form.is_active
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                                }`}
                                        >
                                            {form.is_active
                                                ? getText('Active', 'Aktif')
                                                : getText('Inactive', 'Nonaktif')}
                                        </span>
                                    </div>

                                    {/* Description */}
                                    {form.description && (
                                        <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                                            {form.description}
                                        </p>
                                    )}

                                    {/* Stats */}
                                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                                        <div className="flex items-center">
                                            <Users className="h-4 w-4 mr-1" />
                                            {form.response_count} {getText('responses', 'respons')}
                                        </div>
                                        <div className="flex items-center">
                                            <Calendar className="h-4 w-4 mr-1" />
                                            {format(new Date(form.created_at), 'dd MMM yyyy')}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                        <div className="flex items-center space-x-1">
                                            {/* Toggle Active */}
                                            <button
                                                onClick={() => handleToggleActive(form.id, form.is_active)}
                                                disabled={processingId === form.id}
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title={form.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                                {form.is_active ? (
                                                    <ToggleRight className="h-5 w-5 text-green-600" />
                                                ) : (
                                                    <ToggleLeft className="h-5 w-5" />
                                                )}
                                            </button>

                                            {/* Edit */}
                                            <button
                                                onClick={() => navigate(`/form-builder/${form.id}`)}
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="h-5 w-5" />
                                            </button>

                                            {/* View Responses */}
                                            <button
                                                onClick={() => navigate(`/form-responses/${form.id}`)}
                                                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                title="View Responses"
                                            >
                                                <BarChart2 className="h-5 w-5" />
                                            </button>

                                            {/* Share Link */}
                                            <button
                                                onClick={() => copyShareLink(form)}
                                                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                title="Copy Link"
                                            >
                                                <Share2 className="h-5 w-5" />
                                            </button>
                                        </div>

                                        <div className="flex items-center space-x-1">
                                            {/* Duplicate */}
                                            <button
                                                onClick={() => handleDuplicate(form)}
                                                disabled={processingId === form.id}
                                                className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                title="Duplicate"
                                            >
                                                <Copy className="h-5 w-5" />
                                            </button>

                                            {/* Delete */}
                                            <button
                                                onClick={() => setShowDeleteConfirm(form.id)}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {getText('Delete Form?', 'Hapus Formulir?')}
                            </h3>
                            <p className="text-gray-600 mb-6">
                                {getText(
                                    'This will permanently delete the form and all its responses. This action cannot be undone.',
                                    'Ini akan menghapus formulir dan semua responsnya secara permanen. Tindakan ini tidak dapat dibatalkan.'
                                )}
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
                                    disabled={processingId === showDeleteConfirm}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                                >
                                    {processingId === showDeleteConfirm && (
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    )}
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

export default FormManagement;
