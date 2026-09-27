/**
 * The Workflow tab's stat line (Task 31 fix round 1, review I1): a send
 * that reached only some of its recipients is counted there, so the MC
 * sees it on the tab header without opening the Done strip.
 */
import { describe, expect, it } from 'vitest';

import { workflowTabStats } from '@/app/(dashboard)/couples/couple-workflow-stats';
import type { WorkflowStepRow } from '@/types/workflows';

function step(over: Partial<WorkflowStepRow>): WorkflowStepRow {
  return { status: 'pending', due_at: null, output: null, ...over } as WorkflowStepRow;
}

describe('workflowTabStats', () => {
  it('is undefined with no steps', () => {
    expect(workflowTabStats([], 'Australia/Sydney')).toBeUndefined();
  });

  it('adds a warning stat for partly failed sends', () => {
    const stats = workflowTabStats(
      [
        step({ status: 'pending' }),
        step({ status: 'done', output: { sent: 1, failed: 1 } }),
        step({ status: 'done', output: { sent: 2, failed: 0 } }),
      ],
      'Australia/Sydney',
    );
    expect(stats).toEqual([{ label: '1 open' }, { label: '1 partly failed', tone: 'warning' }]);
  });

  it('keeps the overdue stat and leaves the warning out when nothing failed', () => {
    const stats = workflowTabStats(
      [step({ status: 'pending', due_at: '2020-01-01T00:00:00Z' })],
      'Australia/Sydney',
    );
    expect(stats).toEqual([{ label: '1 open' }, { label: '1 overdue', tone: 'danger' }]);
  });

  // Live check B5: "open" is an adjective, so it never takes a plural s.
  it('reads "2 open", not "2 opens", with more than one open step', () => {
    const stats = workflowTabStats(
      [step({ status: 'pending' }), step({ status: 'waiting' })],
      'Australia/Sydney',
    );
    expect(stats?.[0]).toEqual({ label: '2 open' });
  });
});
