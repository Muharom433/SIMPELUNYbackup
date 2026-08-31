import { useEffect } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { supabase } from '../lib/supabase';
import { useDebouncedCallback } from 'use-debounce';

export const useRealTimeRoomUpdates = (targetDate: string) => {
  const { markStale } = useRoomStore();
  
  const debouncedRefresh = useDebouncedCallback(() => {
    markStale();
  }, 2000);
  
  useEffect(() => {
    
    const subscription = supabase
      .channel('room-status-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings'
      }, (payload) => {
        
        const record = payload.new || payload.old;
        const bookingDate = record?.start_time ? 
          new Date(record.start_time).toISOString().split('T')[0] : 
          null;
        
        if (bookingDate === targetDate) {
          debouncedRefresh();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'exams'
      }, (payload) => {
        
        const examDate = payload.new?.date || payload.old?.date;
        if (examDate === targetDate) {
          debouncedRefresh();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'final_sessions'
      }, (payload) => {
        
        const sessionDate = payload.new?.date || payload.old?.date;
        if (sessionDate === targetDate) {
          debouncedRefresh();
        }
      })
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [targetDate, debouncedRefresh]);
};
