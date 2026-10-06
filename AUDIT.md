# MeetNow — Full Project Audit
**Date:** 2026-08-17
**Auditor:** Claude Code (claude-sonnet-4-6)
**Scope:** Read-only analysis — no code was modified.

---

## 1. PROJECT STRUCTURE

### src/ Tree

```
src/
├── App.tsx                        — Router root: defines all routes, hides BottomNav on /event/*
├── index.css                      — Global Tailwind styles
├── main.tsx                       — Vite entry point, mounts <App />
├── vite-env.d.ts                  — Vite type declarations
│
├── components/
│   ├── ActivityCard.tsx           — OLD: Card for activities feed; uses old activities/interests tables
│   ├── AdCard.tsx                 — OLD: Renders ad_cards (banner ads); used in old Feed page
│   ├── BottomNav.tsx              — Main tab navigation bar (Home, Create, Chats, Profile)
│   ├── CategoryPlaceholder.tsx    — Gradient fallback image for events without a cover photo
│   ├── EventMap.tsx               — Leaflet map showing event location
│   └── ProtectedRoute.tsx         — Auth guard: redirects to Onboarding if not logged in
│
├── contexts/
│   └── AuthContext.tsx            — Supabase auth state, supaUser, user profile
│
├── hooks/
│   ├── useActivities.ts           — OLD: Fetches activities via activities_nearby RPC
│   ├── useEvent.ts                — ACTIVE: Fetches single event + participants + coords
│   ├── useMatches.ts              — OLD: Fetches matches table for old P2P matching
│   └── useMessages.ts             — OLD: Fetches/sends messages in old matches-based chat
│
├── lib/
│   ├── activityMeta.ts            — OLD: Labels/icons for old activity types
│   ├── geo.ts                     — getCurrentPosition() geolocation helper
│   └── supabase.ts                — Supabase client (reads from VITE_ env vars)
│
├── pages/
│   ├── Chat.tsx                   — OLD: 1-on-1 match chat (uses old messages/matches tables)
│   ├── Chats.tsx                  — ACTIVE: List of event group chats the user belongs to
│   ├── CreateActivity.tsx         — OLD: Creates entries in the old activities table
│   ├── EventChat.tsx              — ACTIVE: Real-time group chat for an event
│   ├── EventChatPlaceholder.tsx   — DEAD STUB: Replaced by EventChat.tsx; still exists on disk
│   ├── EventDetail.tsx            — ACTIVE: Event detail page with join button and map
│   ├── Feed.tsx                   — OLD: Old activities feed page (routed to /feed-old)
│   ├── HomeScreen.tsx             — ACTIVE: Main screen with "Мої події" + "Громадські події"
│   ├── Matches.tsx                — OLD: Displays match list from old matches table
│   ├── Onboarding.tsx             — Auth/onboarding entry screen (Google sign-in)
│   ├── Profile.tsx                — User profile page
│   └── Onboarding/
│       └── CompleteProfile.tsx    — Step to fill name, age, gender after first sign-in
│
└── types/
    └── index.ts                   — Shared TypeScript types (User, Activity, Match, AdCard, etc.)
```

### Routes (App.tsx)

| Path | Component | Status |
|------|-----------|--------|
| `/` | `HomeScreen` | ACTIVE — two-column events screen |
| `/feed-old` | `Feed` | OLD/DEPRECATED — old activities feed, not in nav |
| `/create` | `CreateActivity` | OLD — creates to old `activities` table |
| `/matches` | `Matches` | OLD — reads old `matches` table |
| `/chat/:matchId` | `Chat` | OLD — 1-on-1 match chat via old `messages` table |
| `/profile` | `Profile` | ACTIVE |
| `/chats` | `Chats` | ACTIVE — event group chats list |
| `/event/:id` | `EventDetail` | ACTIVE |
| `/event/:id/chat` | `EventChat` | ACTIVE — real-time group chat |

**Note:** BottomNav hides on `/event/*` routes via `HIDE_NAV_PATTERNS`.

### Git Log — Last 30 Commits (Chronological, oldest → newest)

