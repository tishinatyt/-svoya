-- Let authenticated viewers see an aggregate joined count for discoverable
-- public events without exposing participant rows or identities through RLS.

create or replace function public.event_participant_count(p_event_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 0
    else count(participant.*)::int
  end
  from public.events event
  left join public.event_participants participant
    on participant.event_id = event.id
   and participant.status = 'joined'
  where event.id = p_event_id
    and (
      event.is_public = true
      or event.organizer_id = auth.uid()
      or exists (
        select 1
        from public.event_participants own_membership
        where own_membership.event_id = event.id
          and own_membership.user_id = auth.uid()
          and own_membership.status = 'joined'
      )
    )
$$;

revoke all on function public.event_participant_count(uuid) from public;
grant execute on function public.event_participant_count(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
