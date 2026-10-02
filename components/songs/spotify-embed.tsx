import { spotifyEmbedUrl } from '@/lib/spotify/parse'

/** Props for {@link SpotifyEmbed}. */
export interface SpotifyEmbedProps {
  trackId: string
  /** Used for the iframe's accessible name, e.g. the song title. */
  title: string
}

/**
 * Spotify's official compact player for one track (80px tall).
 *
 * Plays the full song for a listener signed in to Spotify in this
 * browser and a short preview otherwise. Spotify styles the player
 * itself, so this renders the same on the branded portal and in the app.
 */
export function SpotifyEmbed({ trackId, title }: SpotifyEmbedProps) {
  return (
    <iframe
      title={`Play ${title} on Spotify`}
      src={spotifyEmbedUrl(trackId)}
      className="block h-20 w-full rounded-control border-0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  )
}
