import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Building,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Package,
  MapPin,
  Zap,
  BookOpen,
  Timer,
  Activity,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  Eye,
  Plus,
  Star,
  Award,
  Smartphone,
  Shield,
  ChevronRight,
  Play,
  GraduationCap,
  Wrench,
  ClipboardCheck,
  CalendarCheck,
  CheckSquare,
  FileText,
  Settings,
  User,
  Home,
  Target,
  BookMarked,
  Lightbulb,
  MessageSquare,
  Send,
  Camera,
  AlertTriangle,
  X,
  RefreshCw,
  Phone,
  Mail
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardStats {
  totalBookings: number;
  pendingBookings: number;
  availableRooms: number;
  totalUsers: number;
  todayBookings: number;
  equipmentAvailable: number;
  activeBookings: number;
  completedBookings: number;
}

interface RecentActivity {
  id: string;
  type: 'booking' | 'equipment' | 'approval' | 'checkout';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface User {
  role: 'super_admin' | 'department_admin' | 'student' | 'lecturer';
  full_name: string;
  department_id?: string;
}

interface DashboardProps {
  user?: User | null;
}

// Add interfaces for reports
interface PublicReport {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  location: string;
  reporter_name: string;
  is_anonymous: boolean;
  attachments: string[];
  created_at: string;
  updated_at: string;
}

interface ReportComment {
  id: string;
  report_id: string;
  commenter_name: string;
  commenter_email: string;
  comment: string;
  is_staff: boolean;
  created_at: string;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { getText } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 1247,
    pendingBookings: 23,
    availableRooms: 18,
    totalUsers: 450,
    todayBookings: 12,
    equipmentAvailable: 35,
    activeBookings: 8,
    completedBookings: 1180,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Handle scroll for animations
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);

    // Mock recent activity data
    const mockActivity: RecentActivity[] = [
      {
        id: '1',
        type: 'booking',
        message: 'Room A101 booked for Database Systems lecture',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        status: 'success'
      },
      {
        id: '2',
        type: 'equipment',
        message: 'Projector PROJ-001 returned successfully',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        status: 'success'
      },
      {
        id: '3',
        type: 'approval',
        message: 'Booking approval pending for Room B205',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        status: 'warning'
      }
    ];
    setRecentActivity(mockActivity);

    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

