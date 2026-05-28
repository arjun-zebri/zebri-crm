/**
 * Phase 3.2 — `contract_audit_log` integration tests.
 *
 * Proves the audit-log table is wired through every state-changing
 * RPC and that RLS keeps each owner's rows scoped to themselves.
 *
 * Coverage matrix:
 *   1. `sign_contract` emits a 'signed' audit row with IP/UA/signer name.
 *   2. `decline_contract` emits a 'declined' audit row with reason.
 *   3. `revoke_contract` emits a 'revoked' audit row with the
 *      pre-revocation status captured.
 *   4. **Cross-tenant RLS**: User B cannot SELECT audit rows
 *      belonging to User A's contract.
 *   5. **Write protection**: even the owner can't INSERT directly
 *      into `contract_audit_log` from the anon-client path —
 *      `emit_contract_audit_event` (SECURITY DEFINER) is the only
 *      sanctioned writer.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

interface ContractFixture {
  contractId: string;
  shareToken: string;
  coupleId: string;
}

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

async function makeUser(): Promise<TestUser> {
  const user = await createTestUser({}, pro);
  cleanupQueue.push(user.cleanup);
  return user;
}

/**
 * Arrange a contract in 'sent' state, owned by `user`, with the
 * share token enabled. Returns the row's id + share token so the
 * test can call the public RPCs against it.
 */
async function arrangeSentContract(user: TestUser): Promise<ContractFixture> {
  const coupleRes = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'Anna & Jake', status: 'enquiry' })
    .select('id')
    .single();
  if (coupleRes.error || !coupleRes.data) {
    throw new Error(`Couple insert failed: ${coupleRes.error?.message}`);
  }
  const coupleId = coupleRes.data.id;

  // Use the service client to set status=sent (the MC-side flow
  // does this through the send-contract route; integration tests
  // bypass that by writing the terminal state directly).
  const admin = serviceClient();
  const contractRes = await admin
    .from('contracts')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      title: 'Wedding Contract',
      contract_number: `CN-${Date.now()}`,
      status: 'sent',
      share_token_enabled: true,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      locked_content_html: '<p>Locked body</p>',
      email_sent_at: new Date().toISOString(),
    })
    .select('id, share_token')
    .single();
  if (contractRes.error || !contractRes.data) {
    throw new Error(`Contract insert failed: ${contractRes.error?.message}`);
  }
  return {
    contractId: contractRes.data.id,
    shareToken: contractRes.data.share_token as string,
    coupleId,
  };
}

