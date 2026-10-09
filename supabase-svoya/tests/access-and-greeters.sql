begin;
do $audit$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];e uuid:=gen_random_uuid();beauty uuid:=gen_random_uuid();n integer;i integer;v jsonb;
begin
 for i in 1..4 loop
  insert into auth.users(id,email_confirmed_at,is_anonymous) values(ids[i],now(),false);
  insert into storage.objects(bucket_id,name,owner_id) values('svoya-profile-photos',ids[i]::text||'/fixture.webp',ids[i]::text);
  insert into public.svoya_profiles(id,name,photo_paths,membership_status,discoverable,welcomes_newcomers) values(ids[i],'Audit Fixture',array[ids[i]::text||'/fixture.webp'],'approved',true,true);
 end loop;
 insert into public.svoya_entries(id,owner_id,kind,title,starts_at,capacity) values(e,ids[1],'event','Audit event',now()+interval '1 day',3);
 insert into public.svoya_entries(id,owner_id,kind,title) values(beauty,ids[1],'beauty','Audit beauty');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[2],'role','authenticated','is_anonymous',false)::text,true);perform set_config('request.jwt.claim.sub',ids[2]::text,true);execute 'set local role authenticated';
 insert into public.svoya_requests(entry_id,user_id,message,contact) values(beauty,ids[2],'Fixture request','private-fixture-contact');
 perform public.svoya_community_action('join',jsonb_build_object('entry_id',e));
 begin update public.svoya_profiles set bio='forged' where id=ids[1];get diagnostics n=row_count;if n<>0 then raise exception 'FOREIGN_PROFILE_UPDATED';end if;end;
 begin insert into public.svoya_entries(owner_id,kind,title) values(ids[1],'beauty','Forged owner');raise exception 'FORGED_OWNER_ALLOWED';exception when insufficient_privilege then null;end;
 begin update public.svoya_profiles set photo_paths=array[]::text[] where id=ids[2];raise exception 'EMPTY_PHOTOS_ALLOWED';exception when others then if sqlerrm<>'SV_PHOTOS_REQUIRED' then raise;end if;end;
 execute 'reset role';perform set_config('request.jwt.claim.sub',ids[3]::text,true);execute 'set local role authenticated';
 if exists(select 1 from public.svoya_requests where entry_id=beauty) then raise exception 'PRIVATE_REQUEST_LEAK';end if;
 perform public.svoya_community_action('join',jsonb_build_object('entry_id',e,'needs_greeter',true));
 execute 'reset role';perform set_config('request.jwt.claim.sub',ids[1]::text,true);execute 'set local role authenticated';
 if not exists(select 1 from public.svoya_requests where entry_id=beauty) then raise exception 'OWNER_REQUEST_INVISIBLE';end if;
 update public.svoya_memberships set status='joined' where entry_id=e and user_id in (ids[2],ids[3]);
 perform public.svoya_community_action('assign_greeter',jsonb_build_object('entry_id',e,'user_id',ids[3],'greeter_id',ids[2]));
 execute 'reset role';perform set_config('request.jwt.claim.sub',ids[2]::text,true);execute 'set local role authenticated';
 delete from public.svoya_memberships where entry_id=e and user_id=ids[2];
 execute 'reset role';
 if not exists(select 1 from public.svoya_memberships where entry_id=e and user_id=ids[3] and greeter_id=ids[1]) then raise exception 'GREETER_NOT_REASSIGNED_AFTER_LEAVE';end if;
 if exists(select 1 from public.svoya_memberships where entry_id=e and user_id=ids[2]) then raise exception 'GREETER_STILL_MEMBER';end if;

 -- Rejoin, then exercise each invalidation path. These fixtures are rolled back.
 insert into public.svoya_memberships(entry_id,user_id,status) values(e,ids[2],'joined');
 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 perform public.svoya_community_action('assign_greeter',jsonb_build_object('entry_id',e,'user_id',ids[3],'greeter_id',ids[2]));
 update public.svoya_memberships set status='rejected' where entry_id=e and user_id=ids[2];
 if (select greeter_id from public.svoya_memberships where entry_id=e and user_id=ids[3]) is distinct from ids[1] then raise exception 'GREETER_AFTER_REJECTION';end if;
 update public.svoya_memberships set status='joined' where entry_id=e and user_id=ids[2];
 perform public.svoya_community_action('assign_greeter',jsonb_build_object('entry_id',e,'user_id',ids[3],'greeter_id',ids[2]));
 update public.svoya_profiles set welcomes_newcomers=false where id=ids[2];
 if (select greeter_id from public.svoya_memberships where entry_id=e and user_id=ids[3]) is distinct from ids[1] then raise exception 'GREETER_AFTER_WITHDRAWAL';end if;
 update public.svoya_profiles set welcomes_newcomers=true where id=ids[2];
 perform public.svoya_community_action('assign_greeter',jsonb_build_object('entry_id',e,'user_id',ids[3],'greeter_id',ids[2]));
 update public.svoya_profiles set membership_status='suspended' where id=ids[2];
 if (select greeter_id from public.svoya_memberships where entry_id=e and user_id=ids[3]) is distinct from ids[1] then raise exception 'GREETER_AFTER_SUSPENSION';end if;
 update public.svoya_profiles set membership_status='approved' where id=ids[2];
 perform public.svoya_community_action('assign_greeter',jsonb_build_object('entry_id',e,'user_id',ids[3],'greeter_id',ids[2]));
 insert into public.svoya_blocks(blocker_id,blocked_id) values(ids[2],ids[3]);
 if (select greeter_id from public.svoya_memberships where entry_id=e and user_id=ids[3]) is distinct from ids[1] then raise exception 'GREETER_AFTER_BLOCK';end if;
 insert into public.svoya_blocks(blocker_id,blocked_id) values(ids[3],ids[1]);
 if (select greeter_id from public.svoya_memberships where entry_id=e and user_id=ids[3]) is not null then raise exception 'BLOCKED_HOST_ASSIGNED';end if;
 execute 'set local role anon';
 begin perform * from public.svoya_profiles;raise exception 'ANON_PROFILES_ALLOWED';exception when insufficient_privilege then null;end;
 begin perform * from public.svoya_push_config;raise exception 'ANON_PUSH_SECRETS_ALLOWED';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $audit$;
rollback;
select 'PASS: private service requests, owner binding, foreign profile write denial, mandatory photo, guest privacy; PASS: greeter repair after departure, rejection, opt-out, suspension and blocking' as result;
