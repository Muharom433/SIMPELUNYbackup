import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const DEFAULT_SUPABASE_URL = 'https://nfoarhurrdelgkrxnwnn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mb2FyaHVycmRlbGdrcnhud25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMzg0NzMsImV4cCI6MjA2NTYxNDQ3M30.7qXZVJuRggQJ6FE5xiP48Kbe8qMYzOKVGqcXIgI1ZMU';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      // Memberi tahu PostgREST bahwa ini adalah admin request (opsional, untuk logging)
      'X-Client-Info': 'simpelny-admin/1.0',
    },
    // Timeout global: 30 detik per request (default Supabase = 8 detik)
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      // Set timeout 30 detik untuk admin query yang berat
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 5, // Batasi realtime events agar tidak overload
    },
  },
});