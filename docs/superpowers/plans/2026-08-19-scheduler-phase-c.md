# Zebri Scheduler Phase C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public booking surface: the `bookings` table with a DB-level double-booking guard, public `/book/[token]` page + iframe embed, a slots API, and a submit flow that creates the booking, matches or creates the couple, pushes a calendar event with an auto-generated Meet/Teams link, sends confirmation emails, and fires `consultation_booked` for real.

**Architecture:** Mirrors the `/lead` public-surface posture: anon never touches tables; a SECURITY DEFINER `submit_booking` RPC owns the couple-match/create + booking insert (the `btree_gist` exclusion constraint settles races), and `get_public_booking_page(token)` serves branding + type info. External-API work (free/busy verification, slot computation, calendar event push, emails) lives in server routes using the service-role client after token resolution. Slot logic reuses Phase B's pure `computeSlots` plus Phase A's `getBusyIntervals`, fail-closed.

**Tech Stack:** Next.js 16 App Router routes + client public page, Supabase (SECURITY DEFINER RPCs, btree_gist), Google Calendar events API (`conferenceData`) + Microsoft Graph events (`isOnlineMeeting`), Resend/OAuth email via `dispatchEmail`.

**Spec:** `docs/superpowers/specs/2026-08-18-scheduler-design.md`

**Scope notes:**
- The manage page (reschedule/cancel) is Phase D. `manage_token` is minted NOW (column + returned by the RPC) but no manage link goes into emails yet; Phase D adds it.
- Reminders and `consultation_completed` are Phase D.
- Video provider choice: push the event to the MC's first active calendar connection, preferring Google (Meet) when both are connected. Push failure never blocks a confirmed booking; it alerts via `sendAlert()` and the emails fall back to "location details to follow".
- If the couple insert hits the Starter plan limit, the booking still lands with `couple_id` null (flagged in the RPC result); the MC is alerted. A lost booking is worse than an unlinked one.

## Global Constraints

- **Never run `git commit` or `git push`. The user commits.** Work on `feature/scheduler-phase-c`, created from `feature/scheduler-phase-b` (both prior phases sit uncommitted in the same tree; if they have been merged by execution time, branch from `staging`).
- No em dashes anywhere. TSDoc on every export; why-comments on non-obvious logic.
- **`'use server'` files and route files export ONLY async functions (+ Next.js route config).** Zod schemas shared with tests live in plain sibling modules. `npm run check:server-action-exports` must pass (memory: this crashed Phase B at runtime while every gate stayed green).
- `SUPABASE_SERVICE_ROLE_KEY` only in server-only files; `npm run check:no-service-role` must pass.
- Gates: `npm run typecheck` 0; `npm run typecheck:strict:gate` 262 budget; `npm run lint:gate` 54/111 budget; new code clean. Components ≤~150 lines (split; action/route files follow house norms). Quote parenthesised paths in shell commands.
- Public routes: rate-limit via `@/lib/api/rate-limit` (`inMemoryLimiter`, `ipOf`), Zod via the `parseJsonBody` idiom from `/api/lead/submit`, honeypot + timing bot-check, `recordInvalidTokenAttempt()` on bad tokens.
- Migrations: non-destructive, CI deploys; local `supabase migration up` + grant-repair-after-reset gotcha; regenerate `types/database.ts` after schema changes.
- Public page styling must pass `npm run check:public-styling` (run it; the lead page is the reference).

---

### Task 1: Branch + `bookings` migration + RLS/exclusion integration tests + types

**Files:**
- Create: `supabase/migrations/20260820000000_create_bookings.sql`
- Create: `tests/integration/rls/bookings.test.ts`
- Modify: `types/database.ts` (regenerated)

**Interfaces:**
- Produces: `bookings` table (columns below), `consultation_booked` emitted by an AFTER INSERT trigger, `meeting_types_share_token_idx`. `Database['public']['Tables']['bookings']` used by every later task.

