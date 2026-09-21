/**
 * Turns an allowlisted embed URL into the provider's player URL (spec §6,
 * §10). YouTube and Vimeo reuse `parseEmbedUrl` so the privacy variants
 * (`youtube-nocookie`, `dnt=1`) stay in one place.
 *
 * @module features/proposals/render/embed-src
 */
import { parseEmbedUrl } from '@/lib/proposals/embed-url'

import { detectEmbedProvider, type EmbedProvider } from '../model/rich-doc-spec'

/**
 * Resolve an embed node's URL to its provider and iframe `src`, or `null`
 * when the URL is not on the allowlist or the provider cannot parse it.
 */
export function embedSrc(url: string): { provider: EmbedProvider; src: string } | null {
  const provider = detectEmbedProvider(url)
  if (!provider) return null
  switch (provider) {
    case 'youtube': {
      const parsed = parseEmbedUrl(url)
      return parsed ? { provider, src: `https://www.youtube-nocookie.com/embed/${parsed.id}` } : null
    }
    case 'vimeo': {
      const parsed = parseEmbedUrl(url)
      return parsed ? { provider, src: `https://player.vimeo.com/video/${parsed.id}?dnt=1` } : null
    }
    case 'spotify': {
      // open.spotify.com/{type}/{id} -> open.spotify.com/embed/{type}/{id}
      const path = new URL(url).pathname.replace(/^\/embed(?=\/)/, '')
      // Only a track/album/playlist/... path embeds; a profile, search or
      // home URL is not a playable Spotify object.
      return /^\/(track|album|playlist|episode|show|artist)\/[A-Za-z0-9]+/.test(path)
        ? { provider, src: `https://open.spotify.com/embed${path}` }
        : null
    }
    case 'googleMaps': {
      const u = new URL(url)
      // Only the embed endpoint renders in an iframe; a plain /maps link does not.
      return u.pathname.startsWith('/maps/embed') ? { provider, src: u.toString() } : null
    }
    case 'instagram': {
      const m = new URL(url).pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)\/?/)
      return m ? { provider, src: `https://www.instagram.com/${m[1]}/${m[2]}/embed` } : null
    }
    case 'zebriScheduler':
      return { provider, src: new URL(url).toString() }
  }
}
