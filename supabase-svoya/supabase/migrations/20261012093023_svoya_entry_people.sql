-- A minimal roster for club cards. Keep application rows and greeter needs private.
-- Privileged lookup is isolated in the non-exposed schema and identity-bound.
create function svoya_private.entry_people(entry_ids uuid[])
returns table(entry_id uuid, user_id uuid, name text, photo_paths text[], is_host boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not svoya_private.is_active() then return; end if;
  if coalesce(cardinality(entry_ids), 0) > 100 then raise exception 'SV_TOO_MANY_ENTRIES'; end if;
  return query
  with visible as (
    select e.id, e.owner_id from public.svoya_entries e
    where e.id = any(entry_ids) and not e.is_demo and e.kind in ('event', 'circle')
      and svoya_private.owner_visible(e.owner_id) and not svoya_private.blocked(e.owner_id)
      and ((e.status = 'published' and (e.expires_at is null or e.expires_at > now()))
        or e.owner_id = auth.uid()
        or exists(select 1 from public.svoya_memberships own where own.entry_id = e.id and own.user_id = auth.uid() and own.status = 'joined'))
  ), roster as (
    select e.id as entry_id, e.owner_id as user_id, true as is_host from visible e
    union all
    select e.id, m.user_id, false from visible e
      join public.svoya_memberships m on m.entry_id = e.id
      where m.status = 'joined' and m.user_id <> e.owner_id
  )
  select r.entry_id, p.id, p.name, p.photo_paths[1:1], r.is_host
  from roster r join public.svoya_profiles p on p.id = r.user_id
  where p.membership_status = 'approved' and not svoya_private.blocked(p.id);
end;
$$;
revoke all on function svoya_private.entry_people(uuid[]) from public, anon, authenticated;
grant execute on function svoya_private.entry_people(uuid[]) to authenticated;

create function public.svoya_entry_people(entry_ids uuid[])
returns table(entry_id uuid, user_id uuid, name text, photo_paths text[], is_host boolean)
language sql stable security invoker set search_path = '' as $$
  select * from svoya_private.entry_people(entry_ids);
$$;
revoke all on function public.svoya_entry_people(uuid[]) from public, anon, authenticated;
grant execute on function public.svoya_entry_people(uuid[]) to authenticated;
