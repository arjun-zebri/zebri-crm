/**
 * Unit coverage for the `invoice_overdue` trigger's match narrowing
 * (A4).
 *
 * The end-to-end behaviour (DB read, dedupe, emit RPC) lives in the
 * matching integration spec at
 * `tests/integration/automations/invoice-overdue-emitter.test.ts`.
 * These tests pin down the pure logic: which emitted `days_overdue`
 * value a given automation config should fire for, including the
 * "min of 0 still means at least 1 day past due" rule and the
 * `daysOverdueMax` window guard. Mirrors the A2 `quote_overdue` spec.
 */

import { describe, expect, it } from 'vitest'

import {
  getTriggerSpec,
  invoiceOverdueThresholdDays,
} from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function makeEvent(daysOverdue: number | string | undefined): AutomationEventRow {
  return {
    id: 'evt',
    user_id: 'u',
    source_table: 'invoices',
    source_id: 'i',
    event_type: 'invoice_overdue',
    payload:
      daysOverdue === undefined
        ? ({} as never)
        : ({ invoice_id: 'i', days_overdue: daysOverdue } as never),
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

describe('invoiceOverdueThresholdDays()', () => {
  it('defaults to 1 day past due when min is unset', () => {
    expect(invoiceOverdueThresholdDays({})).toBe(1)
  })

  it('clamps a configured min of 0 up to 1', () => {
    // "Overdue" means strictly past the due date — a 0 threshold would
    // collide with `invoice_due` (days=0) on the due date itself.
    expect(invoiceOverdueThresholdDays({ daysOverdueMin: 0 })).toBe(1)
  })

  it('passes through a configured min above 1', () => {
    expect(invoiceOverdueThresholdDays({ daysOverdueMin: 5 })).toBe(5)
  })
})

describe('invoice_overdue trigger match()', () => {
  const spec = getTriggerSpec('invoice_overdue')

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
    expect(spec!.match(makeEvent(undefined), {})).toBe(false)
  })

  it('rejects when payload.days_overdue is non-numeric', () => {
    expect(spec!.match(makeEvent('three'), {})).toBe(false)
  })
})

describe('invoice_overdue isFinalBalance narrowing', () => {
  const spec = getTriggerSpec('invoice_overdue')

  /**
   * Create a staged event with stage_is_final computed from position and count.
   *
   * In the real emitter, stage_is_final is computed by finding the max position
   * per invoice. This helper computes it based on whether position === count,
   * which is true for contiguous positions but could be false for non-contiguous
   * ones — the whole point of the stage_is_final field.
   */
  function stageEvent(
    position: number,
    count: number,
  ): AutomationEventRow {
    return {
      ...makeEvent(1),
      payload: {
        invoice_id: 'i',
        days_overdue: 1,
        stage_position: position,
        stage_count: count,
        stage_is_final: position === count,
      } as never,
    }
  }

  it('fires for the last stage when isFinalBalance is set', () => {
    expect(spec!.match(stageEvent(3, 3), { isFinalBalance: true })).toBe(true)
  })

  it('does not fire for an earlier stage when isFinalBalance is set', () => {
    expect(spec!.match(stageEvent(2, 3), { isFinalBalance: true })).toBe(false)
  })

  it('fires for any stage when isFinalBalance is unset', () => {
    expect(spec!.match(stageEvent(2, 3), {})).toBe(true)
  })

  it('fires for a stageless invoice when isFinalBalance is set', () => {
    // No stages means the whole invoice is the final balance.
    expect(spec!.match(makeEvent(1), { isFinalBalance: true })).toBe(true)
  })
})
