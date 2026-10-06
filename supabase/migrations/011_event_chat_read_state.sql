-- Per-user chat read positions allow reliable unread counts for group chats.
create table public.event_chat_read_state (
  event_chat_id uuid not null references public.event_chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (event_chat_id, user_id)
);

create index event_chat_read_state_user_id_idx
  on public.event_chat_read_state (user_id);

alter table public.event_chat_read_state enable row level security;

revoke all on table public.event_chat_read_state from anon;
grant select, insert, update on table public.event_chat_read_state to authenticated;

create policy "Users can read their own accessible chat state"
  on public.event_chat_read_state for select
  using (
    auth.uid() = user_id
    and public.is_event_participant(public.event_chat_event_id(event_chat_id))
  );

create policy "Users can create their own accessible chat state"
  on public.event_chat_read_state for insert
  with check (
    auth.uid() = user_id
    and public.is_event_participant(public.event_chat_event_id(event_chat_id))
  );

create policy "Users can update their own accessible chat state"
  on public.event_chat_read_state for update
  using (
    auth.uid() = user_id
    and public.is_event_participant(public.event_chat_event_id(event_chat_id))
  )
  with check (
    auth.uid() = user_id
    and public.is_event_participant(public.event_chat_event_id(event_chat_id))
  );

create or replace function public.get_unread_event_chat_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.event_chat_messages message
  join public.event_chats chat on chat.id = message.event_chat_id
  left join public.event_chat_read_state read_state
    on read_state.event_chat_id = chat.id
   and read_state.user_id = auth.uid()
  where auth.uid() is not null
    and message.sender_id <> auth.uid()
    and message.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
    and public.is_event_participant(chat.event_id);
$$;

revoke all on function public.get_unread_event_chat_count() from public;
revoke all on function public.get_unread_event_chat_count() from anon;
grant execute on function public.get_unread_event_chat_count() to authenticated;

create or replace function public.mark_event_chat_read(
  p_event_chat_id uuid,
  p_read_through timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  effective_read_at timestamptz := least(coalesce(p_read_through, now()), now());
begin
  if auth.uid() is null or not exists (
    select 1
    from public.event_chats chat
    where chat.id = p_event_chat_id
      and public.is_event_participant(chat.event_id)
  ) then
    raise exception 'Chat is not accessible';
  end if;

  insert into public.event_chat_read_state (event_chat_id, user_id, last_read_at)
  values (p_event_chat_id, auth.uid(), effective_read_at)
  on conflict (event_chat_id, user_id) do update
    set last_read_at = greatest(public.event_chat_read_state.last_read_at, excluded.last_read_at);
end;
$$;

revoke all on function public.mark_event_chat_read(uuid, timestamptz) from public;
revoke all on function public.mark_event_chat_read(uuid, timestamptz) from anon;
grant execute on function public.mark_event_chat_read(uuid, timestamptz) to authenticated;

alter publication supabase_realtime add table public.event_chat_read_state;

notify pgrst, 'reload schema';
