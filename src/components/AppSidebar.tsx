import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext'
import { useMyEventsContext } from '@/contexts/MyEventsContext'

const items = [
  { to: '/club?section=feed', key: 'feed', label: 'Стрічка', icon: '⌂' },
  { to: '/club?section=event', key: 'event', label: 'Події', icon: '▦' },
  { to: '/club?section=circle', key: 'circle', label: 'Свої кола', icon: '♧' },
  { to: '/club?section=beauty', key: 'beauty', label: 'Б’юті', icon: '✣' },
  { to: '/club?section=business', key: 'business', label: 'Бізнес', icon: '▣' },
  { to: '/club?section=help', key: 'help', label: 'Допомога', icon: '♡' },
] as const

export default function AppSidebar() {
  const { profile } = useAuth()
  const { unreadCount } = useUnreadMessages()
  const { events, pendingRequestCount } = useMyEventsContext()
  const location = useLocation()
  const section = new URLSearchParams(location.search).get('section') || 'feed'

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col bg-[#4d2634] px-4 py-5 text-[#f8edf0] lg:flex xl:w-60">
      <Link to="/" className="mb-7 px-2" aria-label="СВОЯ — головна">
        <div className="font-[Georgia] text-[31px] tracking-[0.08em]">СВОЯ</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#ccb7bf]">жіночий клуб</div>
      </Link>

      <p className="mb-3 px-2 text-[10px] uppercase tracking-[0.14em] text-[#c7b2ba]">Твоє місце</p>

      <nav className="space-y-1" aria-label="Навігація клубу">
        {items.map((item) => {
          const active = location.pathname === '/club' && section === item.key
          return (
            <Link
              key={item.key}
              to={item.to}
              className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-[12px] transition ${active ? 'bg-[#f8ecef] font-semibold text-[#4d2634]' : 'text-[#f0e4e8] hover:bg-white/7'}`}
            >
              <span className="w-4 text-center text-[15px]">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}

        <Link to="/my-events" className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-[12px] transition ${location.pathname === '/my-events' ? 'bg-[#f8ecef] font-semibold text-[#4d2634]' : 'text-[#f0e4e8] hover:bg-white/7'}`}>
          <span className="w-4 text-center">◫</span><span>Мої зустрічі</span>
          {events.length > 0 && <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[9px]">{events.length}</span>}
        </Link>

        <Link to="/chats" className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-[12px] transition ${location.pathname === '/chats' ? 'bg-[#f8ecef] font-semibold text-[#4d2634]' : 'text-[#f0e4e8] hover:bg-white/7'}`}>
          <span className="w-4 text-center">◌</span><span>Повідомлення</span>
          {unreadCount > 0 && <span className="ml-auto rounded-full bg-[#f8ecef] px-2 py-0.5 text-[9px] font-bold text-[#8d2f51]">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </Link>
      </nav>

      <div className="mt-7 border-y border-white/20 py-5">
        <div className="text-[18px]">❀</div>
        <h3 className="mt-2 font-[Georgia] text-[22px] leading-6">Можна<br />прийти самій.</h3>
        <p className="mt-3 text-[10px] leading-4 text-[#cfbcc3]">Своє коло починається з одного знайомства.</p>
        <Link to="/create?type=personal" className="mt-4 inline-block text-[10px] font-semibold underline underline-offset-4">Запропонувати зустріч</Link>
      </div>

      <div className="mt-auto">
        {pendingRequestCount > 0 && <div className="mb-3 rounded-lg bg-white/10 px-3 py-2 text-[9px] text-[#eadde1]">Очікують рішення: {pendingRequestCount}</div>}
        <div className="mb-4 text-[10px] text-[#d6c6cb]">♙ &nbsp; Правила спільноти</div>
        <Link to="/profile" className="flex items-center gap-3 border-t border-white/20 pt-4">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-[#7b4b5c] text-[11px] font-semibold">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile?.name?.charAt(0) ?? 'О')}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold">{profile?.name ?? 'Олена'}</div>
            <div className="text-[9px] text-[#cdbbc1]">Мої зустрічі та профіль</div>
          </div>
        </Link>
      </div>
    </aside>
  )
}
