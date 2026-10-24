begin;
do $audit$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 e uuid:=gen_random_uuid(); standard uuid:=gen_random_uuid(); i integer; v jsonb;
begin
 for i in 1..5 loop
  insert into auth.users(id,email_confirmed_at,is_anonymous) values(ids[i],now(),false);
  insert into storage.objects(bucket_id,name,owner_id) values('svoya-profile-photos',ids[i]::text||'/fixture.webp',ids[i]::text);
  insert into public.svoya_profiles(id,name,photo_paths,membership_status) values(ids[i],'Open event fixture',array[ids[i]::text||'/fixture.webp'],'approved');
 end loop;
 insert into public.svoya_entries(id,owner_id,kind,format,title,starts_at,capacity) values
  (e,ids[1],'event','open','Open event fixture',now()+interval '1 day',2),
  (standard,ids[1],'event','standard','Standard event fixture',now()+interval '1 day',2);
 begin
  insert into public.svoya_entries(owner_id,kind,format,title) values(ids[1],'beauty','open','Invalid format');
  raise exception 'OPEN_NON_EVENT_ALLOWED';
 exception when check_violation then null;end;
 for i in 2..4 loop
  perform set_config('request.jwt.claim.sub',ids[i]::text,true);
  execute 'set local role authenticated';
  v:=public.svoya_community_action('join',jsonb_build_object('entry_id',e));
  if v->>'status' is distinct from (case when i=4 then 'waitlisted' else 'joined' end) then raise exception 'WRONG_OPEN_STATUS: %',v;end if;
  if i<4 then
   insert into public.svoya_messages(entry_id,user_id,body) values(e,ids[i],'Immediate chat access');
  else
   begin
    insert into public.svoya_messages(entry_id,user_id,body) values(e,ids[i],'Waitlist cannot chat');
    raise exception 'WAITLIST_CHAT_ALLOWED';
   exception when insufficient_privilege then null;end;
  end if;
  execute 'reset role';
 end loop;
 if (select count(*) from public.svoya_memberships where entry_id=e and status='joined')<>2 then raise exception 'CAPACITY_BROKEN';end if;
 if not exists(select 1 from public.svoya_notifications where user_id=ids[1] and entry_id=e and title='Нова учасниця події') then raise exception 'HOST_NOT_NOTIFIED';end if;
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);execute 'set local role authenticated';
 begin
  perform public.svoya_community_action('join',jsonb_build_object('entry_id',e));raise exception 'DUPLICATE_ALLOWED';
 exception when others then if sqlerrm<>'SV_ALREADY_JOINED' then raise;end if;end;
 delete from public.svoya_memberships where entry_id=e and user_id=ids[2];
 execute 'reset role';
 if not exists(select 1 from public.svoya_memberships where entry_id=e and user_id=ids[4] and status='joined') then raise exception 'WAITLIST_NOT_AUTO_JOINED';end if;
 perform set_config('request.jwt.claim.sub',ids[4]::text,true);execute 'set local role authenticated';
 insert into public.svoya_messages(entry_id,user_id,body) values(e,ids[4],'Promoted chat access');
 v:=public.svoya_community_action('join',jsonb_build_object('entry_id',standard));
 if v->>'status'<>'pending' then raise exception 'STANDARD_APPROVAL_CHANGED';end if;
 begin
  insert into public.svoya_messages(entry_id,user_id,body) values(standard,ids[4],'Pending cannot chat');raise exception 'PENDING_CHAT_ALLOWED';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.svoya_memberships(entry_id,user_id,status) values(e,ids[5],'joined');raise exception 'DIRECT_JOIN_ALLOWED';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.svoya_profiles set membership_status='pending' where id=ids[5];
 perform set_config('request.jwt.claim.sub',ids[5]::text,true);execute 'set local role authenticated';
 begin
  perform public.svoya_community_action('join',jsonb_build_object('entry_id',e));raise exception 'UNAPPROVED_JOIN_ALLOWED';
 exception when others then if sqlerrm<>'SV_REVIEW_PENDING' then raise;end if;end;
 execute 'reset role';
 update public.svoya_profiles set membership_status='approved' where id=ids[5];
 insert into public.svoya_blocks(blocker_id,blocked_id) values(ids[1],ids[5]);
 execute 'set local role authenticated';
 begin
  perform public.svoya_community_action('join',jsonb_build_object('entry_id',e));raise exception 'BLOCKED_JOIN_ALLOWED';
 exception when others then if sqlerrm<>'SV_CLOSED' then raise;end if;end;
 execute 'reset role';
end $audit$;
rollback;
select 'PASS: open event immediate membership/chat, capacity, waitlist promotion, notifications, legacy approval and access restrictions' as result;
