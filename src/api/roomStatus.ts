// ================================
// BACKEND API ENDPOINTS
// File: src/api/roomStatus.ts (atau sesuai struktur project Anda)
// ================================

import { supabase } from '../lib/supabase';

// Types untuk enhanced room status
export interface EnhancedRoomStatus {
  id: string;
  name: string;
  code: string;
  capacity: number;
  department: any;
  is_available: boolean;
  todayStatus: 'In Use' | 'Scheduled' | 'Available';
  currentBooking?: {
    id: string;
    purpose: string;
    start_time: string;
    end_time: string;
    user?: {
      full_name: string;
      identity_number: string;
    };
  };
  scheduleDetails?: {
    lectures: any[];
    exams: any[];
    sessions: any[];
  };
  futureBookings: {
    count: number;
    nextBooking?: {
      date: string;
      time: string;
      purpose: string;
      user?: string;
    };
    thisWeek: number;
    thisMonth: number;
    upcoming: FutureBooking[];
  };
}

export interface FutureBooking {
  id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  user_name?: string;
  user_identity?: string;
  relative_date: string; // "Tomorrow", "Next Monday", etc.
}

// ================================
// API FUNCTIONS
// ================================

/**
 * Get enhanced room status with today + future bookings
 */
export const getEnhancedRoomStatus = async (targetDate?: string): Promise<EnhancedRoomStatus[]> => {
  try {
    const dateParam = targetDate || new Date().toISOString().split('T')[0];
    
    // 1. Get room status untuk tanggal tertentu menggunakan function
    const { data: roomStatusData, error: statusError } = await supabase
      .rpc('get_room_status_for_date', { target_date: dateParam });
    
    if (statusError) throw statusError;

    // 2. Get room basic info
    const { data: roomsData, error: roomsError } = await supabase
      .from('rooms')
      .select(`*, department:departments(*)`)
      .eq('is_available', true)
      .order('name');
    
    if (roomsError) throw roomsError;

    // 3. Get future bookings untuk semua rooms
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(now.getMonth() + 1);
    
    const { data: futureBookingsData, error: futureError } = await supabase
      .from('bookings')
      .select(`
        id, room_id, start_time, end_time, purpose,
        user:users(full_name, identity_number)
      `)
      .eq('status', 'approved')
      .gt('start_time', now.toISOString())
      .lte('start_time', oneMonthLater.toISOString())
      .order('start_time');
    
    if (futureError) throw futureError;

    // 4. Combine data
    const enhancedRooms: EnhancedRoomStatus[] = roomsData.map(room => {
      // Find status data for this room
      const statusInfo = roomStatusData?.find(s => s.room_id === room.id);
      
      // Find future bookings for this room
      const roomFutureBookings = futureBookingsData?.filter(b => b.room_id === room.id) || [];
      
      // Calculate future booking stats
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      
      const thisWeekBookings = roomFutureBookings.filter(b => 
        new Date(b.start_time) <= nextWeek
      ).length;
      
      const nextBooking = roomFutureBookings[0]; // Already sorted by start_time
      
      // Process future bookings with relative dates
      const upcomingBookings: FutureBooking[] = roomFutureBookings.slice(0, 5).map(booking => ({
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        purpose: booking.purpose,
        user_name: booking.user?.full_name,
        user_identity: booking.user?.identity_number,
        relative_date: getRelativeDate(new Date(booking.start_time))
      }));

      return {
        id: room.id,
        name: room.name,
        code: room.code,
        capacity: room.capacity,
        department: room.department,
        is_available: room.is_available,
        todayStatus: statusInfo?.status || 'Available',
        currentBooking: statusInfo?.current_booking ? {
          id: statusInfo.current_booking.id,
          purpose: statusInfo.current_booking.purpose,
          start_time: statusInfo.current_booking.start_time,
          end_time: statusInfo.current_booking.end_time,
          user: statusInfo.current_booking.user
        } : undefined,
        scheduleDetails: statusInfo?.schedule_details,
        futureBookings: {
          count: roomFutureBookings.length,
          nextBooking: nextBooking ? {
            date: format(new Date(nextBooking.start_time), 'yyyy-MM-dd'),
            time: format(new Date(nextBooking.start_time), 'HH:mm'),
            purpose: nextBooking.purpose,
            user: nextBooking.user?.full_name
          } : undefined,
          thisWeek: thisWeekBookings,
          thisMonth: roomFutureBookings.length,
          upcoming: upcomingBookings
        }
      };
    });

    return enhancedRooms;
    
  } catch (error) {
    console.error('Error fetching enhanced room status:', error);
    throw error;
  }
};

