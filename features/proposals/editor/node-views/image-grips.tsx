'use client'

/**
 * The image node view's four corner resize grips, all writing the same
 * `widthPct` (proportional: height follows width automatically, so a
 * corner grip needs no vertical axis of its own: it is an `axis="x"`
 * grip drawn as a corner dot). Just the four corners, no edge bars: the
 * founder found the six-handle version (two full-height side bars plus
 * corners) heavy and confusing on a tall image, and four dots is what
 * every other canvas tool shows. Split out of `image-view.tsx` to keep
 * both files near the ~120-line guideline.
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

// Each dot is centred on its corner (`-translate-*-1/2` off the edge it
// pins to) with the matching diagonal cursor; `invert` on the two left
// corners makes dragging away from the image grow it, as on the right.
const CORNERS = [
  { key: 'top-left', label: 'top-left corner', invert: true, className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' },
  { key: 'top-right', label: 'top-right corner', invert: false, className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
  { key: 'bottom-left', label: 'bottom-left corner', invert: true, className: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' },
  { key: 'bottom-right', label: 'bottom-right corner', invert: false, className: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' },
] as const

/** Props for {@link ImageGrips}. */
export interface ImageGripsProps {
  widthPct: number
  /** Layout px per percentage point of the column (`columnWidthPx / 100`). */
  scale: number
  onChange: (widthPct: number) => void
}

/** The image node view's four corner width grips, rendered only while the node is selected. */
export function ImageGrips({ widthPct, scale, onChange }: ImageGripsProps) {
  return (
    <NodeGrips>
      {CORNERS.map(({ key, label, invert, className }) => (
        <ResizeGrip
          key={key}
          shape="dot"
          axis="x" invert={invert} value={widthPct} min={20} max={100} scale={scale}
          snaps={WIDTH_SNAPS} tolerance={3} format={(v) => `${v}%`} onChange={onChange}
          ariaLabel={`Image size, ${label}`} className={className}
        />
      ))}
    </NodeGrips>
  )
}
