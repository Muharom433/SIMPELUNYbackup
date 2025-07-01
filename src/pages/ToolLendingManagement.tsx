import React, { useState, useEffect } from 'react';
import {
    Wrench, Search, Eye, Edit, Trash2, RefreshCw, Download, User, Package, 
    AlertCircle, Calendar, Clock, X, Phone, Mail, Hash, Building, Users, 
    CheckCircle, XCircle, Plus, Minus, Settings, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { Equipment, User as UserType } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface LendingRecord {
    id: string;
    created_at: string;
    updated_at: string;
    id_user: string | null;
    date: string;
    id_equipment: string[];
    qty: number[];
    user_info?: {
        full_name: string;
        identity_number: string;
        phone_number?: string;
        email?: string;
    };
    user?: UserType;
    equipment_details?: Equipment[];
}

const ToolAdministration: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();
    const [lendingRecords, setLendingRecords] = useState<LendingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<string>('all');
    const [selectedRecord, setSelectedRecord] = useState<LendingRecord | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);

    useEffect(() => {
        fetchLendingRecords();
        fetchAllEquipment();
        
        // Real-time subscription
        const subscription = supabase
            .channel('tool-administration')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'lending_tool' }, 
                () => { fetchLendingRecords(); }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchAllEquipment = async () => {
        try {
            const { data, error } = await supabase
                .from('equipment')
                .select('*')
                .order('name');

            if (error) throw error;
            setAllEquipment(data || []);
        } catch (error) {
            console.error('Error fetching equipment:', error);
        }
    };

    const fetchLendingRecords = async () => {
        try {
            setLoading(true);
            
            const { data: lendingData, error: lendingError } = await supabase
                .from('lending_tool')
                .select('*')
                .order('created_at', { ascending: false });

            if (lendingError) throw lendingError;
            if (!lendingData) { setLendingRecords([]); setLoading(false); return; }

            // Fetch user details and equipment details for each record
            const recordsWithDetails = await Promise.all(
                lendingData.map(async (record) => {
                    let user: UserType | null = null;
                    let equipmentDetails: Equipment[] = [];

                    // Fetch user data if exists
                    if (record.id_user) {
                        const { data: userData } = await supabase
                            .from('users')
                            .select('id, full_name, identity_number, email, role, phone_number')
                            .eq('id', record.id_user)
                            .maybeSingle();
                        if (userData) user = userData;
                    }

                    // Fetch equipment details
                    if (record.id_equipment && record.id_equipment.length > 0) {
                        const { data: equipmentData } = await supabase
                            .from('equipment')
                            .select('*')
                            .in('id', record.id_equipment);
                        
                        if (equipmentData) {
                            // Sort equipment to match the order in id_equipment array
                            equipmentDetails = record.id_equipment.map(id => 
                                equipmentData.find(eq => eq.id === id)
                            ).filter(Boolean) as Equipment[];
                        }
                    }

                    return { 
                        ...record, 
                        user, 
                        equipment_details: equipmentDetails 
                    };
                })
            );

            setLendingRecords(recordsWithDetails);

        } catch (error) {
            console.error('Error fetching lending records:', error);
            toast.error(getText('Failed to load lending records', 'Gagal memuat data peminjaman'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (recordId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(recordId));
            
            // Find the record to get equipment details
            const recordToDelete = lendingRecords.find(r => r.id === recordId);
            if (!recordToDelete) throw new Error("Record not found");

            // Restore equipment quantities
            for (let i = 0; i < recordToDelete.id_equipment.length; i++) {
                const equipmentId = recordToDelete.id_equipment[i];
                const quantity = recordToDelete.qty[i];
                
                const equipment = allEquipment.find(eq => eq.id === equipmentId);
                if (equipment) {
                    const newQuantity = equipment.quantity + quantity;
                    
                    await supabase
                        .from('equipment')
                        .update({ 
                            quantity: newQuantity,
                            is_available: true // Always set to available when quantity > 0
                        })
                        .eq('id', equipmentId);
                }
            }
            
            // Delete the lending record
            const { error } = await supabase
                .from('lending_tool')
                .delete()
                .eq('id', recordId);

            if (error) throw error;
            
            toast.success(getText('Lending record deleted successfully', 'Data peminjaman berhasil dihapus'));
            setShowDeleteConfirm(null);
            await fetchLendingRecords();
            await fetchAllEquipment(); // Refresh equipment list
            
        } catch (error: any) {
            console.error('Error deleting lending record:', error);
            toast.error(error.message || getText('Failed to delete lending record', 'Gagal menghapus data peminjaman'));
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(recordId);
                return newSet;
            });
        }
    };

    const filteredRecords = lendingRecords.filter(record => {
        const userName = record.user?.full_name || record.user_info?.full_name || '';
        const userIdentity = record.user?.identity_number || record.user_info?.identity_number || '';
        const equipmentNames = record.equipment_details?.map(eq => eq.name).join(' ') || '';
        
        const matchesSearch = 
            userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            userIdentity.toLowerCase().includes(searchTerm.toLowerCase()) ||
            equipmentNames.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesDate = true;
        if (dateFilter !== 'all') {
            const recordDate = new Date(record.date);
            const today = new Date();
            today.setHours(0,0,0,0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);

            switch (dateFilter) {
                case 'today': matchesDate = recordDate.toDateString() === today.toDateString(); break;
                case 'tomorrow': matchesDate = recordDate.toDateString() === tomorrow.toDateString(); break;
                case 'week': matchesDate = recordDate >= today && recordDate <= nextWeek; break;
                case 'past': matchesDate = recordDate < today; break;
            }
        }
        
        return matchesSearch && matchesDate;
    });

    const getTotalItemsInRecord = (record: LendingRecord) => {
        return record.qty.reduce((total, qty) => total + qty, 0);
    };

    const getUserDisplayName = (record: LendingRecord) => {
        return record.user?.full_name || record.user_info?.full_name || 'Unknown User';
    };

    const getUserContact = (record: LendingRecord) => {
        return record.user?.phone_number || record.user_info?.phone_number || 
               record.user?.identity_number || record.user_info?.identity_number || 'No contact';
    };

    if (profile?.role !== 'super_admin') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
                    <p className="text-gray-600">You don't have permission to access tool administration.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3">
                            <Wrench className="h-8 w-8" />
                            <span>{getText('Tool Administration', 'Administrasi Alat')}</span>
                        </h1>
                        <p className="mt-2 opacity-90">
                            {getText('Manage equipment lending records and monitor usage', 'Kelola data peminjaman peralatan dan pantau penggunaan')}
                        </p>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-2xl font-bold">{lendingRecords.length}</div>
                        <div className="text-sm opacity-80">{getText('Total Records', 'Total Data')}</div>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { 
                        label: getText('Total Lendings', 'Total Peminjaman'), 
                        count: lendingRecords.length, 
                        color: 'bg-blue-500', 
                        icon: Package 
                    },
                    { 
                        label: getText('Today', 'Hari Ini'), 
                        count: lendingRecords.filter(r => {
                            const recordDate = new Date(r.date);
                            const today = new Date();
                            return recordDate.toDateString() === today.toDateString();
                        }).length, 
                        color: 'bg-green-500', 
                        icon: Calendar 
                    },
                    { 
                        label: getText('This Week', 'Minggu Ini'), 
                        count: lendingRecords.filter(r => {
                            const recordDate = new Date(r.date);
                            const today = new Date();
                            const weekAgo = new Date(today);
                            weekAgo.setDate(weekAgo.getDate() - 7);
                            return recordDate >= weekAgo && recordDate <= today;
                        }).length, 
                        color: 'bg-purple-500', 
                        icon: Clock 
                    },
                    { 
                        label: getText('Unique Users', 'Pengguna Unik'), 
                        count: new Set(lendingRecords.map(r => r.id_user || r.user_info?.identity_number)).size, 
                        color: 'bg-orange-500', 
                        icon: Users 
                    }
                ].map((stat, index) => (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                                <p className="text-3xl font-bold text-gray-900">{stat.count}</p>
                            </div>
                            <div className={`${stat.color} p-3 rounded-xl`}>
                                <stat.icon className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder={getText("Search by user name, ID, or equipment...", "Cari berdasarkan nama, ID, atau peralatan...")}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="all">{getText('All Dates', 'Semua Tanggal')}</option>
                            <option value="today">{getText('Today', 'Hari Ini')}</option>
                            <option value="tomorrow">{getText('Tomorrow', 'Besok')}</option>
                            <option value="week">{getText('This Week', 'Minggu Ini')}</option>
                            <option value="past">{getText('Past Records', 'Data Lalu')}</option>
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => fetchLendingRecords()}
                            disabled={loading}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                            <Download className="h-4 w-4" />
                            <span>{getText('Export', 'Ekspor')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Records Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {getText('User Information', 'Informasi Pengguna')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {getText('Equipment', 'Peralatan')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {getText('Lending Date', 'Tanggal Pinjam')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {getText('Total Items', 'Total Item')}
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {getText('Actions', 'Aksi')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="flex items-center justify-center">
                                            <RefreshCw className="h-6 w-6 animate-spin text-green-600 mr-2" />
                                            <span className="text-gray-600">{getText('Loading records...', 'Memuat data...')}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="text-gray-500">
                                            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p className="text-lg font-medium mb-2">
                                                {getText('No lending records found', 'Tidak ada data peminjaman')}
                                            </p>
                                            <p>{getText('Try adjusting your search or filters', 'Coba sesuaikan pencarian atau filter')}</p>
                                            {lendingRecords.length > 0 && (
                                                <p className="text-sm mt-2">
                                                    {getText('Total records in database:', 'Total data dalam database:')} {lendingRecords.length}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => {
                                    const isProcessing = processingIds.has(record.id);
                                    return (
                                        <tr key={record.id} className="hover:bg-gray-50 transition-colors duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                                                        <User className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {getUserDisplayName(record)}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {getUserContact(record)}
                                                        </div>
                                                        {(record.user?.email || record.user_info?.email) && (
                                                            <div className="text-xs text-gray-400">
                                                                {record.user?.email || record.user_info?.email}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    {record.equipment_details?.slice(0, 2).map((equipment, index) => (
                                                        <div key={equipment.id} className="text-sm">
                                                            <span className="font-medium text-gray-900">{equipment.name}</span>
                                                            <span className="text-gray-500 ml-2">
                                                                ({record.qty[index]} {equipment.unit || 'pcs'})
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {record.equipment_details && record.equipment_details.length > 2 && (
                                                        <div className="text-xs text-gray-500">
                                                            +{record.equipment_details.length - 2} {getText('more items', 'item lainnya')}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {format(new Date(record.date), 'MMM d, yyyy')}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {format(new Date(record.date), 'h:mm a')}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                    {getTotalItemsInRecord(record)} {getText('items', 'item')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRecord(record);
                                                            setShowDetailModal(true);
                                                        }}
                                                        className="text-gray-600 hover:text-gray-900 p-1 rounded transition-colors duration-200"
                                                        title={getText('View Details', 'Lihat Detail')}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(record.id)}
                                                        disabled={isProcessing}
                                                        className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-200 disabled:opacity-50"
                                                        title={getText('Delete Record', 'Hapus Data')}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedRecord && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {getText('Lending Record Details', 'Detail Data Peminjaman')}
                                </h3>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* User Information */}
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                                        {getText('User Information', 'Informasi Pengguna')}
                                    </h4>
                                    <div className="bg-blue-50 rounded-lg p-4">
                                        <div className="flex items-center space-x-4">
                                            <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                                                <User className="h-6 w-6 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-600">
                                                            {getText('Full Name', 'Nama Lengkap')}
                                                        </label>
                                                        <p className="text-gray-900 font-medium">
                                                            {getUserDisplayName(selectedRecord)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-600">
                                                            {getText('Identity Number', 'Nomor Identitas')}
                                                        </label>
                                                        <p className="text-gray-900 font-medium">
                                                            {selectedRecord.user?.identity_number || selectedRecord.user_info?.identity_number || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-600">
                                                            {getText('Phone Number', 'Nomor Telepon')}
                                                        </label>
                                                        <p className="text-gray-900 font-medium">
                                                            {selectedRecord.user?.phone_number || selectedRecord.user_info?.phone_number || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-600">
                                                            {getText('Email', 'Email')}
                                                        </label>
                                                        <p className="text-gray-900 font-medium">
                                                            {selectedRecord.user?.email || selectedRecord.user_info?.email || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Lending Information */}
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                                        {getText('Lending Information', 'Informasi Peminjaman')}
                                    </h4>
                                    <div className="bg-green-50 rounded-lg p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-gray-600">
                                                    {getText('Lending Date', 'Tanggal Pinjam')}
                                                </label>
                                                <p className="text-gray-900 font-medium">
                                                    {format(new Date(selectedRecord.date), 'MMM d, yyyy h:mm a')}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-600">
                                                    {getText('Record Created', 'Data Dibuat')}
                                                </label>
                                                <p className="text-gray-900 font-medium">
                                                    {format(new Date(selectedRecord.created_at), 'MMM d, yyyy h:mm a')}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-600">
                                                    {getText('Total Items', 'Total Item')}
                                                </label>
                                                <p className="text-gray-900 font-medium">
                                                    {getTotalItemsInRecord(selectedRecord)} {getText('items', 'item')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Equipment Details */}
                                <div>
                                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                                        {getText('Equipment Details', 'Detail Peralatan')}
                                    </h4>
                                    <div className="space-y-3">
                                        {selectedRecord.equipment_details?.map((equipment, index) => (
                                            <div key={equipment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                                <div className="flex items-center space-x-4">
                                                    <div className="h-10 w-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
                                                        <Package className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <h5 className="font-medium text-gray-900">{equipment.name}</h5>
                                                        <p className="text-sm text-gray-600">{equipment.code}</p>
                                                        <div className="flex items-center space-x-4 mt-1">
                                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                                                {equipment.category}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {getText('Condition:', 'Kondisi:')} {equipment.condition || 'Good'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-gray-900">
                                                        {selectedRecord.qty[index]}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {equipment.unit || 'pcs'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center mb-4">
                            <div className="flex-shrink-0">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-lg font-medium text-gray-900">
                                    {getText('Delete Lending Record', 'Hapus Data Peminjaman')}
                                </h3>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">
                            {getText(
                                'Are you sure you want to delete this lending record? This will restore the equipment quantities and cannot be undone.',
                                'Apakah Anda yakin ingin menghapus data peminjaman ini? Ini akan mengembalikan jumlah peralatan dan tidak dapat dibatalkan.'
                            )}
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                            >
                                {getText('Cancel', 'Batal')}
                            </button>
                            <button
                                onClick={() => handleDelete(showDeleteConfirm)}
                                disabled={processingIds.has(showDeleteConfirm)}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                {processingIds.has(showDeleteConfirm) ? (
                                    <div className="flex items-center justify-center">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        {getText('Deleting...', 'Menghapus...')}
                                    </div>
                                ) : (
                                    getText('Delete', 'Hapus')
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToolLendingManagement;