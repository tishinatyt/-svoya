import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEvent } from '@/hooks/useEvent'
import { useAuth } from '@/contexts/AuthContext'
import { getDevicePosition } from '@/lib/geo'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/components/icons'
import TopBar from '@/components/TopBar'
import EventMedia from '@/components/EventMedia'
import { EventActionContent, EventInfoRow, EventRequirements, OrganizerHeader, ParticipantList, PendingRequestList } from '@/components/event-detail/EventDetailSections'
import { getDemoEvent } from '@/components/home/demoEvents'
import type { EventDetail as EventDetailData, EventParticipant } from '@/hooks/useEvent'
import { getEventAccessChipClass, getEventAccessLabel } from '@/lib/eventAccess'
import DemoQrPlaceholder from '@/components/DemoQrPlaceholder'

const EventMap = lazy(() => import('@/components/EventMap'))

const CATEGORY_LABEL: Record<string, string> = {
  cinema: 'Кіно', theatre: 'Театр', bar: 'Бар', sport: 'Спорт', music: 'Музика',
  food: 'Їжа', games: 'Ігри', walk: 'Прогулянка', art: 'Мистецтво', communication: 'Спілкування', other: 'Інше',
}

const GENDER_LABEL: Record<string, string> = {
  any: 'Чоловіки та жінки', male: 'Чоловіки', female: 'Жінки',
}

