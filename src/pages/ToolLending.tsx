import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Wrench, Search, Package, User, Building, MapPin,
    X, Plus, Minus, CheckCircle, Send, Info,
    Eye, Maximize2, Camera, RefreshCw,
    FileText, AlertTriangle, Upload
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

// Types
interface EquipmentWithDetails {
    id: string;
    name: string;
    code: string;
    category: string;
    quantity: number;
    unit: string;
    condition: string;
    is_available: boolean;
    attachments?: string | null;
    Spesification?: string | null;
    rooms_id: string | null;
    table_id?: string | null;
    rack_id?: string | null;
    box_id?: string | null;
    rooms?: {
        id: string;
        name: string;
        code: string;
        department_id?: string;
        floor?: number;
        department?: { id: string; name: string; code: string };
        building?: { name: string; campus?: { name: string } };
    } | null;
}

interface Table { id: string; room_id: string; description: string; rack?: number; }
interface Rack { id: string; name: string; table_id: string; }
interface Box { id: string; name: string; description?: string; rack_id: string; }

interface SelectedEquipment {
    equipment: EquipmentWithDetails;
    quantity: number;
}

interface IdentitySuggestion {
    id: string;
    identity_number: string;
    full_name: string;
    phone_number: string;
    email?: string;
    department_id?: string;
    department_name?: string;
}

