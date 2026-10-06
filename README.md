# Poruch

Poruch is a mobile-first social events PWA for finding real-world activities, joining them, coordinating in an event chat, and meeting offline.

## Project context

See [docs/POROOCH_CONTEXT.md](docs/POROOCH_CONTEXT.md) for the current product semantics, architecture, Supabase/RLS model, deployment constraints, and regression checklist.

## MVP features

- Google authentication and short profile onboarding
- Public and personal event discovery
- Event creation with date, capacity, location, map, and join mode
- Open joining and organizer-approved participation requests
- Participant leave/rejoin lifecycle with database-enforced capacity
- Event-scoped realtime chat for organizers and joined participants
- Profiles with avatar, city, bio, age, and interests
- Responsive desktop shell and mobile navigation

## Stack

- React 19 and TypeScript
- Vite 6 and Tailwind CSS 4
- Supabase Auth, Postgres, RLS, Storage, and Realtime
- Leaflet and OpenStreetMap
- `vite-plugin-pwa` with generated service worker

## Local setup

Requirements: Node.js 22 or a compatible current Node.js release, npm, and access to the intended Supabase project.

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173/`.

The frontend requires:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
VITE_APP_URL=http://localhost:5173/
```

Only the public/publishable Supabase key belongs in frontend environment files. Never commit a database password, service-role key, personal access token, or OAuth client secret.

## Commands

```bash
npm run dev
npm run build
npm run preview
```

The production build is written to `dist/`.

## Supabase migrations

Migrations live in `supabase/migrations/`. The hosted project treats migrations 001–005 as the reconciled historical baseline; 006–010 contain the current event, approval, chat, profile, storage, and policy changes.

Always link and inspect the intended project before applying migrations:

```bash
npx supabase@latest link --project-ref <project-ref>
npx supabase@latest migration list --linked
npx supabase@latest db push --linked --dry-run
npx supabase@latest db push --linked
```

Do not run the historical seed migrations against production or reset a hosted database. Migration 002 and migrations 004–005 contain legacy sample data.

## Deployment

Production builds use the GitHub Pages project base `/porooch/`; local development uses `/`. The router, PWA scope/start URL, asset URLs, and GitHub Pages fallback in `public/404.html` follow that base.

Configure Supabase Auth redirect allow-list entries for both `http://localhost:5173/` and the deployed `https://<owner>.github.io/porooch/` URL. The app derives its OAuth return URL from Vite's configured base.

## Current limitations

- Event invitations, notifications, unread counters, and direct messages are not part of the MVP.
- Location search uses OpenStreetMap/Nominatim and depends on network availability.
- Organizer request management is available on Event Detail; there is no separate moderation dashboard.
- Historical activity/match database tables remain for compatibility but are not used by the Poruch UI.
