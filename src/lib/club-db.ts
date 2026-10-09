import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveClubConfig } from './club-config';
export function clubConfig() {
  return resolveClubConfig(import.meta.env, typeof location === 'undefined' ? undefined : location.hostname);
}
let instance: SupabaseClient | undefined;
export function clubDb() {
  if (!instance) {
    const { url, key } = clubConfig();
    instance = createClient(url, key, { auth: {
      storageKey: 'svoya-club-auth', persistSession: true,
      autoRefreshToken: true, detectSessionInUrl: true,
    } });
  }
  return instance;
}
