/**
 * `new_enquiry` trigger narrowing.
 *
 * Every filter the inspector offers has to actually narrow, and every
 * date-derived filter has to reject a couple with no wedding date
 * rather than quietly matching it.
 */
import { describe, expect, it } from 'vitest'

import { monthOfDate, seasonOfDate } from '@/lib/automations/trigger-constants'
import { triggerRegistry } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

const spec = triggerRegistry.new_enquiry

/** Minimal event row carrying the payload `tg_couples_emit_new_enquiry` builds. */
function enquiry(payload: Record<string, unknown>): AutomationEventRow {
  return { payload } as unknown as AutomationEventRow
}

/** An ISO date `days` from now, so days-until-event tests don't drift. */
function inDays(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('new_enquiry config schema', () => {
  it('accepts the values the inspector seeds when a filter is added', () => {
    const seeded = {
      leadSource: '',
      daysUntilEventOp: 'lte',
      daysUntilEventValue: 90,
      hasEventDate: true,
      dayOfWeek: 'any',
      eventMonth: '',
      season: 'any',
      initialStatus: '',
    }
    expect(spec.configSchema.safeParse(seeded).success).toBe(true)
  })

  it('keeps loading a config saved against a lead source that no longer exists', () => {
    // Validation failure here would stop the dispatcher parsing the
    // automation at all, silently disabling it.
    expect(spec.configSchema.safeParse({ leadSource: 'easy_weddings' }).success).toBe(true)
  })
})

describe('new_enquiry match', () => {
  it('fires for any couple when nothing is configured', () => {
    expect(spec.match(enquiry({ lead_source: 'referral' }), {})).toBe(true)
    expect(spec.match(enquiry({}), {})).toBe(true)
  })

  it('narrows on lead source', () => {
    const config = { leadSource: 'referral' }
    expect(spec.match(enquiry({ lead_source: 'referral' }), config)).toBe(true)
    expect(spec.match(enquiry({ lead_source: 'website' }), config)).toBe(false)
    expect(spec.match(enquiry({ lead_source: null }), config)).toBe(false)
  })

  it('narrows on the status the couple landed in', () => {
    const config = { initialStatus: 'new' }
    expect(spec.match(enquiry({ status: 'new' }), config)).toBe(true)
    expect(spec.match(enquiry({ status: 'booked' }), config)).toBe(false)
  })

  it('narrows on days until the wedding', () => {
    const config = { daysUntilEventOp: 'lte', daysUntilEventValue: 90 }
    expect(spec.match(enquiry({ event_date: inDays(30) }), config)).toBe(true)
    expect(spec.match(enquiry({ event_date: inDays(200) }), config)).toBe(false)
    expect(spec.match(enquiry({ event_date: null }), config)).toBe(false)
  })

  it('narrows on whether a wedding date is set at all', () => {
    expect(spec.match(enquiry({ event_date: '2027-03-06' }), { hasEventDate: true })).toBe(true)
    expect(spec.match(enquiry({ event_date: null }), { hasEventDate: true })).toBe(false)
    expect(spec.match(enquiry({ event_date: null }), { hasEventDate: false })).toBe(true)
    expect(spec.match(enquiry({ event_date: '2027-03-06' }), { hasEventDate: false })).toBe(false)
  })

  it('narrows on the wedding day of week', () => {
    // 2027-03-06 is a Saturday.
    expect(spec.match(enquiry({ event_date: '2027-03-06' }), { dayOfWeek: 'saturday' })).toBe(true)
    expect(spec.match(enquiry({ event_date: '2027-03-06' }), { dayOfWeek: 'sunday' })).toBe(false)
    expect(spec.match(enquiry({ event_date: '2027-03-06' }), { dayOfWeek: 'weekend' })).toBe(true)
  })

  it('narrows on the wedding month', () => {
    expect(spec.match(enquiry({ event_date: '2027-03-06' }), { eventMonth: 'mar' })).toBe(true)
    expect(spec.match(enquiry({ event_date: '2027-03-06' }), { eventMonth: 'dec' })).toBe(false)
  })

  it('narrows on season', () => {
    expect(spec.match(enquiry({ event_date: '2027-03-06' }), { season: 'peak' })).toBe(true)
    expect(spec.match(enquiry({ event_date: '2027-07-10' }), { season: 'peak' })).toBe(false)
    expect(spec.match(enquiry({ event_date: '2027-07-10' }), { season: 'off' })).toBe(true)
  })

  it('treats the neutral enum members as no narrowing', () => {
    expect(spec.match(enquiry({ event_date: null }), { dayOfWeek: 'any' })).toBe(true)
    expect(spec.match(enquiry({ event_date: null }), { season: 'any' })).toBe(true)
    expect(spec.match(enquiry({ event_date: null }), { eventMonth: '' })).toBe(true)
    expect(spec.match(enquiry({ lead_source: 'website' }), { leadSource: '' })).toBe(true)
  })

  it('rejects a dateless couple for every date-derived filter', () => {
    // A couple with no date yet has not got a December wedding, so a
    // month / season / day filter must exclude them rather than let
    // them through on a missing field.
    for (const config of [{ dayOfWeek: 'saturday' }, { eventMonth: 'dec' }, { season: 'peak' }]) {
      expect(spec.match(enquiry({ event_date: null }), config)).toBe(false)
      expect(spec.match(enquiry({}), config)).toBe(false)
    }
  })

  it('requires every configured filter to pass', () => {
    const config = { leadSource: 'referral', eventMonth: 'mar' }
    expect(spec.match(enquiry({ lead_source: 'referral', event_date: '2027-03-06' }), config)).toBe(true)
    expect(spec.match(enquiry({ lead_source: 'website', event_date: '2027-03-06' }), config)).toBe(false)
    expect(spec.match(enquiry({ lead_source: 'referral', event_date: '2027-12-06' }), config)).toBe(false)
  })
})

describe('date bucket helpers', () => {
  it('reads month and season in UTC', () => {
    expect(monthOfDate('2027-01-01')).toBe('jan')
    expect(monthOfDate('2027-12-31')).toBe('dec')
    expect(seasonOfDate('2027-05-02')).toBe('shoulder')
    expect(seasonOfDate('2027-09-02')).toBe('shoulder')
    expect(seasonOfDate('2027-06-02')).toBe('off')
    expect(seasonOfDate('2027-10-02')).toBe('peak')
  })

  it('returns null for an absent or unparseable date', () => {
    expect(monthOfDate(null)).toBeNull()
    expect(monthOfDate('not-a-date')).toBeNull()
    expect(seasonOfDate(undefined)).toBeNull()
    expect(seasonOfDate('not-a-date')).toBeNull()
  })
})
