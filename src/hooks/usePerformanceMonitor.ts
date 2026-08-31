import { useEffect } from 'react';
import { useRoomStore } from '../stores/roomStore';

export const usePerformanceMonitor = () => {
  const { getCacheStats } = useRoomStore();
  
  useEffect(() => {
    const logPerformance = () => {
      const stats = getCacheStats();
      
    };
    
    // Log performance every 30 seconds
    const interval = setInterval(logPerformance, 30000);
    
    // Log initial performance
    logPerformance();
    
    return () => clearInterval(interval);
  }, [getCacheStats]);
};