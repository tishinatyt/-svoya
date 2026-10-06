import type { FormEvent, KeyboardEvent } from 'react'
import { Icon } from '@/components/icons'
import ProfileAvatar from '@/components/ProfileAvatar'

export interface ChatSender {
  id: string
  name: string
  avatar_url: string | null
}

export interface ChatMessage {
  id: string
  event_chat_id: string
  sender_id: string
  content: string
  created_at: string
  sender: ChatSender | null
}

export function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

export function formatMessageDay(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(date, today)) return 'Сьогодні'
  if (sameDay(date, yesterday)) return 'Вчора'
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}

export function MessageDateSeparator({ date }: { date: string }) {
  return <div className="my-4 flex justify-center" aria-label={date}><span className="rounded-full bg-brand-surface-muted px-3 py-1 text-[10px] font-bold text-brand-ink-muted">{date}</span></div>
}

export function MessageBubble({ message, isMine, showSender = true }: { message: ChatMessage; isMine: boolean; showSender?: boolean }) {
  const senderName = message.sender?.name ?? 'Учасник'
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      {!isMine && (showSender && message.sender ? <ProfileAvatar profile={{ id: message.sender.id, name: senderName, avatar_url: message.sender.avatar_url }} className="grid h-9 w-9 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-brand-accent-soft text-xs font-extrabold text-brand-accent" /> : <span className="w-9 flex-shrink-0" />)}
      <div className={`flex max-w-[76%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {!isMine && showSender && <span className="mb-1 px-1 text-[11px] font-bold text-brand-ink-muted">{senderName}</span>}
        <div className={`whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-sm leading-5 ${isMine ? 'rounded-br-md bg-brand-accent text-white' : 'rounded-bl-md bg-brand-surface-muted text-brand-ink'}`}>{message.content}</div>
        <time dateTime={message.created_at} className="mt-1 px-1 text-[10px] text-brand-ink-muted">{formatMessageTime(message.created_at)}</time>
      </div>
    </div>
  )
}

export function EventContextCard({ title, date, address, participantCount, onDetails }: { title: string; date: string; address: string; participantCount: number; onDetails: () => void }) {
  return (
    <section className="mb-4 flex items-center gap-3 rounded-2xl border border-brand-border bg-white p-3">
      <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-brand-accent-soft text-brand-accent"><Icon name="calendar" className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-extrabold text-brand-ink">{title}</h2>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-ink-muted">
          <span>{date}</span>
          {address && <span className="flex min-w-0 items-center gap-1"><Icon name="pin" className="h-3 w-3 flex-shrink-0 text-brand-accent" /><span className="max-w-48 truncate">{address}</span></span>}
          <span>{participantCount} учасників</span>
        </div>
      </div>
      <button type="button" onClick={onDetails} className="h-9 flex-shrink-0 rounded-xl bg-brand-accent-soft px-3 text-xs font-bold text-brand-accent hover:bg-brand-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">Деталі</button>
    </section>
  )
}

interface MessageComposerProps {
  value: string
  sending: boolean
  disabled?: boolean
  error: string | null
  maxLength: number
  onChange: (value: string) => void
  onSend: () => void
}

export function MessageComposer({ value, sending, disabled, error, maxLength, onChange, onSend }: MessageComposerProps) {
  const submit = (event: FormEvent) => { event.preventDefault(); onSend() }
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() }
  }
  return (
    <form onSubmit={submit} className="border-t border-brand-border bg-white/95 px-3 py-2.5 backdrop-blur-xl pb-safe sm:px-4">
      <div className="mx-auto max-w-4xl">
        {error && <p role="alert" className="mb-2 px-1 text-xs text-red-600">{error}</p>}
        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="chat-message" className="sr-only">Написати повідомлення</label>
            <textarea id="chat-message" rows={1} value={value} maxLength={maxLength} disabled={disabled} onChange={(event) => onChange(event.target.value)} onKeyDown={keyDown} placeholder="Написати повідомлення..." className="max-h-32 min-h-11 w-full resize-none rounded-[22px] border border-transparent bg-brand-surface-muted px-4 py-2.5 pr-12 text-sm text-brand-ink outline-none transition placeholder:text-brand-ink-muted focus:border-brand-accent/35 focus:bg-white focus:ring-3 focus:ring-brand-accent/10 disabled:cursor-not-allowed disabled:opacity-60" />
            {value.length >= maxLength - 200 && <span className="absolute bottom-2.5 right-3 text-[10px] text-brand-ink-muted">{value.length}/{maxLength}</span>}
          </div>
          <button type="submit" disabled={disabled || sending || !value.trim()} className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-brand-accent text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:cursor-not-allowed disabled:opacity-40" aria-label="Відправити повідомлення"><span className="text-lg leading-none">↑</span></button>
        </div>
      </div>
    </form>
  )
}
