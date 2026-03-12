import { Page, expect } from '@playwright/test';

/**
 * Helper functions for E2E tests
 */

/**
 * Login to the application
 *
 * Note: This uses fill() and then triggers change events because
 * the login form uses React controlled inputs that need state updates.
 */
export async function login(page: Page, email: string, password: string) {
  // Go to login and wait for page to be fully ready
  await page.goto('/login', { waitUntil: 'networkidle' });

  // Wait explicitly for both inputs to be ready
  const emailInput = page.locator('input[id="email"]');
  const passwordInput = page.locator('input[id="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });

  // Fill email and trigger change event
  await emailInput.fill(email);
  await emailInput.dispatchEvent('change');

  // Fill password and trigger change event
  await passwordInput.fill(password);
  await passwordInput.dispatchEvent('change');

  // Wait a bit for React state to settle
  await page.waitForTimeout(500);

  // Click submit button
  await submitButton.click();

  // Wait for navigation - could go to dashboard, settings (billing), or error
  // Use a longer timeout and broader URL pattern
  let navigationSucceeded = false;
  try {
    await Promise.race([
      page.waitForURL(/\/(|dashboard|couples|vendors|settings|account)/, { timeout: 20000 }),
      page.waitForLoadState('networkidle'),
    ]);
    navigationSucceeded = true;
  } catch (error) {
    // Still on login page - check for errors
    const errorDiv = page.locator('[class*="bg-red"], [class*="error"], [class*="text-red"]').first();
    const errorText = await errorDiv.textContent().catch(() => 'Unknown error');

    if (errorText && errorText.trim()) {
      throw new Error(`Login failed: ${errorText.trim()}`);
    } else {
      throw new Error(`Login failed: Still on login page after submission. Check credentials.`);
    }
  }

  if (!navigationSucceeded) {
    throw new Error('Login did not navigate away from /login');
  }
}

/**
 * Logout from the application
 */
export async function logout(page: Page) {
  // Navigate to settings
  await page.goto('/settings');

  // Look for sign out button
  const signOutButton = page.locator('button:has-text("Sign Out"), button:has-text("Log Out"), button:has-text("Sign out")');
  if (await signOutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await signOutButton.click();
  }

  // Wait for redirect to login
  await page.waitForURL('/login');
}

/**
 * Fill and submit a couple form
 */
export async function addCouple(
  page: Page,
  couple: { name: string; email?: string; phone?: string; status?: string; notes?: string }
) {
  // Click New button
  const newButton = page.locator('button:has-text("New")').first();
  await newButton.click();

  // Wait for modal
  await page.waitForLoadState('networkidle');

  // Fill name field (first text input in modal)
  const textInputs = page.locator('input[type="text"]');
  const nameInput = textInputs.first();
  await nameInput.fill(couple.name);

  if (couple.email) {
    // Email field
    const emailInputs = page.locator('input[type="email"]');
    if (await emailInputs.isVisible({ timeout: 1000 }).catch(() => false)) {
      await emailInputs.fill(couple.email);
    }
  }

  if (couple.phone) {
    // Phone field
    const phoneInputs = page.locator('input[type="tel"]');
    if (await phoneInputs.isVisible({ timeout: 1000 }).catch(() => false)) {
      await phoneInputs.fill(couple.phone);
    }
  }

  if (couple.status) {
    // Status select
    const selects = page.locator('select');
    if (await selects.count() > 0) {
      await selects.first().selectOption(couple.status);
    }
  }

  if (couple.notes) {
    // Notes textarea
    const textareas = page.locator('textarea');
    if (await textareas.isVisible({ timeout: 1000 }).catch(() => false)) {
      await textareas.fill(couple.notes);
    }
  }

  // Submit form - look for save button
  const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').last();
  await saveButton.click();

  // Wait for modal to close
  await page.waitForLoadState('networkidle');
}

/**
 * Fill and submit a vendor form
 */
export async function addVendor(
  page: Page,
  vendor: {
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    category?: string;
    status?: string;
    notes?: string;
  }
) {
  // Click New button
  const newButton = page.locator('button:has-text("New")').first();
  await newButton.click();

  // Wait for modal
  await page.waitForLoadState('networkidle');

  // Fill vendor name (first text input)
  const textInputs = page.locator('input[type="text"]');
  await textInputs.first().fill(vendor.name);

  if (vendor.contactName) {
    // Contact name (second text input)
    const contactInput = textInputs.nth(1);
    if (await contactInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await contactInput.fill(vendor.contactName);
    }
  }

  if (vendor.phone) {
    const phoneInputs = page.locator('input[type="tel"]');
    if (await phoneInputs.isVisible({ timeout: 1000 }).catch(() => false)) {
      await phoneInputs.fill(vendor.phone);
    }
  }

  if (vendor.email) {
    const emailInputs = page.locator('input[type="email"]');
    if (await emailInputs.isVisible({ timeout: 1000 }).catch(() => false)) {
      await emailInputs.fill(vendor.email);
    }
  }

  if (vendor.category) {
    // Category select
    const selects = page.locator('select');
    if (await selects.count() >= 1) {
      await selects.first().selectOption(vendor.category).catch(() => {
        // If select fails, try combobox
      });
    }
  }

  if (vendor.status) {
    // Status select
    const selects = page.locator('select');
    if (await selects.count() >= 2) {
      await selects.nth(1).selectOption(vendor.status).catch(() => {
        // Fallback
      });
    }
  }

  if (vendor.notes) {
    const textareas = page.locator('textarea');
    if (await textareas.isVisible({ timeout: 1000 }).catch(() => false)) {
      await textareas.fill(vendor.notes);
    }
  }

  // Submit form
  const saveButton = page.locator('button[type="submit"]').last();
  await saveButton.click();

  // Wait for modal to close
  await page.waitForLoadState('networkidle');
}

/**
 * Search for an item in list
 */
export async function search(page: Page, term: string) {
  const searchInput = page.locator('[placeholder*="Search"], [placeholder*="search"]').first();
  await searchInput.fill(term);
  await page.waitForLoadState('networkidle');
}

/**
 * Clear search
 */
export async function clearSearch(page: Page) {
  const searchInput = page.locator('[placeholder*="Search"], [placeholder*="search"]').first();
  await searchInput.clear();
  await searchInput.press('Escape');
  await page.waitForLoadState('networkidle');
}

/**
 * Get count of rows in table
 */
export async function getTableRowCount(page: Page): Promise<number> {
  const rows = page.locator('table tbody tr, [role="row"]:not([role="columnheader"])');
  return await rows.count();
}

/**
 * Wait for table to load
 */
export async function waitForTableLoad(page: Page, minRows = 0) {
  await page.waitForLoadState('networkidle');

  if (minRows > 0) {
    const rows = page.locator('table tbody tr, [role="row"]:not([role="columnheader"])');
    // Wait until we have at least minRows
    let attempts = 0;
    while ((await rows.count()) < minRows && attempts < 10) {
      await page.waitForTimeout(500);
      attempts++;
    }
  }
}

/**
 * Close slide-over/modal
 */
export async function closeSlideOver(page: Page) {
  const closeButton = page.locator('[aria-label="Close"], button[aria-label*="close"]').first();
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }
  // Wait for it to close
  await page.waitForLoadState('networkidle');
}

/**
 * Check if empty state is shown
 */
export async function isEmptyState(page: Page, type: 'couples' | 'vendors' | 'tasks'): Promise<boolean> {
  const messages = {
    couples: 'No couples',
    vendors: 'No vendors',
    tasks: 'No tasks',
  };

  const emptyStateText = page.locator(`text=${messages[type]}`);
  return await emptyStateText.isVisible({ timeout: 2000 }).catch(() => false);
}
