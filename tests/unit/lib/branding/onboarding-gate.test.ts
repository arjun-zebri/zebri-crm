import { describe, it, expect } from 'vitest'

import { shouldShowOnboarding } from '@/lib/branding/onboarding-gate'

/**
 * The gate decides whether the branding onboarding wizard is visible.
 *
 * Two sources disagree by design: `cacheSaysNeedsOnboarding` is a localStorage
 * guess read at mount (per-browser, so it can be stale across accounts), while
 * `onboardedAt` is the authoritative `user_branding.onboarded_at` value that
 * only arrives once the fetch resolves.
 */
describe('shouldShowOnboarding', () => {
  describe('while the branding fetch is still in flight', () => {
    it('trusts the cache guess so the modal frame paints on the first frame', () => {
      expect(
        shouldShowOnboarding({ loading: true, cacheSaysNeedsOnboarding: true, onboardedAt: null }),
      ).toBe(true)
    })

    it('stays shut for a user the cache says is already onboarded, avoiding a modal flash', () => {
      expect(
        shouldShowOnboarding({ loading: true, cacheSaysNeedsOnboarding: false, onboardedAt: null }),
      ).toBe(false)
    })
  })

  describe('once the branding row has loaded', () => {
    // The account-switch regression: signing into a brand-new account in a
    // browser that already completed onboarding leaves the localStorage flag
    // reading 'true', so the cache guess is false. The DB says onboarded_at is
    // null and must win, otherwise the new account silently never sees the
    // wizard until an unprompted page reload repairs the cache.
    it('shows the wizard for a new account even when a stale cache says otherwise', () => {
      expect(
        shouldShowOnboarding({ loading: false, cacheSaysNeedsOnboarding: false, onboardedAt: null }),
      ).toBe(true)
    })

    it('hides the wizard once onboarding is recorded, even when the cache is stale the other way', () => {
      expect(
        shouldShowOnboarding({
          loading: false,
          cacheSaysNeedsOnboarding: true,
          onboardedAt: '2026-07-18T00:00:00.000Z',
        }),
      ).toBe(false)
    })

    it('agrees with the cache when both sources say onboarding is needed', () => {
      expect(
        shouldShowOnboarding({ loading: false, cacheSaysNeedsOnboarding: true, onboardedAt: null }),
      ).toBe(true)
    })

    it('agrees with the cache when both sources say onboarding is done', () => {
      expect(
        shouldShowOnboarding({
          loading: false,
          cacheSaysNeedsOnboarding: false,
          onboardedAt: '2026-07-18T00:00:00.000Z',
        }),
      ).toBe(false)
    })
  })
})
