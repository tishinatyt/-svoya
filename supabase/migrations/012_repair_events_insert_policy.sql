-- Restore the intended owner-only event creation rule explicitly for signed-in users.
-- RLS stays enabled; no SELECT, UPDATE, or DELETE policy is changed.

alter table public.events enable row level security;

drop policy if exists "events_insert" on public.events;

create policy "events_insert"
  on public.events
  for insert
  to authenticated
  with check (auth.uid() = organizer_id);

notify pgrst, 'reload schema';
