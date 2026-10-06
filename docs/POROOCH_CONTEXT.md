# Poruch — Project Context

> Source of truth for product semantics and architecture. Before significant work: read this document, then verify the relevant current code and migrations.

## 1. Product

**Current product brand:** **Poruch**.

Legacy technical identifiers may still use `porooch` for compatibility because the GitHub repository and current GitHub Pages deployment remain under `/porooch/`. Do not rename those deployment paths or existing storage keys until a compatible migration is planned.

**Primary UI language:** Ukrainian.

Poruch helps people find people nearby through common interests and turn online discovery into real-life meetings and shared events. Its core concepts are personal meetings/events, public events, nearby discovery by interests, and moving interaction from online to offline.

Event concepts are independent:

- `event_type` (`personal | public`) controls the product/card format: a person-led meeting versus a public activity/event.
- `is_public` controls discovery visibility. `false` means invitation-only and excluded from the general public feed.
- `join_mode` (`open | approval`) controls whether an eligible user joins immediately or waits for organizer approval.

Canonical access labels:

```text
is_public === false             → «За запрошенням»
is_public !== false + approval  → «За підтвердженням»
is_public !== false + open      → «Вільний вхід»
```

Never conflate private visibility with approval-based joining.

## 2. Repository and deployment

- Repository: `tishinatyt/porooch`
- Production: <https://tishinatyt.github.io/porooch/>
- Developer workspace: `C:\Users\Dell\Documents\meetnow`
- Stack: React 19, TypeScript, Vite 6, Tailwind CSS 4, Supabase, Leaflet/OpenStreetMap, and `vite-plugin-pwa`.
- Deployment: `.github/workflows/deploy.yml` uses checkout, Node 20, `npm ci`, `npm run build`, official Pages artifact upload, and Pages deployment actions. Supabase frontend values come from GitHub Actions secrets.

Vite uses `/` for development and `/porooch/` for production builds. `BrowserRouter` derives its basename from `import.meta.env.BASE_URL`; internal routes must remain basename-relative.

The app is an installable PWA. Current production manifest values are:

- `start_url: /porooch/`
- `scope: /porooch/`
- `id: /porooch/`
- standalone display, Ukrainian language, and Poruch branding.

The generated service worker uses auto-update, outdated-cache cleanup, `skipWaiting`, `clientsClaim`, and an hourly online update check. Do not reintroduce demo avatars into the precache.

GitHub Pages SPA fallback uses `public/404.html` and `index.html`. The sessionStorage key is `porooch:redirect`; restoration must stay namespaced, same-origin, restricted to `/porooch/`, and compatible with standalone PWA startup. Do not restore old `/meetnow/` routing.

## 3. Supabase

**Project ref:** `pqasdmiqnlyyjwmmqeyc`. Never record keys, database passwords, access tokens, or other secrets here.

Important current tables:

- `public.users`: application profiles (not `profiles`), keyed to `auth.users`; name, age, gender, avatar, verification, city, bio, interests, and timestamps.
- `public.users.profile_photos` stores up to six ordered Storage object paths for the optional profile gallery; `avatar_url` remains the primary identity image.
- `public.events`: event content, `event_type`, visibility, join mode, organizer, geography/address, timing, requirements, capacity, status, and the optional personal-event bank prototype fields.
- `public.event_participants`: event membership and approval states (`pending`, `joined`, `left`, `rejected`) with organizer/participant roles.
- `public.event_chats`: one group chat per event.
- `public.event_chat_messages`: chat, sender, content, and creation timestamp.
- `public.event_chat_read_state`: one read position per user and event chat.

Important database behavior:

- `is_event_participant(event_id)` grants event-chat access to the organizer or joined participants; migration 008 is the hardened definition.
- `event_chat_event_id(chat_id)` resolves a chat to its event.
- `get_unread_event_chat_count()` counts accessible unread messages for `auth.uid()`.
- `get_accessible_event_chat_unread_counts()` returns per-chat unread counts for every chat accessible to `auth.uid()` in one grouped query.
- `mark_event_chat_read(chat_id, read_through)` advances only the authenticated user's accessible chat read position.
- `trg_organizer_participant` runs `add_organizer_as_participant()` after event insertion.
- `trg_create_event_chat` runs `create_event_chat()` after event insertion.

