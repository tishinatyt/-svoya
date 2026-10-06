# СВОЯ club database

The club at `/club` uses the existing Poruch Supabase project. The `svoya_*`
tables are separate from the existing Poruch tables. The applied migration is
`svoya_women_club`; its SQL is preserved in `svoya-schema.sql`.

All client data access uses the public Supabase key and row-level security.
No service-role credential is shipped. Organizers approve participation;
only approved members and the organizer can read or write the group chat.
Service-request contacts are visible only to the sender and listing owner.
The existing verified project owner was provisioned as a club moderator in
`svoya_admins`. Moderator membership must be managed through trusted database
administration; there is no client-side role assignment.

## Current scope

- Events, interest circles, beauty, business, help, profiles, requests and chat.
- Anonymous quick profiles retain data in the database but access depends on
  the browser session. Clearing the session or signing out loses that access.
- Existing Poruch email/password accounts can sign in. New durable-account
  signup and recovery are not part of this release.
- Six clearly labelled inspiration examples; no invented live events or users.
- Payments are not connected. Chat refreshes while the page is visible;
  users arrange service details directly.
- Existing owner-private Sites audience is preserved.

## Verification — 2026-09-30

TypeScript checking and the production Worker build passed. Browser checks
covered landing-to-club navigation, the feed, sample details and service
section. Four disposable anonymous test identities verified 13 access and
workflow checks against the actual database, including self-approval denial,
capacity enforcement, chat access, private request visibility, status updates,
profile identity protection and forged-demo rejection. Their sessions were
revoked and their identities and dependent fixtures removed afterwards.

## Profile photos — 2026-09-30

`svoya-photos.sql` describes the final photo schema, deployed through
`svoya_profile_photos` and the `svoya_photo_policy_scope` policy correction.
The private `svoya-profile-photos` bucket holds immutable objects under each
owner's UUID. Profiles contain 1–10 owned object paths; the first is the avatar.
Existing profiles without photos remain readable and must complete their photo
before a new event, membership or service request.

The browser accepts JPG/PNG/WebP up to 12 MB, resizes to at most 1600 pixels,
re-encodes as WebP and uploads up to 6 MB per file. This removes source metadata.
Signed URLs last 15 minutes and refresh while the component remains open.
Profile photos are visible to authenticated club participants, not guests.
Unpublished uploads are visible only to their owner. Referenced photos cannot
be deleted directly: update the gallery first, then delete removed objects.

15 live API checks passed: mandatory photo, ten-photo maximum, gallery
persistence, member/guest access, signed image retrieval, unpublished image
privacy, delete/upload ownership, referenced-avatar protection, MIME restriction,
last-photo protection, path ownership, avatar selection and photo removal.
Test objects were deleted with the Storage API, sessions revoked and disposable
test profiles/accounts removed. Browser QA verified multiple-file selection,
image preprocessing, selecting the main photo, draft removal and compact cards.

## Notifications — 2026-09-30

`svoya-notifications.sql` adds private notification history and opt-in Web Push.
Database triggers handle membership requests/status, service requests/status,
chat (unread messages grouped for two minutes), event changes and departures.
Recipients can read their own history and update only `read_at`. The bell polls
every 20 seconds while visible; the drawer shows the latest 100 notices.

The `svoya-push` Edge Function uses a sealed database webhook, atomic queue
claims, VAPID encryption and an exact push-provider hostname allowlist. Signing
keys and the webhook secret are service-only in `svoya_push_config`; no secret
is present in source or browser assets. The public GET endpoint returns only
the application public key. A minute cron retries failed deliveries, up to five
attempts within 24 hours. Expired subscriptions are deleted.

Each browser enables push explicitly; signing out disables that device's
subscription. The service worker does not cache authenticated content. Lock
screen notifications omit message text and contacts. iOS needs a supported
Safari home-screen installation. Other browsers can use the in-app inbox.

16 live API checks passed for workflows, private recipients, read state,
grouping, immutable content and unauthorized dispatch/subscription access.
An encrypted request to a disposable invalid FCM endpoint also exercised
webhook dispatch and expired-subscription cleanup. Three test identities,
their fixtures and storage objects were removed. Actual OS notification
delivery still requires permission and verification on the user's device.
TypeScript passed; browser QA covered the redesigned landing and guest drawer.
