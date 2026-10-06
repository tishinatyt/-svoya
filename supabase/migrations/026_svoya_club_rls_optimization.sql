-- Optimize SVOYA club RLS policies and comment lookups.

create index if not exists club_post_comments_author_idx
  on public.club_post_comments(author_id, created_at desc);

drop policy if exists club_posts_select_authenticated on public.club_posts;
create policy club_posts_select_authenticated
on public.club_posts
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (status = 'active' or author_id = (select auth.uid()))
);

drop policy if exists club_posts_insert_own on public.club_posts;
create policy club_posts_insert_own
on public.club_posts
for insert
to authenticated
with check ((select auth.uid()) is not null and author_id = (select auth.uid()));

drop policy if exists club_posts_update_own on public.club_posts;
create policy club_posts_update_own
on public.club_posts
for update
to authenticated
using ((select auth.uid()) is not null and author_id = (select auth.uid()))
with check ((select auth.uid()) is not null and author_id = (select auth.uid()));

drop policy if exists club_posts_delete_own on public.club_posts;
create policy club_posts_delete_own
on public.club_posts
for delete
to authenticated
using ((select auth.uid()) is not null and author_id = (select auth.uid()));

drop policy if exists club_post_comments_select_authenticated on public.club_post_comments;
create policy club_post_comments_select_authenticated
on public.club_post_comments
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists club_post_comments_insert_own on public.club_post_comments;
create policy club_post_comments_insert_own
on public.club_post_comments
for insert
to authenticated
with check ((select auth.uid()) is not null and author_id = (select auth.uid()));

drop policy if exists club_post_comments_update_own on public.club_post_comments;
create policy club_post_comments_update_own
on public.club_post_comments
for update
to authenticated
using ((select auth.uid()) is not null and author_id = (select auth.uid()))
with check ((select auth.uid()) is not null and author_id = (select auth.uid()));

drop policy if exists club_post_comments_delete_own on public.club_post_comments;
create policy club_post_comments_delete_own
on public.club_post_comments
for delete
to authenticated
using ((select auth.uid()) is not null and author_id = (select auth.uid()));
