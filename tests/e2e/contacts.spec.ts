import { test, expect } from '@playwright/test'
import { login, addContact, deleteContact, search, uniqueName } from './helpers'

test.describe('Contact Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/contacts', { waitUntil: 'networkidle' })
  })

  // ── 1. Page header ────────────────────────────────────────────────────────
  test('renders h1 "Contacts" with New button and search', async ({ page }) => {
    await expect(page.locator('h1:has-text("Contacts")')).toBeVisible()
    await expect(page.locator('button:has-text("New")')).toBeVisible()
    await expect(page.locator('input[placeholder="Search..."]')).toBeVisible()
  })

  // ── 2. Table columns ──────────────────────────────────────────────────────
  test('table has Contact, Contact, Phone, Email, Category, Status columns', async ({ page }) => {
    for (const col of ['Contact', 'Phone', 'Email', 'Category', 'Status']) {
      await expect(page.locator(`table th:has-text("${col}")`)).toBeVisible()
    }
  })

  // ── 3. CRUD: create → verify → edit → delete ─────────────────────────────
  test('CRUD: create contact, edit notes, then delete', async ({ page }) => {
    const name = uniqueName('E2E Contact')
    const updatedNotes = 'Updated contact notes ' + Date.now()

    // Create
    await addContact(page, { name, email: 'contact@test.com', phone: '+61 400 999 888' })

    // Verify row
    await search(page, name)
    await expect(page.locator(`table tbody tr:has-text("${name}")`)).toBeVisible()

    // Edit notes
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="contact-profile-panel"] h1')
    await page.locator('[data-testid="contact-profile-panel"]').locator('button:has-text("Edit")').click()
    await page.waitForSelector('h2:has-text("Edit Contact")')
    await page.locator('textarea').fill(updatedNotes)
    await page.locator('button:has-text("Save")').click()
    await page.waitForSelector('h2:has-text("Edit Contact")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // Delete
    await page.locator('[data-testid="contact-profile-panel"]').locator('button:has-text("Edit")').click()
    await page.waitForSelector('h2:has-text("Edit Contact")')
    await page.locator('button:has-text("Delete")').click()
    await page.locator('button:has-text("Click again to confirm")').click()
    await page.waitForSelector('h2:has-text("Edit Contact")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // Row gone
    await search(page, name)
    await expect(page.locator(`table tbody tr:has-text("${name}")`)).toHaveCount(0)
  })

  // ── 4. Save disabled until name filled ───────────────────────────────────
  test('Save disabled until Contact Name is filled', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Contact")')
    const saveBtn = page.locator('button:has-text("Save")')
    await expect(saveBtn).toBeDisabled()
    await page.locator('input[placeholder="e.g., Elegant Venues"]').fill('Some Contact')
    await expect(saveBtn).toBeEnabled()
    await page.locator('button:has-text("Cancel")').click()
  })

  // ── 5. Cancel closes modal ────────────────────────────────────────────────
  test('Cancel closes Add Contact modal', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Contact")')
    await page.locator('button:has-text("Cancel")').click()
    await expect(page.locator('h2:has-text("Add Contact")')).not.toBeVisible()
  })

  // ── 6. Escape closes modal ────────────────────────────────────────────────
  test('Escape key closes Add Contact modal', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Contact")')
    await page.keyboard.press('Escape')
    await expect(page.locator('h2:has-text("Add Contact")')).not.toBeVisible()
  })

  // ── 7. "n" shortcut ───────────────────────────────────────────────────────
  test('"n" shortcut opens Add Contact modal', async ({ page }) => {
    await page.locator('body').click()
    await page.keyboard.press('n')
    await expect(page.locator('h2:has-text("Add Contact")')).toBeVisible()
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
    const name = uniqueName('Searchable Contact')
    await addContact(page, { name })

    await search(page, name)
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(1)

    // Clean up
    await deleteContact(page, name)
  })

  // ── 11. Category filter ───────────────────────────────────────────────────
  test('clicking row opens contact profile panel', async ({ page }) => {
    const name = uniqueName('Profile Test Contact')
    await addContact(page, { name })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await expect(page.locator('[data-testid="contact-profile-panel"] h1')).toBeVisible()
    await expect(page.locator('[data-testid="contact-profile-panel"]')).toContainText(name)

    // Clean up
    await page.locator('[data-testid="contact-profile-panel"]').locator('button').first().click()
    await deleteContact(page, name)
  })

  // ── 12. Contact profile Overview ───────────────────────────────────────────
  test('contact profile Overview shows contact details', async ({ page }) => {
    const name = uniqueName('Overview Contact')
    await addContact(page, { name, email: 'overview@contact.com', phone: '+61 400 777 666' })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="contact-profile-panel"] h1')

    const panel = page.locator('[data-testid="contact-profile-panel"]')
    await expect(panel).toContainText('overview@contact.com')
    await expect(panel).toContainText('+61 400 777 666')

    // Clean up
    await panel.locator('button').first().click()
    await deleteContact(page, name)
  })

  // ── 13. Contact profile close ──────────────────────────────────────────────
  test('contact profile closes via X button', async ({ page }) => {
    const name = uniqueName('Close Contact Test')
    await addContact(page, { name })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="contact-profile-panel"] h1')

    await page.locator('[data-testid="contact-profile-panel"]').locator('button').first().click()
    await expect(page.locator('[data-testid="contact-profile-panel"]')).not.toBeVisible()

    // Clean up
    await deleteContact(page, name)
  })

  // ── 14. Contact profile "Used by" section renders ────────────────────────
  test('contact profile shows Used by section on Overview', async ({ page }) => {
    const name = uniqueName('Used By Contact')
    await addContact(page, { name })
    await search(page, name)
    await page.locator(`table tbody tr:has-text("${name}")`).first().click()
    await page.waitForSelector('[data-testid="contact-profile-panel"]')

    const panel = page.locator('[data-testid="contact-profile-panel"]')
    await expect(panel.locator('text=Used by')).toBeVisible()
    await page.waitForLoadState('networkidle')

    // Clean up
    await panel.locator('button').first().click()
    await deleteContact(page, name)
  })

  // ── 15. Contact modal has all form fields ──────────────────────────────────
  test('Add Contact modal shows all required form fields', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click()
    await page.waitForSelector('h2:has-text("Add Contact")')
    await expect(page.locator('input[placeholder="e.g., Elegant Venues"]')).toBeVisible()
    await expect(page.locator('input[placeholder="e.g., John Smith"]')).toBeVisible()
    await expect(page.locator('input[type="tel"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('textarea')).toBeVisible()
    await page.locator('button:has-text("Cancel")').click()
  })
})
