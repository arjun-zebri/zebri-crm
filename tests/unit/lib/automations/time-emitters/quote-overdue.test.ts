/**
 * Unit coverage for the `quote_overdue` trigger's match narrowing
 * (A2).
 *
 * The end-to-end behaviour (DB read, dedupe, emit RPC) lives in the
 * matching integration spec at
 * `tests/integration/automations/quote-overdue-emitter.test.ts`.
 * These tests pin down the pure logic: which emitted `days_overdue`
 * value a given automation config should fire for, including the
 * "min of 0 still means at least 1 day past expiry" rule and the
 * `daysOverdueMax` window guard.
 */

import { describe, expect, it } from 'vitest'

import {
  getTriggerSpec,
  quoteOverdueThresholdDays,
} from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function makeEvent(daysOverdue: number | string | undefined): AutomationEventRow {
  return {
    id: 'evt',
    user_id: 'u',
    source_table: 'quotes',
    source_id: 'q',
    event_type: 'quote_overdue',
    payload:
      daysOverdue === undefined
        ? ({} as never)
        : ({ quote_id: 'q', days_overdue: daysOverdue } as never),
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

describe('quoteOverdueThresholdDays()', () => {
  it('defaults to 1 day past expiry when min is unset', () => {
    expect(quoteOverdueThresholdDays({})).toBe(1)
  })

  it('clamps a configured min of 0 up to 1', () => {
    // "Overdue" means strictly past the expiry date — a 0 threshold
    // would collide with `quote_due` (days=0) on the expiry day.
    expect(quoteOverdueThresholdDays({ daysOverdueMin: 0 })).toBe(1)
  })

  it('passes through a configured min above 1', () => {
    expect(quoteOverdueThresholdDays({ daysOverdueMin: 5 })).toBe(5)
  })
})

describe('quote_overdue trigger match()', () => {
  const spec = getTriggerSpec('quote_overdue')

  it('registry has a spec', () => {
    expect(spec).not.toBeNull()
  })

  it('matches the default threshold (1 day overdue) with an empty config', () => {
    expect(spec!.match(makeEvent(1), {})).toBe(true)
  })

  it('matches when payload.days_overdue equals the configured min', () => {
    expect(spec!.match(makeEvent(3), { daysOverdueMin: 3 })).toBe(true)
  })

  it('rejects when the overdue depth differs from the threshold', () => {
    // Two automations with different thresholds must not both fire
    // for the same emitted event — same narrowing rule as quote_due.
    expect(spec!.match(makeEvent(3), { daysOverdueMin: 7 })).toBe(false)
    expect(spec!.match(makeEvent(7), {})).toBe(false)
  })

  it('rejects when daysOverdueMax excludes the threshold', () => {
    // A window like min=5/max=3 can never fire; better to silently
    // no-op than fire outside the user's stated bound.
    expect(
      spec!.match(makeEvent(5), { daysOverdueMin: 5, daysOverdueMax: 3 }),
    ).toBe(false)
  })

  it('accepts when daysOverdueMax admits the threshold', () => {
    expect(
      spec!.match(makeEvent(2), { daysOverdueMin: 2, daysOverdueMax: 10 }),
    ).toBe(true)
  })

  it('rejects when payload lacks days_overdue', () => {
    // Defensive — an event without the depth field is not a
    // time-emitted `quote_overdue` we can route.
    expect(spec!.match(makeEvent(undefined), {})).toBe(false)
  })

  it('rejects when payload.days_overdue is non-numeric', () => {
    expect(spec!.match(makeEvent('three'), {})).toBe(false)
  })
})
