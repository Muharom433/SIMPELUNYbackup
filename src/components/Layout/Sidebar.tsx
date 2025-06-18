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
        { icon: LayoutDashboard, label: 'Dashboard', path: '/', badge: null },
        { icon: Calendar, label: 'Book Room', path: '/book', badge: null },
        { icon: Package, label: 'Tool Lending', path: '/tools', badge: null },
        { icon: CheckCircle, label: 'Check Out', path: '/checkout', badge: null },
        { icon: BookOpen, label: 'My Bookings', path: '/my-bookings', badge: null },
      ];
    }

    const baseItems = [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/', badge: null },
      { icon: Calendar, label: 'Book Room', path: '/book', badge: null },
      { icon: Package, label: 'Tool Lending', path: '/tools', badge: null },
      { icon: CheckCircle, label: 'Check Out', path: '/checkout', badge: null },
      { icon: BookOpen, label: 'My Bookings', path: '/my-bookings', badge: null },
      { icon: User, label: 'Profile', path: '/profile', badge: null },
    ];

    if (user.role === 'department_admin') {
      // Simplified menu for department admins
      return [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/', badge: null },
        { icon: Calendar, label: 'Exam Management', path: '/exams', badge: null },
        { icon: Users, label: 'User Management', path: '/users', badge: null },
        { icon: User, label: 'Profile', path: '/profile', badge: null },
      ];
    }

    if (user.role === 'super_admin') {
      return [
        { icon: LayoutDashboard, label: 'System Analytics', path: '/', badge: null },
        { icon: Building, label: 'Room Management', path: '/rooms', badge: null },
        { icon: Users, label: 'User Management', path: '/users', badge: null },
        { icon: Building, label: 'Departments', path: '/departments', badge: null },
        { icon: GraduationCap, label: 'Study Programs', path: '/study-programs', badge: null },
        { icon: BookOpen, label: 'Booking Management', path: '/bookings', badge: pendingBookingsCount > 0 ? pendingBookingsCount : null },
        { icon: Bell, label: 'Validation Queue', path: '/validation', badge: pendingBookingsCount + pendingCheckoutsCount > 0 ? pendingBookingsCount + pendingCheckoutsCount : null },
        { icon: Clock, label: 'Lecture Schedules', path: '/schedules', badge: null },
        { icon: Calendar, label: 'Exam Management', path: '/exams', badge: null },
        { icon: Wrench, label: 'Tool Administration', path: '/tool-admin', badge: null },
        { icon: BarChart3, label: 'Reports', path: '/reports', badge: null },
        { icon: Settings, label: 'System Settings', path: '/settings', badge: null },
        { icon: User, label: 'Profile', path: '/profile', badge: null },
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
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 lg:translate-x-0 border-r border-gray-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
            <div className="flex items-center space-x-2">
              <Building className="h-8 w-8 text-white" />
              <span className="text-xl font-bold text-white">SIMPEL Kuliah</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                  }`
                }
              >
                <item.icon className={`h-5 w-5 mr-3 transition-colors duration-200 ${
                  'group-hover:text-blue-600'
                }`} />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full animate-pulse">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          {user && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user.role.replace('_', ' ')}
                  </p>
                  <div className="flex items-center mt-1">
                    <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                    <span className="text-xs text-gray-500">Online</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;