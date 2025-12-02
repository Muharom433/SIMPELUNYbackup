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
  Shield,
  Phone,
  Mail,
  CreditCard,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// ===== SCHEMA =====
const checkoutSchema = z.object({
  record_id: z.string().min(1, 'Pilih data untuk di-checkout'),
  record_type: z.enum(['booking', 'lending_tool']),
  has_issues: z.boolean(),
  report_category: z.enum(['equipment', 'room_condition', 'cleanliness', 'safety', 'maintenance', 'other']).optional(),
  report_description: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

// ===== INTERFACES =====
interface Equipment {
  id: string;
  name: string;
  code?: string;
  category?: string;
  quantity: number;
  unit?: string;
  is_mandatory: boolean;
}

interface BookingWithDetails {
  id: string;
  user_id?: string;
  room_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  sks?: number;
  class_type?: string;
  status: string;
  equipment_requested: string[];
  equipment_quantities: number[];
  equipment_back?: string[];
  quantities_back?: number[];
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
    phone_number?: string;
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
    phone_number?: string;
  };
  equipment_details?: Array<{
    id: string;
    name: string;
    code: string;
    category: string;
    unit?: string;
    borrowed_quantity: number;
  }>;
  record_type: 'lending_tool';
}

type CombinedRecord = BookingWithDetails | LendingToolWithDetails;

// ===== MAIN COMPONENT =====
const CheckOut: React.FC = () => {
  const [allRecords, setAllRecords] = useState<CombinedRecord[]>([]);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
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

  // ===== EFFECTS =====
  useEffect(() => {
    fetchAllRecords();
    fetchAllEquipment();
  }, []);

  useEffect(() => {
    if (watchRecordId) {
      const record = allRecords.find(r => r.id === watchRecordId);
      setSelectedRecord(record || null);
      if (record) {
        form.setValue('record_type', record.record_type);
      }
    } else {
      setSelectedRecord(null);
    }
  }, [watchRecordId, allRecords, form]);

  useEffect(() => {
    setShowReportForm(watchHasIssues);
    if (!watchHasIssues) {
      form.setValue('report_category', 'equipment');
      form.setValue('report_description', '');
      setAttachments([]);
    }
  }, [watchHasIssues, form]);

  // ===== FETCH EQUIPMENT =====
  const fetchAllEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, code, category, quantity, unit, is_mandatory')
        .order('name');
      
      if (error) throw error;
      setAllEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast.error('Gagal memuat data peralatan');
    }
  };

  // ===== FETCH RECORDS =====
  const fetchAllRecords = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Fetching records for checkout...');
      
      // Get existing checkouts to exclude
      const { data: existingCheckouts, error: checkoutsError } = await supabase
        .from('checkouts')
        .select('booking_id, lendingTool_id')
        .eq('status', 'returned'); // Hanya ambil yang sudah returned

      if (checkoutsError) {
        console.error('Error fetching checkouts:', checkoutsError);
        throw checkoutsError;
      }

      const checkedOutBookingIds = existingCheckouts?.filter(c => c.booking_id).map(c => c.booking_id) || [];
      const checkedOutLendingIds = existingCheckouts?.filter(c => c.lendingTool_id).map(c => c.lendingTool_id) || [];

      console.log('✅ Already checked out:', {
        bookings: checkedOutBookingIds.length,
        lendings: checkedOutLendingIds.length
      });

      // ===== FETCH BOOKINGS =====
      // Ambil bookings dengan status 'borrowed' yang BELUM di-checkout
      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          *,
          user:users!bookings_user_id_fkey(id, full_name, identity_number, email, phone_number),
          room:rooms!bookings_room_id_fkey(id, name, code, capacity, department:departments(name))
        `)
        .eq('status', 'borrowed')
        .order('created_at', { ascending: false });

      if (checkedOutBookingIds.length > 0) {
        bookingsQuery = bookingsQuery.not('id', 'in', `(${checkedOutBookingIds.join(',')})`);
      }

      const { data: bookingsData, error: bookingsError } = await bookingsQuery;
      
      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      const bookingsWithDetails: BookingWithDetails[] = (bookingsData || []).map(booking => ({
        ...booking,
        record_type: 'booking' as const
      }));

      // ===== FETCH LENDING TOOLS =====
      // Ambil lending tools dengan status 'borrow' yang BELUM di-checkout
      let lendingQuery = supabase
        .from('lending_tool')
        .select(`
          *,
          user:users!lending_tool_id_user_fkey(id, full_name, identity_number, email, phone_number)
        `)
        .eq('status', 'borrow')
        .order('created_at', { ascending: false });

      if (checkedOutLendingIds.length > 0) {
        lendingQuery = lendingQuery.not('id', 'in', `(${checkedOutLendingIds.join(',')})`);
      }

      const { data: lendingData, error: lendingError } = await lendingQuery;
      
      if (lendingError) {
        console.error('Error fetching lending tools:', lendingError);
        throw lendingError;
      }

      // Enrich lending tools with equipment details
      const lendingWithDetails: LendingToolWithDetails[] = await Promise.all(
        (lendingData || []).map(async (lending) => {
          let equipment_details: any[] = [];
          
          if (lending.id_equipment && Array.isArray(lending.id_equipment)) {
            const { data: equipmentData } = await supabase
              .from('equipment')
              .select('id, name, code, category, unit, quantity')
              .in('id', lending.id_equipment);
            
            if (equipmentData) {
              equipment_details = equipmentData.map((eq, index) => ({
                ...eq,
                borrowed_quantity: lending.qty[index] || 1
              }));
            }
          }

          return {
            ...lending,
            equipment_details,
            record_type: 'lending_tool' as const
          };
        })
      );

      const combinedRecords = [...bookingsWithDetails, ...lendingWithDetails];
      console.log(`✅ Total records available: ${combinedRecords.length}`);
      setAllRecords(combinedRecords);

    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Gagal memuat data peminjaman');
    } finally {
      setLoading(false);
    }
  };

  // ===== HANDLE RECORD SELECT =====
  const handleRecordSelect = (record: CombinedRecord, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    form.setValue('record_id', record.id);
    form.setValue('record_type', record.record_type);
    setSelectedRecord(record);
    setSearchTerm(getDisplayName(record));
    setShowRecordDropdown(false);
    form.clearErrors('record_id');
  };

  // ===== HANDLE IMAGE UPLOAD =====
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        const newAttachments = [...attachments, base64String];
        setAttachments(newAttachments);
        form.setValue('attachments', newAttachments);
        toast.success('Gambar berhasil diunggah');
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Gagal mengunggah gambar');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
    form.setValue('attachments', newAttachments);
  };

  // ===== HANDLE SUBMIT =====
  const handleSubmit = async (data: CheckoutForm) => {
    try {
      setLoading(true);

      if (!selectedRecord) {
        toast.error('Pilih data untuk di-checkout');
        return;
      }

      console.log('📦 Processing checkout for:', selectedRecord.id, selectedRecord.record_type);

      // ===== BUILD CHECKOUT DATA =====
      const checkoutData: any = {
        checkout_date: new Date().toISOString(),
        actual_return_date: new Date().toISOString(),
        status: 'returned', // ✅ Status hanya bisa 'returned' atau 'active'
        condition_on_checkout: 'good',
        condition_on_return: 'good', // ✅ HARUS 'good' atau sesuai constraint di database
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // ===== SET SPECIFIC FIELDS BASED ON RECORD TYPE =====
      if (selectedRecord.record_type === 'booking') {
        const booking = selectedRecord as BookingWithDetails;
        
        checkoutData.user_id = booking.user_id || booking.user?.id;
        checkoutData.booking_id = booking.id;
        checkoutData.room_id = booking.room_id;
        checkoutData.expected_return_date = booking.end_time;
        checkoutData.total_items = booking.equipment_requested?.length || 0;
        checkoutData.type = 'room';
        checkoutData.checkout_notes = `Pengembalian ruangan ${booking.room?.name}. Equipment: ${booking.equipment_requested?.length || 0} jenis.`;

      } else {
        const lending = selectedRecord as LendingToolWithDetails;
        
        checkoutData.user_id = lending.id_user || lending.user?.id;
        checkoutData.lendingTool_id = lending.id;
        checkoutData.expected_return_date = lending.date;
        checkoutData.total_items = lending.equipment_details?.length || 0;
        checkoutData.type = 'things';
        checkoutData.checkout_notes = `Pengembalian peralatan. ${lending.equipment_details?.length || 0} jenis peralatan.`;
      }

      console.log('📝 Checkout data:', checkoutData);

      // ===== INSERT CHECKOUT RECORD =====
      const { data: checkoutResult, error: checkoutError } = await supabase
        .from('checkouts')
        .insert(checkoutData)
        .select()
        .single();

      if (checkoutError) {
        console.error('❌ Error creating checkout:', checkoutError);
        throw checkoutError;
      }

      console.log('✅ Checkout created:', checkoutResult.id);

      // ===== UPDATE ORIGINAL RECORD STATUS =====
      if (selectedRecord.record_type === 'booking') {
        // Update booking status
        const { error: updateBookingError } = await supabase
          .from('bookings')
          .update({ 
            status: 'returned',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRecord.id);

        if (updateBookingError) {
          console.error('Error updating booking status:', updateBookingError);
        } else {
          console.log('✅ Booking status updated to "returned"');
        }

      } else {
        // Update lending tool status
        const { error: updateLendingError } = await supabase
          .from('lending_tool')
          .update({ 
            status: 'returned',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRecord.id);

        if (updateLendingError) {
          console.error('Error updating lending tool status:', updateLendingError);
        } else {
          console.log('✅ Lending tool status updated to "returned"');
        }
      }

      // ===== HANDLE CHECKOUT ITEMS =====
      if (selectedRecord.record_type === 'booking') {
        const booking = selectedRecord as BookingWithDetails;
        
        if (booking.equipment_requested && booking.equipment_requested.length > 0) {
          // Calculate total quantities
          const equipmentMap = new Map<string, number>();
          booking.equipment_requested.forEach((eqId, index) => {
            const existingQty = equipmentMap.get(eqId) || 0;
            equipmentMap.set(eqId, existingQty + (booking.equipment_quantities[index] || 1));
          });

          // Check if there are previously returned items
          const previouslyReturnedMap = new Map<string, number>();
          if (booking.equipment_back && booking.quantities_back) {
            booking.equipment_back.forEach((eqId, index) => {
              const existingQty = previouslyReturnedMap.get(eqId) || 0;
              previouslyReturnedMap.set(eqId, existingQty + (booking.quantities_back[index] || 0));
            });
          }

          // Create checkout items
          const checkoutItems: any[] = [];
          equipmentMap.forEach((borrowedQty, eqId) => {
            const previouslyReturned = previouslyReturnedMap.get(eqId) || 0;
            const remainingToReturn = Math.max(0, borrowedQty - previouslyReturned);
            
            if (remainingToReturn > 0) {
              checkoutItems.push({
                checkout_id: checkoutResult.id,
                equipment_id: eqId,
                quantity: remainingToReturn,
                condition_notes: null,
                created_at: new Date().toISOString()
              });
            }
          });

          if (checkoutItems.length > 0) {
            const { error: itemsError } = await supabase
              .from('checkout_items')
              .insert(checkoutItems);

            if (itemsError) {
              console.error('Error creating checkout items:', itemsError);
            } else {
              console.log(`✅ Created ${checkoutItems.length} checkout items`);
            }
          }
        }
      } else {
        const lending = selectedRecord as LendingToolWithDetails;
        
        if (lending.id_equipment && lending.id_equipment.length > 0) {
          const checkoutItems = lending.id_equipment.map((eqId, index) => ({
            checkout_id: checkoutResult.id,
            equipment_id: eqId,
            quantity: lending.qty[index] || 1,
            condition_notes: null,
            created_at: new Date().toISOString()
          }));

          const { error: itemsError } = await supabase
            .from('checkout_items')
            .insert(checkoutItems);

          if (itemsError) {
            console.error('Error creating checkout items:', itemsError);
          } else {
            console.log(`✅ Created ${checkoutItems.length} checkout items`);
          }
        }
      }

      // ===== CREATE ISSUE REPORT IF NEEDED =====
      if (data.has_issues && data.report_description) {
        console.log('📄 Creating issue report...');
        
        const reportData = {
          reporter_id: selectedRecord.record_type === 'lending_tool' 
            ? (selectedRecord as LendingToolWithDetails).id_user 
            : (selectedRecord as BookingWithDetails).user_id,
          reporter_name: selectedRecord.user?.full_name || 'Pengguna Tidak Dikenal',
          reporter_email: selectedRecord.user?.email || 'unknown@email.com',
          reporter_phone: selectedRecord.user?.phone_number || null,
          is_anonymous: false,
          category: data.report_category,
          priority: 'medium',
          title: `Laporan ${getCategoryText(data.report_category || 'other')} - ${format(new Date(), 'dd/MM/yyyy')}`,
          description: data.report_description,
          location: selectedRecord.record_type === 'booking' 
            ? (selectedRecord as BookingWithDetails).room?.name 
            : 'Area Equipment',
          room_id: selectedRecord.record_type === 'booking' 
            ? (selectedRecord as BookingWithDetails).room_id 
            : null,
          status: 'new',
          attachments: attachments,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: reportError } = await supabase
          .from('reports')
          .insert(reportData);

        if (reportError) {
          console.error('Error creating report:', reportError);
          toast.error('Pengembalian berhasil tapi gagal membuat laporan');
        } else {
          toast.success('Pengembalian dan laporan berhasil dikirim!');
        }
      } else {
        toast.success('Pengembalian berhasil dikirim!');
      }

      // ===== RESET FORM =====
      form.reset({
        record_id: '',
        has_issues: false,
        report_category: 'equipment',
        attachments: [],
      });
      setSelectedRecord(null);
      setAttachments([]);
      setSearchTerm('');
      
      // Refresh data
      await fetchAllRecords();

    } catch (error: any) {
      console.error('❌ Error processing checkout:', error);
      
      // Detailed error handling
      if (error.code === '23514') {
        toast.error('Error: Nilai kondisi pengembalian tidak valid. Coba ubah condition_on_return ke "good"');
      } else if (error.code === '23505') {
        toast.error('Data ini sudah pernah di-checkout sebelumnya');
      } else {
        toast.error(error.message || 'Gagal memproses pengembalian');
      }
    } finally {
      setLoading(false);
    }
  };

  // ===== UTILITY FUNCTIONS =====
  const getCategoryText = (category: string) => {
    const categories: Record<string, string> = {
      'equipment': 'Masalah Peralatan',
      'room_condition': 'Kondisi Ruangan',
      'cleanliness': 'Kebersihan',
      'safety': 'Keamanan',
      'maintenance': 'Pemeliharaan',
      'other': 'Lainnya'
    };
    return categories[category] || category;
  };

  const getDisplayName = (record: CombinedRecord) => {
    if (record.record_type === 'booking') {
      const booking = record as BookingWithDetails;
      const userName = booking.user?.full_name || booking.user_info?.full_name || 'Pengguna Tidak Dikenal';
      const roomName = booking.room?.name || 'Ruangan Tidak Dikenal';
      return `${userName} - ${roomName}`;
    } else {
      const lending = record as LendingToolWithDetails;
      const userName = lending.user?.full_name || 'Pengguna Tidak Dikenal';
      const equipmentCount = lending.equipment_details?.length || 0;
      return `${userName} - ${equipmentCount} Peralatan`;
    }
  };

  const filteredRecords = allRecords.filter(record => {
    const searchLower = searchTerm.toLowerCase();
    
    if (record.record_type === 'booking') {
      const booking = record as BookingWithDetails;
      return (
        booking.user?.full_name?.toLowerCase().includes(searchLower) ||
        booking.user?.identity_number?.toLowerCase().includes(searchLower) ||
        booking.user_info?.full_name?.toLowerCase().includes(searchLower) ||
        booking.user_info?.identity_number?.toLowerCase().includes(searchLower) ||
        booking.purpose?.toLowerCase().includes(searchLower) ||
        booking.room?.name?.toLowerCase().includes(searchLower) ||
        booking.room?.code?.toLowerCase().includes(searchLower)
      );
    } else {
      const lending = record as LendingToolWithDetails;
      return (
        lending.user?.full_name?.toLowerCase().includes(searchLower) ||
        lending.user?.identity_number?.toLowerCase().includes(searchLower) ||
        lending.equipment_details?.some(eq => 
          eq.name.toLowerCase().includes(searchLower) || 
          eq.code.toLowerCase().includes(searchLower)
        )
      );
    }
  });

  const isSubmitEnabled = selectedRecord && watchRecordId && !loading;

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 relative">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Pengembalian & Check Out
                </h1>
                <p className="text-gray-600 mt-1">
                  Selesaikan pengembalian ruangan dan peralatan yang dipinjam
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{allRecords.length}</div>
                <div className="text-sm text-gray-500">Data Aktif</div>
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
                <h2 className="text-xl font-bold text-gray-800">Cari Data Anda</h2>
              </div>
              
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, NIM, ruangan..."
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
                  onBlur={() => setTimeout(() => setShowRecordDropdown(false), 200)}
                  className="w-full pl-12 pr-10 py-4 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowRecordDropdown(!showRecordDropdown)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2"
                >
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showRecordDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showRecordDropdown && (
                  <div 
                    className="absolute z-60 w-full mt-2 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-2xl max-h-96 overflow-y-auto"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
                        <span className="text-gray-600 font-medium">Memuat data...</span>
                      </div>
                    ) : filteredRecords.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">
                          {allRecords.length === 0 
                            ? 'Tidak ada data peminjaman aktif'
                            : 'Tidak ada data yang cocok'
                          }
                        </p>
                        <button
                          onClick={fetchAllRecords}
                          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <RefreshCw className="h-4 w-4 inline mr-2" />
                          Refresh Data
                        </button>
                      </div>
                    ) : (
                      <div className="p-2">
                        {filteredRecords.map((record) => (
                          <button
                            key={record.id}
                            type="button"
                            onClick={(e) => handleRecordSelect(record, e)}
                            className="w-full text-left p-4 hover:bg-emerald-50 cursor-pointer rounded-xl border border-transparent hover:border-emerald-200 transition-all mb-2 last:mb-0"
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
                                   'Pengguna Tidak Dikenal'}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  {record.user?.identity_number || 
                                   (record.record_type === 'booking' ? (record as BookingWithDetails).user_info?.identity_number : '') || 
                                   'No ID'}
                                </div>
                                
                                <div className="space-y-1">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    record.record_type === 'booking' 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {record.record_type === 'booking' ? 'Peminjaman Ruangan' : 'Peminjaman Peralatan'}
                                  </span>
                                  
                                  {record.record_type === 'booking' ? (
                                    <>
                                      <div className="flex items-center text-xs text-gray-500">
                                        <Building className="h-3 w-3 mr-1" />
                                        <span className="truncate">{(record as BookingWithDetails).room?.name || 'Ruangan Tidak Dikenal'}</span>
                                      </div>
                                      <div className="flex items-center text-xs text-gray-500">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        <span>{format(new Date((record as BookingWithDetails).start_time), 'dd MMM')}</span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center text-xs text-gray-500">
                                      <Wrench className="h-3 w-3 mr-1" />
                                      <span>{(record as LendingToolWithDetails).equipment_details?.length || 0} jenis peralatan</span>
                                    </div>
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

            {/* Quick Stats */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistik</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Data Aktif</span>
                  <span className="font-bold text-emerald-600">{allRecords.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Booking Ruangan</span>
                  <span className="font-bold text-emerald-600">
                    {allRecords.filter(r => r.record_type === 'booking').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Peminjaman Alat</span>
                  <span className="font-bold text-purple-600">
                    {allRecords.filter(r => r.record_type === 'lending_tool').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Checkout Form */}
          <div className="lg:col-span-2 relative z-10">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center space-x-3 mb-8">
                <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Proses Pengembalian</h2>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                {/* Selected Record Details */}
                {selectedRecord && (
                  <div className={`border rounded-2xl p-6 ${
                    selectedRecord.record_type === 'booking' 
                      ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200/50' 
                      : 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200/50'
                  }`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        {selectedRecord.record_type === 'booking' ? (
                          <Building className="h-6 w-6 text-emerald-600" />
                        ) : (
                          <Wrench className="h-6 w-6 text-purple-600" />
                        )}
                        <h3 className={`text-xl font-bold ${
                          selectedRecord.record_type === 'booking' ? 'text-emerald-900' : 'text-purple-900'
                        }`}>
                          {selectedRecord.record_type === 'booking' 
                            ? 'Detail Peminjaman Ruangan'
                            : 'Detail Peminjaman Peralatan'
                          }
                        </h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedRecord.record_type === 'booking' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {selectedRecord.record_type === 'booking' ? 'Status: Borrowed' : 'Status: Borrow'}
                      </span>
                    </div>
                    
                    {/* User & Time Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-4">
                        <div>
                          <span className={`text-sm font-semibold uppercase tracking-wide ${
                            selectedRecord.record_type === 'booking' ? 'text-emerald-700' : 'text-purple-700'
                          }`}>
                            Informasi Peminjam
                          </span>
                          <div className="mt-2 p-3 bg-white/60 rounded-lg border border-gray-200/50">
                            <div className={`font-bold mb-1 ${
                              selectedRecord.record_type === 'booking' ? 'text-emerald-900' : 'text-purple-900'
                            }`}>
                              {selectedRecord.user?.full_name || 
                               (selectedRecord.record_type === 'booking' ? (selectedRecord as BookingWithDetails).user_info?.full_name : '') || 
                               'Pengguna Tidak Dikenal'}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              <CreditCard className="h-3 w-3 inline mr-1" />
                              {selectedRecord.user?.identity_number || 
                               (selectedRecord.record_type === 'booking' ? (selectedRecord as BookingWithDetails).user_info?.identity_number : '') || 
                               'No ID'}
                            </div>
                            <div className="text-sm text-gray-600">
                              <Mail className="h-3 w-3 inline mr-1" />
                              {selectedRecord.user?.email || 'No Email'}
                            </div>
                            {selectedRecord.user?.phone_number && (
                              <div className="text-sm text-gray-600 mt-1">
                                <Phone className="h-3 w-3 inline mr-1" />
                                {selectedRecord.user.phone_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {selectedRecord.record_type === 'booking' ? (
                          <>
                            <div>
                              <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
                                Detail Ruangan
                              </span>
                              <div className="mt-2 p-3 bg-white/60 rounded-lg border border-gray-200/50">
                                <div className="font-bold text-emerald-900 mb-1">
                                  {(selectedRecord as BookingWithDetails).room?.name || 'Ruangan Tidak Dikenal'}
                                </div>
                                <div className="text-sm text-emerald-700 mb-1">
                                  <span className="font-medium">Kode:</span> {(selectedRecord as BookingWithDetails).room?.code || 'N/A'}
                                </div>
                                <div className="text-sm text-emerald-700">
                                  <span className="font-medium">Kapasitas:</span> {(selectedRecord as BookingWithDetails).room?.capacity || 'N/A'} orang
                                </div>
                              </div>
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
                                Waktu Peminjaman
                              </span>
                              <div className="mt-2 p-3 bg-white/60 rounded-lg border border-gray-200/50">
                                <div className="text-sm text-emerald-700">
                                  <Calendar className="h-3 w-3 inline mr-1" />
                                  {format(new Date((selectedRecord as BookingWithDetails).start_time), 'dd MMM yyyy')}
                                </div>
                                <div className="text-sm text-emerald-700 mt-1">
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {format(new Date((selectedRecord as BookingWithDetails).start_time), 'HH:mm')} - 
                                  {format(new Date((selectedRecord as BookingWithDetails).end_time), 'HH:mm')}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div>
                            <span className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
                              Tanggal Pinjam
                            </span>
                            <div className="mt-2 p-3 bg-white/60 rounded-lg border border-gray-200/50">
                              <div className="font-bold text-purple-900">
                                {format(new Date((selectedRecord as LendingToolWithDetails).date), 'dd MMM yyyy')}
                              </div>
                              <div className="text-sm text-purple-700 mt-1">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                Tanggal pengembalian yang dijadwalkan
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Equipment List */}
                    {selectedRecord.record_type === 'booking' ? (
                      // Booking Equipment Display
                      (selectedRecord as BookingWithDetails).equipment_requested && 
                      (selectedRecord as BookingWithDetails).equipment_requested.length > 0 ? (
                        <div className="mt-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
                              Peralatan yang Dipinjam
                            </span>
                            <span className="text-sm text-emerald-600">
                              {(selectedRecord as BookingWithDetails).equipment_requested.length} jenis
                            </span>
                          </div>
                          
                          <div className="space-y-3">
                            {(selectedRecord as BookingWithDetails).equipment_requested.map((equipmentId, index) => {
                              const requestedQuantity = (selectedRecord as BookingWithDetails).equipment_quantities?.[index] || 1;
                              const equipment = allEquipment.find(eq => eq.id === equipmentId);
                              
                              return (
                                <div key={`${equipmentId}-${index}`} className="flex items-center justify-between p-4 bg-white/60 rounded-xl border border-emerald-200/50">
                                  <div className="flex items-center">
                                    <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                                      <Zap className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-emerald-900">{equipment?.name || `Equipment ${equipmentId.slice(0, 8)}`}</div>
                                      <div className="text-xs text-emerald-700">{equipment?.code || 'N/A'}</div>
                                      {equipment?.is_mandatory && (
                                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded mt-1">Wajib</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-emerald-900 text-xl">{requestedQuantity}</div>
                                    <div className="text-xs text-emerald-600">{equipment?.unit || 'pcs'}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex items-center text-gray-500">
                            <Package className="h-5 w-5 mr-2" />
                            <span className="text-sm">Tidak ada peralatan yang dipinjam</span>
                          </div>
                        </div>
                      )
                    ) : (
                      // Lending Tool Equipment Display
                      (selectedRecord as LendingToolWithDetails).equipment_details && 
                      (selectedRecord as LendingToolWithDetails).equipment_details!.length > 0 ? (
                        <div className="mt-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
                              Peralatan yang Dipinjam
                            </span>
                            <span className="text-sm text-purple-600">
                              {(selectedRecord as LendingToolWithDetails).equipment_details!.length} jenis
                            </span>
                          </div>
                          <div className="space-y-3">
                            {(selectedRecord as LendingToolWithDetails).equipment_details!.map((equipment, index) => {
                              const borrowedQuantity = (selectedRecord as LendingToolWithDetails).qty?.[index] || 1;

                              return (
                                <div key={`${equipment.id}-${index}`} className="flex items-center justify-between p-4 bg-white/60 rounded-xl border border-purple-200/50">
                                  <div className="flex items-center">
                                    <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                                      <Wrench className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-purple-900">{equipment.name}</div>
                                      <div className="text-xs text-purple-700">{equipment.code}</div>
                                      <div className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded mt-1">
                                        {equipment.category}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-purple-900 text-xl">{borrowedQuantity}</div>
                                    <div className="text-xs text-purple-600">{equipment.unit || 'pcs'}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex items-center text-gray-500">
                            <Wrench className="h-5 w-5 mr-2" />
                            <span className="text-sm">Detail peralatan tidak tersedia</span>
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
                        className="h-5 w-5 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded mt-1"
                      />
                      <div className="flex-1">
                        <label className="text-lg font-semibold text-yellow-900 cursor-pointer">
                          Laporkan masalah atau kendala
                        </label>
                        <p className="mt-2 text-sm text-yellow-700">
                          Centang ini jika Anda mengalami masalah dengan peralatan, kondisi ruangan, atau fasilitas.
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
                      <h3 className="text-xl font-bold text-orange-900">Detail Laporan Masalah</h3>
                    </div>

                    {/* Issue Category */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Kategori Masalah *
                      </label>
                      <select
                        {...form.register('report_category')}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50"
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
                        Deskripsi Masalah *
                      </label>
                      <textarea
                        {...form.register('report_description')}
                        rows={4}
                        placeholder="Jelaskan masalah secara detail..."
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>

                    {/* Photo Upload */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Lampirkan Foto (Opsional)
                      </label>
                      <div className="space-y-4">
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300/50 border-dashed rounded-xl cursor-pointer bg-gradient-to-b from-gray-50/50 to-white/50 hover:from-gray-100/50">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {uploadingImage ? (
                                <RefreshCw className="h-10 w-10 text-gray-400 animate-spin mb-3" />
                              ) : (
                                <>
                                  <Camera className="h-10 w-10 text-gray-400 mb-3" />
                                  <p className="text-sm text-gray-600 font-semibold">Klik untuk unggah</p>
                                  <p className="text-xs text-gray-500">PNG, JPG (max 5MB)</p>
                                </>
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

                        {attachments.length > 0 && (
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
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <X className="h-3 w-3" />
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
                <div className="flex space-x-4 pt-8 border-t border-gray-200/50">
                  <button
                    type="submit"
                    disabled={!isSubmitEnabled}
                    className={`flex-1 flex items-center justify-center space-x-3 px-8 py-4 font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-lg ${
                      isSubmitEnabled
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl cursor-pointer'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>Selesaikan Pengembalian</span>
                      </>
                    )}
                  </button>
                </div>

                {!selectedRecord && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <p className="text-sm text-blue-800 font-medium">
                        Pilih data peminjaman dari dropdown untuk melanjutkan pengembalian
                      </p>
                    </div>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-2xl p-6">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <ExternalLink className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        Proses Pengembalian
                      </h3>
                      <ul className="space-y-2 text-sm text-blue-800 mb-4">
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                          <span>Status peminjaman akan berubah menjadi "returned"</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                          <span>Data checkout akan dicatat untuk pelacakan</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                          <span>Masalah yang dilaporkan akan ditindaklanjuti</span>
                        </li>
                      </ul>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                        <p className="text-sm text-yellow-800">
                          <strong>Catatan:</strong> Pastikan semua peralatan dalam kondisi baik sebelum melakukan pengembalian.
                        </p>
                      </div>
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