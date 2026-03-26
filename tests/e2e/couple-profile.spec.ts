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
    // Clean up — navigate back to couples page and delete the couple if still present
    try {
      await page.goto('/couples', { waitUntil: 'networkidle' })
      await deleteCouple(page, coupleName)
    } catch {
      // Already deleted in the test — that's fine
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

  test('Overview: Edit button opens Edit modal with pre-filled Name', async ({ page }) => {
    await page.locator('[data-testid="couple-profile-panel"]').locator('button:has-text("Edit")').click()
    await page.waitForSelector('h2:has-text("Edit Couple")')
    const nameInput = page.locator('input[placeholder="Couple\'s name"]')
    await expect(nameInput).toHaveValue(coupleName)
    await page.locator('button:has-text("Cancel")').click()
  })

  // ── EVENTS tab ────────────────────────────────────────────────────────────
  test('Events: empty state shows "No events yet." and "+ Add Event"', async ({ page }) => {
    await navigateToProfileTab(page, 'Events')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=No events yet.')).toBeVisible()
    await expect(panel.locator('text=+ Add Event')).toBeVisible()
  })

  test('Events: add event shows it in list', async ({ page }) => {
    await navigateToProfileTab(page, 'Events')
    const panel = page.locator('[data-testid="couple-profile-panel"]')

    await panel.locator('text=+ Add Event').click()
    await page.waitForSelector('h2:has-text("Add Event")')

    // Fill the date field (required)
    await page.locator('input[type="date"]').first().fill('2027-06-15')
    // Optional venue
    const venueInput = page.locator('input[placeholder*="venue"], input[placeholder*="Venue"]').first()
    if (await venueInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await venueInput.fill('Grand Ballroom')
    }

    await page.locator('button:has-text("Save")').click()
    await page.waitForSelector('h2:has-text("Add Event")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // Event should appear in the list
    await expect(panel.locator('text=2027')).toBeVisible()
  })

  test('Events: delete event via trash icon shows confirmation dialog', async ({ page }) => {
    // First add an event
    await navigateToProfileTab(page, 'Events')
    const panel = page.locator('[data-testid="couple-profile-panel"]')

    await panel.locator('text=+ Add Event').click()
    await page.waitForSelector('h2:has-text("Add Event")')
    await page.locator('input[type="date"]').first().fill('2027-07-20')
    await page.locator('button:has-text("Save")').click()
    await page.waitForSelector('h2:has-text("Add Event")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // Click trash icon to delete
    await panel.locator('button[title*="elete"], button svg[class*="trash"], button').filter({
      has: page.locator('svg')
    }).last().click()

    // Confirmation dialog should appear
    await expect(page.locator('text=Delete Event').or(page.locator('text=Are you sure'))).toBeVisible({ timeout: 3000 })
  })

  // ── CONTACTS tab ───────────────────────────────────────────────────────────
  test('Contacts: empty state shows "No contacts assigned yet." and "+ Add Contact"', async ({ page }) => {
    await navigateToProfileTab(page, 'Contacts')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=No contacts assigned yet.')).toBeVisible()
    await expect(panel.locator('text=+ Add Contact')).toBeVisible()
  })

  test('Contacts: clicking "+ Add Contact" shows contact picker', async ({ page }) => {
    await navigateToProfileTab(page, 'Contacts')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await panel.locator('text=+ Add Contact').click()
    // ContactPicker should be visible — look for search input
    await expect(panel.locator('input[placeholder*="Search"], input[placeholder*="contact"]')).toBeVisible({ timeout: 3000 })
  })

  // ── TASKS tab ─────────────────────────────────────────────────────────────
  test('Tasks: empty state shows "No tasks yet." and "+ Add Task"', async ({ page }) => {
    await navigateToProfileTab(page, 'Tasks')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.locator('text=No tasks yet.')).toBeVisible()
    await expect(panel.locator('text=+ Add Task')).toBeVisible()
  })

  test('Tasks: create task — row with title and "todo" badge appears', async ({ page }) => {
    await navigateToProfileTab(page, 'Tasks')
    const panel = page.locator('[data-testid="couple-profile-panel"]')

    await panel.locator('text=+ Add Task').click()
    await page.waitForSelector('input[placeholder="What needs to be done?"]')

    await page.locator('input[placeholder="What needs to be done?"]').fill('Call venue')
    await page.locator('button:has-text("Add Task")').click()
    await page.waitForLoadState('networkidle')

    await expect(panel.locator('text=Call venue')).toBeVisible()
    await expect(panel.locator('text=todo')).toBeVisible()
  })

  test('Tasks: toggle task complete changes badge to "done"', async ({ page }) => {
    await navigateToProfileTab(page, 'Tasks')
    const panel = page.locator('[data-testid="couple-profile-panel"]')

    // Add a task first
    await panel.locator('text=+ Add Task').click()
    await page.waitForSelector('input[placeholder="What needs to be done?"]')
    await page.locator('input[placeholder="What needs to be done?"]').fill('Toggle me')
    await page.locator('button:has-text("Add Task")').click()
    await page.waitForLoadState('networkidle')

    // Click the checkbox
    await panel.locator('input[type="checkbox"]').first().click()
    await page.waitForLoadState('networkidle')

    await expect(panel.locator('text=done')).toBeVisible()
  })
})
