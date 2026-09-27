import { describe, expect, it } from 'vitest';

import type { QuietHoursWindow } from '@/lib/automations/quiet-hours';
import { projectSchedule, type ProjectionStep } from '@/lib/workflows/schedule-projection';
import type { StepTiming } from '@/types/workflows';

const NOW = new Date('2026-09-27T03:02:00Z');
const APPLIED = '2026-09-27T03:01:00.000Z';
const ANCHORS = { weddingDate: '2027-03-31', appliedAt: APPLIED, timezone: 'Australia/Sydney' };
const CHAINED: StepTiming = { mode: 'after_previous', delayAmount: 0, unit: 'days' };

let seq = 0;
function step(over: Partial<ProjectionStep> = {}): ProjectionStep {
  seq += 1;
  return {
    id: over.id ?? `s${seq}`,
    position: over.position ?? seq * 100,
    type: 'action',
    status: 'pending',
    timing: CHAINED,
    due_at: null,
    parent_step_id: null,
    branch_path: null,
    completed_at: null,
    requires_approval: false,
    config: { actionType: 'send_email', subject: 'Hello' },
    title: '',
    ...over,
  };
}

const wait = (minutes: number, over: Partial<ProjectionStep> = {}) =>
  step({ type: 'wait', config: { mode: 'duration', durationMinutes: minutes }, ...over });

const doneEmail = step({
  id: 'email1',
  status: 'done',
  due_at: APPLIED,
  completed_at: '2026-09-27T03:01:01.000Z',
});

