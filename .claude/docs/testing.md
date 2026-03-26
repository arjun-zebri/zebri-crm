# Zebri — Testing Guide

## Philosophy

Tests are not just validators — they are **discovery tools**. When running tests, Claude should:
1. Run the test
2. Observe failures or visual issues
3. Fix the underlying problem in the app code (not just patch the test)
4. Re-run to confirm

Never skip a test or suppress a failure without understanding why it's failing. Tests that are hard to pass often reveal real bugs.

---

## Test Stack

- **Playwright** — end-to-end testing (desktop + mobile)
- **Location**: `tests/e2e/`
- **Config**: `playwright.config.ts`
- **Helpers**: `tests/e2e/helpers.ts`
- **Fixtures**: `tests/e2e/fixtures/`

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
├── helpers.ts                # Shared actions (login, addCouple, deleteCouple, etc.)
├── fixtures/                 # Auth state, saved sessions
└── README.md
```

One file per feature area. Do not create test files for sub-features — add to the relevant spec file.

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
Tests that require data use a pre-saved auth state (see `fixtures/`). Never hardcode credentials in test files — use `process.env.TEST_EMAIL` and `process.env.TEST_PASSWORD`.

### Use semantic selectors (in priority order)
1. `getByRole` — buttons, inputs, headings
2. `getByLabel` — form fields
3. `getByText` — visible content
4. `data-testid` — last resort for complex components

Avoid `nth()`, index-based selectors, or brittle CSS class selectors.

### Test the user journey, not implementation
```typescript
// Good — describes what the user does and sees
await page.getByRole('button', { name: 'New Couple' }).click();
await page.getByLabel('Name').fill('Sarah & Tom');
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByText('Sarah & Tom')).toBeVisible();

// Bad — brittle, implementation-aware
await page.locator('.modal button.primary').nth(2).click();
```

### Mobile tests
Use `test.use({ ...devices['Pixel 5'] })` at the top of a describe block to test a mobile scenario:
```typescript
import { devices } from '@playwright/test';

test.describe('Couples page — mobile', () => {
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

1. **Identify the root cause** — is it a missing element, wrong selector, or a real bug?
2. **Fix app code first** — update the component/page before touching the test
3. **Update the test only if the UI legitimately changed** — don't weaken assertions to make tests pass
4. **Add `data-testid` attributes** to elements that are hard to select semantically
5. **Add a mobile variant** if the fix behaves differently on small screens

When fixing mobile issues discovered during testing:
- Use Tailwind responsive prefixes (`sm:`, `md:`) — never add breakpoints with raw CSS
- Test the fix on both Pixel 5 and iPhone 12 viewports before marking done

---

## Adding `data-testid` Attributes

Add these sparingly — only when no semantic selector works:
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
