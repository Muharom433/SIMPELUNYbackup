import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Users,
  Building,
  Package,
  TrendingUp,
  TrendingDown,
  Filter,
  RefreshCw,
  FileText,
  PieChart,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Printer,
  Search,
  X,
  User,
  MapPin,
  Star,
  MessageSquare,
  Camera,
  AlertTriangle,
  Shield,
  Wrench,
  Mail,
  Phone,
  Edit,
  Trash2,
  Check,
  Plus,
  Send,
  UserPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import Select from 'react-select';

interface ReportData {
  bookings: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    completed: number;
    byMonth: Array<{ month: string; count: number; approved: number; rejected: number }>;
    byDepartment: Array<{ department: string; count: number }>;
    byRoom: Array<{ room: string; count: number; utilization: number }>;
  };
  users: {
    total: number;
    students: number;
    admins: number;
    byDepartment: Array<{ department: string; count: number }>;
    newRegistrations: Array<{ date: string; count: number }>;
  };
  rooms: {
    total: number;
    available: number;
    utilizationRate: number;
    mostBooked: Array<{ room: string; bookings: number }>;
    capacityUtilization: Array<{ room: string; capacity: number; avgOccupancy: number }>;
  };
  equipment: {
    total: number;
    available: number;
    inUse: number;
    byCategory: Array<{ category: string; count: number; available: number }>;
    utilizationTrend: Array<{ date: string; utilization: number }>;
  };
  issues: {
    total: number;
    new: number;
    inProgress: number;
    resolved: number;
    byCategory: Array<{ category: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
    recentReports: Array<{
      id: string;
      title: string;
      category: string;
      priority: string;
      status: string;
      reporter_name: string;
      created_at: string;
      location: string;
      attachments: string[];
    }>;
  };
}

interface IssueReport {
  id: string;
  reporter_id?: string;
  reporter_name?: string;
  reporter_email?: string;
  reporter_phone?: string;
  is_anonymous: boolean;
  category: string;
  priority: string;
  title: string;
  description: string;
  location?: string;
  room_id?: string;
  status: string;
  assigned_to?: string;
  attachments: string[];
  due_date?: string;
  resolved_at?: string;
  resolution_notes?: string;
  feedback_rating?: number;
  feedback_comment?: string;
  created_at: string;
  updated_at: string;
  room?: {
    name: string;
    code: string;
  };
  assigned_user?: {
    full_name: string;
  };
  source?: 'user' | 'technician';
}

interface ReportComment {
  id: string;
  report_id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  attachments: string[];
  created_at: string;
  user?: {
    full_name: string;
    role: string;
  };
}

