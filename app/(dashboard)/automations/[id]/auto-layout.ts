/**
 * Auto-layout for actions without persisted x/y coordinates.
 *
 * The first time a user opens a canvas (or for any action created
 * before this column existed), we need a sensible default layout
 * so nothing renders at (0, 0) stacked on top of each other.
 *
 * Algorithm: layered top-down from the trigger node. Each action's
 * y is its depth × ROW_GAP. x is its branch column × COL_GAP,
 * offset to center under its parent. Branch yes/no paths split
 * left/right.
 *
 * This is layout-on-display only: positions aren't persisted
 * unless the user actually drags a node. That keeps the canvas
 * idempotent - a fresh load with no manual edits always renders
 * the same way.
 *
 * @module app/(dashboard)/automations/[id]/auto-layout
 */
import type { AutomationActionRow } from '@/types/automations'

const TRIGGER_X = 0
const TRIGGER_Y = 0
const ROW_GAP = 140
const COL_GAP = 260

export interface PlacedAction {
  id: string
  x: number
  y: number
  fromPersisted: boolean
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
} {
  const placed: Record<string, PlacedAction> = {}

  const topLevel = actions
    .filter((a) => !a.parent_action_id)
    .sort((a, b) => a.position - b.position)

  // Layered walk from trigger downward.
  layOutSequence(topLevel, actions, 0, TRIGGER_X, 1, placed)

  return {
    trigger: { x: TRIGGER_X, y: TRIGGER_Y },
    actions: placed,
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
    const x = action.position_x ?? centerX + branchOffsetX
    const y = action.position_y ?? depth * ROW_GAP
    out[action.id] = {
      id: action.id,
      x,
      y,
      fromPersisted: action.position_x !== null && action.position_y !== null,
    }

    if (action.type === 'branch') {
      const yes = allActions
        .filter((a) => a.parent_action_id === action.id && a.branch_path === 'yes')
        .sort((a, b) => a.position - b.position)
      const no = allActions
        .filter((a) => a.parent_action_id === action.id && a.branch_path === 'no')
        .sort((a, b) => a.position - b.position)

      const branchDepth = depth + 1
      layOutSequence(yes, allActions, -COL_GAP / 2, x, branchDepth, out)
      layOutSequence(no, allActions, COL_GAP / 2, x, branchDepth, out)

      const maxBranchDepth = Math.max(
        depth + yes.length + 1,
        depth + no.length + 1,
        branchDepth,
      )
      depth = maxBranchDepth + 1
    } else {
      depth += 1
    }
  }
  return depth
}
