/**
 * The Turn on pre-flight (Task 34, audit M7).
 *
 * A workflow is refused at Turn on while any step would error or mean
 * nothing on the day: no steps at all, a send with no subject, a branch
 * with no condition, an appointment still called "Give it a name", a
 * step type the engine cannot run. A finished workflow has no problems.
 *
 * @module tests/unit/lib/workflows/preflight.test
 */
import { describe, expect, it } from 'vitest';

import {
  CANNOT_RUN_YET,
  NO_STEPS,
  STOP_REMOVED,
  UNNAMED_STEP,
  preflightRefusal,
  preflightSteps,
  type PreflightStepInput,
} from '@/lib/workflows/preflight';

const RECIPIENTS = { roles: ['primary'], fallback: 'primary_only' };

const SEND: PreflightStepInput = {
  id: 's-send',
  type: 'action',
  title: '',
  config: { actionType: 'send_email', recipients: RECIPIENTS, subject: 'Hello', body: 'Hi' },
};

function step(over: Partial<PreflightStepInput>): PreflightStepInput {
  return { ...SEND, ...over };
}

describe('preflightSteps', () => {
  it('passes a finished workflow', () => {
    expect(preflightSteps([SEND, step({ id: 's-todo', type: 'todo', title: 'Ring the venue', config: {} })])).toEqual([]);
  });

  it('blocks a workflow with no steps', () => {
    expect(preflightSteps([])).toEqual([{ stepId: null, kind: 'empty', title: 'This workflow', message: NO_STEPS }]);
  });

  it('blocks a send with no subject, naming the field', () => {
    const problems = preflightSteps([
      step({ config: { actionType: 'send_email', recipients: RECIPIENTS, subject: '', body: 'Hi' } }),
    ]);
    expect(problems).toEqual([{ stepId: 's-send', kind: 'config', title: 'Send email', message: 'Subject is required.' }]);
  });

  it('blocks a picker placeholder ({} config) for a task', () => {
    const problems = preflightSteps([step({ id: 's-task', config: { actionType: 'create_task' } })]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ stepId: 's-task', message: 'Title is required.' });
  });

  it('blocks a branch with no condition', () => {
    expect(preflightSteps([step({ id: 's-branch', type: 'branch', config: {} })])).toEqual([
      { stepId: 's-branch', kind: 'config', title: 'Branch', message: 'No condition chosen.' },
    ]);
  });

  it('blocks an appointment still called "Give it a name", or with no name', () => {
    const problems = preflightSteps([
      step({ id: 'a1', type: 'appointment', title: 'Give it a name', config: {} }),
      step({ id: 'a2', type: 'appointment', title: '  ', config: {} }),
      step({ id: 't1', type: 'todo', title: '', config: {} }),
    ]);
    expect(problems.map((p) => [p.stepId, p.kind, p.message])).toEqual([
      ['a1', 'unnamed', UNNAMED_STEP],
      ['a2', 'unnamed', UNNAMED_STEP],
      ['t1', 'unnamed', UNNAMED_STEP],
    ]);
    // Not an error: the step runs, it just says nothing.
    expect(UNNAMED_STEP).toBe("No name yet, so it won't say what to do on the day.");
  });

  it('blocks a saved Stop step, and says it is gone rather than "not yet" (Phase 6: Stop was removed)', () => {
    expect(preflightSteps([step({ id: 's-stop', config: { actionType: 'stop' } })])).toEqual([
      { stepId: 's-stop', kind: 'cannot_run', title: 'Stop', message: STOP_REMOVED },
    ]);
    expect(STOP_REMOVED).not.toMatch(/yet/);
  });

  it('names an unnamed to-do or appointment by its type, never by the placeholder (Task 34 re-review Minor 6)', () => {
    const problems = preflightSteps([
      step({ id: 'a1', type: 'appointment', title: 'Give it a name', config: {} }),
      step({ id: 't1', type: 'todo', title: '', config: {} }),
    ]);
    expect(problems.map((p) => p.title)).toEqual(['Appointment', 'To-do']);
  });

  it('reads the verdict from the validator\'s structured reason, not its sentence (Task 34 re-review Minor 7)', () => {
    // A step type the engine does not know: the validator says so with
    // reason `not_runnable`, whatever its sentence reads.
    expect(preflightSteps([step({ id: 's-x', type: 'teleport', config: {} })])).toEqual([
      { stepId: 's-x', kind: 'cannot_run', title: expect.any(String), message: expect.any(String) },
    ]);
  });

  it('blocks a coming-soon action even though its config parses', () => {
    const problems = preflightSteps([step({ id: 's-sms', config: { actionType: 'send_sms', body: 'Hi' } })]);
    expect(problems).toEqual([{ stepId: 's-sms', kind: 'cannot_run', title: expect.any(String), message: CANNOT_RUN_YET }]);
  });

  it('blocks an action step with no action chosen', () => {
    const problems = preflightSteps([step({ id: 's-none', config: {} })]);
    expect(problems).toEqual([{ stepId: 's-none', kind: 'config', title: expect.any(String), message: 'No action chosen.' }]);
  });

  it('lists every problem, in the order given', () => {
    const problems = preflightSteps([
      step({ id: 'x', type: 'branch', config: {} }),
      SEND,
      step({ id: 'y', config: { actionType: 'stop' } }),
    ]);
    expect(problems.map((p) => p.stepId)).toEqual(['x', 'y']);
  });
});

