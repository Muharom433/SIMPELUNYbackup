import React, { useState, useEffect } from 'react';
import {
  Bell, Clock, CheckCircle, XCircle, AlertTriangle, User, Building, Calendar,
  Timer, Eye, Check, X, RefreshCw, Filter, Search, FileText, Zap, Users, Package,
  ChevronRight, ChevronDown, Flag, MessageSquare, AlertCircle, CalendarIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Booking, Room, User as UserType, Department } from '../types';
import toast from 'react-hot-toast';
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, compareAsc, startOfDay, endOfDay } from 'date-fns';

// Tipe data untuk Equipment
interface Equipment {
  id: string;
  name: string;
  is_mandatory: boolean;
}

// Tipe data untuk Room yang diperbarui sesuai skema
interface RoomWithEquipment extends Room {
  equipment: string[];
}

// Tipe data untuk join yang kompleks
interface BookingWithDetails extends Booking {
  user?: UserType;
  room?: RoomWithEquipment & { department?: Department };
}

interface Checkout {
  id: string;
  user_id: string;
  booking_id: string;
  checkout_date: string;
  expected_return_date: string;
  status: 'active' | 'returned' | 'overdue' | 'lost' | 'damaged' | 'pending'; // Menambahkan 'pending' jika ada
  total_items: number;
  created_at: string;
  type: 'room' | 'equipment';
  checkout_notes: string | null;
  user?: {
    id: string;
    full_name: string;
    identity_number: string;
    email: string;
  };
  booking?: BookingWithDetails;
  has_report?: boolean;
  report?: {
    id: string;
    title: string;
    description: string;
    severity: 'minor' | 'major' | 'critical';
    created_at: string;
  };
  equipment_back: string[] | null;
}

type RoomEquipmentMap = Map<string, Equipment[]>;

