-- SVOYA only. Existing profiles keep access; every new profile is reviewed.
alter table public.svoya_profiles add column membership_status text not null default 'approved' check(membership_status in ('pending','approved','suspended'));
alter table public.svoya_profiles alter column membership_status set default 'pending';
alter table public.svoya_profiles add column moderated_at timestamptz, add column discoverable boolean not null default false, add column district text not null default '' check(length(district)<=80), add column availability text[] not null default '{}' check(availability <@ array['weekday_day','weekday_evening','weekend']), add column welcomes_newcomers boolean not null default false;
revoke insert on public.svoya_profiles from authenticated;
grant insert(id,name,city,bio,interests,photo_paths,rules_accepted_at,discoverable,district,availability,welcomes_newcomers) on public.svoya_profiles to authenticated;
grant update(discoverable,district,availability,welcomes_newcomers) on public.svoya_profiles to authenticated;
create table public.svoya_blocks(blocker_id uuid not null references public.svoya_profiles(id) on delete cascade,blocked_id uuid not null references public.svoya_profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
create index svoya_blocks_target on public.svoya_blocks(blocked_id);
alter table public.svoya_blocks enable row level security;
revoke all on public.svoya_blocks from anon,authenticated;
grant select,insert,delete on public.svoya_blocks to authenticated;
create policy svoya_blocks_own on public.svoya_blocks for all to authenticated using(blocker_id=(select auth.uid())) with check(blocker_id=(select auth.uid()));
create function svoya_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.svoya_admins where user_id=auth.uid()) $$;
create function svoya_private.is_active() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.svoya_profiles where id=auth.uid() and membership_status='approved' and cardinality(photo_paths)>0) $$;
create function svoya_private.blocked(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.svoya_blocks where (blocker_id=auth.uid() and blocked_id=target) or (blocked_id=auth.uid() and blocker_id=target)) $$;
create function svoya_private.owner_visible(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.svoya_profiles where id=target and membership_status='approved') $$;
grant usage on schema svoya_private to anon,authenticated;
revoke all on function svoya_private.is_admin(),svoya_private.is_active(),svoya_private.blocked(uuid),svoya_private.owner_visible(uuid) from public;
grant execute on function svoya_private.is_admin(),svoya_private.is_active(),svoya_private.blocked(uuid),svoya_private.owner_visible(uuid) to anon,authenticated;
alter policy svoya_profile_read on public.svoya_profiles using(id=(select auth.uid()) or (select svoya_private.is_admin()) or (membership_status='approved' and (select svoya_private.is_active()) and not svoya_private.blocked(id)));
alter policy svoya_profile_insert on public.svoya_profiles with check(id=(select auth.uid()) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false));

