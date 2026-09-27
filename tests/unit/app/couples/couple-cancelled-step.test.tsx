/**
 * A cancelled step reads as cancelled, never as work or an error (Phase
 * 3, Task 22).
 *
 * A step is cancelled when its workflow is stopped. Nothing went wrong
 * and nothing is coming, so the row says "Cancelled" in the neutral
 * tone, offers nothing that would act on it as live work, and carries
 * no due date or "Failed".
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { coupleDueLabel } from '@/app/(dashboard)/couples/couple-due-label';
import { WorkflowStepRow } from '@/app/(dashboard)/couples/workflow-step-row';
import type { WorkflowStepRow as StepRow } from '@/types/workflows';

const step: StepRow = {
  id: 's1',
  instance_id: 'i1',
  template_step_id: null,
  position: 0,
  type: 'action',
  config: { actionType: 'send_email' },
  title: 'Send the run sheet',
  description: null,
  timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
  due_at: '2026-09-01T00:00:00Z',
  parent_step_id: null,
  branch_path: null,
  status: 'cancelled',
  requires_approval: false,
  visible_to_couple: false,
  approval_token: null,
  approval_expires_at: null,
  completed_at: null,
  error_message: null,
  output: null,
  attempt_count: 0,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('a cancelled step', () => {
  it('has no due wording: not overdue, not "Failed"', () => {
    expect(coupleDueLabel(step, 'Australia/Sydney', new Date('2026-09-24T00:00:00Z'))).toBe('');
  });

  it('says Cancelled, is not shown as an error, and offers no live-work actions', async () => {
    const noop = vi.fn();
    render(
      <WorkflowStepRow
        step={step}
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

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByLabelText('This step failed')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    const menu = screen.getByRole('button', { name: 'Remove' }).parentElement as HTMLElement;
    for (const live of ['Skip this step', 'Tomorrow', 'Try again', 'Reopen']) {
      expect(within(menu).queryByRole('button', { name: live })).toBeNull();
    }
  });
});
