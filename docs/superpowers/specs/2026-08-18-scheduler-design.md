# Zebri Scheduler: Calendly-style booking built into Zebri

**Status:** Design approved 2026-08-18. Implementation phased A to E, each
phase its own PR to `staging`.

## 1. Context and goals

Wedding MCs currently juggle Zebri and an external scheduler (Calendly or
manual email back-and-forth) to get consultation calls and client meetings
booked. This initiative builds scheduling natively into Zebri:

- Leads and booked couples pick a time from the MC's real availability.
- The booking lands in the CRM attached to the right couple.
- A Google Meet or Teams link is generated automatically.
- The MC's Google/Outlook calendar stays in sync both directions
  (free/busy read, event push).
- The existing `/calendar` route is rebuilt from a passive event viewer
  into the scheduling hub.

### Locked decisions (brainstorm, 2026-08-18)

| Decision | Choice |
|---|---|
| Use cases | Consultation calls with leads AND meetings with booked couples |
| Availability | Zebri weekly rules + free/busy against BOTH Google Calendar and Outlook; bookings pushed back to the external calendar |
| Sync layer | Self-built on existing OAuth infra (no Nylas/Cronofy) |
| Meeting types | Multiple Calendly-style types (duration, location, buffers, own link) |
| Entry points | Public branded booking link + website iframe embed. Portal integration and automation-email merge fields deferred |
| CRM linkage | Match booker by email to existing couple, else create enquiry couple; fires `consultation_booked` |
| Lifecycle | Confirmation email + manage link (reschedule AND cancel) + automatic reminder |
| Video | Auto-generated Meet/Teams links via calendar event creation |
| Home | Rebuild `/calendar` into the management interface; connections UI in Settings |
| Availability model | ONE user-level weekly schedule, plus an optional per-type schedule that replaces it (added 2026-08-21; date overrides stay user-level) |
| Failure posture | Free/busy failure fails closed on slot listing; event-push failure alerts but does not block a confirmed booking |

## 2. Data model

Five new owned tables. House conventions apply to all: `user_id uuid not
null references auth.users(id) on delete cascade`, RLS `auth.uid() =
user_id` for all four verbs, `snake_case`, `text` over `varchar`, FK
indexes, migrations through CI `supabase db push`.

### `calendar_connections`

One row per connected external calendar. `provider`
('google'|'microsoft'), account email, encrypted access/refresh tokens
(via `encryptSecret()` from `lib/crypto/secret-box`), `token_expires_at`,
`status`, target `calendar_id`. Kept separate from the email OAuth state
in `user_public_settings` so an MC can have Google AND Outlook calendars
connected at once, independent of which provider handles their email.

### `meeting_types`

`name`, `description`, `duration_minutes`, `location_type`
('video'|'phone'|'in_person'), `address` (in-person), `buffer_before_minutes`,
`buffer_after_minutes`, `min_notice_hours`, `max_advance_days`,
`reminder_enabled`, `active`, `share_token`. The video provider (Meet vs
Teams) follows from which connection the event is pushed to, not a column
here.

### `availability_rules` and `availability_overrides`

Rules: weekly windows as rows (`weekday`, `start_time`, `end_time`),
multiple windows per day allowed, times interpreted in the MC's
user-level timezone. Overrides: date-specific rows (`date`, `available`
flag, optional custom windows) for blocking days or opening one-off
hours.

### `bookings`

`meeting_type_id`, nullable `couple_id`, booker `name`, `partner_name`,
`email`, `phone`, `notes`, `starts_at`/`ends_at` (timestamptz), booker
`timezone`, `status` ('confirmed'|'cancelled'|'completed'),
`manage_token`, `video_join_url`, `external_event_ids` jsonb
(per-provider event ids so reschedule/cancel can propagate),
`cancelled_at`. A Postgres **exclusion constraint on
`tstzrange(starts_at, ends_at)` per user, confirmed rows only** is the
DB-level double-booking guard whatever races happen above it.

## 3. Calendar-connection layer (`lib/calendar/`)

Pure functions, no React, TSDoc on every export.

- **OAuth:** extend the existing `/app/api/oauth/` flow with a calendar
  purpose. Scopes: Google calendar events + free/busy; Microsoft
  `Calendars.ReadWrite` (covers event creation with
  `isOnlineMeeting: true` for Teams links). Token refresh mirrors the
  proven logic in `lib/email/dispatch.ts`.
- **`getBusyIntervals(userId, range)`:** merged busy blocks from ALL
  active connections (Google FreeBusy API; Microsoft Graph
  `getSchedule`).
- **Event push:** on booking, create the calendar event on the
  connection matching the meeting's video provider, requesting
  conference data (Google `conferenceData` / Graph `onlineMeeting`); the
  join URL comes back from the provider, so no separate conferencing
  API. Store returned event ids on the booking.
- **Failure posture:** free/busy failure means the slot listing fails
  closed with an explicit error state (never offer slots we cannot
  verify). Event-push failure after a confirmed booking leaves the
  booking standing and fires `sendAlert()` for repair.

**Prod prerequisite (ops, tracked with phase A):** production Vercel has
no `GOOGLE_OAUTH_*` or `EMAIL_CRED_KEY` and no Google OAuth client exists
yet; calendar scopes require Google app verification.

## 4. Slot engine (`lib/scheduling/`)

Pure, unit-tested. Inputs: weekly rules + overrides, confirmed bookings
(expanded by buffers), external busy intervals, the meeting type
(duration, min notice, max advance). Output: available slots of the
type's duration on half-hour boundaries, computed in the MC's timezone,
rendered client-side in the booker's browser timezone. Timezone and DST
edge cases are covered by unit tests here.

