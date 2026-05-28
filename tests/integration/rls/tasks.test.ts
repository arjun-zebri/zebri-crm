import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `tasks` (Phase 4B).
 *
 * Tasks are owned by `user_id` and optionally linked to a couple
 * (`related_couple_id`) or event (`related_event_id`). Cross-tenant
 * SELECT/UPDATE/DELETE must be denied even when the attacker knows
 * the task id.
 */
describe('RLS: tasks tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let taskAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data, error } = await userA.client
      .from('tasks')
      .insert({
        user_id: userA.id,
        title: 'A Task',
        status: 'todo',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    taskAId = data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own task', async () => {
    const { data } = await userA.client
      .from('tasks')
      .select('id')
      .eq('id', taskAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('tasks')
      .select('*')
      .eq('id', taskAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE it', async () => {
    await userB.client
      .from('tasks')
      .update({ title: 'hacked' })
      .eq('id', taskAId);
    const { data } = await serviceClient()
      .from('tasks')
      .select('title')
      .eq('id', taskAId)
      .single();
    expect(data?.title).toBe('A Task');
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('tasks').delete().eq('id', taskAId);
    const { count } = await serviceClient()
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('id', taskAId);
    expect(count).toBe(1);
  });

  it('anonymous client cannot read tasks at all', async () => {
    const { data } = await anonClient().from('tasks').select('*').limit(1);
    expect(data).toEqual([]);
  });
});
