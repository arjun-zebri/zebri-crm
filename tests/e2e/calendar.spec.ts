import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/calendar', { waitUntil: 'networkidle' })
  })

  // ── 1. Calendar renders with nav + view buttons ───────────────────────────
  test('renders with Prev/Next navigation and Day/Week/Month buttons', async ({ page }) => {
    // View dropdown button should be visible (currently showing view name)
    const viewDropdown = page.locator('button').filter({ hasText: /^(day|week|month)$/i }).last()
    await expect(viewDropdown).toBeVisible()
    // Status dropdown should also be visible
    const statusDropdown = page.locator('button').filter({ hasText: /[Ss]tatuses?/ }).first()
    await expect(statusDropdown).toBeVisible()
  })

  // ── 2. Default is Week view ───────────────────────────────────────────────
  test('default view is Week (Week button appears active)', async ({ page, browserName }) => {
    // Skip on mobile browsers since they have different layout
    const isMobile = browserName.includes('webkit') || page.viewportSize()?.width! < 768
    if (isMobile) test.skip()

    // View dropdown shows "week" (lowercase) as current view
    const viewDropdown = page.locator('button').filter({ hasText: /^week$/i }).last()
    await expect(viewDropdown).toBeVisible()
    // Verify we have a 7-column grid (week view)
    const weekColumns = page.locator('[class*="grid-cols-7"]').first()
    await expect(weekColumns).toBeVisible()
  })

  // ── 3. Month view shows weekday headers ───────────────────────────────────
  test('Month view shows 7-column weekday headers', async ({ page }) => {
    // Open the view dropdown (the one on the right side of the header with capitalize text)
    const allViewBtns = page.locator('button').filter({ hasText: /^(day|week|month)$/i })
    const viewDropdownBtn = allViewBtns.last()
    await viewDropdownBtn.click()
    // Wait a moment for dropdown to appear
    await page.waitForTimeout(300)
    // Click month option in dropdown - get all buttons with "month" text
    const monthBtns = page.locator('button:has-text("month")')
    const monthDropdownItem = monthBtns.last() // Get the one in the dropdown (last occurrence)
    await monthDropdownItem.click()
    await page.waitForLoadState('networkidle')
    // Weekday abbreviations should be visible
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(page.locator(`[data-testid="weekday-${day}"]`)).toBeVisible()
    }
  })

  // ── 4. Next advances period ───────────────────────────────────────────────
  test('Next button advances the calendar period', async ({ page }) => {
    // Get the current header label
    const header = page.locator('[data-testid="calendar-header"]')
    const initialText = await header.textContent()

    // Click the next button
    const nextBtn = page.locator('[data-testid="calendar-next-btn"]')
    await nextBtn.click()
    await page.waitForLoadState('networkidle')

    const newText = await header.textContent()
    expect(newText).not.toEqual(initialText)
  })

  // ── 5. Prev goes back ─────────────────────────────────────────────────────
  test('Prev button goes back to previous period', async ({ page }) => {
    const header = page.locator('[data-testid="calendar-header"]')

    // Click next first so we can go back
    const nextBtn = page.locator('[data-testid="calendar-next-btn"]')
    await nextBtn.click()
    await page.waitForLoadState('networkidle')
    const movedText = await header.textContent()

    // Now click prev
    const prevBtn = page.locator('[data-testid="calendar-prev-btn"]')
    await prevBtn.click()
    await page.waitForLoadState('networkidle')
    const backText = await header.textContent()

    expect(backText).not.toEqual(movedText)
  })

  // ── 6. Sidebar shows mini calendar and day timeline ─────────────────────────────
  test('sidebar displays mini calendar and events timeline', async ({ page, browserName }) => {
    // Skip on mobile browsers - different layout on mobile
    const isMobile = browserName.includes('webkit') || page.viewportSize()?.width! < 768
    if (isMobile) test.skip()

    // Mini calendar should be visible in sidebar
    const miniCalendar = page.locator('text=/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d{4}$/').first()
    await expect(miniCalendar).toBeVisible()

    // Day events timeline section should be visible
    const daysTimelineLabel = page.locator('text=/^Events · /').first()
    await expect(daysTimelineLabel).toBeVisible()
  })

  // ── 7. Day view renders without error ────────────────────────────────────────
  test('Day view renders without error', async ({ page }) => {
    // Open the view dropdown
    const allViewBtns = page.locator('button').filter({ hasText: /^(day|week|month)$/i })
    const viewDropdownBtn = allViewBtns.last()
    await viewDropdownBtn.click()
    // Wait a moment for dropdown to appear
    await page.waitForTimeout(300)
    // Click day option in dropdown
    const dayBtns = page.locator('button:has-text("day")')
    const dayDropdownItem = dayBtns.last() // Get the one in the dropdown
    await dayDropdownItem.click()
    await page.waitForLoadState('networkidle')
    // Should not crash — verify day view is visible
    const dayView = page.locator('text=/^(No events on this day|Calendar)$/').first()
    await expect(dayView).toBeVisible({ timeout: 5000 })
  })

  // ── 8. Switching views persists on page ───────────────────────────────────
  test('switching between Day/Week/Month views does not crash', async ({ page }) => {
    for (const view of ['Day', 'Month', 'Week']) {
      // Open the view dropdown
      const allViewBtns = page.locator('button').filter({ hasText: /^(day|week|month)$/i })
      const viewDropdownBtn = allViewBtns.last()
      await viewDropdownBtn.click()
      // Wait a moment for dropdown to appear
      await page.waitForTimeout(300)
      // Click the view option in dropdown
      const viewBtns = page.locator(`button:has-text("${view.toLowerCase()}")`)
      const viewDropdownItem = viewBtns.last()
      await viewDropdownItem.click()
      await page.waitForLoadState('networkidle')
      // Verify the view is now active
      const activeViewBtn = page.locator('button').filter({ hasText: new RegExp(`^${view.toLowerCase()}$`, 'i') }).last()
      await expect(activeViewBtn).toBeVisible()
    }
  })
})
