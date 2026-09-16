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

/** Editor slots that replace the static media / caption with live inline editors. */
export interface VideoSlots {
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
 * A single video section: an uploaded file or a YouTube/Vimeo embed in a
 * 16:9 box, with an optional caption underneath. Renders nothing on an
 * untouched block (no source) so a sent proposal never shows an empty box.
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

  return (
    <div className={p.blockY}>
      <div className="relative aspect-video w-full overflow-hidden" style={{ borderRadius: branding.corner_radius }}>
        {slots?.media ??
          (block.source?.kind === 'upload' ? (
            <VideoPlayer url={block.source.url} posterUrl={block.source.posterUrl} frame={frame} />
          ) : block.source?.kind === 'embed' ? (
            <EmbedFrame url={block.source.url} frame={frame} title={richContentToPlainText(block.caption) || 'Video'} />
          ) : null)}
      </div>
      {(richTextHasContent(block.caption) || slots?.caption) && (
        <p
          className="m-0 mt-2"
          style={resolveTextStyle(block.captionStyle, { ...roleDefaults(branding, 'body'), color: branding.muted_color })}
        >
          {slots?.caption ?? <Rich value={block.caption} values={variableValues} inline />}
        </p>
      )}
      {chrome}
    </div>
  )
}
