-- Harden the currently used discovery/event helper RPCs without changing app behavior.
-- Anonymous Supabase users are signed in as the authenticated PostgREST role, so
-- revoking the pre-auth `anon` role here does not break Poruch onboarding.

alter function public.events_nearby(double precision, double precision, double precision, text)
  set search_path = pg_catalog, public;
revoke all on function public.events_nearby(double precision, double precision, double precision, text) from anon;
grant execute on function public.events_nearby(double precision, double precision, double precision, text) to authenticated, service_role;

alter function public.get_event_coords(uuid)
  set search_path = pg_catalog, public;
revoke all on function public.get_event_coords(uuid) from anon;
grant execute on function public.get_event_coords(uuid) to authenticated, service_role;

alter function public.event_chat_event_id(uuid)
  set search_path = pg_catalog, public;
revoke all on function public.event_chat_event_id(uuid) from anon;
grant execute on function public.event_chat_event_id(uuid) to authenticated, service_role;

alter function public.activities_nearby(double precision, double precision, double precision, text, integer, integer)
  set search_path = pg_catalog, public;
revoke all on function public.activities_nearby(double precision, double precision, double precision, text, integer, integer) from anon;

alter function public.events_point(double precision, double precision)
  set search_path = pg_catalog, public;

-- These are trigger-only functions. Keep them executable by the database owner/
-- service role but remove direct client execution.
alter function public.add_organizer_as_participant()
  set search_path = pg_catalog, public;
revoke all on function public.add_organizer_as_participant() from public, anon, authenticated;

alter function public.create_event_chat()
  set search_path = pg_catalog, public;
revoke all on function public.create_event_chat() from public, anon, authenticated;

notify pgrst, 'reload schema';
