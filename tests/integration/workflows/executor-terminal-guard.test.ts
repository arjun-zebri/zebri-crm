import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { executeStep, type StepOutcome } from '@/lib/workflows/execute-step';
import { runStepNow } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

vi.mock('@/lib/workflows/execute-step', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/workflows/execute-step')>();
  return { ...actual, executeStep: vi.fn(actual.executeStep) };
});

/**
 * The post-claim writes in `runOneStep` and `markErrored` guard on the
 * step still being `running`, not just its id. Today that guard is a
 * no-op: the platform's function timeout is far below the sweep's
 * staleness window, so no genuine runner is still alive by the time a
 * step gets swept. This proves the guard itself, standing in for the
 * runner that outlives the sweep by mocking `executeStep` to perform
 * the sweep's own write mid-flight, since a real 10-minute race is not
 * something a test can wait out.
 */
describe('runOneStep terminal write guard', () => {
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

  /** One instance with one runnable step, plus whatever extras are asked for. */
  async function fixture(name: string): Promise<{ instanceId: string; stepId: string }> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name, status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: `${name} workflow` })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: 'x' },
        status: 'pending',
      })
      .select('id')
      .single();
    return { instanceId: instance!.id, stepId: step!.id };
  }

  /**
   * Stand in for the sweep declaring this step dead while the (mocked)
   * handler is still "running": flip the row to errored mid-execution,
   * then hand back the given result, exactly as a real handler that
   * outlived the sweep would.
   */
  function sweepMidFlight(outcome: StepOutcome) {
    vi.mocked(executeStep).mockImplementationOnce(async (s) => {
      await admin
        .from('workflow_steps')
        .update({
          status: 'errored',
          error_message: 'SWEPT',
          completed_at: new Date().toISOString(),
        })
        .eq('id', s.id);
      return outcome;
    });
  }

  it('does not let a late completion write land on a row the sweep already moved on from', async () => {
    const { stepId } = await fixture('Guard Test');

    sweepMidFlight({ result: { kind: 'ok', output: null } });

    await runStepNow(admin, stepId);

    const { data: after } = await admin
      .from('workflow_steps')
      .select('status, error_message')
      .eq('id', stepId)
      .single();

    // The completion write from the mocked handler must not have landed:
    // the row still reads exactly as the sweep left it.
    expect(after!.status).toBe('errored');
    expect(after!.error_message).toBe('SWEPT');
  });

  /**
   * The guarded write is only half of it. Everything that followed it
   * described a step that had completed, and none of it was guarded, so
   * in exactly the race the guard exists for the MC saw an errored step
   * whose audit trail said it finished. The log is the record the
   * compliance work depends on, so it has to agree with the row.
   */
  it('does not log a completion for a step it no longer owns', async () => {
    const { stepId } = await fixture('Guard Audit Test');

    sweepMidFlight({ result: { kind: 'ok', output: { note_id: 'n1' } } });

    await runStepNow(admin, stepId);

    const { data } = await admin
      .from('workflow_audit_log')
      .select('event')
      .eq('step_id', stepId);
    const events = (data ?? []).map((row) => row.event);
    expect(events).toContain('step_started');
    expect(events).not.toContain('step_completed');
  });

  /**
   * Skipping is permanent: a branch child marked skipped never runs,
   * and nothing puts it back. Doing that off a completion that did not
   * land loses one side of the workflow for good.
   */
  it('does not skip the losing branch off a completion that did not land', async () => {
    const { instanceId, stepId } = await fixture('Guard Branch Test');
    const { data: losing } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instanceId,
        position: 1,
        type: 'todo',
        title: 'The other way',
        parent_step_id: stepId,
        branch_path: 'no',
        status: 'pending',
      })
      .select('id')
      .single();

    sweepMidFlight({ result: { kind: 'ok', output: null }, branchPath: 'yes' });

    await runStepNow(admin, stepId);

    const { data: after } = await admin
      .from('workflow_steps')
      .select('status')
      .eq('id', losing!.id)
      .single();
    expect(after!.status).toBe('pending');
  });

  /**
   * The same shape on the failure side. When the catch fires before a
   * claim succeeded, or the sweep has taken the row, the guarded update
   * correctly does nothing, but the audit row would still land: a
   * "retry scheduled" line against a step that is errored and waiting
   * on the MC.
   */
  it('does not log a retry it did not schedule', async () => {
    const { stepId } = await fixture('Guard Retry Test');

    sweepMidFlight({ result: { kind: 'error', message: 'provider blew up' } });

    await runStepNow(admin, stepId);

    const { data } = await admin
      .from('workflow_audit_log')
      .select('event')
      .eq('step_id', stepId);
    const events = (data ?? []).map((row) => row.event);
    expect(events).not.toContain('step_retry_scheduled');
    expect(events).not.toContain('step_errored');

    // And the row is still exactly what the sweep left.
    const { data: after } = await admin
      .from('workflow_steps')
      .select('status, error_message')
      .eq('id', stepId)
      .single();
    expect(after!.status).toBe('errored');
    expect(after!.error_message).toBe('SWEPT');
  });
});
