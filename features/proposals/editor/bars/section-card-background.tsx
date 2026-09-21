'use client'

/**
 * A packages section's Card background control, split out of
 * `section-style-popover.tsx` to keep that file within its line budget
 * (mirrors `section-text-color.tsx`'s own split). Distinct from the
 * section's own "Section background" row (`SectionBackgroundControl`,
 * which paints behind the cards): this overrides each card's own surface,
 * normally `branding.surface_color` (2026-09-18 feedback: "you should
 * have section background and card background instead of just
 * background").
 *
 * No live brand default to preview against here (unlike
 * `SectionTextColorControl`'s `CONTENT_TEXT_COLOR`): `branding` is not
 * threaded down this toolbar chain, so the swatch/picker falls back to a
 * plain white starting point when no override is set yet - the swatch +
 * "Use brand surface" clear action already show that state without one.
 *
 * @module features/proposals/editor/bars/section-card-background
 */
import { X } from 'lucide-react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'

/** Fallback preview only, for when no override is set yet - the real default is `branding.surface_color`, not threaded down this chain. */
const CARD_BACKGROUND_FALLBACK = '#FFFFFF'

/** Props for {@link SectionCardBackgroundControl}. */
export interface SectionCardBackgroundControlProps {
  color: string | undefined
  /** `undefined` clears the override back to the brand's own surface colour ("Use brand surface"). */
  onChange: (color: string | undefined) => void
  swatches: readonly string[]
}

/** The Card background swatch and its "Use brand surface" clear action. */
export function SectionCardBackgroundControl({ color, onChange, swatches }: SectionCardBackgroundControlProps) {
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <Tooltip side="top" label="Card background">
        <ColorPopover
          value={color ?? CARD_BACKGROUND_FALLBACK}
          onChange={onChange}
          swatches={swatches}
          trigger={
            <button
              type="button"
              aria-label="Card background"
              className="inline-flex h-8 w-8 items-center justify-center rounded-control hover:bg-surface-emphasis"
            >
              <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background: color ?? CARD_BACKGROUND_FALLBACK }} />
            </button>
          }
        />
      </Tooltip>
      {color ? (
        <Tooltip side="top" label="Use brand surface">
          <button
            type="button"
            aria-label="Use brand surface"
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
