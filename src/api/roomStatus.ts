// ================================
// ENHANCED API ENDPOINTS FOR 2-LAYER ROOM STATUS
// File: src/api/roomStatus.ts
// ================================

import { supabase } from '../lib/supabase';
import { format, parseISO, startOfDay, endOfDay, addDays } from 'date-fns';

// Enhanced interfaces for 2-layer status
export interface EnhancedRoomStatus {
  id: string;
  name: string;
  code: string;
  capacity: number;
  department: any;
  equipment: string[];
  is_available: boolean;
  
  // 2-LAYER STATUS
  todayStatus: 'In Use' | 'Scheduled' | 'Available';
  targetDateStatus: 'Scheduled' | 'Available';
  
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
  targetDateBookings: any[];
  scheduleDetails: {
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
// ENHANCED API FUNCTIONS
// ================================

/**
 * Get enhanced room status with 2-layer logic
 */
export const getEnhancedRoomStatus = async (targetDate?: string): Promise<EnhancedRoomStatus[]> => {
  try {
    const dateParam = targetDate || format(new Date(), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');
    const isToday = dateParam === today;
    
    // 1. Get room basic info
    const { data: roomsData, error: roomsError } = await supabase
      .from('rooms')
      .select(`*, department:departments(*)`)
      .eq('is_available', true)
      .order('name');
    
    if (roomsError) throw roomsError;
    if (!roomsData) return [];

    // 2. Process each room for enhanced status
    const enhancedRooms = await Promise.all(
      roomsData.map(async (room) => {
        return await getEnhancedRoomStatusSingle(room, dateParam, isToday);
      })
    );

    return enhancedRooms;
    
  } catch (error) {
    console.error('Error fetching enhanced room status:', error);
    throw error;
  }
};

/**
 * Get enhanced status for a single room
 */
export const getEnhancedRoomStatusSingle = async (
  room: any, 
  targetDate: string, 
  isToday: boolean = false
): Promise<EnhancedRoomStatus> => {
  try {
    // Layer 1: Today Status (Real-time) - only if checking today
    let todayStatus: 'In Use' | 'Scheduled' | 'Available' = 'Available';
    let currentBooking = null;

    if (isToday) {
      // Check current active bookings
      const now = new Date();
      const { data: activeBookings } = await supabase
        .from('bookings')
        .select(`
          *,
          user:users(full_name, identity_number)
        `)
        .eq('room_id', room.id)
        .eq('status', 'approved')
        .lte('start_time', now.toISOString())
        .gte('end_time', now.toISOString())
        .limit(1);

      if (activeBookings && activeBookings.length > 0) {
        todayStatus = 'In Use';
        currentBooking = activeBookings[0];
      } else {
        // Check if room has any scheduled events today
        const hasScheduleToday = await checkScheduledEventsForDate(room, targetDate);
        if (hasScheduleToday) {
          todayStatus = 'Scheduled';
        }
      }
    }

    // Layer 2: Target Date Status
    let targetDateStatus: 'Scheduled' | 'Available' = 'Available';
    let targetDateBookings = [];
    let scheduleDetails = { lectures: [], exams: [], sessions: [] };

    // Check bookings for target date
    const startOfTargetDate = startOfDay(parseISO(targetDate));
    const endOfTargetDate = endOfDay(parseISO(targetDate));

    const { data: dateBookings } = await supabase
      .from('bookings')
      .select(`
        *,
        user:users(full_name, identity_number)
      `)
      .eq('room_id', room.id)
      .eq('status', 'approved')
      .gte('start_time', startOfTargetDate.toISOString())
      .lte('start_time', endOfTargetDate.toISOString());

    if (dateBookings && dateBookings.length > 0) {
      targetDateStatus = 'Scheduled';
      targetDateBookings = dateBookings;
    }

    // Check scheduled events for target date
    const scheduleData = await getScheduleDetailsForDate(room, targetDate);
    if (scheduleData.lectures.length > 0 || scheduleData.exams.length > 0 || scheduleData.sessions.length > 0) {
      targetDateStatus = 'Scheduled';
      scheduleDetails = scheduleData;
    }

    // Get future bookings analytics
    const futureBookings = await getFutureBookingsAnalytics(room.id);

    return {
      ...room,
      todayStatus,
      targetDateStatus,
      currentBooking,
      targetDateBookings,
      scheduleDetails,
      futureBookings,
    };
  } catch (error) {
    console.error('Error getting enhanced room status for single room:', error);
    return {
      ...room,
      todayStatus: 'Available',
      targetDateStatus: 'Available',
      targetDateBookings: [],
      scheduleDetails: { lectures: [], exams: [], sessions: [] },
      futureBookings: { count: 0, thisWeek: 0, thisMonth: 0, upcoming: [] },
    };
  }
};

/**
 * Check scheduled events for a room on a specific date
 */
export const checkScheduledEventsForDate = async (room: any, date: string): Promise<boolean> => {
  try {
    const dayName = format(parseISO(date), 'EEEE');
    
    // Check lecture schedules
    const { data: lectures } = await supabase
      .from('lecture_schedules')
      .select('*')
      .ilike('room', `%${room.name}%`)
      .eq('day', dayName);

    // Check exams
    const { data: exams } = await supabase
      .from('exams')
      .select('*')
      .eq('room_id', room.id)
      .eq('date', date);

    // Check final sessions
    const { data: sessions } = await supabase
      .from('final_sessions')
      .select('*')
      .eq('room_id', room.id)
      .eq('date', date);

    return (lectures && lectures.length > 0) || 
           (exams && exams.length > 0) || 
           (sessions && sessions.length > 0);
  } catch (error) {
    console.error('Error checking scheduled events:', error);
    return false;
  }
};

/**
 * Get detailed schedule information for a specific date
 */
export const getScheduleDetailsForDate = async (room: any, date: string) => {
  try {
    const dayName = format(parseISO(date), 'EEEE');
    
    // Get lecture schedules
    const { data: lectures } = await supabase
      .from('lecture_schedules')
      .select('*')
      .ilike('room', `%${room.name}%`)
      .eq('day', dayName);

    // Get exams
    const { data: exams } = await supabase
      .from('exams')
      .select('*')
      .eq('room_id', room.id)
      .eq('date', date);

    // Get final sessions
    const { data: sessions } = await supabase
      .from('final_sessions')
      .select('*')
      .eq('room_id', room.id)
      .eq('date', date);

    return {
      lectures: lectures || [],
      exams: exams || [],
      sessions: sessions || [],
    };
  } catch (error) {
    console.error('Error getting schedule details:', error);
    return { lectures: [], exams: [], sessions: [] };
  }
};

/**
 * Get future bookings analytics for a room
 */
export const getFutureBookingsAnalytics = async (roomId: string) => {
  try {
    const now = new Date();
    const oneWeekLater = addDays(now, 7);
    const oneMonthLater = addDays(now, 30);

    const { data: futureBookings } = await supabase
      .from('bookings')
      .select(`
        *,
        user:users(full_name, identity_number)
      `)
      .eq('room_id', roomId)
      .eq('status', 'approved')
      .gt('start_time', now.toISOString())
      .lte('start_time', oneMonthLater.toISOString())
      .order('start_time');

    if (!futureBookings) {
      return { count: 0, thisWeek: 0, thisMonth: 0, upcoming: [] };
    }

    const thisWeekBookings = futureBookings.filter(b => 
      parseISO(b.start_time) <= oneWeekLater
    );

    const nextBooking = futureBookings[0];

    const upcomingBookings: FutureBooking[] = futureBookings.slice(0, 5).map(booking => ({
      id: booking.id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      purpose: booking.purpose,
      user_name: booking.user?.full_name,
      user_identity: booking.user?.identity_number,
      relative_date: getRelativeDate(parseISO(booking.start_time))
    }));

    return {
      count: futureBookings.length,
      nextBooking: nextBooking ? {
        date: format(parseISO(nextBooking.start_time), 'yyyy-MM-dd'),
        time: format(parseISO(nextBooking.start_time), 'HH:mm'),
        purpose: nextBooking.purpose,
        user: nextBooking.user?.full_name,
      } : undefined,
      thisWeek: thisWeekBookings.length,
      thisMonth: futureBookings.length,
      upcoming: upcomingBookings,
    };
  } catch (error) {
    console.error('Error getting future bookings analytics:', error);
    return { count: 0, thisWeek: 0, thisMonth: 0, upcoming: [] };
  }
};

/**
 * Check room availability for specific date range
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
    const startDate = parseISO(startDateTime);
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
 * Generate time suggestions when there are conflicts
 */
function generateTimeSuggestions(startDateTime: string, endDateTime: string): string[] {
  const start = parseISO(startDateTime);
  const end = parseISO(endDateTime);
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

/**
 * Get future bookings detail for specific room
 */
export const getRoomFutureBookings = async (roomId: string, daysAhead: number = 30): Promise<FutureBooking[]> => {
  try {
    const now = new Date();
    const futureDate = addDays(now, daysAhead);
    
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        user:users(full_name, identity_number)
      `)
      .eq('room_id', roomId)
      .eq('status', 'approved')
      .gt('start_time', now.toISOString())
      .lte('start_time', futureDate.toISOString())
      .order('start_time');
    
    if (error) throw error;
    
    return (data || []).map(booking => ({
      id: booking.id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      purpose: booking.purpose,
      user_name: booking.user?.full_name,
      user_identity: booking.user?.identity_number,
      relative_date: getRelativeDate(parseISO(booking.start_time))
    }));
    
  } catch (error) {
    console.error('Error fetching room future bookings:', error);
    throw error;
  }
};