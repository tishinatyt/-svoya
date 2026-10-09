export const LOGIN_DOMAIN = 'login.svoya.invalid';
export function normalizeUsername(value: string) { return value.trim().toLowerCase(); }
export function validUsername(value: string) {
  return /^[a-z0-9][a-z0-9_]{2,23}$/.test(value)
    && !['admin','administrator','support','moderator','svoya'].includes(value);
}
export function usernameEmail(value: string) {
  const username = normalizeUsername(value);
  if (!validUsername(username)) throw new Error('SV_USERNAME_INVALID');
  return `${username}@${LOGIN_DOMAIN}`;
}
