import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    Save,
    Eye,
    ArrowLeft,
    Plus,
    Trash2,
    GripVertical,
    Settings,
    Type,
    AlignLeft,
    Hash,
    Mail,
    Phone,
    Calendar,
    Clock,
    ChevronDown,
    CheckSquare,
    Circle,
    PenTool,
    Image,
    Heading,
    FileText,
    Palette,
    RefreshCw,
    Copy,
    AlertCircle,
    X,
    ChevronUp,
    Link,
    HelpCircle,
    Upload,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import {
    Form,
    FormField,
    FieldType,
    FieldOption,
    FieldDataSource,
    FieldCondition,
    CreateFormInput,
    CreateFormFieldInput,
} from '../types/form';
import toast from 'react-hot-toast';

// Field type configurations
const FIELD_TYPES: {
    type: FieldType;
    label: string;
    labelId: string;
    icon: React.ComponentType<any>;
    category: 'input' | 'choice' | 'special';
}[] = [
        { type: 'text', label: 'Short Text', labelId: 'Teks Pendek', icon: Type, category: 'input' },
        { type: 'textarea', label: 'Long Text', labelId: 'Teks Panjang', icon: AlignLeft, category: 'input' },
        { type: 'number', label: 'Number', labelId: 'Angka', icon: Hash, category: 'input' },
        { type: 'email', label: 'Email', labelId: 'Email', icon: Mail, category: 'input' },
        { type: 'phone', label: 'Phone', labelId: 'Telepon', icon: Phone, category: 'input' },
        { type: 'date', label: 'Date', labelId: 'Tanggal', icon: Calendar, category: 'input' },
        { type: 'time', label: 'Time', labelId: 'Waktu', icon: Clock, category: 'input' },
        { type: 'dropdown', label: 'Dropdown', labelId: 'Dropdown', icon: ChevronDown, category: 'choice' },
        { type: 'checkbox', label: 'Checkbox', labelId: 'Kotak Centang', icon: CheckSquare, category: 'choice' },
        { type: 'radio', label: 'Radio Button', labelId: 'Pilihan Tunggal', icon: Circle, category: 'choice' },
        { type: 'signature', label: 'Signature', labelId: 'Tanda Tangan', icon: PenTool, category: 'special' },
        { type: 'header', label: 'Header', labelId: 'Judul Seksi', icon: Heading, category: 'special' },
        { type: 'paragraph', label: 'Paragraph', labelId: 'Paragraf', icon: FileText, category: 'special' },
    ];

// Data source options with multi-role support
const DATA_SOURCES = [
    // Single role options
    { table: 'users', filter: { role: 'lecturer' }, label: 'Dosen', displayField: 'full_name' },
    { table: 'users', filter: { role: 'staff' }, label: 'Tenaga Kependidikan (Staff)', displayField: 'full_name' },
    { table: 'users', filter: { role: 'student' }, label: 'Mahasiswa', displayField: 'full_name' },
    { table: 'users', filter: { role: 'laboratory' }, label: 'Laboran', displayField: 'full_name' },
    { table: 'users', filter: { role: 'super_admin' }, label: 'Super Admin', displayField: 'full_name' },
    { table: 'users', filter: { role: 'department_admin' }, label: 'Admin Departemen', displayField: 'full_name' },

    // Combined role options
    { table: 'users', filter: { role: ['lecturer', 'staff'] }, label: 'Dosen + Staff', displayField: 'full_name' },
    { table: 'users', filter: { role: ['lecturer', 'staff', 'super_admin'] }, label: 'Dosen + Staff + Admin', displayField: 'full_name' },
    { table: 'users', filter: { role: ['lecturer', 'staff', 'laboratory'] }, label: 'Dosen + Staff + Laboran', displayField: 'full_name' },
    { table: 'users', filter: { role: ['super_admin', 'department_admin'] }, label: 'Semua Admin', displayField: 'full_name' },
    { table: 'users', filter: {}, label: 'Semua Pengguna', displayField: 'full_name' },

    // Other tables
    { table: 'departments', filter: {}, label: 'Departemen', displayField: 'name' },
    { table: 'study_programs', filter: {}, label: 'Program Studi', displayField: 'name' },
];

