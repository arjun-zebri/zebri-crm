# Quick Start: Running E2E Tests

## 1. Install Dependencies
```bash
npm install
```

## 2. Set Up Test Account

You need a test user account in Supabase **with an active subscription**:

### Create a test account in Supabase
1. Go to your Supabase dashboard
2. Click **Authentication** in the sidebar
3. Click **Users**
4. Click **Add user** (or use existing test account)
5. Enter email: `test@example.com` and password: `test-password` (or your preferred credentials)
6. ⚠️ **Important**: The account must have an **active subscription** to access the app
   - Without a subscription, you'll be redirected to `/settings?tab=billing`
   - In development, set the subscription manually in `user_metadata` or via your Supabase dashboard

### Configure test environment
```bash
# Copy the example file
cp .env.test.example .env.test

# Edit .env.test with your credentials
# TEST_EMAIL=test@example.com
# TEST_PASSWORD=test-password
```

## 3. Install Playwright browsers (one-time setup)
```bash
npx playwright install
```

## 4. Run the tests!

### Run all tests
```bash
npm run test:e2e
```

### Run tests with UI (recommended for development)
```bash
npm run test:e2e:ui
```

This opens an interactive UI where you can:
- See all tests
- Run/debug individual tests
- Watch tests run in the browser
- View test reports

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run specific test file
```bash
npx playwright test tests/e2e/auth.spec.ts
```

### Run tests matching a pattern
```bash
npx playwright test -g "login"
```

## Test Suite Overview

- **auth.spec.ts** - Tests login, signup, password reset (no login required)
- **couples.spec.ts** - Tests couple management (requires login)
- **vendors.spec.ts** - Tests vendor management (requires login)
- **tasks.spec.ts** - Tests task management (requires login)

## Common Issues

**"Test timeout" or "element not found":**
- Make sure dev server is running: `npm run dev`
- Verify `.env.test` has correct credentials
- Check that test account exists in Supabase

**"Redirect to /settings?tab=billing":**
- Your test account might not have an active subscription
- Create a fresh test account or ensure subscription is set up correctly

**Want to see what's happening:**
- Run with `--headed` flag to see the browser
- Run with `--debug` to step through tests
- Check `test-results/` folder for screenshots on failure

## Next Steps

- Read `README.md` for detailed documentation
- Check `authenticated.spec.example.ts` for how to write authenticated tests
- Review `helpers.ts` for reusable test utilities

