-- Additive club schema; existing Poruch tables and accounts are preserved.
create table public.svoya_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 2 and 80),
 city text not null default 'Чернігів' check(char_length(city) between 2 and 80),
 bio text not null default '' check(char_length(bio)<=500),
 interests text[] not null default '{}' check(cardinality(interests)<=8),
 rules_accepted_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.svoya_entries (
 id uuid primary key default gen_random_uuid(), owner_id uuid references public.svoya_profiles(id) on delete cascade,
 kind text not null check(kind in ('event','circle','beauty','business','help')),
 title text not null check(char_length(trim(title)) between 3 and 120),
 description text not null default '' check(char_length(description)<=5000),
 city text not null default 'Чернігів' check(char_length(city) between 2 and 80),
 category text not null default '' check(char_length(category)<=80),
 location text not null default '' check(char_length(location)<=180),
 starts_at timestamptz, capacity integer not null default 12 check(capacity between 2 and 500),
 price numeric(10,2) not null default 0 check(price>=0),
 is_demo boolean not null default false,
 status text not null default 'published' check(status in ('published','archived')),
 created_at timestamptz not null default now(),
 constraint svoya_real_owner check(is_demo or owner_id is not null),
 constraint svoya_event_date check(kind <> 'event' or is_demo or starts_at is not null)
);
create table public.svoya_memberships (
 entry_id uuid not null references public.svoya_entries(id) on delete cascade,
 user_id uuid not null references public.svoya_profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','joined','rejected')),
 created_at timestamptz not null default now(),primary key(entry_id,user_id)
);
create table public.svoya_requests (
 id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.svoya_entries(id) on delete cascade,
 user_id uuid not null references public.svoya_profiles(id) on delete cascade,
 message text not null check(char_length(trim(message)) between 3 and 2000),
 contact text not null check(char_length(trim(contact)) between 3 and 180),
 status text not null default 'pending' check(status in ('pending','accepted','rejected','closed')),
 created_at timestamptz not null default now(),unique(entry_id,user_id)
);
create table public.svoya_messages (
 id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.svoya_entries(id) on delete cascade,
 user_id uuid not null references public.svoya_profiles(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000), created_at timestamptz not null default now()
);
create table public.svoya_admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.svoya_reports (
 id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.svoya_entries(id) on delete cascade,
 user_id uuid not null references public.svoya_profiles(id) on delete cascade,
 reason text not null check(char_length(trim(reason)) between 5 and 2000),created_at timestamptz not null default now(),unique(entry_id,user_id)
);
create index svoya_entries_city_kind on public.svoya_entries(city,kind,created_at desc) where status='published';
create index svoya_entries_owner on public.svoya_entries(owner_id);
create index svoya_memberships_user on public.svoya_memberships(user_id);
create index svoya_requests_user on public.svoya_requests(user_id);
create index svoya_messages_entry_time on public.svoya_messages(entry_id,created_at desc);
create index svoya_messages_user on public.svoya_messages(user_id);
create index svoya_reports_user on public.svoya_reports(user_id);
alter table public.svoya_profiles enable row level security;
alter table public.svoya_entries enable row level security;
alter table public.svoya_memberships enable row level security;
alter table public.svoya_requests enable row level security;
alter table public.svoya_messages enable row level security;
alter table public.svoya_admins enable row level security;
alter table public.svoya_reports enable row level security;
revoke all on public.svoya_profiles,public.svoya_entries,public.svoya_memberships,public.svoya_requests,public.svoya_messages,public.svoya_admins,public.svoya_reports from anon,authenticated;
grant select on public.svoya_entries to anon,authenticated;
grant select,insert on public.svoya_profiles,public.svoya_memberships,public.svoya_requests,public.svoya_messages,public.svoya_reports to authenticated;
grant insert on public.svoya_entries to authenticated;
grant select on public.svoya_admins to authenticated;
grant update(name,city,bio,interests) on public.svoya_profiles to authenticated;
grant update(title,description,city,category,location,starts_at,capacity,price,status) on public.svoya_entries to authenticated;
grant update(status) on public.svoya_memberships,public.svoya_requests to authenticated;
grant delete on public.svoya_memberships,public.svoya_requests,public.svoya_messages to authenticated;
create policy svoya_profile_read on public.svoya_profiles for select to authenticated using(true);
create policy svoya_profile_insert on public.svoya_profiles for insert to authenticated with check(id=(select auth.uid()));
create policy svoya_profile_update on public.svoya_profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy svoya_admin_self on public.svoya_admins for select to authenticated using(user_id=(select auth.uid()));
create policy svoya_entry_read on public.svoya_entries for select to anon,authenticated using(status='published' or owner_id=(select auth.uid()));
create policy svoya_entry_insert on public.svoya_entries for insert to authenticated with check(owner_id=(select auth.uid()) and not is_demo);
create policy svoya_entry_update on public.svoya_entries for update to authenticated using(owner_id=(select auth.uid()) or exists(select 1 from public.svoya_admins a where a.user_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) or exists(select 1 from public.svoya_admins a where a.user_id=(select auth.uid())));
create policy svoya_member_read on public.svoya_memberships for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.svoya_entries e where e.id=entry_id and e.owner_id=(select auth.uid())));
create policy svoya_member_insert on public.svoya_memberships for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and exists(select 1 from public.svoya_entries e where e.id=entry_id and e.kind in ('event','circle') and e.status='published' and not e.is_demo and e.owner_id<>(select auth.uid()) and (e.kind<>'event' or e.starts_at>now())));
create policy svoya_member_update on public.svoya_memberships for update to authenticated using(exists(select 1 from public.svoya_entries e where e.id=entry_id and e.owner_id=(select auth.uid()))) with check(exists(select 1 from public.svoya_entries e where e.id=entry_id and e.owner_id=(select auth.uid())));
create policy svoya_member_delete on public.svoya_memberships for delete to authenticated using(user_id=(select auth.uid()));
create policy svoya_request_read on public.svoya_requests for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.svoya_entries e where e.id=entry_id and e.owner_id=(select auth.uid())));
create policy svoya_request_insert on public.svoya_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and exists(select 1 from public.svoya_entries e where e.id=entry_id and e.kind in ('beauty','business','help') and e.status='published' and not e.is_demo and e.owner_id<>(select auth.uid())));
create policy svoya_request_update on public.svoya_requests for update to authenticated using(exists(select 1 from public.svoya_entries e where e.id=entry_id and e.owner_id=(select auth.uid()))) with check(exists(select 1 from public.svoya_entries e where e.id=entry_id and e.owner_id=(select auth.uid())));
create policy svoya_request_delete on public.svoya_requests for delete to authenticated using(user_id=(select auth.uid()));
create policy svoya_chat_read on public.svoya_messages for select to authenticated using(exists(select 1 from public.svoya_entries e where e.id=entry_id and e.kind in ('event','circle') and (e.owner_id=(select auth.uid()) or exists(select 1 from public.svoya_memberships m where m.entry_id=e.id and m.user_id=(select auth.uid()) and m.status='joined'))));
create policy svoya_chat_insert on public.svoya_messages for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.svoya_entries e where e.id=entry_id and e.status='published' and not e.is_demo and e.kind in ('event','circle') and (e.owner_id=(select auth.uid()) or exists(select 1 from public.svoya_memberships m where m.entry_id=e.id and m.user_id=(select auth.uid()) and m.status='joined'))));
create policy svoya_chat_delete on public.svoya_messages for delete to authenticated using(user_id=(select auth.uid()));
create policy svoya_report_insert on public.svoya_reports for insert to authenticated with check(user_id=(select auth.uid()));
create policy svoya_report_read on public.svoya_reports for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.svoya_admins a where a.user_id=(select auth.uid())));
-- The organizer's RLS view includes every request. Lock the entry before approving
-- to serialize concurrent decisions and enforce capacity in the database.
create function public.svoya_guard_capacity() returns trigger language plpgsql security invoker set search_path='' as $$
declare max_seats integer; entry_status text;
begin
 if new.status='joined' and old.status<>'joined' then
   select capacity,status into max_seats,entry_status from public.svoya_entries where id=new.entry_id for update;
   if entry_status<>'published' then raise exception 'SV_CLOSED'; end if;
   if (select count(*) from public.svoya_memberships where entry_id=new.entry_id and status='joined')>=max_seats then raise exception 'SV_FULL'; end if;
 end if;
 return new;
