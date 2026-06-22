/**
 * Pure aggregation of the four raw read results into the
 * {@link AutomationsHomePayload} the /automations home page
 * consumes.
 *
 * Kept separate from the server action so it's unit-testable
 * without hitting Supabase: synthesise four arrays of rows,
 * call {@link buildHomePayload}, assert the shape.
 *
 * @module lib/automations/home-payload
 */
import type {
  AutomationRow,
  AutomationsHomePayload,
  CoupleInFlow,
  EnrichedAutomationRow,
  RecentActivityRow,
} from '@/types/automations'

import { triggerRegistry } from './triggers'

const SEVEN_DAYS_MS = 7 * 86_400_000

export interface RunRow {
  id: string
  automation_id: string
  couple_id: string | null
  status: 'running' | 'waiting' | 'paused' | 'completed' | 'errored' | 'cancelled'
  started_at: string
  completed_at: string | null
}

export interface WaitRow {
  id: string
  run_id: string
  wake_at: string
  consumed_at: string | null
}

export interface AuditRow {
  id: string
  automation_id: string
  run_id: string | null
  event: string
  details: Record<string, unknown> | null
  created_at: string
}

export interface CoupleRow {
  id: string
  name: string
}

export interface HomePayloadInputs {
  automations: AutomationRow[]
  runs: RunRow[]
  waits: WaitRow[]
  recent: AuditRow[]
  couples: CoupleRow[]
}

/**
 * Build the home payload from raw rows. Pure: no I/O.
 */
