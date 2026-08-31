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
import { useThrottledSubmit } from '../hooks/useThrottledSubmit';

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
  equipment_quantities?: number[];
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
  equipment_details?: Array<{
    id: string;
    name: string;
    code: string;
    category: string;
    borrowed_quantity: number;
    room_name?: string;
  }>;
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
    borrowed_quantity: number;
    room_name?: string;
  }>;
  record_type: 'lending_tool';
}

type CombinedRecord = BookingWithDetails | LendingToolWithDetails;

// ===== INDONESIAN DATE FORMATTER =====
const formatDateIndonesian = (date: Date): string => {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const dayName = days[date.getDay()];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${day} ${month} ${year}`;
};

const formatDateOnlyIndonesian = (date: Date): string => {
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const PermitLetter: React.FC = () => {
  const { isSubmitting: isThrottling, throttledSubmit } = useThrottledSubmit(3000);
  const { getText } = useLanguage();
  const [allRecords, setAllRecords] = useState<CombinedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecordDropdown, setShowRecordDropdown] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<CombinedRecord[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'booking' | 'lending_tool'>('all');

  // Tab mode: 'generate' for letter generator, 'upload' for document upload
  const [tabMode, setTabMode] = useState<'generate' | 'upload'>('generate');

  // ========== Letter Generator State ==========
  // Users list for recipient and applicant selection
  const [allUsers, setAllUsers] = useState<Array<{
    id: string;
    full_name: string;
    role: string;
    identity_number?: string;
    study_program_id?: string;
    study_program_name?: string;
  }>>([]);

  // Recipient selection
  const [selectedRecipientRole, setSelectedRecipientRole] = useState<string>('laboratory');
  const [recipientSearchTerm, setRecipientSearchTerm] = useState('');
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<{
    id: string;
    full_name: string;
    role: string;
    identity_number?: string;
    study_program_name?: string;
  } | null>(null);

  // Applicant (auto-filled from selected records)
  const [applicantUser, setApplicantUser] = useState<{
    id: string;
    full_name: string;
    role: string;
    identity_number?: string;
    study_program_name?: string;
  } | null>(null);

  // Letter form data
  const [letterData, setLetterData] = useState({
    subject: '',
    attachment_count: '',
    activity: '', // Manual input for kegiatan
    location: '', // Manual input for lokasi (untuk tool lending)
  });

  // Role options and display mapping
  const recipientRoleOptions = [
    { value: 'laboratory', label: 'Laboran' },
    { value: 'lecturer', label: 'Dosen' },
    { value: 'technician', label: 'Teknisi' },
    { value: 'super_admin', label: 'Pelayanan Gedung Kuliah' },
  ];

  const roleDisplayMap: Record<string, string> = {
    'super_admin': 'Super Admin',
    'laboratory': 'Laboran',
    'lecturer': 'Dosen',
    'technician': 'Teknisi',
    'student': 'Mahasiswa',
    'staff': 'Staff',
  };

  // Signature pad state
  const [applicantSignature, setApplicantSignature] = useState<string>('');
  const signatureCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

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
    fetchAllUsers();
  }, []);

  useEffect(() => {
    // Update form values when selected records change
    const bookings = selectedRecords.filter(r => r.record_type === 'booking').map(r => r.id);
    const lendings = selectedRecords.filter(r => r.record_type === 'lending_tool').map(r => r.id);

    form.setValue('selected_bookings', bookings);
    form.setValue('selected_lendings', lendings);

    // Clear validation errors and auto-fill applicant
    if (selectedRecords.length > 0) {
      form.clearErrors('selected_records' as any);

      // Auto-fill applicant from first selected record
      const firstRecord = selectedRecords[0];
      if (firstRecord?.user) {
        const userInfo = allUsers.find(u => u.id === firstRecord.user?.id);
        setApplicantUser({
          id: firstRecord.user.id,
          full_name: firstRecord.user.full_name,
          role: userInfo?.role || 'student',
          identity_number: userInfo?.identity_number,
          study_program_name: userInfo?.study_program_name || '',
        });
      }
    } else {
      setApplicantUser(null);
    }
  }, [selectedRecords, form, allUsers]);

  // Fetch all users for recipient dropdown
  const fetchAllUsers = async () => {
    try {
      // ✅ BATCHED FETCHING - Handle >1000 users
      const BATCH_SIZE = 1000;
      let allUsersData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: usersBatch, error: usersError } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            role,
            identity_number,
            study_program_id,
            study_programs:study_program_id(name)
          `)
          .order('full_name', { ascending: true })
          .range(from, from + BATCH_SIZE - 1);

        if (usersError) {
          if (from === 0) {
            return; // Stop on first batch error
          } else {
            break; // Stop fetching on subsequent batches
          }
        }

        if (usersBatch && usersBatch.length > 0) {
          allUsersData = [...allUsersData, ...usersBatch];
          if (usersBatch.length < BATCH_SIZE) {
            hasMore = false; // Last batch
          } else {
            from += BATCH_SIZE; // Next batch
          }
        } else {
          hasMore = false;
        }
      }


      const formattedUsers = (allUsersData || []).map((user: any) => ({
        id: user.id,
        full_name: user.full_name,
        role: user.role,
        identity_number: user.identity_number || '',
        study_program_id: user.study_program_id,
        study_program_name: user.study_programs?.name || '',
      }));

      setAllUsers(formattedUsers);
    } catch (error) {
    }
  };

  // ✅ PERBAIKAN: fetchAllRecords untuk pending status saja
  const fetchAllRecords = async () => {
    try {
      setLoading(true);



      // ✅ PERBAIKAN: Fetch pending bookings (belum ada permit)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'pending') // ✅ TAMBAH: belum ada attachment
        .order('created_at', { ascending: false });

      if (bookingsError) {
        throw bookingsError;
      }

      // ✅ PERBAIKAN: Fetch lending tools dengan status 'pending' (belum disetujui)
      const { data: lendingToolsData, error: lendingToolsError } = await supabase
        .from('lending_tool')
        .select('*')
        .eq('status', 'pending')// ✅ TAMBAH: belum ada attachment
        .order('created_at', { ascending: false });

      if (lendingToolsError) {
        throw lendingToolsError;
      }



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

            }
          }

          // Fetch equipment details with room info
          if (lendingTool.id_equipment && Array.isArray(lendingTool.id_equipment)) {
            try {
              const { data: equipmentData, error: equipmentError } = await supabase
                .from('equipment')
                .select('id, name, code, category, quantity, rooms(name)')
                .in('id', lendingTool.id_equipment);

              if (!equipmentError && equipmentData) {
                equipment_details = equipmentData.map((eq: any, index: number) => ({
                  id: eq.id,
                  name: eq.name,
                  code: eq.code,
                  category: eq.category,
                  borrowed_quantity: lendingTool.qty[index] || 1,
                  room_name: eq.rooms?.name || '-'
                }));
              }
            } catch (error) {

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

      setAllRecords(combinedRecords);

    } catch (error) {
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
            throw error;
          }
        }

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
            throw error;
          }
        }

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

  // ========== Signature Pad Functions ==========
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setApplicantSignature(dataUrl);
    }
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setApplicantSignature('');
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert.error(getText('Please select an image file', 'Silakan pilih file gambar'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setApplicantSignature(result);

      // Also draw on canvas
      const canvas = signatureCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width - img.width * scale) / 2;
            const y = (canvas.height - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          };
          img.src = result;
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // ========== Generate & Print Letter ==========
  const handlePrintLetter = () => {
    if (selectedRecords.length === 0) {
      alert.error(getText('Please select at least one record', 'Silakan pilih setidaknya satu data'));
      return;
    }

    const currentDate = new Date();
    const formattedDate = formatDateOnlyIndonesian(currentDate);

    // Get first selected record for details
    const firstRecord = selectedRecords[0];
    const isBooking = firstRecord.record_type === 'booking';
    const booking = isBooking ? (firstRecord as BookingWithDetails) : null;
    const lending = !isBooking ? (firstRecord as LendingToolWithDetails) : null;

    // Format activity date and time - INDONESIAN FORMAT
    let activityDate = '';
    let activityTime = '';
    if (booking) {
      activityDate = formatDateIndonesian(new Date(booking.start_time));
      activityTime = `${format(new Date(booking.start_time), 'HH:mm')} - ${format(new Date(booking.end_time), 'HH:mm')} WIB`;
    } else if (lending) {
      activityDate = formatDateIndonesian(new Date(lending.date));
      // Get time from database lending.date
      const lendingDateTime = new Date(lending.date);
      const lendingHour = format(lendingDateTime, 'HH:mm');
      activityTime = `${lendingHour} WIB`;
    }

    // Get recipient info - use dropdown label for role, not database role
    const recipientName = selectedRecipient?.full_name || 'Yth. Bapak/Ibu';
    // Get role label from dropdown options
    const selectedRoleOption = recipientRoleOptions.find(opt => opt.value === selectedRecipientRole);
    const recipientRoleLabel = selectedRoleOption?.label || 'Laboran';
    const recipientStudyProgram = selectedRecipient?.study_program_name || '';

    // Build recipient title: "Laboran Program Studi X" or "Pelayanan Gedung Kuliah" (no program studi)
    const recipientTitle = recipientStudyProgram
      ? `${recipientRoleLabel} Program Studi ${recipientStudyProgram}`
      : recipientRoleLabel;

    // Get applicant info
    const applicantName = applicantUser?.full_name || firstRecord.user?.full_name || 'Nama Pemohon';
    const applicantRole = applicantUser ? (roleDisplayMap[applicantUser.role] || applicantUser.role) : 'Mahasiswa';
    const applicantStudyProgram = applicantUser?.study_program_name || '';

    // Purpose/Activity
    const purpose = letterData.activity || booking?.purpose || 'Kegiatan Praktikum/Perkuliahan';

    // Generate HTML for print
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert.error(getText('Unable to open print window', 'Tidak dapat membuka jendela cetak'));
      return;
    }

    const lendingType = isBooking ? 'ruangan' : 'alat';
    const subject = letterData.subject || `Permohonan Peminjaman ${lendingType === 'ruangan' ? 'Ruangan' : 'Alat'}`;

    // Build details table rows for all selected records
    let detailsTableRows = '';
    selectedRecords.forEach((record, index) => {
      const recBooking = record.record_type === 'booking' ? (record as BookingWithDetails) : null;
      const recLending = record.record_type === 'lending_tool' ? (record as LendingToolWithDetails) : null;

      if (recBooking) {
        const recDate = formatDateIndonesian(new Date(recBooking.start_time));
        const recTime = `${format(new Date(recBooking.start_time), 'HH:mm')} - ${format(new Date(recBooking.end_time), 'HH:mm')} WIB`;
        detailsTableRows += `
          <tr>
            <td style="text-align:center">${index + 1}</td>
            <td>${recBooking.room?.name || '-'}</td>
            <td>${recDate}</td>
            <td>${recTime}</td>
            <td>${recBooking.purpose || '-'}</td>
          </tr>
        `;
      } else if (recLending) {
        const recDate = formatDateIndonesian(new Date(recLending.date));
        const recLendingTime = format(new Date(recLending.date), 'HH:mm') + ' WIB';
        const equipmentList = recLending.equipment_details?.map(e => e.name).join(', ') || '-';
        detailsTableRows += `
          <tr>
            <td style="text-align:center">${index + 1}</td>
            <td>${equipmentList}</td>
            <td>${recDate}</td>
            <td>${recLendingTime}</td>
            <td>${letterData.activity || 'Peminjaman alat'}</td>
          </tr>
        `;
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Surat Izin - ${subject}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
          .info-row { display: flex; margin-bottom: 5px; }
          .info-label { width: 120px; }
          .recipient { margin: 20px 0; }
          .content { text-align: justify; margin: 20px 0; }
          .content p { margin-bottom: 10px; text-indent: 40px; }
          .applicant-table { margin: 15px 0; padding-left: 40px; }
          .applicant-table table { border-collapse: collapse; }
          .applicant-table td { padding: 3px 10px 3px 0; vertical-align: top; }
          .details-table { margin: 15px 0; width: 100%; }
          .details-table table { border-collapse: collapse; width: 100%; }
          .details-table th, .details-table td { border: 1px solid #000; padding: 8px; text-align: left; }
          .details-table th { background-color: #f0f0f0; font-weight: bold; }
          .closing { margin-top: 30px; }
          .signature { margin-top: 20px; display: flex; justify-content: space-between; }
          .signature-box { text-align: center; width: 250px; }
          .signature-box .sign-area { height: 80px; display: flex; align-items: center; justify-content: center; }
          .signature-box .sign-area img { max-height: 70px; max-width: 200px; }
          .signature-box .name { border-bottom: 1px solid #000; padding-bottom: 5px; font-weight: bold; font-style: italic; }
          .signature-box .identity { font-size: 10pt; margin-top: 3px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="info-row">
          <span class="info-label">Hal</span>
          <span>: ${subject}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Lampiran</span>
          <span>: ${letterData.attachment_count || '-'}</span>
        </div>

        <div class="recipient">
          <p>Kepada Yth.</p>
          <p><strong>${recipientName}</strong></p>
          <p>${recipientTitle}</p>
          <p>di Tempat</p>
        </div>

        <div class="content">
          <p>Dengan hormat,</p>
          <p>Yang bertanda tangan di bawah ini:</p>
          
          <div class="applicant-table">
            <table>
              <tr><td>Nama</td><td>: ${applicantName}</td></tr>
              <tr><td>Jabatan</td><td>: ${applicantRole}</td></tr>
              ${applicantStudyProgram ? `<tr><td>Program Studi</td><td>: ${applicantStudyProgram}</td></tr>` : ''}
            </table>
          </div>

          <p>Berkenaan dengan kegiatan <strong>${purpose}</strong> yang diselenggarakan pada:</p>

          <div class="applicant-table">
            <table>
              <tr><td>Hari/Tanggal</td><td>: ${activityDate}</td></tr>
              <tr><td>Pukul</td><td>: ${activityTime}</td></tr>
              <tr><td>Lokasi</td><td>: ${isBooking && booking?.room?.name ? booking.room.name : (letterData.location || '-')}</td></tr>
              ${!isBooking && lending?.equipment_details && lending.equipment_details.length > 0 ? `
              <tr><td>Peralatan</td><td>: Lihat lampiran</td></tr>
              ` : ''}
              ${isBooking && booking?.attachments && booking.attachments.length > 0 ? `
              <tr><td>Dokumen Pendukung</td><td>: Lihat lampiran (${booking.attachments.length} file)</td></tr>
              ` : ''}
            </table>
          </div>

          <p>Dengan ini saya mengajukan permohonan izin untuk ${isBooking ? 'peminjaman ruangan' : 'peminjaman alat/peralatan'} tersebut.</p>

          <p>Demikian surat permohonan ini saya sampaikan. Atas perhatian dan kerjasamanya, saya ucapkan terima kasih.</p>
        </div>

        <div class="closing">
          <p style="text-align: right;">Yogyakarta, ${formattedDate}</p>
        </div>

        <div class="signature">
          <div class="signature-box">
            <p>Mengetahui,</p>
            <p style="margin-top: 5px;">${recipientTitle}</p>
            <div class="sign-area">
              
            </div>
            <p class="name">${recipientName}</p>
            <p class="identity">${selectedRecipient?.identity_number || '-'}</p>
          </div>
          <div class="signature-box">
            <p>Pemohon,</p>
            <p style="font-size: 10pt;">${applicantStudyProgram ? `Mahasiswa Program Studi ${applicantStudyProgram}` : applicantRole}</p>
            <div class="sign-area">
              ${applicantSignature ? `<img src="${applicantSignature}" alt="Tanda Tangan" />` : '<p style="color: #ccc; font-style: italic;">(Tanda Tangan)</p>'}
            </div>
            <p class="name">${applicantName}</p>
            <p class="identity">${applicantUser?.identity_number || firstRecord.user?.identity_number || '-'}</p>
          </div>
        </div>

        ${!isBooking && lending?.equipment_details && lending.equipment_details.length > 0 ? `
        <!-- Page 2: Equipment Details for Tool Lending -->
        <div style="page-break-before: always; padding-top: 40px;">
          <h3 style="text-align: center; margin-bottom: 20px; font-size: 14pt;">LAMPIRAN</h3>
          <h4 style="text-align: center; margin-bottom: 30px; font-size: 12pt;">Daftar Peralatan yang Dipinjam</h4>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="border: 1px solid #000; padding: 10px; text-align: center; width: 50px;">No</th>
                <th style="border: 1px solid #000; padding: 10px; text-align: left;">Nama Barang</th>
                <th style="border: 1px solid #000; padding: 10px; text-align: center; width: 80px;">Jumlah</th>
                <th style="border: 1px solid #000; padding: 10px; text-align: left;">Asal Ruangan</th>
              </tr>
            </thead>
            <tbody>
              ${lending.equipment_details.map((eq: any, idx: number) => `
              <tr>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #000; padding: 8px;">${eq.name || '-'}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${eq.borrowed_quantity || 1}</td>
                <td style="border: 1px solid #000; padding: 8px;">${eq.room_name || '-'}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>

          <p style="margin-top: 30px; font-size: 11pt;">
            <strong>Catatan:</strong> Peralatan yang dipinjam harus dikembalikan dalam kondisi baik sesuai dengan ketentuan yang berlaku.
          </p>
        </div>
        ` : ''}

        ${isBooking && booking?.attachments && booking.attachments.length > 0 ? `
        <!-- Page 2: Attachments for Room Booking -->
        <div style="page-break-before: always; padding-top: 40px;">
          <h3 style="text-align: center; margin-bottom: 20px; font-size: 14pt;">LAMPIRAN</h3>
          <h4 style="text-align: center; margin-bottom: 30px; font-size: 12pt;">Dokumen Pendukung Peminjaman Ruangan</h4>
          
          <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
            ${booking.attachments.map((att: string, idx: number) => {
      if (att.startsWith('data:image') || att.includes('.jpg') || att.includes('.png') || att.includes('.jpeg')) {
        return `
                <div style="text-align: center; margin-bottom: 20px;">
                  <p style="margin-bottom: 10px; font-weight: bold;">Lampiran ${idx + 1}</p>
                  <img src="${att}" alt="Lampiran ${idx + 1}" style="max-width: 300px; max-height: 400px; border: 1px solid #ccc;" />
                </div>
                `;
      } else if (att.startsWith('data:application/pdf') || att.includes('.pdf')) {
        return `
                <div style="text-align: center; margin-bottom: 20px;">
                  <p style="margin-bottom: 10px; font-weight: bold;">Lampiran ${idx + 1} (PDF)</p>
                  <p style="color: #666; font-style: italic;">Dokumen PDF terlampir</p>
                </div>
                `;
      } else {
        return `
                <div style="text-align: center; margin-bottom: 20px;">
                  <p style="margin-bottom: 10px; font-weight: bold;">Lampiran ${idx + 1}</p>
                  <p style="color: #666; font-style: italic;">Dokumen terlampir</p>
                </div>
                `;
      }
    }).join('')}
          </div>

          <p style="margin-top: 30px; font-size: 11pt;">
            <strong>Keterangan:</strong> Dokumen di atas merupakan bukti pendukung permohonan peminjaman ruangan.
          </p>
        </div>
        ` : ''}

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Check if submit button should be enabled
  const isSubmitEnabled = selectedRecords.length > 0 && attachments.length > 0 && !loading && !isThrottling;

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
                  {getText('Submit permit documents for your pending requests', 'Kirim dokumen izin untuk permintaan yang masih menunggu')}
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{allRecords.length}</div>
                <div className="text-sm text-gray-500">
                  {getText('Pending Records', 'Data Menunggu')}
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
                  {getText('Select Pending Records', 'Pilih Data Menunggu')}
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
                            ? getText('No pending records available', 'Tidak ada data menunggu tersedia')
                            : getText('No records match your search', 'Tidak ada data yang cocok dengan pencarian')
                          }
                        </p>
                        <p className="text-sm text-gray-400">
                          {allRecords.length === 0
                            ? getText('All your requests may already have permit documents or are approved', 'Semua permintaan Anda mungkin sudah memiliki dokumen izin atau sudah disetujui')
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
                              className={`w-full text-left p-4 cursor-pointer rounded-xl border transition-all duration-200 mb-2 last:mb-0 ${isSelected
                                ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/50'
                                : 'hover:bg-amber-50 border-transparent hover:border-amber-200'
                                }`}
                            >
                              <div className="flex items-start space-x-3">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => { }}
                                    className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded mr-3"
                                  />
                                  <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${record.record_type === 'booking'
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
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${record.record_type === 'booking'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-purple-100 text-purple-800'
                                        }`}>
                                        {record.record_type === 'booking' ? getText('Room Booking', 'Pemesanan Ruangan') : getText('Tool Lending', 'Peminjaman Alat')}
                                      </span>
                                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        {getText('Pending', 'Menunggu')}
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

          {/* Right Column - Permit Form with Tabs */}
          <div className="lg:col-span-2 relative z-10">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">

              {/* Tab Switcher */}
              <div className="flex space-x-2 mb-6">
                <button
                  type="button"
                  onClick={() => setTabMode('generate')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${tabMode === 'generate'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <FileText className="h-4 w-4" />
                  {getText('Generate Letter', 'Buat Surat')}
                </button>
                <button
                  type="button"
                  onClick={() => setTabMode('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${tabMode === 'upload'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <Upload className="h-4 w-4" />
                  {getText('Upload Document', 'Unggah Dokumen')}
                </button>
              </div>

              {/* Tab Content: Generate Letter */}
              {tabMode === 'generate' && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {getText('Generate Permit Letter', 'Buat Surat Izin')}
                    </h2>
                  </div>

                  {/* Letter Form */}
                  <div className="space-y-4">
                    {/* Subject & Attachments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Subject (Hal)', 'Hal')}
                        </label>
                        <input
                          type="text"
                          value={letterData.subject}
                          onChange={(e) => setLetterData({ ...letterData, subject: e.target.value })}
                          placeholder={getText('e.g., Permohonan Peminjaman Ruangan', 'cth., Permohonan Peminjaman Ruangan')}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Attachments Count', 'Lampiran')}
                        </label>
                        <input
                          type="text"
                          value={letterData.attachment_count}
                          onChange={(e) => setLetterData({ ...letterData, attachment_count: e.target.value })}
                          placeholder={getText('e.g., 1 lembar', 'cth., 1 lembar')}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Activity - Manual Input */}
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                      <h3 className="text-lg font-semibold text-purple-900 mb-3">
                        {getText('Activity Details', 'Detail Kegiatan')}
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {getText('Activity / Purpose (Manual Input)', 'Kegiatan / Tujuan (Isi Manual)')}
                          </label>
                          <input
                            type="text"
                            value={letterData.activity}
                            onChange={(e) => setLetterData({ ...letterData, activity: e.target.value })}
                            placeholder={getText('e.g., Praktikum Mekatronika', 'cth., Praktikum Mekatronika')}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {getText('Location / Destination (for tool lending)', 'Lokasi / Tujuan Peminjaman (untuk peminjaman alat)')}
                          </label>
                          <input
                            type="text"
                            value={letterData.location}
                            onChange={(e) => setLetterData({ ...letterData, location: e.target.value })}
                            placeholder={getText('e.g., Lab Mekatronika Lt.2', 'cth., Lab Mekatronika Lt.2')}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <p className="text-xs text-purple-600 mt-1">
                            {getText('* Required for tool lending (where will the equipment be used?)', '* Wajib untuk peminjaman alat (alat akan dibawa/digunakan di mana?)')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Recipient Section */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <h3 className="text-lg font-semibold text-amber-900 mb-3">
                        {getText('Recipient (Penerima)', 'Penerima Surat')}
                      </h3>
                      <div className="space-y-3">
                        {/* Role Filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {getText('Filter by Role', 'Filter berdasarkan Jabatan')}
                          </label>
                          <select
                            value={selectedRecipientRole}
                            onChange={(e) => {
                              setSelectedRecipientRole(e.target.value);
                              setSelectedRecipient(null);
                              setRecipientSearchTerm('');
                            }}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          >
                            {recipientRoleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* User Search Dropdown */}
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {getText('Select Recipient', 'Pilih Penerima')}
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={recipientSearchTerm}
                              onChange={(e) => {
                                setRecipientSearchTerm(e.target.value);
                                setShowRecipientDropdown(true);
                              }}
                              onFocus={() => setShowRecipientDropdown(true)}
                              placeholder={getText('Search recipient name...', 'Cari nama penerima...')}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent pr-10"
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          </div>

                          {/* Dropdown List */}
                          {showRecipientDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                              {allUsers
                                .filter(user =>
                                  user.role === selectedRecipientRole &&
                                  user.full_name.toLowerCase().includes(recipientSearchTerm.toLowerCase())
                                )
                                .slice(0, 10)
                                .map((user) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedRecipient({
                                        id: user.id,
                                        full_name: user.full_name,
                                        role: user.role,
                                        identity_number: user.identity_number,
                                        study_program_name: user.study_program_name,
                                      });
                                      setRecipientSearchTerm(user.full_name);
                                      setShowRecipientDropdown(false);
                                    }}
                                    className="w-full px-4 py-3 text-left hover:bg-amber-50 transition-colors border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-900">{user.full_name}</div>
                                    <div className="text-sm text-gray-500 flex gap-2">
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                                        {roleDisplayMap[user.role] || user.role}
                                      </span>
                                      {user.study_program_name && (
                                        <span>{user.study_program_name}</span>
                                      )}
                                    </div>
                                  </button>
                                ))
                              }
                              {allUsers.filter(user =>
                                user.role === selectedRecipientRole &&
                                user.full_name.toLowerCase().includes(recipientSearchTerm.toLowerCase())
                              ).length === 0 && (
                                  <div className="px-4 py-3 text-gray-500 text-center">
                                    {getText('No users found with this role', 'Tidak ada pengguna dengan role ini')}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>

                        {/* Selected Recipient Display */}
                        {selectedRecipient && (
                          <div className="bg-white border border-amber-300 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">{selectedRecipient.full_name}</div>
                              <div className="text-sm text-gray-500">
                                {roleDisplayMap[selectedRecipient.role] || selectedRecipient.role}
                                {selectedRecipient.study_program_name && ` - ${selectedRecipient.study_program_name}`}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecipient(null);
                                setRecipientSearchTerm('');
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Applicant Section - Auto-filled */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <h3 className="text-lg font-semibold text-blue-900 mb-3">
                        {getText('Applicant (Pemohon)', 'Data Pemohon')}
                        <span className="ml-2 text-sm font-normal text-blue-600">
                          {getText('(Auto from selected record)', '(Otomatis dari data)')}
                        </span>
                      </h3>

                      {applicantUser ? (
                        <div className="space-y-4">
                          {/* Applicant Info */}
                          <div className="bg-white border border-blue-300 rounded-xl p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  {getText('Name', 'Nama')}
                                </label>
                                <div className="font-medium text-gray-900">{applicantUser.full_name}</div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  {getText('Role', 'Jabatan')}
                                </label>
                                <div className="font-medium text-gray-900">
                                  {roleDisplayMap[applicantUser.role] || applicantUser.role}
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  {getText('Study Program', 'Program Studi')}
                                </label>
                                <div className="font-medium text-gray-900">
                                  {applicantUser.study_program_name || '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Signature Pad */}
                          <div className="bg-white border border-blue-300 rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-blue-900 mb-3">
                              {getText('Digital Signature', 'Tanda Tangan Digital')}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Draw Signature */}
                              <div>
                                <p className="text-xs text-gray-600 mb-2">
                                  {getText('Draw your signature:', 'Gambar tanda tangan:')}
                                </p>
                                <div className="border-2 border-dashed border-blue-300 rounded-xl bg-white p-1">
                                  <canvas
                                    ref={signatureCanvasRef}
                                    width={280}
                                    height={100}
                                    className="w-full bg-white rounded-lg cursor-crosshair touch-none"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={clearSignature}
                                  className="mt-2 text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                                >
                                  <X className="h-3 w-3" />
                                  {getText('Clear Signature', 'Hapus Tanda Tangan')}
                                </button>
                              </div>

                              {/* Upload Signature */}
                              <div>
                                <p className="text-xs text-gray-600 mb-2">
                                  {getText('Or upload signature image:', 'Atau unggah gambar tanda tangan:')}
                                </p>
                                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-blue-300 rounded-xl bg-white cursor-pointer hover:bg-blue-50 transition-colors">
                                  {applicantSignature ? (
                                    <img
                                      src={applicantSignature}
                                      alt="Signature"
                                      className="max-h-24 max-w-full object-contain"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <Upload className="h-6 w-6 text-blue-400 mb-1" />
                                      <span className="text-xs text-gray-500">
                                        {getText('Upload PNG/JPG', 'Upload PNG/JPG')}
                                      </span>
                                    </div>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSignatureUpload}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-center text-gray-500">
                          {getText('Select a pending record to auto-fill applicant data', 'Pilih data menunggu untuk mengisi data pemohon otomatis')}
                        </div>
                      )}
                    </div>

                    {/* Generate Button */}
                    <div className="pt-4">
                      <button
                        type="button"
                        disabled={selectedRecords.length === 0}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-4 font-semibold rounded-xl transition-all ${selectedRecords.length > 0
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 shadow-lg'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        onClick={handlePrintLetter}
                      >
                        <FileText className="h-5 w-5" />
                        <span>{getText('Generate & Print Letter', 'Buat & Cetak Surat')}</span>
                      </button>
                    </div>

                    {selectedRecords.length === 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <div className="flex items-center space-x-2">
                          <Search className="h-5 w-5 text-yellow-600" />
                          <p className="text-sm text-yellow-800 font-medium">
                            {getText('Please select at least one pending record from the left panel', 'Silakan pilih setidaknya satu data menunggu dari panel kiri')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab Content: Upload Document */}
              {tabMode === 'upload' && (
                <>
                  <div className="flex items-center space-x-3 mb-8">
                    <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
                      <Upload className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {getText('Upload Permit Documents', 'Unggah Dokumen Izin')}
                    </h2>
                  </div>

                  <form onSubmit={form.handleSubmit((data) => throttledSubmit(() => handleSubmit(data)))} className="space-y-8">
                    {/* Selected Records Display */}
                    {selectedRecords.length > 0 && (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-6">
                        <div className="flex items-center space-x-3 mb-6">
                          <Check className="h-6 w-6 text-amber-600" />
                          <h3 className="text-xl font-bold text-amber-900">
                            {getText('Selected Pending Records', 'Data Menunggu Terpilih')}
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {selectedRecords.map((record) => (
                            <div key={record.id} className={`border rounded-xl p-4 ${record.record_type === 'booking'
                              ? 'bg-gradient-to-r from-amber-100 to-orange-100 border-amber-200'
                              : 'bg-gradient-to-r from-purple-100 to-indigo-100 border-purple-200'
                              }`}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3">
                                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${record.record_type === 'booking'
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
                                      <div className="flex items-center space-x-2">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${record.record_type === 'booking'
                                          ? 'bg-amber-200 text-amber-800'
                                          : 'bg-purple-200 text-purple-800'
                                          }`}>
                                          {record.record_type === 'booking' ? getText('Room Booking', 'Pemesanan Ruangan') : getText('Tool Lending', 'Peminjaman Alat')}
                                        </span>
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
                                          {getText('Pending Approval', 'Menunggu Persetujuan')}
                                        </span>
                                      </div>
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
                        className={`flex-1 flex items-center justify-center space-x-3 px-8 py-4 font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 transition-all duration-200 shadow-lg ${isSubmitEnabled
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 hover:shadow-xl cursor-pointer'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                      >
                        {loading || isThrottling ? (
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
                            {getText('Please select at least one pending record and upload a permit document', 'Silakan pilih setidaknya satu data menunggu dan unggah dokumen izin')}
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
                              <span>{getText('Documents will be attached to your pending requests', 'Dokumen akan dilampirkan ke permintaan yang menunggu')}</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <span>{getText('Admin will review your permit and approve/reject your request', 'Admin akan meninjau izin Anda dan menyetujui/menolak permintaan')}</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default PermitLetter;