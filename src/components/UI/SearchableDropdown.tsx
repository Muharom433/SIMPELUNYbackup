import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
    id: string;
    name?: string;
    full_name?: string; // Support full_name property usually from Users table
    code?: string;
    [key: string]: any;
}

interface SearchableDropdownProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    className?: string;
}

export const SearchableDropdown = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    searchPlaceholder = 'Cari...',
    emptyMessage = 'Tidak ditemukan',
    disabled = false,
    className = ''
}: SearchableDropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Normalize options to have a 'name' property for consistency
    const normalizedOptions = useMemo(() => {
        return options.map(o => ({
            ...o,
            displayName: o.full_name || o.name || 'Unknown'
        }));
    }, [options]);

    const selectedOption = useMemo(() => {
        return normalizedOptions.find(option => option.displayName === value);
    }, [normalizedOptions, value]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return normalizedOptions;
        const searchLower = searchTerm.toLowerCase().trim();
        return normalizedOptions.filter(option =>
            (option.displayName?.toLowerCase() || '').includes(searchLower)
        );
    }, [normalizedOptions, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionName: string) => {
        onChange(optionName);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full text-left flex items-center justify-between bg-white border border-gray-300 hover:border-orange-500 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''
                    }`}
            >
                <span className={`block truncate ${!selectedOption && value ? '' : ''}`}>
                    {selectedOption ? selectedOption.displayName : (value || <span className="text-gray-500">{placeholder}</span>)}
                </span>
                <ChevronDown className={`h-3 w-3 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full min-w-[200px] mt-1 bg-white border border-gray-300 rounded-md shadow-xl left-0 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                    <div className="p-2 border-b border-gray-100 bg-gray-50 rounded-t-md">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200 transition-all"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="p-3 text-xs text-gray-500 text-center italic">{emptyMessage}</div>
                        ) : (
                            filteredOptions.map(option => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelect(option.displayName)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-orange-50 text-gray-700 hover:text-orange-900 border-b border-gray-50 last:border-0 transition-colors flex items-center justify-between group ${option.displayName === value ? 'bg-orange-50 text-orange-900 font-medium' : ''}`}
                                >
                                    <span>{option.displayName}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
