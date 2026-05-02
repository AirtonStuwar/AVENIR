import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/ruc': {
          target: 'https://api.decolecta.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ruc/, '/v1/sunat/ruc'),
          headers: {
            Authorization: `Bearer ${env.DECOLECTA_API_KEY}`,
          },
        },
      },
    },
  }
})
