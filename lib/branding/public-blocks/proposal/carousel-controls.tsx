'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { getTextColor } from '../../contrast'
import type { PublicBranding } from '../../public-surface'

/**
 * Shared Previous/Next pill buttons + position dots for the gallery,
 * packages (mobile) and testimonials carousels. Pure UI: the caller owns
 * `index` state and passes the wrapped increment/decrement handlers, so
 * every caller stays in sync with its own item list without this
 * component knowing about any of their shapes. `noun` names the item
 * being paged for the accessible labels ("Next photo" vs "Next
 * testimonial") so callers don't share a mislabelled button name.
 *
 * `backgroundColor`/`iconColor` (2026-09-19 feedback: "for carousel mode,
 * you should be able to edit the background colour of the dots and
 * arrows and [icon] colour") override the brand-colour defaults below;
 * unset, they fall back to exactly the old behaviour.
 */
export function CarouselControls({
  branding,
  index,
  count,
  noun,
  onPrev,
  onNext,
  onSelect,
  backgroundColor,
  iconColor,
}: {
  branding: PublicBranding
  index: number
  count: number
  noun: string
  onPrev: () => void
  onNext: () => void
  onSelect: (index: number) => void
  /** Overrides the brand-colour background on the arrow buttons and the active dot. Explicitly `| undefined`: callers pass the block field straight through under `exactOptionalPropertyTypes`. */
  backgroundColor?: string | undefined
  /** Overrides the auto-contrasted icon colour on the arrow chevrons. Explicitly `| undefined`, same reason as {@link backgroundColor}. */
  iconColor?: string | undefined
}) {
  if (count <= 1) return null
  const background = backgroundColor ?? branding.brand_color
  // The background is often a mid-tone, not guaranteed dark or light
  // enough for white icons to read against; pick whichever of black/white
  // actually contrasts, same as the how-it-works step icons - against the
  // resolved background, so an overridden background still gets a legible
  // icon by default.
  const resolvedIconColor = iconColor ?? getTextColor(background)
  return (
    <div className="mt-3 flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label={`Previous ${noun}`}
        onClick={onPrev}
        className="flex h-8 w-8 items-center justify-center rounded-pill"
        style={{ background, color: resolvedIconColor }}
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
            style={{ background: i === index ? background : branding.border_color }}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label={`Next ${noun}`}
        onClick={onNext}
        className="flex h-8 w-8 items-center justify-center rounded-pill"
        style={{ background, color: resolvedIconColor }}
      >
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
