import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 确保 Electron 能够加载资源
  build: {
    outDir: 'dist_renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  }
})
