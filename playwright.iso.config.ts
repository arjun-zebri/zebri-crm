/**
 * Playwright config for the ISOLATED local-Supabase dev server
 * (port 3123) — used to validate migration-coupled e2e specs before
 * the CI migration deploy makes them runnable against the standard
 * dev server. See memory: isolated-dev-server-verification.
 *
 * Usage:
 *   TEST_EMAIL=... TEST_PASSWORD=... npx playwright test \
 *     --config playwright.iso.config.ts --project chromium <spec>
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3123',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
});
