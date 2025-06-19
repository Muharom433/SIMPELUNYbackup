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
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, compareAsc, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';

// Tipe data untuk Equipment
interface Equipment {
  id: string;
  name: string;
  is_mandatory: boolean;
  room_id: string;
}

// Tipe data untuk join yang kompleks
interface BookingWithDetails extends Booking {
  user?: UserType;
  room?: Room & { department?: Department };
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

// Tipe data untuk state equipment
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
  
  // Filter status default adalah 'returned'
  const [statusFilter, setStatusFilter] = useState<'all'| 'active' | 'returned' | 'overdue' | 'lost' | 'damaged'>('returned');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // useEffect untuk mengatur filter default berdasarkan tab
  useEffect(() => {
    if (activeTab === 'room') {
      setStatusFilter('returned');
    } else {
      setStatusFilter('all');
    }
  }, [activeTab]);

  // Helper function untuk memeriksa kelengkapan pengembalian
  const isReturnIncomplete = (checkout: Checkout): boolean => {
    if (checkout.type !== 'room' || !checkout.booking?.room_id) {
      return false;
    }
    
    const equipmentList = roomEquipment.get(checkout.booking.room_id) || [];
    const mandatoryEquipment = equipmentList.filter(eq => eq.is_mandatory);
    
    if (mandatoryEquipment.length === 0) {
      return false;
    }

    const returnedEquipmentIds = new Set(checkout.equipment_back || []);
    
    const allMandatoryReturned = mandatoryEquipment.every(eq => returnedEquipmentIds.has(eq.id));
    
    return !allMandatoryReturned;
  };

  // -- Kumpulan Fungsi Helper --
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

