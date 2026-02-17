import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface RoomConflict {
  type: 'lecture' | 'exam' | 'session' | 'booking';
  title: string;
  startTime: string;
  endTime: string;
  details?: string;
}

interface RoomAvailabilityResult {
  isAvailable: boolean;
  conflicts: RoomConflict[];
  reason?: string;
}

interface FilterParams {
  date: string;           // yyyy-MM-dd format
  startTime: string;      // HH:mm format
  endTime: string;        // HH:mm format
  excludeSessionId?: string; // For editing existing sessions
}

/**
 * ✅ COMPREHENSIVE ROOM AVAILABILITY CHECKER
 * Checks all 6 criteria for room availability
 */
export class RoomAvailabilityChecker {

  /**
   * 1️⃣ Check if room is available for booking
   */
  private static checkRoomEnabled(room: any): boolean {
    return room.is_available === true;
  }

  /**
   * 2️⃣ Check lecture schedule conflicts
   */
  private static async checkLectureConflicts(
    roomName: string,
    params: FilterParams
  ): Promise<RoomConflict[]> {
    try {
      // Get day name in Indonesian
      const dateObj = new Date(params.date);
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[dateObj.getDay()];

      const { data: lectures, error } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', dayName)
        .ilike('room', `%${roomName}%`);

      if (error) throw error;

      const conflicts: RoomConflict[] = [];

      for (const lecture of lectures || []) {
        if (this.isTimeOverlap(
          params.startTime,
          params.endTime,
          lecture.start_time?.substring(0, 5) || '',
          lecture.end_time?.substring(0, 5) || ''
        )) {
          conflicts.push({
            type: 'lecture',
            title: lecture.course_name || 'Kuliah',
            startTime: lecture.start_time?.substring(0, 5) || '',
            endTime: lecture.end_time?.substring(0, 5) || '',
            details: `${lecture.class} • ${lecture.subject_study} • ${lecture.lecturer || 'TBA'}`
          });
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error checking lecture conflicts:', error);
      return [];
    }
  }

  /**
   * 3️⃣ Check exam schedule conflicts
   */
  private static async checkExamConflicts(
    roomId: string,
    params: FilterParams
  ): Promise<RoomConflict[]> {
    try {
      const { data: exams, error } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', params.date);

      if (error) throw error;

      const conflicts: RoomConflict[] = [];

      for (const exam of exams || []) {
        // Skip take-home exams (no time conflict)
        if (exam.is_take_home) continue;

        if (this.isTimeOverlap(
          params.startTime,
          params.endTime,
          exam.start_time?.substring(0, 5) || '',
          exam.end_time?.substring(0, 5) || ''
        )) {
          conflicts.push({
            type: 'exam',
            title: exam.course_name || 'Ujian',
            startTime: exam.start_time?.substring(0, 5) || '',
            endTime: exam.end_time?.substring(0, 5) || '',
            details: `${exam.class} • ${exam.student_amount} mahasiswa • ${exam.inspector || 'TBA'}`
          });
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error checking exam conflicts:', error);
      return [];
    }
  }

  /**
   * 4️⃣ Check session schedule conflicts
   */
  private static async checkSessionConflicts(
    roomId: string,
    params: FilterParams
  ): Promise<RoomConflict[]> {
    try {
      let query = supabase
        .from('final_sessions')
        .select(`
          *,
          student:users!student_id(full_name, identity_number)
        `)
        .eq('room_id', roomId)
        .eq('date', params.date);

      // Exclude current session if editing
      if (params.excludeSessionId) {
        query = query.neq('id', params.excludeSessionId);
      }

      const { data: sessions, error } = await query;

      if (error) throw error;

      const conflicts: RoomConflict[] = [];

      for (const session of sessions || []) {
        if (this.isTimeOverlap(
          params.startTime,
          params.endTime,
          session.start_time?.substring(0, 5) || '',
          session.end_time?.substring(0, 5) || ''
        )) {
          conflicts.push({
            type: 'session',
            title: `Sidang ${session.student?.full_name || 'Mahasiswa'}`,
            startTime: session.start_time?.substring(0, 5) || '',
            endTime: session.end_time?.substring(0, 5) || '',
            details: `${session.student?.identity_number || ''} • ${session.supervisor}`
          });
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error checking session conflicts:', error);
      return [];
    }
  }

  /**
   * 5️⃣ Check booking conflicts
   */
  private static async checkBookingConflicts(
    roomId: string,
    params: FilterParams
  ): Promise<RoomConflict[]> {
    try {
      // Create UTC range for the target date
      // We need to check ALL bookings that overlap with this date
      // Not just bookings that START on this date
      const targetDateStart = new Date(`${params.date}T00:00:00`).toISOString();
      const targetDateEnd = new Date(`${params.date}T23:59:59`).toISOString();

      // Query for bookings where:
      // - booking starts before or on target date END
      // - booking ends after or on target date START
      // This catches all bookings that are active during the target date
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          user:users!user_id(full_name, identity_number)
        `)
        .eq('room_id', roomId)
        .in('status', ['approved', 'borrowed']) // Check approved and borrowed bookings
        .lte('start_time', targetDateEnd)  // Booking starts before or during target date
        .gte('end_time', targetDateStart); // Booking ends during or after target date

      if (error) throw error;

      const conflicts: RoomConflict[] = [];

      for (const booking of bookings || []) {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);

        // Check if this booking is actually on the target date
        const targetDate = new Date(params.date);
        const bookingStartDate = new Date(bookingStart.toDateString());
        const bookingEndDate = new Date(bookingEnd.toDateString());
        const targetDateOnly = new Date(targetDate.toDateString());

        // Only process if booking overlaps with target date
        if (bookingStartDate <= targetDateOnly && bookingEndDate >= targetDateOnly) {
          // For the target date, determine the effective time range
          let effectiveStartTime: string;
          let effectiveEndTime: string;

          // If booking starts on target date, use actual start time
          // Otherwise, it started before, so use 00:00
          if (bookingStartDate.getTime() === targetDateOnly.getTime()) {
            effectiveStartTime = format(bookingStart, 'HH:mm');
          } else {
            effectiveStartTime = '00:00';
          }

          // If booking ends on target date, use actual end time
          // Otherwise, it ends later, so use 23:59
          if (bookingEndDate.getTime() === targetDateOnly.getTime()) {
            effectiveEndTime = format(bookingEnd, 'HH:mm');
          } else {
            effectiveEndTime = '23:59';
          }

          if (this.isTimeOverlap(
            params.startTime,
            params.endTime,
            effectiveStartTime,
            effectiveEndTime
          )) {
            // Calculate total booking duration in days
            const durationDays = Math.ceil((bookingEnd.getTime() - bookingStart.getTime()) / (1000 * 60 * 60 * 24));
            const isMultiDay = durationDays > 1;

            conflicts.push({
              type: 'booking',
              title: booking.purpose || 'Pemesanan Ruangan',
              startTime: effectiveStartTime,
              endTime: effectiveEndTime,
              details: `${booking.user?.full_name || 'User'} • ${booking.user?.identity_number || ''}${isMultiDay ? ` • ${durationDays} hari` : ''}`
            });
          }
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error checking booking conflicts:', error);
      return [];
    }
  }

  /**
   * 🔧 Helper: Check if two time ranges overlap
   */
  private static isTimeOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    if (!start1 || !end1 || !start2 || !end2) return false;

    // Convert HH:mm to minutes for easier comparison
    const toMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const start1Min = toMinutes(start1);
    const end1Min = toMinutes(end1);
    const start2Min = toMinutes(start2);
    const end2Min = toMinutes(end2);

    // Check overlap: start1 < end2 && start2 < end1
    return start1Min < end2Min && start2Min < end1Min;
  }

  /**
   * 🎯 MAIN METHOD: Check room availability
   */
  public static async checkRoomAvailability(
    room: any,
    params: FilterParams
  ): Promise<RoomAvailabilityResult> {
    // 1️⃣ Check if room is enabled
    if (!this.checkRoomEnabled(room)) {
      return {
        isAvailable: false,
        conflicts: [],
        reason: 'Ruangan dinonaktifkan untuk pemesanan'
      };
    }

    // Collect all conflicts
    const allConflicts: RoomConflict[] = [];

    try {
      // 2️⃣ Check lecture conflicts
      const lectureConflicts = await this.checkLectureConflicts(room.name, params);
      allConflicts.push(...lectureConflicts);

      // 3️⃣ Check exam conflicts
      const examConflicts = await this.checkExamConflicts(room.id, params);
      allConflicts.push(...examConflicts);

      // 4️⃣ Check session conflicts
      const sessionConflicts = await this.checkSessionConflicts(room.id, params);
      allConflicts.push(...sessionConflicts);

      // 5️⃣ Check booking conflicts
      const bookingConflicts = await this.checkBookingConflicts(room.id, params);
      allConflicts.push(...bookingConflicts);

      // 6️⃣ Determine availability
      const isAvailable = allConflicts.length === 0;

      let reason: string | undefined;
      if (!isAvailable) {
        const conflictTypes = [...new Set(allConflicts.map(c => c.type))];
        const typeNames = {
          lecture: 'Kuliah',
          exam: 'Ujian',
          session: 'Sidang',
          booking: 'Pemesanan'
        };

        reason = `Bertabrakan dengan: ${conflictTypes.map(t => typeNames[t]).join(', ')}`;
      }

      return {
        isAvailable,
        conflicts: allConflicts,
        reason
      };

    } catch (error) {
      console.error('Error checking room availability:', error);
      return {
        isAvailable: false,
        conflicts: [],
        reason: 'Error checking availability'
      };
    }
  }

  /**
   * 🚀 BATCH METHOD: Filter available rooms from a list
   */
  public static async filterAvailableRooms(
    rooms: any[],
    params: FilterParams
  ): Promise<{ available: any[], unavailable: Array<{ room: any, result: RoomAvailabilityResult }> }> {
    const available: any[] = [];
    const unavailable: Array<{ room: any, result: RoomAvailabilityResult }> = [];

    // Process rooms in parallel for better performance
    const results = await Promise.allSettled(
      rooms.map(async (room) => {
        const result = await this.checkRoomAvailability(room, params);
        return { room, result };
      })
    );

    results.forEach((promiseResult) => {
      if (promiseResult.status === 'fulfilled') {
        const { room, result } = promiseResult.value;

        if (result.isAvailable) {
          available.push(room);
        } else {
          unavailable.push({ room, result });
        }
      }
    });

    return { available, unavailable };
  }
}