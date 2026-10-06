-- Secure organizer review and participant leave operations.

create or replace function public.review_event_join_request(
  p_event_id uuid,
  p_user_id uuid,
  p_decision text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organizer_id uuid;
  v_join_mode text;
  v_max_participants integer;
  v_current_status text;
  v_joined_count integer;
  v_next_status text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception using errcode = '22023', message = 'invalid_decision';
  end if;

  select organizer_id, join_mode, max_participants
    into v_organizer_id, v_join_mode, v_max_participants
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'event_not_found';
  end if;

  if v_organizer_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'organizer_only';
  end if;

  if coalesce(v_join_mode, 'open') <> 'approval' then
    raise exception using errcode = '22023', message = 'approval_not_enabled';
  end if;

  select status
    into v_current_status
  from public.event_participants
  where event_id = p_event_id
    and user_id = p_user_id
    and role = 'participant'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'request_not_found';
  end if;

  if v_current_status <> 'pending' then
    raise exception using errcode = '22023', message = 'invalid_status_transition';
  end if;

  if p_decision = 'approve' then
    select count(*)
      into v_joined_count
    from public.event_participants
    where event_id = p_event_id
      and status = 'joined';

    if v_joined_count >= v_max_participants then
      raise exception using errcode = 'P0001', message = 'event_full';
    end if;
    v_next_status := 'joined';
  else
    v_next_status := 'rejected';
  end if;

  update public.event_participants
  set status = v_next_status,
      joined_at = case when v_next_status = 'joined' then now() else joined_at end
  where event_id = p_event_id
    and user_id = p_user_id
    and role = 'participant'
    and status = 'pending';

  return v_next_status;
end;
$$;

create or replace function public.leave_event(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select status
    into v_current_status
  from public.event_participants
  where event_id = p_event_id
    and user_id = auth.uid()
    and role = 'participant'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'participation_not_found';
  end if;

  if v_current_status <> 'joined' then
    raise exception using errcode = '22023', message = 'invalid_status_transition';
  end if;

  update public.event_participants
  set status = 'left'
  where event_id = p_event_id
    and user_id = auth.uid()
    and role = 'participant'
    and status = 'joined';

  return 'left';
end;
$$;

revoke all on function public.review_event_join_request(uuid, uuid, text) from public;
revoke all on function public.review_event_join_request(uuid, uuid, text) from anon;
grant execute on function public.review_event_join_request(uuid, uuid, text) to authenticated;

revoke all on function public.leave_event(uuid) from public;
revoke all on function public.leave_event(uuid) from anon;
grant execute on function public.leave_event(uuid) to authenticated;
