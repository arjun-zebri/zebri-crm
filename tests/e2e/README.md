# Zebri E2E Tests

End-to-end tests for the Zebri CRM using Playwright.

## Setup

1. **Install dependencies** (from project root):
   ```bash
   npm install
   ```

2. **Install Playwright browsers**:
   ```bash
   npx playwright install
   ```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests in UI mode (recommended for development)
```bash
npm run test:e2e:ui
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test tests/e2e/auth.spec.ts
```

### Run tests matching a pattern
```bash
npx playwright test -g "login"
```

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```

## Test Structure

Tests are organized by feature:

- **auth.spec.ts** - Authentication flows (login, signup, password reset)
- **couples.spec.ts** - Couple management (CRUD, search, views)
- **vendors.spec.ts** - Vendor management (search, filtering, profiles)
- **tasks.spec.ts** - Task management (create, complete, display)

## Test Environment

The tests run against `http://localhost:3000` by default. The dev server starts automatically when running tests.

### Setting Up Test Credentials

Most tests require authentication. You need to:

1. **Create a test account** in your Supabase instance
   - Go to your Supabase dashboard → Authentication → Users
   - Create a new user with email and password, or
   - Use an existing test account

2. **Set environment variables** in `.env.test`:
   ```bash
   # Copy the example file
   cp .env.test.example .env.test

   # Edit with your test credentials
   TEST_EMAIL=your-test-user@example.com
   TEST_PASSWORD=your-test-password
   ```

The tests use these defaults if `.env.test` is not set:
- `TEST_EMAIL` → `test@example.com`
- `TEST_PASSWORD` → `test-password`

**Note:** The auth tests (login/signup) don't require pre-existing credentials and will test the auth flows. The couples/vendors/tasks tests require an existing test account.

## Writing New Tests

### Using the Helpers

```typescript
import { test, expect } from '@playwright/test';
import { login, addCouple, search } from './helpers';

test('example test', async ({ page }) => {
  await login(page, 'test@example.com', 'password');
  await page.goto('/couples');
  await addCouple(page, { name: 'John & Jane Doe', email: 'john@example.com' });
  await search(page, 'John');
  await expect(page.locator('text=John')).toBeVisible();
});
```

### Common Patterns

**Wait for page to load:**
```typescript
await page.waitForLoadState('networkidle');
```

**Find elements flexibly:**
```typescript
// Use OR for multiple selectors
await expect(page.locator('text=Add Task').or(page.locator('button:has-text("Create")'))).toBeVisible();
```

**Handle optional elements:**
```typescript
if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
  // Element exists
}
```

## Debugging

### View test report
After running tests, open the HTML report:
```bash
npx playwright show-report
```

### Debug a specific test
```bash
npx playwright test tests/e2e/auth.spec.ts --debug
```

### Take screenshots
Screenshots are automatically taken on failure in `test-results/`.

## Notes

- Tests use flexible selectors to handle different UI implementations
- Empty state tests will pass if elements don't exist (graceful degradation)
- Tests wait for network activity to settle before asserting
- Slide-overs/modals are closed after each test interaction

## CI/CD Integration

In CI environments, tests:
- Run with a single worker (no parallelization)
- Retry failed tests up to 2 times
- Generate HTML reports
- Take screenshots on failure

## Troubleshooting

**Tests timeout waiting to login:**
- Make sure `TEST_EMAIL` and `TEST_PASSWORD` are set in `.env.test`
- Verify the test account exists in your Supabase database
- Check that the dev server is running
- Ensure there are no subscription/billing redirects (check `/settings?tab=billing`)

**Couples/Vendors/Tasks tests fail immediately:**
- These tests require authentication
- Create a test account in Supabase: Dashboard → Authentication → Users
- Set up `.env.test` with valid credentials
- Try running a single test: `npx playwright test tests/e2e/couples.spec.ts --headed`

**Tests timeout waiting for elements:**
- Check that dev server is running on `http://localhost:3000`
- Verify selectors match your current UI structure
- Check browser console for JavaScript errors
- Try running in headed mode to see what's happening: `npm run test:e2e -- --headed`

**Modal/slide-over not closing:**
- Ensure close button selector is correct
- Try clicking outside the modal

**Authentication tests fail:**
- Verify `TEST_EMAIL` and `TEST_PASSWORD` are correct
- Check that user exists in your Supabase instance
- Verify email/password login is enabled
- Try manually logging in at `http://localhost:3000/login` to test credentials

**Getting "strict mode violation" or "resolved to N elements":**
- Update the selector to be more specific
- Use `button[type="submit"]` instead of `button:has-text("Save")`
- Use `h1:has-text("Title")` instead of `text=Title`

