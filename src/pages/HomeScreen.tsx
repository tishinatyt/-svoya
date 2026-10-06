import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { DEFAULT_LAT, DEFAULT_LNG, getCurrentPosition, type Coords } from '@/lib/geo'
import { getOblastCenterCoordinates } from '@/lib/cities'
import TopBar from '@/components/TopBar'
import { PersonalEventCard, PublicEventCard } from '@/components/home/HomeEventCards'
import { CategoryChips } from '@/components/home/HomeControls'
import HomeCarousel from '@/components/home/HomeCarousel'
import HomeBackgroundDecorations from '@/components/home/HomeBackgroundDecorations'
import type { PersonalEventData, PublicEventData } from '@/components/home/types'
import { DEMO_EVENTS_ENABLED, DEMO_PERSONAL_EVENTS, DEMO_PUBLIC_EVENTS, PUBLIC_CATEGORIES } from '@/components/home/demoEvents'
import { useMyEventsContext } from '@/contexts/MyEventsContext'
import { eventCategoryLabel } from '@/components/home/eventLabels'

const DiscoveryMap = lazy(() => import('@/components/home/DiscoveryMap'))

// ── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',     label: 'Усі' },
  { key: 'cinema',  label: 'Кіно' },
  { key: 'theatre', label: 'Театр' },
  { key: 'bar',     label: 'Бар' },
  { key: 'sport',   label: 'Спорт' },
  { key: 'music',   label: 'Музика' },
  { key: 'food',    label: 'Їжа' },
  { key: 'games',   label: 'Ігри' },
  { key: 'walk',    label: 'Прогулянка' },
  { key: 'art',     label: 'Мистецтво' },
  { key: 'other',   label: 'Інше' },
]

const PAGE_SIZE = 10

