import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Building, Plus, Search, Edit, Trash2, Eye, Users, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Zap, Tv2, Speaker, Presentation, Mic, AirVent, Loader2, Hash, DoorClosed, Calendar as CalendarIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Room, Department, LectureSchedule } from '../types';
import toast from 'react-hot-toast';
import { format, parse } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

interface Equipment {
    id: string;
    name: string;
    category: string;
    icon_name?: string;
}

interface RoomEquipment {
    room_id: string;
    equipment_id: string;
}

const roomSchema = z.object({
    name: z.string().min(2, 'Room name must be at least 2 characters'),
    code: z.string().min(2, 'Room code must be at least 2 characters'),
    capacity: z.number().min(1, 'Capacity must be at least 1'),
    department_id: z.string().optional().nullable(),
});
type RoomForm = z.infer<typeof roomSchema>;

interface RoomWithDetails extends Room {
    department: Department | null;
    status: 'In Use' | 'Scheduled' | 'Available' | 'Loading';
}

const iconMap: { [key: string]: React.FC<any> } = {
    Zap, Tv2, Speaker, Presentation, Mic, AirVent, Edit
};

const RoomManagement: React.FC = () => {
    const { profile } = useAuth();
    const [allRooms, setAllRooms] = useState<RoomWithDetails[]>([]);
    const [displayedRooms, setDisplayedRooms] = useState<RoomWithDetails[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingRoom, setEditingRoom] = useState<RoomWithDetails | null>(null);
    const [showRoomDetail, setShowRoomDetail] = useState<RoomWithDetails | null>(null);
    const [roomSchedules, setRoomSchedules] = useState<LectureSchedule[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [masterEquipmentList, setMasterEquipmentList] = useState<Equipment[]>([]);
    const [roomEquipmentLinks, setRoomEquipmentLinks] = useState<RoomEquipment[]>([]);
    const [isUpdatingEquipment, setIsUpdatingEquipment] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    
    const dayNamesEnglish = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayNamesIndonesian = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const getIndonesianDay = (englishDay: string) => dayNamesIndonesian[dayNamesEnglish.indexOf(englishDay)] || 'Senin';

    const [searchDay, setSearchDay] = useState(format(new Date(), 'EEEE'));
    const [searchStartTime, setSearchStartTime] = useState('07:30');
    const [searchEndTime, setSearchEndTime] = useState('17:00');
    const [isSearchMode, setIsSearchMode] = useState(false);

    const form = useForm<RoomForm>({ resolver: zodResolver(roomSchema) });
    const normalizeRoomName = (name: string): string => name ? name.toLowerCase().replace(/[\s.&-]/g, '') : '';

    const refreshTodayStatus = useCallback(async (isManual = false) => {
        if (isRefreshing && isManual) return;
        if (!isManual) {
             if(allRooms.length === 0) setLoading(true);
        } else {
            setIsRefreshing(true);
        }
        
        try {
            const now = new Date();
            const todayDayName = format(now, 'EEEE', { locale: localeID });
            const { data: roomsData, error: roomsError } = await supabase.from('rooms').select(`*, department:departments(*)`).order('name', { ascending: true });
            if (roomsError) throw roomsError;

            const { data: schedulesData, error: schedulesError } = await supabase.from('lecture_schedules').select('room, start_time, end_time, day').eq('day', todayDayName);
            if (schedulesError) throw schedulesError;

            const scheduleMap = new Map<string, LectureSchedule[]>();
            schedulesData.forEach(schedule => {
                if (schedule.room) {
                    const normalizedName = normalizeRoomName(schedule.room);
                    if (!scheduleMap.has(normalizedName)) scheduleMap.set(normalizedName, []);
                    scheduleMap.get(normalizedName)?.push(schedule);
                }
            });
            
            const roomsWithStatus = roomsData.map(room => {
                const normalizedRoomName = normalizeRoomName(room.name);
                const roomSchedules = scheduleMap.get(normalizedRoomName) || [];
                let status: RoomWithDetails['status'] = 'Available';
                if (roomSchedules.length > 0) {
                    const isCurrentlyInUse = roomSchedules.some(schedule => {
                        if (!schedule.start_time || !schedule.end_time) return false;
                        try {
                            const startTime = parse(schedule.start_time, 'HH:mm:ss', new Date());
                            const endTime = parse(schedule.end_time, 'HH:mm:ss', new Date());
                            return now >= startTime && now <= endTime;
                        } catch (e) { return false; }
                    });
                    status = isCurrentlyInUse ? 'In Use' : 'Scheduled';
                }
                return { ...room, department: room.department, status };
            });

            setAllRooms(roomsWithStatus as RoomWithDetails[]);
            if (!isSearchMode) {
                 setDisplayedRooms(roomsWithStatus as RoomWithDetails[]);
            }
            if (isManual) toast.success('Room statuses updated for today!');
        } catch (error) {
            console.error('Error refreshing today status:', error);
            if(isManual) toast.error('Failed to refresh statuses.');
        } finally {
            setIsRefreshing(false);
            setLoading(false);
        }
    }, [isSearchMode, allRooms.length]);

    const findAvailableRooms = async () => {
        if (!searchDay || !searchStartTime || !searchEndTime) { toast.error("Please complete all search filters."); return; }
        setIsRefreshing(true);
        setLoading(true);
        setIsSearchMode(true);
        try {
            const dayToFetch = getIndonesianDay(searchDay);
            const searchStart = parse(searchStartTime, 'HH:mm', new Date());
            const searchEnd = parse(searchEndTime, 'HH:mm', new Date());
            
            const { data: schedulesData, error: schedulesError } = await supabase.from('lecture_schedules').select('room, start_time, end_time').eq('day', dayToFetch);
            if (schedulesError) throw schedulesError;

            const busyRoomNames = new Set<string>();
            schedulesData.forEach(schedule => {
                if(schedule.room && schedule.start_time && schedule.end_time) {
                    const scheduleStart = parse(schedule.start_time, 'HH:mm:ss', new Date());
                    const scheduleEnd = parse(schedule.end_time, 'HH:mm:ss', new Date());
                    if(scheduleStart < searchEnd && scheduleEnd > searchStart) {
                         busyRoomNames.add(normalizeRoomName(schedule.room));
                    }
                }
            });
            
            const availableRooms = allRooms.filter(room => !busyRoomNames.has(normalizeRoomName(room.name)));
            const availableRoomsWithStatus = availableRooms.map(r => ({...r, status: 'Available' as 'Available'}));

            setDisplayedRooms(availableRoomsWithStatus as RoomWithDetails[]);
            toast.success(`Found ${availableRooms.length} available rooms.`);
        } catch (error) {
             console.error('Error searching for available rooms:', error);
             toast.error('Failed to perform search.');
        } finally {
            setIsRefreshing(false);
            setLoading(false);
        }
    };

    const handleManualRefresh = () => {
        setIsSearchMode(false);
        refreshTodayStatus(true);
    };

    useEffect(() => {
        if (profile) {
            refreshTodayStatus();
            fetchDepartments();
            fetchMasterEquipment();

            const interval = setInterval(() => {
                if (!isSearchMode) {
                    refreshTodayStatus();
                }
            }, 5 * 60 * 1000);

            return () => clearInterval(interval);
        }
    }, [profile, isSearchMode, refreshTodayStatus]);

    const fetchDepartments = async () => { try { const { data, error } = await supabase.from('departments').select('id, name').order('name'); if (error) throw error; setDepartments(data || []); } catch (error: any) { toast.error('Failed to load departments'); } };
    const fetchMasterEquipment = async () => { const { data, error } = await supabase.from('equipment').select('*').order('name'); if (error) toast.error("Could not fetch equipment list."); else setMasterEquipmentList(data || []); };
    const fetchSchedulesForRoom = async (roomName: string, day: string) => { setLoadingSchedules(true); try { const dayToFetch = getIndonesianDay(day); const { data, error } = await supabase.from('lecture_schedules').select('*').eq('day', dayToFetch).eq('room', roomName).order('start_time'); if (error) throw error; setRoomSchedules(data || []); } catch (error: any) { toast.error("Failed to load schedule for this room."); } finally { setLoadingSchedules(false); } };
    const fetchRoomEquipment = async (roomId: string) => { const { data, error } = await supabase.from('room_equipment').select('*').eq('room_id', roomId); if (error) toast.error("Could not fetch room's equipment."); else setRoomEquipmentLinks(data || []); };
    
    useEffect(() => {
        if (showRoomDetail) {
            fetchSchedulesForRoom(showRoomDetail.name, searchDay);
            fetchRoomEquipment(showRoomDetail.id);
        }
    }, [showRoomDetail, searchDay]);

    const handleEquipmentChange = async (equipmentId: string, isChecked: boolean) => { if (!showRoomDetail) return; setIsUpdatingEquipment(equipmentId); if (isChecked) { const { error } = await supabase.from('room_equipment').insert({ room_id: showRoomDetail.id, equipment_id: equipmentId }); if (error) { toast.error('Failed to add equipment.'); } else { toast.success('Equipment added.'); } } else { const { error } = await supabase.from('room_equipment').delete().eq('room_id', showRoomDetail.id).eq('equipment_id', equipmentId); if (error) { toast.error('Failed to remove equipment.'); } else { toast.success('Equipment removed.'); } } await fetchRoomEquipment(showRoomDetail.id); setIsUpdatingEquipment(null); };
    const onSubmit = async (data: RoomForm) => { try { setLoading(true); const roomData = { name: data.name, code: data.code, capacity: data.capacity, department_id: data.department_id || null, }; if (editingRoom) { const { error } = await supabase.from('rooms').update(roomData).eq('id', editingRoom.id); if (error) throw error; toast.success('Room updated successfully!'); } else { const { error } = await supabase.from('rooms').insert(roomData); if (error) throw error; toast.success('Room created successfully!'); } setShowForm(false); setEditingRoom(null); form.reset(); handleManualRefresh(); } catch (error: any) { console.error('Error saving room:', error); toast.error(error.message || 'Failed to save room'); } finally { setLoading(false); } };
    const handleEdit = (room: RoomWithDetails) => { setEditingRoom(room); form.reset({ name: room.name, code: room.code, capacity: room.capacity, department_id: room.department_id, }); setShowForm(true); };
    const handleDelete = async (roomId: string) => { if (!confirm('Are you sure you want to delete this room?')) return; try { const { error } = await supabase.from('rooms').delete().eq('id', roomId); if (error) throw error; toast.success('Room deleted successfully!'); handleManualRefresh(); } catch (error: any) { console.error('Error deleting room:', error); toast.error(error.message || 'Failed to delete room'); } };
    
    const filteredRooms = useMemo(() => {
        return displayedRooms.filter(room => {
            const matchesSearch = (room.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (room.code?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || room.status.toLowerCase() === filterStatus.toLowerCase();
            return matchesSearch && matchesStatus;
        });
    }, [displayedRooms, searchTerm, filterStatus]);

    const getStatusColor = (status: RoomWithDetails['status']) => { switch (status) { case 'In Use': return 'bg-red-100 text-red-800'; case 'Scheduled': return 'bg-yellow-100 text-yellow-800'; case 'Available': return 'bg-green-100 text-green-800'; default: return 'bg-gray-100 text-gray-800'; } };
    
    if (loading) { 
        return <div className="flex justify-center items-center h-screen"><RefreshCw className="h-12 w-12 animate-spin text-blue-600" /></div>; 
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white"> <h1 className="text-3xl font-bold">Room Status & Availability</h1> <p className="mt-2 opacity-90">View real-time room status or search for future availability.</p> </div>
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
                 <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Find Available Rooms</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div><label className="block text-sm font-medium text-gray-700">Day</label><select value={searchDay} onChange={(e) => setSearchDay(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">{dayNamesEnglish.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                        <div><label className="block text-sm font-medium text-gray-700">Start Time</label><input type="time" value={searchStartTime} onChange={(e) => setSearchStartTime(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">End Time</label><input type="time" value={searchEndTime} onChange={(e) => setSearchEndTime(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/></div>
                        <button onClick={findAvailableRooms} disabled={isRefreshing} className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 h-10">{isRefreshing && isSearchMode ? <Loader2 className="h-5 w-5 animate-spin"/> : <Search className="h-5 w-5" />} <span>Search</span></button>
                    </div>
                </div>
                <div className="border-t pt-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-wrap gap-3"> <button onClick={() => { setEditingRoom(null); form.reset(); setShowForm(true); }} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"> <Plus className="h-5 w-5" /> <span>Add Room</span> </button> </div>
                    <div className="flex items-center space-x-3">
                        <div className="relative"> <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /> <input type="text" placeholder="Filter results by name/code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64"/></div>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg"><option value="all">All Statuses</option><option value="Available">Available</option><option value="Scheduled">Scheduled</option><option value="In Use">In Use</option></select>
                        <button onClick={handleManualRefresh} disabled={isRefreshing} className="p-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh to Today's Status"> <RefreshCw className={`h-5 w-5 ${isRefreshing && !isSearchMode ? 'animate-spin' : ''}`} /> </button>
                        <div className="flex border border-gray-300 rounded-lg overflow-hidden"> <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><Grid className="h-5 w-5" /></button> <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><List className="h-5 w-5" /></button> </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {viewMode === 'grid' ? ( 
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"> 
                        {filteredRooms.map((room) => ( 
                            <div key={room.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow group relative"> 
                                <div className={`absolute top-2 right-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>{room.status}</div> 
                                <div className="flex flex-col h-full"> 
                                    <div className="flex-grow"> 
                                        <h3 className="font-semibold text-gray-900 text-lg mt-8">{room.name}</h3> 
                                        <p className="text-sm text-gray-600">{room.code}</p> 
                                        <div className="flex items-center text-sm text-gray-600 mt-2"><Users className="h-4 w-4 mr-1"/><span>{room.capacity} seats</span></div> 
                                        <div className="flex items-center text-sm text-gray-600"><MapPin className="h-4 w-4 mr-1"/><span>{room.department?.name || 'General'}</span></div> 
                                    </div> 
                                    <div className="flex items-center justify-end pt-4 mt-4 border-t border-gray-100 space-x-1"> 
                                        <button onClick={() => setShowRoomDetail(room)} className="p-1 text-gray-500 hover:text-indigo-600"><Eye className="h-4 w-4" /></button> 
                                        <button onClick={() => handleEdit(room)} className="p-1 text-gray-500 hover:text-blue-600"><Edit className="h-4 w-4" /></button> 
                                        <button onClick={() => handleDelete(room.id)} className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button> 
                                    </div> 
                                </div> 
                            </div> 
                        ))} 
                    </div> 
                ) : ( 
                    <div className="space-y-3"> 
                        {filteredRooms.map((room) => ( 
                            <div key={room.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                                <div className="flex items-center space-x-4">
                                    <div className={`w-3 h-12 rounded-full ${getStatusColor(room.status).split(' ')[0]}`}></div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{room.name}</h3>
                                        <p className="text-sm text-gray-600">{room.code} • {room.department?.name || 'General'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-6">
                                    <div className="text-center">
                                        <div className="text-sm font-medium text-gray-900">{room.capacity}</div>
                                        <div className="text-xs text-gray-500">Capacity</div>
                                    </div>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(room.status)}`}>{room.status}</span>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => setShowRoomDetail(room)} className="p-2 text-gray-600 hover:text-indigo-600"><Eye className="h-4 w-4" /></button>
                                        <button onClick={() => handleEdit(room)} className="p-2 text-gray-600 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete(room.id)} className="p-2 text-gray-600 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {filteredRooms.length === 0 && !loading && (<div className="text-center py-12"><Building className="h-12 w-12 text-gray-400 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">No Rooms Found</h3><p className="text-gray-600">Try adjusting your filter criteria.</p></div>)}
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">{editingRoom ? 'Edit Room' : 'Add New Room'}</h3>
                                <button onClick={() => { setShowForm(false); setEditingRoom(null); form.reset(); }} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                            </div>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <div><label className="block text-sm font-medium text-gray-700">Name *</label><input {...form.register('name')} type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>{form.formState.errors.name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>}</div>
                                <div><label className="block text-sm font-medium text-gray-700">Code *</label><input {...form.register('code')} type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>{form.formState.errors.code && <p className="text-red-500 text-xs mt-1">{form.formState.errors.code.message}</p>}</div>
                                <div><label className="block text-sm font-medium text-gray-700">Capacity *</label><input {...form.register('capacity', {valueAsNumber: true})} type="number" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>{form.formState.errors.capacity && <p className="text-red-500 text-xs mt-1">{form.formState.errors.capacity.message}</p>}</div>
                                <div><label className="block text-sm font-medium text-gray-700">Department</label><select {...form.register('department_id')} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">No Department / General</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                                <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md">Cancel</button><button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">{loading ? 'Saving...' : 'Save Room'}</button></div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showRoomDetail && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
                    <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
                        <div className="p-6 border-b flex justify-between items-center">
                            <div className='flex items-center space-x-3'>
                               <div className='bg-blue-100 p-2 rounded-lg'>
                                <DoorClosed className="h-6 w-6 text-blue-600"/>
                               </div>
                               <div>
                                 <h2 className="text-2xl font-bold text-gray-900">{showRoomDetail.name}</h2>
                                 <p className="text-sm text-gray-500">{showRoomDetail.department?.name || 'General Use'}</p>
                               </div>
                            </div>
                            <button onClick={() => setShowRoomDetail(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"><X/></button>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-6 overflow-y-auto">
                            <div className="lg:col-span-2 space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Room Information</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="bg-white p-3 rounded-lg border flex items-center space-x-3">
                                            <Hash className="h-5 w-5 text-gray-400"/>
                                            <div>
                                                <p className="text-gray-500">Code</p>
                                                <p className="font-semibold text-gray-800">{showRoomDetail.code}</p>
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border flex items-center space-x-3">
                                            <Users className="h-5 w-5 text-gray-400"/>
                                            <div>
                                                <p className="text-gray-500">Capacity</p>
                                                <p className="font-semibold text-gray-800">{showRoomDetail.capacity} seats</p>
                                            </div>
                                        </div>
                                        <div className={`bg-white p-3 rounded-lg border flex items-center space-x-3 col-span-2`}>
                                            {showRoomDetail.status === 'Available' ? 
                                                <CheckCircle className="h-5 w-5 text-green-500"/> : 
                                                <AlertCircle className="h-5 w-5 text-red-500"/>
                                            }
                                            <div>
                                                <p className="text-gray-500">Current Status</p>
                                                <p className={`font-semibold ${showRoomDetail.status === 'Available' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {showRoomDetail.status === 'Available' ? 'FREE' : 'BOOKED'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Equipment</h3>
                                    <div className="space-y-2">
                                        {masterEquipmentList.map((eq) => {
                                            const Icon = iconMap[eq.icon_name || 'Zap'] || Zap;
                                            const isChecked = roomEquipmentLinks.some(link => link.equipment_id === eq.id);
                                            const isProcessing = isUpdatingEquipment === eq.id;
                                            return (
                                                <label key={eq.id} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                                                    <div className="flex items-center space-x-3">
                                                        <Icon className="h-5 w-5 text-gray-500" />
                                                        <div>
                                                            <span className="font-medium text-gray-800">{eq.name}</span>
                                                            <span className="block text-xs text-gray-500">{eq.category}</span>
                                                        </div>
                                                    </div>
                                                    {isProcessing ? 
                                                        <Loader2 className="h-5 w-5 animate-spin text-gray-400"/> : 
                                                        <input type="checkbox" checked={isChecked} onChange={(e) => handleEquipmentChange(eq.id, e.target.checked)} className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"/>
                                                    }
                                                </label>
                                            );
                                        })}
                                        {masterEquipmentList.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No master equipment data found.</p>}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="lg:col-span-3">
                                <h3 className="text-lg font-semibold text-gray-800 mb-3">Schedule for {searchDay}</h3>
                                <div className="bg-white p-4 rounded-lg border h-full">
                                    {loadingSchedules ? 
                                        <div className="flex justify-center items-center h-full"><RefreshCw className="animate-spin h-6 w-6 text-gray-500"/></div> : 
                                        roomSchedules.length > 0 ? (
                                            <ul className="space-y-3">
                                                {roomSchedules.map(schedule => (
                                                    <li key={schedule.id} className="p-4 bg-gray-50/80 rounded-lg border border-gray-200/80">
                                                        <p className="font-semibold text-gray-900">{schedule.course_name}</p>
                                                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                                            <div className="flex items-center space-x-1.5">
                                                                <Clock className="h-4 w-4"/>
                                                                <span>{schedule.start_time?.substring(0,5)} - {schedule.end_time?.substring(0,5)}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-1.5">
                                                                <Users className="h-4 w-4"/>
                                                                <span>{schedule.class}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-2">Prodi: {schedule.subject_study}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="flex flex-col justify-center items-center h-full text-center text-gray-500">
                                                <CalendarIcon className="h-10 w-10 mb-2"/>
                                                <p className="font-medium">No schedules</p>
                                                <p className="text-sm">This room is free on the selected day.</p>
                                            </div>
                                        )
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomManagement;