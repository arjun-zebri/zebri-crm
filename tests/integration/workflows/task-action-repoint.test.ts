import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { advanceDueSteps } from '@/lib/workflows/executor';
import type { Json } from '@/types/database';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The four to-do actions after the cutover.
 *
 * `create_task`, `update_task`, `create_calendar_event` and
 * `create_reminder` keep their slugs so converted workflows still parse,
 * but they now write `workflow_steps` on the couple's default workflow
 * instead of rows in the retired `tasks` table.
 */
describe('to-do actions write workflow steps', () => {
  const admin = serviceClient();
  let user: TestUser;

  const PAST = '2026-01-01T00:00:00.000Z';

  beforeAll(async () => {
    user = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    await admin
      .from('user_public_settings')
      .upsert({ user_id: user.id, timezone: 'Australia/Sydney' }, { onConflict: 'user_id' });
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  /** A couple plus its own instance to hang the action step off. */
  async function scenario(
    name: string,
    eventDate: string | null = null,
  ): Promise<{ coupleId: string; instanceId: string; defaultInstanceId: string }> {
    const { data: couple, error } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name, status: 'Enquiry', event_date: eventDate })
      .select('id')
      .single();
    expect(error).toBeNull();

    // The couples INSERT trigger already made the default instance; the
    // generated to-do has to land on that one, not the driving instance.
    const { data: def } = await admin
      .from('workflow_instances')
      .select('id')
      .eq('couple_id', couple!.id)
      .eq('is_default', true)
      .single();

    const { data: inst, error: instErr } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: `${name} driver` })
      .select('id')
      .single();
    expect(instErr).toBeNull();

    return { coupleId: couple!.id, instanceId: inst!.id, defaultInstanceId: def!.id };
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
        type: 'action',
        title: 'driver',
        config: {},
        status: 'pending',
        due_at: PAST,
        ...over,
      } as never)
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id;
  }

  /** Steps on an instance, excluding the one that drove the action. */
  async function stepsOn(instanceId: string) {
    const { data } = await admin
      .from('workflow_steps')
      .select('*')
      .eq('instance_id', instanceId)
      .order('position', { ascending: true });
    return data ?? [];
  }

  it('create_task adds a to-do to the couple default workflow, not a tasks row', async () => {
    const { coupleId, instanceId, defaultInstanceId } = await scenario('Repoint Create');
    await addStep(instanceId, {
      config: { actionType: 'create_task', title: 'Call the venue', description: 'About parking' },
    });

    await advanceDueSteps(admin);

    const todos = await stepsOn(defaultInstanceId);
    const created = todos.find((s) => s.title === 'Call the venue');
    expect(created).toBeDefined();
    expect(created!.type).toBe('todo');
    expect(created!.description).toBe('About parking');
    expect(created!.status).toBe('pending');

    const { count } = await admin
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('related_couple_id', coupleId);
    expect(count).toBe(0);
  });

  it('anchors a relative-to-event due date in the MC timezone', async () => {
    const { instanceId, defaultInstanceId } = await scenario('Repoint Relative', '2026-11-14');
    await addStep(instanceId, {
      config: {
        actionType: 'create_task',
        title: 'Two weeks out',
        relativeToEvent: { direction: 'before', amount: 2, unit: 'weeks' },
      },
    });

    await advanceDueSteps(admin);

    const created = (await stepsOn(defaultInstanceId)).find((s) => s.title === 'Two weeks out');
    // 14 Nov minus 2 weeks is 31 Oct; midnight in Sydney is 13:00 UTC on
    // the 30th. Millisecond arithmetic on a parsed date lands a day out.
    expect(created!.due_at).toBe('2026-10-30T13:00:00+00:00');
  });

  it('update_task patches the step an earlier step created', async () => {
    const { instanceId, defaultInstanceId } = await scenario('Repoint Update');
    await addStep(instanceId, {
      position: 0,
      config: { actionType: 'create_task', title: 'Draft the run sheet' },
    });
    await addStep(instanceId, {
      position: 1,
      config: { actionType: 'update_task', status: 'done', title: 'Run sheet sent' },
    });

    await advanceDueSteps(admin);
    // The second step is gated behind the first, so the tick has to run
    // twice for the chain to complete.
    await advanceDueSteps(admin);

    const todos = await stepsOn(defaultInstanceId);
    const patched = todos.find((s) => s.title === 'Run sheet sent');
    expect(patched).toBeDefined();
    expect(patched!.status).toBe('done');
    expect(patched!.completed_at).not.toBeNull();
    expect(todos.find((s) => s.title === 'Draft the run sheet')).toBeUndefined();
  });

  it('create_calendar_event adds a dated to-do', async () => {
    const { instanceId, defaultInstanceId } = await scenario('Repoint Calendar');
    await addStep(instanceId, {
      config: {
        actionType: 'create_calendar_event',
        title: 'Rehearsal',
        date: '2026-11-13',
        notes: 'At the chapel',
      },
    });

    await advanceDueSteps(admin);

    const created = (await stepsOn(defaultInstanceId)).find((s) => s.title === 'Rehearsal');
    expect(created).toBeDefined();
    expect(created!.type).toBe('todo');
    expect(created!.description).toBe('At the chapel');
    expect(created!.due_at).toBe('2026-11-12T13:00:00+00:00');
  });

  it('create_reminder behaves the same way', async () => {
    const { instanceId, defaultInstanceId } = await scenario('Repoint Reminder');
    await addStep(instanceId, {
      config: { actionType: 'create_reminder', title: 'Charge the batteries', date: '2026-11-13' },
    });

    await advanceDueSteps(admin);

    const created = (await stepsOn(defaultInstanceId)).find(
      (s) => s.title === 'Charge the batteries',
    );
    expect(created).toBeDefined();
    expect(created!.due_at).toBe('2026-11-12T13:00:00+00:00');
  });

  it('refuses to patch another tenant to-do', async () => {
    const other = await createTestUser(
      {},
      { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    );
    try {
      const { data: theirCouple } = await admin
        .from('couples')
        .insert({ user_id: other.id, name: 'Not Yours' })
        .select('id')
        .single();
      const { data: theirInstance } = await admin
        .from('workflow_instances')
        .select('id')
        .eq('couple_id', theirCouple!.id)
        .eq('is_default', true)
        .single();
      const { data: theirStep } = await admin
        .from('workflow_steps')
        .insert({
          instance_id: theirInstance!.id,
          position: 1,
          type: 'todo',
          title: 'Their to-do',
          config: {},
          status: 'pending',
        })
        .select('id')
        .single();

      const { instanceId } = await scenario('Repoint Tenancy');
      const driverId = await addStep(instanceId, {
        config: { actionType: 'update_task', taskId: theirStep!.id, status: 'done' },
      });

      await advanceDueSteps(admin);

      const { data: driver } = await admin
        .from('workflow_steps')
        .select('status, error_message')
        .eq('id', driverId)
        .single();
      expect(driver!.status).toBe('errored');

      const { data: untouched } = await admin
        .from('workflow_steps')
        .select('status')
        .eq('id', theirStep!.id)
        .single();
      expect(untouched!.status).toBe('pending');
    } finally {
      await other.cleanup();
    }
  });
});
