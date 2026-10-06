import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { InterestChips, OnboardingProgress } from '@/components/profile/ProfileComponents'
import { ProfilePhotoGalleryEditor } from '@/components/profile/ProfilePhotoGallery'
import { removeProfilePhoto } from '@/lib/profilePhotos'
import { CitySelect } from '@/components/profile/CitySelect'

export default function CompleteProfile() {
  const navigate = useNavigate()
  const { supaUser, refreshProfile } = useAuth()
  const [step, setStep] = useState(2)
  const [name, setName] = useState(supaUser?.user_metadata?.full_name?.trim() ?? '')
  const [age, setAge] = useState('')
  const [city, setCity] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(supaUser?.user_metadata?.avatar_url ?? null)
  const [profilePhotos, setProfilePhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function continueBasic() {
    const ageNumber = Number(age)
    if (!name.trim()) { setError('Вкажіть ім’я'); return }
    if (!Number.isInteger(ageNumber) || ageNumber < 18 || ageNumber > 100) {
      setError('Вік має бути від 18 до 100 років')
      return
    }
    if (!city.trim()) { setError('Вкажіть місто'); return }
    setError(null)
    setStep(3)
  }

  function continueInterests() {
    if (interests.length < 3) {
      setError('Оберіть щонайменше 3 інтереси')
      return
    }
    setError(null)
    setStep(4)
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !supaUser || uploading) return
    if (!file.type.startsWith('image/')) {
      setError('Оберіть файл зображення')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Зображення має бути менше 5 МБ')
      return
    }

    setUploading(true)
    setError(null)

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${supaUser.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file)

    if (uploadError) {
      console.error('SVOYA avatar upload failed', uploadError)
      setError('Не вдалося завантажити фото')
      setUploading(false)
      return
    }

    setAvatarUrl(supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl)
    setUploading(false)
  }

  async function completeProfile() {
    if (!supaUser || saving || uploading) return

    const cleanBio = bio.trim()
    if (cleanBio.length > 300) {
      setError('Опис може містити до 300 символів')
      return
    }
    if (!avatarUrl) {
      setError('Додайте основне фото профілю')
      return
    }

    setSaving(true)
    setError(null)

    const { error: saveError } = await supabase.from('users').upsert({
      id: supaUser.id,
      name: name.trim(),
      age: Number(age),
      gender: 'female',
      city: city.trim(),
      bio: cleanBio || null,
      interests,
      avatar_url: avatarUrl,
      profile_photos: profilePhotos.slice(0, 10),
      google_verified: supaUser.app_metadata.provider === 'google',
    })

    if (saveError) {
      console.error('SVOYA profile onboarding failed', saveError)
      setError('Не вдалося зберегти профіль. Спробуйте ще раз')
      setSaving(false)
      return
    }

    await refreshProfile()
    setSaving(false)
    navigate('/club', { replace: true })
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-bg px-4 py-6 text-brand-ink sm:px-6">
      <main className="w-full max-w-lg rounded-3xl border border-brand-border bg-white p-5 shadow-card sm:p-8">
        <OnboardingProgress step={step} />

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 2 && (
          <section className="pt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">СВОЯ · ПРОФІЛЬ УЧАСНИЦІ</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.03em]">Розкажи трохи про себе</h1>
            <p className="mt-2 text-sm text-brand-ink-muted">Клуб для повнолітніх учасниць. Ці дані допоможуть своїм упізнати тебе.</p>

            <div className="mt-7 space-y-4">
              <label className="block text-sm font-bold text-brand-ink-soft">
                Як тебе звати?
                <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-2 h-12 w-full rounded-xl border border-brand-border px-4 font-normal text-brand-ink outline-none focus:border-brand-accent focus:ring-3 focus:ring-brand-accent/10" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-brand-ink-soft">
                  Твій вік
                  <input type="number" value={age} min={18} max={100} onChange={(event) => setAge(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-brand-border px-4 font-normal text-brand-ink outline-none focus:border-brand-accent focus:ring-3 focus:ring-brand-accent/10" />
                </label>

                <label className="block text-sm font-bold text-brand-ink-soft">
                  Місто
                  <CitySelect value={city} onChange={setCity} required className="mt-2 h-12 w-full rounded-xl border border-brand-border bg-white px-4 font-normal text-brand-ink outline-none focus:border-brand-accent focus:ring-3 focus:ring-brand-accent/10" />
                </label>
              </div>
            </div>

            <button type="button" onClick={continueBasic} className="mt-7 h-14 w-full rounded-2xl bg-brand-accent text-sm font-extrabold text-white hover:bg-brand-accent-hover">
              Продовжити
            </button>
          </section>
        )}

        {step === 3 && (
          <section className="pt-7">
            <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Що тобі цікаво?</h1>
            <p className="mt-2 text-sm text-brand-ink-muted">Так СВОЯ зможе показувати ближчі кола, події та знайомства.</p>

            <div className="mt-7">
              <InterestChips selected={interests} editable onChange={setInterests} />
              <div className="mt-3 flex justify-between text-xs text-brand-ink-muted">
                <span>{interests.length < 3 ? `Обери ще ${3 - interests.length}` : 'Чудовий вибір'}</span>
                <span>{interests.length}/8</span>
              </div>
            </div>

            <div className="mt-7 flex gap-2">
              <button type="button" onClick={() => { setStep(2); setError(null) }} className="h-14 rounded-2xl border border-brand-border px-5 text-sm font-bold text-brand-ink-soft">
                Назад
              </button>
              <button type="button" onClick={continueInterests} className="h-14 flex-1 rounded-2xl bg-brand-accent text-sm font-extrabold text-white hover:bg-brand-accent-hover">
                Продовжити
              </button>
            </div>
          </section>
        )}

        {step === 4 && supaUser && (
          <section className="pt-7">
            <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Додай фото</h1>
            <p className="mt-2 text-sm text-brand-ink-muted">Основне фото обов’язкове. У галерею можна додати ще до 10 фото.</p>

            <div className="mt-7 flex flex-col items-center">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-brand-accent-soft text-3xl font-extrabold text-brand-accent">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Основне фото профілю" className="h-full w-full object-cover" />
                  : name.charAt(0).toUpperCase()}
              </div>

              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 min-h-11 rounded-xl px-4 text-sm font-bold text-brand-accent hover:bg-brand-accent-soft disabled:opacity-60">
                {uploading ? 'Завантажуємо...' : avatarUrl ? 'Змінити основне фото' : 'Додати основне фото'}
              </button>

              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadAvatar} className="hidden" aria-label="Завантажити основне фото профілю" />
            </div>

            <div className="mt-6">
              <ProfilePhotoGalleryEditor
                userId={supaUser.id}
                photos={profilePhotos}
                onAdd={(path) => setProfilePhotos((photos) => [...photos, path].slice(0, 10))}
                onRemove={async (path) => {
                  await removeProfilePhoto(path)
                  setProfilePhotos((photos) => photos.filter((photo) => photo !== path))
                }}
                disabled={saving || uploading}
              />
            </div>

            <label className="mt-6 block text-sm font-bold text-brand-ink-soft">
              Коротко про себе
              <textarea value={bio} maxLength={300} rows={4} onChange={(event) => setBio(event.target.value)} placeholder="Що варто знати іншим учасницям?" className="mt-2 w-full resize-none rounded-xl border border-brand-border px-4 py-3 font-normal leading-6 text-brand-ink outline-none focus:border-brand-accent focus:ring-3 focus:ring-brand-accent/10" />
              <span className="mt-1 block text-right text-xs font-normal text-brand-ink-muted">{bio.length}/300</span>
            </label>

            <div className="mt-6 grid gap-2 sm:grid-cols-[auto_1fr]">
              <button type="button" onClick={() => { setStep(3); setError(null) }} className="h-14 rounded-2xl border border-brand-border px-5 text-sm font-bold text-brand-ink-soft">
                Назад
              </button>
              <button type="button" onClick={() => { void completeProfile() }} disabled={saving || uploading || !avatarUrl} className="h-14 rounded-2xl bg-brand-accent px-6 text-sm font-extrabold text-white hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? 'Готуємо СВОЯ...' : 'Увійти до клубу'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
