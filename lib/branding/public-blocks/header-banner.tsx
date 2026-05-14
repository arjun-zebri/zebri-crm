'use client'

import type { HeaderBannerBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '../public-surface'
import { HEADER_HEIGHTS } from './shared'

export function RenderHeaderBanner({
  block,
  branding,
}: {
  block: HeaderBannerBlock
  branding: PublicBranding
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
    </div>
  )
}
