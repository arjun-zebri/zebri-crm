/**
 * Invoice builder — "Prices include GST" + first-paint skeleton e2e.
 *
 * Covers the MC-side flow: the Invoices tab opens the builder, the form
 * and the branded preview arrive together (no mid-edit reflow), the Tax
 * chip's "Prices include GST" checkbox flips the chip to "GST incl.",
 * the disclosure appears in the couple-facing preview, and the flag
 * survives a save + reopen.
 *
 * NOTE: needs the gst_inclusive migration on the target DB
 * (20260730150000). Against a dev server pointed at the remote DB this
 * passes only after the CI migration deploy.
 */
import { expect, test } from '@playwright/test'

import { login, uniqueName } from './helpers'

/**
 * Open the invoice builder on a fresh draft with a couple selected.
 *
 * Deliberately picks whichever couple already exists rather than
 * creating one: the couple is incidental to what these tests check, and
 * driving the /couples create flow only adds a way for a GST assertion
 * to fail for an unrelated reason.
 */
async function openNewInvoice(page: import('@playwright/test').Page) {
  await page.goto('/payments')
  await page.getByRole('button', { name: 'Invoices' }).click()
  await page.getByRole('button', { name: /New invoice/i }).first().click()
  await page.getByRole('heading', { name: 'Notes' }).waitFor()

  await page.getByText('Select couple', { exact: false }).first().click()
  const firstCouple = page.locator('[data-radix-popper-content-wrapper] button').first()
  await firstCouple.waitFor()
  await firstCouple.click()
}

test.describe('invoice builder: prices include GST', () => {
  test('the form and the branded preview reveal together', async ({ page }) => {
    await login(page)
    await page.goto('/payments')
    await page.getByRole('button', { name: 'Invoices' }).click()
    await page.getByRole('button', { name: /New invoice/i }).first().click()

    // Once the Notes field is up, the skeleton has been swapped for the
    // real form — and the preview pane must already be there rather than
    // arriving a beat later.
    //
    // The first assertion gets a generous timeout because the reveal waits
    // on real queries (and WebKit is the slowest of the three engines).
    // What this test pins is that the two arrive TOGETHER, not that they
    // arrive quickly, so the assertions after it keep the tight default: if
    // the preview lagged the form, they would fail.
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible()
    // The branded surface itself, not a placeholder pulse.
    await expect(page.getByText(/Branded as|Using default branding/)).toBeVisible()
  })

  test('ticking the checkbox labels the chip and discloses GST to the couple', async ({
    page,
  }) => {
    await login(page)
    await openNewInvoice(page)

    await page.getByRole('button', { name: /Add your first line item|Add line item/i })
      .first()
      .click()
    await page.getByPlaceholder('Description').last().fill('Full-day hosting')
    await page.getByPlaceholder('0.00').last().fill('3300')

    // No rate set: the chip is the neutral "Tax".
    const taxChip = page.getByRole('button', { name: /Add tax/i })
    await expect(taxChip).toHaveText('Tax')
    await taxChip.click()

    await page.getByRole('checkbox', { name: /Prices include GST/i }).click()
    await page.getByRole('button', { name: /Done/i }).click()

    // Chip reflects the note without a rate, and no GST was added on top.
    await expect(page.getByRole('button', { name: /Edit tax settings/i })).toHaveText(
      'GST incl.',
    )
    await expect(page.getByText('Prices include GST').first()).toBeVisible()
    await expect(page.getByText('$3,300.00').first()).toBeVisible()
  })

  test('the flag survives a save and reopen', async ({ page }) => {
    await login(page)
    await openNewInvoice(page)

    await page.getByRole('button', { name: /Add your first line item|Add line item/i })
      .first()
      .click()
    await page.getByPlaceholder('Description').last().fill('Ceremony hosting')
    await page.getByPlaceholder('0.00').last().fill('1800')

    await page.getByRole('button', { name: /Add tax/i }).click()
    await page.getByRole('checkbox', { name: /Prices include GST/i }).click()
    await page.getByRole('button', { name: /Done/i }).click()

    const title = uniqueName('GST Invoice')
    await page.getByPlaceholder(/invoice title|Invoice for/i).first().fill(title)
    await page.getByRole('button', { name: /Save changes/i }).click()
    await expect(page.getByText('Invoice saved')).toBeVisible()

    // Reload rather than closing the modal: a full navigation proves the
    // flag came back from the database, not from surviving client state.
    // (The shared Modal's X button has no accessible name, so there is no
    // semantic locator for it — worth fixing, but not from here.)
    await page.goto('/payments')
    await page.getByRole('button', { name: 'Invoices' }).click()

    // Filter to this invoice, then click it by title.
    //
    // The payments list renders BOTH layouts into the DOM at once and hides
    // one with a responsive class, so an unqualified title match resolves to
    // two nodes and `.first()` picks whichever the current viewport has
    // hidden. Filtering on visibility is what makes this work on desktop and
    // mobile alike.
    await page.getByPlaceholder(/Search invoices/i).fill(title)
    const entry = page.getByText(title).filter({ visible: true }).first()
    await entry.waitFor()
    await entry.click()
    await expect(page.getByRole('button', { name: /Edit tax settings/i })).toHaveText(
      'GST incl.',
    )

    // Clean up after ourselves: this suite runs against a real database,
    // and a test that leaves a draft behind on every run quietly fills the
    // MC's own invoice list with junk.
    await page.getByRole('button', { name: /Delete invoice/i }).click()
    await page.getByRole('button', { name: /^Delete$/ }).click()
    await expect(page.getByText('Invoice deleted')).toBeVisible()
  })
})
