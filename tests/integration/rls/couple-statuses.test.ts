import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `couple_statuses` (Phase 4A).
 *
 * The table is user-customisable — every MC can rename / add / delete
 * their kanban-column statuses. Cross-tenant leakage here would let
 * one MC see (or worse, edit) another's pipeline shape.
 */
describe('RLS: couple_statuses tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let statusAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    // A's signup may have inserted default statuses via a trigger;
    // make a custom one so the test is deterministic.
    const { data, error } = await userA.client
      .from('couple_statuses')
      .insert({
        user_id: userA.id,
        name: 'A Custom Status',
        slug: `a-custom-${Date.now()}`,
        color: 'amber',
        position: 99,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    statusAId = data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own status row', async () => {
    const { data } = await userA.client
      .from('couple_statuses')
      .select('id')
      .eq('id', statusAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('couple_statuses')
      .select('*')
      .eq('id', statusAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE it', async () => {
    await userB.client
      .from('couple_statuses')
      .update({ name: 'hacked' })
      .eq('id', statusAId);
    const { data } = await serviceClient()
      .from('couple_statuses')
      .select('name')
      .eq('id', statusAId)
      .single();
    expect(data?.name).toBe('A Custom Status');
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('couple_statuses').delete().eq('id', statusAId);
    const { count } = await serviceClient()
      .from('couple_statuses')
      .select('*', { count: 'exact', head: true })
      .eq('id', statusAId);
    expect(count).toBe(1);
  });

  it('anonymous client cannot read couple_statuses at all', async () => {
    const { data } = await anonClient()
      .from('couple_statuses')
      .select('*')
      .limit(1);
    expect(data).toEqual([]);
  });
});