RLS must remain enabled wherever migrations currently enable it. The frontend uses only the public/publishable key and must never use service-role credentials.

## 4. Events and RLS

`CreateEvent` validates the form, derives `organizer_id` from the authenticated Supabase user, converts local date/time to ISO UTC, builds the PostGIS point, and performs:

```ts
supabase.from('events').insert(payload).select('id').single()
```

The owner-only INSERT rule is:

```sql
auth.uid() = organizer_id
```

The organizer also needs direct SELECT access to their event:

```sql
auth.uid() = organizer_id
```

This SELECT policy is required because `.select('id')` requests the inserted row back (`INSERT ... RETURNING`). In particular, a private event must be visible to its organizer during that operation.

- `012_repair_events_insert_policy.sql` explicitly restores `events_insert` for `authenticated` users with the owner check.
- `013_events_organizer_select.sql` adds `events_select_organizer` for direct owner visibility.
- Both policies have also been applied manually to the current remote Supabase project.

Never weaken the existing SELECT, INSERT, UPDATE, or DELETE RLS policies.

Organizers edit existing events through `/event/:eventId/edit`, which reuses `CreateEvent` and the owner-only `events_update` policy. A historical date may load into the form, but every save requires a future date/time and resets the event status to `upcoming`; only the saved future timestamp can make the event eligible for normal discovery again. Past organized events remain available in My Events.

## 5. Event access semantics

In Create Event:

- **«Лише за запрошенням»** changes `is_public` to `false`.
- **«Після підтвердження»** changes `join_mode` to `approval`.

They are independent. A valid invitation-only event can be `is_public = false` and `join_mode = open`.

`src/lib/eventAccess.ts` provides `getEventAccessLabel(event)` and is the canonical UI mapping. It is used by Home personal/public cards, EventDetail, CreateEvent preview, and My Events cards. Keep new event surfaces on this helper.

Personal events may optionally persist `bank_enabled` and a short `bank_note`. This is a UI prototype only: the displayed QR is deliberately non-functional and never changes participation or represents payment. Public events cannot enable the bank under the database constraint.

## 6. Home UX

Relevant files are `src/pages/HomeScreen.tsx`, `src/components/home/HomeCarousel.tsx`, `HomeEventCards.tsx`, `HomeControls.tsx`, home types/demo data, `TopBar`, and responsive rules in `src/index.css`.

Mobile/tablet behavior below 1024px:

- Personal and Public are separate, independent horizontal carousels.
- Each owns its native `overflow-x` scroll position; there is no shared ref or scroll state.
- Rails use touch scrolling, momentum, CSS scroll snap, approximately 88% mobile card width, and next-card peek.
- Vertical page scrolling remains natural.

Desktop behavior at 1024px and above:

- Personal is the left vertical feed and Public is the right vertical feed.
- Each `HomeCarousel` switches to its own `overflow-y-auto` scrollport with contained overscroll.
- Section headers/actions remain outside those scrollports.
- The Home viewport uses flex/grid with `min-height: 0`; do not turn it into one giant body-scrolling event list.

Home discovery does not remove an otherwise eligible event because of the current user's participation state. Participant memberships enrich the card CTA while the same event may also appear in My Events:

- no participant membership → `ДОЄДНАТИСЬ`;
- participant + `joined` → `ВИ УЧАСНИК`;
- participant + `pending` → `ЗАПИТ НАДІСЛАНО`;
- participant + `rejected` → `ЗАПИТ ВІДХИЛЕНО`;
- organizer + `joined` → `КЕРУВАТИ`.

Home must wait for the current user's membership query before rendering discovery cards so these states are correct on first paint. Membership state must never be used to exclude an event from Home; only the existing discovery, eligibility, radius, search, category, date, visibility, and event-status rules may do that.

Home participation CTAs are navigation controls only. Every Home CTA state opens EventDetail and must perform zero `event_participants` writes. The actual free-entry join or approval request is submitted only from EventDetail through the shared participation workflow.

Desktop section CTAs are filled purple buttons with the existing plus icon:

- Personal: `/create?type=personal`
- Public: `/create?type=public`

`CreateEvent` reads the `type` query parameter to initialize `event_type`. Personal type does **not** imply private visibility.

