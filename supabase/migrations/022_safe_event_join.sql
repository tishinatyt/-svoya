create or replace function public.join_event(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organizer_id uuid;
  v_is_public boolean;
  v_status text;
  v_event_datetime timestamptz;
  v_join_mode text;
  v_max_participants integer;
  v_current_status text;
  v_joined_count integer;
  v_next_status text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select organizer_id, is_public, status, event_datetime, join_mode, max_participants
    into v_organizer_id, v_is_public, v_status, v_event_datetime, v_join_mode, v_max_participants
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'event_not_found';
  end if;

  if v_organizer_id = v_user_id then
    return 'joined';
  end if;

  if not v_is_public then
    raise exception using errcode = '42501', message = 'private_event';
  end if;

  if v_status not in ('upcoming', 'active') or v_event_datetime <= now() then
    raise exception using errcode = '22023', message = 'event_unavailable';
  end if;

  select status
    into v_current_status
  from public.event_participants
  where event_id = p_event_id
    and user_id = v_user_id
    and role = 'participant'
  for update;

  if found then
    if v_current_status = 'joined' then return 'joined'; end if;
    if v_current_status = 'pending' then return 'pending'; end if;
    if v_current_status = 'rejected' then
      raise exception using errcode = '42501', message = 'request_rejected';
    end if;
  end if;

  select count(*)::int
    into v_joined_count
  from public.event_participants
  where event_id = p_event_id
    and status = 'joined';

  if v_joined_count >= v_max_participants then
    raise exception using errcode = 'P0001', message = 'event_full';
  end if;

  v_next_status := case when coalesce(v_join_mode, 'open') = 'approval' then 'pending' else 'joined' end;

  insert into public.event_participants (event_id, user_id, role, status, joined_at)
  values (p_event_id, v_user_id, 'participant', v_next_status, now())
  on conflict (event_id, user_id) do update
    set role = 'participant',
        status = excluded.status,
        joined_at = now();

  return v_next_status;
end;
$$;

revoke all on function public.join_event(uuid) from public, anon;
grant execute on function public.join_event(uuid) to authenticated, service_role;