describe('projectSchedule', () => {
  it('dates the send behind a sleeping 5 minute wait (the owner report)', () => {
    const w = wait(5, { id: 'w', status: 'waiting', due_at: '2026-09-27T03:06:01.000Z' });
    const email2 = step({ id: 'email2' });
    const out = projectSchedule([doneEmail, w, email2], ANCHORS, null, NOW);
    expect(out.get('email2')).toEqual({ at: '2026-09-27T03:06:01.000Z', gate: null });
    expect(out.has('email1')).toBe(false);
  });

  it('dates the send behind a wait that has not started yet', () => {
    const w = wait(5, { id: 'w', due_at: '2026-09-27T03:10:00.000Z' });
    const out = projectSchedule([doneEmail, w, step({ id: 'e2' })], ANCHORS, null, NOW);
    expect(out.get('e2')?.at).toBe('2026-09-27T03:15:00.000Z');
  });

  it('chains waits and delays one after another', () => {
    const out = projectSchedule(
      [
        doneEmail,
        wait(60, { id: 'w1', status: 'waiting', due_at: '2026-09-27T04:00:00.000Z' }),
        wait(30, { id: 'w2' }),
        step({ id: 'e2', timing: { mode: 'after_previous', delayAmount: 2, unit: 'hours' } }),
      ],
      ANCHORS,
      null,
      NOW,
    );
    expect(out.get('w2')?.at).toBe('2026-09-27T04:30:00.000Z');
    expect(out.get('e2')?.at).toBe('2026-09-27T06:30:00.000Z');
  });

  it('a past-due wake runs on the next tick', () => {
    const w = wait(5, { id: 'w', status: 'waiting', due_at: '2026-09-27T02:00:00.000Z' });
    const out = projectSchedule([doneEmail, w, step({ id: 'e2' })], ANCHORS, null, NOW);
    expect(out.get('e2')?.at).toBe(NOW.toISOString());
  });

  it('a past-due send shows as sending now', () => {
    const late = step({ id: 'late', due_at: '2026-09-26T00:00:00.000Z' });
    expect(projectSchedule([late], ANCHORS, null, NOW).get('late')?.at).toBe(NOW.toISOString());
  });

  it('a relative-date wait ends on the event date, months clamped', () => {
    const w = wait(0, {
      id: 'w',
      config: {
        mode: 'relative_to_event',
        relative: { amount: 1, unit: 'months', direction: 'before', anchor: 'event_date' },
      },
    });
    const out = projectSchedule([doneEmail, w, step({ id: 'e2' })], ANCHORS, null, NOW);
    // Same instant the engine computes: 28 Feb 2027 at 09:00 server time.
    expect(out.get('e2')?.at).toBe(new Date('2027-02-28T09:00:00').toISOString());
  });

  it('holds a wait that ends inside quiet hours until they end', () => {
    const window: QuietHoursWindow = { start: '21:00', end: '08:00', timezone: 'Australia/Sydney' };
    // 11:00 UTC is 21:00 Sydney (AEST), inside the window; it ends 08:00
    // Sydney, which is 22:00 UTC.
    const w = wait(5, { id: 'w', status: 'waiting', due_at: '2026-09-27T11:30:00.000Z' });
    const out = projectSchedule([doneEmail, w, step({ id: 'e2' })], ANCHORS, window, NOW);
    expect(out.get('e2')?.at).toBe('2026-09-27T22:00:00.000Z');
  });

  it('ignores quiet hours for a wait told to ignore them', () => {
    const window: QuietHoursWindow = { start: '21:00', end: '08:00', timezone: 'Australia/Sydney' };
    const w = wait(5, {
      id: 'w',
      status: 'waiting',
      due_at: '2026-09-27T11:30:00.000Z',
      config: { mode: 'duration', durationMinutes: 5, respectQuietHours: false },
    });
    const out = projectSchedule([doneEmail, w, step({ id: 'e2' })], ANCHORS, window, NOW);
    expect(out.get('e2')?.at).toBe('2026-09-27T11:30:00.000Z');
  });

  it('a to-do gates what follows it on the MC', () => {
    const todo = step({
      id: 't',
      type: 'todo',
      title: 'Call the venue',
      due_at: APPLIED,
      config: {},
    });
    const out = projectSchedule(
      [todo, wait(5, { id: 'w' }), step({ id: 'e' })],
      ANCHORS,
      null,
      NOW,
    );
    expect(out.get('t')).toEqual({ at: APPLIED, gate: null });
    expect(out.get('e')).toEqual({ at: null, gate: 'After you finish Call the venue' });
  });

  it('a send waiting for approval gates what follows it', () => {
    const held = step({ id: 'h', requires_approval: true, due_at: APPLIED, title: 'Quote' });
    const out = projectSchedule([held, step({ id: 'e' })], ANCHORS, null, NOW);
    expect(out.get('h')?.at).toBe(APPLIED);
    expect(out.get('e')?.gate).toBe('After you OK Quote');
  });

  it('an undecided branch gates both sides, and its sibling runs on', () => {
    const b = step({
      id: 'b',
      type: 'branch',
      title: 'Paid deposit?',
      due_at: APPLIED,
      config: {},
    });
    const yes = step({ id: 'y', parent_step_id: 'b', branch_path: 'yes', position: 1 });
    const no = step({ id: 'n', parent_step_id: 'b', branch_path: 'no', position: 1 });
    const after = step({ id: 'a' });
    const out = projectSchedule([b, yes, no, after], ANCHORS, null, NOW);
    expect(out.get('y')?.gate).toBe('Depends on Paid deposit?');
    expect(out.get('n')?.gate).toBe('Depends on Paid deposit?');
    expect(out.get('a')?.at).toBe(NOW.toISOString());
  });

  it('a decided branch dates its lane from the decision', () => {
    const b = step({ id: 'b', type: 'branch', status: 'done', completed_at: APPLIED, config: {} });
    const yes = step({
      id: 'y',
      parent_step_id: 'b',
      branch_path: 'yes',
      position: 1,
      due_at: null,
    });
    const out = projectSchedule([b, yes], ANCHORS, null, NOW);
    expect(out.get('y')?.at).toBe(NOW.toISOString());
  });

  it('a held step says so, and gates the steps behind it', () => {
    const held = step({ id: 'h', title: 'Thank you', due_held_at: APPLIED });
    const out = projectSchedule([held, step({ id: 'e' })], ANCHORS, null, NOW);
    expect(out.get('h')).toEqual({ at: null, gate: 'No date set' });
    expect(out.get('e')?.gate).toBe('After Thank you, which has no date');
  });

  it('a failed step gates the steps behind it', () => {
    const failed = step({ id: 'f', status: 'errored', title: 'Invoice', due_at: APPLIED });
    const out = projectSchedule([failed, step({ id: 'e' })], ANCHORS, null, NOW);
    expect(out.has('f')).toBe(false);
    expect(out.get('e')?.gate).toBe('After Invoice is fixed');
  });

  it('starts from nothing done: Email 1 due, then the Wait, then Email 2', () => {
    const email1 = step({ id: 'e1', due_at: APPLIED });
    const out = projectSchedule(
      [email1, wait(5, { id: 'w' }), step({ id: 'e2' })],
      ANCHORS,
      null,
      NOW,
    );
    // Email 1 is past due, so it goes on the next tick (now); the Wait
    // starts then and Email 2 follows five minutes later.
    expect(out.get('e1')?.at).toBe(NOW.toISOString());
    expect(out.get('e2')?.at).toBe('2026-09-27T03:07:00.000Z');
  });

  it('a branch behind a to-do passes the to-do reason to its lanes', () => {
    const todo = step({ id: 't', type: 'todo', title: 'Call', due_at: APPLIED, config: {} });
    const b = step({ id: 'b', type: 'branch', title: 'Paid?', config: {} });
    const yes = step({ id: 'y', parent_step_id: 'b', branch_path: 'yes', position: 1 });
    const out = projectSchedule([todo, b, yes], ANCHORS, null, NOW);
    expect(out.get('y')?.gate).toBe('After you finish Call');
  });

  it('a finished step with no finish time dates nothing behind it', () => {
    const done = step({ id: 'd', status: 'done', completed_at: null, title: 'Intro' });
    const out = projectSchedule([done, step({ id: 'e' })], ANCHORS, null, NOW);
    expect(out.get('e')).toEqual({ at: null, gate: 'After Intro' });
  });

  it('a legacy Wait still flagged for approval holds what follows', () => {
    const w = wait(5, { id: 'w', requires_approval: true, due_at: APPLIED, title: 'Pause' });
    const out = projectSchedule([w, step({ id: 'e' })], ANCHORS, null, NOW);
    expect(out.get('e')?.gate).toBe('After you OK Pause');
  });

  it('a wedding-dated step keeps its own date behind a gate', () => {
    const todo = step({ id: 't', type: 'todo', title: 'Call', due_at: APPLIED, config: {} });
    const dated = step({
      id: 'd',
      timing: { mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'days' },
    });
    const out = projectSchedule([todo, dated], ANCHORS, null, NOW);
    expect(out.get('d')?.at).toBe('2027-03-29T13:00:00.000Z');
  });

  it('a wedding-dated step without a wedding date says what it needs', () => {
    const dated = step({
      id: 'd',
      timing: { mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'days' },
    });
    const out = projectSchedule([dated], { ...ANCHORS, weddingDate: null }, null, NOW);
    expect(out.get('d')).toEqual({ at: null, gate: 'Needs a wedding date' });
  });

  it('a to-do ticked early does not date the send below it before the send above it', () => {
    // Owner report, 2026-09-27: email 2 is behind a sleeping Wait, the
    // to-do below it was ticked early, email 3 follows the to-do.
    const w = wait(1, { id: 'w', status: 'waiting', due_at: '2026-09-27T03:10:00.000Z' });
    const email2 = step({ id: 'email2' });
    const todo = step({ id: 'todo', type: 'todo', status: 'done', completed_at: '2026-09-27T03:01:54.000Z' });
    const email3 = step({ id: 'email3' });
    const out = projectSchedule([doneEmail, w, email2, todo, email3], ANCHORS, null, NOW);
    expect(out.get('email2')?.at).toBe('2026-09-27T03:10:00.000Z');
    expect(out.get('email3')?.at).toBe('2026-09-27T03:10:00.000Z');
  });

  it('a to-do ticked early behind another open to-do passes that reason on', () => {
    const first = step({ id: 'first', type: 'todo', title: 'Call the venue', due_at: APPLIED });
    const todo = step({ id: 'todo', type: 'todo', status: 'done', completed_at: '2026-09-27T03:01:54.000Z' });
    const email = step({ id: 'email' });
    const out = projectSchedule([doneEmail, first, todo, email], ANCHORS, null, NOW);
    expect(out.get('email')).toEqual({ at: null, gate: 'After you finish Call the venue' });
  });

  it('a finished dated step does not date the step behind it past an open to-do (Final call)', () => {
    const questionnaire = step({ id: 'q', type: 'todo', title: 'Send questionnaire', due_at: APPLIED });
    const chase = step({ id: 'chase' });
    const finalCall = step({
      id: 'call',
      type: 'todo',
      status: 'done',
      completed_at: '2026-09-27T03:01:30.000Z',
      timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
    });
    const thanks = step({ id: 'thanks' });
    const out = projectSchedule([doneEmail, questionnaire, chase, finalCall, thanks], ANCHORS, null, NOW);
    expect(out.get('thanks')).toEqual({ at: null, gate: 'After you finish Send questionnaire' });
  });

  it('a pending dated email does not release the step behind it past an open to-do', () => {
    // Final call shape with the dated step still to run (re-review 1): it
    // sends on its own date, but Thanks waits for the to-do above, as
    // recomputeDueDates and releaseBlocker hold it.
    const questionnaire = step({ id: 'q', type: 'todo', title: 'Send questionnaire', due_at: APPLIED });
    const chase = step({ id: 'chase' });
    const dated = step({
      id: 'dated',
      due_at: '2026-09-29T14:00:00.000Z',
      timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
    });
    const thanks = step({ id: 'thanks' });
    const out = projectSchedule([doneEmail, questionnaire, chase, dated, thanks], ANCHORS, null, NOW);
    expect(out.get('dated')).toEqual({ at: '2026-09-29T14:00:00.000Z', gate: null });
    expect(out.get('thanks')).toEqual({ at: null, gate: 'After you finish Send questionnaire' });
  });

  it('a dated email releases the step behind it no earlier than a later Wait above it', () => {
    const w = wait(10, { id: 'w', status: 'waiting', due_at: '2026-09-27T05:00:00.000Z' });
    const dated = step({
      id: 'dated',
      due_at: '2026-09-27T04:00:00.000Z',
      timing: { mode: 'apply_relative', amount: 0, unit: 'days' },
    });
    const after = step({ id: 'after' });
    const out = projectSchedule([doneEmail, w, dated, after], ANCHORS, null, NOW);
    expect(out.get('after')?.at).toBe('2026-09-27T05:00:00.000Z');
  });
});
