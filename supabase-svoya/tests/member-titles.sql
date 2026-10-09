begin;
do $test$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];i integer;n integer;result jsonb;
begin
 for i in 1..3 loop
  insert into auth.users(id,email_confirmed_at,is_anonymous) values(ids[i],now(),false);
  insert into storage.objects(bucket_id,name,owner_id) values('svoya-profile-photos',ids[i]::text||'/fixture.webp',ids[i]::text);
  insert into public.svoya_profiles(id,name,photo_paths,membership_status) values(ids[i],'Title Fixture',array[ids[i]::text||'/fixture.webp'],case when i=3 then 'pending' else 'approved' end);
 end loop;
 insert into public.svoya_admins(user_id) values(ids[1]);
 if has_function_privilege('anon','public.svoya_set_member_title(uuid,text,text,text)','EXECUTE') then raise exception 'GUEST_TITLE_RPC';end if;
 if has_column_privilege('authenticated','public.svoya_profiles','member_title','UPDATE') or has_column_privilege('authenticated','public.svoya_profiles','member_title','INSERT') then raise exception 'CLIENT_TITLE_GRANT';end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[2],'role','authenticated','is_anonymous',false,'user_metadata',jsonb_build_object('admin',true))::text,true);
 execute 'set local role authenticated';
 begin
  perform public.svoya_set_member_title(ids[2],'ambassador','svoya','Attempted self award');
  raise exception 'NON_ADMIN_AWARDED';
 exception when others then if sqlerrm<>'SV_ADMIN_ONLY' then raise;end if;end;
 begin update public.svoya_profiles set member_title='ambassador' where id=ids[2];raise exception 'DIRECT_TITLE_UPDATE';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.svoya_moderation_log) then raise exception 'PRIVATE_NOTES_LEAK';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 execute 'set local role authenticated';
 begin perform public.svoya_set_member_title(ids[3],'active','svoya','Verified contribution');raise exception 'PENDING_AWARDED';exception when others then if sqlerrm<>'SV_TITLE_APPROVAL' then raise;end if;end;
 begin perform public.svoya_set_member_title(ids[2],'administrator','svoya','Verified contribution');raise exception 'INVALID_TITLE';exception when others then if sqlerrm<>'SV_TITLE_INVALID' then raise;end if;end;
 begin perform public.svoya_set_member_title(ids[2],'active','svoya','short');raise exception 'NO_REASON';exception when others then if sqlerrm<>'SV_TITLE_REASON' then raise;end if;end;
 perform public.svoya_set_member_title(ids[2],'active','svoya','Three verified meetings');
 if not exists(select 1 from public.svoya_profiles where id=ids[2] and member_title='active' and member_title_updated_at is not null and membership_status='approved') then raise exception 'AWARD_NOT_SAVED';end if;
 if not exists(select 1 from public.svoya_moderation_log where target_id=ids[2] and admin_id=ids[1] and action='member_title:svoya:active' and note='Three verified meetings') then raise exception 'NO_AUDIT';end if;
 begin perform public.svoya_set_member_title(ids[2],'ambassador','svoya','Stale moderator decision');raise exception 'LOST_UPDATE';exception when others then if sqlerrm<>'SV_TITLE_CONFLICT' then raise;end if;end;
 result:=public.svoya_set_member_title(ids[2],'active','active','Repeated moderator decision');
 if (result->>'changed')::boolean then raise exception 'REPEAT_NOT_IDEMPOTENT';end if;
 select count(*) into n from public.svoya_moderation_log where target_id=ids[2];if n<>1 then raise exception 'DUPLICATE_AUDIT';end if;
 perform public.svoya_set_member_title(ids[2],'svoya','active','Award withdrawn after review');
 execute 'reset role';
 if exists(select 1 from public.svoya_admins where user_id=ids[2]) then raise exception 'TITLE_GRANTED_ADMIN';end if;
 if (select count(*) from public.svoya_notifications where user_id=ids[2] and kind='moderation')<>2 then raise exception 'NOTIFICATION_COUNT';end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);execute 'set local role authenticated';
 if exists(select 1 from public.svoya_moderation_log where target_id=ids[2]) then raise exception 'MEMBER_READ_PRIVATE_NOTES';end if;
 execute 'reset role';
end $test$;
rollback;
select 'PASS: titles admin-only, no forged metadata, no direct writes, approved profiles only, valid title/reason, audit, notifications, idempotence, concurrent edit protection, no privilege escalation' as result;
