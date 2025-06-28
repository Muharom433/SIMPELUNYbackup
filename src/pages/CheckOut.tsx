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
  Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { alert } from '../components/Alert/AlertHelper';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

const checkoutSchema = z.object({
  record_id: z.string().min(1, 'Please select a booking or lending record to check out'),
  record_type: z.enum(['booking', 'lending_tool']),
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
  record_type: 'booking';
}

interface LendingToolWithDetails {
  id: string;
  id_user: string;
  date: string;
  id_equipment: string[];
  qty: number[];
  status: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    identity_number: string;
    email: string;
  };
  equipment_details?: Array<{
    id: string;
    name: string;
    code: string;
    category: string;
  }>;
  record_type: 'lending_tool';
}

type CombinedRecord = BookingWithDetails | LendingToolWithDetails;

const CheckOut: React.FC = () => {
  const { getText } = useLanguage();
  const [allRecords, setAllRecords] = useState<CombinedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecordDropdown, setShowRecordDropdown] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CombinedRecord | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      record_id: '',
      has_issues: false,
      report_category: 'equipment',
      attachments: [],
    },
  });

  const watchHasIssues = form.watch('has_issues');
  const watchRecordId = form.watch('record_id');

  useEffect(() => {
    fetchAllRecords();
  }, []);

  useEffect(() => {
    if (watchRecordId) {
      const record = allRecords.find(r => r.id === watchRecordId);
      console.log('Record found for ID:', watchRecordId, record);
      setSelectedRecord(record || null);
      if (record) {
        form.setValue('record_type', record.record_type);
        console.log('Set record type:', record.record_type);
      }
    } else {
      setSelectedRecord(null);
    }
  }, [watchRecordId, allRecords, form]);

  useEffect(() => {
    setShowReportForm(watchHasIssues);
    if (!watchHasIssues) {
      // Clear report fields when no issues
      form.setValue('report_category', 'equipment');
      form.setValue('report_description', '');
      setAttachments([]);
    }
  }, [watchHasIssues, form]);

  const fetchAllRecords = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching approved bookings and borrowing tools...');
      
      // Fetch approved bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching approved bookings:', bookingsError);
        throw bookingsError;
      }

      // Fetch lending tools with status 'borrow'
      const { data: lendingToolsData, error: lendingToolsError } = await supabase
        .from('lending_tool')
        .select('*')
        .eq('status', 'borrow')
        .order('created_at', { ascending: false });

      if (lendingToolsError) {
        console.error('Error fetching lending tools:', lendingToolsError);
        throw lendingToolsError;
      }

      console.log('Approved bookings found:', bookingsData?.length || 0);
      console.log('Borrowing tools found:', lendingToolsData?.length || 0);

      // Process bookings
      const bookingsWithDetails = await Promise.all(
        (bookingsData || []).map(async (booking) => {
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
            room,
            record_type: 'booking' as const
          };
        })
      );

      // Process lending tools
      const lendingToolsWithDetails = await Promise.all(
        (lendingToolsData || []).map(async (lendingTool) => {
          let user = null;
          let equipment_details = [];

          // Fetch user data
          if (lendingTool.id_user) {
            try {
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, full_name, identity_number, email')
                .eq('id', lendingTool.id_user)
                .maybeSingle();
              
              if (!userError && userData) {
                user = userData;
              }
            } catch (error) {
              console.log('User not found for lending tool:', lendingTool.id);
            }
          }

          // Fetch equipment details
          if (lendingTool.id_equipment && Array.isArray(lendingTool.id_equipment)) {
            try {
              const { data: equipmentData, error: equipmentError } = await supabase
                .from('equipment')
                .select('id, name, code, category, quantity')
                .in('id', lendingTool.id_equipment);
              
              if (!equipmentError && equipmentData) {
                equipment_details = equipmentData.map((eq, index) => ({
                  ...eq,
                  borrowed_quantity: lendingTool.qty[index] || 1
                }));
              }
            } catch (error) {
              console.log('Equipment not found for lending tool:', lendingTool.id);
            }
          }

          return {
            ...lendingTool,
            user,
            equipment_details,
            record_type: 'lending_tool' as const
          };
        })
      );

      // Combine both types of records
      const combinedRecords = [...bookingsWithDetails, ...lendingToolsWithDetails];
      console.log('Combined records:', combinedRecords.length, combinedRecords);
      setAllRecords(combinedRecords);

    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error(getText('Failed to load records', 'Gagal memuat data'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecordSelect = (record: CombinedRecord, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    console.log('Record selected:', record.id, record.record_type);
    
    // Set form values
    form.setValue('record_id', record.id);
    form.setValue('record_type', record.record_type);
    
    // Update UI state
    setSelectedRecord(record);
    setSearchTerm(getDisplayName(record));
    setShowRecordDropdown(false);
    
    // Clear any validation errors
    form.clearErrors('record_id');
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(getText('Please select an image file', 'Silakan pilih file gambar'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(getText('Image size must be less than 5MB', 'Ukuran gambar harus kurang dari 5MB'));
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
        toast.success(getText('Image uploaded successfully', 'Gambar berhasil diunggah'));
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(getText('Failed to upload image', 'Gagal mengunggah gambar'));
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

      if (!selectedRecord) {
        toast.error(getText('Please select a record to check out', 'Silakan pilih data untuk check out'));
        return;
      }

      console.log('Processing checkout for record:', selectedRecord.id, 'Type:', selectedRecord.record_type);

      if (selectedRecord.record_type === 'lending_tool') {
        // Handle lending tool checkout
        const lendingTool = selectedRecord as LendingToolWithDetails;
        
        // Create checkout record for lending tool
        const checkoutData = {
          user_id: lendingTool.id_user,
          lendingTool_id: lendingTool.id, // Foreign key to lending_tool
          checkout_date: new Date().toISOString(),
          expected_return_date: lendingTool.date,
          status: 'returned',
          actual_return_date: new Date().toISOString(),
          condition_on_checkout: 'good',
          condition_on_return: 'good',
          total_items: lendingTool.equipment_details?.length || 0,
          type: 'things' // Set type to 'things' for lending tools
        };

        const { error: checkoutError } = await supabase
          .from('checkouts')
          .insert(checkoutData);

        if (checkoutError) {
          console.error('Error creating checkout for lending tool:', checkoutError);
          throw checkoutError;
        }

        console.log('Checkout record created successfully for lending tool');

        // Update lending tool status to 'completed'
        const { error: lendingUpdateError } = await supabase
          .from('lending_tool')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', lendingTool.id);

        if (lendingUpdateError) {
          console.error('Error updating lending tool status:', lendingUpdateError);
          toast.error(getText('Checkout completed but failed to update lending tool status', 'Checkout selesai tapi gagal memperbarui status peminjaman alat'));
        } else {
          console.log('Lending tool status updated to completed');
        }


      } else {
        // Handle booking checkout (existing logic)
        const booking = selectedRecord as BookingWithDetails;
        
        // Create checkout record for booking
        const checkoutData = {
          user_id: booking.user_id,
          booking_id: booking.id,
          checkout_date: new Date().toISOString(),
          expected_return_date: booking.end_time,
          status: 'returned',
          actual_return_date: new Date().toISOString(),
          condition_on_checkout: 'good',
          condition_on_return: 'good',
          total_items: booking.equipment_requested?.length || 0,
        };

        const { error: checkoutError } = await supabase
          .from('checkouts')
          .insert(checkoutData);

        if (checkoutError) {
          console.error('Error creating checkout for booking:', checkoutError);
          throw checkoutError;
        }

        console.log('Checkout record created successfully for booking');

        // Update booking status to completed
        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.id);

        if (bookingUpdateError) {
          console.error('Error updating booking status:', bookingUpdateError);
          toast.error(getText('Checkout completed but failed to update booking status', 'Checkout selesai tapi gagal memperbarui status pemesanan'));
        } else {
          console.log('Booking status updated to completed');
        }
      }

      // If there are issues, create a report
      if (data.has_issues && data.report_description) {
        console.log('Creating issue report...');
        
        const reportData = {
          reporter_id: selectedRecord.record_type === 'lending_tool' 
            ? (selectedRecord as LendingToolWithDetails).id_user 
            : (selectedRecord as BookingWithDetails).user_id,
          reporter_name: selectedRecord.user?.full_name || 'Unknown User',
          reporter_email: selectedRecord.user?.email || 'unknown@email.com',
          reporter_phone: selectedRecord.record_type === 'booking' 
            ? (selectedRecord as BookingWithDetails).user_info?.phone_number 
            : undefined,
          is_anonymous: false,
          category: data.report_category,
          priority: 'medium',
          title: `Issue with ${data.report_category?.replace('_', ' ')}`,
          description: data.report_description,
          location: selectedRecord.record_type === 'booking' 
            ? (selectedRecord as BookingWithDetails).room?.name 
            : 'Equipment Area',
          room_id: selectedRecord.record_type === 'booking' 
            ? (selectedRecord as BookingWithDetails).room_id 
            : null,
          status: 'new',
          attachments: attachments,
        };

        const { error: reportError } = await supabase
          .from('reports')
          .insert(reportData);

        if (reportError) {
          console.error('Error creating report:', reportError);
          toast.error(getText('Checkout completed but failed to submit report', 'Checkout selesai tapi gagal mengirim laporan'));
        } else {
          console.log('Issue report created successfully');
          toast.success(getText('Checkout completed and issue reported successfully!', 'Checkout selesai dan masalah berhasil dilaporkan!'));
        }
      } else {
        toast.success(getText('Checkout completed successfully!', 'Checkout berhasil diselesaikan!'));
      }

      // Reset form and refresh data
      form.reset({
        record_id: '',
        has_issues: false,
        report_category: 'equipment',
        attachments: [],
      });
      setSelectedRecord(null);
      setAttachments([]);
      setSearchTerm('');
      
      // Refresh the records list
      await fetchAllRecords();

    } catch (error: any) {
      console.error('Error processing checkout:', error);
      toast.error(error.message || getText('Failed to process checkout', 'Gagal memproses checkout'));
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = allRecords.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    
    if (record.record_type === 'booking') {
      const booking = record as BookingWithDetails;
      return (
        (booking.user?.full_name && booking.user.full_name.toLowerCase().includes(searchLower)) ||
        (booking.user?.identity_number && booking.user.identity_number.toLowerCase().includes(searchLower)) ||
        (booking.user_info?.full_name && booking.user_info.full_name.toLowerCase().includes(searchLower)) ||
        (booking.user_info?.identity_number && booking.user_info.identity_number.toLowerCase().includes(searchLower)) ||
        (booking.purpose && booking.purpose.toLowerCase().includes(searchLower)) ||
        (booking.room?.name && booking.room.name.toLowerCase().includes(searchLower)) ||
        (booking.room?.code && booking.room.code.toLowerCase().includes(searchLower))
      );
    } else {
      const lendingTool = record as LendingToolWithDetails;
      return (
        (lendingTool.user?.full_name && lendingTool.user.full_name.toLowerCase().includes(searchLower)) ||
        (lendingTool.user?.identity_number && lendingTool.user.identity_number.toLowerCase().includes(searchLower)) ||
        (lendingTool.equipment_details && lendingTool.equipment_details.some(eq => 
          eq.name.toLowerCase().includes(searchLower) || 
          eq.code.toLowerCase().includes(searchLower)
        ))
      );
    }
  });

  const getCategoryText = (category: string) => {
    switch (category) {
      case 'equipment': return getText('Equipment Issues', 'Masalah Peralatan');
      case 'room_condition': return getText('Room Condition', 'Kondisi Ruangan');
      case 'cleanliness': return getText('Cleanliness', 'Kebersihan');
      case 'safety': return getText('Safety', 'Keamanan');
      case 'maintenance': return getText('Maintenance', 'Pemeliharaan');
      case 'other': return getText('Other', 'Lainnya');
      default: return category;
    }
  };

  const getDisplayName = (record: CombinedRecord) => {
    if (record.record_type === 'booking') {
      const booking = record as BookingWithDetails;
      const userName = booking.user?.full_name || booking.user_info?.full_name || getText('Unknown User', 'Pengguna Tidak Dikenal');
      const roomName = booking.room?.name || getText('Unknown Room', 'Ruangan Tidak Dikenal');
      return `${userName} - ${roomName}`;
    } else {
      const lendingTool = record as LendingToolWithDetails;
      const userName = lendingTool.user?.full_name || getText('Unknown User', 'Pengguna Tidak Dikenal');
      const equipmentCount = lendingTool.equipment_details?.length || 0;
      return `${userName} - ${equipmentCount} ${getText('Equipment(s)', 'Peralatan')}`;
    }
  };

  // Check if submit button should be enabled
  const isSubmitEnabled = selectedRecord && watchRecordId && !loading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 relative">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  {getText('Return & Check Out', 'Pengembalian & Check Out')}
                </h1>
                <p className="text-gray-600 mt-1">
                  {getText('Complete your return and report any issues', 'Selesaikan pengembalian dan laporkan masalah')}
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{allRecords.length}</div>
                <div className="text-sm text-gray-500">
                  {getText('Active Records', 'Data Aktif')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Record Search */}
          <div className="lg:col-span-1 space-y-6 relative z-20">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 relative">
              <div className="flex items-center space-x-3 mb-6">
                <Search className="h-5 w-5 text-emerald-500" />
                <h2 className="text-xl font-bold text-gray-800">
                  {getText('Find Your Record', 'Cari Data Anda')}
                </h2>
              </div>
              
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                <input
                  type="text"
                  placeholder={getText('Search by name, ID, room, equipment...', 'Cari berdasarkan nama, ID, ruangan, peralatan...')}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (e.target.value === '') {
                      form.setValue('record_id', '');
                      setSelectedRecord(null);
                    }
                    setShowRecordDropdown(true);
                  }}
                  onFocus={() => setShowRecordDropdown(true)}
                  onBlur={() => {
                    // Delay hiding to allow clicks on dropdown items
                    setTimeout(() => setShowRecordDropdown(false), 150);
                  }}
                  className="w-full pl-12 pr-4 py-4 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400 relative z-10"
                />
                <button
                  type="button"
                  onClick={() => setShowRecordDropdown(!showRecordDropdown)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10"
                >
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showRecordDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showRecordDropdown && (
                  <div 
                    className="absolute z-60 w-full mt-2 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-2xl max-h-96 overflow-y-auto"
                    onMouseDown={(e) => e.preventDefault()} // Prevent input blur when clicking dropdown
                  >
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
                        <span className="text-gray-600 font-medium">
                          {getText('Loading records...', 'Memuat data...')}
                        </span>
                      </div>
                    ) : filteredRecords.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">
                          {allRecords.length === 0 
                            ? getText('No active records available', 'Tidak ada data aktif tersedia')
                            : getText('No records match your search', 'Tidak ada data yang cocok dengan pencarian')
                          }
                        </p>
                        <p className="text-sm text-gray-400">
                          {allRecords.length === 0 
                            ? getText('Please check if there are approved bookings or borrowed tools', 'Silakan periksa apakah ada pemesanan yang disetujui atau alat yang dipinjam')
                            : getText('Try a different search term', 'Coba kata kunci pencarian lain')
                          }
                        </p>
                        {allRecords.length === 0 && (
                          <button
                            onClick={fetchAllRecords}
                            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-200 flex items-center space-x-2"
                          >
                            <RefreshCw className="h-4 w-4" />
                            <span>{getText('Refresh Data', 'Refresh Data')}</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-2">
                        {filteredRecords.map((record) => (
                          <button
                            key={record.id}
                            type="button"
                            onClick={(e) => handleRecordSelect(record, e)}
                            className="w-full text-left p-4 hover:bg-emerald-50 cursor-pointer rounded-xl border border-transparent hover:border-emerald-200 transition-all duration-200 mb-2 last:mb-0 active:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                record.record_type === 'booking' 
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                                  : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                              }`}>
                                {record.record_type === 'booking' ? (
                                  <Building className="h-5 w-5 text-white" />
                                ) : (
                                  <Wrench className="h-5 w-5 text-white" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">
                                  {record.user?.full_name || 
                                   (record.record_type === 'booking' ? (record as BookingWithDetails).user_info?.full_name : '') || 
                                   getText('Unknown User', 'Pengguna Tidak Dikenal')}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  {record.user?.identity_number || 
                                   (record.record_type === 'booking' ? (record as BookingWithDetails).user_info?.identity_number : '') || 
                                   getText('No ID', 'Tidak Ada ID')}
                                </div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center text-xs text-gray-500">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      record.record_type === 'booking' 
                                        ? 'bg-emerald-100 text-emerald-800' 
                                        : 'bg-purple-100 text-purple-800'
                                    }`}>
                                      {record.record_type === 'booking' ? getText('Room Booking', 'Pemesanan Ruangan') : getText('Tool Lending', 'Peminjaman Alat')}
                                    </span>
                                  </div>
                                  
                                  {record.record_type === 'booking' ? (
                                    <>
                                      <div className="flex items-center text-xs text-gray-500">
                                        <Building className="h-3 w-3 mr-1" />
                                        <span className="truncate">{(record as BookingWithDetails).room?.name || getText('Unknown Room', 'Ruangan Tidak Dikenal')}</span>
                                      </div>
                                      <div className="flex items-center text-xs text-gray-500">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        <span>{format(new Date((record as BookingWithDetails).start_time), 'MMM d, yyyy')}</span>
                                      </div>
                                      <div className="flex items-center text-xs text-gray-500">
                                        <Package className="h-3 w-3 mr-1" />
                                        <span>{(record as BookingWithDetails).equipment_requested?.length || 0} {getText('items', 'item')}</span>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center text-xs text-gray-500">
                                        <Wrench className="h-3 w-3 mr-1" />
                                        <span>{(record as LendingToolWithDetails).equipment_details?.length || 0} {getText('equipment(s)', 'peralatan')}</span>
                                      </div>
                                      <div className="flex items-center text-xs text-gray-500">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        <span>{format(new Date((record as LendingToolWithDetails).date), 'MMM d, yyyy')}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {form.formState.errors.record_id && (
                <p className="mt-2 text-sm text-red-600 font-medium">
                  {form.formState.errors.record_id.message}
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Checkout Form */}
          <div className="lg:col-span-2 relative z-10">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center space-x-3 mb-8">
                <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {getText('Complete Return Process', 'Selesaikan Proses Pengembalian')}
                </h2>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                {/* Selected Record Details */}
                {selectedRecord && (
                  <div className={`border rounded-2xl p-6 ${
                    selectedRecord.record_type === 'booking' 
                      ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200/50' 
                      : 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200/50'
                  }`}>
                    <div className="flex items-center space-x-3 mb-6">
                      {selectedRecord.record_type === 'booking' ? (
                        <Building className="h-6 w-6 text-emerald-600" />
                      ) : (
                        <Wrench className="h-6 w-6 text-purple-600" />
                      )}
                      <h3 className={`text-xl font-bold ${
                        selectedRecord.record_type === 'booking' ? 'text-emerald-900' : 'text-purple-900'
                      }`}>
                        {selectedRecord.record_type === 'booking' 
                          ? getText('Room Booking Details', 'Detail Pemesanan Ruangan')
                          : getText('Tool Lending Details', 'Detail Peminjaman Alat')
                        }
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-3">
                        <div>
                          <span className={`text-sm font-semibold uppercase tracking-wide ${
                            selectedRecord.record_type === 'booking' ? 'text-emerald-700' : 'text-purple-700'
                          }`}>
                            {getText('User Information', 'Informasi Pengguna')}
                          </span>
                          <div className="mt-1">
                            <div className={`font-bold ${
                              selectedRecord.record_type === 'booking' ? 'text-emerald-900' : 'text-purple-900'
                            }`}>
                              {selectedRecord.user?.full_name || 
                               (selectedRecord.record_type === 'booking' ? (selectedRecord as BookingWithDetails).user_info?.full_name : '') || 
                               getText('Unknown User', 'Pengguna Tidak Dikenal')}
                            </div>
                            <div className={selectedRecord.record_type === 'booking' ? 'text-emerald-700' : 'text-purple-700'}>
                              {selectedRecord.user?.identity_number || 
                               (selectedRecord.record_type === 'booking' ? (selectedRecord as BookingWithDetails).user_info?.identity_number : '') || 
                               getText('No ID', 'Tidak Ada ID')}
                            </div>
                          </div>
                        </div>
                        <div>
                          <span className={`text-sm font-semibold uppercase tracking-wide ${
                            selectedRecord.record_type === 'booking' ? 'text-emerald-700' : 'text-purple-700'
                          }`}>
                            {getText('Date & Time', 'Tanggal & Waktu')}
                          </span>
                          <div className="mt-1">
                            {selectedRecord.record_type === 'booking' ? (
                              <>
                                <div className="font-bold text-emerald-900">
                                  {format(new Date((selectedRecord as BookingWithDetails).start_time), 'MMM d, yyyy')}
                                </div>
                                <div className="text-emerald-700">
                                  {format(new Date((selectedRecord as BookingWithDetails).start_time), 'h:mm a')} - {format(new Date((selectedRecord as BookingWithDetails).end_time), 'h:mm a')}
                                </div>
                              </>
                            ) : (
                              <div className="font-bold text-purple-900">
                                {format(new Date((selectedRecord as LendingToolWithDetails).date), 'MMM d, yyyy h:mm a')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {selectedRecord.record_type === 'booking' ? (
                          <>
                            <div>
                              <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
                                {getText('Location', 'Lokasi')}
                              </span>
                              <div className="mt-1">
                                <div className="font-bold text-emerald-900">
                                  {(selectedRecord as BookingWithDetails).room?.name || getText('Unknown Room', 'Ruangan Tidak Dikenal')}
                                </div>
                                <div className="text-emerald-700">
                                  {(selectedRecord as BookingWithDetails).room?.code || ''}
                                </div>
                              </div>
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
                                {getText('Purpose', 'Tujuan')}
                              </span>
                              <div className="mt-1">
                                <div className="font-bold text-emerald-900">
                                  {(selectedRecord as BookingWithDetails).purpose || getText('No purpose specified', 'Tidak ada tujuan yang ditentukan')}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div>
                            <span className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
                              {getText('Status', 'Status')}
                            </span>
                            <div className="mt-1">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                {getText('Currently Borrowed', 'Sedang Dipinjam')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Equipment/Items Display */}
                    {selectedRecord.record_type === 'booking' ? (
                      (selectedRecord as BookingWithDetails).equipment_requested && (selectedRecord as BookingWithDetails).equipment_requested.length > 0 && (
                        <div>
                          <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3 block">
                            {getText('Requested Equipment', 'Peralatan yang Diminta')}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(selectedRecord as BookingWithDetails).equipment_requested.map((item, index) => (
                              <div key={index} className="flex items-center p-3 bg-white/60 rounded-xl border border-emerald-200/50">
                                <div className="h-8 w-8 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                                  <Zap className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div className="font-medium text-emerald-900">{item}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ) : (
                      (selectedRecord as LendingToolWithDetails).equipment_details && (selectedRecord as LendingToolWithDetails).equipment_details.length > 0 && (
                        <div>
                          <span className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-3 block">
                            {getText('Borrowed Equipment', 'Peralatan yang Dipinjam')}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(selectedRecord as LendingToolWithDetails).equipment_details.map((equipment, index) => (
                              <div key={equipment.id} className="flex items-center justify-between p-3 bg-white/60 rounded-xl border border-purple-200/50">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                                    <Wrench className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-purple-900">{equipment.name}</div>
                                    <div className="text-sm text-purple-700">{equipment.code}</div>
                                  </div>
                                </div>
                                <div className="text-sm font-semibold text-purple-800">
                                  Qty: {(selectedRecord as LendingToolWithDetails).qty[index] || 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
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
                          {getText('Report an issue or problem', 'Laporkan masalah atau kendala')}
                        </label>
                        <p className="mt-2 text-sm text-yellow-700">
                          {getText('Check this if you experienced any problems with the equipment, room condition, or facilities.', 'Centang ini jika Anda mengalami masalah dengan peralatan, kondisi ruangan, atau fasilitas.')}
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
                      <h3 className="text-xl font-bold text-orange-900">
                        {getText('Issue Report Details', 'Detail Laporan Masalah')}
                      </h3>
                    </div>

                    {/* Issue Category */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        {getText('Issue Category', 'Kategori Masalah')} *
                      </label>
                      <select
                        {...form.register('report_category')}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all duration-200"
                      >
                        <option value="equipment">{getCategoryText('equipment')}</option>
                        <option value="room_condition">{getCategoryText('room_condition')}</option>
                        <option value="cleanliness">{getCategoryText('cleanliness')}</option>
                        <option value="safety">{getCategoryText('safety')}</option>
                        <option value="maintenance">{getCategoryText('maintenance')}</option>
                        <option value="other">{getCategoryText('other')}</option>
                      </select>
                    </div>

                    {/* Issue Description */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        {getText('Issue Description', 'Deskripsi Masalah')} *
                      </label>
                      <textarea
                        {...form.register('report_description')}
                        rows={4}
                        placeholder={getText('Please describe the issue in detail. Include what happened, when it occurred, and any relevant context...', 'Harap jelaskan masalah secara detail. Sertakan apa yang terjadi, kapan terjadi, dan konteks yang relevan...')}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                      />
                    </div>

                    {/* Photo Upload */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        {getText('Attach Photos (Optional)', 'Lampirkan Foto (Opsional)')}
                      </label>
                      <div className="space-y-4">
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300/50 border-dashed rounded-xl cursor-pointer bg-gradient-to-b from-gray-50/50 to-white/50 hover:from-gray-100/50 hover:to-gray-50/50 transition-all duration-200">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {uploadingImage ? (
                                <div className="flex flex-col items-center">
                                  <RefreshCw className="h-10 w-10 text-gray-400 animate-spin mb-3" />
                                  <p className="text-sm text-gray-500 font-medium">
                                    {getText('Uploading image...', 'Mengunggah gambar...')}
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <div className="p-3 bg-gray-100 rounded-full mb-3">
                                    <Camera className="h-8 w-8 text-gray-400" />
                                  </div>
                                  <p className="mb-2 text-sm text-gray-600 font-semibold">
                                    {getText('Click to upload or drag and drop', 'Klik untuk mengunggah atau seret dan lepas')}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {getText('PNG, JPG up to 5MB', 'PNG, JPG hingga 5MB')}
                                  </p>
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
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                              {getText('Uploaded Images', 'Gambar yang Diunggah')} ({attachments.length})
                            </h4>
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
                    disabled={!isSubmitEnabled}
                    className={`flex-1 flex items-center justify-center space-x-3 px-8 py-4 font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 transition-all duration-200 shadow-lg ${
                      isSubmitEnabled
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>{getText('Processing Return...', 'Memproses Pengembalian...')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>{getText('Complete Return', 'Selesaikan Pengembalian')}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Helper Text for Submit Button */}
                {!selectedRecord && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2">
                      <Search className="h-5 w-5 text-blue-600" />
                      <p className="text-sm text-blue-800 font-medium">
                        {getText('Please select a record from the dropdown above to enable the submit button', 'Silakan pilih data dari dropdown di atas untuk mengaktifkan tombol submit')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-2xl p-6">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <ExternalLink className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        {getText('What happens next?', 'Apa yang terjadi selanjutnya?')}
                      </h3>
                      <ul className="space-y-2 text-sm text-blue-800">
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>{getText('Your record will be marked as completed', 'Data Anda akan ditandai sebagai selesai')}</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>{getText('Equipment will be checked and returned to inventory', 'Peralatan akan diperiksa dan dikembalikan ke inventaris')}</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>{getText('Any reported issues will be forwarded to the maintenance team', 'Masalah yang dilaporkan akan diteruskan ke tim pemeliharaan')}</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>{getText("You'll receive a confirmation notification", 'Anda akan menerima notifikasi konfirmasi')}</span>
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
    </div>
  );
};

export default CheckOut;