/**
 * Unit tests for `lib/spotify/song-fields`: the Spotify columns written to
 * `portal_songs` and the validation that mirrors the table's CHECKs.
 *
 * @module tests/unit/lib/spotify/song-fields.test
 */
import { describe, expect, it } from 'vitest';

import type { SpotifyTrack } from '@/lib/spotify/client';
import { spotifyColumnsFor, spotifySongFields, trackFromSong } from '@/lib/spotify/song-fields';

const track: SpotifyTrack = {
  id: '44AyOl4qVkzS48vBsbNXaC',
  title: 'Perfect',
  artist: 'Ed Sheeran',
  album: 'Divide',
  artworkUrl: 'https://i.scdn.co/image/ab67616d00004851ba5db46f4b838ef6027e6f96',
  durationMs: 263_400,
};

describe('spotifyColumnsFor', () => {
  it('maps a picked track to the row columns', () => {
    expect(spotifyColumnsFor(track)).toEqual({
      spotify_track_id: track.id,
      artwork_url: track.artworkUrl,
      duration_ms: 263_400,
    });
  });

  it('drops a cover that is not on Spotify\'s CDN instead of failing the save', () => {
    expect(spotifyColumnsFor({ ...track, artworkUrl: 'https://tracker.example.com/p.gif' }).artwork_url).toBeNull();
  });
});

describe('spotifySongFields', () => {
  it('accepts valid values and null', () => {
    expect(spotifySongFields.spotify_track_id.safeParse(track.id).success).toBe(true);
    expect(spotifySongFields.artwork_url.safeParse(track.artworkUrl).success).toBe(true);
    expect(spotifySongFields.duration_ms.safeParse(1).success).toBe(true);
    expect(spotifySongFields.spotify_track_id.safeParse(null).success).toBe(true);
  });

  it.each([
    ['spotify_track_id', 'not-an-id'],
    ['artwork_url', 'https://evil.example.com/image/abc'],
    ['artwork_url', 'http://i.scdn.co/image/abc'],
    ['duration_ms', 0],
    ['duration_ms', 86_400_000],
  ] as const)('rejects %s = %s', (field, value) => {
    expect(spotifySongFields[field].safeParse(value).success).toBe(false);
  });
});

describe('trackFromSong', () => {
  it('rebuilds the picker track from a saved picked song', () => {
    const song = { title: 'Perfect', artist: 'Ed Sheeran', ...spotifyColumnsFor(track) };
    expect(trackFromSong(song)).toMatchObject({ id: track.id, title: 'Perfect', artworkUrl: track.artworkUrl });
  });

  it('returns null for a typed song', () => {
    expect(
      trackFromSong({ title: 'Live set', artist: null, spotify_track_id: null, artwork_url: null, duration_ms: null }),
    ).toBeNull();
  });
});
