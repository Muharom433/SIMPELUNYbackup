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
  Lightbulb
} from 'lucide-react';

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

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
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
        { icon: Home, label: 'Dashboard', path: '/', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', description: 'View system overview' },
        { icon: Calendar, label: 'Book Room', path: '/book', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: 'Reserve a room' },
        { icon: Package, label: 'Tool Lending', path: '/tools', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: 'Borrow equipment' },
        { icon: CheckCircle, label: 'Check Out', path: '/checkout', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: 'Return items' },
      ];
    }

    if (user.role === 'super_admin') {
      return [
        { icon: BarChart3, label: 'System Analytics', path: '/', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', description: 'View detailed analytics' },
        { icon: Building, label: 'Room Management', path: '/rooms', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: 'Manage rooms' },
        { icon: Users, label: 'User Management', path: '/users', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: 'Manage users' },
        { icon: Calendar, label: 'Booking Management', path: '/bookings', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: 'Handle bookings' },
        { icon: ClipboardCheck, label: 'Validation Queue', path: '/validation', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100', description: 'Validate returns' },
        { icon: MapPin, label: 'Departments', path: '/departments', color: 'text-pink-600 bg-pink-50 hover:bg-pink-100', description: 'Manage departments' },
        { icon: GraduationCap, label: 'Study Programs', path: '/study-programs', color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', description: 'Manage programs' },
        { icon: FileText, label: 'Reports', path: '/reports', color: 'text-cyan-600 bg-cyan-50 hover:bg-cyan-100', description: 'Generate reports' },
      ];
    }

    if (user.role === 'department_admin') {
      return [
        { icon: PieChart, label: 'Dashboard', path: '/', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', description: 'Department overview' },
        { icon: CalendarCheck, label: 'Exam Management', path: '/exams', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: 'Manage exam schedules' },
        { icon: Users, label: 'User Management', path: '/users', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: 'Manage department users' },
        { icon: User, label: 'Profile', path: '/profile', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: 'Update profile' },
      ];
    }

    // Student and lecturer
    return [
      { icon: Home, label: 'Dashboard', path: '/', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', description: 'View overview' },
      { icon: Calendar, label: 'Book Room', path: '/book', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: 'Reserve a room' },
      { icon: Package, label: 'Tool Lending', path: '/tools', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: 'Borrow equipment' },
      { icon: CheckCircle, label: 'Check Out', path: '/checkout', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: 'Return items' },
      { icon: User, label: 'Profile', path: '/profile', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100', description: 'Update profile' },
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

                {/* Stats Counters */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-500 rounded-xl">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold" style={{color: '#2c1810'}}>1200+</p>
                        <p className="text-xs lg:text-sm" style={{color: '#4a2c1a'}}>Bookings</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-500 rounded-xl">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold" style={{color: '#2c1810'}}>{formatTime(currentTime)}</p>
                        <p className="text-xs lg:text-sm" style={{color: '#4a2c1a'}}>Live Time</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Success Rate */}
                <div className="flex items-center space-x-2">
                  <ArrowUp className="w-5 h-5 text-green-500" />
                  <span className="text-green-600 font-semibold">98% Success Rate</span>
                </div>

                {/* Contact Info */}
                <div className="flex items-center space-x-6 text-sm" style={{color: '#654321'}}>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>Faculty of Vocational</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Timer className="w-4 h-4" />
                    <span>24/7 Online</span>
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
                  Tentang Aplikasi
                </div>
                
                <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  SIMPEL Kuliah
                  <span className="block text-blue-600">Smart Campus Solution</span>
                </h2>
                
                <div className="space-y-6 text-gray-600 leading-relaxed">
                  <div>
                    
                    <p className="text-lg">
                      SIMPEL Kuliah (Sistem Pelayanan Kuliah) adalah platform inovatif yang dirancang khusus untuk mengoptimalkan pengelolaan fasilitas kampus di Fakultas Vokasi UNY. Sistem ini menyediakan solusi terintegrasi untuk pemesanan ruangan, peminjaman peralatan, dan manajemen jadwal secara digital.
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
                    src="https://youtu.be/FThMmRz2Y-w?si=Ehvuru-gD1d8WxOW"
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
                    Tutorial
                  </h4>
                
                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full opacity-20"></div>
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full opacity-10"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="py-24" style={{background: 'linear-gradient(to bottom right, #f9f7f4, #f0e6d6)'}}>
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
              <Zap className="w-4 h-4 mr-2" />
              Quick Actions
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
              {user?.role === 'super_admin' ? 'Admin Control Panel' :
               user?.role === 'department_admin' ? 'Department Management' :
               'Student & Faculty Portal'}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {user?.role === 'super_admin' ? 'Comprehensive system administration tools for managing the entire platform' :
               user?.role === 'department_admin' ? 'Essential tools for managing your department resources and schedules' :
               'Easy access to booking, lending, and academic services'}
            </p>
          </div>

          <div className={`grid gap-6 ${quickActions.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
            {quickActions.map((action, index) => (
              <button
                key={index}
                className={`group flex flex-col items-center space-y-4 p-6 border-2 border-gray-200 rounded-2xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 bg-white ${action.color}`}
                style={{ 
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <div className="p-4 rounded-xl transition-all duration-300 group-hover:scale-110">
                  <action.icon className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <span className="text-lg font-semibold block mb-1">{action.label}</span>
                  <span className="text-sm opacity-75">{action.description}</span>
                </div>
                <ChevronRight className="h-5 w-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </button>
            ))}
          </div>

          {/* Role-specific additional info */}
          {user && (
            <div className="mt-16 bg-white rounded-3xl p-8 shadow-xl border border-gray-200">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  <User className="w-4 h-4 mr-2" />
                  {user.role === 'super_admin' ? 'Super Administrator' :
                   user.role === 'department_admin' ? 'Department Administrator' :
                   user.role === 'lecturer' ? 'Lecturer' : 'Student'}
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Welcome, {user.full_name}!</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  {user.role === 'super_admin' ? 
                    'You have full access to all system features including user management, room administration, and comprehensive analytics. Use your privileges to ensure smooth operation of the entire platform.' :
                   user.role === 'department_admin' ? 
                    'As a department administrator, you can manage department-specific resources, handle exam schedules, and oversee user accounts within your department.' :
                   user.role === 'lecturer' ? 
                    'Access your teaching resources, book classrooms for lectures, borrow equipment for presentations, and manage your academic schedule efficiently.' :
                    'Book study rooms, borrow laboratory equipment, check out materials, and access all student services through this centralized platform.'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Statistics Overview Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
              Platform Statistics
            </h2>
            <p className="text-xl text-gray-600">Real-time usage and performance metrics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              {
                title: 'Available Rooms',
                value: stats.availableRooms,
                subtitle: 'Ready for booking',
                icon: Building,
                color: 'bg-gradient-to-r from-amber-500 to-amber-600',
                change: '+5%',
                trend: 'up',
              },
              {
                title: 'Today\'s Bookings',
                value: stats.todayBookings,
                subtitle: `${stats.activeBookings} currently active`,
                icon: Calendar,
                color: 'bg-gradient-to-r from-green-500 to-green-600',
                change: '+12%',
                trend: 'up',
              },
              {
                title: 'Equipment Available',
                value: stats.equipmentAvailable,
                subtitle: 'Items ready to lend',
                icon: Package,
                color: 'bg-gradient-to-r from-orange-500 to-orange-600',
                change: '+8%',
                trend: 'up',
              },
              {
                title: 'Total Users',
                value: stats.totalUsers,
                subtitle: 'Registered users',
                icon: Users,
                color: 'bg-gradient-to-r from-yellow-500 to-yellow-600',
                change: '+15%',
                trend: 'up',
              },
            ].map((card, index) => (
              <div 
                key={index} 
                className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  transform: `translateY(${Math.max(0, scrollY * 0.05 - index * 10)}px)`
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className={`${card.color} p-4 rounded-2xl shadow-lg`}>
                    <card.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex items-center text-green-600 text-sm font-medium">
                    <ArrowUp className="h-4 w-4 mr-1" />
                    {card.change}
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-gray-900 mb-2">{card.value}</p>
                  <p className="text-lg font-medium text-gray-700 mb-1">{card.title}</p>
                  <p className="text-sm text-gray-500">{card.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="py-24" style={{background: 'linear-gradient(to bottom right, #f9f7f4, #f0e6d6)'}}>
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="bg-white rounded-3xl p-12 border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Recent Activity</h2>
              <button className="text-amber-600 hover:text-amber-700 font-semibold flex items-center space-x-2 bg-amber-50 px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all">
                <Eye className="h-5 w-5" />
                <span>View All</span>
              </button>
            </div>
            <div className="space-y-6">
              {recentActivity.map((activity, index) => (
                <div 
                  key={activity.id} 
                  className="flex items-start space-x-6 p-6 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all duration-300 border border-gray-100"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className={`flex-shrink-0 p-3 rounded-xl ${
                    activity.status === 'success' ? 'bg-green-100 text-green-600' :
                    activity.status === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-medium text-gray-900 mb-2">{activity.message}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                      activity.status === 'success' ? 'bg-green-100 text-green-800' :
                      activity.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-800 py-16">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Experience Smart Campus Management?
          </h2>
          <p className="text-xl text-amber-100 mb-8">
            Join hundreds of students, lecturers, and staff who trust SIMPEL Kuliah for their daily campus activities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-amber-700 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-xl">
              Start Booking Now
            </button>
            <button className="border-2 border-white text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white hover:text-amber-700 transition-all duration-300 transform hover:scale-105">
              Watch Tutorial
            </button>
          </div>
        </div>
      </div>

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

export default Dashboard;