-- ============================================================
-- MeetNow — Events Schema (Meetup Model)
-- Migration 003: New tables for event-based architecture.
-- Old tables (activities, interests, matches, messages) are
-- intentionally left untouched for separate migration decision.
-- ============================================================

-- PostGIS is already enabled by 001_initial.sql
-- create extension if not exists postgis;

-- ============================================================
-- TABLES
-- ============================================================

-- 1. events
create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text not null default '',
  category         text not null check (category in (
                     'cinema', 'theatre', 'bar', 'sport', 'music',
                     'food', 'games', 'walk', 'art', 'other'
                   )),
  is_public        boolean not null default true,
  organizer_id     uuid not null references public.users(id) on delete cascade,
  cover_photo_url  text,
  -- PostGIS geography point (lng, lat) — EPSG:4326
  location         geography(Point, 4326),
  address_text     text not null default '',
  event_datetime   timestamptz not null,
  max_participants int not null default 10 check (max_participants >= 1 and max_participants <= 1000),
  min_age          int not null default 18 check (min_age >= 16),
  max_age          int not null default 60 check (max_age <= 100),
  gender_filter    text not null default 'any' check (gender_filter in ('male', 'female', 'any')),
  status           text not null default 'upcoming' check (
                     status in ('upcoming', 'active', 'completed', 'cancelled')
                   ),
  created_at       timestamptz not null default now()
);

-- Convenience: set location from lat/lng helper function
-- Usage: INSERT ... SET location = events_point(lng, lat)
create or replace function public.events_point(lng float8, lat float8)
returns geography language sql immutable as $$
  select st_setsrid(st_makepoint(lng, lat), 4326)::geography
$$;

-- Spatial index for proximity queries
create index if not exists idx_events_location on public.events using gist(location);
create index if not exists idx_events_status    on public.events(status);
create index if not exists idx_events_datetime  on public.events(event_datetime);
create index if not exists idx_events_organizer on public.events(organizer_id);
create index if not exists idx_events_public    on public.events(is_public) where is_public = true;

-- ----------------------------------------------------------------

-- 2. event_participants
create table if not exists public.event_participants (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null default 'participant' check (role in ('organizer', 'participant')),
  joined_at  timestamptz not null default now(),
  status     text not null default 'joined' check (status in ('joined', 'left')),
  unique (event_id, user_id)
);

create index if not exists idx_ep_event   on public.event_participants(event_id);
create index if not exists idx_ep_user    on public.event_participants(user_id);
create index if not exists idx_ep_status  on public.event_participants(event_id, status) where status = 'joined';

-- Auto-insert organizer as participant when event is created
create or replace function public.add_organizer_as_participant()
returns trigger language plpgsql security definer as $$
begin
  insert into public.event_participants (event_id, user_id, role)
  values (new.id, new.organizer_id, 'organizer')
  on conflict (event_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_organizer_participant on public.events;
create trigger trg_organizer_participant
  after insert on public.events
  for each row execute function public.add_organizer_as_participant();

-- ----------------------------------------------------------------

-- 3. event_chats (one group chat per event)
create table if not exists public.event_chats (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id)   -- one chat per event
);

create index if not exists idx_ec_event on public.event_chats(event_id);