// Main Component
const ToolLending: React.FC = () => {
    const { getText } = useLanguage();

    // Identity states
    const [identityNumber, setIdentityNumber] = useState('');
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [userDepartmentId, setUserDepartmentId] = useState<string | null>(null);
    const [userDepartmentName, setUserDepartmentName] = useState<string>('');
    const [userId, setUserId] = useState<string | null>(null);

    // Identity dropdown
    const [identitySuggestions, setIdentitySuggestions] = useState<IdentitySuggestion[]>([]);
    const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [identityVerified, setIdentityVerified] = useState(false);

    // Equipment states
    const [equipment, setEquipment] = useState<EquipmentWithDetails[]>([]);
    const [filteredEquipment, setFilteredEquipment] = useState<EquipmentWithDetails[]>([]);
    const [selectedEquipments, setSelectedEquipments] = useState<Map<string, SelectedEquipment>>(new Map());
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Location data
    const [tables, setTables] = useState<Table[]>([]);
    const [racks, setRacks] = useState<Rack[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);

    // Equipment detail modal
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailEquipment, setDetailEquipment] = useState<EquipmentWithDetails | null>(null);
    const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

    // Form
    const [purpose, setPurpose] = useState<'Class/Lecture' | 'Other'>('Class/Lecture');
    const [returnDate, setReturnDate] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]);

    // Refs
    const identityInputRef = useRef<HTMLInputElement | null>(null);
    const fullNameInputRef = useRef<HTMLInputElement | null>(null);
    const phoneInputRef = useRef<HTMLInputElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowIdentityDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ==================== IDENTITY SEARCH ====================

    async function searchIdentity(value: string) {
        if (value.length < 3) {
            setIdentitySuggestions([]);
            setShowIdentityDropdown(false);
            setIsManualEntry(true);
            return;
        }

        try {
            const { data: users, error } = await supabase
                .from('users')
                .select(`
                    id,
                    identity_number,
                    full_name,
                    phone_number,
                    email,
                    department_id,
                    departments:department_id (
                        id,
                        name
                    )
                `)
                .or(`identity_number.ilike.%${value}%,full_name.ilike.%${value}%`)
                .limit(10);

            if (error) throw error;

            if (!users || users.length === 0) {
                setIdentitySuggestions([]);
                setShowIdentityDropdown(false);
                setIsManualEntry(true);

                if (fullNameInputRef.current) fullNameInputRef.current.disabled = false;
                if (phoneInputRef.current) phoneInputRef.current.disabled = false;
                return;
            }

            const mappedUsers = users.map((user: any) => ({
                id: user.id,
                identity_number: user.identity_number,
                full_name: user.full_name,
                phone_number: user.phone_number || "",
                email: user.email || "",
                department_id: user.department_id || null,
                department_name: user.departments?.name || ""
            }));

            setIdentitySuggestions(mappedUsers);
            setShowIdentityDropdown(true);
            setIsManualEntry(false);

        } catch (err) {
            console.error("Error fetching identity suggestions:", err);
            setIdentitySuggestions([]);
            setShowIdentityDropdown(false);
            setIsManualEntry(true);
        }
    }

    function selectIdentity(user: IdentitySuggestion) {
        setIdentityNumber(user.identity_number);
        setFullName(user.full_name);
        setPhoneNumber(user.phone_number);
        setEmail(user.email || '');
        setUserDepartmentId(user.department_id || null);
        setUserDepartmentName(user.department_name || '');
        setUserId(user.id);

        if (identityInputRef.current) identityInputRef.current.value = user.identity_number;
        if (fullNameInputRef.current) {
            fullNameInputRef.current.value = user.full_name;
            fullNameInputRef.current.disabled = true;
        }
        if (phoneInputRef.current) {
            phoneInputRef.current.value = user.phone_number;
            phoneInputRef.current.disabled = true;
        }

        setShowIdentityDropdown(false);
        setIdentitySuggestions([]);
        setIsManualEntry(false);
        setIdentityVerified(true);

        // Fetch equipment based on department
        fetchEquipmentData(user.department_id || null);
    }

    function handleIdentityChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value;
        setIdentityNumber(value);

        if (value.length === 0) {
            setFullName('');
            setPhoneNumber('');
            setEmail('');
            setUserDepartmentId(null);
            setUserDepartmentName('');
            setUserId(null);

            if (fullNameInputRef.current) {
                fullNameInputRef.current.value = "";
                fullNameInputRef.current.disabled = false;
            }
            if (phoneInputRef.current) {
                phoneInputRef.current.value = "";
                phoneInputRef.current.disabled = false;
            }
            setIsManualEntry(false);
            setIdentityVerified(false);
        } else {
            searchIdentity(value);
        }
    }

    // ==================== DATA FETCHING ====================

    const fetchEquipmentData = useCallback(async (departmentId: string | null) => {
        try {
            setLoadingEquipment(true);

            const { data: equipmentData, error: equipmentError } = await supabase
                .from('equipment')
                .select(`
                    *,
                    rooms:rooms_id(
                        id, name, code, department_id, floor,
                        department:departments(id, name, code),
                        building:building_id(name, campus:campus_id(name))
                    )
                `)
                .eq('is_available', true)
                .gt('quantity', 0)
                .order('name');

            if (equipmentError) throw equipmentError;

            // Filter equipment based on department
            let filtered = (equipmentData || []).filter((eq: EquipmentWithDetails) => {
                if (!eq.rooms || !eq.rooms.department_id) return true;
                if (!departmentId) return !eq.rooms.department_id;
                return eq.rooms.department_id === departmentId || !eq.rooms.department_id;
            });

            setEquipment(filtered);
            setFilteredEquipment(filtered);

            // Fetch location data
            const [tablesRes, racksRes, boxesRes] = await Promise.all([
                supabase.from('table').select('id, room_id, description, rack'),
                supabase.from('rack').select('id, name, table_id').order('name'),
                supabase.from('box').select('id, name, description, rack_id').order('name')
            ]);

            if (tablesRes.data) setTables(tablesRes.data);
            if (racksRes.data) setRacks(racksRes.data);
            if (boxesRes.data) setBoxes(boxesRes.data);

        } catch (error) {
            console.error('Error fetching equipment:', error);
            toast.error(getText('Failed to load equipment', 'Gagal memuat peralatan'));
        } finally {
            setLoadingEquipment(false);
        }
    }, [getText]);

    // Initial load - fetch equipment with no department filter
    useEffect(() => {
        fetchEquipmentData(null);
    }, [fetchEquipmentData]);

    // ==================== EQUIPMENT FILTERING ====================

    useEffect(() => {
        let filtered = [...equipment];

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(eq =>
                eq.name.toLowerCase().includes(search) ||
                eq.code.toLowerCase().includes(search) ||
                eq.category?.toLowerCase().includes(search) ||
                eq.rooms?.name?.toLowerCase().includes(search)
            );
        }

        if (categoryFilter !== 'all') {
            filtered = filtered.filter(eq => eq.category === categoryFilter);
        }

        setFilteredEquipment(filtered);
    }, [equipment, searchTerm, categoryFilter]);

    const categories = [...new Set(equipment.map(eq => eq.category).filter(Boolean))];

    // ==================== EQUIPMENT SELECTION ====================

    const handleSelectEquipment = (eq: EquipmentWithDetails, quantity: number) => {
        const newMap = new Map(selectedEquipments);

        if (quantity <= 0) {
            newMap.delete(eq.id);
        } else {
            const maxQty = eq.quantity || 1;
            newMap.set(eq.id, {
                equipment: eq,
                quantity: Math.min(quantity, maxQty)
            });
        }

        setSelectedEquipments(newMap);
    };

    // ==================== SUBMIT REQUEST ====================

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!identityNumber || !fullName || !phoneNumber) {
            toast.error(getText('Please fill all required identity fields', 'Harap isi semua kolom identitas yang diperlukan'));
            return;
        }

        if (selectedEquipments.size === 0) {
            toast.error(getText('Please select at least one equipment', 'Pilih minimal satu peralatan'));
            return;
        }

        if (!purpose) {
            toast.error(getText('Please select the purpose', 'Harap pilih tujuan peminjaman'));
            return;
        }

        if (purpose === 'Other' && attachments.length === 0) {
            toast.error(getText('Please upload supporting documents for Other purpose', 'Harap unggah dokumen pendukung untuk tujuan Lainnya'));
            return;
        }

        if (!returnDate) {
            toast.error(getText('Please select return date', 'Pilih tanggal pengembalian'));
            return;
        }

        try {
            setSubmitting(true);

            const equipmentIds = Array.from(selectedEquipments.values()).map(s => s.equipment.id);
            const quantities = Array.from(selectedEquipments.values()).map(s => s.quantity);

            const lendingData: any = {
                id_user: userId,
                date: new Date().toISOString(),
                return_date: returnDate,
                id_equipment: equipmentIds,
                qty: quantities,
                purpose: purpose,
                status: 'pending',
                attachments: purpose === 'Other' ? attachments : null,
                user_info: !userId ? {
                    full_name: fullName,
                    identity_number: identityNumber,
                    phone_number: phoneNumber,
                    email: email
                } : null
            };

            const { error } = await supabase
                .from('lending_tool')
                .insert(lendingData);

            if (error) throw error;

            toast.success(getText(
                'Lending request submitted successfully! Please wait for approval.',
                'Permintaan peminjaman berhasil dikirim! Harap tunggu persetujuan.'
            ));

            // Reset form
            setSelectedEquipments(new Map());
            setPurpose('Class/Lecture');
            setReturnDate('');
            setAttachments([]);

        } catch (err: any) {
            console.error('Submit error:', err);
            toast.error(err.message || getText('Failed to submit request', 'Gagal mengirim permintaan'));
        } finally {
            setSubmitting(false);
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    const getLocationPath = (eq: EquipmentWithDetails): string => {
        const parts: string[] = [];

        if ((eq.rooms as any)?.building?.campus?.name) {
            parts.push((eq.rooms as any).building.campus.name);
        }
        if ((eq.rooms as any)?.building?.name) {
            parts.push((eq.rooms as any).building.name);
        }
        if ((eq.rooms as any)?.floor) {
            parts.push(`Lt. ${(eq.rooms as any).floor}`);
        }
        if (eq.rooms?.name) {
            parts.push(eq.rooms.name);
        }

        const box = boxes.find(b => b.id === eq.box_id);
        const rackId = eq.rack_id || box?.rack_id;
        const rack = racks.find(r => r.id === rackId);
        const tableId = eq.table_id || rack?.table_id;
        const table = tables.find(t => t.id === tableId);

        if (table?.description) parts.push(table.description);
        if (rack?.name) parts.push(`Rak ${rack.name}`);
        if (box?.name) parts.push(`Box ${box.name}`);

        return parts.length > 0 ? parts.join(' → ') : getText('Location not set', 'Lokasi belum diatur');
    };

    // ==================== RENDER EQUIPMENT DETAIL MODAL ====================

    const renderDetailModal = () => {
        if (!showDetailModal || !detailEquipment) return null;

        const eq = detailEquipment;
        const box = boxes.find(b => b.id === eq.box_id);
        const rackId = eq.rack_id || box?.rack_id;
        const rack = racks.find(r => r.id === rackId);
        const tableId = eq.table_id || rack?.table_id;
        const table = tables.find(t => t.id === tableId);

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header with Photo */}
                    {eq.attachments ? (
                        <div className="relative h-64">
                            <img src={eq.attachments} alt={eq.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-lg text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <div className="absolute bottom-4 left-6 right-6">
                                <h2 className="text-white text-2xl font-bold drop-shadow-lg">{eq.name}</h2>
                                <p className="text-white/80 font-mono">{eq.code}</p>
                            </div>
                            <button
                                onClick={() => setFullscreenPhoto(eq.attachments || null)}
                                className="absolute bottom-4 right-4 p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-lg text-white"
                            >
                                <Maximize2 className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Wrench className="h-8 w-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{eq.name}</h2>
                                    <p className="opacity-90 font-mono">{eq.code}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="p-6 space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-4 rounded-xl">
                                <p className="text-xs text-blue-600 mb-1">{getText('Category', 'Kategori')}</p>
                                <p className="font-bold text-blue-900">{eq.category || 'General'}</p>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-xl">
                                <p className="text-xs text-purple-600 mb-1">{getText('Available Quantity', 'Jumlah Tersedia')}</p>
                                <p className="font-bold text-purple-900 text-xl">{eq.quantity} {eq.unit}</p>
                            </div>
                        </div>

                        {/* Condition */}
                        <div className={`p-4 rounded-xl ${eq.condition === 'GOOD' ? 'bg-green-50' : eq.condition === 'MAINTENANCE' ? 'bg-yellow-50' : 'bg-red-50'}`}>
                            <p className="text-xs text-gray-600 mb-1">{getText('Condition', 'Kondisi')}</p>
                            <p className={`font-bold ${eq.condition === 'GOOD' ? 'text-green-700' : eq.condition === 'MAINTENANCE' ? 'text-yellow-700' : 'text-red-700'}`}>
                                {eq.condition === 'GOOD' ? '✅ ' : eq.condition === 'MAINTENANCE' ? '🔧 ' : '⚠️ '}
                                {eq.condition || 'Unknown'}
                            </p>
                        </div>

                        {/* Location */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                {getText('Location', 'Lokasi')}
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {(eq.rooms as any)?.building?.campus?.name && (
                                    <div>
                                        <span className="text-blue-600 text-xs">{getText('Campus', 'Kampus')}</span>
                                        <p className="font-medium text-gray-900">{(eq.rooms as any).building.campus.name}</p>
                                    </div>
                                )}
                                {(eq.rooms as any)?.building?.name && (
                                    <div>
                                        <span className="text-blue-600 text-xs">{getText('Building', 'Gedung')}</span>
                                        <p className="font-medium text-gray-900">{(eq.rooms as any).building.name}</p>
                                    </div>
                                )}
                                {(eq.rooms as any)?.floor && (
                                    <div>
                                        <span className="text-blue-600 text-xs">{getText('Floor', 'Lantai')}</span>
                                        <p className="font-medium text-gray-900">Lantai {(eq.rooms as any).floor}</p>
                                    </div>
                                )}
                                {eq.rooms?.name && (
                                    <div>
                                        <span className="text-blue-600 text-xs">{getText('Room', 'Ruangan')}</span>
                                        <p className="font-medium text-gray-900">{eq.rooms.name}</p>
                                    </div>
                                )}
                                {table && (
                                    <div>
                                        <span className="text-blue-600 text-xs">{getText('Cabinet', 'Lemari')}</span>
                                        <p className="font-medium text-gray-900">{table.description}</p>
                                    </div>
                                )}
                                {rack && (
                                    <div>
                                        <span className="text-blue-600 text-xs">{getText('Rack', 'Rak')}</span>
                                        <p className="font-medium text-gray-900">{rack.name}</p>
                                    </div>
                                )}
                                {box && (
                                    <div>
                                        <span className="text-blue-600 text-xs">Box</span>
                                        <p className="font-medium text-gray-900">{box.name}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Specification */}
                        {eq.Spesification && (
                            <div className="bg-gray-50 p-4 rounded-xl">
                                <h3 className="font-semibold text-gray-800 mb-2">{getText('Specifications', 'Spesifikasi')}</h3>
                                <p className="text-gray-600 text-sm whitespace-pre-wrap">{eq.Spesification}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t">
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                {getText('Close', 'Tutup')}
                            </button>
                            {!selectedEquipments.has(eq.id) && eq.quantity > 0 && (
                                <button
                                    onClick={() => {
                                        handleSelectEquipment(eq, 1);
                                        setShowDetailModal(false);
                                    }}
                                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-5 w-5" />
                                    {getText('Select This Item', 'Pilih Item Ini')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ==================== RENDER FULLSCREEN PHOTO ====================

    const renderFullscreenPhoto = () => {
        if (!fullscreenPhoto) return null;

        return (
            <div
                className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 cursor-zoom-out"
                onClick={() => setFullscreenPhoto(null)}
            >
                <button
                    onClick={() => setFullscreenPhoto(null)}
                    className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white"
                >
                    <X className="h-6 w-6" />
                </button>
                <img
                    src={fullscreenPhoto}
                    alt="Fullscreen preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        );
    };

    // ==================== MAIN RENDER ====================

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
                        <Wrench className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800">{getText('Equipment Lending', 'Peminjaman Peralatan')}</h1>
                    <p className="text-gray-600 mt-2">{getText('Borrow equipment for your needs', 'Pinjam peralatan untuk kebutuhan Anda')}</p>
                </div>

                {/* Main Form - 2 Column Layout Like BookRoom */}
                <form onSubmit={handleSubmitRequest}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* LEFT COLUMN - Equipment Selection */}
                        <div className="lg:col-span-2 relative z-10">
                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 space-y-6">

                                {/* Equipment Section Header */}
                                <div className="flex items-center space-x-3">
                                    <Package className="h-6 w-6 text-blue-600" />
                                    <h2 className="text-xl font-bold text-gray-800">{getText('Select Equipment', 'Pilih Peralatan')}</h2>
                                    {identityVerified && userDepartmentName && (
                                        <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium">
                                            {userDepartmentName}
                                        </span>
                                    )}
                                </div>

                                {/* Info Banner */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-start space-x-2">
                                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                                        <div className="text-sm text-blue-800">
                                            <p className="font-medium">{getText('Information', 'Informasi')}</p>
                                            <p className="mt-1">
                                                {identityVerified
                                                    ? getText('Showing equipment available for your department.', 'Menampilkan peralatan yang tersedia untuk departemen Anda.')
                                                    : getText('Fill in your identity to see equipment based on your department.', 'Isi identitas Anda untuk melihat peralatan berdasarkan departemen Anda.')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Search and Filter */}
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder={getText("Search equipment (name, code)...", "Cari peralatan (nama, kode)...")}
                                            className="w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <select
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        className="px-4 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    >
                                        <option value="all">{getText('All Categories', 'Semua Kategori')}</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Equipment List */}
                                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {loadingEquipment ? (
                                        <div className="text-center py-8">
                                            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                                            <p className="text-gray-600">{getText('Loading equipment...', 'Memuat peralatan...')}</p>
                                        </div>
                                    ) : filteredEquipment.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-600">{getText('No equipment available', 'Tidak ada peralatan tersedia')}</p>
                                        </div>
                                    ) : (
                                        filteredEquipment.map((eq) => {
                                            const isSelected = selectedEquipments.has(eq.id);
                                            const selectedQty = selectedEquipments.get(eq.id)?.quantity || 0;

                                            return (
                                                <div
                                                    key={eq.id}
                                                    className={`p-4 rounded-lg border-2 transition-all duration-200 ${isSelected
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "hover:shadow-md hover:border-blue-300 border-gray-200 bg-white/50"
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        {/* Photo Thumbnail */}
                                                        <div
                                                            className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer bg-gray-100"
                                                            onClick={() => {
                                                                setDetailEquipment(eq);
                                                                setShowDetailModal(true);
                                                            }}
                                                        >
                                                            {eq.attachments ? (
                                                                <img src={eq.attachments} alt={eq.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Camera className="h-6 w-6 text-gray-400" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Equipment Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between mb-1">
                                                                <div>
                                                                    <h4 className="font-semibold text-gray-900">{eq.name}</h4>
                                                                    <p className="text-sm text-gray-600">{eq.code}</p>
                                                                </div>
                                                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                                                    {eq.category || 'General'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                                                                <div className="flex items-center gap-1">
                                                                    <Package className="h-3.5 w-3.5" />
                                                                    <span>{eq.quantity} {eq.unit}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-xs truncate">
                                                                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                                                    <span className="truncate">{getLocationPath(eq)}</span>
                                                                </div>
                                                            </div>

                                                            {/* Action Row */}
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setDetailEquipment(eq);
                                                                        setShowDetailModal(true);
                                                                    }}
                                                                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                    {getText('Details', 'Detail')}
                                                                </button>

                                                                {isSelected ? (
                                                                    <div className="flex items-center gap-2 ml-auto">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSelectEquipment(eq, selectedQty - 1)}
                                                                            className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                                                        >
                                                                            <Minus className="h-4 w-4 text-gray-600" />
                                                                        </button>
                                                                        <span className="w-8 text-center font-bold text-blue-700">{selectedQty}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSelectEquipment(eq, selectedQty + 1)}
                                                                            disabled={selectedQty >= eq.quantity}
                                                                            className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                                                                        >
                                                                            <Plus className="h-4 w-4 text-gray-600" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleSelectEquipment(eq, 0)}
                                                                            className="p-1.5 text-red-500 hover:text-red-700 ml-1"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSelectEquipment(eq, 1)}
                                                                        className="ml-auto px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-medium rounded hover:bg-blue-100 transition-colors flex items-center gap-1"
                                                                    >
                                                                        <Plus className="h-4 w-4" />
                                                                        {getText('Select', 'Pilih')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Selected Equipment Summary */}
                                {selectedEquipments.size > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                            <CheckCircle className="h-5 w-5" />
                                            {getText('Selected Equipment', 'Peralatan Terpilih')} ({selectedEquipments.size})
                                        </h3>
                                        <div className="space-y-2">
                                            {Array.from(selectedEquipments.values()).map(({ equipment: eq, quantity }) => (
                                                <div key={eq.id} className="flex items-center justify-between bg-white rounded p-2">
                                                    <span className="font-medium text-gray-800">{eq.name}</span>
                                                    <span className="text-blue-700 font-semibold">{quantity} {eq.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN - Personal Info & Submit */}
                        <div className="lg:col-span-1 relative z-10">
                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 space-y-6 sticky top-4">
                                {/* Personal Information */}
                                <div>
                                    <div className="flex items-center space-x-3 mb-6">
                                        <User className="h-6 w-6 text-purple-600" />
                                        <h2 className="text-xl font-bold text-gray-800">{getText('Personal Information', 'Informasi Pribadi')}</h2>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Identity Number with Dropdown */}
                                        <div className="relative" ref={dropdownRef}>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                                            </label>
                                            <input
                                                ref={identityInputRef}
                                                type="text"
                                                value={identityNumber}
                                                onChange={handleIdentityChange}
                                                placeholder={getText("Enter your ID", "Masukkan ID Anda")}
                                                autoComplete="off"
                                                className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            />

                                            {showIdentityDropdown && identitySuggestions.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                    {identitySuggestions.map((user, idx) => (
                                                        <div
                                                            key={idx}
                                                            onClick={() => selectIdentity(user)}
                                                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                        >
                                                            <div className="font-medium text-gray-900">{user.full_name}</div>
                                                            <div className="text-sm text-gray-600">{user.identity_number}</div>
                                                            {user.department_name && (
                                                                <div className="text-xs text-blue-600 flex items-center gap-1">
                                                                    <Building className="h-3 w-3" />
                                                                    {user.department_name}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {isManualEntry && (
                                                <p className="mt-1 text-xs text-blue-600">
                                                    {getText('Data not found. Please fill manually.', 'Data tidak ditemukan. Silakan isi manual.')}
                                                </p>
                                            )}
                                        </div>

                                        {/* Full Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {getText('Full Name', 'Nama Lengkap')} *
                                            </label>
                                            <input
                                                ref={fullNameInputRef}
                                                type="text"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                placeholder={getText("Enter your full name", "Masukkan nama lengkap")}
                                                className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            />
                                        </div>

                                        {/* Phone Number */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {getText('Phone Number', 'Nomor Telepon')} *
                                            </label>
                                            <input
                                                ref={phoneInputRef}
                                                type="tel"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                placeholder="08xxxxxxxxxx"
                                                className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            />
                                        </div>

                                        {/* Email (Optional) */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {getText('Email (Optional)', 'Email (Opsional)')}
                                            </label>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="email@example.com"
                                                className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            />
                                        </div>

                                        {/* Department Display */}
                                        {userDepartmentName && (
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                <div className="flex items-center gap-2 text-purple-700">
                                                    <Building className="h-4 w-4" />
                                                    <span className="text-sm font-medium">{getText('Department', 'Departemen')}</span>
                                                </div>
                                                <p className="text-purple-900 font-semibold mt-1">{userDepartmentName}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Lending Details */}
                                <div className="border-t border-gray-200/50 pt-6">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <FileText className="h-5 w-5 text-green-600" />
                                        <h3 className="font-bold text-gray-800">{getText('Lending Details', 'Detail Peminjaman')}</h3>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Purpose Dropdown */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {getText('Purpose', 'Tujuan')} *
                                            </label>
                                            <select
                                                value={purpose}
                                                onChange={(e) => setPurpose(e.target.value as 'Class/Lecture' | 'Other')}
                                                className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            >
                                                <option value="Class/Lecture">{getText('Lecture', 'Kuliah')}</option>
                                                <option value="Other">{getText('Other', 'Lainnya')}</option>
                                            </select>
                                        </div>

                                        {/* File Upload for "Other" purpose */}
                                        {purpose === 'Other' && (
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-4">
                                                <div className="flex items-center space-x-2">
                                                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                                    <h3 className="font-medium text-yellow-900">
                                                        {getText('Supporting Documents Required', 'Dokumen Pendukung Diperlukan')}
                                                    </h3>
                                                </div>

                                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                                    <input
                                                        type="file"
                                                        multiple
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => {
                                                            const files = e.target.files;
                                                            if (!files) return;

                                                            Array.from(files).forEach(file => {
                                                                if (file.size > 10 * 1024 * 1024) {
                                                                    toast.error(getText('File too large (max 10MB)', 'File terlalu besar (maks 10MB)'));
                                                                    return;
                                                                }

                                                                const reader = new FileReader();
                                                                reader.onloadend = () => {
                                                                    setAttachments(prev => [...prev, reader.result as string]);
                                                                };
                                                                reader.readAsDataURL(file);
                                                            });
                                                        }}
                                                        className="hidden"
                                                        id="file-upload-lending"
                                                    />
                                                    <label htmlFor="file-upload-lending" className="cursor-pointer">
                                                        <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                                                            {getText('Upload Files', 'Unggah File')}
                                                        </span>
                                                    </label>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {getText('PDF, JPG, PNG up to 10MB', 'PDF, JPG, PNG hingga 10MB')}
                                                    </p>
                                                </div>

                                                {attachments.length > 0 && (
                                                    <div className="space-y-2">
                                                        {attachments.map((attachment, index) => (
                                                            <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                                                                <div className="flex items-center space-x-2">
                                                                    {attachment.startsWith('data:application/pdf') ? (
                                                                        <FileText className="h-4 w-4 text-red-600" />
                                                                    ) : (
                                                                        <Camera className="h-4 w-4 text-amber-600" />
                                                                    )}
                                                                    <span className="text-sm">
                                                                        {attachment.startsWith('data:application/pdf')
                                                                            ? `Document_${index + 1}.pdf`
                                                                            : `Image_${index + 1}.jpg`}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                                                                    className="text-red-600 hover:text-red-800"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Return Date */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {getText('Return Date', 'Tanggal Pengembalian')} *
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={returnDate}
                                                onChange={(e) => setReturnDate(e.target.value)}
                                                min={new Date().toISOString().slice(0, 16)}
                                                className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <div className="border-t border-gray-200/50 pt-6">
                                    <button
                                        type="submit"
                                        disabled={
                                            submitting ||
                                            selectedEquipments.size === 0 ||
                                            !identityNumber ||
                                            !fullName ||
                                            !phoneNumber ||
                                            !purpose ||
                                            !returnDate
                                        }
                                        className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                                    >
                                        {submitting ? (
                                            <>
                                                <RefreshCw className="h-5 w-5 animate-spin" />
                                                <span>{getText('Submitting...', 'Mengirim...')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-5 w-5" />
                                                <span>{getText('Submit Request', 'Kirim Permintaan')}</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Notice */}
                                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex items-start space-x-3">
                                            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                                            <div className="text-sm text-blue-800">
                                                <p className="font-semibold mb-2">{getText('Notice', 'Perhatian')}</p>
                                                <ul className="space-y-1 text-xs">
                                                    <li>• {getText('Leave your ID card to Admin when picking up', 'Tinggalkan kartu identitas ke Admin saat pengambilan')}</li>
                                                    <li>• {getText('Please return equipment on time', 'Harap kembalikan peralatan tepat waktu')}</li>
                                                    <li>• {getText('Wait for approval before picking up', 'Tunggu persetujuan sebelum mengambil')}</li>
                                                </ul>
                                                <div className="mt-3 pt-3 border-t border-blue-300">
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open('https://wa.me/6285869554147', '_blank')}
                                                        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors shadow-sm"
                                                    >
                                                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                        </svg>
                                                        <span>{getText('Contact: 085869554147', 'Hubungi: 085869554147')}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Modals */}
            {renderDetailModal()}
            {renderFullscreenPhoto()}
        </div>
    );
};

export default ToolLending;