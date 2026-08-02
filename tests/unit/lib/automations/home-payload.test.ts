/**
 * Home payload aggregation tests.
 *
 * The /automations home page does a single batched read then
 * pipes the four arrays of rows through `buildHomePayload`. The
 * aggregation is pure, so we synthesise inputs and assert each
 * derived field - no Supabase required.
 */
import { describe, expect, it } from 'vitest'

import {
  buildHomePayload,
  type AuditRow,
  type CoupleRow,
  type RunRow,
  type WaitRow,
} from '@/lib/automations/home-payload'
import type { AutomationRow } from '@/types/automations'

function automation(overrides: Partial<AutomationRow>): AutomationRow {
  return {
    id: overrides.id ?? 'a1',
    user_id: 'u',
    name: overrides.name ?? 'Quote follow-up',
    description: null,
    trigger_type: (overrides.trigger_type ?? 'invoice_created') as never,
    trigger_config: {} as never,
    status: overrides.status ?? 'active',
    template_slug: null,
    quiet_hours_start: null,
    quiet_hours_end: null,
    branch_depth_limit: 2,
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function run(overrides: Partial<RunRow>): RunRow {
  return {
    id: overrides.id ?? 'r1',
    automation_id: overrides.automation_id ?? 'a1',
    couple_id: overrides.couple_id ?? 'c1',
    status: overrides.status ?? 'running',
    started_at: overrides.started_at ?? new Date().toISOString(),
    completed_at: overrides.completed_at ?? null,
  }
}

function wait(overrides: Partial<WaitRow>): WaitRow {
  return {
    id: overrides.id ?? 'w1',
    run_id: overrides.run_id ?? 'r1',
    wake_at: overrides.wake_at ?? new Date(Date.now() + 3 * 86_400_000).toISOString(),
    consumed_at: overrides.consumed_at ?? null,
  }
}

function audit(overrides: Partial<AuditRow>): AuditRow {
  return {
    id: overrides.id ?? 'au1',
    automation_id: overrides.automation_id ?? 'a1',
    run_id: overrides.run_id ?? 'r1',
    event: overrides.event ?? 'step_completed',
    details: overrides.details ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
  }
}

describe('buildHomePayload', () => {
  it('counts active / actions / upcoming / total correctly', () => {
    const couples: CoupleRow[] = [{ id: 'c1', name: 'Sarah & Jake' }]
    const automations = [
      automation({ id: 'a1', status: 'active' }),
      automation({ id: 'a2', status: 'paused' }),
    ]
    const runs = [
      run({ id: 'r1', automation_id: 'a1', status: 'running' }),
      run({ id: 'r2', automation_id: 'a1', status: 'errored' }),
    ]
    const waits = [wait({ id: 'w1', run_id: 'r1' })]
    const recent = [
      audit({ id: 'au1', automation_id: 'a1' }),
      audit({ id: 'au2', automation_id: 'a1' }),
    ]

    const payload = buildHomePayload({ automations, runs, waits, recent, couples })

    expect(payload.stats.active).toBe(1)
    expect(payload.stats.totalAutomations).toBe(2)
    expect(payload.stats.actionsThisWeek).toBe(2)
    expect(payload.stats.upcoming).toBe(1)
    expect(payload.stats.erroredLast7d).toBe(1)
  })

  it('per-row enrichment: run count, last fired, next wake, trigger label', () => {
    const couples: CoupleRow[] = [{ id: 'c1', name: 'Sarah & Jake' }]
    const automations = [automation({ id: 'a1' })]
    const runs = [
      run({ id: 'r1', automation_id: 'a1', started_at: '2026-06-01T10:00:00Z' }),
      run({ id: 'r2', automation_id: 'a1', started_at: '2026-06-04T10:00:00Z' }),
    ]
    const waits = [wait({ id: 'w1', run_id: 'r2', wake_at: '2026-06-10T09:00:00Z' })]
    const recent: AuditRow[] = []

    const payload = buildHomePayload({ automations, runs, waits, recent, couples })

    expect(payload.automations).toHaveLength(1)
    const row = payload.automations[0]!
    expect(row.runCount).toBe(2)
    expect(row.lastFiredAt).toBe('2026-06-04T10:00:00Z')
    expect(row.nextWakeAt).toBe('2026-06-10T09:00:00Z')
    expect(row.triggerLabel).toBe('Invoice created')
  })

  it('couples-in-flows: groups by couple, sorts by soonest wake', () => {
    const couples: CoupleRow[] = [
      { id: 'c1', name: 'Sarah & Jake' },
      { id: 'c2', name: 'Mia & Leo' },
    ]
    const automations = [automation({ id: 'a1' })]
    const runs = [
      run({ id: 'r1', automation_id: 'a1', couple_id: 'c1', status: 'running' }),
      run({ id: 'r2', automation_id: 'a1', couple_id: 'c1', status: 'waiting' }),
      run({ id: 'r3', automation_id: 'a1', couple_id: 'c2', status: 'running' }),
    ]
    const waits = [
      wait({ id: 'w1', run_id: 'r2', wake_at: '2026-06-10T09:00:00Z' }),
      wait({ id: 'w2', run_id: 'r3', wake_at: '2026-06-06T09:00:00Z' }),
    ]
    const recent: AuditRow[] = []

    const payload = buildHomePayload({ automations, runs, waits, recent, couples })

    expect(payload.upcomingForCouples).toHaveLength(2)
    expect(payload.upcomingForCouples[0]!.coupleId).toBe('c2')
    expect(payload.upcomingForCouples[0]!.nextWakeAt).toBe('2026-06-06T09:00:00Z')
    expect(payload.upcomingForCouples[1]!.coupleId).toBe('c1')
    expect(payload.upcomingForCouples[1]!.runningCount).toBe(2)
  })

  it('recent activity attaches couple + automation names', () => {
    const couples: CoupleRow[] = [{ id: 'c1', name: 'Sarah & Jake' }]
    const automations = [automation({ id: 'a1', name: 'Quote follow-up' })]
    const runs = [run({ id: 'r1', automation_id: 'a1', couple_id: 'c1' })]
    const waits: WaitRow[] = []
    const recent = [audit({ id: 'au1', automation_id: 'a1', run_id: 'r1' })]

    const payload = buildHomePayload({ automations, runs, waits, recent, couples })

    expect(payload.recentActivity).toHaveLength(1)
    const row = payload.recentActivity[0]!
    expect(row.automationName).toBe('Quote follow-up')
    expect(row.coupleName).toBe('Sarah & Jake')
  })

  it('first errored automation surfaces for the health banner', () => {
    const couples: CoupleRow[] = []
    const automations = [
      automation({ id: 'a1', name: 'Quote follow-up' }),
      automation({ id: 'a2', name: 'Onboarding' }),
    ]
    // Relative to now — hardcoded ISO dates silently age out of the
    // 7-day window and start failing months later for no code change.
    const daysAgo = (n: number) =>
      new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
    const runs = [
      run({ id: 'r1', automation_id: 'a1', couple_id: null, status: 'errored', started_at: daysAgo(2) }),
      run({ id: 'r2', automation_id: 'a2', couple_id: null, status: 'errored', started_at: daysAgo(3) }),
    ]
    const payload = buildHomePayload({ automations, runs, waits: [], recent: [], couples })

    expect(payload.stats.erroredLast7d).toBe(2)
    expect(payload.firstErrorAutomationId).toBe('a1')
    expect(payload.firstErrorAutomationName).toBe('Quote follow-up')
  })
})
