import { useRef, useState, type ChangeEvent } from 'react'
import { MAX_PROFILE_PHOTOS, PROFILE_PHOTO_ACCEPT, profilePhotoUrl, uploadProfilePhoto } from '@/lib/profilePhotos'

export function ProfilePhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  if (!photos.length) return null
  return (
    <section className="mt-6 border-t border-brand-border pt-6">
      <h2 className="mb-3 text-sm font-extrabold text-brand-ink">Фото профілю</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((path, index) => <img key={path} src={profilePhotoUrl(path)} alt={`${name}, фото ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" />)}
      </div>
    </section>
  )
}

interface EditorProps {
  userId: string
  photos: string[]
  onAdd: (path: string) => Promise<void> | void
  onRemove: (path: string) => Promise<void> | void
  disabled?: boolean
}

export function ProfilePhotoGalleryEditor({ userId, photos, onAdd, onRemove, disabled = false }: EditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busyRef.current || disabled || photos.length >= MAX_PROFILE_PHOTOS) return
    const localPreviewUrl = URL.createObjectURL(file)
    busyRef.current = true; setUploading(true); setPreviewUrl(localPreviewUrl); setError(null)
    try { await onAdd(await uploadProfilePhoto(userId, file)) }
    catch (uploadError) { console.error('Gallery photo upload failed', uploadError); setError(uploadError instanceof Error ? uploadError.message : 'Не вдалося завантажити фото') }
    finally { URL.revokeObjectURL(localPreviewUrl); busyRef.current = false; setUploading(false); setPreviewUrl(null) }
  }

  async function handleRemove(path: string) {
    if (busyRef.current || disabled) return
    busyRef.current = true; setBusyPath(path); setError(null)
    try { await onRemove(path) }
    catch (removeError) { console.error('Gallery photo removal failed', removeError); setError('Не вдалося видалити фото') }
    finally { busyRef.current = false; setBusyPath(null) }
  }

  return (
    <section className="border-t border-brand-border pt-5">
      <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-extrabold text-brand-ink">Фото профілю</h2><p className="mt-0.5 text-[11px] text-brand-ink-muted">Додайте до 6 додаткових фото.</p></div><span className="rounded-full bg-brand-accent-soft px-2 py-1 text-[10px] font-extrabold text-brand-accent">{photos.length}/6 фото</span></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((path, index) => <div key={path} className="group relative aspect-square overflow-hidden rounded-xl bg-brand-surface-muted"><img src={profilePhotoUrl(path)} alt={`Фото профілю ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => { void handleRemove(path) }} disabled={Boolean(busyPath) || disabled} aria-label={`Видалити фото ${index + 1}`} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:opacity-50">{busyPath === path ? '…' : '×'}</button></div>)}
        {photos.length < MAX_PROFILE_PHOTOS && <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || disabled} className="relative grid aspect-square overflow-hidden place-items-center rounded-xl border border-dashed border-brand-accent/40 bg-brand-accent-soft/45 text-center text-xs font-bold text-brand-accent hover:bg-brand-accent-soft disabled:opacity-70">{previewUrl ? <><img src={previewUrl} alt="Попередній перегляд нового фото" className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1.5 text-[10px] text-white">Завантажуємо…</span></> : <span><span className="block text-2xl leading-none">+</span><span className="mt-1 block">Додати фото</span></span>}</button>}
      </div>
      <input ref={inputRef} type="file" accept={PROFILE_PHOTO_ACCEPT} onChange={handleUpload} className="hidden" aria-label="Додати фото до галереї" />
      {photos.length >= MAX_PROFILE_PHOTOS && <p className="mt-2 text-xs text-brand-ink-muted">Досягнуто максимум 6 фото.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  )
}
