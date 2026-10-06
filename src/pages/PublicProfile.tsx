import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { InterestChips } from '@/components/profile/ProfileComponents'
import TopBar from '@/components/TopBar'
import type { ProfilePreviewData } from '@/contexts/ProfilePreviewContext'
import { ProfilePhotoGallery } from '@/components/profile/ProfilePhotoGallery'

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { supaUser } = useAuth()
  const [profile, setProfile] = useState<ProfilePreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!userId || userId === supaUser?.id) return
    let cancelled = false
    setLoading(true)
    setError(false)
    setProfile(null)

    void supabase.from('users').select('id, name, age, city, bio, interests, avatar_url, profile_photos, google_verified').eq('id', userId).maybeSingle().then(({ data, error: profileError }) => {
      if (cancelled) return
      if (profileError) console.error('[PublicProfile] Failed to load profile:', profileError)
      setProfile(data as ProfilePreviewData | null)
      setError(Boolean(profileError) || !data)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [supaUser?.id, userId])

  if (userId === supaUser?.id) return <Navigate to="/profile" replace />

  return (
    <div className="min-h-screen bg-brand-bg pb-24 text-brand-ink lg:pb-10">
      <TopBar title="Профіль" />
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-brand-ink-soft hover:bg-white focus-visible:outline-2 focus-visible:outline-brand-accent">← Назад</button>
        {loading && <div className="h-72 animate-pulse rounded-3xl border border-brand-border bg-white" />}
        {!loading && error && <div role="alert" className="rounded-3xl border border-brand-border bg-white px-6 py-12 text-center"><h1 className="text-xl font-extrabold">Профіль не знайдено</h1><p className="mt-2 text-sm text-brand-ink-muted">Можливо, він більше недоступний.</p></div>}
        {!loading && profile && <article className="rounded-3xl border border-brand-border bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-brand-accent-soft text-4xl font-extrabold text-brand-accent">{profile.avatar_url ? <img src={profile.avatar_url} alt={profile.name} className="h-full w-full object-cover" /> : profile.name.charAt(0).toUpperCase()}</div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.03em]">{profile.name}{profile.age ? `, ${profile.age}` : ''}</h1>
            {profile.city && <p className="mt-1 text-sm text-brand-ink-muted">{profile.city}</p>}
          </div>
          {profile.bio && <section className="mt-7 border-t border-brand-border pt-6"><h2 className="text-sm font-extrabold">Про себе</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-brand-ink-soft">{profile.bio}</p></section>}
          <ProfilePhotoGallery photos={profile.profile_photos ?? []} name={profile.name} />
          {profile.interests?.length ? <section className="mt-6"><h2 className="mb-3 text-sm font-extrabold">Інтереси</h2><InterestChips selected={profile.interests} /></section> : null}
        </article>}
      </div>
    </div>
  )
}
