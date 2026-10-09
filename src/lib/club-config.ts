export const SHARED_PROJECT_REF = 'pqasdmiqnlyyjwmmqeyc';
export type ClubEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SVOYA_ENV?: string;
};

/** Fail closed: local/test builds must never silently use the shared database. */
export function resolveClubConfig(env: ClubEnvironment, hostname?: string) {
  const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key = env.VITE_SUPABASE_ANON_KEY;
  const environment = env.VITE_SVOYA_ENV;
  if (!url || !key || !['local', 'test', 'production'].includes(environment ?? ''))
    throw new Error('SVOYA configuration is missing. Follow docs/DEVELOPMENT.md.');
  const parsed = new URL(url);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:'))
    throw new Error('SVOYA requires HTTPS outside the local test stack.');
  if (parsed.hostname === `${SHARED_PROJECT_REF}.supabase.co`) {
    if (environment !== 'production') throw new Error('Tests cannot use the shared production database.');
    if (hostname && !['tishinatyt.github.io', 'svoya-women-club.dr12071980.chatgpt.site'].includes(hostname))
      throw new Error('A local preview cannot connect to the shared production database.');
  }
  if (environment === 'local' && !loopback) throw new Error('Local SVOYA requires a loopback Supabase URL.');
  if (key.startsWith('sb_secret_')) throw new Error('A secret key must never be used in a browser.');
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error('SVOYA browser key must have the anon role.');
    } catch { throw new Error('Invalid public SVOYA browser key.'); }
  }
  return { url, key, environment, pushUrl: `${url}/functions/v1/svoya-push` };
}
