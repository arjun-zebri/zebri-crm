import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `portal_people` (Phase 4D).
 *
 * MC-side records the couple sees on the public portal:
 * bridal-party names, family members, role labels. Cross-tenant
 * leakage would expose private wedding info.
 */
describe('RLS: portal_people tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let personAId: string;

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

    const personRes = await userA.client
      .from('portal_people')
      .insert({
        user_id: userA.id,
        couple_id: coupleRes.data!.id,
        category: 'partner',
        full_name: 'A Partner',
      })
      .select('id')
      .single();
    expect(personRes.error).toBeNull();
    personAId = personRes.data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own person row', async () => {
    const { data } = await userA.client
      .from('portal_people')
      .select('id')
      .eq('id', personAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('portal_people')
      .select('*')
      .eq('id', personAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE it', async () => {
    await userB.client
      .from('portal_people')
      .update({ full_name: 'hacked' })
      .eq('id', personAId);
    const { data } = await serviceClient()
      .from('portal_people')
      .select('full_name')
      .eq('id', personAId)
      .single();
    expect(data?.full_name).toBe('A Partner');
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('portal_people').delete().eq('id', personAId);
    const { count } = await serviceClient()
      .from('portal_people')
      .select('*', { count: 'exact', head: true })
      .eq('id', personAId);
    expect(count).toBe(1);
  });

  it('anonymous client cannot read portal_people at all', async () => {
    const { data } = await anonClient()
      .from('portal_people')
      .select('*')
      .limit(1);
    expect(data).toEqual([]);
  });
});
