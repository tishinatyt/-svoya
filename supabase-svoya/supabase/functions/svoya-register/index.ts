import { registrationHandler } from './handler.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const local=new URL(url).hostname === 'kong';
Deno.serve(registrationHandler({
  url,
  serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  allowedOrigins:['https://tishinatyt.github.io',...(local?['http://127.0.0.1:5173','http://localhost:5173']:[])],
}));