## 5. Booking flow

`POST /api/booking/submit`:

1. Zod validation via `@/lib/api/validate`; rate-limit via
   `@/lib/api/rate-limit`; honeypot + form-timing bot check (copy
   `/api/lead/submit`).
2. Server-side slot re-verification: rules + a fresh free/busy call. The
   exclusion constraint settles any remaining race at insert.
3. Couple linkage: match booker email against `primary_email` with
   legacy `email` fallback (see `lib/couples/email.ts`); on no match,
   create an enquiry couple with `lead_source: 'booking'`.
4. Push the external calendar event; capture join URL + event ids.
5. Email booker confirmation (with manage link) and MC notification via
   `dispatchEmail` (`lib/email/dispatch.ts`).
6. Emit `consultation_booked` on the automation event bus (constant
   already scaffolded in `lib/automations/trigger-constants.ts`; this is
   its first real emitter).

## 6. Public surfaces

Patterns copied from `/lead` and `/portal`:

- **`/book/[token]`** - branded booking page per meeting type. Page data
  via a `get_public_booking_page(token)` SECURITY DEFINER RPC (branding
  through the `_user_branding(uuid)` helper + type info). Slots via
  `GET /api/booking/slots` (a server route, because it calls external
  calendar APIs). UX: date picker, slot list, details form (name,
  partner name, email, phone, notes).
- **Embed:** `?embed=1` iframe variant with postMessage height
  reporting + a script loader, identical mechanics to `lead-embed.js`.
- **`/book/manage/[manage_token]`** - reschedule (external event updated
  in place, join link preserved) and cancel (external event deleted,
  both sides emailed).
- **Middleware:** add `/book` and the booking API routes to
  `PUBLIC_ROUTES` (verify against the questionnaire PUBLIC_ROUTES gap).
  Invalid tokens feed `recordInvalidTokenAttempt()` from
  `lib/api/public-token-limiter`.

## 7. Lifecycle and automations

- **Reminders:** 24-hours-before reminder email to the booker,
  per-meeting-type toggle, driven by the existing daily automations-tick
  cron (`/app/api/cron/automations-tick`). Hour-before reminders are
  deferred (needs a faster cron cadence).
- **Completion:** the tick marks past-`ends_at` confirmed bookings
  `completed` and fires the scaffolded `consultation_completed` trigger.
- **Cancellation:** fires a new `booking_cancelled` trigger.
- Auto-created couples land as enquiries and flow into existing
  `new_enquiry`-adjacent automations via `lead_source: 'booking'`.

## 8. `/calendar` rebuild (`app/(dashboard)/calendar/`)

The page becomes the scheduling hub with four tabs:

1. **Calendar** - the existing day/week/month grid, now also rendering
   bookings (visually distinct from wedding events), availability
   windows as background shading, and external busy blocks. Clicking a
   booking opens a booking detail panel (cancel/reschedule); clicking a
   wedding event still opens the couple profile.
2. **Meeting types** - CRUD list with copy-link and embed-snippet
   actions.
3. **Availability** - weekly hours editor + date overrides.
4. **Bookings** - upcoming/past list.

The 1,132-line `_components/couples-calendar.tsx` is split into
<=150-line components as part of this rebuild. Calendar-connections UI
lives in **Settings** next to the email OAuth card. All UI from
`/design-system` primitives; match existing in-app styles
(couple-overview / couple-events), calm, no boxes-in-boxes.

## 9. Phasing

Each phase is its own PR to `staging` (staging-only batch flow; the user
commits).

- **A** - migrations + calendar connections (OAuth, Settings UI,
  free/busy module).
- **B** - meeting types + availability editor + slot engine (internal
  `/calendar` tabs).
- **C** - public booking page + embed + submit flow + CRM linkage +
  event push + confirmation emails.
- **D** - manage link (reschedule/cancel) + reminders + automation
  trigger wiring.
- **E** - calendar-view rebuild (overlays + splitting the monolith).

## 10. Key existing code to reuse

- `/app/api/oauth/callback/route.ts` + `lib/crypto/secret-box` - OAuth
  flow + token encryption pattern.
- `lib/email/dispatch.ts` - token refresh + `dispatchEmail`.
- `/app/api/lead/submit/route.ts` - public submit pattern (rate limit,
  bot check, SECURITY DEFINER RPC, Slack alerts).
- `lib/automations/` - dispatcher, trigger constants
  (`consultation_booked` / `consultation_completed` scaffolds,
  `block_calendar_slot` actions).
- `_user_branding(uuid)` SQL helper for public-page branding.
- `lib/api/{validate,rate-limit,cron-auth}` and
  `lib/api/public-token-limiter`.

## 11. Testing and verification

- **Unit:** slot engine (timezones, DST, buffers, min notice, overrides)
  in `tests/unit/`.
- **Integration** (local Supabase, real RLS): cross-tenant denial on all
  five new tables; exclusion-constraint race test; submit RPC
  match-vs-create couple behaviour.
- **E2E** (Playwright, desktop + Pixel 5 + iPhone 12): full public
  booking flow, reschedule, cancel. Logged-out visitors via
  `browser.newContext()`.
- **Gates:** `npm run typecheck` (0), `typecheck:strict` clean for new
  code, `lint:gate`; ratchet budgets down where reduced.
- **Docs updated in the same PRs:** `database-schema.md`,
  `page-specs.md`, `authentication.md` (calendar OAuth), `alerts.md`,
  `security.md` (RLS matrix), `testing.md`, `production-readiness.md`,
  plus `/design-system` entries for any new primitives.
