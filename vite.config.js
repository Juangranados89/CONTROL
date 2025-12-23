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

          // Split only the heaviest libraries to reduce initial payload,
          // but avoid forcing a global vendor/react split (can create circular chunk deps).
          if (id.includes('/echarts/') || id.includes('echarts-for-react')) return 'echarts';
          if (id.includes('/xlsx/')) return 'xlsx';
          if (id.includes('/html2canvas/')) return 'html2canvas';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts';

          // Let Rollup decide the rest.
          return;
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
