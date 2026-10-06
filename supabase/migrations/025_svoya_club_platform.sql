-- SVOYA club platform: persistent non-event publications and profile gallery capacity.

create table if not exists public.club_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  section text not null check (section in ('circle', 'beauty', 'business', 'help')),
  category text not null,
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 2 and 2000),
  city text,
  image_url text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_posts_section_created_idx
  on public.club_posts(section, created_at desc);

create index if not exists club_posts_author_idx
  on public.club_posts(author_id, created_at desc);

alter table public.club_posts enable row level security;

grant select, insert, update, delete on public.club_posts to authenticated;

drop policy if exists club_posts_select_authenticated on public.club_posts;
create policy club_posts_select_authenticated
on public.club_posts
for select
to authenticated
using (
  auth.uid() is not null
  and (status = 'active' or author_id = auth.uid())
);

drop policy if exists club_posts_insert_own on public.club_posts;
create policy club_posts_insert_own
on public.club_posts
for insert
to authenticated
with check (auth.uid() is not null and author_id = auth.uid());

drop policy if exists club_posts_update_own on public.club_posts;
create policy club_posts_update_own
on public.club_posts
for update
to authenticated
using (auth.uid() is not null and author_id = auth.uid())
with check (auth.uid() is not null and author_id = auth.uid());

drop policy if exists club_posts_delete_own on public.club_posts;
create policy club_posts_delete_own
on public.club_posts
for delete
to authenticated
using (auth.uid() is not null and author_id = auth.uid());

create table if not exists public.club_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.club_posts(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists club_post_comments_post_created_idx
  on public.club_post_comments(post_id, created_at asc);

alter table public.club_post_comments enable row level security;

grant select, insert, update, delete on public.club_post_comments to authenticated;

drop policy if exists club_post_comments_select_authenticated on public.club_post_comments;
create policy club_post_comments_select_authenticated
on public.club_post_comments
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists club_post_comments_insert_own on public.club_post_comments;
create policy club_post_comments_insert_own
on public.club_post_comments
for insert
to authenticated
with check (auth.uid() is not null and author_id = auth.uid());

drop policy if exists club_post_comments_update_own on public.club_post_comments;
create policy club_post_comments_update_own
on public.club_post_comments
for update
to authenticated
using (auth.uid() is not null and author_id = auth.uid())
with check (auth.uid() is not null and author_id = auth.uid());

drop policy if exists club_post_comments_delete_own on public.club_post_comments;
create policy club_post_comments_delete_own
on public.club_post_comments
for delete
to authenticated
using (auth.uid() is not null and author_id = auth.uid());

alter table public.users
  drop constraint if exists users_profile_photos_max_six;

alter table public.users
  drop constraint if exists users_profile_photos_max_ten;

alter table public.users
  add constraint users_profile_photos_max_ten
  check (cardinality(profile_photos) <= 10);
