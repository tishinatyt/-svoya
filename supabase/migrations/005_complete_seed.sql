-- ============================================================
-- MeetNow — Повний seed: усі категорії, публічні події
-- Виконати в: Supabase Dashboard → SQL Editor → Run
-- Ідемпотентний (ON CONFLICT DO NOTHING скрізь)
-- Включає події з 004 + нові публічні для bar/games/art/other
-- ============================================================

-- get_event_coords function (idempotent)
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
-- Юзери (з 002_seed.sql):
-- 111...01 Оля     female 24
-- 111...02 Катя    female 28
-- 111...03 Маша    female 31
-- 111...04 Вика    female 22
-- 111...05 Юля     female 35
-- 111...06 Аня     female 26
-- 111...07 Андрій  male   25
-- 111...08 Максим  male   30
-- 111...09 Дмитро  male   28
-- 111...10 Олена   female 27
-- ============================================================

insert into public.events (
  id, title, description, category, is_public,
  organizer_id, cover_photo_url, location, address_text,
  event_datetime, max_participants, min_age, max_age, gender_filter, status
) values

-- ── CINEMA ──────────────────────────────────────────────────
(
  '700fbd69-6d24-4fd6-a603-799e41a179f0',
  'Кіновечір: новий Marvel',
  'Йдемо на прем''єру разом, потім кава і обговорення фільму. Беремо квитки заздалегідь — пишіть в чат!',
  'cinema', true,
  '11111111-1111-1111-1111-111111111101',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600',
  ST_SetSRID(ST_MakePoint(31.2850, 51.4960), 4326)::geography,
  'Кінотеатр Мультиплекс, вул. Шевченка 1, Чернігів',
  now() + interval '2 days' + interval '18 hours',
  8, 18, 35, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567801',
  'Документальний фільм про природу',
  'Дивимось новий документальний фільм BBC разом у кінотеатрі. Після — обговорення за кавою ☕',
  'cinema', true,
  '11111111-1111-1111-1111-111111111104',
  null,
  ST_SetSRID(ST_MakePoint(31.2810, 51.4950), 4326)::geography,
  'Кінотеатр Україна, вул. Київська 5, Чернігів',
  now() + interval '4 days' + interval '15 hours',
  10, 18, 45, 'any', 'upcoming'
),

-- ── THEATRE ─────────────────────────────────────────────────
(
  '02241340-ccb9-40f8-9064-1a4ac514e518',
  'Вистава «Зойчина квартира»',
  'Запрошую в Чернігівський обласний театр. У мене є зайвий квиток, шукаю компанію. Після — прогулянка набережною.',
  'theatre', true,
  '11111111-1111-1111-1111-111111111102',
  'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=600',
  ST_SetSRID(ST_MakePoint(31.2935, 51.4975), 4326)::geography,
  'Чернігівський обласний театр ім. Шевченка, Чернігів',
  now() + interval '1 day' + interval '19 hours',
  12, 20, 45, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567802',
  'Студентська вистава в театр-студії',
  'Молодіжна вистава за Чеховим. Місць небагато, тому хапайте швидше 🎭 Вхід безкоштовний.',
  'theatre', true,
  '11111111-1111-1111-1111-111111111105',
  null,
  ST_SetSRID(ST_MakePoint(31.2900, 51.4965), 4326)::geography,
  'Театр-студія «Резонанс», вул. Музична 3, Чернігів',
  now() + interval '5 days' + interval '18 hours',
  20, 17, 35, 'any', 'upcoming'
),

-- ── BAR (PUBLIC) ─────────────────────────────────────────────
(
  '4dd405b2-1200-4348-b4b6-9cb5a6448553',
  'П''ятнична вечірка в Arbat Bar',
  'Збираємось невеликою компанією — музика, коктейлі, хороший настрій. Тільки перевірені люди 🍹',
  'bar', false,
  '11111111-1111-1111-1111-111111111107',
  null,
  ST_SetSRID(ST_MakePoint(31.2895, 51.4985), 4326)::geography,
  'Arbat Bar, пр. Миру, Чернігів',
  now() + interval '1 day' + interval '21 hours',
  15, 21, 40, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567803',
  'Крафтовий пивний вечір у BEER.UA',
  'Дегустуємо 5 сортів крафтового пива від українських пивоварень. Розповідаю про кожен сорт 🍺 Без претензій, просто весело!',
  'bar', true,
  '11111111-1111-1111-1111-111111111108',
  'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=600',
  ST_SetSRID(ST_MakePoint(31.2880, 51.4980), 4326)::geography,
  'BEER.UA, вул. Гетьмана Полуботка 12, Чернігів',
  now() + interval '3 days' + interval '19 hours',
  10, 21, 45, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567804',
  'Настільні ігри + коктейлі в Sky Bar',
  'Займаємо великий стіл у Sky Bar — будуть і ігри, і смачні коктейлі 🎲🍹 Ідеально для знайомства з новими людьми!',
  'bar', true,
  '11111111-1111-1111-1111-111111111106',
  null,
  ST_SetSRID(ST_MakePoint(31.2910, 51.4990), 4326)::geography,
  'Sky Bar, вул. Рокосовського 6, Чернігів',
  now() + interval '6 days' + interval '20 hours',
  12, 21, 40, 'any', 'upcoming'
),

