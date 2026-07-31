/**
 * Invoice builder — payment schedule modal redesign e2e.
 *
 * Covers the MC-side flow the redesign introduced: the empty state applies the
 * default schedule in one tap, "Change" is the single door into the library,
 * the library duplicates and edits a schedule in a focused editor, and
 * re-applying the edited schedule is reflected on the invoice timeline. The
 * flow creates and deletes its own throwaway schedule, so it never mutates the
 * seeded "Default" and stays repeatable against a real database.
 *
 * NOTE: needs the payment_schedules migration on the target DB
 * (20260730000000). Against a dev server pointed at the remote DB this passes
 * only after the CI migration deploy; otherwise run it against an isolated
 * local Supabase (see the project's live-verification recipe).
 */
import { expect, test } from '@playwright/test'

import { login, uniqueName } from './helpers'

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
  test('apply the default, duplicate and edit it, and reflect it on the invoice', async ({
    page,
  }) => {
    await login(page)
    await openPricedInvoice(page)

    // Empty state: one tap applies the MC's named default schedule.
    await page.getByRole('button', { name: /Apply .*Default/i }).click()

    // The timeline and its always-visible running total appear.
    await expect(page.getByText(/Stages total .* of \$4,000\.00/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Add stage/i })).toBeVisible()

    // "Change" is the only door into the library.
    await page.getByRole('button', { name: 'Change' }).click()
    await expect(page.getByRole('heading', { name: 'Payment schedule' })).toBeVisible()

    // Duplicate the seeded default into a throwaway with valid stages, so the
    // edit below never mutates the shared "Default".
    await page.getByRole('button', { name: /Row actions/i }).first().click()
    await page.getByRole('button', { name: /^Duplicate$/i }).click()

    // Edit the copy: rename it and shift a due offset, then save to the library.
    const scheduleName = uniqueName('Plan')
    await page
      .getByRole('button', { name: /Default copy/i })
      .locator('..')
      .getByRole('button', { name: /Row actions/i })
      .click()
    await page.getByRole('button', { name: /^Edit$/i }).click()

    const nameField = page.getByLabel('Schedule name')
    await nameField.fill(scheduleName)
    await page.getByLabel('Days after issue').last().fill('45')
    await page.getByRole('button', { name: /^Save$/i }).click()

    // Back on the list, applying the edited schedule closes the modal and the
    // invoice reflects it (the running total still balances against the total).
    await page.getByRole('button', { name: new RegExp(scheduleName, 'i') }).click()
    await expect(page.getByRole('heading', { name: 'Payment schedule' })).toBeHidden()
    await expect(page.getByText(/Stages total .* of \$4,000\.00/i)).toBeVisible()

    // Clean up the throwaway schedule so the library does not accumulate junk.
    await page.getByRole('button', { name: 'Change' }).click()
    await page
      .getByRole('button', { name: new RegExp(scheduleName, 'i') })
      .locator('..')
      .getByRole('button', { name: /Row actions/i })
      .click()
    await page.getByRole('button', { name: /^Delete$/i }).click()
    await page
      .locator('div[role="dialog"]', { hasText: 'Delete schedule?' })
      .getByRole('button', { name: /^Delete$/i })
      .click()
    await expect(page.getByRole('button', { name: new RegExp(scheduleName, 'i') })).toBeHidden()
  })
})
