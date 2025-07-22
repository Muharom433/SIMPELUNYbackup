import React, { useState, useEffect } from 'react';
import {
    Wrench, Search, Eye, Edit, Trash2, RefreshCw, Download, User, Package, 
    AlertCircle, Calendar, Clock, X, Phone, Mail, Hash, Building, Users, 
    CheckCircle, XCircle, Plus, Minus, Settings, Loader2,
    FileText, Check, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import EquipmentQuantityManager from '../lib/equipmentQuantityManager';
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
    status: 'pending' | 'approved' | 'rejected' | 'borrow' | 'completed'; // ✅ TAMBAH STATUS
    attachments?: string[]; // ✅ TAMBAH ATTACHMENTS
    user_info?: {
        full_name: string;
        identity_number: string;
        phone_number?: string;
        email?: string;
    };
    user?: UserType;
    equipment_details?: Equipment[];
}

const ToolLendingManagement: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();
    const [lendingRecords, setLendingRecords] = useState<LendingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all'); // ✅ FILTER STATUS
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

    // ✅ TAMBAH FUNGSI APPROVAL/REJECTION
    
const handleStatusUpdate = async (recordId: string, newStatus: 'approved' | 'rejected') => {
  try {
    setProcessingIds(prev => new Set(prev).add(recordId));
    
    const record = lendingRecords.find(r => r.id === recordId);
    if (!record) throw new Error("Lending record not found");

    console.log('🔧 FIXED: Updating lending status with equipment management:', {
      recordId: record.id,
      currentStatus: record.status,
      newStatus,
      id_equipment: record.id_equipment,
      qty: record.qty
    });

    // ✅ ADD: Equipment quantity management (same as BookingManagement)
    if (record.id_equipment && record.id_equipment.length > 0) {
      const validEquipmentList = [];
      const invalidEquipment = [];
      
      for (let i = 0; i < record.id_equipment.length; i++) {
        const equipmentId = record.id_equipment[i];
        const quantity = record.qty?.[i] || 1;
        
        console.log(`🔍 Validating equipment ${i + 1}/${record.id_equipment.length}:`, {
          equipmentId,
          quantity,
          index: i
        });

        // ✅ CHECK: Does equipment exist and has sufficient quantity?
        const { data: equipment, error: checkError } = await supabase
          .from('equipment')
          .select('id, name, quantity')
          .eq('id', equipmentId)
          .single();

        if (checkError || !equipment) {
          console.warn(`⚠️ Equipment ${equipmentId} not found - will be skipped`);
          invalidEquipment.push({ equipmentId, index: i, reason: 'not_found' });
          continue; // Skip missing equipment
        }

        // For approval, check sufficient quantity
        if (newStatus === 'approved' && equipment.quantity < quantity) {
          console.warn(`⚠️ Equipment ${equipmentId} insufficient quantity: need ${quantity}, available ${equipment.quantity}`);
          invalidEquipment.push({ 
            equipmentId, 
            index: i, 
            reason: 'insufficient', 
            available: equipment.quantity, 
            needed: quantity 
          });
          continue; // Skip insufficient equipment
        }

        console.log(`✅ Equipment validated:`, {
          id: equipment.id,
          name: equipment.name,
          availableQuantity: equipment.quantity,
          requestedQuantity: quantity
        });

        validEquipmentList.push({
          id: equipmentId,
          quantity: quantity,
          currentQuantity: equipment.quantity,
          name: equipment.name
        });
      }

      // ✅ REPORT: Invalid equipment found
      if (invalidEquipment.length > 0) {
        console.warn('⚠️ Invalid equipment found:', invalidEquipment);
        
        const notFoundCount = invalidEquipment.filter(eq => eq.reason === 'not_found').length;
        const insufficientCount = invalidEquipment.filter(eq => eq.reason === 'insufficient').length;
        
        let warningMessage = '';
        if (notFoundCount > 0) {
          warningMessage += `${notFoundCount} equipment not found in database. `;
        }
        if (insufficientCount > 0) {
          warningMessage += `${insufficientCount} equipment has insufficient quantity. `;
        }
        
        // ✅ OPTION 1: Skip invalid equipment and continue with valid ones
        if (validEquipmentList.length > 0) {
          warningMessage += `Continuing with ${validEquipmentList.length} valid equipment.`;
          toast.warning(warningMessage);
        } else {
          // ✅ OPTION 2: No valid equipment, cannot proceed with equipment updates
          warningMessage += 'No valid equipment to process.';
          toast.warning(warningMessage);
          
          // Still update record status but skip equipment updates
          console.log('ℹ️ Proceeding with status update only (no equipment changes)');
        }
      }

      // ✅ PROCESS: Only valid equipment
      if (validEquipmentList.length > 0) {
        console.log('✅ Processing valid equipment list:', validEquipmentList);

        for (const equipmentItem of validEquipmentList) {
          if (newStatus === 'approved') {
            // ✅ APPROVED: Decrease quantity
            console.log(`📉 Decreasing ${equipmentItem.id} by ${equipmentItem.quantity}`);
            
            const newQuantity = equipmentItem.currentQuantity - equipmentItem.quantity;
            const { error: updateError } = await supabase
              .from('equipment')
              .update({ 
                quantity: newQuantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', equipmentItem.id);
              
            if (updateError) {
              console.error(`❌ Failed to update ${equipmentItem.id}:`, updateError);
              // Continue with other equipment instead of failing completely
            } else {
              console.log(`✅ ${equipmentItem.name}: ${equipmentItem.currentQuantity} → ${newQuantity}`);
            }
            
          } else if (newStatus === 'rejected' && (record.status === 'approved' || record.status === 'borrow')) {
            // ✅ REJECTED: Restore quantity
            console.log(`📈 Restoring ${equipmentItem.id} by ${equipmentItem.quantity}`);
            
            const newQuantity = equipmentItem.currentQuantity + equipmentItem.quantity;
            const { error: updateError } = await supabase
              .from('equipment')
              .update({ 
                quantity: newQuantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', equipmentItem.id);
              
            if (updateError) {
              console.error(`❌ Failed to restore ${equipmentItem.id}:`, updateError);
            } else {
              console.log(`✅ ${equipmentItem.name}: ${equipmentItem.currentQuantity} → ${newQuantity}`);
            }
          }
        }
      }
    }

    // ✅ UPDATE LENDING STATUS (always proceed with this)
    let finalStatus = newStatus;
    if (newStatus === 'approved') {
      finalStatus = 'borrow'; // Change to 'borrow' when approved
    }
    
    const { error: recordError } = await supabase
      .from('lending_tool')
      .update({ 
        status: finalStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId);

    if (recordError) throw recordError;
    
    console.log('✅ FIXED: Lending status updated successfully');
    
    // Success notification
    const statusText = newStatus === 'approved' 
      ? getText('approved', 'disetujui') 
      : getText('rejected', 'ditolak');
    
    toast.success(getText(`Tool lending ${statusText} successfully`, `Peminjaman alat berhasil ${statusText}`));
    
    // Refresh data
    await fetchLendingRecords();
    await fetchAllEquipment();
    
    // Close modal if open
    if (selectedRecord?.id === recordId) {
      setShowDetailModal(false);
    }
    
  } catch (error: any) {
    console.error('❌ Error updating lending status:', error);
    toast.error(error.message || getText('Failed to update lending status', 'Gagal memperbarui status peminjaman'));
  } finally {
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(recordId);
      return newSet;
    });
  }
};
    const handleDelete = async (recordId: string) => {
  try {
    setProcessingIds(prev => new Set(prev).add(recordId));
    
    const recordToDelete = lendingRecords.find(r => r.id === recordId);
    if (!recordToDelete) throw new Error("Record not found");

    console.log('🗑️ Deleting lending record:', {
      id: recordToDelete.id,
      status: recordToDelete.status,
      id_equipment: recordToDelete.id_equipment,
      qty: recordToDelete.qty
    });

    // ✅ SIMPLE: Restore equipment quantities if the record was approved/borrow
    if (recordToDelete.status === 'approved' || recordToDelete.status === 'borrow') {
      const quantityManager = new EquipmentQuantityManager(supabase);
      
      // Build equipment list
      const equipmentList: Array<{id: string, quantity: number}> = [];
      
      for (let i = 0; i < recordToDelete.id_equipment.length; i++) {
        const equipmentId = recordToDelete.id_equipment[i];
        const quantity = recordToDelete.qty && recordToDelete.qty[i] ? recordToDelete.qty[i] : 1;
        
        equipmentList.push({ id: equipmentId, quantity });
      }

      // ✅ RESTORE: Tambahkan kembali quantity
      await quantityManager.bulkIncreaseQuantity(
        equipmentList, 
        `Tool lending deleted: ${recordToDelete.id}`
      );
      
      console.log(`✅ Equipment quantities restored after lending deletion`);
    }
    
    // ✅ Delete the lending record
    const { error } = await supabase
      .from('lending_tool')
      .delete()
      .eq('id', recordId);

    if (error) throw error;
    
    toast.success(getText('Lending record deleted successfully', 'Data peminjaman berhasil dihapus'));
    setShowDeleteConfirm(null);
    await fetchLendingRecords();
    await fetchAllEquipment(); // Refresh equipment data
    
  } catch (error: any) {
    console.error('❌ Error deleting lending record:', error);
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
        
        // ✅ FILTER STATUS
        const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
        
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
        
        return matchesSearch && matchesStatus && matchesDate;
    });

    const getUserDisplayName = (record: LendingRecord) => {
        return record.user?.full_name || record.user_info?.full_name || 'Unknown User';
    };

    const getUserContact = (record: LendingRecord) => {
        return record.user?.phone_number || record.user_info?.phone_number || 
               record.user?.identity_number || record.user_info?.identity_number || 'No contact';
    };

    // ✅ FUNGSI STATUS COLOR
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'approved': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            case 'borrow': return 'bg-blue-100 text-blue-800';
            case 'completed': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return Clock;
            case 'approved': return CheckCircle;
            case 'rejected': return XCircle;
            case 'borrow': return Package;
            case 'completed': return Check;
            default: return AlertCircle;
        }
    };

    const getTotalItemsInRecord = (record: LendingRecord) => {
        return record.qty.reduce((total, qty) => total + qty, 0);
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
                            <span>{getText('Tool Lending Management', 'Manajemen Peminjaman Alat')}</span>
                        </h1>
                        <p className="mt-2 opacity-90">
                            {getText('Manage equipment lending requests and monitor usage', 'Kelola permintaan peminjaman peralatan dan pantau penggunaan')}
                        </p>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-2xl font-bold">{lendingRecords.length}</div>
                        <div className="text-sm opacity-80">{getText('Total Records', 'Total Data')}</div>
                    </div>
                </div>
            </div>

            {/* ✅ STATISTICS CARDS - DENGAN STATUS BARU */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {[
                    { 
                        label: getText('Pending', 'Menunggu'), 
                        count: lendingRecords.filter(r => r.status === 'pending').length, 
                        color: 'bg-yellow-500', 
                        icon: Clock 
                    },
                    { 
                        label: getText('Approved', 'Disetujui'), 
                        count: lendingRecords.filter(r => r.status === 'approved').length, 
                        color: 'bg-green-500', 
                        icon: CheckCircle 
                    },
                    { 
                        label: getText('Rejected', 'Ditolak'), 
                        count: lendingRecords.filter(r => r.status === 'rejected').length, 
                        color: 'bg-red-500', 
                        icon: XCircle 
                    },
                    { 
                        label: getText('Borrowed', 'Dipinjam'), 
                        count: lendingRecords.filter(r => r.status === 'borrow').length, 
                        color: 'bg-blue-500', 
                        icon: Package 
                    },
                    { 
                        label: getText('Completed', 'Selesai'), 
                        count: lendingRecords.filter(r => r.status === 'completed').length, 
                        color: 'bg-gray-500', 
                        icon: Check 
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

            {/* ✅ FILTERS - DENGAN STATUS FILTER */}
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

                        {/* ✅ STATUS FILTER */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="all">{getText('All Status', 'Semua Status')}</option>
                            <option value="pending">{getText('Pending', 'Menunggu')}</option>
                            <option value="approved">{getText('Approved', 'Disetujui')}</option>
                            <option value="rejected">{getText('Rejected', 'Ditolak')}</option>
                            <option value="borrow">{getText('Borrowed', 'Dipinjam')}</option>
                            <option value="completed">{getText('Completed', 'Selesai')}</option>
                        </select>

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

            {/* ✅ RECORDS TABLE - DENGAN STATUS DAN ACTIONS */}
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
                                    {getText('Date & Total', 'Tanggal & Total')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {getText('Status', 'Status')}
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
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => {
                                    const isProcessing = processingIds.has(record.id);
                                    const StatusIcon = getStatusIcon(record.status);
                                    
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
                                                    <div className="mt-1">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            {getTotalItemsInRecord(record)} {getText('items', 'item')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                    {getText(record.status.charAt(0).toUpperCase() + record.status.slice(1), record.status.toUpperCase())}
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
                                                    
                                                    {/* ✅ APPROVE/REJECT BUTTONS */}
                                                    {record.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleStatusUpdate(record.id, 'approved')}
                                                                disabled={isProcessing}
                                                                className="text-green-600 hover:text-green-800 p-1 rounded transition-colors duration-200 disabled:opacity-50"
                                                                title={getText('Approve', 'Setujui')}
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </button>
                                                            
                                                            <button
                                                                onClick={() => handleStatusUpdate(record.id, 'rejected')}
                                                                disabled={isProcessing}
                                                                className="text-red-600 hover:text-red-800 p-1 rounded transition-colors duration-200 disabled:opacity-50"
                                                                title={getText('Reject', 'Tolak')}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    
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

            {/* ✅ DETAIL MODAL - DENGAN ATTACHMENTS DAN ACTIONS */}
            {showDetailModal && selectedRecord && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {getText('Tool Lending Details', 'Detail Peminjaman Alat')}
                                </h3>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Status Badge */}
                                <div className="flex items-center space-x-2">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedRecord.status)}`}>
                                        {React.createElement(getStatusIcon(selectedRecord.status), { className: "h-4 w-4 mr-1" })}
                                        {getText(selectedRecord.status.charAt(0).toUpperCase() + selectedRecord.status.slice(1), selectedRecord.status.toUpperCase())}
                                    </span>
                                </div>

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

                                {/* ✅ ATTACHMENTS SECTION */}
                                {selectedRecord.attachments && selectedRecord.attachments.length > 0 && (
                                    <div>
                                        <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                                            <FileText className="h-5 w-5 mr-2 text-green-600" />
                                            {getText('Permit Documents', 'Dokumen Izin')}
                                            <span className="ml-2 text-sm text-gray-500">({selectedRecord.attachments.length} files)</span>
                                        </h4>
                                        
                                        <div className="bg-green-50 rounded-lg p-4">
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                {selectedRecord.attachments.map((attachment, index) => {
                                                    const isPDF = attachment.startsWith('data:application/pdf') || attachment.toLowerCase().includes('.pdf');
                                                    
                                                    return (
                                                        <div key={index} className="relative group">
                                                            <div 
                                                                onClick={() => window.open(attachment, '_blank')}
                                                                className="cursor-pointer bg-white rounded-lg border border-green-200 p-3 hover:shadow-md transition-all duration-200 hover:scale-105"
                                                            >
                                                                {isPDF ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <div className="h-16 w-16 bg-red-100 rounded-lg flex items-center justify-center mb-2">
                                                                            <FileText className="h-8 w-8 text-red-600" />
                                                                        </div>
                                                                        <span className="text-xs text-center text-gray-700 font-medium">
                                                                            PDF Document
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="relative">
                                                                        <img
                                                                            src={attachment}
                                                                            alt={`Permit Document ${index + 1}`}
                                                                            className="w-full h-16 object-cover rounded-lg mb-2"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center">
                                                                            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                                                        </div>
                                                                        <span className="text-xs text-center text-gray-700 font-medium block">
                                                                            Image File
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const modal = document.createElement('div');
                                                                    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
                                                                    modal.onclick = () => document.body.removeChild(modal);
                                                                    
                                                                    if (isPDF) {
                                                                        modal.innerHTML = `
                                                                            <div class="bg-white rounded-lg p-4 max-w-4xl w-full h-full max-h-[90vh] overflow-auto">
                                                                                <div class="flex justify-between items-center mb-4">
                                                                                    <h3 class="text-lg font-semibold">PDF Document</h3>
                                                                                    <button onclick="document.body.removeChild(this.closest('.fixed'))" class="text-gray-500 hover:text-gray-700">
                                                                                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                                                        </svg>
                                                                                    </button>
                                                                                </div>
                                                                                <iframe src="${attachment}" class="w-full h-full" frameborder="0"></iframe>
                                                                            </div>
                                                                        `;
                                                                    } else {
                                                                        modal.innerHTML = `
                                                                            <div class="relative max-w-4xl max-h-[90vh]">
                                                                                <img src="${attachment}" alt="Document" class="max-w-full max-h-full object-contain rounded-lg" />
                                                                                <button onclick="document.body.removeChild(this.closest('.fixed'))" class="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75">
                                                                                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>
                                                                        `;
                                                                    }
                                                                    
                                                                    document.body.appendChild(modal);
                                                                }}
                                                                className="absolute top-1 right-1 bg-green-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-green-700"
                                                                title={getText('Quick View', 'Lihat Cepat')}
                                                            >
                                                                <Eye className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            
                                            <div className="mt-4 pt-4 border-t border-green-200">
                                                <button
                                                    onClick={() => {
                                                        selectedRecord.attachments?.forEach((attachment, index) => {
                                                            const link = document.createElement('a');
                                                            link.href = attachment;
                                                            link.download = `permit_document_${index + 1}${attachment.startsWith('data:application/pdf') ? '.pdf' : '.jpg'}`;
                                                            link.click();
                                                        });
                                                        toast.success(getText('Documents downloaded', 'Dokumen berhasil diunduh'));
                                                    }}
                                                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                                                >
                                                    <Download className="h-4 w-4" />
                                                    <span>{getText('Download All Documents', 'Unduh Semua Dokumen')}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ✅ ACTIONS UNTUK PENDING STATUS */}
                                {selectedRecord.status === 'pending' && (
                                    <div className="flex space-x-3 pt-4 border-t">
                                        <button
                                            onClick={() => {
                                                handleStatusUpdate(selectedRecord.id, 'approved');
                                                setShowDetailModal(false);
                                            }}
                                            disabled={processingIds.has(selectedRecord.id)}
                                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                        >
                                            {processingIds.has(selectedRecord.id) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Check className="h-4 w-4" />
                                            )}
                                            <span>{getText('Approve Lending', 'Setujui Peminjaman')}</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleStatusUpdate(selectedRecord.id, 'rejected');
                                                setShowDetailModal(false);
                                            }}
                                            disabled={processingIds.has(selectedRecord.id)}
                                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                        >
                                            {processingIds.has(selectedRecord.id) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <X className="h-4 w-4" />
                                            )}
                                            <span>{getText('Reject Lending', 'Tolak Peminjaman')}</span>
                                        </button>
                                    </div>
                                )}
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
                                <AlertTriangle className="h-6 w-6 text-red-600" />
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