## 7. Event visuals / branding

The visible product brand is **Poruch**. `src/components/BrandLogo.tsx` renders the supplied `public/poruch-logo.png` asset. Legacy deployment and storage identifiers remain `porooch` where compatibility requires them.

`EventMedia` displays a valid real cover image first and falls back after a missing URL or image error. `CategoryPlaceholder` provides lightweight category-specific gradients, patterns, and existing icons for cinema, theatre, bar, sport, music, food, games, walk, art, communication, and other. It is reused by cards, EventDetail, chat/event thumbnails, and creation preview where applicable.

Do not add external image APIs, heavy raster assets, downloaded fonts, or unnecessary dependencies. Prefer existing CSS, icons, and compact inline SVG.

## 8. Messaging and unread state

Each event has one `event_chats` row; messages live in `event_chat_messages`. Chats lists accessible event conversations through `get_accessible_event_chats()`. EventChat loads messages, subscribes to inserts for its current chat, preserves date separators/new-message behavior, and cleans up subscriptions.

Unread state uses `event_chat_read_state`, keyed by `(event_chat_id, user_id)`, with `last_read_at`. The effective rule is:

```text
message.sender_id != current user
AND message.created_at > current user's last_read_at for that chat
AND the chat is accessible to that user
```

Own messages never count. Opening EventChat advances only that chat through the newest loaded timestamp. Incoming messages are marked read while the user is at the bottom; using the new-message action advances through the newest displayed message.

`UnreadMessagesProvider` performs the initial RPC count and owns one realtime channel. It refreshes on accessible `event_chat_messages` INSERTs and changes to the current user's read-state rows. Sidebar shows no badge at zero, `1–99` numerically, and `99+` above 99. Chats fetches all per-chat counts through `get_accessible_event_chat_unread_counts()` alongside the chronological chat-list RPC; unread rows receive the same numeric badge and update through the list's shared realtime channel.

`011_event_chat_read_state.sql` creates the table, RLS, RPCs, grants, and realtime publication entry. Migration 011 was manually applied to the current remote project. Remotely verified objects are `event_chat_read_state`, `get_unread_event_chat_count()`, and `mark_event_chat_read(uuid,timestamptz)`.

Keep per-user/per-chat state. Never replace it with a global `is_read` boolean on messages.

## 9. Authentication

`AuthProvider` uses Supabase Auth, restores the persisted session with `getSession()`, follows `onAuthStateChange`, and loads the application profile from `public.users`. The first-time test flow is `Landing → Name + Photo → Interests → Home`. Clicking the public landing CTA does not authenticate. The name/photo step calls `supabase.auth.signInAnonymously()`, uploads the avatar under the authenticated user's `avatars/<auth.uid()>/...` Storage path, and upserts the profile for that same ID. The interests step saves 2–6 selections to the existing `public.users.interests` field. A `poruch_onboarding` auth user-metadata marker distinguishes this new incomplete flow without forcing established users with empty interests through onboarding.

Interests are profile data only in the current test version. They do not influence Home filtering, discovery, ranking, matching, recommendations, or people filtering.

Anonymous Sign-Ins must be enabled manually in the Supabase Dashboard under Authentication provider settings. Anonymous users receive a normal authenticated JWT, so existing `auth.uid()` ownership checks and `authenticated` RLS policies remain authoritative. No client-only or localStorage identity is used.

Existing Google-authenticated sessions and profiles remain supported without conversion. The legacy Google OAuth method/configuration stays in the code for compatibility, but Google is no longer presented in the first-time user UI.

Anonymous sessions use the Supabase client's normal browser persistence. The current test version keeps the same simple sign-out action for every account type. Cross-device recovery is not available until a future “Зберегти акаунт” flow links phone/email credentials to the same auth user; such linking must preserve the existing user ID and data.

Supabase Auth production Site URL and legacy OAuth redirects remain:

```text
https://tishinatyt.github.io/porooch/
http://localhost:5173/**
https://tishinatyt.github.io/porooch/**
```

Do not reintroduce old `/meetnow/` redirect paths.

## 10. Current important migrations

