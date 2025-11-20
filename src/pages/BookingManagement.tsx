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
  HandHeart,
  ArrowRight,
  Bell,
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
  status: 'pending' | 'approved' | 'borrowed' | 'rejected' | 'completed';
  equipment_requested: string;
  equipment_quantities: number;
  equipment_details: any;
  notes: string | null;
  attachments: string;
  user_info: any;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    identity_number: string;
    phone_number: string;
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
  const [bookingStats, setBookingStats] = useState({
    pending: 0,
    approved: 0,
    borrowed: 0,
    rejected: 0,
    completed: 0,
    total: 0
  });
  
  // Loading and UI states
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  // Modal states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBorrowConfirm, setShowBorrowConfirm] = useState<string | null>(null);
  
  // Schedule states
  const [combinedSchedules, setCombinedSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  // Initialize data on component mount
  useEffect(() => {
    initializeData();
    
    // Set up real-time subscription for live updates
    const subscription = supabase
      .channel('booking-management-realtime')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bookings'
        }, 
        (payload) => {
          console.log('🔄 Real-time update received:', payload);
          try {
            fetchBookings();
            fetchBookingStats();
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

  // Refetch data when filters or pagination change
  useEffect(() => {
    fetchBookings();
  }, [currentPage, searchTerm, statusFilter, dateFilter]);

  // Fetch combined schedules when detail modal is opened
  useEffect(() => {
    if (showDetailModal && selectedBooking && selectedBooking.room) {
      const bookingDate = format(new Date(selectedBooking.start_time), 'yyyy-MM-dd');
      fetchCombinedSchedulesForRoom(
        selectedBooking.room.id,
        selectedBooking.room.name,
        bookingDate
      );
    }
  }, [showDetailModal, selectedBooking]);

  // Initialize all data
  const initializeData = async () => {
    await Promise.all([
      fetchBookings(),
      fetchAllEquipment(),
      fetchBookingStats()
    ]);
  };

  // FETCH BOOKINGS
  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      console.log('🚀 Fetching bookings...');
      
      // Calculate offset for pagination
      const offset = (currentPage - 1) * pageSize;
      
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
          equipment_details,
          notes,
          attachments,
          user_info,
          created_at,
          updated_at,
          user:users(
            id,
            full_name,
            identity_number,
            phone_number,
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
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setBookings(data || []);
      
      // Get total count for pagination
      if (currentPage === 1) {
        let countQuery = supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true });
        
        if (statusFilter !== 'all') {
          countQuery = countQuery.eq('status', statusFilter);
        }
        
        const { count } = await countQuery;
        setTotalCount(count || 0);
      }
      
      console.log(`✅ Successfully loaded ${data?.length || 0} bookings`);
      
    } catch (error) {
      console.error('❌ Error fetching bookings:', error);
      alert.error(getText('Failed to load bookings', 'Gagal memuat pemesanan'));
    } finally {
      setLoading(false);
    }
  };

  // FETCH EQUIPMENT DATA
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
      alert.error(getText('Failed to load equipment data', 'Gagal memuat data peralatan'));
    }
  };

  // FETCH BOOKING STATISTICS
  const fetchBookingStats = async () => {
    try {
      setStatsLoading(true);
      
      const { data: allBookings } = await supabase
        .from('bookings')
        .select('status');
      
      if (allBookings) {
        const stats = allBookings.reduce((acc, booking) => {
          acc[booking.status] = (acc[booking.status] || 0) + 1;
          acc.total = (acc.total || 0) + 1;
          return acc;
        }, { pending: 0, approved: 0, borrowed: 0, rejected: 0, completed: 0, total: 0 });
        
        setBookingStats(stats);
      }
    } catch (error) {
      console.error('Error fetching booking statistics:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // FETCH COMBINED SCHEDULES FOR ROOM
  const fetchCombinedSchedulesForRoom = async (roomId: string, roomName: string, bookingStartDate: string) => {
    setLoadingSchedules(true);
    try {
      const combined: any[] = [];
      
      // Get day name in Indonesian
      const dayNamesIndonesian = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      const dayNameIndonesian = dayNamesIndonesian[new Date(bookingStartDate).getDay()];
      
      console.log(`📅 Fetching combined schedules for room ${roomName} on ${bookingStartDate} (${dayNameIndonesian})`);

      // 1. Fetch lecture schedules
      const { data: lectureData } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', dayNameIndonesian)
        .ilike('room', `%${roomName}%`)
        .order('start_time');
      
      if (lectureData) {
        lectureData.forEach(lecture => {
          combined.push({
            id: lecture.id,
            type: 'lecture',
            start_time: lecture.start_time?.substring(0, 5) || '',
            end_time: lecture.end_time?.substring(0, 5) || '',
            title: lecture.course_name || getText('Lecture', 'Kuliah'),
            subtitle: `${getText('Class', 'Kelas')} ${lecture.class} • ${lecture.subject_study}`,
            description: `${getText('Lecturer', 'Dosen')}: ${lecture.lecturer || 'TBA'} • ${getText('Semester', 'Semester')} ${lecture.semester}`,
            icon: BookOpen,
            color: 'text-blue-700',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
          });
        });
      }

      // 2. Fetch exam schedules
      const { data: examData } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', bookingStartDate)
        .order('start_time');
      
      if (examData) {
        examData.forEach(exam => {
          combined.push({
            id: exam.id,
            type: 'exam',
            start_time: exam.start_time?.substring(0, 5) || '',
            end_time: exam.end_time?.substring(0, 5) || '',
            title: exam.course_name || getText('UAS Exam', 'Ujian UAS'),
            subtitle: `${exam.student_amount} ${getText('students', 'mahasiswa')} • ${getText('Semester', 'Semester')} ${exam.semester}`,
            description: `${getText('Class', 'Kelas')} ${exam.class} • ${getText('Inspector', 'Pengawas')}: ${exam.inspector}`,
            icon: GraduationCap,
            color: 'text-green-700',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
          });
        });
      }

      // 3. Fetch final sessions
      const { data: sessionData } = await supabase
        .from('final_sessions')
        .select(`
          *,
          student:users!student_id(full_name, identity_number)
        `)
        .eq('room_id', roomId)
        .eq('date', bookingStartDate)
        .order('start_time');
      
      if (sessionData) {
        sessionData.forEach(session => {
          combined.push({
            id: session.id,
            type: 'session',
            start_time: session.start_time?.substring(0, 5) || '',
            end_time: session.end_time?.substring(0, 5) || '',
            title: session.student?.full_name || getText('Final Session', 'Sidang Akhir'),
            subtitle: `ID: ${session.student?.identity_number}`,
            description: `${getText('Supervisor', 'Pembimbing')}: ${session.supervisor} • ${getText('Examiner', 'Penguji')}: ${session.examiner}`,
            icon: GraduationCap,
            color: 'text-purple-700',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
          });
        });
      }

      // 4. Fetch bookings for this date
      const startOfDay = `${bookingStartDate}T00:00:00Z`;
      const endOfDay = `${bookingStartDate}T23:59:59Z`;
      
      const { data: bookingData } = await supabase
        .from('bookings')
        .select(`
          *,
          user:users!user_id(full_name, identity_number)
        `)
        .eq('room_id', roomId)
        .in('status', ['approved', 'borrowed'])
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time');
      
      if (bookingData) {
        bookingData.forEach(booking => {
          const startDate = new Date(booking.start_time);
          const endDate = new Date(booking.end_time);
          
          combined.push({
            id: booking.id,
            type: 'booking',
            start_time: format(startDate, 'HH:mm'),
            end_time: format(endDate, 'HH:mm'),
            title: booking.purpose || getText('Room Booking', 'Pemesanan Ruangan'),
            subtitle: `${booking.user?.full_name} • ${booking.user?.identity_number}`,
            description: `${getText('Status', 'Status')}: ${booking.status === 'approved' ? getText('APPROVED', 'DISETUJUI') : getText('BORROWED', 'DIPINJAM')}`,
            icon: Calendar,
            color: 'text-orange-700',
            bgColor: 'bg-orange-50',
            borderColor: 'border-orange-200'
          });
        });
      }

      combined.sort((a, b) => a.start_time.localeCompare(b.start_time));
      setCombinedSchedules(combined);

    } catch (error) {
      console.error('Error fetching combined schedules:', error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  // HANDLE STATUS UPDATE (APPROVE/REJECT)
  const handleStatusUpdate = async (bookingId: string, newStatus: 'approved' | 'rejected') => {
    try {
      setProcessingIds(prev => new Set(prev).add(bookingId));
      
      console.log('📋 Updating booking status...');
      
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Update booking status
      const updateData = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      const { error: bookingError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (bookingError) throw bookingError;
      
      const statusText = newStatus === 'approved' ? getText('approved', 'disetujui') : getText('rejected', 'ditolak');
      alert.success(getText(`Booking ${statusText} successfully`, `Pemesanan berhasil ${statusText}`));
      
      // Refresh data
      await Promise.all([
        fetchBookings(),
        fetchBookingStats()
      ]);
      
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

  // HANDLE BORROW UPDATE (APPROVED -> BORROWED)
  const handleBorrowUpdate = async (bookingId: string) => {
  try {
    setProcessingIds(prev => new Set(prev).add(bookingId));
    
    console.log('📦 Processing borrow request...');
    
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status !== 'approved') {
      throw new Error('Only approved bookings can be borrowed');
    }

    // Parse equipment dan quantities
    const equipmentList = parseEquipmentRequested(booking.equipment_requested);
    const quantities = getEquipmentQuantities(booking);
    
    console.log('📋 Equipment and quantities:', {
      equipmentList,
      quantities,
      rawEquipmentRequested: booking.equipment_requested,
      rawEquipmentQuantities: booking.equipment_quantities
    });

    // Check equipment availability before borrowing
    if (equipmentList.length > 0) {
      for (let i = 0; i < equipmentList.length; i++) {
        const equipmentId = equipmentList[i];
        const quantity = quantities[i] || 1; // Ambil quantity sesuai index
        
        console.log(`🔍 Checking equipment ${i}:`, { equipmentId, quantity });
        
        const availability = getEquipmentAvailability(equipmentId);
        
        if (availability.available < quantity) {
          throw new Error(`Insufficient equipment quantity for ${equipmentId}. Available: ${availability.available}, Required: ${quantity}`);
        }
      }
    }

    // Decrease equipment quantities when borrowed
    if (equipmentList.length > 0) {
      for (let i = 0; i < equipmentList.length; i++) {
        const equipmentId = equipmentList[i];
        const quantity = quantities[i] || 1; // Ambil quantity sesuai index
        
        console.log(`📉 Decreasing equipment ${i}:`, { equipmentId, quantity });
        
        // PENTING: Kirim quantity sebagai INTEGER, bukan array
        const { error } = await supabase.rpc('decrease_equipment_quantity', {
          equipment_id: equipmentId,
          decrease_by: quantity // Ini harus INTEGER, bukan array
        });
        
        if (error) {
          console.error(`❌ Failed to decrease equipment ${equipmentId}:`, error);
          throw new Error(`Failed to update equipment ${equipmentId}: ${error.message}`);
        }
        
        console.log(`✅ Successfully decreased equipment ${equipmentId} by ${quantity}`);
      }
    }

    // Update booking status to borrowed
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ 
        status: 'borrowed',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (bookingError) throw bookingError;
    
    alert.success(getText('Equipment borrowed successfully', 'Peralatan berhasil dipinjam'));
    setShowBorrowConfirm(null);
    
    // Refresh data
    await Promise.all([
      fetchBookings(),
      fetchAllEquipment(),
      fetchBookingStats()
    ]);
    
    if (selectedBooking?.id === bookingId) {
      setShowDetailModal(false);
    }
    
  } catch (error: any) {
    console.error('❌ Error processing borrow request:', error);
    alert.error(error.message || getText('Failed to process borrow request', 'Gagal memproses permintaan peminjaman'));
  } finally {
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(bookingId);
      return newSet;
    });
  }
};

  // HANDLE DELETE
  const handleDelete = async (bookingId: string) => {
  try {
    setProcessingIds(prev => new Set(prev).add(bookingId));
    
    console.log('🗑️ Deleting booking...');
    
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Restore equipment quantities if booking was approved or borrowed
    const equipmentList = parseEquipmentRequested(booking.equipment_requested);
    const quantities = getEquipmentQuantities(booking);
    
    if ((booking.status === 'approved' || booking.status === 'borrowed') && equipmentList.length > 0) {
      for (let i = 0; i < equipmentList.length; i++) {
        const equipmentId = equipmentList[i];
        const quantity = quantities[i] || 1; // Ambil quantity sesuai index
        
        console.log(`📈 Restoring equipment ${i}:`, { equipmentId, quantity });
        
        // PENTING: Kirim quantity sebagai INTEGER, bukan array
        const { error } = await supabase.rpc('increase_equipment_quantity', {
          equipment_id: equipmentId,
          increase_by: quantity // Ini harus INTEGER, bukan array
        });
        
        if (error) {
          console.error(`❌ Failed to restore equipment ${equipmentId}:`, error);
          // Don't throw error here, just log it
        } else {
          console.log(`✅ Successfully restored equipment ${equipmentId} by ${quantity}`);
        }
      }
    }

    // Delete the booking
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (error) throw error;
    
    alert.success(getText('Booking deleted successfully', 'Pemesanan berhasil dihapus'));
    setShowDeleteConfirm(null);
    
    // Refresh data
    await Promise.all([
      fetchBookings(),
      fetchAllEquipment(),
      fetchBookingStats()
    ]);
    
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

  // EQUIPMENT UTILITY FUNCTIONS
  const parseEquipmentRequested = (equipmentStr: any): string[] => {
  // Handle null, undefined, atau empty
  if (!equipmentStr) return [];
  
  // Jika sudah array, return langsung
  if (Array.isArray(equipmentStr)) {
    return equipmentStr.map(item => String(item)).filter(item => item);
  }
  
  // Jika bukan string, convert ke string dulu
  const strValue = String(equipmentStr);
  
  // Jika string kosong setelah convert
  if (!strValue || strValue === 'null' || strValue === 'undefined') return [];
  
  try {
    // Try parsing as JSON first
    const parsed = JSON.parse(strValue);
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item)).filter(item => item);
    }
    // Jika JSON parse berhasil tapi bukan array, treat as single item
    return [String(parsed)].filter(item => item);
  } catch {
    // Fallback to comma-separated values
    return strValue.split(',').map(item => String(item).trim()).filter(item => item);
  }
};
  
 const parseAttachments = (attachmentStr: any): string[] => {
  // Handle null, undefined, atau empty
  if (!attachmentStr) return [];
  
  // Jika sudah array, return langsung
  if (Array.isArray(attachmentStr)) {
    return attachmentStr.map(item => String(item)).filter(item => item);
  }
  
  // Jika bukan string, convert ke string dulu
  const strValue = String(attachmentStr);
  
  // Jika string kosong setelah convert
  if (!strValue || strValue === 'null' || strValue === 'undefined') return [];
  
  try {
    // Try parsing as JSON first
    const parsed = JSON.parse(strValue);
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item)).filter(item => item);
    }
    // Jika JSON parse berhasil tapi bukan array, treat as single item
    return [String(parsed)].filter(item => item);
  } catch {
    // Fallback to comma-separated values
    return strValue.split(',').map(item => String(item).trim()).filter(item => item);
  }
};

  const getEquipmentQuantities = (booking: Booking): number[] => {
  const equipmentList = parseEquipmentRequested(booking.equipment_requested);
  
  // Jika tidak ada equipment, return empty array
  if (equipmentList.length === 0) return [];
  
  // Jika equipment_quantities adalah array (yang diharapkan)
  if (Array.isArray(booking.equipment_quantities)) {
    const quantities = booking.equipment_quantities.map(qty => Number(qty) || 1);
    // Pastikan panjang array sama dengan equipment list
    if (quantities.length === equipmentList.length) {
      return quantities;
    }
    // Jika tidak sama, ambil sebanyak equipment yang ada
    return equipmentList.map((_, index) => quantities[index] || 1);
  }
  
  // Jika equipment_quantities adalah string JSON array
  if (typeof booking.equipment_quantities === 'string') {
    try {
      const parsed = JSON.parse(booking.equipment_quantities);
      if (Array.isArray(parsed)) {
        const quantities = parsed.map(qty => Number(qty) || 1);
        return equipmentList.map((_, index) => quantities[index] || 1);
      }
    } catch (error) {
      console.log('Failed to parse equipment_quantities as JSON:', error);
    }
  }
  
  // Jika equipment_quantities adalah single number
  if (typeof booking.equipment_quantities === 'number' && booking.equipment_quantities > 0) {
    // Gunakan number yang sama untuk semua equipment
    return equipmentList.map(() => booking.equipment_quantities);
  }
  
  // Default: 1 untuk setiap equipment
  return equipmentList.map(() => 1);
};

  const getEquipmentAvailability = (equipmentId: string) => {
    const equipment = allEquipment.find(eq => eq.id === equipmentId || eq.code === equipmentId || eq.name === equipmentId);
    if (!equipment) return { available: 0, total: 0 };
    
    return {
      available: equipment.quantity,
      total: equipment.quantity,
    };
  };

  // FILTERING
  const filteredBookings = bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
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

  // UTILITY FUNCTIONS
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'borrowed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'completed': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'approved': return CheckCircle;
      case 'borrowed': return HandHeart;
      case 'rejected': return XCircle;
      case 'completed': return Award;
      default: return AlertIcon;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return getText('Pending', 'Menunggu');
      case 'approved': return getText('Approved', 'Disetujui');
      case 'borrowed': return getText('Borrowed', 'Dipinjam');
      case 'rejected': return getText('Rejected', 'Ditolak');
      case 'completed': return getText('Completed', 'Selesai');
      default: return status;
    }
  };

  const getAvailableActions = (booking: Booking) => {
    const actions = [];
    
    switch (booking.status) {
      case 'pending':
        actions.push(
          { type: 'approve', label: getText('Approve', 'Setujui'), icon: Check, color: 'green' },
          { type: 'reject', label: getText('Reject', 'Tolak'), icon: X, color: 'red' }
        );
        break;
      case 'approved':
        actions.push(
          { type: 'borrow', label: getText('Mark as Borrowed', 'Tandai Dipinjam'), icon: HandHeart, color: 'blue' },
          { type: 'reject', label: getText('Cancel Approval', 'Batalkan Persetujuan'), icon: X, color: 'red' }
        );
        break;
      case 'borrowed':
        break;
      case 'rejected':
        actions.push(
          { type: 'approve', label: getText('Re-approve', 'Setujui Ulang'), icon: Check, color: 'green' }
        );
        break;
      case 'completed':
        break;
    }
    
    return actions;
  };

  // RENDER EQUIPMENT SECTION
  const renderEquipmentSection = (selectedBooking: Booking) => {
    const equipmentList = parseEquipmentRequested(selectedBooking.equipment_requested);
    const quantities = getEquipmentQuantities(selectedBooking);
    
    if (equipmentList.length === 0) {
      return null;
    }

    const totalItems = quantities.reduce((sum, qty) => sum + qty, 0);

    return (
      <div>
        <h5 className="font-medium text-gray-900 mb-3 flex items-center">
          <Package className="h-5 w-5 mr-2 text-blue-600" />
          {getText('Requested Equipment', 'Peralatan yang Diminta')}
          <span className="ml-2 text-sm text-gray-500">
            ({equipmentList.length} types, {totalItems} total items)
          </span>
        </h5>
        
        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {equipmentList.map((equipmentId, index) => {
              const requestedQuantity = quantities[index] || 1;

              const equipmentDetails = allEquipment.find(eq => 
                eq.id === equipmentId || eq.code === equipmentId || eq.name === equipmentId
              );
              const equipmentName = equipmentDetails?.name || `Equipment ${equipmentId}`;
              const equipmentCode = equipmentDetails?.code || 'Unknown';
              const equipmentUnit = equipmentDetails?.unit || 'pcs';
              
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
                  
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="text-xs font-medium text-gray-600 mb-2">CURRENT AVAILABILITY</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Available:</span>
                      <span className={`font-bold text-lg ${availability.available >= requestedQuantity ? 'text-green-600' : 'text-red-600'}`}>
                        {availability.available}
                      </span>
                    </div>
                    
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

                  {selectedBooking.status === 'borrowed' && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center text-blue-700">
                        <HandHeart className="h-4 w-4 mr-1" />
                        <span className="text-xs font-medium">
                          {getText('Currently borrowed', 'Sedang dipinjam')}
                        </span>
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        {getText('Last updated', 'Terakhir diperbarui')}: {selectedBooking.updated_at ? format(new Date(selectedBooking.updated_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t border-emerald-200">
            {(() => {
              const allSufficient = equipmentList.every((equipmentId, index) => {
                const requestedQuantity = quantities[index] || 1;
                const availability = getEquipmentAvailability(equipmentId);
                return availability.available >= requestedQuantity;
              });
              
              return allSufficient ? (
                <div className="flex items-center text-green-700 bg-green-100 rounded-lg p-3">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">
                    {getText('✅ All equipment available for booking', '✅ Semua peralatan tersedia untuk pemesanan')}
                    <span className="ml-2 text-sm">({totalItems} items total)</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center text-red-700 bg-red-100 rounded-lg p-3">
                  <XCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">
                    {getText('❌ Some equipment insufficient for booking', '❌ Beberapa peralatan tidak mencukupi untuk pemesanan')}
                    <span className="ml-2 text-sm">({totalItems} items requested)</span>
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  // PAGINATION COMPONENT
  const renderPagination = () => {
    if (loading || totalCount <= pageSize) return null;
    
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages <= 1) return null;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {getText(
              `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} bookings`,
              `Menampilkan ${((currentPage - 1) * pageSize) + 1} hingga ${Math.min(currentPage * pageSize, totalCount)} dari ${totalCount} pemesanan`
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

  // ACCESS CONTROL CHECK
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
              {getText('Review and manage room booking requests with equipment borrowing', 'Tinjau dan kelola permintaan pemesanan ruangan dengan peminjaman peralatan')}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : (
                bookingStats.total || bookings.length
              )}
            </div>
            <div className="text-sm opacity-80">{getText('Total Bookings', 'Total Pemesanan')}</div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards with Borrowed Status */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { 
            label: getText('Pending', 'Menunggu'), 
            count: bookingStats.pending, 
            color: 'bg-yellow-500', 
            icon: Clock,
            description: getText('Awaiting review', 'Menunggu tinjauan')
          },
          { 
            label: getText('Approved', 'Disetujui'), 
            count: bookingStats.approved, 
            color: 'bg-green-500', 
            icon: CheckCircle,
            description: getText('Ready to borrow', 'Siap dipinjam')
          },
          { 
            label: getText('Borrowed', 'Dipinjam'), 
            count: bookingStats.borrowed, 
            color: 'bg-blue-500', 
            icon: HandHeart,
            description: getText('Currently borrowed', 'Sedang dipinjam')
          },
          { 
            label: getText('Rejected', 'Ditolak'), 
            count: bookingStats.rejected, 
            color: 'bg-red-500', 
            icon: XCircle,
            description: getText('Request denied', 'Permintaan ditolak')
          },
          { 
            label: getText('Completed', 'Selesai'), 
            count: bookingStats.completed, 
            color: 'bg-purple-500', 
            icon: Award,
            description: getText('Returned', 'Dikembalikan')
          },
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className={`${stat.color} p-2 rounded-lg`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    stat.count
                  )}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{stat.label}</p>
              <p className="text-xs text-gray-500">{stat.description}</p>
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
              <option value="borrowed">{getText('Borrowed', 'Dipinjam')}</option>
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
                initializeData();
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
                  const equipmentList = parseEquipmentRequested(booking.equipment_requested);
                  const availableActions = getAvailableActions(booking);
                  
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
                              {booking.user?.phone_number || booking.user_info?.phone_number || 'No ID'}
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
                          
                          {equipmentList.length > 0 && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Package className="h-4 w-4 mr-1 text-gray-400" />
                              <span>
                                {equipmentList.length} {getText('equipment', 'peralatan')}
                                {booking.equipment_quantities && (
                                  <span className="ml-1 text-xs text-gray-500">
                                    ({getEquipmentQuantities(booking).reduce((sum, qty) => sum + qty, 0)} items)
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

                          {booking.status === 'borrowed' && (
                            <div className="text-xs text-blue-600 flex items-center">
                              <HandHeart className="h-3 w-3 mr-1" />
                              {getText('Status', 'Status')}: {getStatusText(booking.status)}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <StatusIcon className="h-4 w-4" />
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}>
                            {getStatusText(booking.status)}
                          </span>
                          {booking.status === 'pending' && (
                            <Bell className="h-3 w-3 text-yellow-500 animate-pulse" title={getText('Needs attention', 'Perlu perhatian')} />
                          )}
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

                          {availableActions.map((action, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                if (action.type === 'approve') {
                                  handleStatusUpdate(booking.id, 'approved');
                                } else if (action.type === 'reject') {
                                  handleStatusUpdate(booking.id, 'rejected');
                                } else if (action.type === 'borrow') {
                                  setShowBorrowConfirm(booking.id);
                                }
                              }}
                              disabled={processingIds.has(booking.id)}
                              className={`p-2 text-gray-400 hover:text-${action.color}-600 hover:bg-${action.color}-50 rounded-lg transition-colors duration-200 disabled:opacity-50`}
                              title={action.label}
                            >
                              {processingIds.has(booking.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <action.icon className="h-4 w-4" />
                              )}
                            </button>
                          ))}

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
              {/* HEADER SECTION: 3 Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Column 1: User Information */}
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
                        {selectedBooking.user?.phone_number|| selectedBooking.user_info?.phone_number || 'No ID'}
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

                {/* Column 2: Room Information */}
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

                {/* Column 3: Booking Details */}
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
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <span className="text-sm text-purple-700">{getText('Start Time', 'Waktu Mulai')}:</span>
                        <p className="text-xs font-medium text-purple-900">
                          {selectedBooking.start_time ? format(new Date(selectedBooking.start_time), 'MMM d HH:mm') : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-purple-700">{getText('End Time', 'Waktu Selesai')}:</span>
                        <p className="text-xs font-medium text-purple-900">
                          {selectedBooking.end_time ? format(new Date(selectedBooking.end_time), 'MMM d HH:mm') : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-sm text-purple-700">{getText('SKS', 'SKS')}:</span>
                        <p className="text-xs font-medium text-purple-900">{selectedBooking.sks || 0}</p>
                      </div>
                      <div>
                        <span className="text-sm text-purple-700">{getText('Type', 'Tipe')}:</span>
                        <p className="text-xs font-medium text-purple-900">
                          {selectedBooking.class_type === 'theory' ? getText('Theory', 'Teori') : getText('Practical', 'Praktik')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FULL WIDTH SECTION: Room Schedule */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 overflow-hidden mb-6">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold">{getText('Room Schedule', 'Jadwal Ruangan')}</h4>
                        <p className="text-indigo-100 text-sm">
                          {format(new Date(selectedBooking.start_time), 'EEEE, MMMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1">
                      <span className="text-sm font-semibold">
                        {combinedSchedules.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {loadingSchedules ? (
                    <div className="flex justify-center items-center h-32">
                      <RefreshCw className="animate-spin h-6 w-6 text-indigo-600"/>
                    </div>
                  ) : combinedSchedules.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {combinedSchedules.map((schedule, index) => {
                        const IconComponent = schedule.icon;
                        return (
                          <div 
                            key={`${schedule.type}-${schedule.id}-${index}`} 
                            className={`${schedule.bgColor} rounded-lg p-3 border ${schedule.borderColor}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <div className={`p-1.5 bg-white rounded`}>
                                  <IconComponent className={`h-3.5 w-3.5 ${schedule.color}`} />
                                </div>
                                <span className={`text-xs font-medium ${schedule.color} bg-white px-2 py-0.5 rounded-full`}>
                                  {schedule.type === 'lecture' ? getText('Lecture', 'Kuliah') : 
                                   schedule.type === 'exam' ? getText('Exam', 'UAS') :
                                   schedule.type === 'session' ? getText('Session', 'Sidang') :
                                   getText('Booking', 'Booking')}
                                </span>
                                <span className="font-semibold text-gray-900 text-sm">
                                  {schedule.end_time ? 
                                    `${schedule.start_time} - ${schedule.end_time}` : 
                                    schedule.start_time
                                  }
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-900 text-sm">
                                {schedule.title}
                              </div>
                              {schedule.subtitle && (
                                <div className={`text-xs ${schedule.color} font-medium`}>
                                  {schedule.subtitle}
                                </div>
                              )}
                              {schedule.description && (
                                <div className="text-xs text-gray-600">
                                  {schedule.description}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50"/>
                      <p className="text-sm">{getText('No schedule for this room on this date', 'Tidak ada jadwal untuk ruangan ini pada tanggal ini')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Information & Equipment Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Status Information */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Info className="h-5 w-5 mr-2" />
                    {getText('Status Information', 'Informasi Status')}
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{getText('Current Status', 'Status Saat Ini')}:</span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedBooking.status)}`}>
                        {getStatusText(selectedBooking.status)}
                      </span>
                    </div>
                    
                    {/* Simplified Timeline */}
                    <div className="border-l-2 border-gray-200 pl-4 space-y-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{getText('Created', 'Dibuat')}</div>
                          <div className="text-xs text-gray-500">
                            {selectedBooking.created_at ? format(new Date(selectedBooking.created_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          selectedBooking.status === 'pending' ? 'bg-yellow-500' :
                          selectedBooking.status === 'approved' ? 'bg-green-500' :
                          selectedBooking.status === 'borrowed' ? 'bg-blue-500' :
                          selectedBooking.status === 'rejected' ? 'bg-red-500' :
                          selectedBooking.status === 'completed' ? 'bg-purple-500' : 'bg-gray-300'
                        }`}></div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{getText('Last Updated', 'Terakhir Diperbarui')}</div>
                          <div className="text-xs text-gray-500">
                            {selectedBooking.updated_at ? format(new Date(selectedBooking.updated_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Status: {getStatusText(selectedBooking.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Equipment Section */}
                {renderEquipmentSection(selectedBooking)}
              </div>

              {/* FULL WIDTH SECTION: Attachments */}
              {selectedBooking.attachments && parseAttachments(selectedBooking.attachments).length > 0 && (
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                      <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        {getText('Booking Documents', 'Dokumen Pemesanan')}
                        <span className="ml-2 text-sm text-purple-600">({parseAttachments(selectedBooking.attachments).length} files)</span>
                      </h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {parseAttachments(selectedBooking.attachments).map((attachment, index) => {
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
                      
                      <div className="mt-4 pt-4 border-t border-purple-200">
                        <button
                          onClick={() => {
                            parseAttachments(selectedBooking.attachments).forEach((attachment, index) => {
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

              {/* FULL WIDTH SECTION: Enhanced Actions */}
              {(() => {
                    const availableActions = getAvailableActions(selectedBooking);
                    if (availableActions.length === 0) return null;

                    return (
                      <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                        <h4 className="font-medium text-yellow-900 mb-3 flex items-center">
                          <Zap className="h-5 w-5 mr-2" />
                          {getText('Available Actions', 'Tindakan yang Tersedia')}
                        </h4>
                        
                        <div className="mb-4 p-3 bg-white rounded-lg border border-yellow-200">
                          {selectedBooking.status === 'pending' && (
                            <div className="flex items-start space-x-2">
                              <Bell className="h-4 w-4 text-yellow-600 mt-0.5" />
                              <div className="text-sm text-yellow-800">
                                <p className="font-medium">{getText('Pending Review', 'Menunggu Tinjauan')}</p>
                                <p className="text-xs mt-1">
                                  {getText('This booking requires your approval or rejection. Review the details and equipment availability before deciding.', 
                                           'Pemesanan ini memerlukan persetujuan atau penolakan Anda. Tinjau detail dan ketersediaan peralatan sebelum memutuskan.')}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {selectedBooking.status === 'approved' && (
                            <div className="flex items-start space-x-2">
                              <ArrowRight className="h-4 w-4 text-green-600 mt-0.5" />
                              <div className="text-sm text-green-800">
                                <p className="font-medium">{getText('Ready for Borrowing', 'Siap untuk Dipinjam')}</p>
                                <p className="text-xs mt-1">
                                  {getText('This booking has been approved. Mark as "Borrowed" when the user picks up the equipment.', 
                                           'Pemesanan ini telah disetujui. Tandai sebagai "Dipinjam" ketika pengguna mengambil peralatan.')}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {selectedBooking.status === 'rejected' && (
                            <div className="flex items-start space-x-2">
                              <RefreshCw className="h-4 w-4 text-red-600 mt-0.5" />
                              <div className="text-sm text-red-800">
                                <p className="font-medium">{getText('Previously Rejected', 'Sebelumnya Ditolak')}</p>
                                <p className="text-xs mt-1">
                                  {getText('You can re-approve this booking if circumstances have changed.', 
                                           'Anda dapat menyetujui ulang pemesanan ini jika keadaan telah berubah.')}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          {availableActions.map((action, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                if (action.type === 'approve') {
                                  handleStatusUpdate(selectedBooking.id, 'approved');
                                  setShowDetailModal(false);
                                } else if (action.type === 'reject') {
                                  handleStatusUpdate(selectedBooking.id, 'rejected');
                                  setShowDetailModal(false);
                                } else if (action.type === 'borrow') {
                                  setShowBorrowConfirm(selectedBooking.id);
                                  setShowDetailModal(false);
                                }
                              }}
                              disabled={processingIds.has(selectedBooking.id)}
                              className={`flex-1 flex items-center justify-center px-4 py-2 bg-${action.color}-600 text-white rounded-lg hover:bg-${action.color}-700 disabled:opacity-50 transition-colors duration-200`}
                            >
                              {processingIds.has(selectedBooking.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <action.icon className="h-4 w-4 mr-2" />
                              )}
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
            </div>
          </div>
        </div>
      )}

      {/* Borrow Confirmation Modal */}
      {showBorrowConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <HandHeart className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  {getText('Confirm Equipment Borrowing', 'Konfirmasi Peminjaman Peralatan')}
                </h3>
                <p className="text-sm text-gray-600">
                  {getText('Mark equipment as borrowed', 'Tandai peralatan sebagai dipinjam')}
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center mb-2">
                  <Info className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-900">
                    {getText('What happens when you confirm:', 'Yang terjadi ketika Anda konfirmasi:')}
                  </span>
                </div>
                <ul className="text-sm text-blue-800 space-y-1 ml-6">
                  <li>• {getText('Status changes from "Approved" to "Borrowed"', 'Status berubah dari "Disetujui" ke "Dipinjam"')}</li>
                                    <li>• {getText('Equipment quantities will be reduced', 'Kuantitas peralatan akan dikurangi')}</li>
                  <li>• {getText('Borrowing timestamp will be recorded', 'Waktu peminjaman akan dicatat')}</li>
                  <li>• {getText('User can now use the equipment', 'Pengguna sekarang dapat menggunakan peralatan')}</li>
                </ul>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              {getText(
                'Are you sure the user has picked up the equipment and you want to mark this booking as borrowed?',
                'Apakah Anda yakin pengguna telah mengambil peralatan dan Anda ingin menandai pemesanan ini sebagai dipinjam?'
              )}
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBorrowConfirm(null)}
                disabled={processingIds.has(showBorrowConfirm || '')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
              >
                {getText('Cancel', 'Batal')}
              </button>
              <button
                onClick={() => {
                  if (showBorrowConfirm) {
                    handleBorrowUpdate(showBorrowConfirm);
                  }
                }}
                disabled={processingIds.has(showBorrowConfirm || '')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
              >
                {processingIds.has(showBorrowConfirm || '') ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                    {getText('Processing...', 'Memproses...')}
                  </>
                ) : (
                  <>
                    <HandHeart className="h-4 w-4 mr-2 inline" />
                    {getText('Confirm Borrowing', 'Konfirmasi Peminjaman')}
                  </>
                )}
              </button>
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
            
            <div className="mb-6">
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                  <span className="text-sm font-medium text-red-900">
                    {getText('What happens when you delete:', 'Yang terjadi ketika Anda hapus:')}
                  </span>
                </div>
                <ul className="text-sm text-red-800 space-y-1 ml-6">
                  <li>• {getText('Booking will be permanently removed', 'Pemesanan akan dihapus secara permanen')}</li>
                  <li>• {getText('Equipment quantities will be restored (if applicable)', 'Kuantitas peralatan akan dipulihkan (jika berlaku)')}</li>
                  <li>• {getText('All booking data and attachments will be lost', 'Semua data pemesanan dan lampiran akan hilang')}</li>
                  <li>• {getText('This action cannot be reversed', 'Tindakan ini tidak dapat dibatalkan')}</li>
                </ul>
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