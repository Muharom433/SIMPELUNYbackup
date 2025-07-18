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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { BookingWithDetails } from '../types';
import toast from 'react-hot-toast';
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

  useEffect(() => {
    fetchBookings();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('booking-management')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bookings'
        }, 
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
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
          room:rooms(
            id,
            name,
            code,
            capacity,
            department:departments(
              name
            )
          )
        `);
      
      // Filter by department for department admins
      if (profile?.role === 'department_admin' && profile.department_id) {
        // Get rooms in this department first
        const { data: departmentRooms } = await supabase
          .from('rooms')
          .select('id')
          .eq('department_id', profile.department_id);
        
        if (departmentRooms && departmentRooms.length > 0) {
          const roomIds = departmentRooms.map(room => room.id);
          query = query.in('room_id', roomIds);
        } else {
          // No rooms in department, return empty
          setBookings([]);
          setLoading(false);
          return;
        }
      }
      
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error(getText('Failed to load bookings', 'Gagal memuat pemesanan'));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: 'approved' | 'rejected') => {
    try {
      setProcessingIds(prev => new Set(prev).add(bookingId));
      
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Update booking status - REMOVED ROOM AVAILABILITY UPDATE
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Handle equipment quantities if equipment was requested
      if (booking.equipment_requested && booking.equipment_requested.length > 0) {
        for (const equipmentId of booking.equipment_requested) {
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
            let newQuantity = equipment.quantity;
            
            if (newStatus === 'approved') {
              // Decrease quantity when approved
              newQuantity = Math.max(0, equipment.quantity - 1);
            } else if (newStatus === 'rejected') {
              // Increase quantity when rejected (restore)
              newQuantity = equipment.quantity + 1;
            }

            const { error: equipmentUpdateError } = await supabase
              .from('equipment')
              .update({ 
                quantity: newQuantity,
                is_available: newQuantity > 0
              })
              .eq('id', equipmentId);

            if (equipmentUpdateError) {
              console.error('Error updating equipment:', equipmentUpdateError);
            }
          }
        }
      }
      
      const statusText = newStatus === 'approved' 
        ? getText('approved', 'disetujui') 
        : getText('rejected', 'ditolak');
      
      toast.success(getText(`Booking ${statusText} successfully`, `Pemesanan berhasil ${statusText}`));
      fetchBookings();
      
      if (selectedBooking?.id === bookingId) {
        setShowDetailModal(false);
      }
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      toast.error(error.message || getText('Failed to update booking status', 'Gagal memperbarui status pemesanan'));
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
      }

      // Restore equipment quantities if equipment was requested and booking was approved
      if (booking.status === 'approved' && booking.equipment_requested && booking.equipment_requested.length > 0) {
        for (const equipmentId of booking.equipment_requested) {
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
            const newQuantity = equipment.quantity + 1;

            const { error: equipmentUpdateError } = await supabase
              .from('equipment')
              .update({ 
                quantity: newQuantity,
                is_available: newQuantity > 0
              })
              .eq('id', equipmentId);

            if (equipmentUpdateError) {
              console.error('Error updating equipment:', equipmentUpdateError);
            }
          }
        }
      }

      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;
      
      toast.success(getText('Booking deleted successfully', 'Pemesanan berhasil dihapus'));
      setShowDeleteConfirm(null);
      fetchBookings();
      
      if (selectedBooking?.id === bookingId) {
        setShowDetailModal(false);
      }
    } catch (error: any) {
      console.error('Error deleting booking:', error);
      toast.error(error.message || getText('Failed to delete booking', 'Gagal menghapus pemesanan'));
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
      (booking.room?.code && booking.room.code.toLowerCase().includes(searchLower));
    
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

      {/* Bookings List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
              <span className="text-gray-600">{getText('Loading bookings...', 'Memuat pemesanan...')}</span>
            </div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {getText('No bookings found', 'Tidak ada pemesanan ditemukan')}
            </h3>
            <p className="text-gray-600">
              {getText('Try adjusting your search filters', 'Coba sesuaikan filter pencarian Anda')}
            </p>
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const StatusIcon = getStatusIcon(booking.status);
            const isProcessing = processingIds.has(booking.id);
            
            return (
              <div
                key={booking.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <StatusIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{booking.purpose}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {booking.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {/* User Info */}
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {booking.user?.full_name || booking.user_info?.full_name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {booking.user?.identity_number || booking.user_info?.identity_number || 'No ID'}
                          </p>
                        </div>
                      </div>

                      {/* Room Info */}
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                          <Building className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {booking.room?.name || 'Unknown Room'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {booking.room?.code || 'No Code'} • {booking.room?.department?.name || 'No Department'}
                          </p>
                        </div>
                      </div>

                      {/* Date Info */}
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                          <Clock className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {format(new Date(booking.start_time), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(booking.start_time), 'HH:mm')} - {format(new Date(booking.end_time), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <div className="flex items-center">
                        <BookOpen className="h-4 w-4 mr-1" />
                        <span>{booking.sks} SKS • {booking.class_type}</span>
                      </div>
                      {booking.equipment_requested && booking.equipment_requested.length > 0 && (
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-1" />
                          <span>{booking.equipment_requested.length} {getText('equipment requested', 'peralatan diminta')}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>{getText('Created', 'Dibuat')} {format(new Date(booking.created_at), 'MMM d')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setShowDetailModal(true);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    
                    {booking.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(booking.id, 'approved')}
                          disabled={isProcessing}
                          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          <Check className="h-4 w-4" />
                          <span>{getText('Approve', 'Setujui')}</span>
                        </button>
                        
                        <button
                          onClick={() => handleStatusUpdate(booking.id, 'rejected')}
                          disabled={isProcessing}
                          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          <X className="h-4 w-4" />
                          <span>{getText('Reject', 'Tolak')}</span>
                        </button>
                      </>
                    )}
                    
                    <button
                      onClick={() => setShowDeleteConfirm(booking.id)}
                      disabled={isProcessing}
                      className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors duration-200 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Booking Detail Modal */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
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
                    {getStatusIcon(selectedBooking.status)({ className: "h-4 w-4 mr-1" })}
                    {selectedBooking.status.toUpperCase()}
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
                      <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {selectedBooking.user?.full_name || selectedBooking.user_info?.full_name || 'Unknown User'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {selectedBooking.user?.identity_number || selectedBooking.user_info?.identity_number || 'No ID'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {selectedBooking.user?.email || selectedBooking.user_info?.email || 'No Email'}
                        </div>
                        {selectedBooking.user?.study_program && (
                          <div className="text-sm text-gray-600">
                            {selectedBooking.user.study_program.name} ({selectedBooking.user.study_program.code})
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
                      <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                        <Building className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{selectedBooking.room?.name || 'Unknown Room'}</div>
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
                    <h5 className="font-medium text-gray-900 mb-3">{getText('Equipment Requested', 'Peralatan yang Diminta')}</h5>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex flex-wrap gap-2">
                        {selectedBooking.equipment_requested.map((equipmentId, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Package className="h-3 w-3 mr-1" />
                            Equipment ID: {equipmentId}
                          </span>
                        ))}
                      </div>
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

                {/* Actions */}
                {selectedBooking.status === 'pending' && (
                  <div className="flex space-x-3 pt-4 border-t">
                    <button
                      onClick={() => {
                        handleStatusUpdate(selectedBooking.id, 'approved');
                        setShowDetailModal(false);
                      }}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      <Check className="h-4 w-4" />
                      <span>{getText('Approve Booking', 'Setujui Pemesanan')}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleStatusUpdate(selectedBooking.id, 'rejected');
                        setShowDetailModal(false);
                      }}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      <X className="h-4 w-4" />
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
                {processingIds.has(showDeleteConfirm) 
                  ? getText('Deleting...', 'Menghapus...') 
                  : getText('Delete', 'Hapus')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingManagement;