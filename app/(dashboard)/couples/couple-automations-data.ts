/**
 * Pure data shaping for the couple → Automations tab.
 *
 * Kept React-free so it's unit-testable and so the orchestrator
 * ({@link CoupleAutomations}) stays a thin fetch-and-compose shell:
 * turn raw `automation_runs` + `automation_audit_log` rows into the
 * narrated, automation-grouped {@link AutomationGroup}s the UI renders.
 *
 * @module app/(dashboard)/couples/couple-automations-data
 */
import { narrateAuditEntry } from '@/lib/automations/audit-log/narrate'
import type { AuditEventName } from '@/lib/automations/audit-log/narrate'
import { getTriggerSpec } from '@/lib/automations/triggers'
import type { ActionType, AutomationRunRow, AutomationStatus, RunStatus, TriggerType } from '@/types/automations'

import type { RunActivity } from './couple-automations-feed'
import { HEADLINE_PRIORITY } from './couple-automations-shared'

/** A run joined to a thin slice of its automation. */
export interface RunWithAutomation extends AutomationRunRow {
  automation: { id: string; name: string; trigger_type: string; status: AutomationStatus } | null
}

/** Audit row joined to its action's type + label (for narration). */
export interface AuditRow {
  id: string
  run_id: string
  event: AuditEventName
  details: Record<string, unknown> | null
  created_at: string
  action: { type: ActionType; label: string | null } | null
}

/** Runs grouped under the automation that produced them. */
export interface AutomationGroup {
  key: string
  /** Display title — the automation name, or its trigger if unnamed. */
  title: string
  triggerLabel: string
  /** One-line plain-English description of the trigger, for the card subtitle. */
  triggerDescription: string
  runs: RunActivity[]
  headline: RunStatus
  /** Most recent narrated outcome across the group, for the collapsed row. */
  lastOutcome: string | null
  /** Timestamp of the most recent run (completed, else started), for "Last run". */
  lastRunAt: string | null
}

/** Names that carry no signal — fall back to the trigger label instead. */
const GENERIC_NAMES = new Set(['', 'untitled automation', 'automation'])

/** Newest-meaningful narrated line across a group's runs, if any. */
function latestOutcome(runs: RunActivity[]): string | null {
  for (const run of runs) {
    const last = run.lines[run.lines.length - 1]
    if (last) return last.text
  }
  return null
}

/** At-a-glance counts for the summary strip. */
export interface RunSummary {
  /** Distinct *enabled* (status `active`) automations that have run for this couple. */
  active: number
  /** Runs currently waiting on a scheduled step. */
  waiting: number
  /** Runs that errored in the last 30 days. */
  failedRecently: number
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Roll the run list up into the header summary counts.
 *
 * @param runs - this couple's runs
 * @param nowMs - current time in ms (passed in so this stays pure)
 */
export function summarizeRuns(runs: RunWithAutomation[], nowMs: number): RunSummary {
  // "Active" = how many of the automations touching this couple are still
  // enabled (status 'active'), not how many have a run in flight — that's
  // what reads correctly next to the list of automation cards.
  const activeAutomations = new Set<string>()
  let waiting = 0
  let failedRecently = 0
  for (const run of runs) {
    if (run.automation?.status === 'active') activeAutomations.add(run.automation.id)
    if (run.status === 'waiting') waiting += 1
    if (run.status === 'errored' && nowMs - new Date(run.started_at).getTime() <= THIRTY_DAYS_MS) {
      failedRecently += 1
    }
  }
  return { active: activeAutomations.size, waiting, failedRecently }
}

/**
 * Build the narrated activity feed for each run from its audit rows.
 *
 * @param runs - this couple's runs (any order)
 * @param audit - audit rows for those runs, oldest-first
 * @param wakeByRun - run id → next scheduled step time (waiting runs)
 * @returns run id → its narrated {@link RunActivity}
 */
export function buildActivity(
  runs: RunWithAutomation[],
  audit: AuditRow[],
  wakeByRun: Map<string, string> = new Map(),
): Map<string, RunActivity> {
  const linesByRun = new Map<string, AuditRow[]>()
  for (const row of audit) linesByRun.set(row.run_id, [...(linesByRun.get(row.run_id) ?? []), row])

  const out = new Map<string, RunActivity>()
  for (const run of runs) {
    const lines = (linesByRun.get(run.id) ?? [])
      .map((row) => {
        const n = narrateAuditEntry({
          event: row.event,
          actionType: row.action?.type ?? null,
          actionLabel: row.action?.label ?? null,
          details: row.details ?? {},
        })
        return n ? { id: row.id, at: row.created_at, ...n } : null
      })
      .filter((l): l is RunActivity['lines'][number] => l !== null)
    out.set(run.id, {
      runId: run.id,
      status: run.status,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      wakeAt: wakeByRun.get(run.id) ?? null,
      lines,
    })
  }
  return out
}

/**
 * Group runs by automation (live groups first), attaching each run's
 * narrated activity and a collapsed-row title + last outcome.
 *
 * @param runs - this couple's runs, newest-first
 * @param activityByRun - output of {@link buildActivity}
 */
export function groupRuns(
  runs: RunWithAutomation[],
  activityByRun: Map<string, RunActivity>,
): AutomationGroup[] {
  const byAutomation = new Map<string, RunWithAutomation[]>()
  for (const run of runs) {
    const key = run.automation?.id ?? run.automation_id
    byAutomation.set(key, [...(byAutomation.get(key) ?? []), run])
  }
  const groups = [...byAutomation.entries()].map(([key, grouped]) => {
    const first = grouped[0] as RunWithAutomation
    const name = (first.automation?.name ?? '').trim()
    const spec = first.automation ? getTriggerSpec(first.automation.trigger_type as TriggerType) : null
    const triggerLabel = first.automation ? (spec?.ui.label ?? first.automation.trigger_type) : ''
    const activity = grouped.map((r) => activityByRun.get(r.id)).filter((a): a is RunActivity => Boolean(a))
    return {
      key,
      title: GENERIC_NAMES.has(name.toLowerCase()) ? triggerLabel || 'Automation' : name,
      triggerLabel,
      triggerDescription: spec?.ui.description ?? '',
      runs: activity,
      headline: HEADLINE_PRIORITY.find((s) => grouped.some((r) => r.status === s)) ?? first.status,
      lastOutcome: latestOutcome(activity),
      // Runs arrive newest-first, so the first run is the most recent.
      lastRunAt: first.completed_at ?? first.started_at,
    }
  })
  const isLive = (g: AutomationGroup) => HEADLINE_PRIORITY.includes(g.headline)
  return groups.sort((a, b) => Number(isLive(b)) - Number(isLive(a)))
}
