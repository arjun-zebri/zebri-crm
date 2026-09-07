import { describe, expect, it } from 'vitest';

import { isExecutable } from '@/lib/workflows/executor';
import type { StepStatus, StepType, WorkflowStepRow } from '@/types/workflows';

const NOW = new Date('2026-09-10T12:00:00Z');
const PAST = '2026-09-10T11:00:00Z';
const FUTURE = '2026-09-10T13:00:00Z';

function step(over: Partial<WorkflowStepRow>): WorkflowStepRow {
  return {
    id: 's1',
    instance_id: 'i1',
    template_step_id: null,
    position: 0,
    type: 'action' as StepType,
    config: { actionType: 'send_email' },
    title: 'Send welcome email',
    description: null,
    timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
    due_at: PAST,
    parent_step_id: null,
    branch_path: null,
    status: 'pending' as StepStatus,
    requires_approval: false,
    approval_token: null,
    approval_expires_at: null,
    completed_at: null,
    error_message: null,
    output: null,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
    ...over,
  } as WorkflowStepRow;
}

describe('isExecutable', () => {
  it('runs a pending automated step whose due_at has passed', () => {
    expect(isExecutable(step({}), NOW)).toBe(true);
  });

  it('does not run one whose due_at is still in the future', () => {
    expect(isExecutable(step({ due_at: FUTURE }), NOW)).toBe(false);
  });

  it('does not run one with a null due_at', () => {
    // Null means gated behind a predecessor that has not finished. This
    // is the mechanism, not an edge case.
    expect(isExecutable(step({ due_at: null }), NOW)).toBe(false);
  });

  it('never runs a manual step, however overdue', () => {
    expect(isExecutable(step({ type: 'todo' }), NOW)).toBe(false);
    expect(isExecutable(step({ type: 'appointment' }), NOW)).toBe(false);
  });

  it('does not re-run a terminal step', () => {
    for (const status of ['done', 'skipped', 'errored'] as StepStatus[]) {
      expect(isExecutable(step({ status }), NOW)).toBe(false);
    }
  });

  it('does not double-run a step already marked running', () => {
    expect(isExecutable(step({ status: 'running' }), NOW)).toBe(false);
  });

  it('runs a waiting step once its wake time has passed', () => {
    expect(isExecutable(step({ status: 'waiting', due_at: PAST }), NOW)).toBe(true);
    expect(isExecutable(step({ status: 'waiting', due_at: FUTURE }), NOW)).toBe(false);
  });

  it('holds a step that still needs approval', () => {
    expect(isExecutable(step({ requires_approval: true }), NOW)).toBe(false);
  });

  it('runs a step due at exactly now', () => {
    expect(isExecutable(step({ due_at: NOW.toISOString() }), NOW)).toBe(true);
  });
});
