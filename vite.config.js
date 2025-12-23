import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['xlsx']
  },
  build: {
    // Let Rollup decide chunk splitting automatically to avoid TDZ circular dependency issues.
    // Previously we tried manualChunks but it caused "Cannot access 'X' before initialization" errors.
    chunkSizeWarningLimit: 1200
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
