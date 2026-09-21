/**
 * Embed URLs become provider player URLs (privacy-preserving where the
 * provider offers one) and never an arbitrary iframe src.
 *
 * @module tests/unit/features/proposals/render/embed-src
 */
import { describe, expect, it } from 'vitest'

import { embedSrc } from '@/features/proposals'

describe('embedSrc', () => {
  it('maps each allowlisted provider to its player URL', () => {
    expect(embedSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ provider: 'youtube', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })
    expect(embedSrc('https://vimeo.com/123456789')).toEqual({ provider: 'vimeo', src: 'https://player.vimeo.com/video/123456789?dnt=1' })
    expect(embedSrc('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toEqual({ provider: 'spotify', src: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M' })
    expect(embedSrc('https://www.google.com/maps/embed?pb=!1m18')).toEqual({ provider: 'googleMaps', src: 'https://www.google.com/maps/embed?pb=!1m18' })
    expect(embedSrc('https://www.instagram.com/p/C1234567890/')).toEqual({ provider: 'instagram', src: 'https://www.instagram.com/p/C1234567890/embed' })
    expect(embedSrc('https://zebri.com.au/book/sam-mc')).toEqual({ provider: 'zebriScheduler', src: 'https://zebri.com.au/book/sam-mc' })
  })
  it('returns null for a non-allowlisted or malformed URL', () => {
    expect(embedSrc('https://evil.example/embed')).toBeNull()
    expect(embedSrc('https://www.google.com/search?q=maps')).toBeNull()
    expect(embedSrc('nope')).toBeNull()
  })
})