export function buildHomePayload(inputs: HomePayloadInputs): AutomationsHomePayload {
  const { automations, runs, waits, recent, couples } = inputs
  const now = Date.now()
  const sevenDaysAgo = now - SEVEN_DAYS_MS

  const coupleNameById = new Map<string, string>()
  for (const c of couples) coupleNameById.set(c.id, c.name)

  const automationNameById = new Map<string, string>()
  for (const a of automations) automationNameById.set(a.id, a.name)

  /* ── Per-automation aggregates ─────────────────────────── */

  const runCountPerAutomation = new Map<string, number>()
  const completedCountPerAutomation = new Map<string, number>()
  const erroredCountPerAutomation = new Map<string, number>()
  const lastFiredPerAutomation = new Map<string, string>()

  for (const run of runs) {
    runCountPerAutomation.set(run.automation_id, (runCountPerAutomation.get(run.automation_id) ?? 0) + 1)
    if (run.status === 'completed') {
      completedCountPerAutomation.set(
        run.automation_id,
        (completedCountPerAutomation.get(run.automation_id) ?? 0) + 1,
      )
    } else if (run.status === 'errored') {
      erroredCountPerAutomation.set(
        run.automation_id,
        (erroredCountPerAutomation.get(run.automation_id) ?? 0) + 1,
      )
    }
    const existing = lastFiredPerAutomation.get(run.automation_id)
    if (!existing || run.started_at > existing) {
      lastFiredPerAutomation.set(run.automation_id, run.started_at)
    }
  }

  const runById = new Map<string, RunRow>()
  for (const r of runs) runById.set(r.id, r)

  const nextWakePerAutomation = new Map<string, string>()
  for (const w of waits) {
    if (w.consumed_at) continue
    const run = runById.get(w.run_id)
    if (!run) continue
    const existing = nextWakePerAutomation.get(run.automation_id)
    if (!existing || w.wake_at < existing) {
      nextWakePerAutomation.set(run.automation_id, w.wake_at)
    }
  }

  const enriched: EnrichedAutomationRow[] = automations.map((a) => {
    const completedCount = completedCountPerAutomation.get(a.id) ?? 0
    const erroredCount = erroredCountPerAutomation.get(a.id) ?? 0
    const terminalCount = completedCount + erroredCount
    // Success rate is over runs that *finished* (completed or errored).
    // In-flight runs (running / waiting) don't count yet - they haven't
    // succeeded or failed. NULL when no terminal data is available.
    const successRate = terminalCount > 0 ? completedCount / terminalCount : null
    return {
      ...a,
      runCount: runCountPerAutomation.get(a.id) ?? 0,
      completedCount,
      erroredCount,
      successRate,
      lastFiredAt: lastFiredPerAutomation.get(a.id) ?? null,
      nextWakeAt: nextWakePerAutomation.get(a.id) ?? null,
      triggerLabel: triggerRegistry[a.trigger_type]?.ui.label ?? a.trigger_type,
    }
  })

  /* ── Stats strip ───────────────────────────────────────── */

  const actionsThisWeek = recent.reduce(
    (n, r) => (Date.parse(r.created_at) >= sevenDaysAgo ? n + 1 : n),
    0,
  )
  const upcoming = waits.filter(
    (w) => !w.consumed_at && Date.parse(w.wake_at) <= now + SEVEN_DAYS_MS,
  ).length
  const active = automations.filter((a) => a.status === 'active').length
  const erroredRuns = runs.filter(
    (r) => r.status === 'errored' && Date.parse(r.started_at) >= sevenDaysAgo,
  )
  const erroredLast7d = erroredRuns.length

  const firstError = erroredRuns
    .slice()
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0]
  const firstErrorAutomationId = firstError?.automation_id ?? null
  const firstErrorAutomationName = firstErrorAutomationId
    ? automationNameById.get(firstErrorAutomationId) ?? null
    : null

  /* ── Couples in active flows ───────────────────────────── */

  const couplesAgg = new Map<string, { runningCount: number; nextWakeAt: string | null }>()
  for (const r of runs) {
    if (r.status !== 'running' && r.status !== 'waiting') continue
    if (!r.couple_id) continue
    const entry = couplesAgg.get(r.couple_id) ?? { runningCount: 0, nextWakeAt: null }
    entry.runningCount += 1
    couplesAgg.set(r.couple_id, entry)
  }
  for (const w of waits) {
    if (w.consumed_at) continue
    const run = runById.get(w.run_id)
    if (!run || !run.couple_id) continue
    if (run.status !== 'running' && run.status !== 'waiting') continue
    const entry = couplesAgg.get(run.couple_id)
    if (!entry) continue
    if (!entry.nextWakeAt || w.wake_at < entry.nextWakeAt) entry.nextWakeAt = w.wake_at
  }
  const upcomingForCouples: CoupleInFlow[] = Array.from(couplesAgg.entries())
    .map(([coupleId, agg]) => ({
      coupleId,
      coupleName: coupleNameById.get(coupleId) ?? 'Unknown couple',
      runningCount: agg.runningCount,
      nextWakeAt: agg.nextWakeAt,
    }))
    .sort((a, b) => {
      if (a.nextWakeAt && b.nextWakeAt) return a.nextWakeAt.localeCompare(b.nextWakeAt)
      if (a.nextWakeAt) return -1
      if (b.nextWakeAt) return 1
      return b.runningCount - a.runningCount
    })

  /* ── Recent activity feed ──────────────────────────────── */

  const recentActivity: RecentActivityRow[] = recent.slice(0, 10).map((row) => {
    const run = row.run_id ? runById.get(row.run_id) : null
    const coupleName = run?.couple_id ? coupleNameById.get(run.couple_id) ?? null : null
    const automationName = automationNameById.get(row.automation_id) ?? 'Automation'
    const actionLabel = (row.details && typeof row.details === 'object' && 'action_label' in row.details)
      ? String((row.details as Record<string, unknown>)['action_label'])
      : null
    const summary = actionLabel ? `${actionLabel} - ${automationName}` : automationName
    return {
      id: row.id,
      when: row.created_at,
      automationName,
      coupleName,
      summary,
    }
  })

  return {
    stats: {
      actionsThisWeek,
      upcoming,
      active,
      erroredLast7d,
      totalAutomations: automations.length,
    },
    firstErrorAutomationId,
    firstErrorAutomationName,
    upcomingForCouples,
    automations: enriched,
    recentActivity,
  }
}
