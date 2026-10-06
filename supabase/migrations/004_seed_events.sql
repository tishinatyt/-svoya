-- ============================================================
-- MeetNow — Seed: 8 тестових подій + учасники
-- Виконати в: Supabase Dashboard → SQL Editor → Run
-- Потрібно: 003_events.sql вже застосовано
-- ============================================================

-- Також застосуємо get_event_coords якщо ще не зроблено
create or replace function public.get_event_coords(p_event_id uuid)
returns table (lat float8, lng float8)
language sql stable security definer as $$
  select
    st_y(location::geometry)::float8 as lat,
    st_x(location::geometry)::float8 as lng
  from public.events
  where id = p_event_id
$$;

-- ============================================================
-- Юзери вже існують в БД (сіди з 002_seed.sql):
-- 11111111-1111-1111-1111-111111111101  Оля     female 24
-- 11111111-1111-1111-1111-111111111102  Катя    female 28
-- 11111111-1111-1111-1111-111111111103  Маша    female 31
-- 11111111-1111-1111-1111-111111111104  Вика    female 22
-- 11111111-1111-1111-1111-111111111105  Юля     female 35
-- 11111111-1111-1111-1111-111111111106  Аня     female 26
-- 11111111-1111-1111-1111-111111111107  Андрій  male   25
-- 11111111-1111-1111-1111-111111111108  Максим  male   30
-- 11111111-1111-1111-1111-111111111109  Дмитро  male   28
-- 11111111-1111-1111-1111-111111111110  Олена   female 27
-- ============================================================

-- ============================================================
-- 8 ПОДІЙ (одна на кожну категорію)
-- Координати розкидані по Чернігову ±2–5 км від центру
-- ============================================================

insert into public.events (
  id, title, description, category, is_public,
  organizer_id, cover_photo_url, location, address_text,
  event_datetime, max_participants, min_age, max_age, gender_filter, status
) values

-- 1. cinema  — is_public: TRUE
(
  '700fbd69-6d24-4fd6-a603-799e41a179f0',
  'Кіновечір: новий Marvel',
  'Йдемо на прем''єру разом, потім кава і обговорення фільму. Беремо квитки заздалегідь — пишіть в чат!',
  'cinema', true,
  '11111111-1111-1111-1111-111111111101',  -- Оля
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600',
  ST_SetSRID(ST_MakePoint(31.2850, 51.4960), 4326)::geography,
  'Кінотеатр Мультиплекс, вул. Шевченка 1, Чернігів',
  '2026-08-14 18:00:00+03',
  8, 18, 35, 'any', 'upcoming'
),

-- 2. theatre  — is_public: TRUE
(
  '02241340-ccb9-40f8-9064-1a4ac514e518',
  'Вистава «Зойчина квартира»',
  'Запрошую в Чернігівський обласний театр. У мене є зайвий квиток, шукаю компанію. Після — прогулянка набережною.',
  'theatre', true,
  '11111111-1111-1111-1111-111111111102',  -- Катя
  'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=600',
  ST_SetSRID(ST_MakePoint(31.2935, 51.4975), 4326)::geography,
  'Чернігівський обласний театр ім. Шевченка, Чернігів',
  '2026-08-15 19:00:00+03',
  12, 20, 45, 'any', 'upcoming'
),

-- 3. bar  — is_public: FALSE (приватна)
(
  '4dd405b2-1200-4348-b4b6-9cb5a6448553',
  'П''ятнична вечірка в Arbat Bar',
  'Збираємось невеликою компанією — музика, коктейлі, хороший настрій. Тільки перевірені люди 🍹',
  'bar', false,
  '11111111-1111-1111-1111-111111111107',  -- Андрій
  null,
  ST_SetSRID(ST_MakePoint(31.2895, 51.4985), 4326)::geography,
  'Arbat Bar, пр. Миру, Чернігів',
  '2026-08-15 21:00:00+03',
  15, 21, 40, 'any', 'upcoming'
),

