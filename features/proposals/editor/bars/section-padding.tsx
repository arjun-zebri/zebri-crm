'use client'

/**
 * The section Style popover's two Padding controls (vertical and
 * horizontal): each an icon button that opens a popover holding a
 * `Slider` and a `NumberStepper` over a 0..240px range, snapping to that
 * axis's named stops within a small tolerance so a drag near "cozy" lands
 * exactly on "cozy" rather than one pixel off it. One generic
 * `SectionSpacingControl` backs both rows (own stops, icon and label
 * each) so the two axes can never drift into two slightly different
 * controls. `SectionPaddingControl` / `SectionPaddingXControl` are the
 * two bindings the popover mounts: vertical stores a `SectionPadding`
 * (a stop name when it lands on one, matching the resize grip's
 * `pxToPadding`), horizontal a plain px number (`SectionStyle.paddingX`).
 * Split out of `section-bar.tsx` to keep that file within its line
 * budget, mirroring `section-background.tsx`'s own split.
 *
 * The trigger button's label renders the live value as text, which used
 * to give it no fixed width - every slider tick changed the text's
 * rendered width, which shifted the trigger (the popover's own Radix
 * anchor), which repositioned the still-open popover on every tick
 * (visible flicker, live-found 2026-09-19). `min-w` sized for the longest
 * label ("Compact") keeps the trigger's box constant regardless of value.
 *
 * @module features/proposals/editor/bars/section-padding
 */
import * as Popover from '@radix-ui/react-popover'
import { AlignHorizontalSpaceAround, AlignVerticalSpaceAround, type LucideIcon } from 'lucide-react'
import { useState, type RefObject } from 'react'

import { NumberStepper, Slider } from '@/components/editor'
import { Tooltip } from '@/components/ui/tooltip'

import type { SectionPadding } from '../../model/layout'
import { SECTION_PADDING_PX } from '../../model/rich-doc-spec'
import { SECTION_PADDING_X_PX } from '../../model/theme'
import { pxToPadding } from '../resize/section-resize-math'

/** Within this many px of a named stop, a drag snaps to that stop instead of the raw number. */
const SNAP_TOLERANCE_PX = 4

/** `px`, snapped to the nearest stop in `stops` within {@link SNAP_TOLERANCE_PX}, or `px` itself when none is close enough. */
function snapPx(px: number, stops: Record<string, number>): number {
  for (const stopPx of Object.values(stops)) {
    if (Math.abs(px - stopPx) <= SNAP_TOLERANCE_PX) return stopPx
  }
  return px
}

/** "Compact" / "Cozy" / "Roomy" when `px` sits on a stop of `stops`, else the pixel value. */
function spacingLabel(px: number, stops: Record<string, number>): string {
  const hit = Object.entries(stops).find(([, stopPx]) => stopPx === px)
  return hit ? hit[0].charAt(0).toUpperCase() + hit[0].slice(1) : `${px}px`
}

/** Props for {@link SectionSpacingControl}. */
export interface SectionSpacingControlProps {
  /** What this instance controls ("Vertical padding" / "Horizontal padding"): the trigger's tooltip and aria-label, the popover's heading, and the slider/stepper names. */
  label: string
  icon: LucideIcon
  /** Named stops this axis snaps to; each axis has its own set. */
  stops: Record<string, number>
  /** Current value in px. */
  px: number
  /** Dispatches the new px (already snapped); `commit: true` on release (slider pointer-up, or any stepper change, which has no separate release). */
  onChange: (px: number, opts?: { commit?: boolean }) => void
  boundsRef: RefObject<HTMLElement | null>
}

/** One axis's Padding icon button and its snapping slider popover. */
export function SectionSpacingControl({ label, icon: Icon, stops, px, onChange, boundsRef }: SectionSpacingControlProps) {
  // `boundsRef.current` is only read once the popover is about to open (an
  // event-handler context), never during render: `react-hooks/refs`
  // disallows reading a ref's `.current` as a plain render-phase JSX
  // attribute value, which is what passing it straight to `collisionBoundary`
  // below would be.
  const [bounds, setBounds] = useState<HTMLElement | null>(null)

  return (
    <Popover.Root onOpenChange={(open) => { if (open) setBounds(boundsRef.current) }}>
      <Tooltip side="top" label={label}>
        <Popover.Trigger asChild>
          <span data-testid="padding-control" className="relative inline-flex">
            <button
              type="button"
              aria-label={label}
              className="inline-flex h-8 min-w-[88px] items-center gap-1.5 rounded-control px-2 text-body text-text-muted transition hover:bg-surface-emphasis hover:text-text"
            >
              <Icon size={14} strokeWidth={1.5} />
              {/* The current value on the trigger itself: a bare icon in the
                  labelled Style popover read as "no control here" (audit pass 2). */}
              <span>{spacingLabel(px, stops)}</span>
            </button>
          </span>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionBoundary={bounds}
          // 248px, not the 220 the single Padding popover had: "Horizontal padding" plus the stepper wrapped the heading onto two lines at 220 (live check).
          className="z-[60] w-[248px] animate-modal-in rounded-control border border-border bg-surface p-3 text-body shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-text-muted">{label}</span>
            <NumberStepper
              value={px}
              min={0}
              max={240}
              step={8}
              suffix="px"
              ariaLabel={label}
              onChange={(v) => onChange(snapPx(v, stops), { commit: true })}
            />
          </div>
          <Slider
            value={px}
            min={0}
            max={240}
            step={1}
            ariaLabel={label}
            onChange={(v) => onChange(snapPx(v, stops))}
            onCommit={(v) => onChange(snapPx(v, stops), { commit: true })}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Props for {@link SectionPaddingControl}. */
export interface SectionPaddingControlProps {
  padding: SectionPadding
  /** Dispatches the new padding (a stop name when it lands on one); `commit` as in {@link SectionSpacingControlProps}. */
  onChange: (padding: SectionPadding, opts?: { commit?: boolean }) => void
  boundsRef: RefObject<HTMLElement | null>
}

/** The Vertical padding control: `SectionSpacingControl` over `SECTION_PADDING_PX`, storing a `SectionPadding`. */
export function SectionPaddingControl({ padding, onChange, boundsRef }: SectionPaddingControlProps) {
  const px = typeof padding === 'number' ? padding : SECTION_PADDING_PX[padding]
  return (
    <SectionSpacingControl
      label="Vertical padding"
      icon={AlignVerticalSpaceAround}
      stops={SECTION_PADDING_PX}
      px={px}
      onChange={(v, opts) => onChange(pxToPadding(v), opts)}
      boundsRef={boundsRef}
    />
  )
}

/** Props for {@link SectionPaddingXControl}. */
export interface SectionPaddingXControlProps {
  /** Current horizontal padding in px (the section's own, else the theme's: `effectivePaddingX`). */
  paddingX: number
  onChange: (paddingX: number, opts?: { commit?: boolean }) => void
  boundsRef: RefObject<HTMLElement | null>
}

/** The Horizontal padding control: `SectionSpacingControl` over `SECTION_PADDING_X_PX`, storing a px number. */
export function SectionPaddingXControl({ paddingX, onChange, boundsRef }: SectionPaddingXControlProps) {
  return (
    <SectionSpacingControl
      label="Horizontal padding"
      icon={AlignHorizontalSpaceAround}
      stops={SECTION_PADDING_X_PX}
      px={paddingX}
      onChange={onChange}
      boundsRef={boundsRef}
    />
  )
}