| # | Hash | Message |
|---|------|---------|
| 1 | `ecf305b` | Remove deposit from flow, add to queue without payment |
| 2 | `f328e0b` | Add name as step 1 in onboarding |
| 3 | `962ddd5` | fix advance(1) to check name-input instead of answers[1] |
| 4 | `16f31ed` | Add preferred time step to create meeting |
| 5 | `ada90ea` | rename button to Pidtverdyty |
| 6 | `1d9b489` | Fix tags-N IDs mismatched after step renaming |
| 7 | `142eb46` | add mock events to events page |
| 8 | `b04b276` | add join button with modal to events |
| 9 | `df5c97f` | add standup format card |
| 10 | `6867e62` | add upcoming events section after formats |
| 11 | `c941324` | add contact step after name |
| 12 | `9f5fe31` | add queue status screen after registration |
| 13 | `d2a8b24` | remove venue picker from main flow |
| 14 | `c3a2eb6` | remove deposit mentions from landing |
| 15 | `25e77a3` | swap formats and events sections order |
| 16 | `4adb75a` | add local events page |
| 17 | `97a169c` | add public/private event types |
| 18 | `2f68541` | redesign global and local events pages |
| 19 | `f831926` | feat: event detail screen /event/:id |
| 20 | `05b4de6` | feat: two-column main screen (Мої/Громадські events) |
| 21 | `eef3b06` | feat: light theme + fix tab bar + fix participants data |
| 22 | `63b2789` | feat: single-button cards + search radius filter |
| 23 | `645fea7` | feat: join button on event detail + category placeholders |
| 24 | `611c31b` | feat: fix category tabs + complete seed SQL for all categories |
| 25 | `df92f13` | fix: join button visibility on event detail page |
| 26 | `732228e` | fix: CTA button hidden by BottomNav on /event/:id |
| 27 | `2c6d93a` | feat: real group event chat replacing placeholder |
| 28 | `ae4474c` | fix: myEvents query returning only 1 of 3 participations |
| 29 | `798e85e` | debug: add step-by-step console logs to fetchMyEvents |
| 30 | `17bb8f8` | fix: ep_select RLS + upsert 403 on event_participants |

**Summary:** Early commits built a P2P "activities" matching flow. Starting around commit 17–19, the architecture pivoted to a group-event/meetup model. The last several commits focus on RLS fixes, duplicate join bugs, and adding real group chat.

---

## 2. DB SCHEMA (Supabase)

All schema is defined across migrations `001_initial.sql` through `005_complete_seed.sql`.

### ACTIVELY USED TABLES

#### `public.users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | References `auth.users(id)` |
| `name` | `text` | |
| `age` | `int` | CHECK 16–100 |
| `gender` | `text` | CHECK: male, female |
| `avatar_url` | `text` | Nullable |
| `google_verified` | `boolean` | Default false |
| `created_at` | `timestamptz` | |

#### `public.events`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `title` | `text` | |
| `description` | `text` | Default '' |
| `category` | `text` | CHECK: cinema, theatre, bar, sport, music, food, games, walk, art, other |
| `is_public` | `boolean` | Default true |
| `organizer_id` | `uuid` | FK → users |
| `cover_photo_url` | `text` | Nullable |
| `location` | `geography(Point, 4326)` | PostGIS point |
| `address_text` | `text` | Human-readable address |
| `event_datetime` | `timestamptz` | |
| `max_participants` | `int` | 1–1000 |
| `min_age` | `int` | ≥16 |
| `max_age` | `int` | ≤100 |
| `gender_filter` | `text` | CHECK: male, female, any |
| `status` | `text` | CHECK: upcoming, active, completed, cancelled |
| `created_at` | `timestamptz` | |

#### `public.event_participants`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `event_id` | `uuid` | FK → events |
| `user_id` | `uuid` | FK → users |
| `role` | `text` | CHECK: organizer, participant |
| `joined_at` | `timestamptz` | |
| `status` | `text` | CHECK: joined, left |
| UNIQUE | `(event_id, user_id)` | Prevents duplicate joins |

#### `public.event_chats`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `event_id` | `uuid` | FK → events; UNIQUE — one chat per event |
| `created_at` | `timestamptz` | |

