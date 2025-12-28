import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ChevronDown, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FieldDataSource } from '../types/form';

interface DynamicDropdownOption {
    value: string;
    label: string;
    subtitle?: string;
}

interface DynamicDropdownProps {
    // Static options
    options?: DynamicDropdownOption[];

    // Dynamic data source
    dataSource?: FieldDataSource;

    // Value handling
    value: string | string[];
    onChange: (value: string | string[]) => void;

    // Multiple selection
    multiple?: boolean;

    // UI
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    className?: string;
    error?: string;
}

const DynamicDropdown: React.FC<DynamicDropdownProps> = ({
    options: staticOptions,
    dataSource,
    value,
    onChange,
    multiple = false,
    placeholder = 'Select...',
    searchPlaceholder = 'Search...',
    emptyMessage = 'No options found',
    disabled = false,
    className = '',
    error,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [dynamicOptions, setDynamicOptions] = useState<DynamicDropdownOption[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch dynamic options from data source
    const fetchOptions = useCallback(async () => {
        if (!dataSource) return;

        setLoading(true);
        try {
            let query = supabase.from(dataSource.table).select('*');

            // Apply filters
            if (dataSource.filter) {
                Object.entries(dataSource.filter).forEach(([key, val]) => {
                    if (Array.isArray(val)) {
                        query = query.in(key, val);
                    } else {
                        query = query.eq(key, val);
                    }
                });
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            const options: DynamicDropdownOption[] = (data || []).map((item: any) => ({
                value: item[dataSource.valueField || 'id'],
                label: item[dataSource.displayField],
                subtitle: dataSource.table === 'users' ? item.identity_number : undefined,
            }));

            setDynamicOptions(options);
        } catch (err) {
            console.error('Failed to fetch dropdown options:', err);
            setDynamicOptions([]);
        } finally {
            setLoading(false);
        }
    }, [dataSource]);

    // Fetch on mount if data source exists
    useEffect(() => {
        if (dataSource) {
            fetchOptions();
        }
    }, [dataSource, fetchOptions]);

    // Combine static (manual) options with dynamic (data source) options
    const allOptions = useMemo(() => {
        const manual = staticOptions || [];
        const dynamic = dynamicOptions || [];

        // If both exist, combine them (manual first, then dynamic)
        if (manual.length > 0 && dynamic.length > 0) {
            // Add separator if both exist
            return [
                ...manual,
                { value: '__separator__', label: '── Data dari Database ──', subtitle: '' },
                ...dynamic
            ];
        }

        // Otherwise return whichever exists
        return manual.length > 0 ? manual : dynamic;
    }, [staticOptions, dynamicOptions]);

    // Filter options by search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return allOptions;

        const lower = searchTerm.toLowerCase();
        return allOptions.filter(opt =>
            opt.label.toLowerCase().includes(lower) ||
            opt.subtitle?.toLowerCase().includes(lower)
        );
    }, [allOptions, searchTerm]);

    // Get selected option(s) display text
    // Value now stores labels directly, so we can display them as-is
    const displayText = useMemo(() => {
        if (multiple) {
            const labels = Array.isArray(value) ? value : [];
            if (labels.length === 0) return placeholder;
            return labels.join(', ');
        } else {
            // Value is now the label itself
            return value || placeholder;
        }
    }, [value, multiple, placeholder]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle option select - use LABEL for storage, not value/ID
    const handleSelect = (optionValue: string) => {
        // Get the option to find its label
        const option = allOptions.find(o => o.value === optionValue);
        const labelToStore = option?.label || optionValue; // Fallback to value if label not found

        if (multiple) {
            const currentLabels = Array.isArray(value) ? [...value] : [];
            const index = currentLabels.indexOf(labelToStore);
            if (index >= 0) {
                currentLabels.splice(index, 1);
            } else {
                currentLabels.push(labelToStore);
            }
            onChange(currentLabels);
        } else {
            onChange(labelToStore);
            setIsOpen(false);
            setSearchTerm('');
        }
    };

    // Check if option is selected - compare by label since we store labels
    const isSelected = (optionValue: string) => {
        const option = allOptions.find(o => o.value === optionValue);
        const optionLabel = option?.label || optionValue;

        if (multiple) {
            return Array.isArray(value) && value.includes(optionLabel);
        }
        return value === optionLabel;
    };

    // Clear selection
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(multiple ? [] : '');
    };

    const hasValue = multiple
        ? Array.isArray(value) && value.length > 0
        : !!value;

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-3 border rounded-lg text-left flex items-center justify-between transition-all duration-200 ${error
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : isOpen
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-300 hover:border-gray-400'
                    } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
            >
                <span className={`flex-1 truncate ${hasValue ? 'text-gray-900' : 'text-gray-500'}`}>
                    {loading ? (
                        <span className="flex items-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Loading...
                        </span>
                    ) : displayText}
                </span>

                <div className="flex items-center space-x-1">
                    {hasValue && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 hover:bg-gray-100 rounded-full"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Dropdown Panel */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-72 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-52 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-6 text-center text-gray-500 text-sm">
                                {searchTerm ? `No results for "${searchTerm}"` : emptyMessage}
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                option.value === '__separator__' ? (
                                    // Separator - non-selectable
                                    <div
                                        key={option.value}
                                        className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-y border-gray-100 select-none"
                                    >
                                        {option.label}
                                    </div>
                                ) : (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelect(option.value)}
                                        className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-blue-50 transition-colors ${isSelected(option.value) ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{option.label}</div>
                                            {option.subtitle && (
                                                <div className="text-sm text-gray-500 truncate">{option.subtitle}</div>
                                            )}
                                        </div>
                                        {multiple && isSelected(option.value) && (
                                            <div className="flex-shrink-0 w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                )
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
        </div>
    );
};

export default DynamicDropdown;
