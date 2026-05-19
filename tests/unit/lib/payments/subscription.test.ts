import { currentPlan, hasContractsAccess } from '@/lib/payments/subscription'

/**
 * Entitlement logic — security-relevant (drives the paywall and feature
 * gating). NOTE: the source of `meta` is currently user-writable
 * `user_metadata`; hardening that is tracked in roadmap §7.4 / Phase 0.8.
 * These tests pin the *decision* logic regardless of where meta comes from.
 */
describe('currentPlan', () => {
  it('defaults to starter when meta is missing', () => {
    expect(currentPlan(null)).toBe('starter')
    expect(currentPlan(undefined)).toBe('starter')
    expect(currentPlan({})).toBe('starter')
  })

  it('is starter unless the subscription is active or trialing', () => {
    expect(currentPlan({ subscription_status: 'expired', subscription_plan: 'pro' })).toBe('starter')
    expect(currentPlan({ subscription_status: 'past_due', subscription_plan: 'max' })).toBe('starter')
    expect(currentPlan({ subscription_status: 'canceled', subscription_plan: 'pro' })).toBe('starter')
  })

  it('returns the paid plan when active or trialing', () => {
    expect(currentPlan({ subscription_status: 'active', subscription_plan: 'pro' })).toBe('pro')
    expect(currentPlan({ subscription_status: 'active', subscription_plan: 'max' })).toBe('max')
    expect(currentPlan({ subscription_status: 'trialing', subscription_plan: 'pro' })).toBe('pro')
    expect(currentPlan({ subscription_status: 'trialing', subscription_plan: 'max' })).toBe('max')
  })

  it('falls back to starter for an active subscription with an unknown/absent plan', () => {
    expect(currentPlan({ subscription_status: 'active', subscription_plan: 'enterprise' })).toBe('starter')
    expect(currentPlan({ subscription_status: 'active' })).toBe('starter')
  })
})

describe('hasContractsAccess', () => {
  it('denies starter (and missing meta)', () => {
    expect(hasContractsAccess(null)).toBe(false)
    expect(hasContractsAccess({})).toBe(false)
    expect(hasContractsAccess({ subscription_status: 'active' })).toBe(false)
    expect(hasContractsAccess({ subscription_status: 'expired', subscription_plan: 'pro' })).toBe(false)
  })

  it('grants pro and max on an active or trialing subscription', () => {
    expect(hasContractsAccess({ subscription_status: 'active', subscription_plan: 'pro' })).toBe(true)
    expect(hasContractsAccess({ subscription_status: 'active', subscription_plan: 'max' })).toBe(true)
    expect(hasContractsAccess({ subscription_status: 'trialing', subscription_plan: 'pro' })).toBe(true)
  })
})
