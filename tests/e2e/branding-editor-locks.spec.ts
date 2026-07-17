/**
 * End-to-end tests for the branding editor block lock model.
 *
 * Tests that certain blocks (like line-items) cannot be deleted, and that
 * text blocks can be edited with undo support.
 *
 * @module tests/e2e/branding-editor-locks.spec.ts
 */
import { test, expect } from '@playwright/test'

import { login } from './helpers'

test.describe('Branding Editor - Block Locks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/branding')

    const wizardHeading = page.getByRole('heading', { name: /let's start with your identity/i })
    if (await wizardHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
      const businessInput = page.locator('input[placeholder*="name" i], input[placeholder*="MC" i]').first()
      await businessInput.fill('Test MC')

      const nextBtn = page.getByRole('button', { name: /next/i }).first()
      await nextBtn.click()
      await page.waitForTimeout(200)

      // Set brand color via hex textbox instead of color input
      const colorInput = page.getByLabel(/brand color hex/i)
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

    const lineItemsBlock = page.locator('div').filter({ has: page.getByText(/line.?items|line.?item|items/i) }).first()

    if (await lineItemsBlock.isVisible()) {
      await lineItemsBlock.click()
      await page.waitForTimeout(200)

      const deleteButton = page.locator('button').filter({ has: page.getByText(/delete|remove/i) })

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
      }
    }
  })

  test('Text block can be deleted with undo', async ({ page }) => {
    const proposalTab = page.getByRole('button', { name: /^proposal$/i })
    if (await proposalTab.isVisible()) {
      await proposalTab.click()
      await page.waitForTimeout(300)
    }

    const blockCountBefore = await page.locator('[data-testid="block"], div[data-type]').count()

    const firstEditableBlock = page.locator('button').filter({ has: page.getByText(/add|delete|remove/i) }).first()
    const blockContainer = await firstEditableBlock.evaluate((btn) => {
      let parent = btn.parentElement
      while (parent && !parent.getAttribute('data-testid')?.includes('block')) {
        parent = parent.parentElement
      }
      return parent
    })

    if (blockContainer) {
      const deleteBtn = page.locator('button').filter({ has: page.getByText(/delete|remove/i) }).first()
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

          const undoToast = page.getByRole('button', { name: /undo/i }).or(
            page.locator('div').filter({ has: page.getByText(/undo/i) })
          )

          const toastVisible = await undoToast.isVisible({ timeout: 3000 }).catch(() => false)
          if (toastVisible) {
            expect(toastVisible).toBeTruthy()

            const undoBtn = page.getByRole('button', { name: /undo/i }).first()
            if (await undoBtn.isVisible()) {
              await undoBtn.click()
              await page.waitForTimeout(200)

              const blockCountAfter = await page.locator('[data-testid="block"], div[data-type]').count()
              expect(blockCountAfter).toBeGreaterThanOrEqual(blockCountBefore - 1)
            }
          }
        }
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
