import { PGlite } from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const migrations=new URL('supabase-svoya/supabase/migrations/',root);
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create schema storage;create schema cron;create schema net;
create table auth.users(id uuid primary key,aud text,role text,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,unique(bucket_id,name));
alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
create function storage.extension(text) returns text language sql immutable as $$ select reverse(split_part(reverse($1),'.',1)) $$;
create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$ begin raise exception 'NETWORK_DISABLED_IN_AUDIT'; end $$;`);
for(const file of (await readdir(migrations)).filter(f=>f.endsWith('.sql')).sort()) {
 let sql=await readFile(new URL(file,migrations),'utf8');
 sql=sql.replace(/^create extension if not exists pg_(net|cron);$/gm,'-- extension represented by isolated stub');
 await db.exec(sql);console.log('Loaded',file);
}
for(const file of ['supabase/tests/svoya-community-transaction.sql','supabase-svoya/tests/access-and-greeters.sql']) {
 const results=await db.exec(await readFile(new URL(file,root),'utf8'));
 console.log(file, results.flatMap(r=>r.rows??[]));
}
await db.close();
