import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// Public browser key. Data access is enforced by Supabase RLS.
const url='https://pqasdmiqnlyyjwmmqeyc.supabase.co';
const key="sb_publishable_Ni_SuVPhfR9U2iSpWpOSFw_8qIudiYt";
let instance:SupabaseClient|undefined;
export function clubDb(){return instance??=(createClient(url,key,{auth:{storageKey:'svoya-club-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));}
