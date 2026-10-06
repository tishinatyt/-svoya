import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TopBar from '@/components/TopBar'
import { Icon } from '@/components/icons'
import EventMedia from '@/components/EventMedia'

interface ChatItem {
  event_id: string
  event_title: string
  category: string
  address_text: string
  cover_photo_url: string | null
  event_datetime: string
  event_status: string
  member_role: 'organizer' | 'participant'
  chat_id: string
  last_message: string | null
  last_message_at: string | null
  last_sender_name: string | null
  unread_count: number
}

interface ChatUnreadCount {
  event_chat_id: string
  unread_count: number | string
}

function formatListTime(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay ? date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

function isPast(item: ChatItem) {
  return item.event_status === 'completed' || new Date(item.event_datetime).getTime() < Date.now()
}

export default function Chats() {
  const navigate = useNavigate()
  const { supaUser } = useAuth()
  const [chats, setChats] = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const fetchChats = useCallback(async (showLoading = false) => {
    if (!supaUser) {
      requestIdRef.current += 1
      setChats([])
      setError(null)
      setLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    if (showLoading) setLoading(true)
    const [chatsResult, unreadResult] = await Promise.all([
      supabase.rpc('get_accessible_event_chats'),
      supabase.rpc('get_accessible_event_chat_unread_counts'),
    ])
    if (requestId !== requestIdRef.current) return

    const { data, error: chatsError } = chatsResult
    if (chatsError) {
      console.error('Failed to load chats', chatsError)
      setError('Не вдалося завантажити чати')
    } else {
      if (unreadResult.error) console.error('Failed to load per-chat unread counts', unreadResult.error)
      const unreadRows = (unreadResult.data ?? []) as ChatUnreadCount[]
      const unreadByChat = new Map<string, number>(unreadRows.map((row) => [row.event_chat_id, Number(row.unread_count)]))
      setChats(((data ?? []) as Omit<ChatItem, 'unread_count'>[]).map((chat) => ({ ...chat, unread_count: unreadByChat.get(chat.chat_id) ?? 0 })))
      setError(null)
    }
    setLoading(false)
  }, [supaUser])

  useEffect(() => {
    void fetchChats(true)
    return () => { requestIdRef.current += 1 }
  }, [fetchChats])

  useEffect(() => {
    if (!supaUser) return
    const channel = supabase.channel(`chat-list:${supaUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_chat_messages' }, () => { void fetchChats() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_chat_read_state', filter: `user_id=eq.${supaUser.id}` }, () => { void fetchChats() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_participants', filter: `user_id=eq.${supaUser.id}` }, () => { void fetchChats() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void fetchChats() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchChats, supaUser])

  return (
    <div className="min-h-screen bg-brand-bg pb-24 text-brand-ink lg:pb-10">
      <TopBar title="Повідомлення" />
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-brand-border bg-white/95 px-4 backdrop-blur-xl lg:hidden">
        <h1 className="text-base font-extrabold">Повідомлення</h1>
      </header>
      <div className="mx-auto max-w-[960px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-5 hidden lg:block">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Повідомлення</h1>
          <p className="mt-1 text-sm text-brand-ink-muted">Чати ваших подій</p>
        </header>

        {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => { void fetchChats(true) }} className="min-h-10 rounded-xl bg-white px-3 font-bold text-red-700 shadow-sm">Спробувати ще раз</button></div>}
        {loading && <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl border border-brand-border bg-white" />)}</div>}

        {!loading && !error && chats.length === 0 && (
          <div className="rounded-2xl border border-brand-border bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-accent-soft text-brand-accent"><Icon name="message" className="h-5 w-5" /></div>
            <h2 className="text-lg font-extrabold">Поки що немає чатів</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-ink-muted">Приєднуйтесь до подій — після цього тут з’являться ваші чати.</p>
            <button type="button" onClick={() => navigate('/')} className="mt-5 h-11 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white transition hover:bg-brand-accent-hover">Знайти події</button>
          </div>
        )}

        {!loading && chats.length > 0 && <div className="space-y-2">
          {chats.map((item) => {
            const past = isPast(item)
            const hasUnread = item.unread_count > 0
            const preview = item.last_message ? `${item.last_sender_name ? `${item.last_sender_name}: ` : ''}${item.last_message}` : item.address_text || 'Розмова ще не почалася'
            return (
              <button key={item.chat_id} type="button" onClick={() => navigate(`/event/${item.event_id}/chat`)} className={`flex min-h-20 w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-brand-accent/25 hover:bg-brand-accent-soft/25 focus-visible:outline-2 focus-visible:outline-brand-accent sm:px-4 ${hasUnread ? 'border-brand-accent/25 bg-brand-accent-soft/30' : 'border-brand-border bg-white'}`}>
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl"><EventMedia category={item.category} coverUrl={item.cover_photo_url} alt={item.cover_photo_url ? item.event_title : ''} className="h-full w-full" compactFallback /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-extrabold text-brand-ink sm:text-base">{item.event_title}</h2>
                  <p className={`mt-0.5 truncate text-xs sm:text-sm ${hasUnread ? 'font-semibold text-brand-ink-soft' : 'text-brand-ink-muted'}`}>{preview}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold">
                    {item.member_role === 'organizer' && <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-brand-accent">Організатор</span>}
                    {past && <span className="rounded-full bg-brand-surface-muted px-2 py-0.5 text-brand-ink-muted">Подія завершена</span>}
                  </div>
                </div>
                <div className="flex min-h-14 flex-shrink-0 flex-col items-end justify-between gap-2">
                  {item.last_message_at ? <time dateTime={item.last_message_at} className="text-[11px] text-brand-ink-muted">{formatListTime(item.last_message_at)}</time> : <span />}
                  {hasUnread && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent px-1.5 text-[10px] font-extrabold leading-none text-white" aria-label={`${item.unread_count} непрочитані повідомлення`}>{item.unread_count > 99 ? '99+' : item.unread_count}</span>}
                </div>
              </button>
            )
          })}
        </div>}
      </div>
    </div>
  )
}
