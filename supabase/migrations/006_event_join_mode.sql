-- Limbo: minimal event type and approval-mode support.
-- Existing events remain public-type/open-join; existing participant rows keep their status.

alter table public.events
  add column if not exists event_type text not null default 'public';

alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check
  check (event_type in ('personal', 'public'));

alter table public.events
  add column if not exists join_mode text not null default 'open';

alter table public.events
  drop constraint if exists events_join_mode_check;

alter table public.events
  add constraint events_join_mode_check
  check (join_mode in ('open', 'approval'));

alter table public.event_participants
  drop constraint if exists event_participants_status_check;

alter table public.event_participants
  add constraint event_participants_status_check
  check (status in ('pending', 'joined', 'left', 'rejected'));

-- Joined participants can keep seeing one another. Pending/rejected requests
-- are visible only to their owner and the event organizer.
drop policy if exists "ep_select" on public.event_participants;
create policy "ep_select"
  on public.event_participants for select
  using (
    auth.uid() is not null
    and (
      user_id = auth.uid()
      or (status = 'joined' and public.is_event_participant(event_id))
      or exists (
        select 1 from public.events e
        where e.id = event_id and e.organizer_id = auth.uid()
      )
    )
  );

-- A user may insert only their own participant row, with the state dictated
-- by the event's configured join mode. Organizer rows still come from the
-- security-definer trigger.
drop policy if exists "ep_insert" on public.event_participants;
create policy "ep_insert"
  on public.event_participants for insert
  with check (
    auth.uid() = user_id
    and role = 'participant'
    and status = (
      select case when e.join_mode = 'approval' then 'pending' else 'joined' end
      from public.events e
      where e.id = event_id
    )
  );

-- Participants can leave or resubmit using the event's expected self-service
-- state, but cannot approve their own pending request.
drop policy if exists "ep_update_own" on public.event_participants;
create policy "ep_update_own"
  on public.event_participants for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and role = 'participant'
    and (
      status = 'left'
      or status = (
        select case when e.join_mode = 'approval' then 'pending' else 'joined' end
        from public.events e
        where e.id = event_id
      )
    )
  );

notify pgrst, 'reload schema';
