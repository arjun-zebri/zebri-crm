/**
 * Spotify track search for the songs picker (portal + client profile).
 *
 * `GET /api/spotify/search?q=<text or Spotify link>[&portal_token=<uuid>]`
 * returns `{ tracks: SpotifyTrack[] }`.
 *
 * Callers are either a signed-in MC, or a couple on their portal, who is
 * not signed in and proves themselves with the portal token instead. One of
 * the two is required: our Spotify app quota is shared by every MC, so the
 * route must not be usable as an anonymous Spotify proxy.
 *
 * When Spotify is unreachable or our credentials are missing the route
 * answers 503 and the picker falls back to typing the song by hand.
 *
 * @module app/api/spotify/search/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { SPOTIFY_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseSearchParams } from '@/lib/api/validate';
import { SpotifyApiError, getTrack, searchTracks, type SpotifyTrack } from '@/lib/spotify/client';
import { parseSpotifyTrackRef } from '@/lib/spotify/parse';
import { createClient } from '@/lib/supabase/server';

const limiter = inMemoryLimiter(SPOTIFY_RATE_LIMITS.search);

// One Slack ping per 10 minutes per server instance: a missing or revoked
// key fails every keystroke of every couple, and one alert is enough.
const alertDedup = inMemoryLimiter({ windowMs: 10 * 60_000, max: 1 });

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  portal_token: z.string().uuid().optional(),
});

/** Below this many characters a search returns noise, so skip Spotify. */
const MIN_SEARCH_LENGTH = 2;

export async function GET(request: NextRequest) {
  const ip = ipOf(request);
  const { allowed, retryAfter } = await limiter.check(ip);
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { q, portal_token: portalToken } = parsed.data;

  const supabase = await createClient();
  if (portalToken) {
    const { data: active } = await supabase.rpc('portal_token_is_active', { p_token: portalToken });
    if (!active) {
      await recordInvalidTokenAttempt({ ip, surface: 'portal' });
      return NextResponse.json({ error: 'Invalid portal link' }, { status: 403 });
    }
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const tracks = await lookup(q);
    return NextResponse.json(
      { tracks },
      // Same query from the same person (backspace, retype) is served from
      // the browser cache; private because portal requests carry a token.
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch (err) {
    return unavailable(err);
  }
}

async function lookup(q: string): Promise<SpotifyTrack[]> {
  const trackId = parseSpotifyTrackRef(q);
  if (trackId) {
    const track = await getTrack(trackId);
    return track ? [track] : [];
  }
  if (q.length < MIN_SEARCH_LENGTH) return [];
  return searchTracks(q);
}

async function unavailable(err: unknown): Promise<NextResponse> {
  const status = err instanceof SpotifyApiError ? err.status : 0;
  const code = err instanceof SpotifyApiError ? err.code : 'unknown';
  logger.warn('[spotify/search] Spotify call failed', { status, code });

  // Transient Spotify outages and their own rate-limit (429) self-heal;
  // only page us when the fault is ours (missing or rejected credentials).
  if (err instanceof SpotifyApiError && err.isConfigError) {
    const { allowed } = await alertDedup.check('spotify');
    if (allowed) {
      await sendAlert({ type: 'spotify_api_failed', severity: 'error', status, code });
    }
  }
  return NextResponse.json({ error: 'Spotify search is unavailable' }, { status: 503 });
}