#### `public.event_chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `event_chat_id` | `uuid` | FK → event_chats |
| `sender_id` | `uuid` | FK → users |
| `content` | `text` | CHECK: length 1–4000 |
| `created_at` | `timestamptz` | |

---

### OLD / NOT USED TABLES

| Table | Used in src/? | Verdict |
|-------|---------------|---------|
| `activities` | YES — `src/pages/CreateActivity.tsx:43`, `src/hooks/useActivities.ts:23` | Still referenced; route is `/create` (in nav). Not safe to delete without removing those pages/hooks first. |
| `interests` | YES — `src/components/ActivityCard.tsx:63,70,73` | Still used in ActivityCard; ActivityCard is used in Feed (/feed-old). |
| `matches` | YES — `src/pages/Chat.tsx:21`, `src/hooks/useMatches.ts:16` | Used in /matches and /chat/:id routes. |
| `messages` | YES — `src/hooks/useMessages.ts:11,38` | Used in Chat.tsx (old 1-on-1 chat). |
| `ad_cards` | YES — `src/pages/Feed.tsx:15` | Used in old Feed page (/feed-old). |

**Conclusion:** All "old" tables are still referenced from old pages/hooks that remain in the codebase. The old pages are not linked from the main UI (except `/create` which is in the BottomNav), but the code has not been deleted. None are safe to delete from the DB until the corresponding frontend code is also removed or migrated.

---

### RLS Policies (Active Tables — from migration 003_events.sql)

#### `events`
| Policy | Operation | Rule |
|--------|-----------|------|
| `events_select_public` | SELECT | `auth.uid() IS NOT NULL AND is_public = true` |
| `events_select_private` | SELECT | `auth.uid() IS NOT NULL AND is_public = false AND is_event_participant(id)` |
| `events_insert` | INSERT | `auth.uid() = organizer_id` |
| `events_update` | UPDATE | `auth.uid() = organizer_id` |
| `events_delete` | DELETE | `auth.uid() = organizer_id` |

#### `event_participants`
| Policy | Operation | Rule |
|--------|-----------|------|
| `ep_select` | SELECT | `auth.uid() IS NOT NULL AND (user_id = auth.uid() OR is_event_participant(event_id))` |
| `ep_insert` | INSERT | `auth.uid() = user_id AND role = 'participant'` |
| `ep_update_own` | UPDATE | `auth.uid() = user_id` |

**Note:** The `ep_select` policy was recently fixed (commit `17bb8f8`) to short-circuit on `user_id = auth.uid()` first, preventing a recursive RLS / STABLE-cache bug when calling `is_event_participant()` for a user's own rows.

#### `event_chats`
| Policy | Operation | Rule |
|--------|-----------|------|
| `ec_select` | SELECT | `auth.uid() IS NOT NULL AND is_event_participant(event_id)` |

No INSERT policy — chats are created via `security definer` trigger.

#### `event_chat_messages`
| Policy | Operation | Rule |
|--------|-----------|------|
| `ecm_select` | SELECT | `auth.uid() IS NOT NULL AND is_event_participant(event_chat_event_id(event_chat_id))` |
| `ecm_insert` | INSERT | `auth.uid() = sender_id AND is_event_participant(event_chat_event_id(event_chat_id))` |

#### `users` (from migration 001)
| Policy | Operation | Rule |
|--------|-----------|------|
| `users_select` | SELECT | `true` (public) |
| `users_insert` | INSERT | `auth.uid() = id` |
| `users_update` | UPDATE | `auth.uid() = id` |

---

### Triggers and RPC Functions

#### Triggers

| Trigger | Table | Function | Purpose |
|---------|-------|----------|---------|
| `trg_organizer_participant` | `events` (AFTER INSERT) | `add_organizer_as_participant()` | Auto-inserts organizer into `event_participants` with role='organizer' on event creation |
| `trg_create_event_chat` | `events` (AFTER INSERT) | `create_event_chat()` | Auto-creates a row in `event_chats` on event creation |
| `trg_activity_geo` | `activities` (BEFORE INSERT/UPDATE) | `set_activity_geo()` | Computes PostGIS `geo` column from `lat`/`lng` (old table) |
| `trg_check_match` | `interests` (AFTER INSERT) | `check_and_create_match()` | Auto-creates match when non-owner expresses interest (old P2P flow) |

