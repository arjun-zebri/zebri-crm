import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * Coverage for the time-tracking tables behind the Couple Profile
 * Time tab:
 *
 *   1. RLS: a second user cannot read or write the first user's
 *      entries or categories (all four verbs).
 *   2. The partial unique index enforces one RUNNING entry per user
 *      while allowing many finished ones.
 *   3. Deleting a couple cascades its entries away.
 *   4. Deleting a category leaves its entries intact, uncategorised.
 *   5. The ends-after-start CHECK rejects an inverted range.
 */
describe('time tracking tables', () => {
  let mc: TestUser;
  let other: TestUser;
  let coupleId: string;
  let categoryId: string;

  beforeAll(async () => {
    mc = await createTestUser(
      {},
      {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: 'pro',
      },
    );
    other = await createTestUser(
      {},
      {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: 'pro',
      },
    );

    const { data: couple, error: coupleError } = await mc.client
      .from('couples')
      .insert({ user_id: mc.id, name: 'Timer Couple', status: 'new' })
      .select('id')
      .single();
    expect(coupleError).toBeNull();
    coupleId = couple!.id;

    const { data: category, error: categoryError } = await mc.client
      .from('time_categories')
      .insert({ user_id: mc.id, name: 'Meeting' })
      .select('id')
      .single();
    expect(categoryError).toBeNull();
    categoryId = category!.id;
  });

  afterAll(async () => {
    await mc?.cleanup();
    await other?.cleanup();
  });

  it('rejects a duplicate category name case-insensitively', async () => {
    const { error } = await mc.client
      .from('time_categories')
      .insert({ user_id: mc.id, name: 'meeting' });
    expect(error).not.toBeNull();
  });

  it('allows many finished entries for one user', async () => {
    const { error } = await mc.client.from('couple_time_entries').insert([
      {
        user_id: mc.id,
        couple_id: coupleId,
        started_at: '2026-07-28T00:00:00Z',
        ended_at: '2026-07-28T01:00:00Z',
        category_id: categoryId,
        note: 'Ceremony script',
      },
      {
        user_id: mc.id,
        couple_id: coupleId,
        started_at: '2026-07-29T00:00:00Z',
        ended_at: '2026-07-29T00:30:00Z',
        category_id: null,
        note: null,
      },
    ]);
    expect(error).toBeNull();
  });

  it('rejects an entry whose end precedes its start', async () => {
    const { error } = await mc.client.from('couple_time_entries').insert({
      user_id: mc.id,
      couple_id: coupleId,
      started_at: '2026-07-29T02:00:00Z',
      ended_at: '2026-07-29T01:00:00Z',
    });
    expect(error).not.toBeNull();
  });

  it('allows exactly one running entry per user', async () => {
    const first = await mc.client
      .from('couple_time_entries')
      .insert({
        user_id: mc.id,
        couple_id: coupleId,
        started_at: new Date().toISOString(),
        ended_at: null,
      })
      .select('id')
      .single();
    expect(first.error).toBeNull();

    const second = await mc.client.from('couple_time_entries').insert({
      user_id: mc.id,
      couple_id: coupleId,
      started_at: new Date().toISOString(),
      ended_at: null,
    });
    expect(second.error).not.toBeNull();

    // Stopping the first frees the slot again.
    const stopped = await mc.client
      .from('couple_time_entries')
      .update({ ended_at: new Date(Date.now() + 1000).toISOString() })
      .eq('id', first.data!.id);
    expect(stopped.error).toBeNull();

    const third = await mc.client.from('couple_time_entries').insert({
      user_id: mc.id,
      couple_id: coupleId,
      started_at: new Date().toISOString(),
      ended_at: null,
    });
    expect(third.error).toBeNull();

    // Leave the table with nothing running so later assertions are not
    // reading a half-open session.
    await mc.client
      .from('couple_time_entries')
      .update({ ended_at: new Date(Date.now() + 2000).toISOString() })
      .is('ended_at', null);
  });

  it('RLS: another user cannot SELECT the entries', async () => {
    const { data, error } = await other.client
      .from('couple_time_entries')
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('RLS: another user cannot SELECT the categories', async () => {
    const { data } = await other.client.from('time_categories').select('id');
    expect(data).toEqual([]);
  });

  it('RLS: another user cannot INSERT an entry against this couple', async () => {
    const { error } = await other.client.from('couple_time_entries').insert({
      user_id: other.id,
      couple_id: coupleId,
      started_at: '2026-07-30T00:00:00Z',
      ended_at: '2026-07-30T00:10:00Z',
    });
    // The couple belongs to `mc`, so the row is not theirs to own:
    // either the policy or the FK has to refuse it.
    expect(error).not.toBeNull();
  });

  it('RLS: another user cannot UPDATE or DELETE the entries', async () => {
    const { data: mine } = await mc.client
      .from('couple_time_entries')
      .select('id')
      .limit(1);
    const targetId = mine![0]!.id;

    const updated = await other.client
      .from('couple_time_entries')
      .update({ note: 'hijacked' })
      .eq('id', targetId)
      .select('id');
    expect(updated.data).toEqual([]);

    const deleted = await other.client
      .from('couple_time_entries')
      .delete()
      .eq('id', targetId)
      .select('id');
    expect(deleted.data).toEqual([]);

    const { data: still } = await mc.client
      .from('couple_time_entries')
      .select('id, note')
      .eq('id', targetId)
      .single();
    expect(still?.note).not.toBe('hijacked');
  });

  it('deleting a category leaves its entries, uncategorised', async () => {
    const { error } = await mc.client
      .from('time_categories')
      .delete()
      .eq('id', categoryId);
    expect(error).toBeNull();

    const { data } = await mc.client
      .from('couple_time_entries')
      .select('id, category_id, note')
      .eq('note', 'Ceremony script')
      .single();
    expect(data?.category_id).toBeNull();
  });

  it('deleting the couple cascades its entries away', async () => {
    const { error } = await mc.client
      .from('couples')
      .delete()
      .eq('id', coupleId);
    expect(error).toBeNull();

    const svc = serviceClient();
    const { data } = await svc
      .from('couple_time_entries')
      .select('id')
      .eq('couple_id', coupleId);
    expect(data).toEqual([]);
  });
});
