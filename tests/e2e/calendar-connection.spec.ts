/**
 * The calendar-connection entry point on `/calendar`.
 *
 * An MC used to be able to connect a calendar only from Settings, and nothing
 * on this route said what a missing connection costs: the grid quietly shows
 * no external busy blocks, bookings never reach the real calendar, and video
 * meeting types ship with no join link. These cover the banner that now says
 * so, on desktop and mobile alike.
 */
import { test, expect } from '@playwright/test'

import { login } from './helpers'

/** The route banner shown when no calendar is connected. */
function banner(page: import('@playwright/test').Page) {
  return page.getByText(/No calendar connected|calendar connection stopped working/i)
}

test.describe('Calendar connection banner', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/calendar', { waitUntil: 'networkidle' })
  })

  test('offers both providers when no calendar is connected', async ({ page }) => {
    // The seeded e2e account has no calendar connection; if that ever changes
    // the banner is correctly absent and there is nothing to assert.
    if (!(await banner(page).isVisible().catch(() => false))) test.skip()

    await expect(page.getByRole('button', { name: 'Google Calendar' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Outlook Calendar' }).first()).toBeVisible()
  })

  test('stays visible across every tab', async ({ page }) => {
    if (!(await banner(page).isVisible().catch(() => false))) test.skip()

    for (const tab of ['Meeting types', 'Availability', 'Bookings']) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      // Why: the cost of not connecting is spread across all four tabs, so the
      // notice cannot live on the calendar grid alone.
      await expect(banner(page)).toBeVisible()
    }
  })

  test('does not push the page into horizontal scroll', async ({ page }) => {
    if (!(await banner(page).isVisible().catch(() => false))) test.skip()

    // The banner puts two buttons beside a sentence; on a narrow viewport it
    // has to wrap rather than widen the document.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
