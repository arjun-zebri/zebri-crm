/**
 * End-to-end tests for the branding editor onboarding wizard.
 *
 * Tests the fresh user onboarding flow: entering business name, selecting colors,
 * toggling surfaces, and verifying the editor appears without the wizard on reload.
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
  test.beforeEach(async () => {
    await resetFreshUserState()
  })
  test('Fresh user sees wizard, completes onboarding, editor shows tabs, wizard does not reappear on reload', async ({ page }) => {
    await login(page)
    await page.goto('/branding')

    await expect(page.getByRole('heading', { name: /let's start with your identity/i })).toBeVisible({ timeout: 5000 })

    const businessNameInput = page.locator('input[placeholder*="business" i], input[placeholder*="name" i], input[placeholder*="MC" i]').first()
    await businessNameInput.waitFor({ state: 'visible', timeout: 5000 })
    await businessNameInput.fill('Test MC')

    const nextButton = page.getByRole('button', { name: /next/i }).first()
    await nextButton.click()
    await page.waitForTimeout(200)

    await expect(page.getByRole('heading', { name: /choose your look/i })).toBeVisible({ timeout: 5000 })

    // Set brand color via the hex textbox
    const colorInput = page.getByLabel(/brand color hex/i)
    await colorInput.waitFor({ state: 'visible', timeout: 5000 })
    await colorInput.clear()
    await colorInput.fill('#8B5CF6')

    await nextButton.click()
    await page.waitForTimeout(200)

    await expect(page.getByRole('heading', { name: /which documents/i })).toBeVisible({ timeout: 5000 })

    // Uncheck Invoices if it's checked
    const invoiceCheckbox = page.getByRole('checkbox', { name: /invoices/i })
    if (await invoiceCheckbox.isChecked()) {
      await invoiceCheckbox.click()
    }

    const finishButton = page.getByRole('button', { name: /finish|complete/i }).first()
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

  test('Branding page loads successfully', async ({ page }) => {
    // This test verifies the branding page loads successfully and contains
    // the main navigation/UI elements.
    await login(page)
    await page.goto('/branding')

    // Just verify the page contains the main element
    const mainContent = page.locator('main')
    await expect(mainContent).toBeVisible({ timeout: 10000 })
  })
})