#### RPC Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `events_nearby(user_lat, user_lng, radius_km, p_category)` | TABLE | Returns public, upcoming events sorted by proximity; used in HomeScreen |
| `is_event_participant(p_event_id)` | boolean | Checks if `auth.uid()` is an active participant of an event; used in RLS policies |
| `event_chat_event_id(p_chat_id)` | uuid | Maps `event_chat_id` → `event_id`; used in chat RLS policies |
| `event_participant_count(p_event_id)` | int | Counts active participants; called inside `events_nearby` |
| `get_event_coords(p_event_id)` | TABLE(lat, lng) | Extracts lat/lng from PostGIS geography column; used in `useEvent.ts` |
| `events_point(lng, lat)` | geography | Helper to construct a geography point for INSERT; used in seed SQL |
| `activities_nearby(user_lat, user_lng, radius_km)` | TABLE | Old P2P function for the activities feed; still exists in DB |
| `check_and_create_match()` | trigger fn | Auto-match trigger for old interests table |
| `set_activity_geo()` | trigger fn | Auto-compute geo for old activities table |
| `add_organizer_as_participant()` | trigger fn | Auto-add organizer to event_participants |
| `create_event_chat()` | trigger fn | Auto-create event chat on event insert |

---

### Orphaned / Duplicate Data Check

**Issue identified and fixed during today's session:** Duplicate rows in `event_participants` were found (multiple `joined` rows for the same user+event pair). This was fixed by:
1. Cleaning existing duplicates with a deduplication SQL.
2. Adding a `UNIQUE(event_id, user_id)` constraint to `event_participants`.

**Requires user verification with SQL queries:**

```sql
-- Check for any remaining duplicates (should return 0 rows after fix)
SELECT event_id, user_id, count(*)
FROM public.event_participants
WHERE status = 'joined'
GROUP BY event_id, user_id
HAVING count(*) > 1;

-- Check orphaned event_chats (events deleted but chats remain)
SELECT ec.id, ec.event_id
FROM public.event_chats ec
LEFT JOIN public.events e ON e.id = ec.event_id
WHERE e.id IS NULL;

-- Check orphaned event_chat_messages (chat deleted but messages remain)
SELECT ecm.id, ecm.event_chat_id
FROM public.event_chat_messages ecm
LEFT JOIN public.event_chats ec ON ec.id = ecm.event_chat_id
WHERE ec.id IS NULL;
```

---

## 3. KNOWN BUGS AND THEIR STATUS

### Bug 1: RLS Bug with Embedded Join in event_participants
- **Status: FIXED** (commit `17bb8f8`)
- **Description:** The `ep_select` RLS policy called `is_event_participant()` (a STABLE function) for a user's own rows, which caused a recursive evaluation edge case. The fix short-circuits with `user_id = auth.uid()` first, so `is_event_participant()` is never evaluated for self-rows.
- **Also fixed:** The `ep_insert` policy was updated to prevent 403 errors on upsert by enforcing `role = 'participant'` (organizer role is only set via the security-definer trigger).

