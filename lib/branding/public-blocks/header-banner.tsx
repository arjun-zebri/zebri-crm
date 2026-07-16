'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import type { HeaderBannerBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { HEADER_HEIGHTS } from './shared'

/**
 * Renders the header banner block with optional editor chrome.
 * On public surfaces, renders a single image at the top.
 * In the editor, chrome contains the InlineAsset overlay and ResizeHandle.
 */
export function RenderHeaderBanner({
  block,
  branding,
  chrome,
}: {
  block: HeaderBannerBlock
  branding: PublicBranding
  chrome?: ReactNode
}) {
  const url = branding.header_image_url
  if (!url) return null
  const heightPx = block.heightPx ?? HEADER_HEIGHTS[block.height ?? 'md']
  const fit = block.fit ?? 'cover'
  const imageX = block.imageX ?? 50
  const imageY = block.imageY ?? 50
  const imageScale = block.imageScale ?? 1
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: heightPx,
        borderTopLeftRadius: branding.corner_radius,
        borderTopRightRadius: branding.corner_radius,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="block w-full h-full"
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
