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
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

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
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    pendingBookings: 0,
    availableRooms: 0,
    totalUsers: 0,
    todayBookings: 0,
    equipmentAvailable: 0,
    activeBookings: 0,
    completedBookings: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchDashboardStats();
    fetchRecentActivity();
    
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [profile]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Fetch bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*');

      // Fetch rooms
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*');

      // Fetch users (only for super admin)
      let users = [];
      if (profile?.role === 'super_admin') {
        const { data: userData } = await supabase
          .from('users')
          .select('*');
        users = userData || [];
      }

      // Fetch equipment
      const { data: equipment } = await supabase
        .from('equipment')
        .select('*');

      const today = new Date().toISOString().split('T')[0];
      const todayBookings = bookings?.filter(booking => 
        booking.start_time.startsWith(today)
      ) || [];

      const now = new Date();
      const activeBookings = bookings?.filter(booking => {
        const startTime = new Date(booking.start_time);
        const endTime = new Date(booking.end_time);
        return startTime <= now && endTime >= now && booking.status === 'approved';
      }) || [];

      setStats({
        totalBookings: bookings?.length || 0,
        pendingBookings: bookings?.filter(b => b.status === 'pending').length || 0,
        availableRooms: rooms?.filter(r => r.is_available).length || 0,
        totalUsers: users.length,
        todayBookings: todayBookings.length,
        equipmentAvailable: equipment?.filter(e => e.is_available).length || 0,
        activeBookings: activeBookings.length,
        completedBookings: bookings?.filter(b => b.status === 'completed').length || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    // Mock recent activity data - in real app, this would come from an activity log table
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
      },
      {
        id: '4',
        type: 'checkout',
        message: 'Equipment damage reported in Room C301',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'error'
      },
      {
        id: '5',
        type: 'booking',
        message: 'Weekly schedule imported successfully',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        status: 'info'
      }
    ];
    setRecentActivity(mockActivity);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getDashboardCards = () => {
    const baseCards = [
      {
        title: 'Current Time',
        value: format(currentTime, 'HH:mm:ss'),
        subtitle: format(currentTime, 'EEEE, MMMM d'),
        icon: Clock,
        color: 'bg-gradient-to-r from-blue-500 to-blue-600',
        change: null,
        trend: null,
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
        title: 'Available Rooms',
        value: stats.availableRooms,
        subtitle: 'Ready for booking',
        icon: Building,
        color: 'bg-gradient-to-r from-purple-500 to-purple-600',
        change: '+5%',
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
    ];

    if (profile?.role === 'super_admin') {
      return [
        ...baseCards,
        {
          title: 'Total Users',
          value: stats.totalUsers,
          subtitle: 'Registered users',
          icon: Users,
          color: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
          change: '+15%',
          trend: 'up',
        },
        {
          title: 'Pending Approvals',
          value: stats.pendingBookings,
          subtitle: 'Awaiting review',
          icon: AlertCircle,
          color: 'bg-gradient-to-r from-red-500 to-red-600',
          change: '-3%',
          trend: 'down',
        },
        {
          title: 'Total Bookings',
          value: stats.totalBookings,
          subtitle: 'All time bookings',
          icon: TrendingUp,
          color: 'bg-gradient-to-r from-teal-500 to-teal-600',
          change: '+20%',
          trend: 'up',
        },
        {
          title: 'Completed Bookings',
          value: stats.completedBookings,
          subtitle: 'Successfully finished',
          icon: CheckCircle,
          color: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
          change: '+18%',
          trend: 'up',
        },
      ];
    }

    if (profile?.role === 'department_admin') {
      return [
        ...baseCards,
        {
          title: 'Pending Approvals',
          value: stats.pendingBookings,
          subtitle: 'Awaiting your review',
          icon: AlertCircle,
          color: 'bg-gradient-to-r from-red-500 to-red-600',
          change: '-3%',
          trend: 'down',
        },
        {
          title: 'Department Bookings',
          value: stats.totalBookings,
          subtitle: 'This month',
          icon: BarChart3,
          color: 'bg-gradient-to-r from-cyan-500 to-cyan-600',
          change: '+25%',
          trend: 'up',
        },
      ];
    }

    return baseCards;
  };

  const getQuickActions = () => {
    const baseActions = [
      { icon: Calendar, label: 'Book Room', path: '/book', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
      { icon: Package, label: 'Borrow Equipment', path: '/tools', color: 'text-green-600 bg-green-50 hover:bg-green-100' },
      { icon: CheckCircle, label: 'Check Out', path: '/checkout', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
      { icon: BookOpen, label: 'My Bookings', path: '/my-bookings', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' },
    ];

    if (profile?.role === 'super_admin') {
      return [
        ...baseActions,
        { icon: Users, label: 'Manage Users', path: '/users', color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' },
        { icon: Building, label: 'Manage Rooms', path: '/rooms', color: 'text-red-600 bg-red-50 hover:bg-red-100' },
        { icon: AlertCircle, label: 'Validation Queue', path: '/validation', color: 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' },
        { icon: BarChart3, label: 'View Reports', path: '/reports', color: 'text-teal-600 bg-teal-50 hover:bg-teal-100' },
      ];
    }

    if (profile?.role === 'department_admin') {
      return [
        ...baseActions,
        { icon: AlertCircle, label: 'Approve Bookings', path: '/department-bookings', color: 'text-red-600 bg-red-50 hover:bg-red-100' },
        { icon: BarChart3, label: 'Department Analytics', path: '/department-analytics', color: 'text-teal-600 bg-teal-50 hover:bg-teal-100' },
      ];
    }

    return baseActions;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'booking': return Calendar;
      case 'equipment': return Package;
      case 'approval': return AlertCircle;
      case 'checkout': return CheckCircle;
      default: return Activity;
    }
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-50 text-green-600';
      case 'warning': return 'bg-yellow-50 text-yellow-600';
      case 'error': return 'bg-red-50 text-red-600';
      case 'info': return 'bg-blue-50 text-blue-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {getGreeting()}{profile ? `, ${profile.full_name}` : ''}!
            </h1>
            <p className="mt-2 opacity-90 text-lg">
              {profile 
                ? `Welcome back to your ${profile.role.replace('_', ' ')} dashboard`
                : 'Welcome to the Faculty Room Booking System'
              }
            </p>
            <div className="mt-4 flex items-center space-x-4 text-sm opacity-80">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Faculty of Vocational</span>
              </div>
              <div className="flex items-center space-x-2">
                <Timer className="h-4 w-4" />
                <span>System Online</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="text-right">
              <div className="text-4xl font-bold">{format(currentTime, 'HH:mm')}</div>
              <div className="text-sm opacity-80">{format(currentTime, 'EEEE')}</div>
              <div className="text-sm opacity-80">{format(currentTime, 'MMMM d, yyyy')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {getDashboardCards().map((card, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mb-1">{card.value}</p>
                <p className="text-xs text-gray-500">{card.subtitle}</p>
                {card.change && (
                  <div className="flex items-center mt-2">
                    {card.trend === 'up' ? (
                      <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-red-500 mr-1" />
                    )}
                    <span className={`text-xs font-medium ${
                      card.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {card.change} from last week
                    </span>
                  </div>
                )}
              </div>
              <div className={`${card.color} p-3 rounded-xl shadow-sm`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1">
            <Eye className="h-4 w-4" />
            <span>View All</span>
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {getQuickActions().map((action, index) => (
            <button
              key={index}
              className={`flex flex-col items-center space-y-3 p-6 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 ${action.color}`}
            >
              <action.icon className="h-8 w-8" />
              <span className="text-sm font-medium text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1">
            <Plus className="h-4 w-4" />
            <span>View All</span>
          </button>
        </div>
        <div className="space-y-4">
          {recentActivity.map((activity) => {
            const ActivityIcon = getActivityIcon(activity.type);
            return (
              <div key={activity.id} className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className={`flex-shrink-0 p-2 rounded-lg ${getActivityColor(activity.status)}`}>
                  <ActivityIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {format(new Date(activity.timestamp), 'MMM d, yyyy at h:mm a')}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    activity.status === 'success' ? 'bg-green-100 text-green-800' :
                    activity.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    activity.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;