'use client'

/**
 * The section bar's Text colour control: a `ColorPopover` swatch plus a
 * "Use page colour" clear action, split out of `section-bar.tsx` to keep
 * that file within its line budget.
 *
 * @module features/proposals/editor/bars/section-text-color
 */
import { X } from 'lucide-react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'

import { ControlDot } from './override-dot'

/** Props for {@link SectionTextColorControl}. */
export interface SectionTextColorControlProps {
  color: string | undefined
  /** The section kind's starting text colour, for the override dot. */
  baseline: string | undefined
  /** `undefined` clears the section's own colour back to the page default ("Use page colour"). */
  onChange: (color: string | undefined) => void
  swatches: readonly string[]
}

/** The Text colour swatch and its "Use page colour" clear action. */
export function SectionTextColorControl({ color, baseline, onChange, swatches }: SectionTextColorControlProps) {
  const active = Boolean(color) && color !== baseline

  return (
    <ControlDot testId="text-color-control" active={active}>
      <Tooltip label="Text colour">
        <ColorPopover
          value={color ?? '#111827'}
          onChange={onChange}
          swatches={swatches}
          trigger={
            <button
              type="button"
              aria-label="Text colour"
              className="inline-flex h-8 w-8 items-center justify-center rounded-control hover:bg-surface-emphasis"
            >
              <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background: color ?? '#111827' }} />
            </button>
          }
        />
      </Tooltip>
      {color ? (
        <Tooltip label="Use page colour">
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
    </ControlDot>
  )
}
