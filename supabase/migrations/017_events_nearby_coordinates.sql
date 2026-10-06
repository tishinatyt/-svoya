-- Expose event coordinates through the existing discovery RPC so Home can
-- render the same result set as markers without issuing per-event queries.

drop function if exists public.events_nearby(float8, float8, float8, text);

create function public.events_nearby(
  user_lat  float8,
  user_lng  float8,
  radius_km float8 default 50,
  p_category text default null
)
returns table (
  id                uuid,
  title             text,
  description       text,
  category          text,
  is_public         boolean,
  organizer_id      uuid,
  cover_photo_url   text,
  address_text      text,
  event_datetime    timestamptz,
  max_participants  int,
  min_age           int,
  max_age           int,
  gender_filter     text,
  status            text,
  created_at        timestamptz,
  distance_km       float8,
  participant_count int,
  organizer         json,
  location_lat      float8,
  location_lng      float8
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
    row_to_json(u.*) as organizer,
    st_y(e.location::geometry)::float8 as location_lat,
    st_x(e.location::geometry)::float8 as location_lng
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

notify pgrst, 'reload schema';
