# Click & Fix Technologies — Appointment Booking Portal

Independent Phase 1 booking portal. It has no integration with Click & Fix CRM, Billing, Firebase, or their data.

## What is included

- Mobile-first four-step customer booking in vanilla HTML, CSS, Bootstrap, and JavaScript.
- Server-authoritative availability, validation, random appointment ID generation, and duplicate-slot protection.
- Browser GPS capture for Home / Office visits; no map API is used.
- Private Supabase Storage photo uploads (JPG, PNG, WebP; maximum 5 MB).
- PWA manifest, service worker, offline shell, and push-event handler.
- Authenticated administrator notification permission/subscription foundation at `/admin/`.

## Supabase setup

1. Create a new Supabase project dedicated to this portal. Do not reuse any existing Click & Fix project.
2. Run `supabase db push` (or execute `supabase/migrations/0001_phase1_booking_portal.sql` in the Supabase SQL editor).
3. Create the first Supabase Auth user for the administrator, then add their UUID once:
   ```sql
   insert into public.admin_users (user_id) values ('ADMIN_AUTH_USER_UUID');
   ```
4. Set Edge Function secrets. Values in `.env.example` are examples only:
   ```powershell
   supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   supabase secrets set ALLOWED_ORIGIN=https://booking.clickandfix.site
   ```
5. Deploy functions:
   ```powershell
   supabase functions deploy availability
   supabase functions deploy book-appointment
   supabase functions deploy upload-photo
   supabase functions deploy register-push-subscription
   ```
6. Copy `js/runtime-config.example.js` to `js/runtime-config.js` during deployment and set only the project URL, anon key, and generated public VAPID key. This public runtime file loads before `app-config.js` and is ignored by Git. Never put the service-role key or VAPID private key in it.

## VAPID and push

Generate a VAPID key pair outside the repository. Put the public key in `vapidPublicKey` in `js/app-config.js`; keep the private key as an Edge Function secret for Phase 2 notification sending. The current Phase 1 implementation registers active authenticated administrator devices but deliberately does not send booking notifications.

## Local run and deployment

Serve this folder over HTTP(S), for example `npx serve .`, then open the supplied local URL. Do not test service workers from `file://`.

Deploy the static files to the host serving `booking.clickandfix.site`, with HTTPS enabled and SPA rewrites **not** required (pages are real HTML files). Ensure the host preserves `service-worker.js` at the site root and serves `.webmanifest` with `application/manifest+json` where configurable. Update `ALLOWED_ORIGIN` to the final exact origin before deploying Edge Functions.

### Availability configuration and India timezone

The date picker calls the `availability` Edge Function; it does not create client-side slots. The Phase 1 migration seeds `business_availability` with Monday–Saturday, 10:00–19:00, 30-minute slots, zero buffer, and one appointment per slot. The availability function also recreates that singleton default only if it is missing. It applies business-day, blocked-day/slot, capacity, minimum-advance, and maximum-future-date rules server-side.

All customer-facing date comparisons and Edge Function slot filtering use `Asia/Kolkata`. Apply `0004_availability_ist.sql` and redeploy `availability` and `book-appointment` whenever updating an existing deployment.

## Security model

Browser clients cannot select, insert, or update appointment data directly; RLS is enabled and the functions use the service role on the server. The booking function validates requests and calls the private SQL function, which locks the selected slot and checks it again before insertion. Storage is private. Admin push subscriptions require a signed-in user listed in `admin_users`.

## Phase 2 configuration

Deploy the additional migration and functions:

```powershell
supabase db push
supabase functions deploy customer-tracking
supabase functions deploy customer-appointment-action
supabase functions deploy admin-api
```

The booking function now sends independent post-save notification attempts: Web Push, Formspree, and Brevo. Set the Phase 2 secrets in `.env.example` with `supabase secrets set`. Failure is logged in `notifications` and never rolls back an appointment. Configure the hosting provider to rewrite `/track/<token>` to `/track/index.html` while preserving the URL.

Use Supabase Auth to create the administrator and add their UUID to `admin_users`; admin access is then protected in the browser and again inside `admin-api`. Technician credentials are created only through that protected function, so passwords are handled by Supabase Auth rather than stored in the application database.

Phase 2 customer tracking is at `/tracking/`: customers enter the appointment year, final five digits, and registered mobile number. The secure email link is `/track/<tracking-token>`; it contains no database ID or appointment code. Customer cancellation/rescheduling is enforced in the database function at least one hour before the original appointment. The customer page intentionally contains no authentication or OTP.

## Phase 3 technician portal

The technician portal is served at `/technician/`. Technicians sign in through Supabase Auth; their password is managed by Supabase Auth and is never stored in `technicians`. The `technician-api` Edge Function resolves the technician from the access token, verifies that they are active, and constrains every appointment operation to `technician_id` server-side.

Deploy Phase 3:

```powershell
supabase db push
supabase functions deploy technician-api
```

Set `OTP_HASH_PEPPER`, `BREVO_API_KEY`, and `BREVO_SENDER_EMAIL` as Edge Function secrets. Completion OTPs are generated with Web Crypto, hashed with the server-only pepper, expire after ten minutes, are single-use, are limited to five failures, and invalidate the former active OTP on resend. Resends have a server-enforced sixty-second cooldown. The plaintext OTP is sent only to the registered appointment email through Brevo and is never returned by an API, stored in the database, or logged.

Technicians can move only their appointments to On The Way, In Progress, or Job ID Created. Completion requires the OTP path when status is In Progress or Job ID Created. Administrators retain direct completion, recorded as `admin_direct`, with no OTP email. The booking application never queries, writes, or synchronizes CRM/Billing data; a manually entered Job ID is its sole intentional reference.

## Phase 1 limitations intentionally deferred

Admin appointment management, technician workflows, tracking lookup, OTP, rescheduling/cancellation workflows, job IDs, status transitions, email delivery, and push notification sending are not implemented. The database has only their future-safe structures.
