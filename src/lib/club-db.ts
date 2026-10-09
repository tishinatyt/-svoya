import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveClubConfig } from './club-config';
export function clubConfig() {
  return resolveClubConfig(import.meta.env, typeof location === 'undefined' ? undefined : location.hostname);
}
let instance: SupabaseClient | undefined;
// Auth may process the email callback before a lazy screen mounts its effect.
// Retain only the recovery identity, never the URL tokens, until the form completes.
let recoveryUserId: string | null = null;
export function needsClubPasswordRecovery(userId: string) {
  return recoveryUserId === userId;
}
export function finishClubPasswordRecovery() {
  recoveryUserId = null;
}
export function clubDb() {
  if (!instance) {
    const { url, key } = clubConfig();
    instance = createClient(url, key, { auth: {
      storageKey: 'svoya-club-auth', persistSession: true,
      autoRefreshToken: true, detectSessionInUrl: true,
    } });
    instance.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') recoveryUserId = session?.user.id ?? null;
      else if (event === 'SIGNED_OUT' || (session && recoveryUserId !== session.user.id)) recoveryUserId = null;
    });
  }
  return instance;
}
