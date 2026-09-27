import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps, completeStep, reopenStep } from '@/lib/workflows/executor';
import { healStrandedInstances } from '@/lib/workflows/heal';
import type { Json } from '@/types/database';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * A to-do ticked early never lets the step below it run ahead of an
 * unfinished step above it.
 *
 * The owner's run on zebri-crm-dev (2026-09-27): send, Wait 1 min,
 * "email 2", to-do, "email 3". The MC ticked the to-do while email 2
 * was still behind the Wait; the recompute dated email 3 from the tick,
 * and the next tick sent email 3 a second before email 2. Replayed here
 * with the real executor. Stage changes stand in for the sends: the
 * order is the engine's, not the handler's, and they send nothing.
 */
describe('a to-do ticked early', () => {
  const admin = serviceClient();
  let user: TestUser;
  const CHAINED = { mode: 'after_previous', delayAmount: 0, unit: 'days' };
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

  async function addStep(instanceId: string, over: Record<string, Json | null>): Promise<string> {
    const { data, error } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instanceId,
        type: 'todo',
        title: 'step',
        config: {},
        status: 'pending',
        timing: CHAINED,
        ...over,
      } as never)
      .select('id')
      .single();
    expect(error).toBeNull();
    return (data as { id: string }).id;
  }

  async function read(id: string) {
    const { data } = await admin
      .from('workflow_steps')
      .select('status, due_at, completed_at')
      .eq('id', id)
      .single();
    return data as { status: string; due_at: string | null; completed_at: string | null };
  }

  async function newInstance(name: string): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name, status: 'Enquiry' })
      .select('id')
      .single();
    const { data: inst } = await user.client
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: `${name} workflow` })
      .select('id')
      .single();
    return inst!.id;
  }

  /** Email 1 done, a Wait asleep for five more minutes, email 2, a to-do, email 3. */
  async function ownerChain(instanceId: string) {
    await addStep(instanceId, {
      position: 100,
      type: 'action',
      status: 'done',
      config: { actionType: 'update_couple_stage', toStatus: 'Contacted' },
      due_at: PAST,
      completed_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const wait = await addStep(instanceId, {
      position: 200,
      type: 'wait',
      title: 'Wait',
      status: 'waiting',
      config: { mode: 'duration', durationMinutes: 5 },
      due_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    const email2 = await addStep(instanceId, {
      position: 300,
      type: 'action',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
    });
    const todo = await addStep(instanceId, { position: 400, title: 'Call them' });
    const email3 = await addStep(instanceId, {
      position: 500,
      type: 'action',
      config: { actionType: 'update_couple_stage', toStatus: 'Enquiry' },
    });
    return { wait, email2, todo, email3 };
  }

  it('a date the old rule wrote is cleared by the deploy repair and the heal, before any claim', async () => {
    const instanceId = await newInstance('Stale Date');
    const { email2, todo, email3 } = await ownerChain(instanceId);
    // The state the old one-step rule left: the to-do ticked early and
    // email 3 dated from the tick, in the past, while email 2 is open.
    const tickedAt = new Date(Date.now() - 30_000).toISOString();
    await admin
      .from('workflow_steps')
      .update({ status: 'done', completed_at: tickedAt } as never)
      .eq('id', todo);
    await admin.from('workflow_steps').update({ due_at: tickedAt } as never).eq('id', email3);

    // The migration's repair, then a tick: heal first, then its executor.
    const { error } = await admin.rpc('_workflow_clear_early_tick_dates' as never);
    expect(error).toBeNull();
    expect((await read(email3)).due_at).toBeNull();
    const { data: marked } = await admin
      .from('workflow_instances')
      .select('needs_recompute_at')
      .eq('id', instanceId)
      .single();
    expect((marked as { needs_recompute_at: string | null }).needs_recompute_at).not.toBeNull();

    await healStrandedInstances(admin);
    await advanceDueSteps(admin, { userId: user.id });
    expect((await read(email2)).status).toBe('pending');
    expect(await read(email3)).toMatchObject({ status: 'pending', due_at: null });
  });

  it('unticking the to-do re-gates the step below it', async () => {
    const instanceId = await newInstance('Untick');
    const { wait, email2, todo, email3 } = await ownerChain(instanceId);
    // Everything above the to-do has run, so ticking it releases email 3.
    await admin
      .from('workflow_steps')
      .update({ status: 'done', completed_at: new Date().toISOString() } as never)
      .in('id', [wait, email2]);
    expect(await completeStep(admin, todo)).toBe('done');
    expect((await read(email3)).due_at).not.toBeNull();

    await reopenStep(admin, todo);
    expect((await read(email3)).due_at).toBeNull();
  });

  it('a finished dated step does not release the send behind it past an open to-do (Final call)', async () => {
    // Owner ruling, 2026-09-27: "Send questionnaire" open, "Chase" undated
    // behind it, "Final call" dated two weeks before the wedding, "Thanks
    // for the call" straight after. The MC does the final call.
    const instanceId = await newInstance('Final Call');
    await addStep(instanceId, { position: 100, title: 'Send questionnaire', due_at: PAST });
    const chase = await addStep(instanceId, {
      position: 200,
      type: 'action',
      config: { actionType: 'update_couple_stage', toStatus: 'Contacted' },
    });
    const finalCall = await addStep(instanceId, {
      position: 300,
      title: 'Final call',
      timing: { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
      due_at: PAST,
    });
    const thanks = await addStep(instanceId, {
      position: 400,
      type: 'action',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' },
    });

    expect(await completeStep(admin, finalCall)).toBe('done');
    await advanceDueSteps(admin, { userId: user.id });
    expect(await read(thanks)).toMatchObject({ status: 'pending', due_at: null });
    expect(await read(chase)).toMatchObject({ status: 'pending', due_at: null });
  });

  it('holds the step below it until the step above has run, then runs them in order', async () => {
    const instanceId = await newInstance('Early Tick');
    const { wait, email2, todo, email3 } = await ownerChain(instanceId);

    // The MC ticks the to-do while email 2 is still behind the Wait.
    expect(await completeStep(admin, todo)).toBe('done');
    expect((await read(email3)).due_at).toBeNull();

    // A tick now runs nothing: the Wait is asleep and email 3 undated.
    await advanceDueSteps(admin, { userId: user.id });
    expect((await read(email2)).status).toBe('pending');
    expect((await read(email3)).status).toBe('pending');

    // The Wait's wake arrives; the next tick runs the rest of the chain.
    await admin.from('workflow_steps').update({ due_at: PAST } as never).eq('id', wait);
    await advanceDueSteps(admin, { userId: user.id });
    await advanceDueSteps(admin, { userId: user.id });

    const second = await read(email2);
    const third = await read(email3);
    expect(second.status).toBe('done');
    expect(third.status).toBe('done');
    expect(new Date(third.due_at!).getTime()).toBeGreaterThanOrEqual(
      new Date(second.completed_at!).getTime(),
    );
    expect(new Date(third.completed_at!).getTime()).toBeGreaterThanOrEqual(
      new Date(second.completed_at!).getTime(),
    );
  });
});
