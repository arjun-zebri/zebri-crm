/**
 * Per-session engagement timelines for the proposal detail page.
 *
 * Split out of `./engagement.ts` to keep both files under the file-length
 * convention. `sectionTotals` is reused from there so section rankings use
 * one implementation for both the whole-proposal summary and each session.
 *
 * @module lib/proposals/engagement-sessions
 */
import type { EngagementRow, SectionSeconds } from './engagement'
import { sectionTotals } from './engagement'

const STEP_ORDER = ['choose', 'sign', 'pay', 'done'] as const
type Step = (typeof STEP_ORDER)[number]

// Why: mirrors the defensive readers in `./engagement.ts` -- these rows are
// self-reported by an anonymous browser, never trusted as typed.
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const isStep = (v: unknown): v is Step => typeof v === 'string' && (STEP_ORDER as readonly string[]).includes(v)

/** One session's engagement with a single proposal. */
export interface SessionTimeline {
  sessionId: string
  startedAt: string
  endedAt: string
  /** Sum of this session's section_viewed seconds. */
  seconds: number
  /** Sorted by seconds desc. */
  sections: SectionSeconds[]
  /** In the order first reached, deduped. */
  steps: Step[]
  /** Last package_selected in this session, or null. */
  selectedOptionId: string | null
  outcome: 'accepted' | 'declined' | null
}

function groupBySession(rows: EngagementRow[]): Map<string, EngagementRow[]> {
  const bySession = new Map<string, EngagementRow[]>()
  for (const r of rows) {
    const group = bySession.get(r.session_id) ?? []
    group.push(r)
    bySession.set(r.session_id, group)
  }
  return bySession
}

/** step_reached steps in the order first reached (by created_at), deduped. */
function stepsOf(rows: EngagementRow[]): Step[] {
  const ordered = rows.filter((r) => r.type === 'step_reached').sort((a, b) => a.created_at.localeCompare(b.created_at))
  const seen = new Set<Step>()
  const steps: Step[] = []
  for (const r of ordered) {
    const step = obj(r.payload).step
    if (isStep(step) && !seen.has(step)) {
      seen.add(step)
      steps.push(step)
    }
  }
  return steps
}

/** optionId of the last package_selected event in the session, or null. */
function selectedOptionIdOf(rows: EngagementRow[]): string | null {
  const selections = rows.filter((r) => r.type === 'package_selected').sort((a, b) => a.created_at.localeCompare(b.created_at))
  const last = selections[selections.length - 1]
  return last ? str(obj(last.payload).optionId) : null
}

/** 'declined' if the session has a decline, else 'accepted' if it has an accept, else null. */
function outcomeOf(rows: EngagementRow[]): 'accepted' | 'declined' | null {
  if (rows.some((r) => r.type === 'declined')) return 'declined'
  if (rows.some((r) => r.type === 'accepted')) return 'accepted'
  return null
}

function timelineFor(sessionId: string, rows: EngagementRow[]): SessionTimeline {
  const timestamps = rows.map((r) => r.created_at).sort()
  return {
    sessionId,
    startedAt: timestamps[0] ?? '',
    endedAt: timestamps[timestamps.length - 1] ?? '',
    seconds: rows.filter((r) => r.type === 'section_viewed').reduce((sum, r) => sum + num(obj(r.payload).seconds), 0),
    sections: sectionTotals(rows),
    steps: stepsOf(rows),
    selectedOptionId: selectedOptionIdOf(rows),
    outcome: outcomeOf(rows),
  }
}

/**
 * Builds one {@link SessionTimeline} per distinct session_id, newest session
 * (by startedAt) first, capped at `limit`.
 */
export function sessionTimelines(rows: EngagementRow[], limit = 20): SessionTimeline[] {
  const timelines = [...groupBySession(rows).entries()].map(([sessionId, group]) => timelineFor(sessionId, group))
  return timelines.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0)).slice(0, limit)
}