end $$;
revoke all on function public.svoya_guard_capacity() from public,anon,authenticated;
create trigger svoya_membership_capacity before update on public.svoya_memberships for each row execute function public.svoya_guard_capacity();
-- No real attendees, dates or providers are invented. These are labelled formats.
insert into public.svoya_entries(kind,title,description,category,is_demo,location) values
('event','Кава у своєму колі','Невелика зустріч, на яку можна прийти самій. Знайомство, теплі розмови та час для себе. Це приклад формату: дату й місце визначить організаторка реальної події.','Кава та розмови',true,'Місце обере організаторка'),
('event','Прогулянка без поспіху','Прогулятися містом, познайомитися та побачити звичні місця по-новому. Запропонуй власний маршрут і зручний час.','Прогулянки',true,''),
('event','Творчий вечір разом','Малювання, кераміка або нове хобі у невеликій компанії. Приклад зустрічі для майбутньої програми клубу.','Творчість',true,''),
('circle','Книжкові подруги','Постійне коло для тих, хто любить читати та обговорювати. Одна книга на місяць, зустрічі й спільний чат. Створи таке коло у своєму місті.','Книги',true,''),
('circle','Жінки, які створюють','Коло про власну справу: обмін досвідом, підтримка й знайомства. Це приклад спільноти, яку можна започаткувати.','Підприємництво',true,''),
('circle','Я новенька у місті','Знайомства з містом і людьми, корисні рекомендації та маленькі спільні плани. Приклад кола для нових мешканок.','Моє місто',true,'');
