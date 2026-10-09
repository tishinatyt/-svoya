import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export function localStack() {
  // Fixed workdir, no project links, environment fallbacks or remote credentials.
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const executable = fileURLToPath(new URL('../node_modules/.bin/supabase', import.meta.url));
  const status = JSON.parse(execFileSync(executable, ['status', '--workdir', 'supabase-svoya', '-o', 'json'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const url = new URL(status.API_URL);
  if (url.origin !== 'http://127.0.0.1:55421') throw new Error('Only the dedicated local SVOYA stack is allowed');
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Local stack keys are missing');
  return status;
}
