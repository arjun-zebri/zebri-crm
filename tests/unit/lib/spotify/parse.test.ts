/**
 * Unit tests for `lib/spotify/parse`: recognising pasted Spotify links.
 *
 * @module tests/unit/lib/spotify/parse.test
 */
import { describe, expect, it } from 'vitest';

import {
  formatTrackDuration,
  parseSpotifyTrackRef,
  spotifyEmbedUrl,
  spotifyTrackUrl,
} from '@/lib/spotify/parse';

const ID = '44AyOl4qVkzS48vBsbNXaC';

describe('parseSpotifyTrackRef', () => {
  it.each([
    [`https://open.spotify.com/track/${ID}`],
    [`https://open.spotify.com/track/${ID}?si=abc123`],
    [`https://open.spotify.com/intl-de/track/${ID}?si=x`],
    [`https://open.spotify.com/embed/track/${ID}`],
    [`spotify:track:${ID}`],
    [`  https://open.spotify.com/track/${ID}  `],
  ])('reads the track id from %s', (input) => {
    expect(parseSpotifyTrackRef(input)).toBe(ID);
  });

  it.each([
    ["can't help falling in love"],
    [`https://open.spotify.com/album/${ID}`],
    [`https://open.spotify.com/playlist/${ID}`],
    [`https://evil.example.com/track/${ID}`],
    [`javascript:alert(1)//open.spotify.com/track/${ID}`],
    ['https://open.spotify.com/track/short'],
    [''],
  ])('returns null for %s', (input) => {
    expect(parseSpotifyTrackRef(input)).toBeNull();
  });
});

describe('url helpers', () => {
  it('builds the public and embed urls', () => {
    expect(spotifyTrackUrl(ID)).toBe(`https://open.spotify.com/track/${ID}`);
    expect(spotifyEmbedUrl(ID)).toBe(`https://open.spotify.com/embed/track/${ID}`);
  });
});

describe('formatTrackDuration', () => {
  it.each([
    [182_000, '3:02'],
    [59_600, '1:00'],
    [5_000, '0:05'],
    [3_600_000, '60:00'],
  ])('formats %i ms as %s', (ms, expected) => {
    expect(formatTrackDuration(ms)).toBe(expected);
  });
});