   const getQuickActions = () => {
    if (!user) {
      return [
        { icon: Home, label: getText('Dashboard', 'Dasbor'), path: '/', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', description: getText('View system overview', 'Lihat gambaran sistem') },
        { icon: Calendar, label: getText('Book Room', 'Pesan Ruangan'), path: '/book', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: getText('Reserve a room', 'Reservasi ruangan') },
        { icon: Package, label: getText('Tool Lending', 'Peminjaman Alat'), path: '/tools', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: getText('Borrow equipment', 'Pinjam peralatan') },
        { icon: CheckCircle, label: getText('Check Out', 'Pengembalian'), path: '/checkout', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: getText('Return items', 'Kembalikan barang') },
      ];
    }

    if (user.role === 'super_admin') {
      return [
        { icon: BarChart3, label: getText('System Analytics', 'Analitik Sistem'), path: '/', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', description: getText('View detailed analytics', 'Lihat analitik detail') },
        { icon: Building, label: getText('Room Management', 'Manajemen Ruangan'), path: '/rooms', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: getText('Manage rooms', 'Kelola ruangan') },
        { icon: Users, label: getText('User Management', 'Manajemen Pengguna'), path: '/users', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: getText('Manage users', 'Kelola pengguna') },
        { icon: Calendar, label: getText('Booking Management', 'Manajemen Pemesanan'), path: '/bookings', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: getText('Handle bookings', 'Tangani pemesanan') },
        { icon: ClipboardCheck, label: getText('Validation Queue', 'Antrian Validasi'), path: '/validation', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100', description: getText('Validate returns', 'Validasi pengembalian') },
        { icon: MapPin, label: getText('Departments', 'Departemen'), path: '/departments', color: 'text-pink-600 bg-pink-50 hover:bg-pink-100', description: getText('Manage departments', 'Kelola departemen') },
        { icon: GraduationCap, label: getText('Study Programs', 'Program Studi'), path: '/study-programs', color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', description: getText('Manage programs', 'Kelola program') },
        { icon: FileText, label: getText('Reports', 'Laporan'), path: '/reports', color: 'text-cyan-600 bg-cyan-50 hover:bg-cyan-100', description: getText('Generate reports', 'Buat laporan') },
      ];
    }

    if (user.role === 'department_admin') {
      return [
        { icon: PieChart, label: getText('Dashboard', 'Dasbor'), path: '/', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', description: getText('Department overview', 'Gambaran departemen') },
        { icon: CalendarCheck, label: getText('Exam Management', 'Manajemen Ujian'), path: '/exams', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: getText('Manage exam schedules', 'Kelola jadwal ujian') },
        { icon: Users, label: getText('User Management', 'Manajemen Pengguna'), path: '/users', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: getText('Manage department users', 'Kelola pengguna departemen') },
        { icon: User, label: getText('Profile', 'Profil'), path: '/profile', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: getText('Update profile', 'Perbarui profil') },
      ];
    }

    // Student and lecturer
    return [
      { icon: Home, label: getText('Dashboard', 'Dasbor'), path: '/', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', description: getText('View overview', 'Lihat gambaran') },
      { icon: Calendar, label: getText('Book Room', 'Pesan Ruangan'), path: '/book', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: getText('Reserve a room', 'Reservasi ruangan') },
      { icon: Package, label: getText('Tool Lending', 'Peminjaman Alat'), path: '/tools', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: getText('Borrow equipment', 'Pinjam peralatan') },
      { icon: CheckCircle, label: getText('Check Out', 'Pengembalian'), path: '/checkout', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: getText('Return items', 'Kembalikan barang') },
      { icon: User, label: getText('Profile', 'Profil'), path: '/profile', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100', description: getText('Update profile', 'Perbarui profil') },
    ];
  };

  const quickActions = getQuickActions();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-white via-orange-100 to-amber-200 overflow-hidden" style={{background: 'linear-gradient(to bottom right, #ffffff, #f3e8d9, #daa06d)'}}>
        {/* Background Faded Abstract Shapes with Glassmorphism */}
        <div className="absolute inset-0">
          {/* Large abstract shape - top right */}
          <div 
            className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-60 backdrop-blur-xl filter blur-sm"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #daa06d 0%, #e8d5c4 40%, transparent 70%)'
            }}
          ></div>
          {/* Medium oval shape - center right */}
          <div 
            className="absolute top-1/4 -right-20 w-[400px] h-[300px] rounded-full opacity-50 backdrop-blur-lg filter blur-md"
            style={{
              background: 'radial-gradient(ellipse at 20% 40%, #c4926b 0%, #f0e6d6 50%, transparent 80%)',
              transform: 'rotate(25deg)'
            }}
          ></div>
          {/* Abstract blob - bottom right */}
          <div 
            className="absolute bottom-0 right-0 w-[350px] h-[350px] opacity-55 backdrop-blur-lg filter blur-sm"
            style={{
              background: 'radial-gradient(circle at 40% 60%, #b8956f 0%, #e8d5c4 60%, transparent 85%)',
              borderRadius: '60% 40% 70% 30%'
            }}
          ></div>
          {/* Flowing shape - top left */}
          <div 
            className="absolute -top-20 -left-32 w-[450px] h-[300px] opacity-45 backdrop-blur-xl filter blur-lg"
            style={{
              background: 'radial-gradient(ellipse at 70% 50%, #daa06d 0%, #f5f0ea 45%, transparent 75%)',
              borderRadius: '40% 60% 50% 80%',
              transform: 'rotate(-15deg)'
            }}
          ></div>
          {/* Curved shape - bottom left */}
          <div 
            className="absolute bottom-10 -left-24 w-[300px] h-[200px] opacity-40 backdrop-blur-md filter blur-md"
            style={{
              background: 'radial-gradient(ellipse at 60% 30%, #c4926b 0%, #f0e6d6 55%, transparent 80%)',
              borderRadius: '70% 30% 40% 60%',
              transform: 'rotate(20deg)'
            }}
          ></div>
          {/* Extra flowing element - center */}
          <div 
            className="absolute top-1/2 left-1/4 w-[250px] h-[400px] opacity-30 backdrop-blur-lg filter blur-xl"
            style={{
              background: 'linear-gradient(135deg, #e8d5c4 0%, #f5f0ea 50%, transparent 100%)',
              borderRadius: '50% 80% 30% 70%',
              transform: 'rotate(45deg)'
            }}
          ></div>
        </div>
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div 
            className="absolute top-20 left-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-20"
            style={{ 
              background: '#daa06d',
              transform: `translateY(${scrollY * 0.5}px)`,
              animation: 'blob 7s infinite'
            }}
          ></div>
          <div 
            className="absolute top-40 right-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-20"
            style={{ 
              background: '#c4926b',
              transform: `translateY(${scrollY * 0.3}px)`,
              animation: 'blob 7s infinite 2s'
            }}
          ></div>
          <div 
            className="absolute bottom-20 left-20 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-20"
            style={{ 
              background: '#b8956f',
              transform: `translateY(${scrollY * 0.4}px)`,
              animation: 'blob 7s infinite 4s'
            }}
          ></div>
        </div>

        <div className="relative px-6 py-16 sm:px-12 lg:px-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Left Content */}
              <div className="space-y-6" style={{color: '#2c1810'}}>
                <div className="space-y-4">
                  <div className="inline-flex items-center px-4 py-2 bg-white bg-opacity-30 backdrop-blur-sm rounded-full text-sm font-medium">
                    <Star className="w-4 h-4 mr-2" style={{color: '#8b4513'}} />
                    Best Faculty Management System
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight">
                    Faculty of 
                    <span className="block bg-clip-text text-transparent" style={{background: 'linear-gradient(to right, #8b4513, #654321)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                      Vocational
                    </span>
                  </h1>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold" style={{color: '#3c2415'}}>
                    Yogyakarta State University
                  </h2>
                  <p className="text-sm sm:text-base lg:text-lg leading-relaxed max-w-lg" style={{color: '#4a2c1a'}}>
                    SIMPEL kuliah or Sistem Pelayanan kuliah is an Innovation to improve our services.
                  </p>
                </div>

                {/* Contact Info */}
                <div className="flex items-center space-x-6 text-sm" style={{color: '#654321'}}>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>Faculty of Vocational</span>
                  </div>
                
                </div>
              </div>

              {/* Right Content - People Image with Text Bubbles */}
              <div className="relative">
                <div 
                  className="relative transform transition-transform duration-1000"
                  style={{ transform: `translateY(${scrollY * 0.1}px) rotateY(${scrollY * 0.02}deg)` }}
                >
                  {/* Main Container */}
                  <div className="relative flex items-center justify-center min-h-[500px]">
                    {/* People Image */}
                    <div className="relative z-10">
                      <img 
                        src="/src/assets/people.svg" 
                        alt="Graduate Student" 
                        className="w-full h-auto max-w-xs lg:max-w-md object-contain"
                        onError={(e) => {
                          // Fallback if image doesn't load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-80 flex items-center justify-center" style={{display: 'none'}}>
                        <Users className="w-32 h-32 text-amber-400" />
                      </div>
                    </div>
                    
                    {/* Building Text - Top Left Corner */}
                    <div 
                      className="absolute top-16 -left-8 lg:top-20 lg:-left-12 z-20"
                      style={{ animation: 'float 6s ease-in-out infinite' }}
                    >
                      <img 
                        src="/src/assets/Build.png" 
                        alt="Building Career" 
                        className="w-80 h-auto lg:w-104 drop-shadow-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling.style.display = 'block';
                        }}
                      />
                      <div 
                        className="bg-white rounded-2xl p-3 shadow-xl border border-gray-100"
                        style={{display: 'none'}}
                      >
                        <span className="text-base font-bold text-amber-700">
                          BUILDING CAREER
                        </span>
                      </div>
                    </div>
                    
                    {/* Shaping Text - Bottom Right Corner */}
                    <div 
                      className="absolute bottom-2 -right-12 lg:bottom-4 lg:-right-20 z-20"
                      style={{ animation: 'float 6s ease-in-out infinite 3s' }}
                    >
                      <img 
                        src="/src/assets/Shape.png" 
                        alt="Shaping Future" 
                        className="w-80 h-auto lg:w-104 drop-shadow-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling.style.display = 'block';
                        }}
                      />
                      <div 
                        className="bg-white rounded-2xl p-3 shadow-xl border border-gray-100"
                        style={{display: 'none'}}
                      >
                        <span className="text-base font-bold text-orange-700">
                          SHAPING FUTURE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Application Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content - Description */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  <BookMarked className="w-4 h-4 mr-2" />
                  {getText('About Application', 'Tentang Aplikasi')}
                </div>
                
                <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  {getText('SIMPEL Kuliah', 'SIMPEL Kuliah')}
                  <span className="block text-blue-600">{getText('Smart Campus Solution', 'Solusi Kampus Cerdas')}</span>
                </h2>
                
                <div className="space-y-6 text-gray-600 leading-relaxed">
                  <div>
                    
                    <p className="text-lg">
                      {getText(
                        'SIMPEL Kuliah (Sistem Pelayanan Kuliah) is an innovative platform specifically designed to optimize campus facility management at the Faculty of Vocational UNY. This system provides an integrated solution for room booking, equipment lending, and digital schedule management.',
                        'SIMPEL Kuliah (Sistem Pelayanan Kuliah) adalah platform inovatif yang dirancang khusus untuk mengoptimalkan pengelolaan fasilitas kampus di Fakultas Vokasi UNY. Sistem ini menyediakan solusi terintegrasi untuk pemesanan ruangan, peminjaman peralatan, dan manajemen jadwal secara digital.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - YouTube Video */}
            <div className="relative">
              <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl p-8 shadow-2xl">
                <div className="aspect-video rounded-2xl overflow-hidden shadow-xl">
                  <iframe
                    width="100%"
                    height="100%"
                    src="https://www.youtube.com/embed/FThMmRz2Y-w?si=skv_zkSfgJCmIo0j"
                    title="SIMPEL Kuliah Demo Video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="rounded-2xl"
                  ></iframe>
                </div>
                
                <div className="mt-6 text-center">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    {getText('SIMPEL Access Tutorial', 'Tutorial Akses SIMPEL')}
                  </h4>
                </div>
                
                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full opacity-20"></div>
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full opacity-10"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Public Reports Section */}
      <ReportsSection />

      {/* CSS Styles */}
      <style jsx global>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        .aspect-w-4 {
          position: relative;
          padding-bottom: calc(5 / 4 * 100%);
        }
        
        .aspect-h-5 > * {
          position: absolute;
          height: 100%;
          width: 100%;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
        }
      `}</style>
    </div>
  );
};

// ReportsSection Component for public reports display
const ReportsSection: React.FC = () => {
  const { getText } = useLanguage();
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [comments, setComments] = useState<{[key: string]: ReportComment[]}>({});
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<PublicReport | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commenterInfo, setCommenterInfo] = useState({
    name: '',
    email: ''
  });
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    fetchRecentReports();
  }, []);

  const fetchRecentReports = async () => {
    try {
      setLoading(true);
      
      // Mock data for recent reports in the last month
      const mockReports: PublicReport[] = [
        {
          id: '1',
          title: getText('Projector Not Working in Room A101', 'Proyektor Tidak Berfungsi di Ruangan A101'),
          description: getText(
            'The projector in room A101 is not turning on. Students cannot see presentation materials clearly.',
            'Proyektor di ruangan A101 tidak mau menyala. Mahasiswa tidak dapat melihat materi presentasi dengan jelas.'
          ),
          category: 'equipment',
          priority: 'high',
          status: 'in_progress',
          location: 'Room A101',
          reporter_name: getText('Anonymous Student', 'Mahasiswa Anonim'),
          is_anonymous: true,
          attachments: [],
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          title: getText('Air Conditioning Issue in Lab B205', 'Masalah AC di Lab B205'),
          description: getText(
            'The air conditioning system in Lab B205 is not cooling effectively. The room gets very hot during afternoon classes.',
            'Sistem AC di Lab B205 tidak mendinginkan dengan efektif. Ruangan menjadi sangat panas saat kelas siang.'
          ),
          category: 'room_condition',
          priority: 'medium',
          status: 'resolved',
          location: 'Lab B205',
          reporter_name: 'John Doe',
          is_anonymous: false,
          attachments: [],
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '3',
          title: getText('Cleanliness Concern in Meeting Room C301', 'Masalah Kebersihan di Ruang Rapat C301'),
          description: getText(
            'The meeting room C301 has not been cleaned properly. There are stains on the whiteboard and tables.',
            'Ruang rapat C301 tidak dibersihkan dengan baik. Ada noda di papan tulis dan meja.'
          ),
          category: 'cleanliness',
          priority: 'low',
          status: 'new',
          location: 'Meeting Room C301',
          reporter_name: 'Jane Smith',
          is_anonymous: false,
          attachments: [],
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      setReports(mockReports);
      
      // Mock comments data
      const mockComments: {[key: string]: ReportComment[]} = {
        '1': [
          {
            id: 'c1',
            report_id: '1',
            commenter_name: getText('Technical Staff', 'Staf Teknis'),
            commenter_email: 'tech@faculty.edu',
            comment: getText(
              'Thank you for reporting this issue. We have identified the problem and ordered a replacement bulb. The projector should be working again by tomorrow.',
              'Terima kasih telah melaporkan masalah ini. Kami telah mengidentifikasi masalah dan memesan lampu pengganticomment: getText(
              'Thank you for reporting this issue. We have identified the problem and ordered a replacement bulb. The projector should be working again by tomorrow.',
              'Terima kasih telah melaporkan masalah ini. Kami telah mengidentifikasi masalah dan memesan lampu pengganti. Proyektor akan berfungsi kembali besok.'
            ),
            is_staff: true,
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        '2': [
          {
            id: 'c2',
            report_id: '2',
            commenter_name: getText('Maintenance Team', 'Tim Pemeliharaan'),
            commenter_email: 'maintenance@faculty.edu',
            comment: getText(
              'The AC system has been serviced and is now working properly. Thank you for your patience.',
              'Sistem AC telah diservis dan sekarang berfungsi dengan baik. Terima kasih atas kesabaran Anda.'
            ),
            is_staff: true,
            created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'c3',
            report_id: '2',
            commenter_name: 'Student User',
            commenter_email: 'student@example.com',
            comment: getText(
              'Great! The AC is working much better now. Thank you for the quick response.',
              'Bagus! AC sekarang bekerja lebih baik. Terima kasih atas respons yang cepat.'
            ),
            is_staff: false,
            created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        ]
      };

      setComments(mockComments);
      
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedReport || !newComment.trim() || !commenterInfo.name.trim()) return;
    
    try {
      setSubmittingComment(true);
      
      // Mock adding comment
      const newCommentObj: ReportComment = {
        id: Date.now().toString(),
        report_id: selectedReport.id,
        commenter_name: commenterInfo.name,
        commenter_email: commenterInfo.email || '',
        comment: newComment,
        is_staff: false,
        created_at: new Date().toISOString()
      };
      
      setComments(prev => ({
        ...prev,
        [selectedReport.id]: [...(prev[selectedReport.id] || []), newCommentObj]
      }));
      
      setNewComment('');
      setCommenterInfo({ name: '', email: '' });
      
      // Show success message
      alert(getText('Comment added successfully!', 'Komentar berhasil ditambahkan!'));
      
    } catch (error) {
      console.error('Error adding comment:', error);
      alert(getText('Failed to add comment', 'Gagal menambahkan komentar'));
    } finally {
      setSubmittingComment(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'equipment': return Package;
      case 'room_condition': return Building;
      case 'cleanliness': return Activity;
      case 'safety': return Shield;
      case 'maintenance': return Wrench;
      default: return AlertCircle;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(getText('en-US', 'id-ID'), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
              <span className="text-gray-600">{getText('Loading reports...', 'Memuat laporan...')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium mb-4">
            <MessageSquare className="w-4 h-4 mr-2" />
            {getText('Community Reports', 'Laporan Komunitas')}
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            {getText('Recent Issues & Updates', 'Masalah & Pembaruan Terkini')}
          </h2>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {getText(
              'Stay informed about facility issues and improvements. View recent reports and join the conversation to help make our campus better.',
              'Tetap terinformasi tentang masalah fasilitas dan perbaikan. Lihat laporan terkini dan ikut berpartisipasi untuk membuat kampus kita lebih baik.'
            )}
          </p>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {reports.map((report) => {
            const CategoryIcon = getCategoryIcon(report.category);
            const reportComments = comments[report.id] || [];
            
            return (
              <div key={report.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="h-10 w-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CategoryIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {report.title}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                          {getText(
                            report.status.replace('_', ' ').toUpperCase(),
                            report.status === 'new' ? 'BARU' :
                            report.status === 'in_progress' ? 'SEDANG DITANGANI' :
                            report.status === 'resolved' ? 'DISELESAIKAN' : report.status
                          )}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
                          {getText(
                            report.priority.toUpperCase(),
                            report.priority === 'low' ? 'RENDAH' :
                            report.priority === 'medium' ? 'SEDANG' :
                            report.priority === 'high' ? 'TINGGI' : report.priority
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {report.description}
                  </p>

                  {/* Location and Reporter */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{report.location}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <User className="h-4 w-4 mr-2" />
                      <span>
                        {getText('Reported by', 'Dilaporkan oleh')} {report.is_anonymous ? getText('Anonymous', 'Anonim') : report.reporter_name}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>{formatDate(report.created_at)}</span>
                    </div>
                  </div>

                  {/* Comments Preview */}
                  {reportComments.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {getText('Latest Comment', 'Komentar Terbaru')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {reportComments.length} {getText('comment(s)', 'komentar')}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p className="font-medium">{reportComments[reportComments.length - 1].commenter_name}:</p>
                        <p className="line-clamp-2">{reportComments[reportComments.length - 1].comment}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={() => {
                      setSelectedReport(report);
                      setShowModal(true);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    <Eye className="h-4 w-4" />
                    <span>{getText('View Details & Comment', 'Lihat Detail & Komentar')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* View More Button */}
        <div className="text-center mt-12">
          <button className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors duration-200">
            <FileText className="h-5 w-5" />
            <span>{getText('View All Reports', 'Lihat Semua Laporan')}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {getText('Report Details', 'Detail Laporan')}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Report Details */}
              <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-lg font-medium text-gray-900">{selectedReport.title}</h4>
                    <div className="flex space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedReport.priority)}`}>
                        {getText(
                          selectedReport.priority.toUpperCase(),
                          selectedReport.priority === 'low' ? 'RENDAH' :
                          selectedReport.priority === 'medium' ? 'SEDANG' :
                          selectedReport.priority === 'high' ? 'TINGGI' : selectedReport.priority
                        )}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedReport.status)}`}>
                        {getText(
                          selectedReport.status.replace('_', ' ').toUpperCase(),
                          selectedReport.status === 'new' ? 'BARU' :
                          selectedReport.status === 'in_progress' ? 'SEDANG DITANGANI' :
                          selectedReport.status === 'resolved' ? 'DISELESAIKAN' : selectedReport.status
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">{getText('Category:', 'Kategori:')}</span>
                      <span className="ml-2 font-medium capitalize">
                        {getText(
                          selectedReport.category.replace('_', ' '),
                          selectedReport.category === 'equipment' ? 'Peralatan' :
                          selectedReport.category === 'room_condition' ? 'Kondisi Ruangan' :
                          selectedReport.category === 'cleanliness' ? 'Kebersihan' :
                          selectedReport.category === 'safety' ? 'Keamanan' :
                          selectedReport.category === 'maintenance' ? 'Pemeliharaan' : selectedReport.category
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">{getText('Location:', 'Lokasi:')}</span>
                      <span className="ml-2 font-medium">{selectedReport.location}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{getText('Reported:', 'Dilaporkan:')}</span>
                      <span className="ml-2">{formatDate(selectedReport.created_at)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">{getText('Reporter:', 'Pelapor:')}</span>
                      <span className="ml-2">{selectedReport.is_anonymous ? getText('Anonymous', 'Anonim') : selectedReport.reporter_name}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">{getText('Description', 'Deskripsi')}</h5>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedReport.description}</p>
                  </div>
                </div>

                {/* Attachments */}
                {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">
                      {getText('Attachments', 'Lampiran')} ({selectedReport.attachments.length})
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedReport.attachments.map((attachment, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={attachment}
                            alt={`Attachment ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity duration-200"
                            onClick={() => window.open(attachment, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center">
                            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments Section */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">
                    {getText('Comments & Updates', 'Komentar & Pembaruan')} ({(comments[selectedReport.id] || []).length})
                  </h5>
                  
                  {(comments[selectedReport.id] || []).length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <MessageSquare className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">{getText('No comments yet', 'Belum ada komentar')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4 mb-6">
                      {(comments[selectedReport.id] || []).map((comment) => (
                        <div 
                          key={comment.id} 
                          className={`p-4 rounded-lg ${comment.is_staff ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${comment.is_staff ? 'bg-blue-600' : 'bg-gray-600'}`}>
                              <User className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-gray-900">
                                  {comment.commenter_name}
                                  {comment.is_staff && (
                                    <span className="ml-2 text-xs font-normal text-blue-600">
                                      {getText('Staff', 'Staf')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(comment.created_at)}
                                </div>
                              </div>
                              <div className="mt-1 text-sm text-gray-700">
                                {comment.comment}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add Comment Form */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h6 className="font-medium text-gray-900 mb-4">
                      {getText('Add Your Comment', 'Tambahkan Komentar Anda')}
                    </h6>
                    
                    {/* Commenter Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {getText('Your Name', 'Nama Anda')} *
                        </label>
                        <input
                          type="text"
                          value={commenterInfo.name}
                          onChange={(e) => setCommenterInfo(prev => ({ ...prev, name: e.target.value }))}
                          placeholder={getText('Enter your name', 'Masukkan nama Anda')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {getText('Email (Optional)', 'Email (Opsional)')}
                        </label>
                        <input
                          type="email"
                          value={commenterInfo.email}
                          onChange={(e) => setCommenterInfo(prev => ({ ...prev, email: e.target.value }))}
                          placeholder={getText('Enter your email', 'Masukkan email Anda')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Comment Text */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getText('Your Comment', 'Komentar Anda')} *
                      </label>
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={getText('Share your thoughts, experience, or additional information...', 'Bagikan pemikiran, pengalaman, atau informasi tambahan...')}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || !commenterInfo.name.trim() || submittingComment}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        {submittingComment ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span>
                          {submittingComment ? 
                            getText('Submitting...', 'Mengirim...') : 
                            getText('Post Comment', 'Kirim Komentar')
                          }
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;