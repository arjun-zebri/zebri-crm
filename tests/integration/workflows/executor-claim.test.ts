import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps, claimStep, runStepNow } from '@/lib/workflows/executor';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * A step is a unit of work exactly one caller may own. The tick, the
 * kick, approve-and-send and retry all race for the same row.
 */
describe('claimStep', () => {
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

  async function dueActionStep(): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Claim Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Claim Test workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: 'hello' },
        status: 'pending',
        due_at: PAST,
      })
      .select('id')
      .single();
    return step!.id;
  }

  /** A `wait` step whose sleep has already finished: due now, still `waiting`. */
  async function dueWaitStep(): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Claim Test', status: 'Enquiry' })
      .select('id')
      .single();
    const { data: instance } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Claim Test workflow' })
      .select('id')
      .single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instance!.id,
        position: 0,
        type: 'wait',
        title: 'Wait',
        config: { mode: 'duration', durationMinutes: 15 },
        status: 'waiting',
        due_at: PAST,
      })
      .select('id')
      .single();
    return step!.id;
  }

  it('lets exactly one caller win a concurrent claim', async () => {
    const stepId = await dueActionStep();

    const results = await Promise.all([claimStep(admin, stepId), claimStep(admin, stepId)]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('refuses a step that is already running', async () => {
    const stepId = await dueActionStep();
    expect(await claimStep(admin, stepId)).toBe(true);
    expect(await claimStep(admin, stepId)).toBe(false);
  });

  it('starts a step once when the tick and a manual run collide', async () => {
    // A single race is a coin flip: Promise.all gives no guarantee the two
    // calls actually interleave inside the claim window, so one pass can
    // pass by luck even with the guard missing. Repeating it with a fresh
    // instance and step each time raises the odds a regression gets
    // caught. Do not shrink this back to one repetition.
    for (let i = 0; i < 5; i += 1) {
      const stepId = await dueActionStep();

      await Promise.all([advanceDueSteps(admin), runStepNow(admin, stepId)]);

      const { data: started } = await admin
        .from('workflow_audit_log')
        .select('id')
        .eq('step_id', stepId)
        .eq('event', 'step_started');
      expect(started ?? []).toHaveLength(1);
    }
  });

  it('completes an already-slept wait step once when the tick and a manual run collide', async () => {
    // The wait-completion branch in runOneStep is a second write site,
    // separate from claimStep, that needs its own status guard: without
    // one, two callers holding the same in-memory `waiting` row could
    // both pass the type/status check and both write. No duplicate email
    // results from that (a wait has no side effect), but the audit log
    // and the recompute would both double, corrupting the record of
    // what happened.
    const stepId = await dueWaitStep();

    await Promise.all([advanceDueSteps(admin), runStepNow(admin, stepId)]);

    const { data: completed } = await admin
      .from('workflow_audit_log')
      .select('id')
      .eq('step_id', stepId)
      .eq('event', 'step_completed');
    expect(completed ?? []).toHaveLength(1);
  });
});
