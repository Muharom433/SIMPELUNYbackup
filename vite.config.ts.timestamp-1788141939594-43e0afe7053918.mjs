// vite.config.ts
import { defineConfig } from "file:///D:/MODUL_PROJEK%20-%20Copy%20-%20Copy/SIMPELUNYbackup/node_modules/vite/dist/node/index.js";
import react from "file:///D:/MODUL_PROJEK%20-%20Copy%20-%20Copy/SIMPELUNYbackup/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor": ["react", "react-dom", "react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "ui-vendors": ["react-select", "react-datepicker", "lucide-react"],
          "charts": ["recharts"],
          "forms": ["react-hook-form", "zod"],
          "utils": ["date-fns", "date-fns-tz", "papaparse"]
        }
      }
    },
    chunkSizeWarningLimit: 1e3,
    minify: "esbuild"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxNT0RVTF9QUk9KRUsgLSBDb3B5IC0gQ29weVxcXFxTSU1QRUxVTlliYWNrdXBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXE1PRFVMX1BST0pFSyAtIENvcHkgLSBDb3B5XFxcXFNJTVBFTFVOWWJhY2t1cFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovTU9EVUxfUFJPSkVLJTIwLSUyMENvcHklMjAtJTIwQ29weS9TSU1QRUxVTlliYWNrdXAvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3JlYWN0KCldLFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgZXhjbHVkZTogWydsdWNpZGUtcmVhY3QnXSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgJ3ZlbmRvcic6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcclxuICAgICAgICAgICdzdXBhYmFzZSc6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXHJcbiAgICAgICAgICAndWktdmVuZG9ycyc6IFsncmVhY3Qtc2VsZWN0JywgJ3JlYWN0LWRhdGVwaWNrZXInLCAnbHVjaWRlLXJlYWN0J10sXHJcbiAgICAgICAgICAnY2hhcnRzJzogWydyZWNoYXJ0cyddLFxyXG4gICAgICAgICAgJ2Zvcm1zJzogWydyZWFjdC1ob29rLWZvcm0nLCAnem9kJ10sXHJcbiAgICAgICAgICAndXRpbHMnOiBbJ2RhdGUtZm5zJywgJ2RhdGUtZm5zLXR6JywgJ3BhcGFwYXJzZSddLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsXHJcbiAgfSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBdVUsU0FBUyxvQkFBb0I7QUFDcFcsT0FBTyxXQUFXO0FBR2xCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsVUFDWixVQUFVLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQ25ELFlBQVksQ0FBQyx1QkFBdUI7QUFBQSxVQUNwQyxjQUFjLENBQUMsZ0JBQWdCLG9CQUFvQixjQUFjO0FBQUEsVUFDakUsVUFBVSxDQUFDLFVBQVU7QUFBQSxVQUNyQixTQUFTLENBQUMsbUJBQW1CLEtBQUs7QUFBQSxVQUNsQyxTQUFTLENBQUMsWUFBWSxlQUFlLFdBQVc7QUFBQSxRQUNsRDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSx1QkFBdUI7QUFBQSxJQUN2QixRQUFRO0FBQUEsRUFDVjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
