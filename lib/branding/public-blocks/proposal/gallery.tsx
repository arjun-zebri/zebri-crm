'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'

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

function Tile({ image, branding, className, style, slots, index }: { image: GalleryImage; branding: PublicBranding; className: string; style?: CSSProperties | undefined; slots?: GallerySlots | undefined; index: number }) {
  return (
    <div className={className} style={{ borderRadius: branding.corner_radius, ...style }}>
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
 * shows an empty gallery section. No heading/caption fields here (2026-09-19
 * feedback: "remove the text from all these sections... we can always add
 * text sections around them") - a heading or caption belongs in its own
 * text section stacked above/below, not embedded in this block.
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
  // `tileHeight` set: every tile gets that fixed row height, width free to
  // vary with the grid column. Unset: the original fixed aspect ratio a
  // gallery saved before this field existed already renders with.
  const tileFrame = (defaultAspect: string): CSSProperties =>
    block.tileHeight ? { height: block.tileHeight } : { aspectRatio: defaultAspect }

  if (block.layout === 'carousel') {
    const safeIndex = Math.min(index, Math.max(0, block.images.length - 1))
    const current = block.images[safeIndex]
    return (
      // `data-gallery-frame`: the editor's height-resize handle
      // (`gallery-height-handle.tsx`) measures this exact box.
      <div className={p.blockY} data-gallery-frame>
        {current && (
          <Tile image={current} branding={branding} index={safeIndex} slots={slots} className="w-full overflow-hidden" style={tileFrame('3 / 2')} />
        )}
        {block.images.length > 0 && (
          <CarouselControls
            branding={branding}
            index={safeIndex}
            count={block.images.length}
            noun="photo"
            onPrev={() => setIndex((i) => (i - 1 + block.images.length) % block.images.length)}
            onNext={() => setIndex((i) => (i + 1) % block.images.length)}
            onSelect={setIndex}
            backgroundColor={block.carouselBackgroundColor}
            iconColor={block.carouselIconColor}
          />
        )}
        {slots?.trailing}
      </div>
    )
  }

  const isMasonry = block.layout === 'masonry'
  return (
    <div className={p.blockY} data-gallery-frame>
      <div
        // Grid: `auto-fit` fixed tracks + `justify-content` from the
        // section's alignment (`--doc-box-justify`), same reasoning as
        // packages.tsx's `gridCls`, so a partial last row parks where the
        // section says instead of always at the start. Masonry columns
        // have no partial row to park.
        className={isMasonry ? 'columns-2 gap-3 @md/doc:columns-3' : 'grid gap-3 grid-cols-[repeat(auto-fit,minmax(0,calc((100%-0.75rem)/2-0.02px)))] @md/doc:grid-cols-[repeat(auto-fit,minmax(0,calc((100%-1.5rem)/3-0.02px)))] [justify-content:var(--doc-box-justify,start)]'}
      >
        {block.images.map((image, i) => (
          <Tile
            key={image.id}
            image={image}
            branding={branding}
            index={i}
            slots={slots}
            className={isMasonry ? 'mb-3 break-inside-avoid overflow-hidden' : 'overflow-hidden'}
            style={isMasonry ? (block.tileHeight ? { height: block.tileHeight } : undefined) : tileFrame('4 / 3')}
          />
        ))}
        {slots?.trailing}
      </div>
    </div>
  )
}
