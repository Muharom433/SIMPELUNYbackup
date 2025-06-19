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
  status: 'active' | 'returned' | 'overdue' | 'lost' | 'damaged' | 'pending';
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
  const [selectedCheckoutId, setSelectedCheckoutId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSeverity, setReportSeverity] = useState<'minor' | 'major' | 'critical'>('minor');
  const [sortOption, setSortOption] = useState<'priority' | 'date' | 'status'>('date'); 
  const [statusFilter, setStatusFilter] = useState<'all'| 'active' | 'returned' | 'overdue' | 'lost' | 'damaged' | 'pending'>('returned');
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-blue-100 text-blue-800';
      case 'major': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
            if (e) { console.error(e); return c; }
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
    // ... (fungsi tidak berubah) ...
  };

  const handleReject = async (checkoutId: string) => {
    // ... (fungsi tidak berubah) ...
  };
  
  const handleAddReport = async () => {
    // ... (fungsi tidak berubah) ...
  };

  const filteredCheckouts = checkouts.filter(c => {
    const s = searchTerm.toLowerCase();
    return !s || c.user?.full_name?.toLowerCase().includes(s) || c.booking?.purpose?.toLowerCase().includes(s) || c.booking?.room?.name?.toLowerCase().includes(s);
  }).sort((a, b) => {
    if (a.has_report && !b.has_report) return -1;
    if (!a.has_report && b.has_report) return 1;
    const pOrder = { overdue: 0, urgent: 1, high: 2, medium: 3, low: 4 };
    if (sortOption === 'priority') return pOrder[getCheckoutPriority(a)] - pOrder[getCheckoutPriority(b)];
    if (sortOption === 'date') {
        const dateA = a.created_at ? parseISO(a.created_at) : 0;
        const dateB = b.created_at ? parseISO(b.created_at) : 0;
        if (!dateA || !dateB) return 0;
        return compareAsc(dateB, dateA);
    } 
    if (sortOption === 'status') {
      const sOrder = { overdue: 0, active: 1, returned: 2, pending: 3 };
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
        {/* ... Header ... */}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* ... Tabs ... */}
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* ... Filter Bar ... */}
      </div>

      <div className="space-y-4">
        {loading ? (
            <div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-orange-600 mr-2" /><span>Loading...</span></div>
        ) : filteredCheckouts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"><CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" /><h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3><p className="text-gray-600">No items match the current filters.</p></div>
        ) : (
          filteredCheckouts.map((checkout) => {
            const priority = getCheckoutPriority(checkout);
            const PriorityIcon = getPriorityIcon(priority);
            const isProcessing = processingIds.has(checkout.id);
            
            return (
            <div key={checkout.id} className={`bg-white rounded-xl shadow-sm border p-4 md:p-6 hover:shadow-lg transition-all duration-200 ${getPriorityColor(priority, checkout.has_report)}`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-4">
                            <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${getPriorityIconBgColor(priority, checkout.has_report)}`}>
                                <PriorityIcon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{checkout.booking?.purpose || 'Checkout'}</h3>
                                <div className="flex items-center space-x-2">
                                    <p className="text-sm text-gray-600 capitalize">{priority} Priority • Status: {checkout.status}</p>
                                    {checkout.has_report && (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Flag className="h-3 w-3 mr-1" />REPORTED</span>)}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                            <div className="flex items-center space-x-3"><User className="h-4 w-4 text-gray-400 flex-shrink-0" /><div><p className="font-medium text-gray-800">{checkout.user?.full_name}</p><p className="text-xs text-gray-500">ID: {checkout.user?.identity_number}</p></div></div>
                            <div className="flex items-center space-x-3"><Building className="h-4 w-4 text-gray-400 flex-shrink-0" /><div><p className="font-medium text-gray-800">{checkout.booking?.room?.name}</p><p className="text-xs text-gray-500">{checkout.booking?.room?.department?.name}</p></div></div>
                            <div className="flex items-center space-x-3"><Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" /><div><p className="font-medium text-gray-800">{format(new Date(checkout.checkout_date), 'MMM d, yy')}</p><p className="text-xs text-gray-500">Return by: {format(new Date(checkout.expected_return_date), 'MMM d, yy')}</p></div></div>
                        </div>
                        {/* Perbaikan 1: Tampilkan catatan laporan di kartu */}
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
                    {/* Perbaikan 2 & 3: Tampilkan tombol aksi sesuai kondisi */}
                    <div className="flex items-center space-x-1 ml-4">
                        <button onClick={() => { if(checkout.id) { setSelectedCheckoutId(checkout.id); setShowDetailModal(true); }}} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"><Eye className="h-4 w-4" /></button>
                        {!checkout.has_report && (
                             <button onClick={() => { if(checkout.id) { setSelectedCheckoutId(checkout.id); setShowReportModal(true); }}} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"><Flag className="h-4 w-4" /></button>
                        )}
                        {checkout.status === 'returned' && (
                        <>
                            <button onClick={() => handleApproval(checkout.id)} disabled={isProcessing} className="p-2 text-green-600 hover:bg-green-100 rounded-md disabled:opacity-50"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setShowDeleteConfirm(checkout.id)} disabled={isProcessing} className="p-2 text-red-600 hover:bg-red-100 rounded-md disabled:opacity-50"><X className="h-4 w-4" /></button>
                        </>
                        )}
                    </div>
                </div>
            </div>
            );
          })
        )}
      </div>
      
      {(() => {
        if (showDetailModal && selectedCheckoutId) {
          const selectedCheckout = checkouts.find(c => c.id === selectedCheckoutId);
          if (!selectedCheckout) return null;
          
          const isProcessing = processingIds.has(selectedCheckout.id);

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* ... Konten Modal Detail ... */}
                <div className="mt-8 flex justify-end items-center gap-x-3 border-t pt-4">
                    {/* ... Tombol Aksi di Modal ... */}
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}
      
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            {/* ... Konten Modal Konfirmasi ... */}
        </div>
      )}
      
      {showReportModal && selectedCheckoutId && (() => {
        const selectedCheckout = checkouts.find(c => c.id === selectedCheckoutId);
        if(!selectedCheckout) return null;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                {/* ... Konten Modal Laporan ... */}
            </div>
        )
      })()}
    </div>
  );
};

export default ValidationQueue;