describe('the Turn on pre-flight and the Wait (owner rulings 2026-09-27)', () => {
  it('does not flag a normal Wait, a relative date in months, or a saved specific date', () => {
    expect(
      preflightSteps([
        step({ id: 'w-duration', type: 'wait', config: { mode: 'duration', durationMinutes: 1440 } }),
        step({
          id: 'w-months',
          type: 'wait',
          config: {
            mode: 'relative_to_event',
            relative: { amount: 3, unit: 'months', direction: 'before', anchor: 'event_date' },
          },
        }),
        // No longer offered, but a saved one still runs, so it may be
        // turned on.
        step({ id: 'w-until', type: 'wait', config: { mode: 'until_date', untilDate: '2027-01-03' } }),
      ]),
    ).toEqual([]);
  });
});

describe('preflightRefusal', () => {
  it('names each unfinished step in one sentence the MC can act on', () => {
    expect(
      preflightRefusal([
        { stepId: 'a', kind: 'config', title: 'Send email', message: 'Subject is required.' },
        { stepId: 'b', kind: 'config', title: 'Branch', message: 'No condition chosen.' },
      ]),
    ).toBe(
      'Finish 2 steps before turning this on. Send email: Subject is required. Branch: No condition chosen.',
    );
  });

  it('words the refusal for a hand apply as starting it on a couple', () => {
    expect(
      preflightRefusal([{ stepId: 'a', kind: 'config', title: 'Branch', message: 'No condition chosen.' }], 'apply'),
    ).toBe('Finish 1 step before starting this on a couple. Branch: No condition chosen.');
    expect(preflightRefusal([{ stepId: null, kind: 'empty', title: 'This workflow', message: NO_STEPS }], 'apply')).toBe(
      `Finish this workflow before starting it on a couple. ${NO_STEPS}`,
    );
  });

  it('says "this workflow" rather than a step count when it has no steps', () => {
    expect(preflightRefusal([{ stepId: null, kind: 'empty', title: 'This workflow', message: NO_STEPS }])).toBe(
      `Finish this workflow before turning it on. ${NO_STEPS}`,
    );
  });
});

describe('the registry has no false positives', () => {
  // A future schema tightening that rejects a working default would
  // block Turn on for every MC using that step, with nothing failing.
  it('passes every runnable action at the config the picker or composer saves', () => {
    const ready: Record<string, Record<string, unknown>> = {
      send_email: { recipients: RECIPIENTS, subject: 'Hello', body: 'Hi' },
      create_task: { title: 'Ring the venue' },
      update_couple_stage: { toStatus: 'booked' },
      add_note: { text: 'Remember the rings' },
      send_onboarding_pack: {},
      send_pre_event_checklist: {},
      send_thank_you_message: {},
      send_anniversary_message: {},
      request_review: {},
      send_referral_request: {},
    };
    for (const [actionType, config] of Object.entries(ready)) {
      expect(preflightSteps([step({ id: actionType, config: { actionType, ...config } })]), actionType).toEqual([]);
    }
  });
});

describe('the Stop sentence (Phase 6 residual F2)', () => {
  it('is one sentence at save, at send and on the checklist', async () => {
    const { STOP_NOT_A_STEP } = await import('@/lib/workflows/step-config-validation')
    const text = "Stop isn't a step Zebri runs. Remove it; a workflow ends once its last step is done."
    expect(STOP_NOT_A_STEP).toBe(text)
    expect(STOP_REMOVED).toBe(text)
  })
})
