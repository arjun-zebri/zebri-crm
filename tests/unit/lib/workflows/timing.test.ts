import { describe, expect, it } from 'vitest';

import { computeDueAt, recomputeDueDates } from '@/lib/workflows/timing';
import type { StepTiming, WorkflowStepRow } from '@/types/workflows';

const SYDNEY = 'Australia/Sydney';

/**
 * Anchors for a couple married on 2026-11-14, whose workflow was applied
 * on 2026-09-04. Sydney, deliberately not UTC: a UTC fixture makes wrong
 * and right coincide and hides exactly the bug class this module has. Six
 * timezone bugs were found in the Scheduler build, every one masked by a
 * UTC-pinned fixture.
 */
const anchors = {
  weddingDate: '2026-11-14',
  appliedAt: '2026-09-04T03:00:00Z', // 2026-09-04 13:00 Sydney
  previousCompletedAt: null,
  timezone: SYDNEY,
};

describe('computeDueAt', () => {
  it('wedding_relative "2 weeks before" lands on the local morning of 2026-10-31', () => {
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'before',
      amount: 2,
      unit: 'weeks',
    };
    // 2026-10-31 00:00 Sydney is 2026-10-30T13:00Z (AEDT, UTC+11).
    expect(computeDueAt(timing, anchors)).toBe('2026-10-30T13:00:00.000Z');
  });

  it('wedding_relative "3 days after" lands on 2026-11-17 local', () => {
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'after',
      amount: 3,
      unit: 'days',
    };
    expect(computeDueAt(timing, anchors)).toBe('2026-11-16T13:00:00.000Z');
  });

  it('wedding_relative months step whole calendar months, not 30-day blocks', () => {
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'before',
      amount: 1,
      unit: 'months',
    };
    // 2026-10-14 00:00 Sydney, not "wedding minus 30 days".
    expect(computeDueAt(timing, anchors)).toBe('2026-10-13T13:00:00.000Z');
  });

  it('wedding_relative returns null when the couple has no wedding date', () => {
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'before',
      amount: 2,
      unit: 'weeks',
    };
    expect(computeDueAt(timing, { ...anchors, weddingDate: null })).toBeNull();
  });

  it('apply_relative counts from the apply date in local time', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 3, unit: 'days' };
    // Applied 2026-09-04 13:00 Sydney, so +3 days is 2026-09-07 00:00
    // Sydney = 2026-09-06T14:00Z (AEST, UTC+10).
    expect(computeDueAt(timing, anchors)).toBe('2026-09-06T14:00:00.000Z');
  });

  it('apply_relative with amount 0 is due the day it was applied', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 0, unit: 'days' };
    expect(computeDueAt(timing, anchors)).toBe('2026-09-03T14:00:00.000Z');
  });

  it('after_previous returns null until the predecessor completes', () => {
    // This null is the gating mechanism: an automated step anchored to a
    // manual to-do has no due_at until that to-do is ticked.
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 2, unit: 'days' };
    expect(computeDueAt(timing, anchors)).toBeNull();
  });

  it('after_previous with a completed predecessor adds the delay to the completion instant', () => {
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 2, unit: 'days' };
    const due = computeDueAt(timing, {
      ...anchors,
      previousCompletedAt: '2026-09-10T05:30:00Z',
    });
    expect(due).toBe('2026-09-12T05:30:00.000Z');
  });

  it('after_previous in hours adds hours to the completion instant', () => {
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 6, unit: 'hours' };
    const due = computeDueAt(timing, {
      ...anchors,
      previousCompletedAt: '2026-09-10T05:30:00Z',
    });
    expect(due).toBe('2026-09-10T11:30:00.000Z');
  });

  it('after_previous with zero delay is due the instant the predecessor completes', () => {
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 0, unit: 'days' };
    const due = computeDueAt(timing, {
      ...anchors,
      previousCompletedAt: '2026-09-10T05:30:00Z',
    });
    expect(due).toBe('2026-09-10T05:30:00.000Z');
  });

  it('crosses the Sydney DST boundary without drifting an hour', () => {
    // Sydney enters AEDT on 2026-10-04. A step 1 week before a
    // 2026-10-08 wedding lands on 2026-10-01, which is still AEST
    // (UTC+10), so it must be 14:00Z and not 13:00Z.
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'before',
      amount: 1,
      unit: 'weeks',
    };
    const due = computeDueAt(timing, { ...anchors, weddingDate: '2026-10-08' });
    expect(due).toBe('2026-09-30T14:00:00.000Z');
  });

  it('clamps a calendar-month shift that overflows a short month', () => {
    // 31 March minus one month is 28 February, not 3 March.
    const timing: StepTiming = {
      mode: 'wedding_relative',
      direction: 'before',
      amount: 1,
      unit: 'months',
    };
    const due = computeDueAt(timing, { ...anchors, weddingDate: '2027-03-31' });
    // 2027-02-28 00:00 Sydney is AEDT (UTC+11) = 2027-02-27T13:00Z.
    expect(due).toBe('2027-02-27T13:00:00.000Z');
  });
});

