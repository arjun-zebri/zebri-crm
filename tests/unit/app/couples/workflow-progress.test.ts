import { describe, expect, it } from 'vitest';

import { summarise } from '@/app/(dashboard)/couples/use-workflow-progress';

/** One row in the shape the batched board query returns. */
function row(over: Partial<Parameters<typeof summarise>[0][number]> = {}) {
  return {
    title: 'A step',
    type: 'todo',
    status: 'pending',
    due_at: null,
    requires_approval: false,
    workflow_instances: { couple_id: 'c1' },
    ...over,
  };
}

describe('summarise', () => {
  it('counts done out of total per couple', () => {
    const out = summarise([
      row({ status: 'done' }),
      row(),
      row({ workflow_instances: { couple_id: 'c2' } }),
    ]);
    expect(out.get('c1')).toMatchObject({ done: 1, total: 2 });
    expect(out.get('c2')).toMatchObject({ done: 0, total: 1 });
  });

  it('counts a skipped step as dealt with', () => {
    // The MC decided not to do it. Leaving it in the outstanding count
    // would make a finished workflow read as permanently unfinished.
    expect(summarise([row({ status: 'skipped' })]).get('c1')).toMatchObject({
      done: 1,
      total: 1,
    });
  });

  it('names the next thing the MC can actually do', () => {
    const out = summarise([
      row({ status: 'done', title: 'Welcome email' }),
      row({ type: 'action', title: 'Send the invoice' }),
      row({ title: 'Call the venue' }),
    ]);
    // The automated step is skipped over: naming it would tell the MC to
    // do something they cannot do.
    expect(out.get('c1')?.nextTitle).toBe('Call the venue');
  });

  it('leaves the next line empty when nothing is waiting on the MC', () => {
    expect(summarise([row({ status: 'done' })]).get('c1')?.nextTitle).toBeNull();
  });

  it('flags a failure and a held send', () => {
    const out = summarise([
      row({ status: 'errored' }),
      row({ type: 'action', requires_approval: true }),
    ]);
    expect(out.get('c1')).toMatchObject({ hasFailure: true, needsReview: true });
  });

  it('ignores rows whose instance belongs to no couple', () => {
    // The personal list has no couple, and its steps must not land on
    // whichever card happens to be first.
    expect(summarise([row({ workflow_instances: { couple_id: null } })]).size).toBe(0);
  });
});
