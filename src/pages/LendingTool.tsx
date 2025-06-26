import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Package, Plus, Minus, Search, User, Phone, Mail, Hash, Calendar, Clock, 
    CheckCircle, AlertCircle, Trash2, Loader2, Send, Eye, Building, 
    ChevronDown, Settings, Wrench, Zap, ShoppingCart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { Equipment, User as UserType } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const lendingSchema = z.object({
    full_name: z.string().min(3, 'Full name must be at least 3 characters'),
    identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
    phone_number: z.string().min(10, 'Please enter a valid phone number'),
    email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
    date: z.string().min(1, 'Please select lending date'),
});

type LendingForm = z.infer<typeof lendingSchema>;

interface SelectedEquipment {
    equipment: Equipment;
    quantity: number;
}

interface ExistingUser {
    id: string;
    identity_number: string;
    full_name: string;
    email: string;
    phone_number?: string;
}

const ToolLending: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<SelectedEquipment[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);
    const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
    const [identitySearchTerm, setIdentitySearchTerm] = useState('');
    const [currentTime] = useState(new Date());

    const form = useForm<LendingForm>({
        resolver: zodResolver(lendingSchema),
        defaultValues: {
            date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
        }
    });

    const watchIdentityNumber = form.watch('identity_number');

    useEffect(() => {
        fetchAvailableEquipment();
        fetchExistingUsers();
    }, []);

    useEffect(() => {
        if (watchIdentityNumber && watchIdentityNumber.length >= 5) {
            const existingUser = existingUsers.find(user => user.identity_number === watchIdentityNumber);
            if (existingUser) {
                form.setValue('full_name', existingUser.full_name);
                if (existingUser.phone_number) form.setValue('phone_number', existingUser.phone_number);
                if (existingUser.email) form.setValue('email', existingUser.email);
                toast.success(getText('Data automatically filled!', 'Data otomatis terisi!'));
            }
        }
    }, [watchIdentityNumber, existingUsers, form, getText]);

    const fetchAvailableEquipment = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('equipment')
                .select('*')
                .eq('is_available', true)
                .is('rooms_id', null) // Only equipment not tied to specific rooms
                .gt('quantity', 0)
                .order('name');

            if (error) throw error;
            setAvailableEquipment(data || []);
        } catch (error) {
            console.error('Error fetching equipment:', error);
            toast.error(getText('Failed to load equipment.', 'Gagal memuat peralatan.'));
        } finally {
            setLoading(false);
        }
    };

    const fetchExistingUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, identity_number, full_name, email, phone_number')
                .eq('role', 'student')
                .order('full_name');

            if (error) throw error;
            setExistingUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const addEquipment = (equipment: Equipment) => {
        const existing = selectedEquipment.find(item => item.equipment.id === equipment.id);
        if (existing) {
            if (existing.quantity < equipment.quantity) {
                setSelectedEquipment(prev =>
                    prev.map(item =>
                        item.equipment.id === equipment.id
                            ? { ...item, quantity: item.quantity + 1 }
                            : item
                    )
                );
            } else {
                toast.error(`Maximum available quantity is ${equipment.quantity}`);
            }
        } else {
            setSelectedEquipment(prev => [...prev, { equipment, quantity: 1 }]);
        }
    };

    const updateQuantity = (equipmentId: string, newQuantity: number) => {
        const equipment = availableEquipment.find(eq => eq.id === equipmentId);
        if (!equipment) return;

        if (newQuantity <= 0) {
            removeEquipment(equipmentId);
        } else if (newQuantity <= equipment.quantity) {
            setSelectedEquipment(prev =>
                prev.map(item =>
                    item.equipment.id === equipmentId
                        ? { ...item, quantity: newQuantity }
                        : item
                )
            );
        } else {
            toast.error(`Maximum available quantity is ${equipment.quantity}`);
        }
    };

    const removeEquipment = (equipmentId: string) => {
        setSelectedEquipment(prev => prev.filter(item => item.equipment.id !== equipmentId));
    };

    const onSubmit = async (data: LendingForm) => {
        if (selectedEquipment.length === 0) {
            toast.error(getText('Please select at least one equipment', 'Silakan pilih minimal satu peralatan'));
            return;
        }

        setSubmitting(true);
        try {
            // Prepare equipment IDs and quantities
            const equipmentIds = selectedEquipment.map(item => item.equipment.id);
            const quantities = selectedEquipment.map(item => item.quantity);

            // Create lending record
            const lendingData = {
                date: new Date(data.date).toISOString(),
                id_equipment: equipmentIds,
                qty: quantities,
                id_user: profile?.id || null,
                user_info: profile ? null : {
                    full_name: data.full_name,
                    identity_number: data.identity_number,
                    phone_number: data.phone_number,
                    email: data.email || `${data.identity_number}@student.edu`,
                }
            };

            const { error: lendingError } = await supabase
                .from('lending_tool')
                .insert(lendingData);

            if (lendingError) throw lendingError;

            // Update equipment quantities
            for (const item of selectedEquipment) {
                const newQuantity = item.equipment.quantity - item.quantity;
                const { error: updateError } = await supabase
                    .from('equipment')
                    .update({ 
                        quantity: newQuantity,
                        is_available: newQuantity > 0
                    })
                    .eq('id', item.equipment.id);

                if (updateError) {
                    console.error('Error updating equipment quantity:', updateError);
                }
            }

            toast.success(getText('Equipment lending request submitted successfully!', 'Permintaan peminjaman peralatan berhasil dikirim!'));
            
            // Reset form and selections
            form.reset({
                date: format(new Date(), "yyyy-MM-dd'T'HH:mm")
            });
            setSelectedEquipment([]);
            setIdentitySearchTerm('');
            
            // Refresh equipment list
            await fetchAvailableEquipment();

        } catch (error: any) {
            console.error('Error creating lending request:', error);
            toast.error(error.message || getText('Failed to create lending request', 'Gagal membuat permintaan peminjaman'));
        } finally {
            setSubmitting(false);
        }
    };

    const filteredEquipment = availableEquipment.filter(equipment => {
        const matchesSearch = equipment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            equipment.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || equipment.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const filteredIdentityNumbers = existingUsers.filter(user =>
        user.identity_number.toLowerCase().includes(identitySearchTerm.toLowerCase()) ||
        user.full_name.toLowerCase().includes(identitySearchTerm.toLowerCase())
    );

    const categories = [...new Set(availableEquipment.map(eq => eq.category))];

    const getTotalSelectedItems = () => {
        return selectedEquipment.reduce((total, item) => total + item.quantity, 0);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header Section */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl shadow-lg">
                                <Package className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                    {getText('Tool Lending', 'Peminjaman Alat')}
                                </h1>
                                <p className="text-gray-600 mt-1">
                                    {getText('Borrow equipment for your activities', 'Pinjam peralatan untuk kegiatan Anda')}
                                </p>
                            </div>
                        </div>
                        {selectedEquipment.length > 0 && (
                            <div className="hidden md:block">
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-gray-800">
                                        {getTotalSelectedItems()} {getText('items', 'item')}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {selectedEquipment.length} {getText('types selected', 'jenis dipilih')}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Equipment Selection (7/12 width) */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Search and Filter Controls */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <div className="flex-1 relative w-full">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={getText("Search equipment...", "Cari peralatan...")}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                                    />
                                </div>
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="px-4 py-4 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all duration-200"
                                >
                                    <option value="all">{getText('All Categories', 'Semua Kategori')}</option>
                                    {categories.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Equipment Grid */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {getText('Available Equipment', 'Peralatan Tersedia')}
                                </h2>
                                <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                    {filteredEquipment.length} {getText('items', 'item')}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                                {filteredEquipment.map((equipment) => {
                                    const selectedItem = selectedEquipment.find(item => item.equipment.id === equipment.id);
                                    const isSelected = !!selectedItem;
                                    
                                    return (
                                        <div
                                            key={equipment.id}
                                            className={`group p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                                                isSelected
                                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-500 shadow-lg'
                                                    : 'bg-white/80 hover:bg-white border-gray-200/50 hover:shadow-md'
                                            }`}
                                            onClick={() => addEquipment(equipment)}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h3 className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                                        {equipment.name}
                                                    </h3>
                                                    <p className={`text-sm ${isSelected ? 'text-green-100' : 'text-gray-500'}`}>
                                                        {equipment.code}
                                                    </p>
                                                    <div className="flex items-center space-x-2 mt-2">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                                                            isSelected 
                                                                ? 'bg-white/20 text-white' 
                                                                : 'bg-blue-100 text-blue-800'
                                                        }`}>
                                                            {equipment.category}
                                                        </span>
                                                        <span className={`text-sm ${isSelected ? 'text-green-100' : 'text-gray-600'}`}>
                                                            {equipment.quantity} {equipment.unit || 'pcs'} {getText('available', 'tersedia')}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-1">
                                                        <span className="text-white font-bold">{selectedItem.quantity}</span>
                                                        <CheckCircle className="h-4 w-4 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {equipment.specification && (
                                                <p className={`text-xs ${isSelected ? 'text-green-100' : 'text-gray-500'} mb-2`}>
                                                    {equipment.specification}
                                                </p>
                                            )}
                                            
                                            <div className="flex items-center justify-between">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                    isSelected 
                                                        ? 'bg-white/20 text-white' 
                                                        : equipment.condition === 'good' 
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {getText(
                                                        equipment.condition === 'good' ? 'Good Condition' : 'Fair Condition',
                                                        equipment.condition === 'good' ? 'Kondisi Baik' : 'Kondisi Cukup'
                                                    )}
                                                </span>
                                                {isSelected && (
                                                    <div className="flex items-center space-x-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                updateQuantity(equipment.id, selectedItem.quantity - 1);
                                                            }}
                                                            className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
                                                        >
                                                            <Minus className="h-3 w-3 text-white" />
                                                        </button>
                                                        <span className="text-white font-bold px-2">{selectedItem.quantity}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                updateQuantity(equipment.id, selectedItem.quantity + 1);
                                                            }}
                                                            className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
                                                        >
                                                            <Plus className="h-3 w-3 text-white" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredEquipment.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                        <Package className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                        {getText('No Equipment Available', 'Tidak Ada Peralatan Tersedia')}
                                    </h3>
                                    <p className="text-gray-500">
                                        {getText('Try adjusting your search or category filter.', 'Coba sesuaikan pencarian atau filter kategori.')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Form and Cart (5/12 width) */}
                    <div className="lg:col-span-5">
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 sticky top-24">
                            <div className="flex items-center space-x-3 mb-8">
                                <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                                    <ShoppingCart className="h-5 w-5 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {getText('Lending Request', 'Permintaan Peminjaman')}
                                </h2>
                            </div>

                            {/* Selected Equipment Cart */}
                            {selectedEquipment.length > 0 && (
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {getText('Selected Equipment', 'Peralatan Dipilih')}
                                        </h3>
                                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                            {getTotalSelectedItems()} {getText('items', 'item')}
                                        </span>
                                    </div>
                                    <div className="space-y-3 max-h-48 overflow-y-auto">
                                        {selectedEquipment.map((item) => (
                                            <div key={item.equipment.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-xl">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-gray-800">{item.equipment.name}</h4>
                                                    <p className="text-sm text-gray-600">{item.equipment.code}</p>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <div className="flex items-center space-x-2 bg-white/80 rounded-lg px-3 py-1">
                                                        <button
                                                            onClick={() => updateQuantity(item.equipment.id, item.quantity - 1)}
                                                            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </button>
                                                        <span className="font-bold text-gray-800 min-w-[2rem] text-center">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => updateQuantity(item.equipment.id, item.quantity + 1)}
                                                            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => removeEquipment(item.equipment.id)}
                                                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {!profile && (
                                    <div className="space-y-6">
                                        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                                            <User className="h-5 w-5 text-green-500" />
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {getText('Personal Information', 'Informasi Pribadi')}
                                            </h3>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        {...form.register('identity_number')}
                                                        type="text"
                                                        placeholder={getText("Enter or select your ID", "Masukkan atau pilih ID Anda")}
                                                        value={identitySearchTerm}
                                                        onChange={(e) => {
                                                            setIdentitySearchTerm(e.target.value);
                                                            form.setValue('identity_number', e.target.value);
                                                            setShowIdentityDropdown(true);
                                                        }}
                                                        onFocus={() => setShowIdentityDropdown(true)}
                                                        className="w-full px-4 py-3 pr-10 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all duration-200"
                                                    />
                                                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    {showIdentityDropdown && filteredIdentityNumbers.length > 0 && (
                                                        <div
                                                            onMouseLeave={() => setShowIdentityDropdown(false)}
                                                            className="absolute z-10 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                                                        >
                                                            {filteredIdentityNumbers.map((user) => (
                                                                <div
                                                                    key={user.id}
                                                                    onClick={() => {
                                                                        setIdentitySearchTerm(user.identity_number);
                                                                        form.setValue('identity_number', user.identity_number);
                                                                        setShowIdentityDropdown(false);
                                                                    }}
                                                                    className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150"
                                                                >
                                                                    <div className="font-semibold text-gray-800">{user.identity_number}</div>
                                                                    <div className="text-sm text-gray-600">{user.full_name}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {form.formState.errors.identity_number && (
                                                    <p className="mt-2 text-sm text-red-600 font-medium">
                                                        {form.formState.errors.identity_number.message}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    {getText('Full Name', 'Nama Lengkap')} *
                                                </label>
                                                <input
                                                    {...form.register('full_name')}
                                                    type="text"
                                                    placeholder={getText("Enter your full name", "Masukkan nama lengkap Anda")}
                                                    className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all duration-200"
                                                />
                                                {form.formState.errors.full_name && (
                                                    <p className="mt-2 text-sm text-red-600 font-medium">
                                                        {form.formState.errors.full_name.message}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    {getText('Phone Number', 'Nomor Telepon')} *
                                                </label>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                                    <input
                                                        {...form.register('phone_number')}
                                                        type="tel"
                                                        placeholder="08xxxxxxxxxx"
                                                        className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all duration-200"
                                                    />
                                                </div>
                                                {form.formState.errors.phone_number && (
                                                    <p className="mt-2 text-sm text-red-600 font-medium">
                                                        {form.formState.errors.phone_number.message}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    {getText('Email', 'Email')} ({getText('Optional', 'Opsional')})
                                                </label>
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                                    <input
                                                        {...form.register('email')}
                                                        type="email"
                                                        placeholder="your.email@example.com"
                                                        className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all duration-200"
                                                    />
                                                </div>
                                                {form.formState.errors.email && (
                                                    <p className="mt-2 text-sm text-red-600 font-medium">
                                                        {form.formState.errors.email.message}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3 pb-4 border-b border-gray-200/50">
                                        <Calendar className="h-5 w-5 text-green-500" />
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {getText('Lending Details', 'Detail Peminjaman')}
                                        </h3>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            {getText('Lending Date & Time', 'Tanggal & Waktu Peminjaman')} *
                                        </label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                            <input
                                                {...form.register('date')}
                                                type="datetime-local"
                                                className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all duration-200"
                                            />
                                        </div>
                                        {form.formState.errors.date && (
                                            <p className="mt-2 text-sm text-red-600 font-medium">
                                                {form.formState.errors.date.message}
                                            </p>
                                        )}
                                    </div>

                                    {selectedEquipment.length === 0 && (
                                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200/50 rounded-xl p-4">
                                            <div className="flex items-start space-x-3">
                                                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                                <div className="text-sm text-yellow-800">
                                                    <p className="font-semibold">
                                                        {getText('No Equipment Selected', 'Tidak Ada Peralatan Dipilih')}
                                                    </p>
                                                    <p className="mt-1">
                                                        {getText('Please select at least one equipment from the list above.', 'Silakan pilih minimal satu peralatan dari daftar di atas.')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-gray-200/50">
                                    <button
                                        type="submit"
                                        disabled={selectedEquipment.length === 0 || submitting}
                                        className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                <span>{getText('Submitting...', 'Mengirim...')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-5 w-5" />
                                                <span>{getText('Submit Lending Request', 'Kirim Permintaan Peminjaman')}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ToolLending;