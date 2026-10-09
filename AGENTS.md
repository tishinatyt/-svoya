# SVOYA development

React + TypeScript + Vite, deployed to GitHub Pages at /-svoya/.
Active entry points: src/App.tsx, src/site/page.tsx, src/site/club/club.tsx.
The older src/pages implementation is not routed. Preserve the Ukrainian UI.

- SVOYA and PORUCH share production Supabase. Never apply the legacy
  supabase/migrations directory or run supabase db push against the shared
  project. Never modify PORUCH objects or use real users in automated tests.
- Use the dedicated supabase-svoya workdir for an empty local SVOYA stack.
  Follow docs/DEVELOPMENT.md and its production migration boundary.
- Never commit service-role keys, passwords, webhook secrets or DB credentials.
- Run npm test, npm run test:db, npm run typecheck and npm run build.
- Keep schema changes SVOYA-only. Verify locally before separately authorized
  production application. Frontend deployment does not apply SQL.
