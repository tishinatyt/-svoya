import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './site/page'

const Club = lazy(() => import('./site/club/club'))

function ClubPage() {
  useEffect(() => { document.title = 'СВОЯ — платформа жіночого клубу' }, [])
  return <Suspense fallback={<p role="status" style={{ padding: 32 }}>Завантажуємо клуб…</p>}><Club /></Suspense>
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/club" element={<ClubPage />} />
        <Route path="*" element={<Navigate to="/club" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
