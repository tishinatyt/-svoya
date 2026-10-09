-- Only the SVOYA registration function can consume these limits.
-- No passwords, email addresses or raw IP addresses are stored here.
create table svoya_private.signup_limits (
 bucket text not null,
 window_start timestamptz not null,
 attempts integer not null check(attempts > 0),
 primary key(bucket,window_start)
);
alter table svoya_private.signup_limits enable row level security;
revoke all on svoya_private.signup_limits from public,anon,authenticated;

create function svoya_private.allow_signup(ip_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare window_hour timestamptz:=date_trunc('hour',now()); n integer;
begin
 if ip_hash is null or ip_hash !~ '^[a-f0-9]{64}$' then return false;end if;
 -- A global budget remains effective even if a caller spoofs forwarding headers.
 insert into svoya_private.signup_limits values('global',window_hour,1)
 on conflict(bucket,window_start) do update set attempts=svoya_private.signup_limits.attempts+1
 returning attempts into n;
 if n>200 then return false;end if;
 insert into svoya_private.signup_limits values('ip:'||ip_hash,window_hour,1)
 on conflict(bucket,window_start) do update set attempts=svoya_private.signup_limits.attempts+1
 returning attempts into n;
 delete from svoya_private.signup_limits where window_start<now()-interval '2 days';
 return n<=20;
end $$;
revoke all on function svoya_private.allow_signup(text) from public,anon,authenticated;
create function public.svoya_allow_username_signup(ip_hash text) returns boolean
language sql security invoker set search_path='' as $$ select svoya_private.allow_signup(ip_hash) $$;
revoke all on function public.svoya_allow_username_signup(text) from public,anon,authenticated;
grant usage on schema svoya_private to service_role;
grant execute on function svoya_private.allow_signup(text),public.svoya_allow_username_signup(text) to service_role;
