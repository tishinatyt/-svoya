import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/-svoya/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  build: {
    rollupOptions: {
      output: { manualChunks(id) { if (id.includes('@supabase')) return 'supabase' } },
    },
  },
})
