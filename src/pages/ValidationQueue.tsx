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
  status: 'active' | 'returned' | 'overdue' | 'lost' | 'damaged';
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
  const [selectedCheckout, setSelectedCheckout] = useState<Checkout | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSeverity, setReportSeverity] = useState<'minor' | 'major' | 'critical'>('minor');
  const [sortOption, setSortOption] = useState<'priority' | 'date' | 'status'>('date'); 
  
  // Perbaikan #3: State filter default adalah 'returned' untuk awal render
  const [statusFilter, setStatusFilter] = useState<'all'| 'active' | 'returned' | 'overdue' | 'lost' | 'damaged'>('returned');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Perbaikan #3: useEffect untuk mengatur ulang filter saat tab berubah
  useEffect(() => {
    if (activeTab === 'room') {
      setStatusFilter('returned');
    } else {
      // Untuk tab equipment, tampilkan semua status
      setStatusFilter('all');
    }
  }, [activeTab]);

  const isReturnIncomplete = (checkout: Checkout): boolean => {
    if (checkout.type !== 'room' || !checkout.booking?.room?.id) return false;
    const equipmentList = roomEquipment.get(checkout.booking.room.id) || [];
    const mandatoryEquipment = equipmentList.filter(eq => eq.is_mandatory);
    if (mandatoryEquipment.length === 0) return false;
    const returnedEquipment = new Set(checkout.equipment_back || []);
    return !mandatoryEquipment.every(eq => returnedEquipment.has(eq.name));
  };

  const getCheckoutPriority = (checkout: Checkout): string => {
    if (checkout.status === 'active' && isReturnIncomplete(checkout)) return 'incomplete_return';
    if (checkout.status === 'overdue') return 'overdue';
    const returnDate = new Date(checkout.expected_return_date);
    if (isPast(returnDate) && checkout.status === 'active') return 'overdue';
    if (isToday(returnDate)) return 'urgent';
    if (isTomorrow(returnDate)) return 'high';
    if (isThisWeek(returnDate)) return 'medium';
    return 'low';
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'incomplete_return': return AlertTriangle;
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
      case 'incomplete_return': return 'border-red-500 bg-red-100';
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
      case 'incomplete_return': return 'bg-red-600';
      case 'overdue': return 'bg-red-500';
      case 'urgent': return 'bg-orange-500';
      case 'high': return 'bg-yellow-500';
      case 'medium': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => { /* ... (fungsi tidak berubah) ... */ };
  const getSeverityColor = (severity: string) => { /* ... (fungsi tidak berubah) ... */ };

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
      setRoomEquipment(new Map());
      let query = supabase.from('checkouts')
        .select(`*, equipment_back, user:users!checkouts_user_id_fkey(*), booking:bookings(*, user:users!bookings_user_id_fkey(*), room:rooms(*, department:departments(*)))`)
        .eq('type', activeTab);
      if (dateFilter) {
        const d = new Date(dateFilter);
        query = query.gte('checkout_date', startOfDay(d).toISOString()).lte('checkout_date', endOfDay(d).toISOString());
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const { data: checkoutData, error: checkoutError } = await query.order('created_at', { ascending: false });
      if (checkoutError) throw checkoutError;
      
      let filteredData = (checkoutData as Checkout[]) || [];
      if (profile?.role === 'department_admin' && profile.department_id) {
        filteredData = filteredData.filter(c => c.booking?.room?.department?.id === profile.department_id);
      }

      if (activeTab === 'room' && filteredData.length > 0) {
        const allEquipmentNames = new Set<string>();
        filteredData.forEach(c => c.booking?.room?.equipment?.forEach(name => allEquipmentNames.add(name)));
        if (allEquipmentNames.size > 0) {
          const { data: equipmentDetails, error: equipmentError } = await supabase.from('equipment')
            .select('id, name, is_mandatory').in('name', Array.from(allEquipmentNames));
          if (equipmentError) throw equipmentError;
          const detailsMap = new Map(equipmentDetails.map(eq => [eq.name, eq]));
          const newRoomEquipmentMap = new Map<string, Equipment[]>();
          filteredData.forEach(checkout => {
            if (checkout.booking?.room?.id) {
              const equipmentNames = checkout.booking.room.equipment || [];
              const equipmentObjects = equipmentNames.map(name => detailsMap.get(name)).filter(Boolean) as Equipment[];
              newRoomEquipmentMap.set(checkout.booking.room.id, equipmentObjects);
            }
          });
          setRoomEquipment(newRoomEquipmentMap);
        }
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

  const handleApproval = async (checkoutId: string) => {
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const checkout = checkouts.find(c => c.id === checkoutId);
      if (!checkout || !checkout.booking?.room?.id) throw new Error('Room info not found');
      const { error } = await supabase.from('rooms').update({ is_available: true, updated_at: new Date().toISOString() }).eq('id', checkout.booking.room.id);
      if (error) throw error;
      toast.success('Return process completed, room is now available!');
      fetchPendingCheckouts();
      if (selectedCheckout?.id === checkoutId) setShowDetailModal(false);
    } catch (error: any) { toast.error(error.message || 'Failed to complete return');
    } finally { setProcessingIds(prev => { const s = new Set(prev); s.delete(checkoutId); return s; }); }
  };

  const handleReject = async (checkoutId: string) => {
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const { error } = await supabase.from('checkouts').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', checkoutId);
      if (error) throw error;
      toast.success('Return rejected. Status set back to "active".');
      fetchPendingCheckouts();
      setShowDeleteConfirm(null);
    } catch (error: any) { toast.error(error.message || 'Failed to reject return');
    } finally { setProcessingIds(prev => { const s = new Set(prev); s.delete(checkoutId); return s; }); }
  };
  
  const handleAddReport = async () => {
    if (!selectedCheckout) return;
    if (!reportTitle || !reportDescription) { toast.error('Title and description are required'); return; }
    setProcessingIds(prev => new Set(prev).add(selectedCheckout.id));
    try {
      const { error } = await supabase.from('checkout_violations').insert({
          checkout_id: selectedCheckout.id, user_id: selectedCheckout.user_id, violation_type: 'other',
          severity: reportSeverity, title: reportTitle, description: reportDescription,
          reported_by: profile?.id, status: 'active'
        });
      if (error) throw error;
      toast.success('Report added successfully');
      setShowReportModal(false); setReportTitle(''); setReportDescription(''); setReportSeverity('minor');
      fetchPendingCheckouts();
    } catch (error: any) { toast.error(error.message || 'Failed to add report');
    } finally { if (selectedCheckout) { setProcessingIds(prev => { const s = new Set(prev); s.delete(selectedCheckout.id); return s; }); } }
  };

  const filteredCheckouts = checkouts
    .filter(c => {
      const s = searchTerm.toLowerCase();
      return !s || c.user?.full_name?.toLowerCase().includes(s) || c.booking?.purpose?.toLowerCase().includes(s) || c.booking?.room?.name?.toLowerCase().includes(s);
    })
    .sort((a, b) => {
      if (a.has_report && !b.has_report) return -1;
      if (!a.has_report && b.has_report) return 1;
      const pOrder = { incomplete_return: -1, overdue: 0, urgent: 1, high: 2, medium: 3, low: 4 };
      if (sortOption === 'priority') return pOrder[getCheckoutPriority(a)] - pOrder[getCheckoutPriority(b)];
      if (sortOption === 'date') return compareAsc(parseISO(b.created_at), parseISO(a.created_at));
      if (sortOption === 'status') {
        const sOrder = { overdue: 0, active: 1, returned: 2 };
        const getStatus = (c: Checkout) => c.status === 'overdue' || (isPast(new Date(c.expected_return_date)) && c.status === 'active') ? 'overdue' : c.status;
        return sOrder[getStatus(a)] - sOrder[getStatus(b)];
      }
      return 0;
    });

  if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
    return (<div className="flex items-center justify-center h-64"><div className="text-center"><Bell className="h-12 w-12 text-red-500 mx-auto mb-4" /><h3 className="text-lg font-medium">Access Denied</h3><p className="text-gray-600">You don't have permission to access this page.</p></div></div>);
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
            <div><h1 className="text-3xl font-bold flex items-center space-x-3"><Bell className="h-8 w-8" /><span>Validation Queue</span></h1><p className="mt-2 opacity-90">Review and validate checkouts</p></div>
            <div className="hidden md:block text-right"><div className="text-2xl font-bold">{checkouts.length}</div><div className="text-sm opacity-80">Items in Queue</div></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('room')} className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors duration-200 ${ activeTab === 'room' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Room Checkouts ({activeTab === 'room' ? checkouts.length : 0})</button>
            <button onClick={() => setActiveTab('equipment')} className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors duration-200 ${ activeTab === 'equipment' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Equipment Checkouts ({activeTab === 'equipment' ? checkouts.length : 0})</button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative w-full md:w-auto md:flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="text" placeholder="Search by name, purpose, or room..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                    {activeFiltersCount > 0 && (<span className="inline-flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold text-white bg-orange-500 rounded-full">{activeFiltersCount}</span>)}
                </button>
                <select value={sortOption} onChange={(e) => setSortOption(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                    <option value="date">Sort: Date (Recent)</option>
                    <option value="priority">Sort: Priority</option>
                    <option value="status">Sort: Status</option>
                </select>
            </div>
        </div>
        {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="overdue">Overdue</option>
                    <option value="returned">Returned</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Date</label>
                <div className="relative">
                    <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                    {dateFilter && (<button onClick={() => setDateFilter('')} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>)}
                </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
                <button onClick={() => { setStatusFilter('all'); setDateFilter(''); }} className="text-sm text-orange-600 hover:text-orange-800 font-medium">Clear Filters</button>
            </div>
        </div>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (<div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-orange-600 mr-2" /><span>Loading...</span></div>
        ) : filteredCheckouts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-600">No items in this queue match the current filters.</p>
          </div>
        ) : (
          filteredCheckouts.map((checkout) => {
            const priority = getCheckoutPriority(checkout);
            const PriorityIcon = checkout.has_report ? Flag : getPriorityIcon(priority);
            const isProcessing = processingIds.has(checkout.id);
            const isExpanded = expandedItems.has(checkout.id);
            const equipmentList = checkout.booking?.room?.id ? roomEquipment.get(checkout.booking.room.id) || [] : [];
            const returnedItems = new Set(checkout.equipment_back || []);
            
            return (
            <div key={checkout.id} className={`bg-white rounded-xl shadow-sm border-2 p-4 md:p-6 hover:shadow-lg transition-all duration-200 ${getPriorityColor(priority, checkout.has_report)}`}>
                <div className="hidden md:flex md:items-start md:justify-between">
                    <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-4">
                            <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${getPriorityIconBgColor(priority, checkout.has_report)}`}><PriorityIcon className="h-6 w-6 text-white" /></div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{checkout.booking?.purpose || 'Checkout'}</h3>
                                <div className="flex items-center space-x-2">
                                    <p className="text-sm text-gray-600 capitalize">{checkout.has_report ? 'Reported' : `${priority.replace('_', ' ')} Priority`} • Status: {checkout.status}</p>
                                    {checkout.has_report && (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Flag className="h-3 w-3 mr-1" />REPORTED</span>)}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                            <div className="flex items-center space-x-3"><User className="h-4 w-4 text-gray-400 flex-shrink-0" /><div><p className="font-medium text-gray-800">{checkout.user?.full_name}</p><p className="text-xs text-gray-500">ID: {checkout.user?.identity_number}</p></div></div>
                            <div className="flex items-center space-x-3"><Building className="h-4 w-4 text-gray-400 flex-shrink-0" /><div><p className="font-medium text-gray-800">{checkout.booking?.room?.name}</p><p className="text-xs text-gray-500">{checkout.booking?.room?.department?.name}</p></div></div>
                            <div className="flex items-center space-x-3"><Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" /><div><p className="font-medium text-gray-800">{format(new Date(checkout.checkout_date), 'MMM d, yyyy')}</p><p className="text-xs text-gray-500">Return by: {format(new Date(checkout.expected_return_date), 'MMM d, yyyy')}</p></div></div>
                        </div>
                        {activeTab === 'room' && equipmentList.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Equipment Return Checklist</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                            {equipmentList.map(eq => (
                                <div key={eq.id} className="flex items-center">
                                    <input type="checkbox" checked={returnedItems.has(eq.name)} readOnly className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-not-allowed" />
                                    <label className={`ml-2 text-sm ${eq.is_mandatory ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{eq.name}{eq.is_mandatory && <span className="text-red-500 ml-1">*</span>}</label>
                                </div>
                            ))}
                            </div>
                        </div>
                        )}
                        {/* Perbaikan #2: Mengembalikan Tampilan Catatan Laporan pada Card */}
                        {checkout.has_report && checkout.report && (
                            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3">
                                <div className="flex items-start space-x-3">
                                    <Flag className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-yellow-800">{checkout.report.title}</p>
                                        <p className="text-sm text-yellow-700 mt-1">{checkout.report.description}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                        <button onClick={() => { setSelectedCheckout(checkout); setShowDetailModal(true); }} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => { setSelectedCheckout(checkout); setShowReportModal(true); }} className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200"><Flag className="h-4 w-4" /><span>{checkout.has_report ? 'Update' : 'Report'}</span></button>
                        {(checkout.status === 'returned') && (
                        <>
                            <button onClick={() => handleApproval(checkout.id)} disabled={isProcessing} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"><Check className="h-4 w-4" /><span>Approve</span></button>
                            <button onClick={() => setShowDeleteConfirm(checkout.id)} disabled={isProcessing} className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"><X className="h-4 w-4" /><span>Reject</span></button>
                        </>
                        )}
                    </div>
                </div>
            </div>
            );
          })
        )}
      </div>

      {/* Perbaikan #1: Mengembalikan SEMUA KONTEN MODAL */}
        {showDetailModal && selectedCheckout && (() => {
        const equipmentList = selectedCheckout.booking?.room?.id ? roomEquipment.get(selectedCheckout.booking.room.id) || [] : [];
        const returnedItems = new Set(selectedCheckout.equipment_back || []);
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div><h2 className="text-xl font-bold text-gray-900">Checkout Details</h2></div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"><X className="h-5 w-5"/></button>
            </div>
            <div className="space-y-6 pt-5">
                {/* User Info */}
                <div><h4 className="text-base font-semibold text-gray-500 mb-2">User Information</h4><div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center space-x-4"><div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center"><User className="h-6 w-6 text-blue-600" /></div><div><p className="text-lg font-bold text-gray-900">{selectedCheckout.user?.full_name}</p><p className="text-sm text-gray-500">ID: {selectedCheckout.user?.identity_number}</p></div></div></div>
                
                {/* Room Info & Checklist */}
                <div><h4 className="text-base font-semibold text-gray-500 mb-2">Room Information</h4><div className="bg-white border border-gray-200 rounded-xl p-4 "><div className="flex items-center space-x-4"><div className="flex-shrink-0 h-12 w-12 bg-green-100 rounded-full flex items-center justify-center"><Building className="h-6 w-6 text-green-600" /></div><div><p className="text-lg font-bold text-gray-900">{selectedCheckout.booking?.room?.name}</p><p className="text-sm text-gray-500">{selectedCheckout.booking?.room?.department?.name}</p></div></div>{activeTab === 'room' && equipmentList.length > 0 && (<div className="mt-4 pt-4 border-t"><h4 className="text-sm font-semibold text-gray-700 mb-2">Equipment Checklist</h4><div className="grid grid-cols-2 gap-2">{equipmentList.map(eq => (<div key={eq.id} className="flex items-center"><input type="checkbox" checked={returnedItems.has(eq.name)} readOnly className="h-4 w-4 rounded" /><label className={`ml-2 text-sm ${eq.is_mandatory && 'font-bold'}`}>{eq.name}{eq.is_mandatory &&<span className="text-red-500">*</span>}</label></div>))}</div></div>)}</div></div>
                
                {/* Schedule Info */}
                <div>
                  <h4 className="text-base font-semibold text-gray-500 mb-2">Booking & Schedule</h4>
                  <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3"><FileText className="h-5 w-5 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-500">Purpose</p><p className="font-semibold text-gray-800">{selectedCheckout.booking?.purpose}</p></div></div>
                    <div className="flex items-center space-x-3"><Calendar className="h-5 w-5 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-500">Checkout Date</p><p className="font-semibold text-gray-800">{format(new Date(selectedCheckout.checkout_date), 'E, d MMM yyyy')}</p></div></div>
                    <div className="flex items-center space-x-3"><Package className="h-5 w-5 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-500">Total Items</p><p className="font-semibold text-gray-800">{selectedCheckout.total_items}</p></div></div>
                    <div className="flex items-center space-x-3"><Timer className="h-5 w-5 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-500">Return by</p><p className="font-semibold text-gray-800">{format(new Date(selectedCheckout.expected_return_date), 'E, d MMM yyyy')}</p></div></div>
                  </div>
                </div>

                {/* Report Info */}
                {selectedCheckout.has_report && selectedCheckout.report && (
                  <div>
                    <h4 className="text-base font-semibold text-gray-500 mb-2">Report Information</h4>
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <Flag className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-yellow-800">{selectedCheckout.report.title}</p>
                          <p className="text-sm text-yellow-700 mt-2">{selectedCheckout.report.description}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(selectedCheckout.report.severity)}`}>
                              {selectedCheckout.report.severity.toUpperCase()}
                            </span>
                            <span className="text-xs text-yellow-600">
                              Reported on {format(new Date(selectedCheckout.report.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Notes */}
                {selectedCheckout.checkout_notes && (
                  <div>
                    <h4 className="text-base font-semibold text-gray-500 mb-2">Notes</h4>
                    <div className="bg-gray-50 border-l-4 border-gray-400 text-gray-800 p-4 rounded-r-lg">
                      <p className="text-sm">{selectedCheckout.checkout_notes}</p>
                    </div>
                  </div>
                )}
            </div>
            <div className="mt-8 flex justify-end space-x-3 border-t pt-4">
                <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )})}
      
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold">Confirm Rejection</h3>
            <p className="text-sm text-gray-600 mt-2">Are you sure you want to reject this return?</p>
            <p className="text-sm text-gray-700 mt-2 font-medium">The checkout status will be set back to "active".</p>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => handleReject(showDeleteConfirm)} disabled={processingIds.has(showDeleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-lg">{processingIds.has(showDeleteConfirm) ? 'Processing...' : 'Confirm Reject'}</button>
            </div>
          </div>
        </div>
      )}
      
      {showReportModal && selectedCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{selectedCheckout.has_report ? 'Update Report' : 'Add Report'}</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"><X className="h-5 w-5"/></button>
            </div>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Title *</label>
                <input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder="Enter a title for this report" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select value={reportSeverity} onChange={(e) => setReportSeverity(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} rows={4} placeholder="Describe the issue in detail..." className="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3 pt-4 border-t">
              <button onClick={() => setShowReportModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={handleAddReport} disabled={!reportTitle || !reportDescription || processingIds.has(selectedCheckout.id)} className="flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg disabled:opacity-50">
                <Flag className="h-4 w-4" />
                <span>{processingIds.has(selectedCheckout.id) ? 'Saving...' : (selectedCheckout.has_report ? 'Update Report' : 'Add Report')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationQueue;