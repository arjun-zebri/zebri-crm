# Zebri  -  Testing Guide

## Philosophy

Tests are not just validators  -  they are **discovery tools**. When running tests, Claude should:
1. Run the test
2. Observe failures or visual issues
3. Fix the underlying problem in the app code (not just patch the test)
4. Re-run to confirm

Never skip a test or suppress a failure without understanding why it's failing. Tests that are hard to pass often reveal real bugs.

---

## Test Stack (3 layers  -  added Phase 0.3)

| Layer | Tool | Location | Env | Run |
|---|---|---|---|---|
| **Unit** | Vitest + React Testing Library (jsdom) | `tests/unit/**` | none | `npm run test:unit` |
| **Integration** | Vitest (node) vs **local Supabase** + real RLS | `tests/integration/**` | local stack | `npm run test:integration` |
| **E2E** | Playwright (desktop + mobile) | `tests/e2e/**` | running app | `npm run test:e2e` |

- `npm test` runs unit + integration (Vitest, both projects). Playwright is
  separate (`test:e2e`) and is **not** picked up by Vitest.
- Config: `vitest.config.ts` (two projects), `playwright.config.ts`.
- Unit setup: `vitest.setup.ts` (jest-dom matchers + RTL cleanup).
- `@/…` resolves via `vite-tsconfig-paths` (matches tsconfig  -  no drift).

### Unit tests
Pure functions and React components. Fast, isolated, no I/O. Prefer testing
`lib/**` logic and `components/ui/**` primitives. Example:
`tests/unit/lib/payments/subscription.test.ts`.

### Integration tests (RLS)
Run against the **local** Supabase stack only (never cloud). Helpers in
`tests/integration/helpers/supabase.ts`:
- `createTestUser(metadata)` → isolated confirmed auth user + a client
  signed in as them (RLS applies as the app sees it). Always `cleanup()`
  (use `afterAll`).
- `serviceClient()` bypasses RLS  -  setup/teardown only.
- `anonClient()`  -  unauthenticated RLS checks.
- Connection auto-discovered via `supabase status` (env override for CI).

**Every owned table's hardening phase must add a tenant-isolation test**
following `tests/integration/rls/couples.test.ts`: owner can read/write own
rows; another tenant cannot SELECT/UPDATE/DELETE them; anon cannot read.

Prereq: `supabase start` (and `supabase db reset` to (re)apply migrations +
seed). The integration project runs serially in one process (shared DB).

### Public Page / connect-your-own-mailbox (OAuth)

- Unit: `tests/unit/lib/crypto/secret-box.test.ts` (AES-GCM round-trip +
  tamper rejection); `tests/unit/lib/oauth/tokens.test.ts` (code exchange,
  refresh, userinfo  -  `fetch` mocked); `tests/unit/lib/settings/public-page.test.ts`
  (subdomain helpers + `from`-header composer);
  `tests/unit/lib/email/sender-identity.test.ts` (`resolveSender` fail-safe
   -  OAuth only when connected + tokens usable, refresh-on-expiry, Resend
  otherwise, never throws); `tests/unit/lib/email/dispatch.test.ts`
  (transport routing  -  Gmail API / Graph / Resend, with `fetch` + Resend
  mocked).
- Integration: `tests/integration/rls/user-public-settings.test.ts`
  (cross-tenant denial incl. the encrypted OAuth tokens, + global
  subdomain uniqueness via 23505).
- E2E for the connect flow is **deferred**: it needs real Google/Azure
  OAuth apps and `npm run dev` targets the **remote** Supabase (no table
  until the migration deploys via CI). Assert UI states (mode toggle,
  connected summary, persisted subdomain) from seeded rows once the
  migration is on the e2e DB.

### Branding E2E specs (Phase 11 + Document Blocks Phase C)

