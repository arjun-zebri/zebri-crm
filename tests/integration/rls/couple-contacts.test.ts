import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `couple_contacts` (Phase 4B).
 *
 * The join table linking couples to vendor/team contacts. RLS
 * scopes by `user_id` (denormalised owner) so cross-tenant
 * link/unlink is impossible.
 */
describe('RLS: couple_contacts tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let linkAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    // Arrange a couple + contact owned by A, then link them.
    const coupleRes = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'A Couple', status: 'enquiry' })
      .select('id')
      .single();
    expect(coupleRes.error).toBeNull();

    const contactRes = await userA.client
      .from('contacts')
      .insert({
        user_id: userA.id,
        name: 'A Vendor',
        category: 'photographer',
      })
      .select('id')
      .single();
    expect(contactRes.error).toBeNull();

    const linkRes = await userA.client
      .from('couple_contacts')
      .insert({
        user_id: userA.id,
        couple_id: coupleRes.data!.id,
        contact_id: contactRes.data!.id,
      })
      .select('id')
      .single();
    expect(linkRes.error).toBeNull();
    linkAId = linkRes.data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own link row', async () => {
    const { data } = await userA.client
      .from('couple_contacts')
      .select('id')
      .eq('id', linkAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('couple_contacts')
      .select('*')
      .eq('id', linkAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('couple_contacts').delete().eq('id', linkAId);
    const { count } = await serviceClient()
      .from('couple_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('id', linkAId);
    expect(count).toBe(1);
  });

  it('anonymous client cannot read couple_contacts at all', async () => {
    const { data } = await anonClient()
      .from('couple_contacts')
      .select('*')
      .limit(1);
    expect(data).toEqual([]);
  });
});