// Theme colors
const THEME_COLORS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
];

interface LocalField extends Omit<FormField, 'id' | 'form_id' | 'created_at'> {
    id: string; // temporary ID for new fields
    isNew?: boolean;
}

const FormBuilder: React.FC = () => {
    // Ref untuk file input import Excel
    const excelImportRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // Handler import dari Excel untuk dropdown field
    const handleExcelImport = (fieldId: string, fieldLabel: string, file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

                if (jsonData.length === 0) {
                    toast.error('File Excel kosong atau tidak dapat dibaca');
                    return;
                }

                // Cari kolom yang namanya sama (case-insensitive) dengan label field
                const headers = Object.keys(jsonData[0]);
                const matchedHeader = headers.find(
                    (h) => h.trim().toLowerCase() === fieldLabel.trim().toLowerCase()
                );

                if (!matchedHeader) {
                    toast.error(
                        `Kolom "${fieldLabel}" tidak ditemukan di Excel.\nKolom tersedia: ${headers.join(', ')}`
                    );
                    return;
                }

                // Ambil nilai unik dan non-kosong dari kolom tersebut
                const uniqueValues = Array.from(
                    new Set(
                        jsonData
                            .map((row) => String(row[matchedHeader]).trim())
                            .filter((v) => v !== '' && v !== 'undefined' && v !== 'null')
                    )
                );

                if (uniqueValues.length === 0) {
                    toast.error(`Kolom "${matchedHeader}" tidak memiliki nilai yang valid`);
                    return;
                }

                // Buat opsi dari nilai unik
                const newOptions: FieldOption[] = uniqueValues.map((v) => ({
                    value: v,
                    label: v,
                }));

                updateField(fieldId, { options: newOptions });
                toast.success(
                    `${newOptions.length} opsi berhasil diimpor dari kolom "${matchedHeader}"`
                );
            } catch (err) {
                console.error('Excel import error:', err);
                toast.error('Gagal membaca file Excel. Pastikan format file benar.');
            }
        };
        reader.readAsBinaryString(file);
    };
    const { id: formId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { getText } = useLanguage();

    const isEditing = !!formId;

    // Form state
    const [formData, setFormData] = useState<CreateFormInput>({
        code: '',
        title: '',
        description: '',
        header_image: '',
        theme_color: '#3b82f6',
        is_active: true,
        is_public: true,
    });

    // Fields state
    const [fields, setFields] = useState<LocalField[]>([]);

    // UI state
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [showThemePicker, setShowThemePicker] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Load form data if editing
    useEffect(() => {
        if (isEditing && formId) {
            loadForm();
        }
    }, [formId, isEditing]);

    const loadForm = async () => {
        try {
            setLoading(true);

            // Load form
            const { data: form, error: formError } = await supabase
                .from('forms')
                .select('*')
                .eq('id', formId)
                .single();

            if (formError) throw formError;

            setFormData({
                code: form.code || '',
                title: form.title,
                description: form.description || '',
                header_image: form.header_image || '',
                theme_color: form.theme_color || '#3b82f6',
                is_active: form.is_active,
                is_public: form.is_public,
                department_id: form.department_id,
                study_program_id: form.study_program_id,
                settings: form.settings,
            });

            // Load fields
            const { data: formFields, error: fieldsError } = await supabase
                .from('form_fields')
                .select('*')
                .eq('form_id', formId)
                .order('field_order');

            if (fieldsError) throw fieldsError;

            setFields(
                formFields.map((f) => ({
                    ...f,
                    isNew: false,
                }))
            );
        } catch (error: any) {
            console.error('Error loading form:', error);
            toast.error(getText('Failed to load form', 'Gagal memuat formulir'));
            navigate('/forms');
        } finally {
            setLoading(false);
        }
    };

    // Add new field
    const addField = (type: FieldType) => {
        const newField: LocalField = {
            id: `new-${Date.now()}`,
            field_type: type,
            label: FIELD_TYPES.find((t) => t.type === type)?.label || 'New Field',
            placeholder: '',
            helper_text: '',
            is_required: false,
            options: type === 'dropdown' || type === 'checkbox' || type === 'radio'
                ? [{ value: 'option1', label: 'Option 1' }]
                : null,
            data_source: null,
            validation: null,
            field_order: fields.length,
            settings: {},
            isNew: true,
        };

        setFields([...fields, newField]);
        setSelectedFieldId(newField.id);
    };

    // Update field
    const updateField = (id: string, updates: Partial<LocalField>) => {
        setFields((prev) =>
            prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
        );
    };

    // Delete field
    const deleteField = (id: string) => {
        setFields((prev) => prev.filter((f) => f.id !== id));
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

    // Duplicate field
    const duplicateField = (id: string) => {
        const field = fields.find((f) => f.id === id);
        if (!field) return;

        const newField: LocalField = {
            ...field,
            id: `new-${Date.now()}`,
            label: `${field.label} (Copy)`,
            field_order: fields.length,
            isNew: true,
        };

        setFields([...fields, newField]);
    };

    // Reorder fields (drag & drop)
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newFields = [...fields];
        const draggedField = newFields[draggedIndex];
        newFields.splice(draggedIndex, 1);
        newFields.splice(index, 0, draggedField);

        // Update field_order
        newFields.forEach((f, i) => {
            f.field_order = i;
        });

        setFields(newFields);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    // Add option to field (for dropdown/checkbox/radio)
    const addOption = (fieldId: string) => {
        const field = fields.find((f) => f.id === fieldId);
        if (!field) return;

        const options = field.options || [];
        const newOption: FieldOption = {
            value: `option${options.length + 1}`,
            label: `Option ${options.length + 1}`,
        };

        updateField(fieldId, { options: [...options, newOption] });
    };

    // Update option - keep value same as label for consistency
    const updateOption = (fieldId: string, optionIndex: number, label: string) => {
        const field = fields.find((f) => f.id === fieldId);
        if (!field || !field.options) return;

        const newOptions = [...field.options];
        newOptions[optionIndex] = {
            ...newOptions[optionIndex],
            label,
            value: label, // Use exact label as value, not slug
        };

        updateField(fieldId, { options: newOptions });
    };

    // Delete option
    const deleteOption = (fieldId: string, optionIndex: number) => {
        const field = fields.find((f) => f.id === fieldId);
        if (!field || !field.options || field.options.length <= 1) return;

        const newOptions = field.options.filter((_, i) => i !== optionIndex);
        updateField(fieldId, { options: newOptions });
    };

    // Save form
    const handleSave = async () => {
        if (!formData.title.trim()) {
            toast.error(getText('Form title is required', 'Judul formulir wajib diisi'));
            return;
        }

        try {
            setSaving(true);

            let savedFormId = formId;

            if (isEditing) {
                // Update existing form
                const { error } = await supabase
                    .from('forms')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', formId);

                if (error) throw error;

                // Delete existing fields and re-insert (simpler approach)
                await supabase.from('form_fields').delete().eq('form_id', formId);
            } else {
                // Create new form
                const { data: newForm, error } = await supabase
                    .from('forms')
                    .insert({
                        ...formData,
                        created_by: profile?.id,
                        department_id: profile?.department_id || null,
                    })
                    .select()
                    .single();

                if (error) throw error;
                savedFormId = newForm.id;
            }

            // Insert fields with ID mapping for conditions
            if (fields.length > 0 && savedFormId) {
                // Create fields without IDs (let database generate them)
                const fieldsToInsert = fields.map(({ id, isNew, ...field }, index) => ({
                    ...field,
                    form_id: savedFormId,
                    field_order: index,
                    // Temporarily clear settings.conditions as we need to fix IDs
                    settings: field.settings ? { ...field.settings, conditions: undefined } : null,
                }));

                // Insert and get back the new IDs
                const { data: insertedFields, error: fieldsError } = await supabase
                    .from('form_fields')
                    .insert(fieldsToInsert)
                    .select('id, field_order');

                if (fieldsError) throw fieldsError;

                // Create mapping from old (temp) IDs to new (database) IDs using field_order
                const idMapping: Record<string, string> = {};
                fields.forEach((oldField, index) => {
                    const newField = insertedFields?.find(f => f.field_order === index);
                    if (newField) {
                        idMapping[oldField.id] = newField.id;
                    }
                });

                // Now update fields with corrected condition triggerFieldIds
                for (const oldField of fields) {
                    const conditions = oldField.settings?.conditions;
                    if (conditions && conditions.length > 0) {
                        // Map old triggerFieldIds to new ones
                        const updatedConditions = conditions.map(cond => ({
                            ...cond,
                            triggerFieldId: idMapping[cond.triggerFieldId] || cond.triggerFieldId,
                        }));

                        // Update this field with corrected conditions
                        const newFieldId = idMapping[oldField.id];
                        if (newFieldId) {
                            await supabase
                                .from('form_fields')
                                .update({
                                    settings: {
                                        ...oldField.settings,
                                        conditions: updatedConditions
                                    }
                                })
                                .eq('id', newFieldId);
                        }
                    }
                }
            }

            toast.success(
                isEditing
                    ? getText('Form updated successfully', 'Formulir berhasil diperbarui')
                    : getText('Form created successfully', 'Formulir berhasil dibuat')
            );

            navigate('/forms');
        } catch (error: any) {
            console.error('Error saving form:', error);
            toast.error(getText('Failed to save form', 'Gagal menyimpan formulir'));
        } finally {
            setSaving(false);
        }
    };

    // Selected field for editing
    const selectedField = fields.find((f) => f.id === selectedFieldId);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Back & Title */}
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => navigate('/forms')}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder={getText('Untitled Form', 'Formulir Tanpa Judul')}
                                className="text-xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 placeholder-gray-400"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2">
                            {/* Theme Picker */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowThemePicker(!showThemePicker)}
                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                    style={{ color: formData.theme_color }}
                                >
                                    <Palette className="h-5 w-5" />
                                </button>
                                {showThemePicker && (
                                    <div className="absolute right-0 mt-2 p-3 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                                        <p className="text-sm font-medium text-gray-700 mb-2">Theme Color</p>
                                        <div className="grid grid-cols-5 gap-2">
                                            {THEME_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => {
                                                        setFormData({ ...formData, theme_color: color });
                                                        setShowThemePicker(false);
                                                    }}
                                                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${formData.theme_color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                                                        }`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Preview */}
                            <button
                                onClick={() => window.open(`/form/${formId || 'preview'}`, '_blank')}
                                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                <Eye className="h-5 w-5" />
                                <span className="hidden sm:inline">{getText('Preview', 'Pratinjau')}</span>
                            </button>

                            {/* Save */}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? (
                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Save className="h-5 w-5" />
                                )}
                                <span>{getText('Save', 'Simpan')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex gap-6">
                    {/* Field Palette (Left Sidebar) */}
                    <div className="w-64 flex-shrink-0">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-24">
                            <h3 className="font-semibold text-gray-900 mb-4">
                                {getText('Add Field', 'Tambah Field')}
                            </h3>

                            {/* Input Fields */}
                            <div className="mb-4">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                                    {getText('Input', 'Input')}
                                </p>
                                <div className="space-y-1">
                                    {FIELD_TYPES.filter((f) => f.category === 'input').map((fieldType) => {
                                        const Icon = fieldType.icon;
                                        return (
                                            <button
                                                key={fieldType.type}
                                                onClick={() => addField(fieldType.type)}
                                                className="w-full flex items-center space-x-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span>{getText(fieldType.label, fieldType.labelId)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Choice Fields */}
                            <div className="mb-4">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                                    {getText('Choice', 'Pilihan')}
                                </p>
                                <div className="space-y-1">
                                    {FIELD_TYPES.filter((f) => f.category === 'choice').map((fieldType) => {
                                        const Icon = fieldType.icon;
                                        return (
                                            <button
                                                key={fieldType.type}
                                                onClick={() => addField(fieldType.type)}
                                                className="w-full flex items-center space-x-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span>{getText(fieldType.label, fieldType.labelId)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Special Fields */}
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                                    {getText('Special', 'Spesial')}
                                </p>
                                <div className="space-y-1">
                                    {FIELD_TYPES.filter((f) => f.category === 'special').map((fieldType) => {
                                        const Icon = fieldType.icon;
                                        return (
                                            <button
                                                key={fieldType.type}
                                                onClick={() => addField(fieldType.type)}
                                                className="w-full flex items-center space-x-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span>{getText(fieldType.label, fieldType.labelId)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Canvas (Center) */}
                    <div className="flex-1">
                        {/* Form Header */}
                        <div
                            className="bg-white rounded-xl shadow-sm border-t-4 overflow-hidden mb-4"
                            style={{ borderTopColor: formData.theme_color }}
                        >
                            <div className="p-6">
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder={getText('Form Title', 'Judul Formulir')}
                                    className="w-full text-2xl font-bold text-gray-900 border-none focus:outline-none focus:ring-0 placeholder-gray-400 mb-2"
                                />
                                <textarea
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={getText('Form description (optional)', 'Deskripsi formulir (opsional)')}
                                    className="w-full text-gray-600 border-none focus:outline-none focus:ring-0 placeholder-gray-400 resize-none"
                                    rows={2}
                                />

                                {/* Form Code for Share Link */}
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {getText('Form Code (for short URL)', 'Kode Form (untuk URL pendek)')}
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-gray-500 text-sm">{window.location.origin}/#/form/</span>
                                        <input
                                            type="text"
                                            value={formData.code || ''}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                                            placeholder="presensi-rg"
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {getText('Only lowercase letters, numbers, and dashes. Leave empty to use form ID.', 'Hanya huruf kecil, angka, dan strip. Kosongkan untuk menggunakan ID form.')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Fields List */}
                        {fields.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
                                <Plus className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">
                                    {getText('Click a field type from the left panel to add it', 'Klik tipe field dari panel kiri untuk menambahkan')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {fields.map((field, index) => {
                                    const FieldIcon = FIELD_TYPES.find((t) => t.type === field.field_type)?.icon || Type;
                                    const isSelected = selectedFieldId === field.id;

                                    return (
                                        <div
                                            key={field.id}
                                            draggable
                                            onDragStart={() => handleDragStart(index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => setSelectedFieldId(field.id)}
                                            className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden cursor-pointer transition-all ${isSelected
                                                ? 'border-blue-500 ring-2 ring-blue-200'
                                                : 'border-gray-200 hover:border-gray-300'
                                                } ${draggedIndex === index ? 'opacity-50' : ''}`}
                                        >
                                            <div className="p-4">
                                                {/* Field Header */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center space-x-2">
                                                        <GripVertical className="h-5 w-5 text-gray-400 cursor-grab" />
                                                        <FieldIcon className="h-5 w-5 text-gray-500" />
                                                        <span className="text-sm text-gray-500">
                                                            {getText(
                                                                FIELD_TYPES.find((t) => t.type === field.field_type)?.label || '',
                                                                FIELD_TYPES.find((t) => t.type === field.field_type)?.labelId || ''
                                                            )}
                                                        </span>
                                                        {field.is_required && (
                                                            <span className="text-red-500 text-sm">*</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center space-x-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                duplicateField(field.id);
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteField(field.id);
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Field Content */}
                                                <div className="space-y-2">
                                                    {/* Label */}
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                        className="w-full text-lg font-medium text-gray-900 border-none focus:outline-none focus:ring-0 bg-transparent"
                                                        placeholder="Question"
                                                    />

                                                    {/* Preview based on field type */}
                                                    {['text', 'email', 'phone', 'number'].includes(field.field_type) && (
                                                        <input
                                                            type="text"
                                                            placeholder={field.placeholder || getText('Your answer', 'Jawaban Anda')}
                                                            disabled
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-400"
                                                        />
                                                    )}

                                                    {field.field_type === 'textarea' && (
                                                        <textarea
                                                            placeholder={field.placeholder || getText('Your answer', 'Jawaban Anda')}
                                                            disabled
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-400 resize-none"
                                                            rows={3}
                                                        />
                                                    )}

                                                    {field.field_type === 'date' && (
                                                        <input
                                                            type="date"
                                                            disabled
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-400"
                                                        />
                                                    )}

                                                    {field.field_type === 'time' && (
                                                        <input
                                                            type="time"
                                                            disabled
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-400"
                                                        />
                                                    )}

                                                    {['dropdown', 'checkbox', 'radio'].includes(field.field_type) && (
                                                        <div className="space-y-2 mt-2">
                                                            {(field.options || []).map((option, optIndex) => (
                                                                <div key={optIndex} className="flex items-center space-x-2">
                                                                    {field.field_type === 'checkbox' && (
                                                                        <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                                                                    )}
                                                                    {field.field_type === 'radio' && (
                                                                        <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                                                                    )}
                                                                    {field.field_type === 'dropdown' && (
                                                                        <span className="text-gray-400 text-sm">{optIndex + 1}.</span>
                                                                    )}
                                                                    <input
                                                                        type="text"
                                                                        value={option.label}
                                                                        onChange={(e) => updateOption(field.id, optIndex, e.target.value)}
                                                                        className="flex-1 px-2 py-1 text-sm border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                                                                    />
                                                                    {(field.options?.length || 0) > 1 && (
                                                                        <button
                                                                            onClick={() => deleteOption(field.id, optIndex)}
                                                                            className="p-1 text-gray-400 hover:text-red-500"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <button
                                                                    onClick={() => addOption(field.id)}
                                                                    className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                    <span>{getText('Add option', 'Tambah opsi')}</span>
                                                                </button>

                                                                {/* Import dari Excel */}
                                                                {field.field_type === 'dropdown' && (
                                                                    <>
                                                                        <input
                                                                            type="file"
                                                                            accept=".xlsx,.xls"
                                                                            ref={(el) => { excelImportRefs.current[field.id] = el; }}
                                                                            style={{ display: 'none' }}
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) {
                                                                                    handleExcelImport(field.id, field.label, file);
                                                                                }
                                                                                e.target.value = '';
                                                                            }}
                                                                        />
                                                                        <button
                                                                            onClick={() => excelImportRefs.current[field.id]?.click()}
                                                                            className="flex items-center space-x-1 text-sm text-emerald-600 hover:text-emerald-700"
                                                                            title={`Import opsi dari kolom "${field.label}" di file Excel`}
                                                                        >
                                                                            <Upload className="h-4 w-4" />
                                                                            <span>Import dari Excel</span>
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {field.field_type === 'signature' && (
                                                        <div className="w-full h-24 border border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                                                            <PenTool className="h-6 w-6 mr-2" />
                                                            {getText('Signature pad', 'Area tanda tangan')}
                                                        </div>
                                                    )}

                                                    {field.field_type === 'header' && (
                                                        <div className="text-xl font-bold text-gray-900">{field.label}</div>
                                                    )}

                                                    {field.field_type === 'paragraph' && (
                                                        <div className="text-gray-600">{field.label}</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Field Footer */}
                                            {isSelected && (
                                                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                                    <div className="flex items-center space-x-4">
                                                        {/* Required toggle */}
                                                        <label className="flex items-center space-x-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={field.is_required}
                                                                onChange={(e) => updateField(field.id, { is_required: e.target.checked })}
                                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm text-gray-600">{getText('Required', 'Wajib')}</span>
                                                        </label>

                                                        {/* Data Source (for dropdown) */}
                                                        {field.field_type === 'dropdown' && (
                                                            <div className="flex items-center space-x-2">
                                                                <Link className="h-4 w-4 text-gray-400" />
                                                                <select
                                                                    value={field.data_source ? JSON.stringify(field.data_source) : ''}
                                                                    onChange={(e) => {
                                                                        const ds = e.target.value ? JSON.parse(e.target.value) : null;
                                                                        // Keep manual options - don't clear them!
                                                                        updateField(field.id, { data_source: ds });
                                                                    }}
                                                                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                >
                                                                    <option value="">{getText('Manual only', 'Hanya manual')}</option>
                                                                    {DATA_SOURCES.map((ds, i) => (
                                                                        <option key={i} value={JSON.stringify(ds)}>
                                                                            {ds.label} {field.options && field.options.length > 0 ? '+ Manual' : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Field Settings (Right Sidebar) - Optional */}
                    {selectedField && (
                        <div className="w-72 flex-shrink-0">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-24">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-gray-900">
                                        {getText('Field Settings', 'Pengaturan Field')}
                                    </h3>
                                    <button
                                        onClick={() => setSelectedFieldId(null)}
                                        className="p-1 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Placeholder */}
                                    {['text', 'textarea', 'email', 'phone', 'number'].includes(selectedField.field_type) && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {getText('Placeholder', 'Placeholder')}
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedField.placeholder || ''}
                                                onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}

                                    {/* Helper Text */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {getText('Helper Text', 'Teks Bantuan')}
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedField.helper_text || ''}
                                            onChange={(e) => updateField(selectedField.id, { helper_text: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* Conditional Logic */}
                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium text-gray-700">
                                                {getText('Conditional Logic', 'Logika Kondisi')}
                                            </label>
                                            <HelpCircle className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">
                                            {getText('Show this field based on answers to other fields', 'Tampilkan field ini berdasarkan jawaban field lain')}
                                        </p>
                                        <button
                                            onClick={() => {
                                                const conditions = selectedField.settings?.conditions || [];
                                                updateField(selectedField.id, {
                                                    settings: {
                                                        ...selectedField.settings,
                                                        conditions: [
                                                            ...conditions,
                                                            { triggerFieldId: '', triggerValue: '', action: 'show' },
                                                        ],
                                                    },
                                                });
                                            }}
                                            className="w-full py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                                        >
                                            + {getText('Add Condition', 'Tambah Kondisi')}
                                        </button>

                                        {/* Display conditions */}
                                        {(selectedField.settings?.conditions || []).map((cond, idx) => (
                                            <div key={idx} className="mt-2 p-2 bg-gray-50 rounded-lg text-xs">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium">Condition {idx + 1}</span>
                                                    <button
                                                        onClick={() => {
                                                            const conditions = [...(selectedField.settings?.conditions || [])];
                                                            conditions.splice(idx, 1);
                                                            updateField(selectedField.id, {
                                                                settings: { ...selectedField.settings, conditions },
                                                            });
                                                        }}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                <select
                                                    value={cond.triggerFieldId}
                                                    onChange={(e) => {
                                                        const conditions = [...(selectedField.settings?.conditions || [])];
                                                        conditions[idx] = { ...conditions[idx], triggerFieldId: e.target.value, triggerValue: '' };
                                                        updateField(selectedField.id, {
                                                            settings: { ...selectedField.settings, conditions },
                                                        });
                                                    }}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded mb-1 text-xs"
                                                >
                                                    <option value="">{getText('Select field', 'Pilih field')}</option>
                                                    {fields
                                                        .filter((f) => f.id !== selectedField.id && ['checkbox', 'radio', 'dropdown'].includes(f.field_type))
                                                        .map((f) => (
                                                            <option key={f.id} value={f.id}>{f.label}</option>
                                                        ))}
                                                </select>

                                                {/* Show trigger value dropdown based on selected trigger field */}
                                                {cond.triggerFieldId && (() => {
                                                    const triggerField = fields.find(f => f.id === cond.triggerFieldId);
                                                    const triggerOptions = triggerField?.options || [];

                                                    return triggerOptions.length > 0 ? (
                                                        <select
                                                            value={cond.triggerValue as string}
                                                            onChange={(e) => {
                                                                const conditions = [...(selectedField.settings?.conditions || [])];
                                                                conditions[idx] = { ...conditions[idx], triggerValue: e.target.value };
                                                                updateField(selectedField.id, {
                                                                    settings: { ...selectedField.settings, conditions },
                                                                });
                                                            }}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                                        >
                                                            <option value="">{getText('Select option', 'Pilih opsi')}</option>
                                                            {triggerOptions.map((opt) => (
                                                                <option key={opt.value} value={opt.label}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 italic">
                                                            {getText('Add options to trigger field first', 'Tambahkan opsi ke field pemicu')}
                                                        </p>
                                                    );
                                                })()}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FormBuilder;
