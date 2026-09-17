/**
 * Where a step should slot in among its siblings - inserted fresh, or
 * moved there by a drag.
 *
 * `workflow_template_steps.position` is a sparse integer specifically so
 * a mid-list insert never has to renumber the whole list (see the column
 * comment in `20260905000000_create_workflows_foundation.sql`): a fresh
 * step just takes the integer midpoint of its two new neighbours. This
 * module is the client-side half of that design - it decides the
 * midpoint, and only falls back to spreading the list back out once
 * repeated inserts into the same gap have closed it.
 *
 * The canvas has no free-form positioning: dragging a step is a reorder
 * gesture, not a placement, so `planStepReorderFromDrop` reuses the same
 * midpoint math to decide where the dragged step lands among its true
 * siblings, from nothing but where it was dropped.
 *
 * @module lib/workflows/insert-step
 */
import type { AutomationActionRow, BranchPath } from '@/types/automations'

/** Gap used between fresh siblings, matching the tail-add convention in `[id]/page.tsx`. */
const SIBLING_GAP = 100

export interface StepRenumber {
  stepId: string
  position: number
}

export interface InsertionPlan {
  /** The list the new step joins: same parent + branch as its neighbours. */
  parentStepId: string | null
  branchPath: BranchPath | null
  /** Position to create the new step at. */
  position: number
  /**
   * Present only when no integer sat between the two neighbours. Apply
   * these position updates to the existing siblings first, which opens
   * an even gap for `position` to land in.
   */
  renumber?: StepRenumber[]
}

function siblingsOf(
  actions: AutomationActionRow[],
  parentStepId: string | null,
  branchPath: BranchPath | null,
): AutomationActionRow[] {
  return actions
    .filter(
      (a) => (a.parent_action_id ?? null) === parentStepId && (a.branch_path ?? null) === branchPath,
    )
    .sort((a, b) => a.position - b.position)
}

/**
 * Plan the insertion of a new step immediately above or below `anchor`.
 *
 * The new step always joins `anchor`'s own list (its siblings under the
 * same parent/branch), so this never re-parents anything - it only ever
 * decides a position, and, in the rare case the surrounding gap has
 * closed, a batch of sibling positions to open one back up.
 */
export function planStepInsertion(
  actions: AutomationActionRow[],
  anchor: AutomationActionRow,
  direction: 'above' | 'below',
): InsertionPlan {
  const parentStepId = anchor.parent_action_id ?? null
  const branchPath = anchor.branch_path ?? null
  const siblings = siblingsOf(actions, parentStepId, branchPath)
  const anchorIndex = siblings.findIndex((s) => s.id === anchor.id)
  const insertAt = direction === 'above' ? anchorIndex : anchorIndex + 1

  const prev = siblings[insertAt - 1]
  const next = siblings[insertAt]
  const lower = prev ? prev.position : (next ? next.position - SIBLING_GAP * 2 : 0)
  const upper = next ? next.position : (prev ? prev.position + SIBLING_GAP * 2 : SIBLING_GAP * 2)

  if (upper - lower >= 2) {
    return { parentStepId, branchPath, position: Math.floor((lower + upper) / 2) }
  }

  // The gap closed (this is the Nth insert into the same slot). Spread
  // every sibling in the list back out to multiples of SIBLING_GAP,
  // leaving room at `insertAt` for the new step.
  const renumber = siblings.map((s, i) => ({
    stepId: s.id,
    position: (i + (i >= insertAt ? 1 : 0) + 1) * SIBLING_GAP,
  }))
  return { parentStepId, branchPath, position: (insertAt + 1) * SIBLING_GAP, renumber }
}

/**
 * Plan moving an already-existing step to sit above or below `anchor`.
 *
 * `anchor` must be one of `moving`'s own siblings (same parent + branch):
 * this only ever reorders a step within its own list, it never
 * re-parents one into a different branch. Excluding `moving` from the
 * sibling list before planning is what makes this a move rather than a
 * second insert - `moving`'s own old slot doesn't count as a neighbour.
 */
export function planStepReorder(
  actions: AutomationActionRow[],
  moving: AutomationActionRow,
  anchor: AutomationActionRow,
  direction: 'above' | 'below',
): InsertionPlan {
  return planStepInsertion(
    actions.filter((a) => a.id !== moving.id),
    anchor,
    direction,
  )
}

/**
 * Resolve a canvas drag into a reorder plan, from nothing but the y each
 * sibling already sits at.
 *
 * The canvas always snaps back to auto-layout after a drop, so a drag's
 * (x, y) is used for exactly one thing: picking a slot among `moving`'s
 * true siblings (same parent + branch as it already has). Where the node
 * was physically dropped relative to some other branch's column never
 * matters, since only its own siblings are ever candidates.
 *
 * Returns `null` when `moving` has no siblings to reorder against (a
 * drop that can't change anything).
 */
export function planStepReorderFromDrop(
  actions: AutomationActionRow[],
  positions: Record<string, { x: number; y: number }>,
  movingId: string,
  dropY: number,
): InsertionPlan | null {
  const moving = actions.find((a) => a.id === movingId)
  if (!moving) return null
  const siblings = siblingsOf(actions, moving.parent_action_id ?? null, moving.branch_path ?? null).filter(
    (s) => s.id !== movingId,
  )
  if (siblings.length === 0) return null

  const byY = [...siblings].sort((a, b) => (positions[a.id]?.y ?? 0) - (positions[b.id]?.y ?? 0))
  const next = byY.find((s) => (positions[s.id]?.y ?? 0) > dropY)
  return next
    ? planStepReorder(actions, moving, next, 'above')
    : planStepReorder(actions, moving, byY[byY.length - 1]!, 'below')
}
