'use client';

import { useState } from 'react';

import { SongArtwork } from '@/components/songs/song-artwork';
import { SpotifyEmbed } from '@/components/songs/spotify-embed';
import { SpotifyTrackPicker } from '@/components/songs/spotify-track-picker';
import { SpotifyTrackRow } from '@/components/songs/spotify-track-row';
import type { SpotifyTrack } from '@/lib/spotify/client';

import { Demo, DemoGrid, Spec } from './showroom';

/**
 * Song composites: the Spotify picker and its parts, used by the client
 * profile's song modal and (in the MC's branding) the couple portal.
 *
 * @module app/design-system/composites-songs
 */

const DEMO_TRACKS: SpotifyTrack[] = [
  {
    id: '44AyOl4qVkzS48vBsbNXaC',
    title: "Can't Help Falling in Love",
    artist: 'Elvis Presley',
    album: 'Blue Hawaii',
    artworkUrl: null,
    durationMs: 182_000,
  },
  {
    id: '0tgVpDi06FyKpA1z0VMD4v',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    album: 'Divide',
    artworkUrl: null,
    durationMs: 263_400,
  },
];

/** The Spotify song picker and its building blocks. */
export function CompositesSongs() {
  const [picked, setPicked] = useState<SpotifyTrack | null>(null);
  const [typed, setTyped] = useState(false);

  return (
    <>
      <Spec
        name="SpotifyTrackPicker"
        file="components/songs/spotify-track-picker.tsx"
        importPath="@/components/songs/spotify-track-picker"
        description="Search Spotify, pick a track, hear it. Live: it calls /api/spotify/search, so without SPOTIFY_* keys it shows the unavailable state. One fixed height in every state."
      >
        <div className="max-w-lg">
          {typed ? (
            <button type="button" onClick={() => setTyped(false)} className="text-body text-text-muted hover:text-text">
              Typed entry chosen. Back to search
            </button>
          ) : (
            <SpotifyTrackPicker value={picked} onChange={setPicked} onTypeInstead={() => setTyped(true)} autoFocus={false} />
          )}
        </div>
      </Spec>

      <Spec
        name="SpotifyTrackRow"
        file="components/songs/spotify-track-row.tsx"
        importPath="@/components/songs/spotify-track-row"
        description="One search result. The whole row is the pick target. Shown with no cover, so the fallback tile renders."
      >
        <ul className="max-w-lg space-y-0.5">
          {DEMO_TRACKS.map((t) => (
            <SpotifyTrackRow key={t.id} track={t} onPick={() => {}} />
          ))}
        </ul>
      </Spec>

      <Spec
        name="SpotifyEmbed"
        file="components/songs/spotify-embed.tsx"
        importPath="@/components/songs/spotify-embed"
        description="Spotify's compact player (80px). Full song when the listener is signed in to Spotify, a preview otherwise."
      >
        <div className="max-w-lg">
          <SpotifyEmbed trackId={DEMO_TRACKS[0]!.id} title={DEMO_TRACKS[0]!.title} />
        </div>
      </Spec>

      <Spec
        name="SongArtwork"
        file="components/songs/song-artwork.tsx"
        importPath="@/components/songs/song-artwork"
        description="Album cover that falls back instead of showing a broken image."
      >
        <DemoGrid cols={2}>
          <Demo label="No cover, no fallback">
            <SongArtwork src={null} className="size-10 rounded-control" />
          </Demo>
          <Demo label="Cover that fails to load, with fallback">
            <SongArtwork
              src="https://i.scdn.co/image/missing"
              className="size-10 rounded-control"
              fallback={<span className="block size-10 rounded-control bg-surface-emphasis" />}
            />
          </Demo>
        </DemoGrid>
      </Spec>
    </>
  );
}
