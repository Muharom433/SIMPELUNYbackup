import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Eye,
  Check,
  X,
  AlertTriangle,
  User,
  Building,
  Clock,
  RefreshCw,
  ChevronDown,
  MapPin,
  Users,
  Package,
  FileText,
  Edit,
  Trash2,
  Download,
  Upload,
  Plus,
  Settings,
  BookOpen,
  GraduationCap,
  Phone,
  Mail,
  Hash,
  Award,
  Target,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle as AlertIcon,
  Info,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { BookingWithDetails } from '../types';
import { alert } from '../components/Alert/AlertHelper';
import EquipmentQuantityManager from '../lib/equipmentQuantityManager';
import EquipmentQuantityManager from '../lib/equipmentQuantityManager';
import { format, isAfter, isBefore, parseISO } from 'date-fns';

interface Booking {
  id: string;
  user_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  sks: number;
  class_type: 'theory' | 'practical';
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  equipment_requested: string[];
  notes: string | null;
  attachments: string[];
  user_info: any;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    identity_number: string;
    email: string;
    role: string;
    study_program?: {
      name: string;
      code: string;
    };
  };
  room?: {
    id: string;
    name: string;
    code: string;
    capacity: number;
    department?: {
      name: string;
    };
  };
}

const BookingManagement: React.FC = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [allEquipment, setAllEquipment] = useState<any[]>([]);

  useEffect(() => {
    fetchBookings();
    fetchAllEquipment();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('booking-management')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bookings'
        }, 
        (payload) => {
          try {
            fetchBookings();
          } catch (error) {
            console.error('Error in real-time subscription:', error);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchAllEquipment = async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, code, category')
        .order('name');
      setAllEquipment(data || []);
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const quantityManager = new EquipmentQuantityManager(supabase);

      // Prepare equipment list
      const equipmentList: Array<{id: string, quantity: number}> = [];
      
      if (booking.equipment_requested && booking.equipment_requested.length > 0) {
        for (let i = 0; i < booking.equipment_requested.length; i++) {
          const equipmentId = booking.equipment_requested[i];
          const quantity = booking.equipment_quantities?.[i] || 1;
          
          equipmentList.push({ id: equipmentId, quantity });
        }
      }

      // Validate before approve
      if (newStatus === 'approved' && equipmentList.length > 0) {
        const validation = await quantityManager.validateBorrowRequest(equipmentList);
        
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
      }

      
      let query = supabase
        .from('bookings')
        .select(`
          *,
          user:users(
            id,
            full_name,
            identity_number,
            email,
            role,
            study_program:study_programs(
              name,
              code
            )
          ),
      // Handle equipment quantities
      if (equipmentList.length > 0) {
        if (newStatus === 'approved') {
          await quantityManager.processBorrowing(equipmentList, bookingId, 'booking');
        } else if (newStatus === 'rejected' && booking.status === 'approved') {
          await quantityManager.processRestore(equipmentList, bookingId, 'booking');
        }
      }
      
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      alert.error(getText('Failed to load bookings', 'Gagal memuat pemesanan'));
    } finally {
      setLoading(false);
    }
  };

  // ===== PERBAIKAN BookingManagement.tsx =====
// Mengikuti pola yang sama seperti ToolLendingManagement.tsx

const handleStatusUpdate = async (bookingId: string, newStatus: 'approved' | 'rejected') => {
  try {
    setProcessingIds(prev => new Set(prev).add(bookingId));
    
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    const quantityManager = new EquipmentQuantityManager(supabase);

    const equipmentList: Array<{id: string, quantity: number}> = [];
    
    if (booking.equipment_requested && booking.equipment_requested.length > 0) {
      for (let i = 0; i < booking.equipment_requested.length; i++) {
        const equipmentId = booking.equipment_requested[i];
        const quantity = booking.equipment_quantities?.[i] || 1;
        
        equipmentList.push({ id: equipmentId, quantity });
      }
    }

    // Validate before approve
    if (newStatus === 'approved' && equipmentList.length > 0) {
      const validation = await quantityManager.validateBorrowRequest(equipmentList);
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Update booking status
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (bookingError) throw bookingError;

    // Handle equipment quantities
    if (equipmentList.length > 0) {
      if (newStatus === 'approved') {
        await quantityManager.processBorrowing(equipmentList, bookingId, 'booking');
      } else if (newStatus === 'rejected' && booking.status === 'approved') {
        await quantityManager.processRestore(equipmentList, bookingId, 'booking');
      }
    }

    // ✅ PERBAIKAN: Handle equipment quantities dengan INDEX ARRAY (seperti ToolLendingManagement)
    if (booking.equipment_requested && booking.equipment_requested.length > 0) {
      
      // ✅ Loop berdasarkan INDEX, bukan forEach equipment
      for (let i = 0; i < booking.equipment_requested.length; i++) {
        const equipmentId = booking.equipment_requested[i];
        
        // ✅ Ambil quantity berdasarkan INDEX yang sama
        const requestedQuantity = booking.equipment_quantities && booking.equipment_quantities[i] 
          ? booking.equipment_quantities[i] 
          : 1; // Default 1 jika tidak ada

        console.log(`Processing equipment ${equipmentId} with quantity ${requestedQuantity}`);

        // Fetch current equipment quantity
        const { data: equipment, error: equipmentFetchError } = await supabase
          .from('equipment')
          .select('quantity')
          .eq('id', equipmentId)
          .single();

        if (equipmentFetchError) {
          console.error('Error fetching equipment:', equipmentFetchError);
          continue; // Skip yang error
        }

        if (equipment) {
          let newQuantity = equipment.quantity;
          
          if (newStatus === 'approved') {
            // ✅ KURANGI sesuai quantity yang diminta (sama seperti ToolLendingManagement)
            newQuantity = Math.max(0, equipment.quantity - requestedQuantity);
            console.log(`Equipment ${equipmentId}: ${equipment.quantity} - ${requestedQuantity} = ${newQuantity}`);
            
          } else if (newStatus === 'rejected') {
            // ✅ RESTORE quantity saat reject (sama seperti ToolLendingManagement)
            newQuantity = equipment.quantity + requestedQuantity;
            console.log(`Equipment ${equipmentId} restored: ${equipment.quantity} + ${requestedQuantity} = ${newQuantity}`);
          }

          // Update equipment quantity
          const { error: equipmentUpdateError } = await supabase
            .from('equipment')
            .update({ 
              quantity: newQuantity,
              is_available: newQuantity > 0
            })
            .eq('id', equipmentId);

          if (equipmentUpdateError) {
            console.error('Error updating equipment quantity:', equipmentUpdateError);
          } else {
            console.log(`✅ Equipment ${equipmentId} quantity updated to ${newQuantity}`);
          }
        }
      }
    }
    
    const statusText = newStatus === 'approved' 
      ? getText('approved', 'disetujui') 
      : getText('rejected', 'ditolak');
    
    alert.success(getText(`Booking ${statusText} successfully`, `Pemesanan berhasil ${statusText}`));
    fetchBookings();
    
    if (selectedBooking?.id === bookingId) {
      setShowDetailModal(false);
    }
    
  } catch (error: any) {
    console.error('Error updating booking status:', error);
    alert.error(error.message || getText('Failed to update booking status', 'Gagal memperbarui status pemesanan'));
  } finally {
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(bookingId);
      return newSet;
    });
  }
};

  const handleDelete = async (bookingId: string) => {
  try {
    setProcessingIds(prev => new Set(prev).add(bookingId));
    
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new Error('Booking not found');
      const quantityManager = new EquipmentQuantityManager(supabase);

      // If booking was approved, restore equipment quantities
      if (booking.status === 'approved' && booking.equipment_requested && booking.equipment_requested.length > 0) {
        const equipmentList: Array<{id: string, quantity: number}> = [];
        
        for (let i = 0; i < booking.equipment_requested.length; i++) {
          const equipmentId = booking.equipment_requested[i];
          const quantity = booking.equipment_quantities?.[i] || 1;
          equipmentList.push({ id: equipmentId, quantity });
        const equipmentId = booking.equipment_requested[i];
        const quantity = booking.equipment_quantities?.[i] || 1;
        equipmentList.push({ id: equipmentId, quantity });
      }

      await quantityManager.processRestore(equipmentList, bookingId, 'booking');
      
      for (let i = 0; i < booking.equipment_requested.length; i++) {
        const equipmentId = booking.equipment_requested[i];
        const requestedQuantity = booking.equipment_quantities && booking.equipment_quantities[i] 
          ? booking.equipment_quantities[i] 
          : 1;

        const { data: equipment, error: equipmentFetchError } = await supabase
          .from('equipment')
          .select('quantity')
          .eq('id', equipmentId)
          .single();

        if (equipmentFetchError) {
          console.error('Error fetching equipment:', equipmentFetchError);
          continue;
        }

        if (equipment) {
          // ✅ RESTORE quantity saat delete approved booking
          const newQuantity = equipment.quantity + requestedQuantity;

          const { error: equipmentUpdateError } = await supabase
            .from('equipment')
            .update({ 
              quantity: newQuantity,
              is_available: newQuantity > 0
            })
            .eq('id', equipmentId);

          if (equipmentUpdateError) {
            console.error('Error updating equipment:', equipmentUpdateError);
          } else {
            console.log(`✅ Equipment ${equipmentId} quantity restored: +${requestedQuantity} = ${newQuantity}`);
          }
        }

        await quantityManager.processRestore(equipmentList, bookingId, 'booking');
      }
    }

    // Delete booking
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (error) throw error;
    
    alert.success(getText('Booking deleted successfully', 'Pemesanan berhasil dihapus'));
    setShowDeleteConfirm(null);
    fetchBookings();
    
    if (selectedBooking?.id === bookingId) {
      setShowDetailModal(false);
    }
    
  } catch (error: any) {
    console.error('Error deleting booking:', error);
    alert.error(error.message || getText('Failed to delete booking', 'Gagal menghapus pemesanan'));
  } finally {
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(bookingId);
      return newSet;
    });
  }
};

  const filteredBookings = bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (booking.user?.full_name && booking.user.full_name.toLowerCase().includes(searchLower)) ||
      (booking.user?.identity_number && booking.user.identity_number.toLowerCase().includes(searchLower)) ||
      (booking.purpose && booking.purpose.toLowerCase().includes(searchLower)) ||
      (booking.room?.name && booking.room.name.toLowerCase().includes(searchLower)) ||
      (booking.room?.code && booking.room.code.toLowerCase().includes(searchLower)) ||
      (booking.user_info?.full_name && booking.user_info.full_name.toLowerCase().includes(searchLower)) ||
      (booking.user_info?.identity_number && booking.user_info.identity_number.toLowerCase().includes(searchLower));
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const bookingDate = new Date(booking.start_time);
      const today = new Date();
      today.setHours(0,0,0,0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      switch (dateFilter) {
        case 'today': matchesDate = bookingDate.toDateString() === today.toDateString(); break;
        case 'tomorrow': matchesDate = bookingDate.toDateString() === tomorrow.toDateString(); break;
        case 'week': matchesDate = bookingDate >= today && bookingDate <= nextWeek; break;
        case 'past': matchesDate = bookingDate < today; break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEquipmentDetails = (equipmentIds: string[]) => {
  return equipmentIds.map(id => {
    const equipment = allEquipment.find(eq => eq.id === id);
    return equipment || { id, name: `Equipment ${id}`, code: 'Unknown', category: 'Unknown' };
  });
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'approved': return CheckCircle;
      case 'rejected': return XCircle;
      case 'completed': return Award;
      default: return AlertIcon;
    }
  };

  if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {getText('Access Denied', 'Akses Ditolak')}
          </h3>
          <p className="text-gray-600">
            {getText("You don't have permission to access booking management.", 'Anda tidak memiliki izin untuk mengakses manajemen pemesanan.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Calendar className="h-8 w-8" />
              <span>{getText('Booking Management', 'Manajemen Pemesanan')}</span>
            </h1>
            <p className="mt-2 opacity-90">
              {getText('Review and manage room booking requests', 'Tinjau dan kelola permintaan pemesanan ruangan')}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{bookings.length}</div>
            <div className="text-sm opacity-80">{getText('Total Bookings', 'Total Pemesanan')}</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { 
            label: getText('Pending', 'Menunggu'), 
            count: bookings.filter(b => b.status === 'pending').length, 
            color: 'bg-yellow-500', 
            icon: Clock 
          },
          { 
            label: getText('Approved', 'Disetujui'), 
            count: bookings.filter(b => b.status === 'approved').length, 
            color: 'bg-green-500', 
            icon: CheckCircle 
          },
          { 
            label: getText('Rejected', 'Ditolak'), 
            count: bookings.filter(b => b.status === 'rejected').length, 
            color: 'bg-red-500', 
            icon: XCircle 
          },
          { 
            label: getText('Completed', 'Selesai'), 
            count: bookings.filter(b => b.status === 'completed').length, 
            color: 'bg-blue-500', 
            icon: Award 
          },
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

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={getText('Search bookings...', 'Cari pemesanan...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">{getText('All Status', 'Semua Status')}</option>
              <option value="pending">{getText('Pending', 'Menunggu')}</option>
              <option value="approved">{getText('Approved', 'Disetujui')}</option>
              <option value="rejected">{getText('Rejected', 'Ditolak')}</option>
              <option value="completed">{getText('Completed', 'Selesai')}</option>
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">{getText('All Dates', 'Semua Tanggal')}</option>
              <option value="today">{getText('Today', 'Hari Ini')}</option>
              <option value="tomorrow">{getText('Tomorrow', 'Besok')}</option>
              <option value="week">{getText('This Week', 'Minggu Ini')}</option>
              <option value="past">{getText('Past Bookings', 'Pemesanan Lalu')}</option>
            </select>
          </div>

          {/* Refresh Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchBookings()}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('User & Purpose', 'Pengguna & Tujuan')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Room & Time', 'Ruangan & Waktu')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Details', 'Detail')}
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
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                      <span className="text-gray-600">{getText('Loading bookings...', 'Memuat pemesanan...')}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Calendar className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {getText('No bookings found', 'Tidak ada pemesanan ditemukan')}
                    </h3>
                    <p className="text-gray-600">
                      {getText('Try adjusting your search filters', 'Coba sesuaikan filter pencarian Anda')}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => {
                  const StatusIcon = getStatusIcon(booking.status);
                  const isProcessing = processingIds.has(booking.id);
                  
                  return (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors duration-200">
                      {/* User & Purpose */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {booking.user?.full_name || booking.user_info?.full_name || 'Unknown User'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {booking.user?.identity_number || booking.user_info?.identity_number || 'No ID'}
                            </div>
                            <div className="text-xs font-medium text-gray-700 mt-1">
                              {booking.purpose}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Room & Time */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                            <Building className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {booking.room?.name || 'Unknown Room'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {booking.room?.code || 'No Code'}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {format(new Date(booking.start_time), 'MMM d, HH:mm')} - {format(new Date(booking.end_time), 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900">
                            <span className="font-medium">{booking.sks} SKS</span> • 
                            <span className="capitalize ml-1">{booking.class_type}</span>
                          </div>
                          {booking.equipment_requested && booking.equipment_requested.length > 0 && (
                            <div className="flex items-center text-xs text-gray-500">
                              <Package className="h-3 w-3 mr-1" />
                              <span>{booking.equipment_requested.length} {getText('equipment', 'peralatan')}</span>
                              {/* Show first equipment name as preview */}
                              {allEquipment.length > 0 && (
                                <span className="ml-1 text-gray-400">
                                  ({allEquipment.find(eq => eq.id === booking.equipment_requested[0])?.name || 'Equipment'})
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            {getText('Created', 'Dibuat')} {format(new Date(booking.created_at), 'MMM d')}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {getText(booking.status.charAt(0).toUpperCase() + booking.status.slice(1), booking.status.toUpperCase())}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowDetailModal(true);
                            }}
                            className="text-gray-600 hover:text-gray-900 p-1 rounded transition-colors"
                            title={getText('View Details', 'Lihat Detail')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          {booking.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(booking.id, 'approved')}
                                disabled={isProcessing}
                                className="text-green-600 hover:text-green-800 p-1 rounded transition-colors disabled:opacity-50"
                                title={getText('Approve', 'Setujui')}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              
                              <button
                                onClick={() => handleStatusUpdate(booking.id, 'rejected')}
                                disabled={isProcessing}
                                className="text-red-600 hover:text-red-800 p-1 rounded transition-colors disabled:opacity-50"
                                title={getText('Reject', 'Tolak')}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          
                          <button
                            onClick={() => setShowDeleteConfirm(booking.id)}
                            disabled={isProcessing}
                            className="text-red-600 hover:text-red-800 p-1 rounded transition-colors disabled:opacity-50"
                            title={getText('Delete', 'Hapus')}
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

      {/* Booking Detail Modal */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {getText('Booking Details', 'Detail Pemesanan')}
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
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedBooking.status)}`}>
                    {React.createElement(getStatusIcon(selectedBooking.status), { className: "h-4 w-4 mr-1" })}
                    {getText(selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1), selectedBooking.status.toUpperCase())}
                  </span>
                </div>

                {/* Basic Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">{selectedBooking.purpose}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">{getText('Start Time', 'Waktu Mulai')}:</span>
                      <span className="ml-2 font-medium">
                        {format(new Date(selectedBooking.start_time), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">{getText('End Time', 'Waktu Selesai')}:</span>
                      <span className="ml-2 font-medium">
                        {format(new Date(selectedBooking.end_time), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">SKS:</span>
                      <span className="ml-2 font-medium">{selectedBooking.sks}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{getText('Class Type', 'Tipe Kelas')}:</span>
                      <span className="ml-2 font-medium capitalize">{selectedBooking.class_type}</span>
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">{getText('User Information', 'Informasi Pengguna')}</h5>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-600">{getText('Full Name', 'Nama Lengkap')}</label>
                            <div className="font-medium text-gray-900">
                              {selectedBooking.user?.full_name || selectedBooking.user_info?.full_name || 'Unknown User'}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">{getText('Identity Number', 'Nomor Identitas')}</label>
                            <div className="font-medium text-gray-900">
                              {selectedBooking.user?.identity_number || selectedBooking.user_info?.identity_number || 'No ID'}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">{getText('Email', 'Email')}</label>
                            <div className="font-medium text-gray-900">
                              {selectedBooking.user?.email || selectedBooking.user_info?.email || 'No Email'}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">{getText('Phone', 'Telepon')}</label>
                            <div className="font-medium text-gray-900">
                              {selectedBooking.user_info?.phone_number || 'No Phone'}
                            </div>
                          </div>
                        </div>
                        {selectedBooking.user?.study_program && (
                          <div className="mt-3">
                            <label className="text-sm font-medium text-gray-600">{getText('Study Program', 'Program Studi')}</label>
                            <div className="font-medium text-gray-900">
                              {selectedBooking.user.study_program.name} ({selectedBooking.user.study_program.code})
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Room Info */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">{getText('Room Information', 'Informasi Ruangan')}</h5>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                        <Building className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-lg">{selectedBooking.room?.name || 'Unknown Room'}</div>
                        <div className="text-sm text-gray-600">{selectedBooking.room?.code || 'No Code'}</div>
                        <div className="text-sm text-gray-600">
                          {getText('Capacity', 'Kapasitas')}: {selectedBooking.room?.capacity || 0} {getText('seats', 'kursi')}
                        </div>
                        <div className="text-sm text-gray-600">{selectedBooking.room?.department?.name || 'No Department'}</div>
                      </div>
                    </div>
                  </div>
                </div>

              {/* Equipment Requested */}
{selectedBooking.equipment_requested && selectedBooking.equipment_requested.length > 0 && (
  <div>
    <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3 block">
      {getText('Requested Equipment', 'Peralatan yang Diminta')}
    </span>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {selectedBooking.equipment_requested.map((equipmentId, index) => {
        // ✅ Ambil quantity berdasarkan INDEX
        const quantity = selectedBooking.equipment_quantities && selectedBooking.equipment_quantities[index] 
          ? selectedBooking.equipment_quantities[index] 
          : 1;

        // ✅ Cari nama equipment dari allEquipment
        const equipmentDetails = allEquipment.find(eq => eq.id === equipmentId);
        const equipmentName = equipmentDetails?.name || `Equipment ${equipmentId}`;
        const equipmentCode = equipmentDetails?.code || 'Unknown';

        return (
          <div key={`${equipmentId}-${index}`} className="flex items-center justify-between p-3 bg-white/60 rounded-xl border border-emerald-200/50">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                <Zap className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <div className="font-medium text-emerald-900">{equipmentName}</div>
                <div className="text-sm text-emerald-700">{equipmentCode}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-emerald-900 text-lg">{quantity}</div>
              <div className="text-xs text-emerald-600">{getText('requested', 'diminta')}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
                {/* Notes */}
                {selectedBooking.notes && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">{getText('Notes', 'Catatan')}</h5>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700">{selectedBooking.notes}</p>
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {selectedBooking.attachments && selectedBooking.attachments.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-blue-600" />
                      {getText('Attachments', 'Lampiran')}
                      <span className="ml-2 text-sm text-gray-500">({selectedBooking.attachments.length} files)</span>
                    </h5>
                    
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {selectedBooking.attachments.map((attachment, index) => {
                          const isPDF = attachment.startsWith('data:application/pdf') || attachment.toLowerCase().includes('.pdf');
                          
                          return (
                            <div key={index} className="relative group">
                              <div 
                                onClick={() => window.open(attachment, '_blank')}
                                className="cursor-pointer bg-white rounded-lg border border-blue-200 p-3 hover:shadow-md transition-all duration-200 hover:scale-105"
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
                                      alt={`Attachment ${index + 1}`}
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
                              
                              {/* Quick View Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Open in modal for better viewing
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
                                        <img src="${attachment}" alt="Attachment" class="max-w-full max-h-full object-contain rounded-lg" />
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
                                className="absolute top-1 right-1 bg-blue-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-blue-700"
                                title={getText('Quick View', 'Lihat Cepat')}
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Download All Button */}
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <button
                          onClick={() => {
                            selectedBooking.attachments?.forEach((attachment, index) => {
                              const link = document.createElement('a');
                              link.href = attachment;
                              link.download = `attachment_${index + 1}${attachment.startsWith('data:application/pdf') ? '.pdf' : '.jpg'}`;
                              link.click();
                            });
                            alert.success(getText('Attachments downloaded', 'Lampiran berhasil diunduh'));
                          }}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                        >
                          <Download className="h-4 w-4" />
                          <span>{getText('Download All Attachments', 'Unduh Semua Lampiran')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {selectedBooking.status === 'pending' && (
                  <div className="flex space-x-3 pt-4 border-t">
                    <button
                      onClick={() => {
                        handleStatusUpdate(selectedBooking.id, 'approved');
                        setShowDetailModal(false);
                      }}
                      disabled={processingIds.has(selectedBooking.id)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {processingIds.has(selectedBooking.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span>{getText('Approve Booking', 'Setujui Pemesanan')}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleStatusUpdate(selectedBooking.id, 'rejected');
                        setShowDetailModal(false);
                      }}
                      disabled={processingIds.has(selectedBooking.id)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {processingIds.has(selectedBooking.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      <span>{getText('Reject Booking', 'Tolak Pemesanan')}</span>
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
                  {getText('Delete Booking', 'Hapus Pemesanan')}
                </h3>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              {getText(
                'Are you sure you want to delete this booking? This action cannot be undone.',
                'Apakah Anda yakin ingin menghapus pemesanan ini? Tindakan ini tidak dapat dibatalkan.'
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

export default BookingManagement;