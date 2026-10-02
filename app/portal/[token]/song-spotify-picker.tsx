'use client'

import { Music } from 'lucide-react'
import { useState } from 'react'

import { SongArtwork } from '@/components/songs/song-artwork'
import { SpotifyEmbed } from '@/components/songs/spotify-embed'
import { useSpotifySearch } from '@/components/songs/use-spotify-search'
import type { PublicBranding } from '@/lib/branding/public-surface'
import type { SpotifyTrack } from '@/lib/spotify/client'
import { formatTrackDuration } from '@/lib/spotify/parse'

import { fieldStyle, roleText } from './song-styles'

/** Props for {@link PortalSpotifyPicker}. */
export interface PortalSpotifyPickerProps {
  token: string
  value: SpotifyTrack | null
  onChange: (track: SpotifyTrack | null) => void
  onTypeInstead: () => void
  branding: PublicBranding
}

/**
 * The couple's Spotify search, in the MC's branding. Same behaviour as the
 * MC picker (`components/songs/spotify-track-picker.tsx`): search, pick,
 * hear it in the Spotify player, or type the song in instead. One fixed
 * height in every state so the modal never resizes.
 */
export function PortalSpotifyPicker({ token, value, onChange, onTypeInstead, branding }: PortalSpotifyPickerProps) {
  const [query, setQuery] = useState('')
  const search = useSpotifySearch(value ? '' : query, token)
  const muted = roleText(branding, 'finePrint')
  const linkClass = 'self-start transition cursor-pointer hover:opacity-75'

  if (value) {
    return (
      <div className="flex h-72 flex-col gap-3">
        <SpotifyEmbed trackId={value.id} title={value.title} />
        <button type="button" onClick={() => onChange(null)} className={linkClass} style={muted}>
          Choose a different song
        </button>
      </div>
    )
  }

  let body: React.ReactNode = null
  if (search.unavailable) body = <p style={muted}>Song search isn&apos;t available right now. Type the song in instead.</p>
  else if (search.tracks.length > 0) {
    body = (
      <ul className="space-y-0.5">
        {search.tracks.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onChange(t)}
              className="flex w-full items-center gap-3 px-2 py-1.5 text-left transition cursor-pointer hover:opacity-80"
              style={{ borderRadius: `${branding.corner_radius}px` }}
            >
              <SongArtwork
                src={t.artworkUrl}
                className="size-10 shrink-0 object-cover"
                style={{ borderRadius: `${branding.corner_radius}px` }}
                fallback={<Music size={16} strokeWidth={1.5} className="mx-3 shrink-0" style={{ color: muted.color }} />}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={roleText(branding, 'body')}>{t.title}</span>
                <span className="block truncate" style={muted}>
                  {t.artist} · {formatTrackDuration(t.durationMs)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  } else if (search.searching) body = <p style={muted}>Searching Spotify…</p>
  else if (search.searched) body = <p style={muted}>No matches on Spotify.</p>
  else if (query.trim().length === 0) body = <p style={muted}>Search by song or artist, or paste a Spotify link.</p>

  return (
    <div className="flex h-72 flex-col gap-2">
      <label className="block" style={muted} htmlFor="portal-song-search">Search Spotify</label>
      <input
        id="portal-song-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Song, artist, or a Spotify link"
        autoComplete="off"
        autoFocus
        style={fieldStyle(branding)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">{body}</div>
      <button type="button" onClick={onTypeInstead} className={linkClass} style={muted}>
        Can&apos;t find it? Type it in
      </button>
    </div>
  )
}