-- Auto-create group chat when event is created
create or replace function public.create_event_chat()
returns trigger language plpgsql security definer as $$
begin
  insert into public.event_chats (event_id)
  values (new.id)
  on conflict (event_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_event_chat on public.events;
create trigger trg_create_event_chat
  after insert on public.events
  for each row execute function public.create_event_chat();

-- ----------------------------------------------------------------

-- 4. event_chat_messages
create table if not exists public.event_chat_messages (
  id            uuid primary key default gen_random_uuid(),
  event_chat_id uuid not null references public.event_chats(id) on delete cascade,
  sender_id     uuid not null references public.users(id) on delete cascade,
  content       text not null check (length(content) > 0 and length(content) <= 4000),
  created_at    timestamptz not null default now()
);

create index if not exists idx_ecm_chat      on public.event_chat_messages(event_chat_id, created_at);
create index if not exists idx_ecm_sender    on public.event_chat_messages(sender_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if auth.uid() is an active participant of an event
create or replace function public.is_event_participant(p_event_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.event_participants
    where event_id = p_event_id
      and user_id = auth.uid()
      and status = 'joined'
  )
$$;

-- Get event_id from event_chat_id
create or replace function public.event_chat_event_id(p_chat_id uuid)
returns uuid language sql stable security definer as $$
  select event_id from public.event_chats where id = p_chat_id
$$;

-- Count active participants for an event (for slot display)
create or replace function public.event_participant_count(p_event_id uuid)
returns int language sql stable as $$
  select count(*)::int from public.event_participants
  where event_id = p_event_id and status = 'joined'
$$;

-- Nearby public events with distance
create or replace function public.events_nearby(
  user_lat  float8,
  user_lng  float8,
  radius_km float8 default 50,
  p_category text default null
)
returns table (
  id               uuid,
  title            text,
  description      text,
  category         text,
  is_public        boolean,
  organizer_id     uuid,
  cover_photo_url  text,
  address_text     text,
  event_datetime   timestamptz,
  max_participants int,
  min_age          int,
  max_age          int,
  gender_filter    text,
  status           text,
  created_at       timestamptz,
  distance_km      float8,
  participant_count int,
  organizer        json
)
language sql stable as $$
  select
    e.id,
    e.title,
    e.description,
    e.category,
    e.is_public,
    e.organizer_id,
    e.cover_photo_url,
    e.address_text,
    e.event_datetime,
    e.max_participants,
    e.min_age,
    e.max_age,
    e.gender_filter,
    e.status,
    e.created_at,
    round((
      st_distance(
        e.location,
        st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
      ) / 1000.0
    )::numeric, 1)::float8 as distance_km,
    public.event_participant_count(e.id) as participant_count,
    row_to_json(u.*) as organizer
  from public.events e
  left join public.users u on u.id = e.organizer_id
  where
    e.is_public = true
    and e.status in ('upcoming', 'active')
    and e.event_datetime > now()
    and (p_category is null or e.category = p_category)
    and st_dwithin(
      e.location,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
  order by distance_km asc
  limit 100
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.events             enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_chats        enable row level security;
alter table public.event_chat_messages enable row level security;

-- ----------------------------------------------------------------
-- events policies

-- Public events: visible to all authenticated users
create policy "events_select_public"
  on public.events for select
  using (
    auth.uid() is not null
    and is_public = true
  );

-- Private events: visible only to participants
create policy "events_select_private"
  on public.events for select
  using (
    auth.uid() is not null
    and is_public = false
    and public.is_event_participant(id)
  );

-- Any authenticated user can create an event
create policy "events_insert"
  on public.events for insert
  with check (auth.uid() = organizer_id);

-- Only organizer can update/cancel their event
create policy "events_update"
  on public.events for update
  using (auth.uid() = organizer_id);

-- Only organizer can hard-delete (prefer status = 'cancelled' instead)
create policy "events_delete"
  on public.events for delete
  using (auth.uid() = organizer_id);

-- ----------------------------------------------------------------
-- event_participants policies

-- Own row always visible; other participants visible when user is in same event.
-- user_id = auth.uid() short-circuits first so is_event_participant (STABLE) is
-- never called for the user's own rows — avoids recursive-RLS / STABLE-cache bug.
create policy "ep_select"
  on public.event_participants for select
  using (
    auth.uid() is not null
    and (
      user_id = auth.uid()
      or public.is_event_participant(event_id)
    )
  );

-- Any authenticated user can join (insert themselves as participant)
create policy "ep_insert"
  on public.event_participants for insert
  with check (
    auth.uid() = user_id
    and role = 'participant'   -- only organizer trigger can set role='organizer'
  );

-- User can update their own participation (e.g. leave: status = 'left')
create policy "ep_update_own"
  on public.event_participants for update
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- event_chats policies

-- Participants can see the chat room for their events
create policy "ec_select"
  on public.event_chats for select
  using (
    auth.uid() is not null
    and public.is_event_participant(event_id)
  );

-- Chats are created automatically by trigger, no direct insert needed
-- (no insert policy — trigger runs as security definer)

-- ----------------------------------------------------------------
-- event_chat_messages policies

-- Only participants can read messages
create policy "ecm_select"
  on public.event_chat_messages for select
  using (
    auth.uid() is not null
    and public.is_event_participant(
          public.event_chat_event_id(event_chat_id)
        )
  );

-- Only participants can send messages, and only as themselves
create policy "ecm_insert"
  on public.event_chat_messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_event_participant(
          public.event_chat_event_id(event_chat_id)
        )
  );

-- ============================================================
-- REALTIME: enable realtime for chat messages
-- ============================================================

alter publication supabase_realtime add table public.event_chat_messages;
alter publication supabase_realtime add table public.event_participants;

-- ============================================================
-- NOTIFY PostgREST to reload schema
-- ============================================================

notify pgrst, 'reload schema';

-- ============================================================
-- HELPER: get lat/lng from geography column
-- PostgREST cannot return geography coordinates directly.
-- ============================================================

create or replace function public.get_event_coords(p_event_id uuid)
returns table (lat float8, lng float8)
language sql stable security definer as $$
  select
    st_y(location::geometry)::float8 as lat,
    st_x(location::geometry)::float8 as lng
  from public.events
  where id = p_event_id
$$;
