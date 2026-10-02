/**
 * Pure helpers for recognising Spotify track references typed or pasted
 * by a couple or MC into the song search field.
 *
 * @module lib/spotify/parse
 */

/** A Spotify base-62 track id is always exactly 22 characters. */
export const SPOTIFY_TRACK_ID_PATTERN = /^[A-Za-z0-9]{22}$/

/**
 * Pull the track id out of anything a person is likely to paste:
 * `https://open.spotify.com/track/<id>`, the localised
 * `https://open.spotify.com/intl-de/track/<id>?si=...` share link, an
 * embed URL, or a `spotify:track:<id>` URI.
 *
 * @param input - Raw text from the search field.
 * @returns The 22-character track id, or `null` when the text is not a
 *   track reference (plain search text, albums, playlists, other hosts).
 *
 * @example
 * parseSpotifyTrackRef('https://open.spotify.com/track/44AyOl4qVkzS48vBsbNXaC?si=x')
 * // => '44AyOl4qVkzS48vBsbNXaC'
 */
export function parseSpotifyTrackRef(input: string): string | null {
  const text = input.trim()

  const uri = /^spotify:track:([A-Za-z0-9]{22})$/.exec(text)
  if (uri) return uri[1] ?? null

  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.hostname !== 'open.spotify.com') return null

  // Path shapes: /track/<id>, /intl-xx/track/<id>, /embed/track/<id>.
  const segments = url.pathname.split('/').filter(Boolean)
  const trackIndex = segments.indexOf('track')
  if (trackIndex === -1) return null
  const id = segments[trackIndex + 1]
  return id && SPOTIFY_TRACK_ID_PATTERN.test(id) ? id : null
}

/**
 * Public page for a track, used for "Open in Spotify" links.
 *
 * @param trackId - A 22-character Spotify track id.
 */
export function spotifyTrackUrl(trackId: string): string {
  return `https://open.spotify.com/track/${trackId}`
}

/**
 * Official embed player URL for a track. The embed plays the full song
 * for a listener signed in to Spotify in that browser and a preview
 * otherwise, which is why we use it rather than raw audio previews
 * (Spotify stopped returning `preview_url` to new apps in 2024).
 *
 * @param trackId - A 22-character Spotify track id.
 */
export function spotifyEmbedUrl(trackId: string): string {
  return `https://open.spotify.com/embed/track/${trackId}`
}

/**
 * Format a track length for display, e.g. `3:02`.
 *
 * @param durationMs - Length in milliseconds.
 */
export function formatTrackDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
