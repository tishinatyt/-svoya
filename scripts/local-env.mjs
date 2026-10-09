import { writeFile } from 'node:fs/promises';
import { localStack } from './local-stack.mjs';
const stack = localStack();
await writeFile(new URL('../.env.local', import.meta.url), `VITE_SVOYA_ENV=local\nVITE_SUPABASE_URL=${stack.API_URL}\nVITE_SUPABASE_ANON_KEY=${stack.ANON_KEY}\n`, { mode: 0o600 });
console.log('Local browser configuration saved. No service-role key was written.');
