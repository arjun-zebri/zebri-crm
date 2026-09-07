import { test, expect } from '@playwright/test'

import { login } from './helpers'

/**
 * The surfaces the usability audit added, as an MC meets them.
 *
 * These are deliberately read-and-navigate tests rather than
 * end-to-end sends: the review gate and the timing controls all have
 * their own integration coverage against real RLS,
 * and what only a browser can prove is that the screens render, the
 * controls are reachable, and the phone gets a usable builder.
 */
test.describe('Workflows — Upcoming', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('opens on Upcoming with one group-by dropdown and an add button', async ({ page }) => {
    await page.goto('/workflows', { waitUntil: 'networkidle' })
    await expect(page.getByRole('tab', { name: 'Upcoming' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // The tab name is not repeated as a heading inside the table.
    await expect(page.getByRole('heading', { name: 'Upcoming' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Group by date/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add a to-do' })).toBeVisible()
  })

  test('the toolbar regroups the list rather than filtering it', async ({ page }) => {
    await page.goto('/workflows', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Group by date/ }).click()
    const menu = page.getByRole('menu')
    // Rendered over the list, not clipped by it: nothing above the body
    // carries `overflow-hidden`, precisely so this stays reachable.
    await expect(menu.getByRole('menuitem')).toHaveCount(3)
    await expect(menu.getByRole('menuitem', { name: 'Date' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Couple' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Who does it' })).toBeVisible()

    // Picking a row closes the menu and the button reads it back.
    await menu.getByRole('menuitem', { name: 'Who does it' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Group by who does it/ })).toBeVisible()
  })

  test('the Done strip expands in place and puts work back', async ({ page }) => {
    await page.goto('/workflows', { waitUntil: 'networkidle' })

    // Nothing finished in the last 90 days means no strip at all: a
    // permanent "Done (0)" is a promise the page has not earned.
    const strip = page.getByRole('button', { name: /^Done \(\d+\)$/ })
    const hasDone = await strip.count()
    test.skip(hasDone === 0, 'nothing completed in this account to list')

    await expect(strip).toHaveAttribute('aria-expanded', 'false')
    await strip.click()
    await expect(strip).toHaveAttribute('aria-expanded', 'true')

    // Every row offers the way back, and its title is struck through.
    const restore = page.getByRole('checkbox', { name: /^Put ".*" back on the list$/ }).first()
    await expect(restore).toBeVisible()

    await strip.click()
    await expect(strip).toHaveAttribute('aria-expanded', 'false')
    await expect(restore).toHaveCount(0)
  })

  test('the add-a-to-do composer opens from the toolbar', async ({ page }) => {
    await page.goto('/workflows', { waitUntil: 'networkidle' })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Add a to-do' }).click()
    const dialog = page.getByRole('dialog')
    // A modal like every other create, with room for the note the
    // inline row it replaced had nowhere to put.
    await expect(dialog.getByRole('textbox', { name: 'What needs doing' })).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Notes' })).toBeVisible()
  })

  test('renders no console errors on the list', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.goto('/workflows', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const real = errors.filter((e) => !/favicon|DevTools|Failed to fetch/i.test(e))
    expect(real, real.join('\n')).toHaveLength(0)
  })

  test('offers one New workflow button with two ways behind it', async ({ page }) => {
    await page.goto('/workflows?tab=templates', { waitUntil: 'networkidle' })
    // One heading for the page, none repeated inside the grid.
    await expect(page.getByRole('heading', { name: 'Workflows' })).toHaveCount(1)
    await page.getByRole('button', { name: /New workflow/ }).click()
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem')).toHaveCount(2)
    await expect(menu.getByRole('menuitem', { name: 'Build it myself' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Generate with Zebri AI' })).toBeVisible()
  })

  test('the AI builder is one field and two buttons, nothing else', async ({ page }) => {
    await page.goto('/workflows?tab=templates', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /New workflow/ }).click()
    await page.getByRole('menuitem', { name: 'Generate with Zebri AI' }).click()
    const dialog = page.getByRole('dialog')

    // Nothing to read before typing: the field is the first thing, and
    // it is focused.
    const field = dialog.getByRole('textbox', { name: 'Describe your process' })
    await expect(field).toBeFocused()

    // No example chips, no name field: Cancel and Build it are the only
    // buttons in the body.
    await expect(dialog.getByRole('textbox')).toHaveCount(1)

    // Empty is the only state that cannot be built from, and one word
    // is enough to leave it. There is no minimum length.
    const build = dialog.getByRole('button', { name: 'Build it' })
    await expect(build).toBeDisabled()
    await field.fill('Chase')
    await expect(build).toBeEnabled()
  })

  test('tags are a dropdown that also manages them', async ({ page }) => {
    await page.goto('/workflows?tab=templates', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /All tags/ }).click()
    await expect(page.getByRole('menu').getByRole('menuitem', { name: 'Manage tags' })).toBeVisible()
  })
})

test.describe('Workflows — the builder on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('a narrow viewport gets the list, not the canvas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/workflows?tab=templates', { waitUntil: 'networkidle' })
    // Deliberately NOT opening the mobile sidebar: it is a drawer over the
    // page, and with it open every click at the template list lands on the
    // overlay instead.
    // Template rows are `role="link"` wrappers, not buttons, and the scope
    // is `main` so the off-canvas sidebar's own links never match.
    const templates = page.locator('main [role="link"]')
    const hasTemplate = await templates.count()
    test.skip(hasTemplate === 0, 'no workflow in this account to open')

    await templates.first().click()
    await page.waitForURL(/\/workflows\/[0-9a-f-]{36}/)
    await page.waitForTimeout(2000)
    // React Flow is not rendered at all below `md`: a pan-and-zoom
    // canvas on a 390px screen fights the page rather than helping.
    await expect(page.locator('.react-flow')).toHaveCount(0)
  })
})
