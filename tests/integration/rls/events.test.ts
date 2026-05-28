import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `events` (Phase 4A).
 *
 * Events are owned by both a `user_id` (the MC) AND a `couple_id`
 * (cascade-deleted with the couple). The `auth.uid() = user_id`
 * policy enforces per-tenant scoping; deleting User A's couple
 * cascades the event without User B ever seeing it.
 */
describe('RLS: events tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let coupleAId: string;
  let eventAId: string;

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
    coupleAId = coupleRes.data!.id;

    const eventRes = await userA.client
      .from('events')
      .insert({
        user_id: userA.id,
        couple_id: coupleAId,
        date: '2026-09-14',
        venue: 'Venue A',
      })
      .select('id')
      .single();
    expect(eventRes.error).toBeNull();
    eventAId = eventRes.data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own event', async () => {
    const { data } = await userA.client
      .from('events')
      .select('id')
      .eq('id', eventAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('events')
      .select('*')
      .eq('id', eventAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE it', async () => {
    await userB.client
      .from('events')
      .update({ venue: 'hacked' })
      .eq('id', eventAId);
    const { data } = await serviceClient()
      .from('events')
      .select('venue')
      .eq('id', eventAId)
      .single();
    expect(data?.venue).toBe('Venue A');
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('events').delete().eq('id', eventAId);
    const { count } = await serviceClient()
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('id', eventAId);
    expect(count).toBe(1);
  });

  it('anonymous client cannot read events at all', async () => {
    const { data } = await anonClient().from('events').select('*').limit(1);
    expect(data).toEqual([]);
  });
});
