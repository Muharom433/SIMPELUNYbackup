// src/hooks/useRoomData.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRoomStore, EnhancedRoomStatus } from '../stores/roomStore';
import { format, parseISO, isToday, isSameDay } from 'date-fns';

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
      console.log(`🏢 Fetching room data for ${date}...`);
      
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

      // 2. FETCH BOOKINGS dengan relasi user dan study program LENGKAP
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
          study_program_id,
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
        .gte('end_time', `${date}T00:00:00`)
        .lte('start_time', `${date}T23:59:59`)
        .in('status', ['confirmed', 'pending', 'active']);

      if (bookingsError) throw bookingsError;

      // 3. FETCH FINAL SESSIONS dengan relasi student dan study program LENGKAP
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

      // 4. FETCH LECTURE SCHEDULES dengan proper mapping
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
          study_program:study_programs!study_program_id(
            id,
            name,
            code,
            department:departments(name)
          )
        `)
        .eq('day', dayName);

      if (lecturesError) throw lecturesError;

      // 5. FETCH EXAM SCHEDULES dengan relasi study program
      const { data: examsData, error: examsError } = await supabase
        .from('exam_schedules')
        .select(`
          id,
          room,
          date,
          start_time,
          end_time,
          course_name,
          course_code,
          class,
          subject_study,
          student_amount,
          supervisor,
          study_program:study_programs!study_program_id(
            id,
            name,
            code,
            department:departments(name)
          )
        `)
        .eq('date', date);

      if (examsError) throw examsError;

      // 6. FETCH CURRENT BOOKINGS (untuk status "In Use")
      const now = new Date();
      const currentTime = format(now, 'HH:mm:ss');
      const today = format(now, 'yyyy-MM-dd');
      
      let currentBookingsData = [];
      if (date === today) {
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
          .eq('date', today)
          .lte('start_time', currentTime)
          .gte('end_time', currentTime)
          .eq('status', 'active');

        if (!currentError) {
          currentBookingsData = currentData || [];
        }
      }

      // 7. FETCH FUTURE BOOKINGS untuk statistik
      const { data: futureBookingsData, error: futureError } = await supabase
        .from('bookings')
        .select(`
          id,
          room_id,
          start_time,
          end_time,
          purpose,
          date,
          user:users!user_id(
            full_name,
            study_program:study_programs(name)
          )
        `)
        .gt('date', date)
        .in('status', ['confirmed', 'pending'])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (futureError) console.warn('Future bookings fetch error:', futureError);

      // 8. PROCESS DATA menjadi EnhancedRoomStatus
      const enhancedRooms: EnhancedRoomStatus[] = (roomsData || []).map(room => {
        // Group bookings by room
        const roomBookings = (bookingsData || []).filter(booking => booking.room_id === room.id);
        
        // Group sessions by room
        const roomSessions = (sessionsData || []).filter(session => session.room_id === room.id);
        
        // Group lectures by room (match by room name)
        const roomLectures = (lecturesData || []).filter(lecture => 
          lecture.room.toLowerCase() === room.name.toLowerCase()
        );
        
        // Group exams by room (match by room name)
        const roomExams = (examsData || []).filter(exam => 
          exam.room.toLowerCase() === room.name.toLowerCase()
        );

        // Current booking untuk room ini
        const currentBooking = currentBookingsData.find(booking => booking.room_id === room.id);

        // Future bookings untuk room ini
        const roomFutureBookings = (futureBookingsData || []).filter(booking => booking.room_id === room.id);

        // Calculate future booking stats
        const thisWeekEnd = new Date();
        thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
        const thisMonthEnd = new Date();
        thisMonthEnd.setMonth(thisMonthEnd.getMonth() + 1);

        const futureStats = {
          count: roomFutureBookings.length,
          nextBooking: roomFutureBookings.length > 0 ? {
            date: roomFutureBookings[0].date,
            time: `${roomFutureBookings[0].start_time} - ${roomFutureBookings[0].end_time}`,
            purpose: roomFutureBookings[0].purpose,
            user: roomFutureBookings[0].user?.full_name
          } : undefined,
          thisWeek: roomFutureBookings.filter(b => new Date(b.date) <= thisWeekEnd).length,
          thisMonth: roomFutureBookings.filter(b => new Date(b.date) <= thisMonthEnd).length,
          upcoming: roomFutureBookings.slice(0, 5) // Next 5 bookings
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
            user: currentBooking.user ? {
              full_name: currentBooking.user.full_name,
              identity_number: currentBooking.user.identity_number
            } : undefined
          } : undefined,
          
          targetDateBookings: roomBookings.map(booking => ({
            id: booking.id,
            start_time: booking.start_time,
            end_time: booking.end_time,
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
              study_program: null // Will be resolved separately if needed
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
              study_program: lecture.study_program ? {
                id: lecture.study_program.id,
                name: lecture.study_program.name,
                code: lecture.study_program.code,
                department: lecture.study_program.department
              } : null
            })),
            
            exams: roomExams.map(exam => ({
              id: exam.id,
              start_time: exam.start_time,
              end_time: exam.end_time,
              course_name: exam.course_name,
              course_code: exam.course_code,
              class: exam.class,
              subject_study: exam.subject_study,
              student_amount: exam.student_amount,
              supervisor: exam.supervisor,
              study_program: exam.study_program ? {
                id: exam.study_program.id,
                name: exam.study_program.name,
                code: exam.study_program.code,
                department: exam.study_program.department
              } : null
            })),
            
            sessions: roomSessions.map(session => ({
              id: session.id,
              start_time: session.start_time,
              end_time: session.end_time,
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
      console.log(`✅ Room data fetched successfully for ${date}. Cache hit rate: ${stats.hitRate.toFixed(1)}%`);
      
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