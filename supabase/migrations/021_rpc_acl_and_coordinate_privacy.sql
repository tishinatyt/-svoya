-- Remove inherited PUBLIC execution grants and tighten coordinate access.

revoke all on function public.events_nearby(double precision, double precision, double precision, text) from public, anon;
grant execute on function public.events_nearby(double precision, double precision, double precision, text) to authenticated, service_role;

create or replace function public.get_event_coords(p_event_id uuid)
returns table (lat float8, lng float8)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    st_y(event.location::geometry)::float8 as lat,
    st_x(event.location::geometry)::float8 as lng
  from public.events event
  where event.id = p_event_id
    and auth.uid() is not null
    and (
      event.is_public = true
      or event.organizer_id = auth.uid()
      or exists (
        select 1
        from public.event_participants participant
        where participant.event_id = event.id
          and participant.user_id = auth.uid()
          and participant.status = 'joined'
      )
    )
$$;
revoke all on function public.get_event_coords(uuid) from public, anon;
grant execute on function public.get_event_coords(uuid) to authenticated, service_role;

revoke all on function public.event_chat_event_id(uuid) from public, anon;
grant execute on function public.event_chat_event_id(uuid) to authenticated, service_role;

-- Legacy discovery RPC is no longer used by the current application. Keep it
-- available only to trusted server-side callers rather than exposing a
-- SECURITY DEFINER profile/location query to clients.
revoke all on function public.activities_nearby(double precision, double precision, double precision, text, integer, integer) from public, anon, authenticated;
grant execute on function public.activities_nearby(double precision, double precision, double precision, text, integer, integer) to service_role;

-- SQL/seed helper; the web client writes geography values directly.
revoke all on function public.events_point(double precision, double precision) from public, anon, authenticated;
grant execute on function public.events_point(double precision, double precision) to service_role;

notify pgrst, 'reload schema';
