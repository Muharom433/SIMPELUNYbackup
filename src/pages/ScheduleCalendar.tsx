import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    GraduationCap,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Eye,
    User,
    BookOpen,
    AlertCircle,
    FileText,
    ChevronDown,
    ChevronUp,
    BookMarked,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

interface Session {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    title: string;
    student?: { full_name: string; identity_number: string };
    room?: { id: string; name: string; code: string };
}

interface LectureSchedule {
    id: string;
    day: string;
    start_time: string;
    end_time: string;
    course_name: string;
    course_code: string;
    lecturer: string;
    room: string;
    class: string;
}

interface Exam {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    course_name: string;
    course_code: string;
    is_take_home: boolean;
    inspector: string;
    room?: { id: string; name: string; code: string };
    lecturer?: { full_name: string };
    class: string;
    semester: number;
}

interface Booking {
    id: string;
    start_time: string;
    end_time: string;
    purpose: string;
    status: string;
    user?: { full_name: string; identity_number: string };
    room?: { id: string; name: string; code: string };
}

interface Room {
    id: string;
    name: string;
    code: string;
}

const ScheduleCalendar: React.FC = () => {
    const { profile } = useAuth();
    const { getText } = useLanguage();

    // Data states
    const [sessions, setSessions] = useState<Session[]>([]);
    const [lectureSchedules, setLectureSchedules] = useState<LectureSchedule[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    // Calendar states
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');

    // Toggle visibility states for each schedule type
    const [showLectures, setShowLectures] = useState(true);
    const [showExams, setShowExams] = useState(true);
    const [showSessions, setShowSessions] = useState(true);
    const [showBookings, setShowBookings] = useState(true);

    // Expanded sections in details panel
    const [expandedSection, setExpandedSection] = useState<'lectures' | 'exams' | 'sessions' | 'bookings' | null>('lectures');

    // Day names for mapping
    const dayNamesIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthNamesId = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNamesId = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch sessions (thesis defense)
            const { data: sessionsData, error: sessionsError } = await supabase
                .from('final_sessions')
                .select(`
                    id, date, start_time, end_time, title,
                    student:users!final_sessions_student_id_fkey(full_name, identity_number),
                    room:rooms(id, name, code)
                `)
                .order('date', { ascending: true });

            if (sessionsError) throw sessionsError;
            setSessions(sessionsData || []);

            // Fetch lecture schedules
            const { data: lecturesData, error: lecturesError } = await supabase
                .from('lecture_schedules')
                .select('id, day, start_time, end_time, course_name, course_code, lecturer, room, class')
                .order('day', { ascending: true });

            if (lecturesError) throw lecturesError;
            setLectureSchedules(lecturesData || []);

            // Fetch exams
            const { data: examsData, error: examsError } = await supabase
                .from('exams')
                .select(`
                    id, date, start_time, end_time, course_name, course_code, is_take_home, inspector, class, semester,
                    room:rooms(id, name, code),
                    lecturer:users!exams_lecturer_id_fkey(full_name)
                `)
                .order('date', { ascending: true });

            if (examsError) throw examsError;
            // Transform data to match Exam interface (Supabase returns arrays for single relations)
            const transformedExams = (examsData || []).map((exam: any) => ({
                ...exam,
                room: Array.isArray(exam.room) ? exam.room[0] : exam.room,
                lecturer: Array.isArray(exam.lecturer) ? exam.lecturer[0] : exam.lecturer
            }));
            setExams(transformedExams);

            // Fetch bookings
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    id, start_time, end_time, purpose, status,
                    user:users!bookings_user_id_fkey(full_name, identity_number),
                    room:rooms(id, name, code)
                `)
                .in('status', ['approved', 'borrowed', 'completed', 'pending'])
                .order('start_time', { ascending: true });

            if (bookingsError) throw bookingsError;
            // Transform data to match Booking interface (Supabase returns arrays for single relations)
            const transformedBookings = (bookingsData || []).map((booking: any) => ({
                ...booking,
                room: Array.isArray(booking.room) ? booking.room[0] : booking.room,
                user: Array.isArray(booking.user) ? booking.user[0] : booking.user
            }));
            setBookings(transformedBookings);

            // Fetch rooms
            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select('id, name, code')
                .eq('is_available', true)
                .order('name', { ascending: true });

            if (roomsError) throw roomsError;
            setRooms(roomsData || []);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth));
        const end = endOfWeek(endOfMonth(currentMonth));
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    // Get sessions for a specific date
    const getSessionsForDate = useCallback((date: Date) => {
        if (!showSessions) return [];
        const dateStr = format(date, 'yyyy-MM-dd');
        return sessions.filter(session => {
            const matchesDate = session.date === dateStr;
            const matchesRoom = selectedRoomFilter === 'all' || session.room?.id === selectedRoomFilter;
            return matchesDate && matchesRoom;
        });
    }, [sessions, selectedRoomFilter, showSessions]);

    // Get lecture schedules for a specific date (by day name)
    const getLecturesForDate = useCallback((date: Date) => {
        if (!showLectures) return [];
        const dayName = dayNamesIndonesian[date.getDay()];
        return lectureSchedules.filter(lecture => {
            const matchesDay = lecture.day === dayName;
            const matchesRoom = selectedRoomFilter === 'all' ||
                rooms.find(r => r.name.toLowerCase() === lecture.room?.toLowerCase())?.id === selectedRoomFilter;
            return matchesDay && matchesRoom;
        });
    }, [lectureSchedules, selectedRoomFilter, rooms, showLectures]);

    // Get exams for a specific date
    const getExamsForDate = useCallback((date: Date) => {
        if (!showExams) return [];
        const dateStr = format(date, 'yyyy-MM-dd');
        return exams.filter(exam => {
            const matchesDate = exam.date === dateStr;
            const matchesRoom = selectedRoomFilter === 'all' || exam.room?.id === selectedRoomFilter;
            return matchesDate && matchesRoom;
        });
    }, [exams, selectedRoomFilter, showExams]);

    // Get bookings for a specific date
    const getBookingsForDate = useCallback((date: Date) => {
        if (!showBookings) return [];
        const dateStr = format(date, 'yyyy-MM-dd');
        return bookings.filter(booking => {
            const bookingDate = booking.start_time ? format(new Date(booking.start_time), 'yyyy-MM-dd') : null;
            const matchesDate = bookingDate === dateStr;
            const matchesRoom = selectedRoomFilter === 'all' || booking.room?.id === selectedRoomFilter;
            return matchesDate && matchesRoom;
        });
    }, [bookings, selectedRoomFilter, showBookings]);

    // Get all events for a date
    const getEventsForDate = useCallback((date: Date) => {
        return {
            sessions: getSessionsForDate(date),
            lectures: getLecturesForDate(date),
            exams: getExamsForDate(date),
            bookings: getBookingsForDate(date)
        };
    }, [getSessionsForDate, getLecturesForDate, getExamsForDate, getBookingsForDate]);

    // Get event count for date
    const getEventCountForDate = useCallback((date: Date) => {
        const { sessions, lectures, exams, bookings } = getEventsForDate(date);
        return {
            sessions: sessions.length,
            lectures: lectures.length,
            exams: exams.length,
            bookings: bookings.length,
            total: sessions.length + lectures.length + exams.length + bookings.length
        };
    }, [getEventsForDate]);

    // Get status badge for bookings
    const getStatusBadge = (status: string) => {
        const config: Record<string, { color: string; label: string }> = {
            'approved': { color: 'bg-green-100 text-green-800', label: getText('Approved', 'Disetujui') },
            'borrowed': { color: 'bg-blue-100 text-blue-800', label: getText('In Use', 'Sedang Digunakan') },
            'completed': { color: 'bg-gray-100 text-gray-800', label: getText('Completed', 'Selesai') },
            'pending': { color: 'bg-yellow-100 text-yellow-800', label: getText('Pending', 'Menunggu') },
        };
        const cfg = config[status] || config.pending;
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                {cfg.label}
            </span>
        );
    };

    // Access control
    if (!profile || !['super_admin', 'frontdesk', 'department_admin', 'laboratory'].includes(profile.role)) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] p-4">
                <div className="text-center">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {getText('Access Denied', 'Akses Ditolak')}
                    </h3>
                    <p className="text-gray-600 text-center max-w-md">
                        {getText("You don't have permission to access this page.", 'Anda tidak memiliki izin untuk mengakses halaman ini.')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl p-6 text-white">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3">
                            <Calendar className="h-8 w-8" />
                            <span>{getText('Schedule Calendar', 'Kalender Jadwal')}</span>
                        </h1>
                        <p className="mt-2 opacity-90">
                            {getText('View all lectures, exams, sessions, and bookings', 'Lihat semua jadwal kuliah, ujian, sidang, dan peminjaman')}
                        </p>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        <span>{getText('Refresh', 'Muat Ulang')}</span>
                    </button>
                </div>
            </div>

            {/* Filters and Toggles */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    {/* Room Filter */}
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                        <select
                            value={selectedRoomFilter}
                            onChange={(e) => setSelectedRoomFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="all">{getText('All Rooms', 'Semua Ruangan')}</option>
                            {rooms.map(room => (
                                <option key={room.id} value={room.id}>
                                    {room.name} ({room.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Toggle Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setShowLectures(!showLectures)}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showLectures ? 'bg-green-100 text-green-800 border-2 border-green-300' : 'bg-gray-100 text-gray-500 border-2 border-transparent'
                                }`}
                        >
                            <div className={`w-3 h-3 rounded-full ${showLectures ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            <span>{getText('Lectures', 'Kuliah')}</span>
                        </button>
                        <button
                            onClick={() => setShowExams(!showExams)}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showExams ? 'bg-orange-100 text-orange-800 border-2 border-orange-300' : 'bg-gray-100 text-gray-500 border-2 border-transparent'
                                }`}
                        >
                            <div className={`w-3 h-3 rounded-full ${showExams ? 'bg-orange-500' : 'bg-gray-400'}`}></div>
                            <span>{getText('Exams', 'Ujian')}</span>
                        </button>
                        <button
                            onClick={() => setShowSessions(!showSessions)}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showSessions ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' : 'bg-gray-100 text-gray-500 border-2 border-transparent'
                                }`}
                        >
                            <div className={`w-3 h-3 rounded-full ${showSessions ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                            <span>{getText('Sessions', 'Sidang')}</span>
                        </button>
                        <button
                            onClick={() => setShowBookings(!showBookings)}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showBookings ? 'bg-purple-100 text-purple-800 border-2 border-purple-300' : 'bg-gray-100 text-gray-500 border-2 border-transparent'
                                }`}
                        >
                            <div className={`w-3 h-3 rounded-full ${showBookings ? 'bg-purple-500' : 'bg-gray-400'}`}></div>
                            <span>{getText('Bookings', 'Peminjaman')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Calendar Navigation */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                        >
                            <ChevronLeft className="h-5 w-5 text-gray-600" />
                        </button>

                        <div className="text-center">
                            <h2 className="text-xl font-bold text-gray-900">
                                {getText(monthNames[currentMonth.getMonth()], monthNamesId[currentMonth.getMonth()])} {currentMonth.getFullYear()}
                            </h2>
                        </div>

                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                        >
                            <ChevronRight className="h-5 w-5 text-gray-600" />
                        </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="p-4">
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 mb-2">
                            {(getText('en', 'id') === 'en' ? dayNames : dayNamesId).map(day => (
                                <div key={day} className="p-2 text-center text-sm font-semibold text-gray-600">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Days */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day) => {
                                const isCurrentMonth = isSameMonth(day, currentMonth);
                                const isToday = isSameDay(day, new Date());
                                const isSelected = selectedDate && isSameDay(day, selectedDate);
                                const counts = getEventCountForDate(day);
                                const hasEvents = counts.total > 0;

                                return (
                                    <button
                                        key={day.toString()}
                                        onClick={() => isCurrentMonth && setSelectedDate(day)}
                                        disabled={!isCurrentMonth}
                                        className={`
                                            min-h-[80px] p-2 text-sm border rounded-lg transition-all duration-200 relative
                                            ${!isCurrentMonth
                                                ? 'bg-gray-50 text-gray-300 cursor-not-allowed border-transparent'
                                                : isSelected
                                                    ? 'bg-teal-100 border-teal-500 ring-2 ring-teal-200'
                                                    : isToday
                                                        ? 'bg-blue-50 border-blue-300 font-bold'
                                                        : hasEvents
                                                            ? 'bg-white hover:bg-gray-50 border-gray-200 cursor-pointer'
                                                            : 'bg-white hover:bg-gray-50 border-gray-100 cursor-pointer'
                                            }
                                        `}
                                    >
                                        <div className="flex flex-col h-full">
                                            <span className={`
                                                text-right font-medium
                                                ${isToday ? 'text-blue-600' : ''}
                                                ${isSelected ? 'text-teal-700' : ''}
                                            `}>
                                                {format(day, 'd')}
                                            </span>

                                            {isCurrentMonth && hasEvents && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {counts.lectures > 0 && showLectures && (
                                                        <div className="flex items-center space-x-1">
                                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                            <span className="text-xs text-green-700">{counts.lectures}</span>
                                                        </div>
                                                    )}
                                                    {counts.exams > 0 && showExams && (
                                                        <div className="flex items-center space-x-1">
                                                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                                            <span className="text-xs text-orange-700">{counts.exams}</span>
                                                        </div>
                                                    )}
                                                    {counts.sessions > 0 && showSessions && (
                                                        <div className="flex items-center space-x-1">
                                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                            <span className="text-xs text-blue-700">{counts.sessions}</span>
                                                        </div>
                                                    )}
                                                    {counts.bookings > 0 && showBookings && (
                                                        <div className="flex items-center space-x-1">
                                                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                                            <span className="text-xs text-purple-700">{counts.bookings}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Side Panel - Selected Date Details with Accordion */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                            <Eye className="h-5 w-5 text-gray-400" />
                            <span>{getText('Schedule Details', 'Detail Jadwal')}</span>
                        </h3>
                        {selectedDate && (
                            <p className="text-sm text-gray-600 mt-1">
                                {format(selectedDate, 'EEEE, dd MMMM yyyy')}
                            </p>
                        )}
                    </div>

                    <div className="max-h-[600px] overflow-y-auto">
                        {!selectedDate ? (
                            <div className="text-center py-8 px-4">
                                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">
                                    {getText('Select a date to view schedules', 'Pilih tanggal untuk melihat jadwal')}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {/* Lectures Section */}
                                {showLectures && (
                                    <div className="border-l-4 border-green-500">
                                        <button
                                            onClick={() => setExpandedSection(expandedSection === 'lectures' ? null : 'lectures')}
                                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <BookOpen className="h-5 w-5 text-green-600" />
                                                <span className="font-medium text-green-800">{getText('Lecture Schedules', 'Jadwal Kuliah')}</span>
                                                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                                                    {getLecturesForDate(selectedDate).length}
                                                </span>
                                            </div>
                                            {expandedSection === 'lectures' ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                                        </button>
                                        {expandedSection === 'lectures' && (
                                            <div className="px-4 pb-4 space-y-2">
                                                {getLecturesForDate(selectedDate).length === 0 ? (
                                                    <p className="text-sm text-gray-500 italic">{getText('No lectures scheduled', 'Tidak ada kuliah terjadwal')}</p>
                                                ) : (
                                                    getLecturesForDate(selectedDate).map(lecture => (
                                                        <div key={lecture.id} className="bg-green-50 rounded-lg p-3 border border-green-100">
                                                            <div className="font-medium text-green-900 text-sm mb-1">
                                                                {lecture.course_name} ({lecture.course_code})
                                                            </div>
                                                            <div className="flex items-center space-x-2 text-xs text-green-700 mb-1">
                                                                <Clock className="h-3 w-3" />
                                                                <span>{lecture.start_time?.substring(0, 5)} - {lecture.end_time?.substring(0, 5)}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-2 text-xs text-green-700 mb-1">
                                                                <User className="h-3 w-3" />
                                                                <span>{lecture.lecturer}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-2 text-xs text-green-700 mb-1">
                                                                <Users className="h-3 w-3" />
                                                                <span>{lecture.class}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-2 text-xs text-green-700">
                                                                <MapPin className="h-3 w-3" />
                                                                <span>{lecture.room}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Exams Section */}
                                {showExams && (
                                    <div className="border-l-4 border-orange-500">
                                        <button
                                            onClick={() => setExpandedSection(expandedSection === 'exams' ? null : 'exams')}
                                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <FileText className="h-5 w-5 text-orange-600" />
                                                <span className="font-medium text-orange-800">{getText('Exam Schedules', 'Jadwal Ujian')}</span>
                                                <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full">
                                                    {getExamsForDate(selectedDate).length}
                                                </span>
                                            </div>
                                            {expandedSection === 'exams' ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                                        </button>
                                        {expandedSection === 'exams' && (
                                            <div className="px-4 pb-4 space-y-2">
                                                {getExamsForDate(selectedDate).length === 0 ? (
                                                    <p className="text-sm text-gray-500 italic">{getText('No exams scheduled', 'Tidak ada ujian terjadwal')}</p>
                                                ) : (
                                                    getExamsForDate(selectedDate).map(exam => (
                                                        <div key={exam.id} className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                                                            <div className="font-medium text-orange-900 text-sm mb-1">
                                                                {exam.course_name} ({exam.course_code})
                                                            </div>
                                                            {exam.is_take_home ? (
                                                                <div className="text-xs text-orange-700 mb-1 font-medium">
                                                                    📝 {getText('Take Home Exam', 'Ujian Take Home')}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center space-x-2 text-xs text-orange-700 mb-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    <span>{exam.start_time?.substring(0, 5)} - {exam.end_time?.substring(0, 5)}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center space-x-2 text-xs text-orange-700 mb-1">
                                                                <Users className="h-3 w-3" />
                                                                <span>{getText('Class', 'Kelas')}: {exam.class} | {getText('Semester', 'Semester')}: {exam.semester}</span>
                                                            </div>
                                                            {exam.inspector && (
                                                                <div className="flex items-center space-x-2 text-xs text-orange-700 mb-1">
                                                                    <User className="h-3 w-3" />
                                                                    <span>{getText('Inspector', 'Pengawas')}: {exam.inspector}</span>
                                                                </div>
                                                            )}
                                                            {exam.room && !exam.is_take_home && (
                                                                <div className="flex items-center space-x-2 text-xs text-orange-700">
                                                                    <MapPin className="h-3 w-3" />
                                                                    <span>{exam.room.name}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Sessions Section */}
                                {showSessions && (
                                    <div className="border-l-4 border-blue-500">
                                        <button
                                            onClick={() => setExpandedSection(expandedSection === 'sessions' ? null : 'sessions')}
                                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <GraduationCap className="h-5 w-5 text-blue-600" />
                                                <span className="font-medium text-blue-800">{getText('Session Schedules', 'Jadwal Sidang')}</span>
                                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                                                    {getSessionsForDate(selectedDate).length}
                                                </span>
                                            </div>
                                            {expandedSection === 'sessions' ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                                        </button>
                                        {expandedSection === 'sessions' && (
                                            <div className="px-4 pb-4 space-y-2">
                                                {getSessionsForDate(selectedDate).length === 0 ? (
                                                    <p className="text-sm text-gray-500 italic">{getText('No sessions scheduled', 'Tidak ada sidang terjadwal')}</p>
                                                ) : (
                                                    getSessionsForDate(selectedDate).map(session => (
                                                        <div key={session.id} className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                                            <div className="font-medium text-blue-900 text-sm mb-1">
                                                                {session.title || 'Untitled'}
                                                            </div>
                                                            <div className="flex items-center space-x-2 text-xs text-blue-700 mb-1">
                                                                <Clock className="h-3 w-3" />
                                                                <span>{session.start_time?.substring(0, 5)} - {session.end_time?.substring(0, 5)}</span>
                                                            </div>
                                                            {session.student && (
                                                                <div className="flex items-center space-x-2 text-xs text-blue-700 mb-1">
                                                                    <User className="h-3 w-3" />
                                                                    <span>{session.student.full_name} ({session.student.identity_number})</span>
                                                                </div>
                                                            )}
                                                            {session.room && (
                                                                <div className="flex items-center space-x-2 text-xs text-blue-700">
                                                                    <MapPin className="h-3 w-3" />
                                                                    <span>{session.room.name}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Bookings Section */}
                                {showBookings && (
                                    <div className="border-l-4 border-purple-500">
                                        <button
                                            onClick={() => setExpandedSection(expandedSection === 'bookings' ? null : 'bookings')}
                                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <BookMarked className="h-5 w-5 text-purple-600" />
                                                <span className="font-medium text-purple-800">{getText('Room Bookings', 'Peminjaman Ruangan')}</span>
                                                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">
                                                    {getBookingsForDate(selectedDate).length}
                                                </span>
                                            </div>
                                            {expandedSection === 'bookings' ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                                        </button>
                                        {expandedSection === 'bookings' && (
                                            <div className="px-4 pb-4 space-y-2">
                                                {getBookingsForDate(selectedDate).length === 0 ? (
                                                    <p className="text-sm text-gray-500 italic">{getText('No bookings', 'Tidak ada peminjaman')}</p>
                                                ) : (
                                                    getBookingsForDate(selectedDate).map(booking => (
                                                        <div key={booking.id} className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="font-medium text-purple-900 text-sm">
                                                                    {booking.purpose || getText('Room Booking', 'Peminjaman Ruangan')}
                                                                </div>
                                                                {getStatusBadge(booking.status)}
                                                            </div>
                                                            <div className="flex items-center space-x-2 text-xs text-purple-700 mb-1">
                                                                <Clock className="h-3 w-3" />
                                                                <span>
                                                                    {booking.start_time ? format(new Date(booking.start_time), 'HH:mm') : '--:--'} - {booking.end_time ? format(new Date(booking.end_time), 'HH:mm') : '--:--'}
                                                                </span>
                                                            </div>
                                                            {booking.user && (
                                                                <div className="flex items-center space-x-2 text-xs text-purple-700 mb-1">
                                                                    <User className="h-3 w-3" />
                                                                    <span>{booking.user.full_name} ({booking.user.identity_number})</span>
                                                                </div>
                                                            )}
                                                            {booking.room && (
                                                                <div className="flex items-center space-x-2 text-xs text-purple-700">
                                                                    <MapPin className="h-3 w-3" />
                                                                    <span>{booking.room.name}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduleCalendar;
