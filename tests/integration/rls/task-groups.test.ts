import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `task_groups` (Phase 6).
 *
 * Task groups are the user-customisable "buckets" on the Tasks
 * page (Pre-event, Wedding day, Follow-up, etc.). Cross-tenant
 * access would expose another MC's organisational structure +
 * allow renaming or deleting their buckets.
 */
describe('RLS: task_groups tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let groupAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data, error } = await userA.client
      .from('task_groups')
      .insert({
        user_id: userA.id,
        name: 'A Pre-event',
        color: 'blue',
        position: 0,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    groupAId = data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own group', async () => {
    const { data } = await userA.client
      .from('task_groups')
      .select('id')
      .eq('id', groupAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('task_groups')
      .select('*')
      .eq('id', groupAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE it', async () => {
    await userB.client
      .from('task_groups')
      .update({ name: 'hacked' })
      .eq('id', groupAId);
    const { data } = await serviceClient()
      .from('task_groups')
      .select('name')
      .eq('id', groupAId)
      .single();
    expect(data?.name).toBe('A Pre-event');
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('task_groups').delete().eq('id', groupAId);
    const { count } = await serviceClient()
      .from('task_groups')
      .select('*', { count: 'exact', head: true })
      .eq('id', groupAId);
    expect(count).toBe(1);
  });

  it('anonymous client cannot read task_groups at all', async () => {
    const { data } = await anonClient()
      .from('task_groups')
      .select('*')
      .limit(1);
    expect(data).toEqual([]);
  });
});
