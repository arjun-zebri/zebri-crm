'use client'

/**
 * The image node view's six resize grips: two side edges plus four
 * corners, all writing the same `widthPct` (proportional: height follows
 * width automatically, so a corner grip needs no vertical axis of its
 * own: it is an `axis="x"` grip like the side ones, just repositioned).
 * Split out of `image-view.tsx` to keep both files near the ~120-line
 * guideline.
 *
 * @module features/proposals/editor/node-views/image-grips
 */
import { ResizeGrip } from '@/components/editor'
import type { Snap } from '@/components/editor'

import { NodeGrips } from './node-grips'

/** Widths the drag locks onto: quarter, third, half and full column width. */
const WIDTH_SNAPS: Snap[] = [
  { value: 25, label: '25%' },
  { value: 33, label: '33%' },
  { value: 50, label: '50%' },
  { value: 100, label: '100%' },
]

// Each corner overrides `ResizeGrip`'s axis="x" defaults (a full-height
// bar on the right edge) with a small fixed-height hit box pinned to one
// corner; `invert` on the two left corners matches the left edge grip
// (dragging toward the image's own edge grows it, not shrinks it).
const CORNERS = [
  { key: 'top-left', label: 'top-left corner', invert: true, className: '!top-0 !bottom-auto !left-0 !right-auto !h-3' },
  { key: 'top-right', label: 'top-right corner', invert: false, className: '!top-0 !bottom-auto !right-0 !left-auto !h-3' },
  { key: 'bottom-left', label: 'bottom-left corner', invert: true, className: '!bottom-0 !top-auto !left-0 !right-auto !h-3' },
  { key: 'bottom-right', label: 'bottom-right corner', invert: false, className: '!bottom-0 !top-auto !right-0 !left-auto !h-3' },
] as const

/** Props for {@link ImageGrips}. */
export interface ImageGripsProps {
  widthPct: number
  /** Layout px per percentage point of the column (`columnWidthPx / 100`). */
  scale: number
  onChange: (widthPct: number) => void
}

/** The image node view's side + corner width grips, rendered only while the node is selected. */
export function ImageGrips({ widthPct, scale, onChange }: ImageGripsProps) {
  return (
    <NodeGrips>
      <ResizeGrip
        axis="x" invert value={widthPct} min={20} max={100} scale={scale}
        snaps={WIDTH_SNAPS} tolerance={3} format={(v) => `${v}%`} onChange={onChange}
        ariaLabel="Image width, left edge" className="!inset-y-0 !left-0 !right-auto"
      />
      <ResizeGrip
        axis="x" value={widthPct} min={20} max={100} scale={scale}
        snaps={WIDTH_SNAPS} tolerance={3} format={(v) => `${v}%`} onChange={onChange}
        ariaLabel="Image width, right edge"
      />
      {CORNERS.map(({ key, label, invert, className }) => (
        <ResizeGrip
          key={key}
          axis="x" invert={invert} value={widthPct} min={20} max={100} scale={scale}
          snaps={WIDTH_SNAPS} tolerance={3} format={(v) => `${v}%`} onChange={onChange}
          ariaLabel={`Image size, ${label}`} className={className}
        />
      ))}
    </NodeGrips>
  )
}
