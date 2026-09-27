/**
 * A held step's title at phone width (Phase 5 live check B6).
 *
 * At 390px the "Needs your OK" pill and the due date left the title
 * 19px, so "Venue check-in email" read "V…". jsdom does no layout, so
 * this pins the classes that give the title priority: below `sm` the
 * pills wrap onto their own line under the title instead of sharing
 * its line, and from `sm` up the row stays on one line.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkflowStepTitle } from '@/app/(dashboard)/couples/workflow-step-title';
import type { WorkflowStepRow } from '@/types/workflows';

const step = {
  id: 's1',
  title: 'Venue check-in email',
  status: 'pending',
  requires_approval: true,
  error_message: null,
  branch_path: null,
  output: null,
} as unknown as WorkflowStepRow;

describe('WorkflowStepTitle on a phone', () => {
  it('wraps the pill under the title instead of squeezing the title', () => {
    render(
      <WorkflowStepTitle
        step={step}
        partial={null}
        editing={false}
        onEditingChange={() => {}}
        onRename={() => {}}
        workflowName="Send fidelity check"
        paused={false}
      />,
    );
    const title = screen.getByText('Venue check-in email');
    const line = title.parentElement!;
    const cls = line.className.split(/\s+/);
    expect(cls).toContain('flex-wrap');
    expect(cls).toContain('sm:flex-nowrap');
    // The title may take the whole line before it truncates.
    expect(title.className.split(/\s+/)).toContain('max-w-full');
    expect(screen.getByText('Needs your OK')).toBeInTheDocument();
  });
});
