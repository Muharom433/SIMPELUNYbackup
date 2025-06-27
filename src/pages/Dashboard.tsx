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
import { supabase } from '../lib/supabase';
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
const ReportsSection = () => {
  const { getText } = useLanguage();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commenterInfo, setCommenterInfo] = useState({ name: '', email: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchReports();
  }, [currentPage]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      
      // Real database query with pagination
      const { data, error, count } = await supabase
        .from('reports')
        .select(`
          *,
          room:rooms(name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;
      
      setReports(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
      
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (reportId) => {
    try {
      const { data, error } = await supabase
        .from('report_comments')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !commenterInfo.name.trim()) return;
    
    try {
      const { error } = await supabase
        .from('report_comments')
        .insert({
          report_id: selectedReport.id,
          commenter_name: commenterInfo.name,
          commenter_email: commenterInfo.email,
          comment: newComment,
        });

      if (error) throw error;
      
      setNewComment('');
      setCommenterInfo({ name: '', email: '' });
      fetchComments(selectedReport.id);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      equipment: Package,
      room_condition: Building,
      cleanliness: Activity,
      safety: Shield,
      maintenance: Wrench,
    };
    return icons[category] || AlertCircle;
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'text-blue-600',
      in_progress: 'text-orange-600',
      resolved: 'text-green-600',
      closed: 'text-gray-600'
    };
    return colors[status] || 'text-gray-600';
  };

  const getPriorityDot = (priority) => {
    const colors = {
      low: 'bg-green-500',
      medium: 'bg-yellow-500',
      high: 'bg-red-500',
      critical: 'bg-red-700'
    };
    return colors[priority] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium mb-4">
            <MessageSquare className="w-4 h-4 mr-2" />
            {getText('Community Reports', 'Laporan Komunitas')}
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            {getText('Recent Issues & Updates', 'Masalah & Pembaruan Terkini')}
          </h2>
        </div>

        {/* Modern Table */}
        <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 overflow-hidden">
          <div className="p-8">
            <div className="space-y-6">
              {reports.map((report, index) => {
                const CategoryIcon = getCategoryIcon(report.category);
                return (
                  <div 
                    key={report.id}
                    className="group flex items-center justify-between p-6 rounded-2xl hover:bg-orange-50/50 transition-all duration-300 border border-transparent hover:border-orange-200/50"
                  >
                    {/* Priority Dot & Icon */}
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${getPriorityDot(report.priority)}`}></div>
                      <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl">
                        <CategoryIcon className="h-5 w-5 text-white" />
                      </div>
                    </div>

                    {/* Issue Info */}
                    <div className="flex-1 ml-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-orange-700 transition-colors">
                        {report.title}
                      </h3>
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {report.location || report.room?.name}
                        </div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          {report.is_anonymous ? 'Anonymous' : report.reporter_name}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {new Date(report.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center space-x-4">
                      <span className={`text-sm font-medium ${getStatusColor(report.status)} capitalize`}>
                        {report.status.replace('_', ' ')}
                      </span>
                      
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setShowModal(true);
                          fetchComments(report.id);
                        }}
                        className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition-all duration-200"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Aesthetic Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-12">
            <div className="flex items-center space-x-2 bg-white/70 backdrop-blur-lg rounded-2xl p-2 border border-white/20">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-gray-600 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === i + 1
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-orange-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-gray-600 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-gray-900">Report Details</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Report Info */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-6 mb-8">
                <h4 className="text-xl font-semibold text-gray-900 mb-4">{selectedReport.title}</h4>
                <p className="text-gray-700 mb-4">{selectedReport.description}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Category:</span> {selectedReport.category}</div>
                  <div><span className="font-medium">Priority:</span> {selectedReport.priority}</div>
                  <div><span className="font-medium">Status:</span> {selectedReport.status}</div>
                  <div><span className="font-medium">Location:</span> {selectedReport.location}</div>
                </div>
              </div>

              {/* Comments Section */}
              <div className="space-y-6">
                <h5 className="text-lg font-semibold text-gray-900">Comments</h5>
                
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No comments yet. Be the first to comment!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-2xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900">{comment.commenter_name}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-700">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Comment Form */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h6 className="font-medium text-gray-900 mb-4">Add Your Comment</h6>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      value={commenterInfo.name}
                      onChange={(e) => setCommenterInfo(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Your Name"
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <input
                      type="email"
                      value={commenterInfo.email}
                      onChange={(e) => setCommenterInfo(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Email (Optional)"
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write your comment..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
                  />
                  
                  <button
                    onClick={addComment}
                    disabled={!newComment.trim() || !commenterInfo.name.trim()}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <Send className="h-4 w-4" />
                    <span>Post Comment</span>
                  </button>
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