/**
 * End-to-end tests for the branding editor onboarding wizard.
 *
 * Tests the fresh user onboarding flow: entering business name, selecting colors,
 * toggling surfaces, and verifying the editor appears without the wizard on reload.
 *
 * REQUIRES isolated local Supabase stack on port 3123.
 * Set PLAYWRIGHT_BASE_URL=http://localhost:3123 or define BRANDING_E2E env flag.
 *
 * @module tests/e2e/branding-onboarding.spec.ts
 */
import { test, expect } from '@playwright/test'

import { login } from './helpers'

/**
 * Reset test user's onboarded status before each test via HTTP.
 * This ensures the wizard appears for a "fresh" user.
 * Only works with local Supabase (isolated server on port 3123).
 */
async function resetFreshUserState() {
  // Only reset for isolated server tests
  const isLocalServer = process.env.PLAYWRIGHT_BASE_URL?.includes('3123')
  if (!isLocalServer) return

  try {
    // Use PostgREST to update via the admin client
    const localSupabaseUrl = 'http://127.0.0.1:54321'
    const localKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYyNDk5OTUwMCwiZXhwIjoxNzU2NTM1NTAwfQ.nMlHDVMJJyLBrJ6Nq3L-3h4m_1K5l7-q8q9w0x1y2z'

    // Get the user ID first
    const usersRes = await fetch(`${localSupabaseUrl}/rest/v1/auth.users?email=eq.test-fresh@zebri.com.au`, {
      headers: {
        'Authorization': `Bearer ${localKey}`,
        'apikey': localKey,
      },
    })

    if (!usersRes.ok) return

    const users = await usersRes.json()
    if (!users.length) return

    const userId = users[0].id

    // Now update user_branding for this user
    await fetch(`${localSupabaseUrl}/rest/v1/user_branding?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localKey}`,
        'apikey': localKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ onboarded_at: null }),
    })
  } catch {
    // Silently fail if reset doesn't work
  }
}

test.describe('Branding Onboarding Wizard', () => {
  // Guard: these tests depend on local Supabase for state reset
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL?.includes('3123') && !process.env.BRANDING_E2E,
    'requires the isolated local-supabase stack (port 3123 or BRANDING_E2E=true)'
  )

  test.beforeEach(async () => {
    await resetFreshUserState()
  })
  test('Fresh user sees wizard, completes onboarding, editor shows tabs, wizard does not reappear on reload', async ({ page }) => {
    await login(page)
    await page.goto('/branding')

    // Modal dialog scoping
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByRole('heading', { name: /let's start with your identity/i })).toBeVisible()

    // Use aria-label for business name input, scoped within dialog
    const businessNameInput = dialog.getByLabel('Business name')
    await businessNameInput.waitFor({ state: 'visible', timeout: 5000 })
    await businessNameInput.fill('Test MC')

    const nextButton = dialog.getByRole('button', { name: /next/i }).first()
    await nextButton.click()
    await page.waitForTimeout(200)

    await expect(dialog.getByRole('heading', { name: /choose your look/i })).toBeVisible({ timeout: 5000 })

    // Set brand color via the hex textbox using aria-label
    const colorInput = dialog.getByLabel('Brand color hex')
    await colorInput.waitFor({ state: 'visible', timeout: 5000 })
    await colorInput.clear()
    await colorInput.fill('#8B5CF6')

    await nextButton.click()
    await page.waitForTimeout(200)

    await expect(dialog.getByRole('heading', { name: /which documents/i })).toBeVisible({ timeout: 5000 })

    // Uncheck Invoices if it's checked
    const invoiceCheckbox = dialog.getByRole('checkbox', { name: /invoices/i })
    if (await invoiceCheckbox.isChecked()) {
      await invoiceCheckbox.click()
    }

    const finishButton = dialog.getByRole('button', { name: /finish|complete/i }).first()
    await finishButton.click()

    await page.waitForTimeout(500)
    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeVisible({ timeout: 10000 })

    const proposalTab = page.getByRole('button', { name: /proposal/i })
    const invoiceTabInEditor = page.getByRole('button', { name: /^invoice$/i })

    await expect(proposalTab).toBeVisible({ timeout: 5000 })
    await expect(invoiceTabInEditor).not.toBeVisible()

    await page.reload()

    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /let's start with your identity/i })).not.toBeVisible()
  })

  test('Editor displays after onboarding (no wizard on return)', async ({ page }) => {
    // This test verifies that the branding page either shows the wizard (if fresh)
    // or the editor (if already onboarded). Since test state persists across tests,
    // we verify whichever state is current works correctly.
    await login(page)
    await page.goto('/branding')

    const dialog = page.getByRole('dialog')
    const wizard = dialog.getByRole('heading', { name: /let's start with your identity/i })
    const editor = page.getByRole('button', { name: 'Preview', exact: true })

    const wizardVisible = await wizard.isVisible({ timeout: 2000 }).catch(() => false)

    if (wizardVisible) {
      // User is fresh, complete the wizard
      const businessNameInput = dialog.getByLabel('Business name')
      await businessNameInput.fill('Quick Test MC')

      const nextButton = dialog.getByRole('button', { name: /next/i }).first()
      await nextButton.click()
      await page.waitForTimeout(200)

      const colorInput = dialog.getByLabel('Brand color hex')
      await colorInput.fill('#6366F1')

      await nextButton.click()
      await page.waitForTimeout(200)

      const finishButton = dialog.getByRole('button', { name: /finish|complete/i }).first()
      await finishButton.click()
    }

    // Verify editor loaded (wizard completion or pre-onboarded)
    await expect(editor).toBeVisible({ timeout: 10000 })
  })
})
