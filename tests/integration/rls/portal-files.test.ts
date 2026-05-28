import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `portal_files` (Phase 4D).
 *
 * File-metadata rows that record what the MC has uploaded to the
 * couple's portal storage bucket. Cross-tenant leakage would expose
 * private wedding documents.
 */
describe('RLS: portal_files tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let fileAId: string;

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

    const fileRes = await userA.client
      .from('portal_files')
      .insert({
        user_id: userA.id,
        couple_id: coupleRes.data!.id,
        name: 'A Doc.pdf',
        file_url: 'https://example.test/a-doc.pdf',
        file_size: 1234,
      })
      .select('id')
      .single();
    expect(fileRes.error).toBeNull();
    fileAId = fileRes.data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own file row', async () => {
    const { data } = await userA.client
      .from('portal_files')
      .select('id')
      .eq('id', fileAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('portal_files')
      .select('*')
      .eq('id', fileAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('portal_files').delete().eq('id', fileAId);
    const { count } = await serviceClient()
      .from('portal_files')
      .select('*', { count: 'exact', head: true })
      .eq('id', fileAId);
    expect(count).toBe(1);
  });

  it('anonymous client cannot read portal_files at all', async () => {
    const { data } = await anonClient()
      .from('portal_files')
      .select('*')
      .limit(1);
    expect(data).toEqual([]);
  });
});
