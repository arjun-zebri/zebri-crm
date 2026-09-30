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
 * `sessionTimelines` lives in `./sessions` (kept under the
 * ~150-line file convention) and is re-exported below so callers only need
 * one import path, as the dashboard (Task 5) expects.
 *
 * @module features/proposals/analytics/summary
 */
import { num, obj, str } from './read'

/** One raw `proposal_events` row, as read back for aggregation. */
export interface EngagementRow {
  session_id: string
  type: string
  payload: unknown
  created_at: string
}

/** Total time spent on one proposal section, aggregated across rows. */
export interface SectionSeconds {
  /** Layout v2 section id, or the v1 block id for older rows. */
  id: string
  /** Layout v2 section kind, or the v1 block type for older rows. */
  kind: string
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

const isStep = (v: unknown): v is Step => typeof v === 'string' && (STEP_ORDER as readonly string[]).includes(v)

/**
 * Sums `section_viewed` seconds per section across the given rows, sorted by
 * seconds descending. Shared by {@link summarizeEngagement} (over every
 * session) and `sessionTimelines` (over one session's rows).
 */
export function sectionTotals(rows: EngagementRow[]): SectionSeconds[] {
  const byId = new Map<string, SectionSeconds>()
  for (const r of rows) {
    if (r.type !== 'section_viewed') continue
    const p = obj(r.payload)
    // v1 rows name the block, v2 rows the Layout v2 section. Both are "a
    // section of the page" to the MC, so they fold into one id / kind pair.
    const id = str(p.sectionId) ?? str(p.blockId)
    if (!id) continue
    const kind = str(p.sectionKind) ?? str(p.blockType) ?? 'unknown'
    const cur = byId.get(id) ?? { id, kind, seconds: 0 }
    cur.seconds += num(p.seconds)
    byId.set(id, cur)
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

export { sessionTimelines } from './sessions'
export type { SessionTimeline } from './sessions'
