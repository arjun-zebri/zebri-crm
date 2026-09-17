/**
 * A mid-list insert must never touch a step nobody asked to move, and
 * `position` is a plain integer column, so the interesting behaviour is
 * all in how tight neighbouring positions get before there is nothing
 * left to hand the new step.
 */
import { describe, expect, it } from 'vitest';

import { planStepInsertion, planStepReorder, planStepReorderFromDrop } from '@/lib/workflows/insert-step';
import type { AutomationActionRow, BranchPath } from '@/types/automations';

function step(
  id: string,
  position: number,
  overrides: Partial<AutomationActionRow> = {},
): AutomationActionRow {
  return {
    id,
    automation_id: 'template-1',
    position,
    type: 'wait',
    config: {},
    parent_action_id: null,
    branch_path: null,
    label: null,
    disabled: false,
    position_x: null,
    position_y: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('planStepInsertion', () => {
  it('lands the new step on the integer midpoint of its two neighbours', () => {
    const a = step('a', 100);
    const b = step('b', 200);
    const plan = planStepInsertion([a, b], b, 'above');
    expect(plan).toEqual({ parentStepId: null, branchPath: null, position: 150 });
  });

  it('inserting below a step is the same slot as inserting above its successor', () => {
    const a = step('a', 100);
    const b = step('b', 200);
    expect(planStepInsertion([a, b], a, 'below')).toEqual(
      planStepInsertion([a, b], b, 'above'),
    );
  });

  it('inserting above the first step in a list makes room before it', () => {
    const a = step('a', 100);
    const plan = planStepInsertion([a], a, 'above');
    expect(plan.position).toBeLessThan(100);
    expect(plan.renumber).toBeUndefined();
  });

  it('inserting below the last step in a list continues past it', () => {
    const a = step('a', 100);
    const plan = planStepInsertion([a], a, 'below');
    expect(plan.position).toBeGreaterThan(100);
  });

  it('keeps the new step in the anchor’s own branch leg, not the top level', () => {
    const branch = step('branch', 100, { type: 'branch' });
    const yes1 = step('yes1', 100, { parent_action_id: 'branch', branch_path: 'yes' as BranchPath });
    const noSibling = step('no1', 100, { parent_action_id: 'branch', branch_path: 'no' as BranchPath });
    const plan = planStepInsertion([branch, yes1, noSibling], yes1, 'below');
    expect(plan.parentStepId).toBe('branch');
    expect(plan.branchPath).toBe('yes');
  });

  it('renumbers the whole list once repeated inserts close the gap to nothing', () => {
    const a = step('a', 100);
    const b = step('b', 101);
    const plan = planStepInsertion([a, b], b, 'above');
    expect(plan.renumber).toBeDefined();
    const positions = plan.renumber!.map((r) => r.position);
    // Every renumbered sibling gets a distinct position, and the new
    // step's position does not collide with any of them.
    expect(new Set(positions).size).toBe(positions.length);
    expect(positions).not.toContain(plan.position);
  });

  it('a renumber never reassigns a step outside the affected list', () => {
    const a = step('a', 100);
    const b = step('b', 101);
    const outsider = step('c', 5000, { parent_action_id: 'branch-x', branch_path: 'yes' as BranchPath });
    const plan = planStepInsertion([a, b, outsider], b, 'above');
    expect(plan.renumber!.some((r) => r.stepId === 'c')).toBe(false);
  });
});

describe('planStepReorder', () => {
  it('moves a step above another without treating its own old slot as a neighbour', () => {
    const a = step('a', 100);
    const b = step('b', 200);
    const c = step('c', 300);
    // Move c above a: c's own position (300) must not count as the
    // "next" neighbour once it is excluded from the sibling list.
    const plan = planStepReorder([a, b, c], c, a, 'above');
    expect(plan.parentStepId).toBeNull();
    expect(plan.position).toBeLessThan(100);
  });

  it('moves a step below another, landing between it and its old successor', () => {
    const a = step('a', 100);
    const b = step('b', 200);
    const c = step('c', 300);
    const plan = planStepReorder([a, b, c], a, b, 'below');
    expect(plan.position).toBeGreaterThan(200);
    expect(plan.position).toBeLessThan(300);
  });

  it('never re-parents: the moved step always joins the anchor’s own list', () => {
    const branch = step('branch', 100, { type: 'branch' });
    const yes1 = step('yes1', 100, { parent_action_id: 'branch', branch_path: 'yes' as BranchPath });
    const yes2 = step('yes2', 200, { parent_action_id: 'branch', branch_path: 'yes' as BranchPath });
    const plan = planStepReorder([branch, yes1, yes2], yes2, yes1, 'above');
    expect(plan.parentStepId).toBe('branch');
    expect(plan.branchPath).toBe('yes');
  });
});

describe('planStepReorderFromDrop', () => {
  const positions = { a: { x: 0, y: 200 }, b: { x: 0, y: 400 }, c: { x: 0, y: 600 } };

  it('slots the dragged step above the first sibling below the drop point', () => {
    const a = step('a', 100);
    const b = step('b', 200);
    const c = step('c', 300);
    // c dragged up to sit between a (y=200) and b (y=400).
    const plan = planStepReorderFromDrop([a, b, c], positions, 'c', 300);
    expect(plan).toEqual(planStepReorder([a, b, c], c, b, 'above'));
  });

  it('slots the dragged step below the last sibling when dropped past everything', () => {
    const a = step('a', 100);
    const b = step('b', 200);
    const c = step('c', 300);
    const plan = planStepReorderFromDrop([a, b, c], positions, 'a', 9999);
    expect(plan).toEqual(planStepReorder([a, b, c], a, c, 'below'));
  });

  it('returns null when the moving step has no siblings to reorder against', () => {
    const a = step('a', 100);
    expect(planStepReorderFromDrop([a], positions, 'a', 0)).toBeNull();
  });

  it('ignores a sibling’s branch column when picking a slot: only y matters', () => {
    // A branch's yes/no children can sit at very different x, but a
    // drag within one leg must plan against that leg's own siblings by
    // y alone - x never enters into it.
    const branch = step('branch', 100, { type: 'branch' });
    const yes1 = step('yes1', 100, { parent_action_id: 'branch', branch_path: 'yes' as BranchPath });
    const yes2 = step('yes2', 200, { parent_action_id: 'branch', branch_path: 'yes' as BranchPath });
    const branchPositions = {
      branch: { x: 0, y: 200 },
      yes1: { x: -130, y: 400 },
      yes2: { x: -130, y: 600 },
    };
    const plan = planStepReorderFromDrop([branch, yes1, yes2], branchPositions, 'yes2', 300);
    expect(plan).toEqual(planStepReorder([branch, yes1, yes2], yes2, yes1, 'above'));
  });
});
