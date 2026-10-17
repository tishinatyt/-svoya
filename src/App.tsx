import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './site/page'
import { clubConfig } from './lib/club-db'
import { siteUrl } from './lib/site-path'
import SiteMetadata from './site/metadata'

const Club = lazy(() => import('./site/club/club'))

function ClubPage() {
  try { clubConfig() } catch {
    return <main style={{ maxWidth: 600, margin: '80px auto', padding: 24 }}>
      <h1>Клуб тимчасово недоступний</h1>
      <p role="alert">Не вдалося підключити платформу. Спробуй пізніше або звернися до команди клубу.</p>
      <a href={import.meta.env.BASE_URL}>На головну</a>
    </main>
  }
  return <Suspense fallback={<p role="status" style={{ padding: 32 }}>Завантажуємо клуб…</p>}><Club /></Suspense>
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <SiteMetadata />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/club" element={<ClubPage />} />
        <Route path="*" element={<main style={{ maxWidth: 600, margin: '80px auto', padding: 24 }}>
          <h1>Сторінку не знайдено</h1>
          <p>Можливо, посилання змінилося. Повернися на головну або відкрий клуб.</p>
          <a href={siteUrl('/')}>На головну</a>{' · '}<a href={siteUrl('/club')}>До клубу</a>
        </main>} />
      </Routes>
    </BrowserRouter>
  )
}
