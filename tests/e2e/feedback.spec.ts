import { expect, test } from '@playwright/test'

import { login } from './helpers'

/**
 * The corner dock, and the feedback form behind it.
 *
 * The round button used to be a "Feedback" pill. It is now a menu
 * (`components/assistant/assistant-dock.tsx`) holding "Send feedback"
 * and "Zebri AI", so every path to the form goes through one extra
 * press. The form itself is unchanged.
 *
 * Scope note: these tests exercise reach and layout, not submission. Actually
 * sending a report writes a `bug_reports` row and calls Notion, and the dev
 * server points at the remote Supabase where the migration only lands after a
 * CI deploy. The submit path is covered by the unit tests over
 * `lib/notion/*`, the RLS integration tests, and a manual end-to-end check.
 */
test.describe('Assistant dock — feedback', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  /** The round button. Its label flips to "Close Zebri menu" when open. */
  const dock = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: /Zebri menu$/ })

  /**
   * Open the menu, then the form.
   *
   * The dock is server-rendered, so it is clickable a beat before React has
   * hydrated the handler onto it. On a cold Turbopack dev route that gap is
   * wide enough to swallow the first click, so retry until the dialog shows.
   *
   * The two menu buttons stay mounted and only fade, so the menu has to be
   * opened before "Send feedback" will take a click: while closed it carries
   * `pointer-events-none`.
   */
  async function openFeedback(page: import('@playwright/test').Page) {
    await expect(async () => {
      if ((await dock(page).getAttribute('aria-expanded')) !== 'true') {
        await dock(page).click()
      }
      await page.getByRole('button', { name: 'Send feedback' }).click({ timeout: 2_000 })
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
    return page.getByRole('dialog')
  }

  test('is reachable on every dashboard page', async ({ page }) => {
    for (const route of ['/', '/couples', '/payments', '/branding', '/settings']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(dock(page)).toBeVisible()
    }
  })

  test('the menu reveals both actions, and Zebri AI is off where no page offers a chat', async ({
    page,
  }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })

    await expect(async () => {
      await dock(page).click()
      await expect(dock(page)).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 })
    }).toPass({ timeout: 30_000 })

    await expect(page.getByRole('button', { name: 'Send feedback' })).toBeEnabled()
    // Visibly unavailable rather than absent: /couples offers no copilot.
    await expect(page.getByRole('button', { name: 'Zebri AI' })).toBeDisabled()
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

  test('needs a summary and any description at all', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })
    const dialog = await openFeedback(page)

    const send = dialog.getByRole('button', { name: 'Send' })
    await expect(send).toBeDisabled()

    await dialog.getByLabel('Summary').fill('Contract emails are not sending')
    await expect(send).toBeDisabled()

    // One character is enough. A longer minimum only ever blocked someone
    // whose whole report was "it crashed", which is still worth having.
    await dialog.getByLabel('What happened?').fill('x')
    await expect(send).toBeEnabled()

    await dialog.getByLabel('What happened?').fill('   ')
    await expect(send).toBeDisabled()
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
    // which is the behaviour the dock has to be exempt from. Reaching for the
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

  test('hides itself while its own form is open, and comes back', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' })
    const dialog = await openFeedback(page)

    // The dock sits at `z-[150]`, above the overlay ladder, so it stays
    // usable over somebody else's modal. Its own is the exception: floating
    // the launcher over the form it just opened reads as a stuck control.
    await expect(dock(page)).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(dock(page)).toBeVisible()
  })

  test('does not cover the payments footer total', async ({ page }) => {
    await page.goto('/payments', { waitUntil: 'domcontentloaded' })
    const dockBox = await dock(page).boundingBox()
    // The footer's right-hand item is the total; on an empty account only the
    // count renders, which sits on the left and cannot collide.
    const total = page.locator('p.tabular-nums').last()
    if (await total.isVisible().catch(() => false)) {
      const totalBox = await total.boundingBox()
      expect(totalBox!.x + totalBox!.width).toBeLessThan(dockBox!.x)
    }
  })

  test('does not cover the branding zoom controls', async ({ page }) => {
    await page.goto('/branding', { waitUntil: 'domcontentloaded' })
    const zoomOut = page.getByRole('button', { name: 'Zoom out' })
    await expect(zoomOut).toBeVisible()

    const resetBox = await page.getByRole('button', { name: 'Fit to width' }).boundingBox()
    const dockBox = await dock(page).boundingBox()
    expect(resetBox!.x + resetBox!.width).toBeLessThan(dockBox!.x)
  })
})