1. `001_initial.sql` — initial profiles and legacy activity/match/message model, PostGIS, functions, triggers, and RLS.
2. `002_seed.sql` — legacy test users/data and avatar storage setup; do not run as a production seed.
3. `003_events.sql` — events, participants, event chats/messages, spatial/chat functions, creation triggers, indexes, and base RLS.
4. `004_seed_events.sql` — historical test events plus helper/view setup; seed-bearing.
5. `005_complete_seed.sql` — expanded historical demo dataset and reporting views; seed-bearing.
6. `006_event_join_mode.sql` — `event_type`, `join_mode`, approval statuses, and participant self-service RLS/functions.
7. `007_event_approval_workflow.sql` — secure organizer review and participant leave RPCs.
8. `008_chat_hardening.sql` — organizer-aware chat access and `get_accessible_event_chats()`.
9. `009_profile_fields.sql` — city, bio, interests, constraints, and authenticated profile RLS.
10. `010_remote_schema_reconciliation.sql` — removes drifted profile policies, reconciles avatar storage, and hardens legacy message INSERT access.
11. `011_event_chat_read_state.sql` — per-user chat read state, unread/read RPCs, RLS, and realtime.
12. `012_repair_events_insert_policy.sql` — canonical authenticated owner-only event INSERT policy.
13. `013_events_organizer_select.sql` — authenticated organizer SELECT access to their own events.
14. `014_event_chat_unread_counts.sql` — one access-controlled grouped RPC for per-chat unread counts in Chats.
15. `015_profile_gallery_and_event_bank.sql` — ordered max-six profile gallery paths, personal-event bank prototype fields, constraints, and owner-only avatar-object deletion.
16. `016_anonymous_onboarding_profile_fields.sql` — makes age and gender optional so anonymous onboarding can create an honest profile from only the required name and avatar.

Never rewrite an applied migration. Add the next numbered migration when schema changes are genuinely required.

## 11. Development rules

1. Inspect existing code before implementing.
2. Never guess the database schema.
3. Never disable RLS to fix a problem.
4. Never put service-role credentials in the frontend.
5. Never expose Supabase secrets.
6. Prefer the smallest verified fix.
7. Reuse existing components, hooks, providers, and helpers.
8. Avoid dependencies unless necessary.
9. Preserve mobile behavior when changing desktop.
10. Preserve desktop behavior when changing mobile.
11. Run `npm run build` after changes.
12. If a migration is required, create a new numbered migration; never rewrite an applied migration.
13. Do not apply remote migrations automatically unless explicitly instructed.
14. Report exact files changed and database impact.
15. For Supabase errors, capture `code`, `message`, `details`, and `hint` before changing policies.
16. Do not confuse `is_public` with `join_mode`.

## 12. Current Git state / recent milestones

Relevant commits currently in history, newest first:

- `d12b43f` — Add desktop event creation buttons.
- `4dcfe05` — Fix private event access and organizer visibility.
- `9d7240c` — Add independent desktop feeds and improve card readability.
- `4d44e78` — Add the original brand logo and independent Home carousels.
- `888cc4b` — Optimize mobile Home vertical density.
- `0ca5f94` — Add mobile horizontal event carousels.
- `973cd18` — Polish Poruch event cards and category visuals.
- `0f61ff5` — Fix Poruch PWA startup on GitHub Pages.
- `5a6f16e` — Release the Poruch beta with event visuals and GitHub Pages.

Use `git log --oneline` for newer milestones; update this section when an architectural/product milestone lands.

## 13. Current verification checklist

### Authentication

- [ ] Supabase Anonymous Sign-Ins are enabled in the project dashboard.
- [ ] New name/photo onboarding creates one anonymous session and owned profile.
- [ ] Brand-new unauthenticated users see Landing before name/photo.
- [ ] Interests require 2 selections, stop at 6, and save before Home.
- [ ] Retrying a failed avatar/profile save reuses the same anonymous identity.
- [ ] Refresh restores a complete anonymous session without onboarding.
- [ ] Existing Google sessions and complete profiles still open normally.
- [ ] Incomplete sessions return to name/photo completion.
- [ ] Anonymous and existing Google users can use the standard sign-out action.
- [ ] Refreshing a direct protected route works.

### Events

