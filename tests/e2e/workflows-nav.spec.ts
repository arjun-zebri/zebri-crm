import { test, expect } from '@playwright/test'

import { login, openSidebar } from './helpers'

/**
 * The cutover as a user sees it: one Workflows item in the sidebar where
 * Tasks and Automations used to sit, and every retired URL landing
 * somewhere useful instead of 404ing. Real MCs have all three in their
 * bookmarks and browser history.
 */
test.describe('Workflows navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('the sidebar shows Workflows and neither retired item', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const nav = page.getByRole('navigation').first()
    await expect(nav.getByRole('link', { name: 'Workflows' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Tasks' })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Automations' })).toHaveCount(0)
  })

  test('the sidebar Workflows link opens the queue', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await openSidebar(page)
    await page.getByRole('navigation').first().getByRole('link', { name: 'Workflows' }).click()
    await page.waitForURL(/\/workflows/)
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()
    // Upcoming is the default: it is the MC's daily view.
    await expect(page.getByRole('tab', { name: 'Upcoming' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('/tasks lands on the queue', async ({ page }) => {
    await page.goto('/tasks', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/workflows/)
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()
  })

  test('/automations lands on the template library', async ({ page }) => {
    await page.goto('/automations', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/workflows\?tab=templates/)
    await expect(page.getByRole('tab', { name: 'Workflows' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('an old automation canvas URL lands on the library rather than 404ing', async ({ page }) => {
    // The old id cannot be mapped to its converted template from the URL
    // alone, so the library is the honest destination.
    await page.goto('/automations/00000000-0000-0000-0000-000000000000', {
      waitUntil: 'networkidle',
    })
    await expect(page).toHaveURL(/\/workflows\?tab=templates/)
  })
})
