import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ChevronLeft,
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
  Mail,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useSystemBranding } from '../contexts/SystemSettingsContext';
import peopleImage from '../assets/people.svg';
import buildImage from '../assets/Build.png';
import shapeImage from '../assets/Shape.png';

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
  room?: {
    name: string;
  };
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
  const { dashboard_video_url } = useSystemBranding();
  const navigate = useNavigate();
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
  const [showOverlay, setShowOverlay] = useState(true);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);

  // Interactive mouse tracking for hero section
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const heroRef = React.useRef<HTMLDivElement>(null);

  // Floating particles with smoke movement
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
    color: string;
    phase: number; // For swirl movement
    amplitude: number; // Swirl amplitude
    blur: number; // Individual blur for depth
  }>>([]);

  // Ripple effect for touch interaction
  const [ripples, setRipples] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    opacity: number;
  }>>([]);

  // Initialize particles with elegant smoke properties using #daa06d palette
  useEffect(() => {
    // Elegant amber/gold smoke colors based on #daa06d
    const colors = [
      'rgba(218, 160, 109, 0.6)', // Main amber
      'rgba(196, 146, 107, 0.5)', // Darker amber
      'rgba(232, 213, 196, 0.7)', // Light cream
      'rgba(240, 230, 214, 0.6)', // Soft beige
      'rgba(212, 165, 116, 0.5)', // Golden
      'rgba(184, 149, 111, 0.4)', // Bronze
      'rgba(255, 248, 240, 0.5)', // Warm white
    ];
    const initialParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 150 + 60, // Large, soft clouds
      speedX: (Math.random() - 0.5) * 0.15, // Very slow horizontal drift
      speedY: -Math.random() * 0.2 - 0.05, // Gentle upward float
      opacity: Math.random() * 0.35 + 0.1,
      color: colors[Math.floor(Math.random() * colors.length)],
      phase: Math.random() * Math.PI * 2,
      amplitude: Math.random() * 0.5 + 0.2,
      blur: Math.random() * 25 + 15 // Soft, elegant blur
    }));
    setParticles(initialParticles);
  }, []);

  // Animate particles with elegant flowing motion
  const animFrameRef = useRef<number>();
  const lastAnimUpdate = useRef<number>(0);

  useEffect(() => {
    const animate = (time: number) => {
      if (time - lastAnimUpdate.current > 100) { // Limit to 10 FPS to save CPU
        lastAnimUpdate.current = time;
        setParticles(prev => prev.map(p => {
          // Smooth phase advancement for organic motion
          const newPhase = p.phase + 0.015;

          // Elegant flowing swirl (like soft mist)
          const swirlX = Math.sin(newPhase * 0.4) * 0.06 * p.amplitude;
          const swirlY = Math.cos(newPhase * 0.25) * 0.04 * p.amplitude;

          // Apply smooth movement
          let newX = p.x + p.speedX + swirlX;
          let newY = p.y + p.speedY + swirlY;

          // Seamless wraparound for continuous elegance
          if (newY < -20) {
            newY = 120;
            newX = Math.random() * 100;
          }
          if (newX < -15) newX = 115;
          if (newX > 115) newX = -15;

          return {
            ...p,
            x: newX,
            y: newY,
            phase: newPhase
          };
        }));
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current!);
  }, []);

  // Handle mouse movement on hero section (Liquid Repulsion)
  const lastMouseUpdate = useRef<number>(0);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    // Throttle mouse moves to ~15 FPS to save CPU
    if (now - lastMouseUpdate.current < 66) return;
    lastMouseUpdate.current = now;

    if (!heroRef.current) return;

    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setMousePosition({ x, y });

    // Elegant particle interaction - soft dispersion like mist
    setParticles(prev => prev.map(p => {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const threshold = 25; // Wider, softer interaction

      if (dist < threshold) {
        // Gentle, elegant dispersion
        const force = (threshold - dist) / threshold * 0.8;
        const angle = Math.atan2(dy, dx);

        // Soft outward flow
        const moveX = Math.cos(angle) * force * 0.8;
        const moveY = Math.sin(angle) * force * 0.6;

        return {
          ...p,
          x: p.x + moveX,
          y: p.y + moveY,
          speedX: p.speedX * 0.95 + moveX * 0.03,
          speedY: p.speedY * 0.95 + moveY * 0.03
        };
      }
      return p;
    }));
  }, []);

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Get the main scrollable element
    const mainElement = document.querySelector('main');

    // Handle scroll for animations and indicator visibility
    const handleScroll = () => {
      // Get scroll position from the main element, not window
      const currentScrollY = mainElement ? mainElement.scrollTop : 0;
      setScrollY(currentScrollY);

      // Hide scroll indicator when scrolled past 300px
      if (currentScrollY > 300) {
        setShowScrollIndicator(false);
      } else {
        setShowScrollIndicator(true);
      }
    };

    // Additional wheel event listener for better scroll detection
    const handleWheel = (e: WheelEvent) => {
      const currentScrollY = mainElement ? mainElement.scrollTop : 0;

      // If scrolling down and past threshold, hide indicator
      if (e.deltaY > 0 && currentScrollY > 250) {
        setShowScrollIndicator(false);
      }
    };

    // Attach scroll listener to main element instead of window
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
      mainElement.addEventListener('wheel', handleWheel, { passive: true });
    }

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
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll);
        mainElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  const handleOverlayClick = () => {
    setShowOverlay(false);
  };

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
        { icon: CalendarCheck, label: getText('Exam Management', 'Manajemen Ujian'), path: '/exams', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: getText('Manage exam schedules', 'Kelola jadwal ujian') },
        { icon: Users, label: getText('User Management', 'Manajemen Pengguna'), path: '/users', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: getText('Manage department users', 'Kelola pengguna departemen') },
        { icon: User, label: getText('Profile', 'Profil'), path: '/profile', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: getText('Update profile', 'Perbarui profil') },
      ];
    }

    // Student and lecturer
    return [
      { icon: Calendar, label: getText('Book Room', 'Pesan Ruangan'), path: '/book', color: 'text-green-600 bg-green-50 hover:bg-green-100', description: getText('Reserve a room', 'Reservasi ruangan') },
      { icon: Package, label: getText('Tool Lending', 'Peminjaman Alat'), path: '/tools', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', description: getText('Borrow equipment', 'Pinjam peralatan') },
      { icon: CheckCircle, label: getText('Check Out', 'Pengembalian'), path: '/checkout', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100', description: getText('Return items', 'Kembalikan barang') },
      { icon: User, label: getText('Profile', 'Profil'), path: '/profile', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100', description: getText('Update profile', 'Perbarui profil') },
    ];
  };

  const quickActions = getQuickActions();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Scroll Indicator Arrow - Completely disappears at specific height */}
      {showScrollIndicator && (
        <div
          className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 ease-out"
          style={{
            opacity: Math.max(0, 1 - scrollY / 250),
            transform: `translate(-50%, ${Math.min(scrollY * 0.3, 50)}px)`
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-medium text-amber-800/60 tracking-wider uppercase text-[10px] animate-pulse">
              Scroll Down
            </span>
            <div className="bg-white/50 backdrop-blur-xl p-3 rounded-full shadow-xl border border-amber-200/30 animate-bounce">
              <ChevronDown className="w-6 h-6 text-amber-700" />
            </div>
          </div>
        </div>
      )}

      {/* Hero Section - Modern Elegant Background with #daa06d */}
      <div
        ref={heroRef}
        className="min-h-screen w-full flex items-center relative overflow-hidden cursor-default"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at ${mousePosition.x}% ${mousePosition.y}%, rgba(218, 160, 109, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(232, 213, 196, 0.4) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 80% 70%, rgba(218, 160, 109, 0.2) 0%, transparent 50%),
            linear-gradient(135deg, #fffbf5 0%, #f8f0e6 25%, #f3e8d9 50%, #ebe0d1 75%, #e8d5c4 100%)
          `,
          transition: 'background 0.4s ease-out'
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Elegant Floating Particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ transform: `translateY(${scrollY * 0.15}px)` }}>
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute rounded-full transition-all duration-700 ease-out"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                background: `radial-gradient(circle at 35% 35%, ${particle.color} 0%, rgba(218, 160, 109, 0.15) 50%, transparent 80%)`,
                opacity: particle.opacity,
                filter: `blur(${particle.blur}px)`,
                transform: `translate(-50%, -50%) scale(${isHovering ? 1.08 : 1})`,
                mixBlendMode: 'soft-light'
              }}
            />
          ))}
        </div>

        {/* Elegant Mouse Glow Effect */}
        {isHovering && (
          <div
            className="absolute pointer-events-none transition-all duration-200 ease-out"
            style={{
              left: `${mousePosition.x}%`,
              top: `${mousePosition.y}%`,
              width: '400px',
              height: '400px',
              background: `
                radial-gradient(circle, 
                  rgba(218, 160, 109, 0.35) 0%, 
                  rgba(232, 213, 196, 0.2) 35%, 
                  transparent 70%
                )`,
              transform: 'translate(-50%, -50%)',
              filter: 'blur(50px)',
              borderRadius: '50%'
            }}
          />
        )}

        {/* Elegant Decorative Elements - Modern Glass Morphism */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Large elegant orb - top right */}
          <div
            className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-40"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(218, 160, 109, 0.5) 0%, rgba(232, 213, 196, 0.3) 40%, transparent 70%)',
              filter: 'blur(60px)',
              transform: `translate(${(mousePosition.x - 50) * 0.025}px, ${(mousePosition.y - 50) * 0.025}px)`
            }}
          />
          {/* Medium flowing shape - center right */}
          <div
            className="absolute top-1/3 -right-24 w-[450px] h-[350px] opacity-35"
            style={{
              background: 'radial-gradient(ellipse at 25% 45%, rgba(196, 146, 107, 0.4) 0%, rgba(240, 230, 214, 0.25) 50%, transparent 80%)',
              filter: 'blur(50px)',
              borderRadius: '60% 40% 55% 45%',
              transform: `rotate(15deg) translate(${(mousePosition.x - 50) * 0.03}px, ${(mousePosition.y - 50) * 0.03}px)`
            }}
          />
          {/* Soft glow - bottom right */}
          <div
            className="absolute -bottom-20 -right-10 w-[400px] h-[400px] opacity-30"
            style={{
              background: 'radial-gradient(circle at 45% 55%, rgba(218, 160, 109, 0.45) 0%, rgba(232, 213, 196, 0.2) 55%, transparent 85%)',
              filter: 'blur(55px)',
              borderRadius: '55% 45% 60% 40%',
              transform: `translate(${(mousePosition.x - 50) * 0.02}px, ${(mousePosition.y - 50) * 0.02}px)`
            }}
          />
          {/* Elegant mist - top left */}
          <div
            className="absolute -top-32 -left-40 w-[500px] h-[350px] opacity-30"
            style={{
              background: 'radial-gradient(ellipse at 65% 45%, rgba(232, 213, 196, 0.5) 0%, rgba(255, 251, 245, 0.3) 45%, transparent 75%)',
              filter: 'blur(55px)',
              borderRadius: '45% 55% 50% 75%',
              transform: `rotate(-10deg) translate(${(mousePosition.x - 50) * -0.02}px, ${(mousePosition.y - 50) * -0.02}px)`
            }}
          />
          {/* Subtle accent - bottom left */}
          <div
            className="absolute bottom-20 -left-28 w-[320px] h-[240px] opacity-25"
            style={{
              background: 'radial-gradient(ellipse at 55% 35%, rgba(184, 149, 111, 0.4) 0%, rgba(240, 230, 214, 0.2) 55%, transparent 80%)',
              filter: 'blur(45px)',
              borderRadius: '65% 35% 45% 55%',
              transform: `rotate(25deg) translate(${(mousePosition.x - 50) * -0.018}px, ${(mousePosition.y - 50) * -0.018}px)`
            }}
          />
          {/* Central flowing element */}
          <div
            className="absolute top-1/2 left-1/4 w-[280px] h-[420px] opacity-20"
            style={{
              background: 'linear-gradient(145deg, rgba(218, 160, 109, 0.35) 0%, rgba(255, 248, 240, 0.2) 50%, transparent 100%)',
              filter: 'blur(50px)',
              borderRadius: '50% 75% 35% 65%',
              transform: `rotate(40deg) translate(${(mousePosition.x - 50) * 0.022}px, ${(mousePosition.y - 50) * 0.022}px)`
            }}
          />
        </div>

        {/* Animated Background Orbs - Elegant Motion */}
        <div className="absolute inset-0">
          <div
            className="absolute top-16 left-8 w-80 h-80 rounded-full mix-blend-soft-light filter blur-3xl opacity-25"
            style={{
              background: 'radial-gradient(circle, #daa06d 0%, transparent 70%)',
              transform: `translateY(${scrollY * 0.4}px)`,
              animation: 'elegant-float 12s ease-in-out infinite'
            }}
          ></div>
          <div
            className="absolute top-48 right-12 w-72 h-72 rounded-full mix-blend-soft-light filter blur-3xl opacity-20"
            style={{
              background: 'radial-gradient(circle, #c4926b 0%, transparent 70%)',
              transform: `translateY(${scrollY * 0.3}px)`,
              animation: 'elegant-float 12s ease-in-out infinite 4s'
            }}
          ></div>
          <div
            className="absolute bottom-24 left-16 w-64 h-64 rounded-full mix-blend-soft-light filter blur-3xl opacity-18"
            style={{
              background: 'radial-gradient(circle, #b8956f 0%, transparent 70%)',
              transform: `translateY(${scrollY * 0.35}px)`,
              animation: 'elegant-float 12s ease-in-out infinite 8s'
            }}
          ></div>
        </div>

        {/* Hero Content */}
        <div className="relative px-6 py-8 sm:px-12 lg:px-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Left Content */}
              <div className="space-y-6" style={{ color: '#2c1810' }}>
                <div className="space-y-4">
                  <div className="inline-flex items-center px-4 py-2 bg-white bg-opacity-30 backdrop-blur-sm rounded-full text-sm font-medium">
                    <Star className="w-4 h-4 mr-2" style={{ color: '#8b4513' }} />
                    All in One Services
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight">
                    {getText('Faculty of', 'Fakultas')}
                    <span className="block bg-clip-text text-transparent" style={{ background: 'linear-gradient(to right, #8b4513, #654321)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {getText('Vocational', 'Vokasi')}
                    </span>
                  </h1>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold" style={{ color: '#3c2415' }}>
                    {getText('Yogyakarta State University', 'Universitas Yogyakarta')}
                  </h2>
                  <p className="text-sm sm:text-base lg:text-lg leading-relaxed max-w-lg" style={{ color: '#4a2c1a' }}>
                    SIMPEL kuliah or Sistem Pelayanan kuliah is an Innovation to improve our services.
                  </p>
                </div>

                {/* Contact Info */}
                <div className="flex items-center space-x-6 text-sm" style={{ color: '#654321' }}>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>{getText('Faculty of Vocational', 'FakultasVokasi')}</span>
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
                        src={peopleImage}
                        alt="Graduate Student"
                        className="w-full h-auto max-w-xs lg:max-w-md object-contain"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const nextEl = target.nextElementSibling as HTMLElement;
                          if (nextEl) nextEl.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-80 flex items-center justify-center" style={{ display: 'none' }}>
                        <Users className="w-32 h-32 text-amber-400" />
                      </div>
                    </div>

                    {/* Building Text - Top Left Corner */}
                    <div
                      className="absolute top-12 -left-12 lg:top-6 lg:-left-20 z-20"
                      style={{ animation: 'float 6s ease-in-out infinite' }}
                    >
                      <img
                        src={buildImage}
                        alt="Building Career"
                        className="w-80 h-auto lg:w-104 drop-shadow-lg"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const nextEl = target.nextElementSibling as HTMLElement;
                          if (nextEl) nextEl.style.display = 'block';
                        }}
                      />
                      <div
                        className="bg-white rounded-2xl p-3 shadow-xl border border-gray-100"
                        style={{ display: 'none' }}
                      >
                        <span className="text-base font-bold text-amber-700">
                          BUILDING CAREER
                        </span>
                      </div>
                    </div>

                    {/* Shaping Text - Bottom Right Corner */}
                    <div
                      className="absolute -bottom-8 -right-16 lg:-bottom-12 lg:-right-24 z-20"
                      style={{ animation: 'float 6s ease-in-out infinite 3s' }}
                    >
                      <img
                        src={shapeImage}
                        alt="Shaping Future"
                        className="w-80 h-auto lg:w-104 drop-shadow-lg"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const nextEl = target.nextElementSibling as HTMLElement;
                          if (nextEl) nextEl.style.display = 'block';
                        }}
                      />
                      <div
                        className="bg-white rounded-2xl p-3 shadow-xl border border-gray-100"
                        style={{ display: 'none' }}
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
                  {dashboard_video_url ? (
                    <iframe
                      width="100%"
                      height="100%"
                      src={dashboard_video_url}
                      title="SIMPEL Kuliah Demo Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      className="rounded-2xl"
                    ></iframe>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white">
                      <div className="text-center p-6">
                        <Play className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-sm text-gray-400">Video tutorial belum diset.</p>
                      </div>
                    </div>
                  )}
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

      {/* Quick Actions Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => navigate(action.path)}
                className="group relative bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border border-orange-100"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Icon className="w-24 h-24 text-orange-500" />
                </div>
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="p-4 rounded-xl bg-orange-50 text-orange-600 mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{action.label}</h3>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Public Reports Section */}
      <ReportsSection />

      {/* CSS Styles */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        
        @keyframes elegant-float {
          0%, 100% { 
            transform: translateY(0px) scale(1); 
            opacity: 0.25;
          }
          25% { 
            transform: translateY(-20px) scale(1.03); 
            opacity: 0.3;
          }
          50% { 
            transform: translateY(-35px) scale(1.05); 
            opacity: 0.22;
          }
          75% { 
            transform: translateY(-15px) scale(1.02); 
            opacity: 0.28;
          }
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

        /* Animasi bounce khusus untuk overlay */
        @keyframes bounce-smooth {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }

        .animate-bounce {
          animation: bounce-smooth 2s infinite;
        }
      `}</style>
    </div>
  );
};

// ReportsSection Component untuk public reports display
const ReportsSection: React.FC = () => {
  const { getText } = useLanguage();
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<PublicReport | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [comments, setComments] = useState<ReportComment[]>([]);
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

      // Calculate start of current month for filtering
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Real database query with pagination
      const { data, error, count } = await supabase
        .from('reports')
        .select(`
        *,
        room:rooms(name)
        `, { count: 'exact' })
        // Show unresolved OR (resolved AND updated/resolved this month)
        .or(`status.neq.resolved,and(status.eq.resolved,updated_at.gte.${startOfMonth.toISOString()})`)
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

  const fetchComments = async (reportId: string) => {
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
    if (!newComment.trim() || !commenterInfo.name.trim() || !selectedReport) return;

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

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
      equipment: Package,
      room_condition: Building,
      cleanliness: Activity,
      safety: Shield,
      maintenance: Wrench,
    };
    return icons[category] || AlertCircle;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'text-blue-600',
      in_progress: 'text-orange-600',
      resolved: 'text-green-600',
      closed: 'text-gray-600'
    };
    return colors[status] || 'text-gray-600';
  };

  const getPriorityDot = (priority: string) => {
    const colors: Record<string, string> = {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 lg:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <div className="inline-flex items-center px-3 sm:px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-xs sm:text-sm font-medium mb-4">
            <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            {getText('Community Reports', 'Laporan Komunitas')}
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 px-4">
            {getText('Recent Issues & Updates', 'Masalah & Pembaruan Terkini')}
          </h2>
        </div>

        {/* Mobile-First Responsive Cards */}
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-xl border border-white/20 overflow-hidden">
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="space-y-4 sm:space-y-6">
              {reports.map((report) => {
                const CategoryIcon = getCategoryIcon(report.category);
                return (
                  <div
                    key={report.id}
                    className="group p-4 sm:p-6 rounded-xl sm:rounded-2xl hover:bg-orange-50/50 transition-all duration-300 border border-transparent hover:border-orange-200/50"
                  >
                    {/* Mobile Layout - Stacked */}
                    <div className="block sm:hidden space-y-3">
                      {/* Top Row - Priority, Icon, Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${getPriorityDot(report.priority)}`}></div>
                          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                            <CategoryIcon className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <span className={`text-xs font-medium ${getStatusColor(report.status)} capitalize px-2 py-1 bg-white rounded-full`}>
                          {report.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-orange-700 transition-colors leading-tight">
                        {report.title}
                      </h3>

                      {/* Info Grid - 2 columns on mobile */}
                      <div className="grid grid-cols-1 gap-2 text-xs text-gray-500">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{report.location || report.room?.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <User className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">{report.is_anonymous ? 'Anonymous' : report.reporter_name}</span>
                          </div>
                          <div className="flex items-center ml-2">
                            <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span>{new Date(report.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setShowModal(true);
                            fetchComments(report.id);
                          }}
                          className="flex items-center space-x-2 px-3 py-2 text-xs font-medium text-orange-600 bg-orange-100 hover:bg-orange-200 rounded-lg transition-all duration-200"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>

                    {/* Desktop Layout - Horizontal */}
                    <div className="hidden sm:flex items-center justify-between">
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile-Friendly Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8 sm:mt-12">
            <div className="flex items-center space-x-1 sm:space-x-2 bg-white/70 backdrop-blur-lg rounded-xl sm:rounded-2xl p-2 border border-white/20">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-gray-600 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {/* Show fewer page numbers on mobile */}
              {totalPages <= 5 ? (
                // Show all pages if 5 or fewer
                [...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${currentPage === i + 1
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-orange-100'
                      }`}
                  >
                    {i + 1}
                  </button>
                ))
              ) : (
                // Show condensed pagination for many pages
                <>
                  {currentPage > 2 && (
                    <>
                      <button
                        onClick={() => setCurrentPage(1)}
                        className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-600 hover:bg-orange-100 transition-all duration-200"
                      >
                        1
                      </button>
                      {currentPage > 3 && <span className="text-gray-400 px-1">...</span>}
                    </>
                  )}

                  {[...Array(3)].map((_, i) => {
                    const pageNum = currentPage - 1 + i;
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${currentPage === pageNum
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                          : 'text-gray-600 hover:bg-orange-100'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {currentPage < totalPages - 1 && (
                    <>
                      {currentPage < totalPages - 2 && <span className="text-gray-400 px-1">...</span>}
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-600 hover:bg-orange-100 transition-all duration-200"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </>
              )}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-gray-600 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile-Optimized Detail Modal */}
      {showModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900">Report Details</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              {/* Report Info */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
                <h4 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">{selectedReport.title}</h4>
                <p className="text-sm sm:text-base text-gray-700 mb-4">{selectedReport.description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div><span className="font-medium">Category:</span> {selectedReport.category}</div>
                  <div><span className="font-medium">Priority:</span> {selectedReport.priority}</div>
                  <div><span className="font-medium">Status:</span> {selectedReport.status}</div>
                  <div><span className="font-medium">Location:</span> {selectedReport.location}</div>
                </div>
              </div>

              {/* Comments Section */}
              <div className="space-y-4 sm:space-y-6">
                <h5 className="text-base sm:text-lg font-semibold text-gray-900">Comments</h5>

                {comments.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 text-gray-500">
                    <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm sm:text-base">No comments yet. Be the first to comment!</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4 max-h-60 sm:max-h-80 overflow-y-auto">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 space-y-1 sm:space-y-0">
                          <span className="font-medium text-gray-900 text-sm sm:text-base">{comment.commenter_name}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm sm:text-base leading-relaxed">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Comment Form - Mobile Optimized */}
                <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                  <h6 className="font-medium text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Add Your Comment</h6>

                  <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4 mb-4">
                    <input
                      type="text"
                      value={commenterInfo.name}
                      onChange={(e) => setCommenterInfo(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Your Name"
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <input
                      type="email"
                      value={commenterInfo.email}
                      onChange={(e) => setCommenterInfo(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Email (Optional)"
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write your comment..."
                    rows={3}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4 resize-none"
                  />

                  <button
                    onClick={addComment}
                    disabled={!newComment.trim() || !commenterInfo.name.trim()}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg sm:rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <Send className="h-3 w-3 sm:h-4 sm:w-4" />
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