- [ ] Create public/open event.
- [ ] Create public/approval event.
- [ ] Create private/invitation-only event.
- [ ] Organizer can open the private event returned after creation.
- [ ] Owner can delete only their own event.

### Home

- [ ] Personal mobile carousel scrolls independently.
- [ ] Public mobile carousel scrolls independently.
- [ ] Neither horizontal rail moves the other or the page horizontally.
- [ ] Desktop Personal/Public columns scroll independently.
- [ ] Both desktop create buttons open the correct type.

### Messaging

- [ ] A second account sends a message.
- [ ] Recipient unread badge increments in realtime.
- [ ] Own messages do not increment unread count.
- [ ] Opening one chat clears only that chat.
- [ ] Realtime message and read-state updates work without refresh.

### PWA

- [ ] Installed production app opens `/porooch/` without a blank window.
- [ ] Direct routes and refresh work.
- [ ] A deployed update is detected and activated without clearing all caches every launch.

## 14. How future AI sessions should start

**Before making significant changes to Poruch:**

1. Read `docs/POROOCH_CONTEXT.md`.
2. Inspect the relevant current code.
3. Inspect the relevant migration(s).
4. Do not rely solely on old chat history.
5. Update `POROOCH_CONTEXT.md` when architecture, schema, deployment, or important product semantics change.


## 15. Live handoff snapshot — 2026-09-18

This section is the **first thing to read in a new chat**. It records the current working state so the user does not need to re-explain the task.

### User instruction / working mode

- Continue the Poruch audit autonomously.
- The user wants logic bugs, mobile issues, auth/state races, event/join/approval/chat problems, PWA problems, and database inconsistencies found and fixed proactively.
- Work in small visible batches: 2–3 checks/fixes, report progress, then continue. Long silent runs made it look like the assistant had stalled.
- Do not ask the user to relay work through Codex unless the change exists only locally and cannot be reached through connected GitHub/Supabase tools.
- GitHub connector access to `tishinatyt/porooch` already works. A PAT pasted in chat is not needed for connector work; token replacement can be discussed later.
- Keep production stable: work on a branch/PR, run CI/build, then merge only when the batch is verified.

### Current production / main

- Production URL: <https://tishinatyt.github.io/porooch/>
- Current production/main baseline before PR #3: merge commit `c3ccd8737fd831c4875a86783fbc78a710462a33` (`Merge PR #2: Fix end-to-end event, auth, map, and state logic`).
- PR #2 is merged and its GitHub Pages deployment completed successfully.
- The previous production smoke test covered mobile 360/390 px and desktop flows including onboarding, Home, map, event creation, join/request, organizer approval, and chat. Test data was cleaned up after the run.

### Current working branch / PR

- Branch: `audit/post-production-mobile-logic`
- PR: **#3 — Post-production logic and mobile hardening**
- Base: `main`
- PR #3 is intentionally kept as draft during the second-pass audit.
- Last known PR state before this handoff: mergeable, 8+ commits, CI build green before the newest map-resize patch.
- Newest map-resize patch commit created in this session: `5e635c268d9be5b66573a443bf57285c803af8e9`.
- Before merging, fetch current PR metadata and latest workflow run again; do not assume the previous CI result covers the newest commit.

### Fixes already in PR #3

1. **Desktop event edit shell**
   - `src/App.tsx`
   - `/event/:id/edit` now keeps the desktop sidebar/shell like event detail/chat/create.

2. **Failure-safe onboarding step transition**
   - `src/pages/Onboarding.tsx`
   - `poruch_onboarding = interests` is written only after avatar/profile persistence succeeds.
   - Prevents an incomplete profile from being stranded on the interests step after a failed write.

3. **Single-event stale request protection**
   - `src/hooks/useEvent.ts`
   - Guards against a slower request for a previously viewed event overwriting a newly navigated event.
   - Clears stale event/participant/count state on errors or missing event IDs.

4. **Profile form state preservation + avatar cleanup**
   - `src/pages/Profile.tsx`
   - Profile refreshes caused by avatar/gallery operations no longer overwrite unsaved name/city/bio/interests while editing.
   - Avatar MIME type is validated.
   - Uploaded avatar objects are removed if the profile DB update fails.

5. **Profile preview loading fix**
   - `src/contexts/ProfilePreviewContext.tsx`
   - Non-UUID/demo previews no longer remain stuck in a loading state.

