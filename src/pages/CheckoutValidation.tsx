import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Filter,
  Eye,
  Check,
  X,
  AlertTriangle,
  User,
  Building,
  Calendar,
  Clock,
  RefreshCw,
  Trash2,
  FileText,
  Zap,
  MapPin,
  Users,
  CheckSquare,
  XSquare,
  Flag,
  MessageSquare,
  Edit,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { format, isAfter } from 'date-fns';

interface Checkout {
  id: string;
  user_id: string;
  booking_id: string;
  checkout_date: string;
  expected_return_date: string;
  actual_return_date: string | null;
  status: 'active' | 'returned' | 'overdue' | 'lost' | 'damaged';
  checkout_notes: string | null;
  return_notes: string | null;
  condition_on_checkout: string;
  condition_on_return: string | null;
  approved_by: string | null;
  returned_to: string | null;
  total_items: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    identity_number: string;
    email: string;
    role: string;
  };
  booking?: {
    id: string;
    purpose: string;
    start_time: string;
    end_time: string;
    room_id: string;
    status: string;
    equipment_requested: string[];
    room?: {
      id: string;
      name: string;
      code: string;
      department?: {
        id: string;
        name: string;
      };
    };
  };
  items?: CheckoutItem[];
  has_violation?: boolean;
  violations?: CheckoutViolation[];
}

interface CheckoutItem {
  id: string;
  checkout_id: string;
  equipment_id: string;
  quantity: number;
  condition_notes: string | null;
  serial_numbers: string[] | null;
  equipment?: {
    id: string;
    name: string;
    code: string;
    category: string;
  };
}

