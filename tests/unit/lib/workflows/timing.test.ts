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

  it('wedding_relative with a send time lands at that local time, not midnight', () => {
    const timing: StepTiming = { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks', sendTime: '09:15' };
    // 2026-10-31 09:15 Sydney (AEDT, +11) is 2026-10-30T22:15Z.
    expect(computeDueAt(timing, anchors)).toBe('2026-10-30T22:15:00.000Z');
  });

  it('a send time is resolved in the zone of the day it lands on, across the DST switch', () => {
    // Sydney moves +10 to +11 on 2026-10-04. The same 09:00 send time is
    // 23:00Z the day before the switch and 22:00Z the day after.
    const dst = { ...anchors, weddingDate: '2026-10-04' };
    expect(computeDueAt({ mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'days', sendTime: '09:00' }, dst)).toBe('2026-10-02T23:00:00.000Z');
    expect(computeDueAt({ mode: 'wedding_relative', direction: 'after', amount: 1, unit: 'days', sendTime: '09:00' }, dst)).toBe('2026-10-04T22:00:00.000Z');
  });

  it('apply_relative in minutes is instant arithmetic from the apply moment', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 30, unit: 'minutes' };
    expect(computeDueAt(timing, anchors)).toBe('2026-09-04T03:30:00.000Z');
  });

  it('apply_relative in hours is instant arithmetic too', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 2, unit: 'hours' };
    expect(computeDueAt(timing, anchors)).toBe('2026-09-04T05:00:00.000Z');
  });

  it('apply_relative in days with a send time lands on that local time', () => {
    const timing: StepTiming = { mode: 'apply_relative', amount: 3, unit: 'days', sendTime: '17:30' };
    // Applied 2026-09-04 local; 2026-09-07 17:30 Sydney (AEST, +10) is 07:30Z.
    expect(computeDueAt(timing, anchors)).toBe('2026-09-07T07:30:00.000Z');
  });

  it('after_previous in minutes', () => {
    const timing: StepTiming = { mode: 'after_previous', delayAmount: 45, unit: 'minutes' };
    expect(computeDueAt(timing, { ...anchors, previousCompletedAt: '2026-09-10T01:00:00Z' })).toBe('2026-09-10T01:45:00.000Z');
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

  it('never re-dates a cancelled step', () => {
    // Its workflow is stopped. A recompute that moved it would hand a
    // stopped send a fresh date, and a resume would then judge it by a
    // date the MC never saw.
    const steps = [
      step({
        id: 'x',
        position: 0,
        status: 'cancelled',
        due_at: '2026-10-01T00:00:00Z',
        timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
      }),
    ];
    expect(recomputeDueDates(steps, base).find((r) => r.id === 'x')).toBeUndefined();
  });

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

  it('never dates a lane head from a skipped branch, only from a done one', () => {
    // A skipped branch chose no lane. Dating its lanes from the skip
    // would run both (Task 36 fix round 2, re-review N3).
    const steps = [
      step({
        id: 'br',
        position: 0,
        type: 'branch',
        status: 'skipped',
        completed_at: '2026-09-10T05:00:00Z',
      }),
      step({ id: 'yes1', position: 0, parent_step_id: 'br', branch_path: 'yes' }),
      step({ id: 'no1', position: 0, parent_step_id: 'br', branch_path: 'no' }),
    ];
    const out = recomputeDueDates(steps, { ...base, weddingDate: null });
    expect(out.find((r) => r.id === 'yes1')!.due_at).toBeNull();
    expect(out.find((r) => r.id === 'no1')!.due_at).toBeNull();
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
  describe('a to-do ticked early (owner report, 2026-09-27)', () => {
    // Send, Wait 1 min, send "email 2", to-do, send "email 3". The MC
    // ticked the to-do while email 2 was still behind the Wait, and
    // email 3 was dated from the tick and sent before email 2.
    const chain = (email2: Partial<WorkflowStepRow>) => [
      step({ id: 'email1', position: 100, type: 'action', status: 'done', completed_at: '2026-09-27T05:00:40Z' }),
      step({ id: 'wait', position: 200, type: 'wait', status: 'done', completed_at: '2026-09-27T05:04:52Z' }),
      step({ id: 'email2', position: 300, type: 'action', ...email2 }),
      step({ id: 'todo', position: 400, status: 'done', completed_at: '2026-09-27T05:01:54Z' }),
      step({ id: 'email3', position: 500, type: 'action' }),
    ];

    it('leaves the send below the early to-do undated while the send above it is open', () => {
      const out = recomputeDueDates(chain({ status: 'pending' }), base);
      expect(out.find((r) => r.id === 'email2')!.due_at).toBe('2026-09-27T05:04:52.000Z');
      expect(out.find((r) => r.id === 'email3')!.due_at).toBeNull();
    });

    it('dates it from the send above once that finishes after the tick', () => {
      const out = recomputeDueDates(
        chain({ status: 'done', completed_at: '2026-09-27T05:04:53Z' }),
        base,
      );
      expect(out.find((r) => r.id === 'email3')!.due_at).toBe('2026-09-27T05:04:53.000Z');
    });

    it('dates it from the to-do when the to-do was ticked last', () => {
      const steps = chain({ status: 'done', completed_at: '2026-09-27T05:04:53Z' }).map((s) =>
        s.id === 'todo' ? { ...s, completed_at: '2026-09-27T06:00:00Z' } : s,
      );
      const out = recomputeDueDates(steps, base);
      expect(out.find((r) => r.id === 'email3')!.due_at).toBe('2026-09-27T06:00:00.000Z');
    });

    it('a finished dated step does not release the step behind it past an open one (Final call)', () => {
      // Owner ruling, 2026-09-27. The dated step itself still runs on its
      // own date; only its follower waits for the open to-do above.
      const finalCall = (status: 'pending' | 'done') =>
        step({
          id: 'call',
          position: 2,
          status,
          completed_at: status === 'done' ? '2026-10-30T13:00:00Z' : null,
          timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
        });
      const lane = (call: WorkflowStepRow, questionnaire: 'pending' | 'done') => [
        step({
          id: 'questionnaire',
          position: 0,
          status: questionnaire,
          completed_at: questionnaire === 'done' ? '2026-11-02T00:00:00Z' : null,
        }),
        step({ id: 'chase', position: 1, type: 'action' }),
        call,
        step({ id: 'thanks', position: 3, type: 'action' }),
      ];

      const pendingCall = recomputeDueDates(lane(finalCall('pending'), 'pending'), base);
      expect(pendingCall.find((r) => r.id === 'call')!.due_at).toBe('2026-10-30T13:00:00.000Z');

      const done = recomputeDueDates(lane(finalCall('done'), 'pending'), base);
      expect(done.find((r) => r.id === 'thanks')!.due_at).toBeNull();

      // Once everything above has run, Thanks is dated from the latest.
      const settled = lane(finalCall('done'), 'done').map((s) =>
        s.id === 'chase' ? { ...s, status: 'done' as const, completed_at: '2026-11-03T00:00:00Z' } : s,
      );
      const out = recomputeDueDates(settled, base);
      expect(out.find((r) => r.id === 'thanks')!.due_at).toBe('2026-11-03T00:00:00.000Z');
    });
  });

  it('reads an unreadable timing on a finished row as chained, like release.ts', () => {
    const steps = [
      step({ id: 'open', position: 0, status: 'pending' }),
      step({ id: 'odd', position: 1, status: 'done', completed_at: '2026-09-27T05:00:00Z', timing: { mode: 'someday' } as never }),
      step({ id: 'after', position: 2 }),
    ];
    expect(recomputeDueDates(steps, base).find((r) => r.id === 'after')!.due_at).toBeNull();
  });

  it('a done chained step in a branch lane behind an open sibling releases nothing', () => {
    const steps = [
      step({ id: 'b', position: 0, type: 'branch', status: 'done', completed_at: '2026-09-27T05:00:00Z' }),
      step({ id: 'open', position: 0, parent_step_id: 'b', branch_path: 'yes' }),
      step({ id: 'ticked', position: 1, parent_step_id: 'b', branch_path: 'yes', status: 'done', completed_at: '2026-09-27T05:01:00Z' }),
      step({ id: 'send', position: 2, parent_step_id: 'b', branch_path: 'yes', type: 'action' }),
    ];
    const out = recomputeDueDates(steps, base);
    expect(out.find((r) => r.id === 'open')!.due_at).toBe('2026-09-27T05:00:00.000Z');
    expect(out.find((r) => r.id === 'send')!.due_at).toBeNull();
  });
});
