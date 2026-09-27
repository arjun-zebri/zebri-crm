/**
 * Playwright config for the CI e2e job (`.github/workflows/ci.yml`, job
 * `e2e`). Extends `playwright.config.ts` and changes only what a CI run
 * against a built app and a throwaway local Supabase needs:
 *
 * - The three device projects the Definition of Done names: desktop
 *   Chrome, Pixel 5 and iPhone 12. Desktop Firefox and Safari stay
 *   local-only.
 * - No `webServer`: the job builds and starts the app itself
 *   (`next build` + `next start`) and passes `PLAYWRIGHT_BASE_URL`.
 * - A global setup that seeds the shared MC account and signs it in once;
 *   every test starts from that saved state. See
 *   `tests/e2e/global-setup.ts` for why (the login rate limiter).
 * - Three passes, picked by `E2E_PASS`, run one after another:
 *   - `main` (default): every spec not listed below, signed in.
 *   - `signout`: specs that sign out through the sidebar. That revokes
 *     every session of the shared account (global scope), including the
 *     saved one, so they run after everything else.
 *   - `signed-out`: specs that must start with no session. `/login`
 *     redirects a signed-in visitor to `/`, so a spec that signs in as its
 *     own user (two-factor) cannot start from the saved state. These sign
 *     in only a handful of times, well under the limiter.
 *   A new spec that signs out, or needs a signed-out browser, goes in the
 *   matching list in `tests/e2e/ci-pass-lists.ts` (a unit test enforces
 *   the sign-out half).
 *
 * Usage (what CI runs, once per pass):
 *   E2E_PASS=main PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright \
 *     test --config playwright.ci.config.ts --project=chromium
 */
import { defineConfig } from '@playwright/test'

import base from './playwright.config'
import { SIGN_OUT_SPECS, SIGNED_OUT_SPECS } from './tests/e2e/ci-pass-lists'
import { CI_STORAGE_STATE } from './tests/e2e/global-setup'

const CI_PROJECTS = new Set(['chromium', 'Mobile Chrome', 'Mobile Safari'])

type Pass = 'main' | 'signout' | 'signed-out'
const pass: Pass =
  process.env.E2E_PASS === 'signout' || process.env.E2E_PASS === 'signed-out' ? process.env.E2E_PASS : 'main'

const PASS_FILES = {
  main: { testIgnore: [...SIGN_OUT_SPECS, ...SIGNED_OUT_SPECS] },
  signout: { testMatch: SIGN_OUT_SPECS },
  'signed-out': { testMatch: SIGNED_OUT_SPECS },
} satisfies Record<Pass, { testIgnore?: string[]; testMatch?: string[] }>

if (!process.env.PLAYWRIGHT_BASE_URL) {
  throw new Error('playwright.ci.config.ts needs PLAYWRIGHT_BASE_URL (the started app)')
}

// The job builds and starts the app itself, so drop the base config's
// dev-server hook (omitted rather than set to undefined, which the strict
// tsconfig's exactOptionalPropertyTypes rejects).
const baseConfig = { ...base }
delete baseConfig.webServer

const suffix = pass === 'main' ? '' : `-${pass}`

export default defineConfig({
  ...baseConfig,
  // Retries off while the backlog of known failures is red: a retry on a
  // deterministic failure triples the run and shows nothing new.
  retries: 0,
  globalSetup: './tests/e2e/global-setup.ts',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: `playwright-report${suffix}` }],
  ],
  outputDir: `test-results${suffix}`,
  ...PASS_FILES[pass],
  use: {
    ...baseConfig.use,
    // The base config traces 'on-first-retry', and retries are off here,
    // so no CI failure ever had a trace (Phase 6 review M4). Kept for
    // failures only, so a green run uploads nothing extra.
    trace: 'retain-on-failure',
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    ...(pass === 'signed-out' ? {} : { storageState: CI_STORAGE_STATE }),
  },
  projects: (base.projects ?? []).filter((p) => p.name && CI_PROJECTS.has(p.name)),
})
