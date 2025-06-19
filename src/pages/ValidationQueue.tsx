import React, { useState, useEffect } from 'react';
import {
  Bell, Clock, CheckCircle, XCircle, AlertTriangle, User, Building, Calendar,
  Timer, Eye, Check, X, RefreshCw, Filter, Search, FileText, Zap, Users, Package,
  ChevronRight, ChevronDown, Flag, MessageSquare, AlertCircle, CalendarIcon, HardHat
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Booking, Room, User as UserType, Department } from '../types';
import toast from 'react-hot-toast';
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, compareAsc, startOfDay, endOfDay, subDays } from 'date-fns';

// Tipe data untuk Equipment
interface Equipment {
  id: string; // id tetap kita butuhkan sebagai key unik
  name: string;
  is_mandatory: boolean;
}

// Tipe data untuk Room yang diperbarui sesuai skema
interface RoomWithEquipment extends Room {
  // Kolom ini berisi array NAMA atau KODE equipment
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
  // Kolom ini berisi array NAMA atau KODE equipment yang dikembalikan
  equipment_back: string[] | null;
}

type RoomEquipmentMap = Map<string, Equipment[]>;


const ValidationQueue: React.FC = () => {
  const { profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'room' | 'equipment'>('room');
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [roomEquipment, setRoomEquipment] = useState<RoomEquipmentMap>(new Map());
  const [loading, setLoading] = useState(true);
  // State lainnya tidak berubah
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
  const [statusFilter, setStatusFilter] = useState<'all'| 'active' | 'returned' | 'overdue' | 'lost' | 'damaged'>('returned');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    if (activeTab === 'room') {
      setStatusFilter('returned');
    } else {
      setStatusFilter('all');
    }
  }, [activeTab]);

  const isReturnIncomplete = (checkout: Checkout): boolean => {
    if (checkout.type !== 'room' || !checkout.booking?.room?.id) {
      return false;
    }
    
    const equipmentList = roomEquipment.get(checkout.booking.room.id) || [];
    const mandatoryEquipment = equipmentList.filter(eq => eq.is_mandatory);
    
    if (mandatoryEquipment.length === 0) {
      return false;
    }

    const returnedEquipment = new Set(checkout.equipment_back || []);
    
    // Cek apakah NAMA semua equipment wajib ada di dalam daftar yang dikembalikan
    const allMandatoryReturned = mandatoryEquipment.every(eq => returnedEquipment.has(eq.name));
    
    return !allMandatoryReturned;
  };

  // ... (semua fungsi helper get...Color, get...Icon, dll tidak ada yang berubah) ...
  const getCheckoutPriority = (checkout: Checkout): string => {
    if (checkout.status === 'active' && isReturnIncomplete(checkout)) {
        return 'incomplete_return';
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'returned': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-blue-100 text-blue-800';
      case 'major': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  useEffect(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (dateFilter) count++;
    setActiveFiltersCount(count);
  }, [statusFilter, dateFilter]);

  // --- LOGIKA FETCH DATA YANG SEPENUHNYA DIPERBAIKI ---
  const fetchPendingCheckouts = async () => {
    try {
      setLoading(true);
      setRoomEquipment(new Map());

      // Langkah 1: Ambil data checkout beserta relasi ke room
      let query = supabase
        .from('checkouts')
        .select(`
          *,
          equipment_back,
          user:users!checkouts_user_id_fkey(id, full_name, identity_number, email),
          booking:bookings(
            *,
            user:users!bookings_user_id_fkey(id, full_name, identity_number),
            room:rooms(*, department:departments(*))
          )
        `)
        .eq('type', activeTab);
      
      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        const startDate = startOfDay(filterDate).toISOString();
        const endDate = endOfDay(filterDate).toISOString();
        query = query.gte('checkout_date', startDate).lte('checkout_date', endDate);
      }
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data: checkoutData, error: checkoutError } = await query.order('created_at', { ascending: false });

      if (checkoutError) throw checkoutError;
      
      let filteredData = (checkoutData as Checkout[]) || [];
      if (profile?.role === 'department_admin' && profile.department_id) {
        filteredData = filteredData.filter(checkout => 
          checkout.booking?.room?.department?.id === profile.department_id
        );
      }

      if (activeTab === 'room' && filteredData.length > 0) {
        // Langkah 2: Kumpulkan semua NAMA equipment dari kolom `equipment` di setiap ruangan
        const allEquipmentNames = new Set<string>();
        filteredData.forEach(checkout => {
          checkout.booking?.room?.equipment?.forEach(name => allEquipmentNames.add(name));
        });

        if (allEquipmentNames.size > 0) {
          // Langkah 3: Ambil detail (terutama 'is_mandatory') dari semua equipment berdasarkan NAMA
          const { data: equipmentDetails, error: equipmentError } = await supabase
            .from('equipment')
            .select('id, name, is_mandatory')
            .in('name', Array.from(allEquipmentNames));

          if (equipmentError) throw equipmentError;

          // Buat Peta (Map) dari nama equipment ke detailnya untuk pencarian cepat
          const detailsMap = new Map(equipmentDetails.map(eq => [eq.name, eq]));

          // Langkah 4: Susun data equipment per ruangan untuk checklist
          const newRoomEquipmentMap = new Map<string, Equipment[]>();
          filteredData.forEach(checkout => {
            if (checkout.booking?.room?.id) {
              const equipmentNamesForThisRoom = checkout.booking.room.equipment || [];
              const equipmentObjectsForThisRoom = equipmentNamesForThisRoom
                .map(name => detailsMap.get(name)) // Ambil detail dari map
                .filter(Boolean) as Equipment[]; // Filter jika ada nama yang tidak ditemukan
              newRoomEquipmentMap.set(checkout.booking.room.id, equipmentObjectsForThisRoom);
            }
          });
          setRoomEquipment(newRoomEquipmentMap);
        }
      }

      // Proses laporan tetap sama
      const checkoutsWithReports = await Promise.all(
        filteredData.map(async (checkout) => {
            const { data: reports, error: reportsError } = await supabase
                .from('checkout_violations')
                .select('*')
                .eq('checkout_id', checkout.id)
                .order('created_at', { ascending: false })
                .limit(1);
            if (reportsError) { console.error('Error fetching reports:', reportsError); return checkout; }
            if (reports && reports.length > 0) {
                return { ...checkout, has_report: true, report: { ...reports[0] }};
            }
            return { ...checkout, has_report: false };
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
  
  // Sisa dari kode (useEffect, handlers, dan JSX) tidak perlu diubah.
  // Logika di bawah ini sudah dirancang untuk bekerja dengan state yang kita perbaiki di atas.
  useEffect(() => {
    fetchPendingCheckouts();
  }, [profile, activeTab, statusFilter, dateFilter]);

  useEffect(() => {
    const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
            fetchPendingCheckouts();
        }
    }, 30000);
    return () => clearInterval(interval);
  }, [profile, activeTab, statusFilter, dateFilter]);

  const handleApproval = async (checkoutId: string) => {
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const checkout = checkouts.find(c => c.id === checkoutId);
      if (!checkout || !checkout.booking || !checkout.booking.room?.id) {
        throw new Error('Checkout, booking, or room information not found');
      }
      
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ is_available: true, updated_at: new Date().toISOString() })
        .eq('id', checkout.booking.room.id);
      
      if (roomError) throw roomError;
      
      toast.success('Return process completed and room marked as available!');
      fetchPendingCheckouts();
      if (selectedCheckout?.id === checkoutId) setShowDetailModal(false);
    } catch (error: any) {
      console.error('Error completing return:', error);
      toast.error(error.message || 'Failed to complete return');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkoutId);
        return newSet;
      });
    }
  };

  const handleReject = async (checkoutId: string) => {
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const { error } = await supabase
        .from('checkouts')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', checkoutId);

      if (error) throw error;
      
      toast.success('Return rejected. Checkout status has been set back to "active".');
      fetchPendingCheckouts();
      if (selectedCheckout?.id === checkoutId) setShowDetailModal(false);
      setShowDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error rejecting return:', error);
      toast.error(error.message || 'Failed to reject return');
    } finally {
       setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkoutId);
        return newSet;
      });
    }
  };

  const handleAddReport = async () => {
    if (!selectedCheckout) return;
    
    if (!reportTitle || !reportDescription) {
      toast.error('Please provide both title and description for the report');
      return;
    }
    
    setProcessingIds(prev => new Set(prev).add(selectedCheckout.id));
    
    try {
      const { error } = await supabase
        .from('checkout_violations')
        .insert({
          checkout_id: selectedCheckout.id,
          user_id: selectedCheckout.user_id,
          violation_type: 'other',
          severity: reportSeverity,
          title: reportTitle,
          description: reportDescription,
          reported_by: profile?.id,
          status: 'active'
        });
      
      if (error) throw error;
      
      toast.success('Report added successfully');
      setShowReportModal(false);
      setReportTitle('');
      setReportDescription('');
      setReportSeverity('minor');
      fetchPendingCheckouts();
      
    } catch (error: any) {
      console.error('Error adding report:', error);
      toast.error(error.message || 'Failed to add report');
    } finally {
      if (selectedCheckout) {
        setProcessingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedCheckout.id);
          return newSet;
        });
      }
    }
  };

  const filteredCheckouts = checkouts
    .filter(checkout => {
      const s = searchTerm.toLowerCase();
      const textMatch = !s || 
        checkout.user?.full_name?.toLowerCase().includes(s) ||
        checkout.booking?.purpose?.toLowerCase().includes(s) ||
        checkout.booking?.room?.name?.toLowerCase().includes(s);
      
      return textMatch;
    })
    .sort((a, b) => {
      if (a.has_report && !b.has_report) return -1;
      if (!a.has_report && b.has_report) return 1;
      
      if (sortOption === 'priority') {
        const priorityOrder = { incomplete_return: -1, overdue: 0, urgent: 1, high: 2, medium: 3, low: 4 };
        return priorityOrder[getCheckoutPriority(a)] - priorityOrder[getCheckoutPriority(b)];
      } else if (sortOption === 'date') {
        return compareAsc(parseISO(b.created_at), parseISO(a.created_at));
      } else if (sortOption === 'status') {
        const statusOrder = { overdue: 0, active: 1, returned: 2 };
        const aStatus = a.status === 'overdue' || (isPast(new Date(a.expected_return_date)) && a.status === 'active') 
          ? 'overdue' : a.status;
        const bStatus = b.status === 'overdue' || (isPast(new Date(b.expected_return_date)) && b.status === 'active') 
          ? 'overdue' : b.status;
        
        return statusOrder[aStatus] - statusOrder[bStatus];
      }
      
      return 0;
    });

  if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center"><Bell className="h-12 w-12 text-red-500 mx-auto mb-4" /><h3 className="text-lg font-medium">Access Denied</h3><p className="text-gray-600">You don't have permission to access this page.</p></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
        {/* Bagian JSX di sini tidak perlu diubah sama sekali */}
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
                <div><h1 className="text-3xl font-bold flex items-center space-x-3"><Bell className="h-8 w-8" /><span>Validation Queue</span></h1><p className="mt-2 opacity-90">Review and approve checkout returns</p></div>
                <div className="hidden md:block text-right"><div className="text-2xl font-bold">{checkouts.length}</div><div className="text-sm opacity-80">Items in Queue</div></div>
            </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
                <button onClick={() => setActiveTab('room')} className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors duration-200 ${ activeTab === 'room' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Room Checkouts ({activeTab === 'room' ? checkouts.length : 0})</button>
                <button onClick={() => setActiveTab('equipment')} className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors duration-200 ${ activeTab === 'equipment' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Equipment Checkouts ({activeTab === 'equipment' ? checkouts.length : 0})</button>
            </div>
        </div>
      
        {/* Filter Bar */}
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
                    <select value={sortOption} onChange={(e) => setSortOption(e.target.value as 'priority' | 'date' | 'status')} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
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
                        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
                        {dateFilter && (<button onClick={() => setDateFilter('')} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>)}
                    </div>
                </div>
                <div className="md:col-span-2 flex justify-end">
                    <button onClick={() => { setStatusFilter('all'); setDateFilter(''); }} className="text-sm text-orange-600 hover:text-orange-800 font-medium">Clear Filters</button>
                </div>
            </div>
            )}
        </div>

        {/* List */}
        <div className="space-y-4">
            {loading ? (
                <div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-orange-600 mr-2" /><span>Loading checkouts...</span></div>
            ) : filteredCheckouts.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
                    <p className="text-gray-600">No pending {activeTab} checkouts require your attention.</p>
                    {activeFiltersCount > 0 && (<p className="text-sm text-gray-500 mt-2">Try adjusting your filters to see more results.</p>)}
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
                        {/* Mobile View */}
                        <div className="flex items-start justify-between md:hidden">
                            <div className="flex items-start space-x-3"><div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${getPriorityIconBgColor(priority, checkout.has_report)}`}><PriorityIcon className="h-5 w-5 text-white" /></div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{checkout.booking?.purpose || 'Checkout'}</h3>
                                    <p className="text-xs text-gray-600 capitalize">{checkout.has_report ? 'Reported' : `${priority.replace('_', ' ')} Priority`}</p>
                                    <p className="text-xs text-gray-600">{checkout.user?.full_name || 'Unknown User'}</p>
                                </div>
                            </div>
                            <button onClick={() => toggleExpanded(checkout.id)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md">{isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}</button>
                        </div>
                        {isExpanded && (<div className="mt-4 pt-4 border-t border-gray-200 md:hidden">
                            {/* ... Mobile expanded content ... */}
                        </div>)}

                        {/* Desktop View */}
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
                                    {/* ... User, Room, Date Info ... */}
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
                                {/* ... Report Info ... */}
                            </div>
                            <div className="flex items-start space-x-2 ml-4">
                                {/* ... Action Buttons ... */}
                            </div>
                        </div>
                    </div>
                    );
                })
            )}
        </div>
    </div>
  );
};

export default ValidationQueue;