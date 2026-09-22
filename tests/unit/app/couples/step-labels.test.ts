import { describe, expect, it } from 'vitest';

import { isOverdueForMc, stepDueLabel } from '@/app/(dashboard)/couples/step-labels';
import type { StepStatus, WorkflowStepRow } from '@/types/workflows';

const TZ = 'Australia/Sydney';
const NOW = new Date('2026-09-22T02:00:00Z'); // midday 22 Sep in Sydney

function step(overrides: Partial<WorkflowStepRow> = {}): WorkflowStepRow {
  return {
    id: 's1',
    instance_id: 'inst-1',
    template_step_id: null,
    position: 0,
    type: 'todo',
    config: {},
    title: '',
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

describe('isOverdueForMc', () => {
  const today = '2026-09-22';
  it('is true for a to-do past its date', () => {
    expect(isOverdueForMc(step({ due_at: '2026-09-16T10:05:30Z' }), today, TZ)).toBe(true);
  });
  it('is never true for an engine step, however old its date', () => {
    expect(isOverdueForMc(step({ type: 'branch', due_at: '2026-03-26T13:00:00Z' }), today, TZ)).toBe(false);
    expect(isOverdueForMc(step({ type: 'action', due_at: '2026-09-16T10:05:30Z' }), today, TZ)).toBe(false);
  });
  it('is false once the step is done or has no date', () => {
    expect(isOverdueForMc(step({ due_at: '2026-09-01T00:00:00Z', status: 'done' }), today, TZ)).toBe(false);
    expect(isOverdueForMc(step(), today, TZ)).toBe(false);
  });
});

describe('stepDueLabel', () => {
  it('calls a past to-do overdue and a past engine step "Due to run"', () => {
    expect(stepDueLabel(step({ due_at: '2026-09-16T10:05:30Z' }), TZ, NOW)).toBe('Overdue · 2026-09-16');
    expect(stepDueLabel(step({ type: 'action', due_at: '2026-09-16T10:05:30Z' }), TZ, NOW)).toBe('Due to run');
  });
  it('distinguishes today for both kinds', () => {
    expect(stepDueLabel(step({ due_at: '2026-09-21T23:00:00Z' }), TZ, NOW)).toBe('Today');
    expect(stepDueLabel(step({ type: 'branch', due_at: '2026-09-21T23:00:00Z' }), TZ, NOW)).toBe('Runs today');
  });
  it('shows the date for the future, Failed for errors and nothing once finished', () => {
    expect(stepDueLabel(step({ due_at: '2026-10-04T14:00:00Z' }), TZ, NOW)).toBe('2026-10-05');
    expect(stepDueLabel(step({ type: 'action', status: 'errored', due_at: '2026-09-01T00:00:00Z' }), TZ, NOW)).toBe('Failed');
    expect(stepDueLabel(step({ status: 'done', due_at: '2026-09-01T00:00:00Z' }), TZ, NOW)).toBe('');
  });
});
