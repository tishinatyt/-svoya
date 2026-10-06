create policy "events_select_organizer"
on public.events
for select
to authenticated
using (auth.uid() = organizer_id);

notify pgrst, 'reload schema';
