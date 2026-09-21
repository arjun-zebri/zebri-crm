/**
 * proposal_events RLS: owner-only reads, parent-ownership on writes, and
 * no anon access except through record_proposal_events. Local Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

describe('proposal_events RLS', () => {
  let userA: TestUser;
  let userB: TestUser;
  let proposalAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);
    const { data: couple, error: cErr } = await userA.client.from('couples').insert({ user_id: userA.id, name: 'Sam and Alex', status: 'new' }).select('id').single();
    expect(cErr).toBeNull();
    const { data: p, error: pErr } = await userA.client.from('proposals').insert({ user_id: userA.id, couple_id: couple!.id, title: 'T', proposal_number: 'PR-EV-1' }).select('id').single();
    expect(pErr).toBeNull();
    proposalAId = p!.id;
    const { error: eErr } = await userA.client.from('proposal_events').insert({ proposal_id: proposalAId, user_id: userA.id, session_id: 's1', type: 'opened', payload: {} });
    expect(eErr).toBeNull();
  });

  afterAll(async () => { await userA.cleanup(); await userB.cleanup(); });

  it('the owner reads their events; another tenant sees none', async () => {
    const mine = await userA.client.from('proposal_events').select('id').eq('proposal_id', proposalAId);
    expect(mine.data).toHaveLength(1);
    const theirs = await userB.client.from('proposal_events').select('id').eq('proposal_id', proposalAId);
    expect(theirs.data).toEqual([]);
  });

  it('a tenant cannot write an event that points at another tenant proposal, even with their own user_id', async () => {
    const { error } = await userB.client.from('proposal_events').insert({ proposal_id: proposalAId, user_id: userB.id, session_id: 's2', type: 'opened', payload: {} });
    expect(error).not.toBeNull();
  });

  it('anon cannot read or insert directly', async () => {
    const read = await anonClient().from('proposal_events').select('id').eq('proposal_id', proposalAId);
    // m7: `(read.data ?? []) === []` also passes when the query errors and
    // `data` is null -- assert no error first, then assert genuinely empty.
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    const { error } = await anonClient().from('proposal_events').insert({ proposal_id: proposalAId, user_id: userA.id, session_id: 's3', type: 'opened', payload: {} });
    expect(error).not.toBeNull();
  });

  it('the owner can delete their events (cleanup path), and the row is actually gone', async () => {
    const { error: insertErr } = await userA.client.from('proposal_events').insert({ proposal_id: proposalAId, user_id: userA.id, session_id: 's-delete', type: 'opened', payload: {} });
    expect(insertErr).toBeNull();

    const { error: deleteErr } = await userA.client.from('proposal_events').delete().eq('proposal_id', proposalAId).eq('session_id', 's-delete');
    expect(deleteErr).toBeNull();

    // m7: the original test asserted only `error === null` on the DELETE,
    // which also passes if the policy matched nothing. Re-read to prove
    // the row is actually gone.
    const { data: remaining, error: readErr } = await userA.client.from('proposal_events').select('id').eq('proposal_id', proposalAId).eq('session_id', 's-delete');
    expect(readErr).toBeNull();
    expect(remaining).toEqual([]);
  });

  it('events cascade away when their proposal is deleted', async () => {
    const { data: couple, error: cErr } = await userA.client.from('couples').insert({ user_id: userA.id, name: 'Cascade test', status: 'new' }).select('id').single();
    expect(cErr).toBeNull();
    const { data: p, error: pErr } = await userA.client.from('proposals').insert({ user_id: userA.id, couple_id: couple!.id, title: 'Cascade', proposal_number: 'PR-EV-CASCADE' }).select('id').single();
    expect(pErr).toBeNull();
    const proposalId = p!.id;
    const { error: eErr } = await userA.client.from('proposal_events').insert({ proposal_id: proposalId, user_id: userA.id, session_id: 's-cascade', type: 'opened', payload: {} });
    expect(eErr).toBeNull();

    const { error: delErr } = await userA.client.from('proposals').delete().eq('id', proposalId);
    expect(delErr).toBeNull();

    // m7: the original test never actually deleted a proposal, so it
    // never exercised `on delete cascade` at all. This does.
    const { data: remaining, error: readErr } = await userA.client.from('proposal_events').select('id').eq('proposal_id', proposalId);
    expect(readErr).toBeNull();
    expect(remaining).toEqual([]);
  });
});
