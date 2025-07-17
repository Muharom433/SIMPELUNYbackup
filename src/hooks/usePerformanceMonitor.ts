import { useEffect } from 'react';
import { useRoomStore } from '../stores/roomStore';

export const usePerformanceMonitor = () => {
  const { getCacheStats } = useRoomStore();
  
  useEffect(() => {
    const logPerformance = () => {
      const stats = getCacheStats();
      
      console.log('📊 Performance Metrics:', {
        cacheHitRate: `${stats.hitRate.toFixed(1)}%`,
        totalRequests: stats.totalCalls,
        memoryUsage: (performance as any).memory?.usedJSHeapSize ? 
          `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB` : 
          'N/A',
        timestamp: new Date().toISOString()
      });
    };
    
    // Log performance every 30 seconds
    const interval = setInterval(logPerformance, 30000);
    
    // Log initial performance
    logPerformance();
    
    return () => clearInterval(interval);
  }, [getCacheStats]);
};