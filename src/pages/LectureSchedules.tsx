import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Clock,
  Plus,
  Search,
  Edit,
  Trash2,
  Upload,
  RefreshCw,
  X,
  AlertCircle,
  User,
  BookOpen,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Activity,
  TrendingUp
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import ExcelUploadModal from '../components/ExcelUpload/ExcelUploadModal';

const scheduleSchema = z.object({
  course_name: z.string().min(2, 'Course name is required'),
  course_code: z.string().min(2, 'Course code is required'),
  lecturer: z.string().min(1, 'Lecturer name is required'),
  room: z.string().min(1, 'Room name is required'),
  subject_study: z.string().min(1, 'Study program is required'),
  day: z.string().min(1, 'Day is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  semester: z.number().min(1).max(8),
  academics_year: z.number().min(1),
  type: z.enum(['theory', 'practical']),
  class: z.string().min(1, 'Class/Rombel is required'),
  amount: z.number().min(0),
  kurikulum: z.string().optional(),
});

type ScheduleForm = z.infer<typeof scheduleSchema>;

interface LectureSchedule {
  id: string;
  subject_study: string | null;
  course_code: string | null;
  course_name: string | null;
  semester: number | null;
  kurikulum: string | null;
  academics_year: number | null;
  type: 'theory' | 'practical';
  class: string | null;
  lecturer: string | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  amount: number | null;
  created_at: string;
  updated_at: string;
}

const LectureSchedules: React.FC = () => {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<LectureSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LectureSchedule | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof LectureSchedule; direction: 'ascending' | 'descending' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const form = useForm<ScheduleForm>({ 
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      semester: 1,
      academics_year: new Date().getFullYear(),
      type: 'theory',
      amount: 0
    }
  });
  
  const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  useEffect(() => {
    fetchSchedules();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lecture_schedules')
        .select('*')
        .order('day', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      setSchedules(data || []);
    } catch (error: any) {
      console.error('Error fetching schedules:', error);
      toast.error(error.message || 'Failed to load lecture schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: ScheduleForm) => {
    try {
      setLoading(true);
      const scheduleData = {
        course_name: data.course_name,
        course_code: data.course_code,
        lecturer: data.lecturer,
        room: data.room,
        subject_study: data.subject_study,
        day: data.day,
        start_time: data.start_time,
        end_time: data.end_time,
        semester: data.semester,
        academics_year: data.academics_year,
        type: data.type,
        class: data.class,
        amount: data.amount,
        kurikulum: data.kurikulum,
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('lecture_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);
        if (error) throw error;
        toast.success('Schedule updated successfully! 🎉');
      } else {
        const { error } = await supabase
          .from('lecture_schedules')
          .insert(scheduleData);
        if (error) throw error;
        toast.success('Schedule created successfully! ✨');
      }

      setShowModal(false);
      setEditingSchedule(null);
      form.reset();
      fetchSchedules();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error(error.message || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule: LectureSchedule) => {
    setEditingSchedule(schedule);
    form.reset({
      course_name: schedule.course_name || '',
      course_code: schedule.course_code || '',
      lecturer: schedule.lecturer || '',
      room: schedule.room || '',
      subject_study: schedule.subject_study || '',
      day: schedule.day || '',
      start_time: schedule.start_time || '',
      end_time: schedule.end_time || '',
      semester: schedule.semester || 1,
      academics_year: schedule.academics_year || new Date().getFullYear(),
      type: schedule.type || 'theory',
      class: schedule.class || '',
      amount: schedule.amount || 0,
      kurikulum: schedule.kurikulum || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('lecture_schedules')
        .delete()
        .eq('id', scheduleId);
      
      if (error) throw error;
      toast.success('Schedule deleted successfully! 🗑️');
      setShowDeleteConfirm(null);
      fetchSchedules();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast.error(error.message || 'Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const matchesSearch = 
        (schedule.course_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (schedule.course_code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (schedule.lecturer?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (schedule.room?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      const matchesSemester = semesterFilter === 'all' || schedule.semester?.toString() === semesterFilter;
      const matchesDay = dayFilter === 'all' || schedule.day?.toLowerCase() === dayFilter.toLowerCase();
      
      return matchesSearch && matchesSemester && matchesDay;
    });
  }, [schedules, searchTerm, semesterFilter, dayFilter]);

  const sortedSchedules = useMemo(() => {
    let sortableItems = [...filteredSchedules];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key] || '';
        const valB = b[sortConfig.key] || '';
        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredSchedules, sortConfig]);

  const requestSort = (key: keyof LectureSchedule) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(sortedSchedules.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentTableData = sortedSchedules.slice(startIndex, startIndex + rowsPerPage);

  // Day intensity analysis with color coding
  const dayIntensityStats = useMemo(() => {
    const stats = dayNames.map(day => {
      const daySchedules = schedules.filter(s => s.day?.toLowerCase() === day.toLowerCase());
      const count = daySchedules.length;
      
      let intensity, color;
      if (count === 0) {
        intensity = 'Empty';
        color = '#9CA3AF'; // gray-400
      } else if (count <= 3) {
        intensity = 'Light';
        color = '#10B981'; // green-500
      } else if (count <= 6) {
        intensity = 'Moderate';
        color = '#3B82F6'; // blue-500
      } else if (count <= 9) {
        intensity = 'Busy';
        color = '#F59E0B'; // yellow-500
      } else {
        intensity = 'Very Busy';
        color = '#EF4444'; // red-500
      }
      
      return {
        day,
        count,
        intensity,
        color,
        fullDay: day
      };
    });
    return stats;
  }, [schedules]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{`${data.fullDay}`}</p>
          <p className="text-sm text-gray-600">{`Schedules: ${data.count}`}</p>
          <p className="text-sm" style={{ color: data.color }}>{`Status: ${data.intensity}`}</p>
        </div>
      );
    }
    return null;
  };

  const isScheduleActive = (schedule: LectureSchedule) => {
    const currentDayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
    const dayMapping: { [key: string]: string } = {
      'Monday': 'Senin', 'Tuesday': 'Selasa', 'Wednesday': 'Rabu',
      'Thursday': 'Kamis', 'Friday': 'Jumat', 'Saturday': 'Sabtu'
    };
    
    const currentIndonesianDay = dayMapping[currentDayName];
    
    if (schedule.day?.toLowerCase() !== currentIndonesianDay?.toLowerCase() || !schedule.start_time || !schedule.end_time) {
      return false;
    }
    
    try {
      const now = currentTime;
      const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
      const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
      const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
      return now >= startTime && now <= endTime;
    } catch (e) {
      return false;
    }
  };

  if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to access lecture schedules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 mb-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                <Clock className="h-6 md:h-8 w-6 md:w-8" />
              </div>
              <span>Lecture Schedules</span>
            </h1>
            <p className="text-sm md:text-lg opacity-90">
              Manage academic schedules and timetables
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 opacity-80">
                <BookOpen className="h-4 w-4" />
                <span>Total: {schedules.length}</span>
              </div>
              <div className="flex items-center gap-2 opacity-80">
                <User className="h-4 w-4" />
                <span>Active: {schedules.filter(s => isScheduleActive(s)).length}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl md:text-4xl font-bold opacity-90">{schedules.length}</div>
            <div className="text-xs md:text-sm opacity-70">Total Schedules</div>
          </div>
        </div>
      </div>

      {/* Day Intensity Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Daily Schedule Intensity</h3>
              <p className="text-sm text-gray-600">Weekly schedule distribution analysis</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{schedules.length}</div>
            <div className="text-xs text-gray-500">Total Schedules</div>
          </div>
        </div>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayIntensityStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]}
                stroke="#0f172a"
                strokeWidth={1}
              >
                {dayIntensityStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-gray-400"></div>
            <span className="text-gray-600">Empty (0)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-gray-600">Light (1-3)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-gray-600">Moderate (4-6)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-gray-600">Busy (7-9)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-gray-600">Very Busy (10+)</span>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search schedules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="all">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem.toString()}>Semester {sem}</option>
                ))}
              </select>
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="all">All Days</option>
                {dayNames.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchSchedules()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => {
                setEditingSchedule(null);
                form.reset({
                  semester: 1,
                  academics_year: new Date().getFullYear(),
                  type: 'theory',
                  amount: 0
                });
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>Add Schedule</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('course_name')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>Subject</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('lecturer')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>Lecturer</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('room')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>Room</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('day')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>Schedule</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-teal-600 mr-2" />
                      <span className="text-gray-600">Loading schedules...</span>
                    </div>
                  </td>
                </tr>
              ) : currentTableData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No schedules found</p>
                      <p className="text-sm">Try adjusting your search or create a new schedule</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentTableData.map((schedule) => {
                  const isActive = isScheduleActive(schedule);
                  return (
                    <tr key={schedule.id} className={`hover:bg-gray-50 transition-colors ${isActive ? 'bg-green-50 border-l-4 border-green-500' : ''}`}>
                      <td className="px-3 md:px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isActive && <Activity className="h-4 w-4 text-green-500 animate-pulse" />}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{schedule.course_name}</div>
                            <div className="text-xs text-gray-500">{schedule.course_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{schedule.lecturer}</div>
                      </td>
                      <td className="px-3 md:px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{schedule.room}</div>
                      </td>
                      <td className="px-3 md:px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{schedule.day}</div>
                          <div className="text-xs text-gray-500">
                            {schedule.start_time?.substring(0,5)} - {schedule.end_time?.substring(0,5)}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4">
                        <div>
                          <div className="text-sm text-gray-900">Semester {schedule.semester}</div>
                          <div className="text-xs text-gray-500 capitalize">{schedule.type}</div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(schedule)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(schedule.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-3 bg-gray-50 border-t border-gray-200 gap-3">
            <span className="text-sm text-gray-600">
              Showing {sortedSchedules.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + rowsPerPage, sortedSchedules.length)} of {sortedSchedules.length} entries
            </span>
            <nav className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium px-3 py-1">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Clock className="h-6 w-6" />
                  {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingSchedule(null);
                    form.reset();
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Course Name *</label>
                  <input
                    {...form.register('course_name')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder="Enter course name"
                  />
                  {form.formState.errors.course_name && (
                    <p className="text-red-500 text-sm">{form.formState.errors.course_name.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Course Code *</label>
                  <input
                    {...form.register('course_code')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder="e.g. MKL6305"
                  />
                  {form.formState.errors.course_code && (
                    <p className="text-red-500 text-sm">{form.formState.errors.course_code.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Lecturer *</label>
                  <input
                    {...form.register('lecturer')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder="Enter lecturer name"
                  />
                  {form.formState.errors.lecturer && (
                    <p className="text-red-500 text-sm">{form.formState.errors.lecturer.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Room *</label>
                  <input
                    {...form.register('room')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder="e.g. Lab. Komputer 03"
                  />
                  {form.formState.errors.room && (
                    <p className="text-red-500 text-sm">{form.formState.errors.room.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Study Program *</label>
                <input
                  {...form.register('subject_study')}
                  type="text"
                  className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  placeholder="Enter study program"
                />
                {form.formState.errors.subject_study && (
                  <p className="text-red-500 text-sm">{form.formState.errors.subject_study.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Day *</label>
                  <select
                    {...form.register('day')}
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  >
                    <option value="">Select Day</option>
                    {dayNames.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                  {form.formState.errors.day && (
                    <p className="text-red-500 text-sm">{form.formState.errors.day.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Start Time *</label>
                  <input
                    {...form.register('start_time')}
                    type="time"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  />
                  {form.formState.errors.start_time && (
                    <p className="text-red-500 text-sm">{form.formState.errors.start_time.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">End Time *</label>
                  <input
                    {...form.register('end_time')}
                    type="time"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  />
                  {form.formState.errors.end_time && (
                    <p className="text-red-500 text-sm">{form.formState.errors.end_time.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Semester *</label>
                  <select
                    {...form.register('semester', { valueAsNumber: true })}
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                  {form.formState.errors.semester && (
                    <p className="text-red-500 text-sm">{form.formState.errors.semester.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Academic Year *</label>
                  <input
                    {...form.register('academics_year', { valueAsNumber: true })}
                    type="number"
                    placeholder="2024"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  />
                  {form.formState.errors.academics_year && (
                    <p className="text-red-500 text-sm">{form.formState.errors.academics_year.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Class Type *</label>
                  <select
                    {...form.register('type')}
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  >
                    <option value="theory">Theory</option>
                    <option value="practical">Practical</option>
                  </select>
                  {form.formState.errors.type && (
                    <p className="text-red-500 text-sm">{form.formState.errors.type.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Class/Rombel *</label>
                  <input
                    {...form.register('class')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder="e.g. A, B, C"
                  />
                  {form.formState.errors.class && (
                    <p className="text-red-500 text-sm">{form.formState.errors.class.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Amount</label>
                  <input
                    {...form.register('amount', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder="0"
                  />
                  {form.formState.errors.amount && (
                    <p className="text-red-500 text-sm">{form.formState.errors.amount.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Kurikulum</label>
                  <input
                    {...form.register('kurikulum')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingSchedule(null);
                    form.reset();
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    editingSchedule ? 'Update Schedule' : 'Create Schedule'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center mb-6">
              <div className="flex-shrink-0 p-3 bg-red-100 rounded-full">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-gray-900">Delete Schedule</h3>
                <p className="text-sm text-gray-600 mt-1">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">
                Are you sure you want to delete this lecture schedule? This action will permanently remove 
                the schedule from the system.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm as string)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold transition-colors shadow-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Deleting...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Schedule
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ExcelUploadModal - keeping the original component unchanged */}
      <ExcelUploadModal 
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
        onSuccess={() => { 
          fetchSchedules(); 
        }}
      />
    </div>
  );
};

export default LectureSchedules;