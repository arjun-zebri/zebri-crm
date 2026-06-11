/**
 * Unit coverage for the `invoice_due` trigger's match narrowing (A3).
 *
 * The end-to-end behaviour (DB read, dedupe, emit RPC) lives in the
 * matching integration spec at
 * `tests/integration/automations/invoice-due-emitter.test.ts` — that
 * exercises real RLS and real schema. These tests focus on the pure
 * logic that decides whether a given event matches a given config
 * (the per-lead-time narrowing), mirroring the A1 `quote_due` spec.
 */

import { describe, expect, it } from 'vitest'

import { getTriggerSpec } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function makeEvent(daysUntilDue: number | undefined): AutomationEventRow {
  return {
    id: 'evt',
    user_id: 'u',
    source_table: 'invoices',
    source_id: 'i',
    event_type: 'invoice_due',
    payload:
      daysUntilDue === undefined
        ? ({} as never)
        : ({ invoice_id: 'i', days_until_due: daysUntilDue } as never),
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

describe('invoice_due trigger match()', () => {
  const spec = getTriggerSpec('invoice_due')

  it('registry has a spec', () => {
    expect(spec).not.toBeNull()
  })

  it('matches when payload.days_until_due === config.days', () => {
    expect(spec!.match(makeEvent(3), { days: 3 })).toBe(true)
    expect(spec!.match(makeEvent(0), { days: 0 })).toBe(true)
  })

  it('rejects when lead-time differs', () => {
    // Two automations with different lead-times must not both fire for
    // the same emitted event — that would collapse `days=0` and
    // `days=7` into one recipient blast.
    expect(spec!.match(makeEvent(3), { days: 7 })).toBe(false)
    expect(spec!.match(makeEvent(0), { days: 3 })).toBe(false)
  })

  it('rejects when payload lacks days_until_due', () => {
    // Defensive — an event without the lead-time field is not a
    // time-emitted `invoice_due` we can route.
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
