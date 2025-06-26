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
  Search,
  Bell,
  Settings,
  User,
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 overflow-x-hidden">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-orange-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-gray-900">Faculty of Vocational</h1>
                  <p className="text-xs text-gray-600">Yogyakarta State University</p>
                </div>
              </div>
              <div className="hidden md:flex space-x-6">
                <a href="#" className="text-gray-700 hover:text-orange-600 font-medium">Dashboard</a>
                <a href="#" className="text-gray-700 hover:text-orange-600 font-medium">Booking</a>
                <a href="#" className="text-gray-700 hover:text-orange-600 font-medium">Equipment</a>
                <a href="#" className="text-gray-700 hover:text-orange-600 font-medium">Reports</a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-0 focus:ring-2 focus:ring-orange-300 text-sm"
                />
              </div>
              <button className="p-2 text-gray-600 hover:text-orange-600 relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 text-gray-600 hover:text-orange-600">
                <Settings className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-600 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div 
            className="absolute top-20 left-10 w-72 h-72 bg-yellow-400 rounded-full mix-blend-multiply filter blur-xl opacity-30"
            style={{ 
              transform: `translateY(${scrollY * 0.5}px)`,
              animation: 'blob 7s infinite'
            }}
          ></div>
          <div 
            className="absolute top-40 right-10 w-72 h-72 bg-orange-400 rounded-full mix-blend-multiply filter blur-xl opacity-30"
            style={{ 
              transform: `translateY(${scrollY * 0.3}px)`,
              animation: 'blob 7s infinite 2s'
            }}
          ></div>
          <div 
            className="absolute bottom-20 left-20 w-72 h-72 bg-amber-400 rounded-full mix-blend-multiply filter blur-xl opacity-30"
            style={{ 
              transform: `translateY(${scrollY * 0.4}px)`,
              animation: 'blob 7s infinite 4s'
            }}
          ></div>
        </div>

        <div className="relative px-6 py-16 sm:px-12 lg:px-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div className="text-white space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full text-sm font-medium">
                    <Star className="w-4 h-4 mr-2 text-yellow-300" />
                    Building Career Saving Future
                  </div>
                  <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                    Faculty of 
                    <span className="block text-yellow-300">
                      Vocational
                    </span>
                    <span className="text-2xl lg:text-3xl font-normal block mt-2 text-orange-100">
                      Yogyakarta State University
                    </span>
                  </h1>
                  <p className="text-xl text-orange-100 leading-relaxed max-w-lg">
                    Building Career Saving Future - Advanced room booking and equipment management system for modern educational facilities.
                  </p>
                </div>

                {/* Stats Cards in Hero */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-2xl p-6 border border-white border-opacity-20">
                    <div className="flex items-center space-x-3">
                      <div className="bg-green-500 p-2 rounded-xl">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">1200+</p>
                        <p className="text-sm text-orange-200">Total Bookings</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center text-green-300 text-sm">
                      <ArrowUp className="w-4 h-4 mr-1" />
                      <span>98% Success Rate</span>
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-2xl p-6 border border-white border-opacity-20">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-500 p-2 rounded-xl">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{formatTime(currentTime)}</p>
                        <p className="text-sm text-orange-200">Live Time</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="group bg-white text-orange-700 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-xl">
                    <span className="flex items-center justify-center">
                      Book Room Now
                      <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                  <button className="group bg-transparent border-2 border-white text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-white hover:text-orange-700 transition-all duration-300">
                    <span className="flex items-center justify-center">
                      <Play className="w-5 h-5 mr-2" />
                      Watch Demo
                    </span>
                  </button>
                </div>

                {/* University Info */}
                <div className="flex items-center space-x-6 text-sm text-orange-200">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>Yogyakarta State University</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Timer className="w-4 h-4" />
                    <span>24/7 Online System</span>
                  </div>
                </div>
              </div>

              {/* Right Content - University Building */}
              <div className="relative">
                <div 
                  className="relative transform transition-transform duration-1000"
                  style={{ transform: `translateY(${scrollY * 0.1}px)` }}
                >
                  {/* Building Representation */}
                  <div className="relative bg-gradient-to-br from-amber-100 to-orange-200 rounded-3xl overflow-hidden shadow-2xl border-4 border-white border-opacity-30">
                    <div className="aspect-w-4 aspect-h-5 flex items-center justify-center bg-gradient-to-br from-orange-100 to-amber-100 p-12">
                      <div className="text-center space-y-4">
                        <Building className="w-32 h-32 text-orange-600 mx-auto" />
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold text-orange-800">Faculty Building</h3>
                          <p className="text-orange-700">Yogyakarta State University</p>
                          <div className="bg-orange-600 text-white px-4 py-2 rounded-lg inline-block">
                            Modern Facilities
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Floating elements */}
                    <div 
                      className="absolute top-6 right-6 bg-white rounded-2xl p-4 shadow-lg"
                      style={{ animation: 'float 6s ease-in-out infinite' }}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-gray-700">18 Available</span>
                      </div>
                    </div>
                    
                    <div 
                      className="absolute bottom-6 left-6 bg-white rounded-2xl p-4 shadow-lg"
                      style={{ animation: 'float 6s ease-in-out infinite 3s' }}
                    >
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-700">4.9★</p>
                        <p className="text-xs text-gray-600">User Rating</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Dashboard Section */}
      <div className="py-24" style={{ backgroundColor: '#daa06d', backgroundImage: 'linear-gradient(135deg, #daa06d 0%, #c8935d 100%)' }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 text-white rounded-full text-sm font-medium">
              <Activity className="w-4 h-4 mr-2" />
              Real-time Statistics
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white">
              Dashboard Overview
            </h2>
            <p className="text-xl text-orange-100">Monitor your facility usage with live statistics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              {
                title: 'Available Rooms',
                value: stats.availableRooms,
                subtitle: 'Ready for booking',
                icon: Building,
                color: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
                change: '+5%',
                trend: 'up',
              },
              {
                title: 'Today\'s Bookings',
                value: stats.todayBookings,
                subtitle: `${stats.activeBookings} currently active`,
                icon: Calendar,
                color: 'bg-gradient-to-r from-blue-500 to-blue-600',
                change: '+12%',
                trend: 'up',
              },
              {
                title: 'Equipment Available',
                value: stats.equipmentAvailable,
                subtitle: 'Items ready to lend',
                icon: Package,
                color: 'bg-gradient-to-r from-purple-500 to-purple-600',
                change: '+8%',
                trend: 'up',
              },
              {
                title: 'Total Users',
                value: stats.totalUsers,
                subtitle: 'Registered users',
                icon: Users,
                color: 'bg-gradient-to-r from-rose-500 to-rose-600',
                change: '+15%',
                trend: 'up',
              },
            ].map((card, index) => (
              <div 
                key={index} 
                className="bg-white rounded-3xl shadow-xl border border-orange-200 p-8 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className={`${card.color} p-4 rounded-2xl shadow-lg`}>
                    <card.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex items-center text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full">
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
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-orange-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Calendar, label: 'Book Room', color: 'text-orange-700 bg-orange-50 hover:bg-orange-100 border-orange-200' },
                { icon: Package, label: 'Borrow Equipment', color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
                { icon: CheckCircle, label: 'Check Out', color: 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200' },
                { icon: BarChart3, label: 'View Reports', color: 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200' },
              ].map((action, index) => (
                <button
                  key={index}
                  className={`group flex flex-col items-center space-y-4 p-8 border-2 rounded-2xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${action.color}`}
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
      <div className="py-24 bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="bg-white rounded-3xl p-12 border border-orange-200 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Recent Activity</h2>
              <button className="text-orange-700 hover:text-orange-800 font-semibold flex items-center space-x-2 bg-orange-50 px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all border border-orange-200">
                <Eye className="h-5 w-5" />
                <span>View All Activities</span>
              </button>
            </div>
            <div className="space-y-6">
              {recentActivity.map((activity, index) => (
                <div 
                  key={activity.id} 
                  className="flex items-start space-x-6 p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-orange-100"
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
      <div style={{ backgroundColor: '#daa06d' }} className="py-16">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Faculty Management?
          </h2>
          <p className="text-xl text-orange-100 mb-8">
            Join hundreds of satisfied users who trust our platform for their daily operations at Faculty of Vocational.
          </p>
          <button className="bg-white text-orange-700 px-12 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-xl">
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