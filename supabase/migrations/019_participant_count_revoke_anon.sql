revoke all on function public.event_participant_count(uuid) from anon;

notify pgrst, 'reload schema';