**Phase 11 (stable):**
- `tests/e2e/branding-onboarding.spec.ts`  -  first-run wizard flow: fresh user sees wizard → completes business/look/documents steps → editor shows tabs + no wizard on reload.
- `tests/e2e/branding-editor-locks.spec.ts`  -  lock model: required blocks cannot be deleted (line-items on invoice, etc.); non-required text blocks can be deleted with undo.
- `tests/e2e/branding-mobile-overflow.spec.ts`  -  mobile responsive: canvas scales at <md breakpoint, toolbar scrolls without overflow.

**Document Blocks Phase C (deferred to CI):**
- `tests/e2e/branding-block-readiness.spec.ts`  -  readiness validation: deleting a required block shows "Not ready to send" panel with plain-language missing items; panel clears when block is re-added.
- `tests/integration/branding/blocks-repair.test.ts`  -  repair/migration: `repairBlocks` maps legacy `headerBanner` → Image and old `action` → CTA blocks; sweep migrates all user rows idempotently.
- `tests/integration/branding/account-readiness.test.ts`  -  Layer B validation: Stripe Connect, bank details, contract template prerequisites gate "ready to send" per surface.
- `tests/integration/branding/social-urls-rpc.test.ts`  -  `_user_branding()` exposes twitter_url, pinterest_url, website_url from `raw_user_meta_data`.

### Payment schedule modal specs (2026-07-31 redesign)

Unit (`tests/unit/`), all with semantic selectors:
- `lib/payments/resolve-stages.test.ts`  -  resolution + validation, the
  `<value> <unit>` offsets (day / week / month, month-end clamping), and the
  `issue` / `due` timing anchor (before-due dates backward from the due date;
  `no_due_date` when the invoice has none).
- `lib/payments/describe-schedule.test.ts`  -  `describeSchedule` across
  remainder, single-stage, fixed, and percentage combinations.
- `components/builders/schedule-stage-row.test.tsx`  -  label / share / offset
  edits, the % vs $ unit, "rest" for a remainder, a paid row locks. The unit
  `Select` is a Radix control (not drivable in jsdom), so state is asserted by
  rendering.
- `components/builders/schedule-modal.test.tsx`  -  seeds from the default, the
  running total, Add payment (before the remainder), Apply fires the resolved
  template + closes, Save to library, the Amount %/$ toggle, the remainder
  checkbox, "Before due" disabled without a due date, and Apply disabled with a
  warning for an unresolvable schedule.
- `components/builders/payment-schedule.test.tsx`  -  empty state offers one "Add
  schedule" button that opens the modal; applied state shows the running total
  and "Change" reopens it.
- The v1 library specs (`schedule-library-modal` / `schedule-library-list` /
  `schedule-editor` / `schedule-template-row` / `schedule-picker`) were
  **removed** with those retired parts.

E2E: `tests/e2e/payment-schedule-modal.spec.ts`  -  one flow across desktop +
Mobile Chrome/Safari: Add schedule opens the modal pre-loaded with the default,
Apply writes the timeline, then Change edits an offset and re-applies. Self-
contained (no invoice save, no library mutation). **Deferred to CI / isolated
local Supabase:** `npm run dev` targets the remote DB, which lacks the
`payment_schedules` tables + time-unit columns (migrations `20260730000000`
and `20260731010000`) until the CI deploy. Integration coverage stays in
`tests/integration/payments/schedule-actions.test.ts`.

**New key selectors for blocks:**
| Element | Selector |
|---------|----------|
| "Not ready to send" panel | `text=/Not ready to send/` |
| Block "Required" chip | `text=/Required/` |
| Package header block | `text=/Package header/` |
| Package chooser switcher | `text=/See other packages/` |
| Footer social toggle (Facebook) | `input[aria-label*="Facebook"]` |

**Isolated-stack guard:** Phase 11 tests require either `BRANDING_E2E=1` OR `PLAYWRIGHT_BASE_URL` including `3123` (local Supabase on port 3123). Phase C tests (integration + new e2e) require `supabase start` locally; they are skipped on the remote dev server. Test helpers in `tests/e2e/helpers.ts`.