alter table public.svoya_entries add column format text not null default 'standard' check(format in ('standard','coffee','quick')),add column ends_at timestamptz,add column expires_at timestamptz,add column district text not null default '' check(length(district)<=80),add column image_paths text[] not null default '{}' check(cardinality(image_paths)<=6),add column recurrence_note text not null default '' check(length(recurrence_note)<=180),add column welcome_newcomers boolean not null default true,add column shelter_info text not null default '' check(length(shelter_info)<=500),add column accessibility_info text not null default '' check(length(accessibility_info)<=500),add column children_welcome boolean not null default false;
alter table public.svoya_entries add constraint svoya_format_valid check(format='standard' or (kind='event' and (format<>'coffee' or capacity between 3 and 5))),add constraint svoya_end_after_start check(ends_at is null or ends_at>starts_at),add constraint svoya_quick_expiry check(format<>'quick' or (expires_at is not null and starts_at is not null and expires_at>starts_at and expires_at<=starts_at+interval '24 hours'));
grant update(format,ends_at,expires_at,district,image_paths,recurrence_note,welcome_newcomers,shelter_info,accessibility_info,children_welcome) on public.svoya_entries to authenticated;
alter policy svoya_entry_read on public.svoya_entries using(owner_id=(select auth.uid()) or (select svoya_private.is_admin()) or (status='published' and (expires_at is null or expires_at>now()) and (is_demo or svoya_private.owner_visible(owner_id)) and not svoya_private.blocked(owner_id)));
create policy svoya_entry_active_insert on public.svoya_entries as restrictive for insert to authenticated with check((select svoya_private.is_active()));
create policy svoya_entry_active_update on public.svoya_entries as restrictive for update to authenticated using((select svoya_private.is_active()) or (select svoya_private.is_admin())) with check((select svoya_private.is_active()) or (select svoya_private.is_admin()));
create index svoya_entries_date on public.svoya_entries(starts_at) where status='published' and not is_demo;
alter table public.svoya_memberships drop constraint svoya_memberships_status_check;
alter table public.svoya_memberships add constraint svoya_memberships_status_check check(status in ('pending','joined','rejected','waitlisted')),add column needs_greeter boolean not null default false,add column greeter_id uuid references public.svoya_profiles(id) on delete set null;
create index svoya_memberships_greeter on public.svoya_memberships(greeter_id);
create index svoya_memberships_queue on public.svoya_memberships(entry_id,created_at) where status='waitlisted';
-- New joins go through a serialized, guarded RPC. Direct updates are organizer-only.
revoke insert on public.svoya_memberships from authenticated;
create policy svoya_member_active_update on public.svoya_memberships as restrictive for update to authenticated using((select svoya_private.is_active()) and not svoya_private.blocked(user_id)) with check((select svoya_private.is_active()) and not svoya_private.blocked(user_id));
create policy svoya_request_active_insert on public.svoya_requests as restrictive for insert to authenticated with check((select svoya_private.is_active()));
create policy svoya_request_active_update on public.svoya_requests as restrictive for update to authenticated using((select svoya_private.is_active()) and not svoya_private.blocked(user_id)) with check((select svoya_private.is_active()) and not svoya_private.blocked(user_id));
create policy svoya_chat_safe_read on public.svoya_messages as restrictive for select to authenticated using((select svoya_private.is_active()) and not svoya_private.blocked(user_id));
create policy svoya_chat_active_insert on public.svoya_messages as restrictive for insert to authenticated with check((select svoya_private.is_active()));

alter table public.svoya_reports alter column entry_id drop not null;
alter table public.svoya_reports add column target_user_id uuid references public.svoya_profiles(id) on delete cascade,add column status text not null default 'open' check(status in ('open','resolved')),add column resolution text not null default '' check(length(resolution)<=1000),add constraint svoya_report_target check(entry_id is not null or target_user_id is not null);
create index svoya_reports_target on public.svoya_reports(target_user_id);
revoke insert on public.svoya_reports from authenticated;
grant insert(entry_id,target_user_id,user_id,reason) on public.svoya_reports to authenticated;
create table public.svoya_moderation_log(id uuid primary key default gen_random_uuid(),admin_id uuid not null references auth.users(id),target_id uuid not null,action text not null,note text not null default '',created_at timestamptz not null default now());
alter table public.svoya_moderation_log enable row level security;
revoke all on public.svoya_moderation_log from anon,authenticated;
grant select on public.svoya_moderation_log to authenticated;
create policy svoya_audit_admin on public.svoya_moderation_log for select to authenticated using((select svoya_private.is_admin()));
create index svoya_audit_admin_idx on public.svoya_moderation_log(admin_id);

create table public.svoya_friendships(id uuid primary key default gen_random_uuid(),from_id uuid not null references public.svoya_profiles(id) on delete cascade,to_id uuid not null references public.svoya_profiles(id) on delete cascade,status text not null default 'pending' check(status in ('pending','accepted','declined')),note text not null default '' check(length(note)<=500),created_at timestamptz not null default now(),check(from_id<>to_id));
create unique index svoya_friendships_pair on public.svoya_friendships(least(from_id,to_id),greatest(from_id,to_id));
create index svoya_friendships_from on public.svoya_friendships(from_id);
create index svoya_friendships_to on public.svoya_friendships(to_id);
alter table public.svoya_friendships enable row level security;
revoke all on public.svoya_friendships from anon,authenticated;
grant select on public.svoya_friendships to authenticated;
create policy svoya_friends_read on public.svoya_friendships for select to authenticated using((from_id=(select auth.uid()) or to_id=(select auth.uid())) and (select svoya_private.is_active()) and not svoya_private.blocked(case when from_id=(select auth.uid()) then to_id else from_id end));
create table public.svoya_friend_messages(id uuid primary key default gen_random_uuid(),friendship_id uuid not null references public.svoya_friendships(id) on delete cascade,user_id uuid not null references public.svoya_profiles(id) on delete cascade,body text not null check(length(trim(body)) between 1 and 2000),created_at timestamptz not null default now());
create index svoya_friend_messages_thread on public.svoya_friend_messages(friendship_id,created_at);
create index svoya_friend_messages_user on public.svoya_friend_messages(user_id);
alter table public.svoya_friend_messages enable row level security;
revoke all on public.svoya_friend_messages from anon,authenticated;
grant select,insert on public.svoya_friend_messages to authenticated;
create policy svoya_friend_chat_read on public.svoya_friend_messages for select to authenticated using(exists(select 1 from public.svoya_friendships f where f.id=friendship_id and f.status='accepted'));
create policy svoya_friend_chat_insert on public.svoya_friend_messages for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.svoya_friendships f where f.id=friendship_id and f.status='accepted'));

