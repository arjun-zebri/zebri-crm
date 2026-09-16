import { describe, expect, it } from 'vitest'

import { embedIframeSrc, parseEmbedUrl } from '@/lib/proposals/embed-url'

describe('parseEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://vimeo.com/123456789', 'vimeo', '123456789'],
    ['https://player.vimeo.com/video/123456789?h=abc', 'vimeo', '123456789'],
    ['vimeo.com/channels/staffpicks/123456789', 'vimeo', '123456789'],
  ])('%s parses', (url, provider, id) => {
    expect(parseEmbedUrl(url)).toEqual({ provider, id })
  })

  it.each([
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'javascript:alert(1)',
    '',
    'https://vimeo.com/not-a-number',
  ])('%s is rejected', (url) => {
    expect(parseEmbedUrl(url)).toBeNull()
  })
})

describe('embedIframeSrc', () => {
  it('uses the privacy-enhanced hosts', () => {
    expect(embedIframeSrc({ provider: 'youtube', id: 'dQw4w9WgXcQ' })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1',
    )
    expect(embedIframeSrc({ provider: 'vimeo', id: '123456789' })).toBe(
      'https://player.vimeo.com/video/123456789?dnt=1',
    )
  })

  it('background mode autoplays muted, looped, without controls', () => {
    expect(embedIframeSrc({ provider: 'youtube', id: 'dQw4w9WgXcQ' }, { background: true })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=dQw4w9WgXcQ',
    )
    expect(embedIframeSrc({ provider: 'vimeo', id: '123456789' }, { background: true })).toBe(
      'https://player.vimeo.com/video/123456789?dnt=1&background=1&autoplay=1&muted=1&loop=1',
    )
  })
})
