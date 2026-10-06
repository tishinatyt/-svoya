import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'
import { joinEventParticipation } from '@/lib/eventParticipation'

export interface EventDetail {
  id: string
  title: string
  description: string
  category: string
  is_public: boolean
  event_type: 'personal' | 'public'
  join_mode: 'open' | 'approval'
  bank_enabled: boolean
  bank_note: string | null
  organizer_id: string
  cover_photo_url: string | null
  address_text: string
  event_datetime: string
  max_participants: number
  min_age: number
  max_age: number
  gender_filter: string
  status: string
  created_at: string
  location_lat: number | null
  location_lng: number | null
  organizer: User | null
}

export interface EventParticipant {
  id: string
  event_id: string
  user_id: string
  role: 'organizer' | 'participant'
  joined_at: string
  status: 'pending' | 'joined' | 'left' | 'rejected'
  user: User | null
}

function normalizeParticipants(rows: Record<string, unknown>[]): EventParticipant[] {
  return rows.map((row) => {
    const participant = row as Record<string, unknown> & { user?: User | User[] | null }
    return {
      id: participant.id as string,
      event_id: participant.event_id as string,
      user_id: participant.user_id as string,
      role: participant.role as EventParticipant['role'],
      joined_at: participant.joined_at as string,
      status: participant.status as EventParticipant['status'],
      user: Array.isArray(participant.user) ? participant.user[0] ?? null : participant.user ?? null,
    }
  })
}