create table public.svoya_reminders(user_id uuid not null references public.svoya_profiles(id) on delete cascade,entry_id uuid not null references public.svoya_entries(id) on delete cascade,minutes_before integer not null default 60 check(minutes_before in (30,60,1440)),sent_for timestamptz,primary key(user_id,entry_id));
create index svoya_reminders_entry on public.svoya_reminders(entry_id);
alter table public.svoya_reminders enable row level security;
revoke all on public.svoya_reminders from anon,authenticated;
grant select,delete on public.svoya_reminders to authenticated;
grant insert(user_id,entry_id,minutes_before),update(minutes_before) on public.svoya_reminders to authenticated;
create policy svoya_reminders_own_read on public.svoya_reminders for select to authenticated using(user_id=(select auth.uid()));
create policy svoya_reminders_own_delete on public.svoya_reminders for delete to authenticated using(user_id=(select auth.uid()));
create policy svoya_reminders_insert on public.svoya_reminders for insert to authenticated with check(user_id=(select auth.uid()) and (select svoya_private.is_active()) and exists(select 1 from public.svoya_entries e where e.id=entry_id and e.starts_at>now() and e.status='published' and (e.owner_id=(select auth.uid()) or exists(select 1 from public.svoya_memberships m where m.entry_id=e.id and m.user_id=(select auth.uid()) and m.status='joined'))));
create policy svoya_reminders_update on public.svoya_reminders for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.svoya_benefits(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.svoya_profiles(id),title text not null check(length(trim(title)) between 3 and 120),provider text not null check(length(trim(provider)) between 2 and 120),description text not null check(length(description) between 10 and 3000),terms text not null check(length(terms) between 5 and 2000),city text not null check(length(city) between 2 and 80),url text not null default '' check(url='' or (url ~ '^https://' and length(url)<=2000)),valid_until timestamptz not null,status text not null default 'pending' check(status in ('pending','published','rejected','archived')),created_at timestamptz not null default now());
create index svoya_benefits_owner on public.svoya_benefits(owner_id);
alter table public.svoya_benefits enable row level security;
revoke all on public.svoya_benefits from anon,authenticated;
grant select on public.svoya_benefits to anon,authenticated;
grant insert(owner_id,title,provider,description,terms,city,url,valid_until) on public.svoya_benefits to authenticated;
create policy svoya_benefits_read on public.svoya_benefits for select to anon,authenticated using((status='published' and valid_until>now()) or owner_id=(select auth.uid()) or (select svoya_private.is_admin()));
create policy svoya_benefits_insert on public.svoya_benefits for insert to authenticated with check(owner_id=(select auth.uid()) and (select svoya_private.is_active()) and valid_until>now());
create table public.svoya_benefit_codes(benefit_id uuid primary key references public.svoya_benefits(id) on delete cascade,code text not null check(length(code) between 1 and 200));
alter table public.svoya_benefit_codes enable row level security;
revoke all on public.svoya_benefit_codes from anon,authenticated;
grant select,insert on public.svoya_benefit_codes to authenticated;
create policy svoya_codes_read on public.svoya_benefit_codes for select to authenticated using((select svoya_private.is_admin()) or exists(select 1 from public.svoya_benefits b where b.id=benefit_id and b.owner_id=(select auth.uid())));
create policy svoya_codes_insert on public.svoya_benefit_codes for insert to authenticated with check(exists(select 1 from public.svoya_benefits b where b.id=benefit_id and b.owner_id=(select auth.uid()) and b.status='pending'));
create table public.svoya_benefit_claims(benefit_id uuid not null references public.svoya_benefits(id) on delete cascade,user_id uuid not null references public.svoya_profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(benefit_id,user_id));
create index svoya_benefit_claims_user on public.svoya_benefit_claims(user_id);
alter table public.svoya_benefit_claims enable row level security;
revoke all on public.svoya_benefit_claims from anon,authenticated;
grant select on public.svoya_benefit_claims to authenticated;
create policy svoya_claims_own on public.svoya_benefit_claims for select to authenticated using(user_id=(select auth.uid()));

