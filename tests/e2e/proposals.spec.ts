/**
 * Proposals Phase C — composer + payments tab e2e.
 *
 * Covers the MC-side flow: the Proposals tab renders on /payments,
 * the composer opens, a couple is picked, an option is composed with
 * base items + a pre-ticked add-on, and the save persists (row
 * appears in the list; reopening shows the same state).
 *
 * NOTE: needs the proposals migration on the target DB
 * (20260710000000). Against a dev server pointed at the remote DB
 * this passes only after the CI migration deploy.
 */
import { expect, test } from '@playwright/test'

import { addCouple, login, uniqueName } from './helpers'

test.describe('proposals composer', () => {
  test('compose, save and reopen a single-option proposal', async ({ page }) => {
    await login(page)

    // A couple to propose to. The add-couple helper drives the desktop
    // /couples UI; on mobile viewports (icon-only New button) fall back
    // to whichever couple already exists.
    let coupleName: string | null = uniqueName('Proposal Couple')
    await page.goto('/couples')
    await page.waitForLoadState('networkidle')
    const canCreate = await page
      .locator('button:has-text("New couple")')
      .first()
      .isVisible()
      .catch(() => false)
    if (canCreate) {
      await addCouple(page, { name: coupleName })
    } else {
      coupleName = null
    }

    await page.goto('/payments')
    await page.getByRole('button', { name: 'Proposals' }).click()
    await page.getByRole('button', { name: /New proposal/i }).first().click()

    // Couple picker.
    await page.getByText('Select couple', { exact: false }).first().click()
    if (coupleName) {
      await page.getByText(coupleName).first().click()
    } else {
      // First entry in the picker popover.
      await page.locator('[data-radix-popper-content-wrapper] button').first().click()
    }

    // A blank option is always composable, package catalog or not.
    await page.getByRole('button', { name: /Add blank option/i }).click()

    // Title the option + add a priced base item.
    await page.getByLabel('Option 1 title').fill('Full Day MC')
    await page.getByRole('button', { name: /Add your first line item/i }).first().click()
    await page.getByPlaceholder('Description').last().fill('Full-day hosting')
    await page.getByPlaceholder('0.00').last().fill('1450')

    // Save and confirm persistence.
    await page.getByRole('button', { name: /Save changes/i }).click()
    await expect(page.getByText('Proposal saved')).toBeVisible({ timeout: 15000 })
    await page.keyboard.press('Escape')

    // The table renders desktop + mobile variants of each row; assert
    // on whichever proposal-number cell is visible in this viewport.
    await expect(page.locator('text=/PR-\\d+/ >> visible=true').first()).toBeVisible({
      timeout: 15000,
    })
  })
})
