import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createSvoyaEntry, ensureSvoyaProfile, svoyaCategories, svoyaKindLabels, type SvoyaKind } from '@/lib/svoya'

const allowedKinds: SvoyaKind[] = ['event', 'circle', 'beauty', 'business', 'help']

export default function SvoyaCreateEntry() {
  const { supaUser, profile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const rawKind = params.get('kind') as SvoyaKind | null
  const kind: SvoyaKind = rawKind && allowedKinds.includes(rawKind) ? rawKind : 'event'

  const categories = useMemo(() => svoyaCategories[kind], [kind])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(categories[0] || '')
  const [city, setCity] = useState(profile?.city || 'Чернігів')
  const [location, setLocation] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [capacity, setCapacity] = useState(12)
  const [price, setPrice] = useState(0)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isEventLike = kind === 'event' || kind === 'circle'

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supaUser) {
      setErrorMessage('Потрібно увійти до клубу.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      await ensureSvoyaProfile({
        userId: supaUser.id,
        name: profile?.name,
        city,
        bio: profile?.bio,
        interests: profile?.interests,
      })

      const entry = await createSvoyaEntry(supaUser.id, {
        kind,
        title,
        description,
        city,
        category,
        location,
        starts_at: isEventLike && startsAt ? new Date(startsAt).toISOString() : null,
        capacity: isEventLike ? capacity : 12,
        price: kind === 'beauty' || kind === 'business' ? price : 0,
      })

      navigate(`/club/entry/${entry.id}`)
    } catch (error) {
      console.error('[SVOYA create entry]', error)
      setErrorMessage(error instanceof Error ? error.message : 'Не вдалося зберегти публікацію.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] px-4 py-8 text-[#382e32] md:px-8">
      <div className="mx-auto max-w-[860px]">
        <button type="button" onClick={() => navigate(-1)} className="text-[11px] text-[#8a6975]">← Назад до клубу</button>

        <div className="mt-8 rounded-[18px] border border-[#dfd2ce] bg-[#fcfbf9] p-6 md:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a4562]">{svoyaKindLabels[kind]}</p>
          <h1 className="mt-2 font-[Georgia] text-[42px] font-normal leading-none text-[#50303d]">
            {kind === 'event' && 'Створити подію'}
            {kind === 'circle' && 'Створити своє коло'}
            {kind === 'beauty' && 'Додати б’юті-пропозицію'}
            {kind === 'business' && 'Додати пропозицію для бізнесу'}
            {kind === 'help' && 'Додати запит або допомогу'}
          </h1>
          <p className="mt-3 text-[12px] leading-5 text-[#7e7176]">Це реальна публікація клубу. Після збереження вона з’явиться у відповідному розділі.</p>

          <form onSubmit={submit} className="mt-8 grid gap-5">
            <label className="grid gap-2 text-[11px] font-semibold">
              Назва
              <input required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className="h-12 rounded-[12px] border border-[#ddd0cc] bg-white px-4 outline-none focus:border-[#a55b75]" placeholder="Коротко і зрозуміло" />
            </label>

            <label className="grid gap-2 text-[11px] font-semibold">
              Опис
              <textarea required maxLength={5000} rows={6} value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-[12px] border border-[#ddd0cc] bg-white px-4 py-3 outline-none focus:border-[#a55b75]" placeholder="Що пропонуєш, для кого і як це відбуватиметься?" />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-[11px] font-semibold">
                Категорія
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-12 rounded-[12px] border border-[#ddd0cc] bg-white px-4 outline-none">
                  {categories.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-[11px] font-semibold">
                Місто
                <input required minLength={2} maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} className="h-12 rounded-[12px] border border-[#ddd0cc] bg-white px-4 outline-none focus:border-[#a55b75]" />
              </label>
            </div>

            {isEventLike && (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-[11px] font-semibold md:col-span-1">
                  Дата і час
                  <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-12 rounded-[12px] border border-[#ddd0cc] bg-white px-4 outline-none" />
                </label>

                <label className="grid gap-2 text-[11px] font-semibold md:col-span-1">
                  Кількість місць
                  <input type="number" min={2} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="h-12 rounded-[12px] border border-[#ddd0cc] bg-white px-4 outline-none" />
                </label>

                <label className="grid gap-2 text-[11px] font-semibold md:col-span-1">
                  Місце
                  <input maxLength={180} value={location} onChange={(e) => setLocation(e.target.value)} className="h-12 rounded-[12px] border border-[#ddd0cc] bg-white px-4 outline-none" placeholder="Можна уточнити пізніше" />
                </label>
              </div>
            )}

            {(kind === 'beauty' || kind === 'business') && (
              <label className="grid max-w-[240px] gap-2 text-[11px] font-semibold">
                Орієнтовна ціна, грн
                <input type="number" min={0} step="1" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="h-12 rounded-[12px] border border-[#ddd0cc] bg-white px-4 outline-none" />
              </label>
            )}

            {errorMessage && <div className="rounded-[10px] bg-[#f4e4e9] px-4 py-3 text-[11px] text-[#8d2f51]">{errorMessage}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => navigate(-1)} className="rounded-full border border-[#dbcbd0] px-5 py-2.5 text-[10px] text-[#6e5660]">Скасувати</button>
              <button disabled={saving} className="rounded-full bg-[#8d2f51] px-6 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50">{saving ? 'Зберігаємо…' : 'Опублікувати'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
