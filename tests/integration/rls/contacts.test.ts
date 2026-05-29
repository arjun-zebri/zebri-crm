import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `contacts` (Phase 5).
 *
 * Contacts are the user-owned addressbook (vendors, venues,
 * suppliers). Cross-tenant access would let one MC read or edit
 * another MC's vendor list — bad for both privacy and competitive
 * intel.
 */
describe('RLS: contacts tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let contactAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data, error } = await userA.client
      .from('contacts')
      .insert({
        user_id: userA.id,
        name: 'A Photographer',
        category: 'photographer',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    contactAId = data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own contact', async () => {
    const { data } = await userA.client
      .from('contacts')
      .select('id')
      .eq('id', contactAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('contacts')
      .select('*')
      .eq('id', contactAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE it', async () => {
    await userB.client
      .from('contacts')
      .update({ name: 'hacked' })
      .eq('id', contactAId);
    const { data } = await serviceClient()
      .from('contacts')
      .select('name')
      .eq('id', contactAId)
      .single();
    expect(data?.name).toBe('A Photographer');
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('contacts').delete().eq('id', contactAId);
    const { count } = await serviceClient()
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('id', contactAId);
    expect(count).toBe(1);
  });

  it('anonymous client cannot read contacts at all', async () => {
    const { data } = await anonClient().from('contacts').select('*').limit(1);
    expect(data).toEqual([]);
  });
});
