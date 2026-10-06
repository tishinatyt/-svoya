import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import { InterestChips } from '@/components/profile/ProfileComponents'
import { ProfilePhotoGallery, ProfilePhotoGalleryEditor } from '@/components/profile/ProfilePhotoGallery'
import { removeProfilePhoto } from '@/lib/profilePhotos'
import { CitySelect } from '@/components/profile/CitySelect'

const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default function Profile() {
  const { profile, supaUser, signOut, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Gallery/avatar updates refresh the profile while the edit form is open.
    // Do not overwrite unsaved text/interest edits during those refreshes.
    if (!profile || editing) return
    setName(profile.name)
    setAge(profile.age === null ? '' : String(profile.age))
    setCity(profile.city ?? '')
    setBio(profile.bio ?? '')
    setInterests(profile.interests ?? [])
  }, [editing, profile])

  async function handleSave() {
    if (!supaUser || saving) return
    const cleanName = name.trim()
    const cleanCity = city.trim()
    const cleanBio = bio.trim()
    const ageNumber = age.trim() ? Number(age) : null
    if (cleanName.length < 2) { setError('Вкажіть ім’я'); return }
    if (!cleanCity) { setError('Оберіть місто'); return }
    if (ageNumber !== null && (!Number.isInteger(ageNumber) || ageNumber < 16 || ageNumber > 100)) { setError('Вік має бути від 16 до 100 років'); return }
    if (cleanBio.length > 300) { setError('Опис може містити до 300 символів'); return }
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('users').update({ name: cleanName, age: ageNumber, city: cleanCity, bio: cleanBio || null, interests }).eq('id', supaUser.id)
    if (updateError) {
      console.error('Profile update failed', updateError)
      setError('Не вдалося зберегти профіль. Спробуйте ще раз')
      setSaving(false)
      return
    }
    await refreshProfile()
    setSaving(false); setEditing(false)
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !supaUser || uploading) return
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) { setError('Оберіть зображення JPG, PNG, WebP або GIF'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Зображення має бути менше 5 МБ'); return }
    setUploading(true); setError(null)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${supaUser.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: false })
    if (uploadError) {
      console.error('Avatar upload failed', uploadError)
      setError('Не вдалося завантажити фото. Спробуйте ще раз')
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateError } = await supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', supaUser.id)
    if (updateError) {
      console.error('Avatar profile update failed', updateError)
      await removeProfilePhoto(path).catch(() => undefined)
      setError('Не вдалося зберегти фото')
    } else {
      await refreshProfile()
    }
    setUploading(false)
  }

  async function addGalleryPhoto(path: string) {
    if (!supaUser || !profile) return
    const photos = [...(profile.profile_photos ?? []), path].slice(0, 6)
    const { error: updateError } = await supabase.from('users').update({ profile_photos: photos }).eq('id', supaUser.id)
    if (updateError) {
      await removeProfilePhoto(path).catch(() => undefined)
      throw updateError
    }
    await refreshProfile()
  }

  async function deleteGalleryPhoto(path: string) {
    if (!supaUser || !profile) return
    const photos = (profile.profile_photos ?? []).filter((photo) => photo !== path)
    const { error: updateError } = await supabase.from('users').update({ profile_photos: photos }).eq('id', supaUser.id)
    if (updateError) throw updateError
    await refreshProfile()
    await removeProfilePhoto(path)
  }

  if (!profile) return <div className="min-h-screen bg-brand-bg"><TopBar title="Профіль" /><div className="mx-auto max-w-[960px] px-4 py-6 sm:px-6 lg:px-8"><div className="h-48 animate-pulse rounded-2xl border border-brand-border bg-white" /><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="h-36 animate-pulse rounded-2xl border border-brand-border bg-white" /><div className="h-36 animate-pulse rounded-2xl border border-brand-border bg-white" /></div></div></div>

  return (
    <div className="min-h-screen bg-brand-bg pb-24 text-brand-ink lg:pb-10">
      <TopBar title="Профіль" />
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-brand-border bg-white/95 px-4 backdrop-blur-xl lg:hidden"><h1 className="text-base font-extrabold">Профіль</h1>{!editing && <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-xl px-3 text-sm font-bold text-brand-accent">Редагувати</button>}</header>
      <div className="mx-auto max-w-[960px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <section className="rounded-2xl border border-brand-accent/10 bg-gradient-to-br from-white to-brand-accent-soft/55 p-5 sm:p-6">
          <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
            <div className="relative">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-4 border-white bg-brand-accent-soft text-3xl font-extrabold text-brand-accent sm:h-28 sm:w-28">{profile.avatar_url ? <img src={profile.avatar_url} alt={profile.name} className="h-full w-full object-cover" /> : profile.name.charAt(0).toUpperCase()}</div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="mt-4 min-w-0 flex-1 sm:ml-6 sm:mt-0">
              <h1 className="text-2xl font-extrabold tracking-[-0.03em]">{profile.name}</h1>
              <p className="mt-1 text-sm text-brand-ink-muted">{[profile.city, profile.age ? `${profile.age} років` : null].filter(Boolean).join(' · ')}</p>
              {!editing && <button type="button" onClick={() => setEditing(true)} className="mt-4 h-10 rounded-xl bg-brand-accent px-4 text-sm font-bold text-white hover:bg-brand-accent-hover">Редагувати профіль</button>}
              {editing && <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 h-10 rounded-xl border border-brand-accent/20 bg-white px-4 text-sm font-bold text-brand-accent transition hover:bg-brand-accent-soft disabled:cursor-wait disabled:opacity-60">{uploading ? 'Завантажуємо...' : 'Змінити фото'}</button>}
            </div>
          </div>
        </section>

        {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {editing ? <section className="mt-4 space-y-5 rounded-2xl border border-brand-border bg-white p-4 sm:p-6">
          <div><h2 className="text-base font-extrabold">Основна інформація</h2><p className="mt-1 text-xs text-brand-ink-muted">Ці дані бачать організатори подій.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-brand-ink-soft">Ім’я<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-brand-border bg-brand-bg px-3.5 text-sm font-normal text-brand-ink outline-none focus:border-brand-accent focus:bg-white focus:ring-3 focus:ring-brand-accent/10" /></label>
            <label className="text-xs font-bold text-brand-ink-soft">Вік<input type="number" min={16} max={100} value={age} onChange={(event) => setAge(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-brand-border bg-brand-bg px-3.5 text-sm font-normal text-brand-ink outline-none focus:border-brand-accent focus:bg-white focus:ring-3 focus:ring-brand-accent/10" /></label>
            <label className="text-xs font-bold text-brand-ink-soft sm:col-span-2">Місто<CitySelect value={city} onChange={setCity} className="mt-1.5 h-11 w-full rounded-xl border border-brand-border bg-brand-bg px-3.5 text-sm font-normal text-brand-ink outline-none focus:border-brand-accent focus:bg-white focus:ring-3 focus:ring-brand-accent/10" /></label>
          </div>
          <label className="block text-xs font-bold text-brand-ink-soft">Про себе<textarea value={bio} maxLength={300} rows={4} onChange={(event) => setBio(event.target.value)} placeholder="Кілька слів про вас" className="mt-1.5 w-full resize-none rounded-xl border border-brand-border bg-brand-bg px-3.5 py-3 text-sm font-normal leading-6 text-brand-ink outline-none focus:border-brand-accent focus:bg-white focus:ring-3 focus:ring-brand-accent/10" /><span className="mt-1 block text-right text-xs font-normal text-brand-ink-muted">{bio.length}/300</span></label>
          <ProfilePhotoGalleryEditor userId={supaUser!.id} photos={profile.profile_photos ?? []} onAdd={addGalleryPhoto} onRemove={deleteGalleryPhoto} disabled={saving || uploading} />
          <div className="border-t border-brand-border pt-5"><div className="mb-3 flex justify-between gap-3"><h2 className="text-sm font-extrabold text-brand-ink">Інтереси</h2><span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-bold text-brand-accent">{interests.length} з 8</span></div><InterestChips selected={interests} editable onChange={setInterests} />{interests.length >= 8 && <p className="mt-2 text-xs text-brand-ink-muted">Можна вибрати до 8 інтересів</p>}</div>
          <div className="flex flex-col-reverse gap-2 border-t border-brand-border pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setName(profile.name); setAge(profile.age === null ? '' : String(profile.age)); setCity(profile.city ?? ''); setBio(profile.bio ?? ''); setInterests(profile.interests ?? []); setEditing(false); setError(null) }} className="h-11 rounded-xl border border-brand-border px-5 text-sm font-bold text-brand-ink-soft hover:bg-brand-surface-muted">Скасувати</button><button type="button" onClick={() => { void handleSave() }} disabled={saving || uploading} className="h-11 rounded-xl bg-brand-accent px-6 text-sm font-bold text-white hover:bg-brand-accent-hover disabled:cursor-wait disabled:opacity-60">{saving ? 'Зберігаємо...' : 'Зберегти'}</button></div>
        </section> : <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-brand-border bg-white p-5"><h2 className="text-base font-extrabold">Про себе</h2>{profile.bio ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-brand-ink-soft">{profile.bio}</p> : <button type="button" onClick={() => setEditing(true)} className="mt-3 text-left text-sm text-brand-ink-muted hover:text-brand-accent">Розкажіть трохи про себе <span className="font-bold text-brand-accent">Редагувати</span></button>}</section>
          <section className="rounded-2xl border border-brand-border bg-white p-5"><h2 className="mb-3 text-base font-extrabold">Інтереси</h2>{profile.interests?.length ? <InterestChips selected={profile.interests.slice(0, 8)} /> : <button type="button" onClick={() => setEditing(true)} className="text-left text-sm text-brand-ink-muted hover:text-brand-accent">Інтереси ще не додані. <span className="font-bold text-brand-accent">Додати</span></button>}</section>
          {(profile.profile_photos?.length ?? 0) > 0 && <section className="rounded-2xl border border-brand-border bg-white p-5 sm:col-span-2"><ProfilePhotoGallery photos={profile.profile_photos ?? []} name={profile.name} /></section>}
        </div>}

        <button type="button" onClick={() => { void signOut() }} className="mt-4 h-11 w-full rounded-xl border border-brand-border bg-white text-sm font-bold text-brand-ink-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">Вийти</button>
      </div>
    </div>
  )
}