-- ── SPORT ───────────────────────────────────────────────────
(
  '80fbffd7-2c64-4e14-8b6a-bd1b2f53a1ca',
  'Ранкова пробіжка в Парку Перемоги',
  'Збираємось о 7:00 біля головного входу. Темп легкий, 5 км. Після — розтяжка та кава неподалік ☕🏃',
  'sport', true,
  '11111111-1111-1111-1111-111111111108',
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600',
  ST_SetSRID(ST_MakePoint(31.2840, 51.5015), 4326)::geography,
  'Парк Перемоги, головний вхід, Чернігів',
  now() + interval '1 day' + interval '7 hours',
  10, 18, 45, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567805',
  'Волейбол на пляжі біля Десни',
  'Збираємо команду для дружнього волейбольного матчу. Рівень — будь-який, головне настрій 🏐',
  'sport', true,
  '11111111-1111-1111-1111-111111111107',
  null,
  ST_SetSRID(ST_MakePoint(31.2950, 51.5030), 4326)::geography,
  'Пляж «Дніпрянський», берег Десни, Чернігів',
  now() + interval '2 days' + interval '14 hours',
  16, 18, 40, 'any', 'upcoming'
),

-- ── MUSIC ───────────────────────────────────────────────────
(
  'fb448e4b-c8dc-43af-a342-ab3208ed1593',
  'Акустичний вечір на набережній',
  'Граю на гітарі, шукаю людей які люблять живу музику. Будемо сидіти на набережній Десни, заходи сонця та пісні 🎸',
  'music', true,
  '11111111-1111-1111-1111-111111111103',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  ST_SetSRID(ST_MakePoint(31.2901, 51.4991), 4326)::geography,
  'Набережна Десни, Чернігів',
  now() + interval '3 days' + interval '19 hours' + interval '30 minutes',
  20, 18, 50, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567806',
  'Джем-сейшн для музикантів і слухачів',
  'Відкритий джем у кафе — приходьте з інструментами або просто послухати 🎷🥁 Жанр довільний.',
  'music', true,
  '11111111-1111-1111-1111-111111111109',
  null,
  ST_SetSRID(ST_MakePoint(31.2870, 51.4960), 4326)::geography,
  'Кафе «Мелодія», вул. Шевченка 22, Чернігів',
  now() + interval '5 days' + interval '19 hours',
  15, 16, 55, 'any', 'upcoming'
),

-- ── FOOD ────────────────────────────────────────────────────
(
  '623ac418-5afc-49e4-91d6-7c7d8c43c2f1',
  'Сніданок у затишному кафе',
  'Шукаю компанію на неспішний ранковий сніданок. Знаю класне місце з домашньою випічкою ☕🥐',
  'food', true,
  '11111111-1111-1111-1111-111111111106',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600',
  ST_SetSRID(ST_MakePoint(31.2876, 51.4972), 4326)::geography,
  'Кафе Continental, пр. Миру 20, Чернігів',
  now() + interval '1 day' + interval '10 hours',
  6, 18, 40, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567807',
  'Спільна готовка: борщ та вареники',
  'Готуємо традиційну українську страву разом у моїй кухні. Навчу робити вареники з нуля 🥟 Потім разом їмо!',
  'food', true,
  '11111111-1111-1111-1111-111111111103',
  null,
  ST_SetSRID(ST_MakePoint(31.2860, 51.4955), 4326)::geography,
  'Вул. Незалежності 8, Чернігів (адреса в чаті)',
  now() + interval '4 days' + interval '13 hours',
  8, 18, 45, 'any', 'upcoming'
),

