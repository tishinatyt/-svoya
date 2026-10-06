import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getDevicePosition } from '@/lib/geo'
import { getOblastCenterCoordinates } from '@/lib/cities'
import { Icon } from '@/components/icons'
import EventMedia from '@/components/EventMedia'
import TopBar from '@/components/TopBar'
import CreateEventMap from '@/components/CreateEventMap'
import { getEventAccessChipClass, getEventAccessLabel } from '@/lib/eventAccess'
import DemoQrPlaceholder from '@/components/DemoQrPlaceholder'

const CATEGORIES = [
  { value: 'other', label: 'Спілкування', emoji: '💬' },
  { value: 'food', label: 'Кава та їжа', emoji: '☕' },
  { value: 'cinema', label: 'Кіно', emoji: '🎬' },
  { value: 'theatre', label: 'Театр', emoji: '🎭' },
  { value: 'bar', label: 'Бар', emoji: '🍸' },
  { value: 'sport', label: 'Спорт', emoji: '🏃' },
  { value: 'music', label: 'Музика', emoji: '🎵' },
  { value: 'games', label: 'Ігри', emoji: '🎲' },
  { value: 'walk', label: 'Прогулянка', emoji: '🚶' },
  { value: 'art', label: 'Мистецтво', emoji: '🎨' },
] as const

const CAPACITY_OPTIONS = [2, 4, 6, 10]

type EventType = 'personal' | 'public'
type JoinMode = 'open' | 'approval'
type GenderFilter = 'any' | 'female' | 'male'

interface FormState {
  event_type: EventType
  is_public: boolean
  join_mode: JoinMode
  title: string
  description: string
  category: string
  cover_photo_url: string
  event_date: string
  event_time: string
  venue_name: string
  address: string
  lat: number | null
  lng: number | null
  max_participants: number
  min_age: number
  max_age: number
  gender_filter: GenderFilter
  bank_enabled: boolean
  bank_note: string
}
type FormErrors = Partial<Record<keyof FormState | 'ticket_quantity' | 'ticket_price' | 'submit', string>>

