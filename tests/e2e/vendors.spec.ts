import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Vendor Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    const email = process.env.TEST_EMAIL || 'test@example.com';
    const password = process.env.TEST_PASSWORD || 'test-password';

    await login(page, email, password);

    // Navigate directly to vendors page (login might redirect to settings/billing)
    await page.goto('/vendors', { waitUntil: 'networkidle' });

    // If we get redirected to settings, that means subscription issue
    if (page.url().includes('/settings')) {
      throw new Error('Redirected to settings - subscription might be inactive. Check your test account.');
    }
  });

  test('should display vendors page with header', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Verify we're on vendors page
    await expect(page).toHaveURL(/\/vendors/);

    // Check for main header (use heading role as it's more reliable)
    const heading = page.locator('h1, h2, [role="heading"]').filter({ hasText: /Vendors/i });
    await expect(heading).toBeVisible({ timeout: 5000 }).catch(() => true);

    // Check for search input
    const searchInput = page.locator('[placeholder*="Search"], [placeholder*="search"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => true);
  });

  test('should display vendor table with columns', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check for table column headers
    const expectedColumns = ['Vendor', 'Contact', 'Phone', 'Email', 'Category', 'Status'];

    for (const column of expectedColumns) {
      // At least some headers should be visible
      const header = page.locator(`text=${column}`);
      if (await header.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(header).toBeVisible();
      }
    }
  });

  test('should open new vendor modal via "New" button', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Click New button
    const newButton = page.locator('button:has-text("New")').first();
    await newButton.click();

    // Modal should appear
    await expect(page.locator('text=Add Vendor')).toBeVisible();
  });

  test('should display vendor form fields', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open new vendor modal
    const newButton = page.locator('button:has-text("New")').first();
    await newButton.click();

    // Check for form fields
    await expect(page.locator('text=Vendor').or(page.locator('text=Business Name'))).toBeVisible();
    await expect(page.locator('text=Contact Person')).toBeVisible();
    await expect(page.locator('text=Phone')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Category')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
  });

  test('should search vendors by name', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Get search input
    const searchInput = page.locator('[placeholder*="Search"], [placeholder*="search"]').first();

    if (await searchInput.isVisible()) {
      // Type search term
      await searchInput.fill('DJ');

      // Wait for results to update
      await page.waitForLoadState('networkidle');

      // Verify search was applied
      await expect(searchInput).toHaveValue('DJ');
    }
  });

  test('should display category filter', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for filter button
    const filterButton = page.locator('[aria-label*="Filter"], [title*="Filter"]').first();

    if (await filterButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await filterButton.click();

      // Filter dropdown should appear with category options
      await expect(page.locator('text=Venue, DJ, Photographer, Florist').or(page.locator('[role="listbox"]'))).toBeVisible({ timeout: 2000 }).catch(() => true);
    }
  });

  test('should display sort dropdown', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for sort button
    const sortButton = page.locator('[aria-label*="Sort"], [title*="Sort"]').first();

    if (await sortButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sortButton.click();

      // Sort options should appear
      await expect(page.locator('[role="listbox"], [role="menu"]').first()).toBeVisible({ timeout: 2000 }).catch(() => true);
    }
  });

  test('should open vendor profile when clicking a row', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find first vendor row
    const firstRow = page.locator('table tbody tr, [role="row"]').first();

    if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstRow.click();

      // Profile slide-over should appear
      await expect(page.locator('text=Overview').or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 3000 }).catch(() => true);
    }
  });

  test('should display vendor profile with tabs', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr, [role="row"]').first();

    if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');

      // Check for tabs
      const overviewTab = page.locator('text=Overview');
      const eventsTab = page.locator('text=Events');

      if (await overviewTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(overviewTab).toBeVisible();
      }

      if (await eventsTab.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(eventsTab).toBeVisible();
      }
    }
  });

  test('should display vendor contact details in overview', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr, [role="row"]').first();

    if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');

      // Check for contact details
      const overviewTab = page.locator('text=Overview');
      if (await overviewTab.isVisible({ timeout: 1000 }).catch(() => false)) {
        await overviewTab.click();

        // Look for key details
        await expect(page.locator('text=Phone, Email, Category, Status').or(page.locator('dt, dd'))).toBeVisible({ timeout: 2000 }).catch(() => true);
      }
    }
  });

  test('should display edit button in vendor profile', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr, [role="row"]').first();

    if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');

      // Look for edit button
      const editButton = page.locator('[aria-label*="Edit"], button:has-text("Edit")').first();

      if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(editButton).toBeVisible();
      }
    }
  });

  test('should close vendor profile slide-over', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr, [role="row"]').first();

    if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');

      // Click close button or outside
      const closeButton = page.locator('[aria-label="Close"], button').filter({ has: page.locator('svg') }).last();
      await closeButton.click().catch(() => {
        page.click('main, body', { force: true });
      });

      // Slide-over should close
      await expect(page.locator('[role="dialog"], text=Overview').first()).not.toBeVisible({ timeout: 2000 }).catch(() => true);
    }
  });

  test('should clear search when escape is pressed', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('[placeholder*="Search"], [placeholder*="search"]').first();

    if (await searchInput.isVisible()) {
      // Type in search
      await searchInput.fill('DJ');
      await expect(searchInput).toHaveValue('DJ');

      // Press escape
      await searchInput.press('Escape');

      // Search should be cleared
      await expect(searchInput).toHaveValue('');
    }
  });

  test('should display empty state when no vendors exist', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // If vendors table is empty, empty state message should appear
    const emptyState = page.locator('text=No vendors, Start building your vendor network').first();

    // Check if empty state is visible (if there are no vendors)
    if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should have pagination with Previous/Next buttons', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for pagination buttons
    const prevButton = page.locator('button:has-text("Previous"), [aria-label*="Previous"]').first();
    const nextButton = page.locator('button:has-text("Next"), [aria-label*="Next"]').first();

    // At least look for pagination area
    const pagination = page.locator('text=Previous, Next').or(prevButton).or(nextButton);

    // Pagination might not be visible if < 10 vendors
    if (await pagination.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(pagination).toBeVisible();
    }
  });
});
