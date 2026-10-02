/**
 * Spotify song picks on `portal_songs` (migration 20261026100000).
 *
 * Proves, against the real schema and RLS:
 * - a couple's portal token can save a song with its Spotify pick, read the
 *   pick back, and clear it by re-saving as a typed song;
 * - the CHECKs reject a junk track id and a cover from outside Spotify's
 *   CDN (the cover is rendered as an <img> for the MC);
 * - couple A's token can no longer overwrite couple B's song by id (the
 *   ON CONFLICT branch now requires the same couple);
 * - get_portal_song_spotify / portal_token_is_active only answer for an
 *   enabled token, and another MC cannot read the columns through RLS.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' };

const TRACK_ID = '44AyOl4qVkzS48vBsbNXaC';
const COVER = 'https://i.scdn.co/image/ab67616d00004851ba5db46f4b838ef6';

interface Arranged {
  user: TestUser;
  coupleId: string;
  token: string;
}

const cleanup: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanup.map((fn) => fn().catch(() => undefined)));
});

async function arrange(): Promise<Arranged> {
  const user = await createTestUser({}, pro);
  cleanup.push(user.cleanup);
  const couple = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'Spotify Couple', status: 'enquiry' })
    .select('id, portal_token')
    .single();
  if (couple.error || !couple.data) throw new Error(`couple insert failed: ${couple.error?.message}`);
  await serviceClient().from('couples').update({ portal_token_enabled: true }).eq('id', couple.data.id);
  return { user, coupleId: couple.data.id, token: couple.data.portal_token as string };
}

function saveArgs(token: string, id: string, extra: Record<string, unknown> = {}) {
  return {
    p_token: token,
    p_id: id,
    p_category: 'first_dance',
    p_title: "Can't Help Falling in Love",
    p_artist: 'Elvis Presley',
    p_notes: '',
    p_position: 0,
    ...extra,
  };
}

describe('portal songs: Spotify picks', () => {
  it('saves, reads back and clears a Spotify pick through the portal token', async () => {
    const a = await arrange();
    const anon = anonClient();
    const id = randomUUID();

    const saved = await anon.rpc('save_portal_song', saveArgs(a.token, id, {
      p_spotify_track_id: TRACK_ID, p_artwork_url: COVER, p_duration_ms: 182_000,
    }));
    expect(saved.error).toBeNull();

    const read = await anon.rpc('get_portal_song_spotify', { p_token: a.token });
    expect(read.error).toBeNull();
    expect(read.data).toEqual([{ id, spotify_track_id: TRACK_ID, artwork_url: COVER, duration_ms: 182_000 }]);

    // The MC sees the pick on their own row.
    const mcRow = await a.user.client.from('portal_songs').select('spotify_track_id, artwork_url').eq('id', id).single();
    expect(mcRow.data).toEqual({ spotify_track_id: TRACK_ID, artwork_url: COVER });

    // Re-saving as a typed song (old 7-arg call shape) clears the pick.
    const typed = await anon.rpc('save_portal_song', saveArgs(a.token, id, { p_title: 'Live version' }));
    expect(typed.error).toBeNull();
    const after = await anon.rpc('get_portal_song_spotify', { p_token: a.token });
    expect(after.data).toEqual([]);
  });

  it.each([
    ['a malformed track id', { p_spotify_track_id: 'not-a-track' }],
    ['a cover from another host', { p_spotify_track_id: TRACK_ID, p_artwork_url: 'https://tracker.example.com/image/abc' }],
    ['a cover without a track', { p_artwork_url: COVER }],
    ['a zero duration', { p_spotify_track_id: TRACK_ID, p_duration_ms: 0 }],
  ])('rejects %s', async (_label, extra) => {
    const a = await arrange();
    const res = await anonClient().rpc('save_portal_song', saveArgs(a.token, randomUUID(), extra));
    expect(res.error?.code).toBe('23514');
  });

  it("does not let couple A's token overwrite couple B's song", async () => {
    const a = await arrange();
    const b = await arrange();
    const anon = anonClient();
    const bSong = randomUUID();
    expect((await anon.rpc('save_portal_song', saveArgs(b.token, bSong))).error).toBeNull();

    const hijack = await anon.rpc('save_portal_song', saveArgs(a.token, bSong, { p_title: 'Hijacked' }));
    expect(hijack.error?.message).toMatch(/Song not found/);

    const row = await serviceClient().from('portal_songs').select('title, couple_id').eq('id', bSong).single();
    expect(row.data).toEqual({ title: "Can't Help Falling in Love", couple_id: b.coupleId });
  });

  it('answers the token checks only for an enabled token', async () => {
    const a = await arrange();
    const anon = anonClient();
    expect((await anon.rpc('portal_token_is_active', { p_token: a.token })).data).toBe(true);
    expect((await anon.rpc('portal_token_is_active', { p_token: randomUUID() })).data).toBe(false);

    await anon.rpc('save_portal_song', saveArgs(a.token, randomUUID(), { p_spotify_track_id: TRACK_ID }));
    await serviceClient().from('couples').update({ portal_token_enabled: false }).eq('id', a.coupleId);
    expect((await anon.rpc('portal_token_is_active', { p_token: a.token })).data).toBe(false);
    expect((await anon.rpc('get_portal_song_spotify', { p_token: a.token })).data).toEqual([]);
  });

  it("keeps another MC out of a couple's Spotify picks (RLS)", async () => {
    const a = await arrange();
    const intruder = await createTestUser({}, pro);
    cleanup.push(intruder.cleanup);
    const id = randomUUID();
    await anonClient().rpc('save_portal_song', saveArgs(a.token, id, { p_spotify_track_id: TRACK_ID }));

    const peek = await intruder.client.from('portal_songs').select('spotify_track_id').eq('id', id);
    expect(peek.data).toEqual([]);
    const write = await intruder.client.from('portal_songs').update({ spotify_track_id: null }).eq('id', id).select('id');
    expect(write.data).toEqual([]);
  });
});