create table public.svoya_stories(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.svoya_profiles(id),entry_id uuid references public.svoya_entries(id),kind text not null check(kind in ('story','host')),title text not null check(length(trim(title)) between 3 and 120),body text not null check(length(body) between 20 and 5000),city text not null check(length(city) between 2 and 80),image_paths text[] not null default '{}' check(cardinality(image_paths)<=6),public_consent boolean not null check(public_consent),status text not null default 'pending' check(status in ('pending','published','rejected','archived')),created_at timestamptz not null default now());
create index svoya_stories_owner on public.svoya_stories(owner_id);
create index svoya_stories_entry on public.svoya_stories(entry_id);
alter table public.svoya_stories enable row level security;
revoke all on public.svoya_stories from anon,authenticated;
grant select on public.svoya_stories to anon,authenticated;
grant insert(owner_id,entry_id,kind,title,body,city,image_paths,public_consent) on public.svoya_stories to authenticated;
create policy svoya_stories_read on public.svoya_stories for select to anon,authenticated using(status='published' or owner_id=(select auth.uid()) or (select svoya_private.is_admin()));
create policy svoya_stories_insert on public.svoya_stories for insert to authenticated with check(owner_id=(select auth.uid()) and (select svoya_private.is_active()) and (kind='host' or exists(select 1 from public.svoya_entries e where e.id=entry_id and not e.is_demo and e.starts_at<now() and (e.owner_id=(select auth.uid()) or exists(select 1 from public.svoya_memberships m where m.entry_id=e.id and m.user_id=(select auth.uid()) and m.status='joined')))));
-- Only explicitly public meeting/portfolio/host images go here. Profile photos remain private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('svoya-community','svoya-community',true,6291456,array['image/jpeg','image/png','image/webp']);
create policy svoya_community_upload on storage.objects for insert to authenticated with check(bucket_id='svoya-community' and (storage.foldername(name))[1]=(select auth.uid())::text and (select svoya_private.is_active()));
create policy svoya_community_own_read on storage.objects for select to authenticated using(bucket_id='svoya-community' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy svoya_community_remove on storage.objects for delete to authenticated using(bucket_id='svoya-community' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.svoya_entries e where name=any(e.image_paths)) and not exists(select 1 from public.svoya_stories s where name=any(s.image_paths)));
create function svoya_private.validate_community_images() returns trigger language plpgsql security definer set search_path='' as $$
declare path text;
begin
 foreach path in array new.image_paths loop
  if split_part(path,'/',1)<>new.owner_id::text or not exists(select 1 from storage.objects where bucket_id='svoya-community' and name=path) then raise exception 'SV_IMAGE_INVALID';end if;
 end loop;return new;
end $$;
revoke all on function svoya_private.validate_community_images() from public,anon,authenticated;
create trigger svoya_entry_images before insert or update of image_paths on public.svoya_entries for each row execute function svoya_private.validate_community_images();
create trigger svoya_story_images before insert on public.svoya_stories for each row execute function svoya_private.validate_community_images();

