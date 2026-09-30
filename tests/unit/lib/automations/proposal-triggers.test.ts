/**
 * Narrowing for the six proposal triggers (roadmap R2, spec 5.2).
 *
 * The five lifecycle triggers carry the contract triggers' chips: the
 * wedding date family, joined into every proposal payload by the DB
 * trigger. `proposal_expiring` adds the lead-time parameter and, like
 * `invoice_due`, only fires for the emitted `days_until_expiry` that
 * equals its own `days`.
 */
import { describe, expect, it } from 'vitest'

import { LAUNCH_VISIBLE_TRIGGERS } from '@/lib/automations/launch-catalogue'
import { triggerRegistry } from '@/lib/automations/triggers'
import { TRIGGER_CATEGORIES, type AutomationEventRow, type TriggerType } from '@/types/automations'

function event(payload: Record<string, unknown>): AutomationEventRow {
  return { payload } as unknown as AutomationEventRow
}

const LIFECYCLE = [
  'proposal_sent',
  'proposal_opened',
  'proposal_accepted',
  'proposal_declined',
  'proposal_expired',
] as const

describe('proposal lifecycle triggers', () => {
  it.each(LIFECYCLE)('%s narrows on the wedding date', (type) => {
    const spec = triggerRegistry[type]
    // 2027-03-06 is a Saturday in peak season.
    const march = event({ event_date: '2027-03-06' })
    expect(spec.match(march, {})).toBe(true)
    expect(spec.match(march, { eventMonth: 'mar' })).toBe(true)
    expect(spec.match(march, { eventMonth: 'dec' })).toBe(false)
    expect(spec.match(march, { season: 'peak' })).toBe(true)
    expect(spec.match(march, { dayOfWeek: 'saturday' })).toBe(true)
    expect(spec.match(event({ event_date: null }), { eventMonth: 'mar' })).toBe(false)
    expect(spec.match(event({ event_date: null }), { hasEventDate: false })).toBe(true)
  })

  it.each(LIFECYCLE)('%s sits in the proposal category and is launch-visible', (type) => {
    expect(triggerRegistry[type].ui.category).toBe('proposal')
    expect(LAUNCH_VISIBLE_TRIGGERS.has(type)).toBe(true)
  })

  it('has a picker label for the proposal category', () => {
    expect(TRIGGER_CATEGORIES.map((c) => c.slug)).toContain('proposal')
  })

  it('accepts an empty config and a config with unknown keys', () => {
    const schema = triggerRegistry.proposal_sent.configSchema
    expect(schema.safeParse({}).success).toBe(true)
    expect(schema.safeParse({ optionId: 'x' }).success).toBe(true)
  })
})

describe('proposal_expiring', () => {
  const spec = triggerRegistry.proposal_expiring

  it('defaults the lead time to 3 days', () => {
    const parsed = spec.configSchema.safeParse({})
    expect(parsed.success && (parsed.data as { days: number }).days).toBe(3)
  })

  it('rejects a lead time outside 0 to 60', () => {
    expect(spec.configSchema.safeParse({ days: -1 }).success).toBe(false)
    expect(spec.configSchema.safeParse({ days: 61 }).success).toBe(false)
    expect(spec.configSchema.safeParse({ days: 60 }).success).toBe(true)
  })

  it('fires only for the emitted lead time that equals its own', () => {
    expect(spec.match(event({ days_until_expiry: 3 }), { days: 3 })).toBe(true)
    expect(spec.match(event({ days_until_expiry: 0 }), { days: 3 })).toBe(false)
    expect(spec.match(event({}), { days: 3 })).toBe(false)
  })

  it('still narrows on the wedding date', () => {
    const e = event({ days_until_expiry: 3, event_date: '2027-03-06' })
    expect(spec.match(e, { days: 3, eventMonth: 'mar' })).toBe(true)
    expect(spec.match(e, { days: 3, eventMonth: 'dec' })).toBe(false)
  })

  it('is launch-visible', () => {
    expect(LAUNCH_VISIBLE_TRIGGERS.has('proposal_expiring' as TriggerType)).toBe(true)
  })
})
