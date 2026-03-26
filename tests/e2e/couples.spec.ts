import { test, expect } from '@playwright/test'
import { login, addCouple, deleteCouple, openCoupleProfile, search, uniqueName } from './helpers'

test.describe('Couple Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/couples', { waitUntil: 'networkidle' })
  })

  // ── 1. Page header ────────────────────────────────────────────────────────
  test('renders h1 "Couples" with total count and New button', async ({ page }) => {
    await expect(page.locator('h1:has-text("Couples")')).toBeVisible()
    await expect(page.locator('span:has-text("total")')).toBeVisible()
    await expect(page.locator('button:has-text("New")')).toBeVisible()
  })

  // ── 2. View tabs ──────────────────────────────────────────────────────────
  test('view tabs: List, Board, Calendar', async ({ page }) => {
    await expect(page.locator('button:has-text("List")')).toBeVisible()
    await expect(page.locator('button:has-text("Board")')).toBeVisible()
    await expect(page.locator('button:has-text("Calendar")')).toBeVisible()
  })

  // ── 3. List view table columns ────────────────────────────────────────────
  test('list view shows table with Name/Email/Status columns', async ({ page }) => {
    // Ensure list view is active
    await page.locator('button:has-text("List")').click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table th:has-text("Name")')).toBeVisible()
    await expect(page.locator('table th:has-text("Email")')).toBeVisible()
    await expect(page.locator('table th:has-text("Status")')).toBeVisible()
  })

  // ── 4. Board view ─────────────────────────────────────────────────────────
  test('Board view renders kanban columns', async ({ page }) => {
    await page.locator('button:has-text("Board")').click()
    await page.waitForLoadState('networkidle')
    // Each kanban column has a bg-gray-50 container
    const columns = page.locator('.bg-gray-50')
    await expect(columns.first()).toBeVisible()
  })

  // ── 5. Calendar view ──────────────────────────────────────────────────────
  test('Calendar view renders with nav and view toggles', async ({ page }) => {
    await page.locator('button:has-text("Calendar")').click()
    await page.waitForLoadState('networkidle')
    // Navigation chevrons
    await expect(page.locator('button svg').first()).toBeVisible()
    // Day/Week/Month buttons
    await expect(page.locator('button:has-text("Week")')).toBeVisible()
    await expect(page.locator('button:has-text("Month")')).toBeVisible()
    await expect(page.locator('button:has-text("Day")')).toBeVisible()
  })

  // ── 6. Switch back to List from Calendar ─────────────────────────────────
  test('switching back to List from Calendar restores table', async ({ page }) => {
    await page.locator('button:has-text("Calendar")').click()
    await page.waitForLoadState('networkidle')
    await page.locator('button:has-text("List")').click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible()
  })

  // ── 7. CRUD: create → verify → edit → delete ─────────────────────────────
  test('CRUD: create couple, edit notes, then delete', async ({ page }) => {
    const name = uniqueName('E2E Couple')
    const updatedNotes = 'Updated notes ' + Date.now()

    // Create
    await addCouple(page, { name, email: 'e2e@test.com', notes: 'Initial notes' })

    // Verify row appears
    await search(page, name)
    await expect(page.locator(`table tbody tr:has-text("${name}")`)).toBeVisible()

    // Open profile → Edit → change notes → Save
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="couple-profile-panel"] h1')
    await page.locator('[data-testid="couple-profile-panel"]').locator('button:has-text("Edit")').click()
    await page.waitForSelector('h2:has-text("Edit Couple")')
    await page.locator('textarea').fill(updatedNotes)
    await page.locator('button:has-text("Save")').click()
    await page.waitForSelector('h2:has-text("Edit Couple")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // Verify updated notes appear in Overview tab
    await expect(page.locator(`text=${updatedNotes}`)).toBeVisible()

    // Delete
    await page.locator('[data-testid="couple-profile-panel"]').locator('button:has-text("Edit")').click()
    await page.waitForSelector('h2:has-text("Edit Couple")')
    await page.locator('button:has-text("Delete")').click()
    await page.locator('button:has-text("Click again to confirm")').click()
    await page.waitForSelector('h2:has-text("Edit Couple")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // Row should be gone
    await search(page, name)
    await expect(page.locator(`table tbody tr:has-text("${name}")`)).toHaveCount(0)
  })

  // ── 8. Save disabled until Name is filled ─────────────────────────────────
  test('Save button disabled until Name is filled', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Couple")')
    const saveBtn = page.locator('button:has-text("Save")')
    await expect(saveBtn).toBeDisabled()
    await page.locator('input[placeholder="Couple\'s name"]').fill('Someone')
    await expect(saveBtn).toBeEnabled()
    // Close modal
    await page.locator('button:has-text("Cancel")').click()
  })

  // ── 9. Cancel closes modal without saving ────────────────────────────────
  test('Cancel closes modal without saving', async ({ page }) => {
    const name = uniqueName('Cancel Test')
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Couple")')
    await page.locator('input[placeholder="Couple\'s name"]').fill(name)
    await page.locator('button:has-text("Cancel")').click()
    await expect(page.locator('h2:has-text("Add Couple")')).not.toBeVisible()
    // No row with that name
    await search(page, name)
    await expect(page.locator(`table tbody tr:has-text("${name}")`)).toHaveCount(0)
  })

  // ── 10. Escape closes modal ───────────────────────────────────────────────
  test('Escape key closes the Add Couple modal', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Couple")')
    await page.keyboard.press('Escape')
    await expect(page.locator('h2:has-text("Add Couple")')).not.toBeVisible()
  })

  // ── 11. "n" shortcut opens New modal ──────────────────────────────────────
  test('"n" shortcut opens Add Couple modal', async ({ page }) => {
    // Make sure no input is focused
    await page.locator('body').click()
    await page.keyboard.press('n')
    await expect(page.locator('h2:has-text("Add Couple")')).toBeVisible()
    await page.locator('button:has-text("Cancel")').click()
  })

  // ── 12. "/" shortcut focuses search ──────────────────────────────────────
  test('"/" shortcut focuses search input', async ({ page }) => {
    await page.locator('body').click()
    await page.keyboard.press('/')
    const searchInput = page.locator('input[placeholder="Search..."]').first()
    await expect(searchInput).toBeFocused()
    await page.keyboard.press('Escape')
  })

  // ── 13. Search filters table rows ────────────────────────────────────────
  test('search filters table rows to matching names only', async ({ page }) => {
    const name = uniqueName('Searchable Couple')
    await addCouple(page, { name })

    await search(page, name)
    // Should find exactly the one row we created
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(1)

    // Clean up
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="couple-profile-panel"] h1')
    await deleteCouple(page, name)
  })

  // ── 14. Status filter ─────────────────────────────────────────────────────
  test('status filter opens a dropdown with status options', async ({ page }) => {
    const filterBtn = page.locator('button').filter({ has: page.locator('svg[class*="lucide-sliders"]') })
      .or(page.locator('button[class*="SlidersHorizontal"]'))
    // Use SVG data from layout — it's the SlidersHorizontal button in header
    // Locate by aria or by svg path; fall back to any button containing svg near "New"
    const slidersBtn = page.locator('button').nth(2) // search, sort, filter, new
    // More reliable: click the button right before "New" that renders SlidersHorizontal
    await page.locator('button:has-text("New")').first()
      .locator('..').locator('button').nth(-2).click()
    // Filter dropdown should be open — look for "All" option
    await expect(page.locator('button:has-text("All")')).toBeVisible()
  })

  // ── 15. Clicking row opens profile ───────────────────────────────────────
  test('clicking a row opens the couple profile slide-over', async ({ page }) => {
    // Ensure there is at least one row
    const name = uniqueName('Profile Row Test')
    await addCouple(page, { name })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await expect(page.locator('[data-testid="couple-profile-panel"] h1')).toBeVisible()
    await expect(page.locator('[data-testid="couple-profile-panel"]')).toContainText(name)

    // Clean up
    await deleteCouple(page, name)
  })

  // ── 16. Profile closes via X ──────────────────────────────────────────────
  test('profile closes via the X button', async ({ page }) => {
    const name = uniqueName('Profile Close Test')
    await addCouple(page, { name })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="couple-profile-panel"] h1')

    // X is the first button in the panel header
    await page.locator('[data-testid="couple-profile-panel"]').locator('button').first().click()
    await expect(page.locator('[data-testid="couple-profile-panel"]')).not.toBeVisible()

    // Clean up
    await deleteCouple(page, name)
  })
})
