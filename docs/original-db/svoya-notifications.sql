-- Private recipient inbox and optional per-device Web Push.
create schema if not exists svoya_private;
revoke all on schema svoya_private from public,anon,authenticated;
create extension if not exists pg_net;
create extension if not exists pg_cron;
create table public.svoya_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 entry_id uuid references public.svoya_entries(id) on delete cascade,
 kind text not null check(kind in ('join_request','join_status','booking_request','booking_status','chat','event_change','leave')),
 title text not null,body text not null,created_at timestamptz not null default now(),read_at timestamptz,
 push_status text not null default 'pending' check(push_status in ('pending','sending','sent','none','failed')),
 push_attempts integer not null default 0,push_retry_at timestamptz not null default now(),push_error text
);
alter table public.svoya_notifications enable row level security;
revoke all on public.svoya_notifications from anon,authenticated;
grant select on public.svoya_notifications to authenticated;
grant update(read_at) on public.svoya_notifications to authenticated;
grant all on public.svoya_notifications to service_role;
create policy svoya_notifications_read on public.svoya_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy svoya_notifications_mark on public.svoya_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index svoya_notifications_user_time on public.svoya_notifications(user_id,created_at desc);
create index svoya_notifications_entry on public.svoya_notifications(entry_id);
create index svoya_notifications_pending on public.svoya_notifications(push_retry_at) where push_status in ('pending','sending');
create table public.svoya_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(char_length(endpoint) between 20 and 2500 and endpoint ~ '^https://(fcm.googleapis.com|updates.push.services.mozilla.com|web.push.apple.com|[a-z0-9-]+.push.apple.com|[a-z0-9-]+.notify.windows.com)/'),
 p256dh text not null check(char_length(p256dh) between 80 and 150),auth text not null check(char_length(auth) between 20 and 100),
 created_at timestamptz not null default now()
);
alter table public.svoya_push_subscriptions enable row level security;
revoke all on public.svoya_push_subscriptions from anon,authenticated;
grant select,insert,delete on public.svoya_push_subscriptions to authenticated;
grant all on public.svoya_push_subscriptions to service_role;
create policy svoya_push_self_read on public.svoya_push_subscriptions for select to authenticated using(user_id=(select auth.uid()));
create policy svoya_push_self_insert on public.svoya_push_subscriptions for insert to authenticated with check(user_id=(select auth.uid()));
create policy svoya_push_self_delete on public.svoya_push_subscriptions for delete to authenticated using(user_id=(select auth.uid()));
create index svoya_push_user on public.svoya_push_subscriptions(user_id);
-- Configuration is backend-only; service role and internal triggers need it.
create table public.svoya_push_config(id boolean primary key default true check(id),public_key text not null,private_key text not null,webhook_secret text not null);
alter table public.svoya_push_config enable row level security;
revoke all on public.svoya_push_config from public,anon,authenticated;
grant select on public.svoya_push_config to service_role;
create function svoya_private.limit_devices() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (select count(*) from public.svoya_push_subscriptions where user_id=new.user_id)>=10 then raise exception 'SV_DEVICE_LIMIT'; end if;return new;
end $$;
revoke all on function svoya_private.limit_devices() from public,anon,authenticated;
create trigger svoya_push_device_limit before insert on public.svoya_push_subscriptions for each row execute function svoya_private.limit_devices();
-- Sealed trigger: cross-recipient writes cannot be granted to client roles.
-- Only actual actor changes that passed source-table RLS generate notifications.
create function svoya_private.club_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();e public.svoya_entries;who text;headline text;target uuid;
begin
 if actor is null then return coalesce(new,old);end if;
 if tg_table_name='svoya_entries' then
  if new.owner_id<>actor or old.is_demo or new.is_demo then return new;end if;
  if (old.title,old.starts_at,old.location,old.status) is not distinct from (new.title,new.starts_at,new.location,new.status) then return new;end if;
  insert into public.svoya_notifications(user_id,entry_id,kind,title,body)
  select m.user_id,new.id,'event_change',case when new.status='archived' then 'Зустріч приховано' else 'Змінилися деталі зустрічі' end,new.title
  from public.svoya_memberships m where m.entry_id=new.id and m.status in ('pending','joined') and m.user_id<>actor;return new;
 end if;
 select * into e from public.svoya_entries where id=case when tg_op='DELETE' then old.entry_id else new.entry_id end;
 if e.id is null then return coalesce(new,old);end if;
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
   if target<>actor and not exists(select 1 from public.svoya_notifications n where n.user_id=target and n.entry_id=e.id and n.kind='chat' and n.read_at is null and n.created_at>now()-interval '2 minutes') then
    insert into public.svoya_notifications(user_id,entry_id,kind,title,body) values(target,e.id,'chat','Нове повідомлення у чаті',e.title);
   end if;
  end loop;
 end if;return coalesce(new,old);
end $$;
revoke all on function svoya_private.club_notifications() from public,anon,authenticated;
create trigger svoya_notify_memberships after insert or update or delete on public.svoya_memberships for each row execute function svoya_private.club_notifications();
create trigger svoya_notify_requests after insert or update on public.svoya_requests for each row execute function svoya_private.club_notifications();
create trigger svoya_notify_messages after insert on public.svoya_messages for each row execute function svoya_private.club_notifications();
create trigger svoya_notify_event_change after update on public.svoya_entries for each row execute function svoya_private.club_notifications();
-- Server-only atomic claim: concurrent webhook deliveries cannot send twice.
create function public.svoya_claim_push(p_id uuid) returns setof public.svoya_notifications language sql security invoker set search_path='' as $$
 update public.svoya_notifications set push_status='sending',push_attempts=push_attempts+1,push_retry_at=now()+interval '3 minutes'
 where id=p_id and read_at is null and push_attempts<5 and created_at>now()-interval '24 hours'
 and (push_status='pending' or (push_status='sending' and push_retry_at<now())) returning *;
$$;
revoke all on function public.svoya_claim_push(uuid) from public,anon,authenticated;
grant execute on function public.svoya_claim_push(uuid) to service_role;
create function svoya_private.enqueue_push(nid uuid) returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 select webhook_secret into secret from public.svoya_push_config where id=true;
 if secret is not null then perform net.http_post(url:='https://pqasdmiqnlyyjwmmqeyc.supabase.co/functions/v1/svoya-push',headers:=jsonb_build_object('Content-Type','application/json','X-Svoya-Webhook',secret),body:=jsonb_build_object('notification_id',nid),timeout_milliseconds:=10000);end if;
end $$;
revoke all on function svoya_private.enqueue_push(uuid) from public,anon,authenticated;
create function svoya_private.push_new_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.svoya_push_subscriptions where user_id=new.user_id) then perform svoya_private.enqueue_push(new.id);
 else update public.svoya_notifications set push_status='none' where id=new.id;end if;return new;
end $$;
revoke all on function svoya_private.push_new_notification() from public,anon,authenticated;
create trigger svoya_push_new after insert on public.svoya_notifications for each row execute function svoya_private.push_new_notification();
-- Retry transport failures, without affecting durable in-app notifications.
select cron.schedule('svoya-push-retry','* * * * *', $job$
 select svoya_private.enqueue_push(id) from public.svoya_notifications where push_status in ('pending','sending') and push_retry_at<now() and push_attempts<5 and read_at is null and created_at>now()-interval '24 hours' order by created_at limit 20;
$job$);
