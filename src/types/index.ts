export type Gender = 'male' | 'female' | 'any'

export interface User {
  id: string
  name: string
  age: number | null
  gender: Gender | null
  avatar_url: string | null
  profile_photos?: string[]
  google_verified: boolean
  city: string | null
  bio: string | null
  interests: string[]
  created_at: string
}
