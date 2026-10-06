import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
