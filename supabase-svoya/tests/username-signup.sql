begin;
do $$
begin
 if has_function_privilege('anon','public.svoya_allow_username_signup(text)','EXECUTE') or has_function_privilege('authenticated','public.svoya_allow_username_signup(text)','EXECUTE') then raise exception 'signup limit exposed'; end if;
 if has_table_privilege('authenticated','svoya_private.signup_limits','SELECT') then raise exception 'limit data exposed'; end if;
 if not (select relrowsecurity from pg_class where oid='svoya_private.signup_limits'::regclass) then raise exception 'RLS missing'; end if;
end $$;
set local role service_role;
do $$
declare i integer;
begin
 if public.svoya_allow_username_signup('bad') then raise exception 'invalid hash accepted'; end if;
 for i in 1..20 loop
  if not public.svoya_allow_username_signup(repeat('a',64)) then raise exception 'valid attempt denied'; end if;
 end loop;
 if public.svoya_allow_username_signup(repeat('a',64)) then raise exception 'IP limit bypass'; end if;
 for i in 1..179 loop
  perform public.svoya_allow_username_signup(md5(i::text)||md5(i::text));
 end loop;
 if public.svoya_allow_username_signup(repeat('b',64)) then raise exception 'global limit bypass'; end if;
end $$;
rollback;
