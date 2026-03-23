import { test as base, expect } from '@playwright/test';
import { Page } from '@playwright/test';

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Go to login page
    await page.goto('/login');

    // Fill in test credentials (you'll need to set these up)
    // For now, this is a placeholder - update with real test user
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_PASSWORD || 'test-password';

    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    // Click sign in button
    const signInButton = page.locator('button:has-text("Sign In"), button:has-text("Sign in")');
    await signInButton.click();

    // Wait for navigation to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Provide the authenticated page to the test
    await use(page);
  },
});

export { expect };
