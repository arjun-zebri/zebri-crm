import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('text=Forgot your password?')).toBeVisible();
    await expect(page.locator('text=Sign up')).toBeVisible();
  });

  test('should display signup page and form fields', async ({ page }) => {
    await page.goto('/signup');

    // Check for signup form elements
    await expect(page.locator('input[id="displayName"]')).toBeVisible();
    await expect(page.locator('input[id="businessName"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('input[id="confirmPassword"]')).toBeVisible();
    await expect(page.locator('h1:has-text("Create Account")')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('text=Already have an account?')).toBeVisible();
  });

  test('should show validation errors on empty signup', async ({ page }) => {
    await page.goto('/signup');

    // Click submit without filling form
    await page.locator('button[type="submit"]').click();

    // Should show validation errors or stay on page
    await expect(page).toHaveURL(/\/signup/, { timeout: 3000 });
  });

  test('should navigate to reset password page', async ({ page }) => {
    await page.goto('/login');

    // Click "Forgot your password?" link
    await page.locator('text=Forgot your password?').click();

    // Should navigate to reset password page
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('text=Send Reset Link').or(page.locator('button[type="submit"]'))).toBeVisible();
  });

  test('should show login/signup link toggles', async ({ page }) => {
    // From login, navigate to signup
    await page.goto('/login');
    await page.locator('a[href="/signup"]').click();
    await expect(page).toHaveURL(/\/signup/);

    // From signup, navigate back to login
    await page.locator('a[href="/login"]').click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should reject invalid email format on signup', async ({ page }) => {
    await page.goto('/signup');

    // Fill form with invalid email and other required fields
    await page.fill('input[id="displayName"]', 'Test User');
    await page.fill('input[id="businessName"]', 'Test Business');
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[id="password"]', 'TestPass123!');
    await page.fill('input[id="confirmPassword"]', 'TestPass123!');

    await page.locator('button[type="submit"]').click();

    // Should either show error or remain on signup page
    await expect(page).toHaveURL(/\/signup/, { timeout: 3000 });
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access protected dashboard route
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to login when accessing couples page without auth', async ({ page }) => {
    await page.goto('/couples', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to login when accessing vendors page without auth', async ({ page }) => {
    await page.goto('/vendors', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });
});
