import { test, expect, type Page } from '@playwright/test'

import { login, uniqueName } from './helpers'

/**
 * Workflows page: the template library and the canvas builder that
 * replaced the Automations list. Covers creating a workflow, naming it,
 * setting when it applies, adding a step, and the library row reflecting
 * all of that after a reload.
 */

/** Open the Templates tab of /workflows. */
async function openTemplates(page: Page) {
  // `networkidle` never settles reliably against the dev server's HMR
  // socket; the heading assertion below is the real readiness signal.
  //
  // A save on the canvas revalidates its own route, and the refresh that
  // follows reads as a competing navigation, which aborts a `goto` issued
  // in the same moment. One retry is enough: the refresh is not repeated.
  try {
    await page.goto('/workflows?tab=templates', { waitUntil: 'domcontentloaded' })
  } catch {
    await page.goto('/workflows?tab=templates', { waitUntil: 'domcontentloaded' })
  }
  await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()
}

/** Create a workflow from the library and land on its canvas. */
async function createWorkflow(page: Page, name: string) {
  await openTemplates(page)
  const create = page.getByRole('button', { name: /New workflow|Build your first workflow/ }).first()
  await create.click()
  await page.waitForURL(/\/workflows\/[0-9a-f-]{36}/, { timeout: 20000 })

  const nameInput = page.getByPlaceholder('Untitled workflow')
  await expect(nameInput).toBeVisible({ timeout: 10000 })
  await nameInput.fill(name)
  // The rename fires on blur and saves in the background, so wait for the
  // round trip rather than for the network to go quiet: on a slow device
  // the next navigation would otherwise race the save.
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/workflows/'),
      { timeout: 20000 },
    ),
    nameInput.blur(),
  ])
  await page.waitForLoadState('networkidle')
}

/** Delete a workflow from the library, tolerating one already gone. */
async function deleteWorkflow(page: Page, name: string) {
  await openTemplates(page)
  const row = page.locator(`[role="link"]:has-text("${name}")`).first()
  if ((await row.count()) === 0) return

  // RowActionsMenu renders its items as buttons inside a popover the
  // accessibility tree reports as a dialog, not a menu.
  await row.getByRole('button', { name: 'Row actions' }).click()
  const menu = page.getByRole('dialog')
  await menu.getByRole('button', { name: 'Delete' }).click()

  // Then the confirm dialog's own Delete.
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Delete this workflow?' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page.getByText(name)).toHaveCount(0, { timeout: 10000 })
}

test.describe('Workflows builder', () => {
  let workflowName: string

  test.beforeEach(async ({ page }) => {
    await login(page)
    workflowName = uniqueName('Builder Test')
  })

  test.afterEach(async ({ page }) => {
    try {
      await deleteWorkflow(page, workflowName)
    } catch {
      // Already deleted in the test
    }
  })

  test('creates a workflow and shows it in the library after a reload', async ({ page }) => {
    await createWorkflow(page, workflowName)

    await openTemplates(page)
    await expect(page.getByText(workflowName)).toBeVisible({ timeout: 10000 })
    // A brand new workflow is a draft: nothing applies until the MC says so.
    const row = page.locator(`[role="link"]:has-text("${workflowName}")`).first()
    await expect(row.getByText('Off')).toBeVisible()
    // The applied count is `hidden sm:inline`: on a phone the row keeps
    // only the name and the status pill.
    const wide = (page.viewportSize()?.width ?? 0) >= 640
    await expect(row.getByText('Not running')).toBeVisible({ visible: wide })
  })

  test('sets when the workflow applies, then adds a to-do step to it', async ({ page }) => {
    await createWorkflow(page, workflowName)

    // A new workflow has no automatic rule (the schema's `manual`
    // default), so the first card is the prompt to choose one.
    await page.getByText('When does this start?').click()
    const rules = page.getByRole('dialog', { name: 'When does this apply?' })
    await expect(rules).toBeVisible({ timeout: 10000 })
    await rules.getByPlaceholder('Find a rule…').fill('New enquiry')
    // Each canvas edit saves in the background. Wait for this one before
    // making the next, so the wait below cannot latch onto this save and
    // let the reload abort the step's.
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/workflows/'),
        { timeout: 20000 },
      ),
      rules.getByRole('button', { name: /New enquiry/ }).first().click(),
    ])
    await expect(page.getByText('When does this start?')).toHaveCount(0, { timeout: 10000 })

    // With a rule set, the tail ghost appears and opens the step palette.
    // A to-do is the load-bearing pick: it is the manual step that gates
    // everything anchored behind it.
    await page.getByText('Add step').click()
    const steps = page.getByRole('dialog', { name: 'Add step' })
    await expect(steps).toBeVisible({ timeout: 10000 })
    await steps.getByPlaceholder('Find a step…').fill('To-do')
    // The node is painted optimistically and persisted in the background,
    // so wait for the save itself. Reloading while it is still in flight
    // aborts it, and the step is gone through no fault of the app.
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/workflows/'),
        { timeout: 20000 },
      ),
      steps.getByRole('button', { name: /To-do/ }).first().click(),
    ])

    // The step survives a reload, which is what proves it was persisted
    // rather than only added to the canvas in memory.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByPlaceholder('Untitled workflow')).toHaveValue(workflowName, {
      timeout: 15000,
    })
    await expect(page.getByText('New enquiry').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('To-do').first()).toBeVisible({ timeout: 15000 })
  })

  test('activating a workflow makes it offerable on a couple', async ({ page }) => {
    await createWorkflow(page, workflowName)
    await page.getByRole('button', { name: 'Turn on' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Turn off' })).toBeVisible({
      timeout: 10000,
    })

    await openTemplates(page)
    const row = page.locator(`[role="link"]:has-text("${workflowName}")`).first()
    await expect(row.getByText('On')).toBeVisible({ timeout: 10000 })
  })

  test('the retired Automations route lands on the template library', async ({ page }) => {
    await page.goto('/automations', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/workflows\?tab=templates/)
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()
  })
})
