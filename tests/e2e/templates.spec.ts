import { test, expect } from '@playwright/test'

import { login, uniqueName } from './helpers'

/**
 * Email Templates library — page render + the create flow with a live,
 * variable-filled preview. (Starter-library seeding is covered by the
 * integration test, which runs against a known-clean local DB.)
 */
test.describe('Email Templates library', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/templates', { waitUntil: 'networkidle' })
  })

  test('renders the page header and New button', async ({ page }) => {
    await expect(page.locator('h1:has-text("Templates")')).toBeVisible()
    await expect(page.locator('button:has-text("New template")')).toBeVisible()
  })

  test('create a template with a live, variable-filled preview', async ({ page }) => {
    const name = uniqueName('E2E Template')
    await page.locator('button:has-text("New template")').click()

    // The editor modal is open once its name field is present.
    const nameField = page.getByPlaceholder('e.g. Quote follow-up')
    await expect(nameField).toBeVisible()
    await nameField.fill(name)
    await page.getByPlaceholder('e.g. Your quote from {{mc.business_name}}').fill('Hi {{couple.primary_name}}')

    // The preview resolves the sample couple's primary name.
    await expect(page.getByText('Hi Sam', { exact: false }).first()).toBeVisible()

    await page.locator('button:has-text("Save template")').click()
    await expect(page.getByText(name).first()).toBeVisible()
  })
})
