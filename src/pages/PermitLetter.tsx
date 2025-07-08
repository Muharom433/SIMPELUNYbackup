import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileText,
  Search,
  Upload,
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
  Check,
  ExternalLink,
  Wrench,
  Package,
  AlertCircle,
  Download,
  Eye,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { alert } from '../components/Alert/AlertHelper';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

const permitSchema = z.object({
  selected_bookings: z.array(z.string()).optional(),
  selected_lendings: z.array(z.string()).optional(),
  attachments: z.array(z.string()).min(1, 'Please upload at least one permit document'),
}).refine((data) => {
  return (data.selected_bookings && data.selected_bookings.length > 0) || 
         (data.selected_lendings && data.selected_lendings.length > 0);
}, {
  message: "Please select at least one booking or lending record",
  path: ["selected_records"]
});

type PermitForm = z.infer<typeof permitSchema>;

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
  attachments?: string[];
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
  attachments?: string[];
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

const PermitLetter: React.FC = () => {
  const { getText } = useLanguage();
  const [allRecords, setAllRecords] = useState<CombinedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecordDropdown, setShowRecordDropdown] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<CombinedRecord[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'booking' | 'lending_tool'>('all');

  const form = useForm<PermitForm>({
    resolver: zodResolver(permitSchema),
    defaultValues: {
      selected_bookings: [],
      selected_lendings: [],
      attachments: [],
    },
  });

  useEffect(() => {
    fetchAllRecords();
  }, []);

  useEffect(() => {
    // Update form values when selected records change
    const bookings = selectedRecords.filter(r => r.record_type === 'booking').map(r => r.id);
    const lendings = selectedRecords.filter(r => r.record_type === 'lending_tool').map(r => r.id);
    
    form.setValue('selected_bookings', bookings);
    form.setValue('selected_lendings', lendings);
    
    // Clear validation errors
    if (selectedRecords.length > 0) {
      form.clearErrors('selected_records');
    }
  }, [selectedRecords, form]);

  const fetchAllRecords = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching approved bookings and borrowing tools...');
      
      // Fetch approved bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'pending')
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
        .or('attachments.is.null,attachments.eq.{}') // 🔥 NULL atau empty array
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
      alert.error(getText('Failed to load records', 'Gagal memuat data'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecordToggle = (record: CombinedRecord) => {
    const isSelected = selectedRecords.some(r => r.id === record.id);
    
    if (isSelected) {
      setSelectedRecords(prev => prev.filter(r => r.id !== record.id));
    } else {
      setSelectedRecords(prev => [...prev, record]);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (images and PDFs)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert.error(getText('Please select an image file (JPG, PNG) or PDF document', 'Silakan pilih file gambar (JPG, PNG) atau dokumen PDF'));
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert.error(getText('File size must be less than 10MB', 'Ukuran file harus kurang dari 10MB'));
      return;
    }

    try {
      setUploadingFile(true);
      
      // For demo purposes, we'll convert to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        const newAttachments = [...attachments, base64String];
        setAttachments(newAttachments);
        form.setValue('attachments', newAttachments);
        alert.success(getText('File uploaded successfully', 'File berhasil diunggah'));
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      alert.error(getText('Failed to upload file', 'Gagal mengunggah file'));
    } finally {
      setUploadingFile(false);
    }
  };

  const capturePhoto = async () => {
    try {
      // Request camera permission and capture photo
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Create video element to capture frame
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // Wait for video to load
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });
      
      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      // Convert to base64
      const base64String = canvas.toDataURL('image/jpeg', 0.8);
      const newAttachments = [...attachments, base64String];
      setAttachments(newAttachments);
      form.setValue('attachments', newAttachments);
      
      // Stop camera stream
      stream.getTracks().forEach(track => track.stop());
      
      alert.success(getText('Photo captured successfully', 'Foto berhasil diambil'));
      
    } catch (error) {
      console.error('Error capturing photo:', error);
      alert.error(getText('Failed to capture photo. Please check camera permissions.', 'Gagal mengambil foto. Silakan periksa izin kamera.'));
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
    form.setValue('attachments', newAttachments);
  };

  const handleSubmit = async (data: PermitForm) => {
    try {
      setLoading(true);

      if (selectedRecords.length === 0) {
        alert.error(getText('Please select at least one record', 'Silakan pilih setidaknya satu data'));
        return;
      }

      if (attachments.length === 0) {
        alert.error(getText('Please upload at least one permit document', 'Silakan unggah setidaknya satu dokumen izin'));
        return;
      }

      console.log('Processing permit letter submission...');

      // Update selected bookings with attachments
      if (data.selected_bookings && data.selected_bookings.length > 0) {
        for (const bookingId of data.selected_bookings) {
          const { error } = await supabase
            .from('bookings')
            .update({ 
              attachments: attachments,
              updated_at: new Date().toISOString()
            })
            .eq('id', bookingId);

          if (error) {
            console.error('Error updating booking:', error);
            throw error;
          }
        }
        console.log(`Updated ${data.selected_bookings.length} booking(s) with permit attachments`);
      }

      // Update selected lending tools with attachments
      if (data.selected_lendings && data.selected_lendings.length > 0) {
        for (const lendingId of data.selected_lendings) {
          const { error } = await supabase
            .from('lending_tool')
            .update({ 
              attachments: attachments,
              updated_at: new Date().toISOString()
            })
            .eq('id', lendingId);

          if (error) {
            console.error('Error updating lending tool:', error);
            throw error;
          }
        }
        console.log(`Updated ${data.selected_lendings.length} lending tool(s) with permit attachments`);
      }

      alert.success(getText('Permit letter submitted successfully!', 'Surat izin berhasil dikirim!'));

      // Reset form and refresh data
      form.reset({
        selected_bookings: [],
        selected_lendings: [],
        attachments: [],
      });
      setSelectedRecords([]);
      setAttachments([]);
      setSearchTerm('');
      
      // Refresh the records list
      await fetchAllRecords();

    } catch (error: any) {
      console.error('Error submitting permit letter:', error);
      alert.error(error.message || getText('Failed to submit permit letter', 'Gagal mengirim surat izin'));
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = allRecords.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    
    // Filter by type
    if (filterType !== 'all' && record.record_type !== filterType) {
      return false;
    }
    
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

  const getFileTypeIcon = (attachment: string) => {
    if (attachment.startsWith('data:application/pdf')) {
      return <FileText className="h-4 w-4 text-red-600" />;
    } else {
      return <Camera className="h-4 w-4 text-amber-600" />;
    }
  };

  const getFileName = (attachment: string, index: number) => {
    if (attachment.startsWith('data:application/pdf')) {
      return `Document_${index + 1}.pdf`;
    } else {
      return `Image_${index + 1}.jpg`;
    }
  };

  // Check if submit button should be enabled
  const isSubmitEnabled = selectedRecords.length > 0 && attachments.length > 0 && !loading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50 relative">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl shadow-lg">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  {getText('Permit Letter', 'Surat Izin')}
                </h1>
                <p className="text-gray-600 mt-1">
                  {getText('Submit permit documents for your bookings and tool lending', 'Kirim dokumen izin untuk pemesanan dan peminjaman alat Anda')}
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{allRecords.length}</div>
                <div className="text-sm text-gray-500">
                  {getText('Available Records', 'Data Tersedia')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Record Search & Selection */}
          <div className="lg:col-span-1 space-y-6 relative z-20">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 relative">
              <div className="flex items-center space-x-3 mb-6">
                <Search className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-bold text-gray-800">
                  {getText('Select Records', 'Pilih Data')}
                </h2>
              </div>
              
              {/* Filter Type */}
              <div className="mb-4">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all duration-200"
                >
                  <option value="all">{getText('All Records', 'Semua Data')}</option>
                  <option value="booking">{getText('Room Bookings', 'Pemesanan Ruangan')}</option>
                  <option value="lending_tool">{getText('Tool Lending', 'Peminjaman Alat')}</option>
                </select>
              </div>
              
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                <input
                  type="text"
                  placeholder={getText('Search by name, ID, room, equipment...', 'Cari berdasarkan nama, ID, ruangan, peralatan...')}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowRecordDropdown(true);
                  }}
                  onFocus={() => setShowRecordDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => setShowRecordDropdown(false), 150);
                  }}
                  className="w-full pl-12 pr-4 py-4 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400 relative z-10"
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
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-amber-600 mb-3" />
                        <span className="text-gray-600 font-medium">
                          {getText('Loading records...', 'Memuat data...')}
                        </span>
                      </div>
                    ) : filteredRecords.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">
                          {allRecords.length === 0 
                            ? getText('No records available', 'Tidak ada data tersedia')
                            : getText('No records match your search', 'Tidak ada data yang cocok dengan pencarian')
                          }
                        </p>
                        <p className="text-sm text-gray-400">
                          {allRecords.length === 0 
                            ? getText('Please check if there are approved bookings or borrowed tools', 'Silakan periksa apakah ada pemesanan yang disetujui atau alat yang dipinjam')
                            : getText('Try a different search term', 'Coba kata kunci pencarian lain')
                          }
                        </p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {filteredRecords.map((record) => {
                          const isSelected = selectedRecords.some(r => r.id === record.id);
                          return (
                            <button
                              key={record.id}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRecordToggle(record);
                              }}
                              className={`w-full text-left p-4 cursor-pointer rounded-xl border transition-all duration-200 mb-2 last:mb-0 ${
                                isSelected 
                                  ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/50' 
                                  : 'hover:bg-amber-50 border-transparent hover:border-amber-200'
                              }`}
                            >
                              <div className="flex items-start space-x-3">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded mr-3"
                                  />
                                  <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    record.record_type === 'booking' 
                                      ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                                      : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                                  }`}>
                                    {record.record_type === 'booking' ? (
                                      <Building className="h-5 w-5 text-white" />
                                    ) : (
                                      <Wrench className="h-5 w-5 text-white" />
                                    )}
                                  </div>
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
                                          ? 'bg-amber-100 text-amber-800' 
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
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Selected Records Summary */}
              {selectedRecords.length > 0 && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <h3 className="text-sm font-semibold text-amber-900 mb-2">
                    {getText('Selected Records', 'Data Terpilih')} ({selectedRecords.length})
                  </h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedRecords.map((record) => (
                      <div key={record.id} className="flex items-center justify-between text-xs bg-white/60 p-2 rounded-lg">
                        <span className="truncate text-amber-900">
                          {getDisplayName(record)}
                        </span>
                        <button
                          onClick={() => handleRecordToggle(record)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {form.formState.errors.selected_records && (
                <p className="mt-2 text-sm text-red-600 font-medium">
                  {form.formState.errors.selected_records.message}
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Permit Form */}
          <div className="lg:col-span-2 relative z-10">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center space-x-3 mb-8">
                <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {getText('Upload Permit Documents', 'Unggah Dokumen Izin')}
                </h2>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                {/* Selected Records Display */}
                {selectedRecords.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-6">
                    <div className="flex items-center space-x-3 mb-6">
                      <Check className="h-6 w-6 text-amber-600" />
                      <h3 className="text-xl font-bold text-amber-900">
                        {getText('Selected Records for Permit', 'Data Terpilih untuk Izin')}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {selectedRecords.map((record) => (
                        <div key={record.id} className={`border rounded-xl p-4 ${
                          record.record_type === 'booking' 
                            ? 'bg-gradient-to-r from-amber-100 to-orange-100 border-amber-200' 
                            : 'bg-gradient-to-r from-purple-100 to-indigo-100 border-purple-200'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                record.record_type === 'booking' 
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                                  : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                              }`}>
                                {record.record_type === 'booking' ? (
                                  <Building className="h-5 w-5 text-white" />
                                ) : (
                                  <Wrench className="h-5 w-5 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-gray-900">
                                  {record.user?.full_name || 
                                   (record.record_type === 'booking' ? (record as BookingWithDetails).user_info?.full_name : '') || 
                                   getText('Unknown User', 'Pengguna Tidak Dikenal')}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {record.user?.identity_number || 
                                   (record.record_type === 'booking' ? (record as BookingWithDetails).user_info?.identity_number : '') || 
                                   getText('No ID', 'Tidak Ada ID')}
                                </div>
                                <div className="mt-2 space-y-1">
                                  {record.record_type === 'booking' ? (
                                    <>
                                      <div className="text-sm text-gray-700">
                                        <strong>{getText('Room:', 'Ruangan:')}</strong> {(record as BookingWithDetails).room?.name || getText('Unknown Room', 'Ruangan Tidak Dikenal')}
                                      </div>
                                      <div className="text-sm text-gray-700">
                                        <strong>{getText('Date:', 'Tanggal:')}</strong> {format(new Date((record as BookingWithDetails).start_time), 'MMM d, yyyy h:mm a')} - {format(new Date((record as BookingWithDetails).end_time), 'h:mm a')}
                                      </div>
                                      <div className="text-sm text-gray-700">
                                        <strong>{getText('Purpose:', 'Tujuan:')}</strong> {(record as BookingWithDetails).purpose || getText('No purpose specified', 'Tidak ada tujuan yang ditentukan')}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-sm text-gray-700">
                                        <strong>{getText('Equipment Count:', 'Jumlah Alat:')}</strong> {(record as LendingToolWithDetails).equipment_details?.length || 0} {getText('items', 'item')}
                                      </div>
                                      <div className="text-sm text-gray-700">
                                        <strong>{getText('Date:', 'Tanggal:')}</strong> {format(new Date((record as LendingToolWithDetails).date), 'MMM d, yyyy h:mm a')}
                                      </div>
                                      <div className="text-sm text-gray-700">
                                        <strong>{getText('Equipment:', 'Peralatan:')}</strong> {(record as LendingToolWithDetails).equipment_details?.map(eq => eq.name).join(', ') || getText('No equipment details', 'Tidak ada detail alat')}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRecordToggle(record)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title={getText('Remove from selection', 'Hapus dari pilihan')}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Upload Section */}
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200/50 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <FileText className="h-6 w-6 text-yellow-600" />
                    <h3 className="text-xl font-bold text-yellow-900">
                      {getText('Upload Permit Documents', 'Unggah Dokumen Izin')}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Upload Methods */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* File Upload */}
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300/50 border-dashed rounded-xl cursor-pointer bg-gradient-to-b from-gray-50/50 to-white/50 hover:from-gray-100/50 hover:to-gray-50/50 transition-all duration-200">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {uploadingFile ? (
                              <div className="flex flex-col items-center">
                                <RefreshCw className="h-10 w-10 text-gray-400 animate-spin mb-3" />
                                <p className="text-sm text-gray-500 font-medium">
                                  {getText('Uploading file...', 'Mengunggah file...')}
                                </p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <div className="p-3 bg-amber-100 rounded-full mb-3">
                                  <Upload className="h-8 w-8 text-amber-600" />
                                </div>
                                <p className="mb-2 text-sm text-gray-600 font-semibold">
                                  {getText('Upload Document', 'Unggah Dokumen')}
                                </p>
                                <p className="text-xs text-gray-500 text-center">
                                  {getText('PDF, JPG, PNG up to 10MB', 'PDF, JPG, PNG hingga 10MB')}
                                </p>
                              </div>
                            )}
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={handleFileUpload}
                            disabled={uploadingFile}
                          />
                        </label>
                      </div>

                      {/* Camera Capture */}
                      <div className="flex items-center justify-center w-full">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          disabled={uploadingFile}
                          className="flex flex-col items-center justify-center w-full h-40 border-2 border-amber-300/50 border-dashed rounded-xl bg-gradient-to-b from-amber-50/50 to-orange-50/50 hover:from-amber-100/50 hover:to-orange-100/50 transition-all duration-200 disabled:opacity-50"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <div className="p-3 bg-amber-100 rounded-full mb-3">
                              <Camera className="h-8 w-8 text-amber-600" />
                            </div>
                            <p className="mb-2 text-sm text-gray-600 font-semibold">
                              {getText('Take Photo', 'Ambil Foto')}
                            </p>
                            <p className="text-xs text-gray-500 text-center">
                              {getText('Use camera to capture document', 'Gunakan kamera untuk mengambil dokumen')}
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Uploaded Files */}
                    {attachments.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                          {getText('Uploaded Documents', 'Dokumen yang Diunggah')} ({attachments.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {attachments.map((attachment, index) => (
                            <div key={index} className="relative group border border-gray-200 rounded-xl p-3 bg-white/60">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  {attachment.startsWith('data:application/pdf') ? (
                                    <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                                      <FileText className="h-6 w-6 text-red-600" />
                                    </div>
                                  ) : (
                                    <img
                                      src={attachment}
                                      alt={`Document ${index + 1}`}
                                      className="h-12 w-12 object-cover rounded-lg"
                                    />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {getFileName(attachment, index)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {attachment.startsWith('data:application/pdf') ? 'PDF Document' : 'Image File'}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => window.open(attachment, '_blank')}
                                    className="p-1 text-blue-600 hover:text-blue-800 rounded"
                                    title={getText('View document', 'Lihat dokumen')}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(index)}
                                    className="p-1 text-red-600 hover:text-red-800 rounded"
                                    title={getText('Remove document', 'Hapus dokumen')}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {form.formState.errors.attachments && (
                      <p className="text-sm text-red-600 font-medium">
                        {form.formState.errors.attachments.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex space-x-4 pt-8 border-t border-gray-200/50">
                  <button
                    type="submit"
                    disabled={!isSubmitEnabled}
                    className={`flex-1 flex items-center justify-center space-x-3 px-8 py-4 font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 transition-all duration-200 shadow-lg ${
                      isSubmitEnabled
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 hover:shadow-xl cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>{getText('Submitting Permit...', 'Mengirim Izin...')}</span>
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5" />
                        <span>{getText('Submit Permit Letter', 'Kirim Surat Izin')}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Helper Text for Submit Button */}
                {(!isSubmitEnabled && selectedRecords.length === 0) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2">
                      <Search className="h-5 w-5 text-blue-600" />
                      <p className="text-sm text-blue-800 font-medium">
                        {getText('Please select at least one record and upload a permit document', 'Silakan pilih setidaknya satu data dan unggah dokumen izin')}
                      </p>
                    </div>
                  </div>
                )}

                {(!isSubmitEnabled && selectedRecords.length > 0 && attachments.length === 0) && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2">
                      <Upload className="h-5 w-5 text-orange-600" />
                      <p className="text-sm text-orange-800 font-medium">
                        {getText('Please upload at least one permit document to continue', 'Silakan unggah setidaknya satu dokumen izin untuk melanjutkan')}
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
                        {getText('Important Information', 'Informasi Penting')}
                      </h3>
                      <ul className="space-y-2 text-sm text-blue-800">
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>{getText('Upload official permit documents (letters, approvals, etc.)', 'Unggah dokumen izin resmi (surat, persetujuan, dll.)')}</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>{getText('Supported formats: PDF, JPG, PNG (max 10MB each)', 'Format yang didukung: PDF, JPG, PNG (maks 10MB per file)')}</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>{getText('Documents will be attached to your selected records', 'Dokumen akan dilampirkan ke data yang Anda pilih')}</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span>{getText('Admin will review your permit submission', 'Admin akan meninjau pengajuan izin Anda')}</span>
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

export default PermitLetter;