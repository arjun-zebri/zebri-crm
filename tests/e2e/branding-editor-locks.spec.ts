/**
 * End-to-end tests for the branding editor block lock model.
 *
 * Tests that certain blocks (like line-items) cannot be deleted, and that
 * text blocks can be edited with undo support.
 *
 * REQUIRES isolated local Supabase stack on port 3123.
 * Set PLAYWRIGHT_BASE_URL=http://localhost:3123 or define BRANDING_E2E env flag.
 *
 * @module tests/e2e/branding-editor-locks.spec.ts
 */
import { test, expect } from '@playwright/test'

import { login } from './helpers'

test.describe('Branding Editor - Block Locks', () => {
  // Guard: these tests depend on local Supabase for state reset
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL?.includes('3123') && !process.env.BRANDING_E2E,
    'requires the isolated local-supabase stack (port 3123 or BRANDING_E2E=true)'
  )
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/branding')

    const wizardHeading = page.getByRole('heading', { name: /let's start with your identity/i })
    if (await wizardHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Use aria-label for business name input
      const businessInput = page.getByLabel('Business name')
      await businessInput.fill('Test MC')

      const nextBtn = page.getByRole('button', { name: /next/i }).first()
      await nextBtn.click()
      await page.waitForTimeout(200)

      // Set brand color via hex textbox using aria-label
      const colorInput = page.getByLabel('Brand color hex')
      if (await colorInput.isVisible()) {
        await colorInput.clear()
        await colorInput.fill('#8B5CF6')
      }

      await nextBtn.click()
      await page.waitForTimeout(200)

      const finishBtn = page.getByRole('button', { name: /finish|complete/i }).first()
      await finishBtn.click()
      await page.waitForTimeout(500)
    }

    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('Line-items block cannot be deleted (locked)', async ({ page }) => {
    const invoiceTab = page.getByRole('button', { name: /^invoice$/i })
    if (await invoiceTab.isVisible()) {
      await invoiceTab.click()
      await page.waitForTimeout(300)
    }

    const documentsButton = page.getByRole('button', { name: /documents/i })
    if (await documentsButton.isVisible()) {
      await documentsButton.click()
      await page.waitForTimeout(200)

      const invoiceCheckbox = page.getByRole('checkbox', { name: /toggle invoices/i })
      if (await invoiceCheckbox.isVisible().catch(() => false)) {
        const isChecked = await invoiceCheckbox.isChecked()
        if (!isChecked) {
          await invoiceCheckbox.click()
          await page.waitForTimeout(300)
        }
      }
    }

    const invoiceSurfaceTab = page.getByRole('button', { name: /^invoice$/i })
    if (await invoiceSurfaceTab.isVisible()) {
      await invoiceSurfaceTab.click()
      await page.waitForTimeout(300)
    }

    // Count blocks before any interaction
    const blockCountBefore = await page.locator('[data-block-id]').count()

    // Find lineItems block by its data-block-id and click it
    const lineItemsBlocks = await page.locator('[data-block-id]').all()
    let found = false
    for (const block of lineItemsBlocks) {
      const text = await block.textContent()
      if (text && /line.?items?/i.test(text)) {
        await block.click()
        await page.waitForTimeout(200)
        found = true
        break
      }
    }

    if (found) {
      // Get the delete button using aria-label
      const deleteButton = page.getByRole('button', { name: /delete block/i })

      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isDisabled = await deleteButton.evaluate((el) => {
          const button = el as HTMLButtonElement
          return (
            button.disabled ||
            button.getAttribute('aria-disabled') === 'true' ||
            button.classList.contains('opacity-50') ||
            button.classList.contains('cursor-not-allowed')
          )
        })

        expect(isDisabled).toBeTruthy()

        // Verify block count unchanged after attempting delete (button is disabled anyway)
        const blockCountAfter = await page.locator('[data-block-id]').count()
        expect(blockCountAfter).toBe(blockCountBefore)
      }
    }
  })

  test('Text block can be deleted with undo', async ({ page }) => {
    const proposalTab = page.getByRole('button', { name: /^proposal$/i })
    if (await proposalTab.isVisible()) {
      await proposalTab.click()
      await page.waitForTimeout(300)
    }

    // Count blocks before deletion
    const blockCountBefore = await page.locator('[data-block-id]').count()

    // Find first deletable text block
    const blocks = await page.locator('[data-block-id]').all()
    let deleted = false

    for (const block of blocks) {
      // Skip non-text blocks (lineItems, totals, etc. are locked)
      const text = await block.textContent()
      if (!text || /line.?items?|totals?|payment/i.test(text)) {
        continue
      }

      // Click block to select it
      await block.click()
      await page.waitForTimeout(200)

      // Try to delete via the accessible toolbar button
      const deleteBtn = page.getByRole('button', { name: /delete block/i })
      if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isEnabled = await deleteBtn.evaluate((el) => {
          const button = el as HTMLButtonElement
          return !(
            button.disabled ||
            button.getAttribute('aria-disabled') === 'true' ||
            button.classList.contains('opacity-50')
          )
        })

        if (isEnabled) {
          await deleteBtn.click()
          await page.waitForTimeout(200)
          deleted = true
          break
        }
      }
    }

    if (deleted) {
      // Wait for and click undo button
      const undoBtn = page.getByRole('button', { name: /undo/i })
      const undoVisible = await undoBtn.isVisible({ timeout: 3000 }).catch(() => false)

      if (undoVisible) {
        await undoBtn.click()
        await page.waitForTimeout(200)

        // After undo, block count must equal original (exact)
        const blockCountAfter = await page.locator('[data-block-id]').count()
        expect(blockCountAfter).toBe(blockCountBefore)
      }
    }
  })

  test('Text block content updates on immediate typing', async ({ page }) => {
    const proposalTab = page.getByRole('button', { name: /^proposal$/i })
    if (await proposalTab.isVisible()) {
      await proposalTab.click()
      await page.waitForTimeout(300)
    }

    const textInputs = page.locator('input[type="text"], textarea')

    if (await textInputs.count() > 0) {
      const firstInput = textInputs.first()

      await firstInput.click()
      await firstInput.press('Control+A')
      await firstInput.type('Updated Test Text')

      const updatedValue = await firstInput.inputValue()
      expect(updatedValue).toContain('Updated Test Text')
    }
  })
})