- [ ] **Step 1:** `git checkout -b feature/scheduler-phase-c`
- [ ] **Step 2: Failing integration test** `tests/integration/rls/bookings.test.ts` (mirror `scheduling-tables.test.ts`; service client may insert directly since anon goes through RPCs):
  - Owner SELECT ok; cross-tenant SELECT `[]`; cross-tenant INSERT errors; cross-tenant UPDATE `[]`; cross-tenant DELETE leaves row; anon sees nothing.
  - **Exclusion probe:** insert a confirmed booking 10:00-10:30Z for userA; a second confirmed insert 10:15-10:45Z for userA errors (code `23P01`); the SAME range for userB succeeds; a `cancelled` overlap for userA succeeds (constraint filters on confirmed).
  - **Trigger probe:** after a confirmed insert, `automation_events` (service client) contains a row with `event_type = 'consultation_booked'` and the booking id in the payload.
- [ ] **Step 3:** Run `npm run test:integration -- rls/bookings`: FAIL (relation missing).
- [ ] **Step 4: Migration** `20260820000000_create_bookings.sql`:

```sql
-- Scheduler Phase C: public bookings + double-booking guard.
--
-- bookings are created ONLY by the submit_booking SECURITY DEFINER RPC
-- (next migration); owner RLS is for the MC's own dashboard reads. The
-- exclusion constraint is the final arbiter of races: two confirmed
-- bookings for one MC can never overlap, whatever the app layer does.
--
-- Non-destructive migration: no @ALLOW_DESTRUCTIVE marker required.

create extension if not exists btree_gist;

create table bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meeting_type_id uuid not null references meeting_types(id) on delete cascade,
  couple_id uuid references couples(id) on delete set null,
  name text not null,
  partner_name text,
  email text not null,
  phone text,
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (starts_at < ends_at),
  -- The booker's IANA zone, for rendering their times in email/manage.
  timezone text not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed')),
  -- Capability token for the Phase D manage (reschedule/cancel) page.
  manage_token uuid not null default gen_random_uuid() unique,
  video_join_url text,
  -- Per-provider pushed-event ids, e.g. {"google": "..."}; reschedule
  -- and cancel (Phase D) propagate through these.
  external_event_ids jsonb not null default '{}'::jsonb,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_no_confirmed_overlap exclude using gist (
    user_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);

create index bookings_user_id_idx on bookings(user_id);
create index bookings_meeting_type_id_idx on bookings(meeting_type_id);
create index bookings_couple_id_idx on bookings(couple_id);
create index bookings_starts_at_idx on bookings(starts_at);
create index meeting_types_share_token_idx on meeting_types(share_token);

alter table bookings enable row level security;
create policy "bookings_user_isolation" on bookings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- consultation_booked fires on every confirmed insert (house pattern:
-- DB triggers feed the automation event bus; see tg_couples_emit_new_enquiry).
create or replace function public.tg_bookings_emit_consultation_booked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed' then
    perform public.emit_automation_event(
      new.user_id,
      'bookings',
      new.id,
      'consultation_booked',
      jsonb_build_object(
        'booking_id', new.id,
        'couple_id', new.couple_id,
        'meeting_type_id', new.meeting_type_id,
        'booker_name', new.name,
        'booker_email', new.email,
        'starts_at', new.starts_at,
        'ends_at', new.ends_at,
        'timezone', new.timezone
      ),
      new.couple_id
    );
  end if;
  return new;
end;
$$;

create trigger bookings_emit_consultation_booked
  after insert on bookings
  for each row execute function public.tg_bookings_emit_consultation_booked();
```

- [ ] **Step 5:** `supabase migration up` (+ grant repair if reset), `npx supabase gen types typescript --local > types/database.ts`, `npm run typecheck` 0.
- [ ] **Step 6:** Integration tests PASS. **Step 7:** Checkpoint (list files, no commit).

---

### Task 2: Public RPCs (`get_public_booking_page`, `submit_booking`) + integration tests

**Files:**
- Create: `supabase/migrations/20260820001000_booking_rpcs.sql`
- Create: `tests/integration/booking/booking-rpcs.test.ts`

**Interfaces:**
- Produces: `get_public_booking_page(token uuid) returns jsonb` (null on missing/inactive; business_name + `_user_branding` merge + type `{name, description, duration_minutes, location_type, address}`); `submit_booking(token uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_timezone text, p_name text, p_partner_name text, p_email text, p_phone text, p_notes text) returns jsonb` with results `{ok:true, booking_id, manage_token, user_id, couple_id, couple_created, couple_linked, mc_email, business_name}` or `{error:'not_found'|'slot_taken'|'invalid'}`. Both granted to anon; the trigger from Task 1 fires inside.

