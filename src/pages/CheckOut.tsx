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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Package className="h-8 w-8" />
              <span>Equipment Check Out</span>
            </h1>
            <p className="mt-2 opacity-90">
              Complete your equipment return and report any issues
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{approvedBookings.length}</div>
            <div className="text-sm opacity-80">Approved Bookings</div>
          </div>
        </div>
      </div>

      {/* Check Out Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Complete Equipment Return</h2>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Search and Select Booking */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Your Approved Booking *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, ID, room, or purpose..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowBookingDropdown(true);
                }}
                onFocus={() => setShowBookingDropdown(true)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              
              {showBookingDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-8 text-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-green-600 mx-auto mb-2" />
                      <span className="text-gray-600">Loading bookings...</span>
                    </div>
                  ) : filteredBookings.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No approved bookings found</p>
                      <p className="text-sm">Try a different search term</p>
                    </div>
                  ) : (
                    filteredBookings.map((booking) => (
                      <div
                        key={booking.id}
                        onClick={() => {
                          form.setValue('booking_id', booking.id);
                          setSearchTerm(`${booking.user?.full_name || booking.user_info?.full_name || 'Unknown'} - ${booking.room?.name || 'Unknown Room'}`);
                          setShowBookingDropdown(false);
                        }}
                        className="px-4 py-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                                <User className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {booking.user?.full_name || booking.user_info?.full_name || 'Unknown User'}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {booking.user?.identity_number || booking.user_info?.identity_number || 'No ID'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center space-x-2">
                                <Building className="h-4 w-4 text-gray-400" />
                                <span>{booking.room?.name || 'Unknown Room'}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Package className="h-4 w-4 text-gray-400" />
                                <span>{booking.equipment_requested?.length || 0} items</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span>{format(new Date(booking.start_time), 'MMM d, yyyy')}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-gray-400" />
                                <span>{format(new Date(booking.start_time), 'h:mm a')} - {format(new Date(booking.end_time), 'h:mm a')}</span>
                              </div>
                            </div>

                            {booking.equipment_requested && booking.equipment_requested.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-gray-500 mb-1">Equipment:</div>
                                <div className="flex flex-wrap gap-1">
                                  {booking.equipment_requested.slice(0, 3).map((item, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                  {booking.equipment_requested.length > 3 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      +{booking.equipment_requested.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {form.formState.errors.booking_id && (
              <p className="mt-1 text-sm text-red-600">
                {form.formState.errors.booking_id.message}
              </p>
            )}
          </div>

          {/* Selected Booking Details */}
          {selectedBooking && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-green-900 mb-3">Selected Booking Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-700 font-medium">User:</span>
                  <div className="text-green-800">
                    {selectedBooking.user?.full_name || selectedBooking.user_info?.full_name || 'Unknown User'}
                  </div>
                  <div className="text-green-600">
                    {selectedBooking.user?.identity_number || selectedBooking.user_info?.identity_number || 'No ID'}
                  </div>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Location:</span>
                  <div className="text-green-800">{selectedBooking.room?.name || 'Unknown Room'}</div>
                  <div className="text-green-600">{selectedBooking.purpose || 'No purpose specified'}</div>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Date:</span>
                  <div className="text-green-800">{format(new Date(selectedBooking.start_time), 'MMM d, yyyy')}</div>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Time:</span>
                  <div className="text-green-800">
                    {format(new Date(selectedBooking.start_time), 'h:mm a')} - {format(new Date(selectedBooking.end_time), 'h:mm a')}
                  </div>
                </div>
              </div>
              
              {selectedBooking.equipment_requested && selectedBooking.equipment_requested.length > 0 && (
                <div className="mt-4">
                  <span className="text-green-700 font-medium">Requested Equipment:</span>
                  <div className="mt-2 space-y-2">
                    {selectedBooking.equipment_requested.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded border border-green-200">
                        <div className="flex items-center space-x-3">
                          <Zap className="h-4 w-4 text-green-600" />
                          <div className="font-medium text-gray-900">{item}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Issue Reporting Toggle */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center space-x-3">
              <input
                {...form.register('has_issues')}
                type="checkbox"
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label className="text-sm font-medium text-gray-700">
                Report an issue or problem
              </label>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Check this if you experienced any problems with the equipment or facilities
            </p>
          </div>

          {/* Issue Report Form - Simplified */}
          {showReportForm && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-medium text-yellow-900">Issue Report</h3>
              </div>

              {/* Issue Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Category *
                </label>
                <select
                  {...form.register('report_category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Description *
                </label>
                <textarea
                  {...form.register('report_description')}
                  rows={4}
                  placeholder="Please describe the issue in detail..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attach Photos (Optional)
                </label>
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {uploadingImage ? (
                          <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mb-2" />
                        ) : (
                          <Camera className="h-8 w-8 text-gray-400 mb-2" />
                        )}
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={attachment}
                            alt={`Attachment ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex space-x-3 pt-6">
            <button
              type="submit"
              disabled={loading || !selectedBooking}
              className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              <span>{loading ? 'Processing...' : 'Complete Check Out'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Click outside to close dropdown */}
      {showBookingDropdown && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowBookingDropdown(false)}
        />
      )}
    </div>
  );
};

export default CheckOut;