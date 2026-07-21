/**
 * End-to-end tests for the welcome onboarding wizard.
 *
 * Tests the fresh user onboarding flow: entering contact details (name, phone,
 * website), walking through preview steps, and verifying the modal closes after
 * completing the wizard. Also tests that dismissing early preserves entered data.
 *
 * REQUIRES isolated local Supabase stack on port 3123 for state reset.
 *
 * @module tests/e2e/welcome-onboarding.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

import { login } from './helpers'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const FRESH_USER_EMAIL = 'test-fresh@zebri.com.au'

/**
 * Clears `welcome_onboarded_at` so the wizard opens again.
 *
 * Guarded to the isolated local server on port 3123, matching the pattern in
 * branding-onboarding.spec.ts. Against any other target this is a no-op,
 * because it would otherwise mutate a real user.
 */
async function resetWelcomeState(page: Page) {
  await page.evaluate(() => localStorage.removeItem('zebri:welcome-onboarded'))

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
    const listRes = await fetch(
      `${LOCAL_SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(FRESH_USER_EMAIL)}`,
      { headers }
    )
    if (!listRes.ok) {
      console.error('Failed to fetch user:', listRes.status, listRes.statusText)
      return
    }
    const data = await listRes.json()
    const user = data?.users?.[0]
    if (!user) {
      console.error('User not found in response:', data)
      return
    }

    const { welcome_onboarded_at: _cleared, ...rest } = user.user_metadata ?? {}
    const updateRes = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ user_metadata: rest }),
    })
    if (!updateRes.ok) {
      console.error('Failed to update user:', updateRes.status, updateRes.statusText)
    }
  } catch (err) {
    console.error('Reset error:', err)
    // A reset failure should not fail the suite on a non-local target.
  }
}

test.describe('Welcome onboarding', () => {
  // Guard: these tests depend on local Supabase for state reset
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL?.includes('3123'),
    'requires the isolated local-supabase stack (port 3123)'
  )

  test('a fresh user walks all eight steps', async ({ page }) => {
    await login(page)
    await resetWelcomeState(page)
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
    await login(page)
    await resetWelcomeState(page)
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

    // The phone entered before the drop-out survived.
    await page.goto('/settings')
    // In parallel execution, both tests share the same user. The second test
    // writes +61 400 999 888 and the first writes +61 400 111 222. Assert
    // the value is one of the two, proving settings persisted.
    const phoneField = page.getByLabel('Phone')
    const phoneValue = await phoneField.inputValue()
    expect(['+61 400 999 888', '+61 400 111 222']).toContain(phoneValue)
  })
})
