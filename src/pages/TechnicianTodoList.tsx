import React, { useState, useEffect } from 'react';
import {
    CheckSquare, Plus, Clock, CheckCircle, AlertCircle, RefreshCw,
    Trash2, X, Search, Calendar, MapPin, ArrowRight,
    Package, AlertTriangle, Edit, FileText, MessageSquare, Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import Select from 'react-select';

interface TechnicianTask {
    id: string;
    technician_id: string;
    report_id: string | null;
    equipment_id: string | null;
    title: string;
    description: string | null;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'in_progress' | 'completed';
    notes: string | null;
    is_private: boolean;
    assigned_by: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    report?: {
        id: string;
        title: string;
        category: string;
        location: string;
        description: string;
        room_id: string;
        equipment_ids: string[];
        room?: {
            name: string;
            code: string;
        };
    };
    report_equipment?: Array<{ id: string; name: string; code: string; condition: string }>;
    equipment?: {
        name: string;
        code: string;
        condition: string;
    };
    assigner?: {
        full_name: string;
    };
    room_id?: string;
    equipment_ids?: string[];
    room?: {
        name: string;
        code: string;
    };
    manual_equipment?: Array<{ name: string; code: string; condition: string; }>;
}

interface Room {
    id: string;
    name: string;
    code: string;
}

interface Equipment {
    id: string;
    name: string;
    code: string;
    condition: string;
}

const TechnicianTodoList: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();
    const [tasks, setTasks] = useState<TechnicianTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
    const [resolveComment, setResolveComment] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [notesTaskId, setNotesTaskId] = useState<string | null>(null);
    const [privateNotes, setPrivateNotes] = useState('');
    const [showMessagingModal, setShowMessagingModal] = useState(false);
    const [messagingTaskId, setMessagingTaskId] = useState<string | null>(null);
    const [taskComments, setTaskComments] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
        room_id: '',
        equipment_ids: [] as string[]
    });
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomEquipment, setRoomEquipment] = useState<Equipment[]>([]);

    useEffect(() => {
        if (profile?.id) {
            fetchTasks();
            fetchRooms();
        }
    }, [profile?.id]);

    const fetchRooms = async () => {
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('id, name, code')
                .order('name');

            if (error) throw error;
            setRooms(data || []);
        } catch (error) {
        }
    };

    const fetchRoomEquipment = async (roomId: string) => {
        try {
            const { data, error } = await supabase
                .from('equipment')
                .select('id, name, code, condition')
                .eq('rooms_id', roomId)
                .order('name');

            if (error) throw error;
            setRoomEquipment(data || []);
        } catch (error) {
            setRoomEquipment([]);
        }
    };

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('technician_tasks')
                .select(`
                    *,
                    report:reports(id, title, category, location, description, room_id, equipment_ids,
                        room:rooms(name, code)
                    ),
                    room:rooms(name, code),
                    equipment:equipment(name, code, condition),
                    assigner:users!assigned_by(full_name)
                `)
                .eq('technician_id', profile?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch equipment details for each task (report or manual)
            const tasksWithEquipment = await Promise.all((data || []).map(async (task: any) => {
                let reportEquipment: any[] = [];
                let manualEquipment: any[] = [];

                if (task.report?.equipment_ids && task.report.equipment_ids.length > 0) {
                    const { data: eqData } = await supabase
                        .from('equipment')
                        .select('id, name, code, condition')
                        .in('id', task.report.equipment_ids);
                    reportEquipment = eqData || [];
                }

                if (task.equipment_ids && task.equipment_ids.length > 0) {
                    const { data: eqData } = await supabase
                        .from('equipment')
                        .select('id, name, code, condition')
                        .in('id', task.equipment_ids);
                    manualEquipment = eqData || [];
                }

                return {
                    ...task,
                    report_equipment: reportEquipment,
                    manual_equipment: manualEquipment
                };
            }));

            setTasks(tasksWithEquipment);
        } catch (error) {
            toast.error(getText('Failed to load tasks', 'Gagal memuat tugas'));
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async () => {
        if (!formData.title.trim()) {
            toast.error(getText('Title is required', 'Judul wajib diisi'));
            return;
        }

        try {
            const { error } = await supabase.from('technician_tasks').insert({
                technician_id: profile?.id,
                title: formData.title,
                description: formData.description || null,
                priority: formData.priority,
                room_id: formData.room_id || null,
                equipment_ids: formData.equipment_ids.length > 0 ? formData.equipment_ids : null,
                is_private: true,
                status: 'pending'
            });

            if (error) throw error;

            toast.success(getText('Task added successfully', 'Tugas berhasil ditambahkan'));
            setShowAddModal(false);
            setFormData({
                title: '',
                description: '',
                priority: 'medium',
                room_id: '',
                equipment_ids: []
            });
            fetchTasks();
        } catch (error) {
            toast.error(getText('Failed to add task', 'Gagal menambah tugas'));
        }
    };

    const handleUpdateStatus = async (taskId: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
        try {
            const updates: any = {
                status: newStatus,
                updated_at: new Date().toISOString()
            };

            if (newStatus === 'completed') {
                updates.completed_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('technician_tasks')
                .update(updates)
                .eq('id', taskId);

            if (error) throw error;

            // If completed and has report_id, resolve the report and update equipment
            const task = tasks.find(t => t.id === taskId);
            if (newStatus === 'completed' && task?.report_id) {
                // Get equipment_ids from the linked report
                const { data: reportData } = await supabase
                    .from('reports')
                    .select('equipment_ids')
                    .eq('id', task.report_id)
                    .single();

                // Update all equipment in equipment_ids to GOOD
                const equipmentIds = reportData?.equipment_ids as string[] | null;
                if (equipmentIds && equipmentIds.length > 0) {
                    await supabase
                        .from('equipment')
                        .update({ condition: 'GOOD', updated_at: new Date().toISOString() })
                        .in('id', equipmentIds);
                }

                // Also update single equipment_id if exists on task
                if (task.equipment_id && !equipmentIds?.includes(task.equipment_id)) {
                    await supabase
                        .from('equipment')
                        .update({ condition: 'GOOD', updated_at: new Date().toISOString() })
                        .eq('id', task.equipment_id);
                }

                // Resolve the report
                await supabase
                    .from('reports')
                    .update({
                        status: 'resolved',
                        resolved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', task.report_id);
            } else if (newStatus === 'completed' && task?.equipment_id) {
                // Manual task with just equipment_id (no report)
                await supabase
                    .from('equipment')
                    .update({ condition: 'GOOD', updated_at: new Date().toISOString() })
                    .eq('id', task.equipment_id);
            }

            toast.success(getText('Status updated', 'Status diperbarui'));
            fetchTasks();
        } catch (error) {
            toast.error(getText('Failed to update status', 'Gagal memperbarui status'));
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        const result = await Swal.fire({
            title: getText('Delete this task?', 'Hapus tugas ini?'),
            text: getText('This action cannot be undone.', 'Tindakan ini tidak dapat dibatalkan.'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: getText('Yes, delete it!', 'Ya, hapus!'),
            cancelButtonText: getText('Cancel', 'Batal')
        });

        if (!result.isConfirmed) return;

        try {
            const { error } = await supabase
                .from('technician_tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;

            toast.success(getText('Task deleted', 'Tugas dihapus'));
            fetchTasks();
        } catch (error) {
            toast.error(getText('Failed to delete task', 'Gagal menghapus tugas'));
        }
    };

    // Resolve task with mandatory comment
    const handleResolveWithComment = async (taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!resolveComment.trim()) {
            toast.error(getText('Comment is required to resolve', 'Komentar wajib diisi untuk menyelesaikan'));
            return;
        }

        try {
            // Send comment to report if linked
            if (task?.report_id) {
                await supabase.from('report_comments').insert({
                    report_id: task.report_id,
                    user_id: profile?.id,
                    comment: resolveComment,
                    commenter_name: profile?.full_name || 'Teknisi'
                });
            }

            // Update task status to completed
            await handleUpdateStatus(taskId, 'completed');

            setResolvingTaskId(null);
            setResolveComment('');
        } catch (error) {
            toast.error(getText('Failed to resolve task', 'Gagal menyelesaikan tugas'));
        }
    };

    const handleEditTask = async () => {
        if (!editingTaskId || !formData.title.trim()) return;
        try {
            await supabase.from('technician_tasks').update({
                title: formData.title, description: formData.description, priority: formData.priority,
                room_id: formData.room_id || null, equipment_ids: formData.equipment_ids.length > 0 ? formData.equipment_ids : null
            }).eq('id', editingTaskId);
            toast.success(getText('Task updated', 'Tugas diperbarui'));
            setShowEditModal(false); setEditingTaskId(null); fetchTasks();
        } catch (e) { toast.error(getText('Failed to update', 'Gagal memperbarui')); }
    };

    const handleSaveNotes = async () => {
        if (!notesTaskId) return;
        try {
            await supabase.from('technician_tasks').update({ notes: privateNotes }).eq('id', notesTaskId);
            toast.success(getText('Notes saved', 'Catatan disimpan'));
            setShowNotesModal(false); setNotesTaskId(null); setPrivateNotes(''); fetchTasks();
        } catch (e) { toast.error(getText('Failed to save notes', 'Gagal menyimpan catatan')); }
    };

    const fetchTaskComments = async (reportId: string) => {
        const { data } = await supabase.from('report_comments').select('*, user:users(full_name, role)').eq('report_id', reportId).order('created_at');
        setTaskComments(data || []);
    };

    const handleSendMessage = async () => {
        const task = tasks.find(t => t.id === messagingTaskId);
        if (!task?.report_id || !newMessage.trim()) return;
        try {
            await supabase.from('report_comments').insert({ report_id: task.report_id, user_id: profile?.id, comment: newMessage, is_internal: false });
            if (task.status === 'pending') await handleUpdateStatus(task.id, 'in_progress');
            toast.success(getText('Message sent', 'Pesan terkirim'));
            setNewMessage(''); fetchTaskComments(task.report_id); fetchTasks();
        } catch (e) { toast.error(getText('Failed to send', 'Gagal mengirim')); }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'low': return 'bg-green-100 text-green-800 border-green-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'critical': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="h-4 w-4 text-gray-500" />;
            case 'in_progress': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
            case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
            default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
        }
    };

    const filteredTasks = tasks.filter(task => {
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.notes?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesPriority && matchesSearch;
    });

    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;

    if (profile?.role !== 'technician' && profile?.role !== 'super_admin') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('Access Denied', 'Akses Ditolak')}</h3>
                    <p className="text-gray-600">{getText("You don't have permission to access this page.", 'Anda tidak memiliki izin untuk mengakses halaman ini.')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3">
                            <CheckSquare className="h-8 w-8" />
                            <span>{getText('My To-Do List', 'Daftar Tugas Saya')}</span>
                        </h1>
                        <p className="mt-2 opacity-90">
                            {getText('Manage your personal work tasks and track progress', 'Kelola tugas kerja pribadi dan lacak progres')}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors"
                    >
                        <Plus className="h-5 w-5" />
                        <span>{getText('Add Task', 'Tambah Tugas')}</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">{getText('Pending', 'Menunggu')}</p>
                            <p className="text-3xl font-bold text-gray-900">{pendingCount}</p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-xl">
                            <Clock className="h-6 w-6 text-yellow-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">{getText('In Progress', 'Dikerjakan')}</p>
                            <p className="text-3xl font-bold text-gray-900">{inProgressCount}</p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <RefreshCw className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">{getText('Completed', 'Selesai')}</p>
                            <p className="text-3xl font-bold text-gray-900">{completedCount}</p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-xl">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder={getText('Search tasks...', 'Cari tugas...')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">{getText('All Status', 'Semua Status')}</option>
                        <option value="pending">{getText('Pending', 'Menunggu')}</option>
                        <option value="in_progress">{getText('In Progress', 'Dikerjakan')}</option>
                        <option value="completed">{getText('Completed', 'Selesai')}</option>
                    </select>
                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">{getText('All Priority', 'Semua Prioritas')}</option>
                        <option value="low">{getText('Low', 'Rendah')}</option>
                        <option value="medium">{getText('Medium', 'Sedang')}</option>
                        <option value="high">{getText('High', 'Tinggi')}</option>
                        <option value="critical">{getText('Critical', 'Kritis')}</option>
                    </select>
                    <button
                        onClick={fetchTasks}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Task List */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <CheckSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('No tasks found', 'Tidak ada tugas')}</h3>
                    <p className="text-gray-600 mb-4">{getText('Add a new task to get started', 'Tambah tugas baru untuk memulai')}</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        <Plus className="h-5 w-5" />
                        <span>{getText('Add Task', 'Tambah Tugas')}</span>
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            className={`bg-white rounded-xl shadow-sm border p-4 transition-all hover:shadow-md ${task.status === 'completed' ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                                }`}
                        >
                            <div className="">
                                <div className="flex items-center gap-3 mb-2">
                                    {getStatusIcon(task.status)}
                                    <h3 className={`font-semibold text-lg ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                        {task.title}
                                    </h3>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(task.priority)}`}>
                                        {task.priority.toUpperCase()}
                                    </span>
                                </div>

                                {task.description && (
                                    <p className="text-gray-600 text-sm mb-2">{task.description}</p>
                                )}

                                {/* Linked Report Details */}
                                {task.report && (
                                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="text-xs font-semibold text-blue-800 uppercase mb-2 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            {getText('Report Details', 'Detail Laporan')}
                                        </div>

                                        {/* Room & Location */}
                                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                                            {task.report.room && (
                                                <div className="flex items-center gap-1 text-blue-700">
                                                    <MapPin className="h-3 w-3" />
                                                    <span className="font-medium">{task.report.room.name}</span>
                                                    <span className="text-blue-500">({task.report.room.code})</span>
                                                </div>
                                            )}
                                            {task.report.location && (
                                                <div className="text-blue-600 text-xs">
                                                    {getText('Location', 'Lokasi')}: {task.report.location}
                                                </div>
                                            )}
                                        </div>

                                        {/* Report Description */}
                                        {task.report.description && (
                                            <div className="text-sm text-blue-900 mb-2 italic">
                                                "{task.report.description}"
                                            </div>
                                        )}

                                        {/* Equipment List from Report */}
                                        {task.report_equipment && task.report_equipment.length > 0 && (
                                            <div className="mt-2">
                                                <div className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                                                    <Package className="h-3 w-3" />
                                                    {getText('Equipment with Issues', 'Peralatan Bermasalah')} ({task.report_equipment.length})
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {task.report_equipment.map((eq: any) => (
                                                        <span
                                                            key={eq.id}
                                                            className={`px-2 py-0.5 rounded text-xs font-medium ${eq.condition === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-800' :
                                                                eq.condition === 'BROKEN' ? 'bg-red-100 text-red-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                                }`}
                                                        >
                                                            {eq.name} ({eq.code})
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Manual Task Details (if not linked report and has room data) */}
                                {!task.report && task.room && (
                                    <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                                        <div className="text-xs font-semibold text-purple-800 uppercase mb-2 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            {getText('Task Details', 'Detail Tugas')}
                                        </div>

                                        {/* Room */}
                                        <div className="flex items-center gap-1 text-sm mb-2 text-purple-700">
                                            <MapPin className="h-3 w-3" />
                                            <span className="font-medium">{task.room.name}</span>
                                            <span className="text-purple-500">({task.room.code})</span>
                                        </div>

                                        {/* Equipment List */}
                                        {task.manual_equipment && task.manual_equipment.length > 0 && (
                                            <div className="mt-2">
                                                <div className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1">
                                                    <Package className="h-3 w-3" />
                                                    {getText('Affected Equipment', 'Peralatan Terkait')} ({task.manual_equipment.length})
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {task.manual_equipment.map((eq: any) => (
                                                        <span
                                                            key={eq.id}
                                                            className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                                                        >
                                                            {eq.name} ({eq.code})
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Assigned By Info */}
                                {task.assigner && (
                                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                        <span>{getText('Assigned by', 'Ditugaskan oleh')}: {task.assigner.full_name}</span>
                                    </div>
                                )}


                                {/* Private Notes Display */}
                                {task.notes && (
                                    <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                        <div className="text-xs font-semibold text-amber-800 uppercase mb-1 flex items-center gap-1">
                                            <FileText className="h-3 w-3" />
                                            {getText('My Notes', 'Catatan Saya')}
                                        </div>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.notes}</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 mb-4">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(task.created_at), 'dd MMM yyyy HH:mm')}
                                    </span>
                                    {task.completed_at && (
                                        <span className="flex items-center gap-1 text-green-600">
                                            <CheckCircle className="h-3 w-3" />
                                            {getText('Completed', 'Selesai')}: {format(new Date(task.completed_at), 'dd MMM yyyy')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100 -mx-4 px-4">
                                {task.status !== 'completed' && (
                                    <>
                                        {/* Edit Button */}
                                        <button onClick={() => { setEditingTaskId(task.id); setFormData({ title: task.title, description: task.description || '', priority: task.priority, room_id: task.room_id || '', equipment_ids: task.equipment_ids || [] }); if (task.room_id) fetchRoomEquipment(task.room_id); setShowEditModal(true); }}
                                            className="flex items-center gap-2 px-4 py-2.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 text-sm font-medium transition-colors">
                                            <Edit className="h-4 w-4" />
                                            <span>{getText('Edit', 'Edit')}</span>
                                        </button>
                                    </>
                                )}

                                {/* Notes Button - Always visible */}
                                <button onClick={() => { setNotesTaskId(task.id); setPrivateNotes(task.notes || ''); setShowNotesModal(true); }}
                                    className="flex items-center gap-2 px-4 py-2.5 text-amber-600 hover:bg-amber-50 rounded-lg border border-amber-200 text-sm font-medium transition-colors">
                                    <FileText className="h-4 w-4" />
                                    <span>{getText('Notes', 'Notes')}</span>
                                </button>

                                {task.status !== 'completed' && (
                                    <>
                                        {/* Reply Button - For tasks with report */}
                                        {task.report_id && task.status === 'pending' && (
                                            <button onClick={() => { setMessagingTaskId(task.id); fetchTaskComments(task.report_id!); setShowMessagingModal(true); }}
                                                className="flex items-center gap-2 px-4 py-2.5 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 text-sm font-medium transition-colors">
                                                <MessageSquare className="h-4 w-4" />
                                                <span>{getText('Reply', 'Balas')}</span>
                                            </button>
                                        )}

                                        {/* Complete Button - Wide, center */}
                                        <button onClick={async () => { if (task.report_id) { setResolvingTaskId(task.id); } else { const r = await Swal.fire({ title: getText('Complete?', 'Selesaikan?'), icon: 'question', showCancelButton: true, confirmButtonText: getText('Yes', 'Ya') }); if (r.isConfirmed) handleUpdateStatus(task.id, 'completed'); } }}
                                            className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-green-500 text-white hover:bg-green-600 rounded-lg text-sm font-semibold transition-colors shadow-sm">
                                            <CheckCircle className="h-4 w-4" />
                                            <span>{getText('Complete', 'Complete')}</span>
                                        </button>
                                    </>
                                )}

                                {/* Delete Button */}
                                <button onClick={() => handleDeleteTask(task.id)}
                                    className="flex items-center gap-2 px-4 py-2.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-200 text-sm font-medium transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                    <span>{getText('Delete', 'Delete')}</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )
            }

            {/* Add Task Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Plus className="h-6 w-6" />
                                    {getText('Add New Task', 'Tambah Tugas Baru')}
                                </h2>
                                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                                    <X className="h-5 w-5 text-white" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Title', 'Judul')} *</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder={getText('Enter task title...', 'Masukkan judul tugas...')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Description', 'Deskripsi')}</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder={getText('Enter description...', 'Masukkan deskripsi...')}
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Priority', 'Prioritas')}</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="low">{getText('Low', 'Rendah')}</option>
                                        <option value="medium">{getText('Medium', 'Sedang')}</option>
                                        <option value="high">{getText('High', 'Tinggi')}</option>
                                        <option value="critical">{getText('Critical', 'Kritis')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Room', 'Ruangan')}</label>
                                    <Select
                                        value={rooms.find(r => r.id === formData.room_id) ? {
                                            value: formData.room_id,
                                            label: `${rooms.find(r => r.id === formData.room_id)?.name} (${rooms.find(r => r.id === formData.room_id)?.code})`
                                        } : null}
                                        onChange={(selectedOption: any) => {
                                            const roomId = selectedOption ? selectedOption.value : '';
                                            setFormData({ ...formData, room_id: roomId, equipment_ids: [] });
                                            if (roomId) fetchRoomEquipment(roomId);
                                            else setRoomEquipment([]);
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
                                                    borderColor: '#a855f7'
                                                },
                                                boxShadow: 'none',
                                                borderRadius: '0.5rem',
                                                padding: '2px'
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                backgroundColor: state.isSelected ? '#9333ea' : state.isFocused ? '#f3e8ff' : 'white',
                                                color: state.isSelected ? 'white' : 'black',
                                            })
                                        }}
                                    />
                                </div>

                                {formData.room_id && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {getText('Equipment (All Conditions)', 'Peralatan (Semua Kondisi)')}
                                        </label>
                                        {roomEquipment.length > 0 ? (
                                            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2 bg-gray-50">
                                                {roomEquipment.map((eq) => (
                                                    <label key={eq.id} className="flex items-center p-2 rounded hover:bg-white transition-colors cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.equipment_ids.includes(eq.id)}
                                                            onChange={(e) => {
                                                                const newIds = e.target.checked
                                                                    ? [...formData.equipment_ids, eq.id]
                                                                    : formData.equipment_ids.filter(id => id !== eq.id);
                                                                setFormData({ ...formData, equipment_ids: newIds });
                                                            }}
                                                            className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                        />
                                                        <div className="ml-3 flex flex-col">
                                                            <span className="text-sm font-medium text-gray-700">{eq.name}</span>
                                                            <span className="text-xs text-gray-500">{eq.code} • {eq.condition}</span>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-gray-500 italic p-2 bg-gray-50 rounded-lg border border-gray-200">
                                                {getText('No equipment found in database for this room', 'Tidak ada peralatan ditemukan di database untuk ruangan ini')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    {getText('Cancel', 'Batal')}
                                </button>
                                <button
                                    onClick={handleAddTask}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    {getText('Add Task', 'Tambah Tugas')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Resolve Task Modal */}
            {
                resolvingTaskId && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-600 to-teal-600 rounded-t-2xl">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <CheckCircle className="h-6 w-6" />
                                    {getText('Resolve Task', 'Selesaikan Tugas')}
                                </h2>
                                <button
                                    onClick={() => { setResolvingTaskId(null); setResolveComment(''); }}
                                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X className="h-5 w-5 text-white" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {getText('Follow Up Note', 'Catatan Tindak Lanjut')} <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={resolveComment}
                                        onChange={(e) => setResolveComment(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[120px]"
                                        placeholder={getText('Describe what was done to resolve this task...', 'Jelaskan apa yang dilakukan untuk menyelesaikan tugas ini...')}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        {getText('This comment will be added to the report history.', 'Komentar ini akan ditambahkan ke riwayat laporan.')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
                                <button
                                    onClick={() => { setResolvingTaskId(null); setResolveComment(''); }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    {getText('Cancel', 'Batal')}
                                </button>
                                <button
                                    onClick={() => handleResolveWithComment(resolvingTaskId)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!resolveComment.trim()}
                                >
                                    {getText('Resolve & Complete', 'Selesaikan & Tutup')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Task Modal */}
            {
                showEditModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2"><Edit className="h-6 w-6" />{getText('Edit Task', 'Edit Tugas')}</h2>
                                <button onClick={() => { setShowEditModal(false); setEditingTaskId(null); }} className="p-2 hover:bg-white/20 rounded-lg"><X className="h-5 w-5 text-white" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Title', 'Judul')} *</label>
                                    <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Description', 'Deskripsi')}</label>
                                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[100px]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText('Priority', 'Prioritas')}</label>
                                    <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                                        <option value="low">{getText('Low', 'Rendah')}</option>
                                        <option value="medium">{getText('Medium', 'Sedang')}</option>
                                        <option value="high">{getText('High', 'Tinggi')}</option>
                                        <option value="critical">{getText('Critical', 'Kritis')}</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 p-6 border-t">
                                <button onClick={() => { setShowEditModal(false); setEditingTaskId(null); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">{getText('Cancel', 'Batal')}</button>
                                <button onClick={handleEditTask} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{getText('Save Changes', 'Simpan Perubahan')}</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Private Notes Modal */}
            {
                showNotesModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="h-6 w-6" />{getText('Private Notes', 'Catatan Pribadi')}</h2>
                                <button onClick={() => { setShowNotesModal(false); setNotesTaskId(null); }} className="p-2 hover:bg-white/20 rounded-lg"><X className="h-5 w-5 text-white" /></button>
                            </div>
                            <div className="p-6">
                                <textarea value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 min-h-[150px]" placeholder={getText('Add your private notes here...', 'Tambahkan catatan pribadi Anda di sini...')} />
                                <p className="mt-2 text-xs text-gray-500">{getText('These notes are only visible to you', 'Catatan ini hanya terlihat oleh Anda')}</p>
                            </div>
                            <div className="flex justify-end gap-3 p-6 border-t">
                                <button onClick={() => { setShowNotesModal(false); setNotesTaskId(null); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">{getText('Cancel', 'Batal')}</button>
                                <button onClick={handleSaveNotes} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">{getText('Save Notes', 'Simpan Catatan')}</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Messaging Modal */}
            {
                showMessagingModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2"><MessageSquare className="h-6 w-6" />{getText('Reply to Report', 'Balas Laporan')}</h2>
                                <button onClick={() => { setShowMessagingModal(false); setMessagingTaskId(null); setNewMessage(''); }} className="p-2 hover:bg-white/20 rounded-lg"><X className="h-5 w-5 text-white" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[400px]">
                                {taskComments.length === 0 ? (
                                    <div className="text-center text-gray-500 py-8"><MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>{getText('No messages yet', 'Belum ada pesan')}</p></div>
                                ) : (
                                    taskComments.map((comment) => (
                                        <div key={comment.id} className={`p-4 rounded-lg ${comment.user_id === profile?.id ? 'bg-indigo-50 ml-8' : 'bg-gray-100 mr-8'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-medium text-sm">{comment.user?.full_name || 'Unknown'}</span>
                                                <span className="text-xs text-gray-500">{format(new Date(comment.created_at), 'dd MMM yyyy HH:mm')}</span>
                                            </div>
                                            <p className="text-gray-700">{comment.comment}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-6 border-t">
                                <div className="flex gap-3">
                                    <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[80px]" placeholder={getText('Type your message...', 'Ketik pesan Anda...')} />
                                    <button onClick={handleSendMessage} disabled={!newMessage.trim()} className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"><Send className="h-5 w-5" />{getText('Send', 'Kirim')}</button>
                                </div>
                                <p className="mt-2 text-xs text-gray-500">{getText('Sending a message will mark this task as In Progress', 'Mengirim pesan akan mengubah status tugas menjadi Dikerjakan')}</p>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default TechnicianTodoList;
