/**
 * Unit coverage for the `time_before_event` trigger's match() narrowing.
 *
 * The end-to-end behaviour (DB read, day-grain guard, dedupe, emit RPC)
 * lives in `tests/integration/automations/time-before-event-emitter.test.ts`
 * against real schema + RLS. These tests focus on the pure narrowing
 * logic: an emitted event must only fan out to automations whose
 * configured lead-time (and optional event type) it matches.
 */

import { describe, expect, it } from 'vitest'

import { getTriggerSpec } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function makeEvent(
  daysBefore: number | undefined,
  eventType = 'ceremony',
): AutomationEventRow {
  return {
    id: 'evt',
    user_id: 'u',
    source_table: 'events',
    source_id: 'e',
    event_type: 'time_before_event',
    payload:
      daysBefore === undefined
        ? ({ event_id: 'e', event_type: eventType } as never)
        : ({ event_id: 'e', days_before: daysBefore, event_type: eventType } as never),
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

describe('time_before_event trigger match()', () => {
  const spec = getTriggerSpec('time_before_event')

  it('registry has a spec', () => {
    expect(spec).not.toBeNull()
  })

  it('matches when payload.days_before === config.amount', () => {
    expect(spec!.match(makeEvent(7), { amount: 7, unit: 'days' })).toBe(true)
    expect(spec!.match(makeEvent(0), { amount: 0, unit: 'days' })).toBe(true)
  })

  it('rejects when the lead-time differs', () => {
    // Two automations with different lead-times must not both fire for
    // one emitted event (e.g. "14 days before" vs "1 day before").
    expect(spec!.match(makeEvent(7), { amount: 3, unit: 'days' })).toBe(false)
    expect(spec!.match(makeEvent(0), { amount: 7, unit: 'days' })).toBe(false)
  })

  it('narrows by eventType when configured', () => {
    expect(
      spec!.match(makeEvent(7, 'rehearsal'), { amount: 7, unit: 'days', eventType: 'rehearsal' }),
    ).toBe(true)
    expect(
      spec!.match(makeEvent(7, 'ceremony'), { amount: 7, unit: 'days', eventType: 'rehearsal' }),
    ).toBe(false)
  })

  it('ignores eventType when not configured (fires for any event type)', () => {
    expect(spec!.match(makeEvent(7, 'reception'), { amount: 7, unit: 'days' })).toBe(true)
  })

  it('rejects when payload lacks days_before', () => {
    expect(spec!.match(makeEvent(undefined), { amount: 0, unit: 'days' })).toBe(false)
  })

  it('rejects when payload.days_before is non-numeric', () => {
    const bad: AutomationEventRow = {
      ...makeEvent(0),
      payload: { days_before: 'seven', event_type: 'ceremony' } as never,
    }
    expect(spec!.match(bad, { amount: 7, unit: 'days' })).toBe(false)
  })
})
