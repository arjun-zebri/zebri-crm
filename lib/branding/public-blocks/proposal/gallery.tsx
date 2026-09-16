'use client'

import { useState, type ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import type { GalleryBlock, GalleryImage } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../../public-surface'
import { pad } from '../shared'

import { CarouselControls } from './carousel-controls'

/** Editor slots: a custom tile renderer, and trailing content (the "add photo" affordance). */
export interface GallerySlots {
  tile?: (image: GalleryImage, index: number) => ReactNode
  trailing?: ReactNode
}

function Tile({ image, branding, className, slots, index }: { image: GalleryImage; branding: PublicBranding; className: string; slots?: GallerySlots | undefined; index: number }) {
  return (
    <div className={className} style={{ borderRadius: branding.corner_radius }}>
      {slots?.tile?.(image, index) ?? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded gallery photo, no next/image
        <img src={image.url} alt={image.alt ?? ''} loading="lazy" className="block h-full w-full object-cover" />
      )}
    </div>
  )
}

/**
 * A photo gallery in grid, masonry, or carousel layout. Renders nothing on
 * an untouched block (no images, no editor slot) so a sent proposal never
 * shows an empty gallery section.
 */
export function RenderGallery({
  block,
  branding,
  slots,
}: {
  block: GalleryBlock
  branding: PublicBranding
  slots?: GallerySlots
}) {
  const [index, setIndex] = useState(0)
  if (block.images.length === 0 && !slots?.trailing) return null

  const p = pad(branding)

  if (block.layout === 'carousel') {
    const safeIndex = Math.min(index, Math.max(0, block.images.length - 1))
    const current = block.images[safeIndex]
    return (
      <div className={p.blockY}>
        {current && (
          <Tile image={current} branding={branding} index={safeIndex} slots={slots} className="aspect-[3/2] w-full overflow-hidden" />
        )}
        <CarouselControls
          branding={branding}
          index={safeIndex}
          count={block.images.length}
          noun="photo"
          onPrev={() => setIndex((i) => (i - 1 + block.images.length) % block.images.length)}
          onNext={() => setIndex((i) => (i + 1) % block.images.length)}
          onSelect={setIndex}
        />
        {slots?.trailing}
      </div>
    )
  }

  const isMasonry = block.layout === 'masonry'
  return (
    <div className={p.blockY}>
      <div className={isMasonry ? 'columns-2 gap-3 @md/doc:columns-3' : 'grid grid-cols-2 gap-3 @md/doc:grid-cols-3'}>
        {block.images.map((image, i) => (
          <Tile
            key={image.id}
            image={image}
            branding={branding}
            index={i}
            slots={slots}
            className={isMasonry ? 'mb-3 break-inside-avoid overflow-hidden' : 'aspect-[4/3] overflow-hidden'}
          />
        ))}
      </div>
      {slots?.trailing}
    </div>
  )
}
