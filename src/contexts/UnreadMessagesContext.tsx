import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface UnreadMessagesValue {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
  markChatRead: (chatId: string, readThrough?: string) => Promise<void>
}

const UnreadMessagesContext = createContext<UnreadMessagesValue | null>(null)

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const { supaUser } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!supaUser) {
      setUnreadCount(0)
      return
    }
    const { data, error } = await supabase.rpc('get_unread_event_chat_count')
    if (error) {
      console.error('[UnreadMessages] Failed to load unread count:', error)
      return
    }
    setUnreadCount(Number(data ?? 0))
  }, [supaUser])

  const markChatRead = useCallback(async (chatId: string, readThrough = new Date().toISOString()) => {
    if (!supaUser) return
    const { error } = await supabase.rpc('mark_event_chat_read', {
      p_event_chat_id: chatId,
      p_read_through: readThrough,
    })
    if (error) {
      console.error('[UnreadMessages] Failed to mark chat as read:', error)
      return
    }
    await refreshUnreadCount()
  }, [refreshUnreadCount, supaUser])

  useEffect(() => {
    if (!supaUser) {
      setUnreadCount(0)
      return
    }
    void refreshUnreadCount()
    const channel = supabase
      .channel(`unread-messages:${supaUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_chat_messages' }, () => { void refreshUnreadCount() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_chat_read_state', filter: `user_id=eq.${supaUser.id}` }, () => { void refreshUnreadCount() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [refreshUnreadCount, supaUser])

  const value = useMemo(() => ({ unreadCount, refreshUnreadCount, markChatRead }), [markChatRead, refreshUnreadCount, unreadCount])
  return <UnreadMessagesContext.Provider value={value}>{children}</UnreadMessagesContext.Provider>
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext)
  if (!context) throw new Error('useUnreadMessages must be used within UnreadMessagesProvider')
  return context
}
