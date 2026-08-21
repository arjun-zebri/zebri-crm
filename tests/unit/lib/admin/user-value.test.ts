/**
 * Pure per-user value/tier helpers (`lib/admin/user-value`).
 *
 * The contracts that matter: the Users-table sort puts the highest
 * paying tier first (a cancelled ex-Pro sorts as Starter), and the
 * gone-quiet list only ever contains paying or comped accounts —
 * a free user going quiet is not revenue at risk.
 */
import { describe, expect, it } from 'vitest'

import type { AdminUser } from '@/lib/admin/admin-analytics'
import {
  compareUsersByPlanThenLastSeen,
  computeGoneQuiet,
  effectivePlan,
  emptyUserStats,
  planRank,
} from '@/lib/admin/user-value'

const NOW = new Date('2026-08-15T00:00:00Z').getTime()
const DAY = 24 * 60 * 60 * 1000

const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString()

function user(overrides: Partial<AdminUser>): AdminUser {
  return {
    id: 'u1',
    email: 'mc@example.com',
    display_name: 'MC',
    business_name: 'MC Weddings',
    account_type: 'vendor',
    subscription_status: null,
    subscription_plan: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_end: null,
    subscription_end: null,
    cancel_at_period_end: false,
    is_subscribed: false,
    is_beta_user: false,
    is_comped: false,
    created_at: daysAgo(100),
    last_sign_in_at: null,
    last_seen_at: null,
    ...overrides,
  }
}

const payingMax = (overrides: Partial<AdminUser> = {}) =>
  user({
    subscription_status: 'active',
    subscription_plan: 'max',
    stripe_subscription_id: 'sub_1',
    ...overrides,
  })

const payingPro = (overrides: Partial<AdminUser> = {}) =>
  user({
    subscription_status: 'active',
    subscription_plan: 'pro',
    stripe_subscription_id: 'sub_2',
    ...overrides,
  })

describe('effectivePlan / planRank', () => {
  it('ranks max above pro above starter', () => {
    expect(planRank(payingMax())).toBeLessThan(planRank(payingPro()))
    expect(planRank(payingPro())).toBeLessThan(planRank(user({})))
  })

  it('treats a cancelled ex-Pro as Starter', () => {
    const cancelled = user({ subscription_status: 'cancelled', subscription_plan: 'pro' })
    expect(effectivePlan(cancelled)).toBe('starter')
  })

  it('keeps a comped user on their granted plan', () => {
    const comped = user({
      subscription_status: 'active',
      subscription_plan: 'max',
      is_comped: true,
    })
    expect(effectivePlan(comped)).toBe('max')
  })
})

describe('compareUsersByPlanThenLastSeen', () => {
  it('orders by tier first, then most recently seen', () => {
    const staleMax = payingMax({ id: 'stale-max', last_seen_at: daysAgo(60) })
    const freshPro = payingPro({ id: 'fresh-pro', last_seen_at: daysAgo(1) })
    const fresherPro = payingPro({ id: 'fresher-pro', last_seen_at: daysAgo(0) })
    const starter = user({ id: 'starter', last_seen_at: daysAgo(0) })

    const sorted = [starter, freshPro, staleMax, fresherPro].sort(compareUsersByPlanThenLastSeen)
    expect(sorted.map((u) => u.id)).toEqual(['stale-max', 'fresher-pro', 'fresh-pro', 'starter'])
  })

  it('puts never-seen users after seen ones within a tier', () => {
    const never = payingPro({ id: 'never', last_seen_at: null })
    const seen = payingPro({ id: 'seen', last_seen_at: daysAgo(300) })
    expect([never, seen].sort(compareUsersByPlanThenLastSeen).map((u) => u.id)).toEqual([
      'seen',
      'never',
    ])
  })

  it('ignores last_sign_in_at: a daily user who never re-authenticates sorts first', () => {
    // The production case (Sarah Joel): signed in once weeks ago, on the app
    // yesterday. A sign-in-based sort buried her below dormant accounts.
    const active = payingPro({ id: 'active', last_sign_in_at: daysAgo(29), last_seen_at: daysAgo(1) })
    const lapsed = payingPro({ id: 'lapsed', last_sign_in_at: daysAgo(0), last_seen_at: daysAgo(40) })
    expect([lapsed, active].sort(compareUsersByPlanThenLastSeen).map((u) => u.id)).toEqual([
      'active',
      'lapsed',
    ])
  })
})

describe('computeGoneQuiet', () => {
  it('includes only paying or comped users past the 14-day threshold', () => {
    const quietPaying = payingPro({ id: 'quiet-paying', last_sign_in_at: daysAgo(20) })
    const activePaying = payingPro({ id: 'active-paying', last_sign_in_at: daysAgo(2) })
    const quietFree = user({ id: 'quiet-free', last_sign_in_at: daysAgo(90) })
    const quietComped = user({
      id: 'quiet-comped',
      subscription_status: 'active',
      subscription_plan: 'max',
      is_comped: true,
      last_sign_in_at: daysAgo(30),
    })

    const quiet = computeGoneQuiet([quietPaying, activePaying, quietFree, quietComped], NOW)
    expect(quiet.map((r) => r.id)).toEqual(['quiet-comped', 'quiet-paying'])
    expect(quiet[0]).toMatchObject({ plan: 'max', is_comped: true, daysSinceSignIn: 30 })
  })

  it('counts a paying user who never signed in as gone quiet', () => {
    const never = payingMax({ id: 'never', last_sign_in_at: null })
    const quiet = computeGoneQuiet([never], NOW)
    expect(quiet).toHaveLength(1)
    expect(quiet[0]).toMatchObject({ id: 'never', daysSinceSignIn: null })
  })

  it('is exactly a 14-day boundary', () => {
    const on = payingPro({ id: 'on-boundary', last_sign_in_at: daysAgo(14) })
    const inside = payingPro({ id: 'inside', last_sign_in_at: daysAgo(13.9) })
    const ids = computeGoneQuiet([on, inside], NOW).map((r) => r.id)
    expect(ids).toEqual([])
    const past = payingPro({ id: 'past', last_sign_in_at: daysAgo(14.1) })
    expect(computeGoneQuiet([past], NOW).map((r) => r.id)).toEqual(['past'])
  })
})

describe('emptyUserStats', () => {
  it('is all zeros', () => {
    expect(emptyUserStats()).toEqual({
      couples: 0,
      events: 0,
      invoices: 0,
      paidTotal: 0,
      templates: 0,
      automations: 0,
    })
  })
})
