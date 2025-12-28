// Form Builder Types
// TypeScript interfaces for form creation and management

export type FieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'email'
    | 'phone'
    | 'date'
    | 'time'
    | 'dropdown'
    | 'checkbox'
    | 'radio'
    | 'signature'
    | 'file'
    | 'header'
    | 'paragraph';

export interface FieldOption {
    value: string;
    label: string;
}

export interface FieldDataSource {
    table: 'users' | 'departments' | 'study_programs';
    filter?: Record<string, string | string[]>; // {role: 'lecturer'} or {role: ['lecturer', 'staff']}
    displayField: string; // 'full_name', 'name', etc.
    valueField?: string; // defaults to 'id'
}

export interface FieldValidation {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    patternMessage?: string;
}

export interface FieldCondition {
    triggerFieldId: string;
    triggerValue: string | string[]; // e.g., 'penelitian' or ['penelitian', 'pengabdian']
    operator?: 'equals' | 'contains' | 'notEquals' | 'isEmpty' | 'isNotEmpty';
    action: 'show' | 'hide' | 'require' | 'unrequire';
}

export interface FieldSettings {
    conditions?: FieldCondition[];
    width?: 'full' | 'half' | 'third';
    style?: Record<string, string>;
}

export interface FormSettings {
    showProgressBar?: boolean;
    allowMultipleSubmissions?: boolean;
    requireLogin?: boolean;
    confirmationMessage?: string;
    redirectUrl?: string;
    notifyEmail?: string;
}

// ============================================
// Database Entity Interfaces
// ============================================

export interface Form {
    id: string;
    code: string | null; // Short URL code for sharing
    title: string;
    description: string | null;
    header_image: string | null;
    theme_color: string;
    is_active: boolean;
    is_public: boolean;
    created_by: string | null;
    department_id: string | null;
    study_program_id: string | null;
    settings: FormSettings;
    created_at: string;
    updated_at: string;
}

export interface FormField {
    id: string;
    form_id: string;
    field_type: FieldType;
    label: string;
    placeholder: string | null;
    helper_text: string | null;
    is_required: boolean;
    options: FieldOption[] | null;
    data_source: FieldDataSource | null;
    validation: FieldValidation | null;
    field_order: number;
    settings: FieldSettings;
    created_at: string;
}

export interface FormResponse {
    id: string;
    form_id: string;
    respondent_id: string | null;
    respondent_name: string | null;
    respondent_email: string | null;
    respondent_phone: string | null;
    department_id: string | null;
    study_program_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    submitted_at: string;
}

export interface FormResponseValue {
    id: string;
    response_id: string;
    field_id: string;
    value: string | null;
    value_array: string[] | null;
    signature_data: string | null;
    file_url: string | null;
    created_at: string;
}

// ============================================
// Extended Types with Relations
// ============================================

export interface FormWithFields extends Form {
    fields: FormField[];
    creator?: {
        id: string;
        full_name: string;
    };
    department?: {
        id: string;
        name: string;
    };
    study_program?: {
        id: string;
        name: string;
    };
}

export interface FormResponseWithValues extends FormResponse {
    values: FormResponseValue[];
    form?: Form;
    respondent?: {
        id: string;
        full_name: string;
    };
    department?: {
        id: string;
        name: string;
    };
    study_program?: {
        id: string;
        name: string;
    };
}

// ============================================
// Input Types for Creation/Update
// ============================================

export interface CreateFormInput {
    code?: string; // Short URL code for sharing
    title: string;
    description?: string;
    header_image?: string;
    theme_color?: string;
    is_active?: boolean;
    is_public?: boolean;
    department_id?: string;
    study_program_id?: string;
    settings?: FormSettings;
}

export interface CreateFormFieldInput {
    form_id: string;
    field_type: FieldType;
    label: string;
    placeholder?: string;
    helper_text?: string;
    is_required?: boolean;
    options?: FieldOption[];
    data_source?: FieldDataSource;
    validation?: FieldValidation;
    field_order: number;
    settings?: FieldSettings;
}

export interface CreateFormResponseInput {
    form_id: string;
    respondent_id?: string;
    respondent_name?: string;
    respondent_email?: string;
    respondent_phone?: string;
    department_id?: string;
    study_program_id?: string;
}

export interface CreateFormResponseValueInput {
    response_id: string;
    field_id: string;
    value?: string;
    value_array?: string[];
    signature_data?: string;
    file_url?: string;
}
