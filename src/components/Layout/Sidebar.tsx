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
  Bell,
  ClipboardList,
  Shield,
  Database,
  TrendingUp,
  MapPin,
  UserCheck,
  CalendarCheck,
  BookCheck,
  Zap,
  CheckSquare,
  Flag,
  Menu,
  X,
  ChevronRight,
  Sparkles,
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
        { icon: LayoutDashboard, label: 'Dashboard', path: '/', badge: null, color: 'from-blue-500 to-indigo-500' },
        { icon: Calendar, label: 'Book Room', path: '/book', badge: null, color: 'from-emerald-500 to-teal-500' },
        { icon: Package, label: 'Tool Lending', path: '/tools', badge: null, color: 'from-purple-500 to-pink-500' },
        { icon: CheckCircle, label: 'Check Out', path: '/checkout', badge: null, color: 'from-orange-500 to-red-500' },
      ];
    }

    const baseItems = [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/', badge: null, color: 'from-blue-500 to-indigo-500' },
      { icon: Calendar, label: 'Book Room', path: '/book', badge: null, color: 'from-emerald-500 to-teal-500' },
      { icon: Package, label: 'Tool Lending', path: '/tools', badge: null, color: 'from-purple-500 to-pink-500' },
      { icon: CheckCircle, label: 'Check Out', path: '/checkout', badge: null, color: 'from-orange-500 to-red-500' },
      { icon: User, label: 'Profile', path: '/profile', badge: null, color: 'from-gray-500 to-slate-500' },
    ];

    if (user.role === 'department_admin') {
      // Simplified menu for department admins
      return [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/', badge: null, color: 'from-blue-500 to-indigo-500' },
        { icon: Calendar, label: 'Exam Management', path: '/exams', badge: null, color: 'from-emerald-500 to-teal-500' },
        { icon: Users, label: 'User Management', path: '/users', badge: null, color: 'from-purple-500 to-pink-500' },
        { icon: User, label: 'Profile', path: '/profile', badge: null, color: 'from-gray-500 to-slate-500' },
      ];
    }

    if (user.role === 'super_admin') {
      return [
        { icon: LayoutDashboard, label: 'System Analytics', path: '/', badge: null, color: 'from-blue-500 to-indigo-500' },
        { icon: Building, label: 'Room Management', path: '/rooms', badge: null, color: 'from-emerald-500 to-teal-500' },
        { icon: Users, label: 'User Management', path: '/users', badge: null, color: 'from-purple-500 to-pink-500' },
        { icon: Building, label: 'Departments', path: '/departments', badge: null, color: 'from-cyan-500 to-blue-500' },
        { icon: GraduationCap, label: 'Study Programs', path: '/study-programs', badge: null, color: 'from-indigo-500 to-purple-500' },
        { icon: BookOpen, label: 'Booking Management', path: '/bookings', badge: pendingBookingsCount > 0 ? pendingBookingsCount : null, color: 'from-yellow-500 to-orange-500' },
        { icon: Bell, label: 'Validation Queue', path: '/validation', badge: pendingBookingsCount + pendingCheckoutsCount > 0 ? pendingBookingsCount + pendingCheckoutsCount : null, color: 'from-red-500 to-pink-500' },
        { icon: Clock, label: 'Lecture Schedules', path: '/schedules', badge: null, color: 'from-green-500 to-emerald-500' },
        { icon: Calendar, label: 'Exam Management', path: '/exams', badge: null, color: 'from-teal-500 to-cyan-500' },
        { icon: Wrench, label: 'Tool Administration', path: '/tool-admin', badge: null, color: 'from-slate-500 to-gray-500' },
        { icon: BarChart3, label: 'Reports', path: '/reports', badge: null, color: 'from-violet-500 to-purple-500' },
        { icon: Settings, label: 'System Settings', path: '/settings', badge: null, color: 'from-gray-500 to-slate-500' },
        { icon: User, label: 'Profile', path: '/profile', badge: null, color: 'from-rose-500 to-pink-500' },
      ];
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-72 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 backdrop-blur-xl transform transition-all duration-500 ease-out z-50 lg:translate-x-0 border-r border-white/20 shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-emerald-400/20 to-teal-400/20 rounded-full translate-y-12 -translate-x-12"></div>

          {/* Header */}
          <div className="relative">
            <div className="flex items-center justify-between h-20 px-6 bg-white/70 backdrop-blur-sm border-b border-white/20">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                  <Building className="h-7 w-7 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    SIMPEL
                  </span>
                  <div className="text-sm text-gray-600 font-medium">Kuliah System</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-xl bg-white/50 hover:bg-white/70 transition-all duration-200"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-hide">
            {menuItems.map((item, index) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center px-4 py-4 text-sm font-medium rounded-2xl transition-all duration-300 ease-out relative overflow-hidden ${
                    isActive
                      ? 'bg-white/80 backdrop-blur-sm text-gray-800 shadow-lg border border-white/30 scale-[1.02]'
                      : 'text-gray-600 hover:bg-white/50 hover:backdrop-blur-sm hover:text-gray-800 hover:shadow-md hover:scale-[1.01] hover:border hover:border-white/20'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Icon container with gradient background */}
                    <div className={`relative p-2.5 rounded-xl mr-4 transition-all duration-300 ${
                      isActive 
                        ? `bg-gradient-to-r ${item.color} shadow-lg`
                        : 'bg-gray-100/50 group-hover:bg-gradient-to-r group-hover:' + item.color.split(' ').join(' group-hover:') + ' group-hover:shadow-md'
                    }`}>
                      <item.icon className={`h-5 w-5 transition-all duration-300 ${
                        isActive ? 'text-white' : 'text-gray-600 group-hover:text-white'
                      }`} />
                      
                      {/* Sparkle effect for active items */}
                      {isActive && (
                        <div className="absolute -top-1 -right-1">
                          <Sparkles className="h-3 w-3 text-yellow-300 animate-pulse" />
                        </div>
                      )}
                    </div>
                    
                    <span className="flex-1 font-semibold transition-all duration-300">
                      {item.label}
                    </span>
                    
                    {/* Badge */}
                    {item.badge && item.badge > 0 && (
                      <div className="relative">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 rounded-full shadow-lg animate-pulse">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-pink-400 rounded-full animate-ping opacity-30"></div>
                      </div>
                    )}
                    
                    {/* Arrow indicator for active item */}
                    {isActive && (
                      <ChevronRight className="h-4 w-4 text-gray-400 transition-all duration-300" />
                    )}
                    
                    {/* Hover effect background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User Profile Section */}
          {user && (
            <div className="relative">
              <div className="m-4 p-4 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    {/* Online indicator */}
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-400 border-2 border-white rounded-full shadow-sm">
                      <div className="h-full w-full bg-emerald-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {user.full_name}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200/50">
                        {user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <div className="flex items-center mt-1.5">
                      <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-xs text-emerald-600 font-medium">Online</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Version info */}
          <div className="px-6 pb-4">
            <div className="text-center">
              <div className="text-xs text-gray-400 font-medium">Version 2.1.0</div>
              <div className="text-xs text-gray-400">© 2024 SIMPEL Kuliah</div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
};

export default Sidebar;