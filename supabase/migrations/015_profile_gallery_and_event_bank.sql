-- Profile galleries and the personal-event bank prototype.
-- Additive only; apply manually to the linked Supabase project.

alter table public.users
  add column if not exists profile_photos text[] not null default '{}'::text[];

alter table public.users
  drop constraint if exists users_profile_photos_max_six;
alter table public.users
  add constraint users_profile_photos_max_six
  check (cardinality(profile_photos) <= 6);

alter table public.events
  add column if not exists bank_enabled boolean not null default false,
  add column if not exists bank_note text;

alter table public.events
  drop constraint if exists events_bank_personal_only;
alter table public.events
  add constraint events_bank_personal_only
  check (not bank_enabled or event_type = 'personal');

alter table public.events
  drop constraint if exists events_bank_note_length;
alter table public.events
  add constraint events_bank_note_length
  check (bank_note is null or char_length(bank_note) <= 200);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

notify pgrst, 'reload schema';
