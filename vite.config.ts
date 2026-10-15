import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseTarget = env.VITE_SUPABASE_URL || 'https://nfoarhurrdelgkrxnwnn.supabase.co';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/rest': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
        },
        '/auth': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
        },
        '/storage': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
        },
        '/realtime': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'ui-vendors': ['react-select', 'react-datepicker', 'lucide-react'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', 'zod'],
          'utils': ['date-fns', 'date-fns-tz', 'papaparse'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
  },
  };
});
