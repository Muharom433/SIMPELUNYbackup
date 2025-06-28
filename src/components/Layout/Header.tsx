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
  Globe,
  FileText
} from 'lucide-react';
import { User as UserType } from '../../types';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useLanguage } from '../../contexts/LanguageContext';

interface HeaderProps {
  user: UserType | null;
  onMenuClick: () => void;
  onSignOut: () => void;
  onSignIn: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onMenuClick, onSignOut, onSignIn }) => {
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [pendingCheckoutsCount, setPendingCheckoutsCount] = useState(0);
  const [newReportsCount, setNewReportsCount] = useState(0);
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
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch notification counts function
  const fetchNotificationCounts = async () => {
    // Only fetch for super_admin
    if (user?.role !== 'super_admin') {
      return;
    }

    try {
      // Fetch for bookings
      const { count: bookingsCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingBookingsCount(bookingsCount || 0);

      // Fetch for checkouts
      const { count: checkoutsCount } = await supabase
        .from('checkouts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'returned');
      setPendingCheckoutsCount(checkoutsCount || 0);

      // Fetch for reports
      const { count: reportsCount } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
      setNewReportsCount(reportsCount || 0);

    } catch (error) {
      console.error('Error fetching notification counts:', error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchNotificationCounts();

    // Set up interval to refresh every minute (60000ms) only for super_admin
    let intervalId: NodeJS.Timeout;
    let bookingSubscription: any;
    let checkoutSubscription: any;
    let reportsSubscription: any;

    if (user?.role === 'super_admin') {
      // Set up interval for periodic refresh
      intervalId = setInterval(fetchNotificationCounts, 60000);

      // Set up real-time subscriptions for immediate updates
      bookingSubscription = supabase
        .channel('pending-bookings')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'bookings',
            filter: 'status=eq.pending'
          }, 
          () => {
            fetchNotificationCounts();
          }
        )
        .subscribe();

      checkoutSubscription = supabase
        .channel('pending-checkouts')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'checkouts',
            filter: 'status=eq.returned'
          }, 
          () => {
            fetchNotificationCounts();
          }
        )
        .subscribe();

      reportsSubscription = supabase
        .channel('new-reports')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'reports',
            filter: 'status=eq.new'
          }, 
          () => {
            fetchNotificationCounts();
          }
        )
        .subscribe();
    }

    // Cleanup on unmount or user change
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (bookingSubscription) {
        bookingSubscription.unsubscribe();
      }
      if (checkoutSubscription) {
        checkoutSubscription.unsubscribe();
      }
      if (reportsSubscription) {
        reportsSubscription.unsubscribe();
      }
    };
  }, [user]);

  const totalNotifications = pendingBookingsCount + pendingCheckoutsCount + newReportsCount;

  const changeLanguage = (lang: 'en' | 'id') => {
    setLanguage(lang);
    setShowLanguageDropdown(false);
  };

  const closeAllDropdowns = () => {
    setShowNotificationsDropdown(false);
    setShowUserDropdown(false);
    setShowLanguageDropdown(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Check if click is outside any dropdown
      const isOutsideDropdowns = !target.closest('[data-dropdown]');
      
      if (isOutsideDropdowns) {
        closeAllDropdowns();
      }
    };

    if (showNotificationsDropdown || showUserDropdown || showLanguageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationsDropdown, showUserDropdown, showLanguageDropdown]);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-bold text-blue-600">
                SIMPEL Kuliah
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                {getText('Smart Campus Management', 'Sistem Manajemen Kampus Cerdas')}
              </p>
            </div>
          </div>
        </div>

        {/* Center Section - Language (Desktop) + Mobile Language */}
        <div className="flex items-center">
          {/* Mobile Language Toggle */}
          <div className="relative lg:hidden" data-dropdown>
            <button
              onClick={() => {
                setShowLanguageDropdown(!showLanguageDropdown);
                setShowNotificationsDropdown(false);
                setShowUserDropdown(false);
              }}
              className="flex items-center p-2 rounded-lg hover:bg-gray-100 border border-gray-200"
            >
              <Globe className="h-4 w-4 text-gray-500" />
              <span className="ml-1 text-sm">{getLanguageFlag(currentLanguage)}</span>
            </button>

            {showLanguageDropdown && (
              <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-1">
                  {(['en', 'id'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => changeLanguage(lang)}
                      className={`w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-gray-50 rounded ${
                        currentLanguage === lang ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <span className="text-base">{getLanguageFlag(lang)}</span>
                      <span className={`text-sm font-medium ${
                        currentLanguage === lang ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {getLanguageLabel(lang)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Language Toggle */}
          <div className="relative hidden lg:block" data-dropdown>
            <button
              onClick={() => {
                setShowLanguageDropdown(!showLanguageDropdown);
                setShowNotificationsDropdown(false);
                setShowUserDropdown(false);
              }}
              className="flex items-center space-x-3 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              <Globe className="h-4 w-4 text-gray-500" />
              <span className="text-base">{getLanguageFlag(currentLanguage)}</span>
              <span className="text-sm font-medium text-gray-700">{getLanguageLabel(currentLanguage)}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {showLanguageDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-1">
                  {(['en', 'id'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => changeLanguage(lang)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 rounded ${
                        currentLanguage === lang ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <span className="text-base">{getLanguageFlag(lang)}</span>
                      <span className={`text-sm font-medium ${
                        currentLanguage === lang ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {getLanguageLabel(lang)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Time Display */}
          <div className="hidden xl:flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <Clock className="h-4 w-4 text-gray-500" />
            <div className="text-right">
              <div className="text-sm font-bold text-gray-800">{formatTime(currentTime)}</div>
              <div className="text-xs text-gray-500">{formatDate(currentTime).split(',')[0]}</div>
            </div>
          </div>

          {user && (
            <>
              {/* Notifications - Only visible for super_admin */}
              {user.role === 'super_admin' && (
                <div className="relative" data-dropdown>
                  <button 
                    className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                    onClick={() => {
                      setShowNotificationsDropdown(!showNotificationsDropdown);
                      setShowUserDropdown(false);
                      setShowLanguageDropdown(false);
                    }}
                  >
                    <Bell className="h-5 w-5" />
                    {totalNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-bold">
                          {totalNotifications > 99 ? '99+' : totalNotifications}
                        </span>
                      </span>
                    )}
                  </button>

                  {showNotificationsDropdown && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-gray-900">
                            {getText('Notifications', 'Notifikasi')}
                          </h3>
                          <button
                            onClick={() => setShowNotificationsDropdown(false)}
                            className="p-1 rounded hover:bg-gray-100"
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="max-h-80 overflow-y-auto">
                        {totalNotifications === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">
                              {getText('No new notifications', 'Tidak ada notifikasi baru')}
                            </p>
                          </div>
                        ) : (
                          <div className="p-2 space-y-2">
                            {pendingBookingsCount > 0 && (
                              <div 
                                className="p-4 hover:bg-blue-50 cursor-pointer rounded"
                                onClick={() => {
                                  navigate('/bookings');
                                  setShowNotificationsDropdown(false);
                                }}
                              >
                                <div className="flex items-start space-x-3">
                                  <Calendar className="h-5 w-5 text-blue-600 mt-1" />
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {getText('Pending Room Bookings', 'Pemesanan Ruangan Menunggu')}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {pendingBookingsCount} {getText('booking', 'pemesanan')} {getText('waiting for approval', 'menunggu persetujuan')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {pendingCheckoutsCount > 0 && (
                              <div 
                                className="p-4 hover:bg-green-50 cursor-pointer rounded"
                                onClick={() => {
                                  navigate('/validation');
                                  setShowNotificationsDropdown(false);
                                }}
                              >
                                <div className="flex items-start space-x-3">
                                  <CheckSquare className="h-5 w-5 text-green-600 mt-1" />
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {getText('Pending Checkouts', 'Pengembalian Menunggu')}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {pendingCheckoutsCount} {getText('checkout', 'pengembalian')} {getText('waiting for approval', 'menunggu persetujuan')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {newReportsCount > 0 && (
                              <div 
                                className="p-4 hover:bg-orange-50 cursor-pointer rounded"
                                onClick={() => {
                                  navigate('/reports');
                                  setShowNotificationsDropdown(false);
                                }}
                              >
                                <div className="flex items-start space-x-3">
                                  <FileText className="h-5 w-5 text-orange-600 mt-1" />
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {getText('New Reports', 'Laporan Baru')}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {newReportsCount} {getText('new report', 'laporan baru')} {getText('requiring attention', 'memerlukan perhatian')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Settings */}
              <button className="hidden sm:block p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
                <Settings className="h-5 w-5" 
                  onClick={() => {
                    toast("cocok");
                    console.log("cok jaran");
                  }}/>
              </button>

              {/* User Menu */}
              <div className="relative" data-dropdown>
                <button
                  onClick={() => {
                    setShowUserDropdown(!showUserDropdown);
                    setShowNotificationsDropdown(false);
                    setShowLanguageDropdown(false);
                  }}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg"
                >
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold text-gray-900">{user.full_name || 'User'}</p>
                    <p className="text-xs text-gray-500">
                      {user.role?.replace('_', ' ') || 'user'}
                    </p>
                  </div>
                  
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 bg-blue-500 rounded-lg flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.full_name || 'User'}</p>
                          <p className="text-sm text-gray-600">
                            {user.role?.replace('_', ' ') || 'user'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2">
                      <button
                        onClick={() => {
                          navigate('/profile');
                          setShowUserDropdown(false);
                        }}
                        className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded"
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
                        className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded"
                      >
                        <Settings className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {getText('Settings', 'Pengaturan')}
                        </span>
                      </button>
                    </div>
                    
                    <div className="p-2 border-t border-gray-200">
                      <button
                        onClick={() => {
                          onSignOut();
                          setShowUserDropdown(false);
                        }}
                        className="w-full flex items-center space-x-3 p-3 text-left hover:bg-red-50 rounded text-red-600"
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
              onClick={() => {
                navigate('/auth');
                onSignIn();
              }}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
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
  );
};

export default Header;