import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNav from '@/components/BottomNav'
import AppSidebar from '@/components/AppSidebar'
import Profile from '@/pages/Profile'
import EventDetail from '@/pages/EventDetail'
import EventChat from '@/pages/EventChat'
import Chats from '@/pages/Chats'
import CreateEvent from '@/pages/CreateEvent'
import MyEvents from '@/pages/MyEvents'
import PublicProfile from '@/pages/PublicProfile'
import SvoyaLanding from '@/pages/SvoyaLanding'
import SvoyaClub from '@/pages/SvoyaClub'
import { UnreadMessagesProvider } from '@/contexts/UnreadMessagesContext'
import { ProfilePreviewProvider } from '@/contexts/ProfilePreviewContext'
import { MyEventsProvider } from '@/contexts/MyEventsContext'
import { trackPageView } from '@/lib/analytics'

const FULLSCREEN_PATTERNS = [/^\/event\//]

function RouteAnalytics() {
  const location = useLocation()

  useEffect(() => {
    trackPageView(`${window.location.pathname}${window.location.search}`)
  }, [location.pathname, location.search])

  return null
}

function MemberRoutes() {
  const { pathname } = useLocation()
  const isClub = pathname === '/club'
  const isCreateEvent = pathname === '/create'
  const hideBottomNav = isClub || isCreateEvent || FULLSCREEN_PATTERNS.some((re) => re.test(pathname))
  const showLegacyDesktopShell = !isClub

  return (
    <>
      {showLegacyDesktopShell && <AppSidebar />}
      <main className={showLegacyDesktopShell ? 'lg:pl-56 xl:pl-60' : ''}>
        <Routes>
          <Route path="/club" element={<SvoyaClub />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<PublicProfile />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/event/:id/chat" element={<EventChat />} />
          <Route path="/create" element={<CreateEvent />} />
          <Route path="/event/:eventId/edit" element={<CreateEvent />} />
          <Route path="/my-events" element={<MyEvents />} />
          <Route path="*" element={<Navigate to="/club" replace />} />
        </Routes>
      </main>
      {!hideBottomNav && <BottomNav />}
    </>
  )
}

function ProtectedMemberApp() {
  return (
    <ProtectedRoute>
      <UnreadMessagesProvider>
        <MyEventsProvider>
          <ProfilePreviewProvider>
            <MemberRoutes />
          </ProfilePreviewProvider>
        </MyEventsProvider>
      </UnreadMessagesProvider>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SvoyaLanding />} />
      <Route path="/*" element={<ProtectedMemberApp />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <RouteAnalytics />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
