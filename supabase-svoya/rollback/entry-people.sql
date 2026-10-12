-- Removes only the read-only roster feature. No rows or existing policies change.
begin;
drop function if exists public.svoya_entry_people(uuid[]);
drop function if exists svoya_private.entry_people(uuid[]);
commit;
