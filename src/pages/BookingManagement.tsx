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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { BookingWithDetails } from '../types';
import { alert } from '../components/Alert/AlertHelper';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import EquipmentQuantityManager from '../lib/equipmentQuantityManager';

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
  equipment_quantities: number[];
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
  
  // Data states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  
  // Loading and UI states
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  // Modal states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);

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
            // Only refetch if we're on the first page for real-time updates
            if (currentPage === 1) {
              fetchBookings();
            }
          } catch (error) {
            console.error('Error in real-time subscription:', error);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentPage]);

  const fetchAllEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, code, category, quantity, unit')
        .order('name');
      
      if (error) throw error;
      setAllEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  };

  // ✅ OPTIMIZED FETCH WITH PAGINATION & ERROR HANDLING
  const fetchBookings = async (retryCount = 0) => {
    try {
      setLoading(true);
      
      // Calculate offset for pagination
      const offset = (currentPage - 1) * pageSize;
      
      // First, get the total count (only when needed)
      if (currentPage === 1 || totalCount === 0) {
        setLoadingCount(true);
        try {
          const { count, error: countError } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true });
          
          if (countError) throw countError;
          setTotalCount(count || 0);
        } catch (countError) {
          console.warn('Count query failed, using pagination anyway:', countError);
        }
        setLoadingCount(false);
      }
      
      // Optimized query with limited joins and pagination
      let query = supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          room_id,
          start_time,
          end_time,
          purpose,
          sks,
          class_type,
          status,
          equipment_requested,
          equipment_quantities,
          notes,
          attachments,
          user_info,
          created_at,
          updated_at,
          user:users(
            id,
            full_name,
            identity_number,
            email,
            role,
            study_program:study_programs(name, code)
          ),
          room:rooms(
            id,
            name,
            code,
            capacity,
            department:departments(name)
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      const { data, error } = await query;
      if (error) throw error;
      
      setBookings(data || []);
      
    } catch (error) {
      console.error('Error fetching bookings (attempt ' + (retryCount + 1) + '):', error);
      
      if (retryCount < 2) {
        console.log('Retrying with simplified query...');
        setTimeout(() => fetchBookingsSimplified(retryCount + 1), 1000);
        return;
      }
      
      alert.error(getText('Failed to load bookings', 'Gagal memuat pemesanan'));
    } finally {
      setLoading(false);
    }
  };

  // ✅ FALLBACK SIMPLIFIED QUERY
  const fetchBookingsSimplified = async (retryCount = 0) => {
    try {
      setLoading(true);
      console.log('🔄 Using simplified query fallback...');
      
      const offset = (currentPage - 1) * pageSize;
      
      // Get basic booking data without joins
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      
      if (bookingsError) throw bookingsError;
      
      if (bookingsData && bookingsData.length > 0) {
        // Get unique user IDs and room IDs
        const userIds = [...new Set(bookingsData.map(b => b.user_id).filter(Boolean))];
        const roomIds = [...new Set(bookingsData.map(b => b.room_id).filter(Boolean))];
        
        // Fetch users separately (with timeout)
        let usersData = [];
        let roomsData = [];
        
        if (userIds.length > 0) {
          try {
            const { data: users, error: usersError } = await supabase
              .from('users')
              .select(`
                id, full_name, identity_number, email, role,
                study_program:study_programs(name, code)
              `)
              .in('id', userIds);
            
            if (!usersError) usersData = users || [];
          } catch (userError) {
            console.warn('Users query failed:', userError);
          }
        }
        
        // Fetch rooms separately (with timeout)
        if (roomIds.length > 0) {
          try {
            const { data: rooms, error: roomsError } = await supabase
              .from('rooms')
              .select(`
                id, name, code, capacity,
                department:departments(name)
              `)
              .in('id', roomIds);
            
            if (!roomsError) roomsData = rooms || [];
          } catch (roomError) {
            console.warn('Rooms query failed:', roomError);
          }
        }
        
        // Combine the data
        const enrichedBookings = bookingsData.map(booking => ({
          ...booking,
          user: usersData.find(u => u.id === booking.user_id),
          room: roomsData.find(r => r.id === booking.room_id)
        }));
        
        setBookings(enrichedBookings);
        alert.success(getText('Loaded booking data successfully', 'Data pemesanan berhasil dimuat'));
        
      } else {
        setBookings([]);
      }
      
    } catch (error) {
      console.error('Simplified query failed:', error);
      
      if (retryCount < 1) {
        // Last resort: get just basic data
        try {
          const { data: basicData, error: basicError } = await supabase
            .from('bookings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(25);
          
          if (!basicError && basicData) {
            setBookings(basicData);
            alert.warning(getText(
              'Loaded basic data only. Some details may be missing.',
              'Hanya memuat data dasar. Beberapa detail mungkin tidak lengkap.'
            ));
            return;
          }
        } catch (basicError) {
          console.error('Basic query also failed:', basicError);
        }
      }
      
      alert.error(getText('Failed to load bookings', 'Gagal memuat pemesanan'));
    } finally {
      setLoading(false);
    }
  };

  // ✅ SIMPLIFIED BOOKING STATUS UPDATE WITH EQUIPMENT MANAGEMENT
  const handleStatusUpdate = async (bookingId: string, newStatus: 'approved' | 'rejected') => {
    try {
      setProcessingIds(prev => new Set(prev).add(bookingId));
      
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      console.log('📋 SIMPLE: Updating booking status:', {
        bookingId: booking.id,
        currentStatus: booking.status,
        newStatus,
        equipment_requested: booking.equipment_requested,
        equipment_quantities: booking.equipment_quantities
      });

      // ✅ SIMPLE: Direct equipment updates
      if (booking.equipment_requested && booking.equipment_requested.length > 0) {
        
        for (let i = 0; i < booking.equipment_requested.length; i++) {
          const equipmentId = booking.equipment_requested[i];
          const quantity = booking.equipment_quantities?.[i] || 1;
          
          if (newStatus === 'approved') {
            // ✅ APPROVED: Kurangi quantity
            console.log(`📉 Decreasing ${equipmentId} by ${quantity}`);
            
            const { error } = await supabase.rpc('decrease_equipment_quantity', {
              equipment_id: equipmentId,
              decrease_by: quantity
            });
            
            if (error) {
              console.error(`❌ Failed to decrease ${equipmentId}:`, error);
              throw new Error(`Failed to update equipment ${equipmentId}: ${error.message}`);
            }
            
          } else if (newStatus === 'rejected' && booking.status === 'approved') {
            // ✅ REJECTED (from approved): Tambah quantity kembali
            console.log(`📈 Increasing ${equipmentId} by ${quantity}`);
            
            const { error } = await supabase.rpc('increase_equipment_quantity', {
              equipment_id: equipmentId,
              increase_by: quantity
            });
            
            if (error) {
              console.error(`❌ Failed to increase ${equipmentId}:`, error);
              throw new Error(`Failed to restore equipment ${equipmentId}: ${error.message}`);
            }
          }
        }
      }

      // ✅ UPDATE BOOKING STATUS
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;
      
      console.log('✅ SIMPLE: Booking status updated successfully');
      
      const statusText = newStatus === 'approved' ? getText('approved', 'disetujui') : getText('rejected', 'ditolak');
      alert.success(getText(`Booking ${statusText} successfully`, `Pemesanan berhasil ${statusText}`));
      
      await fetchBookings();
      await fetchAllEquipment();
      
      if (selectedBooking?.id === bookingId) {
        setShowDetailModal(false);
      }
      
    } catch (error: any) {
      console.error('❌ Error updating booking status:', error);
      alert.error(error.message || getText('Failed to update booking status', 'Gagal memperbarui status pemesanan'));
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(bookingId);
        return newSet;
      });
    }
  };

  // ✅ SIMPLIFIED DELETE WITH QUANTITY RESTORATION
  const handleDelete = async (bookingId: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(bookingId));
      
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // ✅ SIMPLE: Restore quantities if booking was approved
      if (booking.status === 'approved' && booking.equipment_requested && booking.equipment_requested.length > 0) {
        
        for (let i = 0; i < booking.equipment_requested.length; i++) {
          const equipmentId = booking.equipment_requested[i];
          const quantity = booking.equipment_quantities?.[i] || 1;
          
          console.log(`📈 Restoring ${equipmentId} by ${quantity} (booking deleted)`);
          
          const { error } = await supabase.rpc('increase_equipment_quantity', {
            equipment_id: equipmentId,
            increase_by: quantity
          });
          
          if (error) {
            console.warn(`⚠️ Failed to restore ${equipmentId}:`, error);
            // Don't throw error for delete operation
          }
        }
      }

      // ✅ DELETE BOOKING
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;
      
      alert.success(getText('Booking deleted successfully', 'Pemesanan berhasil dihapus'));
      setShowDeleteConfirm(null);
      await fetchBookings();
      await fetchAllEquipment();
      
      if (selectedBooking?.id === bookingId) {
        setShowDetailModal(false);
      }
      
    } catch (error: any) {
      console.error('❌ Error deleting booking:', error);
      alert.error(error.message || getText('Failed to delete booking', 'Gagal menghapus pemesanan'));
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(bookingId);
        return newSet;
      });
    }
  };

  // ✅ ENHANCED EQUIPMENT AVAILABILITY CHECK
  const getEquipmentAvailability = (equipmentId: string) => {
    const equipment = allEquipment.find(eq => eq.id === equipmentId);
    if (!equipment) return { available: 0, total: 0 };
    
    return {
      available: equipment.quantity, // Simplified: quantity field shows available
      total: equipment.quantity, // For display purposes
    };
  };

  // ✅ OPTIMIZED FILTERING
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

  // ✅ ENHANCED EQUIPMENT DISPLAY WITH REAL-TIME AVAILABILITY
  const renderEquipmentSection = (selectedBooking: Booking) => {
    if (!selectedBooking.equipment_requested || selectedBooking.equipment_requested.length === 0) {
      return null;
    }

    return (
      <div>
        <h5 className="font-medium text-gray-900 mb-3 flex items-center">
          <Package className="h-5 w-5 mr-2 text-blue-600" />
          {getText('Requested Equipment', 'Peralatan yang Diminta')}
          <span className="ml-2 text-sm text-gray-500">
            ({selectedBooking.equipment_requested.length} types, {
              selectedBooking.equipment_quantities?.reduce((sum, qty) => sum + qty, 0) || selectedBooking.equipment_requested.length
            } total items)
          </span>
        </h5>
        
        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedBooking.equipment_requested.map((equipmentId, index) => {
              // ✅ Get EXACT quantity from equipment_quantities array
              const requestedQuantity = selectedBooking.equipment_quantities && selectedBooking.equipment_quantities[index] 
                ? selectedBooking.equipment_quantities[index] 
                : 1;

              // ✅ Get equipment details
              const equipmentDetails = allEquipment.find(eq => eq.id === equipmentId);
              const equipmentName = equipmentDetails?.name || `Equipment ${equipmentId}`;
              const equipmentCode = equipmentDetails?.code || 'Unknown';
              const equipmentUnit = equipmentDetails?.unit || 'pcs';
              
              // ✅ Get current real-time availability
              const availability = getEquipmentAvailability(equipmentId);

              return (
                <div key={`${equipmentId}-${index}`} className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                        <Package className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-emerald-900">{equipmentName}</div>
                        <div className="text-sm text-emerald-700">{equipmentCode}</div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-bold text-emerald-900 text-lg">{requestedQuantity}</div>
                      <div className="text-xs text-emerald-600">{equipmentUnit}</div>
                    </div>
                  </div>
                  
                  {/* ✅ CURRENT AVAILABILITY STATUS */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="text-xs font-medium text-gray-600 mb-2">CURRENT AVAILABILITY</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Available:</span>
                      <span className={`font-bold text-lg ${availability.available >= requestedQuantity ? 'text-green-600' : 'text-red-600'}`}>
                        {availability.available}
                      </span>
                    </div>
                    
                    {/* ✅ Availability Status Check */}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      {availability.available >= requestedQuantity ? (
                        <div className="flex items-center text-green-700">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          <span className="text-xs font-medium">
                            {getText('Sufficient quantity available', 'Jumlah mencukupi')}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-700">
                          <XCircle className="h-4 w-4 mr-1" />
                          <span className="text-xs font-medium">
                            {getText('Insufficient quantity!', 'Jumlah tidak mencukupi!')} 
                            <span className="ml-1">
                              ({getText('Need', 'Butuh')} {requestedQuantity}, {getText('Available', 'Tersedia')} {availability.available})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* ✅ Overall Equipment Status Summary */}
          <div className="mt-4 pt-4 border-t border-emerald-200">
            {(() => {
              const allSufficient = selectedBooking.equipment_requested.every((equipmentId, index) => {
                const requestedQuantity = selectedBooking.equipment_quantities?.[index] || 1;
                const availability = getEquipmentAvailability(equipmentId);
                return availability.available >= requestedQuantity;
              });
              
              const totalRequested = selectedBooking.equipment_quantities?.reduce((sum, qty) => sum + qty, 0) || 
                                   selectedBooking.equipment_requested.length;
              
              return allSufficient ? (
                <div className="flex items-center text-green-700 bg-green-100 rounded-lg p-3">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">
                    {getText('✅ All equipment available for booking', '✅ Semua peralatan tersedia untuk pemesanan')}
                    <span className="ml-2 text-sm">({totalRequested} items total)</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center text-red-700 bg-red-100 rounded-lg p-3">
                  <XCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">
                    {getText('❌ Some equipment insufficient for booking', '❌ Beberapa peralatan tidak mencukupi untuk pemesanan')}
                    <span className="ml-2 text-sm">({totalRequested} items requested)</span>
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  // ✅ PAGINATION COMPONENT
  const renderPagination = () => {
    if (loading || totalCount <= pageSize) return null;
    
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages <= 1) return null;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {loadingCount ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {getText('Counting...', 'Menghitung...')}
              </div>
            ) : (
              getText(
                `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} bookings`,
                `Menampilkan ${((currentPage - 1) * pageSize) + 1} hingga ${Math.min(currentPage * pageSize, totalCount)} dari ${totalCount} pemesanan`
              )
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {getText('Previous', 'Sebelumnya')}
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={loading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-50 border border-gray-300 disabled:opacity-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || loading}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {getText('Next', 'Selanjutnya')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ✅ ACCESS CONTROL
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
            <div className="text-2xl font-bold">{totalCount || bookings.length}</div>
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
              onClick={() => {
                fetchBookings();
                fetchAllEquipment();
              }}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 disabled:opacity-50"
              title={getText('Refresh', 'Segarkan')}
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
                      {searchTerm || statusFilter !== 'all' || dateFilter !== 'all' ? 
                        getText('Try adjusting your search filters', 'Coba sesuaikan filter pencarian Anda') :
                        getText('No bookings available', 'Belum ada pemesanan tersedia')
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => {
                  const StatusIcon = getStatusIcon(booking.status);
                  
                  return (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {booking.user?.full_name || booking.user_info?.full_name || 'Unknown User'}
                              </p>
                              {booking.user?.role && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {booking.user.role}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">
                              {booking.user?.identity_number || booking.user_info?.identity_number || 'No ID'}
                            </p>
                            <p className="text-sm text-blue-600 truncate font-medium mt-1">
                              {booking.purpose}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-900">
                            <Building className="h-4 w-4 mr-1 text-gray-400" />
                            <span className="font-medium">{booking.room?.name || 'Unknown Room'}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                            <span>{booking.room?.code || 'N/A'}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Clock className="h-4 w-4 mr-1 text-gray-400" />
                            <span>
                              {booking.start_time ? format(new Date(booking.start_time), 'MMM d, HH:mm') : 'N/A'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {booking.end_time ? (
                              <>
                                {getText('to', 'hingga')} {format(new Date(booking.end_time), 'HH:mm')}
                              </>
                            ) : 'N/A'}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <GraduationCap className="h-4 w-4 mr-1 text-gray-400" />
                            <span className="text-gray-900">{booking.sks || 0} SKS</span>
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              {booking.class_type === 'theory' ? getText('Theory', 'Teori') : getText('Practical', 'Praktik')}
                            </span>
                          </div>
                          
                          {booking.equipment_requested && booking.equipment_requested.length > 0 && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Package className="h-4 w-4 mr-1 text-gray-400" />
                              <span>
                                {booking.equipment_requested.length} {getText('equipment', 'peralatan')}
                                {booking.equipment_quantities && (
                                  <span className="ml-1 text-xs text-gray-500">
                                    ({booking.equipment_quantities.reduce((sum, qty) => sum + qty, 0)} items)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-500">
                            {booking.created_at ? (
                              <>
                                {getText('Created', 'Dibuat')}: {format(new Date(booking.created_at), 'MMM d, HH:mm')}
                              </>
                            ) : 'N/A'}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <StatusIcon className="h-4 w-4" />
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                            {getText(booking.status, booking.status === 'pending' ? 'Menunggu' : 
                                      booking.status === 'approved' ? 'Disetujui' : 
                                      booking.status === 'rejected' ? 'Ditolak' : 'Selesai')}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowDetailModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title={getText('View Details', 'Lihat Detail')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {booking.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(booking.id, 'approved')}
                                disabled={processingIds.has(booking.id)}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                                title={getText('Approve', 'Setujui')}
                              >
                                {processingIds.has(booking.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(booking.id, 'rejected')}
                                disabled={processingIds.has(booking.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                                title={getText('Reject', 'Tolak')}
                              >
                                {processingIds.has(booking.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setShowDeleteConfirm(booking.id)}
                            disabled={processingIds.has(booking.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
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

      {/* Pagination */}
      {renderPagination()}

      {/* Detail Modal */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{getText('Booking Details', 'Detail Pemesanan')}</h2>
                  <p className="mt-1 opacity-90">
                    {getText('Review booking information and manage status', 'Tinjau informasi pemesanan dan kelola status')}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* User Information */}
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      {getText('User Information', 'Informasi Pengguna')}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm text-blue-700 w-24">{getText('Name', 'Nama')}:</span>
                        <span className="text-sm font-medium text-blue-900">
                          {selectedBooking.user?.full_name || selectedBooking.user_info?.full_name || 'Unknown User'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm text-blue-700 w-24">{getText('ID', 'ID')}:</span>
                        <span className="text-sm text-blue-900">
                          {selectedBooking.user?.identity_number || selectedBooking.user_info?.identity_number || 'No ID'}
                        </span>
                      </div>
                      {selectedBooking.user?.email && (
                        <div className="flex items-center">
                          <span className="text-sm text-blue-700 w-24">{getText('Email', 'Email')}:</span>
                          <span className="text-sm text-blue-900">{selectedBooking.user.email}</span>
                        </div>
                      )}
                      {selectedBooking.user?.study_program && (
                        <div className="flex items-center">
                          <span className="text-sm text-blue-700 w-24">{getText('Program', 'Program')}:</span>
                          <span className="text-sm text-blue-900">{selectedBooking.user.study_program.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Room Information */}
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <h4 className="font-medium text-green-900 mb-3 flex items-center">
                      <Building className="h-5 w-5 mr-2" />
                      {getText('Room Information', 'Informasi Ruangan')}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm text-green-700 w-24">{getText('Room', 'Ruangan')}:</span>
                        <span className="text-sm font-medium text-green-900">
                          {selectedBooking.room?.name || 'Unknown Room'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm text-green-700 w-24">{getText('Code', 'Kode')}:</span>
                        <span className="text-sm text-green-900">{selectedBooking.room?.code || 'N/A'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm text-green-700 w-24">{getText('Capacity', 'Kapasitas')}:</span>
                        <span className="text-sm text-green-900">
                          {selectedBooking.room?.capacity || 'N/A'} {getText('people', 'orang')}
                        </span>
                      </div>
                      {selectedBooking.room?.department && (
                        <div className="flex items-center">
                          <span className="text-sm text-green-700 w-24">{getText('Department', 'Departemen')}:</span>
                          <span className="text-sm text-green-900">{selectedBooking.room.department.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Equipment Section */}
                  {renderEquipmentSection(selectedBooking)}
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Booking Details */}
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                    <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                      <Calendar className="h-5 w-5 mr-2" />
                      {getText('Booking Details', 'Detail Pemesanan')}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-purple-700">{getText('Purpose', 'Tujuan')}:</span>
                        <p className="text-sm font-medium text-purple-900 mt-1">{selectedBooking.purpose}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-purple-700">{getText('Start Time', 'Waktu Mulai')}:</span>
                          <p className="text-sm font-medium text-purple-900">
                            {selectedBooking.start_time ? format(new Date(selectedBooking.start_time), 'MMM d, yyyy HH:mm') : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-purple-700">{getText('End Time', 'Waktu Selesai')}:</span>
                          <p className="text-sm font-medium text-purple-900">
                            {selectedBooking.end_time ? format(new Date(selectedBooking.end_time), 'MMM d, yyyy HH:mm') : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-purple-700">{getText('SKS', 'SKS')}:</span>
                          <p className="text-sm font-medium text-purple-900">{selectedBooking.sks || 0} SKS</p>
                        </div>
                        <div>
                          <span className="text-sm text-purple-700">{getText('Class Type', 'Jenis Kelas')}:</span>
                          <p className="text-sm font-medium text-purple-900">
                            {selectedBooking.class_type === 'theory' ? getText('Theory', 'Teori') : getText('Practical', 'Praktik')}
                          </p>
                        </div>
                      </div>

                      {selectedBooking.notes && (
                        <div>
                          <span className="text-sm text-purple-700">{getText('Notes', 'Catatan')}:</span>
                          <p className="text-sm text-purple-900 mt-1 p-3 bg-white rounded-lg border border-purple-200">
                            {selectedBooking.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Information */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Info className="h-5 w-5 mr-2" />
                      {getText('Status Information', 'Informasi Status')}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{getText('Current Status', 'Status Saat Ini')}:</span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedBooking.status)}`}>
                          {getText(selectedBooking.status, selectedBooking.status === 'pending' ? 'Menunggu' : 
                                    selectedBooking.status === 'approved' ? 'Disetujui' : 
                                    selectedBooking.status === 'rejected' ? 'Ditolak' : 'Selesai')}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{getText('Created', 'Dibuat')}:</span>
                        <span className="text-sm text-gray-900">
                          {selectedBooking.created_at ? format(new Date(selectedBooking.created_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{getText('Last Updated', 'Terakhir Diperbarui')}:</span>
                        <span className="text-sm text-gray-900">
                          {selectedBooking.updated_at ? format(new Date(selectedBooking.updated_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attachments */}
                  {selectedBooking.attachments && selectedBooking.attachments.length > 0 && (
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                      <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        {getText('Booking Documents', 'Dokumen Pemesanan')}
                        <span className="ml-2 text-sm text-purple-600">({selectedBooking.attachments.length} files)</span>
                      </h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {selectedBooking.attachments.map((attachment, index) => {
                          const isPDF = attachment.startsWith('data:application/pdf') || attachment.toLowerCase().includes('.pdf');
                          
                          return (
                            <div key={index} className="relative group">
                              <div 
                                onClick={() => window.open(attachment, '_blank')}
                                className="cursor-pointer bg-white rounded-lg border border-purple-200 p-3 hover:shadow-md transition-all duration-200 hover:scale-105"
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
                                      alt={`Booking Document ${index + 1}`}
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
                                className="absolute top-1 right-1 bg-purple-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-purple-700"
                                title={getText('Quick View', 'Lihat Cepat')}
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Download All Button */}
                      <div className="mt-4 pt-4 border-t border-purple-200">
                        <button
                          onClick={() => {
                            selectedBooking.attachments?.forEach((attachment, index) => {
                              const link = document.createElement('a');
                              link.href = attachment;
                              link.download = `booking_document_${index + 1}${attachment.startsWith('data:application/pdf') ? '.pdf' : '.jpg'}`;
                              link.click();
                            });
                            alert.success(getText('Documents downloaded', 'Dokumen berhasil diunduh'));
                          }}
                          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
                        >
                          <Download className="h-4 w-4" />
                          <span>{getText('Download All Documents', 'Unduh Semua Dokumen')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {selectedBooking.status === 'pending' && (
                    <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                      <h4 className="font-medium text-yellow-900 mb-3 flex items-center">
                        <Zap className="h-5 w-5 mr-2" />
                        {getText('Actions Required', 'Tindakan Diperlukan')}
                      </h4>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => {
                            handleStatusUpdate(selectedBooking.id, 'approved');
                            setShowDetailModal(false);
                          }}
                          disabled={processingIds.has(selectedBooking.id)}
                          className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
                        >
                          {processingIds.has(selectedBooking.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Check className="h-4 w-4 mr-2" />
                          )}
                          {getText('Approve', 'Setujui')}
                        </button>
                        <button
                          onClick={() => {
                            handleStatusUpdate(selectedBooking.id, 'rejected');
                            setShowDetailModal(false);
                          }}
                          disabled={processingIds.has(selectedBooking.id)}
                          className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
                        >
                          {processingIds.has(selectedBooking.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <X className="h-4 w-4 mr-2" />
                          )}
                          {getText('Reject', 'Tolak')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  {getText('Delete Booking', 'Hapus Pemesanan')}
                </h3>
                <p className="text-sm text-gray-600">
                  {getText('This action cannot be undone', 'Tindakan ini tidak dapat dibatalkan')}
                </p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              {getText(
                'Are you sure you want to delete this booking? All associated data will be permanently removed.',
                'Apakah Anda yakin ingin menghapus pemesanan ini? Semua data terkait akan dihapus secara permanen.'
              )}
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={processingIds.has(showDeleteConfirm || '')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
              >
                {getText('Cancel', 'Batal')}
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm) {
                    handleDelete(showDeleteConfirm);
                  }
                }}
                disabled={processingIds.has(showDeleteConfirm || '')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
              >
                {processingIds.has(showDeleteConfirm || '') ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                    {getText('Deleting...', 'Menghapus...')}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2 inline" />
                    {getText('Delete', 'Hapus')}
                  </>
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