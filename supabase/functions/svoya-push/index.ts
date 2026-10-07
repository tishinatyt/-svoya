import {createClient} from 'npm:@supabase/supabase-js@2.103.3';
import webpush from 'npm:web-push@3.6.7';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const site='https://svoya-women-club.dr12071980.chatgpt.site';
const allowedOrigins=new Set([site,'https://tishinatyt.github.io']);
function trustedEndpoint(endpoint:string){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));}catch{return false;}}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')??'';
 const cors={'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:site,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'};
 function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});}
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 const config=await db.from('svoya_push_config').select('*').eq('id',true).single();if(config.error)return json({error:'Notifications unavailable'},503);
 if(req.method==='GET')return json({publicKey:config.data.public_key});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 // Only the database's sealed webhook can dispatch. Client JWTs cannot send.
 if(req.headers.get('X-Svoya-Webhook')!==config.data.webhook_secret)return json({error:'Unauthorized'},401);
 let id:string;try{const body=await req.json();id=body.notification_id;if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))return json({error:'Invalid notification'},400);}catch{return json({error:'Invalid JSON'},400);}
 const claim=await db.rpc('svoya_claim_push',{p_id:id});if(claim.error)return json({error:'Queue unavailable'},500);const n=claim.data?.[0];if(!n)return json({status:'already handled'});
 try{
  const list=await db.from('svoya_push_subscriptions').select('*').eq('user_id',n.user_id);if(list.error)throw new Error('Subscriptions unavailable');
  if(!list.data.length){await db.from('svoya_notifications').update({push_status:'none'}).eq('id',id);return json({status:'no subscribers'});}
  const payload=JSON.stringify({title:'СВОЯ · '+n.title,body:n.kind==='chat'?'У твоєму колі є нове повідомлення. Відкрий клуб, щоб прочитати.':'Відкрий клуб, щоб переглянути подробиці.',tag:n.kind==='chat'?'chat-'+n.entry_id:n.id,url:(typeof n.link_path==='string'&&/^\/club\?section=(discover|profile)$/.test(n.link_path)?n.link_path:'/club?entry='+encodeURIComponent(n.entry_id??''))+'&notification='+n.id});
  let sent=0,retry=false;
  for(const sub of list.data){
   if(!trustedEndpoint(sub.endpoint)){await db.from('svoya_push_subscriptions').delete().eq('id',sub.id);continue;}
   try{
    const request=webpush.generateRequestDetails({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload,{TTL:3600,urgency:'normal',vapidDetails:{subject:site,publicKey:config.data.public_key,privateKey:config.data.private_key}});
    const res=await fetch(request.endpoint,{method:'POST',headers:request.headers,body:new Uint8Array(request.body),redirect:'error',signal:AbortSignal.timeout(10000)});
    if(res.ok)sent++;else if([400,404,410].includes(res.status)){await db.from('svoya_push_subscriptions').delete().eq('id',sub.id);}else retry=true;
   }catch{retry=true;}
  }
  // A notification tag collapses a rare duplicate on retry. No message text or
  // contacts go to the lock screen; only this authenticated user's event type.
  const status=retry&&n.push_attempts<5?'pending':sent?'sent':retry?'failed':'none';
  await db.from('svoya_notifications').update({push_status:status,push_error:retry?'Push service temporarily unavailable':null,push_retry_at:new Date(Date.now()+180000).toISOString()}).eq('id',id);
  return json({status,delivered:sent});
 }catch{
  await db.from('svoya_notifications').update({push_status:n.push_attempts<5?'pending':'failed',push_error:'Delivery unavailable',push_retry_at:new Date(Date.now()+180000).toISOString()}).eq('id',id);
  return json({error:'Delivery unavailable'},503);
 }
});

