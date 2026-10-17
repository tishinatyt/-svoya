import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './site/globals.css'
import App from './App'
import { siteUrl } from './lib/site-path'

// Replace only this application's former Workbox worker. The original club's
// worker handles notifications without caching private pages or API responses.
// Reuse the same scope; never touch workers belonging to other Pages projects.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(siteUrl('/svoya-sw.js'), {
      scope: siteUrl('/'), updateViaCache: 'none',
    }).catch(error => console.warn('СВОЯ: service worker unavailable', error))
  }, { once: true })
}

const root = document.getElementById('root')!
const app = <StrictMode><App /></StrictMode>
// A legacy deep link may restore a club URL before React starts.
const isHome = location.pathname.replace(/\/$/, '') === import.meta.env.BASE_URL.replace(/\/$/, '')
if (root.dataset.prerendered === 'home' && isHome) hydrateRoot(root, app)
else createRoot(root).render(app)
