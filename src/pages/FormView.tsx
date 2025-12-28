import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FileText,
    Send,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { Form, FormField, FieldCondition } from '../types/form';
import SignatureCanvas, { SignatureCanvasRef } from '../components/SignatureCanvas';
import DynamicDropdown from '../components/DynamicDropdown';
import toast from 'react-hot-toast';

interface FormValues {
    [fieldId: string]: string | string[];
}

interface SignatureRefs {
    [fieldId: string]: SignatureCanvasRef | null;
}

const FormView: React.FC = () => {
    const { id: formId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { getText } = useLanguage();

    const [form, setForm] = useState<Form | null>(null);
    const [actualFormId, setActualFormId] = useState<string | null>(null); // Store actual UUID for submissions
    const [fields, setFields] = useState<FormField[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [values, setValues] = useState<FormValues>({});
    const [errors, setErrors] = useState<{ [fieldId: string]: string }>({});
    const signatureRefs = useRef<SignatureRefs>({});

    // Load form
    useEffect(() => {
        if (formId) {
            loadForm();
        }
    }, [formId]);

    const loadForm = async () => {
        try {
            setLoading(true);

            // Check if formId is a UUID or a code
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formId || '');

            let formData = null;

            if (isUUID) {
                // Try to load by UUID
                const { data, error } = await supabase
                    .from('forms')
                    .select('*')
                    .eq('id', formId)
                    .single();

                if (!error) formData = data;
            }

            // If not found by UUID or not a UUID, try by code
            if (!formData) {
                const { data, error } = await supabase
                    .from('forms')
                    .select('*')
                    .eq('code', formId)
                    .single();

                if (error) throw new Error('Form not found');
                formData = data;
            }

            if (!formData.is_active) {
                toast.error(getText('This form is no longer accepting responses', 'Formulir ini tidak lagi menerima respons'));
                return;
            }

            setForm(formData);
            setActualFormId(formData.id); // Store actual UUID

            // Load fields
            const { data: fieldsData, error: fieldsError } = await supabase
                .from('form_fields')
                .select('*')
                .eq('form_id', formData.id)
                .order('field_order');

            if (fieldsError) throw fieldsError;

            setFields(fieldsData || []);

            // Initialize values
            const initialValues: FormValues = {};
            fieldsData?.forEach((field) => {
                if (field.field_type === 'checkbox') {
                    initialValues[field.id] = [];
                } else {
                    initialValues[field.id] = '';
                }
            });
            setValues(initialValues);
        } catch (error: any) {
            console.error('Error loading form:', error);
            toast.error(getText('Failed to load form', 'Gagal memuat formulir'));
        } finally {
            setLoading(false);
        }
    };

    // Check if field should be visible based on conditions
    const isFieldVisible = useCallback(
        (field: FormField): boolean => {
            const conditions = field.settings?.conditions;
            if (!conditions || conditions.length === 0) return true;

            const result = conditions.every((cond: FieldCondition) => {
                const triggerValue = values[cond.triggerFieldId];
                const matchValue = cond.triggerValue;

                // Normalize values for case-insensitive comparison
                const normalize = (val: string) => val?.toString().toLowerCase().trim();

                if (Array.isArray(triggerValue)) {
                    // For checkbox: check if any selected value matches
                    if (Array.isArray(matchValue)) {
                        return matchValue.some((v) =>
                            triggerValue.some(tv => normalize(tv) === normalize(v))
                        );
                    }
                    return triggerValue.some(tv => normalize(tv) === normalize(matchValue as string));
                } else {
                    // For radio/dropdown: check match (case-insensitive)
                    if (Array.isArray(matchValue)) {
                        return matchValue.some(mv => normalize(mv) === normalize(triggerValue));
                    }
                    const matches = normalize(triggerValue) === normalize(matchValue as string);
                    // Debug log
                    console.log(`[Conditional] Field "${field.label}" - Trigger: "${triggerValue}" vs Match: "${matchValue}" = ${matches}`);
                    return matches;
                }
            });

            return result;
        },
        [values]
    );

    // Visible fields
    const visibleFields = useMemo(() => {
        return fields.filter(isFieldVisible);
    }, [fields, isFieldVisible]);

    // Update value
    const updateValue = (fieldId: string, value: string | string[]) => {
        setValues((prev) => ({ ...prev, [fieldId]: value }));
        setErrors((prev) => ({ ...prev, [fieldId]: '' }));
    };

    // Toggle checkbox value - use LABEL for storage, not value/slug
    const toggleCheckbox = (fieldId: string, optionLabel: string) => {
        const current = (values[fieldId] as string[]) || [];
        const index = current.indexOf(optionLabel);
        if (index >= 0) {
            updateValue(fieldId, current.filter((v) => v !== optionLabel));
        } else {
            updateValue(fieldId, [...current, optionLabel]);
        }
    };

    // Validate form
    const validate = (): boolean => {
        const newErrors: { [fieldId: string]: string } = {};
        let isValid = true;

        visibleFields.forEach((field) => {
            if (field.is_required) {
                const value = values[field.id];

                if (field.field_type === 'signature') {
                    const sigRef = signatureRefs.current[field.id];
                    if (!sigRef || sigRef.isEmpty()) {
                        newErrors[field.id] = getText('Signature is required', 'Tanda tangan wajib diisi');
                        isValid = false;
                    }
                } else if (field.field_type === 'checkbox') {
                    if (!Array.isArray(value) || value.length === 0) {
                        newErrors[field.id] = getText('Please select at least one option', 'Pilih minimal satu opsi');
                        isValid = false;
                    }
                } else {
                    if (!value || (typeof value === 'string' && !value.trim())) {
                        newErrors[field.id] = getText('This field is required', 'Kolom ini wajib diisi');
                        isValid = false;
                    }
                }
            }

            // Email validation
            if (field.field_type === 'email' && values[field.id]) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(values[field.id] as string)) {
                    newErrors[field.id] = getText('Invalid email address', 'Alamat email tidak valid');
                    isValid = false;
                }
            }

            // Phone validation
            if (field.field_type === 'phone' && values[field.id]) {
                const phoneRegex = /^[0-9+\-\s()]{8,}$/;
                if (!phoneRegex.test(values[field.id] as string)) {
                    newErrors[field.id] = getText('Invalid phone number', 'Nomor telepon tidak valid');
                    isValid = false;
                }
            }
        });

        setErrors(newErrors);
        return isValid;
    };

    // Submit form
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            toast.error(getText('Please fill in all required fields', 'Silakan isi semua kolom yang wajib'));
            return;
        }

        try {
            setSubmitting(true);

            // Get respondent name from form if available
            const nameField = fields.find((f) => f.field_type === 'text' && f.label.toLowerCase().includes('nama'));
            const emailField = fields.find((f) => f.field_type === 'email');
            const phoneField = fields.find((f) => f.field_type === 'phone');

            // Find dropdown with users data source to get department/study_program
            let selectedUserDepartmentId: string | null = profile?.department_id || null;
            let selectedUserStudyProgramId: string | null = profile?.study_program_id || null;

            // Look for dropdown fields with users data source
            const userDropdownField = fields.find(f =>
                f.field_type === 'dropdown' &&
                f.data_source?.table === 'users'
            );

            if (userDropdownField) {
                const selectedUserName = values[userDropdownField.id] as string;
                if (selectedUserName) {
                    // Fetch user by name to get their department/study_program
                    const { data: userData } = await supabase
                        .from('users')
                        .select('id, department_id, study_program_id')
                        .eq('full_name', selectedUserName)
                        .single();

                    if (userData) {
                        selectedUserDepartmentId = userData.department_id;
                        selectedUserStudyProgramId = userData.study_program_id;
                    }
                }
            }

            // Create response
            const { data: response, error: responseError } = await supabase
                .from('form_responses')
                .insert({
                    form_id: actualFormId,
                    respondent_id: profile?.id || null,
                    respondent_name: nameField ? (values[nameField.id] as string) : profile?.full_name || null,
                    respondent_email: emailField ? (values[emailField.id] as string) : profile?.email || null,
                    respondent_phone: phoneField ? (values[phoneField.id] as string) : null,
                    department_id: selectedUserDepartmentId,
                    study_program_id: selectedUserStudyProgramId,
                })
                .select()
                .single();

            if (responseError) throw responseError;

            // Create response values
            const responseValues = visibleFields
                .filter((f) => f.field_type !== 'header' && f.field_type !== 'paragraph')
                .map((field) => {
                    const value = values[field.id];
                    const signatureData =
                        field.field_type === 'signature' ? signatureRefs.current[field.id]?.toDataURL() : null;

                    return {
                        response_id: response.id,
                        field_id: field.id,
                        value: typeof value === 'string' ? value : null,
                        value_array: Array.isArray(value) ? value : null,
                        signature_data: signatureData || null,
                    };
                });

            const { error: valuesError } = await supabase.from('form_response_values').insert(responseValues);

            if (valuesError) throw valuesError;

            setSubmitted(true);
            toast.success(getText('Form submitted successfully', 'Formulir berhasil dikirim'));
        } catch (error: any) {
            console.error('Error submitting form:', error);
            toast.error(getText('Failed to submit form', 'Gagal mengirim formulir'));
        } finally {
            setSubmitting(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // Form not found
    if (!form) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {getText('Form Not Found', 'Formulir Tidak Ditemukan')}
                    </h2>
                    <p className="text-gray-600">
                        {getText('This form may have been deleted or is no longer available.', 'Formulir ini mungkin telah dihapus atau tidak tersedia lagi.')}
                    </p>
                </div>
            </div>
        );
    }

    // Success state
    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm max-w-md w-full p-8 text-center">
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: `${form.theme_color}20` }}
                    >
                        <CheckCircle className="h-8 w-8" style={{ color: form.theme_color }} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {getText('Thank You!', 'Terima Kasih!')}
                    </h2>
                    <p className="text-gray-600 mb-6">
                        {form.settings?.confirmationMessage ||
                            getText('Your response has been recorded.', 'Respons Anda telah direkam.')}
                    </p>
                    <button
                        onClick={() => {
                            setSubmitted(false);
                            setValues({});
                            fields.forEach((f) => {
                                if (f.field_type === 'signature') {
                                    signatureRefs.current[f.id]?.clear();
                                }
                            });
                        }}
                        className="px-6 py-2 text-white rounded-lg font-medium"
                        style={{ backgroundColor: form.theme_color }}
                    >
                        {getText('Submit Another Response', 'Kirim Respons Lain')}
                    </button>
                </div>
            </div>
        );
    }

    // Convert hex to rgba for background with opacity
    const hexToRgba = (hex: string, opacity: number) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`
            : `rgba(59, 130, 246, ${opacity})`; // fallback to blue
    };

    return (
        <div
            className="min-h-screen py-4 sm:py-8 px-2 sm:px-4"
            style={{
                background: `linear-gradient(135deg, ${hexToRgba(form.theme_color, 0.1)} 0%, ${hexToRgba(form.theme_color, 0.05)} 50%, #f3f4f6 100%)`
            }}
        >
            <div className="max-w-2xl mx-auto w-full">
                {/* Form Header */}
                <div
                    className="bg-white rounded-xl shadow-sm border-t-4 overflow-hidden mb-4"
                    style={{ borderTopColor: form.theme_color }}
                >
                    {form.header_image && (
                        <img
                            src={form.header_image}
                            alt="Form header"
                            className="w-full h-32 sm:h-48 object-cover"
                        />
                    )}
                    <div className="p-4 sm:p-6">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{form.title}</h1>
                        {form.description && <p className="text-sm sm:text-base text-gray-600">{form.description}</p>}
                        <p className="text-xs sm:text-sm text-red-500 mt-4">* {getText('Required', 'Wajib diisi')}</p>
                    </div>
                </div>

                {/* Form Fields - Render ALL fields, use CSS to hide conditional ones */}
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {fields.map((field) => {
                            const isVisible = isFieldVisible(field);
                            return (
                                <div
                                    key={field.id}
                                    className={`bg-white rounded-xl shadow-sm p-4 sm:p-6 transition-all duration-300 ${isVisible ? 'opacity-100' : 'hidden'
                                        }`}
                                >
                                    {/* Header type */}
                                    {field.field_type === 'header' && (
                                        <h2 className="text-lg sm:text-xl font-bold text-gray-900">{field.label}</h2>
                                    )}

                                    {/* Paragraph type */}
                                    {field.field_type === 'paragraph' && (
                                        <p className="text-sm sm:text-base text-gray-600">{field.label}</p>
                                    )}

                                    {/* Input fields */}
                                    {!['header', 'paragraph'].includes(field.field_type) && (
                                        <>
                                            <label className="block text-sm sm:text-base font-medium text-gray-900 mb-1 sm:mb-2">
                                                {field.label}
                                                {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                            </label>

                                            {field.helper_text && (
                                                <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">{field.helper_text}</p>
                                            )}

                                            {/* Text Input */}
                                            {['text', 'email', 'phone', 'number'].includes(field.field_type) && (
                                                <input
                                                    type={field.field_type === 'phone' ? 'tel' : field.field_type}
                                                    value={values[field.id] as string}
                                                    onChange={(e) => updateValue(field.id, e.target.value)}
                                                    placeholder={field.placeholder || ''}
                                                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 transition-all ${errors[field.id]
                                                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                                                        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                                                        }`}
                                                />
                                            )}

                                            {/* Textarea */}
                                            {field.field_type === 'textarea' && (
                                                <textarea
                                                    value={values[field.id] as string}
                                                    onChange={(e) => updateValue(field.id, e.target.value)}
                                                    placeholder={field.placeholder || ''}
                                                    rows={4}
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none ${errors[field.id]
                                                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                                                        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                                                        }`}
                                                />
                                            )}

                                            {/* Date */}
                                            {field.field_type === 'date' && (
                                                <input
                                                    type="date"
                                                    value={values[field.id] as string}
                                                    onChange={(e) => updateValue(field.id, e.target.value)}
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${errors[field.id]
                                                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                                                        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                                                        }`}
                                                />
                                            )}

                                            {/* Time */}
                                            {field.field_type === 'time' && (
                                                <input
                                                    type="time"
                                                    value={values[field.id] as string}
                                                    onChange={(e) => updateValue(field.id, e.target.value)}
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${errors[field.id]
                                                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                                                        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
                                                        }`}
                                                />
                                            )}

                                            {/* Dropdown - Use DynamicDropdown for both data source and manual options */}
                                            {field.field_type === 'dropdown' && (
                                                <DynamicDropdown
                                                    dataSource={field.data_source || undefined}
                                                    options={field.options?.map(opt => ({ value: opt.value, label: opt.label })) || undefined}
                                                    value={values[field.id] as string}
                                                    onChange={(val) => {
                                                        // Prevent selecting separator
                                                        if (val !== '__separator__') {
                                                            updateValue(field.id, val as string);
                                                        }
                                                    }}
                                                    placeholder={field.placeholder || getText('Select...', 'Pilih...')}
                                                    error={errors[field.id]}
                                                />
                                            )}

                                            {/* Radio - store LABEL not value */}
                                            {field.field_type === 'radio' && (
                                                <div className="space-y-1 sm:space-y-2">
                                                    {(field.options || []).map((opt) => (
                                                        <label
                                                            key={opt.value}
                                                            className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={field.id}
                                                                value={opt.label}
                                                                checked={values[field.id] === opt.label}
                                                                onChange={(e) => updateValue(field.id, e.target.value)}
                                                                className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm sm:text-base text-gray-900">{opt.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Checkbox - store LABEL not value */}
                                            {field.field_type === 'checkbox' && (
                                                <div className="space-y-1 sm:space-y-2">
                                                    {(field.options || []).map((opt) => (
                                                        <label
                                                            key={opt.value}
                                                            className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                value={opt.label}
                                                                checked={(values[field.id] as string[])?.includes(opt.label)}
                                                                onChange={() => toggleCheckbox(field.id, opt.label)}
                                                                className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm sm:text-base text-gray-900">{opt.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Signature - uses SignatureCanvas component which is now responsive */}
                                            {field.field_type === 'signature' && (
                                                <SignatureCanvas
                                                    ref={(ref) => { signatureRefs.current[field.id] = ref; }}
                                                    penColor="#000000"
                                                    backgroundColor="white"
                                                />
                                            )}

                                            {/* Error message */}
                                            {errors[field.id] && (
                                                <p className="mt-2 text-sm text-red-600 flex items-center">
                                                    <AlertCircle className="h-4 w-4 mr-1" />
                                                    {errors[field.id]}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Submit Button - Responsive layout */}
                    <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-4">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center justify-center space-x-2 w-full sm:w-auto px-6 py-3 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            style={{ backgroundColor: form.theme_color }}
                        >
                            {submitting ? (
                                <RefreshCw className="h-5 w-5 animate-spin" />
                            ) : (
                                <Send className="h-5 w-5" />
                            )}
                            <span>{getText('Submit', 'Kirim')}</span>
                        </button>

                        <p className="text-xs sm:text-sm text-gray-500 text-center sm:text-right">
                            {getText('Never submit passwords', 'Jangan pernah mengirim password')}
                        </p>
                    </div>
                </form>
            </div >
        </div >
    );
};

export default FormView;
