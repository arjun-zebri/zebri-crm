/**
 * End-to-end tests for the branding editor readiness flag.
 *
 * Verifies that deleting required blocks triggers the "Not ready to send" panel
 * with appropriate issue messages, and that re-adding the block clears the flag.
 *
 * Tests deletion and re-addition of Package totals (proposal surface) and
 * Bank details + Pay CTA (invoice surface).
 *
 * Requires the running app + deployed migration. Deferred: not executed in the authoring session.
 *
 * @module tests/e2e/branding-readiness.spec.ts
 */
import { test, expect } from '@playwright/test'

import { login } from './helpers'

test.describe('Branding Editor - Readiness Flag', () => {
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

  test.describe('Proposal surface - Package totals block', () => {
    test('deleting Package totals shows "Not ready to send" panel with issue message (desktop)', async ({ page }) => {
      page.setViewportSize({ width: 1280, height: 800 })

      const proposalTab = page.getByRole('button', { name: /^proposal$/i })
      if (await proposalTab.isVisible()) {
        await proposalTab.click()
        await page.waitForTimeout(300)
      }

      // Find and click the Package totals block
      const blocks = await page.locator('[data-block-id]').all()
      let blockFound = false

      for (const block of blocks) {
        const text = await block.textContent()
        if (text && /package\s+totals?/i.test(text)) {
          await block.click()
          await page.waitForTimeout(200)
          blockFound = true
          break
        }
      }

      expect(blockFound).toBeTruthy()

      // Delete the block
      const deleteBtn = page.getByRole('button', { name: /delete block/i })
      await expect(deleteBtn).toBeVisible({ timeout: 2000 })
      await deleteBtn.click()
      await page.waitForTimeout(300)

      // Assert the "Not ready to send" panel appears with Package totals message
      const panel = page.getByRole('heading', { name: 'Not ready to send' })
      await expect(panel).toBeVisible()

      // Check for the issue message mentioning Package totals
      const issueMessage = page.getByText(/package\s+totals?/i)
      await expect(issueMessage).toBeVisible()
    })

    test('deleting Package totals shows flag on Pixel 5', async ({ page }) => {
      page.setViewportSize({ width: 412, height: 915 })

      const proposalTab = page.getByRole('button', { name: /^proposal$/i })
      if (await proposalTab.isVisible()) {
        await proposalTab.click()
        await page.waitForTimeout(300)
      }

      // Find and click the Package totals block
      const blocks = await page.locator('[data-block-id]').all()
      for (const block of blocks) {
        const text = await block.textContent()
        if (text && /package\s+totals?/i.test(text)) {
          await block.click()
          await page.waitForTimeout(200)
          break
        }
      }

      // Delete the block
      const deleteBtn = page.getByRole('button', { name: /delete block/i })
      await expect(deleteBtn).toBeVisible({ timeout: 2000 })
      await deleteBtn.click()
      await page.waitForTimeout(300)

      // Assert the panel is visible on mobile
      const panel = page.getByRole('heading', { name: 'Not ready to send' })
      await expect(panel).toBeVisible()
    })

    test('deleting Package totals shows flag on iPhone 12', async ({ page }) => {
      page.setViewportSize({ width: 390, height: 844 })

      const proposalTab = page.getByRole('button', { name: /^proposal$/i })
      if (await proposalTab.isVisible()) {
        await proposalTab.click()
        await page.waitForTimeout(300)
      }

      // Find and click the Package totals block
      const blocks = await page.locator('[data-block-id]').all()
      for (const block of blocks) {
        const text = await block.textContent()
        if (text && /package\s+totals?/i.test(text)) {
          await block.click()
          await page.waitForTimeout(200)
          break
        }
      }

      // Delete the block
      const deleteBtn = page.getByRole('button', { name: /delete block/i })
      await expect(deleteBtn).toBeVisible({ timeout: 2000 })
      await deleteBtn.click()
      await page.waitForTimeout(300)

      // Assert the panel is visible on iPhone
      const panel = page.getByRole('heading', { name: 'Not ready to send' })
      await expect(panel).toBeVisible()
    })

    test('re-adding Package totals from palette clears the "Not ready to send" flag (desktop)', async ({ page }) => {
      page.setViewportSize({ width: 1280, height: 800 })

      const proposalTab = page.getByRole('button', { name: /^proposal$/i })
      if (await proposalTab.isVisible()) {
        await proposalTab.click()
        await page.waitForTimeout(300)
      }

      // Find and click the Package totals block
      const blocks = await page.locator('[data-block-id]').all()
      let blockFound = false

      for (const block of blocks) {
        const text = await block.textContent()
        if (text && /package\s+totals?/i.test(text)) {
          await block.click()
          await page.waitForTimeout(200)
          blockFound = true
          break
        }
      }

      expect(blockFound).toBeTruthy()

      // Delete the block
      const deleteBtn = page.getByRole('button', { name: /delete block/i })
      await expect(deleteBtn).toBeVisible({ timeout: 2000 })
      await deleteBtn.click()
      await page.waitForTimeout(300)

      // Verify the panel appears
      const panel = page.getByRole('heading', { name: 'Not ready to send' })
      await expect(panel).toBeVisible()

      // Re-add the block from the palette
      const addBlockBtn = page.getByRole('button', { name: /add block|blocks?/i }).first()
      if (await addBlockBtn.isVisible()) {
        await addBlockBtn.click()
        await page.waitForTimeout(200)
      }

      // Find Package totals in the palette and click it
      const paletteItems = page.locator('[data-testid="palette-item"], button').filter({ has: page.getByText(/package\s+totals?/i) })
      if (await paletteItems.first().isVisible()) {
        await paletteItems.first().click()
        await page.waitForTimeout(300)
      }

      // Assert the "Not ready to send" panel is gone
      await expect(panel).not.toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('Invoice surface - Required blocks flag', () => {
    test('deleting Bank details and Pay CTA shows "at-least-one" message (desktop)', async ({ page }) => {
      page.setViewportSize({ width: 1280, height: 800 })

      const invoiceTab = page.getByRole('button', { name: /^invoice$/i })
      if (await invoiceTab.isVisible()) {
        await invoiceTab.click()
        await page.waitForTimeout(300)
      }

      // Toggle invoices in documents if needed
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

        await documentsButton.click()
        await page.waitForTimeout(200)
      }

      // Ensure we are on the invoice surface tab
      const invoiceSurfaceTab = page.getByRole('button', { name: /^invoice$/i })
      if (await invoiceSurfaceTab.isVisible()) {
        await invoiceSurfaceTab.click()
        await page.waitForTimeout(300)
      }

      // Find and delete Bank details block
      let blocks = await page.locator('[data-block-id]').all()
      for (const block of blocks) {
        const text = await block.textContent()
        if (text && /bank\s+details?/i.test(text)) {
          await block.click()
          await page.waitForTimeout(200)

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
              await page.waitForTimeout(300)
            }
          }
          break
        }
      }

      // Find and delete Pay CTA (action) block
      blocks = await page.locator('[data-block-id]').all()
      for (const block of blocks) {
        const text = await block.textContent()
        if (text && (/pay\s+cta|action/i.test(text) || /pay|cta/i.test(text))) {
          await block.click()
          await page.waitForTimeout(200)

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
              await page.waitForTimeout(300)
            }
          }
          break
        }
      }

      // Assert the "Not ready to send" panel appears
      const panel = page.getByRole('heading', { name: 'Not ready to send' })
      await expect(panel).toBeVisible()

      // Check for an issue message that mentions "at least one"
      const issueMessage = page.getByText(/at\s+least\s+one/i)
      await expect(issueMessage).toBeVisible()
    })

    test('deleting Bank details and Pay CTA shows flag on Pixel 5', async ({ page }) => {
      page.setViewportSize({ width: 412, height: 915 })

      const invoiceTab = page.getByRole('button', { name: /^invoice$/i })
      if (await invoiceTab.isVisible()) {
        await invoiceTab.click()
        await page.waitForTimeout(300)
      }

      // Toggle invoices if needed
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

        await documentsButton.click()
        await page.waitForTimeout(200)
      }

      // Ensure we are on the invoice surface tab
      const invoiceSurfaceTab = page.getByRole('button', { name: /^invoice$/i })
      if (await invoiceSurfaceTab.isVisible()) {
        await invoiceSurfaceTab.click()
        await page.waitForTimeout(300)
      }

      // Find and delete Bank details
      let blocks = await page.locator('[data-block-id]').all()
      for (const block of blocks) {
        const text = await block.textContent()
        if (text && /bank\s+details?/i.test(text)) {
          await block.click()
          await page.waitForTimeout(200)

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
              await page.waitForTimeout(300)
            }
          }
          break
        }
      }

      // Find and delete Pay CTA
      blocks = await page.locator('[data-block-id]').all()
      for (const block of blocks) {
        const text = await block.textContent()
        if (text && (/pay\s+cta|action/i.test(text) || /pay|cta/i.test(text))) {
          await block.click()
          await page.waitForTimeout(200)

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
              await page.waitForTimeout(300)
            }
          }
          break
        }
      }

      // Assert panel is visible on mobile
      const panel = page.getByRole('heading', { name: 'Not ready to send' })
      await expect(panel).toBeVisible()
    })

    test('deleting Bank details and Pay CTA shows flag on iPhone 12', async ({ page }) => {
      page.setViewportSize({ width: 390, height: 844 })

      const invoiceTab = page.getByRole('button', { name: /^invoice$/i })
      if (await invoiceTab.isVisible()) {
        await invoiceTab.click()
        await page.waitForTimeout(300)
      }

      // Toggle invoices if needed
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

        await documentsButton.click()
        await page.waitForTimeout(200)
      }

      // Ensure we are on the invoice surface tab
      const invoiceSurfaceTab = page.getByRole('button', { name: /^invoice$/i })
      if (await invoiceSurfaceTab.isVisible()) {
        await invoiceSurfaceTab.click()
        await page.waitForTimeout(300)
      }

      // Find and delete Bank details
      let blocks = await page.locator('[data-block-id]').all()
      for (const block of blocks) {
        const text = await block.textContent()
        if (text && /bank\s+details?/i.test(text)) {
          await block.click()
          await page.waitForTimeout(200)

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
              await page.waitForTimeout(300)
            }
          }
          break
        }
      }

      // Find and delete Pay CTA
      blocks = await page.locator('[data-block-id]').all()
      for (const block of blocks) {
        const text = await block.textContent()
        if (text && (/pay\s+cta|action/i.test(text) || /pay|cta/i.test(text))) {
          await block.click()
          await page.waitForTimeout(200)

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
              await page.waitForTimeout(300)
            }
          }
          break
        }
      }

      // Assert panel is visible on iPhone
      const panel = page.getByRole('heading', { name: 'Not ready to send' })
      await expect(panel).toBeVisible()
    })
  })
})
