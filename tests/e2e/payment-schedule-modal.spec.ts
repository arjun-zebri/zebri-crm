/**
 * Invoice builder — payment schedule modal (v2 redesign) e2e.
 *
 * Covers the single-modal flow: the empty invoice offers one "Add schedule"
 * button, the modal opens pre-loaded with the MC's default, Apply writes the
 * timeline onto the invoice, and reopening via "Change" edits an offset and
 * re-applies. One surface, no stacking. It does not save the invoice or mutate
 * the library, so it is self-contained and repeatable.
 *
 * NOTE: needs the payment_schedules tables + the time-unit columns on the
 * target DB (migrations 20260730000000 and 20260731010000). Against a dev
 * server pointed at the remote DB this passes only after the CI migration
 * deploy; otherwise run it against an isolated local Supabase.
 */
import { expect, test } from '@playwright/test'

import { login } from './helpers'

/**
 * Open the invoice builder on a fresh draft with a couple selected and one
 * priced line item, so the payment schedule has a non-zero total to resolve.
 */
async function openPricedInvoice(page: import('@playwright/test').Page) {
  await page.goto('/payments')
  await page.getByRole('button', { name: 'Invoices' }).click()
  await page.getByRole('button', { name: /New invoice/i }).first().click()
  await page.getByRole('heading', { name: 'Notes' }).waitFor({ timeout: 30_000 })

  await page.getByText('Select couple', { exact: false }).first().click()
  const firstCouple = page.locator('[data-radix-popper-content-wrapper] button').first()
  await firstCouple.waitFor()
  await firstCouple.click()

  await page
    .getByRole('button', { name: /Add your first line item|Add line item/i })
    .first()
    .click()
  await page.getByPlaceholder('Description').last().fill('Full-day hosting')
  await page.getByPlaceholder('0.00').last().fill('4000')
}

test.describe('invoice builder: payment schedule modal', () => {
  test('add a schedule, apply the default, then edit and re-apply', async ({ page }) => {
    await login(page)
    await openPricedInvoice(page)

    // Empty state: one button opens the modal, pre-loaded with the default.
    await page.getByRole('button', { name: /add schedule/i }).click()
    await expect(page.getByLabel('Schedule name')).toBeVisible()
    await expect(page.getByText(/Stages total .* of \$4,000\.00/i)).toBeVisible()

    // Apply writes the timeline onto the invoice and closes the modal.
    await page.getByRole('button', { name: /^apply$/i }).click()
    await expect(page.getByRole('button', { name: /^apply$/i })).toBeHidden()
    await expect(page.getByText(/Stages total .* of \$4,000\.00/i)).toBeVisible()

    // Reopen via the single "Change" door and edit the first stage's offset.
    await page.getByRole('button', { name: 'Change' }).click()
    await page.getByLabel('Offset amount').first().fill('14')

    // Re-apply; the invoice still balances against the total.
    await page.getByRole('button', { name: /^apply$/i }).click()
    await expect(page.getByRole('button', { name: /^apply$/i })).toBeHidden()
    await expect(page.getByText(/Stages total .* of \$4,000\.00/i)).toBeVisible()
  })
})
