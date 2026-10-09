-- SVOYA-only additive upgrade. Titles never grant membership or admin rights.
alter table public.svoya_profiles
 add column member_title text not null default 'svoya'
   check (member_title in ('svoya','active','inspirer','ambassador')),
 add column member_title_updated_at timestamptz;

-- Existing column-level INSERT/UPDATE grants deliberately exclude these fields.
create function svoya_private.set_member_title(target_user uuid,next_title text,expected_title text,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_title text; member_status text; title_label text;
begin
 if actor is null then raise exception 'SV_LOGIN'; end if;
 if not svoya_private.is_admin() then raise exception 'SV_ADMIN_ONLY'; end if;
 if next_title is null or next_title not in ('svoya','active','inspirer','ambassador') then raise exception 'SV_TITLE_INVALID'; end if;
 if reason is null or length(trim(reason)) not between 10 and 1000 then raise exception 'SV_TITLE_REASON'; end if;
 select member_title,membership_status into current_title,member_status
 from public.svoya_profiles where id=target_user for update;
 if not found then raise exception 'SV_UNAVAILABLE'; end if;
 if member_status<>'approved' then raise exception 'SV_TITLE_APPROVAL'; end if;
 if current_title is distinct from expected_title then raise exception 'SV_TITLE_CONFLICT'; end if;
 if current_title=next_title then return jsonb_build_object('ok',true,'changed',false); end if;
 update public.svoya_profiles set member_title=next_title,member_title_updated_at=now() where id=target_user;
 insert into public.svoya_moderation_log(admin_id,target_id,action,note)
 values(actor,target_user,'member_title:'||current_title||':'||next_title,trim(reason));
 title_label:=case next_title when 'svoya' then 'Своя' when 'active' then 'Активна своя' when 'inspirer' then 'Натхненниця' else 'Амбасадорка' end;
 insert into public.svoya_notifications(user_id,kind,title,body,link_path)
 values(target_user,'moderation','Твій титул оновлено',title_label||' · Дізнайся більше у своєму профілі.','/club?section=profile');
 return jsonb_build_object('ok',true,'changed',true);
end $$;
revoke all on function svoya_private.set_member_title(uuid,text,text,text) from public,anon;
grant execute on function svoya_private.set_member_title(uuid,text,text,text) to authenticated;

create function public.svoya_set_member_title(target_user uuid,next_title text,expected_title text,reason text)
returns jsonb language sql security invoker set search_path='' as $$
 select svoya_private.set_member_title(target_user,next_title,expected_title,reason)
$$;
revoke all on function public.svoya_set_member_title(uuid,text,text,text) from public,anon;
grant execute on function public.svoya_set_member_title(uuid,text,text,text) to authenticated;

-- Recent title history is read through the existing admin-only RLS policy.
create index svoya_moderation_title_history_idx on public.svoya_moderation_log(target_id,created_at desc)
 where action like 'member_title:%';
