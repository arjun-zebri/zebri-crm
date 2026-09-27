import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { completeStep, sweepStuckSteps } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * A step marked running by a function that then died is invisible to
 * every other path: the tick skips it, Try again refuses it.
 */
describe('sweepStuckSteps', () => {
  const admin = serviceClient();
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  async function runningStep(updatedAt: string): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Stuck Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Stuck Test workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Send email',
        config: { actionType: 'add_note', text: 'x' },
        status: 'running',
        updated_at: updatedAt,
      })
      .select('id')
      .single();
    return step!.id;
  }

  it('errors a step that has been running too long', async () => {
    const stepId = await runningStep('2026-01-01T00:00:00.000Z');

    const recovered = await sweepStuckSteps(admin);

    expect(recovered).toBeGreaterThanOrEqual(1);
    const { data } = await admin
      .from('workflow_steps')
      .select('status, error_message')
      .eq('id', stepId)
      .single();
    expect(data!.status).toBe('errored');
    expect(data!.error_message).toContain('did not finish');
  });

  /**
   * The sweep is a status transition like any other, and the audit log
   * is the only durable record of what the engine did once the step's
   * own status has moved on. Without a row here, the one transition
   * nobody chose is also the only one that leaves no trace: the couple
   * profile's activity list runs from "started" to nothing at all, and
   * the compliance trail has a hole exactly where a send may or may not
   * have gone out.
   */
  it('writes an audit row for the step it recovered', async () => {
    const stepId = await runningStep('2026-01-01T00:00:00.000Z');

    await sweepStuckSteps(admin);

    const { data } = await admin
      .from('workflow_audit_log')
      .select('event, detail')
      .eq('step_id', stepId);
    const errored = (data ?? []).filter((row) => row.event === 'step_errored');
    expect(errored).toHaveLength(1);
    // `reason` separates it from a step whose action failed: this one may
    // have sent before the function died.
    expect(errored[0]!.detail).toMatchObject({ reason: 'stuck_sweep' });
  });

  it('leaves a step that started a moment ago alone', async () => {
    const stepId = await runningStep(new Date().toISOString());

    await sweepStuckSteps(admin);

    const { data } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', stepId)
      .single();
    expect(data!.status).toBe('running');
  });

  /**
   * A sibling completing must not rewind a stuck step's clock.
   *
   * `completeStep` recomputes every non-terminal step in the instance,
   * the running one included. If that recompute writes the running
   * step's row, the `workflow_steps_set_updated_at` trigger stamps a
   * fresh `updated_at` and the step dodges the sweep for another full
   * threshold, indefinitely, since a workflow's steps keep completing.
   */
  it('does not let a sibling recompute rewind a stuck step past the sweep', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Rewind Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Rewind Test workflow' })
      .select('id')
      .single();

    // The predecessor: a manual to-do, not yet ticked.
    const { data: todo } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'todo',
        title: 'Confirm menu',
        config: {},
        status: 'pending',
      })
      .select('id')
      .single();

    // The stuck step: after_previous behind the to-do above, forced into
    // running with a stale updated_at, simulating a function that died
    // mid-execution. Its due_at is deliberately not what recomputing it
    // against the to-do's completion would produce, so an unguarded
    // recompute has a real new value to write.
    const { data: stuck } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 1,
        type: 'action',
        title: 'Send confirmation',
        config: { actionType: 'add_note', text: 'x' },
        timing: { mode: 'after_previous', delayAmount: 60, unit: 'minutes' },
        status: 'running',
        due_at: '2020-06-01T00:00:00.000Z',
        updated_at: '2020-01-01T00:00:00.000Z',
      })
      .select('id')
      .single();

    // Ticking the to-do is the sibling completion that triggers the
    // instance-wide recompute.
    await completeStep(admin, todo!.id);

    const recovered = await sweepStuckSteps(admin);

    const { data: after } = await admin
      .from('workflow_steps')
      .select('status, updated_at')
      .eq('id', stuck!.id)
      .single();

    // If the recompute had touched the row, updated_at would now be
    // recent and the sweep above would have left it running.
    expect(after!.status).toBe('errored');
    expect(recovered).toBeGreaterThanOrEqual(1);
  });
});