describe('contract_audit_log — integration', () => {
  it('sign_contract emits a signed audit row with IP/UA/signer', async () => {
    const user = await makeUser();
    const fixture = await arrangeSentContract(user);

    const { data, error } = await user.client.rpc('sign_contract', {
      token: fixture.shareToken,
      p_signer_name: 'Anna Park',
      p_signer_ip: '203.0.113.42',
      p_signer_user_agent: 'Mozilla/5.0 (TestRunner)',
    });
    expect(error).toBeNull();
    expect((data as { error?: string }).error).toBeUndefined();

    const { data: rows } = await user.client
      .from('contract_audit_log')
      .select(
        'event_type, actor, actor_ip, actor_user_agent, signer_name_typed',
      )
      .eq('contract_id', fixture.contractId)
      .order('event_at', { ascending: true });

    const signed = rows?.find((r) => r.event_type === 'signed');
    expect(signed).toBeDefined();
    expect(signed?.actor).toBe('couple');
    expect(signed?.actor_ip).toBe('203.0.113.42');
    expect(signed?.actor_user_agent).toBe('Mozilla/5.0 (TestRunner)');
    expect(signed?.signer_name_typed).toBe('Anna Park');
  });

  it('decline_contract emits a declined audit row with the reason', async () => {
    const user = await makeUser();
    const fixture = await arrangeSentContract(user);

    const { data, error } = await user.client.rpc('decline_contract', {
      token: fixture.shareToken,
      p_reason: 'Changed our plans',
      p_actor_ip: '198.51.100.7',
      p_actor_user_agent: 'curl/7.88',
    });
    expect(error).toBeNull();
    expect((data as { error?: string }).error).toBeUndefined();

    const { data: rows } = await user.client
      .from('contract_audit_log')
      .select('event_type, actor, decline_reason, actor_ip')
      .eq('contract_id', fixture.contractId);

    const declined = rows?.find((r) => r.event_type === 'declined');
    expect(declined).toBeDefined();
    expect(declined?.actor).toBe('couple');
    expect(declined?.decline_reason).toBe('Changed our plans');
    expect(declined?.actor_ip).toBe('198.51.100.7');
  });

  it('revoke_contract emits a revoked audit row with the prior status', async () => {
    const user = await makeUser();
    const fixture = await arrangeSentContract(user);

    // Revoke from 'sent'. Signed contracts can't be revoked
    // (`revoke_contract` returns `{ error: "already_signed" }`
    // — that's the by-design guarantee: a signed contract is
    // binding and the audit trail can't be retroactively rewritten
    // via revoke→sign cycles). So the realistic test is from 'sent'.
    const { data, error } = await user.client.rpc('revoke_contract', {
      p_contract_id: fixture.contractId,
    });
    expect(error).toBeNull();
    expect((data as { error?: string }).error).toBeUndefined();

    const { data: rows } = await user.client
      .from('contract_audit_log')
      .select('event_type, actor, revoked_from_status')
      .eq('contract_id', fixture.contractId);

    const revoked = rows?.find((r) => r.event_type === 'revoked');
    expect(revoked).toBeDefined();
    expect(revoked?.actor).toBe('mc');
    expect(revoked?.revoked_from_status).toBe('sent');
  });

  it('RLS blocks cross-tenant audit-log reads', async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    const fixture = await arrangeSentContract(userA);

    // Generate an audit row owned by userA.
    await userA.client.rpc('sign_contract', {
      token: fixture.shareToken,
      p_signer_name: 'Anna',
      p_signer_ip: '203.0.113.42',
      p_signer_user_agent: 'TestRunner',
    });

    // userA sees their row.
    const { data: aRows } = await userA.client
      .from('contract_audit_log')
      .select('id')
      .eq('contract_id', fixture.contractId);
    expect(aRows && aRows.length).toBeGreaterThan(0);

    // userB sees nothing for userA's contract — RLS scopes by user_id.
    const { data: bRows, error: bError } = await userB.client
      .from('contract_audit_log')
      .select('id')
      .eq('contract_id', fixture.contractId);
    expect(bError).toBeNull();
    expect(bRows).toEqual([]);
  });

  it('contract_audit_log has no anon-client write path', async () => {
    const user = await makeUser();
    const fixture = await arrangeSentContract(user);

    // Generate a real audit row so update/delete have a target.
    await user.client.rpc('sign_contract', {
      token: fixture.shareToken,
      p_signer_name: 'Anna',
      p_signer_ip: '203.0.113.42',
      p_signer_user_agent: 'TestRunner',
    });

    // INSERT — no policy grants insert; the row must not appear.
    await user.client
      .from('contract_audit_log')
      .insert({
        contract_id: fixture.contractId,
        user_id: user.id,
        event_type: 'signed',
        actor: 'couple',
        decline_reason: 'INSERT-HIJACK',
      });
    const { data: postInsert } = await user.client
      .from('contract_audit_log')
      .select('decline_reason')
      .eq('contract_id', fixture.contractId);
    expect(
      postInsert?.some((r) => r.decline_reason === 'INSERT-HIJACK'),
    ).toBe(false);

    // UPDATE — no policy grants update; existing rows must be
    // unchanged. (RLS silently no-ops when no policy applies, so
    // we assert state didn't move rather than checking the error.)
    await user.client
      .from('contract_audit_log')
      .update({ decline_reason: 'UPDATE-HIJACK' })
      .eq('contract_id', fixture.contractId);
    const { data: postUpdate } = await user.client
      .from('contract_audit_log')
      .select('decline_reason')
      .eq('contract_id', fixture.contractId);
    expect(
      postUpdate?.some((r) => r.decline_reason === 'UPDATE-HIJACK'),
    ).toBe(false);

    // DELETE — no policy grants delete; the signed row must
    // persist.
    await user.client
      .from('contract_audit_log')
      .delete()
      .eq('contract_id', fixture.contractId);
    const { data: postDelete } = await user.client
      .from('contract_audit_log')
      .select('id')
      .eq('contract_id', fixture.contractId);
    expect(postDelete && postDelete.length).toBeGreaterThan(0);
  });
});
