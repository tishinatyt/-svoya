-- Anonymous onboarding asks only for a name and required avatar.
-- Age and gender remain available as optional profile fields without fabricated defaults.

alter table public.users
  alter column age drop not null,
  alter column gender drop not null;

notify pgrst, 'reload schema';
