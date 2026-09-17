'use client'

/**
 * The section bar's Padding control: an icon button that opens a popover
 * holding a `Slider` and a `NumberStepper` over the same 0..240px range,
 * snapping to the three named stops (`SECTION_PADDING_PX`) within a small
 * tolerance so a drag near "cozy" lands exactly on "cozy" rather than one
 * pixel off it. Split out of `section-bar.tsx` to keep that file within
 * its line budget, mirroring `section-background.tsx`'s own split.
 *
 * @module features/proposals/editor/bars/section-padding
 */
import * as Popover from '@radix-ui/react-popover'
import { AlignVerticalSpaceAround } from 'lucide-react'
import { useState, type RefObject } from 'react'

import { NumberStepper, Slider } from '@/components/editor'
import { Tooltip } from '@/components/ui/tooltip'

import type { SectionPadding } from '../../model/layout'
import { SECTION_PADDING_PX } from '../../model/rich-doc-spec'

import { OverrideDot } from './override-dot'

/** Within this many px of a named stop, a drag snaps to that stop instead of the raw number. */
const SNAP_TOLERANCE_PX = 4

/** `padding`'s pixel value, resolving a named stop through `SECTION_PADDING_PX`. */
function paddingPx(padding: SectionPadding): number {
  return typeof padding === 'number' ? padding : SECTION_PADDING_PX[padding]
}

/** `px`, snapped to the nearest named stop within {@link SNAP_TOLERANCE_PX}, or `px` itself when none is close enough. */
function snapPadding(px: number): SectionPadding {
  for (const [name, stopPx] of Object.entries(SECTION_PADDING_PX) as [SectionPadding, number][]) {
    if (Math.abs(px - stopPx) <= SNAP_TOLERANCE_PX) return name
  }
  return px
}

/** Props for {@link SectionPaddingControl}. */
export interface SectionPaddingControlProps {
  padding: SectionPadding
  /** Dispatches the new padding; `commit: true` on release (slider pointer-up, or any stepper change, which has no separate release). */
  onChange: (padding: SectionPadding, opts?: { commit?: boolean }) => void
  baseline: SectionPadding
  boundsRef: RefObject<HTMLElement | null>
}

/** The Padding icon button and its snapping slider popover. */
export function SectionPaddingControl({ padding, onChange, baseline, boundsRef }: SectionPaddingControlProps) {
  const px = paddingPx(padding)
  const overridden = px !== paddingPx(baseline)
  // `boundsRef.current` is only read once the popover is about to open (an
  // event-handler context), never during render: `react-hooks/refs`
  // disallows reading a ref's `.current` as a plain render-phase JSX
  // attribute value, which is what passing it straight to `collisionBoundary`
  // below would be.
  const [bounds, setBounds] = useState<HTMLElement | null>(null)

  return (
    <Popover.Root onOpenChange={(open) => { if (open) setBounds(boundsRef.current) }}>
      <Tooltip label="Padding">
        <Popover.Trigger asChild>
          <span data-testid="padding-control" className="relative inline-flex">
            <button
              type="button"
              aria-label="Padding"
              className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted transition hover:bg-surface-emphasis hover:text-text"
            >
              <AlignVerticalSpaceAround size={14} strokeWidth={1.5} />
            </button>
            <OverrideDot active={overridden} />
          </span>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionBoundary={bounds}
          className="z-[60] w-[220px] animate-modal-in rounded-control border border-border bg-surface p-3 text-body shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-text-muted">Padding</span>
            <NumberStepper
              value={px}
              min={0}
              max={240}
              step={8}
              suffix="px"
              ariaLabel="Padding"
              onChange={(v) => onChange(snapPadding(v), { commit: true })}
            />
          </div>
          <Slider
            value={px}
            min={0}
            max={240}
            step={1}
            ariaLabel="Padding"
            onChange={(v) => onChange(snapPadding(v))}
            onCommit={(v) => onChange(snapPadding(v), { commit: true })}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
