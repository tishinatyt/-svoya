import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'
import LandingPage from '@/components/onboarding/LandingPage'
import { InterestChips } from '@/components/profile/ProfileComponents'
import { CitySelect } from '@/components/profile/CitySelect'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const ONBOARDING_INTERESTS = [
  'Кава', 'Прогулянки', 'Подорожі', 'Кіно', 'Музика', 'Бар', 'Спорт', 'Настільні ігри',
  'Технології', 'Бізнес', 'Мистецтво', 'Театр', 'Танці', 'Їжа', 'Нетворкінг', 'Мови',
] as const

type OnboardingStep = 'landing' | 'profile' | 'interests'

export default function Onboarding() {
  const navigate = useNavigate()
  const { supaUser, profile, signInWithGoogle, signInAnonymously, refreshProfile } = useAuth()
  const [step, setStep] = useState<OnboardingStep>(() => {
    if (!supaUser) return 'landing'
    return supaUser.user_metadata?.poruch_onboarding === 'interests' ? 'interests' : 'profile'
  })
  const [name, setName] = useState(profile?.name ?? supaUser?.user_metadata?.full_name?.trim() ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(profile?.avatar_url ?? supaUser?.user_metadata?.avatar_url ?? null)
  const [uploadedAvatar, setUploadedAvatar] = useState<{ userId: string; url: string } | null>(null)
  const [onboardingUserId, setOnboardingUserId] = useState<string | null>(supaUser?.id ?? null)
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!photo) return
    const objectUrl = URL.createObjectURL(photo)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Оберіть зображення JPG, PNG, WebP або GIF')
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError('Зображення має бути менше 5 МБ')
      return
    }
    setPhoto(file)
    setUploadedAvatar(null)
    setError(null)
  }

  async function continueToInterests() {
    if (submittingRef.current) return
    const cleanName = name.trim()
    if (cleanName.length < 2) { setError('Вкажіть ім’я'); return }
    if (cleanName.length > 80) { setError('Ім’я може містити до 80 символів'); return }
    if (!city) { setError('Оберіть місто'); return }
    if (!photo && !profile?.avatar_url && !supaUser?.user_metadata?.avatar_url && !uploadedAvatar) { setError('Додайте фото'); return }

    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      const authUser = supaUser ?? await signInAnonymously()
      setOnboardingUserId(authUser.id)

      let avatarUrl = uploadedAvatar?.userId === authUser.id ? uploadedAvatar.url : profile?.avatar_url ?? authUser.user_metadata?.avatar_url ?? null
      if (photo && uploadedAvatar?.userId !== authUser.id) {
        const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${authUser.id}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, photo, { upsert: false })
        if (uploadError) throw uploadError
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
        setUploadedAvatar({ userId: authUser.id, url: avatarUrl })
      }
      if (!avatarUrl) throw new Error('Avatar upload did not return a URL')

      const { error: profileError } = await supabase.from('users').upsert({
        id: authUser.id,
        name: cleanName,
        city,
        avatar_url: avatarUrl,
      })
      if (profileError) throw profileError

      // Mark step 1 complete only after the profile write succeeds. Otherwise a failed
      // upload/profile save could strand the account on step 2 with no usable profile.
      const { error: markerError } = await supabase.auth.updateUser({ data: { poruch_onboarding: 'interests' } })
      if (markerError) throw markerError

      await refreshProfile(authUser.id)
      setStep('interests')
    } catch (submitError) {
      console.error('Anonymous onboarding failed', submitError)
      setError('Не вдалося створити профіль. Спробуйте ще раз')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function finishOnboarding() {
    const userId = supaUser?.id ?? onboardingUserId
    if (!userId || submittingRef.current || interests.length < 2 || interests.length > 6) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      const { error: interestsError } = await supabase.from('users').update({ interests }).eq('id', userId)
      if (interestsError) throw interestsError
      const { error: markerError } = await supabase.auth.updateUser({ data: { poruch_onboarding: 'complete' } })
      if (markerError) throw markerError
      await refreshProfile(userId)
      navigate('/club', { replace: true })
    } catch (finishError) {
      console.error('Interest onboarding failed', finishError)
      setError('Не вдалося зберегти інтереси. Спробуйте ще раз')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (step === 'landing') return <LandingPage onStart={() => { setError(null); setStep('profile') }} onGoogleSignIn={() => { setError(null); void signInWithGoogle().catch((signInError) => { console.error('Google sign-in failed', signInError); setError('Не вдалося увійти через Google. Спробуйте ще раз') }) }} error={error} />

  if (step === 'interests') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-brand-bg px-4 py-8 text-brand-ink sm:px-6"><main className="w-full max-w-lg rounded-3xl border border-brand-border bg-white p-6 shadow-card sm:p-8"><BrandLogo className="mx-auto w-36" /><p className="mt-6 text-center text-xs font-bold text-brand-accent">КРОК 2 З 2</p><h1 className="mt-2 text-center text-2xl font-extrabold tracking-[-0.035em]">Що тобі цікаво?</h1><p className="mt-2 text-center text-sm leading-6 text-brand-ink-muted">Обери кілька інтересів, щоб налаштувати свій профіль.</p><div className="mt-7"><InterestChips selected={interests} editable max={6} options={ONBOARDING_INTERESTS} onChange={(values) => { setInterests(values); setError(null) }} /></div><div className="mt-4 flex items-center justify-between"><p className="text-xs text-brand-ink-muted">Оберіть щонайменше 2</p><span className="rounded-full bg-brand-accent-soft px-2.5 py-1 text-xs font-extrabold text-brand-accent">{interests.length} / 6</span></div>{error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<button type="button" onClick={() => { void finishOnboarding() }} disabled={submitting || interests.length < 2} className="mt-7 h-14 w-full rounded-2xl bg-brand-accent text-sm font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:cursor-not-allowed disabled:opacity-45">{submitting ? 'ЗБЕРІГАЄМО…' : 'ГОТОВО'}</button></main></div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-bg px-4 py-8 text-brand-ink sm:px-6"><main className="w-full max-w-md rounded-3xl border border-brand-border bg-white p-6 shadow-card sm:p-8"><BrandLogo className="mx-auto w-40" /><p className="mt-6 text-center text-xs font-bold text-brand-accent">КРОК 1 З 2</p><h1 className="mt-2 text-center text-2xl font-extrabold leading-tight tracking-[-0.035em]">Знайомства та події поруч</h1><div className="mt-8 space-y-6"><label className="block text-sm font-bold text-brand-ink-soft">Ім’я<input value={name} maxLength={80} autoComplete="name" onChange={(event) => setName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-brand-border bg-brand-bg px-4 font-normal text-brand-ink outline-none transition focus:border-brand-accent focus:bg-white focus:ring-3 focus:ring-brand-accent/10" /></label><label className="block text-sm font-bold text-brand-ink-soft">Місто<CitySelect value={city} onChange={(value) => { setCity(value); setError(null) }} required className="mt-2 h-12 w-full rounded-xl border border-brand-border bg-brand-bg px-4 font-normal text-brand-ink outline-none transition focus:border-brand-accent focus:bg-white focus:ring-3 focus:ring-brand-accent/10" /></label><div><span className="block text-sm font-bold text-brand-ink-soft">Фото</span><div className="mt-3 flex flex-col items-center"><button type="button" onClick={() => fileRef.current?.click()} disabled={submitting} className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-2 border-dashed border-brand-accent/35 bg-brand-accent-soft text-brand-accent transition hover:border-brand-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand-accent disabled:cursor-wait disabled:opacity-60" aria-label={previewUrl ? 'Замінити фото профілю' : 'Додати фото профілю'}>{previewUrl ? <img src={previewUrl} alt="Попередній перегляд фото профілю" className="h-full w-full object-cover" /> : <span className="text-3xl font-light" aria-hidden="true">+</span>}</button><button type="button" onClick={() => fileRef.current?.click()} disabled={submitting} className="mt-2 min-h-10 rounded-xl px-4 text-sm font-bold text-brand-accent transition hover:bg-brand-accent-soft disabled:cursor-wait disabled:opacity-60">{previewUrl ? 'Замінити фото' : '+ Додати фото'}</button><input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={selectPhoto} className="hidden" aria-label="Завантажити фото профілю" /></div></div></div>{error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<button type="button" onClick={() => { void continueToInterests() }} disabled={submitting} className="mt-7 h-14 w-full rounded-2xl bg-brand-accent text-sm font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:cursor-wait disabled:opacity-60">{submitting ? 'СТВОРЮЄМО ПРОФІЛЬ…' : 'ПРОДОВЖИТИ'}</button></main></div>
  )
}
