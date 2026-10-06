import { supabase } from '@/lib/supabase'

export type ClubPostSection = 'circle' | 'beauty' | 'business' | 'help'

export interface ClubPostAuthor {
  id: string
  name: string | null
  avatar_url: string | null
  city: string | null
}

export interface ClubPost {
  id: string
  author_id: string
  section: ClubPostSection
  category: string
  title: string
  body: string
  city: string | null
  image_url: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  author: ClubPostAuthor | null
}

export interface ClubPostComment {
  id: string
  post_id: string
  author_id: string
  body: string
  created_at: string
  author: Pick<ClubPostAuthor, 'id' | 'name' | 'avatar_url'> | null
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function listClubPosts(section?: ClubPostSection) {
  let query = supabase
    .from('club_posts')
    .select(`
      id, author_id, section, category, title, body, city, image_url, status, created_at, updated_at,
      author:users!club_posts_author_id_fkey(id, name, avatar_url, city)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50)

  if (section) query = query.eq('section', section)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    author: normalizeRelation(row.author),
  })) as ClubPost[]
}

export async function createClubPost(input: {
  authorId: string
  section: ClubPostSection
  category: string
  title: string
  body: string
  city?: string | null
}) {
  const { data, error } = await supabase
    .from('club_posts')
    .insert({
      author_id: input.authorId,
      section: input.section,
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      city: input.city?.trim() || null,
    })
    .select(`
      id, author_id, section, category, title, body, city, image_url, status, created_at, updated_at,
      author:users!club_posts_author_id_fkey(id, name, avatar_url, city)
    `)
    .single()

  if (error) throw error

  return {
    ...data,
    author: normalizeRelation((data as any).author),
  } as ClubPost
}

export async function listClubPostComments(postId: string) {
  const { data, error } = await supabase
    .from('club_post_comments')
    .select(`
      id, post_id, author_id, body, created_at,
      author:users!club_post_comments_author_id_fkey(id, name, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    author: normalizeRelation(row.author),
  })) as ClubPostComment[]
}

export async function createClubPostComment(input: { postId: string; authorId: string; body: string }) {
  const { data, error } = await supabase
    .from('club_post_comments')
    .insert({
      post_id: input.postId,
      author_id: input.authorId,
      body: input.body.trim(),
    })
    .select(`
      id, post_id, author_id, body, created_at,
      author:users!club_post_comments_author_id_fkey(id, name, avatar_url)
    `)
    .single()

  if (error) throw error

  return {
    ...data,
    author: normalizeRelation((data as any).author),
  } as ClubPostComment
}
