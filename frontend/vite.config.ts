import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    // Same-origin /api in dev, so the Django backend needs no CORS setup.
    server: { proxy: { '/api': env.BACKEND_URL || 'http://127.0.0.1:8000' } },
  }
})
