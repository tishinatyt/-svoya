import { supabase } from '@/lib/supabase'

export const MAX_PROFILE_PHOTOS = 6
export const PROFILE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

export function profilePhotoUrl(path: string) {
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export async function uploadProfilePhoto(userId: string, file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Оберіть файл зображення')
  if (file.size > 5 * 1024 * 1024) throw new Error('Зображення має бути менше 5 МБ')
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/gallery/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

export async function removeProfilePhoto(path: string) {
  const { error } = await supabase.storage.from('avatars').remove([path])
  if (error) throw error
}
