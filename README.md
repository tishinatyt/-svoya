# СВОЯ — жіночий клуб

Канонічний вихідний код проєкту **СВОЯ**.

Цей репозиторій є джерелом істини для подальшої розробки. ChatGPT Site і скриншоти використовуються лише як референс для відновлення зовнішнього вигляду; застосунок живе тут як звичайний React/TypeScript/Supabase-проєкт.

## Архітектура

- `/` — публічна стартова сторінка-прев'ю.
- `/club?section=feed` — стрічка клубу.
- `/club?section=event` — події.
- `/club?section=circle` — свої кола.
- `/club?section=beauty` — б'юті.
- `/club?section=business` — бізнес.
- `/club?section=help` — допомога.
- `/create` — створення зустрічі / події.
- `/event/:id` — картка події.
- `/event/:id/chat` — чат події.
- `/my-events` — мої зустрічі та заявки.
- `/chats` — чати.
- `/profile` — профіль учасниці.

## Технічна база

- React 19 + TypeScript
- Vite 6 + Tailwind CSS 4
- Supabase Auth / Postgres / RLS / Storage / Realtime
- Leaflet / OpenStreetMap
- PWA / service worker

Функціональна база відновлена з перевіреної робочої версії PORUCH, а інтерфейс СВОЯ — з оригінального ChatGPT Site та підтверджених скриншотів.

## Зафіксовані екрани

У вихідниках відтворені:
- стартова СВОЯ;
- основна платформа / стрічка;
- Події;
- Свої кола;
- Б'юті;
- Бізнес;
- Допомога.

Деталі відновлення та правило «нічого не вигадувати» — у [docs/SVOYA_RECOVERY.md](docs/SVOYA_RECOVERY.md).

## Локальний запуск

```bash
cp .env.example .env
npm ci
npm run dev
```

Для production-збірки:

```bash
npm run build
```

Базовий шлях для деплою можна задати через `VITE_BASE_PATH`, наприклад:

```bash
VITE_BASE_PATH=/startai/svoya/ npm run build
```

## Supabase

Міграції зберігаються у `supabase/migrations/`. Не запускати історичні seed-міграції проти production без перевірки.

Публічний anon/publishable key може використовуватись фронтендом. Service-role key, DB password та інші секрети в репозиторій не додавати.