const RADIUS_OPTIONS = [
  { value: 1,  label: '1 км' },
  { value: 3,  label: '3 км' },
  { value: 5,  label: '5 км' },
  { value: 10, label: '10 км' },
  { value: 50, label: 'До 50 км' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesSearch(event: Pick<PublicEventData, 'title' | 'category' | 'address_text' | 'organizer'>, query: string) {
  const normalized = query.trim().toLocaleLowerCase('uk-UA')
  if (!normalized) return true
  const category = eventCategoryLabel(event.category)
  return [event.title, category, event.address_text, event.organizer?.name ?? '']
    .some((value) => value.toLocaleLowerCase('uk-UA').includes(normalized))
}

function isEligible(event: PublicEventData, age: number | undefined, gender: string | undefined) {
  const ageMatches = !age || age < 1 || (age >= event.min_age && age <= event.max_age)
  const genderMatches = !gender || gender === 'any' || event.gender_filter === 'any' || event.gender_filter === gender
  return ageMatches && genderMatches
}

function sortDiscovery(left: PublicEventData, right: PublicEventData) {
  if (left.distance_km !== null && right.distance_km !== null && left.distance_km !== right.distance_km) {
    return left.distance_km - right.distance_km
  }
  if (left.distance_km !== null && right.distance_km === null) return -1
  if (left.distance_km === null && right.distance_km !== null) return 1
  return new Date(left.event_datetime).getTime() - new Date(right.event_datetime).getTime()
}

function asPersonalEvent(event: PublicEventData): PersonalEventData {
  return {
    eventId: event.id,
    title: event.title,
    category: event.category,
    address_text: event.address_text,
    event_datetime: event.event_datetime,
    created_at: event.created_at ?? event.event_datetime,
    min_age: event.min_age,
    max_age: event.max_age,
    gender_filter: event.gender_filter,
    cover_photo_url: event.cover_photo_url,
    max_participants: event.max_participants,
    organizer: event.organizer,
    participants: (event.participants ?? []).map((person) => ({ user_id: person.id, user: person })),
    participant_count: event.participant_count,
    distance_km: event.distance_km,
    join_mode: event.join_mode,
    is_public: event.is_public,
    description: event.description,
    isDemo: event.isDemo,
    participationStatus: event.participationStatus,
    pending_request_count: event.pending_request_count,
    bank_enabled: event.bank_enabled,
  }
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { supaUser, profile } = useAuth()
  const { pendingRequestCountByEvent } = useMyEventsContext()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [publicPage, setPublicPage] = useState(1)
  const [radiusKm, setRadiusKm] = useState(5)
  const [viewMode, setViewMode] = useState<'feed' | 'map'>('feed')
  const [discoveryCenter, setDiscoveryCenter] = useState<Coords>({ lat: DEFAULT_LAT, lng: DEFAULT_LNG })

  const [allDiscoveryEvents, setAllDiscoveryEvents] = useState<PublicEventData[]>([])
  const [membershipsReady, setMembershipsReady] = useState(false)
  const discoveryRequestId = useRef(0)

  const [loadingDiscovery, setLoadingDiscovery] = useState(true)
  const [discoveryError, setDiscoveryError] = useState(false)
  const [newEventId, setNewEventId] = useState<string | null>(null)

  const fetchDiscoveryEvents = useCallback(async () => {
    if (!supaUser) return
    const requestId = ++discoveryRequestId.current
    setLoadingDiscovery(true)
    setMembershipsReady(false)
    setDiscoveryError(false)

    const cityFallback = getOblastCenterCoordinates(profile?.city) ?? undefined
    const geo = await getCurrentPosition(cityFallback)
    const [nearbyResult, participationResult] = await Promise.all([
      supabase.rpc('events_nearby', { user_lat: geo.lat, user_lng: geo.lng, radius_km: 100 }),
      supabase.from('event_participants').select('event_id, status, role').eq('user_id', supaUser.id).in('status', ['joined', 'pending', 'rejected']),
    ])

    if (requestId !== discoveryRequestId.current) return
    setDiscoveryCenter(geo)

    if (nearbyResult.error || participationResult.error) {
      if (nearbyResult.error) {
        console.error('[fetchDiscoveryEvents] nearby error:', {
          code: nearbyResult.error.code,
          message: nearbyResult.error.message,
          details: nearbyResult.error.details,
          hint: nearbyResult.error.hint,
        })
      }
      if (participationResult.error) {
        console.error('[fetchDiscoveryEvents] participation error:', {
          code: participationResult.error.code,
          message: participationResult.error.message,
          details: participationResult.error.details,
          hint: participationResult.error.hint,
        })
      }
      setAllDiscoveryEvents([])
      setDiscoveryError(true)
      setLoadingDiscovery(false)
      return
    }

    const nearbyRows = (nearbyResult.data ?? []) as Record<string, unknown>[]
    const ids = nearbyRows.map((row) => row.id as string)
    if (import.meta.env.DEV) {
      console.info('[Home discovery diagnostic] RPC returned', {
        count: nearbyRows.length,
        events: nearbyRows.map((row) => ({ id: row.id, title: row.title })),
      })
    }
    const typeById = new Map<string, { event_type: 'personal' | 'public'; join_mode: 'open' | 'approval'; is_public: boolean; bank_enabled: boolean }>()

    if (ids.length > 0) {
      const { data: typeRows, error: typeError } = await supabase
        .from('events')
        .select('id, event_type, join_mode, is_public, bank_enabled')
        .in('id', ids)
      if (requestId !== discoveryRequestId.current) return
      if (typeError) {
        console.error('[fetchDiscoveryEvents] event type error:', {
          code: typeError.code,
          message: typeError.message,
          details: typeError.details,
          hint: typeError.hint,
        })
        setAllDiscoveryEvents([])
        setDiscoveryError(true)
        setLoadingDiscovery(false)
        return
      }
      for (const row of typeRows ?? []) {
        typeById.set(row.id, {
          event_type: (row.event_type ?? 'public') as 'personal' | 'public',
          join_mode: (row.join_mode ?? 'open') as 'open' | 'approval',
          is_public: row.is_public ?? true,
          bank_enabled: row.bank_enabled ?? false,
        })
      }
      if (import.meta.env.DEV) {
        console.info('[Home discovery diagnostic] Metadata returned', {
          count: typeRows?.length ?? 0,
          events: (typeRows ?? []).map((row) => ({ id: row.id, event_type: row.event_type })),
        })
      }
    }

    const participantMembershipById = new Map(
      (participationResult.data ?? [])
        .filter((row) => row.role === 'participant')
        .map((row) => [row.event_id, row.status as 'pending' | 'joined' | 'rejected']),
    )
    setMembershipsReady(true)

    const events: PublicEventData[] = nearbyRows.map((row) => {
      const e = row as Record<string, unknown>
      const metadata = typeById.get(e.id as string)
      return {
        id: e.id,
        title: e.title,
        category: e.category,
        address_text: e.address_text,
        event_datetime: e.event_datetime,
        created_at: e.created_at,
        min_age: e.min_age,
        max_age: e.max_age,
        gender_filter: e.gender_filter,
        cover_photo_url: e.cover_photo_url,
        max_participants: e.max_participants,
        participant_count: e.participant_count ?? 0,
        distance_km: e.distance_km ?? null,
        location_lat: typeof e.location_lat === 'number' ? e.location_lat : null,
        location_lng: typeof e.location_lng === 'number' ? e.location_lng : null,
        organizer: (e.organizer ?? null) as PublicEventData['organizer'],
        event_type: metadata?.event_type ?? 'public',
        join_mode: metadata?.join_mode ?? 'open',
        is_public: metadata?.is_public ?? (e.is_public as boolean | undefined) ?? true,
        bank_enabled: metadata?.bank_enabled ?? false,
        participationStatus: participantMembershipById.get(e.id as string),
      } as PublicEventData
    })
    events.sort(sortDiscovery)
    setAllDiscoveryEvents(events)
    setLoadingDiscovery(false)
  }, [profile?.city, supaUser])

  useEffect(() => { void fetchDiscoveryEvents() }, [fetchDiscoveryEvents])

  // Re-fetch authoritative discovery data for inserts, edits/cancellation, and deletes.

  useEffect(() => {
    const channel = supabase
      .channel('events-discovery-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const insertedId = (payload.new as { id?: string }).id
            if (insertedId) {
              setNewEventId(insertedId)
              setTimeout(() => setNewEventId(null), 3000)
            }
          }
          void fetchDiscoveryEvents()
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchDiscoveryEvents])

  // ── Realtime: participant count changes ───────────────────────────────────

  useEffect(() => {
    const participantsChannel = supabase
      .channel('event-participants-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_participants' },
        () => { void fetchDiscoveryEvents() },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'event_participants' },
        () => {
          void fetchDiscoveryEvents()
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'event_participants' },
        () => {
          void fetchDiscoveryEvents()
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(participantsChannel) }
  }, [fetchDiscoveryEvents])

  // ── Derived / filtered lists ───────────────────────────────────────────────

  const eligibleDiscovery = membershipsReady ? allDiscoveryEvents
    .filter((event) => isEligible(event, profile?.age ?? undefined, profile?.gender ?? undefined))
    .filter((event) => event.distance_km === null || event.distance_km <= radiusKm)
    .filter((event) => matchesSearch(event, searchQuery)) : []

  const realPersonalEvents = eligibleDiscovery
    .filter((event) => event.event_type === 'personal')

  const realPersonalIds = new Set(realPersonalEvents.map((event) => event.id))
  const personalDemoLimit = realPersonalEvents.length >= 3 ? 0 : 4 - realPersonalEvents.length
  const personalDemoFallbacks = (DEMO_EVENTS_ENABLED ? DEMO_PERSONAL_EVENTS : [])
    .filter((event) => !realPersonalIds.has(event.id))
    .filter((event) => event.distance_km === null || event.distance_km <= radiusKm)
    .filter((event) => matchesSearch(event, searchQuery))
    .slice(0, personalDemoLimit)
  const personalEvents = [...realPersonalEvents, ...personalDemoFallbacks]
    .map((event) => ({ ...event, pending_request_count: pendingRequestCountByEvent[event.id] ?? 0 }))
    .map(asPersonalEvent)

  const realPublic = eligibleDiscovery
    .filter((event) => event.event_type === 'public')
    .filter((e) => selectedCategory === 'all' || e.category === selectedCategory)

  const mapEvents = eligibleDiscovery.filter((event) =>
    selectedCategory === 'all' || event.category === selectedCategory,
  )

  const categoriesWithRealEvents = new Set(realPublic.map((event) => event.category))
  const demoFallbacks = (DEMO_EVENTS_ENABLED ? DEMO_PUBLIC_EVENTS : []).filter((event) =>
    (selectedCategory === 'all' ? PUBLIC_CATEGORIES.includes(event.category as typeof PUBLIC_CATEGORIES[number]) : event.category === selectedCategory)
    && !categoriesWithRealEvents.has(event.category)
    && (event.distance_km === null || event.distance_km <= radiusKm)
    && matchesSearch(event, searchQuery)
  )
  const filteredPublic = [...realPublic, ...demoFallbacks]
    .map((event) => ({ ...event, pending_request_count: pendingRequestCountByEvent[event.id] ?? 0 }))

  const shownPublic = filteredPublic.slice(0, publicPage * PAGE_SIZE)
  const hasMorePublic = filteredPublic.length > publicPage * PAGE_SIZE

  useEffect(() => {
    if (!import.meta.env.DEV || loadingDiscovery) return
    const afterEligibility = allDiscoveryEvents.filter((event) => isEligible(event, profile?.age ?? undefined, profile?.gender ?? undefined))
    const afterRadius = afterEligibility.filter((event) => event.distance_km === null || event.distance_km <= radiusKm)
    const afterSearch = afterRadius.filter((event) => matchesSearch(event, searchQuery))
    const summarize = (events: PublicEventData[]) => events.map(({ id, title }) => ({ id, title }))

    console.info('[Home discovery diagnostic] Filter counts', {
      rpcMapped: { count: allDiscoveryEvents.length, events: summarize(allDiscoveryEvents) },
      afterEligibility: { count: afterEligibility.length, events: summarize(afterEligibility) },
      afterRadius: { count: afterRadius.length, events: summarize(afterRadius) },
      afterSearch: { count: afterSearch.length, events: summarize(afterSearch) },
      finalPersonal: { count: realPersonalEvents.length, events: summarize(realPersonalEvents) },
      finalPublic: { count: realPublic.length, events: summarize(realPublic) },
    })
  }, [allDiscoveryEvents, loadingDiscovery, profile?.age, profile?.gender, radiusKm, realPersonalEvents, realPublic, searchQuery])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-home-bg pb-24 text-brand-ink lg:flex lg:h-screen lg:min-h-0 lg:flex-col lg:pb-0">
      <HomeBackgroundDecorations />
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        radiusKm={radiusKm}
        onRadiusChange={(value) => { setRadiusKm(value); setPublicPage(1) }}
        radiusOptions={RADIUS_OPTIONS}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col px-4 py-3 sm:px-6 sm:py-4 lg:min-h-0 lg:max-w-none lg:flex-1 lg:overflow-hidden lg:px-4 lg:py-4 xl:px-4">
        <div className="mb-2 flex flex-none justify-end">
          <div className="inline-flex rounded-xl border border-brand-border bg-white/90 p-1 shadow-sm" role="group" aria-label="Режим перегляду подій">
            {(['feed', 'map'] as const).map((mode) => <button key={mode} type="button" aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)} className={`h-8 rounded-lg px-3 text-[11px] font-extrabold transition ${viewMode === mode ? 'bg-brand-accent text-white shadow-sm' : 'text-brand-ink-muted hover:bg-brand-accent-soft hover:text-brand-accent'}`}>{mode === 'feed' ? 'Стрічка' : 'Карта'}</button>)}
          </div>
        </div>

        {viewMode === 'feed' ? <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-6 sm:gap-7 lg:min-h-0 lg:grid-cols-[minmax(280px,0.4fr)_minmax(0,0.6fr)] lg:items-stretch lg:gap-2 xl:grid-cols-[minmax(340px,0.4fr)_minmax(0,0.6fr)] xl:gap-2.5">
          <section className="min-w-0 rounded-[24px] border border-[#c5badc] bg-[#e4def1] p-2 pb-0 shadow-[0_10px_30px_rgba(61,45,96,0.09)] sm:p-3 sm:pb-0 lg:flex lg:min-h-0 lg:flex-col">
            {loadingDiscovery && <HomeCarousel id="personal-events-loading" label="Завантаження знайомств" className="lg:space-y-3">{[1, 2, 3].map((item) => <div role="listitem" key={item} className="h-56 w-[88%] flex-none snap-start animate-pulse rounded-2xl border border-brand-border bg-white min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto" />)}</HomeCarousel>}
            {!loadingDiscovery && personalEvents.length === 0 && (
              <div className="rounded-2xl border border-dashed border-brand-border-strong bg-white px-4 py-6 text-center lg:flex-1"><p className="text-sm font-bold text-brand-ink">{discoveryError ? 'Не вдалося завантажити події.' : 'Поки немає особистих подій поруч.'}</p>{!discoveryError && <Link to="/create" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-brand-accent px-4 text-xs font-bold text-white transition hover:bg-brand-accent-hover">Створити подію</Link>}</div>
            )}
            {!loadingDiscovery && personalEvents.length > 0 && <HomeCarousel id="personal-events-carousel" label="Знайомства поруч" showScrollControls className="gap-3.5 lg:space-y-3.5">{personalEvents.map((event) => <div role="listitem" key={event.eventId} className="w-[88%] flex-none snap-start [scroll-snap-stop:always] min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto"><PersonalEventCard event={event} isOrganizer={event.organizer?.id === supaUser?.id} /></div>)}</HomeCarousel>}

            <div className="-mx-2 mt-1 flex min-h-9 flex-none items-center gap-2 rounded-b-[23px] border-t border-[#cfc4e2] bg-white/30 px-3 py-2 sm:-mx-3">
              <h1 className="text-sm font-extrabold tracking-[-0.02em] text-brand-ink">Знайомства</h1>
              {!loadingDiscovery && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white/70 bg-white/75 px-1.5 text-[10px] font-bold tabular-nums text-brand-ink-muted" aria-label={`${personalEvents.length} подій у стрічці Знайомства`}>{personalEvents.length}</span>}
            </div>
          </section>

          <section className="min-w-0 rounded-[24px] border border-[#dcc7bb] bg-[#f4e6de] p-2 pb-0 shadow-[0_10px_30px_rgba(91,61,44,0.08)] sm:p-3 sm:pb-0 lg:flex lg:min-h-0 lg:flex-col lg:p-2.5 lg:pb-0">
            {loadingDiscovery && <HomeCarousel id="public-events-loading" label="Завантаження афіші" className="lg:space-y-3">{[1, 2, 3, 4].map((item) => <div role="listitem" key={item} className="h-72 w-[88%] flex-none snap-start animate-pulse rounded-2xl border border-brand-border bg-white min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto" />)}</HomeCarousel>}
            {!loadingDiscovery && shownPublic.length === 0 && <div className="rounded-2xl border border-dashed border-brand-border-strong bg-white px-4 py-6 text-center lg:flex-1"><p className="text-sm font-bold text-brand-ink">{discoveryError ? 'Не вдалося завантажити події.' : 'Поки немає публічних подій поруч.'}</p>{!discoveryError && selectedCategory !== 'all' && <p className="mt-1.5 text-xs text-brand-ink-muted">Спробуйте іншу категорію або збільшіть радіус.</p>}</div>}
            {!loadingDiscovery && shownPublic.length > 0 && <HomeCarousel id="public-events-carousel" label="Афіша поруч" showScrollControls className="gap-3.5 lg:space-y-2">{shownPublic.map((event) => <div role="listitem" key={event.id} className="w-[88%] flex-none snap-start [scroll-snap-stop:always] min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto"><PublicEventCard event={event} isNew={event.id === newEventId} isOrganizer={event.organizer?.id === supaUser?.id} /></div>)}</HomeCarousel>}

            {hasMorePublic && <button type="button" onClick={() => setPublicPage((page) => page + 1)} className="mt-4 w-full rounded-xl border border-brand-border bg-white py-3 text-sm font-bold text-brand-ink-soft transition hover:border-brand-border-strong hover:bg-brand-surface-muted">Показати більше ({filteredPublic.length - shownPublic.length})</button>}
            <div className="-mx-2 mt-1 flex-none rounded-b-[23px] border-t border-[#dfcec4] bg-white/28 px-3 py-2 sm:-mx-3 lg:-mx-2.5 xl:flex xl:min-h-11 xl:items-center xl:gap-2">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold tracking-[-0.02em] text-brand-ink">Афіша</h2>
                {!loadingDiscovery && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white/70 bg-white/75 px-1.5 text-[10px] font-bold tabular-nums text-brand-ink-muted" aria-label={`${filteredPublic.length} подій у стрічці Афіша`}>{filteredPublic.length}</span>}
              </div>
              <div className="mt-1 min-w-0 xl:mt-0 xl:flex-1 [&>div]:pb-0 [&_button]:min-h-7 [&_button]:rounded-[10px] [&_button]:px-2.5 [&_button]:text-[10px]"><CategoryChips items={TABS} selected={selectedCategory} onSelect={(key) => { setSelectedCategory(key); setPublicPage(1) }} /></div>
            </div>
          </section>
        </div> : <section className="flex min-h-[520px] min-w-0 flex-1 flex-col rounded-[24px] border border-brand-border bg-white/75 p-2 shadow-[0_10px_30px_rgba(61,45,96,0.09)] sm:p-3 lg:min-h-0">
          <div className="mb-2 flex flex-none flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-[-0.02em] text-brand-ink">Події на карті</h1>
              {!loadingDiscovery && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent-soft px-1.5 text-[10px] font-bold tabular-nums text-brand-accent">{mapEvents.length}</span>}
            </div>
            <div className="min-w-0 sm:max-w-[520px] sm:flex-1 [&>div]:pb-0 [&_button]:min-h-8 [&_button]:rounded-[10px] [&_button]:px-2.5 [&_button]:text-[10px]"><CategoryChips items={TABS} selected={selectedCategory} onSelect={(key) => { setSelectedCategory(key); setPublicPage(1) }} /></div>
          </div>
          {loadingDiscovery && allDiscoveryEvents.length === 0 ? <div className="min-h-[430px] flex-1 animate-pulse rounded-2xl bg-brand-surface-muted lg:min-h-0" /> : discoveryError ? <div className="grid min-h-[430px] flex-1 place-items-center rounded-2xl border border-dashed border-brand-border-strong bg-white px-4 text-center text-sm font-bold text-brand-ink">Не вдалося завантажити події.</div> : <Suspense fallback={<div className="min-h-[430px] flex-1 animate-pulse rounded-2xl bg-brand-surface-muted lg:min-h-0" />}><DiscoveryMap events={mapEvents} center={discoveryCenter} /></Suspense>}
        </section>}
      </div>
    </div>
  )
}
