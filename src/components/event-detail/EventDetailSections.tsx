import type { ReactNode } from 'react'
import type { EventParticipant } from '@/hooks/useEvent'
import { Icon, type IconName } from '@/components/icons'
import ParticipantAvatars from '@/components/home/ParticipantAvatars'
import ProfileAvatar from '@/components/ProfileAvatar'

export function OrganizerHeader({ id, name, age, city, bio, interests, avatarUrl, verified }: { id: string; name: string; age?: number | null; city?: string | null; bio?: string | null; interests?: string[]; avatarUrl: string | null; verified: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <ProfileAvatar profile={{ id, name, age, city, bio, interests, avatar_url: avatarUrl, google_verified: verified }} className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-brand-accent-soft text-sm font-extrabold text-brand-accent" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-brand-ink">{name}</p>
          {verified && <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-accent text-[9px] font-extrabold text-white" aria-label="Підтверджений профіль">✓</span>}
        </div>
        <p className="mt-0.5 text-[11px] text-brand-ink-muted">Запрошує на зустріч</p>
      </div>
      <span className="rounded-full bg-brand-accent-soft px-2 py-1 text-[10px] font-extrabold text-brand-accent">Ведучий</span>
    </div>
  )
}

export function EventInfoRow({ icon, eyebrow, primary, secondary }: { icon: IconName; eyebrow?: string; primary: string; secondary?: string | null }) {
  return (
    <div className="flex gap-3 rounded-xl bg-[#faf9fd] p-3">
      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-accent-soft text-brand-accent"><Icon name={icon} className="h-4.5 w-4.5" /></div>
      <div className="min-w-0 pt-0.5">
        {eyebrow && <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-ink-muted">{eyebrow}</p>}
        <p className="text-xs font-bold leading-5 text-brand-ink">{primary}</p>
        {secondary && <p className="text-[11px] leading-4 text-brand-ink-muted">{secondary}</p>}
      </div>
    </div>
  )
}

export function ParticipantList({ participants, totalCount, capacity }: { participants: EventParticipant[]; totalCount: number; capacity: number }) {
  const users = participants.map((participant) => ({ id: participant.user_id, name: participant.user?.name, avatar_url: participant.user?.avatar_url ?? null }))
  return (
    <section className="rounded-xl bg-[#faf9fd] p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-brand-ink">Учасники</h2>
        <span className="text-xs font-bold text-brand-accent">{totalCount}/{capacity}</span>
      </div>
      {totalCount > 0 ? (
        <div className="flex items-center justify-between gap-3">
          {users.length > 0 ? <ParticipantAvatars users={users} totalCount={totalCount} max={6} /> : <span className="text-xs text-brand-ink-muted">Список учасників доступний після приєднання</span>}
          <span className="text-xs text-brand-ink-muted">{totalCount} {totalCount === 1 ? 'учасник' : 'учасників'}</span>
        </div>
      ) : <p className="text-sm text-brand-ink-muted">Поки немає учасників</p>}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-brand-surface-muted"><div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${Math.min((totalCount / Math.max(capacity, 1)) * 100, 100)}%` }} /></div>
    </section>
  )
}

export function EventRequirements({ gender, age, category, isPublic }: { gender: string; age: string; category: string; isPublic: boolean }) {
  const chips = [gender, age, category, !isPublic ? 'Приватна подія' : null].filter((item): item is string => Boolean(item))
  return (
    <section>
      <h2 className="mb-2.5 text-sm font-extrabold text-brand-ink">Хто підходить?</h2>
      <div className="flex flex-wrap gap-1.5">{chips.map((chip) => <span key={chip} className="rounded-lg border border-[#ebe8f2] bg-[#faf9fd] px-2.5 py-1.5 text-[11px] font-semibold text-brand-ink-soft">{chip}</span>)}</div>
    </section>
  )
}

interface PendingRequestListProps {
  requests: EventParticipant[]
  processingUserId: string | null
  onApprove: (userId: string) => void
  onReject: (userId: string) => void
}

export function PendingRequestList({ requests, processingUserId, onApprove, onReject }: PendingRequestListProps) {
  return (
    <section className="rounded-2xl border border-brand-border bg-white p-4 shadow-card sm:p-5">
      <h2 className="text-base font-extrabold text-brand-ink">
        Запити на участь{requests.length > 0 ? ` · ${requests.length}` : ''}
      </h2>
      {requests.length === 0 ? (
        <p className="mt-3 text-sm text-brand-ink-muted">Нових запитів поки немає</p>
      ) : (
        <div className="mt-4 divide-y divide-brand-border">
          {requests.map((request) => {
            const name = request.user?.name ?? 'Учасник'
            const processing = processingUserId === request.user_id
            return (
              <article key={request.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ProfileAvatar profile={{ id: request.user_id, name, age: request.user?.age, city: request.user?.city, bio: request.user?.bio, interests: request.user?.interests, avatar_url: request.user?.avatar_url ?? null }} className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-brand-accent-soft text-sm font-extrabold text-brand-accent" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-brand-ink">{name}</p>
                    <p className="mt-0.5 text-xs text-brand-ink-muted">{request.user?.age ? `${request.user.age} років · ` : ''}Очікує підтвердження</p>
                    {request.user?.bio && <p className="mt-1 line-clamp-2 max-w-md text-xs leading-5 text-brand-ink-soft">{request.user.bio}</p>}
                    {request.user?.interests?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{request.user.interests.slice(0, 3).map((interest) => <span key={interest} className="rounded-lg bg-brand-surface-muted px-2 py-1 text-[10px] font-semibold text-brand-ink-muted">{interest}</span>)}</div> : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button type="button" disabled={processing} onClick={() => onReject(request.user_id)} className="h-10 rounded-xl border border-brand-border px-3 text-[11px] font-extrabold text-brand-ink-soft transition hover:border-brand-ink-muted hover:bg-brand-surface-muted disabled:cursor-wait disabled:opacity-50">ВІДХИЛИТИ</button>
                  <button type="button" disabled={processing} onClick={() => onApprove(request.user_id)} className="h-10 rounded-xl bg-brand-accent px-3 text-[11px] font-extrabold text-white transition hover:bg-brand-accent-hover disabled:cursor-wait disabled:opacity-50">{processing ? 'ОБРОБЛЯЄМО…' : 'ПІДТВЕРДИТИ'}</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

interface EventActionContentProps {
  isOrganizer: boolean
  joined: boolean
  pending: boolean
  rejected: boolean
  joinMode: 'open' | 'approval'
  isFull: boolean
  joinUnavailableLabel: string | null
  joining: boolean
  leaving: boolean
  onJoin: () => void
  onChat: () => void
  onLeave: () => void
}

export function EventActionContent({ isOrganizer, joined, pending, rejected, joinMode, isFull, joinUnavailableLabel, joining, leaving, onJoin, onChat, onLeave }: EventActionContentProps) {
  let status: ReactNode = null
  let action: ReactNode

  if (isOrganizer) {
    status = <p className="mb-3 text-center text-xs font-semibold text-brand-accent">Ви організатор цієї події</p>
    action = <button type="button" onClick={onChat} className="h-14 w-full rounded-2xl bg-brand-accent px-5 text-sm font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">Чат події</button>
  } else if (joined) {
    status = <p className="mb-3 text-center text-xs font-semibold text-brand-accent">✓ Ви берете участь</p>
    action = <div className="space-y-2"><button type="button" onClick={onChat} className="h-14 w-full rounded-2xl bg-brand-accent px-5 text-sm font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">Перейти до чату</button><button type="button" onClick={onLeave} disabled={leaving} className="h-11 w-full rounded-xl text-xs font-bold text-brand-ink-muted transition hover:bg-brand-surface-muted disabled:cursor-wait disabled:opacity-50">{leaving ? 'Виходимо…' : 'Вийти з події'}</button></div>
  } else if (pending) {
    status = <div className="mb-3 text-center"><p className="text-xs font-semibold text-brand-accent">Запит надіслано</p><p className="mt-1 text-[11px] text-brand-ink-muted">Організатор має підтвердити вашу участь</p></div>
    action = <button type="button" disabled className="h-14 w-full cursor-not-allowed rounded-2xl bg-brand-surface-muted px-5 text-sm font-extrabold text-brand-ink-muted">Запит надіслано</button>
  } else if (rejected) {
    status = <p className="mb-3 text-center text-xs font-semibold text-brand-ink-muted">Запит відхилено</p>
    action = <button type="button" disabled className="h-14 w-full cursor-not-allowed rounded-2xl bg-brand-surface-muted px-5 text-sm font-extrabold text-brand-ink-muted">Запит відхилено</button>
  } else if (joinUnavailableLabel) {
    action = <button type="button" disabled className="h-14 w-full cursor-not-allowed rounded-2xl bg-brand-surface-muted px-5 text-sm font-extrabold text-brand-ink-muted">{joinUnavailableLabel}</button>
  } else if (isFull) {
    action = <button type="button" disabled className="h-14 w-full cursor-not-allowed rounded-2xl bg-brand-surface-muted px-5 text-sm font-extrabold text-brand-ink-muted">Місць немає</button>
  } else {
    action = <button type="button" onClick={onJoin} disabled={joining} className="h-14 w-full rounded-2xl bg-brand-accent px-5 text-sm font-extrabold text-white transition hover:bg-brand-accent-hover disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">{joining ? 'Надсилаємо…' : joinMode === 'approval' ? 'Надіслати запит' : 'Приєднатися'}</button>
  }

  return <>{status}{action}</>
}
