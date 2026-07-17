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

test.describe('Branding Onboarding Wizard', () => {
  test('Fresh user sees wizard, completes onboarding, editor shows tabs, wizard does not reappear on reload', async ({ page }) => {
    await login(page)
    await page.goto('/branding')

    await expect(page.getByRole('heading', { name: /get started/i })).toBeVisible({ timeout: 5000 })

    const businessNameInput = page.locator('input[placeholder*="business" i], input[placeholder*="name" i], input[placeholder*="MC" i]').first()
    await businessNameInput.waitFor({ state: 'visible', timeout: 5000 })
    await businessNameInput.fill('Test MC')

    const nextButton = page.getByRole('button', { name: /next/i }).first()
    await nextButton.click()
    await page.waitForTimeout(200)

    await expect(page.getByRole('heading', { name: /brand color/i })).toBeVisible({ timeout: 5000 })

    const colorInput = page.locator('input[type="color"]').first()
    await colorInput.waitFor({ state: 'visible', timeout: 5000 })
    await colorInput.fill('#8B5CF6')

    await nextButton.click()
    await page.waitForTimeout(200)

    await expect(page.getByRole('heading', { name: /enabled surfaces|documents/i })).toBeVisible({ timeout: 5000 })

    const invoiceCheckbox = page.locator('div:has(input[type="checkbox"])').filter({ has: page.getByText(/invoice/i) }).first().locator('input[type="checkbox"]')
    if (await invoiceCheckbox.isVisible()) {
      const isChecked = await invoiceCheckbox.isChecked()
      if (isChecked) {
        await invoiceCheckbox.click()
      }
    }

    const finishButton = page.getByRole('button', { name: /finish|complete/i }).first()
    await finishButton.click()

    await page.waitForTimeout(500)
    await expect(page.getByRole('button', { name: /preview/i })).toBeVisible({ timeout: 10000 })

    const proposalTab = page.getByRole('button', { name: /proposal/i })
    const invoiceTabInEditor = page.getByRole('button', { name: /^invoice$/i })

    await expect(proposalTab).toBeVisible({ timeout: 5000 })
    await expect(invoiceTabInEditor).not.toBeVisible()

    await page.reload()

    await expect(page.getByRole('button', { name: /preview/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /get started/i })).not.toBeVisible()
  })

  test('Wizard appears for fresh user on desktop', async ({ page }) => {
    await login(page)
    await page.goto('/branding')

    await expect(page.getByRole('heading', { name: /get started/i })).toBeVisible({ timeout: 5000 })
  })
})
