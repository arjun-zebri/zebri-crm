/**
 * The activity-feed lines for pausing and resuming a workflow.
 *
 * An unknown event falls back to its raw slug, so without these cases a
 * pause would reach the MC's feed as "instance_paused".
 */
import { describe, expect, it } from 'vitest';

import { narrateWorkflowEvent } from '@/lib/workflows/narrate';

describe('narrateWorkflowEvent, instance pause and resume', () => {
  it('names a paused workflow', () => {
    expect(
      narrateWorkflowEvent('instance_paused', {}, { instanceName: 'Booking flow' }),
    ).toBe('Workflow paused: Booking flow');
  });

  it('says a pause came from turning the workflow off, and which one', () => {
    expect(
      narrateWorkflowEvent(
        'instance_paused',
        { reason: 'template_off', workflow: 'Booking flow' },
        { instanceName: 'Booking flow' },
      ),
    ).toBe('Workflow paused: Booking flow (Booking flow was turned off)');
  });

  it('says a stop came from deleting the workflow, and which one', () => {
    expect(
      narrateWorkflowEvent(
        'instance_cancelled',
        { reason: 'template_deleted', workflow: 'Booking flow' },
        { instanceName: 'Booking flow' },
      ),
    ).toBe('Workflow stopped: Booking flow (Booking flow was deleted)');
  });

  it('says a stop came from a setup that did not finish', () => {
    expect(
      narrateWorkflowEvent(
        'instance_cancelled',
        { reason: 'setup_interrupted' },
        { instanceName: 'Booking flow' },
      ),
    ).toBe('Workflow stopped: Booking flow (its setup did not finish)');
  });

  it('names a resumed workflow', () => {
    expect(
      narrateWorkflowEvent('instance_resumed', {}, { instanceName: 'Booking flow' }),
    ).toBe('Workflow resumed: Booking flow');
  });

  it('carries the skip reason written on resume', () => {
    expect(
      narrateWorkflowEvent(
        'step_skipped',
        { reason: 'its time passed while the workflow was paused' },
        { stepTitle: 'Send the questionnaire' },
      ),
    ).toBe('Skipped: Send the questionnaire (its time passed while the workflow was paused)');
  });
});

describe('narrateWorkflowEvent, a wait whose timer was lost', () => {
  it('tells the MC what to do about it', () => {
    expect(
      narrateWorkflowEvent('step_waiting', { reason: 'wake_lost' }, { stepTitle: 'Wait 3 days' }),
    ).toBe('Waiting: Wait 3 days (its timer was lost in an update; skip it to carry on)');
  });
});

describe('narrateWorkflowEvent, a wait held for quiet hours', () => {
  it('uses the same words as the Wait card chip', () => {
    expect(
      narrateWorkflowEvent('step_waiting', { reason: 'quiet_hours' }, { stepTitle: 'Wait 1 day' }),
    ).toBe('Waiting: Wait 1 day (held until your quiet hours end)');
  });
});

describe('narrateWorkflowEvent, the daily send check (Task 30 I3)', () => {
  it('says the check is unavailable, not that a limit was reached', () => {
    const line = narrateWorkflowEvent('step_waiting', { reason: 'send_check_unavailable' }, { stepTitle: 'Thank you' });
    expect(line).toBe('Waiting: Thank you (sending check unavailable, retrying automatically)');
    expect(line).not.toMatch(/limit/);
  });
});

describe('narrateWorkflowEvent, the account-wide stop', () => {
  it('says a send was held back by the stop', () => {
    expect(
      narrateWorkflowEvent('step_waiting', { reason: 'account_paused' }, { stepTitle: 'Thank you' }),
    ).toBe('Waiting: Thank you (held while all workflows are paused)');
  });

  it('says a step was skipped because it came due while stopped', () => {
    expect(
      narrateWorkflowEvent(
        'step_skipped',
        { reason: 'its time passed while all workflows were paused' },
        { stepTitle: 'Thank you' },
      ),
    ).toBe('Skipped: Thank you (its time passed while all workflows were paused)');
  });
});

describe('narrateWorkflowEvent, an exit rule', () => {
  it('names the stage the couple moved to', () => {
    expect(
      narrateWorkflowEvent(
        'instance_cancelled',
        { reason: 'exit_rule', stage: 'Lost', workflow: 'Nurture' },
        { instanceName: 'Nurture' },
      ),
    ).toBe('Workflow stopped: Nurture (couple moved to Lost)');
  });
});

describe('narrateWorkflowEvent, a send that reached only some recipients (M6)', () => {
  it('says so on the done line instead of a plain "Done"', () => {
    expect(
      narrateWorkflowEvent(
        'step_completed',
        { recipients: 2, sent: 1, failed: 1, last_error: 'mailbox full' },
        { stepTitle: 'Send welcome email' },
      ),
    ).toBe('Done: Send welcome email (sent to 1 of 2, 1 failed: mailbox full)');
  });

  it('keeps a clean send a plain "Done"', () => {
    expect(
      narrateWorkflowEvent('step_completed', { sent: 2, failed: 0 }, { stepTitle: 'Send welcome email' }),
    ).toBe('Done: Send welcome email');
  });
});