- [ ] **Step 1: Failing integration tests** (service + anon clients; seed a user with an active meeting type via service client):
  - `get_public_booking_page`: valid token returns type + business fields; invalid token null; `active=false` type null.
  - `submit_booking` as ANON: creates a booking; matches an existing couple by `primary_email` (case-insensitive) and by legacy `email`; creates a couple (`lead_source='booking'`, name from booker, `couple_created=true`) when no match; second overlapping submit returns `{error:'slot_taken'}` (exclusion caught, not thrown); invalid token `{error:'not_found'}`; `starts_at >= ends_at` `{error:'invalid'}`.
- [ ] **Step 2:** Run: FAIL. **Step 3: Migration** modelled on `get_lead_form`/`submit_lead` (SECURITY DEFINER, `set search_path = public, auth`, null posture, `_user_branding(user_id)` jsonb merge, `grant execute ... to anon`):
  - `submit_booking` body: resolve `meeting_types` row by `share_token = token and active`, else `not_found`. Validate range (`p_starts_at < p_ends_at`, duration matches `duration_minutes` within a minute, `p_starts_at > now()`), else `invalid`. Couple match: `select id from couples where user_id = mt.user_id and (lower(primary_email) = lower(p_email) or lower(email) = lower(p_email)) order by created_at limit 1`. No match: insert couple mirroring `submit_lead`'s column shape (`name`/`primary_name` from p_name, emails, phone, `lead_source 'booking'`, same default status `submit_lead` uses); wrap in `begin/exception` so a plan-limit exception leaves `v_couple_id` null and sets `couple_linked=false`. Insert booking (confirmed) in `begin/exception when exclusion_violation then return {'error':'slot_taken'}`. Return the jsonb above with `mc_email` from `auth.users` and business_name like `get_lead_form` does.
- [ ] **Step 4:** Apply, tests PASS, `npm run typecheck` (regen types not needed for RPCs unless you want typed rpc names: regenerate anyway). **Step 5:** Checkpoint.

---

### Task 3: Bookable-slots service (`lib/booking/availability.ts`)

**Files:**
- Create: `lib/booking/availability.ts`
- Create: `lib/supabase/service.ts` ONLY IF no service-role server client helper exists yet (search `SUPABASE_SERVICE_ROLE_KEY` under `lib/` and `app/api/` first; reuse the existing helper if one does)
- Test: `tests/unit/lib/booking/availability.test.ts`

**Interfaces:**
- Consumes: `computeSlots`, `SlotEngineConfig`, `Slot` (`@/lib/scheduling/slots`); `getBusyIntervals`, `FreeBusyUnavailableError` (`@/lib/calendar/free-busy`); `mergeIntervals` (`@/lib/calendar/intervals`); `Database` types.
- Produces (used by Tasks 6, 7):
  - `interface BookingContext { meetingType: MeetingTypeRow; userId: string; timezone: string; rules: WeeklyRule[]; overrides: DateOverride[] }`
  - `async function loadBookingContext(supabase: SupabaseClient<Database>, shareToken: string): Promise<BookingContext | null>` (service-role client; null when token unknown/inactive; timezone defaults to 'Australia/Sydney' with a why-comment when the MC never saved one)
  - `async function getBookableSlots(supabase, ctx: BookingContext, range: {start: Date; end: Date}, now?: Date): Promise<Slot[]>`: merges external busy (`getBusyIntervals`) + confirmed `bookings` rows in range (as BusyIntervals) into `computeSlots` config from the meeting type's duration/buffers/notice/advance. Propagates `FreeBusyUnavailableError` (fail closed).
  - `async function isSlotBookable(supabase, ctx, start: Date, end: Date, now?: Date): Promise<boolean>`: recomputes the slot set for that day and checks membership (exact start + exact duration).

- [ ] **Step 1: Failing unit tests** (mock `@/lib/calendar/free-busy` and the supabase client): slots exclude a confirmed booking's window; `isSlotBookable` true for an offered slot, false for an overlapping/odd-duration one; `FreeBusyUnavailableError` propagates; no-connections path works (empty busy).
- [ ] **Step 2:** FAIL. **Step 3:** Implement (≤150 lines; times from DB normalised `HH:MM:SS -> HH:mm` for the engine, same slice(0,5) idiom as the availability actions). **Step 4:** PASS + typecheck + strict gate. **Step 5:** Checkpoint.