const ValidationQueue: React.FC = () => {
  const { profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'room' | 'equipment'>('room');
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [roomEquipment, setRoomEquipment] = useState<RoomEquipmentMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCheckoutId, setSelectedCheckoutId] = useState<string | null>(null); // PERBAIKAN MODAL
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSeverity, setReportSeverity] = useState<'minor' | 'major' | 'critical'>('minor');
  const [sortOption, setSortOption] = useState<'priority' | 'date' | 'status'>('date'); 
  
  // Mengembalikan filter default ke 'all'
  const [statusFilter, setStatusFilter] = useState<'all'| 'active' | 'returned' | 'overdue' | 'lost' | 'damaged'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Helper asli untuk prioritas
  const getCheckoutPriority = (checkout: Checkout): string => {
    if (checkout.status === 'overdue') return 'overdue';
    const returnDate = new Date(checkout.expected_return_date);
    if (isPast(returnDate) && checkout.status === 'active') return 'overdue';
    if (isToday(returnDate)) return 'urgent';
    if (isTomorrow(returnDate)) return 'high';
    if (isThisWeek(returnDate, { weekStartsOn: 1 })) return 'medium';
    return 'low';
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'overdue': return AlertTriangle;
      case 'urgent': return Clock;
      case 'high': return Timer;
      case 'medium': return Calendar;
      default: return FileText;
    }
  };

  const getPriorityColor = (priority: string, hasReport: boolean = false) => {
    if (hasReport) return 'border-yellow-400 bg-yellow-50';
    switch (priority) {
      case 'overdue': return 'border-red-300 bg-red-50';
      case 'urgent': return 'border-orange-300 bg-orange-50';
      case 'high': return 'border-yellow-300 bg-yellow-50';
      case 'medium': return 'border-blue-300 bg-blue-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };
  
  const getPriorityIconBgColor = (priority: string, hasReport: boolean = false) => {
    if (hasReport) return 'bg-yellow-500';
    switch (priority) {
      case 'overdue': return 'bg-red-500';
      case 'urgent': return 'bg-orange-500';
      case 'high': return 'bg-yellow-500';
      case 'medium': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => { /* ... */ };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  };

  useEffect(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (dateFilter) count++;
    setActiveFiltersCount(count);
  }, [statusFilter, dateFilter]);

  const fetchPendingCheckouts = async () => {
    try {
      setLoading(true);
      let query = supabase.from('checkouts')
        .select(`*, equipment_back, user:users!checkouts_user_id_fkey(*), booking:bookings(*, user:users!bookings_user_id_fkey(*), room:rooms(*, department:departments(*)))`)
        .eq('type', activeTab);
      
      if (dateFilter) {
        const d = new Date(dateFilter);
        query = query.gte('checkout_date', startOfDay(d).toISOString()).lte('checkout_date', endOfDay(d).toISOString());
      }
      
      // Hapus filter tanggal default untuk menampilkan semua
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data: checkoutData, error: checkoutError } = await query.order('created_at', { ascending: false });
      if (checkoutError) throw checkoutError;
      
      let filteredData = (checkoutData as Checkout[]) || [];
      if (profile?.role === 'department_admin' && profile.department_id) {
        filteredData = filteredData.filter(c => c.booking?.room?.department?.id === profile.department_id);
      }

      const checkoutsWithReports = await Promise.all(
        filteredData.map(async c => {
            const { data: reports, error: e } = await supabase.from('checkout_violations').select('*').eq('checkout_id', c.id).order('created_at', { ascending: false }).limit(1);
            if (e) return c;
            return reports && reports.length > 0 ? { ...c, has_report: true, report: { ...reports[0] } } : { ...c, has_report: false };
        })
      );
      setCheckouts(checkoutsWithReports as Checkout[]);
    } catch (err: any) {
      console.error('Error fetching pending checkouts:', err);
      toast.error(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { fetchPendingCheckouts(); }, [profile, activeTab, statusFilter, dateFilter]);
  useEffect(() => { const i = setInterval(() => { if (document.visibilityState === 'visible') fetchPendingCheckouts(); }, 30000); return () => clearInterval(i); }, [profile, activeTab, statusFilter, dateFilter]);

  // Mengembalikan logika handleApproval ke versi ASLI
  const handleApproval = async (checkoutId: string) => {
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const checkout = checkouts.find(c => c.id === checkoutId);
      if (!checkout || !checkout.booking || !checkout.booking.room_id) {
        throw new Error('Checkout, booking, or room information not found');
      }
      
      const { error: checkoutError } = await supabase
        .from('checkouts')
        .update({ approved_by: profile?.id, status: 'active', updated_at: new Date().toISOString() })
        .eq('id', checkoutId);
      if (checkoutError) throw checkoutError;
      
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ is_available: true, updated_at: new Date().toISOString() })
        .eq('id', checkout.booking.room_id);
      if (roomError) console.error('Error updating room availability:', roomError);
      
      toast.success('Checkout approved successfully and room marked as available!');
      fetchPendingCheckouts();
      if (selectedCheckoutId === checkoutId) setShowDetailModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve checkout');
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(checkoutId); return s; });
    }
  };

  // Mengembalikan logika handleReject ke versi ASLI
  const handleReject = async (checkoutId: string) => {
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const checkout = checkouts.find(c => c.id === checkoutId);
      const bookingId = checkout?.booking_id;
      if (!bookingId) throw new Error('Booking ID not found for this checkout');

      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (bookingError) throw bookingError;
      
      const { error: checkoutError } = await supabase
        .from('checkouts')
        .delete()
        .eq('id', checkoutId);
      if (checkoutError) throw checkoutError;
      
      toast.success('Checkout rejected and booking status restored to approved');
      fetchPendingCheckouts();
      if (selectedCheckoutId === checkoutId) setShowDetailModal(false);
      setShowDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject checkout');
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(checkoutId); return s; });
    }
  };
  
  const handleAddReport = async () => { /* ... (fungsi ini tidak berubah dari versi asli) ... */ };

  const filteredCheckouts = checkouts.filter(c => {
    const s = searchTerm.toLowerCase();
    return !s || c.user?.full_name?.toLowerCase().includes(s) || c.booking?.purpose?.toLowerCase().includes(s) || c.booking?.room?.name?.toLowerCase().includes(s);
  }).sort((a, b) => { /* ... (fungsi sort tidak berubah dari versi asli) ... */ });

  if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
    return (<div className="flex items-center justify-center h-64"><div className="text-center"><Bell className="h-12 w-12 text-red-500 mx-auto mb-4" /><h3 className="text-lg font-medium">Access Denied</h3></div></div>);
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
            <div><h1 className="text-3xl font-bold flex items-center space-x-3"><Bell className="h-8 w-8" /><span>Validation Queue</span></h1><p className="mt-2 opacity-90">Review and approve pending checkouts</p></div>
            <div className="hidden md:block text-right"><div className="text-2xl font-bold">{checkouts.length}</div><div className="text-sm opacity-80">Pending Approvals</div></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('room')} className={`flex-1 py-4 px-6 text-center font-medium text-sm ${activeTab === 'room' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'}`}>Room Checkouts ({activeTab === 'room' ? checkouts.length : 0})</button>
            <button onClick={() => setActiveTab('equipment')} className={`flex-1 py-4 px-6 text-center font-medium text-sm ${activeTab === 'equipment' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'}`}>Equipment Checkouts ({activeTab === 'equipment' ? checkouts.length : 0})</button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-auto md:flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="text" placeholder="Search by name, purpose, or room..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-lg">
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                    {activeFiltersCount > 0 && (<span className="inline-flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold text-white bg-orange-500 rounded-full">{activeFiltersCount}</span>)}
                </button>
                <select value={sortOption} onChange={(e) => setSortOption(e.target.value as any)} className="px-3 py-2 border rounded-lg">
                    <option value="date">Sort: Date (Recent)</option>
                    <option value="priority">Sort: Priority</option>
                    <option value="status">Sort: Status</option>
                </select>
            </div>
        </div>
        {showFilters && (
        <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg">
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="overdue">Overdue</option>
                    <option value="returned">Returned</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Date</label>
                <div className="relative">
                    <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg"/>
                    {dateFilter && (<button onClick={() => setDateFilter('')} className="absolute right-2 top-1/2 transform -translate-y-1/2"><X className="h-4 w-4" /></button>)}
                </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
                <button onClick={() => { setStatusFilter('all'); setDateFilter(''); }} className="text-sm text-orange-600">Clear Filters</button>
            </div>
        </div>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (<div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-orange-600" /><span>Loading...</span></div>
        ) : filteredCheckouts.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-xl font-semibold mt-4">All Caught Up!</h3>
            <p className="text-gray-600">No items match the current filters.</p>
          </div>
        ) : (
          filteredCheckouts.map((checkout) => {
            const priority = getCheckoutPriority(checkout);
            const PriorityIcon = checkout.has_report ? Flag : getPriorityIcon(priority);
            const isProcessing = processingIds.has(checkout.id);
            return (
            <div key={checkout.id} className={`bg-white rounded-xl p-6 ${getPriorityColor(priority, checkout.has_report)}`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-4">
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${getPriorityIconBgColor(priority, checkout.has_report)}`}><PriorityIcon className="h-6 w-6 text-white" /></div>
                            <div>
                                <h3 className="text-lg font-semibold">{checkout.booking?.purpose || 'Checkout'}</h3>
                                <div className="flex items-center space-x-2">
                                    <p className="text-sm text-gray-600 capitalize">{priority} Priority • Status: {checkout.status}</p>
                                    {checkout.has_report && (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800"><Flag className="h-3 w-3 mr-1" />REPORTED</span>)}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                            <div className="flex items-center space-x-3"><User className="h-4 w-4" /><div><p>{checkout.user?.full_name}</p><p className="text-xs">ID: {checkout.user?.identity_number}</p></div></div>
                            <div className="flex items-center space-x-3"><Building className="h-4 w-4" /><div><p>{checkout.booking?.room?.name}</p><p className="text-xs">{checkout.booking?.room?.department?.name}</p></div></div>
                            <div className="flex items-center space-x-3"><Calendar className="h-4 w-4" /><div><p>{format(new Date(checkout.checkout_date), 'MMM d, yyyy')}</p><p className="text-xs">Return by: {format(new Date(checkout.expected_return_date), 'MMM d, yyyy')}</p></div></div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                        <button onClick={() => { setSelectedCheckoutId(checkout.id); setShowDetailModal(true); }} className="p-2 rounded-md"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => { setSelectedCheckoutId(checkout.id); setShowReportModal(true); }} className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 rounded-lg"><Flag className="h-4 w-4" /><span>{checkout.has_report ? 'Update' : 'Report'}</span></button>
                        <button onClick={() => handleApproval(checkout.id)} disabled={isProcessing} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg"><Check className="h-4 w-4" /><span>Approve</span></button>
                        <button onClick={() => setShowDeleteConfirm(checkout.id)} disabled={isProcessing} className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg"><X className="h-4 w-4" /><span>Reject</span></button>
                    </div>
                </div>
            </div>
            );
          })
        )}
      </div>

      {showDetailModal && selectedCheckoutId && (() => {
        const selectedCheckout = checkouts.find(c => c.id === selectedCheckoutId);
        if (!selectedCheckout) return null;
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b">
                <h2 className="text-xl font-bold">Checkout Details</h2>
                <button onClick={() => setShowDetailModal(false)}><X className="h-5 w-5"/></button>
            </div>
            <div className="space-y-6 pt-5">
                <div><h4 className="text-base font-semibold text-gray-500 mb-2">User Information</h4><div className="border rounded-xl p-4 flex items-center space-x-4"><div><User className="h-6 w-6" /></div><div><p className="font-bold">{selectedCheckout.user?.full_name}</p><p className="text-sm">ID: {selectedCheckout.user?.identity_number}</p></div></div></div>
                <div><h4 className="text-base font-semibold text-gray-500 mb-2">Room Information</h4><div className="border rounded-xl p-4"><div className="flex items-center space-x-4"><div><Building className="h-6 w-6" /></div><div><p className="font-bold">{selectedCheckout.booking?.room?.name}</p><p className="text-sm">{selectedCheckout.booking?.room?.department?.name}</p></div></div></div></div>
                <div><h4 className="text-base font-semibold text-gray-500 mb-2">Booking & Schedule</h4><div className="border rounded-xl p-4 grid grid-cols-2 gap-4">
                    <div><p className="text-xs">Purpose</p><p className="font-semibold">{selectedCheckout.booking?.purpose}</p></div>
                    <div><p className="text-xs">Checkout Date</p><p className="font-semibold">{format(new Date(selectedCheckout.checkout_date), 'E, d MMM yyyy')}</p></div>
                    <div><p className="text-xs">Total Items</p><p className="font-semibold">{selectedCheckout.total_items}</p></div>
                    <div><p className="text-xs">Return by</p><p className="font-semibold">{format(new Date(selectedCheckout.expected_return_date), 'E, d MMM yyyy')}</p></div>
                </div></div>
                {selectedCheckout.has_report && selectedCheckout.report && (<div><h4 className="text-base font-semibold text-gray-500 mb-2">Report Info</h4><div className="bg-yellow-50 p-4">{/* Report Info */}</div></div>)}
                {selectedCheckout.checkout_notes && (<div><h4 className="text-base font-semibold text-gray-500 mb-2">Notes</h4><p>{selectedCheckout.checkout_notes}</p></div>)}
            </div>
            <div className="mt-8 flex justify-end space-x-3 pt-4 border-t">
                <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )})}
      
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold">Confirm Rejection</h3>
            <p className="text-sm mt-2">Are you sure you want to reject this checkout request?</p>
            <p className="text-sm mt-2 font-medium">The booking will be restored to "approved" status.</p>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => handleReject(showDeleteConfirm)} disabled={processingIds.has(showDeleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-lg">{processingIds.has(showDeleteConfirm) ? 'Processing...' : 'Confirm Reject'}</button>
            </div>
          </div>
        </div>
      )}
      
      {showReportModal && selectedCheckoutId && (() => {
        const selectedCheckout = checkouts.find(c => c.id === selectedCheckoutId);
        if(!selectedCheckout) return null;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                <div className="flex justify-between items-center pb-4 border-b">
                  <h3 className="text-lg font-bold">{selectedCheckout.has_report ? 'Update Report' : 'Add Report'}</h3>
                  <button onClick={() => setShowReportModal(false)}><X className="h-5 w-5"/></button>
                </div>
                <div className="space-y-4 mt-4">
                  <div><label className="block text-sm">Title *</label><input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className="w-full border rounded-lg p-2" /></div>
                  <div><label className="block text-sm">Severity</label><select value={reportSeverity} onChange={(e) => setReportSeverity(e.target.value as any)} className="w-full border rounded-lg p-2"><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select></div>
                  <div><label className="block text-sm">Description *</label><textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} rows={4} className="w-full border rounded-lg p-2"/></div>
                </div>
                <div className="mt-6 flex justify-end space-x-3 pt-4 border-t">
                  <button onClick={() => setShowReportModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
                  <button onClick={handleAddReport} disabled={!reportTitle || !reportDescription || processingIds.has(selectedCheckout.id)} className="px-4 py-2 bg-yellow-600 text-white rounded-lg"><Flag className="h-4 w-4" /><span>{processingIds.has(selectedCheckout.id) ? 'Saving...' : 'Save Report'}</span></button>
                </div>
              </div>
            </div>
        )
      })()}
    </div>
  );
};

export default ValidationQueue;