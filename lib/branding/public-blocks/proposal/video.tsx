'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { VideoBlock } from '@/app/(dashboard)/branding/blocks/types'
import { parseEmbedUrl } from '@/lib/proposals/embed-url'

import type { PublicBranding } from '../../public-surface'
import { richContentToPlainText, richTextHasContent } from '../../render-rich-text'
import { roleDefaults } from '../../type-defaults'
import { Rich } from '../rich'
import { pad } from '../shared'
import type { FrameMode } from '../shared'

import { EmbedFrame, VideoPlayer } from './media'

/** Editor slots that replace the static heading / media / caption with live inline editors. */
export interface VideoSlots {
  heading?: ReactNode
  media?: ReactNode
  caption?: ReactNode
}

/**
 * Whether this source has anything to show. An `embed` source with a URL
 * that fails `parseEmbedUrl` has nothing to render: the value is only ever
 * saved after validating it client-side, but a second, defensive check here
 * means a corrupted or hand-edited row can't embed an arbitrary origin.
 */
function hasPlayableSource(source: VideoBlock['source']): boolean {
  if (!source) return false
  return source.kind === 'upload' || parseEmbedUrl(source.url) !== null
}

/**
 * A single video section: an optional heading, an uploaded file or a
 * YouTube/Vimeo embed in a 16:9 box, and an optional caption underneath.
 * Both heading and caption are free-form multi-line text (2026-09-18),
 * not one-liners. Renders nothing on an untouched block (no source) so a
 * sent proposal never shows an empty box.
 */
export function RenderVideo({
  block,
  branding,
  frame,
  slots,
  chrome,
  variableValues,
}: {
  block: VideoBlock
  branding: PublicBranding
  frame: FrameMode
  slots?: VideoSlots
  chrome?: ReactNode
  variableValues?: Record<string, string>
}) {
  const hasMedia = !!slots?.media || hasPlayableSource(block.source)
  if (!hasMedia) return null

  const p = pad(branding)
  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))

  return (
    <div className={p.blockY}>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        // Same `<div>`-when-slotted split as the caption below: the heading
        // is multi-line editable text now, not a one-line title, so the
        // live `InlineField`'s own block-level `<p>` markup needs a `<div>`
        // to sit in, not a `<h2>` (invalid HTML). The unslotted path keeps
        // `<h2>` with `Rich`'s `inline` mode, which already flattens
        // multiple paragraphs to `<br>` for a heading-safe phrasing context.
        slots?.heading ? (
          <div className="m-0 mb-4" style={headingStyle}>{slots.heading}</div>
        ) : (
          <h2 className="m-0 mb-4" style={headingStyle}><Rich value={block.heading} values={variableValues} inline /></h2>
        )
      )}
      {/* `widthPx` resizes just the media box (2026-09-19 feedback: "resize
          just the video ... without resizing the whole section padding"),
          independent of the section's own width/padding controls.
          `max-width: 100%` keeps a wide value from overflowing a narrower
          column (a saved widthPx from a wider template/device). Unlike
          heading/caption, the slotted `media` is rendered bare: it sizes
          and clips its own box (`video-media-slot.tsx`'s module doc has
          why - a live drag has to drive the width from local state, and
          its corner grips must sit outside the `overflow-hidden` that
          rounds the video's corners), so this wrapper and box are the
          unslotted path only. */}
      {slots?.media ?? (
        <div style={block.widthPx ? { width: `${block.widthPx}px`, maxWidth: '100%', marginInline: 'var(--doc-box-margin, auto)' } : undefined}>
          <div className="relative aspect-video w-full overflow-hidden" style={{ borderRadius: block.cornerRadius ?? branding.corner_radius }}>
            {block.source?.kind === 'upload' ? (
              <VideoPlayer url={block.source.url} posterUrl={block.source.posterUrl} frame={frame} />
            ) : block.source?.kind === 'embed' ? (
              <EmbedFrame url={block.source.url} frame={frame} title={richContentToPlainText(block.caption) || 'Video'} />
            ) : null}
          </div>
        </div>
      )}
      {(richTextHasContent(block.caption) || slots?.caption) && (
        // A slotted caption (Slice E2's `InlineField`) renders a `<div>`
        // wrapper around TipTap's own block-level markup, which is invalid
        // inside a `<p>`; the unslotted path keeps `<p>`, matching every
        // other public-page paragraph.
        slots?.caption ? (
          <div className="m-0 mt-2" style={resolveTextStyle(block.captionStyle, { ...roleDefaults(branding, 'body'), color: branding.muted_color })}>
            {slots.caption}
          </div>
        ) : (
          <p className="m-0 mt-2" style={resolveTextStyle(block.captionStyle, { ...roleDefaults(branding, 'body'), color: branding.muted_color })}>
            <Rich value={block.caption} values={variableValues} inline />
          </p>
        )
      )}
      {chrome}
    </div>
  )
}
