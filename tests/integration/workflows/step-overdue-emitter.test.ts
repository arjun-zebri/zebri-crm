import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { stepOverdueEmitter } from '@/lib/workflows/emitters/step-overdue';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The `step_overdue` emitter, which replaces the retired `task_overdue`.
 *
 * The property that matters most is the day-bucket dedupe: without it the
 * emitter re-fires on every tick, which on a minute-grain cron would mean
 * 1440 events a day per overdue step.
 */
describe('stepOverdueEmitter', () => {
  const admin = serviceClient();
  let user: TestUser;
  let coupleId: string;
  let instanceId: string;

  const PAST = '2026-01-01T00:00:00.000Z';
  const FUTURE = '2099-01-01T00:00:00.000Z';

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Overdue Couple' })
      .select('id')
      .single();
    coupleId = couple!.id;
    const { data: inst } = await admin
      .from('workflow_instances')
      .select('id')
      .eq('couple_id', coupleId)
      .single();
    instanceId = inst!.id;
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  async function addStep(over: Record<string, unknown>): Promise<string> {
    const { data, error } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: instanceId,
        position: 0,
        type: 'todo',
        title: 'Overdue thing',
        config: {},
        status: 'pending',
        ...over,
      } as never)
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id;
  }

  async function eventsFor(stepId: string) {
    const { data } = await admin
      .from('automation_events')
      .select('payload')
      .eq('event_type', 'step_overdue')
      .eq('source_id', stepId);
    return data ?? [];
  }

  it('emits once for an overdue pending to-do, with a useful payload', async () => {
    const stepId = await addStep({ due_at: PAST });
    await stepOverdueEmitter.run(admin);

    const events = await eventsFor(stepId);
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.step_id).toBe(stepId);
    expect(payload.instance_id).toBe(instanceId);
    expect(payload.couple_id).toBe(coupleId);
    expect(payload.step_type).toBe('todo');
    expect(Number(payload.days_overdue)).toBeGreaterThan(0);
  });

  it('does not re-emit on a second run the same day', async () => {
    const stepId = await addStep({ due_at: PAST });
    await stepOverdueEmitter.run(admin);
    await stepOverdueEmitter.run(admin);
    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(stepId)).toHaveLength(1);
  });

  it('ignores a step that is not yet due', async () => {
    const stepId = await addStep({ due_at: FUTURE });
    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(stepId)).toHaveLength(0);
  });

  it('ignores a step that is already done or skipped', async () => {
    const doneId = await addStep({ due_at: PAST, status: 'done' });
    const skippedId = await addStep({ due_at: PAST, status: 'skipped' });
    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(doneId)).toHaveLength(0);
    expect(await eventsFor(skippedId)).toHaveLength(0);
  });

  it('ignores automated steps, which are the engine’s problem not the MC’s', async () => {
    const stepId = await addStep({ due_at: PAST, type: 'action', config: { actionType: 'add_note' } });
    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(stepId)).toHaveLength(0);
  });

  it('ignores steps in a cancelled instance', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Cancelled Couple' })
      .select('id').single();
    const { data: inst } = await admin
      .from('workflow_instances').select('id').eq('couple_id', couple!.id).single();
    const { data: step } = await admin
      .from('workflow_steps')
      .insert({
        instance_id: inst!.id, position: 0, type: 'todo', title: 'Nagging',
        config: {}, status: 'pending', due_at: PAST,
      } as never)
      .select('id').single();
    await admin.from('workflow_instances').update({ status: 'cancelled' }).eq('id', inst!.id);

    await stepOverdueEmitter.run(admin);
    expect(await eventsFor(step!.id)).toHaveLength(0);
  });
});
