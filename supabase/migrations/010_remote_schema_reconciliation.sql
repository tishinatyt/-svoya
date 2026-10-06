-- Limbo hosted-schema reconciliation.
-- Additive and seed-free: preserves all legacy tables and application data.

-- Migration 009 creates the canonical authenticated profile policies. Remove
-- the manually-created permissive policies whose names differ from migration
-- history, otherwise PostgreSQL would OR them with the canonical policies.
drop policy if exists "Users can read all users" on public.users;
drop policy if exists "Users can update own profile" on public.users;

-- Reconcile only the avatars bucket configuration from migration 002. The
-- historical migration also contains test users and seed data, so it must not
-- be executed against the hosted project.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Canonical avatar object policies. Frontend uploads use object keys under
-- <auth.uid()>/..., matching the owner check below.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_upload" on storage.objects;
create policy "avatars_owner_upload"
  on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Preserve the legacy match chat while closing its sender-only INSERT policy.
-- A sender must be authenticated as themselves and belong to the referenced
-- match. Current Limbo event chat policies remain untouched.
drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages"
  on public.messages
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.matches m
      where m.id = match_id
        and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
  );

notify pgrst, 'reload schema';
