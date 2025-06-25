import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Package,
  CheckCircle,
  BookOpen,
  Users,
  Building,
  Settings,
  User,
  FileText,
  BarChart3,
  Clock,
  GraduationCap,
  Wrench,
  ClipboardCheck,
  MapPin,
  CalendarCheck,
  CheckSquare,
  X,
  ChevronRight,
  Sparkles,
  Home,
  PieChart,
  Zap,
} from 'lucide-react';
import { User as UserType } from '../../types';
import { supabase } from '../../lib/supabase';

interface SidebarProps {
  user: UserType | null;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, isOpen, onClose }) => {
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [pendingCheckoutsCount, setPendingCheckoutsCount] = useState(0);

  useEffect(() => {
    if (user && (user.role === 'super_admin' || user.role === 'department_admin')) {
      fetchPendingBookingsCount();
      fetchPendingCheckoutsCount();
      
      // Set up real-time subscription for pending bookings
      const bookingSubscription = supabase
        .channel('sidebar-pending-bookings')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'bookings',
            filter: 'status=eq.pending'
          }, 
          () => {
            fetchPendingBookingsCount();
          }
        )
        .subscribe();

      // Set up real-time subscription for pending checkouts
      const checkoutSubscription = supabase
        .channel('sidebar-pending-checkouts')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'checkouts',
            filter: 'approved_by=is.null'
          }, 
          () => {
            fetchPendingCheckoutsCount();
          }
        )
        .subscribe();

      return () => {
        bookingSubscription.unsubscribe();
        checkoutSubscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchPendingBookingsCount = async () => {
    try {
      let query = supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      // If department admin, only count bookings for their department
      if (user?.role === 'department_admin' && user.department_id) {
        // We need to join with rooms to filter by department
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id,
            room:rooms!inner(department_id)
          `, { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('room.department_id', user.department_id);

        if (error) throw error;
        setPendingBookingsCount(data?.length || 0);
      } else {
        const { count, error } = await query;
        if (error) throw error;
        setPendingBookingsCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching pending bookings count:', error);
    }
  };

  const fetchPendingCheckoutsCount = async () => {
    try {
      let query = supabase
        .from('checkouts')
        .select('id', { count: 'exact', head: true })
        .is('approved_by', null);

      // If department admin, only count checkouts for their department
      if (user?.role === 'department_admin' && user.department_id) {
        // We need to join with bookings and rooms to filter by department
        const { data, error } = await supabase
          .from('checkouts')
          .select(`
            id,
            booking:bookings!inner(
              room:rooms!inner(department_id)
            )
          `, { count: 'exact', head: true })
          .is('approved_by', null)
          .eq('booking.room.department_id', user.department_id);

        if (error) throw error;
        setPendingCheckoutsCount(data?.length || 0);
      } else {
        const { count, error } = await query;
        if (error) throw error;
        setPendingCheckoutsCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching pending checkouts count:', error);
    }
  };

  const getMenuItems = () => {
    if (!user) {
      // Public/Non-logged student access
      return [
        { 
          icon: Home, 
          label: getText('Dashboard', 'Dasbor'), 
          path: '/', 
          badge: null, 
          color: 'from-blue-500 to-indigo-500' 
        },
        { 
          icon: Calendar, 
          label: getText('Book Room', 'Pesan Ruangan'), 
          path: '/book', 
          badge: null, 
          color: 'from-emerald-500 to-teal-500' 
        },
        { 
          icon: Package, 
          label: getText('Tool Lending', 'Peminjaman Alat'), 
          path: '/tools', 
          badge: null, 
          color: 'from-purple-500 to-pink-500' 
        },
        { 
          icon: CheckCircle, 
          label: getText('Check Out', 'Pengembalian'), 
          path: '/checkout', 
          badge: null, 
          color: 'from-orange-500 to-red-500' 
        },
      ];
    }

    const baseItems = [
      { 
        icon: Home, 
        label: getText('Dashboard', 'Dasbor'), 
        path: '/', 
        badge: null, 
        color: 'from-blue-500 to-indigo-500' 
      },
      { 
        icon: Calendar, 
        label: getText('Book Room', 'Pesan Ruangan'), 
        path: '/book', 
        badge: null, 
        color: 'from-emerald-500 to-teal-500' 
      },
      { 
        icon: Package, 
        label: getText('Tool Lending', 'Peminjaman Alat'), 
        path: '/tools', 
        badge: null, 
        color: 'from-purple-500 to-pink-500' 
      },
      { 
        icon: CheckCircle, 
        label: getText('Check Out', 'Pengembalian'), 
        path: '/checkout', 
        badge: null, 
        color: 'from-orange-500 to-red-500' 
      },
      { 
        icon: User, 
        label: getText('Profile', 'Profil'), 
        path: '/profile', 
        badge: null, 
        color: 'from-gray-500 to-slate-500' 
      },
    ];

    if (user.role === 'department_admin') {
      // Department admin menu
      return [
        { 
          icon: PieChart, 
          label: getText('Department Analytics', 'Analitik Departemen'), 
          path: '/department-analytics', 
          badge: null, 
          color: 'from-blue-500 to-indigo-500' 
        },
        { 
          icon: CalendarCheck, 
          label: getText('Exam Management', 'Manajemen Ujian'), 
          path: '/exams', 
          badge: null, 
          color: 'from-emerald-500 to-teal-500' 
        },
        { 
          icon: Clock, 
          label: getText('Exam Schedules', 'Jadwal Ujian'), 
          path: '/exam-schedules', 
          badge: null, 
          color: 'from-purple-500 to-pink-500' 
        },
        { 
          icon: BookOpen, 
          label: getText('Department Bookings', 'Pemesanan Departemen'), 
          path: '/department-bookings', 
          badge: null, 
          color: 'from-orange-500 to-red-500' 
        },
        { 
          icon: FileText, 
          label: getText('Department Reports', 'Laporan Departemen'), 
          path: '/department-reports', 
          badge: null, 
          color: 'from-teal-500 to-cyan-500' 
        },
        { 
          icon: Wrench, 
          label: getText('Equipment Management', 'Manajemen Peralatan'), 
          path: '/department-equipment', 
          badge: null, 
          color: 'from-indigo-500 to-purple-500' 
        },
        { 
          icon: Users, 
          label: getText('User Management', 'Manajemen Pengguna'), 
          path: '/users', 
          badge: null, 
          color: 'from-pink-500 to-rose-500' 
        },
        { 
          icon: User, 
          label: getText('Profile', 'Profil'), 
          path: '/profile', 
          badge: null, 
          color: 'from-gray-500 to-slate-500' 
        },
      ];
    }

    if (user.role === 'super_admin') {
      return [
        { 
          icon: BarChart3, 
          label: getText('System Analytics', 'Analitik Sistem'), 
          path: '/', 
          badge: null, 
          color: 'from-blue-500 to-indigo-500' 
        },
        { 
          icon: Building, 
          label: getText('Room Management', 'Manajemen Ruangan'), 
          path: '/rooms', 
          badge: null, 
          color: 'from-emerald-500 to-teal-500' 
        },
        { 
          icon: Users, 
          label: getText('User Management', 'Manajemen Pengguna'), 
          path: '/users', 
          badge: null, 
          color: 'from-purple-500 to-pink-500' 
        },
        { 
          icon: MapPin, 
          label: getText('Departments', 'Departemen'), 
          path: '/departments', 
          badge: null, 
          color: 'from-orange-500 to-red-500' 
        },
        { 
          icon: GraduationCap, 
          label: getText('Study Programs', 'Program Studi'), 
          path: '/study-programs', 
          badge: null, 
          color: 'from-teal-500 to-cyan-500' 
        },
        { 
          icon: Calendar, 
          label: getText('Booking Management', 'Manajemen Pemesanan'), 
          path: '/bookings', 
          badge: pendingBookingsCount > 0 ? pendingBookingsCount : null, 
          color: 'from-indigo-500 to-purple-500' 
        },
        { 
          icon: ClipboardCheck, 
          label: getText('Validation Queue', 'Antrian Validasi'), 
          path: '/validation', 
          badge: pendingCheckoutsCount > 0 ? pendingCheckoutsCount : null, 
          color: 'from-pink-500 to-rose-500' 
        },
        { 
          icon: CheckSquare, 
          label: getText('Checkout Validation', 'Validasi Pengembalian'), 
          path: '/checkout-validation', 
          badge: null, 
          color: 'from-amber-500 to-orange-500' 
        },
        { 
          icon: Clock, 
          label: getText('Lecture Schedules', 'Jadwal Kuliah'), 
          path: '/schedules', 
          badge: null, 
          color: 'from-lime-500 to-emerald-500' 
        },
        { 
          icon: CalendarCheck, 
          label: getText('Exam Management', 'Manajemen Ujian'), 
          path: '/exams', 
          badge: null, 
          color: 'from-sky-500 to-blue-500' 
        },
        { 
          icon: Wrench, 
          label: getText('Tool Administration', 'Administrasi Alat'), 
          path: '/tool-admin', 
          badge: null, 
          color: 'from-violet-500 to-purple-500' 
        },
        { 
          icon: FileText, 
          label: getText('Reports', 'Laporan'), 
          path: '/reports', 
          badge: null, 
          color: 'from-rose-500 to-pink-500' 
        },
        { 
          icon: Settings, 
          label: getText('System Settings', 'Pengaturan Sistem'), 
          path: '/settings', 
          badge: null, 
          color: 'from-gray-500 to-slate-500' 
        },
      ];
    }

    // Regular student menu items
    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <div 
      id="mobile-sidebar"
      className={`
        h-full w-80
        bg-white border-r border-gray-200 
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-300 ease-in-out
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200/50 flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg flex-shrink-0">
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">
              SIMPEL Kuliah
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">
              {getText('Smart Campus Management', 'Sistem Manajemen Kampus Cerdas')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-200 lg:hidden flex-shrink-0"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* User Info */}
      {user && (
        <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200/50 flex-shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="relative flex-shrink-0">
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 bg-emerald-400 border-2 border-white rounded-full">
                <div className="h-full w-full bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg font-bold text-gray-900 truncate">{user.full_name}</p>
              <p className="text-xs sm:text-sm text-gray-600 capitalize truncate">
                {getText( 
                  user.role === 'super_admin' ? 'Super Admin' :
                  user.role === 'department_admin' ? 'Admin Departemen' :
                  user.role === 'student' ? 'Mahasiswa' :
                  user.role === 'lecturer' ? 'Dosen' : user.role
                )}
              </p>
              <div className="flex items-center mt-1">
                <div className="h-2 w-2 bg-emerald-400 rounded-full mr-2 flex-shrink-0"></div>
                <span className="text-xs text-emerald-600 font-medium">
                  {getText('Online', 'Online')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto py-4 sm:py-6">
        <div className="px-3 sm:px-4 space-y-1 sm:space-y-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={index}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r text-white shadow-lg transform scale-[1.02]'
                      : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-md hover:scale-[1.01]'
                  } ${isActive ? item.color : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <div className={`p-2 sm:p-2.5 rounded-xl transition-all duration-200 flex-shrink-0 ${
                        isActive 
                          ? 'bg-white/20 shadow-lg' 
                          : 'bg-gray-100/50 group-hover:bg-white/80'
                      }`}>
                        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 transition-colors duration-200 ${
                          isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-800'
                        }`} />
                      </div>
                      <span className="text-sm font-semibold truncate">
                        {item.label}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {item.badge && (
                        <span className={`inline-flex items-center justify-center px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-200 ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-red-100 text-red-600 group-hover:bg-red-200'
                        }`}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                      
                      <ChevronRight className={`h-4 w-4 transition-all duration-200 ${
                        isActive 
                          ? 'text-white/70 transform translate-x-1' 
                          : 'text-gray-400 group-hover:text-gray-600 group-hover:transform group-hover:translate-x-1'
                      }`} />
                    </div>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 sm:p-6 border-t border-gray-200/50 bg-gradient-to-r from-gray-50 to-blue-50 flex-shrink-0">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-2">
            {getText('Powered by', 'Didukung oleh')}
          </p>
          <div className="flex items-center justify-center space-x-2">
            <Zap className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              SIMPEL Technology
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {getText('Version 2.0.1', 'Versi 2.0.1')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;