-- ── GAMES (PUBLIC) ───────────────────────────────────────────
(
  '5c87e313-1c39-40e9-bf1b-05d1e17de3ad',
  'Вечір настільних ігор (приватний)',
  'Маємо Каркасон, Колонізаторів і Ticket to Ride. Місць небагато. Досвід не обов''язковий! 🎲',
  'games', false,
  '11111111-1111-1111-1111-111111111109',
  null,
  ST_SetSRID(ST_MakePoint(31.2860, 51.4940), 4326)::geography,
  'Вул. Рокосовського, Чернігів (адреса в чаті)',
  now() + interval '4 days' + interval '18 hours',
  8, 18, 40, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567808',
  'Настільні ігри в кав''ярні Board Game Club',
  'Клуб настільних ігор — щотижнева зустріч у кафе. Є понад 50 ігор, від простих до складних 🎲 Вхід вільний!',
  'games', true,
  '11111111-1111-1111-1111-111111111104',
  'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=600',
  ST_SetSRID(ST_MakePoint(31.2888, 51.4968), 4326)::geography,
  'Кав''ярня «Ход конем», вул. Музична 7, Чернігів',
  now() + interval '2 days' + interval '17 hours',
  16, 16, 50, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567809',
  'Квест-вечір: детектив у місті',
  'Міський квест — вирішуємо загадки, ходимо по вулицях Чернігова і шукаємо підказки 🔍 Команда 4-6 осіб.',
  'games', true,
  '11111111-1111-1111-1111-111111111105',
  null,
  ST_SetSRID(ST_MakePoint(31.2920, 51.4975), 4326)::geography,
  'Старт: площа Червона, Чернігів',
  now() + interval '6 days' + interval '16 hours',
  12, 18, 45, 'any', 'upcoming'
),

-- ── WALK ────────────────────────────────────────────────────
(
  'acb6faad-8679-46b7-a1d0-59bd5580125d',
  'Прогулянка Валом та Дитинцем',
  'Йду досліджувати історичний центр Чернігова — Вал, Дитинець, стародавні собори. Люблю розповідати цікаві факти 🏰',
  'walk', true,
  '11111111-1111-1111-1111-111111111110',
  'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=600',
  ST_SetSRID(ST_MakePoint(31.2922, 51.4963), 4326)::geography,
  'Вал (Дитинець), початок біля Спаського собору, Чернігів',
  now() + interval '2 days' + interval '16 hours',
  10, 18, 60, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567810',
  'Вечірня прогулянка набережною Десни',
  'Зустрічаємось біля моста, йдемо набережною до парку та назад. Приблизно 6 км в спокійному темпі 🌅',
  'walk', true,
  '11111111-1111-1111-1111-111111111101',
  null,
  ST_SetSRID(ST_MakePoint(31.2935, 51.4998), 4326)::geography,
  'Міст через Десну, Чернігів',
  now() + interval '3 days' + interval '18 hours',
  15, 18, 55, 'any', 'upcoming'
),

-- ── ART (new!) ───────────────────────────────────────────────
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567811',
  'Пленер: замальовки старого Чернігова',
  'Малюємо акварель. Збираємось біля Спаського собору та малюємо архітектуру разом 🎨 Матеріали свої, рівень — будь-який.',
  'art', true,
  '11111111-1111-1111-1111-111111111102',
  'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600',
  ST_SetSRID(ST_MakePoint(31.2916, 51.4959), 4326)::geography,
  'Спаський собор, Дитинець, Чернігів',
  now() + interval '3 days' + interval '11 hours',
  12, 16, 60, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567812',
  'Майстер-клас: ліплення з глини',
  'Навчаю основам гончарства — ліпимо невеличкі вироби руками 🏺 Матеріали і обпал включено в участь. Дуже медитативно!',
  'art', true,
  '11111111-1111-1111-1111-111111111110',
  null,
  ST_SetSRID(ST_MakePoint(31.2845, 51.4945), 4326)::geography,
  'Майстерня «Глина та Форма», вул. Пирогова 4, Чернігів',
  now() + interval '5 days' + interval '15 hours',
  8, 16, 55, 'any', 'upcoming'
),

-- ── OTHER (new!) ─────────────────────────────────────────────
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567813',
  'Мовний обмін: українська ↔ англійська',
  'Language exchange — практикуємо розмовну мову в парах і невеликих групах ☕ Рівень будь-який, головне бажання говорити!',
  'other', true,
  '11111111-1111-1111-1111-111111111109',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600',
  ST_SetSRID(ST_MakePoint(31.2866, 51.4970), 4326)::geography,
  'Кафе «Подорожник», пр. Перемоги 42, Чернігів',
  now() + interval '4 days' + interval '18 hours',
  14, 16, 50, 'any', 'upcoming'
),
(
  'a1b2c3d4-e5f6-7890-ab12-cd34ef567814',
  'Зустріч нових людей: знайомимось у парку',
  'Просто приходимо, знайомимось, спілкуємось 😊 Ніяких сценаріїв — просто гарна компанія та свіже повітря. Беріть каву з собою!',
  'other', true,
  '11111111-1111-1111-1111-111111111106',
  null,
  ST_SetSRID(ST_MakePoint(31.2875, 51.5005), 4326)::geography,
  'Центральний парк, головна алея, Чернігів',
  now() + interval '1 day' + interval '16 hours',
  20, 18, 45, 'any', 'upcoming'
)

