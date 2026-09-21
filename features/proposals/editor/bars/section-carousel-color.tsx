'use client'

/**
 * A gallery/packages section's carousel arrow + dot colour controls
 * (2026-09-19 feedback: "for carousel mode, you should be able to edit the
 * background colour of the dots and arrows and [icon] colour"), split out
 * of `section-style-popover.tsx` to keep that file within its line budget,
 * mirroring `section-card-background.tsx`'s own split. One generic swatch +
 * clear-to-default control, used twice (background, icon) since both rows
 * share the exact same shape and only their label/fallback/clear text
 * differ.
 *
 * No live brand default to preview against here (unlike
 * `SectionTextColorControl`'s `CONTENT_TEXT_COLOR`): `branding` is not
 * threaded down this toolbar chain, so an unset swatch falls back to a
 * plain placeholder colour - the swatch + clear action already show the
 * unset state without one. `CarouselControls` (the public renderer) is
 * what actually resolves the real default (`branding.brand_color` /
 * auto-contrast) at render time.
 *
 * @module features/proposals/editor/bars/section-carousel-color
 */
import { X } from 'lucide-react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'

/** Props for {@link CarouselColorControl}. */
export interface CarouselColorControlProps {
  /** Tooltip / aria-label for the swatch button. */
  label: string
  /** Tooltip / aria-label for the clear button. */
  clearLabel: string
  color: string | undefined
  /** `undefined` clears the override back to the resolved default. */
  onChange: (color: string | undefined) => void
  /** Preview colour shown while `color` is unset. */
  fallback: string
  swatches: readonly string[]
}

/** One carousel colour swatch (background or icon) and its clear-to-default action. */
export function CarouselColorControl({ label, clearLabel, color, onChange, fallback, swatches }: CarouselColorControlProps) {
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <Tooltip side="top" label={label}>
        <ColorPopover
          value={color ?? fallback}
          onChange={onChange}
          swatches={swatches}
          trigger={
            <button
              type="button"
              aria-label={label}
              className="inline-flex h-8 w-8 items-center justify-center rounded-control hover:bg-surface-emphasis"
            >
              <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background: color ?? fallback }} />
            </button>
          }
        />
      </Tooltip>
      {color ? (
        <Tooltip side="top" label={clearLabel}>
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => onChange(undefined)}
            className="ml-0.5 inline-flex h-8 w-5 items-center justify-center text-text-subtle hover:text-text"
          >
            <X size={11} strokeWidth={1.5} />
          </button>
        </Tooltip>
      ) : null}
    </span>
  )
}
