/**
 * Server-only Spotify Web API client for song search.
 *
 * Uses the Client Credentials flow: the app authenticates as itself, no
 * Spotify login is asked of the MC or the couple. That flow covers search
 * and track lookup, which is all the songs feature needs, and it is not
 * subject to Spotify's 25-user development-mode cap (that cap only counts
 * users who sign in with OAuth).
 *
 * Every call is time-boxed: Spotify sits on a search-as-you-type path, so a
 * hung socket must fail fast and let the UI fall back to manual entry.
 *
 * @module lib/spotify/client
 */

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE_URL = 'https://api.spotify.com/v1';
const REQUEST_TIMEOUT_MS = 5_000;

/** Refresh this long before Spotify's stated expiry, so no call races it. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/** Search results are biased to the Australian catalogue, where our MCs work. */
const MARKET = 'AU';

/** The slice of a Spotify track the songs feature stores and shows. */
export interface SpotifyTrack {
  /** 22-character Spotify track id. */
  id: string;
  title: string;
  /** All credited artists, comma-joined, e.g. `Ed Sheeran, Andrea Bocelli`. */
  artist: string;
  album: string;
  /** Smallest album cover at least 64px wide, or null when the track has none. */
  artworkUrl: string | null;
  durationMs: number;
}

/**
 * A failed Spotify call. `status` is 0 when no response arrived (timeout,
 * DNS, socket) or when credentials are missing.
 */
export class SpotifyApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.code = code;
  }

  /**
   * True when the fault is ours to fix (missing or rejected credentials),
   * as opposed to a transient Spotify outage. Callers alert on these.
   */
  get isConfigError(): boolean {
    return this.code === 'missing_credentials' || this.status === 400 || this.status === 401;
  }
}

/** Raw track shape from the Web API; only the fields we read. */
interface RawTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string; width: number | null }[] };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function credentials(): { id: string; secret: string } {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new SpotifyApiError('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set', 0, 'missing_credentials');
  }
  return { id, secret };
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    throw new SpotifyApiError(`Spotify request failed: ${(err as Error).message}`, 0, 'network');
  }
}

/** Fetch (or reuse) an app access token. Module-level cache per server instance. */
async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const { id, secret } = credentials();
  const res = await timedFetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new SpotifyApiError(`Spotify token request returned ${res.status}`, res.status, 'token');
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS,
  };
  return cachedToken.value;
}

async function apiGet(path: string): Promise<Response> {
  const token = await accessToken();
  const res = await timedFetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // A token revoked early (rotated secret) shows up as 401 on the API, not
  // the token endpoint. Drop it so the next call mints a fresh one.
  if (res.status === 401) cachedToken = null;
  return res;
}

function pickArtwork(images: RawTrack['album']['images']): string | null {
  // Spotify lists covers largest first; the smallest one >= 64px keeps the
  // row thumbnail sharp without pulling a 640px image per result.
  const usable = images.filter((img) => (img.width ?? 0) >= 64);
  return usable.at(-1)?.url ?? images.at(-1)?.url ?? null;
}

/** Map a raw API track to the stored shape. Exported for tests. */
export function toSpotifyTrack(raw: RawTrack): SpotifyTrack {
  return {
    id: raw.id,
    title: raw.name,
    artist: raw.artists.map((a) => a.name).join(', '),
    album: raw.album.name,
    artworkUrl: pickArtwork(raw.album.images),
    durationMs: raw.duration_ms,
  };
}

/**
 * Search Spotify's catalogue for tracks.
 *
 * @param query - Free text, e.g. `can't help falling elvis`.
 * @param limit - Max results (1-10).
 * @throws {SpotifyApiError} on missing credentials, timeouts or non-2xx.
 */
export async function searchTracks(query: string, limit = 8): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit), market: MARKET });
  const res = await apiGet(`/search?${params.toString()}`);
  if (!res.ok) throw new SpotifyApiError(`Spotify search returned ${res.status}`, res.status, 'search');
  const body = (await res.json()) as { tracks?: { items: (RawTrack | null)[] } };
  // Spotify occasionally returns null entries for region-blocked tracks.
  return (body.tracks?.items ?? []).filter((t): t is RawTrack => t !== null).map(toSpotifyTrack);
}

/**
 * Look up one track by id (the pasted-link path).
 *
 * @param trackId - A 22-character Spotify track id.
 * @returns The track, or null when Spotify has no such track.
 * @throws {SpotifyApiError} on missing credentials, timeouts or other non-2xx.
 */
export async function getTrack(trackId: string): Promise<SpotifyTrack | null> {
  const res = await apiGet(`/tracks/${encodeURIComponent(trackId)}?market=${MARKET}`);
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new SpotifyApiError(`Spotify track lookup returned ${res.status}`, res.status, 'track');
  return toSpotifyTrack((await res.json()) as RawTrack);
}

/** Test-only: forget the cached token between cases. */
export function _resetSpotifyTokenForTest(): void {
  cachedToken = null;
}
