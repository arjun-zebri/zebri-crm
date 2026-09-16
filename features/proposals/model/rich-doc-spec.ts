/**
 * The canonical rich-doc vocabulary (spec §2.2): node and mark names, the
 * embed provider allowlist, and the size limits. The editor schema
 * (Phase 2), the React renderer and the Zod validator all derive from this
 * file so a node cannot exist in one and not the others.
 *
 * @module features/proposals/model/rich-doc-spec
 */

/** Allowlisted node types for rich document content. */
export const NODE_TYPES = [
  'text', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote',
  'table', 'tableRow', 'tableCell', 'tableHeader', 'horizontalRule', 'hardBreak',
  'image', 'button', 'embed', 'audio', 'columns', 'column', 'spacer', 'variable',
] as const
/** Type union of all allowlisted node types. */
export type NodeType = (typeof NODE_TYPES)[number]

/** Allowlisted mark (inline formatting) types for rich document content. */
export const MARK_TYPES = ['bold', 'italic', 'underline', 'strike', 'link', 'textStyle', 'highlight', 'textCase'] as const
/** Type union of all allowlisted mark types. */
export type MarkType = (typeof MARK_TYPES)[number]

/** Allowlisted external embed providers. */
export type EmbedProvider = 'youtube' | 'vimeo' | 'spotify' | 'googleMaps' | 'instagram' | 'zebriScheduler'

/**
 * Hosts an `embed` node may point at. Matched on the URL's hostname only
 * (never a substring of the whole URL), so `evil.example/youtube.com` is
 * rejected. The scheduler entry is our own booking page.
 */
export const EMBED_PROVIDERS: ReadonlyArray<{ provider: EmbedProvider; hosts: readonly string[] }> = [
  { provider: 'youtube', hosts: ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'] },
  { provider: 'vimeo', hosts: ['vimeo.com', 'player.vimeo.com'] },
  { provider: 'spotify', hosts: ['open.spotify.com'] },
  { provider: 'googleMaps', hosts: ['www.google.com', 'maps.google.com', 'google.com'] },
  { provider: 'instagram', hosts: ['www.instagram.com', 'instagram.com'] },
  { provider: 'zebriScheduler', hosts: ['zebri.com.au', 'www.zebri.com.au', 'app.zebri.com.au', 'localhost'] },
]

/** The provider for a URL, or `null` when the host is not allowlisted or the URL is not http(s). */
export function detectEmbedProvider(url: string): EmbedProvider | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  const host = parsed.hostname.toLowerCase()
  for (const entry of EMBED_PROVIDERS) {
    if (entry.hosts.includes(host)) {
      // Google's host serves far more than maps; only the maps paths embed.
      if (entry.provider === 'googleMaps' && !parsed.pathname.startsWith('/maps')) return null
      return entry.provider
    }
  }
  return null
}

/** Size and count constraints for proposal layouts and documents. */
export const LAYOUT_LIMITS = {
  maxSections: 40,
  maxNodesPerDoc: 200,
  maxSerialisedBytes: 2 * 1024 * 1024,
} as const

/**
 * Named content-column widths in px, matching the `max-w-doc-narrow` /
 * `max-w-doc-prose` / `max-w-doc-page` tokens so the numbers and the
 * classes never disagree.
 */
export const CONTENT_WIDTH_PX = { narrow: 560, medium: 720, wide: 1100 } as const
/** Named vertical padding stops in px (compact / cozy / roomy). */
export const SECTION_PADDING_PX = { compact: 32, cozy: 48, roomy: 64 } as const
