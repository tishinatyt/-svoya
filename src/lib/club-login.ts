import { clubDb } from './club-db';
import { LOGIN_DOMAIN, normalizeUsername, usernameEmail, validUsername } from '../../supabase-svoya/supabase/functions/svoya-register/identity';
export { normalizeUsername, usernameEmail, validUsername };
export const usernameRegistration = () => import.meta.env.VITE_SVOYA_SIGNUP_MODE === 'username';
export function loginAddress(value: string) {
  const login=value.trim();
  return login.includes('@') ? login : usernameEmail(login);
}
export function usernameFor(user: { app_metadata?: Record<string,unknown>; email?: string } | null) {
  if (user?.app_metadata?.svoya_auth==='username' && typeof user.app_metadata.svoya_username==='string') return user.app_metadata.svoya_username;
  return user?.email?.endsWith(`@${LOGIN_DOMAIN}`) ? user.email.slice(0,-LOGIN_DOMAIN.length-1) : null;
}
export async function registerUsername(username: string,password: string,linkAnonymous: boolean) {
  const result=await clubDb().functions.invoke('svoya-register',{body:{username,password,linkAnonymous}});
  if (result.error) {
    const body=await result.error.context?.json?.().catch(()=>null);
    throw new Error(body?.code??'SV_REGISTRATION_UNAVAILABLE');
  }
  if (!result.data?.ok) throw new Error('SV_REGISTRATION_UNAVAILABLE');
  const login=await clubDb().auth.signInWithPassword({email:usernameEmail(username),password});
  if (login.error) throw new Error('SV_CREATED_LOGIN_AGAIN');
}
