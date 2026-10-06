-- ============================================================
-- MeetNow — Seed: тестові дані + Storage bucket
-- Вставити в Supabase SQL Editor після 001_initial.sql
-- ============================================================

-- ============================================================
-- STORAGE: bucket для аватарів
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true;

-- Storage RLS: будь-хто може читати, тільки власник може завантажувати
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (string_to_array(name, '/'))[1]);

create policy "avatars_owner_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (string_to_array(name, '/'))[1]);

-- ============================================================
-- TEST USERS: вставити в auth.users + public.users
-- ============================================================

do $$
declare
  -- UUIDs для тестових користувачів
  u_olya    uuid := 'aaaaaaaa-0001-0001-0001-000000000001';
  u_katya   uuid := 'aaaaaaaa-0001-0001-0001-000000000002';
  u_masha   uuid := 'aaaaaaaa-0001-0001-0001-000000000003';
  u_vika    uuid := 'aaaaaaaa-0001-0001-0001-000000000004';
  u_yulia   uuid := 'aaaaaaaa-0001-0001-0001-000000000005';
  u_anya    uuid := 'aaaaaaaa-0001-0001-0001-000000000006';
  u_dasha   uuid := 'aaaaaaaa-0001-0001-0001-000000000007';
  u_natalya uuid := 'aaaaaaaa-0001-0001-0001-000000000008';
  u_iryna   uuid := 'aaaaaaaa-0001-0001-0001-000000000009';
  u_olena   uuid := 'aaaaaaaa-0001-0001-0001-000000000010';
  u_andriy  uuid := 'aaaaaaaa-0001-0001-0001-000000000011';
  u_maxim   uuid := 'aaaaaaaa-0001-0001-0001-000000000012';
  u_dmytro  uuid := 'aaaaaaaa-0001-0001-0001-000000000013';
  u_oleg    uuid := 'aaaaaaaa-0001-0001-0001-000000000014';
  u_artem   uuid := 'aaaaaaaa-0001-0001-0001-000000000015';
