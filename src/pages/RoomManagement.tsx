import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Building, Plus, Search, Edit, Trash2, Eye, Users, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Loader2, Hash, DoorClosed, Calendar as CalendarIcon, Wrench, ChevronDown, BookOpen, GraduationCap, UserCheck, UserPlus, UserMinus, AlertTriangle, Filter, ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Room, Department, Equipment } from '../types';
import toast from 'react-hot-toast';
import { format, parse, addDays } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { useRoomData } from '../hooks/useRoomData';
import { useRealTimeRoomUpdates } from '../hooks/useRealTimeRoomUpdates';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { EnhancedRoomStatus } from '../stores/roomStore';

// ========================
// TIMEZONE UTILITY FUNCTIONS
// ========================
const convertLocalToUTC = (localDateTimeString: string) => {
  const localDate = new Date(localDateTimeString);
  return localDate.toISOString();
};

const convertUTCToLocal = (utcTimeString: string) => {
  return new Date(utcTimeString);
};

const getLocalDateString = (date = new Date()) => {
  return format(date, 'yyyy-MM-dd');
};

const roomSchema = z.object({
    name: z.string().min(2, 'Room name must be at least 2 characters'),
    code: z.string().min(2, 'Room code must be at least 2 characters'),
    capacity: z.number().min(1, 'Capacity must be at least 1'),
    department_id: z.string().optional().nullable(),
});
type RoomForm = z.infer<typeof roomSchema>;

interface RoomUser {
    id: string;
    user_id: string;
    room_id: string;
    assigned_at: string;
    user: {
        id: string;
        full_name: string;
        identity_number: string;
        role: string;
        department?: any;
    };
}

// Combined schedule interface untuk semua jenis jadwal
interface CombinedSchedule {
    id: string;
    type: 'lecture' | 'exam' | 'session' | 'booking';
    start_time: string;
    end_time: string;
    title: string;
    subtitle?: string;
    description?: string;
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
}