-- 4. sport  — is_public: TRUE
(
  '80fbffd7-2c64-4e14-8b6a-bd1b2f53a1ca',
  'Ранкова пробіжка в Парку Перемоги',
  'Збираємось о 7:00 біля головного входу. Темп легкий, 5 км. Після — розтяжка та кава неподалік ☕🏃',
  'sport', true,
  '11111111-1111-1111-1111-111111111108',  -- Максим
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600',
  ST_SetSRID(ST_MakePoint(31.2840, 51.5015), 4326)::geography,
  'Парк Перемоги, головний вхід, Чернігів',
  '2026-08-14 07:00:00+03',
  10, 18, 45, 'any', 'upcoming'
),

-- 5. music  — is_public: TRUE
(
  'fb448e4b-c8dc-43af-a342-ab3208ed1593',
  'Акустичний вечір на набережній',
  'Граю на гітарі, шукаю людей які люблять живу музику. Будемо сидіти на набережній Десни, заходи сонця та пісні 🎸',
  'music', true,
  '11111111-1111-1111-1111-111111111103',  -- Маша
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  ST_SetSRID(ST_MakePoint(31.2901, 51.4991), 4326)::geography,
  'Набережна Десни, Чернігів',
  '2026-08-16 19:30:00+03',
  20, 18, 50, 'any', 'upcoming'
),

-- 6. food  — is_public: TRUE
(
  '623ac418-5afc-49e4-91d6-7c7d8c43c2f1',
  'Сніданок у затишному кафе',
  'Шукаю компанію на неспішний ранковий сніданок. Знаю класне місце з домашньою випічкою ☕🥐 Будемо говорити про все на світі.',
  'food', true,
  '11111111-1111-1111-1111-111111111106',  -- Аня
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600',
  ST_SetSRID(ST_MakePoint(31.2876, 51.4972), 4326)::geography,
  'Кафе Continental, пр. Миру 20, Чернігів',
  '2026-08-14 10:00:00+03',
  6, 18, 40, 'any', 'upcoming'
),

-- 7. games  — is_public: FALSE (приватна)
(
  '5c87e313-1c39-40e9-bf1b-05d1e17de3ad',
  'Вечір настільних ігор',
  'Маємо Каркасон, Колонізаторів і Ticket to Ride. Зберемось вдома у Дмитра, місць небагато. Досвід не обов''язковий! 🎲',
  'games', false,
  '11111111-1111-1111-1111-111111111109',  -- Дмитро
  null,
  ST_SetSRID(ST_MakePoint(31.2860, 51.4940), 4326)::geography,
  'Вул. Рокосовського, Чернігів (адреса в чаті)',
  '2026-08-17 18:00:00+03',
  8, 18, 40, 'any', 'upcoming'
),

-- 8. walk  — is_public: TRUE
(
  'acb6faad-8679-46b7-a1d0-59bd5580125d',
  'Прогулянка Валом та Дитинцем',
  'Йду досліджувати історичний центр Чернігова — Вал, Дитинець, стародавні собори. Люблю розповідати цікаві факти 🏰 Приєднуйтесь!',
  'walk', true,
  '11111111-1111-1111-1111-111111111110',  -- Олена
  'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=600',
  ST_SetSRID(ST_MakePoint(31.2922, 51.4963), 4326)::geography,
  'Вал (Дитинець), початок біля Спаського собору, Чернігів',
  '2026-08-16 16:00:00+03',
  10, 18, 60, 'any', 'upcoming'
)

on conflict (id) do nothing;

-- ============================================================
-- УЧАСНИКИ (4-5 подій наповнюємо вручну)
-- Організатор вже є в event_participants через тригер.
-- Додаємо лише ДОДАТКОВИХ учасників.
-- ============================================================

