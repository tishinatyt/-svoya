import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext'
import TopBar from '@/components/TopBar'
import ParticipantAvatars from '@/components/home/ParticipantAvatars'
import { EventContextCard, formatMessageDay, MessageBubble, MessageComposer, MessageDateSeparator, type ChatMessage } from '@/components/chat/ChatComponents'

const MESSAGE_LIMIT = 2000

interface EventChatContext { title: string; address: string; eventDatetime: string; organizerId: string }

function normalizeMessage(row: Record<string, unknown>): ChatMessage {
  const sender = row.sender
  return { id: row.id as string, event_chat_id: row.event_chat_id as string, sender_id: row.sender_id as string, content: row.content as string, created_at: row.created_at as string, sender: Array.isArray(sender) ? sender[0] ?? null : (sender as ChatMessage['sender'] ?? null) }
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => byId.set(message.id, message))
  return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id))
}

function formatEventDate(iso: string) {
  const date = new Date(iso)
  return `${date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}, ${date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`
}

export default function EventChat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { supaUser } = useAuth()
  const { markChatRead } = useUnreadMessages()
  const [event, setEvent] = useState<EventChatContext | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [participantUsers, setParticipantUsers] = useState<{ id: string; name?: string; avatar_url: string | null }[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const initialScrollRef = useRef(true)
  const activeTargetRef = useRef('')
  const loadRequestRef = useRef(0)
  const chatIdRef = useRef<string | null>(null)

  const activeTarget = `${id ?? ''}:${supaUser?.id ?? ''}`
  activeTargetRef.current = activeTarget
  chatIdRef.current = chatId

  const checkAccess = useCallback(async () => {
    if (!id || !supaUser) return false
    const target = `${id}:${supaUser.id}`
    const [{ data: eventRow }, { data: membership }] = await Promise.all([
      supabase.from('events').select('organizer_id').eq('id', id).maybeSingle(),
      supabase.from('event_participants').select('status').eq('event_id', id).eq('user_id', supaUser.id).eq('status', 'joined').maybeSingle(),
    ])
    if (activeTargetRef.current !== target) return false

    const allowed = eventRow?.organizer_id === supaUser.id || Boolean(membership)
    setHasAccess(allowed)
    if (!allowed) { setChatId(null); setMessages([]); setSendError(null) }
    return allowed
  }, [id, supaUser])

  const load = useCallback(async (showLoading = true) => {
    if (!id || !supaUser) return
    const target = `${id}:${supaUser.id}`
    const requestId = ++loadRequestRef.current
    if (showLoading) setLoading(true)
    setSendError(null)

    const [eventResult, membershipResult, participantsResult] = await Promise.all([
      supabase.from('events').select('title, address_text, event_datetime, organizer_id').eq('id', id).single(),
      supabase.from('event_participants').select('status').eq('event_id', id).eq('user_id', supaUser.id).eq('status', 'joined').maybeSingle(),
      supabase.from('event_participants').select('user_id, user:users!event_participants_user_id_fkey(name, avatar_url)').eq('event_id', id).eq('status', 'joined'),
    ])
    if (requestId !== loadRequestRef.current || activeTargetRef.current !== target) return

    if (!eventResult.data) {
      setEvent(null)
      setParticipantUsers([])
      setParticipantCount(0)
      setChatId(null)
      setMessages([])
      setHasAccess(false)
      setLoading(false)
      return
    }

    const eventData = eventResult.data
    setEvent({ title: eventData.title, address: eventData.address_text ?? '', eventDatetime: eventData.event_datetime, organizerId: eventData.organizer_id })
    const allowed = eventData.organizer_id === supaUser.id || Boolean(membershipResult.data)
    setHasAccess(allowed)
    const normalizedUsers = (participantsResult.data ?? []).map((participant) => {
      const user = Array.isArray(participant.user) ? participant.user[0] : participant.user
      return { id: participant.user_id, name: user?.name, avatar_url: user?.avatar_url ?? null }
    })
    setParticipantUsers(normalizedUsers)
    setParticipantCount(normalizedUsers.length)

    if (!allowed) {
      setChatId(null)
      setMessages([])
      setLoading(false)
      return
    }

    const { data: chat } = await supabase.from('event_chats').select('id').eq('event_id', id).maybeSingle()
    if (requestId !== loadRequestRef.current || activeTargetRef.current !== target) return
    if (!chat) {
      setChatId(null)
      setMessages([])
      setSendError('Чат події ще не готовий. Спробуйте оновити сторінку.')
      setLoading(false)
      return
    }

    setChatId(chat.id)
    const { data: rows } = await supabase.from('event_chat_messages').select('id, event_chat_id, sender_id, content, created_at, sender:users!event_chat_messages_sender_id_fkey(id, name, avatar_url)').eq('event_chat_id', chat.id).order('created_at', { ascending: true }).order('id', { ascending: true })
    if (requestId !== loadRequestRef.current || activeTargetRef.current !== target) return

    const loadedMessages = (rows ?? []).map((row) => normalizeMessage(row as unknown as Record<string, unknown>))
    setMessages((current) => mergeMessages(current.filter((message) => message.event_chat_id === chat.id), loadedMessages))
    if (showLoading || nearBottomRef.current) {
      await markChatRead(chat.id, loadedMessages.at(-1)?.created_at ?? new Date().toISOString())
      if (requestId !== loadRequestRef.current || activeTargetRef.current !== target) return
    }
    initialScrollRef.current = true
    setLoading(false)
  }, [id, markChatRead, supaUser])

  useEffect(() => {
    void load()
    return () => { loadRequestRef.current += 1 }
  }, [load])

  useEffect(() => {
    if (!id || !supaUser) return
    const channel = supabase.channel(`event-chat-access:${id}:${supaUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_participants', filter: `event_id=eq.${id}` }, () => { void load(false) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` }, () => { void load(false) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [id, load, supaUser])

  useEffect(() => {
    if (!chatId || !supaUser) return
    const subscribedChatId = chatId
    const channel = supabase.channel(`event-chat:${subscribedChatId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_chat_messages', filter: `event_chat_id=eq.${subscribedChatId}` }, async (payload) => {
      const { data } = await supabase.from('event_chat_messages').select('id, event_chat_id, sender_id, content, created_at, sender:users!event_chat_messages_sender_id_fkey(id, name, avatar_url)').eq('id', (payload.new as { id: string }).id).maybeSingle()
      if (chatIdRef.current !== subscribedChatId) return
      if (!data) { void checkAccess(); return }
      const message = normalizeMessage(data as unknown as Record<string, unknown>)
      if (message.sender_id === supaUser.id) nearBottomRef.current = true
      else if (!nearBottomRef.current) setHasNewMessages(true)
      setMessages((current) => mergeMessages(current, [message]))
      if (nearBottomRef.current) void markChatRead(subscribedChatId, message.created_at)
    }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [chatId, checkAccess, markChatRead, supaUser])

  useEffect(() => {
    if (initialScrollRef.current || nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: initialScrollRef.current ? 'auto' : 'smooth' })
      initialScrollRef.current = false
      setHasNewMessages(false)
    }
  }, [messages])

  function scrollToNewest() {
    nearBottomRef.current = true
    setHasNewMessages(false)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    const newest = messages.at(-1)
    if (chatId && newest) void markChatRead(chatId, newest.created_at)
  }

  async function handleSend() {
    const content = text.trim()
    if (!content || content.length > MESSAGE_LIMIT || !chatId || !supaUser || sending || !hasAccess) return
    const target = activeTarget
    const targetChatId = chatId
    setSending(true); setSendError(null); nearBottomRef.current = true
    const { error } = await supabase.from('event_chat_messages').insert({ event_chat_id: targetChatId, sender_id: supaUser.id, content })
    if (activeTargetRef.current !== target || chatIdRef.current !== targetChatId) return
    if (error) { setSendError('Не вдалося надіслати повідомлення'); await checkAccess() } else setText('')
    if (activeTargetRef.current === target) setSending(false)
  }

  if (loading || hasAccess === null) return <div className="min-h-screen bg-brand-bg"><TopBar title="Чат події" /><div className="mx-auto max-w-5xl space-y-3 px-4 py-6">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl border border-brand-border bg-white" />)}</div></div>
  if (!hasAccess) return <div className="min-h-screen bg-brand-bg text-brand-ink"><TopBar title="Чат події" /><div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-accent-soft text-2xl">🔒</div><h1 className="text-xl font-extrabold">Чат доступний учасникам події</h1><p className="mt-2 max-w-sm text-sm leading-6 text-brand-ink-muted">Доступ мають організатор і підтверджені учасники зі статусом участі.</p><button type="button" onClick={() => navigate(`/event/${id}`)} className="mt-6 h-12 rounded-xl bg-brand-accent px-6 text-sm font-bold text-white">До події</button></div></div>

  const eventTitle = event?.title ?? 'Подія'
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-brand-bg text-brand-ink">
      <TopBar title={eventTitle} />
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-brand-border bg-white/95 px-2.5 backdrop-blur-xl lg:hidden">
        <button type="button" onClick={() => navigate(`/event/${id}`)} aria-label="Назад" className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl text-xl hover:bg-brand-surface-muted focus-visible:outline-2 focus-visible:outline-brand-accent">←</button>
        <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-extrabold">{eventTitle}</h1><p className="mt-0.5 text-xs text-brand-ink-muted">{participantCount} учасників</p></div>
        <ParticipantAvatars users={participantUsers} totalCount={participantCount} max={2} />
        <button type="button" onClick={() => navigate(`/event/${id}`)} className="h-9 rounded-xl px-2 text-xs font-bold text-brand-accent hover:bg-brand-accent-soft">Деталі</button>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-[960px] flex-1 flex-col lg:px-6 lg:pb-6">
        <div onScroll={(scrollEvent) => { const element = scrollEvent.currentTarget; const wasNearBottom = nearBottomRef.current; const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120; nearBottomRef.current = isNearBottom; if (isNearBottom) { setHasNewMessages(false); const newest = messages.at(-1); if (!wasNearBottom && chatId && newest) void markChatRead(chatId, newest.created_at) } }} className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 lg:rounded-t-2xl lg:border-x lg:border-t lg:border-brand-border lg:bg-white/50">
          {event && <EventContextCard title={eventTitle} date={formatEventDate(event.eventDatetime)} address={event.address} participantCount={participantCount} onDetails={() => navigate(`/event/${id}`)} />}
          {messages.length === 0 ? <div className="grid min-h-56 place-items-center text-center"><div><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-accent-soft text-xl">💬</div><h2 className="font-extrabold">Почніть розмову</h2><p className="mt-1 max-w-sm text-sm leading-6 text-brand-ink-muted">Домовтесь про деталі зустрічі з іншими учасниками.</p></div></div> : messages.map((message, index) => {
            const day = formatMessageDay(message.created_at)
            const showDay = !messages[index - 1] || formatMessageDay(messages[index - 1].created_at) !== day
            const showSender = showDay || !messages[index - 1] || messages[index - 1].sender_id !== message.sender_id
            return <div key={message.id}>{showDay && <MessageDateSeparator date={day} />}<div className={showSender ? 'mb-2.5' : 'mb-1'}><MessageBubble message={message} isMine={message.sender_id === supaUser?.id} showSender={showSender} /></div></div>
          })}
          <div ref={bottomRef} />
          {hasNewMessages && <button type="button" onClick={scrollToNewest} className="sticky bottom-3 mx-auto block rounded-full bg-brand-accent px-4 py-2 text-xs font-bold text-white shadow-lg">Нові повідомлення</button>}
        </div>
        <div className="sticky bottom-0 z-20 flex-shrink-0 lg:static"><MessageComposer value={text} sending={sending} disabled={!hasAccess || !chatId} error={sendError} maxLength={MESSAGE_LIMIT} onChange={setText} onSend={() => { void handleSend() }} /></div>
      </div>
    </div>
  )
}
