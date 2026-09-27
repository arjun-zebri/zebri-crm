/**
 * Which e2e specs run outside the CI `main` pass (`playwright.ci.config.ts`).
 *
 * Plain data, no Playwright import, so the unit guard
 * (`tests/unit/e2e/ci-pass-lists.test.ts`) can read the same lists.
 *
 * @module tests/e2e/ci-pass-lists
 */

/**
 * Specs that sign out through the app. Sidebar sign-out revokes every
 * session of the shared account, so these run after the `main` pass.
 */
export const SIGN_OUT_SPECS = ['**/navigation.spec.ts']

/**
 * Specs that must start with no session: `/login` redirects a signed-in
 * visitor to `/`, so a spec that signs in as its own user, or drives the
 * login form without clearing cookies, runs in the `signed-out` pass.
 */
export const SIGNED_OUT_SPECS = ['**/two-factor.spec.ts', '**/debug-login.spec.ts']
