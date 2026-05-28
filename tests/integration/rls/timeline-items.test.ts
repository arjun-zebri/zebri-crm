import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `timeline_items` (Phase 4C).
 *
 * Timeline items are owned by `user_id` and scoped to an `event_id`.
 * Cross-tenant SELECT / UPDATE / DELETE must be denied even when
 * the attacker knows the item id.
 */
describe('RLS: timeline_items tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let itemAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const coupleRes = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'A Couple', status: 'enquiry' })
      .select('id')
      .single();
    expect(coupleRes.error).toBeNull();

    const eventRes = await userA.client
      .from('events')
      .insert({
        user_id: userA.id,
        couple_id: coupleRes.data!.id,
        date: '2026-09-14',
        venue: 'A Venue',
      })
      .select('id')
      .single();
    expect(eventRes.error).toBeNull();

    const itemRes = await userA.client
      .from('timeline_items')
      .insert({
        user_id: userA.id,
        event_id: eventRes.data!.id,
        title: 'A item',
        position: 0,
      })
      .select('id')
      .single();
    expect(itemRes.error).toBeNull();
    itemAId = itemRes.data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own timeline item', async () => {
    const { data } = await userA.client
      .from('timeline_items')
      .select('id')
      .eq('id', itemAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('timeline_items')
      .select('*')
      .eq('id', itemAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE it', async () => {
    await userB.client
      .from('timeline_items')
      .update({ title: 'hacked' })
      .eq('id', itemAId);
    const { data } = await serviceClient()
      .from('timeline_items')
      .select('title')
      .eq('id', itemAId)
      .single();
    expect(data?.title).toBe('A item');
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('timeline_items').delete().eq('id', itemAId);
    const { count } = await serviceClient()
      .from('timeline_items')
      .select('*', { count: 'exact', head: true })
      .eq('id', itemAId);
    expect(count).toBe(1);
  });

  it('anonymous client cannot read timeline_items at all', async () => {
    const { data } = await anonClient()
      .from('timeline_items')
      .select('*')
      .limit(1);
    expect(data).toEqual([]);
  });
});
