/**
 * `couple_stage_changed` trigger narrowing.
 *
 * The trigger sweep gave this trigger the same filter vocabulary as
 * `new_enquiry`, so the bar is the same: every filter the chip row
 * offers has to narrow, the date-derived ones have to reject a couple
 * with no wedding date, and the two dead config keys must be gone.
 */
import { describe, expect, it } from 'vitest'

import { triggerRegistry } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

const spec = triggerRegistry.couple_stage_changed

/** Minimal event row carrying the payload `tg_couples_emit_stage_changed` builds. */
function stageChange(payload: Record<string, unknown>): AutomationEventRow {
  return { payload } as unknown as AutomationEventRow
}

/** An ISO date `days` from now, so days-until-event tests don't drift. */
function inDays(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('couple_stage_changed config schema', () => {
  it('accepts the values the chip row seeds when a filter is added', () => {
    const seeded = {
      toStatus: '',
      fromStatus: '',
      leadSource: '',
      daysUntilEventOp: 'lte',
      daysUntilEventValue: 90,
      hasEventDate: true,
      dayOfWeek: 'any',
      eventMonth: '',
      season: 'any',
    }
    expect(spec.configSchema.safeParse(seeded).success).toBe(true)
  })

  it('keeps loading a config saved against a stage the MC has since deleted', () => {
    // Validation failure here would stop the dispatcher parsing the
    // automation at all, silently disabling it.
    expect(spec.configSchema.safeParse({ toStatus: 'retired_stage' }).success).toBe(true)
  })
})

describe('couple_stage_changed match', () => {
  it('fires for any stage move when nothing is configured', () => {
    expect(spec.match(stageChange({ from_status: 'new', to_status: 'booked' }), {})).toBe(true)
    expect(spec.match(stageChange({}), {})).toBe(true)
  })

  it('narrows on the stage the couple moved into', () => {
    const config = { toStatus: 'booked' }
    expect(spec.match(stageChange({ to_status: 'booked' }), config)).toBe(true)
    expect(spec.match(stageChange({ to_status: 'quoted' }), config)).toBe(false)
  })

  it('narrows on the stage the couple moved out of', () => {
    const config = { fromStatus: 'quoted' }
    expect(spec.match(stageChange({ from_status: 'quoted' }), config)).toBe(true)
    expect(spec.match(stageChange({ from_status: 'new' }), config)).toBe(false)
  })

  it('narrows on lead source', () => {
    const config = { leadSource: 'referral' }
    expect(spec.match(stageChange({ lead_source: 'referral' }), config)).toBe(true)
    expect(spec.match(stageChange({ lead_source: 'website' }), config)).toBe(false)
    expect(spec.match(stageChange({ lead_source: null }), config)).toBe(false)
  })

  it('narrows on days until the wedding', () => {
    const config = { daysUntilEventOp: 'lte' as const, daysUntilEventValue: 90 }
    expect(spec.match(stageChange({ event_date: inDays(30) }), config)).toBe(true)
    expect(spec.match(stageChange({ event_date: inDays(200) }), config)).toBe(false)
    expect(spec.match(stageChange({ event_date: null }), config)).toBe(false)
  })

  it('narrows on whether a wedding date is set at all', () => {
    expect(spec.match(stageChange({ event_date: '2027-03-06' }), { hasEventDate: true })).toBe(true)
    expect(spec.match(stageChange({ event_date: null }), { hasEventDate: true })).toBe(false)
    expect(spec.match(stageChange({ event_date: null }), { hasEventDate: false })).toBe(true)
  })

  it('narrows on the wedding day, month and season', () => {
    // 2027-03-06 is a Saturday.
    const march = stageChange({ event_date: '2027-03-06' })
    expect(spec.match(march, { dayOfWeek: 'saturday' })).toBe(true)
    expect(spec.match(march, { dayOfWeek: 'sunday' })).toBe(false)
    expect(spec.match(march, { eventMonth: 'mar' })).toBe(true)
    expect(spec.match(march, { eventMonth: 'dec' })).toBe(false)
    expect(spec.match(march, { season: 'peak' })).toBe(true)
    expect(spec.match(stageChange({ event_date: '2027-07-10' }), { season: 'peak' })).toBe(false)
  })

  it('treats the neutral enum members as no narrowing', () => {
    expect(spec.match(stageChange({ event_date: null }), { dayOfWeek: 'any' })).toBe(true)
    expect(spec.match(stageChange({ event_date: null }), { season: 'any' })).toBe(true)
    expect(spec.match(stageChange({ event_date: null }), { eventMonth: '' })).toBe(true)
    expect(spec.match(stageChange({ to_status: 'booked' }), { toStatus: '' })).toBe(true)
    expect(spec.match(stageChange({ from_status: 'new' }), { fromStatus: '' })).toBe(true)
  })

  it('rejects a dateless couple for every date-derived filter', () => {
    for (const config of [{ dayOfWeek: 'saturday' }, { eventMonth: 'dec' }, { season: 'peak' }]) {
      expect(spec.match(stageChange({ event_date: null }), config)).toBe(false)
      expect(spec.match(stageChange({}), config)).toBe(false)
    }
  })

  it('requires every configured filter to pass', () => {
    const config = { fromStatus: 'quoted', toStatus: 'booked', leadSource: 'referral' }
    const payload = { from_status: 'quoted', to_status: 'booked', lead_source: 'referral' }
    expect(spec.match(stageChange(payload), config)).toBe(true)
    expect(spec.match(stageChange({ ...payload, to_status: 'lost' }), config)).toBe(false)
    expect(spec.match(stageChange({ ...payload, lead_source: 'website' }), config)).toBe(false)
  })
})
