import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthContextValue {
  session: Session | null
  supaUser: SupabaseUser | null
  profile: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInAnonymously: () => Promise<SupabaseUser>
  signOut: () => Promise<void>
  refreshProfile: (userId?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [supaUser, setSupaUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRequestRef = useRef(0)
  const activeUserIdRef = useRef<string | null>(null)

  async function fetchProfile(userId: string) {
    const requestId = ++profileRequestRef.current
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (requestId !== profileRequestRef.current || activeUserIdRef.current !== userId) return
    if (error) console.error('[Auth] Failed to load profile:', error)
    setProfile(data ?? null)
  }

  async function refreshProfile(userId?: string) {
    const profileUserId = userId ?? activeUserIdRef.current ?? supaUser?.id
    if (profileUserId) await fetchProfile(profileUserId)
  }

  useEffect(() => {
    let mounted = true
    void supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return
      setSession(initialSession)
      setSupaUser(initialSession?.user ?? null)
      activeUserIdRef.current = initialSession?.user.id ?? null
      if (initialSession?.user) await fetchProfile(initialSession.user.id)
      if (mounted) setLoading(false)
    }).catch((error) => {
      console.error('[Auth] Failed to restore session:', error)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      profileRequestRef.current += 1
      setSession(nextSession)
      setSupaUser(nextSession?.user ?? null)
      activeUserIdRef.current = nextSession?.user.id ?? null
      if (nextSession?.user) void fetchProfile(nextSession.user.id)
      else setProfile(null)
    })

    return () => {
      mounted = false
      profileRequestRef.current += 1
      subscription.unsubscribe()
    }
  }, [])

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString() }
    })
    if (error) throw error
  }

  async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    if (!data.user) throw new Error('Anonymous sign-in did not return a user')
    return data.user
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ session, supaUser, profile, loading, signInWithGoogle, signInAnonymously, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
