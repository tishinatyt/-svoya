begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.svoya_entries, public.svoya_profiles, public.svoya_blocks, public.svoya_memberships in share row exclusive mode;
do $guard$
begin
 if md5(pg_get_functiondef('svoya_private.community_action(text,jsonb)'::regprocedure)) <> 'cc3c927427675e29707d32bcb738e4bd' then raise exception 'SVOYA_FUNCTION_DRIFT'; end if;
 if (select proacl::text from pg_proc where oid='svoya_private.community_action(text,jsonb)'::regprocedure) is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then raise exception 'SVOYA_FUNCTION_ACL_DRIFT'; end if;
 if to_regprocedure('svoya_private.repair_greeters()') is not null or exists(select 1 from pg_trigger where tgname in ('svoya_greeter_membership','svoya_greeter_profile','svoya_greeter_block')) then raise exception 'SVOYA_UPGRADE_ALREADY_PRESENT_OR_DRIFTED'; end if;
 if exists(select 1 from public.svoya_memberships) then raise exception 'SVOYA_MEMBERSHIPS_CHANGED_REFRESH_BACKUP'; end if;
end $guard$;
-- SVOYA-only upgrade. Baseline must NOT be applied to existing production.
-- Serialize assignment with join/cancellation on the event row.
create or replace function svoya_private.community_action(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();target uuid;item uuid;st text;result jsonb;e public.svoya_entries;f public.svoya_friendships;next_user uuid;code_value text;
begin
 if me is null then raise exception 'SV_LOGIN';end if;
 if action in ('review_profile','review_report','review_story','review_benefit') then
  if not svoya_private.is_admin() then raise exception 'SV_ADMIN_ONLY';end if;
  target:=(data->>'id')::uuid;st:=data->>'status';
  if action='review_profile' then
   if st not in ('approved','suspended','pending') then raise exception 'SV_STATUS';end if;
   if st='approved' and not exists(select 1 from auth.users where id=target and email_confirmed_at is not null and not is_anonymous) then raise exception 'SV_EMAIL_REQUIRED';end if;
   update public.svoya_profiles set membership_status=st,moderated_at=now() where id=target;
   insert into public.svoya_notifications(user_id,kind,title,body,link_path) values(target,'moderation','Анкету розглянуто','Перевір статус у своєму профілі.','/club?section=profile');
  elsif action='review_report' then
   update public.svoya_reports set status='resolved',resolution=left(coalesce(data->>'note','Розглянуто'),1000) where id=target;
  elsif action='review_story' then
   if st not in ('published','rejected','archived') then raise exception 'SV_STATUS';end if;
   update public.svoya_stories set status=st where id=target;
  else
   if st not in ('published','rejected','archived') then raise exception 'SV_STATUS';end if;
   update public.svoya_benefits set status=st where id=target;
  end if;
  insert into public.svoya_moderation_log(admin_id,target_id,action,note) values(me,target,action||':'||coalesce(st,'resolved'),left(coalesce(data->>'note',''),1000));return jsonb_build_object('ok',true);
 end if;
 if not svoya_private.is_active() then raise exception 'SV_REVIEW_PENDING';end if;
 if action='join' then
  item:=(data->>'entry_id')::uuid;
  select * into e from public.svoya_entries where id=item for update;
  if e.id is null or e.owner_id=me or e.is_demo or e.status<>'published' or e.kind not in ('event','circle') or (e.kind='event' and e.starts_at<=now()) or (e.expires_at is not null and e.expires_at<=now()) or svoya_private.blocked(e.owner_id) or not svoya_private.owner_visible(e.owner_id) then raise exception 'SV_CLOSED';end if;
  if exists(select 1 from public.svoya_memberships where entry_id=item and user_id=me) then raise exception 'SV_ALREADY_JOINED';end if;
  st:=case when (select count(*) from public.svoya_memberships where entry_id=item and status in ('joined','pending'))>=e.capacity then 'waitlisted' else 'pending' end;
  insert into public.svoya_memberships(entry_id,user_id,status,needs_greeter,greeter_id) values(item,me,st,coalesce((data->>'needs_greeter')::boolean,false),case when coalesce((data->>'needs_greeter')::boolean,false) then e.owner_id end);
  return jsonb_build_object('status',st);
 elsif action='assign_greeter' then
  item:=(data->>'entry_id')::uuid;target:=(data->>'user_id')::uuid;next_user:=(data->>'greeter_id')::uuid;
  select * into e from public.svoya_entries where id=item for update;
  if e.owner_id is distinct from me then raise exception 'SV_OWNER_ONLY';end if;
  if next_user<>me and not exists(select 1 from public.svoya_profiles p join public.svoya_memberships m on m.user_id=p.id where p.id=next_user and p.welcomes_newcomers and p.membership_status='approved' and m.entry_id=item and m.status='joined') then raise exception 'SV_GREETER_INVALID';end if;
  if exists(select 1 from public.svoya_blocks where (blocker_id=target and blocked_id=next_user) or (blocker_id=next_user and blocked_id=target)) then raise exception 'SV_BLOCKED';end if;
  update public.svoya_memberships set greeter_id=next_user where entry_id=item and user_id=target and needs_greeter;return jsonb_build_object('ok',true);
 elsif action='friend_invite' then
  target:=(data->>'user_id')::uuid;
  if target=me or svoya_private.blocked(target) or not exists(select 1 from public.svoya_profiles where id=target and membership_status='approved' and discoverable) then raise exception 'SV_UNAVAILABLE';end if;
  insert into public.svoya_friendships(from_id,to_id,note) values(me,target,left(coalesce(data->>'note','Привіт! Буду рада познайомитися.'),500)) returning id into item;
  insert into public.svoya_notifications(user_id,kind,title,body,link_path) values(target,'friendship','Запрошення познайомитися','Відкрий розділ «Подруги».','/club?section=discover');return jsonb_build_object('id',item);
 elsif action='friend_respond' then
  item:=(data->>'id')::uuid;st:=data->>'status';
  select * into f from public.svoya_friendships where id=item for update;
  if f.to_id is distinct from me or f.status<>'pending' or st not in ('accepted','declined') or svoya_private.blocked(f.from_id) then raise exception 'SV_UNAVAILABLE';end if;
  update public.svoya_friendships set status=st where id=item;
  if st='accepted' then insert into public.svoya_notifications(user_id,kind,title,body,link_path) values(f.from_id,'friendship','Тепер можна поспілкуватися','Твоє запрошення прийнято.','/club?section=discover');end if;return jsonb_build_object('ok',true);
 elsif action='claim_benefit' then
  item:=(data->>'id')::uuid;
  if not exists(select 1 from public.svoya_benefits where id=item and status='published' and valid_until>now()) then raise exception 'SV_EXPIRED';end if;
  insert into public.svoya_benefit_claims(benefit_id,user_id) values(item,me) on conflict do nothing;
  select code into code_value from public.svoya_benefit_codes where benefit_id=item;return jsonb_build_object('code',coalesce(code_value,'Покажи партнеру свій профіль СВОЯ та умови цієї пропозиції.'));
 end if;
 raise exception 'SV_ACTION';
end $$;

-- Invoked only by RLS-protected changes to SVOYA rows, never exposed as RPC.
create function svoya_private.repair_greeters() returns trigger
language plpgsql security definer set search_path='' as $$
declare event_id uuid; person_id uuid;
begin
 if tg_table_name='svoya_memberships' then
   event_id:=old.entry_id;
   person_id:=old.user_id;
   if tg_op='UPDATE' and new.status='joined' then return new;end if;
   perform 1 from public.svoya_entries where id=event_id for update;
 elsif tg_table_name='svoya_profiles' then
   person_id:=new.id;
 end if;
 update public.svoya_memberships m
 set greeter_id=case
   when exists(select 1 from public.svoya_profiles p where p.id=e.owner_id and p.membership_status='approved')
   and not exists(select 1 from public.svoya_blocks b where
     (b.blocker_id=e.owner_id and b.blocked_id=m.user_id) or (b.blocked_id=e.owner_id and b.blocker_id=m.user_id))
   then e.owner_id else null end
 from public.svoya_entries e
 where e.id=m.entry_id and m.needs_greeter and m.greeter_id is not null
   and (event_id is null or m.entry_id=event_id)
   and (person_id is null or m.greeter_id=person_id)
   and (
     not exists(select 1 from public.svoya_profiles p where p.id=m.greeter_id and p.membership_status='approved')
     or (m.greeter_id<>e.owner_id and not exists(
       select 1 from public.svoya_memberships g join public.svoya_profiles p on p.id=g.user_id
       where g.entry_id=m.entry_id and g.user_id=m.greeter_id and g.status='joined'
         and p.membership_status='approved' and p.welcomes_newcomers))
     or exists(select 1 from public.svoya_blocks b where
       (b.blocker_id=m.greeter_id and b.blocked_id=m.user_id) or (b.blocked_id=m.greeter_id and b.blocker_id=m.user_id))
   );
 return coalesce(new,old);
end $$;
revoke all on function svoya_private.repair_greeters() from public,anon,authenticated;
create trigger svoya_greeter_membership after delete or update of status on public.svoya_memberships
 for each row execute function svoya_private.repair_greeters();
create trigger svoya_greeter_profile after update of membership_status,welcomes_newcomers on public.svoya_profiles
 for each row execute function svoya_private.repair_greeters();
create trigger svoya_greeter_block after insert on public.svoya_blocks
 for each row execute function svoya_private.repair_greeters();

-- Repair historical SVOYA assignments using the same eligibility rules.
 update public.svoya_memberships m
 set greeter_id=case
   when exists(select 1 from public.svoya_profiles p where p.id=e.owner_id and p.membership_status='approved')
   and not exists(select 1 from public.svoya_blocks b where
     (b.blocker_id=e.owner_id and b.blocked_id=m.user_id) or (b.blocked_id=e.owner_id and b.blocker_id=m.user_id))
   then e.owner_id else null end
 from public.svoya_entries e
 where e.id=m.entry_id and m.needs_greeter and m.greeter_id is not null
   and (
     not exists(select 1 from public.svoya_profiles p where p.id=m.greeter_id and p.membership_status='approved')
     or (m.greeter_id<>e.owner_id and not exists(
       select 1 from public.svoya_memberships g join public.svoya_profiles p on p.id=g.user_id
       where g.entry_id=m.entry_id and g.user_id=m.greeter_id and g.status='joined'
         and p.membership_status='approved' and p.welcomes_newcomers))
     or exists(select 1 from public.svoya_blocks b where
       (b.blocker_id=m.greeter_id and b.blocked_id=m.user_id) or (b.blocked_id=m.greeter_id and b.blocker_id=m.user_id))
   );

do $verify$
begin
 if (select md5(prosrc) from pg_proc where oid='svoya_private.community_action(text,jsonb)'::regprocedure) <> 'a88cade4a1f53d07cfae554d92cd5a51' then raise exception 'SVOYA_ACTION_MISMATCH'; end if;
 if (select md5(prosrc) from pg_proc where oid='svoya_private.repair_greeters()'::regprocedure) <> '9e194a62f96d9c80e6cb9898c38e0fe8' then raise exception 'SVOYA_REPAIR_MISMATCH'; end if;
 if (select count(*) from pg_trigger where tgfoid='svoya_private.repair_greeters()'::regprocedure and tgenabled='O' and not tgisinternal and (tgname,tgrelid) in (('svoya_greeter_membership','public.svoya_memberships'::regclass),('svoya_greeter_profile','public.svoya_profiles'::regclass),('svoya_greeter_block','public.svoya_blocks'::regclass))) <> 3 then raise exception 'SVOYA_TRIGGERS_MISMATCH'; end if;
 if has_function_privilege('anon','svoya_private.repair_greeters()','EXECUTE') or has_function_privilege('authenticated','svoya_private.repair_greeters()','EXECUTE') then raise exception 'SVOYA_INTERNAL_FUNCTION_EXPOSED'; end if;
 if (select proacl::text from pg_proc where oid='svoya_private.community_action(text,jsonb)'::regprocedure) is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then raise exception 'SVOYA_ACTION_ACL_CHANGED'; end if;
 if exists(select 1 from public.svoya_memberships) then raise exception 'SVOYA_UNEXPECTED_MEMBERSHIP_WRITE'; end if;
 if (select md5(string_agg(pg_get_functiondef(p.oid),E'\n' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname not like 'svoya%') is distinct from 'a964ad2d495cf8cb7ab02ad2044b034c' then raise exception 'OTHER_PUBLIC_FUNCTIONS_CHANGED'; end if;
 if (select md5(string_agg(row_to_json(p)::text,E'\n' order by schemaname,tablename,policyname)) from pg_policies p where tablename not like 'svoya%') is distinct from '5fce12697e30eb5bcc4d2ba9ca64c667' then raise exception 'OTHER_POLICIES_CHANGED'; end if;
end $verify$;
commit;

