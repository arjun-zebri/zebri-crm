/**
 * Unit coverage for the `anniversary_of_event` trigger's match()
 * narrowing — by exact year, or a `years..maxYears` range.
 */

import { describe, expect, it } from 'vitest'

import { getTriggerSpec } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function makeEvent(yearsSince: number | undefined): AutomationEventRow {
  return {
    id: 'evt',
    user_id: 'u',
    source_table: 'events',
    source_id: 'e',
    event_type: 'anniversary_of_event',
    payload:
      yearsSince === undefined
        ? ({ event_id: 'e' } as never)
        : ({ event_id: 'e', years_since: yearsSince } as never),
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

describe('anniversary_of_event trigger match()', () => {
  const spec = getTriggerSpec('anniversary_of_event')

  it('registry has a spec', () => {
    expect(spec).not.toBeNull()
  })

  it('matches the exact year when no maxYears', () => {
    expect(spec!.match(makeEvent(1), { years: 1 })).toBe(true)
    expect(spec!.match(makeEvent(5), { years: 1 })).toBe(false)
  })

  it('matches anywhere in [years, maxYears] when maxYears is set', () => {
    expect(spec!.match(makeEvent(3), { years: 1, maxYears: 5 })).toBe(true)
    expect(spec!.match(makeEvent(1), { years: 1, maxYears: 5 })).toBe(true)
    expect(spec!.match(makeEvent(5), { years: 1, maxYears: 5 })).toBe(true)
    expect(spec!.match(makeEvent(6), { years: 1, maxYears: 5 })).toBe(false)
  })

  it('rejects a missing or non-numeric years_since', () => {
    expect(spec!.match(makeEvent(undefined), { years: 1 })).toBe(false)
    const bad: AutomationEventRow = {
      ...makeEvent(1),
      payload: { years_since: 'one' } as never,
    }
    expect(spec!.match(bad, { years: 1 })).toBe(false)
  })
})