### Bug 2: Duplicate Rows in event_participants
- **Status: FIXED** (today's session — exact commit not isolated but implied by constraint in 003_events.sql)
- **Description:** Multiple `joined` status rows for the same (event_id, user_id) pair existed in the DB, causing "My Events" to show the same event multiple times, or participant counts to be inflated.
- **Fix:** Duplicates were removed via SQL, and a `UNIQUE(event_id, user_id)` constraint was added to prevent recurrence. The frontend `joinEvent()` function also handles `23505` (unique violation) as a success case.

### Bug 3: Session/Cache Token — "My Events" Shows 1 Card Instead of 3
- **Status: REQUIRES USER VERIFICATION**
- **Description:** In the main browser (not incognito), "Мої події" may display only 1 event card instead of the expected 3. The root cause is suspected to be a stale Supabase session token cached by the browser causing the `event_participants` query to run as the wrong user, or a timing issue where the auth state is resolved from cache before the actual session is refreshed.
- **Debug logging** was added in commit `798e85e` (step-by-step console logs in `fetchMyEvents`). Check browser console for `[Step1]`, `[Step2]`, `[Step3]`, `[Final]` output to isolate whether the issue is at the participation query or the event visibility stage.
- **To verify:** Open browser DevTools → Console, reload the main page, and check the `[Step1] participations:` log. If it shows only 1 participation, the bug is in the auth session / RLS at the `event_participants` level. If it shows 3 but `[Final]` shows 1, the RLS on `events` is blocking the other two.

### TODO / FIXME Comments in Code

**No `TODO` or `FIXME` comments were found in `src/`.** (grep returned no output)

---

## 4. BUILD & TYPE HEALTH

### Build Output

```
> meetnow@0.1.0 build
> tsc -b && vite build

vite v6.3.x building for production...
✓ 112 modules transformed.

dist/index.html                        0.80 kB │ gzip:   0.43 kB
dist/assets/index-Dssc_TFh.css        42.48 kB │ gzip:   7.63 kB
dist/assets/leaflet-src-7ah4FPQk.js  150.12 kB │ gzip:  43.59 kB
dist/assets/index-gN_bk_kc.js        518.71 kB │ gzip: 147.28 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 31.15s

PWA v0.21.2 — mode: generateSW — precache: 18 entries (699.75 KiB)
```

### TypeScript Errors / Warnings

- **Zero TypeScript errors** — `tsc -b` passes cleanly.
- **Build warning:** Main JS chunk (`index-gN_bk_kc.js`) is 518 KB (147 KB gzipped) — exceeds Vite's 500 KB recommendation. This is primarily due to Leaflet (150 KB) and Supabase client being bundled together.
- **Code-quality debt:** Several files use `eslint-disable-next-line @typescript-eslint/no-explicit-any` to cast Supabase responses (notably `HomeScreen.tsx` in `fetchMyEvents`). This is a pragmatic workaround for PostgREST embedded join type inference limitations, not a runtime error.

---

## 5. UNFINISHED / STUBS

### Grep Results for Stub Keywords (case-insensitive)

All matches for `placeholder` in `src/` are either:
1. HTML `placeholder="..."` attributes on `<input>` elements (normal, not stubs).
2. Imports/usage of `CategoryPlaceholder` component (a legitimate, active utility component).
3. `EventChatPlaceholder.tsx` — a dead stub file (see below).

No matches for: `mock`, `temporary`, `stub`, `TODO`, `FIXME` (confirmed zero).

### EventChatPlaceholder.tsx — Dead Stub File

**File:** `src/pages/EventChatPlaceholder.tsx`
**Status: DEAD — safe to delete**

This file was the old placeholder for the group chat feature, displaying "Груповий чат події буде реалізований на наступному етапі." It was replaced by the real `EventChat.tsx` implementation in commit `2c6d93a`. The file **still exists on disk** but is **not imported or routed anywhere** in `App.tsx`. It is completely unreachable code.

### Components/Pages That Look Like Stubs

| File | Assessment |
|------|------------|
| `src/pages/CreateActivity.tsx` | Creates entries in old `activities` table. Functionally works but is the wrong architecture — should create `events` instead. Acts as a functional stub for the "create event" flow. |
| `src/pages/Feed.tsx` | Old activities feed, routed to `/feed-old`. Only accessible by direct URL, not linked from BottomNav. Effectively deprecated. |
| `src/pages/Matches.tsx` | Reads old `matches` table. Linked from BottomNav but reads dead data. Stub-like status. |
| `src/pages/Chat.tsx` | Old 1-on-1 match chat. Route `/chat/:matchId` exists but no UI links to it. Dead code. |

---

## 6. ENV & SECRETS

### .env Variables

| Variable | Declared in .env | Declared in .env.example | Used in code |
|----------|-----------------|--------------------------|--------------|
| `VITE_SUPABASE_URL` | YES | YES | YES — `src/lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | YES | YES | YES — `src/lib/supabase.ts` |
| `VITE_APP_URL` | NO | YES | NOT FOUND in src/ |

**Note:** `VITE_APP_URL` is declared in `.env.example` but missing from the real `.env` and not referenced in `src/`. It is unused.

### .gitignore

`.env*` is listed in `.gitignore` (with `!.env.example` exception). The `.env` file should not appear in normal commits.

### Real .env Committed to Git History

**WARNING: YES — the `.env` file was committed to git history.**

```
commit 24eb5c94dd828b03bc01562fa43570662a6f55e5
Author: tishinatyt <tishinatyt@github.com>
Date:   Wed Apr 29 12:29:57 2026

    sync mock events to gh-pages

Files: .env  events.html  index.html
```

The actual `.env` was part of commit `24eb5c94` (branch: gh-pages or similar). This means the `VITE_SUPABASE_URL` (`https://pqasdmiqnlyyjwmmqeyc.supabase.co`) and `VITE_SUPABASE_ANON_KEY` (`sb_publishable_Ni_SuVPhfR9U2iSpWpOSFw_8qIudiYt`) are **permanently in git history**.

**Since these are Supabase `publishable` (anon) keys**, exposure is lower severity than a service role key — the anon key is meant to be used from the browser and is RLS-protected. However, the URL identifies your project publicly, and if RLS policies have any gaps, this is a risk. Rotating the anon key is recommended.

### Hardcoded API Keys in src/

**No hardcoded Supabase URLs, JWT tokens (`eyJ`), or Anthropic keys found in `src/`.** All credentials are correctly loaded via `import.meta.env.VITE_*`.

---

## 7. SUMMARY — TOP 5 PRIORITY ITEMS

### Priority 1 — SECURITY: Rotate Supabase Anon Key (Medium urgency)
The `.env` file with real credentials was committed in git commit `24eb5c94` and is permanently in history. Although the anon key is browser-safe and protected by RLS, it is now public in the repo. Go to **Supabase Dashboard → Project Settings → API → Reset anon key**. Then update `.env` locally. The old key should be invalidated.

### Priority 2 — BUG VERIFICATION: "My Events" shows 1 card instead of 3
The session/cache token bug (Section 3, Bug 3) is still unconfirmed. Open the app in the main browser (not incognito), reload, open DevTools Console, and check the `[Step1]` debug log output. This determines whether the issue is at the auth/RLS level or at data aggregation. Once root cause is identified, the debug `console.log` statements in `HomeScreen.tsx` (commits `798e85e`) should be removed.

### Priority 3 — CLEANUP: Remove Dead Code (Old Architecture)
The following files/routes belong to the old P2P "activities" flow and are either unreachable or write to obsolete tables. They should be removed:
- `src/pages/EventChatPlaceholder.tsx` — completely unreachable, dead stub
- `src/pages/Feed.tsx` + route `/feed-old`
- `src/pages/CreateActivity.tsx` + route `/create` (or replace with a Create Event page for the new `events` table)
- `src/pages/Matches.tsx` + route `/matches`
- `src/pages/Chat.tsx` + route `/chat/:matchId`
- `src/hooks/useActivities.ts`, `useMatches.ts`, `useMessages.ts`
- `src/components/ActivityCard.tsx`, `AdCard.tsx`
- `src/lib/activityMeta.ts`

### Priority 4 — PERFORMANCE: Code Splitting for Large Bundle
The main JS bundle is 518 KB (147 KB gzipped), exceeding Vite's 500 KB warning threshold. Leaflet alone is 150 KB. Solutions:
- Lazy-load `EventMap.tsx` / Leaflet with `React.lazy()` + `Suspense` (only needed on `/event/:id`)
- Use `vite build.rollupOptions.output.manualChunks` to split Leaflet into its own chunk

### Priority 5 — CODE QUALITY: Remove Debug console.logs + Fix TypeScript `any` casts
- Commit `798e85e` added extensive `console.log` statements in `HomeScreen.tsx` (`fetchMyEvents`). These should be removed once Bug #3 is diagnosed.
- Multiple `// eslint-disable-next-line @typescript-eslint/no-explicit-any` suppressions in `HomeScreen.tsx`. Consider defining proper Supabase response types or using `supabase-js` generic overloads to restore type safety.

---

*Audit generated: 2026-08-17. All findings are based on static analysis of source files and migration SQL — no live DB queries were executed.*