---

### Task 4: Calendar event push (`lib/calendar/event-push.ts`)

**Files:**
- Create: `lib/calendar/event-push.ts`
- Test: `tests/unit/lib/calendar/event-push.test.ts`

**Interfaces:**
- Consumes: `listActiveConnections`, `getFreshAccessToken`, `CalendarConnection` (`@/lib/calendar/connections`).
- Produces (used by Task 7; Phase D reuses for update/delete):
  - `interface PushedEvent { provider: 'google' | 'microsoft'; eventId: string; joinUrl: string | null }`
  - `async function pushBookingEvent(supabase, userId: string, details: { summary: string; description: string; start: Date; end: Date; attendeeEmail: string; attendeeName: string; withConference: boolean }): Promise<PushedEvent | null>` (null when no active connections; prefers the google connection when both exist)

Provider payloads (implement exactly):
- Google: `POST https://www.googleapis.com/calendar/v3/calendars/{calendarId|primary}/events?conferenceDataVersion=1&sendUpdates=all`, body `{summary, description, start: {dateTime}, end: {dateTime}, attendees: [{email, displayName}], conferenceData: {createRequest: {requestId: <uuid>, conferenceSolutionKey: {type: 'hangoutsMeet'}}}}` (conferenceData only when `withConference`); joinUrl from `data.hangoutLink ?? data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ?? null`.
- Microsoft: `POST https://graph.microsoft.com/v1.0/me/events`, body `{subject, body: {contentType: 'Text', content}, start: {dateTime: <naive UTC, reuse the toNaiveUtc idiom from free-busy>, timeZone: 'UTC'}, end likewise, attendees: [{emailAddress: {address, name}, type: 'required'}], isOnlineMeeting: withConference, onlineMeetingProvider: 'teamsForBusiness'}`; joinUrl from `data.onlineMeeting?.joinUrl ?? null`.
- Non-2xx: throw `EventPushError(provider, status)` (exported class). Callers treat failure as non-blocking.

- [ ] **Step 1: Failing unit tests** (mock connections module + global fetch): google push returns eventId + joinUrl and the request body carried conferenceData + conferenceDataVersion=1; microsoft push uses naive UTC datetimes + isOnlineMeeting and returns joinUrl; google preferred when both connections active; null when none; non-2xx throws EventPushError; `withConference:false` omits conference fields.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (server-only module TSDoc). **Step 4:** PASS + gates. **Step 5:** Checkpoint.

---

### Task 5: Booking emails (`lib/email/booking.ts`)

**Files:**
- Create: `lib/email/booking.ts` (senders) and extend `lib/email/html.ts` (templates)
- Test: `tests/unit/lib/email/booking.test.ts`

