import { Music } from 'lucide-react'

import type { SpotifyTrack } from '@/lib/spotify/client'
import { formatTrackDuration } from '@/lib/spotify/parse'

import { SongArtwork } from './song-artwork'

/** Props for {@link SpotifyTrackRow}. */
export interface SpotifyTrackRowProps {
  track: SpotifyTrack
  onPick: (track: SpotifyTrack) => void
}

/**
 * One Spotify search result: cover, title, artist and length. The whole
 * row is the pick target so it is easy to hit on a phone.
 */
export function SpotifyTrackRow({ track, onPick }: SpotifyTrackRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(track)}
        className="flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left transition hover:bg-surface-muted"
      >
        <SongArtwork
          src={track.artworkUrl}
          className="size-10 shrink-0 rounded-control object-cover"
          fallback={
            <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-emphasis">
              <Music size={16} strokeWidth={1.5} className="text-text-subtle" />
            </span>
          }
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-text">{track.title}</span>
          <span className="block truncate text-body text-text-muted">
            {track.artist} · {formatTrackDuration(track.durationMs)}
          </span>
        </span>
      </button>
    </li>
  )
}
