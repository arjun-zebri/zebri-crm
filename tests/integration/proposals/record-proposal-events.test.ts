/**
 * record_proposal_events: token gating, the 50-event cap, unknown types
 * dropped, first_open reported once, and (this file's newest coverage)
 * a replayed batch of client ids inserting nothing twice. Local Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Json } from '@/types/database';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;

async function seed(overrides: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from('proposals')
    .insert({ user_id: user.id, couple_id: coupleId, proposal_number: 'PR-EV', title: 'T', status: 'sent', share_token_enabled: true, ...overrides })
    .select('id, share_token')
    .single();
  if (error) throw error;
  return data;
}

// Json, not unknown[]: the generated RPC arg type is Json, and every event
// literal in this file is already JSON-shaped. Every event needs its own
// `id` now (the client-generated idempotency key): the RPC drops any
// event whose id is missing or malformed, the same as a malformed payload.
const rpc = (token: string, session: string, events: Json[]) =>
  anonClient().rpc('record_proposal_events', { p_token: token, p_session_id: session, p_events: events });

beforeAll(async () => {
  user = await createTestUser();
  const { data: c, error } = await user.client.from('couples').insert({ user_id: user.id, name: 'A & B', status: 'new' }).select('id').single();
  if (error) throw error;
  coupleId = c!.id;
});
afterAll(async () => { await user.cleanup(); });

describe('record_proposal_events', () => {
  it('C1: the owner previewing their own link records nothing, and the real first_open is still available to a later anon call', async () => {
    const p = await seed();
    // The owner's own client carries their JWT: `auth.uid()` resolves
    // inside the security-definer RPC even though the call is otherwise
    // shaped exactly like the couple's.
    const ownerPreview = (await user.client.rpc('record_proposal_events', {
      p_token: p.share_token,
      p_session_id: 'mc-preview',
      p_events: [{ id: 'ev-owner', type: 'opened', payload: {} }],
    })).data as { ok?: boolean; inserted?: number; first_open?: boolean };
    expect(ownerPreview).toEqual({ ok: true, inserted: 0, first_open: false });

    const { data: rows } = await user.client.from('proposal_events').select('id').eq('proposal_id', p.id);
    expect(rows).toHaveLength(0);

    const coupleOpen = (await rpc(p.share_token, 'sess-couple', [{ id: 'ev-couple-open', type: 'opened', payload: {} }])).data as { first_open?: boolean };
    expect(coupleOpen.first_open).toBe(true);
  });

  it('inserts known events with the owner user_id and reports first_open once', async () => {
    const p = await seed();
    const first = (await rpc(p.share_token, 'sess-1', [
      { id: 'ev-1', type: 'opened', payload: {} },
      { id: 'ev-2', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 4 } },
      { id: 'ev-3', type: 'bogus', payload: {} },
    ])).data as { ok?: boolean; inserted?: number; first_open?: boolean };
    expect(first).toMatchObject({ ok: true, inserted: 2, first_open: true });
    const second = (await rpc(p.share_token, 'sess-2', [{ id: 'ev-4', type: 'opened', payload: {} }])).data as { first_open?: boolean; inserted?: number };
    expect(second).toMatchObject({ inserted: 1, first_open: false });
    const { data: rows } = await user.client.from('proposal_events').select('user_id, session_id, type, payload').eq('proposal_id', p.id).order('created_at');
    expect(rows).toHaveLength(3);
    expect(rows!.every((r) => r.user_id === user.id)).toBe(true);
    expect(rows![1]).toMatchObject({ session_id: 'sess-1', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 4 } });
  });

  it('refuses more than 50 events, a bad session id, and an unsent token', async () => {
    const p = await seed();
    const many = Array.from({ length: 51 }, (_, i) => ({ id: `ev-many-${i}`, type: 'opened', payload: {} }));
    expect(((await rpc(p.share_token, 'sess-1', many)).data as { error?: string }).error).toBe('too_many');
    expect(((await rpc(p.share_token, '', [{ id: 'ev-1', type: 'opened', payload: {} }])).data as { error?: string }).error).toBe('bad_session');
    const unsent = await seed({ share_token_enabled: false });
    expect(((await rpc(unsent.share_token, 'sess-1', [{ id: 'ev-1', type: 'opened', payload: {} }])).data as { error?: string }).error).toBe('not_found');
  });

  it('a batch of only unknown types inserts nothing and is not a first open', async () => {
    const p = await seed();
    const r = (await rpc(p.share_token, 'sess-1', [{ id: 'ev-1', type: 'nope', payload: {} }])).data as { inserted?: number; first_open?: boolean };
    expect(r).toMatchObject({ inserted: 0, first_open: false });
  });

  it('a known event with a missing or malformed id inserts nothing, same as a malformed payload', async () => {
    const p = await seed();
    const r = (await rpc(p.share_token, 'sess-1', [
      { type: 'opened', payload: {} },
      { id: '', type: 'opened', payload: {} },
      { id: 'x'.repeat(65), type: 'opened', payload: {} },
    ])).data as { inserted?: number; first_open?: boolean };
    expect(r).toMatchObject({ inserted: 0, first_open: false });
    const { data: rows } = await user.client.from('proposal_events').select('id').eq('proposal_id', p.id);
    expect(rows).toHaveLength(0);
  });

  it('M4: clamps a reported duration to 0-3600 seconds', async () => {
    const p = await seed();
    await rpc(p.share_token, 'sess-1', [
      { id: 'ev-1', type: 'opened', payload: {} },
      { id: 'ev-2', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 1e12 } },
    ]);
    const { data: rows } = await user.client
      .from('proposal_events')
      .select('payload')
      .eq('proposal_id', p.id)
      .eq('type', 'section_viewed')
      .single();
    expect((rows!.payload as { seconds: number }).seconds).toBe(3600);
  });

  it('M4: drops a single event whose payload is not a plain object or is oversized, without failing the batch', async () => {
    const p = await seed();
    const bigString = 'x'.repeat(3000);
    const r = (await rpc(p.share_token, 'sess-1', [
      { id: 'ev-1', type: 'opened', payload: {} },
      { id: 'ev-2', type: 'section_viewed', payload: 'not-an-object' },
      { id: 'ev-3', type: 'section_viewed', payload: { blockId: 'b1', blockType: bigString, seconds: 1 } },
    ])).data as { ok?: boolean; inserted?: number };
    // Only 'opened' survives: the other two are malformed/oversized.
    expect(r).toMatchObject({ ok: true, inserted: 1 });
    const { data: rows } = await user.client.from('proposal_events').select('type').eq('proposal_id', p.id);
    expect(rows).toHaveLength(1);
    expect(rows![0]!.type).toBe('opened');
  });

  it('M4: a proposal at the row ceiling accepts the batch but writes nothing', async () => {
    const p = await seed();
    // Seed straight past the 20000-row ceiling with the service-role
    // owner-insert policy rather than 20000 real RPC round trips.
    const filler = Array.from({ length: 20000 }, (_, i) => ({
      proposal_id: p.id, user_id: user.id, session_id: `s${i}`, type: 'opened', payload: {},
    }));
    const { error } = await user.client.from('proposal_events').insert(filler);
    expect(error).toBeNull();

    const r = (await rpc(p.share_token, 'sess-over', [{ id: 'ev-over', type: 'opened', payload: {} }])).data as { ok?: boolean; inserted?: number; first_open?: boolean };
    expect(r).toEqual({ ok: true, inserted: 0, first_open: false });

    const { count } = await user.client.from('proposal_events').select('id', { count: 'exact', head: true }).eq('proposal_id', p.id);
    expect(count).toBe(20000);
  }, 30_000);

  it('the "for update" lock: two concurrent opens on the same proposal report exactly one first_open', async () => {
    const p = await seed();
    const [a, b] = await Promise.all([
      rpc(p.share_token, 'sess-race-a', [{ id: 'ev-race-a', type: 'opened', payload: {} }]),
      rpc(p.share_token, 'sess-race-b', [{ id: 'ev-race-b', type: 'opened', payload: {} }]),
    ]);
    const results = [a.data, b.data] as Array<{ first_open?: boolean }>;
    expect(results.filter((r) => r.first_open === true)).toHaveLength(1);
    expect(results.filter((r) => r.first_open === false)).toHaveLength(1);
  });

  it('idempotency: replaying the identical batch (same client ids) leaves the row count unchanged and reports 0 inserted', async () => {
    const p = await seed();
    const batch: Json[] = [
      { id: 'replay-open', type: 'opened', payload: {} },
      { id: 'replay-section', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 4 } },
    ];
    const first = (await rpc(p.share_token, 'sess-replay', batch)).data as { inserted?: number };
    expect(first.inserted).toBe(2);

    const { count: afterFirst } = await user.client.from('proposal_events').select('id', { count: 'exact', head: true }).eq('proposal_id', p.id);
    expect(afterFirst).toBe(2);

    // Same batch, same ids: this is exactly what the tracker's requeue
    // produces when it believes the first POST failed but the server
    // had already committed it.
    const second = (await rpc(p.share_token, 'sess-replay', batch)).data as { ok?: boolean; inserted?: number };
    expect(second).toMatchObject({ ok: true, inserted: 0 });

    const { count: afterSecond } = await user.client.from('proposal_events').select('id', { count: 'exact', head: true }).eq('proposal_id', p.id);
    expect(afterSecond).toBe(2);
  });

  it('idempotency: a replayed `opened` does not report first_open a second time', async () => {
    const p = await seed();
    const opened: Json[] = [{ id: 'replay-open-2', type: 'opened', payload: {} }];
    const first = (await rpc(p.share_token, 'sess-replay-2', opened)).data as { first_open?: boolean; inserted?: number };
    expect(first).toMatchObject({ inserted: 1, first_open: true });

    const replay = (await rpc(p.share_token, 'sess-replay-2', opened)).data as { first_open?: boolean; inserted?: number };
    expect(replay).toMatchObject({ inserted: 0, first_open: false });
  });
});
