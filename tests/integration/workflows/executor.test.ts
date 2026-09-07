import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps, completeStep, reopenStep } from '@/lib/workflows/executor';
import type { Json } from '@/types/database';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The executor, end to end against real action handlers.
 *
 * The load-bearing case is "ticking a to-do releases the automated step
 * behind it". Everything else in the feature is presentation; that is the
 * mechanism.
 */
describe('advanceDueSteps / completeStep', () => {
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

  /** A couple with its own ad-hoc instance to hang steps off. */
  async function scenario(name: string): Promise<{ coupleId: string; instanceId: string }> {
    const { data: couple, error } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name, status: 'Enquiry' })
      .select('id')
      .single();
    expect(error).toBeNull();

    const { data: inst, error: instErr } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: `${name} workflow` })
      .select('id')
      .single();
    expect(instErr).toBeNull();
    return { coupleId: couple!.id, instanceId: inst!.id };
  }

  async function addStep(
    instanceId: string,
    over: Record<string, Json | null>,
  ): Promise<string> {
    const { data, error } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instanceId,
        position: 0,
        type: 'todo',
        title: 'step',
        config: {},
        status: 'pending',
        ...over,
      } as never)
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id;
  }

  async function step(id: string) {
    const { data } = await admin.from('workflow_steps').select('*').eq('id', id).single();
    return data!;
  }

  it('runs a due action step through its real handler', async () => {
    const { coupleId, instanceId } = await scenario('Executor Basic');
    const stepId = await addStep(instanceId, {
      type: 'action',
      title: 'Move to Booked',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      due_at: PAST,
    });

    const result = await advanceDueSteps(admin);
    expect(result.stepsExecuted).toBeGreaterThan(0);

    expect((await step(stepId)).status).toBe('done');
    const { data: couple } = await admin
      .from('couples').select('status').eq('id', coupleId).single();
    expect(couple!.status).toBe('Booked');
  });

  it('runs steps of one instance in position order when they fall due together', async () => {
    // Two steps of one workflow can share a due instant (a template
    // applied with zero offsets). Without a position tiebreak the second
    // can run first, and a step reading the previous step's output finds
    // nothing. That failed intermittently before the tiebreak existed.
    const { instanceId } = await scenario('Executor Order');
    const first = await addStep(instanceId, {
      position: 0,
      type: 'action',
      title: 'first',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      due_at: PAST,
    });
    const second = await addStep(instanceId, {
      position: 1,
      type: 'action',
      title: 'second',
      config: { actionType: 'update_couple_stage', toStatus: 'Enquiry' },
      due_at: PAST,
    });

    await advanceDueSteps(admin);

    const a = await step(first);
    const b = await step(second);
    expect(a.status).toBe('done');
    expect(b.status).toBe('done');
    expect(new Date(b.completed_at!).getTime()).toBeGreaterThanOrEqual(
      new Date(a.completed_at!).getTime(),
    );
  });

  it('records output on the step and merges it into the instance context', async () => {
    const { instanceId } = await scenario('Executor Output');
    const stepId = await addStep(instanceId, {
      type: 'action',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      due_at: PAST,
    });

    await advanceDueSteps(admin);

    const row = await step(stepId);
    expect(row.output).toMatchObject({ to_status: 'Booked' });
    const { data: inst } = await admin
      .from('workflow_instances').select('context').eq('id', instanceId).single();
    const outputs = (inst!.context as Record<string, unknown>)['step_outputs'] as Record<string, unknown>;
    expect(outputs[stepId]).toMatchObject({ to_status: 'Booked' });
  });

  it('marks a failing step errored and leaves the instance active', async () => {
    const { instanceId } = await scenario('Executor Failure');
    const badId = await addStep(instanceId, {
      type: 'action',
      title: 'Broken',
      config: { actionType: 'not_a_real_action' },
      due_at: PAST,
    });

    await advanceDueSteps(admin);

    const row = await step(badId);
    expect(row.status).toBe('errored');
    expect(row.error_message).toContain('not_a_real_action');

    const { data: inst } = await admin
      .from('workflow_instances').select('status').eq('id', instanceId).single();
    // Deliberately still active: the MC fixes the config and retries
    // rather than losing the whole workflow to one bad step.
    expect(inst!.status).toBe('active');
  });

  it('does not touch a manual to-do however overdue it is', async () => {
    const { instanceId } = await scenario('Executor Manual');
    const stepId = await addStep(instanceId, { type: 'todo', due_at: PAST });

    await advanceDueSteps(admin);

    expect((await step(stepId)).status).toBe('pending');
  });

  it('ticking a to-do releases the automated step gated behind it', async () => {
    // The single most important assertion in the suite.
    const { coupleId, instanceId } = await scenario('Executor Gating');
    const todoId = await addStep(instanceId, {
      position: 0,
      type: 'todo',
      title: 'Call the venue',
      due_at: PAST,
    });
    const actionId = await addStep(instanceId, {
      position: 1,
      type: 'action',
      title: 'Then move them to Booked',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      due_at: null,
    });

    // Gated: nothing to run yet.
    await advanceDueSteps(admin);
    expect((await step(actionId)).status).toBe('pending');
    expect((await step(actionId)).due_at).toBeNull();

    await completeStep(admin, todoId);

    // Ticking the to-do gave the next step a due_at.
    expect((await step(actionId)).due_at).not.toBeNull();

    await advanceDueSteps(admin);
    expect((await step(actionId)).status).toBe('done');
    const { data: couple } = await admin
      .from('couples').select('status').eq('id', coupleId).single();
    expect(couple!.status).toBe('Booked');
  });

  it('skipping a to-do also releases the step behind it', async () => {
    const { instanceId } = await scenario('Executor Skip');
    const todoId = await addStep(instanceId, { position: 0, type: 'todo', due_at: PAST });
    const actionId = await addStep(instanceId, {
      position: 1,
      type: 'action',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      due_at: null,
    });

    await completeStep(admin, todoId, { skipped: true });

    expect((await step(todoId)).status).toBe('skipped');
    expect((await step(actionId)).due_at).not.toBeNull();
  });

  it('un-ticking a step re-gates what it released', async () => {
    const { instanceId } = await scenario('Executor Reopen');
    const todoId = await addStep(instanceId, { position: 0, type: 'todo', due_at: PAST });
    const actionId = await addStep(instanceId, {
      position: 1,
      type: 'action',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
      due_at: null,
    });

    await completeStep(admin, todoId);
    expect((await step(actionId)).due_at).not.toBeNull();

    await reopenStep(admin, todoId);
    expect((await step(todoId)).status).toBe('pending');
    expect((await step(actionId)).due_at).toBeNull();
  });

  it('a wait step sleeps, then completes on a later tick', async () => {
    const { instanceId } = await scenario('Executor Wait');
    const waitId = await addStep(instanceId, {
      type: 'wait',
      title: 'Wait 3 days',
      config: { mode: 'duration', durationMinutes: 4320 },
      due_at: PAST,
    });

    await advanceDueSteps(admin);
    const sleeping = await step(waitId);
    expect(sleeping.status).toBe('waiting');
    expect(new Date(sleeping.due_at!).getTime()).toBeGreaterThan(Date.now());

    // Pull the wake time into the past and tick again.
    await admin.from('workflow_steps').update({ due_at: PAST }).eq('id', waitId);
    await advanceDueSteps(admin);
    expect((await step(waitId)).status).toBe('done');
  });

  it('a branch takes one path and skips the other', async () => {
    const { instanceId } = await scenario('Executor Branch');
    const branchId = await addStep(instanceId, {
      type: 'branch',
      title: 'Signed a contract?',
      // The couple has signed nothing, so this evaluates false.
      config: { predicate: { kind: 'has_signed_contract' } },
      due_at: PAST,
    });
    const { data: kids, error: kidErr } = await admin.from('workflow_steps').insert([
      {
        instance_id: instanceId, position: 0, type: 'todo', title: 'Yes path',
        parent_step_id: branchId, branch_path: 'yes', config: {}, status: 'pending',
      },
      {
        instance_id: instanceId, position: 0, type: 'todo', title: 'No path',
        parent_step_id: branchId, branch_path: 'no', config: {}, status: 'pending',
      },
    ]).select('id, title');
    expect(kidErr).toBeNull();

    await advanceDueSteps(admin);

    expect((await step(branchId)).status).toBe('done');
    const yesId = kids!.find((k) => k.title === 'Yes path')!.id;
    const noId = kids!.find((k) => k.title === 'No path')!.id;
    // Predicate false, so the "no" path is taken and "yes" is skipped.
    expect((await step(yesId)).status).toBe('skipped');
    expect((await step(noId)).status).toBe('pending');

    const { data: audit } = await admin
      .from('workflow_audit_log').select('event, detail').eq('instance_id', instanceId);
    const branchRow = audit!.find((a) => a.event === 'branch_taken');
    expect(branchRow).toBeDefined();
    expect((branchRow!.detail as Record<string, unknown>).path).toBe('no');
  });

  it('completes the instance when nothing is left to do', async () => {
    const { instanceId } = await scenario('Executor Complete');
    const stepId = await addStep(instanceId, { type: 'todo', due_at: PAST });

    await completeStep(admin, stepId);

    const { data: inst } = await admin
      .from('workflow_instances').select('status, completed_at').eq('id', instanceId).single();
    expect(inst!.status).toBe('completed');
    expect(inst!.completed_at).not.toBeNull();

    const { data: audit } = await admin
      .from('workflow_audit_log').select('event').eq('instance_id', instanceId);
    expect(audit!.map((a) => a.event)).toContain('instance_completed');
  });

  it('never completes the couple default instance, which is an open-ended list', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Executor Default' })
      .select('id')
      .single();
    const { data: def } = await admin
      .from('workflow_instances')
      .select('id').eq('couple_id', couple!.id).eq('is_default', true).single();

    const stepId = await addStep(def!.id, { type: 'todo', due_at: PAST });
    await completeStep(admin, stepId);

    const { data: inst } = await admin
      .from('workflow_instances').select('status').eq('id', def!.id).single();
    expect(inst!.status).toBe('active');
  });

  it('does not run steps belonging to a cancelled instance', async () => {
    const { instanceId } = await scenario('Executor Cancelled');
    const stepId = await addStep(instanceId, {
      type: 'action',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      due_at: PAST,
    });
    await admin.from('workflow_instances').update({ status: 'cancelled' }).eq('id', instanceId);

    await advanceDueSteps(admin);

    expect((await step(stepId)).status).toBe('pending');
  });

  it('holds a step that requires approval', async () => {
    const { instanceId } = await scenario('Executor Approval');
    const stepId = await addStep(instanceId, {
      type: 'action',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
      due_at: PAST,
      requires_approval: true,
    });

    await advanceDueSteps(admin);

    expect((await step(stepId)).status).toBe('pending');
  });
});
