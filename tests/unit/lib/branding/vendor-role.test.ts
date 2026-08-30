import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VENDOR_ROLE,
  derivedVendorRole,
  parseBusinessTypes,
  resolveVendorRole,
} from '@/lib/branding/vendor-role'

describe('resolveVendorRole', () => {
  it('uses the single selected business type', () => {
    expect(resolveVendorRole({ business_type: ['dj'] })).toBe('DJ')
    expect(resolveVendorRole({ business_type: ['celebrant'] })).toBe('Celebrant')
  })

  it('joins a multi-select rather than silently picking one', () => {
    expect(resolveVendorRole({ business_type: ['mc', 'dj'] })).toBe('MC & DJ')
    expect(resolveVendorRole({ business_type: ['mc', 'celebrant', 'dj'] })).toBe(
      'MC, Celebrant & DJ',
    )
  })

  it('lets the free-text override win over the business type', () => {
    expect(resolveVendorRole({ business_type: ['mc'], vendor_role: 'Host' })).toBe('Host')
  })

  it('never falls back to "MC" for a user who set nothing', () => {
    expect(resolveVendorRole({})).toBe(DEFAULT_VENDOR_ROLE)
    expect(resolveVendorRole(null)).toBe(DEFAULT_VENDOR_ROLE)
    expect(DEFAULT_VENDOR_ROLE).not.toContain('MC')
  })

  it('ignores a blank or whitespace-only override', () => {
    expect(resolveVendorRole({ business_type: ['dj'], vendor_role: '   ' })).toBe('DJ')
  })

  it('accepts the legacy bare-string business_type', () => {
    // business_type was a single string before the multi-select landed.
    expect(resolveVendorRole({ business_type: 'dj' })).toBe('DJ')
  })

  it('drops unknown business types instead of rendering them', () => {
    expect(parseBusinessTypes(['dj', 'wizard'])).toEqual(['dj'])
    expect(resolveVendorRole({ business_type: ['wizard'] })).toBe(DEFAULT_VENDOR_ROLE)
  })

  it('caps an overlong override so it cannot break a sentence', () => {
    expect(resolveVendorRole({ vendor_role: 'x'.repeat(200) })).toHaveLength(40)
  })

  it('exposes the derived label separately for the Settings placeholder', () => {
    expect(derivedVendorRole({ business_type: ['mc'] })).toBe('MC')
    expect(derivedVendorRole({ business_type: ['mc'], vendor_role: 'Host' })).toBe('MC')
  })
})
