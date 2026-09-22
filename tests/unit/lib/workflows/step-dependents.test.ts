import { describe, expect, it } from 'vitest';

import { nestedSteps, timedDependents } from '@/lib/workflows/step-dependents';
import type { StepStatus, WorkflowStepRow } from '@/types/workflows';

function step(id: string, overrides: Partial<WorkflowStepRow> = {}): WorkflowStepRow {
  return {
    id,
    instance_id: 'inst-1',
    template_step_id: null,
    position: 0,
    type: 'todo',
    config: {},
    title: id,
    description: null,
    timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
    due_at: null,
    parent_step_id: null,
    branch_path: null,
    status: 'pending' as StepStatus,
    requires_approval: false,
    visible_to_couple: false,
    approval_token: null,
    approval_expires_at: null,
    completed_at: null,
    error_message: null,
    output: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

const WEDDING_TIMED = { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'months' } as const;

describe('timedDependents', () => {
  it('returns the run of "straight after" siblings behind the step, and stops at one with its own date', () => {
    const steps = [
      step('a', { position: 100 }),
      step('timer', { position: 200, type: 'branch', timing: WEDDING_TIMED }),
      step('email', { position: 300, type: 'action' }),
      step('followup', { position: 400, type: 'action' }),
      step('later-timer', { position: 500, type: 'branch', timing: WEDDING_TIMED }),
      step('after-later', { position: 600, type: 'action' }),
    ];
    const timer = steps[1]!;
    expect(timedDependents(timer, steps).map((s) => s.id)).toEqual(['email', 'followup']);
  });

  it('stops at a step that has already finished', () => {
    const steps = [
      step('timer', { position: 100, type: 'branch', timing: WEDDING_TIMED }),
      step('sent', { position: 200, type: 'action', status: 'done', completed_at: '2026-09-02T00:00:00Z' }),
      step('next', { position: 300, type: 'action' }),
    ];
    expect(timedDependents(steps[0]!, steps)).toEqual([]);
  });

  it('includes the head of each nested lane of a branch', () => {
    const steps = [
      step('branch', { position: 100, type: 'branch', timing: WEDDING_TIMED }),
      step('yes-1', { position: 10, parent_step_id: 'branch', branch_path: 'yes', type: 'action' }),
      step('yes-2', { position: 20, parent_step_id: 'branch', branch_path: 'yes', type: 'action', timing: WEDDING_TIMED }),
      step('no-1', { position: 10, parent_step_id: 'branch', branch_path: 'no' }),
      step('after', { position: 200, type: 'action' }),
    ];
    expect(timedDependents(steps[0]!, steps).map((s) => s.id)).toEqual(['after', 'yes-1', 'no-1']);
  });

  it('ignores steps of other instances and other lanes', () => {
    const steps = [
      step('a', { position: 100 }),
      step('b', { position: 200, type: 'action' }),
      step('other', { position: 300, type: 'action', instance_id: 'inst-2' }),
      step('nested', { position: 300, type: 'action', parent_step_id: 'x', branch_path: 'yes' }),
    ];
    expect(timedDependents(steps[0]!, steps).map((s) => s.id)).toEqual(['b']);
  });
});

describe('nestedSteps', () => {
  it('is empty for anything but a branch', () => {
    const steps = [step('a'), step('child', { parent_step_id: 'a', branch_path: 'yes' })];
    expect(nestedSteps(steps[0]!, steps)).toEqual([]);
  });

  it('lists every step under a branch, finished ones included, in order', () => {
    const steps = [
      step('branch', { type: 'branch' }),
      step('c2', { position: 20, parent_step_id: 'branch', branch_path: 'yes', status: 'done' }),
      step('c1', { position: 10, parent_step_id: 'branch', branch_path: 'no' }),
    ];
    expect(nestedSteps(steps[0]!, steps).map((s) => s.id)).toEqual(['c1', 'c2']);
  });
});
