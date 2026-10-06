-- ============================================================
-- MeetNow — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- PostGIS for geolocation queries
create extension if not exists postgis;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  age         int not null check (age >= 16 and age <= 100),
  gender      text not null check (gender in ('male', 'female')),
  avatar_url  text,
  google_verified boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.ad_cards (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null,
  cta_url     text not null,
  image_url   text,
  active      boolean not null default true
);

create table if not exists public.activities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  type                text not null check (type in ('walk','cafe','bar','sport','cinema','boardgames','eat','other')),
  description         text not null,
  looking_for_gender  text not null check (looking_for_gender in ('male','female','any')),
  age_min             int not null default 18 check (age_min >= 16),
  age_max             int not null default 60 check (age_max <= 100),
  when_time           timestamptz not null,
  location            text not null,
  lat                 float8 not null,
  lng                 float8 not null,
  geo                 geography(Point, 4326),
  status              text not null default 'active' check (status in ('active','closed')),
  created_at          timestamptz not null default now()
);

-- Auto-compute geo column from lat/lng
create or replace function public.set_activity_geo()
returns trigger language plpgsql as $$
begin
  new.geo := st_setsrid(st_makepoint(new.lng, new.lat), 4326);
  return new;
end;
$$;

drop trigger if exists trg_activity_geo on public.activities;
create trigger trg_activity_geo
  before insert or update of lat, lng on public.activities
  for each row execute function public.set_activity_geo();

create table if not exists public.interests (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (activity_id, user_id)
);

create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user1_id    uuid not null references public.users(id) on delete cascade,
  user2_id    uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (activity_id, user1_id, user2_id)
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  sender_id   uuid not null references public.users(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_activities_geo on public.activities using gist(geo);
create index if not exists idx_activities_status on public.activities(status);
create index if not exists idx_interests_activity on public.interests(activity_id);
create index if not exists idx_matches_users on public.matches(user1_id, user2_id);
create index if not exists idx_messages_match on public.messages(match_id, created_at);

-- ============================================================
-- NEARBY ACTIVITIES FUNCTION
-- ============================================================

create or replace function public.activities_nearby(
  user_lat   float8,
  user_lng   float8,
  radius_km  float8 default 50
)
returns table (
  id                  uuid,
  user_id             uuid,
  type                text,
  description         text,
  looking_for_gender  text,
  age_min             int,
  age_max             int,
  when_time           timestamptz,
  location            text,
  lat                 float8,
  lng                 float8,
  status              text,
  created_at          timestamptz,
  distance_km         float8,
  author              json
)
language sql stable as $$
  select
    a.id,
    a.user_id,
    a.type,
    a.description,
    a.looking_for_gender,
    a.age_min,
    a.age_max,
    a.when_time,
    a.location,
    a.lat,
    a.lng,
    a.status,
    a.created_at,
    round((st_distance(
      a.geo::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
    ) / 1000.0)::numeric, 1)::float8 as distance_km,
    row_to_json(u.*) as author
  from public.activities a
  left join public.users u on u.id = a.user_id
  where
    a.status = 'active'
    and a.when_time > now()
    and st_dwithin(
      a.geo::geography,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
  order by distance_km asc
  limit 100;
$$;

-- ============================================================
-- AUTO-MATCH TRIGGER
-- When a user expresses interest, check if activity owner
-- already expressed interest back → create match
-- ============================================================

create or replace function public.check_and_create_match()
returns trigger language plpgsql security definer as $$
declare
  v_activity  public.activities%rowtype;
  v_match_id  uuid;
begin
  select * into v_activity from public.activities where id = new.activity_id;

  -- The activity owner expressing interest means they want to meet the interested users
  -- Simple logic: if current user ≠ activity owner AND activity owner's activities
  -- have been "interested in" by the other side — create match
  -- For MVP: match is created when the interested user is different from owner
  -- and there's already a reciprocal interest record

  if new.user_id = v_activity.user_id then
    return new; -- owner can't match themselves
  end if;

  -- Check if there's already a match for this activity between these two users
  if exists (
    select 1 from public.matches
    where activity_id = new.activity_id
      and ((user1_id = new.user_id and user2_id = v_activity.user_id)
        or (user1_id = v_activity.user_id and user2_id = new.user_id))
  ) then
    return new; -- match already exists
  end if;

  -- Check for reciprocal: activity owner expressed interest in the new user's activity
  -- OR activity owner "accepted" by the system (for MVP, auto-match on interest)
  -- MVP approach: auto-create match when any non-owner expresses interest
  -- (Both users see each other in Matches tab after one presses "Написати")
  insert into public.matches (activity_id, user1_id, user2_id)
  values (new.activity_id, v_activity.user_id, new.user_id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_check_match on public.interests;
create trigger trg_check_match
  after insert on public.interests
  for each row execute function public.check_and_create_match();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.activities enable row level security;
alter table public.interests enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.ad_cards enable row level security;

-- users: anyone can read, only self can update
create policy "users_select" on public.users for select using (true);
create policy "users_insert" on public.users for insert with check (auth.uid() = id);
create policy "users_update" on public.users for update using (auth.uid() = id);

-- activities: anyone can read active, only owner can insert/update
create policy "activities_select" on public.activities for select using (true);
create policy "activities_insert" on public.activities for insert with check (auth.uid() = user_id);
create policy "activities_update" on public.activities for update using (auth.uid() = user_id);

-- interests: authenticated users can insert, select own
create policy "interests_select" on public.interests for select using (auth.uid() = user_id);
create policy "interests_insert" on public.interests for insert with check (auth.uid() = user_id);

-- matches: only participants can see
create policy "matches_select" on public.matches
  for select using (auth.uid() = user1_id or auth.uid() = user2_id);

-- messages: only match participants can read/write
create policy "messages_select" on public.messages
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
  );
create policy "messages_insert" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
  );

-- ad_cards: public read
create policy "ad_cards_select" on public.ad_cards for select using (active = true);

-- ============================================================
-- SEED: Sample ad cards
-- ============================================================

insert into public.ad_cards (title, description, cta_url, active) values
  ('Кав'ярня "Зернятко"', 'Найкраща кава в Чернігові. Знижка 10% для користувачів MeetNow!', 'https://example.com/zernyatko', true),
  ('Квест-кімната "Лабіринт"', 'Пройди квест з новими знайомими. Бронювання онлайн.', 'https://example.com/labyrinth', true)
on conflict do nothing;
