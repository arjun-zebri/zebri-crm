import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `contract_templates` (Phase 12).
 *
 * Contract templates are the reusable e-sign agreements MCs draft in
 * Settings → Templates and apply when sending new contracts. A leak
 * would expose another MC's contract language (often customised with
 * legal advice) and an unauthorised write would let a malicious user
 * silently swap clauses in a competitor's templates — the next
 * contract that MC sends would carry doctored terms.
 */
describe('RLS: contract_templates tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let templateAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data, error } = await userA.client
      .from('contract_templates')
      .insert({
        user_id: userA.id,
        name: 'A Standard MC Agreement',
        description: 'A\'s default',
        content: { clauses: ['payment terms 30 days', 'cancellation 50%'] },
        is_default: true,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    templateAId = data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own template', async () => {
    const { data, error } = await userA.client
      .from('contract_templates')
      .select('id, name')
      .eq('id', templateAId)
      .single();
    expect(error).toBeNull();
    expect(data?.name).toBe('A Standard MC Agreement');
  });

  it('cross-tenant SELECT returns empty (RLS filters)', async () => {
    const { data, error } = await userB.client
      .from('contract_templates')
      .select('id')
      .eq('id', templateAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('cross-tenant UPDATE silently affects zero rows', async () => {
    // RLS UPDATE policy is USING-style: the row is invisible to B's
    // session, so the update simply matches no rows.
    const { error } = await userB.client
      .from('contract_templates')
      .update({ name: 'PWNED' })
      .eq('id', templateAId);
    expect(error).toBeNull();

    // Confirm A's template is unchanged via service client.
    const admin = serviceClient();
    const { data } = await admin
      .from('contract_templates')
      .select('name')
      .eq('id', templateAId)
      .single();
    expect(data?.name).toBe('A Standard MC Agreement');
  });

  it('cross-tenant DELETE silently affects zero rows', async () => {
    await userB.client
      .from('contract_templates')
      .delete()
      .eq('id', templateAId);

    const admin = serviceClient();
    const { data } = await admin
      .from('contract_templates')
      .select('id')
      .eq('id', templateAId);
    expect(data).toHaveLength(1);
  });

  it('INSERT claiming a different user_id is rejected', async () => {
    // WITH CHECK (auth.uid() = user_id) on insert — the row's
    // user_id must match the caller, so this insert should fail.
    const { error } = await userB.client.from('contract_templates').insert({
      user_id: userA.id,
      name: 'Smuggled in as A',
      content: {},
    });
    expect(error).not.toBeNull();
  });

  it('anonymous client cannot read contract_templates at all', async () => {
    const anon = anonClient();
    const { data } = await anon.from('contract_templates').select('id');
    // RLS hides everything from anonymous — base policy is
    // auth.uid() = user_id, which is null for anon.
    expect(data).toEqual([]);
  });
});
