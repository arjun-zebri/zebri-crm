/**
 * E2E tests for proposal block rendering — verifies that the public proposal
 * page renders decomposed package blocks correctly, handles package selection,
 * add-on toggles, and proposal acceptance.
 *
 * Requires the running app + a seeded multi-package proposal + deployed migration.
 * Deferred: not executed in the authoring session.
 */
import { test, expect } from '@playwright/test'

test.describe('Proposal blocks rendering', () => {
  test.describe.configure({ retries: 1 })

  test('renders multi-package proposal with package header, description, add-ons, and total', async ({ page }) => {
    // NOTE: This test requires a seeded proposal token with multiple packages
    const token = process.env.TEST_PROPOSAL_TOKEN || 'test-token-placeholder'

    await page.goto(`/proposal/${token}`)

    // Should render the package header with the selected package title
    await expect(page.getByRole('heading', { name: /gold package/i })).toBeVisible()

    // Should render the package description
    await expect(page.getByText(/premium service package/i)).toBeVisible()

    // Should render the optional add-ons section with toggles
    await expect(page.getByText(/optional add-ons/i)).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /drone shots/i })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /highlight reel/i })).toBeVisible()

    // Should render the total price
    await expect(page.getByText(/\$5,000/)).toBeVisible()
  })

  test('toggling an add-on updates the total price', async ({ page }) => {
    const token = process.env.TEST_PROPOSAL_TOKEN || 'test-token-placeholder'

    await page.goto(`/proposal/${token}`)

    // Get initial total
    const initialTotal = await page.getByText(/Total.*\$[\d,]+/).first().textContent()

    // Toggle the first add-on
    const droneCheckbox = page.getByRole('checkbox', { name: /drone shots/i })
    await droneCheckbox.click()

    // Total should increase (add-on is now selected)
    await page.waitForTimeout(200) // Allow state to update
    const updatedTotal = await page.getByText(/Total.*\$[\d,]+/).first().textContent()

    expect(updatedTotal).not.toBe(initialTotal)
    // Should now reflect the added amount ($500 for drone shots)
    await expect(page.getByText(/\$5,500/)).toBeVisible()
  })

  test('clicking "See other packages" shows package chooser and switches packages', async ({ page }) => {
    const token = process.env.TEST_PROPOSAL_TOKEN || 'test-token-placeholder'

    await page.goto(`/proposal/${token}`)

    // Should initially show Gold Package
    await expect(page.getByRole('heading', { name: /gold package/i })).toBeVisible()

    // Click the "See other packages" button to open the chooser
    const seeOtherButton = page.getByRole('button', { name: /see other packages/i })
    await seeOtherButton.click()

    // Should show the Silver Package option in the chooser
    const silverOption = page.getByRole('button', { name: /silver package/i })
    await expect(silverOption).toBeVisible()

    // Click Silver Package
    await silverOption.click()

    // Page should now show Silver Package
    await expect(page.getByRole('heading', { name: /silver package/i })).toBeVisible()

    // Header and total should update for Silver Package
    await expect(page.getByText(/standard service package/i)).toBeVisible()
    await expect(page.getByText(/\$3,000/)).toBeVisible()
  })

  test('accepting the proposal shows the accepted state', async ({ page }) => {
    const token = process.env.TEST_PROPOSAL_TOKEN || 'test-token-placeholder'

    await page.goto(`/proposal/${token}`)

    // Should show the package header and accept button
    await expect(page.getByRole('heading', { name: /gold package/i })).toBeVisible()
    const acceptButton = page.getByRole('button', { name: /accept/i }).first()
    await expect(acceptButton).toBeVisible()

    // Click accept
    await acceptButton.click()

    // May show a confirmation dialog; click confirm if present
    const confirmButton = page.getByRole('button', { name: /confirm|accept/i }).last()
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }

    // Should show accepted state banner
    await expect(page.getByText(/accepted/i)).toBeVisible()

    // Accept button should no longer be clickable
    await expect(acceptButton).toBeDisabled()
  })

  test.describe('responsive design', () => {
    test('renders correctly on desktop (1280px)', async ({ page }) => {
      page.setViewportSize({ width: 1280, height: 800 })

      const token = process.env.TEST_PROPOSAL_TOKEN || 'test-token-placeholder'
      await page.goto(`/proposal/${token}`)

      // Should render package blocks with proper spacing
      await expect(page.getByRole('heading', { name: /gold package/i })).toBeVisible()
      await expect(page.getByText(/\$5,000/)).toBeVisible()
    })

    test('renders correctly on Pixel 5 (412px)', async ({ page }) => {
      page.setViewportSize({ width: 412, height: 915 })

      const token = process.env.TEST_PROPOSAL_TOKEN || 'test-token-placeholder'
      await page.goto(`/proposal/${token}`)

      // All elements should be visible and responsive
      await expect(page.getByRole('heading', { name: /gold package/i })).toBeVisible()
      const description = page.getByText(/premium service package/i)
      await expect(description).toBeVisible()

      // Add-on toggle should be accessible on mobile
      const droneCheckbox = page.getByRole('checkbox', { name: /drone shots/i })
      await expect(droneCheckbox).toBeVisible()
    })

    test('renders correctly on iPhone 12 (390px)', async ({ page }) => {
      page.setViewportSize({ width: 390, height: 844 })

      const token = process.env.TEST_PROPOSAL_TOKEN || 'test-token-placeholder'
      await page.goto(`/proposal/${token}`)

      // Package header should be readable
      await expect(page.getByRole('heading', { name: /gold package/i })).toBeVisible()

      // Total should be visible
      await expect(page.getByText(/\$5,000/)).toBeVisible()
    })
  })
})
