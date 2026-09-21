import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, type TestUser } from '../helpers/supabase';

/**
 * RLS tenant isolation for proposals, proposal_options, proposal_option_items.
 *
 * The write case matters most: foreign keys ignore RLS, so an owner-only
 * `with check (user_id = auth.uid())` still lets B insert an option row that
 * points at A's proposal. `_owns_proposal()` / `_owns_proposal_option()` in
 * the child policies are what block it (spec §5.2).
 */
describe('RLS: proposals tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let coupleAId: string;
  let proposalAId: string;
  let optionAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data: couple, error: coupleErr } = await userA.client
      .from('couples')
      .insert({ user_id: userA.id, name: 'Sam and Alex', status: 'new' })
      .select('id')
      .single();
    expect(coupleErr).toBeNull();
    coupleAId = couple!.id;

    const { data: proposal, error: pErr } = await userA.client
      .from('proposals')
      .insert({
        user_id: userA.id,
        couple_id: coupleAId,
        title: 'Your wedding with Sam',
        proposal_number: 'PR-RLS-1',
      })
      .select('id')
      .single();
    expect(pErr).toBeNull();
    proposalAId = proposal!.id;

    const { data: option, error: oErr } = await userA.client
      .from('proposal_options')
      .insert({
        proposal_id: proposalAId,
        user_id: userA.id,
        position: 1,
        title: 'Full day',
        pricing_mode: 'itemised',
      })
      .select('id')
      .single();
    expect(oErr).toBeNull();
    optionAId = option!.id;

    const { error: iErr } = await userA.client.from('proposal_option_items').insert({
      option_id: optionAId,
      user_id: userA.id,
      description: 'Ceremony MC',
      amount: 1200,
      position: 1,
    });
    expect(iErr).toBeNull();
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner reads their own proposal with options and items', async () => {
    const { data, error } = await userA.client
      .from('proposals')
      .select('id, title, proposal_options!proposal_options_proposal_id_fkey(id, proposal_option_items(id))')
      .eq('id', proposalAId)
      .single();
    expect(error).toBeNull();
    expect(data?.proposal_options).toHaveLength(1);
    expect(data?.proposal_options[0]?.proposal_option_items).toHaveLength(1);
  });

  it('cross-tenant SELECT on every table returns nothing', async () => {
    const p = await userB.client.from('proposals').select('id').eq('id', proposalAId);
    const o = await userB.client.from('proposal_options').select('id').eq('id', optionAId);
    const i = await userB.client.from('proposal_option_items').select('id').eq('option_id', optionAId);
    expect(p.data).toEqual([]);
    expect(o.data).toEqual([]);
    expect(i.data).toEqual([]);
  });

  it('cross-tenant UPDATE and DELETE affect no rows', async () => {
    const upd = await userB.client
      .from('proposals')
      .update({ title: 'Hijacked' })
      .eq('id', proposalAId)
      .select('id');
    expect(upd.data).toEqual([]);
    const del = await userB.client.from('proposals').delete().eq('id', proposalAId).select('id');
    expect(del.data).toEqual([]);
    const { data: check } = await userA.client
      .from('proposals')
      .select('title')
      .eq('id', proposalAId)
      .single();
    expect(check?.title).toBe('Your wedding with Sam');
  });

  it('rejects an option owned by B attached to A\'s proposal', async () => {
    const { error } = await userB.client.from('proposal_options').insert({
      proposal_id: proposalAId,
      user_id: userB.id,
      position: 9,
      title: 'Attacker',
      pricing_mode: 'itemised',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('rejects an item owned by B attached to A\'s option', async () => {
    const { error } = await userB.client.from('proposal_option_items').insert({
      option_id: optionAId,
      user_id: userB.id,
      description: 'Attacker',
      amount: 1,
      position: 9,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('rejects a proposal that claims another user as owner', async () => {
    const { data: couple } = await userB.client
      .from('couples')
      .insert({ user_id: userB.id, name: 'B couple', status: 'new' })
      .select('id')
      .single();
    const { error } = await userB.client.from('proposals').insert({
      user_id: userA.id,
      couple_id: couple!.id,
      title: 'Spoof',
      proposal_number: 'PR-RLS-2',
    });
    expect(error).not.toBeNull();
  });

  // FKs ignore RLS: without the parent-ownership EXISTS clause in
  // `proposals_user_isolation`'s `with check`, B could point a proposal
  // (self-owned `user_id`, so the base check passes) at A's couple, and
  // since `get_public_proposal` is SECURITY DEFINER and joins couples
  // straight off `proposals.couple_id`, that would leak A's couple through
  // B's own public share link.
  it("rejects B inserting a proposal that points at A's couple", async () => {
    const { error } = await userB.client.from('proposals').insert({
      user_id: userB.id,
      couple_id: coupleAId,
      title: 'Spoofed couple on insert',
      proposal_number: 'PR-RLS-3',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("rejects B updating their own proposal to point at A's couple", async () => {
    const { data: coupleB, error: coupleBErr } = await userB.client
      .from('couples')
      .insert({ user_id: userB.id, name: 'B and Partner', status: 'new' })
      .select('id')
      .single();
    expect(coupleBErr).toBeNull();

    const { data: proposalB, error: pErr } = await userB.client
      .from('proposals')
      .insert({
        user_id: userB.id,
        couple_id: coupleB!.id,
        title: "B's own proposal",
        proposal_number: 'PR-RLS-4',
      })
      .select('id')
      .single();
    expect(pErr).toBeNull();

    const { error, data } = await userB.client
      .from('proposals')
      .update({ couple_id: coupleAId })
      .eq('id', proposalB!.id)
      .select('id');
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
    expect(data).toBeNull();
  });
});
