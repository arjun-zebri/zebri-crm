import { test, expect, type Page } from '@playwright/test'

import { addCouple, deleteCouple, login, navigateToProfileTab, openCoupleProfile, uniqueName } from './helpers'

/**
 * Couple profile, Scripts tab: a bilingual celebrant writes a ceremony
 * script with diacritics and CJK text, it survives a reload with the caret
 * left alone, fonts, lists and undo/redo behave, and Print shows it in the
 * script's fonts.
 */
const COUPLE_PREFIX = 'Scripts Test'
const UNICODE_LINE = 'Do you, Nguyễn Thị Ánh, take Đặng Văn Minh 阮氏映 Ελένη'

async function openScriptsTab(page: Page) {
  await navigateToProfileTab(page, 'Scripts')
  await expect(page.getByRole('heading', { name: 'Scripts' })).toBeVisible()
}

test.describe('Couple Scripts', () => {
  let coupleName: string

  test.beforeEach(async ({ page }) => {
    await login(page)
    coupleName = uniqueName(COUPLE_PREFIX)
    await page.goto('/couples', { waitUntil: 'networkidle' })
    await addCouple(page, { name: coupleName, email: 'scripts@test.com' })
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

  test('shows the empty state before any script exists', async ({ page }) => {
    await openScriptsTab(page)
    await expect(page.getByText('No scripts yet')).toBeVisible()
  })

  test('writes a Unicode script that survives autosave and reload, with working lists, redo and print', async ({ page, context }) => {
    await openScriptsTab(page)
    await page.getByRole('button', { name: 'New script' }).click()

    const editor = page.locator('.script-document .ProseMirror')
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.click()
    await page.keyboard.type(UNICODE_LINE)
    const saved = page.locator('[data-save-status="saved"]')
    await expect(saved).toBeAttached({ timeout: 10000 })

    // Autosave must not reset the editor: keep typing after the save landed
    // and the new text lands at the caret, in the same paragraph.
    await page.keyboard.type(' Дмитрий')
    await expect(editor.locator('p').first()).toHaveText(`${UNICODE_LINE} Дмитрий`)

    // Picking a font from the toolbar select keeps the caret in the editor
    // (what is typed next lands in the document, in that face) and is a real
    // history step, so Undo takes it back and Redo restores it.
    await page.keyboard.press('Enter')
    await page.getByRole('combobox', { name: 'Font' }).click()
    await page.getByRole('option', { name: 'Lora' }).click()
    // The caret is back in the editor once the menu has closed (the select
    // does not restore focus to its trigger), so typing lands in the document.
    await expect(editor).toBeFocused()
    await page.keyboard.type('Vows')
    const inFace = (face: string) => editor.locator(`p:has(span[style*="${face}"])`)
    await expect(inFace('Lora')).toHaveText('Vows')
    await expect(page.getByRole('combobox', { name: 'Font' })).toHaveText('Lora')
    // Select exactly "Vows" (Shift+Home would run back to the document
    // start on macOS). Let ProseMirror's history close the typing group
    // (newGroupDelay is 500 ms) so the font change is its own undo step.
    await page.waitForTimeout(700)
    for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft')
    await page.getByRole('combobox', { name: 'Font' }).click()
    await page.getByRole('option', { name: 'Inter' }).click()
    await expect(editor).toBeFocused()
    await expect(inFace('Inter')).toHaveText('Vows')
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(inFace('Inter')).toHaveCount(0)
    await expect(inFace('Lora')).toHaveText('Vows')
    await page.getByRole('button', { name: 'Redo' }).click()
    await expect(inFace('Inter')).toHaveText('Vows')
    await page.keyboard.press('End')

    // The colour pickers open (their triggers are wrapped in tooltips).
    // The colour picker opens (a second dialog over the script modal) and
    // Esc closes only the picker, not the script.
    await page.getByRole('button', { name: 'Highlight', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(2)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await editor.click()
    await page.keyboard.press('End')

    // A numbered list keeps numbering across Enter; a bullet list adds a bullet.
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Numbered list' }).click()
    await page.keyboard.type('First')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Second')
    await expect(editor.locator('ol > li')).toHaveCount(2)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Bullet list' }).click()
    await page.keyboard.type('Rings')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Kiss')
    await expect(editor.locator('ul > li')).toHaveCount(2)

    // Undo takes the last bullet away (history groups the Enter with the
    // typing); redo brings it back. Redo used to be dead: every autosave
    // pushed a "new" document into the editor and cleared the redo stack.
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(editor).not.toContainText('Kiss')
    await page.getByRole('button', { name: 'Redo' }).click()
    await expect(editor).toContainText('Kiss')
    await expect(editor.locator('ul > li')).toHaveCount(2)

    const title = page.getByRole('textbox', { name: 'Script title' })
    await title.fill('Ceremony')
    await title.press('Enter')
    // Esc closes the script modal (not the profile behind it); the list shows
    // the new title before reloading, so the rename has definitely landed.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByRole('button', { name: /Ceremony/ })).toBeVisible({ timeout: 10000 })

    await page.reload({ waitUntil: 'networkidle' })
    await openCoupleProfile(page, coupleName)
    await openScriptsTab(page)
    await page.getByRole('button', { name: /Ceremony/ }).click()
    await expect(page.locator('.script-document .ProseMirror')).toContainText(UNICODE_LINE, { timeout: 10000 })
    await expect(page.locator('.script-document .ProseMirror ol > li')).toHaveCount(2)

    // Print opens a window whose body carries the script in its own fonts.
    const [printWindow] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Print' }).click(),
    ])
    await printWindow.waitForLoadState('domcontentloaded')
    await expect(printWindow.locator('.script-document')).toContainText(UNICODE_LINE)
    await printWindow.close()
  })
})
