import { create } from 'zustand';
import { format } from 'date-fns';

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
    upcoming: any[];
  };
}

interface RoomDataStore {
  rooms: EnhancedRoomStatus[];
  lastFetch: Date;
  isStale: boolean;
  targetDate: string;
  cacheHits: number;
  apiCalls: number;
  
  // Actions
  setRooms: (rooms: EnhancedRoomStatus[], targetDate: string) => void;
  markStale: () => void;
  updateRoomStatus: (roomId: string, updates: Partial<EnhancedRoomStatus>) => void;
  shouldRefresh: (targetDate: string) => boolean;
  incrementCacheHit: () => void;
  incrementApiCall: () => void;
  getCacheStats: () => { hitRate: number; totalCalls: number };
}

export const useRoomStore = create<RoomDataStore>((set, get) => ({
  rooms: [],
  lastFetch: new Date(0),
  isStale: true,
  targetDate: format(new Date(), 'yyyy-MM-dd'),
  cacheHits: 0,
  apiCalls: 0,
  
  setRooms: (rooms: EnhancedRoomStatus[], targetDate: string) => {
    set({ 
      rooms, 
      lastFetch: new Date(), 
      isStale: false,
      targetDate
    });
    get().incrementApiCall();
  },
  
  markStale: () => set({ isStale: true }),
  
  updateRoomStatus: (roomId: string, updates: Partial<EnhancedRoomStatus>) => {
    const { rooms } = get();
    const updatedRooms = rooms.map(room => 
      room.id === roomId ? { ...room, ...updates } : room
    );
    set({ rooms: updatedRooms });
  },
  
  shouldRefresh: (targetDate: string) => {
    const { lastFetch, isStale, targetDate: storedDate } = get();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    const isExpired = (Date.now() - lastFetch.getTime()) > CACHE_DURATION;
    const isDateChanged = targetDate !== storedDate;
    
    if (!isExpired && !isDateChanged && !isStale) {
      get().incrementCacheHit();
      return false;
    }
    
    return isStale || isExpired || isDateChanged;
  },
  
  incrementCacheHit: () => set(state => ({ cacheHits: state.cacheHits + 1 })),
  incrementApiCall: () => set(state => ({ apiCalls: state.apiCalls + 1 })),
  
  getCacheStats: () => {
    const { cacheHits, apiCalls } = get();
    const totalRequests = cacheHits + apiCalls;
    return {
      hitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
      totalCalls: totalRequests
    };
  }
}));