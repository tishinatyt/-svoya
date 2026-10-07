-- Preserve access to one's own past bookings without exposing participant identities.
create function svoya_private.has_entry_access(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.svoya_memberships where entry_id=target and user_id=auth.uid()) or exists(select 1 from public.svoya_requests where entry_id=target and user_id=auth.uid())
$$;
revoke all on function svoya_private.has_entry_access(uuid) from public;
grant execute on function svoya_private.has_entry_access(uuid) to anon,authenticated;
alter policy svoya_entry_read on public.svoya_entries using(owner_id=(select auth.uid()) or (select svoya_private.is_admin()) or (svoya_private.has_entry_access(id) and not svoya_private.blocked(owner_id)) or (status='published' and (expires_at is null or expires_at>now()) and (is_demo or svoya_private.owner_visible(owner_id)) and not svoya_private.blocked(owner_id)));
create policy svoya_chat_open_insert on public.svoya_messages as restrictive for insert to authenticated with check(exists(select 1 from public.svoya_entries e where e.id=entry_id and (e.expires_at is null or e.expires_at>now()) and svoya_private.owner_visible(e.owner_id) and not svoya_private.blocked(e.owner_id)));
create policy svoya_requests_contact_allowed on public.svoya_requests as restrictive for insert to authenticated with check(exists(select 1 from public.svoya_entries e where e.id=entry_id and svoya_private.owner_visible(e.owner_id) and not svoya_private.blocked(e.owner_id)));
alter policy svoya_friends_read on public.svoya_friendships using((from_id=(select auth.uid()) or to_id=(select auth.uid())) and (select svoya_private.is_active()) and svoya_private.owner_visible(case when from_id=(select auth.uid()) then to_id else from_id end) and not svoya_private.blocked(case when from_id=(select auth.uid()) then to_id else from_id end));
create function svoya_private.validate_plan() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' and new.format='quick' and (new.starts_at<=now() or new.starts_at>now()+interval '24 hours') then raise exception 'SV_QUICK_TIME';end if;
 if tg_op='UPDATE' and new.capacity<old.capacity and (select count(*) from public.svoya_memberships where entry_id=new.id and status='joined')>new.capacity then raise exception 'SV_FULL';end if;
 return new;
end $$;
revoke all on function svoya_private.validate_plan() from public,anon,authenticated;
create trigger svoya_plan_valid before insert or update on public.svoya_entries for each row execute function svoya_private.validate_plan();
