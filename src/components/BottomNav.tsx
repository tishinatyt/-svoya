import { Link, useLocation } from 'react-router-dom'
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext'
import { useMyEventsContext } from '@/contexts/MyEventsContext'

const tabs: { to: string; label: string; icon: string; key: string; primary?: boolean }[] = [
  { to: '/club?section=feed', label: 'Стрічка', icon: '⌂', key: 'feed' },
  { to: '/club?section=event', label: 'Події', icon: '▦', key: 'event' },
  { to: '/create', label: 'Створити', icon: '+', key: 'create', primary: true },
  { to: '/chats', label: 'Чати', icon: '◌', key: 'chat' },
  { to: '/profile', label: 'Профіль', icon: '○', key: 'profile' },
]

export default function BottomNav() {
  const { unreadCount } = useUnreadMessages()
  const { pendingRequestCount } = useMyEventsContext()
  const location = useLocation()
  const section = new URLSearchParams(location.search).get('section') || 'feed'

  function active(key: string) {
    if (key === 'feed' || key === 'event') return location.pathname === '/club' && section === key
    if (key === 'create') return location.pathname === '/create'
    if (key === 'chat') return location.pathname === '/chats'
    if (key === 'profile') return location.pathname === '/profile'
    return false
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e0d6d2] bg-[#fffaf8]/95 pb-safe shadow-[0_-8px_30px_rgba(77,38,52,0.08)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            to={tab.to}
            className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[9px] font-semibold ${active(tab.key) ? 'text-[#8d2f51]' : 'text-[#8b7e83]'}`}
          >
            <span className={tab.primary ? '-mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-[#8d2f51] text-[22px] text-white shadow-[0_8px_24px_rgba(141,47,81,0.22)]' : 'relative grid h-6 w-6 place-items-center text-[18px]'}>
              {tab.icon}
              {tab.key === 'chat' && unreadCount > 0 && <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#8d2f51] px-1 text-[8px] text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              {tab.key === 'event' && pendingRequestCount > 0 && <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#8d2f51] px-1 text-[8px] text-white">{pendingRequestCount > 99 ? '99+' : pendingRequestCount}</span>}
            </span>
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
