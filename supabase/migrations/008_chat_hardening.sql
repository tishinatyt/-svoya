-- Make organizer chat access explicit while preserving joined-only participant access.

create or replace function public.is_event_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (
      select 1
      from public.events
      where id = p_event_id
        and organizer_id = auth.uid()
    )
    or exists (
      select 1
      from public.event_participants
      where event_id = p_event_id
        and user_id = auth.uid()
        and status = 'joined'
    )
  )
$$;

revoke all on function public.is_event_participant(uuid) from public;
revoke all on function public.is_event_participant(uuid) from anon;
grant execute on function public.is_event_participant(uuid) to authenticated;

-- One indexed query for the conversation list, avoiding a message query per event.
create or replace function public.get_accessible_event_chats()
returns table (
  event_id uuid,
  event_title text,
  category text,
  address_text text,
  cover_photo_url text,
  event_datetime timestamptz,
  event_status text,
  member_role text,
  chat_id uuid,
  last_message text,
  last_message_at timestamptz,
  last_sender_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.title,
    e.category,
    e.address_text,
    e.cover_photo_url,
    e.event_datetime,
    e.status,
    case when e.organizer_id = auth.uid() then 'organizer' else 'participant' end,
    ec.id,
    latest.content,
    latest.created_at,
    sender.name
  from public.events e
  join public.event_chats ec on ec.event_id = e.id
  left join lateral (
    select m.content, m.created_at, m.sender_id
    from public.event_chat_messages m
    where m.event_chat_id = ec.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  left join public.users sender on sender.id = latest.sender_id
  where auth.uid() is not null
    and (
      e.organizer_id = auth.uid()
      or exists (
        select 1
        from public.event_participants ep
        where ep.event_id = e.id
          and ep.user_id = auth.uid()
          and ep.status = 'joined'
      )
    )
  order by coalesce(latest.created_at, e.event_datetime) desc;
$$;

revoke all on function public.get_accessible_event_chats() from public;
revoke all on function public.get_accessible_event_chats() from anon;
grant execute on function public.get_accessible_event_chats() to authenticated;

notify pgrst, 'reload schema';