export function useEvent(eventId: string) {
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [participants, setParticipants] = useState<EventParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const activeEventIdRef = useRef(eventId)
  const mountedRef = useRef(true)
  activeEventIdRef.current = eventId

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const reloadParticipants = useCallback(async () => {
    if (!eventId) return
    const targetEventId = eventId
    const [participantsResult, countResult] = await Promise.all([
      supabase
        .from('event_participants')
        .select(`
          id, event_id, user_id, role, joined_at, status,
          user:users!event_participants_user_id_fkey(
            id, name, age, gender, avatar_url, google_verified, city, bio, interests, created_at
          )
        `)
        .eq('event_id', targetEventId),
      supabase.rpc('event_participant_count', { p_event_id: targetEventId }),
    ])

    if (!mountedRef.current || activeEventIdRef.current !== targetEventId) return

    if (participantsResult.error) console.error('Failed to refresh event participants', participantsResult.error)
    else setParticipants(normalizeParticipants((participantsResult.data ?? []) as unknown as Record<string, unknown>[]))

    if (countResult.error) console.error('Failed to refresh participant count', countResult.error)
    else setParticipantCount(Number(countResult.data ?? 0))
  }, [eventId])

  useEffect(() => {
    if (!eventId) {
      setEvent(null)
      setParticipants([])
      setParticipantCount(0)
      setError(null)
      setLoading(false)
      return
    }
    void load()
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    const channel = supabase
      .channel(`event-participants:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_participants', filter: `event_id=eq.${eventId}` },
        () => { void reloadParticipants() },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [eventId, reloadParticipants])

  async function load() {
    const targetEventId = eventId
    setLoading(true)
    setError(null)

    const [eventResult, participantsResult, coordsResult, participantCountResult] = await Promise.all([
      supabase
        .from('events')
        .select(`
          id, title, description, category, is_public, event_type, join_mode, bank_enabled, bank_note,
          organizer_id, cover_photo_url, address_text,
          event_datetime, max_participants, min_age, max_age,
          gender_filter, status, created_at,
          organizer:users!events_organizer_id_fkey(
            id, name, age, gender, avatar_url, google_verified, city, bio, interests, created_at
          )
        `)
        .eq('id', targetEventId)
        .single(),
      supabase
        .from('event_participants')
        .select(`
          id, event_id, user_id, role, joined_at, status,
          user:users!event_participants_user_id_fkey(
              id, name, age, gender, avatar_url, google_verified, city, bio, interests, created_at
          )
        `)
        .eq('event_id', targetEventId),
      // Graceful: may fail if get_event_coords function not yet deployed
      (supabase.rpc('get_event_coords', { p_event_id: targetEventId }).single() as unknown) as Promise<{ data: { lat: number; lng: number } | null; error: unknown }>,
      supabase.rpc('event_participant_count', { p_event_id: targetEventId }),
    ])

    if (!mountedRef.current || activeEventIdRef.current !== targetEventId) return

    if (eventResult.error || !eventResult.data) {
      if (eventResult.error) console.error('Failed to load event', eventResult.error)
      setEvent(null)
      setParticipants([])
      setParticipantCount(0)
      setError('Не вдалося завантажити подію. Спробуйте ще раз')
      setLoading(false)
      return
    }

    const raw = eventResult.data
    const organizer = Array.isArray(raw.organizer)
      ? (raw.organizer[0] as User | null)
      : (raw.organizer as User | null)

    setEvent({
      id: raw.id,
      title: raw.title,
      description: raw.description,
      category: raw.category,
      is_public: raw.is_public,
      event_type: (raw.event_type ?? 'public') as 'personal' | 'public',
      join_mode: (raw.join_mode ?? 'open') as 'open' | 'approval',
      bank_enabled: raw.bank_enabled ?? false,
      bank_note: raw.bank_note ?? null,
      organizer_id: raw.organizer_id,
      cover_photo_url: raw.cover_photo_url,
      address_text: raw.address_text,
      event_datetime: raw.event_datetime,
      max_participants: raw.max_participants,
      min_age: raw.min_age,
      max_age: raw.max_age,
      gender_filter: raw.gender_filter,
      status: raw.status,
      created_at: raw.created_at,
      organizer,
      location_lat: coordsResult.data?.lat ?? null,
      location_lng: coordsResult.data?.lng ?? null,
    })

    if (participantsResult.error) console.error('Failed to load event participants', participantsResult.error)
    setParticipants(participantsResult.data
      ? normalizeParticipants(participantsResult.data as unknown as Record<string, unknown>[])
      : [])

    if (participantCountResult.error) {
      console.error('Failed to load participant count', participantCountResult.error)
      setParticipantCount(0)
    } else {
      setParticipantCount(Number(participantCountResult.data ?? 0))
    }

    setLoading(false)
  }

  async function joinEvent(): Promise<{ error: string | null; status: 'pending' | 'joined' | null }> {
    const { error: err, status: requestedStatus } = await joinEventParticipation(eventId)

    if (err) {
      console.error('Failed to join event', err)
      const message = err.message ?? ''
      const friendlyError = message.includes('event_full') ? 'Місць більше немає'
        : message.includes('event_unavailable') ? 'До цієї події вже не можна приєднатися'
        : message.includes('private_event') ? 'Ця подія доступна лише за запрошенням'
        : message.includes('request_rejected') ? 'Ваш попередній запит було відхилено'
        : 'Не вдалося приєднатися до події. Спробуйте ще раз'
      return { error: friendlyError, status: null }
    }
    await reloadParticipants()
    return { error: null, status: requestedStatus }
  }

  async function reviewRequest(userId: string, decision: 'approve' | 'reject'): Promise<string | null> {
    const { error: rpcError } = await supabase.rpc('review_event_join_request', {
      p_event_id: eventId,
      p_user_id: userId,
      p_decision: decision,
    })
    if (rpcError) {
      console.error('Failed to review event request', rpcError)
      if (rpcError.message.includes('event_full')) return 'Подія вже заповнена'
      if (rpcError.message.includes('event_unavailable')) return 'Подія вже недоступна для підтвердження нових учасників'
      return decision === 'approve'
        ? 'Не вдалося підтвердити учасника. Спробуйте ще раз'
        : 'Не вдалося відхилити запит. Спробуйте ще раз'
    }
    await reloadParticipants()
    return null
  }

  async function leaveEvent(): Promise<string | null> {
    const { error: rpcError } = await supabase.rpc('leave_event', { p_event_id: eventId })
    if (rpcError) {
      console.error('Failed to leave event', rpcError)
      return 'Не вдалося вийти з події. Спробуйте ще раз'
    }
    await reloadParticipants()
    return null
  }

  return { event, participants, participantCount, loading, error, joinEvent, reviewRequest, leaveEvent }
}
