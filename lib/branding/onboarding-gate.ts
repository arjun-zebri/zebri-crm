/**
 * Visibility rule for the branding onboarding wizard.
 *
 * The branding page reads two disagreeing sources: a localStorage cache guess
 * available synchronously at mount, and the authoritative
 * `user_branding.onboarded_at` column that only arrives once the fetch
 * resolves. This module owns which one wins, and when.
 *
 * @module lib/branding/onboarding-gate
 */

/**
 * Inputs to the onboarding visibility decision.
 */
export interface OnboardingGateInput {
  /** True while the `user_branding` fetch is still in flight. */
  loading: boolean
  /**
   * The localStorage guess read at mount. A paint optimisation only: it lets
   * the modal frame appear on the first frame instead of after the round trip.
   */
  cacheSaysNeedsOnboarding: boolean
  /**
   * Authoritative `user_branding.onboarded_at`. Null means onboarding has
   * never been completed for this account. Meaningless while `loading`.
   */
  onboardedAt: string | null
}

/**
 * Decide whether the onboarding wizard should be visible.
 *
 * While loading, the cache guess drives the decision so the modal frame can
 * paint immediately (the modal renders a skeleton until the wizard data lands).
 * Once loaded, `onboardedAt` is the sole authority.
 *
 * Why the handover matters: localStorage is keyed per browser, not per account.
 * Signing into a new account in a browser that already finished onboarding
 * leaves a stale 'true' flag behind. Letting that stale guess keep gating the
 * modal after the fetch resolved meant new accounts saw no wizard at all until
 * a manual reload repaired the cache.
 *
 * @param input - Loading state, cache guess, and the authoritative timestamp.
 * @returns True when the wizard should be shown.
 */
export function shouldShowOnboarding({
  loading,
  cacheSaysNeedsOnboarding,
  onboardedAt,
}: OnboardingGateInput): boolean {
  if (loading) return cacheSaysNeedsOnboarding
  return onboardedAt === null
}
