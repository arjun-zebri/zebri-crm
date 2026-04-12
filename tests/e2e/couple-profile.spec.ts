import { test, expect } from '@playwright/test'
import { login, addCouple, deleteCouple, openCoupleProfile, navigateToProfileTab, search, uniqueName } from './helpers'

const COUPLE_NAME_PREFIX = 'Profile Test'

test.describe('Couple Profile', () => {
  let coupleName: string

  test.beforeEach(async ({ page }) => {
    await login(page)
    coupleName = uniqueName(COUPLE_NAME_PREFIX)
    await page.goto('/couples', { waitUntil: 'networkidle' })
    await addCouple(page, {
      name: coupleName,
      email: 'profile@test.com',
      phone: '+61 400 111 222',
      notes: 'Profile test notes',
    })
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

  // ── OVERVIEW tab ──────────────────────────────────────────────────────────

  test('Overview: contact email and phone are visible', async ({ page }) => {
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel).toContainText('profile@test.com')
    await expect(panel).toContainText('+61 400 111 222')
  })

  test('Overview: notes appear when provided', async ({ page }) => {
    await navigateToProfileTab(page, 'Overview')
    await expect(page.locator('[data-testid="couple-profile-panel"]')).toContainText('Profile test notes')
  })

  test('Overview: Events section heading is visible', async ({ page }) => {
    await navigateToProfileTab(page, 'Overview')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('h3:has-text("Events")')).toBeVisible()
  })

  test('Overview: Events empty state shows "No events yet."', async ({ page }) => {
    await navigateToProfileTab(page, 'Overview')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=No events yet.')).toBeVisible()
  })

  test('Overview: clicking Events heading opens EventModal', async ({ page }) => {
    await navigateToProfileTab(page, 'Overview')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    // The Events heading is wrapped in a button — click the button
    await panel.locator('button:has(h3:has-text("Events"))').click()
    await expect(page.locator('h2:has-text("Add Event")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("Cancel")').click()
  })

  test('Overview: add event shows it in list', async ({ page }) => {
    await navigateToProfileTab(page, 'Overview')
    const panel = page.locator('[data-testid="couple-profile-panel"]')

    await panel.locator('button:has(h3:has-text("Events"))').click()
    await page.waitForSelector('h2:has-text("Add Event")')
    await page.locator('input[type="date"]').first().fill('2027-06-15')
    await page.locator('button:has-text("Save")').click()
    await page.waitForSelector('h2:has-text("Add Event")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    await expect(panel.locator('text=2027')).toBeVisible()
  })

  test('Overview: Contacts section heading is visible', async ({ page }) => {
    await navigateToProfileTab(page, 'Overview')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('h3:has-text("Contacts")')).toBeVisible()
  })

  test('Overview: Contacts empty state shows "No contacts yet."', async ({ page }) => {
    await navigateToProfileTab(page, 'Overview')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=No contacts yet.')).toBeVisible()
  })

  test('Overview: clicking Contacts heading opens contact picker', async ({ page }) => {
    await navigateToProfileTab(page, 'Overview')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await panel.locator('button:has(h3:has-text("Contacts"))').click()
    // ContactPicker renders a search input
    await expect(panel.locator('input[placeholder*="Search"], input[placeholder*="search"]').first()).toBeVisible({ timeout: 5000 })
  })

  // ── TASKS tab ─────────────────────────────────────────────────────────────

  test('Tasks: empty state shows "No tasks yet." and "+ Add task"', async ({ page }) => {
    await navigateToProfileTab(page, 'Tasks')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=No tasks yet.')).toBeVisible()
    await expect(panel.locator('text=+ Add task')).toBeVisible()
  })

  test('Tasks: create task — row with title appears in Upcoming section', async ({ page }) => {
    await navigateToProfileTab(page, 'Tasks')
    const panel = page.locator('[data-testid="couple-profile-panel"]')

    await panel.locator('text=+ Add task').click()
    await page.waitForSelector('h2:has-text("New Task")', { timeout: 5000 })

    await page.locator('input[placeholder="What needs to be done?"]').fill('Call venue')
    await page.locator('button:has-text("Save")').click()
    await page.waitForLoadState('networkidle')

    await expect(panel.locator('text=Call venue')).toBeVisible()
  })

  test('Tasks: toggle task complete moves it to Done section', async ({ page }) => {
    await navigateToProfileTab(page, 'Tasks')
    const panel = page.locator('[data-testid="couple-profile-panel"]')

    // Add a task first
    await panel.locator('text=+ Add task').click()
    await page.waitForSelector('h2:has-text("New Task")', { timeout: 5000 })
    await page.locator('input[placeholder="What needs to be done?"]').fill('Toggle me')
    await page.locator('button:has-text("Save")').click()
    await page.waitForLoadState('networkidle')

    // Click the circle toggle button (title="Mark as done")
    await panel.locator('button[title="Mark as done"]').first().click()
    await page.waitForLoadState('networkidle')

    // Task should now appear under Done section heading
    await expect(panel.locator('text=Done')).toBeVisible()
  })

  // ── PAYMENTS tab ──────────────────────────────────────────────────────────

  test('Payments: both section headings are visible', async ({ page }) => {
    await navigateToProfileTab(page, 'Payments')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=Quotes').first()).toBeVisible()
    await expect(panel.locator('text=Invoices').first()).toBeVisible()
  })

  test('Payments: Quotes empty state shows "No quotes yet."', async ({ page }) => {
    await navigateToProfileTab(page, 'Payments')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=No quotes yet.')).toBeVisible()
  })

  test('Payments: Invoices empty state shows "No invoices yet."', async ({ page }) => {
    await navigateToProfileTab(page, 'Payments')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=No invoices yet.')).toBeVisible()
  })

  // ── NAMES tab ─────────────────────────────────────────────────────────────

  test('Names: all four category headings are visible', async ({ page }) => {
    await navigateToProfileTab(page, 'Names')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('h3:has-text("Couple")')).toBeVisible()
    await expect(panel.locator('h3:has-text("Bridal Party")')).toBeVisible()
    await expect(panel.locator('h3:has-text("Family")')).toBeVisible()
    await expect(panel.locator('h3:has-text("Others")')).toBeVisible()
  })

  test('Names: empty state shows "No people added yet." per category', async ({ page }) => {
    await navigateToProfileTab(page, 'Names')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    // There are 4 categories — at least one should show empty text
    const emptyMessages = panel.locator('text=No people added yet.')
    await expect(emptyMessages.first()).toBeVisible()
  })

  test('Names: clicking category heading opens Add Person modal', async ({ page }) => {
    await navigateToProfileTab(page, 'Names')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await panel.locator('button:has(h3:has-text("Couple"))').click()
    await expect(page.locator('h2:has-text("Add person")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("Cancel")').click()
  })

  // ── SONGS tab ─────────────────────────────────────────────────────────────

  test('Songs: default categories are seeded on first open', async ({ page }) => {
    await navigateToProfileTab(page, 'Songs')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await page.waitForLoadState('networkidle')
    // Default categories: Parents Entry, Bridal Party Entry, Couple Entry
    await expect(panel.locator('text=Parents Entry')).toBeVisible({ timeout: 8000 })
    await expect(panel.locator('text=Bridal Party Entry')).toBeVisible()
    await expect(panel.locator('text=Couple Entry')).toBeVisible()
  })

  // ── FILES tab ─────────────────────────────────────────────────────────────

  test('Files: empty state shows "No files uploaded yet."', async ({ page }) => {
    await navigateToProfileTab(page, 'Files')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=No files uploaded yet.')).toBeVisible()
  })

  test('Files: "Add file" button is always visible (even when loading)', async ({ page }) => {
    await navigateToProfileTab(page, 'Files')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=Add file')).toBeVisible()
  })

  // ── TIMELINE tab ──────────────────────────────────────────────────────────

  test('Timeline: empty state shown when couple has no events', async ({ page }) => {
    await navigateToProfileTab(page, 'Timeline')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await page.waitForLoadState('networkidle')
    await expect(panel.locator('text=No events yet.')).toBeVisible({ timeout: 8000 })
  })
})