interface EventInsertPayload {
  organizer_id: string
  event_type: EventType
  is_public: boolean
  join_mode: JoinMode
  title: string
  description: string
  category: string
  cover_photo_url: string | null
  event_datetime: string
  address_text: string
  location: string
  max_participants: number
  min_age: number
  max_age: number
  gender_filter: GenderFilter
  bank_enabled: boolean
  bank_note: string | null
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function defaultDateTime() {
  const date = new Date()
  date.setHours(date.getHours() + 1, 0, 0, 0)
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

function todayInputValue() {
  const today = new Date()
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
}

function SectionCard({ number, title, description, children }: { number: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#ebe9f0] bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-brand-accent-soft text-[10px] font-extrabold text-brand-accent">{number}</span>
        <div><h2 className="text-[15px] font-extrabold text-brand-ink">{title}</h2>{description && <p className="mt-0.5 text-[11px] leading-5 text-brand-ink-muted">{description}</p>}</div>
      </div>
      {children}
    </section>
  )
}

export default function CreateEvent() {
  const navigate = useNavigate()
  const { eventId } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const { supaUser, profile } = useAuth()
  const defaults = useMemo(defaultDateTime, [])
  const submittingRef = useRef(false)
  const [form, setForm] = useState<FormState>({
    event_type: searchParams.get('type') === 'public' ? 'public' : 'personal', is_public: true, join_mode: 'open', title: '', description: '', category: 'other',
    cover_photo_url: '', event_date: defaults.date, event_time: defaults.time, venue_name: '', address: '',
    lat: null, lng: null, max_participants: 10, min_age: 18, max_age: 60, gender_filter: 'any', bank_enabled: false, bank_note: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [locating, setLocating] = useState(false)
  const [loadingEvent, setLoadingEvent] = useState(Boolean(eventId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ticketsEnabled, setTicketsEnabled] = useState(false)
  const [ticketQuantity, setTicketQuantity] = useState('50')
  const [ticketPrice, setTicketPrice] = useState('200')

  useEffect(() => {
    if (!eventId || !supaUser) return
    const organizerId = supaUser.id
    let cancelled = false
    async function loadEventForEdit() {
      setLoadingEvent(true); setLoadError(null)
      const [eventResult, coordsResult] = await Promise.all([
        supabase.from('events').select('event_type, is_public, join_mode, title, description, category, cover_photo_url, event_datetime, address_text, max_participants, min_age, max_age, gender_filter, bank_enabled, bank_note').eq('id', eventId).eq('organizer_id', organizerId).maybeSingle(),
        (supabase.rpc('get_event_coords', { p_event_id: eventId }).single() as unknown) as Promise<{ data: { lat: number; lng: number } | null; error: unknown }>,
      ])
      if (cancelled) return
      if (eventResult.error || !eventResult.data) {
        if (eventResult.error) console.error('[CreateEvent] Failed to load event for editing', eventResult.error)
        setLoadError('Не вдалося завантажити подію для редагування')
        setLoadingEvent(false)
        return
      }
      const source = eventResult.data
      const date = new Date(source.event_datetime)
      setForm({
        event_type: source.event_type ?? 'personal', is_public: source.is_public, join_mode: source.join_mode ?? 'open', title: source.title,
        description: source.description ?? '', category: source.category, cover_photo_url: source.cover_photo_url ?? '',
        event_date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, event_time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
        venue_name: '', address: source.address_text ?? '', lat: coordsResult.data?.lat ?? null, lng: coordsResult.data?.lng ?? null,
        max_participants: source.max_participants, min_age: source.min_age, max_age: source.max_age, gender_filter: source.gender_filter,
        bank_enabled: source.event_type === 'personal' && Boolean(source.bank_enabled), bank_note: source.bank_note ?? '',
      })
      setLoadingEvent(false)
    }
    void loadEventForEdit()
    return () => { cancelled = true }
  }, [eventId, supaUser])

  const set = useCallback(<Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, submit: undefined }))
  }, [])

  const selectEventType = (eventType: EventType) => {
    setForm((current) => ({ ...current, event_type: eventType, ...(eventType === 'public' ? { bank_enabled: false, bank_note: '' } : {}) }))
  }

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const coordinateFallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    setGeocoding(true)
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=uk`)
      if (!response.ok) throw new Error(`Nominatim ${response.status}`)
      const result = await response.json() as { display_name?: string }
      setForm((current) => ({ ...current, address: result.display_name || current.address || coordinateFallback }))
    } catch (error) {
      console.warn('[CreateEvent] Reverse geocoding failed:', error)
      setForm((current) => ({ ...current, address: current.address || coordinateFallback }))
    } finally {
      setErrors((current) => ({ ...current, address: undefined, lat: undefined, lng: undefined }))
      setGeocoding(false)
    }
  }, [])

  const handleMapPick = useCallback((lat: number, lng: number) => {
    setForm((current) => ({ ...current, lat, lng }))
    void reverseGeocode(lat, lng)
  }, [reverseGeocode])

  async function useCurrentLocation() {
    setLocating(true)
    setErrors((current) => ({ ...current, lat: undefined }))
    try {
      const position = await getDevicePosition()
      if (!position) {
        setErrors((current) => ({ ...current, lat: 'Не вдалося визначити ваше місцезнаходження. Дозвольте геолокацію або виберіть точку на карті.' }))
        return
      }
      setForm((current) => ({ ...current, lat: position.lat, lng: position.lng }))
      await reverseGeocode(position.lat, position.lng)
    } finally {
      setLocating(false)
    }
  }

  function validate() {
    const nextErrors: FormErrors = {}
    if (!form.title.trim()) nextErrors.title = 'Вкажіть назву події'
    if (!form.event_date) nextErrors.event_date = 'Оберіть дату'
    if (!form.event_time) nextErrors.event_time = 'Оберіть час'

    if (form.event_date && form.event_time) {
      const eventDateTime = new Date(`${form.event_date}T${form.event_time}`)
      if (Number.isNaN(eventDateTime.getTime())) nextErrors.event_date = 'Перевірте дату й час'
      else if (eventDateTime <= new Date()) nextErrors.event_date = eventId ? 'Оберіть майбутню дату та час' : 'Подія має починатися в майбутньому'
    }

    if (!Number.isInteger(form.max_participants) || form.max_participants < 1 || form.max_participants > 1000) nextErrors.max_participants = 'Вкажіть від 1 до 1000 учасників'
    if (form.bank_note.trim().length > 200) nextErrors.bank_note = 'Мета збору може містити до 200 символів'
    if (ticketsEnabled) {
      const quantity = Number(ticketQuantity)
      const price = Number(ticketPrice)
      if (!ticketQuantity.trim()) nextErrors.ticket_quantity = 'Вкажіть кількість квитків'
      else if (!Number.isInteger(quantity) || quantity < 1) nextErrors.ticket_quantity = 'Кількість має бути цілим числом від 1'
      if (!ticketPrice.trim()) nextErrors.ticket_price = 'Вкажіть ціну квитка'
      else if (!Number.isFinite(price) || price < 0) nextErrors.ticket_price = 'Ціна не може бути від’ємною'
    }
    if (form.min_age < 16 || form.max_age > 100) nextErrors.min_age = 'Допустимий вік — від 16 до 100 років'
    else if (form.min_age > form.max_age) nextErrors.min_age = 'Мінімальний вік не може бути більшим за максимальний'
    if (!form.address.trim()) nextErrors.address = 'Вкажіть адресу події'
    if ((form.lat === null) !== (form.lng === null)) nextErrors.lat = 'Координати мають бути вказані повністю'
    else if (form.lat === null || form.lng === null) nextErrors.lat = 'Позначте місце на карті'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supaUser || submittingRef.current || !validate()) return
    submittingRef.current = true
    setSubmitting(true)

    const addressText = [form.venue_name.trim(), form.address.trim()].filter(Boolean).join(', ')
    const payload: EventInsertPayload = {
      organizer_id: supaUser.id,
      event_type: form.event_type,
      is_public: form.is_public,
      join_mode: form.join_mode,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      cover_photo_url: form.cover_photo_url.trim() || null,
      event_datetime: new Date(`${form.event_date}T${form.event_time}`).toISOString(),
      address_text: addressText,
      location: `POINT(${form.lng} ${form.lat})`,
      max_participants: form.max_participants,
      min_age: form.min_age,
      max_age: form.max_age,
      gender_filter: form.gender_filter,
      bank_enabled: form.event_type === 'personal' && form.bank_enabled,
      bank_note: form.event_type === 'personal' && form.bank_enabled ? form.bank_note.trim() || null : null,
    }

    if (import.meta.env.DEV) {
      console.info('[CreateEvent diagnostic] CREATE EVENT START', {
        organizer_id: payload.organizer_id,
        event_type: payload.event_type,
        is_public: payload.is_public,
        join_mode: payload.join_mode,
        event_datetime: payload.event_datetime,
        location: payload.location,
      })
    }
    const { data, error } = eventId
      ? await supabase.from('events').update(payload).eq('id', eventId).eq('organizer_id', supaUser.id).select('id').single()
      : await supabase.from('events').insert({ ...payload, status: 'upcoming' }).select('id').single()
    if (import.meta.env.DEV) {
      console.info('[CreateEvent diagnostic] EVENT INSERT RESULT', { id: data?.id ?? null, succeeded: !error && Boolean(data?.id) })
      if (error) console.error('[CreateEvent diagnostic] EVENT INSERT ERROR', { code: error.code, message: error.message, details: error.details, hint: error.hint })
    }
    if (error || !data?.id) {
      console.error('[CreateEvent] Event insert/returning failed', {
        operation: "supabase.from('events').insert(payload).select('id').single()",
        phase: 'single PostgREST INSERT with representation return; no participant/request setup call follows',
        error: error ? {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        } : null,
        authenticatedUserId: supaUser.id,
        organizerMatchesAuthenticatedUser: payload.organizer_id === supaUser.id,
        visibilityMode: payload.is_public ? 'feed' : 'invitation-only',
        joinMode: payload.join_mode,
        payload,
      })
      const serverMessage = error?.message ?? ''
      const submitMessage = serverMessage.includes('capacity_below_joined')
        ? 'Кількість місць не може бути меншою за кількість уже підтверджених учасників.'
        : serverMessage.includes('pending_requests_exist')
          ? 'Спочатку підтвердьте або відхиліть усі заявки на участь.'
          : eventId
            ? 'Не вдалося зберегти зміни. Перевірте дані та спробуйте ще раз.'
            : 'Не вдалося створити подію. Перевірте дані та спробуйте ще раз.'
      setErrors({ submit: submitMessage })
      setSubmitting(false)
      submittingRef.current = false
      return
    }
    if (import.meta.env.DEV && !eventId) {
      console.info('[CreateEvent diagnostic] CREATED EVENT ID', data.id)
      const membershipResult = await supabase
        .from('event_participants')
        .select('event_id, user_id, role, status')
        .eq('event_id', data.id)
        .eq('user_id', supaUser.id)
        .maybeSingle()
      console.info('[CreateEvent diagnostic] ORGANIZER MEMBERSHIP INSERT RESULT', membershipResult.data)
      if (membershipResult.error) {
        console.error('[CreateEvent diagnostic] ORGANIZER MEMBERSHIP ERROR', {
          code: membershipResult.error.code,
          message: membershipResult.error.message,
          details: membershipResult.error.details,
          hint: membershipResult.error.hint,
        })
      }
    }
    navigate(`/event/${data.id}`)
  }

  const selectedCategory = CATEGORIES.find((category) => category.value === form.category)
  const previewDate = form.event_date && form.event_time ? new Date(`${form.event_date}T${form.event_time}`) : null
  const inputClass = (field: keyof FormErrors) => `h-11 w-full rounded-xl border bg-[#fcfcfe] px-3.5 text-sm text-brand-ink outline-none transition placeholder:text-brand-ink-muted focus:bg-white focus:ring-2 focus:ring-brand-accent/10 ${errors[field] ? 'border-red-400 focus:border-red-400' : 'border-brand-border focus:border-brand-accent'}`
  const labelClass = 'mb-1.5 block text-xs font-bold text-brand-ink-soft'

  if (loadingEvent) return <div className="min-h-screen bg-brand-bg"><TopBar title="Редагувати подію" /><div className="mx-auto max-w-[880px] space-y-4 px-4 py-7 sm:px-6">{[1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-brand-border bg-white" />)}</div></div>
  if (loadError) return <div className="grid min-h-screen place-items-center bg-brand-bg px-4 text-center"><div><p className="text-sm text-red-600">{loadError}</p><button type="button" onClick={() => navigate(-1)} className="mt-4 h-11 rounded-xl bg-brand-accent px-4 text-sm font-bold text-white">Повернутися</button></div></div>

  return (
    <div className="min-h-screen bg-brand-bg pb-28 text-brand-ink lg:pb-10">
      <TopBar title={eventId ? 'Редагувати подію' : 'Створити подію'} />
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-brand-border bg-white/95 px-2.5 backdrop-blur-xl lg:hidden">
        <button type="button" onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-xl text-2xl focus-visible:outline-2 focus-visible:outline-brand-accent" aria-label="Назад">←</button>
        <p className="ml-1 text-sm font-extrabold">{eventId ? 'Редагувати подію' : 'Створити подію'}</p>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mx-auto max-w-[880px] px-4 py-5 sm:px-6 md:py-7">
          <div className="mb-5">
            <h1 className="text-2xl font-extrabold tracking-[-0.035em] sm:text-[28px]">{eventId ? 'Редагувати подію' : 'Створити подію'}</h1>
            <p className="mt-1 text-xs leading-5 text-brand-ink-muted">{eventId ? 'Оновіть деталі та збережіть зміни.' : 'Заповніть деталі — і ваша зустріч з’явиться в Poruch'}</p>
          </div>

          <div className="space-y-3.5">
            <SectionCard number="1" title="Яку подію ви створюєте?" description="Тип описує формат зустрічі, а не її видимість.">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {([
                  { value: 'personal' as const, title: 'Особиста подія', text: 'Зустріч із людьми поруч — кава, прогулянка, спорт або спільні інтереси.', icon: 'user' as const },
                  { value: 'public' as const, title: 'Громадська подія', text: 'Подія для ширшої аудиторії — кіно, театр, бар, концерт, спорт та інше.', icon: 'calendar' as const },
                ]).map((option) => {
                  const selected = form.event_type === option.value
                  return (
                    <button key={option.value} type="button" onClick={() => selectEventType(option.value)} aria-pressed={selected} className={`flex min-h-[104px] items-start gap-3 rounded-2xl border p-3.5 text-left transition ${selected ? 'border-brand-accent bg-brand-accent-soft ring-1 ring-brand-accent/10' : 'border-brand-border bg-[#fcfcfe] hover:border-brand-border-strong'}`}>
                      <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${selected ? 'bg-brand-accent text-white' : 'bg-brand-surface-muted text-brand-ink-soft'}`}><Icon name={option.icon} className="h-4.5 w-4.5"/></span>
                      <span><strong className="block text-sm text-brand-ink">{option.title}</strong><span className="mt-1 block text-[11px] leading-[18px] text-brand-ink-muted">{option.text}</span></span>
                    </button>
                  )
                })}
              </div>
            </SectionCard>

            <SectionCard number="2" title="Про подію">
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="title">Назва *</label>
                  <input id="title" value={form.title} onChange={(event) => set('title', event.target.value)} maxLength={120} placeholder="Наприклад, Кава та розмови" className={inputClass('title')} />
                  {errors.title && <p className="mt-1.5 text-xs text-red-600">{errors.title}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between"><label className={labelClass} htmlFor="description">Опис</label><span className="mb-1.5 text-[10px] text-brand-ink-muted">{form.description.length}/1000</span></div>
                  <textarea id="description" value={form.description} onChange={(event) => set('description', event.target.value)} maxLength={1000} rows={4} placeholder="Розкажіть, що плануєте і кого хочете бачити на зустрічі" className={`${inputClass('description')} h-auto min-h-24 resize-y py-2.5 leading-5`} />
                </div>
                <div>
                  <p className={labelClass}>Категорія</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((category) => <button key={category.value} type="button" onClick={() => set('category', category.value)} className={`h-8 rounded-lg border px-2.5 text-[11px] font-bold transition ${form.category === category.value ? 'border-brand-accent bg-brand-accent text-white' : 'border-[#eeebf8] bg-[#f7f5fc] text-brand-ink-soft hover:border-[#ddd6f8]'}`}>{category.emoji} {category.label}</button>)}
                  </div>
                </div>
                <div className="rounded-xl bg-[#faf9fd] p-3">
                  <label className={labelClass} htmlFor="cover_photo_url">Обкладинка <span className="font-normal text-brand-ink-muted">(необов’язково)</span></label>
                  <input id="cover_photo_url" type="url" value={form.cover_photo_url} onChange={(event) => set('cover_photo_url', event.target.value)} placeholder="Посилання на зображення https://..." className={inputClass('cover_photo_url')} />
                  {form.cover_photo_url && <div className="mt-2.5 h-28 overflow-hidden rounded-xl border border-brand-border bg-brand-surface-muted"><EventMedia category={form.category} coverUrl={form.cover_photo_url} alt="Попередній перегляд обкладинки" className="h-full w-full" /></div>}
                </div>
              </div>
            </SectionCard>

            <SectionCard number="3" title="Коли?">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="event_date">Дата *</label>
                  <input id="event_date" type="date" min={todayInputValue()} value={form.event_date} onChange={(event) => set('event_date', event.target.value)} className={inputClass('event_date')} />
                  {errors.event_date && <p className="mt-1.5 text-xs text-red-600">{errors.event_date}</p>}
                </div>
                <div>
                  <label className={labelClass} htmlFor="event_time">Час *</label>
                  <input id="event_time" type="time" value={form.event_time} onChange={(event) => set('event_time', event.target.value)} className={inputClass('event_time')} />
                  {errors.event_time && <p className="mt-1.5 text-xs text-red-600">{errors.event_time}</p>}
                </div>
              </div>
            </SectionCard>

            <SectionCard number="4" title="Де?" description="Вкажіть адресу й позначте точку зустрічі на карті.">
              <div className="space-y-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={labelClass} htmlFor="venue_name">Назва місця</label><input id="venue_name" value={form.venue_name} onChange={(event) => set('venue_name', event.target.value)} placeholder="Кав’ярня White Cup" className={inputClass('venue_name')} /></div>
                  <div>
                    <label className={labelClass} htmlFor="address">Адреса *</label>
                    <div className="relative"><input id="address" value={form.address} onChange={(event) => set('address', event.target.value)} placeholder="вул. Шевченка, 12" className={inputClass('address')} />{geocoding && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-brand-ink-muted">Шукаємо…</span>}</div>
                    {errors.address && <p className="mt-1.5 text-xs text-red-600">{errors.address}</p>}
                  </div>
                </div>
                <button type="button" onClick={useCurrentLocation} disabled={locating} className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-border bg-white px-3.5 text-[11px] font-bold text-brand-accent transition hover:border-brand-accent disabled:opacity-60"><Icon name="pin" className="h-4 w-4"/>{locating ? 'Визначаємо…' : 'Використати моє місцезнаходження'}</button>
                <CreateEventMap lat={form.lat} lng={form.lng} center={getOblastCenterCoordinates(profile?.city) ?? undefined} onPick={handleMapPick} />
                <div>{form.lat !== null && form.lng !== null ? <p className="text-[11px] font-semibold text-brand-accent">✓ Точку вибрано</p> : <p className="text-[11px] text-brand-ink-muted">Натисніть на карту, щоб вибрати точне місце.</p>}{errors.lat && <p className="mt-1 text-xs text-red-600">{errors.lat}</p>}</div>
              </div>
            </SectionCard>

            <SectionCard number="5" title="Хто може приєднатися?">
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="max_participants">Кількість учасників</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CAPACITY_OPTIONS.map((capacity) => <button key={capacity} type="button" onClick={() => set('max_participants', capacity)} className={`h-9 min-w-10 rounded-lg border px-2.5 text-[11px] font-bold ${form.max_participants === capacity ? 'border-brand-accent bg-brand-accent text-white' : 'border-[#eeebf8] bg-[#f7f5fc] text-brand-ink-soft'}`}>{capacity}</button>)}
                    <input id="max_participants" type="number" min={1} max={1000} value={form.max_participants} onChange={(event) => set('max_participants', Number(event.target.value))} aria-label="Інша кількість учасників" className="h-9 w-24 rounded-lg border border-brand-border bg-white px-3 text-xs outline-none focus:border-brand-accent" />
                  </div>
                  {errors.max_participants && <p className="mt-1.5 text-xs text-red-600">{errors.max_participants}</p>}
                </div>
                <div>
                  <p className={labelClass}>Стать</p>
                  <div className="flex flex-wrap gap-1.5">{([{ value: 'any', label: 'Усі' }, { value: 'female', label: 'Жінки' }, { value: 'male', label: 'Чоловіки' }] as const).map((option) => <button key={option.value} type="button" onClick={() => set('gender_filter', option.value)} className={`h-9 rounded-lg border px-3 text-[11px] font-bold ${form.gender_filter === option.value ? 'border-brand-accent bg-brand-accent-soft text-brand-accent' : 'border-brand-border bg-white text-brand-ink-soft'}`}>{option.label}</button>)}</div>
                </div>
                <div>
                  <p className={labelClass}>Віковий діапазон</p>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                    <div><label className="sr-only" htmlFor="min_age">Мінімальний вік</label><input id="min_age" type="number" min={16} max={100} value={form.min_age} onChange={(event) => set('min_age', Number(event.target.value))} className={inputClass('min_age')} /></div>
                    <span className="text-brand-ink-muted">—</span>
                    <div><label className="sr-only" htmlFor="max_age">Максимальний вік</label><input id="max_age" type="number" min={16} max={100} value={form.max_age} onChange={(event) => set('max_age', Number(event.target.value))} className={inputClass('max_age')} /></div>
                  </div>
                  {errors.min_age && <p className="mt-1.5 text-xs text-red-600">{errors.min_age}</p>}
                </div>
                <p className="rounded-lg bg-brand-accent-soft px-3 py-2 text-[10px] leading-4 text-brand-ink-muted">Ці параметри впливають на те, кому подія показується у стрічці.</p>
              </div>
            </SectionCard>

            <SectionCard number="6" title="Хто побачить подію?">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {([
                  { value: true, title: 'У стрічці', text: 'Подія з’явиться у стрічці відповідних користувачів поруч.', disabled: false },
                  { value: false, title: 'Лише за запрошенням', text: 'Приватні запрошення ще не підключені.', disabled: true },
                ]).map((option) => {
                  const selected = form.is_public === option.value
                  return <button key={String(option.value)} type="button" disabled={option.disabled} onClick={() => set('is_public', option.value)} aria-pressed={selected} className={`rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${selected ? 'border-brand-accent bg-brand-accent-soft' : 'border-brand-border bg-[#fcfcfe]'}`}><span className="flex items-center gap-2"><span className={`grid h-4 w-4 place-items-center rounded-full border ${selected ? 'border-brand-accent' : 'border-brand-border-strong'}`}>{selected && <span className="h-2 w-2 rounded-full bg-brand-accent"/>}</span><strong className="text-xs text-brand-ink">{option.title}</strong></span><span className="mt-2 block pl-6 text-[11px] leading-[18px] text-brand-ink-muted">{option.text}</span></button>
                })}
              </div>
            </SectionCard>

            <SectionCard number="7" title="Як люди приєднуються?">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {([
                  { value: 'open' as const, title: 'Одразу', text: 'Людина одразу стає учасником, якщо є вільні місця.' },
                  { value: 'approval' as const, title: 'Після підтвердження', text: 'Ви переглядаєте заявку та вирішуєте, кого прийняти.' },
                ]).map((option) => {
                  const selected = form.join_mode === option.value
                  return <button key={option.value} type="button" onClick={() => set('join_mode', option.value)} aria-pressed={selected} className={`rounded-2xl border p-3.5 text-left transition ${selected ? 'border-brand-accent bg-brand-accent-soft' : 'border-brand-border bg-[#fcfcfe]'}`}><span className="flex items-center gap-2"><span className={`grid h-4 w-4 place-items-center rounded-full border ${selected ? 'border-brand-accent' : 'border-brand-border-strong'}`}>{selected && <span className="h-2 w-2 rounded-full bg-brand-accent"/>}</span><strong className="text-xs text-brand-ink">{option.title}</strong></span><span className="mt-2 block pl-6 text-[11px] leading-[18px] text-brand-ink-muted">{option.text}</span></button>
                })}
              </div>
            </SectionCard>

            {form.event_type === 'personal' && <SectionCard number="8" title="Банка на захід" description="Необов’язковий прототип збору для особистої зустрічі.">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-xs font-extrabold text-brand-ink">Банка на захід</p><p className="mt-0.5 text-[10px] leading-4 text-brand-ink-muted">Участь у події не залежить від банки.</p></div>
                  <button type="button" role="switch" aria-checked={form.bank_enabled} onClick={() => set('bank_enabled', !form.bank_enabled)} className={`relative h-7 w-12 flex-none rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${form.bank_enabled ? 'bg-brand-accent' : 'bg-brand-border-strong'}`} aria-label="Банка на захід"><span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.bank_enabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                </div>
                {form.bank_enabled && <div className="grid gap-4 border-t border-brand-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div><label className={labelClass} htmlFor="bank_note">Мета збору</label><input id="bank_note" value={form.bank_note} maxLength={200} onChange={(event) => set('bank_note', event.target.value)} placeholder="На оренду столика та закуски" className={inputClass('bank_note')} />{errors.bank_note && <p className="mt-1.5 text-xs text-red-600">{errors.bank_note}</p>}<p className="mt-2 text-[10px] leading-4 text-brand-ink-muted">Демо QR — підключення реальної банки буде додано пізніше.</p></div>
                  <div className="flex flex-col items-center rounded-xl bg-brand-accent-soft/50 p-3"><DemoQrPlaceholder className="h-20 w-20" /><span className="mt-1 text-[8px] font-bold uppercase tracking-wide text-brand-ink-muted">Демо QR</span></div>
                </div>}
              </div>
            </SectionCard>}

            <SectionCard number={form.event_type === 'personal' ? '9' : '8'} title="Квитки" description="Необов’язковий демо-режим для майбутньої квиткової системи.">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold text-brand-ink">Генерувати квитки</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-brand-ink-muted">Налаштування не зберігаються після створення події.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ticketsEnabled}
                    onClick={() => {
                      setTicketsEnabled((enabled) => !enabled)
                      setErrors((current) => ({ ...current, ticket_quantity: undefined, ticket_price: undefined, submit: undefined }))
                    }}
                    className={`relative h-7 w-12 flex-none rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${ticketsEnabled ? 'bg-brand-accent' : 'bg-brand-border-strong'}`}
                    aria-label="Генерувати квитки"
                  >
                    <span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${ticketsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {ticketsEnabled && (
                  <div className="grid gap-4 border-t border-brand-border pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
                    <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div>
                        <label className={labelClass} htmlFor="ticket_quantity">Кількість квитків *</label>
                        <input
                          id="ticket_quantity"
                          type="number"
                          min={1}
                          step={1}
                          value={ticketQuantity}
                          onChange={(event) => {
                            setTicketQuantity(event.target.value)
                            setErrors((current) => ({ ...current, ticket_quantity: undefined, submit: undefined }))
                          }}
                          className={`${inputClass('ticket_quantity')} max-w-full`}
                        />
                        {errors.ticket_quantity && <p className="mt-1.5 text-xs text-red-600">{errors.ticket_quantity}</p>}
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="ticket_price">Ціна за квиток *</label>
                        <div className="relative">
                          <input
                            id="ticket_price"
                            type="number"
                            min={0}
                            step="0.01"
                            value={ticketPrice}
                            onChange={(event) => {
                              setTicketPrice(event.target.value)
                              setErrors((current) => ({ ...current, ticket_price: undefined, submit: undefined }))
                            }}
                            className={`${inputClass('ticket_price')} pr-10`}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-ink-muted">₴</span>
                        </div>
                        {errors.ticket_price && <p className="mt-1.5 text-xs text-red-600">{errors.ticket_price}</p>}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-[#ddd5f6] bg-gradient-to-br from-white to-[#f5f1ff] p-3.5 shadow-sm">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-brand-accent">Квиток</p>
                          <p className="mt-1.5 truncate text-sm font-extrabold text-brand-ink">{form.title.trim() || 'Назва події'}</p>
                          <p className="mt-2 text-[11px] font-semibold text-brand-ink-soft">
                            {Number.isInteger(Number(ticketQuantity)) && Number(ticketQuantity) >= 1 ? `${Number(ticketQuantity)} квитків` : '— квитків'}
                          </p>
                          <p className="mt-0.5 text-sm font-extrabold text-brand-accent">
                            {ticketPrice.trim() && Number(ticketPrice) === 0 ? 'Безкоштовно' : ticketPrice.trim() && Number(ticketPrice) >= 0 ? `${Number(ticketPrice)} ₴` : '— ₴'}
                          </p>
                        </div>
                        <div className="flex flex-none flex-col items-center">
                          <DemoQrPlaceholder className="h-16 w-16 p-1.5" />
                          <span className="mt-1 text-[8px] font-bold uppercase tracking-wide text-brand-ink-muted">Демо QR</span>
                        </div>
                      </div>
                      <p className="mt-3 border-t border-brand-border pt-2 text-[9px] leading-4 text-brand-ink-muted">QR буде створено після запуску квиткової системи.</p>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            <section className={`rounded-2xl border p-4 ${form.event_type === 'personal' ? 'border-[#e9e3ff] bg-[#f8f6ff]' : 'border-brand-border bg-white'}`}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-ink-muted">Як це виглядатиме</p>
              <div className={`flex min-w-0 gap-3 ${form.event_type === 'public' ? 'items-stretch' : 'items-start'}`}>
                {form.event_type === 'public' && <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl"><EventMedia category={form.category} coverUrl={form.cover_photo_url} alt={form.cover_photo_url ? 'Попередній перегляд обкладинки' : ''} className="h-full w-full" /></div>}
                {form.event_type === 'personal' && <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-white text-lg">{selectedCategory?.emoji}</div>}
                <div className="min-w-0 flex-1">
                  <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-brand-accent">{selectedCategory?.label}</span>
                  <span className={`ml-1.5 rounded-md border px-2 py-1 text-[10px] font-bold ${getEventAccessChipClass(form)}`}>{getEventAccessLabel(form)}</span>
                  <h3 className="mt-2 truncate text-sm font-extrabold">{form.title.trim() || 'Назва вашої події'}</h3>
                  {previewDate && !Number.isNaN(previewDate.getTime()) && <p className="mt-1 text-[11px] text-brand-ink-muted">{previewDate.toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>}
                  <p className="mt-1 truncate text-[11px] text-brand-ink-muted">{[form.venue_name, form.address].filter(Boolean).join(', ') || 'Місце ще не вказано'}</p>
                  <p className="mt-1 text-[10px] font-semibold text-brand-ink-muted">{form.max_participants} учасників</p>
                </div>
              </div>
            </section>

            {errors.submit && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors.submit}</div>}
            <div className="hidden justify-end lg:flex"><button type="submit" disabled={submitting} className="h-12 min-w-52 rounded-xl bg-brand-accent px-6 text-sm font-extrabold text-white transition hover:bg-brand-accent-hover disabled:cursor-wait disabled:opacity-60">{submitting ? 'Зберігаємо...' : eventId ? 'Зберегти зміни' : 'Створити подію'}</button></div>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(23,23,28,0.06)] backdrop-blur-xl lg:hidden">
          <button type="submit" disabled={submitting} className="mx-auto block h-13 w-full max-w-lg rounded-xl bg-brand-accent text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-60">{submitting ? 'Зберігаємо...' : eventId ? 'Зберегти зміни' : 'Створити подію'}</button>
        </div>
      </form>
    </div>
  )
}
