import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ensureSvoyaProfile, getSvoyaEntry, requestToEntry, svoyaKindLabels, type SvoyaEntry } from '@/lib/svoya'

export default function SvoyaEntryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { supaUser, profile } = useAuth()
  const [entry, setEntry] = useState<SvoyaEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    void getSvoyaEntry(id)
      .then((value) => { if (!cancelled) setEntry(value) })
      .catch((error) => console.error('[SVOYA entry]', error))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!entry || !supaUser) {
      setStatus('Потрібно увійти до клубу.')
      return
    }

    setSending(true)
    setStatus('')

    try {
      await ensureSvoyaProfile({
        userId: supaUser.id,
        name: profile?.name,
        city: profile?.city,
        bio: profile?.bio,
        interests: profile?.interests,
      })

      await requestToEntry({
        entryId: entry.id,
        userId: supaUser.id,
        kind: entry.kind,
        message: message || 'Хочу долучитися.',
        contact: contact || profile?.name || 'Контакт у профілі',
      })

      setStatus(entry.kind === 'event' || entry.kind === 'circle' ? 'Заявку на участь надіслано.' : 'Запит надіслано авторці.')
    } catch (error) {
      console.error('[SVOYA request]', error)
      setStatus(error instanceof Error ? error.message : 'Не вдалося надіслати заявку.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#f8f6f3] p-8 text-[#7f7377]">Завантажуємо…</div>
  if (!entry) return <div className="min-h-screen bg-[#f8f6f3] p-8"><Link to="/club">← До клубу</Link><p className="mt-8">Публікацію не знайдено.</p></div>

  const eventLike = entry.kind === 'event' || entry.kind === 'circle'

  return (
    <div className="min-h-screen bg-[#f8f6f3] px-4 py-8 text-[#382e32] md:px-8">
      <div className="mx-auto max-w-[900px]">
        <button type="button" onClick={() => navigate(-1)} className="text-[11px] text-[#8a6975]">← Назад</button>

        <article className="mt-8 overflow-hidden rounded-[18px] border border-[#ded1cd] bg-[#fcfbf9]">
          <div className="border-b border-[#e7ddd9] px-6 py-6 md:px-8">
            <div className="flex flex-wrap items-center gap-3 text-[9px] uppercase tracking-[0.13em] text-[#9a6578]">
              <span>{svoyaKindLabels[entry.kind]}</span>
              <span>•</span>
              <span>{entry.city}</span>
              {entry.category && <><span>•</span><span>{entry.category}</span></>}
            </div>
            <h1 className="mt-3 font-[Georgia] text-[46px] font-normal leading-[0.98] text-[#52323f]">{entry.title}</h1>
            <p className="mt-5 whitespace-pre-wrap text-[13px] leading-6 text-[#706367]">{entry.description}</p>
          </div>

          <div className="grid gap-5 px-6 py-6 md:grid-cols-[1fr_320px] md:px-8">
            <div className="grid content-start gap-3 text-[11px] text-[#6f6367]">
              {entry.location && <div><strong>Місце:</strong> {entry.location}</div>}
              {entry.starts_at && <div><strong>Коли:</strong> {new Date(entry.starts_at).toLocaleString('uk-UA')}</div>}
              {eventLike && <div><strong>Місць:</strong> до {entry.capacity}</div>}
              {entry.price > 0 && <div><strong>Ціна:</strong> {entry.price} грн</div>}
              {entry.is_demo && <div className="rounded-[9px] bg-[#efede8] px-4 py-3 text-[10px]">Це приклад формату. Реальна заявка відкривається для публікацій учасниць.</div>}
            </div>

            {!entry.is_demo && (
              <form onSubmit={submit} className="rounded-[14px] bg-[#f1e7ea] p-4">
                <h2 className="font-[Georgia] text-[24px] text-[#6f4052]">{eventLike ? 'Хочу долучитися' : 'Написати авторці'}</h2>

                {!eventLike && (
                  <>
                    <textarea required minLength={3} maxLength={2000} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-4 w-full rounded-[10px] border border-[#dccbd1] bg-white p-3 text-[11px] outline-none" placeholder="Коротко напиши, що саме тебе цікавить" />
                    <input required minLength={3} maxLength={180} value={contact} onChange={(e) => setContact(e.target.value)} className="mt-2 h-10 w-full rounded-[10px] border border-[#dccbd1] bg-white px-3 text-[11px] outline-none" placeholder="Телефон / Telegram / Instagram" />
                  </>
                )}

                {status && <div className="mt-3 text-[10px] leading-4 text-[#7b455a]">{status}</div>}
                <button disabled={sending} className="mt-4 w-full rounded-full bg-[#8d2f51] px-5 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50">{sending ? 'Надсилаємо…' : eventLike ? 'Надіслати заявку' : 'Надіслати запит'}</button>
              </form>
            )}
          </div>
        </article>
      </div>
    </div>
  )
}
