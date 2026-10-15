import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/rest': {
        target: 'https://simpel.vokasiuny.my.id',
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: 'https://simpel.vokasiuny.my.id',
        changeOrigin: true,
        secure: false,
      },
      '/storage': {
        target: 'https://simpel.vokasiuny.my.id',
        changeOrigin: true,
        secure: false,
      },
      '/realtime': {
        target: 'https://simpel.vokasiuny.my.id',
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
});