begin

  -- -------------------------------------------------------
  -- 1. auth.users (потрібно для FK constraint)
  -- -------------------------------------------------------
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (u_olya,    'olya@test.meetnow',    '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Оля"}',    'authenticated', 'authenticated', '', '', '', ''),
    (u_katya,   'katya@test.meetnow',   '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Катя"}',   'authenticated', 'authenticated', '', '', '', ''),
    (u_masha,   'masha@test.meetnow',   '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Маша"}',   'authenticated', 'authenticated', '', '', '', ''),
    (u_vika,    'vika@test.meetnow',    '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Віка"}',   'authenticated', 'authenticated', '', '', '', ''),
    (u_yulia,   'yulia@test.meetnow',   '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Юля"}',    'authenticated', 'authenticated', '', '', '', ''),
    (u_anya,    'anya@test.meetnow',    '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Аня"}',    'authenticated', 'authenticated', '', '', '', ''),
    (u_dasha,   'dasha@test.meetnow',   '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Даша"}',   'authenticated', 'authenticated', '', '', '', ''),
    (u_natalya, 'natalya@test.meetnow', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Наталя"}', 'authenticated', 'authenticated', '', '', '', ''),
    (u_iryna,   'iryna@test.meetnow',   '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Ірина"}',  'authenticated', 'authenticated', '', '', '', ''),
    (u_olena,   'olena@test.meetnow',   '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Олена"}',  'authenticated', 'authenticated', '', '', '', ''),
    (u_andriy,  'andriy@test.meetnow',  '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Андрій"}', 'authenticated', 'authenticated', '', '', '', ''),
    (u_maxim,   'maxim@test.meetnow',   '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Максим"}', 'authenticated', 'authenticated', '', '', '', ''),
    (u_dmytro,  'dmytro@test.meetnow',  '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Дмитро"}', 'authenticated', 'authenticated', '', '', '', ''),
    (u_oleg,    'oleg@test.meetnow',    '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Олег"}',   'authenticated', 'authenticated', '', '', '', ''),
    (u_artem,   'artem@test.meetnow',   '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{"full_name":"Артем"}',  'authenticated', 'authenticated', '', '', '', '')
  on conflict (id) do nothing;

  -- -------------------------------------------------------
  -- 2. public.users
  -- Аватари — публічні фото з ui-avatars.com (не треба завантажувати)
  -- -------------------------------------------------------
  insert into public.users (id, name, age, gender, avatar_url, google_verified) values
    (u_olya,    'Оля',    24, 'female', 'https://ui-avatars.com/api/?name=Оля&background=ec4899&color=fff&size=200',    true),
    (u_katya,   'Катя',   28, 'female', 'https://ui-avatars.com/api/?name=Катя&background=8b5cf6&color=fff&size=200',   true),
    (u_masha,   'Маша',   31, 'female', 'https://ui-avatars.com/api/?name=Маша&background=f59e0b&color=fff&size=200',   true),
    (u_vika,    'Віка',   22, 'female', 'https://ui-avatars.com/api/?name=Віка&background=10b981&color=fff&size=200',   true),
    (u_yulia,   'Юля',    35, 'female', 'https://ui-avatars.com/api/?name=Юля&background=ef4444&color=fff&size=200',    true),
    (u_anya,    'Аня',    26, 'female', 'https://ui-avatars.com/api/?name=Аня&background=6366f1&color=fff&size=200',    true),
    (u_dasha,   'Даша',   23, 'female', 'https://ui-avatars.com/api/?name=Даша&background=f97316&color=fff&size=200',   true),
    (u_natalya, 'Наталя', 29, 'female', 'https://ui-avatars.com/api/?name=Наталя&background=14b8a6&color=fff&size=200', true),
    (u_iryna,   'Ірина',  33, 'female', 'https://ui-avatars.com/api/?name=Ірина&background=a855f7&color=fff&size=200',  true),
    (u_olena,   'Олена',  27, 'female', 'https://ui-avatars.com/api/?name=Олена&background=06b6d4&color=fff&size=200',  true),
    (u_andriy,  'Андрій', 25, 'male',   'https://ui-avatars.com/api/?name=Андрій&background=3b82f6&color=fff&size=200', true),
    (u_maxim,   'Максим', 30, 'male',   'https://ui-avatars.com/api/?name=Максим&background=1d4ed8&color=fff&size=200', true),
    (u_dmytro,  'Дмитро', 28, 'male',   'https://ui-avatars.com/api/?name=Дмитро&background=7c3aed&color=fff&size=200', true),
    (u_oleg,    'Олег',   34, 'male',   'https://ui-avatars.com/api/?name=Олег&background=dc2626&color=fff&size=200',   true),
    (u_artem,   'Артем',  22, 'male',   'https://ui-avatars.com/api/?name=Артем&background=059669&color=fff&size=200',  true)
  on conflict (id) do nothing;

  -- -------------------------------------------------------
  -- 3. activities — 20 штук по Чернігову
  -- Координати центру: 51.4982, 31.2893
  -- Розкид ±0.01–0.03 градуса (~1–3 км)
  -- -------------------------------------------------------
  insert into public.activities
    (user_id, type, description, looking_for_gender, age_min, age_max, when_time, location, lat, lng, status)
  values

    -- Прогулянки
    (u_olya,    'walk',       'Іду гуляти набережною Десни, хтось складе компанію? 🌊',
     'any',    20, 35,  now() + interval '30 minutes',  'Набережна Десни',           51.4991, 31.2901, 'active'),

    (u_andriy,  'walk',       'Пробіжка в Парку Перемоги, темп спокійний 🏃‍♂️',
     'female',  18, 30,  now() + interval '1 hour',     'Парк Перемоги',             51.5010, 31.2850, 'active'),

    (u_dasha,   'walk',       'Вечірня прогулянка по Валу, дуже люблю це місце 🌿',
     'male',    22, 32,  now() + interval '2 hours',    'Вал (Дитинець)',             51.4963, 31.2922, 'active'),

    -- Кафе
    (u_katya,   'cafe',       'Йду на каву на пр. Миру, шукаю подругу ☕',
     'female',  22, 35,  now() + interval '20 minutes', 'пр. Миру, центр',           51.4975, 31.2880, 'active'),

    (u_maxim,   'cafe',       'Сиджу в Starbucks (пр. Миру), можна приєднатись ☕📚',
     'any',     20, 40,  now(),                         'Starbucks, пр. Миру',       51.4972, 31.2876, 'active'),

    (u_anya,    'cafe',       'Шукаю компанію на сніданок, знаю класне місце 🥐',
     'any',     20, 30,  now() + interval '45 minutes', 'Кафе Континент',            51.4980, 31.2860, 'active'),

    -- Бар
    (u_vika,    'bar',        'Хтось на пиво в Хмільний Рай сьогодні ввечері? 🍺',
     'male',    23, 35,  now() + interval '4 hours',    'Хмільний Рай',              51.4968, 31.2910, 'active'),

    (u_dmytro,  'bar',        'Йду в Arbat Bar о 20:00, шукаю компанію 🍻',
     'any',     21, 35,  now() + interval '3 hours',    'Arbat Bar',                 51.4985, 31.2895, 'active'),

    (u_yulia,   'bar',        'Cocktail evening в центрі 🍹 Шукаю нових знайомих!',
     'male',    28, 42,  now() + interval '5 hours',    'Центр міста',               51.4978, 31.2888, 'active'),

    -- Спорт
    (u_andriy,  'sport',      'Футбол на стадіоні Юність, потрібен ще один гравець ⚽',
     'male',    18, 35,  now() + interval '2 hours',    'Стадіон Юність',            51.5020, 31.2840, 'active'),

    (u_iryna,   'sport',      'Бадмінтон у спортзалі, граю для задоволення 🏸',
     'any',     20, 40,  now() + interval '90 minutes', 'СК Авангард',               51.4950, 31.2870, 'active'),

    (u_artem,   'sport',      'Велопрогулянка через Єлецький монастир 🚴 20 км',
     'any',     18, 35,  now() + interval '1 hour',     'Старт: пл. Перемоги',       51.4990, 31.2920, 'active'),

    -- Кіно
    (u_natalya, 'cinema',     'Йду в Multiplex на 18:30, не хочу сама 🎬',
     'male',    25, 38,  now() + interval '3 hours',    'Multiplex Чернігів',        51.4960, 31.2850, 'active'),

    (u_oleg,    'cinema',     'Шукаю когось на новий Marvel, сьогодні о 19:30 🦸',
     'female',  20, 32,  now() + interval '4 hours',    'Кінотеатр Україна',         51.4970, 31.2900, 'active'),

    -- Настолки
    (u_masha,   'boardgames', 'Хтось на настолки сьогодні ввечері? 🎲 Є Каркасон і Колонізатори',
     'any',     20, 40,  now() + interval '3 hours',    'Антикафе Простір',          51.4983, 31.2878, 'active'),

    (u_katya,   'boardgames', 'Настольний вечір кожну п\'ятницю! Приєднуйся 🎲',
     'any',     18, 45,  now() + interval '5 hours',    'Кав\'ярня Зернятко',        51.4977, 31.2892, 'active'),

    -- Поїсти
    (u_olena,   'eat',        'Йду в Челентано на обід, компанія? 🍕',
     'any',     20, 35,  now() + interval '30 minutes', 'Піцерія Челентано',         51.4965, 31.2905, 'active'),

    (u_vika,    'eat',        'Хочу спробувати новий грузинський ресторан на Рокосовського 🥘',
     'female',  22, 32,  now() + interval '2 hours',    'вул. Рокосовського',        51.4940, 31.2860, 'active'),

    -- Інше
    (u_dasha,   'other',      'Шукаю партнера для парного малювання в арт-студії 🎨',
     'male',    20, 35,  now() + interval '2 hours',    'Арт-студія Колір',          51.4988, 31.2870, 'active'),

    (u_artem,   'other',      'Йду на виставку в Музей археології, цікаво разом? 🏛️',
     'any',     18, 45,  now() + interval '1 hour',     'Музей археології Чернігів', 51.4955, 31.2935, 'active')

  on conflict do nothing;

end $$;

-- ============================================================
-- Перевірка
-- ============================================================
select 'users' as table_name, count(*)::text as rows from public.users
union all
select 'activities', count(*)::text from public.activities
union all
select 'auth.users', count(*)::text from auth.users where email like '%@test.meetnow';
