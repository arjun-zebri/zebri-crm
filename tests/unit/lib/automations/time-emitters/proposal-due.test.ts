/**
 * Unit coverage for the `proposal_due` trigger's match surface —
 * mirrors the quote_due suite: the per-lead-time narrowing is the
 * single most subtle thing about the trigger (two automations with
 * different lead-times must never both fire for one emitted event).
 */

import { describe, expect, it } from 'vitest'

import { getTriggerSpec } from '@/lib/automations/triggers'
import type { AutomationEventRow } from '@/types/automations'

function makeEvent(daysUntilDue: number | undefined): AutomationEventRow {
  return {
    id: 'evt',
    user_id: 'u',
    source_table: 'proposals',
    source_id: 'p',
    event_type: 'proposal_due',
    payload:
      daysUntilDue === undefined
        ? ({} as never)
        : ({ proposal_id: 'p', days_until_due: daysUntilDue } as never),
    couple_id: 'c',
    created_at: new Date().toISOString(),
    processed_at: null,
    error_message: null,
  }
}

describe('proposal_due trigger match()', () => {
  const spec = getTriggerSpec('proposal_due')

  it('registry has a spec', () => {
    expect(spec).not.toBeNull()
  })

  it('matches when payload.days_until_due === config.days', () => {
    expect(spec!.match(makeEvent(3), { days: 3 })).toBe(true)
    expect(spec!.match(makeEvent(0), { days: 0 })).toBe(true)
  })

  it('rejects when lead-time differs', () => {
    expect(spec!.match(makeEvent(3), { days: 7 })).toBe(false)
    expect(spec!.match(makeEvent(0), { days: 3 })).toBe(false)
  })

  it('rejects when payload lacks days_until_due', () => {
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
