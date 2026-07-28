/**
 * Unit coverage for `proposal_overdue` — mirrors the quote_overdue
 * suite: the threshold clamp (never colliding with `proposal_due` on
 * expiry day) and the per-threshold narrowing.
 */

import { describe, expect, it } from 'vitest'

import { getTriggerSpec, proposalOverdueThresholdDays } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function makeEvent(daysOverdue: number | string | undefined): AutomationEventRow {
  return {
    id: 'evt',
    user_id: 'u',
    source_table: 'proposals',
    source_id: 'p',
    event_type: 'proposal_overdue',
    payload:
      daysOverdue === undefined
        ? ({} as never)
        : ({ proposal_id: 'p', days_overdue: daysOverdue } as never),
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

describe('proposalOverdueThresholdDays()', () => {
  it('defaults to 1 day past expiry when min is unset', () => {
    expect(proposalOverdueThresholdDays({})).toBe(1)
  })

  it('clamps a configured min of 0 up to 1', () => {
    // "Overdue" means strictly past expiry — a 0 threshold would
    // collide with `proposal_due` (days=0) on the expiry day.
    expect(proposalOverdueThresholdDays({ daysOverdueMin: 0 })).toBe(1)
  })

  it('passes through a configured min above 1', () => {
    expect(proposalOverdueThresholdDays({ daysOverdueMin: 5 })).toBe(5)
  })
})

describe('proposal_overdue trigger match()', () => {
  const spec = getTriggerSpec('proposal_overdue')

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
