import { useState, useCallback } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { getEnhancedRoomStatus } from '../api/roomStatus';
import { format } from 'date-fns';

export const useRoomData = (targetDate?: string) => {
  const { 
    rooms, 
    setRooms, 
    shouldRefresh, 
    targetDate: storedDate 
  } = useRoomStore();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchRoomData = useCallback(async (date: string, force = false) => {
    // Smart cache check - only fetch if necessary
    if (!force && !shouldRefresh(date)) {
      console.log(`🎯 Cache hit for ${date} - using cached data`);
      return rooms;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log(`🔄 Fetching room data for ${date} (cache miss or forced)`);
      
      // Single comprehensive API call
      const enhancedRooms = await getEnhancedRoomStatus(date);
      setRooms(enhancedRooms, date);
      
      console.log(`✅ Fetched ${enhancedRooms.length} rooms for ${date}`);
      return enhancedRooms;
    } catch (err: any) {
      console.error('❌ Room data fetch error:', err);
      setError(err.message);
      return rooms; // Return cached data on error
    } finally {
      setLoading(false);
    }
  }, [rooms, shouldRefresh, setRooms]);
  
  return {
    rooms,
    loading,
    error,
    fetchRoomData,
    refreshData: (date?: string) => fetchRoomData(date || storedDate, true)
  };
};