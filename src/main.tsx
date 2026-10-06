import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { initializeAnalytics } from '@/lib/analytics'

// Older builds cached authenticated Supabase GET responses. Remove that cache
// before rendering so sessions on shared devices cannot receive stale data.
if ('caches' in window) void window.caches.delete('supabase-cache')

initializeAnalytics()

// Check periodically rather than clearing caches on every launch. Workbox's
// auto-update strategy activates a new shell once it has been downloaded.
registerSW({
  immediate: true,
  onRegisteredSW(_serviceWorkerUrl, registration) {
    if (!registration) return
    window.setInterval(() => {
      if (navigator.onLine) void registration.update()
    }, 60 * 60 * 1000)
  },
  onRegisterError(error) {
    console.error('Service worker registration failed', error)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
