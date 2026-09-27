/**
 * The canvas warning on a workflow that is already on but unfinished
 * (Task 34, the Task 33 I2 carry-over).
 *
 * A step added to a live workflow is exempt from the save-time check
 * while it is a placeholder, and couples enrolled meanwhile would reach
 * it and error. The banner names those steps; it says nothing on a
 * workflow that is off (the Turn on gate covers that) or finished.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UnfinishedStepsBanner } from '@/app/(dashboard)/workflows/[id]/unfinished-steps-banner';

const PROBLEMS = [
  { stepId: 's1', kind: 'config' as const, title: 'Send email', message: 'Subject is required.' },
  { stepId: 's2', kind: 'config' as const, title: 'Branch', message: 'No condition chosen.' },
];
const UNNAMED = { stepId: 's3', kind: 'unnamed' as const, title: 'To-do', message: 'No name yet.' };

describe('UnfinishedStepsBanner', () => {
  it('names the unfinished steps on a workflow that is on, and that they error', () => {
    render(<UnfinishedStepsBanner status="active" problems={PROBLEMS} />);
    expect(
      screen.getByText(
        'This workflow is on, but 2 steps are unfinished. Send email and Branch will error for a couple who reaches them. Finish them, or turn it off.',
      ),
    ).toBeInTheDocument();
  });

  it('does not claim an unnamed to-do errors: it runs, with nothing to say', () => {
    render(<UnfinishedStepsBanner status="active" problems={[UNNAMED]} />);
    const text = screen.getByText(/This workflow is on/).textContent ?? '';
    expect(text).toBe(
      "This workflow is on, but 1 step is unfinished. To-do has no name, so it won't say what to do. Finish it, or turn it off.",
    );
    expect(text).not.toContain('error');
  });

  it('says each part when both kinds are unfinished', () => {
    render(<UnfinishedStepsBanner status="active" problems={[PROBLEMS[1]!, UNNAMED]} />);
    expect(
      screen.getByText(
        "This workflow is on, but 2 steps are unfinished. Branch will error for a couple who reaches it. To-do has no name, so it won't say what to do. Finish them, or turn it off.",
      ),
    ).toBeInTheDocument();
  });

  it('says nothing on a workflow that is off', () => {
    const { container } = render(<UnfinishedStepsBanner status="draft" problems={PROBLEMS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing when every step is finished, or before the check has answered', () => {
    const { container, rerender } = render(<UnfinishedStepsBanner status="active" problems={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<UnfinishedStepsBanner status="active" problems={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
