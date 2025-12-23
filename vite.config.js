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

          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts';
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
