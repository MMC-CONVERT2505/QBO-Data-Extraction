import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/qbo-data-extraction/",
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7002',
        changeOrigin: true,
        credentials: true,
      }
    }
  }
})