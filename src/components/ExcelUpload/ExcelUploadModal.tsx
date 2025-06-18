import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Clock,
  Calendar,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Download,
  Upload,
  RefreshCw,
  X,
  AlertCircle,
  Building,
  User,
  GraduationCap,
  BookOpen,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
// --- UPDATED: Corrected the import path ---
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Room, User as UserType, Department, StudyProgram } from '../types';
import toast from 'react-hot-toast';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import ExcelUploadModal from '../components/ExcelUpload/ExcelUploadModal';
import * as XLSX from 'xlsx';

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
  course_name: string;
  course_code: string;
  lecturer: string;
  room: string;
  subject_study: string;
  day: string;
  start_time: string;
  end_time: string;
  semester: number;
  academics_year: number;
  type: 'theory' | 'practical';
  class: string;
  amount: number;
  kurikulum?: string;
  created_at: string;
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
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof LectureSchedule; direction: 'ascending' | 'descending' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const form = useForm<ScheduleForm>({ resolver: zodResolver(scheduleSchema) });
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  useEffect(() => {
    fetchSchedules();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('lecture_schedules').select(`*`).order('day', { ascending: true }).order('start_time', { ascending: true });
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
        course_name: data.course_name, course_code: data.course_code, lecturer: data.lecturer,
        room: data.room, subject_study: data.subject_study, day: data.day,
        start_time: data.start_time, end_time: data.end_time, semester: data.semester,
        academics_year: data.academics_year, type: data.type, class: data.class,
        amount: data.amount, kurikulum: data.kurikulum,
      };
      if (editingSchedule) {
        const { error } = await supabase.from('lecture_schedules').update(scheduleData).eq('id', editingSchedule.id);
        if (error) throw error;
        toast.success('Schedule updated successfully');
      } else {
        const { error } = await supabase.from('lecture_schedules').insert(scheduleData);
        if (error) throw error;
        toast.success('Schedule created successfully');
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
        course_name: schedule.course_name, course_code: schedule.course_code, lecturer: schedule.lecturer,
        room: schedule.room, subject_study: schedule.subject_study, day: schedule.day,
        start_time: schedule.start_time, end_time: schedule.end_time, semester: schedule.semester,
        academics_year: schedule.academics_year, type: schedule.type, class: schedule.class,
        amount: schedule.amount, kurikulum: schedule.kurikulum,
    });
    setShowModal(true);
  };
  
  const handleDelete = async (scheduleId: string) => { try { setLoading(true); const { error } = await supabase.from('lecture_schedules').delete().eq('id', scheduleId); if (error) throw error; toast.success('Schedule deleted successfully'); setShowDeleteConfirm(null); fetchSchedules(); } catch (error: any) { console.error('Error deleting schedule:', error); toast.error(error.message || 'Failed to delete schedule'); } finally { setLoading(false); } };
  const handleExportExcel = () => { try { const exportData = filteredSchedules.map(schedule => ({ 'Subject Code': schedule.course_code, 'Subject Name': schedule.course_name, 'Day': schedule.day, 'Start Time': schedule.start_time, 'End Time': schedule.end_time, 'Room': schedule.room, 'Lecturer': schedule.lecturer, 'Study Program': schedule.subject_study, 'Semester': schedule.semester, 'Academic Year': schedule.academics_year, 'Class Type': schedule.type, 'Class': schedule.class, 'Amount': schedule.amount, })); const worksheet = XLSX.utils.json_to_sheet(exportData); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedules'); XLSX.writeFile(workbook, 'lecture_schedules.xlsx'); toast.success('Schedules exported successfully'); } catch (error) { console.error('Error exporting schedules:', error); toast.error('Failed to export schedules'); } };
  
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

  const getWeekDays = () => { const start = startOfWeek(currentWeek, { weekStartsOn: 1 }); const end = endOfWeek(currentWeek, { weekStartsOn: 1 }); return eachDayOfInterval({ start, end }); };
  const getSchedulesForDay = (day: Date) => { const dayName = format(day, 'EEEE'); return filteredSchedules.filter(schedule => schedule.day?.toLowerCase() === dayName.toLowerCase()); };
  const isScheduleActive = (schedule: LectureSchedule) => {
    const currentDayName = format(currentTime, 'EEEE');
    if (schedule.day?.toLowerCase() !== currentDayName.toLowerCase() || !schedule.start_time || !schedule.end_time) {
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
    return ( <div className="flex items-center justify-center h-64"> <div className="text-center"> <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" /> <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3> <p className="text-gray-600">You don't have permission to access lecture schedules.</p> </div> </div> );
  }

  return (
    <div className="space-y-6">
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl p-6 text-white"> <div className="flex items-center justify-between"> <div> <h1 className="text-3xl font-bold flex items-center space-x-3"> <Clock className="h-8 w-8" /> <span>Lecture Schedules</span> </h1> <p className="mt-2 opacity-90"> Manage academic schedules and timetables </p> </div> <div className="hidden md:block text-right"> <div className="text-2xl font-bold">{schedules.length}</div> <div className="text-sm opacity-80">Total Schedules</div> </div> </div> </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"> <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"> <div className="flex flex-col sm:flex-row gap-4 flex-1"> <div className="relative flex-1 max-w-md"> <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /> <input type="text" placeholder="Search schedules..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" /> </div> <div className="flex gap-2"> <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" > <option value="all">All Semesters</option> {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => ( <option key={sem} value={sem.toString()}>Semester {sem}</option> ))} </select> <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" > <option value="all">All Days</option> {dayNames.slice(1, 7).map((day) => ( <option key={day} value={day}>{day}</option> ))} </select> <div className="flex border border-gray-300 rounded-lg overflow-hidden"> <button onClick={() => setViewMode('table')} className={`px-4 py-2 text-sm font-medium ${ viewMode === 'table' ? 'bg-teal-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50' }`} > Table </button> <button onClick={() => setViewMode('calendar')} className={`px-4 py-2 text-sm font-medium ${ viewMode === 'calendar' ? 'bg-teal-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50' }`} > Calendar </button> </div> </div> </div> <div className="flex items-center space-x-2"> <button onClick={() => fetchSchedules()} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" > <RefreshCw className="h-5 w-5" /> </button> <button onClick={() => setShowUploadModal(true)} className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" > <Upload className="h-4 w-4" /> <span>Import Excel</span> </button> <button onClick={handleExportExcel} className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" > <Download className="h-4 w-4" /> <span>Export</span> </button> <button onClick={() => { setEditingSchedule(null); form.reset(); setShowModal(true); }} className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors" > <Plus className="h-4 w-4" /> <span>Add Schedule</span> </button> </div> </div> </div>
        
        {viewMode === 'table' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200"> <tr> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><button onClick={() => requestSort('course_name')} className="flex items-center space-x-1"><span>Subject</span><ArrowUpDown size={14}/></button></th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><button onClick={() => requestSort('lecturer')} className="flex items-center space-x-1"><span>Lecturer</span><ArrowUpDown size={14}/></button></th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><button onClick={() => requestSort('room')} className="flex items-center space-x-1"><span>Room</span><ArrowUpDown size={14}/></button></th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><button onClick={() => requestSort('day')} className="flex items-center space-x-1"><span>Schedule</span><ArrowUpDown size={14}/></button></th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><button onClick={() => requestSort('semester')} className="flex items-center space-x-1"><span>Details</span><ArrowUpDown size={14}/></button></th> <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th> </tr> </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? ( <tr> <td colSpan={6} className="px-6 py-12 text-center"> <div className="flex items-center justify-center"> <RefreshCw className="h-6 w-6 animate-spin text-teal-600 mr-2" /> <span className="text-gray-600">Loading schedules...</span> </div> </td> </tr> )
                            : currentTableData.length === 0 ? ( <tr> <td colSpan={6} className="px-6 py-12 text-center"> <div className="text-gray-500"> <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" /> <p className="text-lg font-medium mb-2">No schedules found</p> <p>Try adjusting your search or create a new schedule</p> </div> </td> </tr> )
                            : ( currentTableData.map((schedule) => { const isActive = isScheduleActive(schedule); return ( <tr key={schedule.id} className={`hover:bg-gray-50 ${isActive ? 'bg-green-100' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{schedule.course_name}</div><div className="text-sm text-gray-500">{schedule.course_code}</div></td>
                                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{schedule.lecturer}</div></td>
                                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{schedule.room}</div></td>
                                <td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm font-medium text-gray-900">{schedule.day}</div><div className="text-sm text-gray-500">{schedule.start_time?.substring(0,5)} - {schedule.end_time?.substring(0,5)}</div></div></td>
                                <td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm text-gray-900">Semester {schedule.semester}</div><div className="text-sm text-gray-500">{schedule.type}</div></div></td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><div className="flex items-center justify-end space-x-2"><button onClick={() => handleEdit(schedule)} className="text-blue-600 hover:text-blue-900 p-1 rounded"><Edit className="h-4 w-4" /></button><button onClick={() => setShowDeleteConfirm(schedule.id)} className="text-red-600 hover:text-red-900 p-1 rounded"><Trash2 className="h-4 w-4" /></button></div></td>
                            </tr> ); }) )}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t border-gray-200">
                  <span className="text-sm text-gray-600"> Showing {sortedSchedules.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + rowsPerPage, sortedSchedules.length)} of {sortedSchedules.length} entries </span>
                  <nav className="flex items-center space-x-2">
                    <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"><ChevronLeft className="h-5 w-5"/></button>
                    <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"><ChevronRight className="h-5 w-5"/></button>
                  </nav>
                </div>
            </div>
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6"> <h3 className="text-lg font-semibold text-gray-900"> Week of {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d,<x_bin_342>')} </h3> <div className="flex items-center space-x-2"> <button onClick={() => setCurrentWeek(addDays(currentWeek, -7))} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"> ← </button> <button onClick={() => setCurrentWeek(new Date())} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"> Today </button> <button onClick={() => setCurrentWeek(addDays(currentWeek, 7))} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"> → </button> </div> </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    {getWeekDays().map((day, index) => (
                    <div key={index} className="min-h-[200px] bg-gray-50 p-2 rounded-lg">
                        <div className="text-center mb-2"> <div className="text-sm font-medium text-gray-900">{format(day, 'EEE')}</div> <div className="text-lg font-bold text-gray-700">{format(day, 'd')}</div> </div>
                        <div className="space-y-1">
                        {getSchedulesForDay(day).map((schedule) => {
                            const isActive = isScheduleActive(schedule);
                            return (
                                <div key={schedule.id} className={`p-2 border rounded text-xs cursor-pointer hover:bg-teal-200 relative ${isActive ? 'bg-green-200 border-green-400' : 'bg-teal-100 border-teal-200'}`} onClick={() => handleEdit(schedule)}>
                                    {isActive && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 animate-ping"></span>}
                                    <div className="font-medium text-teal-900">{schedule.course_code}</div>
                                    <div className="text-teal-700">{schedule.start_time?.substring(0,5)} - {schedule.end_time?.substring(0,5)}</div>
                                    <div className="text-teal-600">{schedule.room}</div>
                                </div>
                            )
                        })}
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        )}
      
      {showModal && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"> <div className="p-6"> <div className="flex items-center justify-between mb-6"> <h3 className="text-lg font-semibold text-gray-900"> {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'} </h3> <button onClick={() => { setShowModal(false); setEditingSchedule(null); form.reset(); }} className="text-gray-400 hover:text-gray-600" > <X className="h-6 w-6" /> </button> </div> <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4"> <div className="grid grid-cols-2 gap-4"> <div><label className="block text-sm font-medium text-gray-700 mb-1">Course Name *</label><input {...form.register('course_name')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Course Code *</label><input {...form.register('course_code')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> </div> <div className="grid grid-cols-2 gap-4"> <div><label className="block text-sm font-medium text-gray-700 mb-1">Lecturer *</label><input {...form.register('lecturer')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Room *</label><input {...form.register('room')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> </div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Study Program *</label><input {...form.register('subject_study')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> <div className="grid grid-cols-3 gap-4"> <div><label className="block text-sm font-medium text-gray-700 mb-1">Day *</label><input {...form.register('day')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label><input {...form.register('start_time')} type="time" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label><input {...form.register('end_time')} type="time" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> </div> <div className="grid grid-cols-3 gap-4"> <div><label className="block text-sm font-medium text-gray-700 mb-1">Semester *</label><input {...form.register('semester', { valueAsNumber: true })} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label><input {...form.register('academics_year', { valueAsNumber: true })} type="number" placeholder="2024" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label><input {...form.register('amount', { valueAsNumber: true })} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> </div> <div className="grid grid-cols-2 gap-4"> <div><label className="block text-sm font-medium text-gray-700 mb-1">Class Type *</label><select {...form.register('type')} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="theory">Theory</option><option value="practical">Practical</option></select></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Kurikulum</label><input {...form.register('kurikulum')} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div> </div> <div className="flex space-x-3 pt-4"><button type="button" onClick={() => { setShowModal(false); setEditingSchedule(null); form.reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">{loading ? 'Saving...' : editingSchedule ? 'Update' : 'Create'}</button></div> </form> </div> </div> </div> )}
      {showDeleteConfirm && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"> <div className="flex items-center mb-4"> <div className="flex-shrink-0"> <AlertCircle className="h-6 w-6 text-red-600" /> </div> <div className="ml-3"> <h3 className="text-lg font-medium text-gray-900">Delete Schedule</h3> </div> </div> <p className="text-sm text-gray-500 mb-6"> Are you sure you want to delete this lecture schedule? This action cannot be undone. </p> <div className="flex space-x-3"> <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50" > Cancel </button> <button onClick={() => handleDelete(showDeleteConfirm as string)} disabled={loading} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50" > {loading ? 'Deleting...' : 'Delete'} </button> </div> </div> </div> )}
      <ExcelUploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onSuccess={() => { fetchSchedules(); toast.success('Schedules imported successfully'); }}/>
    </div>
  );
};

export default LectureSchedules;
