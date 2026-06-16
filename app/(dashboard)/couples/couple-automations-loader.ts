/**
 * Data loader for the couple Automations tab.
 *
 * The IO seam: one RLS-scoped read of `automation_runs`, then a
 * parallel read of the audit trail + live waits for those runs, shaped
 * (via `couple-automations-data`) into what the tab renders. Split
 * from the pure transforms so the orchestrator stays a thin shell and
 * the shaping logic stays DB-free + unit-testable.
 *
 * @module app/(dashboard)/couples/couple-automations-loader
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { buildActivity, type AuditRow, type RunWithAutomation } from './couple-automations-data'
import type { RunActivity } from './couple-automations-feed'

/** The fully-shaped data the couple Automations tab renders. */
export interface CoupleAutomationsData {
  runs: RunWithAutomation[]
  activity: Map<string, RunActivity>
  /** Fetch time (ms) — drives the summary's 30-day window. */
  loadedAt: number
}

/**
 * Load + shape every run, audit line, and pending wait for a couple.
 *
 * @param supabase - the caller's RLS-scoped client
 * @param coupleId - the couple to load runs for
 */
export async function loadCoupleAutomations(
  supabase: SupabaseClient,
  coupleId: string,
): Promise<CoupleAutomationsData> {
  const { data: runRows } = await supabase
    .from('automation_runs' as never)
    .select('*, automation:automations(id, name, trigger_type)')
    .eq('couple_id', coupleId)
    .order('started_at', { ascending: false })
  const runs = (runRows as RunWithAutomation[] | null) ?? []

  let audit: AuditRow[] = []
  const wakeByRun = new Map<string, string>()
  if (runs.length > 0) {
    const runIds = runs.map((r) => r.id)
    const [{ data: auditRows }, { data: waitRows }] = await Promise.all([
      supabase
        .from('automation_audit_log' as never)
        .select('id, run_id, event, details, created_at, action:automation_actions(type, label)')
        .in('run_id', runIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('automation_waits' as never)
        .select('run_id, wake_at')
        .in('run_id', runIds)
        .is('consumed_at', null),
    ])
    audit = (auditRows as AuditRow[] | null) ?? []
    for (const w of (waitRows as { run_id: string; wake_at: string }[] | null) ?? []) {
      // Earliest pending wake wins (a run has at most one live wait).
      if (!wakeByRun.has(w.run_id)) wakeByRun.set(w.run_id, w.wake_at)
    }
  }
  return { runs, activity: buildActivity(runs, audit, wakeByRun), loadedAt: Date.now() }
}