/**
 * Get future bookings detail untuk specific room
 */
export const getRoomFutureBookings = async (roomId: string, daysAhead: number = 30): Promise<FutureBooking[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_room_future_bookings', { 
        room_id_param: roomId, 
        days_ahead: daysAhead 
      });
    
    if (error) throw error;
    
    return data.map(booking => ({
      id: booking.booking_id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      purpose: booking.purpose,
      user_name: booking.user_name,
      user_identity: booking.user_identity,
      relative_date: getRelativeDate(new Date(booking.start_time))
    }));
    
  } catch (error) {
    console.error('Error fetching room future bookings:', error);
    throw error;
  }
};

/**
 * Check room availability untuk specific date range
 */
export const checkRoomAvailability = async (
  roomId: string, 
  startDateTime: string, 
  endDateTime: string
): Promise<{
  available: boolean;
  conflicts: any[];
  suggestions?: string[];
}> => {
  try {
    // Check booking conflicts
    const { data: bookingConflicts, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'approved')
      .or(`start_time.lte.${endDateTime},end_time.gte.${startDateTime}`)
      .or(`start_time.gte.${startDateTime},start_time.lte.${endDateTime}`);
    
    if (bookingError) throw bookingError;

    // Check schedule conflicts (lectures, exams, sessions)
    const startDate = new Date(startDateTime);
    const dayName = format(startDate, 'EEEE');
    const dateString = format(startDate, 'yyyy-MM-dd');
    
    // Get room name for lecture check
    const { data: roomData } = await supabase
      .from('rooms')
      .select('name')
      .eq('id', roomId)
      .single();
    
    let scheduleConflicts = [];
    
    if (roomData) {
      // Check lecture conflicts
      const { data: lectureConflicts } = await supabase
        .from('lecture_schedules')
        .select('*')
        .ilike('room', `%${roomData.name}%`)
        .eq('day', dayName);
      
      // Check exam conflicts
      const { data: examConflicts } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', dateString);
      
      // Check session conflicts
      const { data: sessionConflicts } = await supabase
        .from('final_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', dateString);
      
      scheduleConflicts = [
        ...(lectureConflicts || []),
        ...(examConflicts || []),
        ...(sessionConflicts || [])
      ];
    }
    
    const allConflicts = [
      ...(bookingConflicts || []),
      ...scheduleConflicts
    ];
    
    return {
      available: allConflicts.length === 0,
      conflicts: allConflicts,
      suggestions: allConflicts.length > 0 ? generateTimeSuggestions(startDateTime, endDateTime) : undefined
    };
    
  } catch (error) {
    console.error('Error checking room availability:', error);
    throw error;
  }
};

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Generate relative date string (Tomorrow, Next Monday, etc.)
 */
function getRelativeDate(targetDate: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays <= 7) return format(targetDate, 'EEEE'); // Monday, Tuesday, etc.
  if (diffDays > 7 && diffDays <= 14) return `Next ${format(targetDate, 'EEEE')}`;
  
  return format(targetDate, 'MMM d, yyyy');
}

/**
 * Generate time suggestions saat ada conflict
 */
function generateTimeSuggestions(startDateTime: string, endDateTime: string): string[] {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  const duration = end.getTime() - start.getTime();
  
  const suggestions = [];
  
  // Suggest earlier times
  const earlier1 = new Date(start.getTime() - duration);
  const earlier2 = new Date(start.getTime() - duration * 2);
  
  // Suggest later times
  const later1 = new Date(end.getTime());
  const later2 = new Date(end.getTime() + duration);
  
  suggestions.push(
    `${format(earlier2, 'HH:mm')} - ${format(earlier1, 'HH:mm')}`,
    `${format(earlier1, 'HH:mm')} - ${format(start, 'HH:mm')}`,
    `${format(later1, 'HH:mm')} - ${format(later2, 'HH:mm')}`
  );
  
  return suggestions;
}

// Import format function
import { format } from 'date-fns';