6. **Public profile request cancellation**
   - `src/pages/PublicProfile.tsx`
   - Rapid profile-to-profile navigation cannot let an older response replace the newer profile.

7. **Chat list stale-request + event-edit refresh**
   - `src/pages/Chats.tsx`
   - Request IDs prevent older async responses from overwriting newer chat-list state.
   - State clears correctly when the authenticated user disappears/changes.
   - The chat list also refetches when `events` change, so edited title/date/status/location data does not stay stale.

8. **Event chat race hardening**
   - `src/pages/EventChat.tsx`
   - Guards load/access/message/send state against rapid event/chat/user navigation.
   - Prevents messages from an old chat being merged into a new one.
   - Event updates refetch chat context in realtime.
   - Stale send responses cannot mutate the new chat screen.

9. **Discovery map mobile resize hardening**
   - `src/components/home/DiscoveryMap.tsx`
   - Added `ResizeObserver` + orientation handling to call Leaflet `invalidateSize()`.
   - Addresses partially gray/cropped map tiles after mobile viewport changes or rotation.
   - Map region now has an explicit ARIA region role.
   - Popup details button touch target increased.

### Database work already completed before PR #3

Remote Supabase project: `pqasdmiqnlyyjwmmqeyc`.

Previously applied/hardened items include:

- discovery RPC coordinates;
- aggregate participant counts visible to authenticated viewers while identities remain RLS-protected;
- anon execute revoked from participant count;
- current RPC search-path / permission hardening;
- safe event coordinates access;
- atomic event join/request behavior with capacity enforcement;
- organizer review / capacity integrity checks;
- `google_verified` protected from client spoofing.

A real inconsistent historical row was found where confirmed participants exceeded `max_participants`; capacity was raised to the existing confirmed count instead of deleting users.

Local migration numbering has been reconciled through the newer migration batch; do not rewrite older applied migrations. Remote migration history may still use timestamp versions for connector-applied migrations, so do not casually run `supabase db push` without checking history reconciliation first.

### Remaining second-pass audit tasks

Continue from here without asking the user to restate the project:

1. **Mobile navigation / safe-area**
   - Recheck `BottomNav`, event/chat full-screen routes, keyboard overlap, iPhone home-indicator spacing, very narrow widths (320–360 px), and landscape behavior.
   - Existing `.pb-safe` is present; look for actual layout/interaction bugs rather than changing it just for style.

2. **My Events**
   - Inspect organizer/joined/pending tab semantics, counts, stale/realtime behavior, card wrapping at 320–390 px, and whether historical/cancelled states are represented correctly.
   - Verify participant display does not rely on identities that RLS may hide.

3. **Map**
   - Verify the new resize patch builds and CI passes.
   - Check filtered event markers, empty-marker behavior, one-marker/multi-marker bounds, city/geolocation center changes, popup touch usability, and that filters never inject demo events into production map.

4. **PWA / GitHub Pages**
   - Verify manifest generated by `vite-plugin-pwa`, service worker registration/update, `public/404.html` SPA fallback, direct-route refresh, and standalone startup.
   - `index.html` already has `viewport-fit=cover`.
   - Current Vite manifest uses SVG 192/512 icons. In `public/icons`, files named `.png` are tiny duplicate text/SVG-looking assets and are ignored by Workbox; do not treat them as valid PNG icons without checking bytes/content.
   - Avoid unnecessary cache-clearing regressions.

5. **Final PR #3 checks**
   - Fetch latest PR diff and changed filenames.
   - Run/confirm GitHub Actions production build for the newest head SHA.
   - Review for accidental generated `dist/` changes or unrelated files.
   - Update this handoff section if another important fix lands.
   - When all checks are green, mark PR #3 ready for review and report exact fixes.
   - Do **not** merge PR #3 without the user's explicit merge instruction unless the user has already clearly said to merge that PR.

### One-line new-chat command

The user should only need to say:

> **Продолжай PORUCH. Прочитай docs/POROOCH_CONTEXT.md из ветки audit/post-production-mobile-logic и продолжай PR #3 с раздела 15. Делай и исправляй сам, мобильную версию обязательно проверяй.**

That instruction is sufficient to resume the current work.
