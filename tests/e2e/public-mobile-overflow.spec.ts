/**
 * End-to-end tests for mobile overflow on public branding preview pages.
 *
 * Verifies that the branding preview surfaces do not have horizontal
 * scroll overflow on mobile and desktop viewports.
 *
 * @module tests/e2e/public-mobile-overflow.spec.ts
 */
import { test, expect } from '@playwright/test'

test.describe('Public Branding Preview - Overflow', () => {
  test('Proposal preview has no horizontal overflow', async ({ page }) => {
    await page.goto('/branding/preview/proposal')
    await page.waitForLoadState('networkidle')

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })

  test('Invoice preview has no horizontal overflow', async ({ page }) => {
    await page.goto('/branding/preview/invoice')
    await page.waitForLoadState('networkidle')

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })

  test('Contract preview has no horizontal overflow', async ({ page }) => {
    await page.goto('/branding/preview/contract')
    await page.waitForLoadState('networkidle')

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })

  test('Portal preview has no horizontal overflow', async ({ page }) => {
    await page.goto('/branding/preview/portal')
    await page.waitForLoadState('networkidle')

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })

  test('Questionnaire preview has no horizontal overflow', async ({ page }) => {
    await page.goto('/branding/preview/questionnaire')
    await page.waitForLoadState('networkidle')

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })
})
