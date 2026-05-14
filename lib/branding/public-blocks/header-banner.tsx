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
  const heightPx = HEADER_HEIGHTS[block.height ?? 'md']
  const fit = block.fit ?? 'cover'
  const overlay = block.overlayColor
  const overlayOpacity = block.overlayOpacity ?? 0
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: heightPx,
        borderTopLeftRadius: branding.corner_radius,
        borderTopRightRadius: branding.corner_radius,
      }}
    >
      <img src={url} alt="" className="block w-full h-full" style={{ objectFit: fit }} />
      {overlay && overlayOpacity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: overlay, opacity: overlayOpacity / 100 }}
        />
      )}
    </div>
  )
}
