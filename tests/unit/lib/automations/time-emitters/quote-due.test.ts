/**
 * Unit coverage for the `quote_due` trigger's match + emitter
 * surface area.
 *
 * The end-to-end behaviour (DB read, dedupe, emit RPC) lives in the
 * matching integration spec at
 * `tests/integration/automations/quote-due-emitter.test.ts` — that
 * exercises real RLS and real schema. These tests focus on the
 * pure logic that decides whether a given event matches a given
 * config (the per-lead-time narrowing), which is the single most
 * subtle thing about this trigger.
 */

import { describe, expect, it } from 'vitest'

import { getTriggerSpec } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function makeEvent(daysUntilDue: number | undefined): AutomationEventRow {
  return {
    id: 'evt',
    user_id: 'u',
    source_table: 'quotes',
    source_id: 'q',
    event_type: 'quote_due',
    payload:
      daysUntilDue === undefined
        ? ({} as never)
        : ({ quote_id: 'q', days_until_due: daysUntilDue } as never),
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

describe('quote_due trigger match()', () => {
  const spec = getTriggerSpec('quote_due')

  it('registry has a spec', () => {
    expect(spec).not.toBeNull()
  })

  it('matches when payload.days_until_due === config.days', () => {
    expect(spec!.match(makeEvent(3), { days: 3 })).toBe(true)
    expect(spec!.match(makeEvent(0), { days: 0 })).toBe(true)
  })

  it('rejects when lead-time differs', () => {
    // Two automations with different lead-times must not both fire
    // for the same emitted event — that would make `days=0` and
    // `days=7` collapse into the same recipient blast.
    expect(spec!.match(makeEvent(3), { days: 7 })).toBe(false)
    expect(spec!.match(makeEvent(0), { days: 3 })).toBe(false)
  })

  it('rejects when payload lacks days_until_due', () => {
    // Defensive — an event without the lead-time field is not a
    // time-emitted `quote_due` we can route. Today nothing else
    // emits this event_type; in future, a manual/test emit without
    // the field should be ignored rather than fan out blindly.
    expect(spec!.match(makeEvent(undefined), { days: 0 })).toBe(false)
  })

  it('rejects when payload.days_until_due is non-numeric', () => {
    const bad: AutomationEventRow = {
      ...makeEvent(0),
      payload: { days_until_due: 'three' } as never,
    }
    expect(spec!.match(bad, { days: 3 })).toBe(false)
  })
})
