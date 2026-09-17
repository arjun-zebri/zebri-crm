/**
 * Auto-layout for the workflow canvas.
 *
 * The canvas has no free-form positioning: every node always sits at
 * its computed slot, so the steps stay evenly spaced no matter how a
 * step was dragged around to get reordered. Dragging is a reorder
 * gesture (see `lib/workflows/insert-step.ts`'s `planStepReorderFromDrop`),
 * never a placement, so a dropped node always snaps back to its layout
 * position once the reorder lands.
 *
 * Algorithm: layered top-down from the trigger node. Each action's
 * y is its depth × ROW_GAP. The gap leaves room for a node that has
 * been opened to show its config, which grows it well past the ~72px
 * a collapsed card occupies. x is its branch column × COL_GAP,
 * offset to center under its parent. Branch yes/no paths split
 * left/right.
 *
 * @module app/(dashboard)/workflows/[id]/auto-layout
 */
import type { AutomationActionRow } from '@/types/automations'

const TRIGGER_X = 0
const TRIGGER_Y = 0
/**
 * Vertical distance between two layers of the flow.
 *
 * Sized for a node that has been opened to show its config, which is
 * a good deal taller than the ~72px a collapsed card occupies.
 * Exported so callers and tests describe spacing in terms of it
 * rather than repeating the number.
 */
export const ROW_GAP = 200

/** Horizontal distance between a branch's yes and no columns. */
export const COL_GAP = 260

export interface PlacedAction {
  id: string
  x: number
  y: number
}

/**
 * Lay out the trigger pseudo-node + the action list.
 *
 * Returns positions for every action + a `trigger` position for the
 * canvas's synthetic trigger node.
 */
export function autoLayout(actions: AutomationActionRow[]): {
  trigger: { x: number; y: number }
  actions: Record<string, PlacedAction>
  /**
   * y for the "+ Add action" tail ghost: below EVERY placed node
   * (branch children included), not just the last top-level action.
   * Placing it at `last top-level y + 160` stacked it on top of
   * branch children.
   */
  tailY: number
} {
  const placed: Record<string, PlacedAction> = {}

  const topLevel = actions
    .filter((a) => !a.parent_action_id)
    .sort((a, b) => a.position - b.position)

  // Layered walk from trigger downward.
  layOutSequence(topLevel, actions, 0, TRIGGER_X, 1, placed)

  const maxY = Object.values(placed).reduce((max, p) => Math.max(max, p.y), TRIGGER_Y)
  return {
    trigger: { x: TRIGGER_X, y: TRIGGER_Y },
    actions: placed,
    // One `ROW_GAP`, like every other gap. It was 160, which is a
    // different pitch from the rest of the column, so the tail ghost sat
    // closer to the last step than the steps sat to each other, and a
    // step added from it persisted that tighter position for good.
    tailY: maxY + ROW_GAP,
  }
}

function layOutSequence(
  sequence: AutomationActionRow[],
  allActions: AutomationActionRow[],
  branchOffsetX: number,
  centerX: number,
  startDepth: number,
  out: Record<string, PlacedAction>,
): number {
  let depth = startDepth
  for (const action of sequence) {
    const x = centerX + branchOffsetX
    const y = depth * ROW_GAP
    out[action.id] = { id: action.id, x, y }

    if (action.type === 'branch') {
      const yes = allActions
        .filter((a) => a.parent_action_id === action.id && a.branch_path === 'yes')
        .sort((a, b) => a.position - b.position)
      const no = allActions
        .filter((a) => a.parent_action_id === action.id && a.branch_path === 'no')
        .sort((a, b) => a.position - b.position)

      const branchDepth = depth + 1
      // The recursive calls return the depth BELOW each arm's whole
      // subtree (nested branches included). Counting only direct
      // children (yes.length) made anything after the branch collide
      // with nested chains.
      const yesEnd = layOutSequence(yes, allActions, -COL_GAP / 2, x, branchDepth, out)
      const noEnd = layOutSequence(no, allActions, COL_GAP / 2, x, branchDepth, out)
      depth = Math.max(yesEnd, noEnd, branchDepth) + 1
    } else {
      depth += 1
    }
  }
  return depth
}
