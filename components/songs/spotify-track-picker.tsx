'use client'

import { useState } from 'react'
import { SiSpotify } from 'react-icons/si'

import { Input } from '@/components/ui/input'
import { Loading } from '@/components/ui/loading'
import type { SpotifyTrack } from '@/lib/spotify/client'

import { SpotifyEmbed } from './spotify-embed'
import { SpotifyTrackRow } from './spotify-track-row'
import { useSpotifySearch } from './use-spotify-search'

/** Props for {@link SpotifyTrackPicker}. */
export interface SpotifyTrackPickerProps {
  /** The picked track, or null while searching. */
  value: SpotifyTrack | null
  onChange: (track: SpotifyTrack | null) => void
  /** Switch the song form to typed title and artist. */
  onTypeInstead: () => void
  /** Focus the search field on mount. On by default, for use in a modal. */
  autoFocus?: boolean
}

/**
 * Search Spotify and pick one track, for the MC's song form.
 *
 * Before a pick: a search field and a results list. After a pick: the
 * Spotify player for that track, so the MC can check it is the right
 * recording, and a way back to the search. The area has one fixed height
 * in every state, so the surrounding modal never resizes.
 */
export function SpotifyTrackPicker({ value, onChange, onTypeInstead, autoFocus = true }: SpotifyTrackPickerProps) {
  const [query, setQuery] = useState('')
  const search = useSpotifySearch(value ? '' : query)

  if (value) {
    return (
      <div className="flex h-72 flex-col gap-3">
        <SpotifyEmbed trackId={value.id} title={value.title} />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="self-start text-body text-text-muted transition hover:text-text"
        >
          Choose a different song
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-72 flex-col gap-2">
      <Input
        label="Search Spotify"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Song, artist, or a Spotify link"
        autoComplete="off"
        autoFocus={autoFocus}
      />
      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <PickerBody query={query} search={search} onPick={onChange} />
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onTypeInstead}
          className="text-body text-text-muted transition hover:text-text"
        >
          Can&apos;t find it? Type it in
        </button>
        <span className="flex items-center gap-1.5 text-body text-text-subtle">
          <SiSpotify aria-hidden className="size-3.5" />
          Spotify
        </span>
      </div>
    </div>
  )
}

function PickerBody({
  query,
  search,
  onPick,
}: {
  query: string
  search: ReturnType<typeof useSpotifySearch>
  onPick: (track: SpotifyTrack) => void
}) {
  if (search.unavailable) {
    return <p className="py-2 text-body text-text-muted">Spotify search isn&apos;t available right now. Type the song in instead.</p>
  }
  if (search.tracks.length > 0) {
    return (
      <ul className="space-y-0.5">
        {search.tracks.map((t) => (
          <SpotifyTrackRow key={t.id} track={t} onPick={onPick} />
        ))}
      </ul>
    )
  }
  if (search.searching) return <Loading label="Searching Spotify" size={16} />
  if (search.searched) return <p className="py-2 text-body text-text-muted">No matches on Spotify.</p>
  if (query.trim().length === 0) {
    return <p className="py-2 text-body text-text-muted">Search by song or artist, or paste a Spotify link.</p>
  }
  return null
}
