/**
 * Pure helpers of the proposal_expiring emitter: which lead times a
 * saved config asks for, and which calendar date that targets.
 */
import { describe, expect, it } from 'vitest'

import {
  expiryDateForLeadDays,
  parseLeadDays,
} from '@/lib/automations/time-emitters/proposal-expiring'

describe('parseLeadDays', () => {
  it('applies the schema default for an empty config', () => {
    expect(parseLeadDays({})).toBe(3)
    expect(parseLeadDays(null)).toBe(3)
  })

  it('reads a configured lead time', () => {
    expect(parseLeadDays({ days: 7 })).toBe(7)
    expect(parseLeadDays({ days: 0 })).toBe(0)
  })

  it('returns null for a config the trigger schema rejects', () => {
    expect(parseLeadDays({ days: 90 })).toBeNull()
    expect(parseLeadDays({ days: 'soon' })).toBeNull()
  })
})

describe('expiryDateForLeadDays', () => {
  it('targets today plus the lead time, as a Postgres date', () => {
    const now = new Date('2026-09-21T13:00:00Z')
    expect(expiryDateForLeadDays(0, now)).toBe('2026-09-21')
    expect(expiryDateForLeadDays(3, now)).toBe('2026-09-24')
    expect(expiryDateForLeadDays(10, now)).toBe('2026-10-01')
  })
})
