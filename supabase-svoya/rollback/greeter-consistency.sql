-- Snapshot of the SVOYA function read from production on 2026-10-09.
-- Schema-only rollback for the greeter consistency upgrade; does not roll back user activity.
-- Apply only after separately checking the current schema and stopping conflicting writes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
drop trigger if exists svoya_greeter_membership on public.svoya_memberships;
drop trigger if exists svoya_greeter_profile on public.svoya_profiles;
drop trigger if exists svoya_greeter_block on public.svoya_blocks;
drop function if exists svoya_private.repair_greeters();
CREATE OR REPLACE FUNCTION svoya_private.community_action(action text, data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  select * into e from public.svoya_entries where id=item;
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
end $function$
;
commit;
