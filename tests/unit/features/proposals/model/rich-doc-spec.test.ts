/**
 * The rich-doc spec is the single list every other part of the feature
 * derives from (editor schema, renderer, validator). These tests pin the
 * embed allowlist and the size limits from spec §2.
 *
 * @module tests/unit/features/proposals/model/rich-doc-spec
 */
import { describe, expect, it } from 'vitest'

import {
  CONTENT_WIDTH_PX,
  detectEmbedProvider,
  LAYOUT_LIMITS,
  MARK_TYPES,
  NODE_TYPES,
  SECTION_PADDING_PX,
} from '@/features/proposals'

describe('rich-doc spec', () => {
  it('lists every node and mark from the spec, once', () => {
    expect([...NODE_TYPES].sort()).toEqual([
      'audio', 'blockquote', 'bulletList', 'button', 'column', 'columns', 'embed', 'hardBreak', 'heading',
      'horizontalRule', 'image', 'listItem', 'orderedList', 'paragraph', 'spacer', 'table', 'tableCell',
      'tableHeader', 'tableRow', 'text', 'variable',
    ])
    expect([...MARK_TYPES].sort()).toEqual(['bold', 'highlight', 'italic', 'link', 'strike', 'textCase', 'textStyle', 'underline'])
  })

  it('detects allowlisted embed providers by host and rejects everything else', () => {
    expect(detectEmbedProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectEmbedProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
    expect(detectEmbedProvider('https://vimeo.com/123456789')).toBe('vimeo')
    expect(detectEmbedProvider('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe('spotify')
    expect(detectEmbedProvider('https://www.google.com/maps/embed?pb=!1m18')).toBe('googleMaps')
    expect(detectEmbedProvider('https://www.instagram.com/p/C1234567890/')).toBe('instagram')
    expect(detectEmbedProvider('https://zebri.com.au/book/sam-mc')).toBe('zebriScheduler')
    expect(detectEmbedProvider('https://evil.example/youtube.com')).toBeNull()
    expect(detectEmbedProvider('javascript:alert(1)')).toBeNull()
    expect(detectEmbedProvider('not a url')).toBeNull()
  })

  it('pins the limits and the width / padding stops from the spec', () => {
    expect(LAYOUT_LIMITS).toEqual({ maxSections: 40, maxNodesPerDoc: 200, maxSerialisedBytes: 2 * 1024 * 1024 })
    expect(CONTENT_WIDTH_PX).toEqual({ narrow: 560, medium: 720, wide: 1100 })
    expect(SECTION_PADDING_PX).toEqual({ compact: 32, cozy: 48, roomy: 64 })
  })
})
