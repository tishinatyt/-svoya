import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationHandler } from '../supabase-svoya/supabase/functions/svoya-register/handler.ts';
import { normalizeUsername, validUsername, usernameEmail } from '../supabase-svoya/supabase/functions/svoya-register/identity.ts';
const config={url:'https://test.invalid',serviceKey:'server-only-test-key',allowedOrigins:['https://club.invalid']};
const req=(data:unknown,origin='https://club.invalid')=>new Request('https://test.invalid/functions/v1/svoya-register',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer fixture'},body:JSON.stringify(data)});
test('username normalization has one namespace and rejects email identifiers',()=>{
 assert.equal(normalizeUsername('  Olena_22 '),'olena_22');
 assert.equal(usernameEmail('Olena_22'),'olena_22@login.svoya.invalid');
 for(const v of ['a','email@example.com','with space','admin','_hidden','x'.repeat(25)]) assert.equal(validUsername(v),false);
});
test('registration validates origin, size and credentials before calling privileged APIs',async()=>{
 let calls=0;const handle=registrationHandler(config,async()=>{calls++;throw new Error('must not call');});
 assert.equal((await handle(req({username:'ok_user',password:'1234567890'},'https://other.invalid'))).status,403);
 assert.equal((await handle(req({username:'person@example.com',password:'1234567890'}))).status,422);
 assert.equal((await handle(req({username:'ok_user',password:'short'}))).status,422);
 assert.equal((await handle(req({username:'ok_user',password:'x'.repeat(5000)}))).status,413);
 assert.equal(calls,0);
});
test('new registration only creates a generated identifier and server-owned metadata',async()=>{
 const calls:{url:string;body:any}[]=[];
 const handle=registrationHandler(config,async(url,init)=>{calls.push({url:String(url),body:JSON.parse(String(init?.body))});return Response.json(calls.length===1?true:{id:'new-user'},{status:calls.length===1?200:201});});
 const r=await handle(req({username:'Olena_22',password:'long-password',email:'victim@example.com',id:'victim',email_confirm:true,app_metadata:{admin:true}}));
 assert.equal(r.status,201);assert.deepEqual(await r.json(),{ok:true,username:'olena_22'});
 assert.match(calls[0].body.ip_hash,/^[a-f0-9]{64}$/);
 assert.equal(calls[1].url,'https://test.invalid/auth/v1/admin/users');
 assert.deepEqual(calls[1].body,{email:'olena_22@login.svoya.invalid',password:'long-password',email_confirm:true,app_metadata:{svoya_auth:'username',svoya_username:'olena_22'}});
});
test('rate limiter failures close registration and never create users',async()=>{
 for(const [response,status] of [[Response.json(false),429],[Response.json({}, {status:500}),503]] as const){
  let calls=0;const handle=registrationHandler(config,async()=>{calls++;return response;});
  assert.equal((await handle(req({username:'olena_22',password:'long-password'}))).status,status);assert.equal(calls,1);
 }
});
test('anonymous linking verifies the current token and rejects permanent accounts',async()=>{
 let calls=0;const handle=registrationHandler(config,async()=>{calls++;return Response.json(calls===1?true:{id:'permanent',is_anonymous:false});});
 assert.equal((await handle(req({username:'olena_22',password:'long-password',linkAnonymous:true}))).status,409);
 assert.equal(calls,2);
});
