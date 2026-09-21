/**
 * Pure aggregation over `proposal_events` rows for the detail page.
 * Time is summed from `section_viewed` / `package_viewed` deltas (E2);
 * "sessions" is every distinct `session_id` among the rows, not only
 * sessions with an `opened` (E4, revised by C2: a session whose `opened`
 * was lost to a dropped POST still produced real rows, and showing "no
 * opens yet" next to a populated timeline is worse than counting a
 * session whose opening event did not survive). Malformed payloads are
 * skipped, never thrown on: the rows come from an anonymous browser.
 *
 * `sessionTimelines` lives in `./engagement-sessions` (kept under the
 * ~150-line file convention) and is re-exported below so callers only need
 * one import path, as the dashboard (Task 5) expects.
 *
 * @module lib/proposals/engagement
 */

/** One raw `proposal_events` row, as read back for aggregation. */
export interface EngagementRow {
  session_id: string
  type: string
  payload: unknown
  created_at: string
}

/** Total time spent on one proposal block, aggregated across rows. */
export interface SectionSeconds {
  blockId: string
  blockType: string
  seconds: number
}

/** Aggregate engagement across every session for one proposal. */
export interface EngagementSummary {
  /** Distinct session_ids among the rows (E4/C2: not only ones with an 'opened' event -- see the module doc). */
  sessions: number
  firstOpenedAt: string | null
  /** Max created_at across every row. */
  lastSeenAt: string | null
  /** Sum of section_viewed seconds. */
  totalSeconds: number
  /** Sorted by seconds desc. */
  sections: SectionSeconds[]
  /** Sorted by seconds desc. */
  packages: Array<{ optionId: string; seconds: number; selected: number }>
  /** Top of packages, or null. */
  lingeredOptionId: string | null
  /** Furthest step_reached across every session. */
  furthestStep: 'choose' | 'sign' | 'pay' | 'done' | null
  outcome: 'accepted' | 'declined' | null
}

const STEP_ORDER = ['choose', 'sign', 'pay', 'done'] as const
type Step = (typeof STEP_ORDER)[number]

// Why: rows are self-reported by an anonymous browser (Task 4), so every
// payload field is read defensively rather than trusted as typed.
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const isStep = (v: unknown): v is Step => typeof v === 'string' && (STEP_ORDER as readonly string[]).includes(v)

/**
 * Sums `section_viewed` seconds per block across the given rows, sorted by
 * seconds descending. Shared by {@link summarizeEngagement} (over every
 * session) and `sessionTimelines` (over one session's rows).
 */
export function sectionTotals(rows: EngagementRow[]): SectionSeconds[] {
  const byId = new Map<string, SectionSeconds>()
  for (const r of rows) {
    if (r.type !== 'section_viewed') continue
    const p = obj(r.payload)
    const blockId = str(p.blockId)
    if (!blockId) continue
    const cur = byId.get(blockId) ?? { blockId, blockType: str(p.blockType) ?? 'unknown', seconds: 0 }
    cur.seconds += num(p.seconds)
    byId.set(blockId, cur)
  }
  return [...byId.values()].sort((a, b) => b.seconds - a.seconds)
}

/** Sums `package_viewed` seconds and `package_selected` counts, by optionId, seconds desc. */
function packageTotals(rows: EngagementRow[]): Array<{ optionId: string; seconds: number; selected: number }> {
  const byId = new Map<string, { optionId: string; seconds: number; selected: number }>()
  const entry = (optionId: string) => byId.get(optionId) ?? (byId.set(optionId, { optionId, seconds: 0, selected: 0 }), byId.get(optionId)!)
  for (const r of rows) {
    if (r.type !== 'package_viewed') continue
    const optionId = str(obj(r.payload).optionId)
    if (optionId) entry(optionId).seconds += num(obj(r.payload).seconds)
  }
  for (const r of rows) {
    if (r.type !== 'package_selected') continue
    const optionId = str(obj(r.payload).optionId)
    if (optionId) entry(optionId).selected += 1
  }
  return [...byId.values()].sort((a, b) => b.seconds - a.seconds)
}

/** Furthest `step_reached` step across the given rows, or null if none. */
function furthestStepOf(rows: EngagementRow[]): Step | null {
  let best = -1
  for (const r of rows) {
    if (r.type !== 'step_reached') continue
    const step = obj(r.payload).step
    if (isStep(step)) best = Math.max(best, STEP_ORDER.indexOf(step))
  }
  return best >= 0 ? (STEP_ORDER[best] ?? null) : null
}

/** 'declined' if any row is a decline, else 'accepted' if any is an accept, else null. */
function outcomeOf(rows: EngagementRow[]): 'accepted' | 'declined' | null {
  if (rows.some((r) => r.type === 'declined')) return 'declined'
  if (rows.some((r) => r.type === 'accepted')) return 'accepted'
  return null
}

/** Aggregates raw `proposal_events` rows into one summary for the whole proposal. */
export function summarizeEngagement(rows: EngagementRow[]): EngagementSummary {
  const openedRows = rows.filter((r) => r.type === 'opened')
  const firstOpened = openedRows.map((r) => r.created_at).sort()
  const lastSeen = rows.map((r) => r.created_at).sort()
  const packages = packageTotals(rows)
  // m1: only a package that actually banked time is worth calling out as
  // "lingered on" -- a `package_selected` with no matching `package_viewed`
  // (a pick made without the tracker ever seeing the card visible) would
  // otherwise read "Lingered on Gold (0s)".
  const topPackage = packages[0]

  return {
    // E4/C2: every distinct session_id, not only sessions with an
    // 'opened' row -- see the module doc for why.
    sessions: new Set(rows.map((r) => r.session_id)).size,
    firstOpenedAt: firstOpened[0] ?? null,
    lastSeenAt: lastSeen[lastSeen.length - 1] ?? null,
    totalSeconds: rows.filter((r) => r.type === 'section_viewed').reduce((sum, r) => sum + num(obj(r.payload).seconds), 0),
    sections: sectionTotals(rows),
    packages,
    lingeredOptionId: topPackage && topPackage.seconds > 0 ? topPackage.optionId : null,
    furthestStep: furthestStepOf(rows),
    outcome: outcomeOf(rows),
  }
}

export { sessionTimelines } from './engagement-sessions'
export type { SessionTimeline } from './engagement-sessions'