function formatEventDate(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
  const dayLabel = sameDay(date, today) ? 'Сьогодні' : sameDay(date, tomorrow) ? 'Завтра' : date.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })
  return {
    day: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
    time: date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusKm = 6371
  const latitudeDelta = ((lat2 - lat1) * Math.PI) / 180
  const longitudeDelta = ((lng2 - lng1) * Math.PI) / 180
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { supaUser } = useAuth()
  const demoEvent = getDemoEvent(id)
  const { event: liveEvent, participants: liveParticipants, participantCount: liveParticipantCount, loading, error, joinEvent, reviewRequest, leaveEvent } = useEvent(demoEvent ? '' : id!)
  const event: EventDetailData | null = demoEvent ? {
    id: demoEvent.id,
    title: demoEvent.title,
    description: demoEvent.description ?? '',
    category: demoEvent.category,
    is_public: true,
    event_type: demoEvent.event_type ?? 'public',
    join_mode: demoEvent.join_mode ?? 'open',
    bank_enabled: false,
    bank_note: null,
    organizer_id: demoEvent.organizer?.id ?? 'demo-organizer',
    cover_photo_url: demoEvent.cover_photo_url,
    address_text: demoEvent.address_text,
    event_datetime: demoEvent.event_datetime,
    max_participants: demoEvent.max_participants,
    min_age: demoEvent.min_age,
    max_age: demoEvent.max_age,
    gender_filter: demoEvent.gender_filter,
    status: 'active',
    created_at: demoEvent.created_at ?? '',
    location_lat: demoEvent.location_lat ?? null,
    location_lng: demoEvent.location_lng ?? null,
    organizer: demoEvent.organizer ? { ...demoEvent.organizer, age: demoEvent.organizer.age ?? 29, gender: 'any', city: 'Чернігів', bio: null, interests: [], created_at: demoEvent.created_at ?? '' } : null,
  } : liveEvent
  const demoParticipants = demoEvent?.event_type === 'personal' && demoEvent.organizer
    ? [{ id: demoEvent.organizer.id, name: demoEvent.organizer.name, avatar_url: demoEvent.organizer.avatar_url }, ...(demoEvent.participants ?? []).filter((person) => person.id !== demoEvent.organizer?.id)].slice(0, demoEvent.participant_count)
    : demoEvent?.participants ?? []
  const participants: EventParticipant[] = demoEvent ? demoParticipants.map((person, index) => ({
    id: `${demoEvent.id}-participant-${index}`,
    event_id: demoEvent.id,
    user_id: person.id,
    role: index === 0 ? 'organizer' : 'participant',
    joined_at: demoEvent.created_at ?? '',
    status: 'joined',
    user: { ...person, age: 24 + index, gender: 'any', city: 'Чернігів', bio: null, interests: [], google_verified: false, created_at: demoEvent.created_at ?? '' },
  })) : liveParticipants
  const participantCount = demoEvent ? demoEvent.participant_count : liveParticipantCount
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [bookmarked, setBookmarked] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [pending, setPending] = useState(false)
  const [rejected, setRejected] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [processingUserId, setProcessingUserId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const joiningRef = useRef(false)
  const deletingRef = useRef(false)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    setDistanceKm(null)
    if (event?.location_lat == null || event.location_lng == null) return
    void getDevicePosition().then((position) => {
      if (cancelled || !position || event.location_lat == null || event.location_lng == null) return
      const distance = haversineKm(position.lat, position.lng, event.location_lat, event.location_lng)
      setDistanceKm(Math.round(distance * 10) / 10)
    })
    return () => { cancelled = true }
  }, [event?.location_lat, event?.location_lng])

  useEffect(() => {
    if (!supaUser) return
    setJoined(participants.some((participant) => participant.user_id === supaUser.id && participant.status === 'joined'))
    setPending(participants.some((participant) => participant.user_id === supaUser.id && participant.status === 'pending'))
    setRejected(participants.some((participant) => participant.user_id === supaUser.id && participant.status === 'rejected'))
  }, [participants, supaUser])

  useEffect(() => {
    if (!deleteDialogOpen) return
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape' && !deletingRef.current) setDeleteDialogOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [deleteDialogOpen])

  async function handleJoin() {
    if (!supaUser || !event || joiningRef.current) return
    joiningRef.current = true
    setJoining(true)
    setJoinError(null)
    const { error: joinEventError, status } = await joinEvent()
    joiningRef.current = false
    if (joinEventError) {
      setJoinError(joinEventError)
      setJoining(false)
      return
    }
    setJoined(status === 'joined')
    setPending(status === 'pending')
    setRejected(false)
    setJoining(false)
  }

  async function handleReview(userId: string, decision: 'approve' | 'reject') {
    if (processingUserId) return
    setProcessingUserId(userId)
    setRequestError(null)
    const reviewError = await reviewRequest(userId, decision)
    setProcessingUserId(null)
    if (reviewError) setRequestError(reviewError)
  }

  async function handleLeave() {
    if (leaving || !window.confirm('Вийти з події?')) return
    setLeaving(true)
    setJoinError(null)
    const leaveError = await leaveEvent()
    setLeaving(false)
    if (leaveError) {
      setJoinError(leaveError)
      return
    }
    setJoined(false)
    setPending(false)
    setRejected(false)
  }

  function closeDeleteDialog() {
    setDeleteDialogOpen(false)
    window.requestAnimationFrame(() => deleteTriggerRef.current?.focus())
  }

  async function handleDelete() {
    if (!event || !supaUser || supaUser.id !== event.organizer_id || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setDeleteError(null)

    try {
      const { data, error: deleteEventError } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id)
        .eq('organizer_id', supaUser.id)
        .select('id')
        .maybeSingle()

      if (deleteEventError || !data) throw deleteEventError ?? new Error('Event deletion was not authorized or the event no longer exists')
      setDeleteDialogOpen(false)
      navigate('/', { replace: true })
    } catch (deleteEventError) {
      console.error('Failed to delete event', deleteEventError)
      setDeleteError('Не вдалося видалити подію. Спробуйте ще раз.')
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  if (loading && !demoEvent) {
    return <div className="min-h-screen bg-brand-bg"><TopBar title="Деталі події" /><div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:space-y-0 lg:px-8"><div className="space-y-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl border border-brand-border bg-white" />)}</div><div className="hidden h-80 animate-pulse rounded-2xl border border-brand-border bg-white lg:block" /></div></div>
  }

  if ((!demoEvent && error) || !event) {
    return <div className="grid min-h-screen place-items-center bg-brand-bg px-4 text-center"><div><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-accent-soft text-brand-accent">!</div><p className="text-sm text-brand-ink-soft">{error ?? 'Подію не знайдено'}</p><button onClick={() => navigate(-1)} className="mt-5 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-bold text-white">Повернутися</button></div></div>
  }

  const activeParticipants = participants.filter((participant) => participant.status === 'joined')
  const pendingRequests = participants.filter((participant) => participant.role === 'participant' && participant.status === 'pending')
  const isOrganizer = !demoEvent && supaUser?.id === event.organizer_id
  const isFull = participantCount >= event.max_participants
  const eventStarted = new Date(event.event_datetime).getTime() <= Date.now()
  const joinUnavailableLabel = event.status === 'cancelled' ? 'Подію скасовано'
    : event.status === 'completed' ? 'Подія завершена'
    : eventStarted ? 'Подія вже почалася'
    : null
  const formattedDate = formatEventDate(event.event_datetime)
  const organizerName = event.organizer?.name ?? 'Організатор'
  const locationSecondary = distanceKm !== null ? `${distanceKm.toLocaleString('uk-UA')} км від вас` : null
  const hasLocation = (event.location_lat != null && event.location_lng != null) || Boolean(event.address_text)
  const actions = demoEvent
    ? <button type="button" onClick={() => setJoinError('Це демонстраційна подія')} className="h-14 w-full rounded-2xl bg-brand-accent px-5 text-sm font-extrabold text-white transition hover:bg-brand-accent-hover">{demoEvent.join_mode === 'approval' ? 'Надіслати запит' : 'Приєднатися'}</button>
    : <EventActionContent isOrganizer={isOrganizer} joined={joined} pending={pending} rejected={rejected} joinMode={event.join_mode} isFull={isFull} joinUnavailableLabel={joinUnavailableLabel} joining={joining} leaving={leaving} onJoin={handleJoin} onChat={() => navigate(`/event/${event.id}/chat`)} onLeave={handleLeave} />

  const renderMap = () => event.location_lat != null && event.location_lng != null ? (
    <Suspense fallback={<div className="h-52 animate-pulse rounded-2xl border border-brand-border bg-white" />}><EventMap lat={event.location_lat!} lng={event.location_lng!} title={event.address_text || event.title} /></Suspense>
  ) : event.address_text ? (
    <div className="rounded-2xl border border-brand-border bg-white p-5 text-sm text-brand-ink-soft shadow-card"><div className="flex items-center gap-2"><Icon name="pin" className="h-5 w-5 text-brand-accent" />{event.address_text}</div></div>
  ) : null

  return (
    <div className="min-h-screen bg-white pb-28 text-brand-ink lg:bg-brand-bg lg:pb-10">
      <TopBar title={event.title} />
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-brand-border bg-white/95 px-2.5 backdrop-blur-xl lg:hidden">
        <button type="button" onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-xl text-brand-ink transition hover:bg-white focus-visible:outline-2 focus-visible:outline-brand-accent" aria-label="Назад"><span className="text-2xl leading-none">←</span></button>
        <p className="max-w-[220px] truncate text-sm font-bold">{event.title}</p>
        <button type="button" disabled={Boolean(demoEvent)} onClick={() => setBookmarked((value) => !value)} className={`grid h-11 w-11 place-items-center rounded-xl transition hover:bg-brand-bg focus-visible:outline-2 focus-visible:outline-brand-accent disabled:cursor-not-allowed disabled:opacity-45 ${bookmarked ? 'text-brand-accent' : 'text-brand-ink-muted'}`} aria-label={bookmarked ? 'Видалити зі збережених' : 'Зберегти подію'} aria-pressed={bookmarked}><Icon name="bookmark" className="h-5 w-5" /></button>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-7 px-4 py-5 sm:px-7 md:py-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8 xl:grid-cols-[minmax(0,1fr)_370px] xl:gap-9">
        <main className="min-w-0 space-y-5">
          <OrganizerHeader id={event.organizer_id} name={organizerName} age={event.organizer?.age} city={event.organizer?.city} bio={event.organizer?.bio} interests={event.organizer?.interests} avatarUrl={event.organizer?.avatar_url ?? null} verified={event.organizer?.google_verified ?? false} />
          <div className="h-40 overflow-hidden rounded-2xl border border-brand-border shadow-card lg:hidden"><EventMedia category={event.category} coverUrl={event.cover_photo_url} alt={event.cover_photo_url ? event.title : ''} className="h-full w-full" /></div>
          <section>
            <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-md bg-brand-accent-soft px-2 py-1 text-[10px] font-extrabold text-brand-accent">{CATEGORY_LABEL[event.category] ?? event.category}</span><span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${getEventAccessChipClass(event)}`}>{getEventAccessLabel(event)}</span></div>
            <h1 className="text-[28px] font-extrabold leading-[1.12] tracking-[-0.04em] text-brand-ink md:text-[34px] lg:text-4xl">{event.title}</h1>
            {event.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-ink-soft md:text-[15px]">{event.description}</p>}
          </section>
          <div className="border-t border-brand-border" />
          <div className="grid gap-2 sm:grid-cols-2"><EventInfoRow icon="calendar" eyebrow="Дата і час" primary={formattedDate.day} secondary={formattedDate.time} />{event.address_text && <EventInfoRow icon="pin" eyebrow="Місце" primary={event.address_text} secondary={locationSecondary} />}</div>
          <ParticipantList participants={activeParticipants} totalCount={participantCount} capacity={event.max_participants} />
          {isOrganizer && event.join_mode === 'approval' && pendingRequests.length > 0 && <PendingRequestList requests={pendingRequests} processingUserId={processingUserId} onApprove={(userId) => { void handleReview(userId, 'approve') }} onReject={(userId) => { void handleReview(userId, 'reject') }} />}
          {requestError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{requestError}</div>}
          <EventRequirements gender={GENDER_LABEL[event.gender_filter] ?? event.gender_filter} age={`${event.min_age}–${event.max_age} років`} category={CATEGORY_LABEL[event.category] ?? event.category} isPublic={event.is_public} />
          {event.event_type === 'personal' && event.bank_enabled && <section className="rounded-2xl border border-[#ddd5f6] bg-gradient-to-br from-white to-[#f5f1ff] p-4 shadow-card sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-accent">Банка на захід</p>{event.bank_note && <p className="mt-2 text-sm font-bold leading-5 text-brand-ink">{event.bank_note}</p>}<p className="mt-2 max-w-md text-[11px] leading-5 text-brand-ink-muted">Демо QR — підключення реальної банки буде додано пізніше. Відкриття цього блоку не змінює вашу участь у події.</p></div><div className="flex flex-none flex-col items-center self-start rounded-xl bg-white/80 p-3 sm:self-center"><DemoQrPlaceholder /><span className="mt-1 text-[8px] font-bold uppercase tracking-wide text-brand-ink-muted">Демо QR</span></div></div></section>}
          {hasLocation && <div className="lg:hidden"><h2 className="mb-2.5 text-sm font-extrabold text-brand-ink">Місце зустрічі</h2>{renderMap()}</div>}
          {joinError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{joinError}</div>}
          {isOrganizer && <section className="border-t border-brand-border pt-5"><h2 className="text-sm font-extrabold text-brand-ink">Керування подією</h2><p className="mt-1 text-xs leading-5 text-brand-ink-muted">Редагуйте деталі або перенесіть подію на майбутню дату.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => navigate(`/event/${event.id}/edit`)} className="min-h-11 rounded-xl bg-brand-accent px-4 text-sm font-bold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">Редагувати подію</button><button ref={deleteTriggerRef} type="button" onClick={() => { deletingRef.current = false; setDeleting(false); setDeleteError(null); setDeleteDialogOpen(true) }} className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 transition hover:border-red-300 hover:bg-red-50">Видалити подію</button></div></section>}
        </main>

        <aside className="sticky top-24 hidden space-y-4 lg:block">
          <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
            <div className="h-36 overflow-hidden"><EventMedia category={event.category} coverUrl={event.cover_photo_url} alt={event.cover_photo_url ? event.title : ''} className="h-full w-full" /></div>
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink-muted">{CATEGORY_LABEL[event.category] ?? event.category}</p><h2 className="mt-2 line-clamp-2 text-lg font-extrabold leading-snug text-brand-ink">{event.title}</h2>
              <div className="mt-5 space-y-4">
                <div className="flex gap-3"><Icon name="calendar" className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-accent"/><p className="text-sm font-bold text-brand-ink">{formattedDate.day}, {formattedDate.time}</p></div>
                {event.address_text && <div className="flex gap-3"><Icon name="pin" className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-accent"/><div className="min-w-0"><p className="text-sm font-bold leading-5 text-brand-ink">{event.address_text}</p>{locationSecondary && <p className="mt-0.5 text-xs text-brand-ink-muted">{locationSecondary}</p>}</div></div>}
                <div className="flex gap-3"><Icon name="user" className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-accent"/><p className="text-sm font-bold text-brand-ink">{activeParticipants.length}/{event.max_participants} учасників</p></div>
              </div>
              <div className="mt-6">{actions}</div>{joinError && <p role="alert" className="mt-3 text-xs text-red-600">{joinError}</p>}
            </div>
          </div>
          {renderMap() && <div><h2 className="mb-3 text-sm font-extrabold text-brand-ink">Місце зустрічі</h2>{renderMap()}</div>}
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-white/96 px-4 py-3 shadow-[0_-8px_30px_rgba(23,23,28,0.06)] backdrop-blur-xl pb-safe lg:hidden"><div className="mx-auto flex max-w-lg items-end gap-3"><div className="min-w-0 flex-1">{actions}</div><button type="button" disabled={Boolean(demoEvent)} onClick={() => setBookmarked((value) => !value)} aria-label="Зберегти подію" className={`grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl border border-brand-border bg-white disabled:cursor-not-allowed disabled:opacity-45 ${bookmarked ? 'text-brand-accent' : 'text-brand-ink-soft'}`}><Icon name="bookmark" className="h-5 w-5" /></button></div></div>
      {deleteDialogOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 px-4 py-6" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) closeDeleteDialog() }}><div role="dialog" aria-modal="true" aria-labelledby="delete-event-title" aria-describedby="delete-event-description" className="w-full max-w-sm rounded-2xl border border-brand-border bg-white p-5 shadow-[0_24px_70px_rgba(23,23,28,0.24)] sm:p-6"><h2 id="delete-event-title" className="text-lg font-extrabold text-brand-ink">Видалити подію?</h2><p id="delete-event-description" className="mt-2 text-sm leading-6 text-brand-ink-muted">Цю дію неможливо скасувати.</p>{deleteError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{deleteError}</p>}<div className="mt-6 grid grid-cols-2 gap-2"><button type="button" autoFocus onClick={closeDeleteDialog} disabled={deleting} className="h-11 rounded-xl border border-brand-border bg-white text-sm font-bold text-brand-ink-soft transition hover:bg-brand-surface-muted disabled:cursor-not-allowed disabled:opacity-50">Скасувати</button><button type="button" onClick={() => { void handleDelete() }} disabled={deleting} className="h-11 rounded-xl bg-red-600 px-4 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60">{deleting ? 'Видаляємо…' : 'Видалити'}</button></div></div></div>}
    </div>
  )
}
