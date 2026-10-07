-- Evaluate caller JWT once per statement; preserve existing anonymous account upgrades.
alter policy svoya_profile_insert on public.svoya_profiles with check(id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
