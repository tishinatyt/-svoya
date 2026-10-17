-- Additive SVOYA-only change. Apply to production only after separate approval.
create table public.svoya_lounge_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.svoya_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now()
);
create index svoya_lounge_messages_time on public.svoya_lounge_messages(created_at desc, id desc);
create index svoya_lounge_messages_author on public.svoya_lounge_messages(user_id);
alter table public.svoya_lounge_messages enable row level security;
revoke all on public.svoya_lounge_messages from public, anon, authenticated;
grant select, delete on public.svoya_lounge_messages to authenticated;
-- The server supplies the timestamp; a client cannot move a post to the future.
grant insert(id, user_id, body) on public.svoya_lounge_messages to authenticated;
create policy svoya_lounge_read on public.svoya_lounge_messages for select to authenticated
using ((select svoya_private.is_active()) and not svoya_private.blocked(user_id) and svoya_private.owner_visible(user_id));
create policy svoya_lounge_insert on public.svoya_lounge_messages for insert to authenticated
with check ((select svoya_private.is_active()) and user_id = (select auth.uid()));
create policy svoya_lounge_delete on public.svoya_lounge_messages for delete to authenticated
using ((select svoya_private.is_active()) and (user_id = (select auth.uid()) or (select svoya_private.is_admin())));
comment on table public.svoya_lounge_messages is 'Теревеньки — спільний чат схвалених учасниць СВОЯ, незалежно від міста.';
