'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { getTextColor } from '../../contrast'
import type { PublicBranding } from '../../public-surface'

/**
 * Shared Previous/Next pill buttons + position dots for the gallery and
 * testimonials carousels. Pure UI: the caller owns `index` state and passes
 * the wrapped increment/decrement handlers, so both blocks stay in sync with
 * their own item list without this component knowing about either shape.
 * `noun` names the item being paged for the accessible labels ("Next
 * photo" vs "Next testimonial") so the two callers don't share a mislabelled
 * button name.
 */
export function CarouselControls({
  branding,
  index,
  count,
  noun,
  onPrev,
  onNext,
  onSelect,
}: {
  branding: PublicBranding
  index: number
  count: number
  noun: string
  onPrev: () => void
  onNext: () => void
  onSelect: (index: number) => void
}) {
  if (count <= 1) return null
  // The brand colour is often a mid-tone, not guaranteed dark or light
  // enough for white icons to read against; pick whichever of black/white
  // actually contrasts, same as the how-it-works step icons.
  const iconColor = getTextColor(branding.brand_color)
  return (
    <div className="mt-3 flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label={`Previous ${noun}`}
        onClick={onPrev}
        className="flex h-8 w-8 items-center justify-center rounded-pill"
        style={{ background: branding.brand_color, color: iconColor }}
      >
        <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to ${noun} ${i + 1}`}
            onClick={() => onSelect(i)}
            className="h-1.5 w-1.5 rounded-pill"
            style={{ background: i === index ? branding.brand_color : branding.border_color }}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label={`Next ${noun}`}
        onClick={onNext}
        className="flex h-8 w-8 items-center justify-center rounded-pill"
        style={{ background: branding.brand_color, color: iconColor }}
      >
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
