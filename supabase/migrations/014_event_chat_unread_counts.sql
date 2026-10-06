-- Return per-chat unread counts in one access-controlled query for the chat list.
create or replace function public.get_accessible_event_chat_unread_counts()
returns table (
  event_chat_id uuid,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    chat.id,
    count(message.id)
  from public.event_chats chat
  join public.events event on event.id = chat.event_id
  left join public.event_chat_read_state read_state
    on read_state.event_chat_id = chat.id
   and read_state.user_id = auth.uid()
  left join public.event_chat_messages message
    on message.event_chat_id = chat.id
   and message.sender_id <> auth.uid()
   and message.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
  where auth.uid() is not null
    and (
      event.organizer_id = auth.uid()
      or exists (
        select 1
        from public.event_participants participant
        where participant.event_id = event.id
          and participant.user_id = auth.uid()
          and participant.status = 'joined'
      )
    )
  group by chat.id;
$$;

revoke all on function public.get_accessible_event_chat_unread_counts() from public;
revoke all on function public.get_accessible_event_chat_unread_counts() from anon;
grant execute on function public.get_accessible_event_chat_unread_counts() to authenticated;

notify pgrst, 'reload schema';