### Lead capture e2e specs (ZEB-2 + Public API 2026-09-03)

- `tests/e2e/lead-capture.spec.ts`  -  the hosted `/lead/[token]` flow: MC copies the hosted link from Settings, Lead Capture, a logged-out visitor fills and submits it, sees the branded success state, and the lead appears in the MC's pipeline.
- `tests/e2e/lead-capture-api.spec.ts`  -  the public API a third-party site posts to. The spec starts a plain `http.Server` on `127.0.0.1` inside itself (`node:http`, ephemeral port) and serves a tiny third-party page from it, because that is a genuinely different origin from the app's own `localhost` (a page opened via `context.newPage()` or a relative path would still be same-origin, so the CORS allowlist would never actually be exercised). It allowlists that origin from Settings, confirms a browser post from it lands (and the couple shows "Enquiry from" with the `127.0.0.1:<port>` host), then removes the origin and confirms the browser now refuses the post.

**The 2000ms minimum-fill spam check applies to both specs.** The submit route silently drops (200, nothing stored) any submission faster than `MIN_FILL_MS` after the form rendered, so both specs `waitForTimeout(2200)` before clicking submit. Playwright fills a form fast enough that without this wait the submission is treated as a bot and the test's "lead appears" assertion times out with no error to explain why.

### Public booking e2e specs (Scheduler Phase C)

E2E: `tests/e2e/booking.spec.ts` covers the public booking flow end to end. Covers:
- Slot picker: fetches available times, groups by booker's local day, renders times with timezone
- Form submission: fills required fields (name, email) + optional fields (partner name, phone, notes)
- Confirmation screen: shows meeting name, time, join URL (if video + event-push populated it)
- Slot-taken recovery: first visitor books a slot, second visitor sees "That time was just taken" notice and can pick a different time
- Mobile (Pixel 5): all steps responsive with full form visibility

