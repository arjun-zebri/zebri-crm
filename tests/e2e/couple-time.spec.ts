import { test, expect } from '@playwright/test'

import {
  addCouple,
  deleteCouple,
  login,
  navigateToProfileTab,
  openCoupleProfile,
  startCoupleTimer,
  stopCoupleTimerFromPill,
  uniqueName,
} from './helpers'

/**
 * Couple time tracking: the header clock, the floating pill, the stop
 * note dialog, and the Time tab.
 *
 * These specs need the `couple_time_entries` / `time_categories` tables,
 * so they only pass against a server whose database has the
 * 20260730120000 migration. The default dev server points at the remote
 * Supabase, which gets it on the next CI deploy; until then run them
 * against a dev server wired to local Supabase.
 */
const PREFIX = 'Timer Test'

test.describe('Couple time tracking', () => {
  let coupleName: string

  test.beforeEach(async ({ page }) => {
    await login(page)
    coupleName = uniqueName(PREFIX)
    await page.goto('/couples', { waitUntil: 'networkidle' })
    await addCouple(page, { name: coupleName, email: 'timer@test.com' })
    await openCoupleProfile(page, coupleName)
  })

  test.afterEach(async ({ page }) => {
    // Never leave a timer running: it would follow the next spec around
    // and the couple delete would cascade it away mid-flight.
    const pill = page.locator('[data-testid="timer-pill"]')
    if (await pill.isVisible().catch(() => false)) {
      await stopCoupleTimerFromPill(page)
      await page
        .getByRole('button', { name: 'Skip' })
        .click()
        .catch(() => {})
    }
    try {
      await page.goto('/couples', { waitUntil: 'networkidle' })
      await deleteCouple(page, coupleName)
    } catch {
      // Already deleted in the test
    }
  })

  test('Time tab starts empty', async ({ page }) => {
    await navigateToProfileTab(page, 'Time')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.getByText('No time tracked yet')).toBeVisible()
  })

  test('starting from the header shows the pill once the profile closes', async ({
    page,
  }) => {
    await startCoupleTimer(page)
    await page.locator('[data-testid="couple-profile-panel"]').press('Escape')
    const pill = page.locator('[data-testid="timer-pill"]')
    await expect(pill).toBeVisible()
    await expect(pill).toContainText(coupleName)
  })

  test('the pill survives navigation and a reload, and keeps ticking', async ({
    page,
  }) => {
    await startCoupleTimer(page)
    await page.locator('[data-testid="couple-profile-panel"]').press('Escape')

    await page.goto('/tasks', { waitUntil: 'networkidle' })
    const pill = page.locator('[data-testid="timer-pill"]')
    await expect(pill).toBeVisible()

    const before = await pill.innerText()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(pill).toBeVisible()
    await page.waitForTimeout(2200)
    expect(await pill.innerText()).not.toBe(before)
  })

  test('stopping captures a note and a new category, which land in the Time tab', async ({
    page,
  }) => {
    await startCoupleTimer(page)
    await page.locator('[data-testid="couple-profile-panel"]').press('Escape')
    await stopCoupleTimerFromPill(page)

    await page
      .getByLabel('What did you work on?')
      .fill('Venue walkthrough call')
    await page.getByRole('button', { name: 'Add category' }).click()
    await page.getByPlaceholder('Search or add new').fill('Site visit')
    await page.getByRole('button', { name: /Create "Site visit"/ }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByLabel('What did you work on?')).toBeHidden()

    await page.goto('/couples', { waitUntil: 'networkidle' })
    await openCoupleProfile(page, coupleName)
    await navigateToProfileTab(page, 'Time')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.getByText('Venue walkthrough call')).toBeVisible()
    await expect(panel.getByText('Site visit').first()).toBeVisible()
    await expect(panel.getByText(/tracked/)).toBeVisible()
  })

  test('skipping the note dialog still keeps the session', async ({ page }) => {
    await startCoupleTimer(page)
    await page.locator('[data-testid="couple-profile-panel"]').press('Escape')
    await stopCoupleTimerFromPill(page)
    await page.getByRole('button', { name: 'Skip' }).click()

    await page.goto('/couples', { waitUntil: 'networkidle' })
    await openCoupleProfile(page, coupleName)
    await navigateToProfileTab(page, 'Time')
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.getByText('No time tracked yet')).toBeHidden()
    await expect(panel.getByText('Uncategorised', { exact: false })).toBeVisible()
  })

  test('the starter categories are seeded', async ({ page }) => {
    await navigateToProfileTab(page, 'Time')
    await page
      .locator('[data-testid="couple-profile-panel"]')
      .getByRole('button', { name: 'Add time' })
      .click()
    await page.getByRole('button', { name: 'Add category' }).click()
    for (const name of [
      'Meeting',
      'Call',
      'Admin',
      'Travel',
      'Rehearsal',
      'Ceremony',
    ]) {
      await expect(
        page.getByRole('button', { name, exact: true }).first(),
      ).toBeVisible()
    }
  })

  test('a manual entry can be added, edited and deleted', async ({ page }) => {
    await navigateToProfileTab(page, 'Time')
    const panel = page.locator('[data-testid="couple-profile-panel"]')

    await panel.getByRole('button', { name: 'Add time' }).click()
    await page.getByLabel('Duration', { exact: true }).fill('1h 30m')
    await page.getByLabel('Note', { exact: true }).fill('Ceremony script draft')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(panel.getByText('Ceremony script draft')).toBeVisible()
    await expect(panel.getByText('1h 30m tracked')).toBeVisible()

    // Edit it down to an hour, two quarter-hour steps on the stepper.
    await panel.getByRole('button', { name: 'Row actions' }).first().click()
    // `exact` matters: accessible-name matching is substring by default,
    // and the profile header carries an "Edit tabs" button.
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const less = page.getByRole('button', { name: 'Less by 15 minutes' })
    await less.click()
    await less.click()
    await expect(page.getByLabel('Duration', { exact: true })).toHaveValue('1h')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(panel.getByText('1h tracked')).toBeVisible()

    // Then remove it.
    await panel.getByRole('button', { name: 'Row actions' }).first().click()
    // `exact` again: the header's destructive icon is named "Delete
    // couple", so a substring match would delete the couple instead of
    // the row and leave nothing to assert against.
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(panel.getByText('No time tracked yet')).toBeVisible()
  })

  test('starting a second couple stops the first', async ({ page }) => {
    const otherName = uniqueName('Timer Other')
    await startCoupleTimer(page)
    await page.locator('[data-testid="couple-profile-panel"]').press('Escape')

    await page.goto('/couples', { waitUntil: 'networkidle' })
    await addCouple(page, { name: otherName })
    await openCoupleProfile(page, otherName)

    // The other couple's timer shows as a chip in this header.
    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.getByText(coupleName).first()).toBeVisible()

    // Starting here stops it and offers its note dialog.
    await startCoupleTimer(page)
    await expect(page.getByLabel('What did you work on?')).toBeVisible()
    await page.getByRole('button', { name: 'Skip' }).click()

    await page.locator('[data-testid="couple-profile-panel"]').press('Escape')
    await expect(page.locator('[data-testid="timer-pill"]')).toContainText(
      otherName,
    )

    await stopCoupleTimerFromPill(page)
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.goto('/couples', { waitUntil: 'networkidle' })
    await deleteCouple(page, otherName)
  })
})