const Reports: React.FC = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [issueReports, setIssueReports] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>('30days');
  const [selectedReport, setSelectedReport] = useState<string>('issues');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [selectedIssue, setSelectedIssue] = useState<IssueReport | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [reportComments, setReportComments] = useState<ReportComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'maintenance',
    priority: 'medium',
    location: '',
    room_id: '',
    equipment_ids: [] as string[],
    attachments: [] as string[],
  });

  // State for rooms, equipment, and technicians
  const [rooms, setRooms] = useState<{ id: string; name: string; code: string }[]>([]);
  const [equipmentByRoom, setEquipmentByRoom] = useState<{ id: string; name: string; code: string; condition: string }[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; full_name: string }[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [assigningReportId, setAssigningReportId] = useState<string | null>(null);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  useEffect(() => {
    fetchReportData();
    fetchIssueReports();
    fetchRooms();
    fetchTechnicians();
  }, [dateRange, departmentFilter, statusFilter, priorityFilter]);

  // Fetch rooms for dropdown
  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, code')
        .order('name');
      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  // Fetch technicians for assignment dropdown
  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'technician')
        .order('full_name');
      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

  // Fetch equipment by room_id
  const fetchEquipmentByRoom = async (roomId: string) => {
    if (!roomId) {
      setEquipmentByRoom([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, code, condition')
        .eq('rooms_id', roomId)
        .order('name');
      if (error) throw error;
      setEquipmentByRoom(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // Get actual data from the reports table for the dashboard
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select('id, category, priority, status, created_at');

      if (reportsError) throw reportsError;

      const reports = reportsData || [];

      // Calculate statistics
      const totalReports = reports.length;
      const newReports = reports.filter(r => r.status === 'new').length;
      const inProgressReports = reports.filter(r => ['under_review', 'in_progress'].includes(r.status)).length;
      const resolvedReports = reports.filter(r => ['resolved', 'closed'].includes(r.status)).length;

      // Group by category
      const categoryGroups = reports.reduce((acc, report) => {
        const category = report.category;
        if (!acc[category]) acc[category] = 0;
        acc[category]++;
        return acc;
      }, {});

      const byCategory = Object.entries(categoryGroups).map(([category, count]) => ({
        category: category.replace('_', ' '),
        count
      }));

      // Group by priority
      const priorityGroups = reports.reduce((acc, report) => {
        const priority = report.priority;
        if (!acc[priority]) acc[priority] = 0;
        acc[priority]++;
        return acc;
      }, {});

      const byPriority = Object.entries(priorityGroups).map(([priority, count]) => ({
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        count
      }));

      // Create mock data for other sections
      const mockData: ReportData = {
        bookings: {
          total: 245,
          approved: 180,
          pending: 25,
          rejected: 15,
          completed: 165,
          byMonth: [
            { month: 'Jan', count: 45, approved: 35, rejected: 5 },
            { month: 'Feb', count: 52, approved: 40, rejected: 7 },
            { month: 'Mar', count: 38, approved: 30, rejected: 3 },
            { month: 'Apr', count: 65, approved: 50, rejected: 8 },
            { month: 'May', count: 45, approved: 35, rejected: 5 },
          ],
          byDepartment: [
            { department: 'Computer Science', count: 85 },
            { department: 'Engineering', count: 65 },
            { department: 'Mathematics', count: 45 },
            { department: 'Physics', count: 35 },
            { department: 'Chemistry', count: 15 },
          ],
          byRoom: [
            { room: 'A101', count: 45, utilization: 85 },
            { room: 'B205', count: 38, utilization: 72 },
            { room: 'C301', count: 32, utilization: 68 },
            { room: 'D102', count: 28, utilization: 55 },
            { room: 'E203', count: 25, utilization: 48 },
          ],
        },
        users: {
          total: 1250,
          students: 1100,
          admins: 150,
          byDepartment: [
            { department: 'Computer Science', count: 450 },
            { department: 'Engineering', count: 350 },
            { department: 'Mathematics', count: 200 },
            { department: 'Physics', count: 150 },
            { department: 'Chemistry', count: 100 },
          ],
          newRegistrations: [
            { date: '2024-12-01', count: 15 },
            { date: '2024-12-02', count: 12 },
            { date: '2024-12-03', count: 18 },
            { date: '2024-12-04', count: 22 },
            { date: '2024-12-05', count: 8 },
            { date: '2024-12-06', count: 14 },
            { date: '2024-12-07', count: 19 },
          ],
        },
        rooms: {
          total: 45,
          available: 42,
          utilizationRate: 68,
          mostBooked: [
            { room: 'A101 - Lecture Hall', bookings: 45 },
            { room: 'B205 - Computer Lab', bookings: 38 },
            { room: 'C301 - Seminar Room', bookings: 32 },
            { room: 'D102 - Workshop', bookings: 28 },
            { room: 'E203 - Meeting Room', bookings: 25 },
          ],
          capacityUtilization: [
            { room: 'A101', capacity: 100, avgOccupancy: 85 },
            { room: 'B205', capacity: 50, avgOccupancy: 42 },
            { room: 'C301', capacity: 30, avgOccupancy: 25 },
            { room: 'D102', capacity: 40, avgOccupancy: 28 },
            { room: 'E203', capacity: 20, avgOccupancy: 15 },
          ],
        },
        equipment: {
          total: 180,
          available: 145,
          inUse: 35,
          byCategory: [
            { category: 'Audio Visual', count: 45, available: 38 },
            { category: 'Computing', count: 35, available: 28 },
            { category: 'Laboratory', count: 30, available: 25 },
            { category: 'Connectivity', count: 25, available: 22 },
            { category: 'Power', count: 20, available: 18 },
            { category: 'Safety', count: 15, available: 14 },
            { category: 'Furniture', count: 10, available: 10 },
          ],
          utilizationTrend: [
            { date: '2024-12-01', utilization: 18 },
            { date: '2024-12-02', utilization: 22 },
            { date: '2024-12-03', utilization: 25 },
            { date: '2024-12-04', utilization: 30 },
            { date: '2024-12-05', utilization: 28 },
            { date: '2024-12-06', utilization: 35 },
            { date: '2024-12-07', utilization: 32 },
          ],
        },
        issues: {
          total: totalReports,
          new: newReports,
          inProgress: inProgressReports,
          resolved: resolvedReports,
          byCategory: byCategory,
          byPriority: byPriority,
          recentReports: []
        },
      };

      setReportData(mockData);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const fetchIssueReports = async () => {
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          room:rooms(name, code),
          assigned_user:users!assigned_to(full_name)
        `)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply priority filter
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      // Apply department filter if needed
      if (departmentFilter !== 'all' && profile?.role === 'department_admin') {
        query = query.eq('room.department_id', departmentFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setIssueReports(data || []);
    } catch (error) {
      console.error('Error fetching issue reports:', error);
      toast.error('Failed to load issue reports');
    }
  };

  const fetchReportComments = async (reportId: string) => {
    try {
      const { data, error } = await supabase
        .from('report_comments')
        .select(`
          *,
          user:users(full_name, role)
        `)
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReportComments(data || []);
    } catch (error) {
      console.error('Error fetching report comments:', error);
      toast.error('Failed to load report comments');
    }
  };

  const handleAddComment = async () => {
    if (!selectedIssue || !newComment.trim()) return;

    try {
      setProcessingAction(true);

      const { error } = await supabase
        .from('report_comments')
        .insert({
          report_id: selectedIssue.id,
          user_id: profile?.id,
          comment: newComment,
          is_internal: isInternalComment,
          attachments: []
        });

      if (error) throw error;

      toast.success('Comment added successfully');
      setNewComment('');
      fetchReportComments(selectedIssue.id);

      // If this is the first comment and status is 'new', update to 'under_review'
      if (selectedIssue.status === 'new') {
        await updateReportStatus(selectedIssue.id, 'under_review');
      }

    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setProcessingAction(false);
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      setProcessingAction(true);

      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // If resolving, add resolution details
      if (newStatus === 'resolved') {
        updates.resolved_at = new Date().toISOString();
        updates.resolution_notes = resolutionNotes;
      }

      // If assigning, add assigned_to
      if (newStatus === 'in_progress' && !selectedIssue?.assigned_to) {
        updates.assigned_to = profile?.id;
      }

      const { error } = await supabase
        .from('reports')
        .update(updates)
        .eq('id', reportId);

      if (error) throw error;

      toast.success(`Report ${newStatus.replace('_', ' ')} successfully`);

      // Update local state
      if (selectedIssue && selectedIssue.id === reportId) {
        setSelectedIssue({
          ...selectedIssue,
          status: newStatus,
          ...(newStatus === 'resolved' && {
            resolved_at: new Date().toISOString(),
            resolution_notes: resolutionNotes
          }),
          ...(newStatus === 'in_progress' && !selectedIssue.assigned_to && {
            assigned_to: profile?.id,
            assigned_user: { full_name: profile?.full_name || 'Current User' }
          })
        });
      }

      // Refresh reports list
      fetchIssueReports();

      // Close modals if needed
      if (newStatus === 'resolved') {
        setShowResolveModal(false);
        setResolutionNotes('');
      }

    } catch (error) {
      console.error('Error updating report status:', error);
      toast.error('Failed to update report status');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      setProcessingAction(true);

      // First delete all comments
      const { error: commentsError } = await supabase
        .from('report_comments')
        .delete()
        .eq('report_id', reportId);

      if (commentsError) throw commentsError;

      // Then delete the report
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      toast.success('Report deleted successfully');
      setShowDeleteConfirm(null);

      // Close detail modal if open
      if (selectedIssue?.id === reportId) {
        setShowIssueModal(false);
      }

      // Refresh reports list
      fetchIssueReports();
      fetchReportData();

    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleAddTask = async () => {
    try {
      if (!newTask.title || !newTask.description) {
        toast.error(getText('Please fill in all required fields', 'Harap isi semua field yang diperlukan'));
        return;
      }

      setProcessingAction(true);

      // Get room name for location field if room_id is selected
      const selectedRoom = rooms.find(r => r.id === newTask.room_id);
      const locationName = selectedRoom?.name || newTask.location || '';

      const { error } = await supabase
        .from('reports')
        .insert({
          title: newTask.title,
          description: newTask.description,
          category: newTask.category,
          priority: newTask.priority,
          location: locationName,
          room_id: newTask.room_id || null,
          equipment_ids: newTask.equipment_ids.length > 0 ? newTask.equipment_ids : null,
          attachments: newTask.attachments.length > 0 ? newTask.attachments : null,
          status: 'new',
          is_anonymous: false,
          reporter_name: profile?.full_name || 'Super Admin',
          reporter_id: profile?.id
        });

      if (error) throw error;

      toast.success(getText('Report added successfully', 'Laporan berhasil ditambahkan'));
      setShowAddModal(false);
      setNewTask({
        title: '',
        description: '',
        category: 'maintenance',
        priority: 'medium',
        location: '',
        room_id: '',
        equipment_ids: [],
        attachments: [],
      });
      setEquipmentByRoom([]);
      fetchIssueReports();
      fetchReportData();

    } catch (error) {
      console.error('Error adding task:', error);
      toast.error(getText('Failed to add report', 'Gagal menambah laporan'));
    } finally {
      setProcessingAction(false);
    }
  };

  // Function to assign report to a technician's to-do list
  const handleAssignToTechnician = async (reportId: string, technicianId: string) => {
    try {
      setProcessingAction(true);

      const report = issueReports.find(r => r.id === reportId);
      if (!report) {
        toast.error('Report not found');
        return;
      }

      // Create a task in technician_tasks table
      const { error: taskError } = await supabase
        .from('technician_tasks')
        .insert({
          technician_id: technicianId,
          report_id: reportId,
          equipment_id: (report as any).equipment_id || null,
          title: report.title,
          description: report.description,
          priority: report.priority,
          status: 'pending',
          assigned_by: profile?.id,
          is_private: false
        });

      if (taskError) throw taskError;

      // Update report status to in_progress and assigned_to
      const { error: reportError } = await supabase
        .from('reports')
        .update({
          status: 'in_progress',
          assigned_to: technicianId,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (reportError) throw reportError;

      // Update equipment_ids status to MAINTENANCE
      const equipmentIds = (report as any).equipment_ids as string[] | null;
      if (equipmentIds && equipmentIds.length > 0) {
        const { error: equipmentError } = await supabase
          .from('equipment')
          .update({ condition: 'MAINTENANCE' })
          .in('id', equipmentIds);

        if (equipmentError) {
          console.error('Error updating equipment status:', equipmentError);
        }
      }

      toast.success(getText('Report assigned to technician successfully', 'Laporan berhasil ditugaskan ke teknisi'));
      fetchIssueReports();
      fetchReportData();
    } catch (error) {
      console.error('Error assigning to technician:', error);
      toast.error(getText('Failed to assign report', 'Gagal menugaskan laporan'));
    } finally {
      setProcessingAction(false);
    }
  };

  const exportReport = (format: 'pdf' | 'excel' | 'csv') => {
    // Mock export functionality
    toast.success(`Report exported as ${format.toUpperCase()}`);
  };

  const printReport = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'equipment': return Package;
      case 'room_condition': return Building;
      case 'cleanliness': return Activity;
      case 'safety': return Shield;
      case 'maintenance': return Wrench;
      default: return AlertCircle;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new': return getText('New', 'Baru');
      case 'under_review': return getText('Under Review', 'Sedang Ditinjau');
      case 'in_progress': return getText('In Progress', 'Dalam Proses');
      case 'resolved': return getText('Resolved', 'Selesai');
      case 'closed': return getText('Closed', 'Ditutup');
      default: return status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1);
    }
  };

  const filteredIssueReports = issueReports.filter(report => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.reporter_name && report.reporter_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (report.location && report.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || report.priority === priorityFilter;
    const matchesRoom = roomFilter === 'all' || report.room_id === roomFilter || (report.location && rooms.find(r => r.id === roomFilter)?.name === report.location);

    return matchesSearch && matchesStatus && matchesPriority && matchesRoom;
  });

  if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to access reports.</p>
        </div>
      </div>
    );
  }

  if (loading && !reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading reports...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <BarChart3 className="h-8 w-8" />
              <span>{getText('Issue Reports Management', 'Manajemen Laporan Masalah')}</span>
            </h1>
            <p className="mt-2 opacity-90">
              {getText('Manage and respond to student complaints and issue reports', 'Kelola dan tanggapi keluhan dan laporan masalah mahasiswa')}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{reportData?.issues.total || 0}</div>
            <div className="text-sm opacity-80">{getText('Total Reports', 'Total Laporan')}</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: getText('New', 'Baru'), count: reportData?.issues.new || 0, color: 'bg-blue-500', icon: AlertCircle },
          { label: getText('In Progress', 'Dalam Proses'), count: reportData?.issues.inProgress || 0, color: 'bg-yellow-500', icon: Clock },
          { label: getText('Resolved', 'Selesai'), count: reportData?.issues.resolved || 0, color: 'bg-green-500', icon: CheckCircle },
          { label: getText('Total', 'Total'), count: reportData?.issues.total || 0, color: 'bg-purple-500', icon: BarChart3 },
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.count}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-xl`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={getText("Search issue reports...", "Cari laporan masalah...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Searchable Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Status Filter */}
              <div className="min-w-[140px] w-40">
                <Select
                  value={{
                    value: statusFilter,
                    label: statusFilter === 'all' ? getText("All Status", "Semua Status") :
                           statusFilter === 'new' ? 'New' :
                           statusFilter === 'under_review' ? 'Under Review' :
                           statusFilter === 'in_progress' ? 'In Progress' :
                           statusFilter === 'resolved' ? 'Resolved' : 'Closed'
                  }}
                  onChange={(selectedOption: any) => setStatusFilter(selectedOption ? selectedOption.value : 'all')}
                  options={[
                    { value: 'all', label: getText("All Status", "Semua Status") },
                    { value: 'new', label: 'New' },
                    { value: 'under_review', label: 'Under Review' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'resolved', label: 'Resolved' },
                    { value: 'closed', label: 'Closed' }
                  ]}
                  placeholder={getText("Status...", "Status...")}
                  isSearchable
                  isClearable={false}
                  className="text-sm"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      borderColor: state.isFocused ? '#2563eb' : '#d1d5db',
                      borderRadius: '0.5rem',
                      minHeight: '38px',
                      boxShadow: state.isFocused ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
                      '&:hover': { borderColor: '#2563eb' }
                    }),
                    menu: (base) => ({ ...base, zIndex: 50 }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : 'white',
                      color: state.isSelected ? 'white' : '#374151',
                      cursor: 'pointer'
                    })
                  }}
                />
              </div>

              {/* Priority Filter */}
              <div className="min-w-[140px] w-40">
                <Select
                  value={{
                    value: priorityFilter,
                    label: priorityFilter === 'all' ? getText("All Priority", "Semua Prioritas") :
                           priorityFilter === 'low' ? 'Low' :
                           priorityFilter === 'medium' ? 'Medium' :
                           priorityFilter === 'high' ? 'High' : 'Critical'
                  }}
                  onChange={(selectedOption: any) => setPriorityFilter(selectedOption ? selectedOption.value : 'all')}
                  options={[
                    { value: 'all', label: getText("All Priority", "Semua Prioritas") },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'critical', label: 'Critical' }
                  ]}
                  placeholder={getText("Priority...", "Prioritas...")}
                  isSearchable
                  isClearable={false}
                  className="text-sm"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      borderColor: state.isFocused ? '#2563eb' : '#d1d5db',
                      borderRadius: '0.5rem',
                      minHeight: '38px',
                      boxShadow: state.isFocused ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
                      '&:hover': { borderColor: '#2563eb' }
                    }),
                    menu: (base) => ({ ...base, zIndex: 50 }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : 'white',
                      color: state.isSelected ? 'white' : '#374151',
                      cursor: 'pointer'
                    })
                  }}
                />
              </div>

              {/* Room Filter */}
              <div className="min-w-[180px] w-56">
                <Select
                  value={roomFilter === 'all' ? { value: 'all', label: getText('All Rooms', 'Semua Ruangan') } : {
                    value: roomFilter,
                    label: `${rooms.find(r => r.id === roomFilter)?.name || ''} (${rooms.find(r => r.id === roomFilter)?.code || ''})`
                  }}
                  onChange={(selectedOption: any) => setRoomFilter(selectedOption ? selectedOption.value : 'all')}
                  options={[
                    { value: 'all', label: getText('All Rooms', 'Semua Ruangan') },
                    ...rooms.map(r => ({
                      value: r.id,
                      label: `${r.name} (${r.code})`
                    }))
                  ]}
                  placeholder={getText('Filter room...', 'Filter ruangan...')}
                  isSearchable
                  isClearable={false}
                  className="text-sm"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      borderColor: state.isFocused ? '#2563eb' : '#d1d5db',
                      borderRadius: '0.5rem',
                      minHeight: '38px',
                      boxShadow: state.isFocused ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
                      '&:hover': { borderColor: '#2563eb' }
                    }),
                    menu: (base) => ({ ...base, zIndex: 50 }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : 'white',
                      color: state.isSelected ? 'white' : '#374151',
                      cursor: 'pointer'
                    })
                  }}
                />
              </div>

              {/* Reset filter button if any filter is active */}
              {(statusFilter !== 'all' || priorityFilter !== 'all' || roomFilter !== 'all') && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setPriorityFilter('all');
                    setRoomFilter('all');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg border border-blue-200 transition-colors"
                >
                  {getText('Reset', 'Atur Ulang')}
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <Plus className="h-4 w-4" />
              <span>{getText('Add Task', 'Tambah Tugas')}</span>
            </button>
            <button
              onClick={() => {
                fetchIssueReports();
                fetchReportData();
              }}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
            >
              <RefreshCw className="h-5 w-5" />
            </button>

            <button
              onClick={printReport}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <Printer className="h-4 w-4" />
              <span>{getText('Print', 'Cetak')}</span>
            </button>

            <div className="relative group">
              <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
                <Download className="h-4 w-4" />
                <span>{getText('Export', 'Ekspor')}</span>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => exportReport('pdf')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export as PDF
                  </button>
                  <button
                    onClick={() => exportReport('excel')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export as Excel
                  </button>
                  <button
                    onClick={() => exportReport('csv')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export as CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Reports List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Issue', 'Masalah')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Reporter', 'Pelapor')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Location', 'Lokasi')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Priority', 'Prioritas')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Status', 'Status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Created', 'Dibuat')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Actions', 'Aksi')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIssueReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No issue reports found</p>
                      <p>Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIssueReports.map((report) => {
                  const CategoryIcon = getCategoryIcon(report.category);
                  return (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                            <CategoryIcon className="h-5 w-5 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{report.title}</div>
                            <div className="text-sm text-gray-500 capitalize">{report.category.replace('_', ' ')}</div>
                            {report.attachments && report.attachments.length > 0 && (
                              <div className="flex items-center mt-1">
                                <Camera className="h-3 w-3 text-gray-400 mr-1" />
                                <span className="text-xs text-gray-500">{report.attachments.length} photo(s)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {report.is_anonymous ? 'Anonymous' : (report.reporter_name || 'Unknown')}
                            </div>
                            {!report.is_anonymous && report.reporter_email && (
                              <div className="text-sm text-gray-500">{report.reporter_email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm text-gray-900">{report.location || report.room?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
                          {report.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                          {getStatusText(report.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(report.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedIssue(report);
                              setShowIssueModal(true);
                              fetchReportComments(report.id);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors duration-200"
                            title={getText('View Details', 'Lihat Detail')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {/* Assign to Technician Button */}
                          {report.status !== 'resolved' && report.status !== 'closed' && profile?.role === 'super_admin' && (
                            <button
                              onClick={() => {
                                setAssigningReportId(report.id);
                                setShowAssignModal(true);
                              }}
                              className="text-purple-600 hover:text-purple-900 p-1 rounded transition-colors duration-200"
                              title={getText('Assign to Technician', 'Tugaskan ke Teknisi')}
                            >
                              <UserPlus className="h-4 w-4" />
                            </button>
                          )}
                          {report.status !== 'resolved' && report.status !== 'closed' && (
                            <button
                              onClick={() => {
                                setSelectedIssue(report);
                                setShowResolveModal(true);
                              }}
                              className="text-green-600 hover:text-green-900 p-1 rounded transition-colors duration-200"
                              title={getText('Resolve Issue', 'Selesaikan Laporan')}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setShowDeleteConfirm(report.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-200"
                            title={getText('Delete Report', 'Hapus Laporan')}
                          >
                            <Trash2 className="h-4 w-4" />
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
      </div>

      {/* Issue Detail Modal */}
      {showIssueModal && selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Issue Report Details</h3>
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-lg font-medium text-gray-900">{selectedIssue.title}</h4>
                    <div className="flex space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedIssue.priority)}`}>
                        {selectedIssue.priority.toUpperCase()}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedIssue.status)}`}>
                        {getStatusText(selectedIssue.status)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Category:</span>
                      <span className="ml-2 font-medium capitalize">{selectedIssue.category.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <span className="ml-2 font-medium">{selectedIssue.location || selectedIssue.room?.name || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Reported:</span>
                      <span className="ml-2">{format(new Date(selectedIssue.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Reporter:</span>
                      <span className="ml-2">{selectedIssue.is_anonymous ? 'Anonymous' : (selectedIssue.reporter_name || 'Unknown')}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Description</h5>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">{selectedIssue.description}</p>
                  </div>
                </div>

                {/* Contact Information */}
                {!selectedIssue.is_anonymous && (selectedIssue.reporter_email || selectedIssue.reporter_phone) && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Contact Information</h5>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="space-y-2 text-sm">
                        {selectedIssue.reporter_email && (
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 text-blue-600 mr-2" />
                            <span>{selectedIssue.reporter_email}</span>
                          </div>
                        )}
                        {selectedIssue.reporter_phone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 text-blue-600 mr-2" />
                            <span>{selectedIssue.reporter_phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {selectedIssue.attachments && selectedIssue.attachments.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Attachments ({selectedIssue.attachments.length})</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedIssue.attachments.map((attachment, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={attachment}
                            alt={`Attachment ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity duration-200"
                            onClick={() => window.open(attachment, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center">
                            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assignment Info */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Assignment</h5>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {selectedIssue.assigned_to ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {selectedIssue.assigned_user?.full_name || 'Assigned Staff'}
                            </div>
                            <div className="text-xs text-gray-500">
                              Assigned on {selectedIssue.updated_at ? format(new Date(selectedIssue.updated_at), 'MMM d, yyyy') : 'Unknown date'}
                            </div>
                          </div>
                        </div>
                        {selectedIssue.status !== 'resolved' && selectedIssue.status !== 'closed' && (
                          <button
                            onClick={() => updateReportStatus(selectedIssue.id, 'in_progress')}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm hover:bg-blue-200 transition-colors"
                          >
                            {selectedIssue.status === 'in_progress' ? 'Update Status' : 'Start Working'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">No one is assigned to this issue yet</div>
                        <button
                          onClick={() => updateReportStatus(selectedIssue.id, 'in_progress')}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                        >
                          Assign to Me
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments Section */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Comments & Updates</h5>

                  {reportComments.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <MessageSquare className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No comments yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4 mb-4">
                      {reportComments.map((comment) => (
                        <div
                          key={comment.id}
                          className={`p-4 rounded-lg ${comment.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-200'}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-gray-900">
                                  {comment.user?.full_name || 'Staff Member'}
                                  {comment.is_internal && (
                                    <span className="ml-2 text-xs font-normal text-yellow-600">Internal Note</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                                </div>
                              </div>
                              <div className="mt-1 text-sm text-gray-700">
                                {comment.comment}
                              </div>
                              {comment.attachments && comment.attachments.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {comment.attachments.map((attachment, index) => (
                                    <div key={index} className="relative group">
                                      <img
                                        src={attachment}
                                        alt={`Attachment ${index + 1}`}
                                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Comment Form */}
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment or update..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mt-1"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="internal-comment"
                              checked={isInternalComment}
                              onChange={() => setIsInternalComment(!isInternalComment)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="internal-comment" className="ml-2 text-sm text-gray-700">
                              Internal note (only visible to staff)
                            </label>
                          </div>
                          <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim() || processingAction}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            <Send className="h-4 w-4" />
                            <span>{processingAction ? 'Sending...' : 'Send'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resolution */}
                {selectedIssue.status === 'resolved' && selectedIssue.resolution_notes && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Resolution</h5>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700">{selectedIssue.resolution_notes}</p>
                      {selectedIssue.resolved_at && (
                        <p className="text-xs text-green-600 mt-2">
                          Resolved on {format(new Date(selectedIssue.resolved_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {selectedIssue.feedback_rating && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Feedback</h5>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <span className="text-sm text-gray-700 mr-2">Rating:</span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${star <= selectedIssue.feedback_rating!
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                                }`}
                            />
                          ))}
                        </div>
                      </div>
                      {selectedIssue.feedback_comment && (
                        <p className="text-sm text-gray-700">{selectedIssue.feedback_comment}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                  {selectedIssue.status !== 'resolved' && selectedIssue.status !== 'closed' && (
                    <button
                      onClick={() => {
                        setShowIssueModal(false);
                        setShowResolveModal(true);
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                    >
                      <Check className="h-4 w-4" />
                      <span>Mark as Resolved</span>
                    </button>
                  )}

                  {selectedIssue.status === 'new' && (
                    <button
                      onClick={() => updateReportStatus(selectedIssue.id, 'under_review')}
                      disabled={processingAction}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4" />
                      <span>{processingAction ? 'Updating...' : 'Start Review'}</span>
                    </button>
                  )}

                  {selectedIssue.status === 'under_review' && (
                    <button
                      onClick={() => updateReportStatus(selectedIssue.id, 'in_progress')}
                      disabled={processingAction}
                      className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      <Clock className="h-4 w-4" />
                      <span>{processingAction ? 'Updating...' : 'Start Working'}</span>
                    </button>
                  )}

                  {selectedIssue.status === 'resolved' && (
                    <button
                      onClick={() => updateReportStatus(selectedIssue.id, 'closed')}
                      disabled={processingAction}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>{processingAction ? 'Updating...' : 'Close Issue'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowDeleteConfirm(selectedIssue.id)}
                    disabled={processingAction}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Report</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Resolve Issue</h3>
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4">
                <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700">
                        You're about to mark this issue as resolved. Please provide resolution details.
                      </p>
                    </div>
                  </div>
                </div>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issue Title
                </label>
                <div className="text-sm font-medium text-gray-900 mb-4 p-2 bg-gray-50 rounded-lg">
                  {selectedIssue.title}
                </div>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Notes *
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  placeholder="Describe how this issue was resolved..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateReportStatus(selectedIssue.id, 'resolved')}
                  disabled={!resolutionNotes.trim() || processingAction}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {processingAction ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{processingAction ? 'Resolving...' : 'Resolve Issue'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Delete Report</h3>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this report? This action cannot be undone and all associated comments will also be deleted.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteReport(showDeleteConfirm)}
                disabled={processingAction}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {processingAction ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>{processingAction ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section - Only show when not viewing issues */}
      {selectedReport !== 'issues' && reportData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking Trends */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Booking Trends</h3>
              <Eye className="h-5 w-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={reportData.bookings.byMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="count" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="approved" stackId="2" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Issue Reports by Category */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Issues by Category</h3>
              <PieChart className="h-5 w-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={reportData.issues.byCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {reportData.issues.byCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{getText('Report Summary', 'Ringkasan Laporan')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{reportData?.issues.new || 0}</div>
            <div className="text-sm text-gray-600">{getText('New Reports', 'Laporan Baru')}</div>
            <div className="text-xs text-blue-600 mt-1">
              {getText('Require immediate attention', 'Butuh perhatian segera')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{reportData?.issues.inProgress || 0}</div>
            <div className="text-sm text-gray-600">{getText('In Progress', 'Dalam Proses')}</div>
            <div className="text-xs text-orange-600 mt-1">
              {getText('Currently being addressed', 'Sedang ditangani')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{reportData?.issues.resolved || 0}</div>
            <div className="text-sm text-gray-600">{getText('Resolved', 'Selesai')}</div>
            <div className="text-xs text-green-600 mt-1">
              {getText('Successfully completed', 'Berhasil diselesaikan')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{reportData?.issues.total || 0}</div>
            <div className="text-sm text-gray-600">{getText('Total Reports', 'Total Laporan')}</div>
            <div className="text-xs text-purple-600 mt-1">
              {getText('All time submissions', 'Semua kiriman')}
            </div>
          </div>
        </div>
      </div>

      {/* Add Manual Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">{getText('Add Manual Task', 'Tambah Tugas Manual')}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getText('Task Title', 'Judul Tugas')} *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Fix projector in A101"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Detailed description of the task..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="maintenance">Maintenance</option>
                    <option value="equipment">Equipment</option>
                    <option value="room_condition">Room Condition</option>
                    <option value="cleanliness">Cleanliness</option>
                    <option value="safety">Safety</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              {/* Room Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getText('Room', 'Ruangan')}
                </label>
                <Select
                  value={rooms.find(r => r.id === newTask.room_id) ? {
                    value: newTask.room_id,
                    label: `${rooms.find(r => r.id === newTask.room_id)?.name} (${rooms.find(r => r.id === newTask.room_id)?.code})`
                  } : null}
                  onChange={(selectedOption: any) => {
                    const roomId = selectedOption ? selectedOption.value : '';
                    setNewTask({ ...newTask, room_id: roomId, equipment_ids: [] });
                    if (roomId) fetchEquipmentByRoom(roomId);
                    else setEquipmentByRoom([]);
                  }}
                  options={rooms.map(room => ({
                    value: room.id,
                    label: `${room.name} (${room.code})`
                  }))}
                  placeholder={getText('Select Room...', 'Pilih Ruangan...')}
                  isClearable
                  className="text-sm"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: '#d1d5db',
                      '&:hover': {
                        borderColor: '#2563eb'
                      },
                      boxShadow: 'none',
                      borderRadius: '0.5rem',
                      padding: '2px'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : 'white',
                      color: state.isSelected ? 'white' : 'black',
                    })
                  }}
                />
              </div>

              {/* Equipment Multi-Select */}
              {newTask.room_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Equipment (optional)', 'Peralatan (opsional)')}
                  </label>
                  {equipmentByRoom.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">{getText('No equipment in this room', 'Tidak ada peralatan di ruangan ini')}</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                      {equipmentByRoom.map((eq) => (
                        <label key={eq.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newTask.equipment_ids.includes(eq.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewTask({ ...newTask, equipment_ids: [...newTask.equipment_ids, eq.id] });
                              } else {
                                setNewTask({ ...newTask, equipment_ids: newTask.equipment_ids.filter(id => id !== eq.id) });
                              }
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">{eq.name} ({eq.code})</span>
                          <span className={`text-xs px-1 py-0.5 rounded ${eq.condition === 'GOOD' ? 'bg-green-100 text-green-700' :
                            eq.condition === 'BROKEN' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>{eq.condition}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 flex space-x-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {getText('Cancel', 'Batal')}
                </button>
                <button
                  onClick={handleAddTask}
                  disabled={processingAction}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {processingAction ? getText('Adding...', 'Menambahkan...') : getText('Add Task', 'Tambah Tugas')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Technician Modal */}
      {showAssignModal && assigningReportId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {getText('Assign to Technician', 'Tugaskan ke Teknisi')}
                </h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssigningReportId(null);
                    setSelectedTechnicianId('');
                  }}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('Select Technician', 'Pilih Teknisi')}
                  </label>
                  <Select
                    value={selectedTechnicianId ? {
                      value: selectedTechnicianId,
                      label: technicians.find(t => t.id === selectedTechnicianId)?.full_name || ''
                    } : null}
                    onChange={(selectedOption: any) => setSelectedTechnicianId(selectedOption ? selectedOption.value : '')}
                    options={technicians.map((tech) => ({
                      value: tech.id,
                      label: tech.full_name
                    }))}
                    placeholder={getText('Search or choose technician...', 'Cari / pilih teknisi...')}
                    isSearchable
                    isClearable
                    className="text-sm"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: state.isFocused ? '#9333ea' : '#d1d5db',
                        borderRadius: '0.5rem',
                        boxShadow: state.isFocused ? '0 0 0 2px rgba(147, 51, 234, 0.2)' : 'none',
                        '&:hover': {
                          borderColor: '#9333ea'
                        }
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 50,
                        borderRadius: '0.5rem',
                        overflow: 'hidden'
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected ? '#9333ea' : state.isFocused ? '#f3e8ff' : 'white',
                        color: state.isSelected ? 'white' : '#374151',
                        cursor: 'pointer'
                      })
                    }}
                  />
                </div>

                <div className="pt-4 flex space-x-3">
                  <button
                    onClick={() => {
                      setShowAssignModal(false);
                      setAssigningReportId(null);
                      setSelectedTechnicianId('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    {getText('Cancel', 'Batal')}
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedTechnicianId) {
                        toast.error(getText('Please select a technician', 'Pilih teknisi terlebih dahulu'));
                        return;
                      }
                      await handleAssignToTechnician(assigningReportId, selectedTechnicianId);
                      setShowAssignModal(false);
                      setAssigningReportId(null);
                      setSelectedTechnicianId('');
                    }}
                    disabled={!selectedTechnicianId || processingAction}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {processingAction ? getText('Assigning...', 'Menugaskan...') : getText('Assign', 'Tugaskan')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;