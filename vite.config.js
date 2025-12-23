import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['xlsx']
  },
  build: {
    // Disable manualChunks to let Vite/Rollup handle splitting automatically.
    // This is often the most stable configuration for complex dependency trees.
    chunkSizeWarningLimit: 2000
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