-- Кіновечір (cinema) — +4 учасники: Катя, Маша, Аня, Андрій
insert into public.event_participants (event_id, user_id, role, status) values
  ('700fbd69-6d24-4fd6-a603-799e41a179f0', '11111111-1111-1111-1111-111111111102', 'participant', 'joined'),  -- Катя
  ('700fbd69-6d24-4fd6-a603-799e41a179f0', '11111111-1111-1111-1111-111111111103', 'participant', 'joined'),  -- Маша
  ('700fbd69-6d24-4fd6-a603-799e41a179f0', '11111111-1111-1111-1111-111111111106', 'participant', 'joined'),  -- Аня
  ('700fbd69-6d24-4fd6-a603-799e41a179f0', '11111111-1111-1111-1111-111111111107', 'participant', 'joined')   -- Андрій
on conflict (event_id, user_id) do nothing;

-- Пробіжка (sport) — +3 учасники: Оля, Аня, Дмитро
insert into public.event_participants (event_id, user_id, role, status) values
  ('80fbffd7-2c64-4e14-8b6a-bd1b2f53a1ca', '11111111-1111-1111-1111-111111111101', 'participant', 'joined'),  -- Оля
  ('80fbffd7-2c64-4e14-8b6a-bd1b2f53a1ca', '11111111-1111-1111-1111-111111111106', 'participant', 'joined'),  -- Аня
  ('80fbffd7-2c64-4e14-8b6a-bd1b2f53a1ca', '11111111-1111-1111-1111-111111111109', 'participant', 'joined')   -- Дмитро
on conflict (event_id, user_id) do nothing;

-- Акустичний вечір (music) — +5 учасників: Оля, Катя, Андрій, Максим, Юля
insert into public.event_participants (event_id, user_id, role, status) values
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111101', 'participant', 'joined'),  -- Оля
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111102', 'participant', 'joined'),  -- Катя
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111107', 'participant', 'joined'),  -- Андрій
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111108', 'participant', 'joined'),  -- Максим
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111105', 'participant', 'joined')   -- Юля
on conflict (event_id, user_id) do nothing;

-- Сніданок у кафе (food) — +2 учасники: Маша, Юля (майже заповнено з 6 слотів!)
insert into public.event_participants (event_id, user_id, role, status) values
  ('623ac418-5afc-49e4-91d6-7c7d8c43c2f1', '11111111-1111-1111-1111-111111111103', 'participant', 'joined'),  -- Маша
  ('623ac418-5afc-49e4-91d6-7c7d8c43c2f1', '11111111-1111-1111-1111-111111111105', 'participant', 'joined')   -- Юля
on conflict (event_id, user_id) do nothing;

-- Настільні ігри (games, приватне) — +4 учасники: Оля, Катя, Максим, Андрій
insert into public.event_participants (event_id, user_id, role, status) values
  ('5c87e313-1c39-40e9-bf1b-05d1e17de3ad', '11111111-1111-1111-1111-111111111101', 'participant', 'joined'),  -- Оля
  ('5c87e313-1c39-40e9-bf1b-05d1e17de3ad', '11111111-1111-1111-1111-111111111102', 'participant', 'joined'),  -- Катя
  ('5c87e313-1c39-40e9-bf1b-05d1e17de3ad', '11111111-1111-1111-1111-111111111108', 'participant', 'joined'),  -- Максим
  ('5c87e313-1c39-40e9-bf1b-05d1e17de3ad', '11111111-1111-1111-1111-111111111107', 'participant', 'joined')   -- Андрій
on conflict (event_id, user_id) do nothing;

-- ============================================================
-- ПЕРЕВІРКА
-- ============================================================
select
  e.id,
  e.title,
  e.category,
  e.is_public,
  e.max_participants,
  count(ep.id) filter (where ep.status = 'joined') as joined_count,
  (select count(*) from public.event_chats ec where ec.event_id = e.id) as has_chat
from public.events e
left join public.event_participants ep on ep.event_id = e.id
group by e.id, e.title, e.category, e.is_public, e.max_participants
order by e.title;
