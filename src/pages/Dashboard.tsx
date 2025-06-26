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

const Dashboard: React.FC = () => {
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

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div 
            className="absolute top-20 left-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20"
            style={{ 
              transform: `translateY(${scrollY * 0.5}px)`,
              animation: 'blob 7s infinite'
            }}
          ></div>
          <div 
            className="absolute top-40 right-10 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-20"
            style={{ 
              transform: `translateY(${scrollY * 0.3}px)`,
              animation: 'blob 7s infinite 2s'
            }}
          ></div>
          <div 
            className="absolute bottom-20 left-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20"
            style={{ 
              transform: `translateY(${scrollY * 0.4}px)`,
              animation: 'blob 7s infinite 4s'
            }}
          ></div>
        </div>

        <div className="relative px-6 py-16 sm:px-12 lg:px-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Left Content */}
              <div className="text-white space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center px-4 py-2 bg-white bg-opacity-10 backdrop-blur-sm rounded-full text-sm font-medium">
                    <Star className="w-4 h-4 mr-2 text-yellow-400" />
                    Best Faculty Management System
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight">
                    Faculty of 
                    <span className="block bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                      Vocational
                    </span>
                  </h1>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-purple-100">
                    Yogyakarta State University
                  </h2>
                  <p className="text-sm sm:text-base lg:text-lg text-purple-100 leading-relaxed max-w-lg">
                    SIMPEL kuliah or Sistem Pelayanan kuliah is an Innovation to improve our services.
                  </p>
                </div>

                {/* Stats Cards in Hero */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-4 lg:p-6 border border-white border-opacity-20">
                    <div className="flex items-center space-x-3">
                      <div className="bg-green-500 p-2 rounded-xl">
                        <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xl lg:text-2xl font-bold">1200+</p>
                        <p className="text-xs lg:text-sm text-purple-200">Bookings</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center text-green-400 text-sm">
                      <ArrowUp className="w-4 h-4 mr-1" />
                      <span>98% Success Rate</span>
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-4 lg:p-6 border border-white border-opacity-20">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-500 p-2 rounded-xl">
                        <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xl lg:text-2xl font-bold">{formatTime(currentTime)}</p>
                        <p className="text-xs lg:text-sm text-purple-200">Live Time</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons - REMOVED */}

                {/* Contact Info */}
                <div className="flex items-center space-x-6 text-sm text-purple-200">
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
                        <Users className="w-32 h-32 text-purple-400" />
                      </div>
                    </div>
                    
                    {/* Building Text - Top Left Corner (2x bigger, moved down and further right from people) */}
                    <div 
                      className="absolute top-16 -left-8 lg:top-20 lg:-left-12 z-20"
                      style={{ animation: 'float 6s ease-in-out infinite' }}
                    >
                      <img 
                        src="/src/assets/Build.png" 
                        alt="Building Career" 
                        className="w-80 h-auto lg:w-104 drop-shadow-lg"
                        onError={(e) => {
                          // Fallback text if image doesn't load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling.style.display = 'block';
                        }}
                      />
                      <div 
                        className="bg-white rounded-2xl p-3 shadow-xl border border-gray-100"
                        style={{display: 'none'}}
                      >
                        <span className="text-base font-bold text-purple-700">
                          BUILDING CAREER
                        </span>
                      </div>
                    </div>
                    
                    {/* Shaping Text - Bottom Right Corner (2x bigger, moved down and further right) */}
                    <div 
                      className="absolute bottom-2 -right-12 lg:bottom-4 lg:-right-20 z-20"
                      style={{ animation: 'float 6s ease-in-out infinite 3s' }}
                    >
                      <img 
                        src="/src/assets/Shape.png" 
                        alt="Shaping Future" 
                        className="w-80 h-auto lg:w-104 drop-shadow-lg"
                        onError={(e) => {
                          // Fallback text if image doesn't load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling.style.display = 'block';
                        }}
                      />
                      <div 
                        className="bg-white rounded-2xl p-3 shadow-xl border border-gray-100"
                        style={{display: 'none'}}
                      >
                        <span className="text-base font-bold text-blue-700">
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

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              <Zap className="w-4 h-4 mr-2" />
              Our Features
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
              Everything You Need for
              <span className="block text-purple-600">Smart Room Management</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Calendar,
                title: 'Smart Booking',
                description: 'Advanced scheduling system with real-time availability and conflict prevention.',
                color: 'bg-gradient-to-br from-blue-500 to-blue-600'
              },
              {
                icon: Shield,
                title: 'Secure Access',
                description: 'Multi-level authentication with role-based permissions for enhanced security.',
                color: 'bg-gradient-to-br from-green-500 to-green-600'
              },
              {
                icon: Smartphone,
                title: 'Mobile Ready',
                description: 'Fully responsive design that works perfectly on all devices and platforms.',
                color: 'bg-gradient-to-br from-purple-500 to-purple-600'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-purple-200 transform hover:-translate-y-2"
              >
                <div className={`${feature.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Dashboard Section */}
      <div className="py-24 bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
              Real-time Dashboard
            </h2>
            <p className="text-xl text-gray-600">Monitor your facility usage with live statistics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              {
                title: 'Available Rooms',
                value: stats.availableRooms,
                subtitle: 'Ready for booking',
                icon: Building,
                color: 'bg-gradient-to-r from-purple-500 to-purple-600',
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
                color: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
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

          {/* Quick Actions Grid */}
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Calendar, label: 'Book Room', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
                { icon: Package, label: 'Borrow Equipment', color: 'text-green-600 bg-green-50 hover:bg-green-100' },
                { icon: CheckCircle, label: 'Check Out', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
                { icon: BarChart3, label: 'View Reports', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' },
              ].map((action, index) => (
                <button
                  key={index}
                  className={`group flex flex-col items-center space-y-4 p-8 border-2 border-gray-200 rounded-2xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${action.color}`}
                >
                  <action.icon className="h-10 w-10 group-hover:scale-110 transition-transform" />
                  <span className="text-lg font-semibold text-center">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="bg-gradient-to-br from-gray-50 to-purple-50 rounded-3xl p-12 border border-gray-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Recent Activity</h2>
              <button className="text-purple-600 hover:text-purple-700 font-semibold flex items-center space-x-2 bg-white px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all">
                <Eye className="h-5 w-5" />
                <span>View All</span>
              </button>
            </div>
            <div className="space-y-6">
              {recentActivity.map((activity, index) => (
                <div 
                  key={activity.id} 
                  className="flex items-start space-x-6 p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100"
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
      <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 py-16">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Faculty Management?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join hundreds of satisfied users who trust our platform for their daily operations.
          </p>
          <button className="bg-white text-purple-700 px-12 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-xl">
            Get Started Today
          </button>
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