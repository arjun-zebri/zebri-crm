'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import type { HeaderBannerBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'

import { HEADER_HEIGHTS } from './shared'

/**
 * Optional interaction props for the header banner image (editor-only).
 * When provided, these handlers enable pan/zoom control.
 * When absent, the image is static (public surfaces).
 */
export interface HeaderBannerInteraction {
  /** Container ref for attaching event listeners (e.g., wheel zoom) */
  ref?: React.RefObject<HTMLDivElement | null>
  /** Pan handler applied to the container div; fired on mouse down to start pan */
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void
  /** Whether the user is currently panning (used for cursor feedback) */
  panning?: boolean
}

/**
 * Renders the header banner block with optional editor chrome.
 * On public surfaces, renders a single image at the top.
 * In the editor, chrome contains the InlineAsset overlay and ResizeHandle.
 *
 * @param block Header banner block configuration
 * @param branding Public branding settings
 * @param chrome Optional editor chrome (upload overlay, resize handle, zoom display)
 * @param imageInteraction Optional interaction handlers for editor pan/zoom (no-ops when absent)
 */
export function RenderHeaderBanner({
  block,
  branding,
  chrome,
  imageInteraction,
}: {
  block: HeaderBannerBlock
  branding: PublicBranding
  chrome?: ReactNode
  imageInteraction?: HeaderBannerInteraction
}) {
  const url = branding.header_image_url
  if (!url) return null
  const heightPx = block.heightPx ?? HEADER_HEIGHTS[block.height ?? 'md']
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
        borderTopLeftRadius: branding.corner_radius,
        borderTopRightRadius: branding.corner_radius,
      }}
      onMouseDown={imageInteraction?.onMouseDown}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
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
      {block.overlayColor && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: block.overlayColor,
            opacity: block.overlayOpacity ?? 0.5,
            pointerEvents: 'none',
          }}
        />
      )}
      {chrome}
    </div>
  )
}
