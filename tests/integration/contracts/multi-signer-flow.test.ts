import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

/**
 * End-to-end multi-signer signing, against real RLS and the real RPCs.
 *
 * The reported defect: a contract had exactly one signature slot, so a couple
 * could not each sign. Each signer now gets their own `sign_token`, and the
 * contract only reaches 'signed' once every required signer is done.
 */
describe('multi-signer contract signing', () => {
  let user: TestUser;
  let coupleId: string;

  const makeSentContract = async (number: string) => {
    const { data, error } = await user.client
      .from('contracts')
      .insert({
        user_id: user.id,
        couple_id: coupleId,
        title: 'Service agreement',
        contract_number: number,
        status: 'sent',
        content: {},
        share_token_enabled: true,
        locked_content_html: '<p>Terms</p>',
      })
      .select('id, share_token')
      .single();
    expect(error).toBeNull();
    return data!;
  };

  const signersOf = async (contractId: string) => {
    const { data } = await user.client
      .from('contract_signers')
      .select('id, name, role, signing_order, sign_token, signed_at')
      .eq('contract_id', contractId)
      .order('signing_order');
    return data ?? [];
  };

  const statusOf = async (contractId: string) => {
    const { data } = await user.client
      .from('contracts')
      .select('status, signed_at, signer_name')
      .eq('id', contractId)
      .single();
    return data!;
  };

  beforeAll(async () => {
    user = await createTestUser({}, { subscription_status: 'active', subscription_plan: 'pro' });

    const { data, error } = await user.client
      .from('couples')
      .insert({
        user_id: user.id,
        name: 'Sam and Alex',
        email: 'couple@example.com',
        primary_name: 'Sam Rivera',
        primary_email: 'sam@example.com',
        secondary_name: 'Alex Rivera',
        secondary_email: 'alex@example.com',
        status: 'enquiry',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    coupleId = data!.id;
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('seeds one signer per named partner when a contract is created', async () => {
    const contract = await makeSentContract('CTR-MS-1');
    const signers = await signersOf(contract.id);
    expect(signers.map((s) => s.name)).toEqual(['Sam Rivera', 'Alex Rivera']);
    expect(new Set(signers.map((s) => s.sign_token)).size).toBe(2);
  });

  it('completes only once BOTH partners have signed', async () => {
    const contract = await makeSentContract('CTR-MS-2');
    const [first, second] = await signersOf(contract.id);

    const one = await anonClient().rpc('sign_contract', {
      token: first!.sign_token,
      p_signer_name: 'Sam Rivera',
      p_signer_ip: '203.0.113.1',
      p_signer_user_agent: 'Sam/1.0',
    });
    expect(one.error).toBeNull();
    expect(one.data).toMatchObject({ ok: true, complete: false, outstanding: 1 });
    // The contract must NOT be signed yet: this is the whole bug.
    expect((await statusOf(contract.id)).status).toBe('sent');

    const two = await anonClient().rpc('sign_contract', {
      token: second!.sign_token,
      p_signer_name: 'Alex Rivera',
      p_signer_ip: '203.0.113.2',
      p_signer_user_agent: 'Alex/1.0',
    });
    expect(two.error).toBeNull();
    expect(two.data).toMatchObject({ ok: true, complete: true, outstanding: 0 });

    const after = await statusOf(contract.id);
    expect(after.status).toBe('signed');
    expect(after.signed_at).not.toBeNull();
  });

  it('records each signature against its own signer, with its own IP', async () => {
    const contract = await makeSentContract('CTR-MS-3');
    const [first, second] = await signersOf(contract.id);
    await anonClient().rpc('sign_contract', {
      token: first!.sign_token,
      p_signer_name: 'Sam Rivera',
      p_signer_ip: '198.51.100.7',
      p_signer_user_agent: 'Sam/1.0',
    });
    await anonClient().rpc('sign_contract', {
      token: second!.sign_token,
      p_signer_name: 'Alex Rivera',
      p_signer_ip: '198.51.100.9',
      p_signer_user_agent: 'Alex/1.0',
    });

    const { data } = await user.client
      .from('contract_signers')
      .select('name, signer_name_typed, signer_ip')
      .eq('contract_id', contract.id)
      .order('signing_order');
    expect(data).toEqual([
      { name: 'Sam Rivera', signer_name_typed: 'Sam Rivera', signer_ip: '198.51.100.7' },
      { name: 'Alex Rivera', signer_name_typed: 'Alex Rivera', signer_ip: '198.51.100.9' },
    ]);
  });

  it('refuses to let the same link sign twice', async () => {
    const contract = await makeSentContract('CTR-MS-4');
    const [first] = await signersOf(contract.id);
    await anonClient().rpc('sign_contract', {
      token: first!.sign_token,
      p_signer_name: 'Sam Rivera',
      p_signer_ip: '203.0.113.5',
      p_signer_user_agent: 'Sam/1.0',
    });
    const again = await anonClient().rpc('sign_contract', {
      token: first!.sign_token,
      p_signer_name: 'Sam Rivera',
      p_signer_ip: '203.0.113.5',
      p_signer_user_agent: 'Sam/1.0',
    });
    expect(again.data).toMatchObject({ error: 'already_signed' });
  });

  it('exposes the roster publicly without leaking anyone else\'s sign token', async () => {
    const contract = await makeSentContract('CTR-MS-5');
    const [first] = await signersOf(contract.id);

    const { data, error } = await anonClient().rpc('get_public_contract', {
      token: first!.sign_token,
    });
    expect(error).toBeNull();
    const payload = data as Record<string, unknown>;
    expect(payload.viewer_signer_id).toBe(first!.id);

    const roster = payload.signers as Array<Record<string, unknown>>;
    expect(roster).toHaveLength(2);
    expect(roster.map((s) => s.name)).toEqual(['Sam Rivera', 'Alex Rivera']);
    // A sign token is a bearer credential; none may appear in a public payload.
    expect(JSON.stringify(payload)).not.toContain(first!.sign_token);
  });

  it('still honours the legacy share link for contracts already in flight', async () => {
    const contract = await makeSentContract('CTR-MS-6');
    const result = await anonClient().rpc('sign_contract', {
      token: contract.share_token,
      p_signer_name: 'Sam Rivera',
      p_signer_ip: '203.0.113.8',
      p_signer_user_agent: 'Legacy/1.0',
    });
    expect(result.error).toBeNull();
    // The legacy link signs the first outstanding client, leaving the partner.
    expect(result.data).toMatchObject({ ok: true, complete: false, outstanding: 1 });
  });

  it('clears partial signatures and reissues tokens when the contract is revoked', async () => {
    const contract = await makeSentContract('CTR-MS-7');
    const before = await signersOf(contract.id);
    await anonClient().rpc('sign_contract', {
      token: before[0]!.sign_token,
      p_signer_name: 'Sam Rivera',
      p_signer_ip: '203.0.113.9',
      p_signer_user_agent: 'Sam/1.0',
    });

    const { error } = await user.client.rpc('revoke_contract', { p_contract_id: contract.id });
    expect(error).toBeNull();

    const after = await signersOf(contract.id);
    // Partner A's signature must not carry over onto re-issued wording, and
    // their old link must stop working.
    expect(after.every((s) => s.signed_at === null)).toBe(true);
    expect(after[0]!.sign_token).not.toBe(before[0]!.sign_token);
  });

  it('logs a viewed event once per signer, not once per page load', async () => {
    const contract = await makeSentContract('CTR-MS-9');
    const [first, second] = await signersOf(contract.id);

    // Same signer opening the page repeatedly must not flood the trail.
    for (let i = 0; i < 3; i += 1) {
      await anonClient().rpc('record_contract_view', {
        token: first!.sign_token,
        p_actor_ip: '203.0.113.30',
        p_actor_user_agent: 'Sam/1.0',
      });
    }
    await anonClient().rpc('record_contract_view', {
      token: second!.sign_token,
      p_actor_ip: '203.0.113.31',
      p_actor_user_agent: 'Alex/1.0',
    });

    const { data } = await user.client
      .from('contract_audit_log')
      .select('event_type, signer_name_typed, actor_ip')
      .eq('contract_id', contract.id)
      .eq('event_type', 'viewed');

    expect(data).toHaveLength(2);
    expect(data!.map((r) => r.signer_name_typed).sort()).toEqual([
      'Alex Rivera',
      'Sam Rivera',
    ]);
  });

  it('does not log a view for an unknown token', async () => {
    const res = await anonClient().rpc('record_contract_view', {
      token: '00000000-0000-0000-0000-0000000000ff',
      p_actor_ip: '203.0.113.40',
      p_actor_user_agent: 'UA/1',
    });
    expect(res.data).toMatchObject({ ok: false });
  });

  it('takes every signer link offline when the contract is revoked', async () => {
    // Regression: revoke reset the body to empty but left the link live, so a
    // stale signer link opened a page reading "No content." around the sign
    // form. The link must come back only when a send locks a body behind it.
    const contract = await makeSentContract('CTR-MS-10');
    const [first] = await signersOf(contract.id);

    const { error } = await user.client.rpc('revoke_contract', { p_contract_id: contract.id });
    expect(error).toBeNull();

    const { data: byOldSigner } = await anonClient().rpc('get_public_contract', {
      token: first!.sign_token,
    });
    expect(byOldSigner).toBeNull();

    const [reissued] = await signersOf(contract.id);
    const { data: byNewSigner } = await anonClient().rpc('get_public_contract', {
      token: reissued!.sign_token,
    });
    expect(byNewSigner).toBeNull();
  });

  it('serves nothing for a draft: the body does not exist until send', async () => {
    // Fresh drafts are share-enabled by default (20260527000000), but their
    // body is only frozen at send. Before this gate the public page rendered
    // the header, "No content." and a sign form that sign_contract refused.
    const { data: draft, error } = await user.client
      .from('contracts')
      .insert({
        user_id: user.id,
        couple_id: coupleId,
        contract_number: 'CTR-MS-DRAFT',
        status: 'draft',
        content: { type: 'doc', content: [] },
        share_token_enabled: true,
      })
      .select('id, share_token')
      .single();
    expect(error).toBeNull();

    const publicView = await anonClient().rpc('get_public_contract', { token: draft!.share_token });
    expect(publicView.error).toBeNull();
    expect(publicView.data).toBeNull();

    const viewed = await anonClient().rpc('record_contract_view', { token: draft!.share_token });
    expect(viewed.data).toMatchObject({ ok: false });
  });

  it('writes one audit row per signature', async () => {
    const contract = await makeSentContract('CTR-MS-8');
    const [first, second] = await signersOf(contract.id);
    for (const [signer, name] of [[first, 'Sam Rivera'], [second, 'Alex Rivera']] as const) {
      await anonClient().rpc('sign_contract', {
        token: signer!.sign_token,
        p_signer_name: name,
        p_signer_ip: '203.0.113.20',
        p_signer_user_agent: 'UA/1',
      });
    }
    const { data } = await user.client
      .from('contract_audit_log')
      .select('event_type, signer_name_typed')
      .eq('contract_id', contract.id)
      .eq('event_type', 'signed');
    expect(data).toHaveLength(2);
    expect(data!.map((r) => r.signer_name_typed).sort()).toEqual(['Alex Rivera', 'Sam Rivera']);
  });
});
