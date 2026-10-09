import { normalizeUsername, validUsername, usernameEmail } from './identity.ts';

type Config = { url: string; serviceKey: string; allowedOrigins: string[] };
export function registrationHandler(config: Config, request = fetch) {
  const adminHeaders = { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, 'Content-Type': 'application/json' };
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('origin') ?? '';
    const headers: Record<string,string> = {
      'Content-Type':'application/json', 'Cache-Control':'no-store', Vary:'Origin',
      'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods':'POST, OPTIONS',
    };
    if (config.allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !config.allowedOrigins.includes(origin)) return reply(403,{code:'SV_ORIGIN'});
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method !== 'POST') return reply(405,{code:'SV_METHOD'});
    if (!req.headers.get('content-type')?.includes('application/json')) return reply(415,{code:'SV_FORMAT'});
    if (Number(req.headers.get('content-length')) > 4096) return reply(413,{code:'SV_SIZE'});
    try {
      // Read a bounded body. Never log the body, credentials, or upstream Auth response.
      const reader = req.body?.getReader();
      if (!reader) return reply(400,{code:'SV_FORMAT'});
      const chunks: Uint8Array[] = []; let size=0;
      while (true) { const {value,done}=await reader.read(); if(done) break; size+=value.length; if(size>4096){await reader.cancel();return reply(413,{code:'SV_SIZE'});} chunks.push(value); }
      const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      let data; try { data=JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply(400,{code:'SV_FORMAT'}); }
      if (!data || typeof data !== 'object' || typeof data.username !== 'string' || typeof data.password !== 'string') return reply(422,{code:'SV_USERNAME_INVALID'});
      const username=normalizeUsername(data.username), password=data.password;
      if (!validUsername(username)) return reply(422,{code:'SV_USERNAME_INVALID'});
      if (password.length<10 || password.length>128) return reply(422,{code:'SV_PASSWORD_LENGTH'});
      const ip=(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown').slice(0,128);
      const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.serviceKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`svoya-signup:${ip}`));
      const ipHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      const limit=await request(`${config.url}/rest/v1/rpc/svoya_allow_username_signup`,{method:'POST',headers:adminHeaders,body:JSON.stringify({ip_hash:ipHash}),signal:AbortSignal.timeout(10000)});
      if (!limit.ok) return reply(503,{code:'SV_REGISTRATION_UNAVAILABLE'});
      if (await limit.json() !== true) return reply(429,{code:'SV_SIGNUP_LIMIT'});
      let anonymousId: string | undefined;
      if (data.linkAnonymous === true) {
        const token=req.headers.get('authorization');
        if (!token) return reply(401,{code:'SV_SESSION_REQUIRED'});
        const current=await request(`${config.url}/auth/v1/user`,{headers:{apikey:config.serviceKey,Authorization:token},signal:AbortSignal.timeout(10000)});
        if (!current.ok) return reply(401,{code:'SV_SESSION_REQUIRED'});
        const user=await current.json();
        if (!user.is_anonymous || typeof user.id !== 'string') return reply(409,{code:'SV_ACCOUNT_ALREADY_SAVED'});
        anonymousId=user.id;
      }
      // The address is an internal username identifier in a non-deliverable domain.
      // Real email addresses and existing permanent accounts can never be confirmed here.
      const upstream=await request(`${config.url}/auth/v1/admin/users${anonymousId?`/${encodeURIComponent(anonymousId)}`:''}`,{
        method:anonymousId?'PUT':'POST',headers:adminHeaders,
        body:JSON.stringify({email:usernameEmail(username),password,email_confirm:true,app_metadata:{svoya_auth:'username',svoya_username:username}}),
        signal:AbortSignal.timeout(15000),
      });
      if (!upstream.ok) {
        const failure=await upstream.json().catch(()=>({}));
        if (['email_exists','user_already_exists'].includes(failure.error_code??failure.code) || /already.*registered|already.*exists/i.test(failure.msg??failure.message??'')) return reply(409,{code:'SV_USERNAME_TAKEN'});
        return reply(503,{code:'SV_REGISTRATION_UNAVAILABLE'});
      }
      return reply(201,{ok:true,username});
    } catch { return reply(503,{code:'SV_REGISTRATION_UNAVAILABLE'}); }
  };
}
