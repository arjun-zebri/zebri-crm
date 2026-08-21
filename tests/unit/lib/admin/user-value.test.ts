/**
 * Pure per-user value/tier helpers (`lib/admin/user-value`).
 *
 * The contracts that matter: the Users-table sort puts the highest
 * paying tier first (a cancelled ex-Pro sorts as Starter), and the
 * gone-quiet list only ever contains paying or comped accounts —
 * a free user going quiet is not revenue at risk.
 *
 * Activity is measured from what a user has *written* (their most
 * recent couple / event / invoice / contract), never from
 * `auth.users.last_sign_in_at`. GoTrue only stamps that column on a
 * real credential exchange, and Zebri sessions never expire, so a
 * daily user's `last_sign_in_at` freezes at their first-ever login.
 */
import { describe, expect, it } from 'vitest'

import type { AdminUser } from '@/lib/admin/admin-analytics'
import {
  byPlanThenActivity,
  computeGoneQuiet,
  effectivePlan,
  emptyUserStats,
  planRank,
  type UserStats,
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

/** Build the stats map the activity-aware helpers read from. */
function statsMap(entries: Record<string, string | null>): Record<string, UserStats> {
  const out: Record<string, UserStats> = {}
  for (const [id, lastActiveAt] of Object.entries(entries)) {
    out[id] = { ...emptyUserStats(), lastActiveAt }
  }
  return out
}

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

describe('emptyUserStats', () => {
  it('reports no activity rather than pretending the user is fresh', () => {
    expect(emptyUserStats().lastActiveAt).toBeNull()
  })
})

describe('byPlanThenActivity', () => {
  it('orders by tier first, then most recent activity', () => {
    const staleMax = payingMax({ id: 'stale-max' })
    const freshPro = payingPro({ id: 'fresh-pro' })
    const fresherPro = payingPro({ id: 'fresher-pro' })
    const starter = user({ id: 'starter' })
    const stats = statsMap({
      'stale-max': daysAgo(60),
      'fresh-pro': daysAgo(1),
      'fresher-pro': daysAgo(0),
      starter: daysAgo(0),
    })

    const sorted = [starter, freshPro, staleMax, fresherPro].sort(byPlanThenActivity(stats))
    expect(sorted.map((u) => u.id)).toEqual(['stale-max', 'fresher-pro', 'fresh-pro', 'starter'])
  })

  it('puts never-active users after active ones within a tier', () => {
    const never = payingPro({ id: 'never' })
    const active = payingPro({ id: 'active' })
    const stats = statsMap({ never: null, active: daysAgo(300) })
    expect([never, active].sort(byPlanThenActivity(stats)).map((u) => u.id)).toEqual([
      'active',
      'never',
    ])
  })

  it('sorts a user with no stats entry at all as never-active', () => {
    const missing = payingPro({ id: 'missing' })
    const active = payingPro({ id: 'active' })
    const stats = statsMap({ active: daysAgo(300) })
    expect([missing, active].sort(byPlanThenActivity(stats)).map((u) => u.id)).toEqual([
      'active',
      'missing',
    ])
  })
})

describe('computeGoneQuiet', () => {
  it('includes only paying or comped users past the 14-day threshold', () => {
    const quietPaying = payingPro({ id: 'quiet-paying' })
    const activePaying = payingPro({ id: 'active-paying' })
    const quietFree = user({ id: 'quiet-free' })
    const quietComped = user({
      id: 'quiet-comped',
      subscription_status: 'active',
      subscription_plan: 'max',
      is_comped: true,
    })
    const stats = statsMap({
      'quiet-paying': daysAgo(20),
      'active-paying': daysAgo(2),
      'quiet-free': daysAgo(90),
      'quiet-comped': daysAgo(30),
    })

    const quiet = computeGoneQuiet(
      [quietPaying, activePaying, quietFree, quietComped],
      stats,
      NOW,
    )
    expect(quiet.map((r) => r.id)).toEqual(['quiet-comped', 'quiet-paying'])
    expect(quiet[0]).toMatchObject({ plan: 'max', is_comped: true, daysSinceActive: 30 })
  })

  it('does NOT flag a user whose sign-in is ancient but who is writing every day', () => {
    // The original bug: this user logged in once in January and has
    // never re-authenticated since (sessions never expire), so
    // last_sign_in_at is 200 days stale — but they created a couple
    // yesterday. They are the opposite of revenue at risk.
    const workhorse = payingMax({ id: 'workhorse', last_sign_in_at: daysAgo(200) })
    const quiet = computeGoneQuiet([workhorse], statsMap({ workhorse: daysAgo(1) }), NOW)
    expect(quiet).toEqual([])
  })

  it('flags a user who signed in recently but has written nothing for a month', () => {
    // The mirror case: a fresh sign-in is not evidence of use.
    const lurker = payingMax({ id: 'lurker', last_sign_in_at: daysAgo(0) })
    const quiet = computeGoneQuiet([lurker], statsMap({ lurker: daysAgo(30) }), NOW)
    expect(quiet.map((r) => r.id)).toEqual(['lurker'])
  })

  it('counts a paying user who has never written anything as gone quiet', () => {
    const never = payingMax({ id: 'never' })
    const quiet = computeGoneQuiet([never], statsMap({ never: null }), NOW)
    expect(quiet).toHaveLength(1)
    expect(quiet[0]).toMatchObject({ id: 'never', daysSinceActive: null, lastActiveAt: null })
  })

  it('treats a user missing from the stats map as never active', () => {
    const never = payingMax({ id: 'ghost' })
    const quiet = computeGoneQuiet([never], {}, NOW)
    expect(quiet.map((r) => r.id)).toEqual(['ghost'])
  })

  it('is exactly a 14-day boundary', () => {
    const on = payingPro({ id: 'on-boundary' })
    const inside = payingPro({ id: 'inside' })
    const stats = statsMap({ 'on-boundary': daysAgo(14), inside: daysAgo(13.9) })
    expect(computeGoneQuiet([on, inside], stats, NOW).map((r) => r.id)).toEqual([])

    const past = payingPro({ id: 'past' })
    expect(
      computeGoneQuiet([past], statsMap({ past: daysAgo(14.1) }), NOW).map((r) => r.id),
    ).toEqual(['past'])
  })
})
