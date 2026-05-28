import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `portal_songs` + `portal_song_categories`
 * (Phase 4D).
 */
describe('RLS: portal_songs tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let songAId: string;
  let categoryAId: string;

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

    const songRes = await userA.client
      .from('portal_songs')
      .insert({
        user_id: userA.id,
        couple_id: coupleRes.data!.id,
        category: 'first_dance',
        title: 'A Song',
      })
      .select('id')
      .single();
    expect(songRes.error).toBeNull();
    songAId = songRes.data!.id;

    const categoryRes = await userA.client
      .from('portal_song_categories')
      .insert({
        user_id: userA.id,
        couple_id: coupleRes.data!.id,
        key: 'custom_one',
        label: 'Custom One',
      })
      .select('id')
      .single();
    expect(categoryRes.error).toBeNull();
    categoryAId = categoryRes.data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own song', async () => {
    const { data } = await userA.client
      .from('portal_songs')
      .select('id')
      .eq('id', songAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT the song', async () => {
    const { data, error } = await userB.client
      .from('portal_songs')
      .select('*')
      .eq('id', songAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot UPDATE the song', async () => {
    await userB.client
      .from('portal_songs')
      .update({ title: 'hacked' })
      .eq('id', songAId);
    const { data } = await serviceClient()
      .from('portal_songs')
      .select('title')
      .eq('id', songAId)
      .single();
    expect(data?.title).toBe('A Song');
  });

  it('another tenant cannot DELETE the song', async () => {
    await userB.client.from('portal_songs').delete().eq('id', songAId);
    const { count } = await serviceClient()
      .from('portal_songs')
      .select('*', { count: 'exact', head: true })
      .eq('id', songAId);
    expect(count).toBe(1);
  });

  it('owner can read their own song category', async () => {
    const { data } = await userA.client
      .from('portal_song_categories')
      .select('id')
      .eq('id', categoryAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT the song category', async () => {
    const { data, error } = await userB.client
      .from('portal_song_categories')
      .select('*')
      .eq('id', categoryAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('anonymous client cannot read portal_songs at all', async () => {
    const { data } = await anonClient()
      .from('portal_songs')
      .select('*')
      .limit(1);
    expect(data).toEqual([]);
  });
});
