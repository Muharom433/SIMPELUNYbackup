import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  RefreshCw,
  ChevronDown,
  Zap,
  Building,
  FileText,
  Upload,
  Wrench,
  Shield,
  Phone,
  Mail,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit';

// ===== SCHEMA =====
const checkoutSchema = z.object({
  record_id: z.string().min(1, 'Pilih data untuk di-checkout'),
  record_type: z.enum(['booking', 'lending_tool']),
  has_issues: z.boolean().default(false),
  report_category: z.enum(['room', 'equipment']).optional(),
  report_description: z.string().optional(),
  attachments: z.array(z.string()).optional(),
}).refine((data) => {
  if (data.has_issues) {
    return data.report_description && data.report_description.trim().length > 0;
  }
  return true;
}, {
  message: 'Deskripsi masalah wajib diisi jika ada masalah',
  path: ['report_description'],
}).refine((data) => {
  if (data.has_issues) {
    return !!data.report_category;
  }
  return true;
}, {
  message: 'Kategori masalah wajib dipilih jika ada masalah',
  path: ['report_category'],
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

// ===== INTERFACES =====
// Lightweight record — hanya untuk ditampilkan di dropdown
interface LightRecord {
  id: string;
  record_type: 'booking' | 'lending_tool';
  status: string;
  created_at: string;
  // Booking fields
  user_id?: string;
  room_id?: string;
  start_time?: string;
  end_time?: string;
  purpose?: string;
  equipment_requested?: string[];
  equipment_quantities?: number[];
  // Lending fields
  id_user?: string;
  id_equipment?: string[];
  qty?: number[];
  date?: string;
  return_date?: string;
  // Enriched display fields (nama saja)
  display_name: string;      // "Budi - Lab Fisika" atau "Budi - 3 Peralatan"
  display_sub: string;       // tanggal / info ringkas
  user_name: string;
  room_name?: string;
}
interface Equipment {
  id: string;
  name: string;
  code?: string;
  category?: string;
  condition?: string;
  quantity: number;
  unit?: string;
  is_mandatory: boolean;
}

interface UserInfo {
  id: string;
  full_name: string;
  identity_number: string;
  email: string;
  phone_number?: string;
}

interface RoomInfo {
  id: string;
  name: string;
  code: string;
  capacity: number;
  building_id?: string;
}

interface BookingWithDetails {
  id: string;
  user_id?: string;
  room_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  status: string;
  equipment_requested: string[];
  equipment_quantities: number[];
  created_at: string;
  updated_at: string;
  user?: UserInfo;
  room?: RoomInfo;
  equipment_details?: Equipment[];
  record_type: 'booking';
}

interface LendingToolWithDetails {
  id: string;
  id_user: string;
  date: string;
  return_date?: string;
  id_equipment: string[];
  qty: number[];
  status: string;
  purpose?: string;
  created_at: string;
  updated_at: string;
  user?: UserInfo;
  equipment_details?: Equipment[];
  record_type: 'lending_tool';
}

type CombinedRecord = BookingWithDetails | LendingToolWithDetails;

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

const formatDate = (dateString: string) => {
  try {
    return format(parseISO(dateString), 'dd MMM yyyy, HH:mm');
  } catch (error) {
    return dateString;
  }
};

// ===== MAIN COMPONENT =====
const CheckOut: React.FC = () => {
  const { isSubmitting: isThrottling, throttledSubmit } = useThrottledSubmit(3000);
  const [lightRecords, setLightRecords] = useState<LightRecord[]>([]);
  // Fase 2: detail lengkap setelah dipilih
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecordDropdown, setShowRecordDropdown] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CombinedRecord | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // State for equipment issue selection
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [allRoomEquipment, setAllRoomEquipment] = useState<Equipment[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced search — filter dijalankan 300ms setelah user berhenti mengetik
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      record_id: '',
      has_issues: false,
      report_category: 'room',
      attachments: [],
    },
  });

  const watchHasIssues = form.watch('has_issues');
  const watchRecordId = form.watch('record_id');

  // ===== FASE 1: FETCH LIGHT RECORDS (hanya untuk dropdown) =====
  // Query minimal: hanya field yang dibutuhkan untuk tampil di list
  const fetchLightRecords = useCallback(async () => {
    try {
      setLoadingRecords(true);

      // Ambil checkouts, bookings, lending paralel — kolom MINIMAL saja
      const [checkoutsResult, bookingsResult, lendingResult] = await Promise.all([
        supabase.from('checkouts').select('booking_id, lendingTool_id').eq('status', 'returned'),
        supabase
          .from('bookings')
          .select('id, user_id, room_id, start_time, end_time, status, purpose, equipment_requested, equipment_quantities, created_at, updated_at')
          .eq('status', 'borrowed')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('lending_tool')
          .select('id, id_user, id_equipment, qty, date, return_date, status, purpose, created_at, updated_at')
          .eq('status', 'borrow')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const checkedOutBookingIds = checkoutsResult.data?.filter(c => c.booking_id).map(c => c.booking_id) || [];
      const checkedOutLendingIds = checkoutsResult.data?.filter(c => c.lendingTool_id).map(c => c.lendingTool_id) || [];

      if (bookingsResult.error) throw bookingsResult.error;
      if (lendingResult.error) throw lendingResult.error;

      const bookingsData = (bookingsResult.data || []).filter(b => !checkedOutBookingIds.includes(b.id));
      const lendingData = (lendingResult.data || []).filter(l => !checkedOutLendingIds.includes(l.id));

      // Kumpulkan user & room IDs saja (BUKAN equipment — itu di fase 2)
      const allUserIds = [...new Set([
        ...bookingsData.filter(b => b.user_id).map(b => b.user_id),
        ...lendingData.filter(l => l.id_user).map(l => l.id_user),
      ])].filter(Boolean);

      const allRoomIds = [...new Set(
        bookingsData.filter(b => b.room_id).map(b => b.room_id)
      )].filter(Boolean);

      // Batch fetch user & room saja (2 query, bukan N query, tanpa equipment)
      const [usersResult, roomsResult] = await Promise.all([
        allUserIds.length > 0
          ? supabase.from('users').select('id, full_name, identity_number').in('id', allUserIds)
          : Promise.resolve({ data: [] }),
        allRoomIds.length > 0
          ? supabase.from('rooms').select('id, name, code').in('id', allRoomIds)
          : Promise.resolve({ data: [] }),
      ]);

      const userMap = new Map((usersResult.data || []).map(u => [u.id, u]));
      const roomMap = new Map((roomsResult.data || []).map(r => [r.id, r]));

      // Buat LightRecord — cukup untuk tampil di dropdown
      const bookingLight: LightRecord[] = bookingsData.map(b => {
        const user = b.user_id ? userMap.get(b.user_id) : null;
        const room = b.room_id ? roomMap.get(b.room_id) : null;
        const userName = (user as any)?.full_name || 'Pengguna Tidak Dikenal';
        const roomName = (room as any)?.name || 'Ruangan Tidak Dikenal';
        return {
          id: b.id,
          record_type: 'booking' as const,
          status: b.status,
          created_at: b.created_at,
          user_id: b.user_id,
          room_id: b.room_id,
          start_time: b.start_time,
          end_time: b.end_time,
          purpose: b.purpose,
          equipment_requested: b.equipment_requested,
          equipment_quantities: b.equipment_quantities,
          updated_at: b.updated_at,
          display_name: `${userName} - ${roomName}`,
          display_sub: b.start_time ? formatDate(b.start_time) : '',
          user_name: userName,
          room_name: roomName,
        };
      });

      const lendingLight: LightRecord[] = lendingData.map(l => {
        const user = l.id_user ? userMap.get(l.id_user) : null;
        const userName = (user as any)?.full_name || 'Pengguna Tidak Dikenal';
        const eqCount = Array.isArray(l.id_equipment) ? l.id_equipment.length : 0;
        return {
          id: l.id,
          record_type: 'lending_tool' as const,
          status: l.status,
          created_at: l.created_at,
          id_user: l.id_user,
          id_equipment: l.id_equipment,
          qty: l.qty,
          date: l.date,
          return_date: l.return_date,
          updated_at: l.updated_at,
          display_name: `${userName} - ${eqCount} Peralatan`,
          display_sub: l.date ? formatDate(l.date) : '',
          user_name: userName,
        };
      });

      setLightRecords([...bookingLight, ...lendingLight]);

    } catch (error: any) {
      toast.error('Gagal memuat data peminjaman');
      setLightRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  // ===== FASE 2: FETCH DETAIL SATU RECORD (dipanggil setelah user klik) =====
  const fetchRecordDetail = useCallback(async (light: LightRecord): Promise<CombinedRecord | null> => {
    try {
      setLoadingDetail(true);

      if (light.record_type === 'booking') {
        // Fetch user, room, equipment secara paralel — tapi HANYA untuk 1 booking ini
        const [userRes, roomRes, eqRes] = await Promise.all([
          light.user_id
            ? supabase.from('users').select('id, full_name, identity_number, email, phone_number').eq('id', light.user_id).single()
            : Promise.resolve({ data: null }),
          light.room_id
            ? supabase.from('rooms').select('id, name, code, capacity, building_id').eq('id', light.room_id).single()
            : Promise.resolve({ data: null }),
          Array.isArray(light.equipment_requested) && light.equipment_requested.length > 0
            ? supabase.from('equipment').select('id, name, code, category, quantity, unit, is_mandatory').in('id', light.equipment_requested)
            : Promise.resolve({ data: [] }),
        ]);

        return {
          id: light.id,
          user_id: light.user_id,
          room_id: light.room_id!,
          start_time: light.start_time!,
          end_time: light.end_time!,
          purpose: light.purpose!,
          status: light.status,
          equipment_requested: light.equipment_requested || [],
          equipment_quantities: light.equipment_quantities || [],
          created_at: light.created_at,
          updated_at: (light as any).updated_at || '',
          user: userRes.data as UserInfo,
          room: roomRes.data as RoomInfo,
          equipment_details: (eqRes.data || []) as Equipment[],
          record_type: 'booking',
        } as BookingWithDetails;

      } else {
        // Lending tool: fetch user + equipment saja
        const [userRes, eqRes] = await Promise.all([
          light.id_user
            ? supabase.from('users').select('id, full_name, identity_number, email, phone_number').eq('id', light.id_user).single()
            : Promise.resolve({ data: null }),
          Array.isArray(light.id_equipment) && light.id_equipment.length > 0
            ? supabase.from('equipment').select('id, name, code, category, quantity, unit, is_mandatory').in('id', light.id_equipment)
            : Promise.resolve({ data: [] }),
        ]);

        return {
          id: light.id,
          id_user: light.id_user!,
          date: light.date!,
          return_date: light.return_date,
          id_equipment: light.id_equipment || [],
          qty: light.qty || [],
          status: light.status,
          created_at: light.created_at,
          updated_at: (light as any).updated_at || '',
          user: userRes.data as UserInfo,
          equipment_details: (eqRes.data || []) as Equipment[],
          record_type: 'lending_tool',
        } as LendingToolWithDetails;
      }

    } catch {
      return null;
    } finally {
      setLoadingDetail(false);
    }
  }, []);


  // ===== EFFECTS =====
  // Debounce: update debouncedSearch 300ms setelah searchTerm berubah
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchTerm]);

  useEffect(() => {
    fetchLightRecords();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRecordDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fetchLightRecords]);

  // watchRecordId: jika di-clear, reset selectedRecord
  useEffect(() => {
    if (!watchRecordId) setSelectedRecord(null);
  }, [watchRecordId]);

  useEffect(() => {
    setShowReportForm(watchHasIssues);
    if (!watchHasIssues) {
      form.setValue('report_category', 'equipment');
      form.setValue('report_description', '');
      setAttachments([]);
    }
  }, [watchHasIssues, form]);

  // ===== GET DISPLAY NAME =====
  const getDisplayName = useCallback((record: CombinedRecord) => {
    if (record.record_type === 'booking') {
      const booking = record as BookingWithDetails;
      const userName = booking.user?.full_name || 'Pengguna Tidak Dikenal';
      const roomName = booking.room?.name || 'Ruangan Tidak Dikenal';
      return `${userName} - ${roomName}`;
    } else {
      const lending = record as LendingToolWithDetails;
      const userName = lending.user?.full_name || 'Pengguna Tidak Dikenal';
      const equipmentCount = lending.equipment_details?.length || 0;
      return `${userName} - ${equipmentCount} Peralatan`;
    }
  }, []);

  // ===== HANDLE RECORD SELECT (Fase 2: fetch detail setelah dipilih) =====
  const handleRecordSelect = async (light: LightRecord, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Langsung set nama di searchbox agar UX responsif
    setSearchTerm(light.display_name);
    setShowRecordDropdown(false);
    form.clearErrors('record_id');
    setSelectedEquipmentIds([]);
    setAllRoomEquipment([]);

    // Set form values awal (cukup id & type)
    form.setValue('record_id', light.id);
    form.setValue('record_type', light.record_type);

    // Fase 2: fetch detail lengkap untuk record ini saja
    const detail = await fetchRecordDetail(light);
    if (detail) {
      setSelectedRecord(detail);
      // Jika booking, fetch equipment di ruangan untuk laporan masalah
      if (detail.record_type === 'booking') {
        const booking = detail as BookingWithDetails;
        if (booking.room_id) fetchRoomEquipment(booking.room_id);
      }
    } else {
      toast.error('Gagal memuat detail data');
      form.setValue('record_id', '');
    }
  };

  // Fetch all equipment in a room (for issue reporting)
  const fetchRoomEquipment = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, code, category, condition, quantity, unit, is_mandatory')
        .eq('rooms_id', roomId)
        .order('name');
      if (error) throw error;
      setAllRoomEquipment(data || []);
    } catch (error) {
      setAllRoomEquipment([]);
    }
  };

  // ===== HANDLE IMAGE UPLOAD =====
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error('Hanya file gambar yang diperbolehkan');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran gambar maksimal 5MB');
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    try {
      setUploadingImage(true);

      const newAttachments: string[] = [];

      for (const file of validFiles) {
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newAttachments.push(base64String);
      }

      const updatedAttachments = [...attachments, ...newAttachments];
      setAttachments(updatedAttachments);
      form.setValue('attachments', updatedAttachments);
      toast.success(`${newAttachments.length} gambar berhasil diunggah`);

    } catch (error) {
      toast.error('Gagal mengunggah gambar');
    } finally {
      setUploadingImage(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
    form.setValue('attachments', newAttachments);
  };

  // ===== BUILD CHECKOUT DATA =====
  const buildCheckoutData = (selectedRecord: CombinedRecord) => {
    const baseData: any = {
      checkout_date: new Date().toISOString(),
      status: 'returned',
      condition_on_checkout: 'good',
      condition_on_return: 'good',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (selectedRecord.record_type === 'booking') {
      const booking = selectedRecord as BookingWithDetails;
      baseData.booking_id = booking.id;
      baseData.user_id = booking.user_id || booking.user?.id;
      // ❌ REMOVED: baseData.room_id = booking.room_id;
      baseData.expected_return_date = booking.end_time;
      baseData.total_items = booking.equipment_requested?.length || 0;
      baseData.type = 'room';
      baseData.checkout_notes = `Pengembalian ruangan ${booking.room?.name || 'N/A'}. ${booking.equipment_requested?.length || 0} peralatan dipinjam.`;
    } else {
      const lending = selectedRecord as LendingToolWithDetails;
      baseData.user_id = lending.id_user || lending.user?.id;
      baseData.lendingTool_id = lending.id;
      baseData.expected_return_date = lending.return_date || lending.date;
      baseData.total_items = lending.equipment_details?.length || 0;
      baseData.type = 'things';
      baseData.checkout_notes = `Pengembalian ${lending.equipment_details?.length || 0} peralatan dari lending tool.`;
    }


    return baseData;
  };

  // ===== UPDATE SOURCE RECORD STATUS =====
  const updateSourceRecordStatus = async (selectedRecord: CombinedRecord) => {
    try {
      if (selectedRecord.record_type === 'booking') {
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'returned',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRecord.id);

        if (updateError) throw updateError;

      } else {
        const { error: updateError } = await supabase
          .from('lending_tool')
          .update({
            status: 'returned',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRecord.id);

        if (updateError) throw updateError;

      }

      return true;
    } catch (error) {
      throw error;
    }
  };

  // ===== CREATE CHECKOUT ITEMS =====
  const createCheckoutItems = async (checkoutId: string, selectedRecord: CombinedRecord) => {
    try {
      if (selectedRecord.record_type === 'booking') {
        const booking = selectedRecord as BookingWithDetails;

        if (booking.equipment_requested && booking.equipment_requested.length > 0) {


          // ⭐⭐ CRITICAL: Single record dengan arrays
          const checkoutItemData = {
            checkout_id: checkoutId,
            equipment_requested: booking.equipment_requested,
            equipment_quantities: booking.equipment_quantities,
            equipment_back: [],
            quantities_back: [],
            status: 'pending',
            created_at: new Date().toISOString()
          };

          const { error: itemsError } = await supabase
            .from('checkout_items')
            .insert(checkoutItemData);

          if (itemsError) {
            throw itemsError;
          }


        } else {

        }

      } else {
        const lending = selectedRecord as LendingToolWithDetails;

        if (lending.id_equipment && lending.id_equipment.length > 0) {


          const checkoutItemData = {
            checkout_id: checkoutId,
            equipment_requested: lending.id_equipment,
            equipment_quantities: lending.qty,
            equipment_back: [],
            quantities_back: [],
            status: 'pending',
            created_at: new Date().toISOString()
          };

          const { error: itemsError } = await supabase
            .from('checkout_items')
            .insert(checkoutItemData);

          if (itemsError) {
            throw itemsError;
          }


        } else {

        }
      }

      return true;
    } catch (error) {
      throw error;
    }
  };

  // ===== CREATE ISSUE REPORT =====
  const createIssueReport = async (data: CheckoutForm, selectedRecord: CombinedRecord) => {
    try {
      if (!data.has_issues || !data.report_description || !data.report_category) {
        return null;
      }

      // For equipment category, use selected equipment; otherwise null
      const equipmentIdsToReport = data.report_category === 'equipment' && selectedEquipmentIds.length > 0
        ? selectedEquipmentIds
        : null;

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
        title: `Laporan ${data.report_category === 'room' ? 'Masalah Ruangan' : 'Masalah Peralatan'} - ${format(new Date(), 'dd/MM/yyyy')}`,
        description: data.report_description,
        location: selectedRecord.record_type === 'booking'
          ? (selectedRecord as BookingWithDetails).room?.name
          : 'Area Equipment',
        room_id: selectedRecord.record_type === 'booking'
          ? (selectedRecord as BookingWithDetails).room_id
          : null,
        equipment_ids: equipmentIdsToReport,
        status: 'new',
        attachments: attachments,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: reportError } = await supabase
        .from('reports')
        .insert(reportData);

      if (reportError) throw reportError;


      return true;
    } catch (error) {
      throw error;
    }
  };

  // ===== HANDLE SUBMIT =====
  const handleSubmit = async (data: CheckoutForm) => {
    let checkoutId: string | undefined = undefined;

    try {
      setSubmitting(true);

      if (!selectedRecord) {
        toast.error('Pilih data untuk di-checkout');
        return;
      }



      // ===== STEP 1: UPDATE SOURCE RECORD STATUS =====
      await updateSourceRecordStatus(selectedRecord);

      // ===== STEP 2: BUILD CHECKOUT DATA =====
      const checkoutData = buildCheckoutData(selectedRecord);

      // ===== STEP 3: INSERT CHECKOUT RECORD =====
      const { data: checkoutResult, error: checkoutError } = await supabase
        .from('checkouts')
        .insert(checkoutData)
        .select()
        .single();

      if (checkoutError) {
        throw checkoutError;
      }

      // ⭐⭐ CRITICAL FIX: Assign checkoutId from the result
      checkoutId = checkoutResult.id;

      // ===== STEP 4: CREATE CHECKOUT ITEMS =====
      await createCheckoutItems(checkoutId, selectedRecord);

      // ===== STEP 5: CREATE ISSUE REPORT IF NEEDED =====
      if (data.has_issues) {
        await createIssueReport(data, selectedRecord);
      }

      // ===== SUCCESS MESSAGE =====
      let successMessage = 'Pengembalian berhasil diproses!';
      if (data.has_issues) {
        successMessage += ' Laporan masalah telah dikirim.';
      }

      toast.success(successMessage, { duration: 5000 });

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
      await fetchLightRecords();

    } catch (error: any) {

      // Rollback
      if (selectedRecord && checkoutId) {
        try {


          if (selectedRecord.record_type === 'booking') {
            await supabase
              .from('bookings')
              .update({ status: 'borrowed' })
              .eq('id', selectedRecord.id);
          } else {
            await supabase
              .from('lending_tool')
              .update({ status: 'borrow' })
              .eq('id', selectedRecord.id);
          }

          await supabase.from('checkouts').delete().eq('id', checkoutId);

        } catch (rollbackError) {
        }
      }

      if (error.code === '23505') {
        toast.error('Data ini sudah pernah di-checkout');
      } else {
        toast.error(error.message || 'Gagal memproses checkout');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = useMemo(() => {
    if (!debouncedSearch.trim()) return lightRecords;
    const q = debouncedSearch.toLowerCase();
    return lightRecords.filter(r =>
      r.display_name.toLowerCase().includes(q) ||
      r.user_name.toLowerCase().includes(q) ||
      (r.room_name && r.room_name.toLowerCase().includes(q))
    );
  }, [lightRecords, debouncedSearch]);

  const isSubmitEnabled = selectedRecord && watchRecordId && !submitting && !isThrottling;

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50">
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
                <div className="text-2xl font-bold text-gray-800">{lightRecords.length}</div>
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
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 relative" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <Search className="h-5 w-5 text-emerald-500" />
                  <h2 className="text-xl font-bold text-gray-800">Cari Data Anda</h2>
                </div>
                <button
                  onClick={fetchLightRecords}
                  disabled={loadingRecords}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw className={`h-4 w-4 text-gray-500 ${loadingRecords ? 'animate-spin' : ''}`} />
                </button>
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
                    className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-2xl max-h-96 overflow-y-auto"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {loadingRecords ? (
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
                      </div>
                    ) : (
                      <div className="p-2">
                        {filteredRecords.map((light) => (
                          <button
                            key={light.id}
                            type="button"
                            onClick={(e) => handleRecordSelect(light, e)}
                            className="w-full text-left p-4 hover:bg-emerald-50 cursor-pointer rounded-xl border transition-all mb-2 last:mb-0"
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${light.record_type === 'booking'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                                }`}>
                                {light.record_type === 'booking' ? (
                                  <Building className="h-5 w-5 text-white" />
                                ) : (
                                  <Wrench className="h-5 w-5 text-white" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">
                                  {light.user_name}
                                </div>
                                <div className="text-sm text-gray-600 truncate">
                                  {light.record_type === 'booking'
                                    ? light.room_name || 'Ruangan Tidak Dikenal'
                                    : `${light.id_equipment?.length || 0} Peralatan`}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${light.record_type === 'booking'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-purple-100 text-purple-800'
                                    }`}>
                                    {light.record_type === 'booking' ? 'Peminjaman Ruangan' : 'Peminjaman Peralatan'}
                                  </span>
                                  <span className="text-xs text-gray-400">{light.display_sub}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}</div>
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
          <div className="lg:col-span-2">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center space-x-3 mb-8">
                <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Proses Pengembalian</h2>
              </div>

              <form onSubmit={form.handleSubmit((data) => throttledSubmit(() => handleSubmit(data)))} className="space-y-8">
                {/* Loading Detail Spinner (Fase 2) */}
                {loadingDetail && (
                  <div className="flex items-center justify-center py-8 space-x-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Memuat detail data...</span>
                  </div>
                )}

                {/* Selected Record Details */}
                {selectedRecord && (
                  <div className={`border rounded-2xl p-6 ${selectedRecord.record_type === 'booking'
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
                        <h3 className={`text-xl font-bold ${selectedRecord.record_type === 'booking' ? 'text-emerald-900' : 'text-purple-900'
                          }`}>
                          {selectedRecord.record_type === 'booking'
                            ? 'Detail Peminjaman Ruangan'
                            : 'Detail Peminjaman Peralatan'
                          }
                        </h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedRecord.record_type === 'booking'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-purple-100 text-purple-800'
                        }`}>
                        Status: {selectedRecord.status}
                      </span>
                    </div>

                    {/* User Info */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                        Informasi Peminjam
                      </h4>
                      <div className="bg-white/60 rounded-xl border border-gray-200/50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="font-bold text-gray-900 mb-1">
                              {selectedRecord.user?.full_name || 'Pengguna Tidak Dikenal'}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              <CreditCard className="h-3 w-3 inline mr-1" />
                              {selectedRecord.user?.identity_number || 'No ID'}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600 mb-1">
                              <Mail className="h-3 w-3 inline mr-1" />
                              {selectedRecord.user?.email || 'No Email'}
                            </div>
                            {selectedRecord.user?.phone_number && (
                              <div className="text-sm text-gray-600">
                                <Phone className="h-3 w-3 inline mr-1" />
                                {selectedRecord.user.phone_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Record Specific Info */}
                    {selectedRecord.record_type === 'booking' ? (
                      <>
                        {/* Room Info */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3">
                            Detail Ruangan
                          </h4>
                          <div className="bg-white/60 rounded-xl border border-gray-200/50 p-4">
                            <div className="font-bold text-emerald-900 mb-2">
                              {(selectedRecord as BookingWithDetails).room?.name || 'Ruangan Tidak Dikenal'}
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm text-emerald-700">
                                <span className="font-medium">Kode:</span> {(selectedRecord as BookingWithDetails).room?.code || 'N/A'}
                              </div>
                              <div className="text-sm text-emerald-700">
                                <span className="font-medium">Kapasitas:</span> {(selectedRecord as BookingWithDetails).room?.capacity || 'N/A'} orang
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Time Info */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3">
                            Waktu Peminjaman
                          </h4>
                          <div className="bg-white/60 rounded-xl border border-gray-200/50 p-4">
                            <div className="text-sm text-emerald-700 mb-2">
                              <Calendar className="h-4 w-4 inline mr-2" />
                              <span className="font-medium">Mulai:</span> {formatDate((selectedRecord as BookingWithDetails).start_time)}
                            </div>
                            <div className="text-sm text-emerald-700">
                              <Clock className="h-4 w-4 inline mr-2" />
                              <span className="font-medium">Selesai:</span> {formatDate((selectedRecord as BookingWithDetails).end_time)}
                            </div>
                          </div>
                        </div>

                        {/* Equipment List */}
                        {(selectedRecord as BookingWithDetails).equipment_details &&
                          (selectedRecord as BookingWithDetails).equipment_details!.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
                                  Peralatan yang Dipinjam
                                </span>
                                <span className="text-sm text-emerald-600">
                                  {(selectedRecord as BookingWithDetails).equipment_details!.length} jenis
                                </span>
                              </div>

                              <div className="space-y-3">
                                {(selectedRecord as BookingWithDetails).equipment_details!.map((equipment, index) => {
                                  const quantity = (selectedRecord as BookingWithDetails).equipment_quantities?.[index] || 1;

                                  return (
                                    <div key={equipment.id} className="flex items-center justify-between p-4 bg-white/60 rounded-xl border border-emerald-200/50">
                                      <div className="flex items-center">
                                        <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                                          <Zap className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div>
                                          <div className="font-medium text-emerald-900">{equipment.name}</div>
                                          <div className="text-xs text-emerald-700">{equipment.code || 'N/A'}</div>
                                          {equipment.is_mandatory && (
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                              Wajib
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-bold text-emerald-900 text-xl">{quantity}</div>
                                        <div className="text-xs text-emerald-600">{equipment.unit || 'pcs'}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </>
                    ) : (
                      <>
                        {/* Lending Tool Info */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-3">
                            Detail Peminjaman
                          </h4>
                          <div className="bg-white/60 rounded-xl border border-gray-200/50 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="font-bold text-purple-900 mb-2">
                                  Tanggal Pinjam
                                </div>
                                <div className="text-sm text-purple-700">
                                  <Calendar className="h-4 w-4 inline mr-2" />
                                  {formatDate((selectedRecord as LendingToolWithDetails).date)}
                                </div>
                              </div>
                              {(selectedRecord as LendingToolWithDetails).return_date && (
                                <div>
                                  <div className="font-bold text-purple-900 mb-2">
                                    Tanggal Kembali
                                  </div>
                                  <div className="text-sm text-purple-700">
                                    <Clock className="h-4 w-4 inline mr-2" />
                                    {formatDate((selectedRecord as LendingToolWithDetails).return_date)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Equipment List */}
                        {(selectedRecord as LendingToolWithDetails).equipment_details &&
                          (selectedRecord as LendingToolWithDetails).equipment_details!.length > 0 && (
                            <div>
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
                                  const quantity = (selectedRecord as LendingToolWithDetails).qty?.[index] || 1;

                                  return (
                                    <div key={equipment.id} className="flex items-center justify-between p-4 bg-white/60 rounded-xl border border-purple-200/50">
                                      <div className="flex items-center">
                                        <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                                          <Wrench className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div>
                                          <div className="font-medium text-purple-900">{equipment.name}</div>
                                          <div className="text-xs text-purple-700">{equipment.code || 'N/A'}</div>
                                          <div className="text-xs text-purple-600 mt-1">{equipment.category || 'Kategori N/A'}</div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-bold text-purple-900 text-xl">{quantity}</div>
                                        <div className="text-xs text-purple-600">{equipment.unit || 'pcs'}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </>
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
                        id="has_issues"
                        className="h-5 w-5 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor="has_issues" className="text-lg font-semibold text-yellow-900 cursor-pointer">
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

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Kategori Masalah *
                      </label>
                      <select
                        {...form.register('report_category')}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        <option value="room">Masalah Ruangan</option>
                        <option value="equipment">Masalah Peralatan</option>
                      </select>
                      {form.formState.errors.report_category && (
                        <p className="mt-1 text-sm text-red-600 font-medium">
                          {form.formState.errors.report_category.message}
                        </p>
                      )}
                    </div>

                    {/* Equipment Selection - Only show when category is equipment */}
                    {form.watch('report_category') === 'equipment' && selectedRecord && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Pilih Peralatan Bermasalah *
                        </label>
                        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl bg-white/50 p-3 space-y-2">
                          {/* Equipment from borrowing */}
                          {selectedRecord.equipment_details && selectedRecord.equipment_details.length > 0 && (
                            <>
                              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Peralatan Dipinjam</p>
                              {selectedRecord.equipment_details.map((eq) => (
                                <label key={eq.id} className="flex items-center gap-2 p-2 hover:bg-orange-50 rounded-lg cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedEquipmentIds.includes(eq.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedEquipmentIds([...selectedEquipmentIds, eq.id]);
                                      } else {
                                        setSelectedEquipmentIds(selectedEquipmentIds.filter(id => id !== eq.id));
                                      }
                                    }}
                                    className="rounded text-orange-600 focus:ring-orange-500"
                                  />
                                  <span className="text-sm font-medium">{eq.name}</span>
                                  <span className="text-xs text-gray-500">({eq.code})</span>
                                </label>
                              ))}
                            </>
                          )}

                          {/* All equipment in room (for booking) */}
                          {selectedRecord.record_type === 'booking' && allRoomEquipment.length > 0 && (
                            <>
                              <p className="text-xs font-medium text-gray-500 uppercase mt-4 mb-2 border-t pt-3">Peralatan Lain di Ruangan</p>
                              {allRoomEquipment
                                .filter(eq => !selectedRecord.equipment_details?.find(e => e.id === eq.id))
                                .map((eq) => (
                                  <label key={eq.id} className="flex items-center gap-2 p-2 hover:bg-orange-50 rounded-lg cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedEquipmentIds.includes(eq.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedEquipmentIds([...selectedEquipmentIds, eq.id]);
                                        } else {
                                          setSelectedEquipmentIds(selectedEquipmentIds.filter(id => id !== eq.id));
                                        }
                                      }}
                                      className="rounded text-orange-600 focus:ring-orange-500"
                                    />
                                    <span className="text-sm">{eq.name}</span>
                                    <span className="text-xs text-gray-500">({eq.code})</span>
                                    <span className={`text-xs px-1 py-0.5 rounded ${eq.condition === 'GOOD' ? 'bg-green-100 text-green-700' :
                                      eq.condition === 'BROKEN' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>{eq.condition || 'N/A'}</span>
                                  </label>
                                ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}

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
                      {form.formState.errors.report_description && (
                        <p className="mt-1 text-sm text-red-600 font-medium">
                          {form.formState.errors.report_description.message}
                        </p>
                      )}
                    </div>

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
                              ref={fileInputRef}
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={uploadingImage}
                              multiple
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
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600"
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
                    disabled={!isSubmitEnabled || submitting}
                    className={`flex-1 flex items-center justify-center space-x-3 px-8 py-4 font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-lg ${isSubmitEnabled && !submitting
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    {submitting || isThrottling ? (
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
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckOut;