/**
 * Data-shaping tests for the couple → Automations tab.
 *
 * Cover the two pure transforms the orchestrator leans on:
 * `buildActivity` (audit rows → narrated per-run feed) and
 * `groupRuns` (runs → automation groups, live-first, with a
 * collapsed-row title that falls back to the trigger label when the
 * automation is unnamed).
 */
import { describe, expect, it } from 'vitest'

import {
  buildActivity,
  groupRuns,
  summarizeRuns,
  type AuditRow,
  type RunWithAutomation,
} from '@/app/(dashboard)/couples/couple-automations-data'

function run(over: Partial<RunWithAutomation>): RunWithAutomation {
  return {
    id: 'run-1',
    user_id: 'u1',
    automation_id: 'auto-1',
    couple_id: 'c1',
    event_id: 'e1',
    status: 'completed',
    current_action_id: null,
    started_at: '2026-06-11T04:03:00Z',
    completed_at: '2026-06-11T04:03:01Z',
    last_payload: null,
    error_message: null,
    automation: { id: 'auto-1', name: 'Untitled automation', trigger_type: 'invoice_overdue', status: 'active' },
    ...over,
  } as RunWithAutomation
}

function audit(over: Partial<AuditRow>): AuditRow {
  return {
    id: 'a1',
    run_id: 'run-1',
    event: 'action_completed',
    details: {},
    created_at: '2026-06-11T04:03:00Z',
    action: { type: 'send_email', label: null },
    ...over,
  }
}

describe('buildActivity', () => {
  it('narrates audit rows into per-run lines, dropping noise events', () => {
    const runs = [run({})]
    const map = buildActivity(runs, [
      audit({ id: 'a0', event: 'action_started' }), // dropped
      audit({ id: 'a1', event: 'action_completed', details: { sent: 1 } }),
    ])
    const activity = map.get('run-1')
    expect(activity?.lines).toHaveLength(1)
    expect(activity?.lines[0]?.text).toBe('Sent email')
  })

  it('surfaces a silent no-op (ok result with skipped output) as a warning', () => {
    const map = buildActivity(
      [run({})],
      [audit({ details: { skipped: 'no recipients' } })],
    )
    expect(map.get('run-1')?.lines[0]?.tone).toBe('warning')
  })

  it('gives a run with no audit rows an empty line list', () => {
    const map = buildActivity([run({ id: 'run-x' })], [])
    expect(map.get('run-x')?.lines).toEqual([])
  })
})

describe('groupRuns', () => {
  it('falls back to the trigger label when the automation is unnamed', () => {
    const runs = [run({})]
    const groups = groupRuns(runs, buildActivity(runs, []))
    expect(groups[0]?.title).toBe('Invoice overdue')
  })

  it('keeps a real automation name', () => {
    const runs = [run({ automation: { id: 'auto-1', name: 'Win-back flow', trigger_type: 'invoice_overdue', status: 'active' } })]
    const groups = groupRuns(runs, buildActivity(runs, []))
    expect(groups[0]?.title).toBe('Win-back flow')
  })

  it('floats live automations above completed ones', () => {
    const runs = [
      run({ id: 'r1', automation_id: 'done', status: 'completed', automation: { id: 'done', name: 'Done', trigger_type: 'quote_created', status: 'active' } }),
      run({ id: 'r2', automation_id: 'live', status: 'waiting', automation: { id: 'live', name: 'Live', trigger_type: 'invoice_overdue', status: 'active' } }),
    ]
    const groups = groupRuns(runs, buildActivity(runs, []))
    expect(groups[0]?.title).toBe('Live')
  })

  it('exposes the most recent outcome for the collapsed row', () => {
    const runs = [run({})]
    const groups = groupRuns(runs, buildActivity(runs, [audit({ details: { sent: 1 } })]))
    expect(groups[0]?.lastOutcome).toBe('Sent email')
  })
})

describe('summarizeRuns', () => {
  const NOW = new Date('2026-06-20T00:00:00Z').getTime()

  it('counts distinct enabled (status active) automations, ignoring run state', () => {
    const runs = [
      run({ id: 'r1', automation_id: 'a', status: 'completed', automation: { id: 'a', name: 'A', trigger_type: 'x', status: 'active' } }),
      run({ id: 'r2', automation_id: 'a', status: 'waiting', automation: { id: 'a', name: 'A', trigger_type: 'x', status: 'active' } }),
      run({ id: 'r3', automation_id: 'b', status: 'waiting', automation: { id: 'b', name: 'B', trigger_type: 'x', status: 'paused' } }),
      run({ id: 'r4', automation_id: 'c', status: 'completed', automation: { id: 'c', name: 'C', trigger_type: 'x', status: 'active' } }),
    ]
    const s = summarizeRuns(runs, NOW)
    expect(s.active).toBe(2) // a + c (enabled), not b (paused)
    expect(s.waiting).toBe(2) // r2 + r3 — waiting still tracks live runs
  })

  it('counts errored runs only within the last 30 days', () => {
    const runs = [
      run({ id: 'recent', status: 'errored', started_at: '2026-06-15T00:00:00Z' }), // 5 days ago
      run({ id: 'old', status: 'errored', started_at: '2026-04-01T00:00:00Z' }), // >30 days
    ]
    expect(summarizeRuns(runs, NOW).failedRecently).toBe(1)
  })

  it('is all-zero for an empty list', () => {
    expect(summarizeRuns([], NOW)).toEqual({ active: 0, waiting: 0, failedRecently: 0 })
  })
})
