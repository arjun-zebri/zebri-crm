/**
 * Unit tests for `GET /api/spotify/search`.
 *
 * The route must only serve a signed-in MC or a couple holding an active
 * portal token (our Spotify quota is shared by every MC), must look a
 * pasted link up directly, and must degrade to 503 (with one Slack alert
 * for our own credential faults) when Spotify fails.
 *
 * @module tests/unit/app/api/spotify-search-route.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ rpc, auth: { getUser } })),
}));

const searchTracks = vi.fn();
const getTrack = vi.fn();
vi.mock('@/lib/spotify/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/spotify/client')>();
  return {
    ...actual,
    searchTracks: (...a: unknown[]) => searchTracks(...a),
    getTrack: (...a: unknown[]) => getTrack(...a),
  };
});

const recordInvalidTokenAttempt = vi.fn(async () => ({ allowed: true, retryAfter: 0 }));
vi.mock('@/lib/api/public-token-limiter', () => ({
  recordInvalidTokenAttempt: (...args: unknown[]) => recordInvalidTokenAttempt(...(args as [])),
}));

const sendAlert = vi.fn(async () => true);
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: (...args: unknown[]) => sendAlert(...(args as [])),
}));
vi.mock('@/lib/alerts/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { GET } from '@/app/api/spotify/search/route';
import { SpotifyApiError } from '@/lib/spotify/client';

const TOKEN = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '44AyOl4qVkzS48vBsbNXaC';
const track = { id: TRACK_ID, title: 'Perfect', artist: 'Ed Sheeran', album: 'Divide', artworkUrl: null, durationMs: 1 };

/** Random IP per request so the per-IP limiter never trips between cases. */
function req(params: Record<string, string>) {
  const url = new URL('http://localhost/api/spotify/search');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { headers: { 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
}

beforeEach(() => {
  rpc.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: 'mc-1' } } });
  searchTracks.mockReset();
  searchTracks.mockResolvedValue([track]);
  getTrack.mockReset();
  recordInvalidTokenAttempt.mockClear();
  sendAlert.mockClear();
});

describe('GET /api/spotify/search', () => {
  it('searches for a signed-in MC', async () => {
    const res = await GET(req({ q: 'perfect' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tracks: [track] });
    expect(searchTracks).toHaveBeenCalledWith('perfect');
    expect(res.headers.get('cache-control')).toBe('private, max-age=300');
  });

  it('refuses an anonymous caller with no portal token', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req({ q: 'perfect' }));
    expect(res.status).toBe(401);
    expect(searchTracks).not.toHaveBeenCalled();
  });

  it('serves a couple with an active portal token', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    rpc.mockResolvedValue({ data: true, error: null });
    const res = await GET(req({ q: 'perfect', portal_token: TOKEN }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('portal_token_is_active', { p_token: TOKEN });
  });

  it('refuses an inactive portal token and counts the attempt', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const res = await GET(req({ q: 'perfect', portal_token: TOKEN }));
    expect(res.status).toBe(403);
    expect(recordInvalidTokenAttempt).toHaveBeenCalledWith(expect.objectContaining({ surface: 'portal' }));
    expect(searchTracks).not.toHaveBeenCalled();
  });

  it('rejects a malformed portal token', async () => {
    const res = await GET(req({ q: 'perfect', portal_token: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('looks a pasted link up directly instead of searching', async () => {
    getTrack.mockResolvedValue(track);
    const res = await GET(req({ q: `https://open.spotify.com/track/${TRACK_ID}?si=x` }));
    expect(await res.json()).toEqual({ tracks: [track] });
    expect(getTrack).toHaveBeenCalledWith(TRACK_ID);
    expect(searchTracks).not.toHaveBeenCalled();
  });

  it('skips Spotify for a one-character query', async () => {
    const res = await GET(req({ q: 'a' }));
    expect(await res.json()).toEqual({ tracks: [] });
    expect(searchTracks).not.toHaveBeenCalled();
  });

  it('answers 503 without alerting on a transient Spotify outage', async () => {
    searchTracks.mockRejectedValue(new SpotifyApiError('down', 503, 'search'));
    const res = await GET(req({ q: 'perfect' }));
    expect(res.status).toBe(503);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('alerts once when our credentials are missing or rejected', async () => {
    searchTracks.mockRejectedValue(new SpotifyApiError('no creds', 0, 'missing_credentials'));
    expect((await GET(req({ q: 'perfect' }))).status).toBe(503);
    expect((await GET(req({ q: 'perfect' }))).status).toBe(503);
    expect(sendAlert).toHaveBeenCalledTimes(1);
    expect(sendAlert).toHaveBeenCalledWith({ type: 'spotify_api_failed', severity: 'error', status: 0, code: 'missing_credentials' });
  });
});
