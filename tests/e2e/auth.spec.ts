import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
  })

  // ── 1. Login page elements ────────────────────────────────────────────────
  test('displays login page with all form elements', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1:has-text("Sign In")')).toBeVisible()
    await expect(page.locator('input[id="email"]')).toBeVisible()
    await expect(page.locator('input[id="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('text=Forgot your password?')).toBeVisible()
    await expect(page.locator('text=Sign up')).toBeVisible()
  })

  // ── 2. Password type ──────────────────────────────────────────────────────
  test('password input is type=password', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[id="password"]')).toHaveAttribute('type', 'password')
  })

  // ── 3. Wrong password ─────────────────────────────────────────────────────
  test('rejects wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[id="email"]').fill('test@example.com')
    await page.locator('input[id="password"]').fill('definitely-wrong-password-xyz')
    await page.locator('button[type="submit"]').click()
    // Give it time to respond
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 4. Unregistered email ─────────────────────────────────────────────────
  test('rejects unregistered email', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[id="email"]').fill('notreal_xyz_123@example.com')
    await page.locator('input[id="password"]').fill('SomePassword123!')
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 5. Sign up link navigates to /signup ──────────────────────────────────
  test('"Sign up" link navigates to /signup', async ({ page }) => {
    await page.goto('/login')
    await page.locator('a[href="/signup"]').click()
    await expect(page).toHaveURL(/\/signup/)
  })

  // ── 6. Signup page form fields ────────────────────────────────────────────
  test('signup page has all form fields', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[id="displayName"]')).toBeVisible()
    await expect(page.locator('input[id="businessName"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[id="password"]')).toBeVisible()
    await expect(page.locator('input[id="confirmPassword"]')).toBeVisible()
  })

  // ── 7. Empty signup stays on page ────────────────────────────────────────
  test('empty signup form stays on /signup', async ({ page }) => {
    await page.goto('/signup')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/signup/, { timeout: 3000 })
  })

  // ── 8. Reset password page ────────────────────────────────────────────────
  test('navigates to reset-password from login', async ({ page }) => {
    await page.goto('/login')
    await page.locator('text=Forgot your password?').click()
    await expect(page).toHaveURL(/\/reset-password/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  // ── 9. /dashboard redirect ────────────────────────────────────────────────
  test('/dashboard redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 10. /couples redirect ─────────────────────────────────────────────────
  test('/couples redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 11. /vendors redirect ─────────────────────────────────────────────────
  test('/vendors redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/vendors', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 12. Successful login navigates away ───────────────────────────────────
  test('successful login navigates away from /login', async ({ page }) => {
    const email = process.env.TEST_EMAIL || 'test@example.com'
    const password = process.env.TEST_PASSWORD || 'test-password'

    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.locator('input[id="email"]').fill(email)
    await page.locator('input[id="email"]').dispatchEvent('change')
    await page.locator('input[id="password"]').fill(password)
    await page.locator('input[id="password"]').dispatchEvent('change')
    await page.waitForTimeout(300)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/(|dashboard|couples|vendors|settings)/, { timeout: 20000 })
    await expect(page).not.toHaveURL(/\/login/)
  })
})
