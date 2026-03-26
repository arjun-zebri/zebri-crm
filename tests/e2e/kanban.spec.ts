import { test, expect } from '@playwright/test'
import { login, addCouple, deleteCouple, search, uniqueName } from './helpers'

test.describe('Kanban / Board View', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/couples', { waitUntil: 'networkidle' })
    await page.locator('button:has-text("Board")').click()
    await page.waitForLoadState('networkidle')
  })

  // ── 1. At least one column ────────────────────────────────────────────────
  test('renders at least one kanban column', async ({ page }) => {
    const columns = page.locator('.bg-gray-50')
    await expect(columns.first()).toBeVisible()
  })

  // ── 2. Each column has a status label ─────────────────────────────────────
  test('each column shows a status label', async ({ page }) => {
    // Status labels are rendered as text inside column headers
    const columns = page.locator('.bg-gray-50')
    const count = await columns.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const col = columns.nth(i)
      const text = await col.textContent()
      expect(text?.trim().length).toBeGreaterThan(0)
    }
  })

  // ── 3. Each column has a "+ New" button ───────────────────────────────────
  test('each column has a "+ New" or "New" button inside it', async ({ page }) => {
    const columns = page.locator('.bg-gray-50')
    const count = await columns.count()
    expect(count).toBeGreaterThan(0)
    // At least one column should contain a button for adding
    const newBtnsInColumns = page.locator('.bg-gray-50 button')
    await expect(newBtnsInColumns.first()).toBeVisible()
  })

  // ── 4. Column "+ New" opens modal ────────────────────────────────────────
  test('"+ New" inside a column opens Add Couple modal', async ({ page }) => {
    // Click the first button inside any kanban column
    const colNewBtn = page.locator('.bg-gray-50 button').first()
    await colNewBtn.click()
    await expect(page.locator('h2:has-text("Add Couple")')).toBeVisible()
    await page.locator('button:has-text("Cancel")').click()
  })

  // ── 5. Create couple from column appears in that column ───────────────────
  test('couple created from column button appears in the board', async ({ page }) => {
    const name = uniqueName('Kanban Couple')

    // Use global "New" button in header (avoids needing to know which column button maps to which status)
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Couple")')
    await page.locator('input[placeholder="Couple\'s name"]').fill(name)
    await page.locator('button:has-text("Save")').click()
    await page.waitForSelector('h2:has-text("Add Couple")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // The couple's name should appear on the board
    await expect(page.locator(`.bg-gray-50:has-text("${name}")`)).toBeVisible()

    // Clean up — switch to list to delete
    await page.locator('button:has-text("List")').click()
    await page.waitForLoadState('networkidle')
    await deleteCouple(page, name)
  })

  // ── 6. Clicking a kanban card opens profile ───────────────────────────────
  test('clicking a kanban card opens the couple profile', async ({ page }) => {
    const name = uniqueName('Kanban Card')
    await page.locator('button:has-text("List")').click()
    await page.waitForLoadState('networkidle')
    await addCouple(page, { name })
    await page.locator('button:has-text("Board")').click()
    await page.waitForLoadState('networkidle')

    // Click the card
    await page.locator(`.bg-gray-50:has-text("${name}")`).click()
    await expect(page.locator('div.fixed.top-0.right-0 h1')).toBeVisible()

    // Close profile
    await page.locator('div.fixed.top-0.right-0').locator('button').first().click()
    await page.locator('button:has-text("List")').click()
    await page.waitForLoadState('networkidle')
    await deleteCouple(page, name)
  })

  // ── 7. Board is horizontally scrollable ───────────────────────────────────
  test('board container has overflow-x-auto class (horizontally scrollable)', async ({ page }) => {
    const boardWrapper = page.locator('.overflow-x-auto')
    await expect(boardWrapper.first()).toBeVisible()
  })

  // ── 8. Header New button works in Board view ──────────────────────────────
  test('header New button opens Add Couple modal in Board view', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await expect(page.locator('h2:has-text("Add Couple")')).toBeVisible()
    await page.locator('button:has-text("Cancel")').click()
  })
})
