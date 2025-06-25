import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Bell, 
  LogOut, 
  LogIn, 
  Search, 
  Settings, 
  User as UserIcon, 
  CheckSquare,
  Calendar,
  Clock,
  ChevronDown,
  Sun,
  Moon,
  Sparkles,
  Zap,
  X
} from 'lucide-react';
import { User } from '../../types';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  user: User | null;
  onMenuClick: () => void;
  onSignOut: () => void;
  onSignIn: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onMenuClick, onSignOut, onSignIn }) => {
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [pendingCheckoutsCount, setPendingCheckoutsCount] = useState(0);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user && (user.role === 'super_admin' || user.role === 'department_admin')) {
      fetchPendingBookingsCount();
      fetchPendingCheckoutsCount();
      
      // Set up real-time subscription for pending bookings
      const bookingSubscription = supabase
        .channel('pending-bookings')
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
        .channel('pending-checkouts')
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

  const totalNotifications = pendingBookingsCount + pendingCheckoutsCount;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const closeAllDropdowns = () => {
    setShowNotificationsDropdown(false);
    setShowUserDropdown(false);
  };

  return (
    <>
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-30 shadow-lg">
        <div className="flex items-center justify-between px-4 lg:px-6 py-4">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            <button
              onClick={onMenuClick}
              className="p-2.5 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-white/60 lg:hidden transition-all duration-200 backdrop-blur-sm border border-gray-200/50"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <div className="hidden sm:block">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    SIMPEL Kuliah
                  </h1>
                  <p className="text-sm text-gray-600 font-medium">
                    Smart Campus Management
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Center Section - Search */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-8">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search rooms, users, bookings..."
                className="w-full pl-12 pr-6 py-3 bg-white/50 border border-gray-200/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400 backdrop-blur-sm"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <kbd className="hidden lg:inline-flex items-center px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100/80 border border-gray-200/50 rounded">
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-2 lg:space-x-4">
            {/* Time Display */}
            <div className="hidden lg:flex items-center space-x-3 px-4 py-2 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border border-gray-200/50">
              <Clock className="h-4 w-4 text-gray-500" />
              <div className="text-right">
                <div className="text-lg font-bold text-gray-800">{formatTime(currentTime)}</div>
                <div className="text-xs text-gray-500 leading-none">{formatDate(currentTime).split(',')[0]}</div>
              </div>
            </div>

            {user && (
              <>
                {/* Notifications */}
                <div className="relative">
                  <button 
                    className="relative p-3 text-gray-600 hover:text-gray-900 hover:bg-white/60 rounded-2xl transition-all duration-200 backdrop-blur-sm border border-gray-200/50 hover:border-gray-300/50"
                    onClick={() => {
                      setShowNotificationsDropdown(!showNotificationsDropdown);
                      setShowUserDropdown(false);
                    }}
                  >
                    <Bell className="h-5 w-5" />
                    {totalNotifications > 0 && (
                      <div className="absolute -top-1 -right-1">
                        <span className="flex h-5 w-5 items-center justify-center bg-gradient-to-r from-red-500 to-pink-500 rounded-full shadow-lg">
                          <span className="text-xs text-white font-bold">
                            {totalNotifications > 99 ? '99+' : totalNotifications}
                          </span>
                        </span>
                        <span className="absolute inset-0 bg-gradient-to-r from-red-400 to-pink-400 rounded-full animate-ping opacity-30"></span>
                      </div>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotificationsDropdown && (
                    <div className="absolute right-0 mt-3 w-96 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 z-50 overflow-hidden">
                      <div className="p-4 border-b border-gray-200/50 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
                          <button
                            onClick={() => setShowNotificationsDropdown(false)}
                            className="p-1 rounded-lg hover:bg-white/60 transition-colors duration-200"
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto">
                        {totalNotifications === 0 ? (
                          <div className="p-8 text-center">
                            <div className="p-4 bg-gray-100/50 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                              <Bell className="h-8 w-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 font-medium">No new notifications</p>
                            <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
                          </div>
                        ) : (
                          <div className="p-2 space-y-2">
                            {pendingBookingsCount > 0 && (
                              <div 
                                className="p-4 hover:bg-blue-50 cursor-pointer rounded-xl transition-all duration-200 border border-transparent hover:border-blue-200/50"
                                onClick={() => {
                                  navigate('/bookings');
                                  setShowNotificationsDropdown(false);
                                }}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                                    <Calendar className="h-5 w-5 text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">
                                      Pending Room Bookings
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {pendingBookingsCount} booking{pendingBookingsCount !== 1 ? 's' : ''} waiting for approval
                                    </p>
                                    <div className="flex items-center mt-2">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Action Required
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {pendingCheckoutsCount > 0 && (
                              <div 
                                className="p-4 hover:bg-emerald-50 cursor-pointer rounded-xl transition-all duration-200 border border-transparent hover:border-emerald-200/50"
                                onClick={() => {
                                  navigate('/validation');
                                  setShowNotificationsDropdown(false);
                                }}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl shadow-lg">
                                    <CheckSquare className="h-5 w-5 text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">
                                      Pending Checkouts
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {pendingCheckoutsCount} checkout{pendingCheckoutsCount !== 1 ? 's' : ''} waiting for approval
                                    </p>
                                    <div className="flex items-center mt-2">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                        Review Needed
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {totalNotifications > 0 && (
                        <div className="p-3 border-t border-gray-200/50 bg-gradient-to-r from-gray-50 to-blue-50">
                          <button 
                            className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors duration-200"
                            onClick={() => setShowNotificationsDropdown(false)}
                          >
                            Mark all as read
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Settings */}
                <button className="p-3 text-gray-600 hover:text-gray-900 hover:bg-white/60 rounded-2xl transition-all duration-200 backdrop-blur-sm border border-gray-200/50 hover:border-gray-300/50">
                  <Settings className="h-5 w-5" />
                </button>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowUserDropdown(!showUserDropdown);
                      setShowNotificationsDropdown(false);
                    }}
                    className="flex items-center space-x-3 p-2 hover:bg-white/60 rounded-2xl transition-all duration-200 backdrop-blur-sm border border-gray-200/50 hover:border-gray-300/50"
                  >
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
                    </div>
                    <div className="relative">
                      <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <UserIcon className="h-5 w-5 text-white" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-400 border-2 border-white rounded-full">
                        <div className="h-full w-full bg-emerald-400 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* User Dropdown */}
                  {showUserDropdown && (
                    <div className="absolute right-0 mt-3 w-64 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 z-50 overflow-hidden">
                      <div className="p-4 border-b border-gray-200/50 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex items-center space-x-3">
                          <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <UserIcon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{user.full_name}</p>
                            <p className="text-sm text-gray-600 capitalize">{user.role.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-2">
                        <button
                          onClick={() => {
                            navigate('/profile');
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors duration-200"
                        >
                          <UserIcon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">View Profile</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            navigate('/settings');
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors duration-200"
                        >
                          <Settings className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">Settings</span>
                        </button>
                      </div>
                      
                      <div className="p-2 border-t border-gray-200/50">
                        <button
                          onClick={() => {
                            onSignOut();
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center space-x-3 p-3 text-left hover:bg-red-50 rounded-xl transition-colors duration-200 text-red-600 hover:text-red-700"
                        >
                          <LogOut className="h-4 w-4" />
                          <span className="text-sm font-medium">Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {!user && (
              <button
                onClick={onSignIn}
                className="flex items-center space-x-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Click outside to close dropdowns */}
      {(showNotificationsDropdown || showUserDropdown) && (
        <div
          className="fixed inset-0 z-20"
          onClick={closeAllDropdowns}
        />
      )}
    </>
  );
};

export default Header;