/**
 * The couple's checklist row for a send that reached only some of its
 * recipients (Task 31, audit M6). The step is `done` (re-running it would
 * double-send the ones that worked), but it must not wear the plain green
 * tick: it shows a warning glyph and says how many went and why.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowStepRow } from '@/app/(dashboard)/couples/workflow-step-row';
import type { WorkflowStepRow as StepRow } from '@/types/workflows';

function step(over: Partial<StepRow> = {}): StepRow {
  return {
    id: 'step-1',
    instance_id: 'inst-1',
    template_step_id: null,
    position: 0,
    type: 'action',
    config: { actionType: 'send_email' },
    title: 'Send welcome email',
    description: null,
    timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
    due_at: null,
    parent_step_id: null,
    branch_path: null,
    status: 'done',
    requires_approval: false,
    visible_to_couple: false,
    approval_token: null,
    approval_expires_at: null,
    completed_at: '2026-09-25T00:00:00Z',
    error_message: null,
    output: null,
    attempt_count: 1,
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
    ...over,
  } as StepRow;
}

function renderRow(row: StepRow) {
  const noop = vi.fn();
  render(
    <WorkflowStepRow
      step={row}
      dueLabel=""
      onTick={noop}
      onUntick={noop}
      onSkip={noop}
      onRetry={noop}
      onRemove={noop}
      onReschedule={noop}
      onRename={noop}
    />,
  );
}

describe('WorkflowStepRow partial send', () => {
  it('shows a warning with the counts and the reason, not the green tick', () => {
    renderRow(step({ output: { recipients: 2, sent: 1, failed: 1, last_error: 'mailbox full' } }));
    expect(screen.queryByLabelText('Done')).toBeNull();
    expect(screen.getByLabelText('Sent, but not to everyone')).toBeInTheDocument();
    expect(screen.getByText('Sent to 1 of 2, 1 failed: mailbox full')).toBeInTheDocument();
  });

  it('does not strike the title through, which would read as "all done"', () => {
    renderRow(step({ output: { sent: 1, failed: 1 } }));
    expect(screen.getByText('Send welcome email').className).not.toContain('line-through');
  });

  it('keeps the green tick for a send that reached everyone', () => {
    renderRow(step({ output: { recipients: 2, sent: 2, failed: 0 } }));
    expect(screen.getByLabelText('Done')).toBeInTheDocument();
    expect(screen.queryByText(/failed/)).toBeNull();
  });
});
