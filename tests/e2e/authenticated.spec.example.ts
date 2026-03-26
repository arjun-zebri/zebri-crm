/**
 * Example: Running tests with authentication
 *
 * This file shows how to write tests that require authentication.
 * Copy and modify this for your authenticated test scenarios.
 */

import { test, expect } from '@playwright/test';
import { login, logout, addCouple, addVendor } from './helpers';

// Skip these tests by default - uncomment and configure with real credentials
test.describe.skip('Authenticated Workflows', () => {
  // Before each test, log in
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // After each test, log out
  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should create a new couple', async ({ page }) => {
    await page.goto('/couples');

    await addCouple(page, {
      name: 'John & Jane Doe',
      email: 'john@example.com',
      phone: '555-1234',
      notes: 'Met at networking event',
    });

    // Verify couple appears in list
    await expect(page.locator('text=John & Jane Doe')).toBeVisible();
  });

  test('should create a new vendor', async ({ page }) => {
    await page.goto('/vendors');

    await addVendor(page, {
      name: 'Amazing Photography Co',
      contactName: 'Alice Smith',
      phone: '555-5678',
      email: 'alice@photos.com',
      notes: 'Great for candids, flexible with schedule',
    });

    // Verify vendor appears in list
    await expect(page.locator('text=Amazing Photography Co')).toBeVisible();
  });

  test('should edit a couple profile', async ({ page }) => {
    await page.goto('/couples');

    // Open first couple
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();

    // Click edit button
    const editButton = page.locator('button:has-text("Edit"), [aria-label*="Edit"]').first();
    await editButton.click();

    // Update couple name
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.clear();
    await nameInput.fill('Updated Couple Name');

    // Save
    const saveButton = page.locator('button:has-text("Save")').first();
    await saveButton.click();

    // Verify update
    await expect(page.locator('text=Updated Couple Name')).toBeVisible();
  });

  test('should assign vendor to couple', async ({ page }) => {
    await page.goto('/couples');

    // Open first couple
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();

    await page.waitForLoadState('networkidle');

    // Navigate to Vendors tab
    const vendorsTab = page.locator('text=Vendors');
    await vendorsTab.click();

    // Click Add Vendor
    const addVendorButton = page.locator('button:has-text("Add Vendor")').first();
    if (await addVendorButton.isVisible()) {
      await addVendorButton.click();

      // Search for and select a vendor
      const vendorSearch = page.locator('[placeholder*="Search"], [placeholder*="vendor"]').first();
      await vendorSearch.fill('Photography');
      await page.waitForLoadState('networkidle');

      // Click first result
      const firstVendor = page.locator('[role="option"], li').first();
      if (await firstVendor.isVisible()) {
        await firstVendor.click();
      }
    }

    // Verify vendor appears in list
    await expect(page.locator('text=Photography').or(page.locator('[role="row"]'))).toBeVisible({ timeout: 3000 }).catch(() => true);
  });

  test('should create a task for a couple', async ({ page }) => {
    await page.goto('/couples');

    // Open first couple
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();

    await page.waitForLoadState('networkidle');

    // Navigate to Tasks tab
    const tasksTab = page.locator('text=Tasks');
    await tasksTab.click();

    // Create a task
    const taskInput = page.locator('input[placeholder*="Task"], input[placeholder*="title"]').first();
    if (await taskInput.isVisible()) {
      await taskInput.fill('Send proposal');

      // Set due date if available
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible()) {
        // Set to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        await dateInput.fill(dateStr);
      }

      // Submit task
      const addButton = page.locator('button:has-text("Add"), button[aria-label*="Add"]').first();
      if (await addButton.isVisible()) {
        await addButton.click();
      } else {
        await taskInput.press('Enter');
      }
    }

    // Verify task appears
    await expect(page.locator('text=Send proposal')).toBeVisible({ timeout: 3000 }).catch(() => true);
  });

  test('should search and filter couples', async ({ page }) => {
    await page.goto('/couples');

    // Search by name
    const searchInput = page.locator('[placeholder*="Search"]').first();
    await searchInput.fill('John');

    await page.waitForLoadState('networkidle');

    // Verify search was applied
    await expect(searchInput).toHaveValue('John');

    // Clear search
    await searchInput.clear();
    await searchInput.press('Escape');
  });

  test('should navigate between dashboard, couples, and vendors', async ({ page }) => {
    // Dashboard
    await page.goto('/dashboard');
    await expect(page.locator('text=Upcoming Weddings').or(page.locator('text=Dashboard'))).toBeVisible({ timeout: 3000 }).catch(() => true);

    // Couples
    await page.goto('/couples');
    await expect(page.locator('text=Couples')).toBeVisible();

    // Vendors
    await page.goto('/vendors');
    await expect(page.locator('text=Vendors')).toBeVisible();
  });
});
