import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { InterestChips } from '@/components/profile/ProfileComponents'

export interface ProfilePreviewData {
  id: string
  name: string
  age?: number | null
  city?: string | null
  bio?: string | null
  interests?: string[]
  avatar_url: string | null
  profile_photos?: string[]
  google_verified?: boolean
}

interface ProfilePreviewValue {
  openProfilePreview: (profile: ProfilePreviewData, trigger?: HTMLElement | null) => void
}

const ProfilePreviewContext = createContext<ProfilePreviewValue | null>(null)
const PUBLIC_PROFILE_FIELDS = 'id, name, age, city, bio, interests, avatar_url, profile_photos, google_verified'
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export function ProfilePreviewProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfilePreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const requestIdRef = useRef(0)

  const close = useCallback(() => {
    requestIdRef.current += 1
    setProfile(null)
    setLoading(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const openProfilePreview = useCallback((preview: ProfilePreviewData, trigger?: HTMLElement | null) => {
    const requestId = ++requestIdRef.current
    triggerRef.current = trigger ?? document.activeElement as HTMLElement | null
    setProfile(preview)
    setLoading(false)
    if (!isUuid(preview.id)) return

    setLoading(true)
    void supabase.from('users').select(PUBLIC_PROFILE_FIELDS).eq('id', preview.id).maybeSingle().then(({ data, error }) => {
      if (requestIdRef.current !== requestId) return
      if (error) console.error('[ProfilePreview] Failed to load profile:', error)
      if (data) setProfile(data as ProfilePreviewData)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!profile) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [close, profile])

  return (
    <ProfilePreviewContext.Provider value={{ openProfilePreview }}>
      {children}
      {profile && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
          <section role="dialog" aria-modal="true" aria-labelledby="profile-preview-title" className="relative w-full max-w-sm rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl sm:rounded-3xl sm:p-6">
            <button ref={closeButtonRef} type="button" onClick={close} aria-label="Закрити попередній перегляд профілю" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-xl text-brand-ink-muted hover:bg-brand-surface-muted focus-visible:outline-2 focus-visible:outline-brand-accent">×</button>
            <div className="flex items-center gap-4 pr-9">
              <div className="grid h-20 w-20 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-brand-accent-soft text-2xl font-extrabold text-brand-accent">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.name} className="h-full w-full object-cover" /> : profile.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 id="profile-preview-title" className="truncate text-xl font-extrabold tracking-[-0.025em] text-brand-ink">{profile.name}{profile.age ? `, ${profile.age}` : ''}</h2>
                {profile.city && <p className="mt-1 truncate text-sm text-brand-ink-muted">{profile.city}</p>}
                {loading && <p className="mt-1 text-xs text-brand-ink-muted" aria-live="polite">Завантажуємо профіль…</p>}
              </div>
            </div>
            {profile.bio && <p className="mt-4 line-clamp-3 text-sm leading-6 text-brand-ink-soft">{profile.bio}</p>}
            {profile.interests?.length ? <div className="mt-4"><InterestChips selected={profile.interests.slice(0, 4)} /></div> : null}
            {isUuid(profile.id) && <button type="button" onClick={() => { const id = profile.id; close(); navigate(`/profile/${id}`) }} className="mt-5 h-12 w-full rounded-xl bg-brand-accent px-4 text-sm font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">Переглянути профіль</button>}
          </section>
        </div>
      )}
    </ProfilePreviewContext.Provider>
  )
}

export function useProfilePreview() {
  const context = useContext(ProfilePreviewContext)
  if (!context) throw new Error('useProfilePreview must be used within ProfilePreviewProvider')
  return context
}
