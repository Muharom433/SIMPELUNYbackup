import { useEffect } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { supabase } from '../lib/supabase';
import { useDebouncedCallback } from 'use-debounce';

export const useRealTimeRoomUpdates = (targetDate: string) => {
  const { markStale } = useRoomStore();
  
  const debouncedRefresh = useDebouncedCallback(() => {
    console.log('📡 Real-time update triggered - marking cache as stale');
    markStale();
  }, 2000);
  
  useEffect(() => {
    console.log(`🔔 Setting up real-time subscription for ${targetDate}`);
    
    const subscription = supabase
      .channel('room-status-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings'
      }, (payload) => {
        console.log('📡 Real-time booking update received:', payload);
        
        // 🎯 FIX: Check both new and old payload to handle DELETE events
        const record = payload.new || payload.old;
        const bookingDate = record?.start_time ? 
          new Date(record.start_time).toISOString().split('T')[0] : 
          null;
        
        if (bookingDate === targetDate) {
          console.log(`🎯 Update affects target date ${targetDate} - triggering refresh`);
          debouncedRefresh();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'exams'
      }, (payload) => {
        console.log('📡 Real-time exam update received:', payload);
        
        const examDate = payload.new?.date || payload.old?.date;
        if (examDate === targetDate) {
          console.log(`🎯 Exam update affects target date ${targetDate} - triggering refresh`);
          debouncedRefresh();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'final_sessions'
      }, (payload) => {
        console.log('📡 Real-time session update received:', payload);
        
        const sessionDate = payload.new?.date || payload.old?.date;
        if (sessionDate === targetDate) {
          console.log(`🎯 Session update affects target date ${targetDate} - triggering refresh`);
          debouncedRefresh();
        }
      })
      .subscribe();
    
    return () => {
      console.log('🔌 Cleaning up real-time subscription');
      subscription.unsubscribe();
    };
  }, [targetDate, debouncedRefresh]);
};