**Seeding:** Service client (SECURITY DEFINER RPC bypass) creates:
- Test MC user with `account_type: 'vendor'` in app_metadata
- Meeting type (Consultation, 30 min, video) with active=true
- User timezone (user_public_settings.timezone = 'Australia/Sydney')
- Availability rule for tomorrow (9am-6pm in MC's timezone)

**Important:** Tests use `browser.newContext()` to create genuinely logged-out visitors, **not** `context.newPage()` (which shares the MC's auth cookies). This is critical for testing the public booking page as an unauthenticated surface.

**Isolated-stack guard:** Tests require `supabase start` locally + dev server on http://localhost:3000. The migrations (`20260819000000_create_scheduling_tables.sql`, `20260820000000_create_bookings.sql`, `20260820001000_booking_rpcs.sql`) must be deployed locally; they are skipped on the remote dev server. If local Supabase is unavailable (service client throws), the suite skips with a clear message.

**Key selectors:**
| Element | Selector |
|---------|----------|
| Slot buttons | `page.locator('button').filter({ has: page.getByText(/\d{1,2}:\d{2}/) })` (matches time format) |
| Slot-taken notice | `page.getByText('That time was just taken...')` |
| Back button | `page.getByRole('button', { name: 'Back' })` |
| Name field | `page.getByLabel('Your name')` |
| Partner name field | `page.getByLabel("Partner's name (optional)")` |
| Email field | `page.getByLabel('Email')` |
| Phone field | `page.getByLabel('Phone (optional)')` |
| Notes field | `page.getByLabel('Notes (optional)')` |
| Submit button | `page.getByRole('button', { name: 'Confirm booking' })` |
| Confirmation heading | `page.getByText('Booking confirmed')` |

### Calendar tests (Scheduler Phase E)

**Unit tests:** `tests/unit/lib/calendar/` and `tests/unit/app/calendar/`
- `grid-layout.test.ts`: bandGeometry clamping at both edges, minimum height guard at grid bottom, A-B-C transitive overlaps
- `grid-window.test.ts`: viewport slicing in local timezone
- `day-grid.test.tsx`: day view rendering with availability shading, busy blocks, booking chips; positional assertions; Melbourne and UTC timezone variants prove timezone correctness
- `week-grid.test.tsx`: week view column matching and overlap layout; bookings straddling window edges; one intentionally skipped DST test (see note below)
- `layer-toggles.test.tsx`: layer visibility toggling
- `bookings-tab.test.tsx`: bookings list rendering

**Critical fixture requirement:** All calendar tests must include a NON-UTC timezone case (Australia/Melbourne is the standard). Six timezone bugs were found during Phase E; all were invisible to code review and hidden by UTC-only fixtures where wrong and right coincide.

**Known open issue  -  DST changeover in week view:**
`tests/unit/app/calendar/week-grid.test.tsx:36` contains an intentionally skipped DST test. During Sydney's daylight-saving changeover week (2026-10-03, local day is 23 hours long), no booking renders in any column despite the query returning rows. This is a suspected real defect in the week view's column matching logic, not a test artifact. When bookings are fetched, their local-day derivation may drift across the transition boundary, causing column mismatches. Until fixed, the defect means the week view may silently drop or mis-place bookings during the two DST transition weeks each year. Unblock requires fresh investigation of per-column dayStart derivation and the booking-to-column equality check.

### Welcome onboarding e2e specs (Phase 14, metadata-gated features)

E2E tests for the welcome wizard use per-test users created via the local GoTrue admin API with `email_confirm: true`. The once-only gate is reset by sending a user metadata update with `{"user_metadata": {"welcome_onboarded_at": null}}` (GoTrue admin update MERGES metadata; keys are deleted only by explicit null). Tests are guarded to the isolated server on port 3123 (local Supabase); they do not run on the remote dev server.

Environment variable: `LOCAL_SUPABASE_SERVICE_ROLE_KEY`  -  the service role key for admin API calls. Injected by the test harness when running on `:3123`. See `tests/e2e/welcome-onboarding.spec.ts`.

### Grant repair after local DB reset

After `supabase db reset` locally (Supabase CLI v2.65.5 + PG17), DML grants on auth schema tables may be stale. If integration tests fail with "permission denied," run:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.sessions TO postgres;
```

### Regenerating DB types
After any migration: `supabase gen types typescript --local --schema public > types/database.ts`

---

### Couple scripts specs (Scripts tab)

`tests/e2e/couple-scripts.spec.ts` types a line with Vietnamese
diacritics, CJK and Greek into the script editor, keeps typing after the
autosave lands (the caret must not move), changes the font from the
toolbar select and undoes / redoes it, builds a numbered and a bullet list
across Enter, closes the modal with Esc, reloads, and checks the print
window (`context.waitForEvent('page')`) carries the text. The editor is `.script-document .ProseMirror`; the title is
the textbox named "Script title"; toolbar buttons are found by their
tooltip / `aria-label` names. Needs the `scripts` migrations on the target
DB (see the dev-server DB note above). `tests/unit/components/ui/modal.test.tsx`
style tests for `useOverlay`: an Escape that is already `defaultPrevented`
(a Radix layer handled it) must not close the overlay.

## Running Tests

```bash
# All tests (desktop + mobile)
npm run test:e2e

# Specific file
npx playwright test tests/e2e/couples.spec.ts

# Specific test by name
npx playwright test -g "should display couple list"

# Headed mode (watch browser)
npx playwright test --headed

# UI mode (recommended for debugging)
npm run test:e2e:ui

# Debug mode (step through)
npm run test:e2e:debug

# Desktop only
npx playwright test --project=chromium

# Mobile only
npx playwright test --project="Mobile Chrome" --project="Mobile Safari"

# View last report
npx playwright show-report
```

---

## Viewport Targets

All features must work on both:

| Target | Device | Viewport |
|--------|--------|----------|
| Desktop Chrome | Desktop Chrome | 1280×720 |
| Desktop Safari | Desktop Safari (WebKit) | 1280×720 |
| Mobile Chrome | Pixel 5 | 393×851 |
| Mobile Safari | iPhone 12 | 390×844 |

### Mobile-specific rules
- Sidebar collapses to a hamburger/bottom nav on mobile
- Modals/slide-overs must be scrollable on small screens
- Touch targets must be at least 44×44px
- Tables should stack or scroll horizontally
- No content should overflow viewport width (no horizontal scroll on body)

### Branding e2e specs (isolated-stack guard)

Branding tests run against an isolated Supabase instance to test block-tree mutations without interfering with other tests. Guard with env vars:
- `BRANDING_E2E=1`  -  signals that the branding test suite is running
- `PLAYWRIGHT_BASE_URL` includes `:3123`  -  runs the app against the isolated stack (port 3123 is the isolated dev server's Supabase instance)

After `supabase db reset` locally, run `scripts/repair-auth-grants.sql` to restore DML grants on the auth schema tables; the stale CLI v2.65.5 leaves them stripped on PG17.

---

---

## Test Structure

```
tests/e2e/
├── auth.spec.ts              # Login, signup, redirects (12 tests)
├── couples.spec.ts           # Couple list, CRUD, keyboard shortcuts (16 tests)
├── couple-profile.spec.ts    # Profile tabs: Overview, Events, Vendors, Tasks (12 tests)
├── vendors.spec.ts           # Vendor list, CRUD, keyboard shortcuts (15 tests)
├── kanban.spec.ts            # Board view columns, cards, drag-add (8 tests)
├── calendar.spec.ts          # Calendar navigation, views, Statuses filter (8 tests)
├── navigation.spec.ts        # Dashboard, sidebar nav, sign out (10 tests)
├── mobile.spec.ts            # Pixel 5 + iPhone 12 layouts (12 tests)
├── branding-onboarding.spec.ts    # First-run wizard, surface tabs, preview (9 tests)
├── branding-editor-locks.spec.ts  # Required blocks, surface reset, isDeletable (8 tests)
├── branding-mobile-overflow.spec.ts # Responsive canvas, container queries, mobile preview (7 tests)
├── helpers.ts                # Shared actions (login, addCouple, deleteCouple, etc.)
├── fixtures/                 # Auth state, saved sessions
└── README.md
```

One file per feature area. Do not create test files for sub-features  -  add to the relevant spec file.

## Key Selectors (verified from source)

| Element | Selector |
|---------|----------|
| Couple name input | `input[placeholder="Couple's name"]` |
| Vendor name input | `input[placeholder="e.g., Elegant Venues"]` |
| Search input | `input[placeholder="Search..."]` |
| Task title input | `input[placeholder="What needs to be done?"]` |
| Profile panel | `div.fixed.top-0.right-0` |
| Profile close (X) | `div.fixed.top-0.right-0 button:first-child` |
| Status/Category | Radix Popover → click trigger button, then click option text |
| Delete (2-click) | `button:has-text("Delete")` → `button:has-text("Click again to confirm")` |
| Board view label | "Board" (not "Kanban") |
| Profile tabs | `button:has-text("Overview\|Events\|Vendors\|Tasks")` |
| Welcome wizard dialog | `[role="dialog"]` (inside the modal) |
| Wizard step heading | `h2:has-text("Welcome\|Business\|Look\|Documents\|Previews...")` |
| Preview nav active item | `[data-active="true"]` (on sidebar nav buttons inside PreviewFrame) |
| Wizard "Next" button | `button:has-text("Next")` (context-specific inside modal) |
| Wizard "Done" button | `button:has-text("Done")` (step 8 close action) |
| Settings phone input | `input[placeholder="Phone"]` (placeholder selector; label association pending Settings hardening) |

## Helpers

| Helper | Purpose |
|--------|---------|
| `login(page)` | Authenticates using `TEST_EMAIL` / `TEST_PASSWORD` env vars |
| `addCouple(page, opts)` | Opens modal, fills form, saves |
| `deleteCouple(page, name)` | Opens profile, Edit modal, two-click delete |
| `openCoupleProfile(page, name)` | Searches + clicks row, waits for panel |
| `closeProfile(page)` | Clicks first button in panel header (X) |
| `navigateToProfileTab(page, tab)` | Clicks named tab inside profile panel |
| `addVendor(page, opts)` | Opens modal, fills form, saves |
| `deleteVendor(page, name)` | Opens profile, Edit modal, two-click delete |
| `search(page, term)` | Types into `input[placeholder="Search..."]` |
| `uniqueName(prefix)` | Returns `"prefix + timestamp"` for test isolation |

---

## Writing Tests

### Always authenticate first
Tests that require data use a pre-saved auth state (see `fixtures/`). Never hardcode credentials in test files  -  use `process.env.TEST_EMAIL` and `process.env.TEST_PASSWORD`.

### Use semantic selectors (in priority order)
1. `getByRole`  -  buttons, inputs, headings
2. `getByLabel`  -  form fields
3. `getByText`  -  visible content
4. `data-testid`  -  last resort for complex components

Avoid `nth()`, index-based selectors, or brittle CSS class selectors.

### Responsive dual-render: filter on visibility, not `.first()`

Several list components render **both** layouts into the DOM and hide one
with a responsive class  -  `payments-table.tsx` emits a mobile card stack
*and* a `<table>`, for example. Two consequences bite e2e tests:

- `getByText('…').first()` can resolve to the node the current viewport has
  hidden, so `waitFor()` / `click()` time out while a screenshot at the
  point of failure shows the content plainly visible.
- `getByRole('row')` finds rows on a mobile viewport (the table is present,
  just hidden), so a mobile test fails for a structural reason rather than
  a real one.

Filter on visibility so one locator works on every viewport:

```typescript
// Good  -  matches whichever layout is actually rendered
const entry = page.getByText(title).filter({ visible: true }).first();

// Bad  -  may grab the hidden layout's node
const entry = page.getByText(title).first();
```

Where the list also truncates long labels, filter the list down first (the
search box) so the visible match is unambiguous.

### Give data-dependent reveals a generous first assertion

A UI that holds a skeleton until several queries resolve can exceed the 5s
default `expect` timeout, especially on WebKit. Put an explicit
`{ timeout: 30_000 }` on the **first** assertion that waits for the reveal
and leave the assertions after it at the tight default  -  that still pins
"these appear together" without making the test a latency benchmark. See
`tests/e2e/invoice-gst-inclusive.spec.ts`.

### Test the user journey, not implementation
```typescript
// Good  -  describes what the user does and sees
await page.getByRole('button', { name: 'New Couple' }).click();
await page.getByLabel('Name').fill('Sarah & Tom');
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByText('Sarah & Tom')).toBeVisible();

// Bad  -  brittle, implementation-aware
await page.locator('.modal button.primary').nth(2).click();
```

### Mobile tests
Use `test.use({ ...devices['Pixel 5'] })` at the top of a describe block to test a mobile scenario:
```typescript
import { devices } from '@playwright/test';

test.describe('Couples page  -  mobile', () => {
  test.use({ ...devices['Pixel 5'] });

  test('sidebar is hidden on load', async ({ page }) => {
    await page.goto('/couples');
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
  });
});
```

---

## Improving While Testing (Claude Workflow)

When a test fails or reveals a UI problem, Claude should:

1. **Identify the root cause**  -  is it a missing element, wrong selector, or a real bug?
2. **Fix app code first**  -  update the component/page before touching the test
3. **Update the test only if the UI legitimately changed**  -  don't weaken assertions to make tests pass
4. **Add `data-testid` attributes** to elements that are hard to select semantically
5. **Add a mobile variant** if the fix behaves differently on small screens

When fixing mobile issues discovered during testing:
- Use Tailwind responsive prefixes (`sm:`, `md:`)  -  never add breakpoints with raw CSS
- Test the fix on both Pixel 5 and iPhone 12 viewports before marking done

---

## Adding `data-testid` Attributes

Add these sparingly  -  only when no semantic selector works:
```tsx
// Sidebar
<nav data-testid="sidebar">

// Mobile menu toggle
<button data-testid="mobile-menu-toggle">

// Couple row in table
<tr data-testid={`couple-row-${couple.id}`}>
```

---

## Environment Setup

Tests require `.env.test` in the project root:
```
TEST_EMAIL=your-test-user@example.com
TEST_PASSWORD=your-test-password
```

The dev server starts automatically when running tests (`webServer` in `playwright.config.ts`).

---

## What to Test

| Area | What to cover |
|------|--------------|
| Auth | Login, failed login, session persistence |
| Couples | List renders, create, edit, search, status filter, profile tabs |
| Vendors | List renders, create, edit, search, category filter |
| Tasks | Create task, mark complete, due date display |
| Calendar | Events appear, view switching (day/week/month) |
| Mobile | Sidebar collapse, modals fit screen, tables scroll |

### Booking lifecycle integration tests (Scheduler Phase D)

Integration: `tests/integration/booking/booking-lifecycle.test.ts` covers the booking manage page RPC lifecycle end to end. Covers:
- `get_booking_by_manage_token`: fetches booking detail, strips user_id, validates branding merge
- `cancel_booking`: transitions status to cancelled, emits booking_cancelled event, denies past/already-cancelled
- `reschedule_booking`: updates times, clears reminder_sent_at, catches exclusion violations (slot-taken), handles duration validation
- Cross-tenant denial: another MC's manage_token does not resolve

**Seeding:** Service client creates test MC, meeting type, bookings in various states (confirmed, cancelled, past).

**Key assertions:**
- Cancelled booking emits automation_events row with booking_cancelled type
- Reschedule clears reminder_sent_at for next tick to send reminder
- Slot-taken returns error; booking unchanged
- Past booking denies reschedule + cancel

### Booking manage page unit tests (Scheduler Phase D)

Unit: `tests/unit/app/book/manage-booking.test.tsx` covers the manage page UI component. Covers:
- Loading state: spinner visible until RPC returns
- Active state: shows booking details, buttons enabled
- Cancelled state: read-only view, callout shown
- Past state: read-only, reschedule/cancel disabled
- Cancel modal: confirmation checkbox required, calls RPC on confirm
- Reschedule modal: slot picker reuses booking form slot logic, calls RPC on select
- Slot-taken recovery: banner displayed, user re-selects time
- Error handling: failed RPC shows inline banner, no state transition

### Consultation completed emitter unit tests (Scheduler Phase D)

Unit: `tests/unit/lib/automations/consultation-completed-emitter.test.ts` covers the time-based emitter. Covers:
- Past confirmed booking: status flipped to completed, event emitted
- Future booking: not selected, no action
- Already-completed booking: not re-selected (status guard is idempotency)
- Cancelled booking: ignored by query filter
- Emit failure on one row: batch continues, Slack alert sent, remaining rows processed

### Time-interval subtraction helper tests

Unit: Tests for duration/buffer subtraction utility used by slot picker. Covers:
- Buffer overlap detection (15-min buffer on each side)
- Same-day multi-slot rendering (9am-6pm availability, 30-min slots + buffers)
- Timezone edge cases (buffer spans calendar day boundary)

## What NOT to Test
- Supabase internals or DB queries
- Exact CSS values or pixel measurements
- Third-party library behavior (tanstack-table, dnd-kit)
- Animation timing

---

## Document Maintenance

When you add or change tests, update this file if:
- New test files are added
- New helpers are created
- New `data-testid` conventions are established
- Mobile breakpoints or layout rules change