interface CheckoutViolation {
  id: string;
  checkout_id: string;
  user_id: string;
  violation_type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

const CheckoutValidation: React.FC = () => {
  const { profile } = useAuth();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCheckout, setSelectedCheckout] = useState<Checkout | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showViolationForm, setShowViolationForm] = useState(false);
  const [violationTitle, setViolationTitle] = useState('');
  const [violationDescription, setViolationDescription] = useState('');
  const [violationType, setViolationType] = useState('late_return');
  const [violationSeverity, setViolationSeverity] = useState('minor');

  useEffect(() => {
    fetchCheckouts();
    
    // Set up real-time subscription for checkouts
    const subscription = supabase
      .channel('checkout-validation')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'checkouts'
        }, 
        () => {
          fetchCheckouts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchCheckouts = async () => {
    try {
      setLoading(true);
      
      // Get all checkouts that need approval (status is not 'returned')
      const { data: checkoutsData, error: checkoutsError } = await supabase
        .from('checkouts')
        .select('*')
        .in('status', ['active', 'overdue'])
        .is('approved_by', null)
        .order('created_at', { ascending: false });

      if (checkoutsError) throw checkoutsError;

      if (!checkoutsData || checkoutsData.length === 0) {
        setCheckouts([]);
        return;
      }

      // Fetch related data for each checkout
      const checkoutsWithDetails = await Promise.all(
        checkoutsData.map(async (checkout) => {
          let user = null;
          let booking = null;
          let items = [];
          let violations = [];
          let hasViolation = false;

          // Fetch user data
          if (checkout.user_id) {
            try {
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, full_name, identity_number, email, role')
                .eq('id', checkout.user_id)
                .maybeSingle();
              
              if (!userError && userData) {
                user = userData;
              }
            } catch (error) {
              console.log('User not found for checkout:', checkout.id);
            }
          }

          // Fetch booking data
          if (checkout.booking_id) {
            try {
              const { data: bookingData, error: bookingError } = await supabase
                .from('bookings')
                .select(`
                  id,
                  purpose,
                  start_time,
                  end_time,
                  room_id,
                  status,
                  equipment_requested,
                  room:rooms(
                    id,
                    name,
                    code,
                    department:departments(
                      id,
                      name
                    )
                  )
                `)
                .eq('id', checkout.booking_id)
                .maybeSingle();
              
              if (!bookingError && bookingData) {
                booking = bookingData;
              }
            } catch (error) {
              console.log('Booking not found for checkout:', checkout.id);
            }
          }

          // Fetch checkout items
          try {
            const { data: itemsData, error: itemsError } = await supabase
              .from('checkout_items')
              .select(`
                *,
                equipment:equipment(
                  id,
                  name,
                  code,
                  category
                )
              `)
              .eq('checkout_id', checkout.id);
            
            if (!itemsError && itemsData) {
              items = itemsData;
            }
          } catch (error) {
            console.log('Error fetching checkout items:', error);
          }

          // Fetch violations
          try {
            const { data: violationsData, error: violationsError } = await supabase
              .from('checkout_violations')
              .select('*')
              .eq('checkout_id', checkout.id);
            
            if (!violationsError && violationsData && violationsData.length > 0) {
              violations = violationsData;
              hasViolation = true;
            }
          } catch (error) {
            console.log('Error fetching violations:', error);
          }

          return {
            ...checkout,
            user,
            booking,
            items,
            has_violation: hasViolation,
            violations
          };
        })
      );

      // Apply department filtering for department admins
      let filteredCheckouts = checkoutsWithDetails;
      if (profile?.role === 'department_admin' && profile.department_id) {
        filteredCheckouts = checkoutsWithDetails.filter(checkout => 
          checkout.booking?.room?.department?.id === profile.department_id
        );
      }

      setCheckouts(filteredCheckouts);
    } catch (error) {
      console.error('Error fetching checkouts:', error);
      toast.error('Failed to load checkouts');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (checkoutId: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(checkoutId));
      
      // Update checkout status to approved
      const { error: checkoutError } = await supabase
        .from('checkouts')
        .update({ 
          approved_by: profile?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', checkoutId);

      if (checkoutError) throw checkoutError;
      
      toast.success('Checkout approved successfully');
      fetchCheckouts();
      
      if (selectedCheckout?.id === checkoutId) {
        setShowDetailModal(false);
      }
    } catch (error: any) {
      console.error('Error approving checkout:', error);
      toast.error(error.message || 'Failed to approve checkout');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkoutId);
        return newSet;
      });
    }
  };

  const handleDelete = async (checkoutId: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(checkoutId));
      
      // Get the booking ID before deleting the checkout
      const checkout = checkouts.find(c => c.id === checkoutId);
      const bookingId = checkout?.booking_id;
      
      if (!bookingId) {
        throw new Error('Booking ID not found for this checkout');
      }
      
      // Delete the checkout
      const { error: checkoutError } = await supabase
        .from('checkouts')
        .delete()
        .eq('id', checkoutId);

      if (checkoutError) throw checkoutError;
      
      // Update the booking status back to 'approved'
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (bookingError) {
        toast.error('Checkout deleted but failed to update booking status');
      } else {
        toast.success('Checkout deleted and booking status restored to approved');
      }
      
      setShowDeleteConfirm(null);
      fetchCheckouts();
      
      if (selectedCheckout?.id === checkoutId) {
        setShowDetailModal(false);
      }
    } catch (error: any) {
      console.error('Error deleting checkout:', error);
      toast.error(error.message || 'Failed to delete checkout');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkoutId);
        return newSet;
      });
    }
  };

  const handleAddViolation = async () => {
    if (!selectedCheckout) return;
    
    try {
      setProcessingIds(prev => new Set(prev).add(selectedCheckout.id));
      
      if (!violationTitle || !violationDescription) {
        toast.error('Please provide both title and description for the violation');
        return;
      }
      
      // Create violation record
      const violationData = {
        checkout_id: selectedCheckout.id,
        user_id: selectedCheckout.user_id,
        violation_type: violationType,
        severity: violationSeverity,
        title: violationTitle,
        description: violationDescription,
        reported_by: profile?.id,
        status: 'active'
      };
      
      const { error } = await supabase
        .from('checkout_violations')
        .insert(violationData);

      if (error) throw error;
      
      toast.success('Violation report added successfully');
      
      // Reset form
      setViolationTitle('');
      setViolationDescription('');
      setViolationType('late_return');
      setViolationSeverity('minor');
      setShowViolationForm(false);
      
      // Refresh data
      fetchCheckouts();
      
    } catch (error: any) {
      console.error('Error adding violation:', error);
      toast.error(error.message || 'Failed to add violation');
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

  const filteredCheckouts = checkouts.filter(checkout => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (checkout.user?.full_name && checkout.user.full_name.toLowerCase().includes(searchLower)) ||
      (checkout.user?.identity_number && checkout.user.identity_number.toLowerCase().includes(searchLower)) ||
      (checkout.booking?.purpose && checkout.booking.purpose.toLowerCase().includes(searchLower)) ||
      (checkout.booking?.room?.name && checkout.booking.room.name.toLowerCase().includes(searchLower)) ||
      (checkout.booking?.room?.code && checkout.booking.room.code.toLowerCase().includes(searchLower));
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'flagged' && checkout.has_violation) ||
      checkout.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'returned': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'lost': return 'bg-purple-100 text-purple-800';
      case 'damaged': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return Clock;
      case 'returned': return CheckSquare;
      case 'overdue': return AlertTriangle;
      case 'lost': return XSquare;
      case 'damaged': return AlertTriangle;
      default: return Clock;
    }
  };

  const getViolationTypeColor = (type: string) => {
    switch (type) {
      case 'late_return': return 'bg-yellow-100 text-yellow-800';
      case 'damage': return 'bg-orange-100 text-orange-800';
      case 'loss': return 'bg-red-100 text-red-800';
      case 'misuse': return 'bg-purple-100 text-purple-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-green-100 text-green-800';
      case 'major': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to access checkout validation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Package className="h-8 w-8" />
              <span>Checkout Validation Queue</span>
            </h1>
            <p className="mt-2 opacity-90">
              Review and approve pending equipment checkouts
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{checkouts.length}</div>
            <div className="text-sm opacity-80">Pending Approvals</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Active', count: checkouts.filter(c => c.status === 'active').length, color: 'bg-blue-500', icon: Clock },
          { label: 'Overdue', count: checkouts.filter(c => c.status === 'overdue').length, color: 'bg-red-500', icon: AlertTriangle },
          { label: 'With Violations', count: checkouts.filter(c => c.has_violation).length, color: 'bg-yellow-500', icon: Flag },
          { label: 'Total Items', count: checkouts.reduce((sum, c) => sum + (c.total_items || 0), 0), color: 'bg-purple-500', icon: Package },
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
                placeholder="Search checkouts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="overdue">Overdue</option>
              <option value="flagged">Flagged with Violations</option>
            </select>
          </div>

          {/* Refresh Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchCheckouts()}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Checkouts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center">
              <RefreshCw className="h-6 w-6 animate-spin text-green-600 mr-2" />
              <span className="text-gray-600">Loading checkouts...</span>
            </div>
          </div>
        ) : filteredCheckouts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Package className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-600">No pending checkouts require your attention.</p>
          </div>
        ) : (
          filteredCheckouts.map((checkout) => {
            const StatusIcon = getStatusIcon(checkout.status);
            const isProcessing = processingIds.has(checkout.id);
            const isOverdue = checkout.expected_return_date && isAfter(new Date(), new Date(checkout.expected_return_date));
            
            return (
              <div
                key={checkout.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 hover:shadow-md transition-all duration-200 ${
                  checkout.has_violation 
                    ? 'border-yellow-300' 
                    : isOverdue 
                      ? 'border-red-300' 
                      : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className={`p-2 rounded-lg ${
                        checkout.has_violation 
                          ? 'bg-yellow-500' 
                          : isOverdue 
                            ? 'bg-red-500' 
                            : 'bg-blue-500'
                      }`}>
                        {checkout.has_violation ? (
                          <Flag className="h-5 w-5 text-white" />
                        ) : isOverdue ? (
                          <AlertTriangle className="h-5 w-5 text-white" />
                        ) : (
                          <StatusIcon className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {checkout.booking?.purpose || 'Equipment Checkout'}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(checkout.status)}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {checkout.status.toUpperCase()}
                          </span>
                          {checkout.has_violation && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Flag className="h-3 w-3 mr-1" />
                              VIOLATION REPORTED
                            </span>
                          )}
                        </div>
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
                            {checkout.user?.full_name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {checkout.user?.identity_number || 'No ID'}
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
                            {checkout.booking?.room?.name || 'Unknown Room'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {checkout.booking?.room?.code || 'No Code'} • {checkout.booking?.room?.department?.name || 'No Department'}
                          </p>
                        </div>
                      </div>

                      {/* Date Info */}
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {checkout.checkout_date ? format(new Date(checkout.checkout_date), 'MMM d, yyyy') : 'Unknown Date'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Due: {checkout.expected_return_date ? format(new Date(checkout.expected_return_date), 'MMM d, yyyy') : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Items Info */}
                    {checkout.items && checkout.items.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Equipment Items:</p>
                        <div className="flex flex-wrap gap-2">
                          {checkout.items.map((item, index) => (
                            <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Zap className="h-3 w-3 mr-1" />
                              {item.equipment?.name || 'Unknown Item'} {item.quantity > 1 ? `(${item.quantity})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Violation Warning */}
                    {checkout.has_violation && checkout.violations && checkout.violations.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800">
                              {checkout.violations[0].title}
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              {checkout.violations[0].description.length > 100 
                                ? `${checkout.violations[0].description.substring(0, 100)}...` 
                                : checkout.violations[0].description}
                            </p>
                            {checkout.violations.length > 1 && (
                              <p className="text-xs text-yellow-600 mt-1">
                                +{checkout.violations.length - 1} more violation(s)
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedCheckout(checkout);
                        setShowDetailModal(true);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => handleApproval(checkout.id)}
                      disabled={isProcessing}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      <Check className="h-4 w-4" />
                      <span>Approve</span>
                    </button>
                    
                    <button
                      onClick={() => setShowDeleteConfirm(checkout.id)}
                      disabled={isProcessing}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      <X className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Checkout Detail Modal */}
      {showDetailModal && selectedCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Checkout Details</h3>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowViolationForm(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Status Badge */}
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedCheckout.status)}`}>
                    {getStatusIcon(selectedCheckout.status)({ className: "h-4 w-4 mr-1" })}
                    {selectedCheckout.status.toUpperCase()}
                  </span>
                  
                  {selectedCheckout.has_violation && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      <Flag className="h-4 w-4 mr-1" />
                      HAS VIOLATIONS
                    </span>
                  )}
                </div>

                {/* Basic Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">
                    {selectedCheckout.booking?.purpose || 'Equipment Checkout'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Checkout Date:</span>
                      <span className="ml-2 font-medium">
                        {selectedCheckout.checkout_date ? format(new Date(selectedCheckout.checkout_date), 'MMM d, yyyy') : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expected Return:</span>
                      <span className="ml-2 font-medium">
                        {selectedCheckout.expected_return_date ? format(new Date(selectedCheckout.expected_return_date), 'MMM d, yyyy') : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Items:</span>
                      <span className="ml-2 font-medium">{selectedCheckout.total_items || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Booking Status:</span>
                      <span className="ml-2 font-medium capitalize">{selectedCheckout.booking?.status || 'Unknown'}</span>
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">User Information</h5>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{selectedCheckout.user?.full_name || 'Unknown User'}</div>
                        <div className="text-sm text-gray-600">{selectedCheckout.user?.identity_number || 'No ID'}</div>
                        <div className="text-sm text-gray-600">{selectedCheckout.user?.email || 'No Email'}</div>
                        <div className="text-sm text-gray-600 capitalize">{selectedCheckout.user?.role?.replace('_', ' ') || 'No Role'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Room Info */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Room Information</h5>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                        <Building className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{selectedCheckout.booking?.room?.name || 'Unknown Room'}</div>
                        <div className="text-sm text-gray-600">{selectedCheckout.booking?.room?.code || 'No Code'}</div>
                        <div className="text-sm text-gray-600">{selectedCheckout.booking?.room?.department?.name || 'No Department'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Equipment Items */}
                {selectedCheckout.items && selectedCheckout.items.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Equipment Items</h5>
                    <div className="space-y-2">
                      {selectedCheckout.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Zap className="h-5 w-5 text-gray-400" />
                            <div>
                              <div className="font-medium text-gray-900">{item.equipment?.name || 'Unknown Item'}</div>
                              <div className="text-sm text-gray-500">{item.equipment?.code || 'No Code'} • {item.equipment?.category || 'No Category'}</div>
                              {item.condition_notes && (
                                <div className="text-xs text-gray-500 mt-1">{item.condition_notes}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            Qty: {item.quantity}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Violations */}
                {selectedCheckout.has_violation && selectedCheckout.violations && selectedCheckout.violations.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Reported Violations</h5>
                    <div className="space-y-3">
                      {selectedCheckout.violations.map((violation, index) => (
                        <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-start space-x-2">
                              <Flag className="h-5 w-5 text-yellow-600 mt-0.5" />
                              <div>
                                <p className="font-medium text-gray-900">{violation.title}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getViolationTypeColor(violation.violation_type)}`}>
                                    {violation.violation_type.replace('_', ' ').toUpperCase()}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                                    {violation.severity.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500">
                              {format(new Date(violation.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-2">{violation.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Violation Form */}
                {showViolationForm ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Flag className="h-5 w-5 text-yellow-600 mr-2" />
                      Report Violation
                    </h5>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Violation Type
                        </label>
                        <select
                          value={violationType}
                          onChange={(e) => setViolationType(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        >
                          <option value="late_return">Late Return</option>
                          <option value="damage">Damage</option>
                          <option value="loss">Loss</option>
                          <option value="misuse">Misuse</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Severity
                        </label>
                        <select
                          value={violationSeverity}
                          onChange={(e) => setViolationSeverity(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        >
                          <option value="minor">Minor</option>
                          <option value="major">Major</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Violation Title
                        </label>
                        <input
                          type="text"
                          value={violationTitle}
                          onChange={(e) => setViolationTitle(e.target.value)}
                          placeholder="Enter a title for this violation"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={violationDescription}
                          onChange={(e) => setViolationDescription(e.target.value)}
                          rows={3}
                          placeholder="Describe the violation in detail..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        />
                      </div>
                      
                      <div className="flex space-x-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowViolationForm(false)}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddViolation}
                          disabled={!violationTitle || !violationDescription || isProcessing}
                          className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          Submit Violation
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowViolationForm(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors duration-200 w-full justify-center"
                  >
                    <Flag className="h-4 w-4" />
                    <span>Report Violation</span>
                  </button>
                )}

                {/* Actions */}
                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      handleApproval(selectedCheckout.id);
                      setShowDetailModal(false);
                    }}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <Check className="h-4 w-4" />
                    <span>Approve Checkout</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setShowDeleteConfirm(selectedCheckout.id);
                    }}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <X className="h-4 w-4" />
                    <span>Delete Checkout</span>
                  </button>
                </div>
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
                <h3 className="text-lg font-medium text-gray-900">Delete Checkout</h3>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-2">
              Are you sure you want to delete this checkout? This action cannot be undone.
            </p>
            <p className="text-sm text-gray-700 mb-6 font-medium">
              The associated booking will be restored to "approved" status.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={processingIds.has(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {processingIds.has(showDeleteConfirm) ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutValidation;