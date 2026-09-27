/**
 * Global setup for the CI e2e run (`playwright.ci.config.ts`).
 *
 * Two jobs, both against a throwaway local Supabase stack:
 *
 * 1. Seed the shared MC account the specs log in as (`TEST_EMAIL` /
 *    `TEST_PASSWORD`): confirmed, on an active subscription so the
 *    dashboard does not bounce to billing, and with the first-run welcome
 *    wizard already dismissed so it never covers the page under test.
 * 2. Sign that account in once through the real login form and save the
 *    browser state. Every spec's `login()` helper takes its fast path on
 *    that state instead of submitting the form again.
 *
 * Why sign in once: the login server action allows 10 attempts a minute
 * per IP (`AUTH_RATE_LIMITS.login`). The suite has a few hundred tests
 * that each call `login()` in `beforeEach`, all from one runner, so
 * logging in per test trips the limiter within the first minute and
 * every later test fails at the form with "Too many attempts".
 *
 * Refuses to run against anything but a loopback Supabase URL: it creates
 * and edits auth users with the service role key, which must never touch
 * a hosted project.
 *
 * @module tests/e2e/global-setup
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { chromium, webkit, type Browser, type FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/** Where the signed-in browser state is written. Gitignored. */
export const CI_STORAGE_STATE = path.resolve(__dirname, '../../playwright/.auth/ci-user.json')

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`[e2e setup] ${name} must be set`)
  return value
}

/** True for a Supabase URL on this machine (the CI runner's own stack). */
function isLoopback(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url)
}

/**
 * Create the MC account, or bring an existing one back to the seeded
 * state. On a fresh CI stack it never exists; the update branch keeps a
 * local re-run from failing on `email_exists`.
 */
async function seedTestUser(url: string, serviceKey: string, email: string, password: string) {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const attributes = {
    password,
    email_confirm: true,
    app_metadata: { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    user_metadata: {
      display_name: 'E2E MC',
      business_name: 'E2E Weddings',
      welcome_onboarded_at: new Date().toISOString(),
    },
  }
  const created = await admin.auth.admin.createUser({ email, ...attributes })
  if (!created.error) return

  // `listUsers` is unreliable on some local stacks, so find the id via a
  // magic link, which returns the user without sending anything.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const id = link.data.user?.id
  if (!id) throw new Error(`[e2e setup] could not create or find ${email}: ${created.error.message}`)
  const updated = await admin.auth.admin.updateUserById(id, attributes)
  if (updated.error) throw new Error(`[e2e setup] could not reset ${email}: ${updated.error.message}`)
}

/**
 * A job installs only the browser its project needs, so launch whichever
 * engine is present rather than assuming Chromium.
 */
async function launchAnyBrowser(): Promise<Browser> {
  try {
    return await chromium.launch()
  } catch {
    return await webkit.launch()
  }
}

/** Playwright global setup entry point. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  if (!isLoopback(url)) {
    throw new Error(`[e2e setup] refusing to seed users on a non-local Supabase: ${url}`)
  }
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const email = requireEnv('TEST_EMAIL')
  const password = requireEnv('TEST_PASSWORD')
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) throw new Error('[e2e setup] PLAYWRIGHT_BASE_URL must be set')

  await seedTestUser(url, serviceKey, email, password)

  const browser = await launchAnyBrowser()
  try {
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
    // Let the landing page settle so any cookie the middleware rewrites
    // on the first authenticated request is in the saved state too.
    await page.waitForLoadState('networkidle')

    mkdirSync(path.dirname(CI_STORAGE_STATE), { recursive: true })
    const state = await context.storageState({ path: CI_STORAGE_STATE })
    if (!state.cookies.some((c) => c.name.includes('auth-token'))) {
      throw new Error('[e2e setup] signed in but no Supabase auth cookie was saved')
    }
  } finally {
    await browser.close()
  }
}
