import ProfileAvatar from '@/components/ProfileAvatar'

interface AvatarUser {
  id?: string
  name?: string
  avatar_url: string | null
}

export default function ParticipantAvatars({ users, totalCount = users.length, max = 4 }: { users: AvatarUser[]; totalCount?: number; max?: number }) {
  const visibleUsers = users.slice(0, max)
  const remaining = Math.max(0, totalCount - visibleUsers.length)

  return (
    <div className="flex items-center" aria-label={`${totalCount} учасників`}>
      {visibleUsers.map((user, index) => (
        user.id && user.name ? <ProfileAvatar key={user.id} profile={{ id: user.id, name: user.name, avatar_url: user.avatar_url }} className="-ml-1.5 grid h-8 w-8 first:ml-0 flex-shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-brand-accent-soft text-[9px] font-bold text-brand-accent" /> : <div key={`${user.name}-${index}`} title={user.name} className="-ml-1.5 grid h-7 w-7 first:ml-0 flex-shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-brand-accent-soft text-[9px] font-bold text-brand-accent">{user.avatar_url ? <img src={user.avatar_url} alt={user.name ?? ''} className="h-full w-full object-cover" /> : (user.name?.charAt(0).toUpperCase() ?? '•')}</div>
      ))}
      {remaining > 0 && (
        <div className="-ml-1.5 grid h-7 min-w-7 place-items-center rounded-full border-2 border-white bg-brand-surface-muted px-1 text-[9px] font-bold text-brand-ink-soft">+{remaining}</div>
      )}
    </div>
  )
}
