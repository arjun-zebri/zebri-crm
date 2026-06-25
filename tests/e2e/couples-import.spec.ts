import { test, expect } from '@playwright/test'

import { login, deleteCouple, openImportCouplesModal, search, uniqueName } from './helpers'

test.describe('Couples — CSV import', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/couples', { waitUntil: 'networkidle' })
  })

  test('upload → map → preview → import surfaces the new couple', async ({
    page,
  }) => {
    const valid = uniqueName('CSV Import')
    const csv = [
      'couple_name,primary_name,primary_email,event_date',
      `${valid},Sam,sam@example.com,2026-09-01`,
      // A second row with no couple name — invalid, must be skipped.
      ',Nobody,,2026-09-01',
    ].join('\n')

    await openImportCouplesModal(page)

    // The file input is visually hidden behind the dropzone.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'couples.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })

    // Mapping step: headers auto-map, so Continue is enabled.
    await expect(page.locator('text=Match each Zebri field')).toBeVisible()
    await page.locator('button:has-text("Continue")').click()

    // Preview step: the valid row is selected, the invalid one isn't.
    await expect(page.locator(`text=${valid}`)).toBeVisible()
    await expect(page.locator('text=Missing couple name')).toBeVisible()
    await page.locator('button:has-text("Import 1 couple")').click()
    await page.waitForSelector('h2:has-text("Import couples")', { state: 'hidden' })
    await page.waitForLoadState('networkidle')

    // The imported couple shows up in the list.
    await page.locator('button:has-text("List")').click()
    await search(page, valid)
    await expect(
      page.locator(`table tbody tr:has-text("${valid}")`),
    ).toBeVisible()

    await deleteCouple(page, valid)
  })

  test('lets you map columns when the headers do not match', async ({ page }) => {
    await openImportCouplesModal(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'odd.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Couple,Bride\nSam & Alex,Sam'),
    })
    // Lands on the mapping step with the header toggle available.
    await expect(page.locator('text=Match each Zebri field')).toBeVisible()
    await expect(
      page.locator('text=First row contains column names'),
    ).toBeVisible()
    await expect(page.locator('button:has-text("Continue")')).toBeEnabled()
  })

  test('offers a downloadable template', async ({ page }) => {
    await openImportCouplesModal(page)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Download the template")').click(),
    ])
    expect(download.suggestedFilename()).toBe('couples-template.csv')
  })
})
