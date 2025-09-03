// src/hooks/useRoomData.ts - COMPLETE FILE dengan APPROVED only logic
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRoomStore, EnhancedRoomStatus } from '../stores/roomStore';
import { format, parseISO } from 'date-fns';

// Timezone utility functions
const convertUTCToLocal = (utcTimeString: string): Date => {
  return new Date(utcTimeString);
};

const getLocalDateString = (date: Date = new Date()): string => {
  return format(date, 'yyyy-MM-dd');
};

const getDateRangeForBookings = (localDate: string) => {
  // Start: 00:00:00 local time
  const startOfDay = new Date(`${localDate}T00:00:00`);
  const startUTC = startOfDay.toISOString();
  
  // End: 23:59:59 local time  
  const endOfDay = new Date(`${localDate}T23:59:59`);
  const endUTC = endOfDay.toISOString();
  
  return { startUTC, endUTC };
};

export const useRoomData = (targetDate: string) => {
  const { 
    rooms, 
    setRooms, 
    shouldRefresh, 
    getCacheStats 
  } = useRoomStore();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoomData = useCallback(async (date: string, forceRefresh = false) => {
    if (!forceRefresh && !shouldRefresh(date)) {
      return rooms;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🏢 Fetching room data for ${date} (local timezone)...`);
      
      // 1. FETCH ROOMS dengan relasi department
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          id,
          name,
          code,
          capacity,
          is_available,
          equipment,
          department:departments(id, name)
        `)
        .order('name');

      if (roomsError) throw roomsError;

      // 2. FETCH BOOKINGS - HANYA yang APPROVED untuk conflict detection
      const { startUTC, endUTC } = getDateRangeForBookings(date);
      
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          room_id,
          start_time,
          end_time,
          purpose,
          status,
          user_info,
          user_id,
          user:users!user_id(
            id,
            full_name,
            identity_number,
            study_program_id,
            study_program:study_programs(
              id,
              name,
              code,
              department:departments(name)
            )
          )
        `)
        .gte('start_time', startUTC)
        .lt('start_time', endUTC)
        .eq('status', ['approved','borrowed']);

      if (bookingsError) throw bookingsError;

      // 3. FETCH FINAL SESSIONS dengan filter tanggal yang benar
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('final_sessions')
        .select(`
          id,
          room_id,
          date,
          start_time,
          end_time,
          title,
          supervisor,
          examiner,
          secretary,
          student_id,
          student:users!student_id(
            id,
            full_name,
            identity_number,
            study_program_id,
            study_program:study_programs(
              id,
              name,
              code,
              department:departments(name)
            )
          )
        `)
        .eq('date', date);

      if (sessionsError) throw sessionsError;

      // 4. FETCH LECTURE SCHEDULES
      const dateObj = new Date(date);
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[dateObj.getDay()];

      const { data: lecturesData, error: lecturesError } = await supabase
        .from('lecture_schedules')
        .select(`
          id,
          room,
          day,
          start_time,
          end_time,
          course_name,
          course_code,
          class,
          subject_study,
          lecturer,
          semester,
          kurikulum,
          academics_year,
          type
        `)
        .eq('day', dayName);

      if (lecturesError) throw lecturesError;

      // 5. FETCH EXAM SCHEDULES
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select(`
          id,
          room_id,
          date,
          start_time,
          end_time,
          course_name,
          course_code,
          class,
          student_amount,
          lecturer_id,
          department_id,
          study_program_id
        `)
        .eq('date', date);

      if (examsError) throw examsError;

      // 6. FETCH CURRENT BOOKINGS - HANYA yang APPROVED untuk "In Use"
      const now = new Date();
      const currentTimeUTC = now.toISOString();
      
      let currentBookingsData = [];
      if (date === getLocalDateString(now)) {
        const { data: currentData, error: currentError } = await supabase
          .from('bookings')
          .select(`
            id,
            room_id,
            start_time,
            end_time,
            purpose,
            status,
            user_info,
            user:users!user_id(
              id,
              full_name,
              identity_number,
              study_program:study_programs(
                id,
                name,
                code
              )
            )
          `)
          .lte('start_time', currentTimeUTC)
          .gte('end_time', currentTimeUTC)
          .eq('status', 'approved');

        if (!currentError) {
          currentBookingsData = currentData || [];
        }
      }

      // 7. FETCH FUTURE BOOKINGS - HANYA yang APPROVED
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayRange = getDateRangeForBookings(getLocalDateString(nextDay));

      const { data: futureBookingsData, error: futureError } = await supabase
        .from('bookings')
        .select(`
          id,
          room_id,
          start_time,
          end_time,
          purpose,
          user:users!user_id(
            full_name,
            study_program:study_programs(name)
          )
        `)
        .gte('start_time', nextDayRange.startUTC)
        .eq('status', 'approved')
        .order('start_time', { ascending: true });

      if (futureError) console.warn('Future bookings fetch error:', futureError);

      // 8. PROCESS DATA dengan timezone handling yang benar
      const enhancedRooms: EnhancedRoomStatus[] = (roomsData || []).map(room => {
        // Group bookings by room
        const roomBookings = (bookingsData || []).filter(booking => booking.room_id === room.id);
        
        // Group sessions by room
        const roomSessions = (sessionsData || []).filter(session => session.room_id === room.id);
        
        // Group lectures by room
        const roomLectures = (lecturesData || []).filter(lecture => 
          lecture.room.toLowerCase() === room.name.toLowerCase()
        );
        
        // Group exams by room
        const roomExams = (examsData || []).filter(exam => 
          exam.room_id === room.id
        );

        // Current booking untuk room ini
        const currentBooking = currentBookingsData.find(booking => booking.room_id === room.id);

        // Future bookings untuk room ini
        const roomFutureBookings = (futureBookingsData || []).filter(booking => booking.room_id === room.id);

        // Calculate future booking stats dengan timezone handling
        const thisWeekEnd = new Date();
        thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
        const thisMonthEnd = new Date();
        thisMonthEnd.setMonth(thisMonthEnd.getMonth() + 1);

        const futureStats = {
          count: roomFutureBookings.length,
          nextBooking: roomFutureBookings.length > 0 ? {
            date: format(convertUTCToLocal(roomFutureBookings[0].start_time), 'yyyy-MM-dd'),
            time: `${format(convertUTCToLocal(roomFutureBookings[0].start_time), 'HH:mm')} - ${format(convertUTCToLocal(roomFutureBookings[0].end_time), 'HH:mm')}`,
            purpose: roomFutureBookings[0].purpose,
            user: roomFutureBookings[0].user?.full_name
          } : undefined,
          thisWeek: roomFutureBookings.filter(b => convertUTCToLocal(b.start_time) <= thisWeekEnd).length,
          thisMonth: roomFutureBookings.filter(b => convertUTCToLocal(b.start_time) <= thisMonthEnd).length,
          upcoming: roomFutureBookings.slice(0, 5)
        };

        // Determine status
        const hasCurrentBooking = !!currentBooking;
        const hasScheduledContent = roomBookings.length > 0 || roomSessions.length > 0 || 
                                  roomLectures.length > 0 || roomExams.length > 0;

        const todayStatus: 'In Use' | 'Scheduled' | 'Available' = 
          hasCurrentBooking ? 'In Use' : 
          hasScheduledContent ? 'Scheduled' : 
          'Available';

        const targetDateStatus: 'Scheduled' | 'Available' = 
          hasScheduledContent ? 'Scheduled' : 'Available';

        return {
          id: room.id,
          name: room.name,
          code: room.code,
          capacity: room.capacity,
          department: room.department,
          equipment: room.equipment || [],
          is_available: room.is_available,
          
          todayStatus,
          targetDateStatus,
          
          currentBooking: currentBooking ? {
            id: currentBooking.id,
            purpose: currentBooking.purpose,
            start_time: currentBooking.start_time,
            end_time: currentBooking.end_time,
            start_time_local: format(convertUTCToLocal(currentBooking.start_time), 'HH:mm'),
            end_time_local: format(convertUTCToLocal(currentBooking.end_time), 'HH:mm'),
            user: currentBooking.user ? {
              full_name: currentBooking.user.full_name,
              identity_number: currentBooking.user.identity_number
            } : undefined
          } : undefined,
          
          targetDateBookings: roomBookings.map(booking => ({
            id: booking.id,
            start_time: booking.start_time,
            end_time: booking.end_time,
            start_time_local: format(convertUTCToLocal(booking.start_time), 'HH:mm'),
            end_time_local: format(convertUTCToLocal(booking.end_time), 'HH:mm'),
            purpose: booking.purpose,
            status: booking.status,
            user: booking.user ? {
              id: booking.user.id,
              full_name: booking.user.full_name,
              identity_number: booking.user.identity_number,
              study_program: booking.user.study_program ? {
                id: booking.user.study_program.id,
                name: booking.user.study_program.name,
                code: booking.user.study_program.code,
                department: booking.user.study_program.department
              } : null
            } : (booking.user_info ? {
              full_name: booking.user_info.full_name,
              identity_number: booking.user_info.identity_number,
              study_program: null
            } : null)
          })),
          
          scheduleDetails: {
            lectures: roomLectures.map(lecture => ({
              id: lecture.id,
              start_time: lecture.start_time,
              end_time: lecture.end_time,
              course_name: lecture.course_name,
              course_code: lecture.course_code,
              class: lecture.class,
              subject_study: lecture.subject_study,
              lecturer: lecture.lecturer,
              semester: lecture.semester,
              kurikulum: lecture.kurikulum,
              academics_year: lecture.academics_year,
              type: lecture.type
            })),
            
            exams: roomExams.map(exam => ({
              id: exam.id,
              start_time: exam.start_time,
              end_time: exam.end_time,
              course_name: exam.course_name,
              course_code: exam.course_code,
              class: exam.class,
              student_amount: exam.student_amount,
              lecturer_id: exam.lecturer_id,
              department_id: exam.department_id,
              study_program_id: exam.study_program_id
            })),
            
            sessions: roomSessions.map(session => ({
              id: session.id,
              start_time: session.start_time,
              end_time: session.end_time,
              start_time_local: format(new Date(`${session.date}T${session.start_time}`), 'HH:mm'),
              end_time_local: format(new Date(`${session.date}T${session.end_time}`), 'HH:mm'),
              title: session.title,
              supervisor: session.supervisor,
              examiner: session.examiner,
              secretary: session.secretary,
              student: session.student ? {
                id: session.student.id,
                full_name: session.student.full_name,
                identity_number: session.student.identity_number,
                study_program: session.student.study_program ? {
                  id: session.student.study_program.id,
                  name: session.student.study_program.name,
                  code: session.student.study_program.code,
                  department: session.student.study_program.department
                } : null
              } : null
            }))
          },
          
          futureBookings: futureStats
        };
      });

      setRooms(enhancedRooms, date);
      
      const stats = getCacheStats();
      console.log(`✅ Room data fetched successfully for ${date} (local). Cache hit rate: ${stats.hitRate.toFixed(1)}%`);
      
      return enhancedRooms;

    } catch (error: any) {
      console.error('❌ Error fetching room data:', error);
      setError(error.message || 'Failed to fetch room data');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [shouldRefresh, setRooms, getCacheStats]);

  return {
    rooms,
    loading,
    error,
    fetchRoomData,
    cacheStats: getCacheStats()
  };
};