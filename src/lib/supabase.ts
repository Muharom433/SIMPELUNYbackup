import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

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