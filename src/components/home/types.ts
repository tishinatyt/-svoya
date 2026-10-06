export interface OrganizerInfo {
  id: string
  name: string
  age?: number
  avatar_url: string | null
  google_verified: boolean
}

export interface ParticipantInfo {
  user_id: string
  user: { id: string; name: string; avatar_url: string | null } | null
}

export interface PersonalEventData {
  eventId: string
  role?: 'organizer' | 'participant'
  participationStatus?: 'pending' | 'joined' | 'rejected'
  title: string
  category: string
  address_text: string
  event_datetime: string
  created_at: string
  min_age: number
  max_age: number
  gender_filter: string
  cover_photo_url: string | null
  max_participants: number
  organizer: OrganizerInfo | null
  participants: ParticipantInfo[]
  participant_count?: number
  distance_km?: number | null
  join_mode?: 'open' | 'approval'
  is_public?: boolean
  description?: string
  isDemo?: true
  pending_request_count?: number
  bank_enabled?: boolean
}

export interface PublicEventData {
  id: string
  title: string
  category: string
  address_text: string
  event_datetime: string
  created_at?: string
  min_age: number
  max_age: number
  gender_filter: string
  cover_photo_url: string | null
  max_participants: number
  participant_count: number
  distance_km: number | null
  organizer: OrganizerInfo | null
  event_type?: 'personal' | 'public'
  join_mode?: 'open' | 'approval'
  is_public?: boolean
  participants?: { id: string; name: string; avatar_url: string | null }[]
  description?: string
  location_lat?: number | null
  location_lng?: number | null
  isDemo?: true
  participationStatus?: 'pending' | 'joined' | 'rejected'
  pending_request_count?: number
  bank_enabled?: boolean
}
