'use client'

import { Music, Pause, Play, Plus } from 'lucide-react'
import { useState } from 'react'

import { SongArtwork } from '@/components/songs/song-artwork'
import { SpotifyEmbed } from '@/components/songs/spotify-embed'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { formatTrackDuration } from '@/lib/spotify/parse'

import type { PortalSong } from './page'
import { roleText } from './song-styles'

/** Props for {@link SongCategoryGroup}. */
export interface SongCategoryGroupProps {
  category: { key: string; label: string; description: string | null }
  songs: PortalSong[]
  onAdd: () => void
  onEdit: (song: PortalSong) => void
  branding: PublicBranding
}

/**
 * One song category on the portal (e.g. First Dance): a heading with its
 * "Add song" action, then the songs as plain rows. Always open, so adding
 * a song is one tap from any category. A picked song plays inline in
 * Spotify's player; tapping the row edits it. The `avoid` category ("Do
 * Not Play") titles in the error colour so it is never read as a request.
 */
export function SongCategoryGroup({ category, songs, onAdd, onEdit, branding }: SongCategoryGroupProps) {
  const categorySongs = songs.filter((s) => s.category === category.key)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const muted = roleText(branding, 'finePrint')
  const radius = `${branding.corner_radius}px`
  const titleColor = category.key === 'avoid' ? STATUS_COLORS.error : roleText(branding, 'body').color

  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 style={roleText(branding, 'body', { color: titleColor, fontWeight: 500 })}>{category.label}</h3>
          {category.description && <p style={muted}>{category.description}</p>}
        </div>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add song to ${category.label}`}
          className="flex shrink-0 items-center gap-1 transition cursor-pointer hover:opacity-70"
          style={muted}
        >
          <Plus size={14} strokeWidth={1.5} />
          Add song
        </button>
      </div>

      {categorySongs.length === 0 ? (
        <p style={{ ...muted, opacity: 0.7 }}>No songs yet</p>
      ) : (
        <ul className="-mx-2">
          {categorySongs.map((s) => {
            const playing = playingId === s.id && s.spotify_track_id !== null
            const detail = [s.artist, s.duration_ms ? formatTrackDuration(s.duration_ms) : null, s.notes]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={s.id}>
                <div className="flex items-center gap-3 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onEdit(s)}
                    aria-label={`Edit ${s.title}`}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition cursor-pointer hover:opacity-80"
                  >
                    <SongArtwork
                      src={s.artwork_url}
                      className="size-10 shrink-0 object-cover"
                      style={{ borderRadius: radius }}
                      fallback={
                        <span
                          className="flex size-10 shrink-0 items-center justify-center"
                          style={{ borderRadius: radius, backgroundColor: `${branding.border_color}55` }}
                        >
                          <Music size={16} strokeWidth={1.5} style={{ color: muted.color }} />
                        </span>
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={roleText(branding, 'body')}>{s.title}</span>
                      {detail && <span className="block truncate" style={muted}>{detail}</span>}
                    </span>
                  </button>
                  {s.spotify_track_id && (
                    <button
                      type="button"
                      onClick={() => setPlayingId(playing ? null : s.id)}
                      aria-label={playing ? `Hide player for ${s.title}` : `Play ${s.title}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-pill transition cursor-pointer hover:opacity-70"
                      style={{ color: muted.color }}
                    >
                      {playing ? <Pause size={16} strokeWidth={1.5} /> : <Play size={16} strokeWidth={1.5} />}
                    </button>
                  )}
                </div>
                {playing && s.spotify_track_id && (
                  <div className="px-2 pb-2">
                    <SpotifyEmbed trackId={s.spotify_track_id} title={s.title} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
