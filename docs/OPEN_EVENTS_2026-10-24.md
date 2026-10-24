# Simple sign-in and open events

Registration uses the existing SVOYA username/password endpoint, with no email or confirmation code. The form has two fields and a password visibility button. Existing email accounts can still sign in. Password requirements and profile moderation remain in place.

Under publication type «Події», choose «Будь-хто · без підтвердження». Approved club members immediately join and can use the event chat. Full events place applicants on the waitlist; the oldest eligible applicant automatically joins when a place opens. The organizer and participant receive notifications. Standard, coffee and quick events retain organizer approval.

The narrow migration `20261024184755_svoya_open_events.sql` only extends the SVOYA format constraint and replaces two SVOYA functions, preserving row locks, capacity, authentication, profile and block checks. It does not modify shared Auth settings or PORUCH objects. Frontend publication does not apply SQL.

Rollback: restore the prior frontend and apply `supabase-svoya/rollback/open-events-functions.sql`. Keep the extended format constraint so existing open events remain valid; further joining then uses the previous approval flow. Existing memberships are preserved.

Validation: `npm test`, `npm run test:db`, `npm run typecheck`, `npm run build`. Database fixtures run only in isolated PGlite transactions, never against production users.
