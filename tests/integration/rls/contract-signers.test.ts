import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, type TestUser } from '../helpers/supabase';

/**
 * RLS tenant isolation for `contract_signers`.
 *
 * Each row carries a `sign_token` that is a bearer credential: whoever holds
 * it can sign that contract. A cross-tenant read therefore leaks the ability
 * to sign someone else's agreement, and a cross-tenant write lets an attacker
 * add themselves as a signer on a competitor's contract.
 *
 * The write case is the subtle one. Foreign keys are validated with elevated
 * privileges and ignore RLS, so an owner-only `with check (user_id =
 * auth.uid())` still permits inserting a row you own that points at ANOTHER
 * tenant's `contract_id`, the same hole closed for `bookings.couple_id` in
 * 20260821040000. `_owns_contract()` in the policy is what blocks it.
 */
describe('RLS: contract_signers tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let contractAId: string;
  let signerAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data: couple, error: coupleErr } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Sam and Alex', status: 'enquiry' })
      .select('id')
      .single();
    expect(coupleErr).toBeNull();

    const { data: contract, error: contractErr } = await userA.client
      .from('contracts')
      .insert({
        user_id: userA.id,
        couple_id: couple!.id,
        title: 'A service agreement',
        contract_number: 'CTR-RLS-1',
        status: 'draft',
        content: {},
      })
      .select('id')
      .single();
    expect(contractErr).toBeNull();
    contractAId = contract!.id;

    const { data: signer, error: signerErr } = await userA.client
      .from('contract_signers')
      .insert({
        contract_id: contractAId,
        user_id: userA.id,
        role: 'client',
        name: 'Sam Rivera',
        email: 'sam@example.com',
        signing_order: 1,
      })
      .select('id')
      .single();
    expect(signerErr).toBeNull();
    signerAId = signer!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own signer row', async () => {
    const { data, error } = await userA.client
      .from('contract_signers')
      .select('id, name, sign_token')
      .eq('id', signerAId)
      .single();
    expect(error).toBeNull();
    expect(data?.name).toBe('Sam Rivera');
    expect(data?.sign_token).toBeTruthy();
  });

  it('cross-tenant SELECT returns nothing, so the sign token cannot leak', async () => {
    const { data, error } = await userB.client
      .from('contract_signers')
      .select('id, sign_token')
      .eq('id', signerAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('cross-tenant UPDATE affects no rows', async () => {
    const { data, error } = await userB.client
      .from('contract_signers')
      .update({ name: 'Hijacked' })
      .eq('id', signerAId)
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: check } = await userA.client
      .from('contract_signers')
      .select('name')
      .eq('id', signerAId)
      .single();
    expect(check?.name).toBe('Sam Rivera');
  });

  it('cross-tenant DELETE affects no rows', async () => {
    const { data, error } = await userB.client
      .from('contract_signers')
      .delete()
      .eq('id', signerAId)
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { count } = await userA.client
      .from('contract_signers')
      .select('id', { count: 'exact', head: true })
      .eq('id', signerAId);
    expect(count).toBe(1);
  });

  it('rejects a signer row owned by B but attached to A\'s contract', async () => {
    // Count first: `contracts_seed_signers` seeds a roster on insert, so the
    // contract already has rows of its own.
    const before = await userA.client
      .from('contract_signers')
      .select('id', { count: 'exact', head: true })
      .eq('contract_id', contractAId);

    // The FK to contracts resolves regardless of RLS, so only the
    // parent-ownership predicate in the policy stops this.
    const { error } = await userB.client.from('contract_signers').insert({
      contract_id: contractAId,
      user_id: userB.id,
      role: 'client',
      name: 'Attacker',
      signing_order: 99,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');

    const after = await userA.client
      .from('contract_signers')
      .select('id, name', { count: 'exact' })
      .eq('contract_id', contractAId);
    expect(after.count).toBe(before.count);
    expect(after.data?.some((r) => r.name === 'Attacker')).toBe(false);
  });

  it('rejects a signer row that claims another user as owner', async () => {
    const { error } = await userB.client.from('contract_signers').insert({
      contract_id: contractAId,
      user_id: userA.id,
      role: 'client',
      name: 'Attacker',
      signing_order: 98,
    });
    expect(error).not.toBeNull();
  });
});
