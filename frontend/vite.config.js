import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxies API calls through Vite's own dev server to the backend, so
    // the browser sees everything as one origin (http://localhost:5173)
    // instead of two (5173 + 8000). This matters because the session
    // cookie uses SameSite=Lax, which browsers won't attach to genuinely
    // cross-site fetch() calls -- only to same-site ones. This makes local
    // dev behave the same way production already does behind Caddy.
    proxy: {
      '/customers': 'http://localhost:8000',
      '/services': 'http://localhost:8000',
      '/products': 'http://localhost:8000',
      '/orders': 'http://localhost:8000',
      '/analytics': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
    },
  },
})