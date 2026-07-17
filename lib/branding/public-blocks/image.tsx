'use client'

import type { ReactNode } from 'react'

// Type-only import (erased at runtime); block types live under the editor surface.
// eslint-disable-next-line no-restricted-imports
import type { ImageBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'

/**
 * Optional interaction props for the image element (editor-only).
 * When provided, these handlers enable pan/zoom control.
 * When absent, the image is static (public surfaces).
 */
export interface ImageInteraction {
  /** Container ref for attaching event listeners (e.g., wheel zoom) */
  ref?: React.RefObject<HTMLDivElement | null>
  /** Pan handler applied to the container div; fired on mouse down to start pan */
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void
  /** Whether the user is currently panning (used for cursor feedback) */
  panning?: boolean
}

/**
 * Renders an image block on public surfaces (proposal, invoice, contract, portal).
 * Applies pan/zoom positioning if configured.
 * In the editor, chrome contains the InlineAsset overlay and ResizeHandle.
 *
 * @param block Image block configuration
 * @param branding Public branding settings
 * @param chrome Optional editor chrome (upload overlay, resize handle, zoom display)
 * @param imageInteraction Optional interaction handlers for editor pan/zoom (no-ops when absent)
 */
export function RenderImage({
  block,
  branding,
  chrome,
  imageInteraction,
}: {
  block: ImageBlock
  branding: PublicBranding
  chrome?: ReactNode
  imageInteraction?: ImageInteraction
}) {
  if (!block.url) return null

  const heightPx = block.heightPx ?? 160
  const fit = block.fit ?? 'cover'
  const imageX = block.imageX ?? 50
  const imageY = block.imageY ?? 50
  const imageScale = block.imageScale ?? 1

  const cursorClass = imageInteraction ? (imageInteraction.panning ? 'cursor-grabbing' : 'cursor-grab') : ''

  return (
    <div
      ref={imageInteraction?.ref}
      className={`relative w-full max-w-full overflow-hidden ${cursorClass}`}
      style={{
        height: heightPx,
        borderRadius: branding.corner_radius,
      }}
      onMouseDown={imageInteraction?.onMouseDown}
    >
      {/* User-uploaded brand asset — no next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.url}
        alt=""
        draggable={false}
        className="block w-full h-full select-none"
        style={{
          objectFit: fit,
          objectPosition: `${imageX}% ${imageY}%`,
          transform: imageScale !== 1 ? `scale(${imageScale})` : undefined,
          transformOrigin: `${imageX}% ${imageY}%`,
        }}
      />
      {chrome}
    </div>
  )
}