**Interfaces:**
- Consumes: `dispatchEmail`, `resolveSender` (read `lib/email/sender-identity.ts` for the exact signature), existing html.ts helpers/shell.
- Produces (used by Task 7):
  - `async function sendBookingConfirmationEmail(supabase, opts: { userId: string; businessName: string; to: string; bookerName: string; meetingTypeName: string; start: Date; end: Date; timezone: string; locationType: 'video' | 'phone' | 'in_person'; address: string | null; joinUrl: string | null }): Promise<DispatchResult>`: couple-facing, sent via `resolveSender` (MC's mailbox when connected). Renders date/time IN THE BOOKER'S timezone via `Intl.DateTimeFormat` with `timeZone` + `timeZoneName: 'short'`. Location line: join link when present; "Video call (link to follow)" when video without link; the address when in person; "Phone call: we'll call you" for phone. NO manage link yet (Phase D).
  - `async function sendBookingNotificationEmail(opts: { to: string; mcBusinessName: string; booking: {...} }): Promise<DispatchResult>`: ops email to the MC mirroring `sendLeadNotificationEmail` (DEFAULT_FROM, table of booker details + meeting type + local time in the MC's timezone, replyTo booker).
- [ ] **Step 1: Failing unit tests** (mock dispatchEmail + resolveSender): confirmation renders the booker-timezone time string and join link; in-person renders address; MC notification goes to mc email with replyTo booker.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (templates in html.ts matching the existing neutral shell idiom; no em dashes in copy). **Step 4:** PASS + gates. **Step 5:** Checkpoint.

---

### Task 6: Slots route (`GET /api/booking/slots`)

**Files:**
- Create: `app/api/booking/slots/route.ts`
- Create: `app/api/booking/slots-schema.ts` (plain module: the query Zod schema, per the use-server export rule)
- Test: `tests/unit/app/api/booking-slots.test.ts` (schema only; route logic is covered by Task 3's unit tests + e2e)

**Interfaces:**
- Produces: `GET /api/booking/slots?token=<uuid>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>` returning `{ slots: Slot[], timezone: string, durationMinutes: number }` (timezone = MC's, so the client can label "times shown in your local time" while knowing the MC zone). Errors: 400 invalid query, 404 unknown/inactive token (feeds `recordInvalidTokenAttempt`), 429 rate limited, 503 `{ error: 'availability_unavailable' }` on `FreeBusyUnavailableError` (fail closed), range hard-capped at 31 days.
- Rate limit: `inMemoryLimiter({ windowMs: 60_000, max: 30 })` per IP (slot browsing is chatty).
- Uses `loadBookingContext` + `getBookableSlots` with the service-role client.

- [ ] Steps: schema test first (valid; bad uuid; to before from; >31 days rejected), FAIL, implement route + schema module, PASS, `npm run check:server-action-exports`, checkpoint.

---

### Task 7: Submit route (`POST /api/booking/submit`)

**Files:**
- Create: `app/api/booking/submit/route.ts`
- Create: `app/api/booking/submit-schema.ts` (plain module: body schema incl. honeypot + startedAt like the lead schema; booker timezone validated against `Intl.supportedValuesOf('timeZone')`)
- Test: `tests/unit/app/api/booking-submit.test.ts` (schema) + integration additions in `tests/integration/booking/booking-rpcs.test.ts` only if gaps emerge

**Interfaces:**
- Produces `POST /api/booking/submit` body `{ token, startsAt (ISO), timezone, name, partnerName?, email, phone?, notes?, website (honeypot), startedAt }`. Flow (copy `/api/lead/submit` structure):
  1. Rate limit (`{ windowMs: 60_000, max: 5 }` per IP), Zod parse, bot check (silent ok).
  2. `loadBookingContext`; unknown token: `recordInvalidTokenAttempt` + 404. Compute `end = start + duration`.
  3. `isSlotBookable` re-verification; false: 409 `{ error: 'slot_taken' }`; `FreeBusyUnavailableError`: 503 (fail closed).
  4. `supabase.rpc('submit_booking', ...)` (service client is fine; the RPC is SECURITY DEFINER either way). Map `slot_taken`/`not_found`/`invalid` to 409/404/400.
  5. `pushBookingEvent` (withConference when `location_type === 'video'`); on success update the booking row (service client) with `video_join_url` + `external_event_ids`; on `EventPushError` `sendAlert({ type: 'booking_event_push_failed', severity: 'warning', ... })` and continue.
  6. `void sendBookingConfirmationEmail(...)` (with joinUrl when available) + `void sendBookingNotificationEmail(...)`; `sendAlert({ type: 'booking_created', severity: 'info', ... })`.
  7. Return 200 `{ ok: true, joinUrl, start, end, timezone }`.
- New alert types: add to the alerts registry the same way existing `lead_*` types are declared (read `lib/alerts` for the union/type map; extend it, update `.claude/docs/alerts.md` in Task 10).

- [ ] Steps: schema tests first (honeypot field present; bad timezone rejected; ISO startsAt), FAIL, implement, PASS, `npm run check:server-action-exports && npm run check:no-service-role`, checkpoint.

---

### Task 8: Public booking page (`/book/[token]`)

**Files:**
- Create: `app/book/[token]/page.tsx` (orchestrator, ≤150 lines)
- Create: `app/book/[token]/booking-slot-picker.tsx`, `booking-details-form.tsx`, `booking-confirmed.tsx`, `use-booking-page.ts` (fetch + state hook)
- Test: `tests/unit/app/book/booking-page.test.tsx` (hook + form component with mocked fetch)

**Interfaces:**
- Consumes: `get_public_booking_page` RPC via the anon browser client (copy the `/lead/[token]/page.tsx` fetch/branding idiom exactly, including the null "not found" state), `/api/booking/slots`, `/api/booking/submit`.
- Produces the 3-step flow: (1) date strip + slot list (booker's local timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`, which is sent as `timezone` on submit; slots labelled with `timeZoneName: 'short'`; "Times shown in your local time" hint; loads 2 weeks at a time with prev/next; 503 renders the fail-closed message "Availability is temporarily unavailable, please try again shortly"); (2) details form (name, partner name, email, phone, notes + hidden honeypot `website` + `startedAt` minted on mount); (3) confirmation screen (meeting name, local time, join URL when returned, "check your email for details").
- Branding: apply the MC branding scalars the way `/lead` does (surface/text/brand colors, fonts, density). This is a public surface: `npm run check:public-styling` must pass.
- Mobile-first; explicit loading, error, empty (no slots this fortnight: "No times available, try the next two weeks") states.

- [ ] Steps: hook/form tests first (mocked fetch: slot select advances step; submit posts the exact body; 409 rolls back to slot list with "that time was just taken" message), FAIL, implement, PASS + gates + `check:public-styling`, checkpoint.

---

### Task 9: Embed + middleware

**Files:**
- Create: `public/book-embed.js` (copy `public/lead-embed.js` mechanics: iframe to `/book/<token>?embed=1`, listens for `zebri-book-height`)
- Modify: `app/book/[token]/page.tsx` (embed=1: strip chrome, ResizeObserver postMessage `{ type: 'zebri-book-height', height }`)
- Modify: `middleware.ts` (add `'/book'` and `'/api/booking'` to PUBLIC_ROUTES)
- Modify: `app/(dashboard)/calendar/meeting-type-row.tsx` (the copy-link already exists; add a second RowActionsMenu item "Copy embed code" producing the `<script src=".../book-embed.js" data-token="...">` snippet, mirroring however the lead embed snippet is surfaced; read the lead-capture settings UI for the exact snippet format)
- Test: extend `tests/unit/app/book/booking-page.test.tsx` for the embed branch (no chrome, postMessage fired)

- [ ] Steps: test first, FAIL, implement, PASS; verify middleware by unit-testing nothing (middleware is config): instead add to the checkpoint report the exact PUBLIC_ROUTES diff for reviewer eyes. Checkpoint.

---

### Task 10: E2E + docs + gates + wrap-up

**Files:**
- Create: `tests/e2e/booking.spec.ts`
- Modify: `.claude/docs/database-schema.md` (bookings + RPCs), `page-specs.md` (/book page), `security.md` (RLS matrix row for bookings + public-surface checklist for the two routes), `alerts.md` (booking alert types), `automations.md`-equivalent if trigger docs exist (check; else trigger-constants comments), `testing.md` (new e2e spec + selectors), `production-readiness.md` (Phase C status)
- Modify: `docs`? no. Design system untouched (no new primitives expected).

- [ ] **Step 1: E2E spec** (Playwright): seed via service client (test user + meeting type + availability), logged-out `browser.newContext()` (memory: shared context is authenticated), visit `/book/<token>`, pick the first slot, fill the form, submit, assert the confirmation screen; second visitor booking the same slot sees the slot-taken recovery. Desktop + Pixel 5 projects. Run only if the local stack + dev server are available (`npm run test:e2e -- booking`); if the environment cannot run it, mark clearly in the report and DO NOT claim it ran.
- [ ] **Step 2:** Docs, mirroring existing styles, nothing invented, no em dashes.
- [ ] **Step 3: Full gates**: `npm run typecheck && npm run typecheck:strict:gate && npm run lint:gate && npm run check:server-action-exports && npm run check:no-service-role && npm run check:public-styling && npm run test:unit && npm run test:integration`.
- [ ] **Step 4:** Final checkpoint: every file changed this phase; branch ready for review/commit; note the prod prerequisites (Google OAuth client + calendar scopes verification, EMAIL_CRED_KEY, CRON_SECRET unchanged) and that remote needs the CI migration deploy before /book works there.
