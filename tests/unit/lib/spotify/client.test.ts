/**
 * Unit tests for `lib/spotify/client`: token caching, result mapping and
 * error classification, with `fetch` stubbed.
 *
 * @module tests/unit/lib/spotify/client.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SpotifyApiError,
  _resetSpotifyTokenForTest,
  getTrack,
  searchTracks,
  toSpotifyTrack,
} from '@/lib/spotify/client';

const rawTrack = {
  id: '44AyOl4qVkzS48vBsbNXaC',
  name: "Can't Help Falling in Love",
  duration_ms: 182_000,
  artists: [{ name: 'Elvis Presley' }, { name: 'The Jordanaires' }],
  album: {
    name: 'Blue Hawaii',
    images: [
      { url: 'https://i.scdn.co/image/large', width: 640 },
      { url: 'https://i.scdn.co/image/medium', width: 300 },
      { url: 'https://i.scdn.co/image/small', width: 64 },
    ],
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('SPOTIFY_CLIENT_ID', 'id');
  vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'secret');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  _resetSpotifyTokenForTest();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function tokenThen(...responses: Response[]) {
  fetchMock.mockResolvedValueOnce(json({ access_token: 'tok', expires_in: 3600 }));
  for (const r of responses) fetchMock.mockResolvedValueOnce(r);
}

describe('toSpotifyTrack', () => {
  it('joins artists and picks the smallest cover at least 64px wide', () => {
    expect(toSpotifyTrack(rawTrack)).toEqual({
      id: rawTrack.id,
      title: "Can't Help Falling in Love",
      artist: 'Elvis Presley, The Jordanaires',
      album: 'Blue Hawaii',
      artworkUrl: 'https://i.scdn.co/image/small',
      durationMs: 182_000,
    });
  });

  it('copes with a track that has no cover', () => {
    expect(toSpotifyTrack({ ...rawTrack, album: { name: 'x', images: [] } }).artworkUrl).toBeNull();
  });
});

describe('searchTracks', () => {
  it('authenticates with client credentials and searches the AU market', async () => {
    tokenThen(json({ tracks: { items: [rawTrack, null] } }));

    const tracks = await searchTracks('elvis', 5);

    expect(tracks).toHaveLength(1);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect(tokenUrl).toBe('https://accounts.spotify.com/api/token');
    expect((tokenInit?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('id:secret').toString('base64')}`,
    );
    const searchUrl = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(searchUrl.pathname).toBe('/v1/search');
    expect(searchUrl.searchParams.get('q')).toBe('elvis');
    expect(searchUrl.searchParams.get('type')).toBe('track');
    expect(searchUrl.searchParams.get('limit')).toBe('5');
    expect(searchUrl.searchParams.get('market')).toBe('AU');
  });

  it('reuses the cached token across calls', async () => {
    tokenThen(json({ tracks: { items: [] } }), json({ tracks: { items: [] } }));
    await searchTracks('a b');
    await searchTracks('c d');
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/token'));
    expect(tokenCalls).toHaveLength(1);
  });

  it('drops the token after a 401 so the next call mints a new one', async () => {
    tokenThen(json({}, 401));
    await expect(searchTracks('x y')).rejects.toBeInstanceOf(SpotifyApiError);
    tokenThen(json({ tracks: { items: [] } }));
    await searchTracks('x y');
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/token'));
    expect(tokenCalls).toHaveLength(2);
  });

  it('flags missing credentials as a config error without calling Spotify', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '');
    const err = await searchTracks('x y').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SpotifyApiError);
    expect((err as SpotifyApiError).isConfigError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a Spotify 503 as transient, not a config error', async () => {
    tokenThen(json({}, 503));
    const err = (await searchTracks('x y').catch((e: unknown) => e)) as SpotifyApiError;
    expect(err.status).toBe(503);
    expect(err.isConfigError).toBe(false);
  });

  it('flags a rejected token request as a config error', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_client' }, 400));
    const err = (await searchTracks('x y').catch((e: unknown) => e)) as SpotifyApiError;
    expect(err.code).toBe('token');
    expect(err.isConfigError).toBe(true);
  });

  it('wraps a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));
    const err = (await searchTracks('x y').catch((e: unknown) => e)) as SpotifyApiError;
    expect(err.status).toBe(0);
    expect(err.code).toBe('network');
  });
});

describe('getTrack', () => {
  it('returns the mapped track', async () => {
    tokenThen(json(rawTrack));
    expect((await getTrack(rawTrack.id))?.title).toBe("Can't Help Falling in Love");
  });

  it('returns null when Spotify has no such track', async () => {
    tokenThen(json({ error: { status: 404 } }, 404));
    expect(await getTrack(rawTrack.id)).toBeNull();
  });
});
