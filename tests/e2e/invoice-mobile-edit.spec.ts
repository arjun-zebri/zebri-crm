/**
 * Invoice builder on a phone — regression for ZEB-128.
 *
 * Below `lg:` the builder stacks the form above the preview. The form
 * pane used to keep its desktop `min-h-0 overflow-y-auto` inside an
 * `h-full` grid, so the preview's `min-h-[60vh]` took the whole modal
 * and the form collapsed to ~8px: an MC could open an invoice on her
 * phone but not edit it.
 *
 * Playwright scrolls inside clipped containers on its own, so "the
 * field is visible" would pass even with the bug. These tests pin the
 * layout itself (the form pane is never a clipped scroll box on a
 * phone) and then drive a real edit → save → reload round trip.
 */
import { expect, test, type Page } from '@playwright/test'

import { login, uniqueName } from './helpers'

// The Next dev overlay pill sits bottom-left, right over the footer's
// Save button at phone width. It never ships to production, so hide it
// rather than let it decide whether the save is clickable.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = 'nextjs-portal { display: none !important; }'
      document.head.appendChild(style)
    })
  })
})

const PHONES = [
  { name: 'Pixel 5', viewport: { width: 393, height: 851 } },
  { name: 'iPhone 12', viewport: { width: 390, height: 844 } },
]

/** Locates the builder's form pane: the parent of the hero title input. */
function editorPane(page: Page) {
  return page.getByPlaceholder(/Invoice for|Wedding invoice title/).first().locator('..')
}

/** Creates and saves a draft invoice, returning its unique title. */
async function createDraft(page: Page): Promise<string> {
  await page.goto('/payments')
  await page.getByRole('button', { name: 'Invoices' }).click()
  await page.getByRole('button', { name: /New invoice/i }).filter({ visible: true }).first().click()
  await page.getByRole('heading', { name: 'Notes' }).waitFor({ timeout: 30_000 })

  await page.getByText('Select couple', { exact: false }).first().click()
  const firstCouple = page.locator('[data-radix-popper-content-wrapper] button').first()
  await firstCouple.waitFor()
  await firstCouple.click()

  await page.getByRole('button', { name: /Add your first line item|Add line item/i }).first().click()
  await page.getByPlaceholder('Description').last().fill('Ceremony hosting')
  await page.getByPlaceholder('0.00').last().fill('1800')

  const title = uniqueName('Mobile Invoice')
  await page.getByPlaceholder(/Invoice for|Wedding invoice title/).first().fill(title)
  await page.getByRole('button', { name: /Save changes/i }).click()
  await expect(page.getByText('Invoice saved')).toBeVisible()
  return title
}

/** Reopens an invoice from the list by title (fresh navigation). */
async function reopen(page: Page, title: string) {
  await page.goto('/payments')
  await page.getByRole('button', { name: 'Invoices' }).click()
  await page.getByPlaceholder(/Search invoices/i).fill(title)
  // The list renders the desktop table and the mobile cards together;
  // only the one this viewport shows is clickable.
  const entry = page.getByText(title).filter({ visible: true }).first()
  await entry.waitFor()
  await entry.click()
  await page.getByRole('heading', { name: 'Notes' }).waitFor({ timeout: 30_000 })
}

async function deleteOpenInvoice(page: Page) {
  await page.getByRole('button', { name: /Delete invoice/i }).click()
  await page.getByRole('button', { name: /^Delete$/ }).click()
  await expect(page.getByText('Invoice deleted')).toBeVisible()
}

for (const phone of PHONES) {
  test.describe(`invoice builder on ${phone.name}`, () => {
    test.use({ viewport: phone.viewport })

    test('an existing invoice can be edited, saved and reloaded', async ({ page }) => {
      test.setTimeout(120_000)
      await login(page)
      const title = await createDraft(page)
      await reopen(page, title)

      // The bug: the form pane collapsed into a few-pixel scroll box.
      // Stacked, it must take its full natural height instead.
      const pane = editorPane(page)
      const { clientHeight, scrollHeight } = await pane.evaluate((el) => ({
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      }))
      expect(clientHeight).toBeGreaterThan(200)
      expect(clientHeight).toBeGreaterThanOrEqual(scrollHeight - 1)

      // Every editable section is reachable by scrolling the modal.
      await page.getByPlaceholder('0.00').last().fill('2400')
      const notes = page.getByPlaceholder(/Bank details, payment terms/)
      await notes.scrollIntoViewIfNeeded()
      await expect(notes).toBeInViewport()
      await notes.fill('Pay by bank transfer')
      await expect(page.getByRole('button', { name: /Add tax|Edit tax settings/i })).toBeVisible()

      await page.getByRole('button', { name: /Save changes/i }).click()
      await expect(page.getByText('Invoice saved')).toBeVisible()

      // A full navigation proves the edit came back from the database.
      await reopen(page, title)
      await expect(page.getByPlaceholder('0.00').last()).toHaveValue(/2400/)
      await expect(page.getByPlaceholder(/Bank details, payment terms/)).toHaveValue(
        'Pay by bank transfer',
      )

      await deleteOpenInvoice(page)
    })
  })
}

test.describe('invoice builder on desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('keeps the form and preview side by side', async ({ page }) => {
    test.setTimeout(120_000)
    await login(page)
    const title = await createDraft(page)

    const form = await editorPane(page).boundingBox()
    const preview = await page.getByRole('heading', { name: 'Preview' }).boundingBox()
    expect(form && preview).toBeTruthy()
    // Preview sits to the right of the form, not below it.
    expect(preview!.x).toBeGreaterThan(form!.x + form!.width - 1)

    await reopen(page, title)
    await deleteOpenInvoice(page)
  })
})
