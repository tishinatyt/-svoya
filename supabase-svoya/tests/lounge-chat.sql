begin;
do $test$
declare
  ids uuid[] := array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  message_id uuid := gen_random_uuid(); i integer; n integer;
begin
  for i in 1..4 loop
    insert into auth.users(id,email_confirmed_at,is_anonymous) values(ids[i],now(),false);
    insert into storage.objects(bucket_id,name,owner_id) values('svoya-profile-photos',ids[i]::text||'/fixture.webp',ids[i]::text);
    insert into public.svoya_profiles(id,name,photo_paths,membership_status) values(ids[i],'Lounge fixture '||i,array[ids[i]::text||'/fixture.webp'],case when i=3 then 'pending' when i=4 then 'suspended' else 'approved' end);
  end loop;
  if has_table_privilege('anon','public.svoya_lounge_messages','SELECT') then raise exception 'GUEST_CHAT_ACCESS';end if;
  if has_column_privilege('authenticated','public.svoya_lounge_messages','created_at','INSERT') then raise exception 'FORGED_TIMESTAMP_GRANT';end if;
  if has_table_privilege('authenticated','public.svoya_lounge_messages','UPDATE') then raise exception 'MESSAGE_UPDATE_GRANT';end if;
  perform set_config('request.jwt.claim.sub',ids[1]::text,true);
  execute 'set local role authenticated';
  insert into public.svoya_lounge_messages(id,user_id,body) values(message_id,ids[1],'Привіт, свої!');
  begin insert into public.svoya_lounge_messages(user_id,body) values(ids[2],'Impersonation');raise exception 'FORGED_AUTHOR';exception when insufficient_privilege then null;end;
  begin insert into public.svoya_lounge_messages(user_id,body) values(ids[1],E' \n\t ');raise exception 'EMPTY_MESSAGE';exception when check_violation then null;end;
  begin insert into public.svoya_lounge_messages(user_id,body) values(ids[1],repeat('a',2001));raise exception 'LONG_MESSAGE';exception when check_violation then null;end;
  begin insert into public.svoya_lounge_messages(id,user_id,body) values(message_id,ids[1],'Duplicate');raise exception 'DUPLICATE_RETRY';exception when unique_violation then null;end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',ids[2]::text,true);
  execute 'set local role authenticated';
  if not exists(select 1 from public.svoya_lounge_messages where id=message_id) then raise exception 'APPROVED_CANNOT_READ';end if;
  delete from public.svoya_lounge_messages where id=message_id;
  get diagnostics n = row_count;if n<>0 then raise exception 'DELETED_OTHER_AUTHOR';end if;
  execute 'reset role';
  -- Pending and suspended accounts cannot read or write, even with forged metadata.
  for i in 3..4 loop
    perform set_config('request.jwt.claim.sub',ids[i]::text,true);
    perform set_config('request.jwt.claims','{"user_metadata":{"membership_status":"approved","role":"admin"}}',true);
    execute 'set local role authenticated';
    if exists(select 1 from public.svoya_lounge_messages) then raise exception 'INACTIVE_READ';end if;
    begin insert into public.svoya_lounge_messages(user_id,body) values(ids[i],'Unauthorized');raise exception 'INACTIVE_SENT';exception when insufficient_privilege then null;end;
    execute 'reset role';
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  execute 'set local role authenticated';
  if exists(select 1 from public.svoya_lounge_messages) then raise exception 'MISSING_IDENTITY_READ';end if;
  execute 'reset role';
  insert into public.svoya_blocks(blocker_id,blocked_id) values(ids[1],ids[2]);
  perform set_config('request.jwt.claim.sub',ids[2]::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from public.svoya_lounge_messages where id=message_id) then raise exception 'BLOCKED_READ';end if;
  execute 'reset role';
  delete from public.svoya_blocks where blocker_id=ids[1] and blocked_id=ids[2];
  insert into public.svoya_blocks(blocker_id,blocked_id) values(ids[2],ids[1]);
  execute 'set local role authenticated';
  if exists(select 1 from public.svoya_lounge_messages where id=message_id) then raise exception 'REVERSE_BLOCK_READ';end if;
  execute 'reset role';
  delete from public.svoya_blocks where blocker_id=ids[2] and blocked_id=ids[1];
  update public.svoya_profiles set membership_status='suspended' where id=ids[1];
  execute 'set local role authenticated';
  if exists(select 1 from public.svoya_lounge_messages where id=message_id) then raise exception 'SUSPENDED_AUTHOR_VISIBLE';end if;
  execute 'reset role';
  update public.svoya_profiles set membership_status='approved' where id=ids[1];
  insert into public.svoya_admins(user_id) values(ids[2]);
  execute 'set local role authenticated';
  delete from public.svoya_lounge_messages where id=message_id;
  get diagnostics n = row_count;if n<>1 then raise exception 'ADMIN_CANNOT_MODERATE';end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',ids[1]::text,true);
  execute 'set local role authenticated';
  insert into public.svoya_lounge_messages(id,user_id,body) values(message_id,ids[1],'Own message');
  delete from public.svoya_lounge_messages where id=message_id;
  get diagnostics n = row_count;if n<>1 then raise exception 'AUTHOR_CANNOT_DELETE';end if;
  execute 'reset role';
end
$test$;
select 'PASS: lounge membership, authorship, guest privacy, blocks, moderation, size, timestamps and retry uniqueness' as result;
rollback;
