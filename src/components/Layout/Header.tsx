import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Bell, 
  LogOut, 
  LogIn, 
  Settings, 
  User as UserIcon, 
  CheckSquare,
  Calendar,
  Clock,
  ChevronDown,
  Sparkles,
  X,
  Globe
} from 'lucide-react';
import { User as UserType } from '../../types';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useLanguage, translations } from '../../contexts/LanguageContext';

interface HeaderProps {
  user: UserType | null;
  onMenuClick: () => void;
  onSignOut: () => void;
  onSignIn: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onMenuClick, onSignOut, onSignIn }) => {
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [pendingCheckoutsCount, setPendingCheckoutsCount] = useState(0);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  
  // Use language context
  const { 
    currentLanguage, 
    setLanguage, 
    getText, 
    formatTime, 
    formatDate, 
    getLanguageLabel, 
    getLanguageFlag 
  } = useLanguage();

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

  const changeLanguage = (lang: 'en' | 'id') => {
    setLanguage(lang);
    setShowLanguageDropdown(false);
  };

  const closeAllDropdowns = () => {
    setShowNotificationsDropdown(false);
    setShowUserDropdown(false);
    setShowLanguageDropdown(false);
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
                    {getText(translations.smartRoomBooking.en, translations.smartRoomBooking.id)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Center Section - Language Switcher */}
          <div className="hidden md:flex flex-1 max-w-xs mx-8 justify-center">
            <div className="relative">
              <button
                onClick={() => {
                  setShowLanguageDropdown(!showLanguageDropdown);
                  setShowNotificationsDropdown(false);
                  setShowUserDropdown(false);
                }}
                className="flex items-center space-x-3 px-4 py-3 bg-white/50 border border-gray-200/50 rounded-2xl hover:bg-white/70 transition-all duration-200 backdrop-blur-sm min-w-[180px]"
              >
                <Globe className="h-5 w-5 text-gray-500" />
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getLanguageFlag(currentLanguage)}</span>
                  <span className="text-sm font-medium text-gray-700">{getLanguageLabel(currentLanguage)}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showLanguageDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Language Dropdown */}
              {showLanguageDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 z-50 overflow-hidden">
                  <div className="p-2">
                    {(['en', 'id'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => changeLanguage(lang)}
                        className={`w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-all duration-200 ${
                          currentLanguage === lang ? 'bg-blue-50 border border-blue-200/50' : ''
                        }`}
                      >
                        <span className="text-lg">{getLanguageFlag(lang)}</span>
                        <span className={`text-sm font-medium ${
                          currentLanguage === lang ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                          {getLanguageLabel(lang)}
                        </span>
                        {currentLanguage === lang && (
                          <div className="ml-auto">
                            <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                      setShowLanguageDropdown(false);
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
                          <h3 className="text-lg font-bold text-gray-900">
                            {getText('Notifications', 'Notifikasi')}
                          </h3>
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
                            <p className="text-gray-500 font-medium">
                              {getText('No new notifications', 'Tidak ada notifikasi baru')}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              {getText("You're all caught up!", 'Semua sudah terbaca!')}
                            </p>
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
                                      {getText('Pending Room Bookings', 'Pemesanan Ruangan Menunggu')}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {pendingBookingsCount} {getText('booking', 'pemesanan')}{pendingBookingsCount !== 1 ? (currentLanguage === 'id' ? '' : 's') : ''} {getText('waiting for approval', 'menunggu persetujuan')}
                                    </p>
                                    <div className="flex items-center mt-2">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {getText('Action Required', 'Aksi Diperlukan')}
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
                                      {getText('Pending Checkouts', 'Pengembalian Menunggu')}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {pendingCheckoutsCount} {getText('checkout', 'pengembalian')}{pendingCheckoutsCount !== 1 ? (currentLanguage === 'id' ? '' : 's') : ''} {getText('waiting for approval', 'menunggu persetujuan')}
                                    </p>
                                    <div className="flex items-center mt-2">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                        {getText('Review Needed', 'Perlu Ditinjau')}
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
                            {getText('Mark all as read', 'Tandai semua sebagai telah dibaca')}
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
                      setShowLanguageDropdown(false);
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
                          <span className="text-sm font-medium text-gray-700">
                            {getText('View Profile', 'Lihat Profil')}
                          </span>
                        </button>
                        
                        <button
                          onClick={() => {
                            navigate('/settings');
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors duration-200"
                        >
                          <Settings className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">
                            {getText('Settings', 'Pengaturan')}
                          </span>
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
                          <span className="text-sm font-medium">
                            {getText('Sign Out', 'Keluar')}
                          </span>
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
                <span className="hidden sm:inline">
                  {getText('Sign In', 'Masuk')}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Click outside to close dropdowns */}
      {(showNotificationsDropdown || showUserDropdown || showLanguageDropdown) && (
        <div
          className="fixed inset-0 z-20"
          onClick={closeAllDropdowns}
        />
      )}
    </>
  );
};

export default Header;