import { useAuth } from '@/contexts/AuthContext'
import { useProfilePreview, type ProfilePreviewData } from '@/contexts/ProfilePreviewContext'

interface ProfileAvatarProps {
  profile: ProfilePreviewData
  className: string
  imageClassName?: string
}

export default function ProfileAvatar({ profile, className, imageClassName = 'h-full w-full object-cover' }: ProfileAvatarProps) {
  const { supaUser } = useAuth()
  const { openProfilePreview } = useProfilePreview()
  const content = profile.avatar_url ? <img src={profile.avatar_url} alt={profile.name} className={imageClassName} /> : profile.name.charAt(0).toUpperCase()

  if (!profile.id || profile.id === supaUser?.id) return <div className={className}>{content}</div>

  return (
    <button type="button" onClick={(event) => { event.stopPropagation(); openProfilePreview(profile, event.currentTarget) }} aria-label={`Переглянути профіль ${profile.name}`} className={`${className} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent`}>
      {content}
    </button>
  )
}
