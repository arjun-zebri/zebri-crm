import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  describeConsequence,
  StepConsequenceDialog,
} from '@/app/(dashboard)/couples/step-consequence-dialog';
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

const TIMER = { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'months' } as const;

// The 2026-09-16 shape: a timer branch with the "2 months out" email
// timed straight after it.
const STEPS = [
  step('Send questionnaire', { position: 100, type: 'action', status: 'done' }),
  step('timer', { position: 200, type: 'branch', title: '', timing: TIMER }),
  step('2 months out email', { position: 300, type: 'action' }),
  step('Call them', { position: 400 }),
];

describe('describeConsequence', () => {
  it('is null when nothing is timed from the step', () => {
    expect(describeConsequence({ op: 'remove', step: STEPS[3]! }, STEPS)).toBeNull();
    expect(describeConsequence({ op: 'skip', step: STEPS[3]! }, STEPS)).toBeNull();
  });

  it('names what moves when a timer is removed', () => {
    const copy = describeConsequence({ op: 'remove', step: STEPS[1]! }, STEPS);
    expect(copy?.title).toBe('Remove "Branch · 2mo before wedding"?');
    expect(copy?.description).toContain('"2 months out email", "Call them" are timed from this step');
    expect(copy?.description).toContain('becoming due straight away');
  });

  it('separates what is removed with a branch from what moves after it', () => {
    const steps = [
      ...STEPS,
      step('nested', { position: 10, parent_step_id: 'timer', branch_path: 'yes', type: 'action' }),
    ];
    const copy = describeConsequence({ op: 'remove', step: steps[1]! }, steps);
    expect(copy?.description).toContain('"nested" sits inside it and will be removed too.');
    expect(copy?.description).toContain('"2 months out email", "Call them" are timed from this step');
  });

  it('warns that skipping a timer makes its dependents due now', () => {
    const copy = describeConsequence({ op: 'skip', step: STEPS[1]! }, STEPS);
    expect(copy?.title).toBe('Skip "Branch · 2mo before wedding"?');
    expect(copy?.description).toContain('become due as soon as it is skipped');
    expect(copy?.confirmLabel).toBe('Skip it');
  });
});

describe('StepConsequenceDialog', () => {
  it('renders the warning and confirms with the pending action', async () => {
    const onConfirm = vi.fn();
    render(
      <StepConsequenceDialog
        pending={{ op: 'remove', step: STEPS[1]! }}
        steps={STEPS}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Remove' }).click();
    expect(onConfirm).toHaveBeenCalledWith({ op: 'remove', step: STEPS[1] });
  });

  it('shows nothing when there is no consequence to confirm', () => {
    render(
      <StepConsequenceDialog
        pending={{ op: 'remove', step: STEPS[3]! }}
        steps={STEPS}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
