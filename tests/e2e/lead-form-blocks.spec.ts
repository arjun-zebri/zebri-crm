/**
 * End-to-end tests for the block-based Website form (`lead`) branding surface.
 *
 * Covers the editor side (the Website form tab + readiness flag when the Name
 * field or Submit button is removed) and the public side (the block-designed
 * form renders, submits to a branded success state, and the lead lands in the
 * MC's pipeline; `?embed=1` renders chromeless).
 *
 * Requires the running app AND the `20260813000000_lead_form_blocks` migration
 * on the target database, plus a resettable state — so, like the other branding
 * e2e, this is guarded to the isolated local-Supabase stack and deferred: it is
 * not executed in the authoring session (the migration ships via CI). Against a
 * database without the migration `get_lead_form` returns no block tree and the
 * public page falls back to the fixed form, so the block assertions here are
 * expected to be skipped until the stack is available.
 *
 * @module tests/e2e/lead-form-blocks.spec.ts
 */
import { test, expect } from '@playwright/test'

import { login, uniqueName } from './helpers'

test.describe('Website form (block-based)', () => {
  // Guard: these tests depend on the isolated local-Supabase stack for the
  // migration + a resettable branding state (mirrors branding-readiness.spec).
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL?.includes('3123') && !process.env.BRANDING_E2E,
    'requires the isolated local-supabase stack (port 3123 or BRANDING_E2E=true)',
  )

  test.describe('Editor - Website form surface + readiness', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
      await page.goto('/branding')
      // Dismiss the onboarding wizard if it is showing (fresh account).
      const wizardHeading = page.getByRole('heading', { name: /let's start with your identity/i })
      if (await wizardHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.getByLabel('Business name').fill('Test MC')
        await page.getByRole('button', { name: /next/i }).first().click()
        await page.waitForTimeout(200)
        const finishBtn = page.getByRole('button', { name: /finish|complete/i }).first()
        if (await finishBtn.isVisible({ timeout: 1000 }).catch(() => false)) await finishBtn.click()
      }
      await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeVisible({ timeout: 10000 })
    })

    test('shows the Website form tab and its default form', async ({ page }) => {
      await page.getByRole('button', { name: /^website form$/i }).click()
      // The seeded default form has a Submit button preview.
      await expect(page.getByRole('button', { name: /send enquiry/i })).toBeVisible()
    })

    test('deleting the Submit button raises the Not ready flag; re-adding clears it', async ({ page }) => {
      await page.getByRole('button', { name: /^website form$/i }).click()

      // Select the submit button preview, then delete it.
      await page.getByRole('button', { name: /send enquiry/i }).click()
      const deleteBtn = page.getByRole('button', { name: /delete block/i })
      await expect(deleteBtn).toBeVisible({ timeout: 2000 })
      await deleteBtn.click()

      const panel = page.getByRole('heading', { name: 'Not ready to send' })
      await expect(panel).toBeVisible({ timeout: 2000 })

      // Re-add the Submit button from the palette; the flag clears.
      await page.getByRole('button', { name: /add block|blocks?/i }).first().click()
      await page.getByRole('button', { name: /submit button/i }).click()
      await expect(panel).toBeHidden({ timeout: 2000 })
    })
  })

  test.describe('Public - block-designed form', () => {
    test('a visitor submits the block form and the lead lands in the pipeline', async ({ page, context }) => {
      await login(page)
      await page.goto('/settings?tab=lead-capture', { waitUntil: 'networkidle' })
      const hostedUrl = await page.getByLabel('Hosted link').inputValue()
      expect(hostedUrl).toContain('/lead/')

      const visitor = await context.newPage()
      await visitor.goto(hostedUrl, { waitUntil: 'networkidle' })

      const leadName = uniqueName('Lead')
      await visitor.getByRole('textbox', { name: /your name/i }).fill(leadName)
      await visitor
        .getByRole('textbox', { name: /email/i })
        .fill(`${leadName.replace(/\s+/g, '.').toLowerCase()}@example.test`)
      await visitor.getByRole('button', { name: /send enquiry/i }).click()

      // Branded success message from the formSubmit block.
      await expect(visitor.getByText(/thanks/i)).toBeVisible()
      await visitor.close()

      await page.goto('/couples', { waitUntil: 'networkidle' })
      await expect(page.getByText(leadName)).toBeVisible()
    })

    test('embed mode renders chromeless (no standalone heading)', async ({ page, context }) => {
      await login(page)
      await page.goto('/settings?tab=lead-capture', { waitUntil: 'networkidle' })
      const hostedUrl = await page.getByLabel('Hosted link').inputValue()

      const embed = await context.newPage()
      await embed.goto(`${hostedUrl}?embed=1`, { waitUntil: 'networkidle' })
      await expect(embed.getByRole('button', { name: /send enquiry/i })).toBeVisible()
      await expect(embed.getByRole('heading', { level: 1 })).toHaveCount(0)
      await embed.close()
    })
  })
})
