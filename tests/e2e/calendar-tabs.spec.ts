/**
 * The `/calendar` tab strip must not become a scroll container.
 *
 * Regression: the tab buttons carried `-mb-px` so the active tab's 2px
 * underline sits on the wrapper's 1px divider. That left each button's border
 * box 1px taller than the strip's content box, and because `overflow-x-auto`
 * makes `overflow-y` compute to `auto` (CSS spec: a non-visible overflow on one
 * axis promotes the other), the stray pixel rendered as a vertical scrollbar
 * beside the tabs. The negative margin now lives on the strip itself.
 */
import { test, expect } from '@playwright/test'

import { login } from './helpers'

test.describe('Calendar tab strip', () => {
  test('does not scroll vertically', async ({ page }) => {
    await login(page)
    await page.goto('/calendar', { waitUntil: 'networkidle' })

    const metrics = await page.evaluate(() => {
      const bar = [...document.querySelectorAll('div')].find(
        (d) => d.className.includes('overflow-x-auto') && d.querySelector('button'),
      )
      if (!bar) return null
      const active = [...bar.querySelectorAll('button')].find((b) =>
        b.className.includes('border-text'),
      )
      return {
        vOverflow: bar.scrollHeight - bar.clientHeight,
        underline: active ? getComputedStyle(active).borderBottomWidth : null,
        // The strip's bottom edge must still land on the wrapper's divider,
        // otherwise the fix has moved the underline off the border it overlays.
        barBottom: Math.round(bar.getBoundingClientRect().bottom),
        wrapperBottom: Math.round(bar.parentElement!.getBoundingClientRect().bottom),
      }
    })

    expect(metrics).not.toBeNull()
    expect(metrics!.vOverflow).toBe(0)
    expect(metrics!.underline).toBe('2px')
    expect(metrics!.barBottom).toBe(metrics!.wrapperBottom)
  })
})
