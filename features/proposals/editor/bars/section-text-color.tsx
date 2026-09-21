'use client'

/**
 * The section bar's Text colour control: a `ColorPopover` swatch plus a
 * "Use page colour" clear action, split out of `section-bar.tsx` to keep
 * that file within its line budget.
 *
 * No override dot here (unlike the other Style popover rows): a section
 * defaults to the page's text colour and only carries its own when one is
 * explicitly set, so the swatch + "Use page colour" X already show that
 * state without a separate indicator (2026-09-18 feedback).
 *
 * @module features/proposals/editor/bars/section-text-color
 */
import { X } from 'lucide-react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'

import { CONTENT_TEXT_COLOR } from '../../model/rich-doc-spec'

/** Props for {@link SectionTextColorControl}. */
export interface SectionTextColorControlProps {
  color: string | undefined
  /** `undefined` clears the section's own colour back to the page default ("Use page colour"). */
  onChange: (color: string | undefined) => void
  swatches: readonly string[]
}

/** The Text colour swatch and its "Use page colour" clear action. */
export function SectionTextColorControl({ color, onChange, swatches }: SectionTextColorControlProps) {
  return (
    <span data-testid="text-color-control" className="relative inline-flex shrink-0 items-center">
      <Tooltip side="top" label="Text colour">
        <ColorPopover
          value={color ?? CONTENT_TEXT_COLOR}
          onChange={onChange}
          swatches={swatches}
          trigger={
            <button
              type="button"
              aria-label="Text colour"
              className="inline-flex h-8 w-8 items-center justify-center rounded-control hover:bg-surface-emphasis"
            >
              <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background: color ?? CONTENT_TEXT_COLOR }} />
            </button>
          }
        />
      </Tooltip>
      {color ? (
        <Tooltip side="top" label="Use page colour">
          <button
            type="button"
            aria-label="Use page colour"
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
