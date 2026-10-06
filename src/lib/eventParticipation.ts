import { supabase } from '@/lib/supabase'

export type ParticipantStatus = 'pending' | 'joined' | 'left' | 'rejected'

export async function joinEventParticipation(eventId: string) {
  const { data, error } = await supabase.rpc('join_event', { p_event_id: eventId })
  const status = data === 'pending' || data === 'joined' ? data : null
  return { error, status }
}
