import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar,
  Clock,
  Users,
  Building,
  MapPin,
  Package,
  User,
  Phone,
  Mail,
  Hash,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Zap,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  Plus,
  Minus,
  Globe,
  Star,
  Award,
  Target,
  Lightbulb,
  Heart,
  Shield,
  Sparkles,
  GraduationCap,
  FileText,
  Camera,
  Upload,
  Download,
  Settings,
  Info,
  HelpCircle,
  CheckSquare,
  XCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  Signal,
  Bluetooth,
  Headphones,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Desktop,
  Server,
  Database,
  Cloud,
  CloudOff,
  Lock,
  Unlock,
  Key,
  Fingerprint,
  CreditCard,
  Banknote,
  Coins,
  Wallet,
  ShoppingCart,
  ShoppingBag,
  Gift,
  Tag,
  Bookmark,
  Flag,
  Bell,
  BellOff,
  MessageSquare,
  MessageCircle,
  Send,
  Inbox,
  Archive,
  Trash,
  Edit,
  Edit2,
  Edit3,
  Save,
  Copy,
  Cut,
  Paste,
  Scissors,
  PenTool,
  Brush,
  Palette,
  Image,
  Camera as CameraIcon,
  Film,
  Music,
  Headphones as HeadphonesIcon,
  Radio,
  Tv,
  GameController2,
  Gamepad,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Puzzle,
  Target as TargetIcon,
  Crosshair,
  Scope,
  Zap as ZapIcon,
  Flame,
  Droplet,
  Snowflake,
  Sun,
  Moon,
  CloudRain,
  CloudSnow,
  Wind,
  Tornado,
  Umbrella,
  Rainbow,
  Thermometer,
  Gauge,
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart,
  BarChart2,
  BarChart3,
  PieChart,
  LineChart,
  ScatterChart,
  Map,
  MapPin as MapPinIcon,
  Navigation,
  Compass,
  Route,
  Car,
  Truck,
  Bus,
  Train,
  Plane,
  Ship,
  Bike,
  Scooter,
  Motorcycle,
  Fuel,
  BatteryCharging,
  Plug,
  Power,
  PowerOff,
  RotateCcw,
  RotateCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipForward as SkipForwardIcon,
  SkipBack as SkipBackIcon,
  FastForward,
  Rewind,
  Play,
  Pause,
  Square,
  Circle,
  Triangle,
  Hexagon,
  Octagon,
  Pentagon,
  Star as StarIcon,
  Heart as HeartIcon,
  Diamond,
  Spade,
  Club,
  Hash as HashIcon,
  AtSign,
  Percent,
  DollarSign,
  Euro,
  Pound,
  Yen,
  Ruble,
  IndianRupee,
  Bitcoin,
  Banknote as BanknoteIcon,
  CreditCard as CreditCardIcon,
  Wallet as WalletIcon,
  PiggyBank,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Calculator,
  Abacus,
  Binary,
  Code,
  Code2,
  CodeSquare,
  Terminal,
  Command,
  Option,
  Alt,
  Shift,
  Ctrl,
  Space,
  Enter,
  Backspace,
  Delete,
  Tab,
  CapsLock,
  NumLock,
  ScrollLock,
  PrintScreen,
  Insert,
  Home,
  End,
  PageUp,
  PageDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ArrowLeftRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  Move,
  Move3d,
  MousePointer,
  MousePointer2,
  Hand,
  Grab,
  GrabHand,
  Pointer,
  Click,
  Touch,
  Swipe,
  Pinch,
  Zoom,
  ZoomIn,
  ZoomOut,
  Maximize,
  Maximize2,
  Minimize,
  Minimize2,
  Expand,
  Shrink,
  FullScreen,
  ExitFullScreen,
  PictureInPicture,
  PictureInPicture2,
  ScanLine,
  QrCode,
  Barcode,
  ScanBarcode,
  ScanText,
  ScanFace,
  ScanEye,
  Scan,
  Search as SearchIcon,
  SearchCheck,
  SearchCode,
  SearchSlash,
  SearchX,
  Filter as FilterIcon,
  FilterX,
  Sort,
  SortAsc,
  SortDesc,
  ArrowUpAZ,
  ArrowDownAZ,
  ArrowUpZA,
  ArrowDownZA,
  ArrowUp01,
  ArrowDown01,
  ArrowUp10,
  ArrowDown10,
  List,
  ListChecks,
  ListEnd,
  ListFilter,
  ListMinus,
  ListMusic,
  ListOrdered,
  ListPlus,
  ListRestart,
  ListStart,
  ListTodo,
  ListTree,
  ListVideo,
  ListX,
  Grid,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  LayoutList,
  LayoutDashboard,
  Layout,
  LayoutTemplate,
  Columns,
  Rows,
  Table,
  Table2,
  TableProperties,
  Sidebar,
  SidebarClose,
  SidebarOpen,
  PanelBottom,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  PanelTop,
  PanelTopClose,
  PanelTopOpen,
  SeparatorHorizontal,
  SeparatorVertical,
  Split,
  SplitSquareHorizontal,
  SplitSquareVertical,
  Combine,
  Group,
  Ungroup,
  Layers,
  Layers2,
  Layers3,
  Stack,
  Stack2,
  Stack3,
  Package as PackageIcon,
  Package2,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  PackagePlus,
  PackageSearch,
  PackageX,
  Box,
  Boxes,
  Container,
  Archive as ArchiveIcon,
  ArchiveRestore,
  ArchiveX,
  Folder,
  FolderArchive,
  FolderCheck,
  FolderClosed,
  FolderEdit,
  FolderHeart,
  FolderInput,
  FolderKey,
  FolderLock,
  FolderMinus,
  FolderOpen,
  FolderOutput,
  FolderPlus,
  FolderRoot,
  FolderSearch,
  FolderSymlink,
  FolderTree,
  FolderUp,
  FolderX,
  File,
  FileArchive,
  FileAudio,
  FileAudio2,
  FileAxis3d,
  FileBadge,
  FileBadge2,
  FileBarChart,
  FileBarChart2,
  FileBox,
  FileCheck,
  FileCheck2,
  FileClock,
  FileCode,
  FileCode2,
  FileCog,
  FileCog2,
  FileDiff,
  FileDigit,
  FileDown,
  FileEdit,
  FileHeart,
  FileImage,
  FileInput,
  FileKey,
  FileKey2,
  FileLock,
  FileLock2,
  FileMinus,
  FileMinus2,
  FileMusic,
  FileOutput,
  FilePenLine,
  FilePlus,
  FilePlus2,
  FileQuestion,
  FileScan,
  FileSearch,
  FileSearch2,
  FileSpreadsheet,
  FileStack,
  FileSymlink,
  FileTerminal,
  FileText as FileTextIcon,
  FileType,
  FileType2,
  FileUp,
  FileVideo,
  FileVideo2,
  FileVolume,
  FileVolume2,
  FileWarning,
  FileX,
  FileX2,
  Files,
  Paperclip,
  Link,
  Link2,
  Link2Off,
  LinkBreak,
  LinkBreak2,
  Unlink,
  Unlink2,
  ExternalLink,
  Share,
  Share2,
  ShareIcon,
  Forward,
  Reply,
  ReplyAll,
  Import,
  Export,
  Download as DownloadIcon,
  Upload as UploadIcon,
  CloudDownload,
  CloudUpload,
  Inbox as InboxIcon,
  Outbox,
  Send as SendIcon,
  SendHorizontal,
  SendToBack,
  BringToFront,
  FlipHorizontal,
  FlipVertical,
  RotateCcw as RotateCcwIcon,
  RotateCw as RotateCwIcon,
  Rotate3d,
  Scale,
  Scale3d,
  Resize,
  Crop,
  Scissors as ScissorsIcon,
  PenTool as PenToolIcon,
  Brush as BrushIcon,
  Palette as PaletteIcon,
  Pipette,
  Eyedropper,
  Paintbrush,
  Paintbrush2,
  Spray,
  Eraser,
  Highlighter,
  Marker,
  Pen,
  Pencil,
  PencilLine,
  PencilRuler,
  Ruler,
  Triangle as TriangleIcon,
  Square as SquareIcon,
  Circle as CircleIcon,
  Hexagon as HexagonIcon,
  Octagon as OctagonIcon,
  Pentagon as PentagonIcon,
  Shapes,
  Spline,
  Bezier,
  Vector,
  Anchor,
  Magnet,
  Crosshair as CrosshairIcon,
  Target as TargetIcon2,
  Focus,
  Scan as ScanIcon,
  ScanLine as ScanLineIcon,
  Grid as GridIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  DistributeHorizontal,
  DistributeVertical,
  FlipHorizontal2,
  FlipVertical2,
  WrapText,
  Type,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Paragraph,
  Text,
  TextCursor,
  TextCursorInput,
  TextQuote,
  TextSelect,
  CaseLower,
  CaseUpper,
  CaseSensitive,
  Strikethrough,
  Underline,
  Italic,
  Bold,
  Subscript,
  Superscript,
  Quote,
  IndentDecrease,
  IndentIncrease,
  ListOrdered as ListOrderedIcon,
  List as ListIcon,
  CheckSquare as CheckSquareIcon,
  Square as SquareIcon2,
  Minus,
  Plus as PlusIcon,
  Equal,
  NotEqual,
  Approximately,
  Infinity,
  Pi,
  Sigma,
  Radical,
  Integral,
  Function,
  Variable,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Fraction,
  Percent as PercentIcon,
  PercentCircle,
  PercentDiamond,
  PercentSquare,
  Hash as HashIcon2,
  AtSign as AtSignIcon,
  Ampersand,
  Asterisk,
  Backslash,
  Slash,
  Pipe,
  Tilde,
  Caret,
  Grave,
  Acute,
  Circumflex,
  Diaeresis,
  Cedilla,
  Macron,
  Breve,
  DotAbove,
  RingAbove,
  DoubleAcute,
  Caron,
  Ogonek,
  Hook,
  Horn,
  Stroke,
  Dot,
  Comma,
  Semicolon,
  Colon,
  Exclamation,
  Question,
  Interrobang,
  Section,
  Paragraph as ParagraphIcon,
  Pilcrow,
  Copyright,
  Registered,
  Trademark,
  Degree,
  Minute,
  Second,
  Prime,
  DoublePrime,
  TriplePrime,
  Celsius,
  Fahrenheit,
  Kelvin,
  Ohm,
  Micro,
  Mho,
  Alpha,
  Beta,
  Gamma,
  Delta,
  Epsilon,
  Zeta,
  Eta,
  Theta,
  Iota,
  Kappa,
  Lambda,
  Mu,
  Nu,
  Xi,
  Omicron,
  Pi as PiIcon,
  Rho,
  Sigma as SigmaIcon,
  Tau,
  Upsilon,
  Phi,
  Chi,
  Psi,
  Omega,
  Aleph,
  Beth,
  Gimel,
  Daleth,
  He,
  Vav,
  Zayin,
  Het,
  Tet,
  Yod,
  Kaf,
  Lamed,
  Mem,
  Nun,
  Samekh,
  Ayin,
  Pe,
  Tsadi,
  Qof,
  Resh,
  Shin,
  Tav,
  FinalKaf,
  FinalMem,
  FinalNun,
  FinalPe,
  FinalTsadi
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { alert } from '../components/Alert/AlertHelper';
import { format, isSameDay, parseISO, isAfter, isBefore, isEqual } from 'date-fns';

