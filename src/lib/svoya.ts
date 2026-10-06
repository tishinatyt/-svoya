import { supabase } from '@/lib/supabase'

export type SvoyaKind = 'event' | 'circle' | 'beauty' | 'business' | 'help'

export interface SvoyaEntry {
  id: string
  owner_id: string | null
  kind: SvoyaKind
  title: string
  description: string
  city: string
  category: string
  location: string
  starts_at: string | null
  capacity: number
  price: number
  is_demo: boolean
  status: 'published' | 'archived'
  created_at: string
}

export interface SvoyaEntryInput {
  kind: SvoyaKind
  title: string
  description: string
  city: string
  category: string
  location?: string
  starts_at?: string | null
  capacity?: number
  price?: number
}

export async function listSvoyaEntries(kind?: SvoyaKind) {
  let query = supabase
    .from('svoya_entries')
    .select('*')
    .eq('status', 'published')
    .order('is_demo', { ascending: true })
    .order('created_at', { ascending: false })

  if (kind) query = query.eq('kind', kind)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as SvoyaEntry[]
}

export async function getSvoyaEntry(id: string) {
  const { data, error } = await supabase
    .from('svoya_entries')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as SvoyaEntry | null
}

export async function ensureSvoyaProfile(args: {
  userId: string
  name?: string | null
  city?: string | null
  bio?: string | null
  interests?: string[]
}) {
  const payload = {
    id: args.userId,
    name: (args.name?.trim() || 'Учасниця СВОЯ').slice(0, 80),
    city: (args.city?.trim() || 'Чернігів').slice(0, 80),
    bio: (args.bio || '').slice(0, 500),
    interests: (args.interests || []).slice(0, 8),
  }

  const { error } = await supabase
    .from('svoya_profiles')
    .upsert(payload, { onConflict: 'id' })

  if (error) throw error
}

export async function createSvoyaEntry(userId: string, input: SvoyaEntryInput) {
  const { data, error } = await supabase
    .from('svoya_entries')
    .insert({
      owner_id: userId,
      kind: input.kind,
      title: input.title.trim(),
      description: input.description.trim(),
      city: input.city.trim(),
      category: input.category.trim(),
      location: (input.location || '').trim(),
      starts_at: input.starts_at || null,
      capacity: Math.max(2, Math.min(500, input.capacity || 12)),
      price: Math.max(0, input.price || 0),
      is_demo: false,
      status: 'published',
    })
    .select('*')
    .single()

  if (error) throw error
  return data as SvoyaEntry
}

export async function requestToEntry(args: {
  entryId: string
  userId: string
  kind: SvoyaKind
  message: string
  contact: string
}) {
  if (args.kind === 'event' || args.kind === 'circle') {
    const { error } = await supabase
      .from('svoya_memberships')
      .upsert({
        entry_id: args.entryId,
        user_id: args.userId,
        status: 'pending',
      }, { onConflict: 'entry_id,user_id' })

    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('svoya_requests')
    .insert({
      entry_id: args.entryId,
      user_id: args.userId,
      message: args.message.trim(),
      contact: args.contact.trim(),
      status: 'pending',
    })

  if (error) throw error
}

export const svoyaKindLabels: Record<SvoyaKind, string> = {
  event: 'Подія',
  circle: 'Своє коло',
  beauty: 'Б’юті',
  business: 'Бізнес',
  help: 'Допомога',
}

export const svoyaCategories: Record<SvoyaKind, string[]> = {
  event: ['Кава та розмови', 'Творчість', 'Прогулянки', 'Спорт', 'Розвиток'],
  circle: ['Книги', 'Підприємництво', 'Моє місто', 'Творчість', 'Спорт'],
  beauty: ['Волосся', 'Нігті', 'Брови та вії', 'Макіяж', 'Догляд', 'Стиль'],
  business: ['Послуги', 'Співпраця', 'Вакансії', 'Наставництво'],
  help: ['Потрібна допомога', 'Можу допомогти', 'Рекомендації', 'Волонтерство'],
}
