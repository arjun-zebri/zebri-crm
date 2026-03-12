import { test, expect } from '@playwright/test';

/**
 * Debug test - run this to see what's happening with login
 * Run with: npx playwright test tests/e2e/debug-login.spec.ts --headed --debug
 */
test('debug: login form submission', async ({ page }) => {
  // Check env vars
  const testEmail = process.env.TEST_EMAIL;
  const testPassword = process.env.TEST_PASSWORD;

  console.log('=== DEBUG: Login Test ===');
  console.log(`TEST_EMAIL from env: ${testEmail}`);
  console.log(`TEST_PASSWORD from env: ${testPassword}`);

  // Go to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Check page title
  const title = await page.title();
  console.log(`Page title: ${title}`);

  // Find form elements
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  console.log(`Email input visible: ${await emailInput.isVisible()}`);
  console.log(`Password input visible: ${await passwordInput.isVisible()}`);
  console.log(`Submit button visible: ${await submitButton.isVisible()}`);

  // Try to fill and submit
  const email = testEmail || 'test@example.com';
  const password = testPassword || 'test-password';

  console.log(`\nAttempting login with:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${'*'.repeat(password.length)}`);

  // Method 1: Using type() - might not work with React controlled inputs
  console.log('\nMethod 1: Using type()');
  await emailInput.clear();
  await emailInput.type(email, { delay: 50 });
  let emailValue = await emailInput.inputValue();
  console.log(`Email input value after type(): ${emailValue}`);

  await passwordInput.clear();
  await passwordInput.type(password, { delay: 50 });
  let passwordValue = await passwordInput.inputValue();
  console.log(`Password input value after type(): ${'*'.repeat(passwordValue.length)}`);

  // Check React state - get the value attribute
  let emailReactValue = await emailInput.evaluate((el: HTMLInputElement) => el.value);
  console.log(`Email React state: ${emailReactValue}`);

  // Clear and try again with fill() + change event
  console.log('\nMethod 2: Using fill() + triggering change event');
  await emailInput.clear();
  await emailInput.fill(email);
  emailValue = await emailInput.inputValue();
  console.log(`Email input value after fill(): ${emailValue}`);

  // Trigger change event
  await emailInput.evaluate((el: HTMLInputElement) => {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  emailReactValue = await emailInput.evaluate((el: HTMLInputElement) => el.value);
  console.log(`Email React state after change event: ${emailReactValue}`);

  // Do the same for password
  await passwordInput.clear();
  await passwordInput.fill(password);
  passwordValue = await passwordInput.inputValue();
  console.log(`Password input value after fill(): ${'*'.repeat(passwordValue.length)}`);

  // Trigger change event
  await passwordInput.evaluate((el: HTMLInputElement) => {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  let passwordReactValue = await passwordInput.evaluate((el: HTMLInputElement) => el.value);
  console.log(`Password React state after change event: ${'*'.repeat(passwordReactValue.length)}`);

  // Check if button is enabled
  const isDisabled = await submitButton.isDisabled();
  console.log(`Submit button disabled: ${isDisabled}`);

  // Take screenshot before clicking
  await page.screenshot({ path: 'debug-before-click.png' });
  console.log(`Screenshot saved: debug-before-click.png`);

  // Check form element
  const form = page.locator('form');
  console.log(`Form found: ${await form.count() > 0}`);

  // Click submit
  console.log(`\nClicking submit button...`);

  // Listen for response errors
  let responseReceived = false;
  page.on('response', response => {
    if (response.url().includes('/auth') || response.url().includes('/login')) {
      console.log(`API Response: ${response.status()} from ${response.url()}`);
      responseReceived = true;
    }
  });

  await submitButton.click();

  // Wait a bit longer for the response
  await page.waitForTimeout(2000);

  // Wait for network if possible
  try {
    await page.waitForLoadState('networkidle');
  } catch (e) {
    console.log('Network did not idle within timeout');
  }

  // Check current URL
  const currentUrl = page.url();
  console.log(`Current URL after click: ${currentUrl}`);

  // Check for ALL error messages (be more thorough)
  const errorElements = page.locator('[class*="error"], [class*="red"]');
  const errorCount = await errorElements.count();
  console.log(`Error elements found: ${errorCount}`);

  for (let i = 0; i < Math.min(errorCount, 3); i++) {
    const errorText = await errorElements.nth(i).textContent();
    console.log(`Error ${i + 1}: ${errorText}`);
  }

  // Check for disabled state on button
  const buttonDisabledAfter = await submitButton.isDisabled();
  console.log(`Submit button disabled after click: ${buttonDisabledAfter}`);

  // Check button text (might show "Signing in...")
  const buttonText = await submitButton.textContent();
  console.log(`Submit button text: ${buttonText}`);

  // Take screenshot after clicking
  await page.screenshot({ path: 'debug-after-click.png' });
  console.log(`Screenshot saved: debug-after-click.png`);

  console.log(`\nResponse received from server: ${responseReceived}`);
  console.log('\n=== End Debug ===');
});