const RoomManagement: React.FC = () => {
    const { profile } = useAuth();
    
    // ✅ NEW: Use optimized room data hook
    const [targetDate, setTargetDate] = useState(getLocalDateString());
    const [searchStartTime, setSearchStartTime] = useState('07:30');
    const [searchEndTime, setSearchEndTime] = useState('17:00');
    const [isSearchMode, setIsSearchMode] = useState(false);
    
    const { rooms: optimizedRooms, loading: roomsLoading, error: roomsError, fetchRoomData, cacheStats } = useRoomData(targetDate);
    
    // ✅ NEW: Real-time updates
    useRealTimeRoomUpdates(targetDate);
    usePerformanceMonitor();
    
    // Legacy states (keeping for compatibility)
    const [allRooms, setAllRooms] = useState<EnhancedRoomStatus[]>([]);
    const [displayedRooms, setDisplayedRooms] = useState<EnhancedRoomStatus[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingRoom, setEditingRoom] = useState<EnhancedRoomStatus | null>(null);
    const [showRoomDetail, setShowRoomDetail] = useState<EnhancedRoomStatus | null>(null);
    
    // Schedule states
    const [combinedSchedules, setCombinedSchedules] = useState<CombinedSchedule[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    
    // Equipment and users states
    const [selectedRoomEquipment, setSelectedRoomEquipment] = useState<Equipment[]>([]);
    const [loadingEquipment, setLoadingEquipment] = useState(false);
    const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
    const [loadingRoomUsers, setLoadingRoomUsers] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [showAssignUserModal, setShowAssignUserModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showInUse, setShowInUse] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showAvailabilitySearch, setShowAvailabilitySearch] = useState(false);
    
    // Room name autocomplete states
    const [roomNameSuggestions, setRoomNameSuggestions] = useState<string[]>([]);
    const [roomNameInput, setRoomNameInput] = useState('');
    const [showRoomSuggestions, setShowRoomSuggestions] = useState(false);
    const [filteredRoomSuggestions, setFilteredRoomSuggestions] = useState<string[]>([]);
    
    const [showUnassignModal, setShowUnassignModal] = useState(false);
    const [userToUnassign, setUserToUnassign] = useState<{id: string, name: string} | null>(null);

    // Refs untuk dropdown manual DOM manipulation
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const userDisplayRef = useRef<HTMLInputElement>(null);

    const form = useForm<RoomForm>({ resolver: zodResolver(roomSchema) });

    // ✅ NEW: Optimized room status logic with timezone handling (from BookRoom)
    const getOptimizedRoomStatus = useCallback((room: EnhancedRoomStatus) => {
        // 1. Check if room is disabled
        if (!room.is_available) {
            return {
                status: 'Unavailable' as const,
                reason: 'Ruangan dinonaktifkan untuk pemesanan',
                color: 'bg-gray-100 text-gray-800 border-gray-200'
            };
        }

        // 2. Check if currently in use (timezone aware)
        const isToday = targetDate === getLocalDateString();
        if (isToday && room.currentBooking) {
            const now = new Date();
            const bookingStart = convertUTCToLocal(room.currentBooking.start_time);
            const bookingEnd = convertUTCToLocal(room.currentBooking.end_time);
            
            if (now >= bookingStart && now <= bookingEnd) {
                return {
                    status: 'In Use' as const,
                    reason: `Sedang digunakan oleh ${room.currentBooking.user?.full_name || 'Tidak diketahui'}`,
                    color: 'bg-red-100 text-red-800 border-red-200',
                    detail: room.currentBooking
                };
            }
        }

        // 3. Check conflicts with search time (timezone aware)
        if (isSearchMode && searchStartTime && searchEndTime) {
            const searchStart = new Date(`${targetDate}T${searchStartTime}:00`);
            const searchEnd = new Date(`${targetDate}T${searchEndTime}:00`);

            if (Array.isArray(room.targetDateBookings) && room.targetDateBookings.length > 0) {
                for (const booking of room.targetDateBookings) {
                    const existingStart = convertUTCToLocal(booking.start_time);
                    const existingEnd = convertUTCToLocal(booking.end_time);
                    
                    // Overlap condition with correct timezone
                    if (searchStart < existingEnd && searchEnd > existingStart) {
                        return {
                            status: 'Conflict' as const,
                            reason: `Bertabrakan dengan jadwal pukul ${booking.start_time_local} - ${booking.end_time_local}`,
                            color: 'bg-orange-100 text-orange-800 border-orange-200'
                        };
                    }
                }
            }
        }
        
        // 4. Check if has other scheduled content for the day
        const hasScheduledContent =
            (Array.isArray(room.scheduleDetails?.lectures) && room.scheduleDetails.lectures.length > 0) ||
            (Array.isArray(room.scheduleDetails?.exams) && room.scheduleDetails.exams.length > 0) ||
            (Array.isArray(room.scheduleDetails?.sessions) && room.scheduleDetails.sessions.length > 0) ||
            (Array.isArray(room.targetDateBookings) && room.targetDateBookings.length > 0);

        if (hasScheduledContent) {
            return {
                status: 'Scheduled' as const,
                reason: 'Ruangan memiliki aktivitas terjadwal',
                color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                scheduleCount: (room.scheduleDetails?.lectures?.length || 0) + 
                            (room.scheduleDetails?.exams?.length || 0) + 
                            (room.scheduleDetails?.sessions?.length || 0) + 
                            (room.targetDateBookings?.length || 0)
            };
        }

        // 5. If passes all checks, it's available
        return {
            status: 'Available' as const,
            reason: 'Ruangan bebas dan tersedia untuk dipesan',
            color: 'bg-green-100 text-green-800 border-green-200'
        };
    }, [targetDate, searchStartTime, searchEndTime, isSearchMode]);

    // ✅ NEW: Availability search function (from BookRoom)
    const findAvailableRooms = async () => {
        if (!searchStartTime || !searchEndTime) { 
            toast.error("Please complete all search filters."); 
            return; 
        }
        
        setIsRefreshing(true);
        setIsSearchMode(true);
        
        try {
            console.log(`🗓️ Search for ${targetDate} from ${searchStartTime} to ${searchEndTime}`);
            
            // Force refresh data for the target date
            await fetchRoomData(targetDate, true);
            
            toast.success(
                `Found ${optimizedRooms.length} rooms for ${format(new Date(targetDate), 'MMM dd, yyyy')} ${searchStartTime}-${searchEndTime}`
            );
            
        } catch (error) {
            console.error('Error searching for available rooms:', error);
            toast.error('Failed to perform search.');
        } finally {
            setIsRefreshing(false);
        }
    };

    // ✅ NEW: Reset to today's view
    const handleBackToToday = () => {
        setIsSearchMode(false);
        const today = getLocalDateString();
        setTargetDate(today);
        fetchRoomData(today, true);
        toast.success('Switched back to today\'s room status!');
    };

    // ✅ Sync optimized rooms with legacy state
    useEffect(() => {
        if (optimizedRooms && optimizedRooms.length > 0) {
            setAllRooms(optimizedRooms);
            setDisplayedRooms(optimizedRooms);
        }
    }, [optimizedRooms]);

    // ✅ Initial data fetch
    useEffect(() => {
        if (profile) {
            fetchRoomData(targetDate, true);
            fetchDepartments();
            fetchRoomSuggestions();
            fetchAllUsers();
        }
    }, [profile, fetchRoomData, targetDate]);

    // ✅ Enhanced filtered and sorted rooms with optimized status
    const filteredAndSortedRooms = useMemo(() => {
        if (!Array.isArray(displayedRooms)) return [];
        
        return displayedRooms.filter(room => {
            const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                room.code.toLowerCase().includes(searchTerm.toLowerCase());

            const roomStatus = getOptimizedRoomStatus(room);
            const matchesStatus = filterStatus === 'all' || roomStatus.status === filterStatus;
            const matchesVisibility = roomStatus.status !== 'In Use' || showInUse;

            return matchesSearch && matchesStatus && matchesVisibility;
        }).sort((a, b) => {
            // Priority sorting: Available > Scheduled > In Use > Unavailable
            const statusOrder = { 'Available': 0, 'Scheduled': 1, 'In Use': 2, 'Conflict': 3, 'Unavailable': 4 };
            const aStatus = getOptimizedRoomStatus(a).status;
            const bStatus = getOptimizedRoomStatus(b).status;
            
            const statusComparison = statusOrder[aStatus] - statusOrder[bStatus];
            if (statusComparison !== 0) return statusComparison;
            
            // Secondary sort by name
            return a.name.localeCompare(b.name);
        });
    }, [displayedRooms, searchTerm, filterStatus, showInUse, getOptimizedRoomStatus]);

    // Enhanced fetch schedules for room detail modal
    const fetchSchedulesForRoom = async (roomName: string, roomId: string) => { 
        setLoadingSchedules(true); 
        try { 
            const combined: CombinedSchedule[] = [];
            const targetDateObj = new Date(targetDate);
            
            // Get day name in Indonesian
            const dayNamesEnglish = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayNamesIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const dayNameIndonesian = dayNamesIndonesian[targetDateObj.getDay()];
            
            console.log(`📅 Fetching schedule for ${roomName} on ${targetDate} (${dayNameIndonesian})`);

            // 1. Fetch lecture schedules
            const { data: lectureData, error: lectureError } = await supabase
                .from('lecture_schedules')
                .select('*')
                .eq('day', dayNameIndonesian)
                .ilike('room', `%${roomName}%`)
                .order('start_time'); 
                
            if (!lectureError && lectureData) {
                lectureData.forEach(lecture => {
                    combined.push({
                        id: lecture.id,
                        type: 'lecture',
                        start_time: lecture.start_time?.substring(0,5) || '',
                        end_time: lecture.end_time?.substring(0,5) || '',
                        title: lecture.course_name || 'Lecture',
                        subtitle: `Class ${lecture.class} • ${lecture.subject_study}`,
                        description: `Lecturer: ${lecture.lecturer || 'TBA'} • Semester ${lecture.semester}`,
                        icon: BookOpen,
                        color: 'text-blue-700',
                        bgColor: 'bg-blue-50',
                        borderColor: 'border-blue-200'
                    });
                });
            }

            // 2. Fetch exam schedules
            const { data: examData, error: examError } = await supabase
                .from('exams')
                .select('*')
                .eq('room_id', roomId)
                .eq('date', targetDate)
                .order('start_time');
                
            if (!examError && examData) {
                examData.forEach(exam => {
                    combined.push({
                        id: exam.id,
                        type: 'exam',
                        start_time: exam.is_take_home ? 'Take Home' : exam.start_time?.substring(0,5) || '',
                        end_time: exam.is_take_home ? '' : exam.end_time?.substring(0,5) || '',
                        title: `${exam.course_name || 'UAS Exam'}`,
                        subtitle: `${exam.student_amount} students • Semester ${exam.semester}`,
                        description: `Class ${exam.class} • Inspector: ${exam.inspector}`,
                        icon: GraduationCap,
                        color: 'text-green-700',
                        bgColor: 'bg-green-50',
                        borderColor: 'border-green-200'
                    });
                });
            }

            // 3. Fetch final sessions
            const { data: sessionData, error: sessionError } = await supabase
                .from('final_sessions')
                .select(`
                    *,
                    student:users!student_id(full_name, identity_number)
                `)
                .eq('room_id', roomId)
                .eq('date', targetDate)
                .order('start_time');
            
            if (!sessionError && sessionData) {
                sessionData.forEach(session => {
                    combined.push({
                        id: session.id,
                        type: 'session',
                        start_time: session.start_time?.substring(0,5) || '',
                        end_time: session.end_time?.substring(0,5) || '',
                        title: `${session.student?.full_name || 'Final Session'}`,
                        subtitle: `ID: ${session.student?.identity_number}`,
                        description: `Supervisor: ${session.supervisor} • Examiner: ${session.examiner}`,
                        icon: UserCheck,
                        color: 'text-purple-700',
                        bgColor: 'bg-purple-50',
                        borderColor: 'border-purple-200'
                    });
                });
            }

            // 4. Fetch bookings with timezone handling
            const startOfDay = `${targetDate}T00:00:00Z`;
            const endOfDay = `${targetDate}T23:59:59Z`;
            
            const { data: bookingData, error: bookingError } = await supabase
                .from('bookings')
                .select(`
                    *,
                    user:users!user_id(full_name, identity_number)
                `)
                .eq('room_id', roomId)
                .eq('status', 'approved')
                .gte('start_time', startOfDay)
                .lte('start_time', endOfDay)
                .order('start_time');
            
            if (!bookingError && bookingData) {
                bookingData.forEach(booking => {
                    const startDate = new Date(booking.start_time);
                    const endDate = new Date(booking.end_time);
                    
                    combined.push({
                        id: booking.id,
                        type: 'booking',
                        start_time: format(startDate, 'HH:mm'),
                        end_time: format(endDate, 'HH:mm'),
                        title: `${booking.purpose || 'Room Booking'}`,
                        subtitle: `${booking.user?.full_name} • ${booking.user?.identity_number}`,
                        description: `Status: APPROVED`,
                        icon: CalendarIcon,
                        color: 'text-orange-700',
                        bgColor: 'bg-orange-50',
                        borderColor: 'border-orange-200'
                    });
                });
            }

            // Sort by time
            combined.sort((a, b) => {
                const aTime = a.start_time === 'Take Home' ? '00:00' : a.start_time;
                const bTime = b.start_time === 'Take Home' ? '00:00' : b.start_time;
                return aTime.localeCompare(bTime);
            });
            
            setCombinedSchedules(combined);

        } catch (error: any) { 
            console.error('Error fetching schedules:', error);
            toast.error("Failed to load schedule for this room."); 
        } finally { 
            setLoadingSchedules(false); 
        } 
    };

    // Fetch room suggestions from lecture_schedules
    const fetchRoomSuggestions = async () => {
        try {
            const { data, error } = await supabase
                .from('lecture_schedules')
                .select('room')
                .not('room', 'is', null);
            
            if (error) throw error;
            
            const uniqueRooms = [...new Set(data.map(item => item.room).filter(Boolean))].sort();
            setRoomNameSuggestions(uniqueRooms);
        } catch (error) {
            console.error('Error fetching room suggestions:', error);
        }
    };

    // Filter room suggestions based on input
    useEffect(() => {
        if (roomNameInput.length >= 1) {
            const filtered = roomNameSuggestions.filter(room => 
                room.toLowerCase().includes(roomNameInput.toLowerCase())
            );
            setFilteredRoomSuggestions(filtered);
            setShowRoomSuggestions(true);
        } else {
            setFilteredRoomSuggestions(roomNameSuggestions);
            setShowRoomSuggestions(false);
        }
    }, [roomNameInput, roomNameSuggestions]);

    // Handle room name input change
    const handleRoomNameChange = (value: string) => {
        setRoomNameInput(value);
        form.setValue('name', value);
    };

    // Handle room name selection from dropdown
    const handleRoomNameSelect = (roomName: string) => {
        setRoomNameInput(roomName);
        form.setValue('name', roomName);
        setShowRoomSuggestions(false);
    };

    const getEquipmentConditionChip = (status: string | undefined) => {
        switch (status) {
            case 'broken':
                return <span className="text-xs font-medium text-red-800 bg-red-100 px-2 py-0.5 rounded-full">BROKEN</span>;
            case 'under_maintenance':
                return <span className="text-xs font-medium text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">MAINTENANCE</span>;
            case 'available':
            default:
                return <span className="text-xs font-medium text-green-800 bg-green-100 px-2 py-0.5 rounded-full">GOOD</span>;
        }
    };

    const fetchDepartments = async () => { 
        try { 
            const { data, error } = await supabase.from('departments').select('id, name').order('name'); 
            if (error) throw error; 
            setDepartments(data || []); 
        } catch (error: any) { 
            toast.error('Failed to load departments'); 
        } 
    };

    // Fetch ALL users (semua role) untuk assignment dropdown
    const fetchAllUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    identity_number,
                    role,
                    department:departments(name)
                `)
                .order('full_name');
            
            if (error) throw error;
            setAllUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    // Manual DOM manipulation untuk user dropdown dengan search internal (SEMUA ROLE)
    const showUserDropdown = () => {
        const dropdownHTML = `
            <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden">
                <div class="p-3 border-b border-gray-100">
                    <div class="relative">
                        <input
                            type="text"
                            placeholder="Search by name or NIM..."
                            class="w-full px-3 py-2 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            id="user-search-input"
                            autocomplete="off"
                        />
                        <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </div>
                </div>
                <div class="max-h-60 overflow-y-auto" id="user-list">
                    ${allUsers.map(user => `
                        <div 
                            class="user-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                            data-user-id="${user.id}"
                            data-user-name="${user.full_name}"
                            data-user-nim="${user.identity_number}"
                            data-user-role="${user.role}"
                            data-user-dept="${user.department?.name || ''}"
                        >
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 bg-gradient-to-r ${getRoleColor(user.role)} rounded-full flex items-center justify-center text-white text-sm font-medium">
                                    ${user.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div class="font-semibold text-gray-900">${user.full_name}</div>
                                    <div class="text-sm text-gray-600">
                                        ${user.identity_number} • ${user.role}
                                        ${user.department ? ` • ${user.department.name}` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        if (userDropdownRef.current) {
            userDropdownRef.current.innerHTML = dropdownHTML;
            userDropdownRef.current.style.display = 'block';
            
            const searchInput = userDropdownRef.current.querySelector('#user-search-input');
            const userList = userDropdownRef.current.querySelector('#user-list');
            
            // Focus pada search input
            if (searchInput) {
                (searchInput as HTMLInputElement).focus();
                
                // Real-time search tanpa delay
                searchInput.addEventListener('input', (e) => {
                    const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
                    
                    const filteredUsers = allUsers.filter(user =>
                        user.full_name.toLowerCase().includes(searchTerm) ||
                        user.identity_number.toLowerCase().includes(searchTerm) ||
                        user.role.toLowerCase().includes(searchTerm)
                    );
                    
                    if (userList) {
                        userList.innerHTML = filteredUsers.map(user => `
                            <div 
                                class="user-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                                data-user-id="${user.id}"
                                data-user-name="${user.full_name}"
                                data-user-nim="${user.identity_number}"
                                data-user-role="${user.role}"
                                data-user-dept="${user.department?.name || ''}"
                            >
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 bg-gradient-to-r ${getRoleColor(user.role)} rounded-full flex items-center justify-center text-white text-sm font-medium">
                                        ${user.full_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div class="font-semibold text-gray-900">${user.full_name}</div>
                                        <div class="text-sm text-gray-600">
                                            ${user.identity_number} • ${user.role}
                                            ${user.department ? ` • ${user.department.name}` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                        
                        // Re-add click listeners after re-rendering
                        addUserListeners();
                    }
                });
            }
            
            // Add initial click listeners
            addUserListeners();
        }
    };

    const addUserListeners = () => {
        userDropdownRef.current?.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const userId = (e.currentTarget as HTMLElement).dataset.userId;
                const userName = (e.currentTarget as HTMLElement).dataset.userName;
                const userNim = (e.currentTarget as HTMLElement).dataset.userNim;
                const userRole = (e.currentTarget as HTMLElement).dataset.userRole;
                const userDept = (e.currentTarget as HTMLElement).dataset.userDept;
                
                const user = {
                    id: userId,
                    full_name: userName,
                    identity_number: userNim,
                    role: userRole,
                    department: userDept ? { name: userDept } : null
                };
                
                setSelectedUser(user);
                
                // Set display value
                if (userDisplayRef.current) {
                    userDisplayRef.current.value = userName || '';
                }
                
                // Hide dropdown
                hideUserDropdown();
            });
        });
    };

    const hideUserDropdown = () => {
        if (userDropdownRef.current) {
            userDropdownRef.current.style.display = 'none';
        }
    };

    // Function untuk mendapatkan warna berdasarkan role
    const getRoleColor = (role: string) => {
        switch (role) {
            case 'student': return 'from-blue-500 to-indigo-500';
            case 'lecturer': return 'from-green-500 to-teal-500';
            case 'department_admin': return 'from-purple-500 to-pink-500';
            case 'super_admin': return 'from-red-500 to-orange-500';
            default: return 'from-gray-500 to-gray-600';
        }
    };
    
    const fetchEquipmentForRoom = async (roomId: string) => {
        setLoadingEquipment(true);
        try {
            const { data, error } = await supabase.from('equipment').select('*').eq('rooms_id', roomId);
            if (error) throw error;
            setSelectedRoomEquipment(data || []);
        } catch (error: any) {
            toast.error("Failed to load room's equipment.");
            console.error("Error fetching equipment for room:", error);
        } finally {
            setLoadingEquipment(false);
        }
    };

    // Fetch assigned users for room
    const fetchRoomUsers = async (roomId: string) => {
        setLoadingRoomUsers(true);
        try {
            const { data, error } = await supabase
                .from('room_users')
                .select(`
                    *,
                    user:users(
                        id,
                        full_name,
                        identity_number,
                        role,
                        department:departments(name)
                    )
                `)
                .eq('room_id', roomId)
                .order('assigned_at', { ascending: false });
            
            if (error) throw error;
            setRoomUsers(data || []);
        } catch (error) {
            console.error('Error fetching room users:', error);
            toast.error("Failed to load assigned users.");
        } finally {
            setLoadingRoomUsers(false);
        }
    };

    // Assign user to room
    const handleAssignUser = async () => {
        if (!selectedUser || !showRoomDetail) return;
        
        try {
            const { data: existing, error: checkError } = await supabase
                .from('room_users')
                .select('id')
                .eq('user_id', selectedUser.id)
                .eq('room_id', showRoomDetail.id)
                .maybeSingle();
            
            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }
            
            if (existing) {
                toast.error('User is already assigned to this room');
                return;
            }

            const { error } = await supabase
                .from('room_users')
                .insert({
                    user_id: selectedUser.id,
                    room_id: showRoomDetail.id,
                    assigned_at: new Date().toISOString()
                });
            
            if (error) throw error;
            
            toast.success(`${selectedUser.full_name} assigned to room successfully`);
            setSelectedUser(null);
            if (userDisplayRef.current) {
                userDisplayRef.current.value = '';
            }
            setShowAssignUserModal(false);
            fetchRoomUsers(showRoomDetail.id);
        } catch (error) {
            console.error('Error assigning user:', error);
            toast.error('Failed to assign user to room');
        }
    };

    const handleToggleAvailability = async (roomId: string, newStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('rooms')
                .update({ is_available: newStatus })
                .eq('id', roomId);
            
            if (error) throw error;
            
            // Update local state
            if (showRoomDetail) {
                setShowRoomDetail({
                    ...showRoomDetail,
                    is_available: newStatus
                });
            }
            
            // Force refresh room data
            await fetchRoomData(targetDate, true);
            
            toast.success(`Room ${newStatus ? 'enabled' : 'disabled'} successfully!`);
        } catch (error) {
            console.error('Error updating room availability:', error);
            toast.error('Failed to update room status');
        }
    };

    // Unassign user from room
    const handleUnassignUser = async (roomUserId: string, userName: string) => {
        setUserToUnassign({id: roomUserId, name: userName});
        setShowUnassignModal(true);
    };

    const confirmUnassignUser = async () => {
        if (!userToUnassign) return;
        
        try {
            const { error } = await supabase
                .from('room_users')
                .delete()
                .eq('id', userToUnassign.id);
            
            if (error) throw error;
            
            toast.success(`${userToUnassign.name} removed from room successfully`);
            fetchRoomUsers(showRoomDetail!.id);
        } catch (error) {
            console.error('Error unassigning user:', error);
            toast.error('Failed to remove user from room');
        } finally {
            setShowUnassignModal(false);
            setUserToUnassign(null);
        }
    };
    
    useEffect(() => {
        if (showRoomDetail) {
            fetchSchedulesForRoom(showRoomDetail.name, showRoomDetail.id);
            fetchEquipmentForRoom(showRoomDetail.id);
            fetchRoomUsers(showRoomDetail.id);
        }
    }, [showRoomDetail, targetDate]);

    const onSubmit = async (data: RoomForm) => { 
        try { 
            setLoading(true); 
            const roomData = { 
                name: data.name, 
                code: data.code, 
                capacity: data.capacity, 
                department_id: data.department_id || null, 
            }; 
            if (editingRoom) { 
                const { error } = await supabase.from('rooms').update(roomData).eq('id', editingRoom.id); 
                if (error) throw error; 
                toast.success('Room updated successfully!'); 
            } else { 
                const { error } = await supabase.from('rooms').insert(roomData); 
                if (error) throw error; 
                toast.success('Room created successfully!'); 
            } 
            setShowForm(false); 
            setEditingRoom(null); 
            form.reset(); 
            setRoomNameInput('');
            await fetchRoomData(targetDate, true);
        } catch (error: any) { 
            console.error('Error saving room:', error); 
            toast.error(error.message || 'Failed to save room'); 
        } finally { 
            setLoading(false); 
        } 
    };

    const handleEdit = (room: EnhancedRoomStatus) => { 
        setEditingRoom(room); 
        setRoomNameInput(room.name);
        form.reset({ 
            name: room.name, 
            code: room.code, 
            capacity: room.capacity, 
            department_id: room.department?.id, 
        }); 
        setShowForm(true); 
    };

    const handleDelete = async (roomId: string) => { 
        if (!confirm('Are you sure you want to delete this room?')) return; 
        try { 
            const { error } = await supabase.from('rooms').delete().eq('id', roomId); 
            if (error) throw error; 
            toast.success('Room deleted successfully!'); 
            await fetchRoomData(targetDate, true);
        } catch (error: any) { 
            console.error('Error deleting room:', error); 
            toast.error(error.message || 'Failed to delete room'); 
        } 
    };

    const handleAddNewRoom = () => {
        setEditingRoom(null);
        setRoomNameInput('');
        form.reset();
        setShowForm(true);
    };

    // ✅ NEW: Enhanced status color function
    const getStatusColor = (status: string) => { 
        switch (status) { 
            case 'In Use': return 'bg-red-100 text-red-800 border-red-200'; 
            case 'Scheduled': return 'bg-yellow-100 text-yellow-800 border-yellow-200'; 
            case 'Available': return 'bg-green-100 text-green-800 border-green-200';
            case 'Conflict': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'Unavailable': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200'; 
        } 
    };

    // Component untuk menampilkan combined schedules dalam satu section
    const CombinedScheduleSection = () => {
        const titleText = isSearchMode ? 
            `Schedule for ${format(new Date(targetDate), 'EEEE, MMMM d, yyyy')}` :
            'Room Schedule';
        const subtitleText = isSearchMode ?
            `Showing all activities for the selected date` :
            `Today's schedule and activities`;
        
        return (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                                <Building className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold">{titleText}</h4>
                                <p className="text-blue-100 text-sm">{subtitleText}</p>
                            </div>
                        </div>
                        <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1">
                            <span className="text-sm font-semibold">
                                {combinedSchedules.length}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    {loadingSchedules ? (
                        <div className="flex justify-center items-center h-32">
                            <RefreshCw className="animate-spin h-6 w-6 text-gray-500"/>
                        </div>
                    ) : combinedSchedules.length > 0 ? (
                        <div className="space-y-3">
                            {combinedSchedules.map((schedule, index) => {
                                const IconComponent = schedule.icon;
                                return (
                                    <div 
                                        key={`${schedule.type}-${schedule.id}-${index}`} 
                                        className={`${schedule.bgColor} rounded-lg p-4 border ${schedule.borderColor} hover:shadow-sm transition-shadow`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center space-x-3">
                                                <div className={`p-2 bg-white rounded-lg shadow-sm`}>
                                                    <IconComponent className={`h-4 w-4 ${schedule.color}`} />
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className={`text-xs font-medium ${schedule.color} bg-white px-2 py-1 rounded-full uppercase tracking-wide`}>
                                                        {schedule.type === 'lecture' ? 'Kuliah' : 
                                                         schedule.type === 'exam' ? 'UAS' :
                                                         schedule.type === 'session' ? 'Sidang' :
                                                         'Booking'}
                                                    </span>
                                                    <span className="font-semibold text-gray-900 text-lg">
                                                        {schedule.end_time ? 
                                                            `${schedule.start_time} - ${schedule.end_time}` : 
                                                            schedule.start_time
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div className="font-semibold text-gray-900 text-lg">
                                                {schedule.title}
                                            </div>
                                            {schedule.subtitle && (
                                                <div className={`text-sm ${schedule.color} font-medium`}>
                                                    {schedule.subtitle}
                                                </div>
                                            )}
                                            {schedule.description && (
                                                <div className="text-sm text-gray-600">
                                                    {schedule.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-50"/>
                            <p className="text-lg font-medium mb-2">Tidak ada jadwal</p>
                            <p className="text-sm">
                                {isSearchMode 
                                    ? `Ruangan ini kosong untuk ${format(new Date(targetDate), 'MMM dd, yyyy')}`
                                    : 'Tidak ada jadwal hari ini atau aktivitas yang terjadwal'
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // User Search Dropdown Component dengan manual DOM (SEMUA ROLE)
    const UserSearchDropdown = () => (
        <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search and Select User</label>
            <div className="relative">
                <input
                    ref={userDisplayRef}
                    type="text"
                    readOnly
                    placeholder="Click to select user..."
                    onClick={showUserDropdown}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer bg-white"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <div ref={userDropdownRef} style={{ display: 'none' }}></div>
            </div>
            
            {selectedUser && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 bg-gradient-to-r ${getRoleColor(selectedUser.role)} rounded-full flex items-center justify-center text-white font-medium`}>
                                {selectedUser.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900">{selectedUser.full_name}</div>
                                <div className="text-sm text-gray-600">
                                    {selectedUser.identity_number} • {selectedUser.role}
                                    {selectedUser.department && ` • ${selectedUser.department.name}`}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedUser(null);
                                if (userDisplayRef.current) {
                                    userDisplayRef.current.value = '';
                                }
                            }}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
    
    if (roomsLoading && displayedRooms.length === 0) { 
        return <div className="flex justify-center items-center h-screen"><RefreshCw className="h-12 w-12 animate-spin text-blue-600" /></div>; 
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white"> 
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Enhanced Room Management</h1> 
                        <p className="mt-2 opacity-90">
                            {isSearchMode 
                                ? `Availability search results for ${format(new Date(targetDate), 'MMM dd, yyyy')}`
                                : 'View real-time room status and manage room operations'
                            }
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">{filteredAndSortedRooms.length}</div>
                        <div className="text-sm opacity-90">
                            {isSearchMode ? 'Available Rooms' : 'Total Rooms'}
                        </div>
                        <div className="text-xs opacity-75 mt-1">
                            Cache Hit: {cacheStats.hitRate.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border p-6">
                {/* ✅ NEW: Enhanced Search Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                            <Search className="h-5 w-5 text-blue-600" />
                            <span>Find Available Rooms</span>
                        </h3>
                        <button
                            onClick={() => setShowAvailabilitySearch(!showAvailabilitySearch)}
                            className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            <Filter className="h-4 w-4" />
                            <span>{showAvailabilitySearch ? 'Hide' : 'Show'} Search</span>
                            {showAvailabilitySearch ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    </div>

                    {showAvailabilitySearch && (
                        <div className="bg-blue-50 rounded-lg p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Target Date</label>
                                    <input 
                                        type="date" 
                                        value={targetDate} 
                                        onChange={(e) => setTargetDate(e.target.value)}
                                        min={getLocalDateString()}
                                        max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={searchStartTime} 
                                        onChange={(e) => setSearchStartTime(e.target.value)} 
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">End Time</label>
                                    <input 
                                        type="time" 
                                        value={searchEndTime} 
                                        onChange={(e) => setSearchEndTime(e.target.value)} 
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={findAvailableRooms} 
                                        disabled={isRefreshing} 
                                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 h-10 transition-colors"
                                    >
                                        {isRefreshing ? <Loader2 className="h-5 w-5 animate-spin"/> : <Search className="h-5 w-5" />} 
                                        <span>Search</span>
                                    </button>
                                    {isSearchMode && (
                                        <button 
                                            onClick={handleBackToToday} 
                                            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 h-10 transition-colors"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            <span>Today</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="text-sm text-gray-600 bg-white p-3 rounded border border-blue-200">
                                💡 This search will check all schedules: Lectures, UAS Exams, Final Sessions, and Room Bookings for conflicts
                            </div>
                        </div>
                    )}
                    
                    <div className="border-t pt-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                        <div className="flex flex-wrap gap-3"> 
                            <button onClick={handleAddNewRoom} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"> 
                                <Plus className="h-5 w-5" /> 
                                <span>Add Room</span> 
                            </button> 
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="relative"> 
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /> 
                                <input 
                                    type="text" 
                                    placeholder="Filter results by name/code..." 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <select 
                                value={filterStatus} 
                                onChange={(e) => setFilterStatus(e.target.value)} 
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Statuses</option>
                                <option value="Available">Available</option>
                                <option value="Scheduled">Scheduled</option>
                                <option value="In Use">In Use</option>
                                <option value="Conflict">Conflict</option>
                                <option value="Unavailable">Unavailable</option>
                            </select>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showInUse}
                                    onChange={(e) => setShowInUse(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">Show In Use</span>
                            </label>
                            <div className="flex border border-gray-300 rounded-lg overflow-hidden"> 
                                <button 
                                    onClick={() => setViewMode('grid')} 
                                    className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <Grid className="h-5 w-5" />
                                </button> 
                                <button 
                                    onClick={() => setViewMode('list')} 
                                    className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <List className="h-5 w-5" />
                                </button> 
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"> 
                {viewMode === 'grid' ? ( 
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"> 
                        {filteredAndSortedRooms.map((room) => {
                            const roomStatus = getOptimizedRoomStatus(room);
                            return (
                                <div key={room.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 group relative"> 
                                    <div className={`absolute top-2 right-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${roomStatus.color}`}>
                                        {roomStatus.status}
                                    </div> 
                                    <div className="flex flex-col h-full"> 
                                        <div className="flex-grow"> 
                                            <h3 className="font-semibold text-gray-900 text-lg mt-8">{room.name}</h3> 
                                            <p className="text-sm text-gray-600">{room.code}</p> 
                                            <div className="flex items-center text-sm text-gray-600 mt-2">
                                                <Users className="h-4 w-4 mr-1"/>
                                                <span>{room.capacity} seats</span>
                                            </div> 
                                            <div className="flex items-center text-sm text-gray-600">
                                                <MapPin className="h-4 w-4 mr-1"/>
                                                <span>{room.department?.name || 'General'}</span>
                                            </div>
                                            
                                            {/* ✅ NEW: Enhanced status details */}
                                            {roomStatus.status === 'Conflict' && (
                                                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                                                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                                                    Time conflict detected
                                                </div>
                                            )}
                                            
                                            {roomStatus.status === 'In Use' && room.currentBooking && (
                                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                                    <Users className="h-3 w-3 inline mr-1" />
                                                    {room.currentBooking.user?.full_name || 'In Use'}
                                                </div>
                                            )}
                                            
                                            {roomStatus.scheduleCount && roomStatus.scheduleCount > 0 && (
                                                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                                                    <CalendarIcon className="h-3 w-3 inline mr-1" />
                                                    {roomStatus.scheduleCount} activities scheduled
                                                </div>
                                            )}
                                        </div> 
                                        <div className="flex items-center justify-end pt-4 mt-4 border-t border-gray-100 space-x-1"> 
                                            <button 
                                                onClick={() => setShowRoomDetail(room)} 
                                                className="p-1 text-gray-500 hover:text-indigo-600 transition-colors"
                                                title="View Details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button> 
                                            <button 
                                onClick={() => handleEdit(room)} 
                                className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                                title="Edit Room"
                            >
                                <Edit className="h-4 w-4" />
                            </button> 
                            <button 
                                onClick={() => handleDelete(room.id)} 
                                className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                                title="Delete Room"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button> 
                        </div> 
                    </div> 
                </div>
            );
        })} 
                    </div> 
                ) : ( 
                    <div className="space-y-3"> 
                        {filteredAndSortedRooms.map((room) => {
                            const roomStatus = getOptimizedRoomStatus(room);
                            return (
                                <div key={room.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-3 h-12 rounded-full ${roomStatus.color.split(' ')[0]}`}></div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{room.name}</h3>
                                            <p className="text-sm text-gray-600">{room.code} • {room.department?.name || 'General'}</p>
                                            {roomStatus.reason && (
                                                <p className="text-xs text-gray-500 mt-1">{roomStatus.reason}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-6">
                                        <div className="text-center">
                                            <div className="text-sm font-medium text-gray-900">{room.capacity}</div>
                                            <div className="text-xs text-gray-500">Capacity</div>
                                        </div>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${roomStatus.color}`}>
                                            {roomStatus.status}
                                        </span>
                                        <div className="flex items-center space-x-2">
                                            <button 
                                                onClick={() => setShowRoomDetail(room)} 
                                                className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
                                                title="View Details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleEdit(room)} 
                                                className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                                                title="Edit Room"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(room.id)} 
                                                className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                                                title="Delete Room"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })} 
                    </div> 
                )} 
                {filteredAndSortedRooms.length === 0 && !roomsLoading && (
                    <div className="text-center py-12">
                        <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">No Rooms Found</h3>
                        <p className="text-gray-600">
                            {isSearchMode 
                                ? 'No rooms are available for the selected time period.'
                                : 'Try adjusting your filter criteria.'
                            }
                        </p>
                        {isSearchMode && (
                            <button
                                onClick={handleBackToToday}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Back to Today's View
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Enhanced Add/Edit Room Form Modal with Autocomplete */}
            {showForm && ( 
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998] p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">{editingRoom ? 'Edit Room' : 'Add New Room'}</h3>
                                <button onClick={() => { 
                                    setShowForm(false); 
                                    setEditingRoom(null); 
                                    setRoomNameInput('');
                                    setShowRoomSuggestions(false);
                                    form.reset(); 
                                }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                {/* Enhanced Room Name Input with Autocomplete */}
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700">Room Name *</label>
                                    <div className="relative mt-1">
                                        <input
                                            type="text"
                                            value={roomNameInput}
                                            onChange={(e) => handleRoomNameChange(e.target.value)}
                                            onFocus={() => setShowRoomSuggestions(roomNameInput.length >= 1)}
                                            onBlur={() => setTimeout(() => setShowRoomSuggestions(false), 200)}
                                            className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Type room name or select from list..."
                                        />
                                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        
                                        {/* Dropdown Suggestions */}
                                        {showRoomSuggestions && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                                {filteredRoomSuggestions.length > 0 ? (
                                                    <>
                                                        {filteredRoomSuggestions.map((roomName, index) => (
                                                            <button
                                                                key={index}
                                                                type="button"
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onClick={() => handleRoomNameSelect(roomName)}
                                                                className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 hover:text-indigo-600 focus:bg-indigo-50 focus:text-indigo-600 transition-colors"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span>{roomName}</span>
                                                                    <span className="text-xs text-gray-400">from schedules</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                        <div className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500 bg-gray-50">
                                                            💡 Select from existing rooms or type a new name
                                                        </div>
                                                    </>
                                                ) : roomNameInput.length >= 1 ? (
                                                    <div className="px-3 py-2 text-sm text-gray-500">
                                                        <div className="flex items-center justify-between">
                                                            <span>No matching rooms found</span>
                                                            <span className="text-xs text-green-600">✓ Will create new</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-2 text-sm text-gray-500">
                                                        Start typing to see suggestions...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {form.formState.errors.name && (
                                        <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Code *</label>
                                    <input 
                                        {...form.register('code')} 
                                        type="text" 
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="e.g. R101, LAB01"
                                    />
                                    {form.formState.errors.code && (
                                        <p className="text-red-500 text-xs mt-1">{form.formState.errors.code.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Capacity *</label>
                                    <input 
                                        {...form.register('capacity', {valueAsNumber: true})} 
                                        type="number" 
                                        min="1"
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="e.g. 30"
                                    />
                                    {form.formState.errors.capacity && (
                                        <p className="text-red-500 text-xs mt-1">{form.formState.errors.capacity.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Department</label>
                                    <select 
                                        {...form.register('department_id')} 
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">No Department / General</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setShowForm(false);
                                            setRoomNameInput('');
                                            setShowRoomSuggestions(false);
                                        }} 
                                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={loading} 
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                        {loading ? 'Saving...' : 'Save Room'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div> 
            )}

            {/* Enhanced Room Detail Modal */}
            {showRoomDetail && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-white rounded-t-2xl">
                            <div className='flex items-center space-x-3'>
                                <div className='bg-blue-100 p-2 rounded-lg'>
                                    <DoorClosed className="h-6 w-6 text-blue-600"/>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{showRoomDetail.name}</h2>
                                    <div className="flex items-center space-x-3 mt-1">
                                        <p className="text-sm text-gray-500">{showRoomDetail.department?.name || 'General Use'}</p>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOptimizedRoomStatus(showRoomDetail).color}`}>
                                            {getOptimizedRoomStatus(showRoomDetail).status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowRoomDetail(null)} 
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="h-6 w-6"/>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column - Room Info, Equipment, Assigned Users */}
                                <div className="space-y-6">
                                    {/* Room Information */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Room Information</h3>
                                        <div className="grid grid-cols-1 gap-4 text-sm">
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
                                            <div className="bg-white p-3 rounded-lg border">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-gray-500">Official Booking Status</p>
                                                    <button
                                                        onClick={() => handleToggleAvailability(showRoomDetail.id, !showRoomDetail.is_available)}
                                                        className={`p-1 rounded transition-colors ${
                                                            showRoomDetail.is_available 
                                                                ? 'text-green-600 hover:bg-green-50' 
                                                                : 'text-red-600 hover:bg-red-50'
                                                        }`}
                                                        title={`Click to ${showRoomDetail.is_available ? 'disable' : 'enable'} room`}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                
                                                <div className="flex items-center space-x-3">
                                                    {showRoomDetail.is_available ? (
                                                        <CheckCircle className="h-5 w-5 text-green-500"/>
                                                    ) : (
                                                        <AlertCircle className="h-5 w-5 text-red-500"/>
                                                    )}
                                                    <div className="flex-1">
                                                        <p className={`font-semibold ${showRoomDetail.is_available ? 'text-green-600' : 'text-red-600'}`}>
                                                            {showRoomDetail.is_available ? 'AVAILABLE' : 'UNAVAILABLE'}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {showRoomDetail.is_available 
                                                                ? 'Room can be booked officially' 
                                                                : 'Room is disabled for booking'
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Equipment in Room */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Equipment in Room</h3>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {loadingEquipment ? (
                                                <div className="flex justify-center p-4">
                                                    <RefreshCw className="h-5 w-5 animate-spin"/>
                                                </div>
                                            ) : selectedRoomEquipment.length > 0 ? (
                                                selectedRoomEquipment.map((eq) => (
                                                    <div key={eq.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                                        <div>
                                                            <p className="font-medium text-gray-800">{eq.name}</p>
                                                            <p className="text-xs text-gray-500">{eq.code}</p>
                                                        </div>
                                                        {getEquipmentConditionChip(eq.status)}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-gray-500 text-center py-4">No equipment assigned to this room.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Assigned Users Section */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-lg font-semibold text-gray-800">Assigned Users</h3>
                                            <button
                                                onClick={() => setShowAssignUserModal(true)}
                                                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                <span>Assign</span>
                                            </button>
                                        </div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {loadingRoomUsers ? (
                                                <div className="flex justify-center p-4">
                                                    <RefreshCw className="h-5 w-5 animate-spin"/>
                                                </div>
                                            ) : roomUsers.length > 0 ? (
                                                roomUsers.map((roomUser) => (
                                                    <div key={roomUser.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                                        <div className="flex items-center space-x-3">
                                                            <div className={`w-8 h-8 bg-gradient-to-r ${getRoleColor(roomUser.user.role)} rounded-full flex items-center justify-center text-white text-sm font-medium`}>
                                                                {roomUser.user.full_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-800 text-sm">{roomUser.user.full_name}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {roomUser.user.identity_number} • {roomUser.user.role}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleUnassignUser(roomUser.id, roomUser.user.full_name)}
                                                            className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
                                                            title="Remove user"
                                                        >
                                                            <UserMinus className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-6 text-gray-500">
                                                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm">No users assigned</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Right Column - Enhanced Schedule Display */}
                                <div className="lg:col-span-2">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                        Complete Schedule for {format(new Date(targetDate), 'EEEE, MMMM d, yyyy')}
                                    </h3>
                                    
                                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                                        <CombinedScheduleSection />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign User Modal */}
            {showAssignUserModal && showRoomDetail && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Assign User to {showRoomDetail.name}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowAssignUserModal(false);
                                        setSelectedUser(null);
                                        if (userDisplayRef.current) {
                                            userDisplayRef.current.value = '';
                                        }
                                    }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <UserSearchDropdown />

                            <div className="flex space-x-3 pt-6">
                                <button
                                    onClick={() => {
                                        setShowAssignUserModal(false);
                                        setSelectedUser(null);
                                        if (userDisplayRef.current) {
                                            userDisplayRef.current.value = '';
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAssignUser}
                                    disabled={!selectedUser}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Assign User
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unassign Confirmation Modal */}
            {showUnassignModal && userToUnassign && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001] p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Confirm Removal
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowUnassignModal(false);
                                        setUserToUnassign(null);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                            
                            <div className="mb-6">
                                <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg border border-red-200">
                                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                        <UserMinus className="h-5 w-5 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-900">
                                            Are you sure you want to remove <strong>{userToUnassign.name}</strong> from this room?
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            This action cannot be undone. The user will lose access to this room.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => {
                                        setShowUnassignModal(false);
                                        setUserToUnassign(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmUnassignUser}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Remove User
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomManagement;