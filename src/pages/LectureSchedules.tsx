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
  TrendingUp,
  FileText,
  Calendar,
  Send,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock3,
  Filter,
  CalendarCheck
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import ExcelUploadModal from '../components/ExcelUpload/ExcelUploadModal';
import { useLanguage } from '../contexts/LanguageContext';
import jsPDF from 'jspdf';

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

const rescheduleSchema = z.object({
  course_code: z.string().min(2, 'Course code is required'),
  day: z.string().min(1, 'Day is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  room: z.string().min(1, 'Room is required'),
  class: z.string().min(1, 'Class/Rombel is required'),
});

type ScheduleForm = z.infer<typeof scheduleSchema>;
type RescheduleForm = z.infer<typeof rescheduleSchema>;

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

interface RescheduleRequest {
  id: string;
  course_code: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
  class: string;
  is_done: boolean | null;
}

const LectureSchedules: React.FC = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();
  const [schedules, setSchedules] = useState<LectureSchedule[]>([]);
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showRescheduleRequestsModal, setShowRescheduleRequestsModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LectureSchedule | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [rescheduleFilter, setRescheduleFilter] = useState<string>('pending');
  
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

  const rescheduleForm = useForm<RescheduleForm>({
    resolver: zodResolver(rescheduleSchema),
  });
  
  const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  useEffect(() => {
    fetchSchedules();
    fetchRescheduleRequests();
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

  const fetchRescheduleRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('reschedule')
        .select('*');
      
      if (error) throw error;
      setRescheduleRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching reschedule requests:', error);
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
        toast.success(getText('Schedule updated successfully!', 'Jadwal berhasil diperbarui!'));
      } else {
        const { error } = await supabase
          .from('lecture_schedules')
          .insert(scheduleData);
        if (error) throw error;
        toast.success(getText('Schedule created successfully!', 'Jadwal berhasil dibuat!'));
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

  const handleRescheduleSubmit = async (data: RescheduleForm) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('reschedule')
        .insert({
          course_code: data.course_code,
          day: data.day,
          start_time: data.start_time,
          end_time: data.end_time,
          room: data.room,
          class: data.class,
          is_done: null
        });
      
      if (error) throw error;
      
      toast.success(getText('Reschedule request submitted successfully!', 'Permintaan reschedule berhasil dikirim!'));
      
      setShowRescheduleModal(false);
      rescheduleForm.reset();
      fetchRescheduleRequests();
    } catch (error: any) {
      console.error('Error submitting reschedule request:', error);
      toast.error(error.message || 'Failed to submit reschedule request');
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
      toast.success(getText('Schedule deleted successfully!', 'Jadwal berhasil dihapus!'));
      setShowDeleteConfirm(null);
      fetchSchedules();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast.error(error.message || 'Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleAction = async (requestId: string, isDone: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('reschedule')
        .update({ is_done: isDone })
        .eq('id', requestId);
      
      if (error) throw error;
      
      toast.success(getText(
        `Reschedule request ${isDone ? 'completed' : 'unchecked'} successfully!`,
        `Permintaan reschedule berhasil ${isDone ? 'diselesaikan' : 'dibatalkan'}!`
      ));
      fetchRescheduleRequests();
    } catch (error: any) {
      console.error('Error processing reschedule request:', error);
      toast.error(error.message || 'Failed to process reschedule request');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    try {
      // Filter data yang belum selesai (is_done != true)
      const pendingRequests = rescheduleRequests.filter(request => request.is_done !== true);
      
      if (pendingRequests.length === 0) {
        toast.error(getText('No pending reschedule requests to export', 'Tidak ada permintaan reschedule yang belum selesai untuk diekspor'));
        return;
      }

      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(getText('Reschedule Requests Report', 'Laporan Permintaan Reschedule'), 20, 30);
      
      // Sub header
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      const currentDate = new Date().toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });
      doc.text(getText(`Generated on: ${currentDate}`, `Dibuat pada: ${currentDate}`), 20, 45);
      doc.text(getText(`Total Pending Requests: ${pendingRequests.length}`, `Total Permintaan Belum Selesai: ${pendingRequests.length}`), 20, 55);
      
      // Table header
      let yPosition = 75;
      const columnWidths = [15, 35, 25, 45, 35, 25];
      const columnPositions = [20, 35, 70, 95, 140, 175];
      
      // Header background
      doc.setFillColor(59, 130, 246);
      doc.rect(20, yPosition - 8, 180, 15, 'F');
      
      // Header text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      
      const headers = [
        getText('No', 'No'),
        getText('Course Code', 'Kode MK'),
        getText('Day', 'Hari'),
        getText('Time', 'Waktu'),
        getText('Room', 'Ruangan'),
        getText('Class', 'Kelas')
      ];
      
      headers.forEach((header, index) => {
        doc.text(header, columnPositions[index] + 2, yPosition);
      });
      
      yPosition += 20;
      
      // Table body
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      pendingRequests.forEach((request, index) => {
        // Alternate row colors
        if (index % 2 === 0) {
          doc.setFillColor(245, 247, 250);
          doc.rect(20, yPosition - 8, 180, 12, 'F');
        }
        
        const rowData = [
          (index + 1).toString(),
          request.course_code,
          request.day,
          `${request.start_time} - ${request.end_time}`,
          request.room,
          request.class
        ];
        
        rowData.forEach((data, colIndex) => {
          doc.text(data, columnPositions[colIndex] + 2, yPosition);
        });
        
        yPosition += 12;
        
        // Check for page break
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 30;
        }
      });
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          getText(
            `Page ${i} of ${pageCount} - SIMPEL Kuliah System`,
            `Halaman ${i} dari ${pageCount} - Sistem SIMPEL Kuliah`
          ), 
          20, 
          280
        );
      }
      
      // Save PDF
      const fileName = getText(
        `Reschedule_Requests_${new Date().toISOString().split('T')[0]}.pdf`,
        `Permintaan_Reschedule_${new Date().toISOString().split('T')[0]}.pdf`
      );
      
      doc.save(fileName);
      
      toast.success(getText(
        `PDF exported successfully! (${pendingRequests.length} pending requests)`,
        `PDF berhasil diekspor! (${pendingRequests.length} permintaan belum selesai)`
      ));
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(getText('Failed to generate PDF', 'Gagal membuat PDF'));
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

  const filteredRescheduleRequests = useMemo(() => {
    return rescheduleRequests.filter(request => {
      if (rescheduleFilter === 'all') return true;
      if (rescheduleFilter === 'pending') return request.is_done === null;
      if (rescheduleFilter === 'completed') return request.is_done === true;
      return true;
    });
  }, [rescheduleRequests, rescheduleFilter]);

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

  // Day intensity analysis - only for super admin
  const dayIntensityStats = useMemo(() => {
    if (profile?.role !== 'super_admin') return [];
    
    const stats = dayNames.map(day => {
      const daySchedules = schedules.filter(s => s.day?.toLowerCase() === day.toLowerCase());
      const count = daySchedules.length;
      
      let intensity, color;
      if (count === 0) {
        intensity = 'Empty';
        color = '#9CA3AF';
      } else if (count <= 3) {
        intensity = 'Light';
        color = '#10B981';
      } else if (count <= 6) {
        intensity = 'Moderate';
        color = '#3B82F6';
      } else if (count <= 9) {
        intensity = 'Busy';
        color = '#F59E0B';
      } else {
        intensity = 'Very Busy';
        color = '#EF4444';
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
  }, [schedules, profile?.role]);

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
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {getText('Access Denied', 'Akses Ditolak')}
          </h3>
          <p className="text-gray-600">
            {getText(
              "You don't have permission to access lecture schedules.",
              "Anda tidak memiliki izin untuk mengakses jadwal kuliah."
            )}
          </p>
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
              <span>{getText('Lecture Schedules', 'Jadwal Kuliah')}</span>
            </h1>
            <p className="text-sm md:text-lg opacity-90">
              {getText('Manage academic schedules and timetables', 'Kelola jadwal akademik dan timetable')}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs md:text-sm">
              <div className="flex items-center gap-2 opacity-80">
                <BookOpen className="h-4 w-4" />
                <span>{getText('Total', 'Total')}: {schedules.length}</span>
              </div>
              <div className="flex items-center gap-2 opacity-80">
                <User className="h-4 w-4" />
                <span>{getText('Active', 'Aktif')}: {schedules.filter(s => isScheduleActive(s)).length}</span>
              </div>
              {profile?.role === 'super_admin' && (
                <div className="flex items-center gap-2 opacity-80">
                  <Calendar className="h-4 w-4" />
                  <span>{getText('Reschedule Requests', 'Permintaan Reschedule')}: {rescheduleRequests.filter(r => r.is_done === null).length}</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl md:text-4xl font-bold opacity-90">{schedules.length}</div>
            <div className="text-xs md:text-sm opacity-70">
              {getText('Total Schedules', 'Total Jadwal')}
            </div>
          </div>
        </div>
      </div>

      {/* Day Intensity Chart - Super Admin Only */}
      {profile?.role === 'super_admin' && dayIntensityStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {getText('Daily Schedule Intensity', 'Intensitas Jadwal Harian')}
                </h3>
                <p className="text-sm text-gray-600">
                  {getText('Weekly schedule distribution analysis', 'Analisis distribusi jadwal mingguan')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dayIntensityStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                <Line 
                  type="monotone"
                  dataKey="count" 
                  stroke="#0d9488"
                  strokeWidth={3}
                  dot={{ fill: '#0d9488', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, fill: '#0f766e' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
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
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={getText('Search schedules...', 'Cari jadwal...')}
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
                <option value="all">{getText('All Semesters', 'Semua Semester')}</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem.toString()}>Semester {sem}</option>
                ))}
              </select>
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="all">{getText('All Days', 'Semua Hari')}</option>
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
              title={getText('Refresh', 'Muat Ulang')}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            {/* Department Admin Actions */}
            {profile?.role === 'department_admin' && (
              <button
                onClick={() => setShowRescheduleModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors text-sm"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">{getText('Request Reschedule', 'Minta Reschedule')}</span>
              </button>
            )}

            {/* Super Admin Actions */}
            {profile?.role === 'super_admin' && (
              <>
                <button
                  onClick={() => setShowRescheduleRequestsModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors text-sm relative"
                >
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">{getText('View Requests', 'Lihat Permintaan')}</span>
                  {rescheduleRequests.filter(r => r.is_done === null).length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {rescheduleRequests.filter(r => r.is_done === null).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={generatePDF}
                  className="flex items-center gap-2 px-3 py-2 text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">{getText('Export PDF', 'Ekspor PDF')}</span>
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">{getText('Import Excel', 'Impor Excel')}</span>
                </button>
              </>
            )}

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
              <span>{getText('Add Schedule', 'Tambah Jadwal')}</span>
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
                    <span>{getText('Subject', 'Mata Kuliah')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('subject_study')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('Study Program', 'Program Studi')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('room')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('Room', 'Ruangan')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={() => requestSort('day')} className="flex items-center gap-1 hover:text-gray-700">
                    <span>{getText('Schedule', 'Jadwal')}</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Details', 'Detail')}
                </th>
                <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Actions', 'Aksi')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-teal-600 mr-2" />
                      <span className="text-gray-600">{getText('Loading schedules...', 'Memuat jadwal...')}</span>
                    </div>
                  </td>
                </tr>
              ) : currentTableData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">{getText('No schedules found', 'Tidak ada jadwal ditemukan')}</p>
                      <p className="text-sm">{getText('Try adjusting your search or create a new schedule', 'Coba sesuaikan pencarian atau buat jadwal baru')}</p>
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
                        <div className="text-sm font-medium text-gray-900">{schedule.subject_study}</div>
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
                          <div className="text-xs text-gray-500 capitalize">{getText(schedule.type === 'theory' ? 'Theory' : 'Practical', schedule.type === 'theory' ? 'Teori' : 'Praktik')}</div>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(schedule)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title={getText('Edit', 'Edit')}
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(schedule.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title={getText('Delete', 'Hapus')}
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
              {getText(
                `Showing ${sortedSchedules.length > 0 ? startIndex + 1 : 0} to ${Math.min(startIndex + rowsPerPage, sortedSchedules.length)} of ${sortedSchedules.length} entries`,
                `Menampilkan ${sortedSchedules.length > 0 ? startIndex + 1 : 0} sampai ${Math.min(startIndex + rowsPerPage, sortedSchedules.length)} dari ${sortedSchedules.length} entri`
              )}
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
                {getText(`Page ${currentPage} of ${totalPages}`, `Halaman ${currentPage} dari ${totalPages}`)}
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

      {/* Add/Edit Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Clock className="h-6 w-6" />
                  {editingSchedule ? getText('Edit Schedule', 'Edit Jadwal') : getText('Add New Schedule', 'Tambah Jadwal Baru')}
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
                  <label className="block text-sm font-semibold text-gray-700">{getText('Course Name', 'Nama Mata Kuliah')} *</label>
                  <input
                    {...form.register('course_name')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder={getText('Enter course name', 'Masukkan nama mata kuliah')}
                  />
                  {form.formState.errors.course_name && (
                    <p className="text-red-500 text-sm">{form.formState.errors.course_name.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Course Code', 'Kode Mata Kuliah')} *</label>
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
                  <label className="block text-sm font-semibold text-gray-700">{getText('Lecturer', 'Dosen')} *</label>
                  <input
                    {...form.register('lecturer')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder={getText('Enter lecturer name', 'Masukkan nama dosen')}
                  />
                  {form.formState.errors.lecturer && (
                    <p className="text-red-500 text-sm">{form.formState.errors.lecturer.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Room', 'Ruangan')} *</label>
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
                <label className="block text-sm font-semibold text-gray-700">{getText('Study Program', 'Program Studi')} *</label>
                <input
                  {...form.register('subject_study')}
                  type="text"
                  className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  placeholder={getText('Enter study program', 'Masukkan program studi')}
                />
                {form.formState.errors.subject_study && (
                  <p className="text-red-500 text-sm">{form.formState.errors.subject_study.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Day', 'Hari')} *</label>
                  <select
                    {...form.register('day')}
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  >
                    <option value="">{getText('Select Day', 'Pilih Hari')}</option>
                    {dayNames.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                  {form.formState.errors.day && (
                    <p className="text-red-500 text-sm">{form.formState.errors.day.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Start Time', 'Waktu Mulai')} *</label>
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
                  <label className="block text-sm font-semibold text-gray-700">{getText('End Time', 'Waktu Selesai')} *</label>
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
                  <label className="block text-sm font-semibold text-gray-700">{getText('Semester', 'Semester')} *</label>
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
                  <label className="block text-sm font-semibold text-gray-700">{getText('Academic Year', 'Tahun Akademik')} *</label>
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
                  <label className="block text-sm font-semibold text-gray-700">{getText('Class Type', 'Tipe Kelas')} *</label>
                  <select
                    {...form.register('type')}
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                  >
                    <option value="theory">{getText('Theory', 'Teori')}</option>
                    <option value="practical">{getText('Practical', 'Praktik')}</option>
                  </select>
                  {form.formState.errors.type && (
                    <p className="text-red-500 text-sm">{form.formState.errors.type.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Class/Rombel', 'Kelas/Rombel')} *</label>
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
                  <label className="block text-sm font-semibold text-gray-700">{getText('Amount', 'Jumlah')}</label>
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
                  <label className="block text-sm font-semibold text-gray-700">{getText('Curriculum', 'Kurikulum')}</label>
                  <input
                    {...form.register('kurikulum')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-teal-500 focus:ring-0 transition-colors"
                    placeholder={getText('Optional', 'Opsional')}
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
                  {getText('Cancel', 'Batal')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {getText('Saving...', 'Menyimpan...')}
                    </div>
                  ) : (
                    editingSchedule ? getText('Update Schedule', 'Perbarui Jadwal') : getText('Create Schedule', 'Buat Jadwal')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Request Modal - Department Admin */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Calendar className="h-6 w-6" />
                  {getText('Request Schedule Reschedule', 'Permintaan Reschedule Jadwal')}
                </h3>
                <button
                  onClick={() => {
                    setShowRescheduleModal(false);
                    rescheduleForm.reset();
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <form onSubmit={rescheduleForm.handleSubmit(handleRescheduleSubmit)} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Course Code', 'Kode Mata Kuliah')} *</label>
                  <input
                    {...rescheduleForm.register('course_code')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                    placeholder="e.g. TIF001"
                  />
                  {rescheduleForm.formState.errors.course_code && (
                    <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.course_code.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Day', 'Hari')} *</label>
                  <select
                    {...rescheduleForm.register('day')}
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                  >
                    <option value="">{getText('Select Day', 'Pilih Hari')}</option>
                    {dayNames.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                  {rescheduleForm.formState.errors.day && (
                    <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.day.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Start Time', 'Waktu Mulai')} *</label>
                  <input
                    {...rescheduleForm.register('start_time')}
                    type="time"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                  />
                  {rescheduleForm.formState.errors.start_time && (
                    <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.start_time.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('End Time', 'Waktu Selesai')} *</label>
                  <input
                    {...rescheduleForm.register('end_time')}
                    type="time"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                  />
                  {rescheduleForm.formState.errors.end_time && (
                    <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.end_time.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Room', 'Ruangan')} *</label>
                  <input
                    {...rescheduleForm.register('room')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                    placeholder="e.g. Lab Komputer 1"
                  />
                  {rescheduleForm.formState.errors.room && (
                    <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.room.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">{getText('Class/Rombel', 'Kelas/Rombel')} *</label>
                  <input
                    {...rescheduleForm.register('class')}
                    type="text"
                    className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:ring-0 transition-colors"
                    placeholder="e.g. A, B, C"
                  />
                  {rescheduleForm.formState.errors.class && (
                    <p className="text-red-500 text-sm">{rescheduleForm.formState.errors.class.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowRescheduleModal(false);
                    rescheduleForm.reset();
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                >
                  {getText('Cancel', 'Batal')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {getText('Submitting...', 'Mengirim...')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      {getText('Submit Request', 'Kirim Permintaan')}
                    </div>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Requests Modal - Super Admin */}
      {showRescheduleRequestsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Eye className="h-6 w-6" />
                  {getText('Reschedule Requests Management', 'Manajemen Permintaan Reschedule')}
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={generatePDF}
                    className="flex items-center gap-2 px-3 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors text-sm"
                  >
                    <Download className="h-4 w-4" />
                    {getText('Export PDF', 'Ekspor PDF')}
                  </button>
                  <button
                    onClick={() => {
                      setShowRescheduleRequestsModal(false);
                    }}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Filter */}
              <div className="mb-6 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={rescheduleFilter}
                    onChange={(e) => setRescheduleFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  >
                    <option value="all">{getText('All Requests', 'Semua Permintaan')}</option>
                    <option value="pending">{getText('Pending', 'Menunggu')}</option>
                    <option value="completed">{getText('Completed', 'Selesai')}</option>
                  </select>
                </div>
                <div className="text-sm text-gray-600">
                  {getText(
                    `Total: ${filteredRescheduleRequests.length} requests`,
                    `Total: ${filteredRescheduleRequests.length} permintaan`
                  )}
                </div>
              </div>

              {/* Requests List */}
              <div className="space-y-4">
                {filteredRescheduleRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      {getText('No reschedule requests found', 'Tidak ada permintaan reschedule ditemukan')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {getText('All reschedule requests will appear here', 'Semua permintaan reschedule akan muncul di sini')}
                    </p>
                  </div>
                ) : (
                  filteredRescheduleRequests.map((request) => (
                    <div key={request.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">{request.course_code}</h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              request.is_done === null ? 'bg-yellow-100 text-yellow-800' :
                              request.is_done === true ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {getText(
                                request.is_done === null ? 'Pending' : request.is_done === true ? 'Completed' : 'Unchecked',
                                request.is_done === null ? 'Menunggu' : request.is_done === true ? 'Selesai' : 'Belum Selesai'
                              )}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">{getText('Day', 'Hari')}:</span>
                              <div className="font-medium">{request.day}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">{getText('Time', 'Waktu')}:</span>
                              <div className="font-medium">{request.start_time} - {request.end_time}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">{getText('Room', 'Ruangan')}:</span>
                              <div className="font-medium">{request.room}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">{getText('Class', 'Kelas')}:</span>
                              <div className="font-medium">{request.class}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 ml-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={request.is_done === true}
                              onChange={(e) => handleRescheduleAction(request.id, e.target.checked)}
                              className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              {getText('Mark as Done', 'Tandai Selesai')}
                            </span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          {getText('Course Code', 'Kode Mata Kuliah')}: <span className="font-medium">{request.course_code}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
                <h3 className="text-xl font-bold text-gray-900">{getText('Delete Schedule', 'Hapus Jadwal')}</h3>
                <p className="text-sm text-gray-600 mt-1">{getText('This action cannot be undone', 'Tindakan ini tidak dapat dibatalkan')}</p>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">
                {getText(
                  'Are you sure you want to delete this lecture schedule? This action will permanently remove the schedule from the system.',
                  'Apakah Anda yakin ingin menghapus jadwal kuliah ini? Tindakan ini akan menghapus jadwal secara permanen dari sistem.'
                )}
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
              >
                {getText('Cancel', 'Batal')}
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm as string)}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold transition-colors shadow-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {getText('Deleting...', 'Menghapus...')}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    {getText('Delete Schedule', 'Hapus Jadwal')}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ExcelUploadModal - Super Admin Only */}
      {profile?.role === 'super_admin' && (
        <ExcelUploadModal 
          isOpen={showUploadModal} 
          onClose={() => setShowUploadModal(false)} 
          onSuccess={() => { 
            fetchSchedules(); 
          }}
        />
      )}
    </div>
  );
};

export default LectureSchedules;