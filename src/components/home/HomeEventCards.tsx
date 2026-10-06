import { useNavigate } from 'react-router-dom'
import EventMedia from '@/components/EventMedia'
import { Icon } from '@/components/icons'
import ParticipantAvatars from '@/components/home/ParticipantAvatars'
import type { PersonalEventData, PublicEventData } from '@/components/home/types'
import ProfileAvatar from '@/components/ProfileAvatar'
import { getEventAccessChipClass, getEventAccessLabel } from '@/lib/eventAccess'

const CATEGORY_LABEL: Record<string, string> = { cinema: 'Кіно', theatre: 'Театр', bar: 'Бар', sport: 'Спорт', music: 'Музика', food: 'Їжа', games: 'Ігри', walk: 'Прогулянка', art: 'Мистецтво', communication: 'Спілкування', other: 'Інше' }
const GENDER_LABEL: Record<string, string> = { any: 'Для всіх', male: 'Хлопці', female: 'Дівчата' }
const CATEGORY_CHIP: Record<string, string> = {
  cinema: 'border-violet-200 bg-violet-100 text-violet-800',
  theatre: 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-800',
  bar: 'border-rose-200 bg-rose-100 text-rose-800',
  sport: 'border-blue-200 bg-blue-100 text-blue-800',
  music: 'border-purple-200 bg-purple-100 text-purple-800',
  food: 'border-orange-200 bg-orange-100 text-orange-800',
  games: 'border-sky-200 bg-sky-100 text-sky-800',
  walk: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  art: 'border-pink-200 bg-pink-100 text-pink-800',
  communication: 'border-indigo-200 bg-indigo-100 text-indigo-800',
  other: 'border-slate-200 bg-slate-100 text-slate-700',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function MetaRow({ icon, children }: { icon: 'pin' | 'clock'; children: React.ReactNode }) {
  return <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-4 text-brand-ink-muted sm:text-xs"><span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-md bg-[#f0edf6] text-brand-ink-muted"><Icon name={icon} className="h-3 w-3"/></span><span className="truncate">{children}</span></div>
}

export function PersonalEventCard({ event, management = false, isOrganizer = false }: { event: PersonalEventData; management?: boolean; isOrganizer?: boolean }) {
  const navigate = useNavigate()
  const participantUsers = event.participants.map((participant) => ({ id: participant.user_id, name: participant.user?.name, avatar_url: participant.user?.avatar_url ?? null }))
  const visibleUsers = participantUsers.length > 0 ? participantUsers : event.organizer ? [{ id: event.organizer.id, name: event.organizer.name, avatar_url: event.organizer.avatar_url }] : []
  const participantCount = event.participant_count ?? event.participants.length
  const isFull = participantCount >= event.max_participants
  const actionLabel = isOrganizer
    ? 'КЕРУВАТИ'
    : event.participationStatus === 'joined'
      ? 'ВИ УЧАСНИК'
      : event.participationStatus === 'pending'
      ? 'ЗАПИТ НАДІСЛАНО'
      : event.participationStatus === 'rejected'
        ? 'ЗАПИТ ВІДХИЛЕНО'
        : isFull ? 'МІСЦЬ НЕМАЄ' : 'ДОЄДНАТИСЬ'
  const actionMuted = !isOrganizer && (isFull || Boolean(event.participationStatus))

  return (
    <article className="home-event-card h-full rounded-[18px] border border-[#d8d0e7] bg-white p-3 transition-[transform,box-shadow,border-color] duration-200 hover:border-[#c7b9df] sm:p-3.5">
      <div className="mb-2 flex items-center gap-2.5">
        {event.organizer ? <ProfileAvatar profile={{ id: event.organizer.id, name: event.organizer.name, age: event.organizer.age, avatar_url: event.organizer.avatar_url }} className="grid h-8 w-8 flex-shrink-0 place-items-center overflow-hidden rounded-full border border-white bg-brand-accent-soft text-xs font-extrabold text-brand-accent shadow-[0_2px_7px_rgba(62,44,105,0.13)]" /> : <div className="grid h-8 w-8 place-items-center rounded-full border border-white bg-brand-accent-soft text-xs font-extrabold text-brand-accent shadow-[0_2px_7px_rgba(62,44,105,0.13)]">О</div>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-brand-ink sm:text-[15px]">{event.organizer?.name ?? 'Організатор'}{event.organizer?.age ? `, ${event.organizer.age}` : ''}</p>
          <p className="mt-0.5 text-[10px] font-medium text-brand-ink-muted">Запрошує на особисту зустріч</p>
        </div>
        <span className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">Особиста</span>
      </div>

      <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="block w-full text-left">
        <h3 className="mb-2 line-clamp-2 text-[17px] font-extrabold leading-[1.16] tracking-[-0.025em] text-brand-ink sm:text-lg">{event.title}</h3>
        <div className="space-y-1"><MetaRow icon="clock">{formatDateTime(event.event_datetime)}</MetaRow><MetaRow icon="pin">{event.address_text || 'Місце не вказано'}{event.distance_km != null ? ` · ${event.distance_km.toFixed(1)} км` : ''}</MetaRow></div>
      </button>

      <div className="mt-2 flex flex-wrap gap-1">
        <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${CATEGORY_CHIP[event.category] ?? CATEGORY_CHIP.other}`}>{CATEGORY_LABEL[event.category] ?? event.category}</span>
        <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">{event.min_age}–{event.max_age} · {GENDER_LABEL[event.gender_filter] ?? event.gender_filter}</span>
        <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${getEventAccessChipClass(event)}`}>{getEventAccessLabel(event)}</span>
        {event.bank_enabled && <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Банка</span>}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#ece8f2] pt-2">
        <div className="flex min-w-0 items-center gap-2"><ParticipantAvatars users={visibleUsers} totalCount={participantCount}/><span className="truncate text-[11px] font-semibold text-brand-ink-muted">{participantCount}/{event.max_participants} учасників</span></div>
        <div className="flex gap-1.5">
          {isOrganizer && Boolean(event.pending_request_count) && <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="rounded-lg border border-amber-200 bg-amber-100 px-2 text-[9px] font-extrabold text-amber-900" aria-label={`${event.pending_request_count} запитів на участь`}>Запити · {event.pending_request_count}</button>}
          {management && <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="h-10 rounded-xl border border-brand-border px-3 text-[11px] font-bold text-brand-ink-soft transition hover:border-brand-accent hover:text-brand-accent">Деталі</button>}
          <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} aria-label={`${actionLabel}: «${event.title}»`} className={`home-card-cta font-extrabold tracking-[0.02em] transition ${actionMuted ? 'bg-brand-surface-muted text-brand-ink-muted hover:bg-brand-border' : 'bg-brand-accent text-white hover:bg-brand-accent-hover'}`}>{actionLabel}</button>
        </div>
      </div>
    </article>
  )
}

