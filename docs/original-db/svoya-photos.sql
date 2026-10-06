-- Profile galleries: first path is the avatar. Existing profiles remain readable
-- and must add a photo the next time they save or participate.
alter table public.svoya_profiles add column photo_paths text[] not null default '{}';
alter table public.svoya_profiles add constraint svoya_photo_limit check(cardinality(photo_paths)<=10);
grant update(photo_paths) on public.svoya_profiles to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('svoya-profile-photos','svoya-profile-photos',false,6291456,array['image/jpeg','image/png','image/webp']);
create policy svoya_photo_read on storage.objects for select to authenticated
using(bucket_id='svoya-profile-photos' and ((storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.svoya_profiles p where storage.objects.name=any(p.photo_paths))));
create policy svoya_photo_upload on storage.objects for insert to authenticated
with check(bucket_id='svoya-profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and array_length(storage.foldername(name),1)=1 and storage.extension(name) in ('jpg','jpeg','png','webp'));
-- Immutable object names: replace a photo by uploading a new object, save the
-- new gallery, then remove unreferenced objects. Never delete a live avatar.
create policy svoya_photo_delete on storage.objects for delete to authenticated
using(bucket_id='svoya-profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.svoya_profiles p where storage.objects.name=any(p.photo_paths)));
create function public.svoya_validate_profile_photos() returns trigger
language plpgsql security invoker set search_path='' as $$
declare photo text;
begin
 if cardinality(new.photo_paths)<1 or cardinality(new.photo_paths)>10 then raise exception 'SV_PHOTOS_REQUIRED'; end if;
 if cardinality(new.photo_paths)<>(select count(distinct x) from unnest(new.photo_paths) x) then raise exception 'SV_PHOTOS_DUPLICATE'; end if;
 foreach photo in array new.photo_paths loop
  if photo is null or split_part(photo,'/',1)<>new.id::text or not exists(
   select 1 from storage.objects o where o.bucket_id='svoya-profile-photos' and o.name=photo
  ) then raise exception 'SV_PHOTO_INVALID'; end if;
 end loop;
 return new;
end $$;
revoke all on function public.svoya_validate_profile_photos() from public,anon,authenticated;
create trigger svoya_profile_photos_required before insert or update on public.svoya_profiles
for each row execute function public.svoya_validate_profile_photos();
create policy svoya_entry_photo_required on public.svoya_entries as restrictive for insert to authenticated
with check(exists(select 1 from public.svoya_profiles p where p.id=(select auth.uid()) and cardinality(p.photo_paths)>0));
create policy svoya_member_photo_required on public.svoya_memberships as restrictive for insert to authenticated
with check(exists(select 1 from public.svoya_profiles p where p.id=(select auth.uid()) and cardinality(p.photo_paths)>0));
create policy svoya_request_photo_required on public.svoya_requests as restrictive for insert to authenticated
with check(exists(select 1 from public.svoya_profiles p where p.id=(select auth.uid()) and cardinality(p.photo_paths)>0));
