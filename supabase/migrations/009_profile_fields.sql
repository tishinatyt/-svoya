-- Public social profile fields used in event participation context.

alter table public.users
  add column if not exists city text,
  add column if not exists bio text,
  add column if not exists interests text[] not null default '{}'::text[];

alter table public.users
  drop constraint if exists users_city_length_check,
  add constraint users_city_length_check check (city is null or char_length(city) <= 80),
  drop constraint if exists users_bio_length_check,
  add constraint users_bio_length_check check (bio is null or char_length(bio) <= 300),
  drop constraint if exists users_interests_count_check,
  add constraint users_interests_count_check check (cardinality(interests) <= 8);

-- The table contains social profile data only. Keep it available to signed-in
-- Limbo users, but stop anonymous profile enumeration.
drop policy if exists "users_select" on public.users;
create policy "users_select_authenticated"
  on public.users for select
  using (auth.uid() is not null);

drop policy if exists "users_update" on public.users;
create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

notify pgrst, 'reload schema';