describe('recomputeDueDates', () => {
  function step(over: Partial<WorkflowStepRow>): WorkflowStepRow {
    return {
      id: 's1',
      instance_id: 'i1',
      template_step_id: null,
      position: 0,
      type: 'todo',
      config: {},
      title: 'step',
      description: null,
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      due_at: null,
      parent_step_id: null,
      branch_path: null,
      status: 'pending',
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

  const base = {
    weddingDate: '2026-11-14',
    appliedAt: '2026-09-04T03:00:00Z',
    timezone: SYDNEY,
  };

  it('threads each step completion into the next after_previous step', () => {
    const steps = [
      step({ id: 'a', position: 0, status: 'done', completed_at: '2026-09-10T05:00:00Z' }),
      step({
        id: 'b',
        position: 1,
        timing: { mode: 'after_previous', delayAmount: 1, unit: 'days' },
      }),
      step({
        id: 'c',
        position: 2,
        timing: { mode: 'after_previous', delayAmount: 1, unit: 'days' },
      }),
    ];
    const out = recomputeDueDates(steps, base);
    expect(out.find((r) => r.id === 'b')!.due_at).toBe('2026-09-11T05:00:00.000Z');
    // c's predecessor b has not completed, so c is not schedulable yet.
    expect(out.find((r) => r.id === 'c')!.due_at).toBeNull();
  });

  it('a wedding_relative step is scheduled even when its predecessor is pending', () => {
    // Anchored steps do not gate on anything: this is what lets "2 weeks
    // before the wedding" show up in the queue while earlier to-dos are
    // still open.
    const steps = [
      step({ id: 'a', position: 0, status: 'pending' }),
      step({
        id: 'b',
        position: 1,
        timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
      }),
    ];
    const out = recomputeDueDates(steps, base);
    expect(out.find((r) => r.id === 'b')!.due_at).toBe('2026-10-30T13:00:00.000Z');
  });

  it('skipped steps still count as completed for gating purposes', () => {
    // Skipping a to-do must not strand every automated step below it.
    const steps = [
      step({ id: 'a', position: 0, status: 'skipped', completed_at: '2026-09-10T05:00:00Z' }),
      step({
        id: 'b',
        position: 1,
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      }),
    ];
    const out = recomputeDueDates(steps, { ...base, weddingDate: null });
    expect(out.find((r) => r.id === 'b')!.due_at).toBe('2026-09-10T05:00:00.000Z');
  });

  it('the first top-level step anchors to the apply date, not to nothing', () => {
    // With no predecessor, an after_previous step is the head of the chain
    // and must be immediately due, otherwise a workflow never starts.
    const steps = [
      step({
        id: 'a',
        position: 0,
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      }),
    ];
    const out = recomputeDueDates(steps, base);
    expect(out.find((r) => r.id === 'a')!.due_at).toBe('2026-09-04T03:00:00.000Z');
  });

  it('gates within a branch on the branch parent, not the flat list', () => {
    const steps = [
      step({
        id: 'br',
        position: 0,
        type: 'branch',
        status: 'done',
        completed_at: '2026-09-10T05:00:00Z',
      }),
      step({
        id: 'yes1',
        position: 0,
        parent_step_id: 'br',
        branch_path: 'yes',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      }),
      step({
        id: 'no1',
        position: 0,
        parent_step_id: 'br',
        branch_path: 'no',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      }),
    ];
    const out = recomputeDueDates(steps, { ...base, weddingDate: null });
    // Both first-in-branch children anchor to the branch step itself.
    expect(out.find((r) => r.id === 'yes1')!.due_at).toBe('2026-09-10T05:00:00.000Z');
    expect(out.find((r) => r.id === 'no1')!.due_at).toBe('2026-09-10T05:00:00.000Z');
  });

  it('chains within one branch path without leaking across to the other', () => {
    const steps = [
      step({
        id: 'br',
        position: 0,
        type: 'branch',
        status: 'done',
        completed_at: '2026-09-10T05:00:00Z',
      }),
      step({
        id: 'yes1',
        position: 0,
        parent_step_id: 'br',
        branch_path: 'yes',
        status: 'done',
        completed_at: '2026-09-11T05:00:00Z',
      }),
      step({
        id: 'yes2',
        position: 1,
        parent_step_id: 'br',
        branch_path: 'yes',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      }),
      step({
        id: 'no1',
        position: 0,
        parent_step_id: 'br',
        branch_path: 'no',
        status: 'skipped',
        completed_at: '2026-09-10T05:00:00Z',
      }),
      step({
        id: 'no2',
        position: 1,
        parent_step_id: 'br',
        branch_path: 'no',
        timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      }),
    ];
    const out = recomputeDueDates(steps, { ...base, weddingDate: null });
    expect(out.find((r) => r.id === 'yes2')!.due_at).toBe('2026-09-11T05:00:00.000Z');
    expect(out.find((r) => r.id === 'no2')!.due_at).toBe('2026-09-10T05:00:00.000Z');
  });

  it('leaves terminal steps out of the returned patch', () => {
    // A done step's due_at is history. Rewriting it on every recompute
    // would churn rows and move dates the MC already acted on.
    const steps = [
      step({
        id: 'a',
        position: 0,
        status: 'done',
        completed_at: '2026-09-10T05:00:00Z',
        due_at: '2026-09-01T00:00:00Z',
      }),
      step({ id: 'b', position: 1 }),
    ];
    const out = recomputeDueDates(steps, base);
    expect(out.map((r) => r.id)).toEqual(['b']);
  });
});
