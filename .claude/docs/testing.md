# Zebri  -  Testing Guide

## Philosophy

Tests are not just validators  -  they are **discovery tools**. When running tests, Claude should:
1. Run the test
2. Observe failures or visual issues
3. Fix the underlying problem in the app code (not just patch the test)
4. Re-run to confirm

Never skip a test or suppress a failure without understanding why it's failing. Tests that are hard to pass often reveal real bugs.

---

## Test Stack (3 layers — added Phase 0.3)

| Layer | Tool | Location | Env | Run |
|---|---|---|---|---|
| **Unit** | Vitest + React Testing Library (jsdom) | `tests/unit/**` | none | `npm run test:unit` |
| **Integration** | Vitest (node) vs **local Supabase** + real RLS | `tests/integration/**` | local stack | `npm run test:integration` |
| **E2E** | Playwright (desktop + mobile) | `tests/e2e/**` | running app | `npm run test:e2e` |

- `npm test` runs unit + integration (Vitest, both projects). Playwright is
  separate (`test:e2e`) and is **not** picked up by Vitest.
- Config: `vitest.config.ts` (two projects), `playwright.config.ts`.
- Unit setup: `vitest.setup.ts` (jest-dom matchers + RTL cleanup).
- `@/…` resolves via `vite-tsconfig-paths` (matches tsconfig — no drift).

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
- `serviceClient()` bypasses RLS — setup/teardown only.
- `anonClient()` — unauthenticated RLS checks.
- Connection auto-discovered via `supabase status` (env override for CI).

**Every owned table's hardening phase must add a tenant-isolation test**
following `tests/integration/rls/couples.test.ts`: owner can read/write own
rows; another tenant cannot SELECT/UPDATE/DELETE them; anon cannot read.

Prereq: `supabase start` (and `supabase db reset` to (re)apply migrations +
seed). The integration project runs serially in one process (shared DB).

### Public Page / connect-your-own-mailbox (OAuth)

- Unit: `tests/unit/lib/crypto/secret-box.test.ts` (AES-GCM round-trip +
  tamper rejection); `tests/unit/lib/oauth/tokens.test.ts` (code exchange,
  refresh, userinfo — `fetch` mocked); `tests/unit/lib/settings/public-page.test.ts`
  (subdomain helpers + `from`-header composer);
  `tests/unit/lib/email/sender-identity.test.ts` (`resolveSender` fail-safe
  — OAuth only when connected + tokens usable, refresh-on-expiry, Resend
  otherwise, never throws); `tests/unit/lib/email/dispatch.test.ts`
  (transport routing — Gmail API / Graph / Resend, with `fetch` + Resend
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
- `tests/e2e/branding-onboarding.spec.ts` — first-run wizard flow: fresh user sees wizard → completes business/look/documents steps → editor shows tabs + no wizard on reload.
- `tests/e2e/branding-editor-locks.spec.ts` — lock model: required blocks cannot be deleted (line-items on invoice, etc.); non-required text blocks can be deleted with undo.
- `tests/e2e/branding-mobile-overflow.spec.ts` — mobile responsive: canvas scales at <md breakpoint, toolbar scrolls without overflow.

**Document Blocks Phase C (deferred to CI):**
- `tests/e2e/branding-block-readiness.spec.ts` — readiness validation: deleting a required block shows "Not ready to send" panel with plain-language missing items; panel clears when block is re-added.
- `tests/integration/branding/blocks-repair.test.ts` — repair/migration: `repairBlocks` maps legacy `headerBanner` → Image and old `action` → CTA blocks; sweep migrates all user rows idempotently.
- `tests/integration/branding/account-readiness.test.ts` — Layer B validation: Stripe Connect, bank details, contract template prerequisites gate "ready to send" per surface.
- `tests/integration/branding/social-urls-rpc.test.ts` — `_user_branding()` exposes twitter_url, pinterest_url, website_url from `raw_user_meta_data`.

### Payment schedule modal specs (2026-07-30 redesign)

Unit (`tests/unit/`), all with semantic selectors:
- `lib/payments/describe-schedule.test.ts` — `describeSchedule` across
  remainder, single-stage, fixed, and percentage combinations.
- `components/builders/schedule-template-row.test.tsx` — label/offset edits,
  the value field hides for a remainder. The amount-type control is a Radix
  `Select`; its option selection is **not** drivable in jsdom (same as
  `select.test.tsx`), so the switch-clears-value behaviour is asserted by
  rendering each state, not by opening the dropdown.
- `components/builders/schedule-editor.test.tsx` — Save disabled with a stated
  reason (two remainders, percentages > 100, empty), dirty reporting, add stage.
- `components/builders/schedule-library-list.test.tsx` — click-to-apply,
  overflow actions, New schedule, `describeSchedule` summaries.
- `components/builders/schedule-library-modal.test.tsx` — apply closes, Edit
  opens the editor + saves an update, unsaved-changes guard prompts, delete
  confirms, the paid-stage note.
- `components/builders/payment-schedule.test.tsx` (rewritten) — empty state
  names the default, applies it, the running total, "Change" opens the library.
- `schedule-picker.test.tsx` was **removed** with the retired picker.

E2E: `tests/e2e/payment-schedule-modal.spec.ts` — one flow across desktop +
Mobile Chrome/Safari: apply the default, duplicate + edit a schedule, re-apply,
confirm the invoice reflects it, then delete the throwaway. Self-cleaning so it
never mutates the seeded "Default". **Deferred to CI / isolated local
Supabase:** `npm run dev` targets the remote DB, which lacks the
`payment_schedules` tables (migration `20260730000000`) until the CI deploy;
running it against that DB fails on missing schema. No new integration tests —
`schedule-actions.ts` is unchanged and already covered by
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

### Welcome onboarding e2e specs (Phase 14, metadata-gated features)

E2E tests for the welcome wizard use per-test users created via the local GoTrue admin API with `email_confirm: true`. The once-only gate is reset by sending a user metadata update with `{"user_metadata": {"welcome_onboarded_at": null}}` (GoTrue admin update MERGES metadata; keys are deleted only by explicit null). Tests are guarded to the isolated server on port 3123 (local Supabase); they do not run on the remote dev server.

Environment variable: `LOCAL_SUPABASE_SERVICE_ROLE_KEY` — the service role key for admin API calls. Injected by the test harness when running on `:3123`. See `tests/e2e/welcome-onboarding.spec.ts`.

### Grant repair after local DB reset

After `supabase db reset` locally (Supabase CLI v2.65.5 + PG17), DML grants on auth schema tables may be stale. If integration tests fail with "permission denied," run:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth.sessions TO postgres;
```

### Regenerating DB types
After any migration: `supabase gen types typescript --local --schema public > types/database.ts`

---

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
- `BRANDING_E2E=1` — signals that the branding test suite is running
- `PLAYWRIGHT_BASE_URL` includes `:3123` — runs the app against the isolated stack (port 3123 is the isolated dev server's Supabase instance)

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
├── calendar.spec.ts          # Calendar navigation, views, search (8 tests)
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
with a responsive class — `payments-table.tsx` emits a mobile card stack
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
and leave the assertions after it at the tight default — that still pins
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