alter table public.svoya_notifications drop constraint svoya_notifications_kind_check;
alter table public.svoya_notifications add constraint svoya_notifications_kind_check check(kind in ('join_request','join_status','booking_request','booking_status','chat','event_change','leave','reminder','friendship','moderation')),add column link_path text;
-- All elevated writes are identity-bound and validate their target, not caller metadata.
create function svoya_private.community_action(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function svoya_private.community_action(text,jsonb) from public,anon;
grant execute on function svoya_private.community_action(text,jsonb) to authenticated;
create function public.svoya_community_action(action text,data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select svoya_private.community_action(action,data) $$;
revoke all on function public.svoya_community_action(text,jsonb) from public,anon;
grant execute on function public.svoya_community_action(text,jsonb) to authenticated;

-- Cancellation offers the oldest waiting request a place for organizer confirmation.
create function svoya_private.promote_waitlist() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.svoya_entries;target uuid;
begin
 if old.status not in ('joined','pending') or (tg_op='UPDATE' and new.status<>'rejected') then return coalesce(new,old);end if;
 select * into e from public.svoya_entries where id=old.entry_id for update;
 if e.status<>'published' or (e.kind='event' and e.starts_at<=now()) then return coalesce(new,old);end if;
 if (select count(*) from public.svoya_memberships where entry_id=e.id and status in ('joined','pending'))>=e.capacity then return coalesce(new,old);end if;
 select m.user_id into target from public.svoya_memberships m join public.svoya_profiles p on p.id=m.user_id where m.entry_id=e.id and m.status='waitlisted' and p.membership_status='approved' and not exists(select 1 from public.svoya_blocks b where (b.blocker_id=e.owner_id and b.blocked_id=m.user_id) or (b.blocked_id=e.owner_id and b.blocker_id=m.user_id)) order by m.created_at,m.user_id limit 1 for update of m;
 if target is not null then
  update public.svoya_memberships set status='pending' where entry_id=e.id and user_id=target;
  insert into public.svoya_notifications(user_id,entry_id,kind,title,body) values(target,e.id,'join_status','Звільнилося місце',e.title||' · Очікуємо підтвердження організаторки.'),(e.owner_id,e.id,'join_request','Учасниця з листа очікування',e.title);
 end if;return coalesce(new,old);
end $$;
revoke all on function svoya_private.promote_waitlist() from public,anon,authenticated;
create trigger svoya_waitlist_cancel after delete or update of status on public.svoya_memberships for each row execute function svoya_private.promote_waitlist();
create function svoya_private.send_reminders() returns void language plpgsql security definer set search_path='' as $$
declare r record;
begin
 for r in select x.user_id,x.entry_id,e.starts_at,e.title from public.svoya_reminders x join public.svoya_entries e on e.id=x.entry_id join public.svoya_profiles p on p.id=x.user_id where e.status='published' and not e.is_demo and p.membership_status='approved' and e.starts_at>now() and e.starts_at<=now()+make_interval(mins=>x.minutes_before) and x.sent_for is distinct from e.starts_at and (e.owner_id=x.user_id or exists(select 1 from public.svoya_memberships m where m.entry_id=e.id and m.user_id=x.user_id and m.status='joined')) and not exists(select 1 from public.svoya_blocks b where (b.blocker_id=e.owner_id and b.blocked_id=x.user_id) or (b.blocked_id=e.owner_id and b.blocker_id=x.user_id)) for update of x skip locked loop
  update public.svoya_reminders set sent_for=r.starts_at where user_id=r.user_id and entry_id=r.entry_id;
  insert into public.svoya_notifications(user_id,entry_id,kind,title,body) values(r.user_id,r.entry_id,'reminder','Незабаром зустріч',r.title);
 end loop;
end $$;
revoke all on function svoya_private.send_reminders() from public,anon,authenticated;
select cron.schedule('svoya-event-reminders','* * * * *','select svoya_private.send_reminders()');
create function svoya_private.friend_message_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 select case when from_id=new.user_id then to_id else from_id end into target from public.svoya_friendships where id=new.friendship_id and status='accepted';
 if target is not null and not exists(select 1 from public.svoya_notifications where user_id=target and kind='friendship' and read_at is null and created_at>now()-interval '2 minutes') then insert into public.svoya_notifications(user_id,kind,title,body,link_path) values(target,'friendship','Нове особисте повідомлення','Відкрий розділ «Подруги», щоб прочитати.','/club?section=discover');end if;return new;
end $$;
revoke all on function svoya_private.friend_message_notice() from public,anon,authenticated;
create trigger svoya_friend_message_notify after insert on public.svoya_friend_messages for each row execute function svoya_private.friend_message_notice();
-- Aggregate counts expose no participant identities; only currently public events.
create function svoya_private.entry_counts() returns table(entry_id uuid,joined bigint,waiting bigint) language sql stable security definer set search_path='' as $$
 select e.id,count(m.user_id) filter(where m.status='joined'),count(m.user_id) filter(where m.status='waitlisted') from public.svoya_entries e left join public.svoya_memberships m on m.entry_id=e.id where e.status='published' and (e.expires_at is null or e.expires_at>now()) and (e.is_demo or svoya_private.owner_visible(e.owner_id)) and not svoya_private.blocked(e.owner_id) group by e.id
$$;
revoke all on function svoya_private.entry_counts() from public;
grant execute on function svoya_private.entry_counts() to anon,authenticated;
create function public.svoya_entry_counts() returns table(entry_id uuid,joined bigint,waiting bigint) language sql stable security invoker set search_path='' as $$ select * from svoya_private.entry_counts() $$;
revoke all on function public.svoya_entry_counts() from public;
grant execute on function public.svoya_entry_counts() to anon,authenticated;

create or replace function svoya_private.club_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();e public.svoya_entries;who text;headline text;target uuid;
begin
 if actor is null then return coalesce(new,old);end if;
 if tg_table_name='svoya_entries' then
  if new.owner_id<>actor or old.is_demo or new.is_demo then return new;end if;
  if (old.title,old.starts_at,old.location,old.status) is not distinct from (new.title,new.starts_at,new.location,new.status) then return new;end if;
  insert into public.svoya_notifications(user_id,entry_id,kind,title,body)
  select m.user_id,new.id,'event_change',case when new.status='archived' then 'Зустріч приховано' else 'Змінилися деталі зустрічі' end,new.title
  from public.svoya_memberships m where m.entry_id=new.id and m.status in ('pending','joined','waitlisted') and m.user_id<>actor;return new;
 end if;
 select * into e from public.svoya_entries where id=case when tg_op='DELETE' then old.entry_id else new.entry_id end;
 if e.id is null or svoya_private.blocked(e.owner_id) then return coalesce(new,old);end if;
 select name into who from public.svoya_profiles where id=actor;
 if tg_table_name='svoya_memberships' then
  if tg_op='INSERT' and new.user_id=actor and new.status='pending' then
   insert into public.svoya_notifications(user_id,entry_id,kind,title,body) values(e.owner_id,e.id,'join_request','Нова заявка на участь',coalesce(who,'Учасниця')||' · '||e.title);
  elsif tg_op='UPDATE' and e.owner_id=actor and new.status<>old.status then
   insert into public.svoya_notifications(user_id,entry_id,kind,title,body) values(new.user_id,e.id,'join_status',case when new.status='joined' then 'Твою участь підтверджено' else 'Статус заявки оновлено' end,e.title);
  elsif tg_op='DELETE' and old.user_id=actor then
   insert into public.svoya_notifications(user_id,entry_id,kind,title,body) values(e.owner_id,e.id,'leave','Участь скасовано',coalesce(who,'Учасниця')||' · '||e.title);
  end if;
 elsif tg_table_name='svoya_requests' then
  if tg_op='INSERT' and new.user_id=actor then
   insert into public.svoya_notifications(user_id,entry_id,kind,title,body) values(e.owner_id,e.id,'booking_request','Нове звернення',coalesce(who,'Учасниця')||' · '||e.title);
  elsif tg_op='UPDATE' and e.owner_id=actor and new.status<>old.status then
   insert into public.svoya_notifications(user_id,entry_id,kind,title,body) values(new.user_id,e.id,'booking_status',case when new.status='accepted' then 'Твою заявку підтверджено' when new.status='closed' then 'Звернення завершено' else 'Статус звернення оновлено' end,e.title);
  end if;
 elsif tg_table_name='svoya_messages' and new.user_id=actor then
  for target in select e.owner_id union select m.user_id from public.svoya_memberships m where m.entry_id=e.id and m.status='joined' loop
   if target<>actor and not svoya_private.blocked(target) and not exists(select 1 from public.svoya_notifications n where n.user_id=target and n.entry_id=e.id and n.kind='chat' and n.read_at is null and n.created_at>now()-interval '2 minutes') then
    insert into public.svoya_notifications(user_id,entry_id,kind,title,body) values(target,e.id,'chat','Нове повідомлення у чаті',e.title);
   end if;
  end loop;
 end if;return coalesce(new,old);
end $$;
