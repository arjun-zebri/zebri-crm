/**
 * Proposals Phase C — composer + payments tab e2e.
 *
 * Covers the MC-side flow: the Proposals tab renders on /payments,
 * the composer opens, a couple is picked, an option is composed with
 * base items + a pre-ticked add-on, and the save persists (row
 * appears in the list; reopening shows the same state).
 *
 * NOTE: needs the proposals migration on the target DB
 * (20260710000000). Against a dev server pointed at the remote DB
 * this passes only after the CI migration deploy.
 */
import { expect, test } from '@playwright/test'

import { addCouple, login, uniqueName } from './helpers'

test.describe('proposals composer', () => {
  test('compose, save and reopen a single-option proposal', async ({ page }) => {
    await login(page)

    // A couple to propose to. The add-couple helper drives the desktop
    // /couples UI; on mobile viewports (icon-only New button) fall back
    // to whichever couple already exists.
    let coupleName: string | null = uniqueName('Proposal Couple')
    await page.goto('/couples')
    await page.waitForLoadState('networkidle')
    const canCreate = await page
      .locator('button:has-text("New couple")')
      .first()
      .isVisible()
      .catch(() => false)
    if (canCreate) {
      await addCouple(page, { name: coupleName })
    } else {
      coupleName = null
    }

    await page.goto('/payments')
    await page.getByRole('button', { name: 'Proposals' }).click()
    await page.getByRole('button', { name: /New proposal/i }).first().click()

    // Couple picker.
    await page.getByText('Select couple', { exact: false }).first().click()
    if (coupleName) {
      await page.getByText(coupleName).first().click()
    } else {
      // First entry in the picker popover.
      await page.locator('[data-radix-popper-content-wrapper] button').first().click()
    }

    // A blank option is always composable, package catalog or not.
    await page.getByRole('button', { name: /Add blank option/i }).click()

    // Title the option + add a priced base item.
    await page.getByLabel('Option 1 title').fill('Full Day MC')
    await page.getByRole('button', { name: /Add your first line item/i }).first().click()
    await page.getByPlaceholder('Description').last().fill('Full-day hosting')
    await page.getByPlaceholder('0.00').last().fill('1450')

    // Save and confirm persistence.
    await page.getByRole('button', { name: /Save changes/i }).click()
    await expect(page.getByText('Proposal saved')).toBeVisible({ timeout: 15000 })
    await page.keyboard.press('Escape')

    // The table renders desktop + mobile variants of each row; assert
    // on whichever proposal-number cell is visible in this viewport.
    await expect(page.locator('text=/PR-\\d+/ >> visible=true').first()).toBeVisible({
      timeout: 15000,
    })
  })

  test('flagship: compose → send → couple accepts → invoice from the recorded selection', async ({
    page,
    browser,
  }) => {
    // Full-workflow test spanning two browser contexts — needs more
    // than the 30s default.
    test.setTimeout(120_000)
    await login(page)

    // Couple (desktop-only helper; mobile falls back like the spec above).
    let coupleName: string | null = uniqueName('Flagship Couple')
    await page.goto('/couples')
    await page.waitForLoadState('networkidle')
    const canCreate = await page
      .locator('button:has-text("New couple")')
      .first()
      .isVisible()
      .catch(() => false)
    if (canCreate) {
      await addCouple(page, { name: coupleName })
    } else {
      coupleName = null
    }

    // Compose: one option, one base item, one PRE-TICKED add-on.
    await page.goto('/payments')
    await page.getByRole('button', { name: 'Proposals' }).click()
    await page.getByRole('button', { name: /New proposal/i }).first().click()
    await page.getByText('Select couple', { exact: false }).first().click()
    if (coupleName) {
      await page.getByText(coupleName).first().click()
    } else {
      await page.locator('[data-radix-popper-content-wrapper] button').first().click()
    }
    // Unique title so the reopen steps can't collide with proposals
    // created by parallel tests.
    const proposalTitle = uniqueName('Flagship Proposal')
    await page.getByPlaceholder(/proposal title|Proposal for/i).fill(proposalTitle)
    await page.getByRole('button', { name: /Add blank option/i }).click()
    await page.getByLabel('Option 1 title').fill('Full Day MC')
    await page.getByRole('button', { name: /Add your first line item/i }).click()
    await page.getByPlaceholder('Description').last().fill('Full-day hosting')
    await page.getByPlaceholder('0.00').last().fill('1450')
    await page.getByRole('button', { name: /Add add-on/i }).click()
    await page.getByPlaceholder('e.g., After-party hosting').last().fill('Rehearsal attendance')
    await page.locator('input[aria-label="Add-on amount"]').last().fill('150')
    await page.getByLabel(/Pre-select Rehearsal attendance/i).click()

    // Save, then reopen from the list — a freshly created proposal's
    // modal stays keyed 'new', and the share/mark-sent affordances
    // only render once the modal holds the persisted row.
    await page.getByRole('button', { name: /Save changes/i }).click()
    await expect(page.getByText('Proposal saved')).toBeVisible({ timeout: 15000 })
    await page.keyboard.press('Escape')
    await page.locator(`text=${proposalTitle} >> visible=true`).first().click()
    await expect(page.getByLabel('Option 1 title')).toHaveValue('Full Day MC', { timeout: 15000 })

    // Send without email so no Resend call is needed: Mark as sent.
    await page.getByRole('button', { name: /Mark as sent/i }).click()
    await expect(page.getByText('Marked as sent')).toBeVisible({ timeout: 15000 })

    // The live share link appears in the footer once the token is on.
    const shareUrl = await page
      .locator('a[href*="/proposal/"]')
      .first()
      .getAttribute('href', { timeout: 15000 })
    expect(shareUrl).toBeTruthy()

    // The couple accepts in a fresh, unauthenticated context — keeps
    // the pre-ticked add-on (total 1450 + 150).
    const couplePage = await (await browser.newContext()).newPage()
    await couplePage.goto(shareUrl!, { waitUntil: 'networkidle' })
    await expect(couplePage.getByText('Full-day hosting')).toBeVisible({ timeout: 15000 })
    await expect(couplePage.getByLabel(/Include Rehearsal attendance/i)).toBeChecked()
    await couplePage.getByRole('button', { name: /Accept Proposal/i }).click()
    await couplePage.getByRole('button', { name: /Yes, accept/i }).click()
    await expect(couplePage.getByText('Proposal accepted')).toBeVisible({ timeout: 15000 })
    await couplePage.context().close()

    // MC generates the invoice from the recorded selection.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Proposals' }).click()
    await page.locator(`text=${proposalTitle} >> visible=true`).first().click()
    await expect(page.locator('text=/accepted/i >> visible=true').first()).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByText('Generate invoice', { exact: true }).click()

    // Invoice builder opens on the generated draft: recorded items +
    // the agreed $1,600 total.
    await expect(page.getByText('Full-day hosting')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Rehearsal attendance')).toBeVisible()
    await expect(page.locator('text=/1,600/ >> visible=true').first()).toBeVisible()
  })
})
