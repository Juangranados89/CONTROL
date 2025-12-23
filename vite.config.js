import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['xlsx']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Split only the heaviest libraries to reduce initial payload.
          // Keep a single shared 'vendor' chunk for the rest of node_modules to avoid
          // circular chunk dependencies that can cause TDZ runtime errors.
          if (id.includes('/echarts/') || id.includes('echarts-for-react')) return 'echarts';
          if (id.includes('/xlsx/')) return 'xlsx';
          if (id.includes('/html2canvas/')) return 'html2canvas';

          return 'vendor';
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
})