  // Update active filters count
  useEffect(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (dateFilter) count++;
    setActiveFiltersCount(count);
  }, [statusFilter, dateFilter]);

  // -- Fungsi Fetch Data --
  const fetchPendingCheckouts = async () => {
    try {
      setLoading(true);
      
      // Base query
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
        .eq('type', activeTab)
      
      // Apply date filter if set
      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        const startDate = startOfDay(filterDate).toISOString();
        const endDate = endOfDay(filterDate).toISOString();
        
        query = query.gte('checkout_date', startDate)
                     .lte('checkout_date', endDate);
      }
      
      // Apply status filter if not 'all'
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      // Execute query
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      let filteredData = data || [];
      if (profile?.role === 'department_admin' && profile.department_id) {
        filteredData = filteredData.filter(checkout => 
          checkout.booking?.room?.department_id === profile.department_id
        );
      }

      // Ambil data equipment untuk semua ruangan yang relevan
      if (activeTab === 'room' && filteredData.length > 0) {
        const roomIds = [...new Set(filteredData.map(c => c.booking?.room_id).filter(Boolean))];
        if (roomIds.length > 0) {
          const { data: equipmentData, error: equipmentError } = await supabase
            .from('equipment')
            .select('*')
            .in('room_id', roomIds as string[]);

          if (equipmentError) throw equipmentError;

          const equipmentMap: RoomEquipmentMap = new Map();
          equipmentData.forEach(eq => {
            const list = equipmentMap.get(eq.room_id) || [];
            list.push(eq);
            equipmentMap.set(eq.room_id, list);
          });
          setRoomEquipment(equipmentMap);
        }
      }

      // Fetch reports for each checkout
      const checkoutsWithReports = await Promise.all(
        filteredData.map(async (checkout) => {
          const { data: reports, error: reportsError } = await supabase
            .from('checkout_violations')
            .select('*')
            .eq('checkout_id', checkout.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (reportsError) {
            console.error('Error fetching reports:', reportsError);
            return checkout;
          }
          
          if (reports && reports.length > 0) {
            return {
              ...checkout,
              has_report: true,
              report: {
                id: reports[0].id,
                title: reports[0].title,
                description: reports[0].description,
                severity: reports[0].severity,
                created_at: reports[0].created_at
              }
            };
          }
          
          return {
            ...checkout,
            has_report: false
          };
        })
      );
      
      setCheckouts(checkoutsWithReports);
    } catch (err: any) {
      console.error('Error fetching pending checkouts:', err);
      toast.error(`Failed to load ${activeTab} checkouts.`);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch data when filters change
  useEffect(() => {
    setLoading(true);
    fetchPendingCheckouts();
  }, [profile, activeTab, statusFilter, dateFilter]);

  // Set up auto-refresh interval
  useEffect(() => {
    const interval = setInterval(fetchPendingCheckouts, 30000);
    return () => clearInterval(interval);
  }, [profile, activeTab, statusFilter, dateFilter]);

  // -- Fungsi Handler untuk Tombol --
  const handleApproval = async (checkoutId: string) => {
    // Fungsi ini sekarang berarti "Menyelesaikan Pengembalian"
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const checkout = checkouts.find(c => c.id === checkoutId);
      if (!checkout || !checkout.booking || !checkout.booking.room_id) {
        throw new Error('Checkout, booking, or room information not found');
      }
      
      // Update room availability to true (make it available again)
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ 
          is_available: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', checkout.booking.room_id);
      
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
    // Fungsi ini sekarang berarti "Menolak Pengembalian"
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      // Update status checkout dari 'returned' kembali ke 'active'
      const { error } = await supabase
        .from('checkouts')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
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

  // -- Logika Render --
  const filteredCheckouts = checkouts
    .filter(checkout => {
      // Text search filter
      const s = searchTerm.toLowerCase();
      const textMatch = !s || 
        checkout.user?.full_name?.toLowerCase().includes(s) ||
        checkout.booking?.purpose?.toLowerCase().includes(s) ||
        checkout.booking?.room?.name?.toLowerCase().includes(s);
      
      return textMatch;
    })
    .sort((a, b) => {
      // First sort by has_report (reported items first)
      if (a.has_report && !b.has_report) return -1;
      if (!a.has_report && b.has_report) return 1;
      
      if (sortOption === 'priority') {
        // Sort by priority
        const priorityOrder = { incomplete_return: -1, overdue: 0, urgent: 1, high: 2, medium: 3, low: 4 };
        return priorityOrder[getCheckoutPriority(a)] - priorityOrder[getCheckoutPriority(b)];
      } else if (sortOption === 'date') {
        // Sort by date (most recent first)
        return compareAsc(parseISO(b.checkout_date), parseISO(a.checkout_date));
      } else if (sortOption === 'status') {
        // Sort by status (overdue first, then active)
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
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
            <div><h1 className="text-3xl font-bold flex items-center space-x-3"><Bell className="h-8 w-8" /><span>Validation Queue</span></h1><p className="mt-2 opacity-90">Review and approve pending checkouts</p></div>
            <div className="hidden md:block text-right"><div className="text-2xl font-bold">{checkouts.length}</div><div className="text-sm opacity-80">Pending Items</div></div>
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
            <input 
              type="text" 
              placeholder="Search by name, purpose, or room..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" 
            />
          </div>
          
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold text-white bg-orange-500 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as 'priority' | 'date' | 'status')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="date">Sort: Date (Recent)</option>
              <option value="priority">Sort: Priority</option>
              <option value="status">Sort: Status</option>
            </select>
          </div>
        </div>
        
        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'returned' | 'overdue')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="returned">Returned</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                {dateFilter && (
                  <button 
                    onClick={() => setDateFilter('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="md:col-span-2 flex justify-end">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setDateFilter('');
                }}
                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-6 w-6 animate-spin text-orange-600 mr-2" />
            <span>Loading checkouts...</span>
          </div>
        ) : filteredCheckouts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-600">No pending {activeTab} checkouts require your attention.</p>
            {activeFiltersCount > 0 && (
              <p className="text-sm text-gray-500 mt-2">Try adjusting your filters to see more results.</p>
            )}
          </div>
        ) : (
          filteredCheckouts.map((checkout) => {
            const priority = getCheckoutPriority(checkout);
            const PriorityIcon = checkout.has_report ? Flag : getPriorityIcon(priority);
            const isProcessing = processingIds.has(checkout.id);
            const isExpanded = expandedItems.has(checkout.id);
            const equipmentList = roomEquipment.get(checkout.booking?.room_id || '') || [];
            const returnedIds = new Set(checkout.equipment_back || []);
            
            return (
              <div 
                key={checkout.id} 
                className={`bg-white rounded-xl shadow-sm border-2 p-4 md:p-6 hover:shadow-lg transition-all duration-200 ${getPriorityColor(priority, checkout.has_report)}`}
              >
                {/* Mobile View (Collapsed) */}
                <div className="flex items-start justify-between md:hidden">
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${getPriorityIconBgColor(priority, checkout.has_report)}`}>
                      <PriorityIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{checkout.booking?.purpose || 'Checkout'}</h3>
                      <p className="text-xs text-gray-600 capitalize">
                        {checkout.has_report ? 'Reported' : `${priority} Priority`}
                      </p>
                      <p className="text-xs text-gray-600">{checkout.user?.full_name || 'Unknown User'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleExpanded(checkout.id)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"
                  >
                    {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                </div>

                {/* Mobile View (Expanded) */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 md:hidden">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{checkout.user?.full_name || 'Unknown User'}</p>
                          <p className="text-xs text-gray-500">ID: {checkout.user?.identity_number || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{checkout.booking?.room?.name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{checkout.booking?.room?.department?.name || 'No Department'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{format(new Date(checkout.checkout_date), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-gray-500">Return by: {format(new Date(checkout.expected_return_date), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      
                      {/* Report information (if exists) */}
                      {checkout.has_report && checkout.report && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                          <div className="flex items-start space-x-2">
                            <Flag className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-yellow-800">{checkout.report.title}</p>
                              <p className="text-xs text-yellow-700 mt-1 line-clamp-2">{checkout.report.description}</p>
                              <div className="mt-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(checkout.report.severity)}`}>
                                  {checkout.report.severity.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col space-y-2 mt-4">
                      <button 
                        onClick={() => { setSelectedCheckout(checkout); setShowDetailModal(true); }} 
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Details</span>
                      </button>
                      <button 
                        onClick={() => { 
                          setSelectedCheckout(checkout); 
                          if (checkout.has_report && checkout.report) {
                            setReportTitle(checkout.report.title);
                            setReportDescription(checkout.report.description);
                            setReportSeverity(checkout.report.severity);
                          }
                          setShowReportModal(true); 
                        }}
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200"
                      >
                        <Flag className="h-4 w-4" />
                        <span>{checkout.has_report ? 'Update Report' : 'Add Report'}</span>
                      </button>
                      {checkout.status === 'returned' && (
                        <>
                          <button 
                            onClick={() => handleApproval(checkout.id)} 
                            disabled={isProcessing} 
                            className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            <span>Approve</span>
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(checkout.id)} 
                            disabled={isProcessing} 
                            className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Desktop View */}
                <div className="hidden md:flex md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${getPriorityIconBgColor(priority, checkout.has_report)}`}>
                        <PriorityIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{checkout.booking?.purpose || 'Checkout'}</h3>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-gray-600 capitalize">
                            {checkout.has_report ? 'Reported' : `${priority.replace('_', ' ')} Priority`} • Status: {checkout.status}
                          </p>
                          {checkout.has_report && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Flag className="h-3 w-3 mr-1" />
                              REPORTED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                      <div className="flex items-center space-x-3">
                        <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{checkout.user?.full_name || 'Unknown User'}</p>
                          <p className="text-xs text-gray-500">ID: {checkout.user?.identity_number || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{checkout.booking?.room?.name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{checkout.booking?.room?.department?.name || 'No Department'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{format(new Date(checkout.checkout_date), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-gray-500">Return by: {format(new Date(checkout.expected_return_date), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Checklist Equipment */}
                    {activeTab === 'room' && equipmentList.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Equipment Return Checklist</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                          {equipmentList.map(eq => (
                            <div key={eq.id} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={returnedIds.has(eq.id)}
                                readOnly
                                className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-not-allowed"
                              />
                              <label className={`ml-2 text-sm ${eq.is_mandatory ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                {eq.name}
                                {eq.is_mandatory && <span className="text-red-500 ml-1">*</span>}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Report information (if exists) */}
                    {checkout.has_report && checkout.report && (
                      <div className="mt-4 bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <Flag className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-yellow-800">{checkout.report.title}</p>
                            <p className="text-sm text-yellow-700 mt-1">{checkout.report.description}</p>
                            <div className="mt-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(checkout.report.severity)}`}>
                                {checkout.report.severity.toUpperCase()}
                              </span>
                              <span className="text-xs text-yellow-600 ml-2">
                                Reported on {format(new Date(checkout.report.created_at), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start space-x-2 ml-4">
                    <button 
                      onClick={() => { setSelectedCheckout(checkout); setShowDetailModal(true); }} 
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => { 
                        setSelectedCheckout(checkout); 
                        if (checkout.has_report && checkout.report) {
                          setReportTitle(checkout.report.title);
                          setReportDescription(checkout.report.description);
                          setReportSeverity(checkout.report.severity);
                        } else {
                          setReportTitle('');
                          setReportDescription('');
                          setReportSeverity('minor');
                        }
                        setShowReportModal(true); 
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200"
                    >
                      <Flag className="h-4 w-4" />
                      <span>{checkout.has_report ? 'Update Report' : 'Add Report'}</span>
                    </button>
                     {checkout.status === 'returned' && (
                        <>
                          <button 
                            onClick={() => handleApproval(checkout.id)} 
                            disabled={isProcessing} 
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            <span>Approve</span>
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(checkout.id)} 
                            disabled={isProcessing} 
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Checkout Detail Modal */}
      {showDetailModal && selectedCheckout && (() => {
        const priority = getCheckoutPriority(selectedCheckout);
        const PriorityIcon = selectedCheckout.has_report ? Flag : getPriorityIcon(priority);
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div><h2 className="text-xl font-bold text-gray-900">Checkout Validation</h2><p className="text-sm text-gray-500">Review the details below before taking action.</p></div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"><X className="h-5 w-5"/></button>
              </div>
              <div className="space-y-6 pt-5">
                <div><h4 className="text-base font-semibold text-gray-500 mb-2">User Information</h4><div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center space-x-4"><div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center"><User className="h-6 w-6 text-blue-600" /></div><div><p className="text-lg font-bold text-gray-900">{selectedCheckout.user?.full_name || 'Unknown User'}</p><p className="text-sm text-gray-500">ID: {selectedCheckout.user?.identity_number || 'N/A'}</p></div></div></div>
                <div><h4 className="text-base font-semibold text-gray-500 mb-2">Room Information</h4><div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center space-x-4"><div className="flex-shrink-0 h-12 w-12 bg-green-100 rounded-full flex items-center justify-center"><Building className="h-6 w-6 text-green-600" /></div><div><p className="text-lg font-bold text-gray-900">{selectedCheckout.booking?.room?.name || 'Unknown Room'}</p><p className="text-sm text-gray-500">{selectedCheckout.booking?.room?.department?.name || 'No Department'}</p><p className="text-xs text-gray-500 mt-1">Capacity: {selectedCheckout.booking?.room?.capacity} seats</p></div></div></div>
                <div><h4 className="text-base font-semibold text-gray-500 mb-2">Booking & Schedule</h4><div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4"><div className="flex items-center space-x-3"><FileText className="h-5 w-5 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-500">Purpose</p><p className="font-semibold text-gray-800">{selectedCheckout.booking?.purpose}</p></div></div><div className="flex items-center space-x-3"><Calendar className="h-5 w-5 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-500">Checkout Date</p><p className="font-semibold text-gray-800">{format(new Date(selectedCheckout.checkout_date), 'E, d MMM yyyy')}</p></div></div><div className="flex items-center space-x-3"><Package className="h-5 w-5 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-500">Total Items</p><p className="font-semibold text-gray-800">{selectedCheckout.total_items}</p></div></div><div className="flex items-center space-x-3"><Timer className="h-5 w-5 text-gray-400 flex-shrink-0" /><div><p className="text-xs text-gray-500">Return by</p><p className="font-semibold text-gray-800">{format(new Date(selectedCheckout.expected_return_date), 'E, d MMM yyyy')}</p></div></div></div></div>
                
                {/* Report information (if exists) */}
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
                
                {selectedCheckout.checkout_notes && (
                  <div>
                    <h4 className="text-base font-semibold text-gray-500 mb-2">Notes</h4>
                    <div className="bg-gray-50 border-l-4 border-gray-400 text-gray-800 p-4 rounded-r-lg">
                      <p className="text-sm">{selectedCheckout.checkout_notes}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-8 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 border-t pt-4">
                <button 
                  onClick={() => { 
                    setShowDetailModal(false); 
                    if (selectedCheckout.has_report && selectedCheckout.report) {
                      setReportTitle(selectedCheckout.report.title);
                      setReportDescription(selectedCheckout.report.description);
                      setReportSeverity(selectedCheckout.report.severity);
                    } else {
                      setReportTitle('');
                      setReportDescription('');
                      setReportSeverity('minor');
                    }
                    setShowReportModal(true); 
                  }}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200"
                >
                  <Flag className="h-4 w-4" />
                  <span>{selectedCheckout.has_report ? 'Update Report' : 'Add Report'}</span>
                </button>
                <button 
                  onClick={() => setShowDetailModal(false)} 
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
                {selectedCheckout.status === 'returned' && (
                  <button 
                    onClick={() => handleApproval(selectedCheckout.id)} 
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Check className="h-5 w-5"/>
                    <span>Approve Return</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold">Confirm Rejection</h3>
            <p className="text-sm text-gray-600 mt-2">Are you sure you want to reject this return?</p>
            <p className="text-sm text-gray-700 mt-2 font-medium">The checkout status will be set back to "active".</p>
            <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)} 
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleReject(showDeleteConfirm)} 
                disabled={processingIds.has(showDeleteConfirm)} 
                className="px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                {processingIds.has(showDeleteConfirm) ? 'Processing...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Report Modal */}
      {showReportModal && selectedCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {selectedCheckout.has_report ? 'Update Report' : 'Add Report'}
              </h3>
              <button 
                onClick={() => setShowReportModal(false)} 
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5"/>
              </button>
            </div>
            
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report Title *
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Enter a title for this report"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Severity
                </label>
                <select
                  value={reportSeverity}
                  onChange={(e) => setReportSeverity(e.target.value as 'minor' | 'major' | 'critical')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                >
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the issue in detail..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg mt-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Reports will be visible to administrators and will be attached to this checkout record.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
              <button 
                onClick={() => setShowReportModal(false)} 
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddReport}
                disabled={!reportTitle || !reportDescription || processingIds.has(selectedCheckout.id)}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                <Flag className="h-4 w-4" />
                <span>
                  {processingIds.has(selectedCheckout.id) 
                    ? 'Saving...' 
                    : selectedCheckout.has_report 
                      ? 'Update Report' 
                      : 'Add Report'
                  }
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationQueue;