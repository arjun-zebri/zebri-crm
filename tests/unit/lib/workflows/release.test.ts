import { describe, expect, it } from 'vitest';

import { blockedReason, releaseBlocker, type ReleaseStep } from '@/lib/workflows/release';

const CHAINED = { mode: 'after_previous', delayAmount: 0, unit: 'days' } as const;

function step(over: Partial<ReleaseStep> & { id: string }): ReleaseStep {
  // A real finished row always carries its finish time.
  const finished = over.status === 'done' || over.status === 'skipped';
  return {
    completed_at: finished ? '2026-09-27T05:00:00Z' : null,
    position: 0,
    type: 'action',
    status: 'pending',
    timing: CHAINED,
    parent_step_id: null,
    branch_path: null,
    title: '',
    config: { actionType: 'send_email', subject: 'Hello' },
    ...over,
  };
}

describe('releaseBlocker', () => {
  it('releases the head of the workflow', () => {
    const head = step({ id: 'a', position: 1 });
    expect(releaseBlocker(head, [head])).toBeNull();
  });

  it('holds a send behind an unfinished to-do, and names it', () => {
    const todo = step({ id: 't', position: 1, type: 'todo', title: 'Call the venue', config: {} });
    const send = step({ id: 's', position: 2 });
    expect(releaseBlocker(send, [send, todo])).toBe(todo);
    expect(blockedReason(send, [todo, send])).toBe(
      'This step waits for "Call the venue" to finish first.',
    );
  });

  it('holds a send behind a sleeping Wait', () => {
    const wait = step({ id: 'w', position: 1, type: 'wait', status: 'waiting', title: 'Wait' });
    const send = step({ id: 's', position: 2 });
    expect(releaseBlocker(send, [wait, send])).toBe(wait);
  });

  it('releases once the step above is done or skipped', () => {
    for (const status of ['done', 'skipped'] as const) {
      const above = step({ id: 'a', position: 1, status });
      const send = step({ id: 's', position: 2 });
      expect(releaseBlocker(send, [above, send])).toBeNull();
    }
  });

  it('a stopped or failed step above releases nothing', () => {
    for (const status of ['cancelled', 'errored'] as const) {
      const above = step({ id: 'a', position: 1, status });
      const send = step({ id: 's', position: 2 });
      expect(releaseBlocker(send, [above, send])).toBe(above);
    }
  });

  it('a wedding-dated step has its own date, so nothing holds it', () => {
    const todo = step({ id: 't', position: 1, type: 'todo', config: {} });
    const dated = step({
      id: 'd',
      position: 2,
      timing: { mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'days' },
    });
    expect(releaseBlocker(dated, [todo, dated])).toBeNull();
  });

  it('a branch lane waits for its branch to decide', () => {
    const branch = step({
      id: 'b',
      position: 1,
      type: 'branch',
      title: 'Paid deposit?',
      config: {},
    });
    const yes = step({ id: 'y', position: 1, parent_step_id: 'b', branch_path: 'yes' });
    expect(blockedReason(yes, [branch, yes])).toBe(
      'This step runs once "Paid deposit?" has decided which way to go.',
    );
    expect(releaseBlocker(yes, [{ ...branch, status: 'done' }, yes])).toBeNull();
    expect(releaseBlocker(yes, [{ ...branch, status: 'skipped' }, yes])).not.toBeNull();
  });

  it('only looks at its own lane', () => {
    const otherLane = step({ id: 'o', position: 1, parent_step_id: 'b', branch_path: 'no' });
    const head = step({ id: 'h', position: 2 });
    expect(releaseBlocker(head, [otherLane, head])).toBeNull();
  });

  it('holds a send behind a to-do ticked early until the send above it is done', () => {
    // Owner report, 2026-09-27: send, Wait, "email 2", to-do, "email 3".
    // The to-do was ticked while email 2 was still behind the Wait.
    const email2 = step({ id: 'e2', position: 3, title: 'Email 2' });
    const todo = step({ id: 't', position: 4, type: 'todo', status: 'done', config: {} });
    const email3 = step({ id: 'e3', position: 5 });
    const lane = [email2, todo, email3];
    expect(releaseBlocker(email3, lane)).toBe(email2);
    expect(blockedReason(email3, lane)).toBe('This step waits for "Email 2" to finish first.');
    const sent = { ...email2, status: 'done' as const, completed_at: '2026-09-27T05:04:53Z' };
    expect(releaseBlocker(email3, [sent, todo, email3])).toBeNull();
  });

  it('a finished dated step does not release the step behind it past an open one (Final call)', () => {
    // Owner ruling, 2026-09-27: "Send questionnaire" open, "Chase" undated
    // behind it, "Final call" (2 weeks before the wedding) done, "Thanks
    // for the call" straight after. Thanks waits for the open to-do.
    const questionnaire = step({ id: 'q', position: 1, type: 'todo', title: 'Send questionnaire', config: {} });
    const chase = step({ id: 'c', position: 2, title: 'Chase questionnaire' });
    const finalCall = step({
      id: 'f',
      position: 3,
      type: 'todo',
      status: 'done',
      config: {},
      timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
    });
    const thanks = step({ id: 't', position: 4 });
    const lane = [questionnaire, chase, finalCall, thanks];
    expect(releaseBlocker(thanks, lane)).toBe(chase);
    // The dated step itself is never held: it runs on its own date.
    const openCall = { ...finalCall, status: 'pending' as const, completed_at: null };
    expect(releaseBlocker(openCall, [questionnaire, chase, openCall, thanks])).toBeNull();
  });

  it('a finished row with no finish time releases nothing, as the engine treats it', () => {
    const above = { ...step({ id: 'a', position: 1, status: 'done' }), completed_at: null };
    const send = step({ id: 's', position: 2 });
    expect(releaseBlocker(send, [above, send])).toBe(above);
  });

  it('an unreadable timing on a finished row reads as chained, as everywhere else', () => {
    const open = step({ id: 'o', position: 1, type: 'todo', config: {} });
    const odd = step({ id: 'x', position: 2, status: 'done', timing: { mode: 'someday' } as never });
    const after = step({ id: 'a', position: 3 });
    expect(releaseBlocker(after, [open, odd, after])).toBe(open);
  });
});
