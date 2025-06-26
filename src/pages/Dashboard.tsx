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
  GraduationCap,
  School,
  ChevronLeft,
} from 'lucide-react';

interface ScheduleData {
  time: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
}

interface DashboardStats {
  totalRooms: number;
  activeClasses: number;
  todaySchedule: number;
  totalStudents: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 45,
    activeClasses: 12,
    todaySchedule: 28,
    totalStudents: 1250,
  });
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scrollY, setScrollY] = useState(0);

  const scheduleData: ScheduleData[] = [
    {
      time: "07:00 - 08:40",
      monday: "Database Systems",
      tuesday: "Web Programming",
      wednesday: "Mobile App Dev",
      thursday: "Network Security",
      friday: "UI/UX Design"
    },
    {
      time: "08:40 - 10:20",
      monday: "Data Structures",
      tuesday: "Software Engineering",
      wednesday: "Machine Learning",
      thursday: "Cloud Computing",
      friday: "Digital Marketing"
    },
    {
      time: "10:30 - 12:10",
      monday: "Algorithm Analysis",
      tuesday: "Project Management",
      wednesday: "AI Fundamentals",
      thursday: "Cybersecurity",
      friday: "E-Commerce"
    },
    {
      time: "13:00 - 14:40",
      monday: "System Analysis",
      tuesday: "Quality Assurance",
      wednesday: "Data Mining",
      thursday: "Information Systems",
      friday: "Business Intelligence"
    },
    {
      time: "14:40 - 16:20",
      monday: "Practicum Lab",
      tuesday: "Workshop",
      wednesday: "Seminar",
      thursday: "Industry Visit",
      friday: "Final Project"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);

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
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-amber-600 via-orange-600 to-yellow-700 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div 
            className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-amber-400 to-orange-400 rounded-full mix-blend-multiply filter blur-xl opacity-30"
            style={{ 
              transform: `translateY(${scrollY * 0.5}px)`,
              animation: 'blob 7s infinite'
            }}
          ></div>
          <div 
            className="absolute top-40 right-10 w-72 h-72 bg-gradient-to-br from-yellow-400 to-amber-400 rounded-full mix-blend-multiply filter blur-xl opacity-25"
            style={{ 
              transform: `translateY(${scrollY * 0.3}px)`,
              animation: 'blob 7s infinite 2s'
            }}
          ></div>
          <div 
            className="absolute bottom-20 left-20 w-72 h-72 bg-gradient-to-br from-orange-400 to-red-400 rounded-full mix-blend-multiply filter blur-xl opacity-20"
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
                <div className="space-y-4">
                  <div className="inline-flex items-center px-4 py-2 bg-white bg-opacity-15 backdrop-blur-sm rounded-full text-sm font-medium border border-white border-opacity-20">
                    <GraduationCap className="w-4 h-4 mr-2 text-yellow-300" />
                    Excellence in Vocational Education
                  </div>
                  <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                    Faculty of 
                    <span className="block bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-300 bg-clip-text text-transparent">
                      Vocational
                    </span>
                  </h1>
                  <h2 className="text-2xl lg:text-3xl font-semibold text-amber-100">
                    Yogyakarta State University
                  </h2>
                  <p className="text-xl text-amber-50 leading-relaxed max-w-lg font-medium">
                    Building Career Saving Future
                  </p>
                  <p className="text-lg text-amber-100 leading-relaxed max-w-lg">
                    Empowering students with practical skills and industry-ready knowledge 
                    for tomorrow's challenges.
                  </p>
                </div>

                {/* Stats Cards in Hero */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-2xl p-6 border border-white border-opacity-20">
                    <div className="flex items-center space-x-3">
                      <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-xl">
                        <School className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">1250+</p>
                        <p className="text-sm text-amber-200">Students</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center text-green-300 text-sm">
                      <ArrowUp className="w-4 h-4 mr-1" />
                      <span>95% Success Rate</span>
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-2xl p-6 border border-white border-opacity-20">
                    <div className="flex items-center space-x-3">
                      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{formatTime(currentTime)}</p>
                        <p className="text-sm text-amber-200">Live Time</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="group bg-white text-amber-700 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-amber-50 transition-all duration-300 transform hover:scale-105 shadow-xl">
                    <span className="flex items-center justify-center">
                      Explore Programs
                      <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                  <button className="group bg-transparent border-2 border-white text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-white hover:text-amber-700 transition-all duration-300">
                    <span className="flex items-center justify-center">
                      <Play className="w-5 h-5 mr-2" />
                      Virtual Tour
                    </span>
                  </button>
                </div>

                {/* Contact Info */}
                <div className="flex items-center space-x-6 text-sm text-amber-200">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>Yogyakarta, Indonesia</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Timer className="w-4 h-4" />
                    <span>Est. 1964</span>
                  </div>
                </div>
              </div>

              {/* Right Content - Building Image */}
              <div className="relative">
                <div 
                  className="relative transform transition-transform duration-1000"
                  style={{ transform: `translateY(${scrollY * 0.1}px) rotateY(${scrollY * 0.02}deg)` }}
                >
                  {/* Building Image */}
                  <div className="relative bg-gradient-to-br from-amber-100 to-orange-200 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="aspect-w-4 aspect-h-5 flex items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
                      <div className="w-full h-full flex items-center justify-center">
                        <School className="w-32 h-32 text-amber-600" />
                      </div>
                    </div>
                    
                    {/* Floating elements */}
                    <div 
                      className="absolute top-6 right-6 bg-white rounded-2xl p-4 shadow-lg"
                      style={{ animation: 'float 6s ease-in-out infinite' }}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">45 Rooms</span>
                      </div>
                    </div>
                    
                    <div 
                      className="absolute bottom-6 left-6 bg-white rounded-2xl p-4 shadow-lg"
                      style={{ animation: 'float 6s ease-in-out infinite 3s' }}
                    >
                      <div className="text-center">
                        <p className="text-2xl font-bold text-amber-700">A</p>
                        <p className="text-xs text-gray-600">Accredited</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 rounded-full text-sm font-medium">
              <Zap className="w-4 h-4 mr-2" />
              Quick Access
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
              Everything You Need
              <span className="block bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                At Your Fingertips
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Calendar,
                title: 'Room Booking',
                description: 'Book classrooms and labs with real-time availability checking and automated scheduling.',
                color: 'bg-gradient-to-br from-amber-500 to-orange-600'
              },
              {
                icon: BarChart3,
                title: 'Schedule Analytics',
                description: 'Monitor class schedules, room utilization, and academic calendar with detailed insights.',
                color: 'bg-gradient-to-br from-yellow-500 to-amber-600'
              },
              {
                icon: Users,
                title: 'Student Portal',
                description: 'Access student information, attendance records, and academic progress tracking.',
                color: 'bg-gradient-to-br from-orange-500 to-red-600'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-amber-100 hover:border-amber-300 transform hover:-translate-y-2"
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
      <div className="py-24 bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
              Faculty Overview
            </h2>
            <p className="text-xl text-gray-600">Real-time statistics and facility management</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              {
                title: 'Total Rooms',
                value: stats.totalRooms,
                subtitle: 'Available facilities',
                icon: Building,
                color: 'bg-gradient-to-r from-amber-500 to-orange-600',
                change: '+3 new',
                trend: 'up',
              },
              {
                title: 'Active Classes',
                value: stats.activeClasses,
                subtitle: 'Currently running',
                icon: BookOpen,
                color: 'bg-gradient-to-r from-yellow-500 to-amber-600',
                change: '+5 today',
                trend: 'up',
              },
              {
                title: 'Today\'s Schedule',
                value: stats.todaySchedule,
                subtitle: 'Classes scheduled',
                icon: Calendar,
                color: 'bg-gradient-to-r from-orange-500 to-red-600',
                change: '85% filled',
                trend: 'up',
              },
              {
                title: 'Total Students',
                value: stats.totalStudents,
                subtitle: 'Enrolled students',
                icon: Users,
                color: 'bg-gradient-to-r from-red-500 to-pink-600',
                change: '+12% this year',
                trend: 'up',
              },
            ].map((card, index) => (
              <div 
                key={index} 
                className="bg-white rounded-3xl shadow-lg border border-amber-200 p-8 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1"
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
                    <span className="text-xs">{card.change}</span>
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
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-amber-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Calendar, label: 'Book Room', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
                { icon: BarChart3, label: 'View Schedule', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' },
                { icon: Users, label: 'Student List', color: 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' },
                { icon: CheckCircle, label: 'Check Attendance', color: 'text-red-600 bg-red-50 hover:bg-red-100' },
              ].map((action, index) => (
                <button
                  key={index}
                  className={`group flex flex-col items-center space-y-4 p-8 border-2 border-amber-200 rounded-2xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${action.color}`}
                >
                  <action.icon className="h-10 w-10 group-hover:scale-110 transition-transform" />
                  <span className="text-lg font-semibold text-center">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Class Schedule Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-12 border border-amber-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Weekly Class Schedule</h2>
              <div className="flex items-center space-x-4">
                <button className="text-amber-600 hover:text-amber-700 font-semibold flex items-center space-x-2 bg-white px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all">
                  <ChevronLeft className="h-5 w-5" />
                  <span>Previous</span>
                </button>
                <button className="text-amber-600 hover:text-amber-700 font-semibold flex items-center space-x-2 bg-white px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all">
                  <span>Next</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-2xl shadow-lg overflow-hidden">
                <thead className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Time</th>
                    <th className="px-6 py-4 text-left font-semibold">Monday</th>
                    <th className="px-6 py-4 text-left font-semibold">Tuesday</th>
                    <th className="px-6 py-4 text-left font-semibold">Wednesday</th>
                    <th className="px-6 py-4 text-left font-semibold">Thursday</th>
                    <th className="px-6 py-4 text-left font-semibold">Friday</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.map((row, index) => (
                    <tr 
                      key={index} 
                      className={`border-b border-amber-100 hover:bg-amber-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-amber-25'
                      }`}
                    >
                      <td className="px-6 py-4 font-semibold text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50">
                        {row.time}
                      </td>
                      <td className="px-6 py-4">
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                          <span className="text-sm font-medium text-blue-800">{row.monday}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                          <span className="text-sm font-medium text-green-800">{row.tuesday}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                          <span className="text-sm font-medium text-purple-800">{row.wednesday}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="p-3 bg-gradient-to-r from-pink-50 to-pink-100 rounded-lg">
                          <span className="text-sm font-medium text-pink-800">{row.thursday}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="p-3 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg">
                          <span className="text-sm font-medium text-indigo-800">{row.friday}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-700 py-16">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Shape Your Future?
          </h2>
          <p className="text-xl text-amber-100 mb-8">
            Join thousands of students who have built successful careers through our programs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-amber-700 px-12 py-4 rounded-2xl font-bold text-lg hover:bg-amber-50 transition-all duration-300 transform hover:scale-105 shadow-xl">
              Apply Now
            </button>
            <button className="bg-transparent border-2 border-white text-white px-12 py-4 rounded-2xl font-bold text-lg hover:bg-white hover:text-amber-700 transition-all duration-300">
              Learn More
            </button>
          </div>
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
        
        .bg-amber-25 {
          background-color: #fffbeb;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;