/**
 * End-to-end tests for the welcome onboarding wizard.
 *
 * Each test gets its own isolated user via freshEmail(tag) to prevent cross-worker races
 * under fullyParallel execution. Supports all 5 Playwright projects (chromium, firefox,
 * webkit, Mobile Chrome, Mobile Safari) with independent state per test.
 *
 * Tests the fresh user onboarding flow: entering contact details (name, phone,
 * website), walking through preview steps, and verifying the modal closes after
 * completing the wizard. Also tests that dismissing early preserves entered data.
 *
 * REQUIRES isolated local Supabase stack on port 3123 for user creation and state reset.
 *
 * @module tests/e2e/welcome-onboarding.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const TEST_PASSWORD = 'test-password-e2e'

/**
 * Generate a per-test user email with isolation across projects and test cases.
 *
 * Returns an email like test-fresh-walk-chromium@zebri.com.au or
 * test-fresh-dismiss-mobile-chrome@zebri.com.au. Ensures no collisions
 * when all 5 Playwright projects run fullyParallel.
 */
function freshEmail(tag: string, projectName: string): string {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `test-fresh-${tag}-${slug}@zebri.com.au`
}

/**
 * Create or reset a fresh test user via Supabase admin API.
 *
 * Deletes any existing user with this email and creates a new one with
 * app_metadata for account type and subscription. Marks email as confirmed
 * by setting the email_confirmed_at field in the identity record via
 * a second update call. Clears welcome_onboarded_at to allow the wizard to open.
 *
 * This is the source of truth for test isolation: each test gets its own user
 * with a clean slate.
 *
 * Guarded to port 3123; returns silently if not on a local server.
 */
async function ensureFreshUser(email: string) {
  const isLocalServer = process.env.PLAYWRIGHT_BASE_URL?.includes('3123')
  if (!isLocalServer) return

  const key = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
  if (!key) return

  const headers = {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json',
  }

  try {
    // Fetch and delete user if it exists
    const listRes = await fetch(
      `${LOCAL_SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
      { headers }
    )
    if (listRes.ok) {
      const data = await listRes.json()
      const existingUser = data?.users?.[0]
      if (existingUser) {
        await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`, {
          method: 'DELETE',
          headers,
        })
        await new Promise(r => setTimeout(r, 50))
      }
    }

    // Create the user confirmed at birth. Without email_confirm the
    // password grant fails with "Email not confirmed" and the login
    // form never leaves /login.
    const createRes = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password: TEST_PASSWORD,
        email_confirm: true,
        app_metadata: {
          account_type: 'standard',
          subscription_status: 'active',
        },
        user_metadata: {
          display_name: 'Fresh Tester',
          business_name: 'Fresh MC',
        },
      }),
    })

    if (!createRes.ok) {
      console.error('Failed to create user:', createRes.status)
      return
    }
  } catch (err) {
    console.error('ensureFreshUser error:', err)
  }
}

/**
 * Login with a specific email and password.
 *
 * Does not rely on TEST_EMAIL env var (which is globally shared).
 * Follows the same flow as the shared helpers.login() but allows per-test customization.
 */
async function loginAs(page: Page, email: string) {
  // Fast path: if storageState already has a valid session, '/' won't redirect to /login
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  if (!page.url().includes('/login')) {
    return
  }

  // Full login flow
  await page.goto('/login', { waitUntil: 'networkidle' })

  const emailInput = page.locator('input[name="email"]')
  const passwordInput = page.locator('input[name="password"]')
  const submitButton = page.locator('button[type="submit"]')

  await emailInput.waitFor({ state: 'visible', timeout: 10000 })
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 })

  await emailInput.fill(email)
  await emailInput.dispatchEvent('change')
  await passwordInput.fill(TEST_PASSWORD)
  await passwordInput.dispatchEvent('change')

  await page.waitForTimeout(300)
  await submitButton.click()

  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20000 })
}

/**
 * Drop every cached onboarding hint in the browser.
 *
 * The gate stores one key per user id, so a fixed key name would miss
 * any account but the one that happened to be hard-coded. Sweeping the
 * prefix keeps the reset honest no matter which user the test created.
 */
async function clearWelcomeCache(page: Page) {
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('zebri:welcome-onboarded'))
      .forEach(k => localStorage.removeItem(k))
  })
}

test.describe('Welcome onboarding', () => {
  // Guard: these tests depend on local Supabase for user creation and state reset
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL?.includes('3123'),
    'requires the isolated local-supabase stack (port 3123)'
  )

  test('a fresh user walks all eight steps', async ({ page }) => {
    const projectName = test.info().project.name
    const email = freshEmail('walk', projectName)
    await ensureFreshUser(email)
    await loginAs(page, email)
    await clearWelcomeCache(page)
    await page.goto('/')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByRole('heading', { name: /welcome to zebri/i })).toBeVisible()

    await dialog.getByRole('button', { name: /next/i }).click()
    await expect(dialog.getByLabel('Your name')).toBeVisible()
    await dialog.getByLabel('Phone').fill('+61 400 111 222')

    await dialog.getByRole('button', { name: /next/i }).click()
    await expect(dialog.getByLabel('Website')).toBeVisible()
    await dialog.getByLabel('Website').fill('https://example.com')

    // Steps 4 to 7 are previews: advance through each.
    for (const heading of [/add a couple/i, /create a template/i, /send it/i, /let it run/i]) {
      await dialog.getByRole('button', { name: /next/i }).click()
      await expect(dialog.getByRole('heading', { name: heading })).toBeVisible()
    }

    await dialog.getByRole('button', { name: /next/i }).click()
    await expect(dialog.getByRole('heading', { name: /a note from the founder/i })).toBeVisible()

    await dialog.getByRole('button', { name: /finish/i }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('dismissing at a preview keeps the details and does not reopen', async ({ page }) => {
    const projectName = test.info().project.name
    const email = freshEmail('dismiss', projectName)
    await ensureFreshUser(email)
    await loginAs(page, email)
    await clearWelcomeCache(page)
    await page.goto('/')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await dialog.getByRole('button', { name: /next/i }).click()
    await dialog.getByLabel('Phone').fill('+61 400 999 888')
    await dialog.getByRole('button', { name: /next/i }).click()
    await dialog.getByRole('button', { name: /next/i }).click() // saves, lands on step 4
    await expect(dialog.getByRole('heading', { name: /add a couple/i })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()

    await page.reload()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // The phone entered before the drop-out survived. Each test uses its own
    // user, so we assert the exact value this test wrote. Selected by
    // placeholder because the legacy Settings markup has no label-input
    // association yet (tracked for the Settings hardening phase).
    await page.goto('/settings')
    const phoneField = page.getByPlaceholder('+61 400 000 000')
    await expect(phoneField).toHaveValue('+61 400 999 888')
  })
})