on conflict (id) do nothing;

-- ============================================================
-- УЧАСНИКИ
-- Організатор вже є через тригер. Додаємо додаткових.
-- ============================================================

-- cinema: Кіновечір +4
insert into public.event_participants (event_id, user_id, role, status) values
  ('700fbd69-6d24-4fd6-a603-799e41a179f0', '11111111-1111-1111-1111-111111111102', 'participant', 'joined'),
  ('700fbd69-6d24-4fd6-a603-799e41a179f0', '11111111-1111-1111-1111-111111111103', 'participant', 'joined'),
  ('700fbd69-6d24-4fd6-a603-799e41a179f0', '11111111-1111-1111-1111-111111111106', 'participant', 'joined'),
  ('700fbd69-6d24-4fd6-a603-799e41a179f0', '11111111-1111-1111-1111-111111111107', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- sport: Пробіжка +3
insert into public.event_participants (event_id, user_id, role, status) values
  ('80fbffd7-2c64-4e14-8b6a-bd1b2f53a1ca', '11111111-1111-1111-1111-111111111101', 'participant', 'joined'),
  ('80fbffd7-2c64-4e14-8b6a-bd1b2f53a1ca', '11111111-1111-1111-1111-111111111106', 'participant', 'joined'),
  ('80fbffd7-2c64-4e14-8b6a-bd1b2f53a1ca', '11111111-1111-1111-1111-111111111109', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- sport: Волейбол +4
insert into public.event_participants (event_id, user_id, role, status) values
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567805', '11111111-1111-1111-1111-111111111101', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567805', '11111111-1111-1111-1111-111111111103', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567805', '11111111-1111-1111-1111-111111111104', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567805', '11111111-1111-1111-1111-111111111108', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- music: Акустичний вечір +5
insert into public.event_participants (event_id, user_id, role, status) values
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111101', 'participant', 'joined'),
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111102', 'participant', 'joined'),
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111107', 'participant', 'joined'),
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111108', 'participant', 'joined'),
  ('fb448e4b-c8dc-43af-a342-ab3208ed1593', '11111111-1111-1111-1111-111111111105', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- food: Сніданок +2
insert into public.event_participants (event_id, user_id, role, status) values
  ('623ac418-5afc-49e4-91d6-7c7d8c43c2f1', '11111111-1111-1111-1111-111111111103', 'participant', 'joined'),
  ('623ac418-5afc-49e4-91d6-7c7d8c43c2f1', '11111111-1111-1111-1111-111111111105', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- bar: Крафтове пиво +3
insert into public.event_participants (event_id, user_id, role, status) values
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567803', '11111111-1111-1111-1111-111111111107', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567803', '11111111-1111-1111-1111-111111111109', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567803', '11111111-1111-1111-1111-111111111110', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- games: Board Game Club +4
insert into public.event_participants (event_id, user_id, role, status) values
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567808', '11111111-1111-1111-1111-111111111101', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567808', '11111111-1111-1111-1111-111111111102', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567808', '11111111-1111-1111-1111-111111111109', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567808', '11111111-1111-1111-1111-111111111110', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- art: Пленер +3
insert into public.event_participants (event_id, user_id, role, status) values
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567811', '11111111-1111-1111-1111-111111111104', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567811', '11111111-1111-1111-1111-111111111105', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567811', '11111111-1111-1111-1111-111111111110', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- walk: Прогулянка набережною +2
insert into public.event_participants (event_id, user_id, role, status) values
  ('acb6faad-8679-46b7-a1d0-59bd5580125d', '11111111-1111-1111-1111-111111111102', 'participant', 'joined'),
  ('acb6faad-8679-46b7-a1d0-59bd5580125d', '11111111-1111-1111-1111-111111111105', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- other: Мовний обмін +3
insert into public.event_participants (event_id, user_id, role, status) values
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567813', '11111111-1111-1111-1111-111111111101', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567813', '11111111-1111-1111-1111-111111111103', 'participant', 'joined'),
  ('a1b2c3d4-e5f6-7890-ab12-cd34ef567813', '11111111-1111-1111-1111-111111111108', 'participant', 'joined')
on conflict (event_id, user_id) do nothing;

-- ============================================================
-- ПЕРЕВІРКА
-- ============================================================
select
  e.category,
  e.is_public,
  count(distinct e.id) as events_count,
  sum(count(ep.id)) over (partition by e.category, e.is_public) as total_participants
from public.events e
left join public.event_participants ep on ep.event_id = e.id and ep.status = 'joined'
group by e.category, e.is_public
order by e.category, e.is_public desc;
