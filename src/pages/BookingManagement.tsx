import React, { useState, useEffect } from 'react';
import {
  Calendar, Search, Eye, Check, X, AlertTriangle, User, Building, Clock, RefreshCw,
  MapPin, Package, FileText, Trash2, CheckCircle, XCircle, Award, Info, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { alert } from '../components/Alert/AlertHelper';
import { format } from 'date-fns';

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
  equipment_requested: string[];
  equipment_quantities: number[];
  equipment_details: any;
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
    study_program?: { name: string; code: string };
  };
  room?: {
    id: string;
    name: string;
    code: string;
    capacity: number;
    department?: { name: string };
  };
}

const BookingManagement: React.FC = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [bookingStats, setBookingStats] = useState({
    pending: 0,
    approved: 0,
    borrowed: 0,
    rejected: 0,
    completed: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [statsLoading, setStatsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    initializeData();
    const subscription = supabase
      .channel('booking-management-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
        fetchBookingStats();
      })
      .subscribe();
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [currentPage, searchTerm, statusFilter, dateFilter]);

  const initializeData = async () => {
    await Promise.all([fetchBookings(), fetchAllEquipment(), fetchBookingStats()]);
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_bookings_paginated', {
        page_number: currentPage,
        page_size: pageSize,
        search_term: searchTerm,
        status_filter: statusFilter,
        date_filter: dateFilter,
      });

      if (error) {
        await fetchBookingsFallback();
        return;
      }

      if (data && data.length > 0) {
        setBookings(
          data.map((row: any) => ({
            ...row,
            equipment_requested: row.equipment_requested || [],
            equipment_quantities: row.equipment_quantities || [],
            attachments: row.attachments || [],
          }))
        );
        setTotalCount(data[0]?.total_count || 0);
      } else {
        setBookings([]);
        setTotalCount(0);
      }
    } catch (error) {
      await fetchBookingsFallback();
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingsFallback = async () => {
    try {
      const offset = (currentPage - 1) * pageSize;
      const { data, error } = await supabase
        .from('bookings')
        .select(
          `id, user_id, room_id, start_time, end_time, purpose, sks, class_type, status,
           equipment_requested, equipment_quantities, equipment_details, notes, attachments,
           user_info, created_at, updated_at`
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      setBookings(data || []);
      if (currentPage === 1) {
        const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
        setTotalCount(count || 0);
      }
    } catch (error) {
      alert.error(getText('Failed to load bookings', 'Gagal memuat pemesanan'));
    }
  };

  const fetchAllEquipment = async () => {
    const { data, error } = await supabase.from('equipment').select('id, name, code, category, quantity, unit').order('name');
    if (!error) setAllEquipment(data || []);
  };

  const fetchBookingStats = async () => {
    try {
      setStatsLoading(true);
      const { data, error } = await supabase.rpc('get_booking_statistics');
      if (error || !data) {
        const { data: allBookings } = await supabase.from('bookings').select('status');
        if (allBookings) {
          const stats = allBookings.reduce(
            (acc: any, booking: any) => {
              acc[booking.status] = (acc[booking.status] || 0) + 1;
              acc.total = (acc.total || 0) + 1;
              return acc;
            },
            { pending: 0, approved: 0, borrowed: 0, rejected: 0, completed: 0, total: 0 }
          );
          setBookingStats(stats);
        }
      } else setBookingStats(data);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleBorrow = async (bookingId: string) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(bookingId));
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) throw new Error('Booking not found');

      for (let i = 0; i < booking.equipment_requested.length; i++) {
        const equipmentId = booking.equipment_requested[i];
        const quantity = booking.equipment_quantities[i] || 1;
        const { error } = await supabase.rpc('decrease_equipment_quantity', {
          equipment_id: equipmentId,
          decrease_by: quantity,
        });
        if (error) throw error;
      }

      await supabase.from('bookings').update({ status: 'borrowed', updated_at: new Date().toISOString() }).eq('id', bookingId);
      alert.success(getText('Booking marked as borrowed', 'Pemesanan ditandai sebagai dipinjam'));
      await Promise.all([fetchBookings(), fetchAllEquipment(), fetchBookingStats()]);
    } catch (error: any) {
      alert.error(error.message || getText('Failed to borrow booking', 'Gagal meminjam pemesanan'));
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(bookingId);
        return newSet;
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'borrowed': return 'bg-purple-100 text-purple-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'approved': return CheckCircle;
      case 'borrowed': return Package;
      case 'rejected': return XCircle;
      case 'completed': return Award;
      default: return AlertTriangle;
    }
  };

  return (
    <div>
      {/* Table rendering with action buttons */}
      {/* On approved bookings, add Borrow button */}
      {/* Example: */}
      {bookings.map((booking) => {
        const StatusIcon = getStatusIcon(booking.status);
        return (
          <div key={booking.id}>
            <span className={`px-2 py-1 rounded ${getStatusColor(booking.status)}`}>
              <StatusIcon className="inline h-4 w-4 mr-1" />
              {booking.status}
            </span>
            {booking.status === 'approved' && (
              <button
                onClick={() => handleBorrow(booking.id)}
                disabled={processingIds.has(booking.id)}
                className="ml-2 px-3 py-1 bg-purple-600 text-white rounded"
              >
                {processingIds.has(booking.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : getText('Borrow', 'Pinjam')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BookingManagement;
