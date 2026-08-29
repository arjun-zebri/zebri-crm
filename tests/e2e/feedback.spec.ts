import { expect, test } from '@playwright/test'

import { login } from './helpers'

/**
 * The Feedback pill.
 *
 * Scope note: these tests exercise reach and layout, not submission. Actually
 * sending a report writes a `bug_reports` row and calls Notion, and the dev
 * server points at the remote Supabase where the migration only lands after a
 * CI deploy. The submit path is covered by the unit tests over
 * `lib/notion/*`, the RLS integration tests, and a manual end-to-end check.
 */
test.describe('Feedback pill', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  const pill = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: 'Feedback' })

  /**
   * Click the pill and wait for the form.
   *
   * The pill is server-rendered, so it is clickable a beat before React has
   * hydrated the handler onto it. On a cold Turbopack dev route that gap is
   * wide enough to swallow the first click, so retry until the dialog shows.
   */
  async function openFeedback(page: import('@playwright/test').Page) {
    await expect(async () => {
      await pill(page).click()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
    return page.getByRole('dialog')
  }

  test('is reachable on every dashboard page', async ({ page }) => {
    for (const route of ['/', '/couples', '/payments', '/branding', '/settings']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(pill(page)).toBeVisible()
    }
  })

  test('opens the form and captures nothing the MC has to type', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })
    const dialog = await openFeedback(page)

    await expect(dialog.getByText('Send feedback')).toBeVisible()
    await expect(dialog.getByLabel('Summary')).toBeVisible()
    await expect(dialog.getByLabel('What happened?')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Take screenshot' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Attach an image' })).toBeVisible()
    // No field asks for the page, the browser or the account.
    await expect(dialog.getByLabel(/browser|url|page/i)).toHaveCount(0)
  })

  test('the kind-of-feedback dropdown opens in front of the modal', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })
    const dialog = await openFeedback(page)

    await dialog.getByRole('combobox').click()
    // The Select renders its panel in a portal at the popover tier (z-[90]).
    // A modal on the `top` layer (z-[130]) would hide it, which read as a
    // dead control.
    await expect(page.getByRole('option', { name: 'An idea for something new' })).toBeVisible()
  })

  test('will not send until there is something worth reading', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })
    const dialog = await openFeedback(page)

    const send = dialog.getByRole('button', { name: 'Send' })
    await expect(send).toBeDisabled()

    await dialog.getByLabel('Summary').fill('Contract emails are not sending')
    await expect(send).toBeDisabled()

    await dialog.getByLabel('What happened?').fill('Pressed send and nothing arrived.')
    await expect(send).toBeEnabled()
  })

  test('captures the page behind the form', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })
    const dialog = await openFeedback(page)

    await dialog.getByRole('button', { name: 'Take screenshot' }).click()

    // The filename names the route it was taken on, so a wrong-page capture
    // shows up here rather than only in the finished ticket.
    await expect(dialog.getByText(/^zebri-couples-/)).toBeVisible({ timeout: 20_000 })
    const thumb = dialog.getByRole('img', { name: 'Screenshot preview' })
    await expect(thumb).toBeVisible()
    // A blank capture still decodes, so assert it has real pixels.
    expect(await thumb.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(100)

    await dialog.getByRole('button', { name: 'Remove screenshot' }).click()
    await expect(thumb).toHaveCount(0)
  })

  test('leaves an open dropdown alone', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })

    // The status filter is a plain dropdown that closes on any outside press,
    // which is the behaviour the pill has to be exempt from. Reaching for the
    // report button must not change the thing being reported.
    // `menuitem`, not `button`: MenuItem sets an explicit role, which
    // overrides the element's implicit one.
    const allOption = page.getByRole('menuitem', { name: /^All \(\d+\)$/ })
    // Retried for the same reason openFeedback is: on a cold dev route the
    // first click can land before React has hydrated the handler.
    await expect(async () => {
      await page.getByRole('button', { name: 'Filter' }).click()
      await expect(allOption).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })

    await openFeedback(page)
    await expect(allOption).toBeVisible()

    // And clicking inside the form does not close it either, so a capture
    // taken from here still shows the dropdown.
    await page.getByRole('dialog').getByLabel('Summary').click()
    await expect(allOption).toBeVisible()
  })

  test('hides itself while its own form is open', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })
    const dialog = await openFeedback(page)
    await expect(pill(page)).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(pill(page)).toBeVisible()
  })

  test('does not cover the payments footer total', async ({ page }) => {
    await page.goto('/payments', { waitUntil: 'domcontentloaded' })
    const pillBox = await pill(page).boundingBox()
    // The footer's right-hand item is the total; on an empty account only the
    // count renders, which sits on the left and cannot collide.
    const total = page.locator('p.tabular-nums').last()
    if (await total.isVisible().catch(() => false)) {
      const totalBox = await total.boundingBox()
      expect(totalBox!.x + totalBox!.width).toBeLessThan(pillBox!.x)
    }
  })

  test('does not cover the branding zoom controls', async ({ page }) => {
    await page.goto('/branding', { waitUntil: 'domcontentloaded' })
    const zoomOut = page.getByRole('button', { name: 'Zoom out' })
    await expect(zoomOut).toBeVisible()

    const resetBox = await page.getByRole('button', { name: 'Fit to width' }).boundingBox()
    const pillBox = await pill(page).boundingBox()
    expect(resetBox!.x + resetBox!.width).toBeLessThan(pillBox!.x)
    // Both float in the same corner, so they have to be the same height.
    expect(Math.abs(resetBox!.height - pillBox!.height)).toBeLessThanOrEqual(8)
  })
})
