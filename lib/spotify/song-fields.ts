/**
 * Validation and mapping for the Spotify columns on `portal_songs`.
 *
 * Lives in a plain module (not a `'use server'` file) so both the MC
 * server actions and tests can import the schemas: a `'use server'` file
 * may only export async functions.
 *
 * @module lib/spotify/song-fields
 */
import { z } from 'zod';

import type { SpotifyTrack } from './client';
import { SPOTIFY_TRACK_ID_PATTERN } from './parse';

/**
 * Album covers must come from Spotify's image CDN. Mirrors the
 * `portal_songs_artwork_url_spotify_cdn` CHECK: the URL is rendered as an
 * `<img>` for the MC, so it must not point anywhere a couple chooses.
 */
export const SPOTIFY_ARTWORK_URL_PATTERN = /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/;

/** Field-level schemas for the three Spotify columns (all nullable). */
export const spotifySongFields = {
  spotify_track_id: z.string().regex(SPOTIFY_TRACK_ID_PATTERN).nullable(),
  artwork_url: z.string().regex(SPOTIFY_ARTWORK_URL_PATTERN).nullable(),
  duration_ms: z.number().int().positive().lt(86_400_000).nullable(),
};

/** The Spotify columns of a song row. All null for a typed song. */
export interface SongSpotifyColumns {
  spotify_track_id: string | null;
  artwork_url: string | null;
  duration_ms: number | null;
}

/** Columns to clear the Spotify pick when a song is typed by hand. */
export const NO_SPOTIFY_PICK: SongSpotifyColumns = {
  spotify_track_id: null,
  artwork_url: null,
  duration_ms: null,
};

/**
 * Map a picked track to the song row's Spotify columns. A cover from any
 * host other than Spotify's CDN is dropped rather than failing the save.
 */
export function spotifyColumnsFor(track: SpotifyTrack): SongSpotifyColumns {
  return {
    spotify_track_id: track.id,
    artwork_url:
      track.artworkUrl && SPOTIFY_ARTWORK_URL_PATTERN.test(track.artworkUrl) ? track.artworkUrl : null,
    duration_ms: track.durationMs > 0 && track.durationMs < 86_400_000 ? Math.round(track.durationMs) : null,
  };
}

/**
 * Rebuild the picker's track from a saved row, so editing a picked song
 * opens with its player showing. Null for a typed song.
 */
export function trackFromSong(song: SongSpotifyColumns & { title: string; artist: string | null }): SpotifyTrack | null {
  if (!song.spotify_track_id) return null;
  return {
    id: song.spotify_track_id,
    title: song.title,
    artist: song.artist ?? '',
    album: '',
    artworkUrl: song.artwork_url,
    durationMs: song.duration_ms ?? 0,
  };
}
