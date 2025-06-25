import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Package,
  Search,
  CheckCircle,
  AlertTriangle,
  Camera,
  X,
  User,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  ChevronDown,
  Zap,
  Building,
  FileText,
  Upload,
  Check,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const checkoutSchema = z.object({
  booking_id: z.string().min(1, 'Please select a booking to check out'),
  has_issues: z.boolean(),
  // Report fields (conditional)
  report_category: z.enum(['equipment', 'room_condition', 'cleanliness', 'safety', 'maintenance', 'other']).optional(),
  report_description: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

interface BookingWithDetails {
  id: string;
  user_id?: string;
  room_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  sks: number;
  class_type: string;
  status: string;
  equipment_requested: string[];
  notes?: string;
  user_info?: {
    full_name: string;
    identity_number: string;
    email: string;
    phone_number?: string;
  };
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    identity_number: string;
    email: string;
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

const CheckOut: React.FC = () => {
  const [approvedBookings, setApprovedBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBookingDropdown, setShowBookingDropdown] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      has_issues: false,
      report_category: 'equipment',
      attachments: [],
    },
  });

  const watchHasIssues = form.watch('has_issues');
  const watchBookingId = form.watch('booking_id');

  useEffect(() => {
    fetchApprovedBookings();
  }, []);

  useEffect(() => {
    if (watchBookingId) {
      const booking = approvedBookings.find(b => b.id === watchBookingId);
      setSelectedBooking(booking || null);
    }
  }, [watchBookingId, approvedBookings]);

  useEffect(() => {
    setShowReportForm(watchHasIssues);
    if (!watchHasIssues) {
      // Clear report fields when no issues
      form.setValue('report_category', 'equipment');
      form.setValue('report_description', '');
      setAttachments([]);
    }
  }, [watchHasIssues, form]);

  const fetchApprovedBookings = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching approved bookings...');
      
      // Get approved bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching approved bookings:', bookingsError);
        throw bookingsError;
      }

      console.log('Approved bookings found:', bookingsData?.length || 0);

      if (!bookingsData || bookingsData.length === 0) {
        setApprovedBookings([]);
        return;
      }

      // Fetch related data for each booking
      const bookingsWithDetails = await Promise.all(
        bookingsData.map(async (booking) => {
          let user = null;
          let room = null;

          // Fetch user data if user_id exists
          if (booking.user_id) {
            try {
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, full_name, identity_number, email')
                .eq('id', booking.user_id)
                .maybeSingle();
              
              if (!userError && userData) {
                user = userData;
              }
            } catch (error) {
              console.log('User not found for booking:', booking.id);
            }
          }

          // If no user found but user_info exists, use that
          if (!user && booking.user_info) {
            user = {
              id: 'temp',
              full_name: booking.user_info.full_name,
              identity_number: booking.user_info.identity_number,
              email: booking.user_info.email || `${booking.user_info.identity_number}@student.edu`,
            };
          }

          // Fetch room data
          if (booking.room_id) {
            try {
              const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select(`
                  id,
                  name,
                  code,
                  capacity,
                  department:departments(name)
                `)
                .eq('id', booking.room_id)
                .maybeSingle();
              
              if (!roomError && roomData) {
                room = roomData;
              }
            } catch (error) {
              console.log('Room not found for booking:', booking.id);
            }
          }

          return {
            ...booking,
            user,
            room
          };
        })
      );

      setApprovedBookings(bookingsWithDetails);
    } catch (error) {
      console.error('Error fetching approved bookings:', error);
      toast.error('Failed to load approved bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // For demo purposes, we'll convert to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        const newAttachments = [...attachments, base64String];
        setAttachments(newAttachments);
        form.setValue('attachments', newAttachments);
        toast.success('Image uploaded successfully');
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
    form.setValue('attachments', newAttachments);
  };

  const handleSubmit = async (data: CheckoutForm) => {
    try {
      setLoading(true);

      if (!selectedBooking) {
        toast.error('Please select a booking to check out');
        return;
      }

      console.log('Processing checkout for booking:', selectedBooking.id);

      // Create checkout record
      // Create checkout record
      const checkoutData = {
        user_id: selectedBooking.user_id,
        booking_id: data.booking_id,
        checkout_date: new Date().toISOString(),
        expected_return_date: selectedBooking.end_time,
        status: 'returned', // Mark as returned immediately since this is a return process
        actual_return_date: new Date().toISOString(),
        condition_on_checkout: 'good',
        condition_on_return: 'good',
        total_items: selectedBooking.equipment_requested?.length || 0,
      };

      const { error: checkoutError } = await supabase
        .from('checkouts')
        .insert(checkoutData);

      if (checkoutError) {
        console.error('Error creating checkout:', checkoutError);
        throw checkoutError;
      }

      console.log('Checkout record created successfully');

      // Update booking status to completed
      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', data.booking_id);

      if (bookingUpdateError) {
        console.error('Error updating booking status:', bookingUpdateError);
        // Don't throw error here as checkout was successful
        toast.error('Checkout completed but failed to update booking status');
      } else {
        console.log('Booking status updated to completed');
      }

      // If there are issues, create a report
      if (data.has_issues && data.report_description) {
        console.log('Creating issue report...');
        
        const reportData = {
          reporter_id: selectedBooking.user_id,
          reporter_name: selectedBooking.user?.full_name || selectedBooking.user_info?.full_name,
          reporter_email: selectedBooking.user?.email || selectedBooking.user_info?.email,
          reporter_phone: selectedBooking.user_info?.phone_number,
          is_anonymous: false,
          category: data.report_category,
          priority: 'medium', // Default to medium priority
          title: `Issue with ${data.report_category?.replace('_', ' ')}`,
          description: data.report_description,
          location: selectedBooking.room?.name,
          room_id: selectedBooking.room_id,
          status: 'new',
          attachments: attachments,
        };

        const { error: reportError } = await supabase
          .from('reports')
          .insert(reportData);

        if (reportError) {
          console.error('Error creating report:', reportError);
          toast.error('Checkout completed but failed to submit report');
        } else {
          console.log('Issue report created successfully');
          toast.success('Checkout completed and issue reported successfully!');
        }
      } else {
        toast.success('Checkout completed successfully!');
      }

      // Reset form and refresh data
      form.reset({
        has_issues: false,
        report_category: 'equipment',
        attachments: [],
      });
      setSelectedBooking(null);
      setAttachments([]);
      setSearchTerm('');
      
      // Refresh the bookings list to remove the completed booking
      await fetchApprovedBookings();

    } catch (error: any) {
      console.error('Error processing checkout:', error);
      toast.error(error.message || 'Failed to process checkout');
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = approvedBookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (booking.user?.full_name && booking.user.full_name.toLowerCase().includes(searchLower)) ||
      (booking.user?.identity_number && booking.user.identity_number.toLowerCase().includes(searchLower)) ||
      (booking.user_info?.full_name && booking.user_info.full_name.toLowerCase().includes(searchLower)) ||
      (booking.user_info?.identity_number && booking.user_info.identity_number.toLowerCase().includes(searchLower)) ||
      (booking.purpose && booking.purpose.toLowerCase().includes(searchLower)) ||
      (booking.room?.name && booking.room.name.toLowerCase().includes(searchLower)) ||
      (booking.room?.code && booking.room.code.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Equipment Check Out
                </h1>
                <p className="text-gray-600 mt-1">Complete your equipment return and report any issues</p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{approvedBookings.length}</div>
                <div className="text-sm text-gray-500">Approved Bookings</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Booking Search */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Search className="h-5 w-5 text-emerald-500" />
                <h2 className="text-xl font-bold text-gray-800">Find Your Booking</h2>
              </div>
              
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, room..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowBookingDropdown(true);
                  }}
                  onFocus={() => setShowBookingDropdown(true)}
                  className="w-full pl-12 pr-4 py-4 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                />
                <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                
                {showBookingDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
                        <span className="text-gray-600 font-medium">Loading bookings...</span>
                      </div>
                    ) : filteredBookings.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No approved bookings found</p>
                        <p className="text-sm text-gray-400">Try a different search term</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {filteredBookings.map((booking) => (
                          <div
                            key={booking.id}
                            onClick={() => {
                              form.setValue('booking_id', booking.id);
                              setSearchTerm(`${booking.user?.full_name || booking.user_info?.full_name || 'Unknown'} - ${booking.room?.name || 'Unknown Room'}`);
                              setShowBookingDropdown(false);
                            }}
                            className="p-4 hover:bg-emerald-50 cursor-pointer rounded-xl border border-transparent hover:border-emerald-200 transition-all duration-200 mb-2 last:mb-0"
                          >
                            <div className="flex items-start space-x-3">
                              <div className="h-10 w-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">
                                  {booking.user?.full_name || booking.user_info?.full_name || 'Unknown User'}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  {booking.user?.identity_number || booking.user_info?.identity_number || 'No ID'}
                                </div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center text-xs text-gray-500">
                                    <Building className="h-3 w-3 mr-1" />
                                    <span className="truncate">{booking.room?.name || 'Unknown Room'}</span>
                                  </div>
                                  <div className="flex items-center text-xs text-gray-500">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    <span>{format(new Date(booking.start_time), 'MMM d, yyyy')}</span>
                                  </div>
                                  <div className="flex items-center text-xs text-gray-500">
                                    <Package className="h-3 w-3 mr-1" />
                                    <span>{booking.equipment_requested?.length || 0} items</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {form.formState.errors.booking_id && (
                <p className="mt-2 text-sm text-red-600 font-medium">
                  {form.formState.errors.booking_id.message}
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Checkout Form */}
          <div className="lg:col-span-2">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center space-x-3 mb-8">
                <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Complete Equipment Return</h2>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                {/* Selected Booking Details */}
                {selectedBooking && (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 rounded-2xl p-6">
                    <div className="flex items-center space-x-3 mb-6">
                      <CheckCircle className="h-6 w-6 text-emerald-600" />
                      <h3 className="text-xl font-bold text-emerald-900">Selected Booking Details</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">User Information</span>
                          <div className="mt-1">
                            <div className="font-bold text-emerald-900">
                              {selectedBooking.user?.full_name || selectedBooking.user_info?.full_name || 'Unknown User'}
                            </div>
                            <div className="text-emerald-700">
                              {selectedBooking.user?.identity_number || selectedBooking.user_info?.identity_number || 'No ID'}
                            </div>
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Date & Time</span>
                          <div className="mt-1">
                            <div className="font-bold text-emerald-900">{format(new Date(selectedBooking.start_time), 'MMM d, yyyy')}</div>
                            <div className="text-emerald-700">
                              {format(new Date(selectedBooking.start_time), 'h:mm a')} - {format(new Date(selectedBooking.end_time), 'h:mm a')}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Location</span>
                          <div className="mt-1">
                            <div className="font-bold text-emerald-900">{selectedBooking.room?.name || 'Unknown Room'}</div>
                            <div className="text-emerald-700">{selectedBooking.room?.code || ''}</div>
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Purpose</span>
                          <div className="mt-1">
                            <div className="font-bold text-emerald-900">{selectedBooking.purpose || 'No purpose specified'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {selectedBooking.equipment_requested && selectedBooking.equipment_requested.length > 0 && (
                      <div>
                        <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3 block">Requested Equipment</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedBooking.equipment_requested.map((item, index) => (
                            <div key={index} className="flex items-center p-3 bg-white/60 rounded-xl border border-emerald-200/50">
                              <div className="h-8 w-8 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                                <Zap className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div className="font-medium text-emerald-900">{item}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Issue Reporting Toggle */}
                <div className="border-t border-gray-200/50 pt-8">
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200/50 rounded-2xl p-6">
                    <div className="flex items-start space-x-4">
                      <input
                        {...form.register('has_issues')}
                        type="checkbox"
                        className="h-5 w-5 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded mt-1 transition-all duration-200"
                      />
                      <div className="flex-1">
                        <label className="text-lg font-semibold text-yellow-900 cursor-pointer">
                          Report an issue or problem
                        </label>
                        <p className="mt-2 text-sm text-yellow-700">
                          Check this if you experienced any problems with the equipment, room condition, or facilities during your booking.
                        </p>
                      </div>
                      <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                    </div>
                  </div>
                </div>

                {/* Issue Report Form */}
                {showReportForm && (
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200/50 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center space-x-3 mb-6">
                      <FileText className="h-6 w-6 text-orange-600" />
                      <h3 className="text-xl font-bold text-orange-900">Issue Report Details</h3>
                    </div>

                    {/* Issue Category */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Issue Category *
                      </label>
                      <select
                        {...form.register('report_category')}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all duration-200"
                      >
                        <option value="equipment">Equipment Issues</option>
                        <option value="room_condition">Room Condition</option>
                        <option value="cleanliness">Cleanliness</option>
                        <option value="safety">Safety</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Issue Description */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Issue Description *
                      </label>
                      <textarea
                        {...form.register('report_description')}
                        rows={4}
                        placeholder="Please describe the issue in detail. Include what happened, when it occurred, and any relevant context..."
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                      />
                    </div>

                    {/* Photo Upload */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Attach Photos (Optional)
                      </label>
                      <div className="space-y-4">
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300/50 border-dashed rounded-xl cursor-pointer bg-gradient-to-b from-gray-50/50 to-white/50 hover:from-gray-100/50 hover:to-gray-50/50 transition-all duration-200">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {uploadingImage ? (
                                <div className="flex flex-col items-center">
                                  <RefreshCw className="h-10 w-10 text-gray-400 animate-spin mb-3" />
                                  <p className="text-sm text-gray-500 font-medium">Uploading image...</p>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <div className="p-3 bg-gray-100 rounded-full mb-3">
                                    <Camera className="h-8 w-8 text-gray-400" />
                                  </div>
                                  <p className="mb-2 text-sm text-gray-600 font-semibold">
                                    Click to upload or drag and drop
                                  </p>
                                  <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                                </div>
                              )}
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={uploadingImage}
                            />
                          </label>
                        </div>

                        {/* Uploaded Images */}
                        {attachments.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Uploaded Images ({attachments.length})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {attachments.map((attachment, index) => (
                                <div key={index} className="relative group">
                                  <img
                                    src={attachment}
                                    alt={`Attachment ${index + 1}`}
                                    className="w-full h-24 object-cover rounded-xl border border-gray-200/50 shadow-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(index)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:bg-red-600 hover:scale-110"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-all duration-200"></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex space-x-4 pt-8 border-t border-gray-200/50">
                  <button
                    type="submit"
                    disabled={loading || !selectedBooking}
                    className="flex-1 flex items-center justify-center space-x-3 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>Processing Checkout...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>Complete Equipment Return</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Additional Information */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-2xl p-6">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <ExternalLink className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">What happens next?</h3>
                      <ul className="space-y-2 text-sm text-blue-800">
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>Your booking will be marked as completed</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>Equipment will be checked and processed for return</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>Any reported issues will be forwarded to the maintenance team</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>You'll receive a confirmation notification</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {showBookingDropdown && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowBookingDropdown(false)}
        />
      )}
    </div>
  );
};

export default CheckOut;