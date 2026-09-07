import { test, expect, type Page } from '@playwright/test'

import { addCouple, deleteCouple, login, navigateToProfileTab, openCoupleProfile, uniqueName } from './helpers'

/**
 * Couple profile, Workflow tab: the folded tab that replaced Tasks and
 * Automations. Every couple gets a default workflow on creation, ad-hoc
 * to-dos are steps on it, and ticking one survives a reload.
 */
const COUPLE_PREFIX = 'Workflow Test'

async function openWorkflowTab(page: Page) {
  await navigateToProfileTab(page, 'Workflow')
  await expect(page.getByRole('heading', { name: 'Workflow' })).toBeVisible()
}

/**
 * The id of the couple whose profile is open.
 *
 * Read off the panel rather than threaded down from `addCouple`, which
 * returns nothing: the profile is the only place the id is on the page.
 */
async function currentCoupleId(page: Page): Promise<string> {
  const id = await page
    .locator('[data-testid="couple-profile-panel"]')
    .getAttribute('data-couple-id')
  expect(id).toBeTruthy()
  return id as string
}

/** Add a to-do through the composer, from the tab's own button. */
async function addTodo(page: Page, title: string) {
  const panel = page.locator('[data-testid="couple-profile-panel"]')
  await panel.getByRole('button', { name: 'Add a to-do' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'What needs doing' }).fill(title)
  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10000 })
}

test.describe('Couple Workflow tab', () => {
  let coupleName: string

  test.beforeEach(async ({ page }) => {
    await login(page)
    coupleName = uniqueName(COUPLE_PREFIX)
    await page.goto('/couples', { waitUntil: 'networkidle' })
    await addCouple(page, { name: coupleName, email: 'workflow@test.com' })
    await openCoupleProfile(page, coupleName)
  })

  test.afterEach(async ({ page }) => {
    try {
      await page.goto('/couples', { waitUntil: 'networkidle' })
      await deleteCouple(page, coupleName)
    } catch {
      // Already deleted in the test
    }
  })

  test('a new couple offers somewhere to put work, and no invented heading', async ({
    page,
  }) => {
    await openWorkflowTab(page)
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    // The default instance exists (the insert trigger creates it in the
    // same transaction as the couple) but it is never a heading: its
    // stored name is "General", a workflow the MC never made.
    await expect(panel.getByText('General')).toHaveCount(0)
    await expect(panel.getByRole('button', { name: 'Add a to-do' })).toBeVisible()
  })

  test('adds an ad-hoc to-do, ticks it, and both survive a reload', async ({ page }) => {
    await openWorkflowTab(page)
    const panel = page.locator('[data-testid="couple-profile-panel"]')

    await addTodo(page, 'Call the venue about parking')
    await expect(panel.getByText('Call the venue about parking')).toBeVisible({ timeout: 10000 })

    await panel
      .getByRole('checkbox', { name: 'Mark "Call the venue about parking" done' })
      .click()

    // Ticking moves the step out of the open list and into the collapsed
    // Done strip: the tab is a list of what still needs a person, so
    // finished work stops taking up room the moment it is finished.
    const done = panel.getByRole('button', { name: /^Done \(\d+\)$/ })
    await expect(done).toBeVisible({ timeout: 10000 })
    await done.click()
    await expect(
      panel.getByRole('checkbox', {
        name: 'Mark "Call the venue about parking" not done',
      }),
    ).toBeChecked({ timeout: 10000 })

    // Re-entered through the deep link rather than by clicking the board
    // again: once a couple has workflow progress their kanban card grows a
    // line to show it, and a click aimed before that lands can miss. The
    // `?openCouple=` path is the one the Workflows queue itself uses.
    const coupleId = await currentCoupleId(page)
    await page.goto(`/couples?view=board&openCouple=${coupleId}`, {
      waitUntil: 'networkidle',
    })
    await page.waitForSelector('[data-testid="couple-profile-panel"]')
    await openWorkflowTab(page)
    const reloaded = page.locator('[data-testid="couple-profile-panel"]')
    await reloaded.getByRole('button', { name: /^Done \(\d+\)$/ }).click()
    await expect(
      reloaded.getByRole('checkbox', {
        name: 'Mark "Call the venue about parking" not done',
      }),
    ).toBeChecked({ timeout: 10000 })
  })

  test('a to-do added here shows up in the Workflows queue', async ({ page }) => {
    await openWorkflowTab(page)
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    const todo = uniqueName('Confirm the run sheet')

    await addTodo(page, todo)
    await expect(panel.getByText(todo)).toBeVisible({ timeout: 10000 })

    // The queue is the cross-couple view of the same steps, so anything
    // added on a couple has to be reachable from there.
    await page.goto('/workflows?tab=queue', { waitUntil: 'networkidle' })
    await expect(page.getByText(todo)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(coupleName).first()).toBeVisible()
  })

  test('offers to apply a saved workflow', async ({ page }) => {
    await openWorkflowTab(page)
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await panel.getByRole('button', { name: 'Start a workflow' }).click()
    await expect(page.getByRole('heading', { name: 'Start a workflow' })).toBeVisible()
  })
})
