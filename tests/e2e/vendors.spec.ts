import { test, expect } from '@playwright/test'
import { login, addVendor, deleteVendor, search, uniqueName } from './helpers'

test.describe('Vendor Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/vendors', { waitUntil: 'networkidle' })
  })

  // ── 1. Page header ────────────────────────────────────────────────────────
  test('renders h1 "Vendors" with New button and search', async ({ page }) => {
    await expect(page.locator('h1:has-text("Vendors")')).toBeVisible()
    await expect(page.locator('button:has-text("New")')).toBeVisible()
    await expect(page.locator('input[placeholder="Search..."]')).toBeVisible()
  })

  // ── 2. Table columns ──────────────────────────────────────────────────────
  test('table has Vendor, Contact, Phone, Email, Category, Status columns', async ({ page }) => {
    for (const col of ['Vendor', 'Contact', 'Phone', 'Email', 'Category', 'Status']) {
      await expect(page.locator(`table th:has-text("${col}")`)).toBeVisible()
    }
  })

  // ── 3. CRUD: create → verify → edit → delete ─────────────────────────────
  test('CRUD: create vendor, edit notes, then delete', async ({ page }) => {
    const name = uniqueName('E2E Vendor')
    const updatedNotes = 'Updated vendor notes ' + Date.now()

    // Create
    await addVendor(page, { name, email: 'vendor@test.com', phone: '+61 400 999 888' })

    // Verify row
    await search(page, name)
    await expect(page.locator(`table tbody tr:has-text("${name}")`)).toBeVisible()

    // Edit notes
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="vendor-profile-panel"] h1')
    await page.locator('[data-testid="vendor-profile-panel"]').locator('button:has-text("Edit")').click()
    await page.waitForSelector('h2:has-text("Edit Vendor")')
    await page.locator('textarea').fill(updatedNotes)
    await page.locator('button:has-text("Save")').click()
    await page.waitForSelector('h2:has-text("Edit Vendor")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // Delete
    await page.locator('[data-testid="vendor-profile-panel"]').locator('button:has-text("Edit")').click()
    await page.waitForSelector('h2:has-text("Edit Vendor")')
    await page.locator('button:has-text("Delete")').click()
    await page.locator('button:has-text("Click again to confirm")').click()
    await page.waitForSelector('h2:has-text("Edit Vendor")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // Row gone
    await search(page, name)
    await expect(page.locator(`table tbody tr:has-text("${name}")`)).toHaveCount(0)
  })

  // ── 4. Save disabled until name filled ───────────────────────────────────
  test('Save disabled until Vendor Name is filled', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Vendor")')
    const saveBtn = page.locator('button:has-text("Save")')
    await expect(saveBtn).toBeDisabled()
    await page.locator('input[placeholder="e.g., Elegant Venues"]').fill('Some Vendor')
    await expect(saveBtn).toBeEnabled()
    await page.locator('button:has-text("Cancel")').click()
  })

  // ── 5. Cancel closes modal ────────────────────────────────────────────────
  test('Cancel closes Add Vendor modal', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Vendor")')
    await page.locator('button:has-text("Cancel")').click()
    await expect(page.locator('h2:has-text("Add Vendor")')).not.toBeVisible()
  })

  // ── 6. Escape closes modal ────────────────────────────────────────────────
  test('Escape key closes Add Vendor modal', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Vendor")')
    await page.keyboard.press('Escape')
    await expect(page.locator('h2:has-text("Add Vendor")')).not.toBeVisible()
  })

  // ── 7. "n" shortcut ───────────────────────────────────────────────────────
  test('"n" shortcut opens Add Vendor modal', async ({ page }) => {
    await page.locator('body').click()
    await page.keyboard.press('n')
    await expect(page.locator('h2:has-text("Add Vendor")')).toBeVisible()
    await page.locator('button:has-text("Cancel")').click()
  })

  // ── 8. "/" shortcut ───────────────────────────────────────────────────────
  test('"/" shortcut focuses search input', async ({ page }) => {
    await page.locator('body').click()
    await page.keyboard.press('/')
    await expect(page.locator('input[placeholder="Search..."]').first()).toBeFocused()
    await page.keyboard.press('Escape')
  })

  // ── 9. Escape in search clears value ─────────────────────────────────────
  test('Escape in focused search clears value', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search..."]').first()
    await searchInput.fill('DJ')
    await expect(searchInput).toHaveValue('DJ')
    await searchInput.press('Escape')
    await expect(searchInput).toHaveValue('')
  })

  // ── 10. Search filters rows ───────────────────────────────────────────────
  test('search filters table rows to matching names only', async ({ page }) => {
    const name = uniqueName('Searchable Vendor')
    await addVendor(page, { name })

    await search(page, name)
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(1)

    // Clean up
    await deleteVendor(page, name)
  })

  // ── 11. Category filter ───────────────────────────────────────────────────
  test('clicking row opens vendor profile panel', async ({ page }) => {
    const name = uniqueName('Profile Test Vendor')
    await addVendor(page, { name })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await expect(page.locator('[data-testid="vendor-profile-panel"] h1')).toBeVisible()
    await expect(page.locator('[data-testid="vendor-profile-panel"]')).toContainText(name)

    // Clean up
    await page.locator('[data-testid="vendor-profile-panel"]').locator('button').first().click()
    await deleteVendor(page, name)
  })

  // ── 12. Vendor profile Overview ───────────────────────────────────────────
  test('vendor profile Overview shows contact details', async ({ page }) => {
    const name = uniqueName('Overview Vendor')
    await addVendor(page, { name, email: 'overview@vendor.com', phone: '+61 400 777 666' })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="vendor-profile-panel"] h1')

    const panel = page.locator('[data-testid="vendor-profile-panel"]')
    await expect(panel).toContainText('overview@vendor.com')
    await expect(panel).toContainText('+61 400 777 666')

    // Clean up
    await panel.locator('button').first().click()
    await deleteVendor(page, name)
  })

  // ── 13. Vendor profile close ──────────────────────────────────────────────
  test('vendor profile closes via X button', async ({ page }) => {
    const name = uniqueName('Close Vendor Test')
    await addVendor(page, { name })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="vendor-profile-panel"] h1')

    await page.locator('[data-testid="vendor-profile-panel"]').locator('button').first().click()
    await expect(page.locator('[data-testid="vendor-profile-panel"]')).not.toBeVisible()

    // Clean up
    await deleteVendor(page, name)
  })

  // ── 14. Vendor profile Events tab ────────────────────────────────────────
  test('vendor profile Events tab renders without crash', async ({ page }) => {
    const name = uniqueName('Events Tab Vendor')
    await addVendor(page, { name })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="vendor-profile-panel"] h1')

    const panel = page.locator('[data-testid="vendor-profile-panel"]')
    await panel.locator('button:has-text("Events")').click()
    await page.waitForLoadState('networkidle')
    // Should render the tab content without error
    await expect(panel).toBeVisible()

    // Clean up
    await panel.locator('button').first().click()
    await deleteVendor(page, name)
  })

  // ── 15. Vendor modal has all form fields ──────────────────────────────────
  test('Add Vendor modal shows all required form fields', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Vendor")')
    await expect(page.locator('input[placeholder="e.g., Elegant Venues"]')).toBeVisible()
    await expect(page.locator('input[placeholder="e.g., John Smith"]')).toBeVisible()
    await expect(page.locator('input[type="tel"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('textarea')).toBeVisible()
    await page.locator('button:has-text("Cancel")').click()
  })
})
