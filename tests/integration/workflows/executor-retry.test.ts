import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps, reopenStep } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * A step that fails for a reason that might pass next time is
 * rescheduled, not buried. Only the last attempt is terminal.
 */
describe('executor retry', () => {
  const admin = serviceClient();
  let user: TestUser;
  const PAST = '2026-01-01T00:00:00.000Z';

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  /**
   * `send_email` against a couple with no address fails in the handler,
   * which is the cheapest real failure to provoke without a network.
   */
  async function failingStep(): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Retry Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Retry Test workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Send email',
        config: { actionType: 'send_email', subject: 'Hi', body: 'Hello', recipients: ['couple'] },
        status: 'pending',
        due_at: PAST,
      })
      .select('id')
      .single();
    return step!.id;
  }

  it('reschedules the first failure instead of erroring', async () => {
    const stepId = await failingStep();

    await advanceDueSteps(admin);

    const { data } = await admin
      .from('workflow_steps')
      .select('status, attempt_count, due_at')
      .eq('id', stepId)
      .single();
    expect(data!.status).toBe('pending');
    expect(data!.attempt_count).toBe(1);
    expect(new Date(data!.due_at!).getTime()).toBeGreaterThan(Date.now());
  });

  /**
   * The sibling-completion variant of this exclusion (does a full-instance
   * recompute leave the backoff alone) has moved to
   * `executor-recompute.test.ts`, alongside the other two
   * `recomputeInstance`-only exclusions, so all three live in one place.
   */

  /**
   * Not every failure is worth repeating. An action that reports
   * `recoverable: false` is saying a second attempt cannot do better:
   * a setting only the MC can fix, or a send whose transport cannot
   * deduplicate, where retrying risks a second copy in the couple's
   * inbox rather than a second chance. `send_sms` is the cheapest real
   * one to provoke: it is not wired yet and says so.
   */
  it('buries a failure the action says cannot be retried, on the first attempt', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Unretryable Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Unretryable workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Text the couple',
        config: {
          actionType: 'send_sms',
          recipients: { roles: ['primary'], fallback: 'primary_only' },
          body: 'On my way',
        },
        status: 'pending',
        due_at: PAST,
      })
      .select('id')
      .single();

    await advanceDueSteps(admin);

    const { data } = await admin
      .from('workflow_steps')
      .select('status, attempt_count')
      .eq('id', step!.id)
      .single();
    expect(data!.status).toBe('errored');
    expect(data!.attempt_count).toBe(1);
  });

  /**
   * The other side of the backoff exclusion. A step keeps its
   * `attempt_count` after it eventually succeeds, so un-ticking it from
   * the Done strip used to hand back a `pending` step that both
   * recompute paths now refuse to touch: frozen on the stale due date it
   * was last retried on, sending again on the next tick rather than on
   * schedule, and never rescheduled by a wedding-date change again.
   */
  it('clears the spent attempt when the MC un-ticks a step', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Reopen Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({
        user_id: user.id,
        couple_id: couple!.id,
        name: 'Reopen Test workflow',
        applied_at: PAST,
      })
      .select('id')
      .single();
    // A step that failed once, then succeeded: done, one attempt spent,
    // and holding the due date of the retry that worked.
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: 'x' },
        status: 'done',
        attempt_count: 1,
        due_at: '2020-06-01T00:00:00.000Z',
        completed_at: '2020-06-01T00:01:00.000Z',
      })
      .select('id')
      .single();

    await reopenStep(admin, step!.id);

    const { data } = await admin
      .from('workflow_steps')
      .select('status, attempt_count, due_at')
      .eq('id', step!.id)
      .single();
    expect(data!.status).toBe('pending');
    expect(data!.attempt_count).toBe(0);
    // And the recompute reached it: the head of the lane anchors to the
    // apply instant, not to the old retry's due date. Compared as
    // instants, since Postgres hands the timestamp back in its own
    // format rather than the ISO string it was given.
    expect(new Date(data!.due_at!).getTime()).toBe(new Date(PAST).getTime());
  });

  it('errors once the attempts are spent', async () => {
    const stepId = await failingStep();
    await admin.from('workflow_steps').update({ attempt_count: 3 }).eq('id', stepId);

    await advanceDueSteps(admin);

    const { data } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', stepId)
      .single();
    expect(data!.status).toBe('errored');
  });
});
