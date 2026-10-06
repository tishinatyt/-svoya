alter table public.users alter column google_verified set default false;

create or replace function public.enforce_google_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.google_verified := exists (
    select 1
    from auth.identities identity_row
    where identity_row.user_id = new.id
      and identity_row.provider = 'google'
  );
  return new;
end;
$$;

revoke all on function public.enforce_google_verified() from public, anon, authenticated;

drop trigger if exists trg_enforce_google_verified on public.users;
create trigger trg_enforce_google_verified
before insert or update on public.users
for each row execute function public.enforce_google_verified();

update public.users user_row
set google_verified = exists (
  select 1
  from auth.identities identity_row
  where identity_row.user_id = user_row.id
    and identity_row.provider = 'google'
)
where google_verified is distinct from exists (
  select 1
  from auth.identities identity_row
  where identity_row.user_id = user_row.id
    and identity_row.provider = 'google'
);