// Form validation schema
const bookingSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
  class_type: z.enum(['theory', 'practical']),
  equipment_requested: z.array(z.string()).optional(),
  notes: z.string().optional(),
  full_name: z.string().min(2, 'Full name is required'),
  identity_number: z.string().min(5, 'Identity number is required'),
  phone_number: z.string().min(10, 'Phone number is required'),
  email: z.string().email('Valid email is required').optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

interface Room {
  id: string;
  name: string;
  code: string;
  capacity: number;
  department_id: string;
  equipment: string[];
  is_available: boolean;
  created_at: string;
  updated_at: string;
  department?: {
    name: string;
  };
  status?: 'available' | 'in_use' | 'scheduled';
  schedule_details?: any;
}

interface Equipment {
  id: string;
  name: string;
  code: string;
  category: string;
  is_mandatory: boolean;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  full_name: string;
  identity_number: string;
  phone_number?: string;
  email?: string;
  role: string;
  department_id?: string;
  study_program_id?: string;
}

const BookRoom: React.FC = () => {
  const { user } = useAuth();
  const { getText, currentLanguage } = useLanguage();
  
  // Form state
  const [currentStep, setCurrentStep] = useState(1);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDetails, setScheduleDetails] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [departments, setDepartments] = useState<any[]>([]);
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      sks: 1,
      class_type: 'theory',
      equipment_requested: [],
      notes: '',
    },
  });

  // Watch form values for real-time updates
  const watchedDate = form.watch('date');
  const watchedStartTime = form.watch('start_time');
  const watchedEndTime = form.watch('end_time');

  useEffect(() => {
    fetchEquipment();
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (watchedDate && watchedStartTime && watchedEndTime) {
      fetchRoomsWithStatus();
    }
  }, [watchedDate, watchedStartTime, watchedEndTime]);

  // Auto-fill user data if logged in
  useEffect(() => {
    if (user) {
      form.setValue('full_name', user.full_name);
      form.setValue('identity_number', user.identity_number);
      form.setValue('phone_number', user.phone_number || '');
      form.setValue('email', user.email || '');
    }
  }, [user, form]);

  const fetchEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      alert.error(
        getText('Failed to load equipment', 'Gagal memuat peralatan'),
        getText('Please try again later', 'Silakan coba lagi nanti')
      );
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  // MAIN FUNCTION: Get room status based on your rules
  const getRoomStatus = async (roomId: string, date: string, startTime: string, endTime: string) => {
    try {
      const selectedDate = new Date(date);
      const selectedStartDateTime = new Date(`${date}T${startTime}`);
      const selectedEndDateTime = new Date(`${date}T${endTime}`);
      const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

      // 1. Check if room is booked (bookings table)
      const { data: bookings, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('room_id', roomId)
        .in('status', ['approved', 'pending'])
        .gte('start_time', `${date}T00:00:00`)
        .lt('start_time', `${date}T23:59:59`);

      if (bookingError) throw bookingError;

      if (bookings && bookings.length > 0) {
        for (const booking of bookings) {
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);
          
          // Check for time overlap
          if (
            (selectedStartDateTime >= bookingStart && selectedStartDateTime < bookingEnd) ||
            (selectedEndDateTime > bookingStart && selectedEndDateTime <= bookingEnd) ||
            (selectedStartDateTime <= bookingStart && selectedEndDateTime >= bookingEnd)
          ) {
            return {
              status: 'in_use' as const,
              details: booking
            };
          }
        }
      }

      // 2. Check lecture schedules
      const { data: lectures, error: lectureError } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('room', roomId)
        .ilike('day', dayName);

      if (lectureError) throw lectureError;

      if (lectures && lectures.length > 0) {
        for (const lecture of lectures) {
          if (lecture.start_time && lecture.end_time) {
            const lectureStart = new Date(`${date}T${lecture.start_time}`);
            const lectureEnd = new Date(`${date}T${lecture.end_time}`);
            
            // Check for time overlap
            if (
              (selectedStartDateTime >= lectureStart && selectedStartDateTime < lectureEnd) ||
              (selectedEndDateTime > lectureStart && selectedEndDateTime <= lectureEnd) ||
              (selectedStartDateTime <= lectureStart && selectedEndDateTime >= lectureEnd)
            ) {
              return {
                status: 'scheduled' as const,
                details: lecture,
                type: 'lecture'
              };
            }
          }
        }
      }

      // 3. Check exams
      const { data: exams, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', date);

      if (examError) throw examError;

      if (exams && exams.length > 0) {
        for (const exam of exams) {
          if (exam.start_time && exam.end_time) {
            const examStart = new Date(`${date}T${exam.start_time}`);
            const examEnd = new Date(`${date}T${exam.end_time}`);
            
            // Check for time overlap
            if (
              (selectedStartDateTime >= examStart && selectedStartDateTime < examEnd) ||
              (selectedEndDateTime > examStart && selectedEndDateTime <= examEnd) ||
              (selectedStartDateTime <= examStart && selectedEndDateTime >= examEnd)
            ) {
              return {
                status: 'scheduled' as const,
                details: exam,
                type: 'exam'
              };
            }
          }
        }
      }

      // 4. Check final sessions
      const { data: finalSessions, error: finalSessionError } = await supabase
        .from('final_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', date);

      if (finalSessionError) throw finalSessionError;

      if (finalSessions && finalSessions.length > 0) {
        for (const session of finalSessions) {
          if (session.start_time && session.end_time) {
            const sessionStart = new Date(`${date}T${session.start_time}`);
            const sessionEnd = new Date(`${date}T${session.end_time}`);
            
            // Check for time overlap
            if (
              (selectedStartDateTime >= sessionStart && selectedStartDateTime < sessionEnd) ||
              (selectedEndDateTime > sessionStart && selectedEndDateTime <= sessionEnd) ||
              (selectedStartDateTime <= sessionStart && selectedEndDateTime >= sessionEnd)
            ) {
              return {
                status: 'scheduled' as const,
                details: session,
                type: 'final_session'
              };
            }
          }
        }
      }

      // 5. If nothing found, room is available
      return {
        status: 'available' as const,
        details: null
      };

    } catch (error) {
      console.error('Error checking room status:', error);
      return {
        status: 'available' as const,
        details: null
      };
    }
  };

  const fetchRoomsWithStatus = async () => {
    if (!watchedDate || !watchedStartTime || !watchedEndTime) return;

    try {
      setRoomsLoading(true);

      // Only fetch rooms where is_available = true
      const { data: roomsData, error } = await supabase
        .from('rooms')
        .select(`
          *,
          department:departments(name)
        `)
        .eq('is_available', true)
        .order('name');

      if (error) throw error;

      // Get status for each room
      const roomsWithStatus = await Promise.all(
        (roomsData || []).map(async (room) => {
          const statusResult = await getRoomStatus(
            room.id,
            watchedDate,
            watchedStartTime,
            watchedEndTime
          );

          return {
            ...room,
            status: statusResult.status,
            schedule_details: statusResult.details,
            schedule_type: statusResult.type
          };
        })
      );

      setRooms(roomsWithStatus);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert.error(
        getText('Failed to load rooms', 'Gagal memuat ruangan'),
        getText('Please try again later', 'Silakan coba lagi nanti')
      );
    } finally {
      setRoomsLoading(false);
    }
  };

  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 3) {
      setFoundUsers([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`full_name.ilike.%${searchTerm}%,identity_number.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      setFoundUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setFoundUsers([]);
    }
  };

  const selectUser = (selectedUser: User) => {
    form.setValue('full_name', selectedUser.full_name);
    form.setValue('identity_number', selectedUser.identity_number);
    form.setValue('phone_number', selectedUser.phone_number || '');
    form.setValue('email', selectedUser.email || '');
    setShowUserSearch(false);
    setUserSearchTerm('');
    setFoundUsers([]);
  };

  const handleRoomSelect = (room: Room) => {
    if (room.status === 'available' || room.status === 'in_use') {
      setSelectedRoom(room);
      
      // Auto-detect equipment for chosen room
      if (room.equipment && room.equipment.length > 0) {
        setSelectedEquipment(room.equipment);
        form.setValue('equipment_requested', room.equipment);
      }
    } else if (room.status === 'scheduled') {
      // Show schedule details modal
      setScheduleDetails({
        ...room.schedule_details,
        type: room.schedule_type
      });
      setShowScheduleModal(true);
    }
  };

  const handleSubmit = async (data: BookingForm) => {
    if (!selectedRoom) {
      alert.error(
        getText('Please select a room', 'Silakan pilih ruangan'),
        getText('You must select a room before submitting', 'Anda harus memilih ruangan sebelum mengirim')
      );
      return;
    }

    try {
      setLoading(true);

      // If room is "in_use", mark the existing booking as "completed"
      if (selectedRoom.status === 'in_use' && selectedRoom.schedule_details) {
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'completed' })
          .eq('id', selectedRoom.schedule_details.id);

        if (updateError) throw updateError;
      }

      // Create new booking
      const bookingData = {
        user_id: user?.id || null,
        room_id: selectedRoom.id,
        start_time: `${data.date}T${data.start_time}`,
        end_time: `${data.date}T${data.end_time}`,
        purpose: data.purpose,
        sks: data.sks,
        class_type: data.class_type,
        equipment_requested: selectedEquipment,
        notes: data.notes,
        status: 'pending',
        user_info: user ? null : {
          full_name: data.full_name,
          identity_number: data.identity_number,
          phone_number: data.phone_number,
          email: data.email,
        },
      };

      const { error } = await supabase
        .from('bookings')
        .insert(bookingData);

      if (error) throw error;

      alert.success(
        getText('Booking submitted successfully!', 'Pemesanan berhasil dikirim!'),
        getText('Your booking request has been submitted and is pending approval', 'Permintaan pemesanan Anda telah dikirim dan menunggu persetujuan')
      );

      // Reset form
      form.reset();
      setSelectedRoom(null);
      setSelectedEquipment([]);
      setCurrentStep(1);

    } catch (error: any) {
      console.error('Error submitting booking:', error);
      alert.error(
        getText('Failed to submit booking', 'Gagal mengirim pemesanan'),
        error.message || getText('Please try again later', 'Silakan coba lagi nanti')
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_use':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return CheckCircle;
      case 'in_use':
        return XCircle;
      case 'scheduled':
        return Clock;
      default:
        return AlertCircle;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return getText('Available', 'Tersedia');
      case 'in_use':
        return getText('In Use', 'Sedang Digunakan');
      case 'scheduled':
        return getText('Scheduled', 'Terjadwal');
      default:
        return getText('Unknown', 'Tidak Diketahui');
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCapacity = capacityFilter === 'all' || 
                           (capacityFilter === 'small' && room.capacity <= 20) ||
                           (capacityFilter === 'medium' && room.capacity > 20 && room.capacity <= 50) ||
                           (capacityFilter === 'large' && room.capacity > 50);
    
    const matchesDepartment = departmentFilter === 'all' || room.department_id === departmentFilter;
    
    return matchesSearch && matchesCapacity && matchesDepartment;
  });

  const nextStep = () => {
    if (currentStep === 1) {
      const isValid = form.trigger(['date', 'start_time', 'end_time', 'purpose', 'sks', 'class_type']);
      if (isValid) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (selectedRoom) {
        setCurrentStep(3);
      } else {
        alert.warning(
          getText('Please select a room', 'Silakan pilih ruangan'),
          getText('You must select a room to continue', 'Anda harus memilih ruangan untuk melanjutkan')
        );
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            <Calendar className="w-4 h-4 mr-2" />
            {getText('Smart Room Booking', 'Pemesanan Ruangan Cerdas')}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            {getText('Book Your Perfect Space', 'Pesan Ruang Sempurna Anda')}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {getText('Reserve your ideal study or meeting space with our intelligent booking system', 'Pesan ruang belajar atau rapat ideal Anda dengan sistem pemesanan cerdas kami')}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-500'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-4">
            <div className="text-sm text-gray-600">
              {currentStep === 1 && getText('Booking Details', 'Detail Pemesanan')}
              {currentStep === 2 && getText('Select Room', 'Pilih Ruangan')}
              {currentStep === 3 && getText('User Information', 'Informasi Pengguna')}
            </div>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {/* Step 1: Booking Details */}
          {currentStep === 1 && (
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Calendar className="w-6 h-6 mr-3 text-blue-600" />
                {getText('Booking Details', 'Detail Pemesanan')}
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Date', 'Tanggal')} *
                  </label>
                  <input
                    {...form.register('date')}
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.date && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.date.message}</p>
                  )}
                </div>

                {/* Time Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Start Time', 'Waktu Mulai')} *
                    </label>
                    <input
                      {...form.register('start_time')}
                      type="time"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.start_time && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.start_time.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('End Time', 'Waktu Selesai')} *
                    </label>
                    <input
                      {...form.register('end_time')}
                      type="time"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.end_time && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.end_time.message}</p>
                    )}
                  </div>
                </div>

                {/* Purpose */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Purpose', 'Tujuan')} *
                  </label>
                  <input
                    {...form.register('purpose')}
                    type="text"
                    placeholder={getText('e.g., Database Systems Lecture', 'mis. Kuliah Sistem Basis Data')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.purpose && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.purpose.message}</p>
                  )}
                </div>

                {/* SKS and Class Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('SKS (Credits)', 'SKS (Kredit)')} *
                    </label>
                    <input
                      {...form.register('sks', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      max="6"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.sks && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.sks.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Class Type', 'Tipe Kelas')} *
                    </label>
                    <select
                      {...form.register('class_type')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="theory">{getText('Theory', 'Teori')}</option>
                      <option value="practical">{getText('Practical', 'Praktik')}</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Additional Notes', 'Catatan Tambahan')}
                  </label>
                  <textarea
                    {...form.register('notes')}
                    rows={3}
                    placeholder={getText('Any special requirements or notes...', 'Persyaratan khusus atau catatan...')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-8">
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <span>{getText('Next: Select Room', 'Selanjutnya: Pilih Ruangan')}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Room Selection */}
          {currentStep === 2 && (
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Building className="w-6 h-6 mr-3 text-blue-600" />
                  {getText('Select Room', 'Pilih Ruangan')}
                </h2>
                <button
                  type="button"
                  onClick={() => fetchRoomsWithStatus()}
                  disabled={roomsLoading}
                  className="flex items-center space-x-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200"
                >
                  <RefreshCw className={`w-4 h-4 ${roomsLoading ? 'animate-spin' : ''}`} />
                  <span>{getText('Refresh', 'Refresh')}</span>
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <input
                    type="text"
                    placeholder={getText('Search rooms...', 'Cari ruangan...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <select
                    value={capacityFilter}
                    onChange={(e) => setCapacityFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">{getText('All Capacities', 'Semua Kapasitas')}</option>
                    <option value="small">{getText('Small (≤20)', 'Kecil (≤20)')}</option>
                    <option value="medium">{getText('Medium (21-50)', 'Sedang (21-50)')}</option>
                    <option value="large">{getText('Large (>50)', 'Besar (>50)')}</option>
                  </select>
                </div>
                <div>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">{getText('All Departments', 'Semua Departemen')}</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Room Grid */}
              {roomsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mr-3" />
                  <span className="text-gray-600">{getText('Loading rooms...', 'Memuat ruangan...')}</span>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-12">
                  <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {getText('No rooms available', 'Tidak ada ruangan tersedia')}
                  </h3>
                  <p className="text-gray-600">
                    {getText('Try adjusting your search criteria or time slot', 'Coba sesuaikan kriteria pencarian atau slot waktu')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredRooms.map((room) => {
                    const StatusIcon = getStatusIcon(room.status || 'available');
                    const isSelected = selectedRoom?.id === room.id;
                    const canSelect = room.status === 'available' || room.status === 'in_use';
                    
                    return (
                      <div
                        key={room.id}
                        onClick={() => handleRoomSelect(room)}
                        className={`relative p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-lg'
                            : canSelect
                              ? 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                              : 'border-gray-200 hover:border-yellow-300'
                        }`}
                      >
                        {/* Status Badge */}
                        <div className={`absolute top-4 right-4 flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(room.status || 'available')}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{getStatusText(room.status || 'available')}</span>
                        </div>

                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">{room.name}</h3>
                          <p className="text-sm text-gray-600">{room.code}</p>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <Users className="w-4 h-4 mr-2" />
                            <span>{room.capacity} {getText('seats', 'kursi')}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="w-4 h-4 mr-2" />
                            <span>{room.department?.name || getText('No department', 'Tanpa departemen')}</span>
                          </div>
                          {room.equipment && room.equipment.length > 0 && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Package className="w-4 h-4 mr-2" />
                              <span>{room.equipment.length} {getText('equipment', 'peralatan')}</span>
                            </div>
                          )}
                        </div>

                        {room.status === 'scheduled' && (
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs text-yellow-800">
                              {getText('Click to view schedule details', 'Klik untuk melihat detail jadwal')}
                            </p>
                          </div>
                        )}

                        {room.status === 'in_use' && (
                          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs text-red-800">
                              {getText('Room is currently in use but can be booked', 'Ruangan sedang digunakan tapi masih bisa dipesan')}
                            </p>
                          </div>
                        )}

                        {isSelected && (
                          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-xl flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-blue-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Equipment Selection */}
              {selectedRoom && (
                <div className="mt-8 p-6 bg-gray-50 rounded-xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-blue-600" />
                    {getText('Equipment Selection', 'Pilihan Peralatan')}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {equipment.map((item) => (
                      <label key={item.id} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEquipment.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEquipment([...selectedEquipment, item.id]);
                            } else {
                              setSelectedEquipment(selectedEquipment.filter(id => id !== item.id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.category}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{getText('Back', 'Kembali')}</span>
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!selectedRoom}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <span>{getText('Next: User Info', 'Selanjutnya: Info Pengguna')}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: User Information */}
          {currentStep === 3 && (
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <User className="w-6 h-6 mr-3 text-blue-600" />
                {getText('User Information', 'Informasi Pengguna')}
              </h2>

              {/* User Search */}
              <div className="mb-6">
                <div className="flex items-center space-x-4 mb-4">
                  <button
                    type="button"
                    onClick={() => setShowUserSearch(!showUserSearch)}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                  >
                    <Search className="w-4 h-4" />
                    <span>{getText('Search Existing User', 'Cari Pengguna Terdaftar')}</span>
                  </button>
                  <span className="text-gray-500">{getText('or fill manually', 'atau isi manual')}</span>
                </div>

                {showUserSearch && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      placeholder={getText('Search by name or ID...', 'Cari berdasarkan nama atau ID...')}
                      value={userSearchTerm}
                      onChange={(e) => {
                        setUserSearchTerm(e.target.value);
                        searchUsers(e.target.value);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                    />
                    
                    {foundUsers.length > 0 && (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {foundUsers.map((foundUser) => (
                          <div
                            key={foundUser.id}
                            onClick={() => selectUser(foundUser)}
                            className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer"
                          >
                            <div className="font-medium text-gray-900">{foundUser.full_name}</div>
                            <div className="text-sm text-gray-600">{foundUser.identity_number}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Full Name', 'Nama Lengkap')} *
                  </label>
                  <input
                    {...form.register('full_name')}
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.full_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Identity Number', 'Nomor Identitas')} *
                  </label>
                  <input
                    {...form.register('identity_number')}
                    type="text"
                    placeholder={getText('NIM/NIP/NIK', 'NIM/NIP/NIK')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.identity_number && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.identity_number.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Phone Number', 'Nomor Telepon')} *
                  </label>
                  <input
                    {...form.register('phone_number')}
                    type="tel"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.phone_number && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.phone_number.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Email', 'Email')}
                  </label>
                  <input
                    {...form.register('email')}
                    type="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.email && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Booking Summary */}
              {selectedRoom && (
                <div className="mt-8 p-6 bg-blue-50 rounded-xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {getText('Booking Summary', 'Ringkasan Pemesanan')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{getText('Room:', 'Ruangan:')}</span>
                      <span className="ml-2">{selectedRoom.name} ({selectedRoom.code})</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Date:', 'Tanggal:')}</span>
                      <span className="ml-2">{watchedDate}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Time:', 'Waktu:')}</span>
                      <span className="ml-2">{watchedStartTime} - {watchedEndTime}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Purpose:', 'Tujuan:')}</span>
                      <span className="ml-2">{form.watch('purpose')}</span>
                    </div>
                    {selectedEquipment.length > 0 && (
                      <div className="md:col-span-2">
                        <span className="font-medium text-gray-700">{getText('Equipment:', 'Peralatan:')}</span>
                        <span className="ml-2">{selectedEquipment.length} {getText('items selected', 'item dipilih')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{getText('Back', 'Kembali')}</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>
                    {loading 
                      ? getText('Submitting...', 'Mengirim...') 
                      : getText('Submit Booking', 'Kirim Pemesanan')
                    }
                  </span>
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Schedule Details Modal */}
        {showScheduleModal && scheduleDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {getText('Schedule Details', 'Detail Jadwal')}
                </h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3">
                {scheduleDetails.type === 'lecture' && (
                  <>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Course:', 'Mata Kuliah:')}</span>
                      <span className="ml-2">{scheduleDetails.course_name || scheduleDetails.course_code}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Lecturer:', 'Dosen:')}</span>
                      <span className="ml-2">{scheduleDetails.lecturer}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Class:', 'Kelas:')}</span>
                      <span className="ml-2">{scheduleDetails.class}</span>
                    </div>
                  </>
                )}

                {scheduleDetails.type === 'exam' && (
                  <>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Course:', 'Mata Kuliah:')}</span>
                      <span className="ml-2">{scheduleDetails.course_name || scheduleDetails.course_code}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Students:', 'Mahasiswa:')}</span>
                      <span className="ml-2">{scheduleDetails.student_amount}</span>
                    </div>
                  </>
                )}

                {scheduleDetails.type === 'final_session' && (
                  <>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Title:', 'Judul:')}</span>
                      <span className="ml-2">{scheduleDetails.title}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{getText('Supervisor:', 'Pembimbing:')}</span>
                      <span className="ml-2">{scheduleDetails.supervisor}</span>
                    </div>
                  </>
                )}

                <div>
                  <span className="font-medium text-gray-700">{getText('Time:', 'Waktu:')}</span>
                  <span className="ml-2">{scheduleDetails.start_time} - {scheduleDetails.end_time}</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {getText('Close', 'Tutup')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookRoom;