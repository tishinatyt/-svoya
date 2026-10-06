import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { EmptyState } from '@/components/home/HomeControls'
import ParticipantAvatars from '@/components/home/ParticipantAvatars'
import { Icon } from '@/components/icons'
import { useMyEventsContext } from '@/contexts/MyEventsContext'
import type { PersonalEventData } from '@/components/home/types'
import { getEventAccessChipClass, getEventAccessLabel } from '@/lib/eventAccess'

type MyEventsTab = 'organizing' | 'joined' | 'pending'

const CATEGORY_LABEL: Record<string, string> = {
  cinema: 'Кіно', theatre: 'Театр', bar: 'Бар', sport: 'Спорт', music: 'Музика',
  food: 'Їжа', games: 'Ігри', walk: 'Прогулянка', art: 'Мистецтво', communication: 'Спілкування', other: 'Інше',
}

const TABS: { key: MyEventsTab; label: string }[] = [
  { key: 'organizing', label: 'Організовую' },
  { key: 'joined', label: 'Беру участь' },
  { key: 'pending', label: 'Заявки' },
]

const EMPTY_CONTENT: Record<MyEventsTab, { title: string; description: string; action: string; to: string }> = {
  organizing: { title: 'Ви ще не створили жодної події', description: 'Створіть зустріч і запросіть людей приєднатися.', action: 'Створити подію', to: '/create' },
  joined: { title: 'Ви ще не приєдналися до подій', description: 'Знайдіть цікаву зустріч у стрічці Poruch.', action: 'Знайти події', to: '/' },
  pending: { title: 'Немає заявок, що очікують підтвердження', description: 'Надіслані заявки з’являться тут, доки організатор не відповість.', action: 'Знайти події', to: '/' },
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function MyEventCard({ event, tab }: { event: PersonalEventData; tab: MyEventsTab }) {
  const navigate = useNavigate()
  const isOrganizer = tab === 'organizing'
  const isPending = tab === 'pending'
  const organizerName = event.organizer?.name ?? 'Організатор'
  const participantUsers = event.participants.map((participant) => ({
    id: participant.user_id,
    name: participant.user?.name,
    avatar_url: participant.user?.avatar_url ?? null,
  }))
  const roleLabel = isOrganizer ? 'Ви організатор' : isPending ? 'Очікує підтвердження' : 'Ви берете участь'

  return (
    <article className={`flex min-w-0 flex-col rounded-2xl border p-4 shadow-card transition hover:border-[#dcd3ff] sm:p-[18px] ${isPending ? 'border-[#e5defe] bg-[#fbfaff]' : 'border-[#e9e3ff] bg-[#f8f6ff]'}`}>
      <div className="flex items-start gap-2.5">
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-white text-xs font-extrabold text-brand-accent">
          {event.organizer?.avatar_url ? <img src={event.organizer.avatar_url} alt={organizerName} className="h-full w-full object-cover" /> : organizerName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-brand-ink">{isOrganizer ? 'Ваша подія' : organizerName}</p>
          <p className="mt-0.5 text-[10px] text-brand-ink-muted">{isOrganizer ? 'Керуйте подією та заявками в деталях' : 'Організатор події'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isPending ? 'bg-white text-brand-ink-soft' : 'bg-white text-brand-accent'}`}>{roleLabel}</span>
            {isOrganizer && Boolean(event.pending_request_count) && <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold text-amber-900" aria-label={`${event.pending_request_count} запитів на участь`}>Запити · {event.pending_request_count}</button>}
          </div>
        </div>
      </div>

      <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="mt-3 block w-full text-left">
        <h2 className="line-clamp-2 text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-brand-ink">{event.title}</h2>
      </button>

      <div className="mt-2.5 space-y-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-brand-ink-muted"><Icon name="calendar" className="h-3.5 w-3.5 flex-shrink-0"/><span className="truncate">{formatEventDate(event.event_datetime)}</span></div>
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-brand-ink-muted"><Icon name="pin" className="h-3.5 w-3.5 flex-shrink-0"/><span className="truncate">{event.address_text || 'Місце не вказано'}</span></div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-brand-accent">{CATEGORY_LABEL[event.category] ?? event.category}</span>
        <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${getEventAccessChipClass(event)}`}>{getEventAccessLabel(event)}</span>
        {isPending && <span className="rounded-md border border-[#e8e3f7] bg-white px-2 py-1 text-[10px] font-semibold text-brand-ink-muted">Організатор ще не відповів</span>}
      </div>

      <div className="mt-[14px] flex items-end justify-between gap-3 border-t border-[#e7e1fa] pt-3">
        {!isPending ? (
          <div className="flex min-w-0 items-center gap-2">
            <ParticipantAvatars users={participantUsers} totalCount={event.participants.length} max={4} />
            <span className="truncate text-[10px] text-brand-ink-muted">{event.participants.length}/{event.max_participants} учасників</span>
          </div>
        ) : <span className="text-[10px] font-semibold text-brand-ink-muted">Заявку надіслано</span>}

        <div className="flex flex-shrink-0 gap-2">
          {tab === 'joined' && <button type="button" onClick={() => navigate(`/event/${event.eventId}/chat`)} className="h-10 rounded-xl border border-[#ddd7ee] bg-white px-3 text-[11px] font-bold text-brand-ink-soft transition hover:border-brand-accent hover:text-brand-accent">Чат</button>}
          <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="h-10 rounded-xl bg-brand-accent px-4 text-[11px] font-bold text-white transition hover:bg-brand-accent-hover">Деталі</button>
        </div>
      </div>
    </article>
  )
}

export default function MyEvents() {
  const { events, loading } = useMyEventsContext()
  const [selectedTab, setSelectedTab] = useState<MyEventsTab>('organizing')

  const eventsByTab: Record<MyEventsTab, PersonalEventData[]> = {
    organizing: events.filter((event) => event.role === 'organizer'),
    joined: events.filter((event) => event.role === 'participant' && event.participationStatus === 'joined'),
    pending: events.filter((event) => event.role === 'participant' && event.participationStatus === 'pending'),
  }
  const selectedEvents = eventsByTab[selectedTab]
  const empty = EMPTY_CONTENT[selectedTab]

  return (
    <div className="min-h-screen bg-brand-bg pb-24 text-brand-ink lg:pb-10">
      <TopBar title="Мої події" />
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-brand-border bg-white/95 px-4 backdrop-blur-xl lg:hidden">
        <h1 className="text-sm font-extrabold">Мої події</h1>
      </header>

      <div className="mx-auto max-w-[1160px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="mb-4 sm:mb-5">
          <h1 className="text-xl font-extrabold tracking-[-0.025em] sm:text-2xl">Мої події</h1>
          <p className="mt-1 text-xs leading-5 text-brand-ink-muted">Керуйте створеними подіями та вашою участю</p>
        </div>

        <div className="scrollbar-hide mb-5 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Фільтр моїх подій">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" role="tab" aria-selected={selectedTab === tab.key} onClick={() => setSelectedTab(tab.key)} className={`h-9 flex-shrink-0 rounded-lg border px-3.5 text-[11px] font-bold transition ${selectedTab === tab.key ? 'border-brand-accent bg-brand-accent text-white' : 'border-[#eeebf8] bg-[#f7f5fc] text-brand-ink-soft hover:border-[#ddd6f8] hover:bg-brand-accent-soft'}`}>
              {tab.label}<span className={`ml-1.5 ${selectedTab === tab.key ? 'text-white/75' : 'text-brand-ink-muted'}`}>{eventsByTab[tab.key].length}</span>
            </button>
          ))}
        </div>

        {loading && <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-[260px] animate-pulse rounded-2xl border border-brand-border bg-white" />)}</div>}

        {!loading && selectedEvents.length === 0 && (
          <EmptyState title={empty.title} description={empty.description} action={<Link to={empty.to} className="inline-flex h-10 items-center rounded-xl bg-brand-accent px-4 text-xs font-bold text-white transition hover:bg-brand-accent-hover">{empty.action}</Link>} />
        )}

        {!loading && selectedEvents.length > 0 && (
          <div className="grid items-stretch gap-3 md:grid-cols-2">
            {selectedEvents.map((event) => <MyEventCard key={event.eventId} event={event} tab={selectedTab} />)}
          </div>
        )}
      </div>
    </div>
  )
}
