/**
 * Auto-layout tests for the automation canvas.
 *
 * Regression coverage for the overlapping-blocks bug (2026-08-12):
 * the "+ Add action" tail ghost was placed at `last top-level y +
 * 160`, landing on top of branch children, and the depth walk only
 * counted a branch's direct children so nested chains collided with
 * whatever followed the branch.
 */
import { describe, expect, it } from 'vitest'

import { COL_GAP, ROW_GAP, autoLayout } from '@/app/(dashboard)/automations/[id]/auto-layout'
import type { AutomationActionRow } from '@/types/automations'

let seq = 0
function row(overrides: Partial<AutomationActionRow>): AutomationActionRow {
  seq += 1
  return {
    id: `a${seq}`,
    automation_id: 'auto-1',
    user_id: 'user-1',
    type: 'send_email',
    label: null,
    config: {},
    position: seq * 100,
    parent_action_id: null,
    branch_path: null,
    position_x: null,
    position_y: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as AutomationActionRow
}

describe('autoLayout', () => {
  it('lays a simple chain top-down under the trigger', () => {
    const a = row({ id: 'a', position: 100 })
    const b = row({ id: 'b', position: 200 })
    const { trigger, actions } = autoLayout([a, b])
    expect(trigger).toEqual({ x: 0, y: 0 })
    // Depth × ROW_GAP, rather than the literal spacing: the gap is a
    // tunable, the layered walk is the behaviour under test.
    expect(actions['a']).toMatchObject({ x: 0, y: ROW_GAP })
    expect(actions['b']).toMatchObject({ x: 0, y: ROW_GAP * 2 })
  })

  it('splits branch children left/right one row below the branch', () => {
    const branch = row({ id: 'br', type: 'branch', position: 100 })
    const yes = row({ id: 'y1', parent_action_id: 'br', branch_path: 'yes', position: 100 })
    const no = row({ id: 'n1', parent_action_id: 'br', branch_path: 'no', position: 100 })
    const { actions } = autoLayout([branch, yes, no])
    expect(actions['br']).toMatchObject({ x: 0, y: ROW_GAP })
    expect(actions['y1']).toMatchObject({ x: -COL_GAP / 2, y: ROW_GAP * 2 })
    expect(actions['n1']).toMatchObject({ x: COL_GAP / 2, y: ROW_GAP * 2 })
  })

  it('respects persisted coordinates', () => {
    const a = row({ id: 'a', position: 100, position_x: 42, position_y: 999 })
    const { actions } = autoLayout([a])
    expect(actions['a']).toMatchObject({ x: 42, y: 999, fromPersisted: true })
  })

  it('places actions after a branch below the deepest NESTED child', () => {
    // outer branch → yes: inner branch → yes: two-step chain.
    // The step after the outer branch must clear the whole subtree,
    // not just the outer branch's single direct child.
    const outer = row({ id: 'outer', type: 'branch', position: 100 })
    const inner = row({ id: 'inner', type: 'branch', parent_action_id: 'outer', branch_path: 'yes', position: 100 })
    const c1 = row({ id: 'c1', parent_action_id: 'inner', branch_path: 'yes', position: 100 })
    const c2 = row({ id: 'c2', parent_action_id: 'inner', branch_path: 'yes', position: 200 })
    const after = row({ id: 'after', position: 200 })
    const { actions } = autoLayout([outer, inner, c1, c2, after])
    const deepestChildY = Math.max(
      actions['inner']!.y,
      actions['c1']!.y,
      actions['c2']!.y,
    )
    expect(actions['after']!.y).toBeGreaterThan(deepestChildY)
  })

  it('returns a tail y that clears every placed node', () => {
    const branch = row({ id: 'br', type: 'branch', position: 100 })
    const yes = row({ id: 'y1', parent_action_id: 'br', branch_path: 'yes', position: 100 })
    const no = row({ id: 'n1', parent_action_id: 'br', branch_path: 'no', position: 100 })
    const no2 = row({ id: 'n2', parent_action_id: 'br', branch_path: 'no', position: 200 })
    const { actions, tailY } = autoLayout([branch, yes, no, no2])
    for (const placed of Object.values(actions)) {
      expect(tailY).toBeGreaterThan(placed.y)
    }
  })

  it('puts the tail directly under the trigger when there are no actions', () => {
    const { tailY } = autoLayout([])
    expect(tailY).toBe(160)
  })
})