export function PublicEventCard({ event, isNew = false, isOrganizer = false }: { event: PublicEventData; isNew?: boolean; isOrganizer?: boolean }) {
  const navigate = useNavigate()
  const participantUsers = event.participants ?? (event.organizer ? [{ id: event.organizer.id, name: event.organizer.name, avatar_url: event.organizer.avatar_url }] : [])
  const openEvent = () => navigate(`/event/${event.id}`)
  const isFull = event.participant_count >= event.max_participants
  const actionLabel = isOrganizer
    ? 'КЕРУВАТИ'
    : event.participationStatus === 'joined'
      ? 'ВИ УЧАСНИК'
      : event.participationStatus === 'pending'
      ? 'ЗАПИТ НАДІСЛАНО'
      : event.participationStatus === 'rejected'
        ? 'ЗАПИТ ВІДХИЛЕНО'
        : isFull ? 'МІСЦЬ НЕМАЄ' : 'ДОЄДНАТИСЬ'
  const actionMuted = !isOrganizer && (isFull || Boolean(event.participationStatus))

  return (
    <article className={`home-event-card group h-full rounded-[18px] border bg-white p-3 transition-[transform,box-shadow,border-color] duration-200 hover:border-[#c9bedb] sm:p-3.5 lg:h-auto lg:p-3 ${isNew ? 'border-brand-accent/50 ring-2 ring-brand-accent/10' : 'border-[#d9d2e4]'}`}>
      <div className="flex min-w-0 gap-3 lg:gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${CATEGORY_CHIP[event.category] ?? CATEGORY_CHIP.other}`}>{CATEGORY_LABEL[event.category] ?? event.category}</span>
            {isNew && <span className="rounded-full bg-brand-accent px-2 py-0.5 text-[9px] font-extrabold text-white">НОВА</span>}
          </div>
          <button type="button" onClick={openEvent} className="block w-full text-left"><h3 className="line-clamp-2 text-[18px] font-extrabold leading-[1.16] tracking-[-0.025em] text-brand-ink sm:text-[19px]">{event.title}</h3></button>
          <div className="mt-1.5 space-y-0.5"><MetaRow icon="clock">{formatDateTime(event.event_datetime)}</MetaRow><MetaRow icon="pin">{event.address_text || 'Місце не вказано'}{event.distance_km !== null ? ` · ${event.distance_km.toFixed(1)} км` : ''}</MetaRow></div>
        </div>
        <button type="button" onClick={openEvent} aria-label={`Відкрити подію «${event.title}»`} className="relative h-20 w-20 flex-none overflow-hidden rounded-xl bg-brand-surface-muted text-left sm:h-24 sm:w-24 lg:h-[104px] lg:w-[104px] xl:h-[108px] xl:w-[108px]">
          <EventMedia category={event.category} coverUrl={event.cover_photo_url} alt={event.cover_photo_url ? event.title : ''} compactFallback className="h-full w-full" imageClassName="transition duration-300 group-hover:scale-[1.04]" />
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-[#ece9f0] pt-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <ParticipantAvatars users={participantUsers} totalCount={event.participant_count} />
            <p className="truncate text-[11px] font-bold text-brand-ink-soft">{event.participant_count}/{event.max_participants} учасників</p>
            <p className={`inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${getEventAccessChipClass(event)}`}>{getEventAccessLabel(event)}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {isOrganizer && Boolean(event.pending_request_count) && <button type="button" onClick={openEvent} className="home-card-cta border border-amber-200 bg-amber-100 font-extrabold text-amber-900" aria-label={`${event.pending_request_count} запитів на участь`}>Запити · {event.pending_request_count}</button>}
            <button type="button" onClick={openEvent} aria-label={`${actionLabel}: «${event.title}»`} className={`home-card-cta font-extrabold tracking-[0.02em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${actionMuted ? 'bg-brand-surface-muted text-brand-ink-muted hover:bg-brand-border' : 'bg-brand-accent text-white hover:bg-brand-accent-hover'}`}>{actionLabel}</button>
          </div>
      </div>
    </article>
  )
}
