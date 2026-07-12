'use client'

import type { ImageBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '../public-surface'

/**
 * Renders an image block on public surfaces (proposal, invoice, contract, portal).
 * Applies pan/zoom positioning if configured.
 */
export function RenderImage({
  block,
  branding,
}: {
  block: ImageBlock
  branding: PublicBranding
}) {
  if (!block.url) return null

  const heightPx = block.heightPx ?? 240
  const fit = block.fit ?? 'cover'
  const imageX = block.imageX ?? 50
  const imageY = block.imageY ?? 50
  const imageScale = block.imageScale ?? 1

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: heightPx,
        borderRadius: branding.corner_radius,
      }}
    >
      <img
        src={block.url}
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
