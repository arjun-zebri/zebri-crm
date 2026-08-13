/**
 * Unit coverage for the `time_after_event` trigger's match() narrowing.
 * End-to-end behaviour lives in the integration spec. These tests lock
 * the per-lag (+ optional event-type) narrowing.
 */

import { describe, expect, it } from 'vitest'

import { getTriggerSpec } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function makeEvent(
  daysAfter: number | undefined,
  eventType = 'ceremony',
): AutomationEventRow {
  return {
    id: 'evt',
    user_id: 'u',
    source_table: 'events',
    source_id: 'e',
    event_type: 'time_after_event',
    payload:
      daysAfter === undefined
        ? ({ event_id: 'e', event_type: eventType } as never)
        : ({ event_id: 'e', days_after: daysAfter, event_type: eventType } as never),
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

describe('time_after_event trigger match()', () => {
  const spec = getTriggerSpec('time_after_event')

  it('registry has a spec', () => {
    expect(spec).not.toBeNull()
  })

  it('matches when payload.days_after === config.amount', () => {
    expect(spec!.match(makeEvent(1), { amount: 1, unit: 'days' })).toBe(true)
    expect(spec!.match(makeEvent(0), { amount: 0, unit: 'days' })).toBe(true)
  })

  it('rejects when the lag differs', () => {
    expect(spec!.match(makeEvent(1), { amount: 7, unit: 'days' })).toBe(false)
  })

  it('ignores a legacy eventType in match()', () => {
    // The field left the schema in the trigger sweep: the app never
    // writes events.event_type, so every row holds the column default
    // and the filter could only match everything or nothing. Saved
    // configs still parse via passthrough and now simply fire.
    expect(
      spec!.match(makeEvent(7, 'ceremony'), { amount: 7, unit: 'days', eventType: 'rehearsal' }),
    ).toBe(true)
  })

  it('rejects when payload lacks days_after or it is non-numeric', () => {
    expect(spec!.match(makeEvent(undefined), { amount: 0, unit: 'days' })).toBe(false)
    const bad: AutomationEventRow = {
      ...makeEvent(0),
      payload: { days_after: 'one', event_type: 'ceremony' } as never,
    }
    expect(spec!.match(bad, { amount: 1, unit: 'days' })).toBe(false)
  })
})
