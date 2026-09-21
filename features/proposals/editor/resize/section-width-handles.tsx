'use client'

/**
 * The selected section's content-column width handles: two `ResizeGrip`s
 * on the column's left and right edges, both writing the same
 * `SectionStyle.contentWidth` so either edge grows or shrinks the column
 * symmetrically around its centre. `scale: 0.5` is what makes that
 * symmetry work: the column is horizontally centred, so a screen-px of
 * drag on one edge only needs to move the *total* width by twice that for
 * the column to visually grow from both sides at once, and `ResizeGrip`'s
 * `scale` prop (layout px per unit of the dragged value) is exactly the
 * knob for that - halving it doubles the value's response to the same
 * drag distance.
 *
 * @module features/proposals/editor/resize/section-width-handles
 */
import { ResizeGrip } from '@/components/editor'

import type { SectionStyle } from '../../model/layout'
import { NodeGrips } from '../node-views/node-grips'
import type { LayoutAction } from '../state'

import { pxToWidth, widthToPx, WIDTH_SNAPS } from './section-resize-math'

/** The content column's measured box, relative to the section wrapper the handles are positioned against. */
export interface ColumnRect {
  left: number
  top: number
  width: number
  height: number
}

// Faded at rest: two solid black bars either side of the text column read
// as stray cursors (audit pass 2). Full strength on hover/focus/drag.
const GRIP_REST = 'opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100 data-[dragging=true]:opacity-100'

/** Props for {@link SectionWidthHandles}. */
export interface SectionWidthHandlesProps {
  sectionId: string
  /** The section's width resolved through the theme (`effectiveWidth`): a section that inherits still needs a number to drag from. */
  contentWidth: NonNullable<SectionStyle['contentWidth']>
  /** The measured column box from `SectionResizeOverlay`, or `null` before the first measurement (nothing renders yet). */
  rect: ColumnRect | null
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
}

/** Left and right edge grips on the content column, both dragging `contentWidth` symmetrically. */
export function SectionWidthHandles({ sectionId, contentWidth, rect, dispatch }: SectionWidthHandlesProps) {
  if (!rect) return null
  const value = widthToPx(contentWidth)
  const onChange = (px: number) => dispatch({ type: 'updateStyle', id: sectionId, patch: { contentWidth: pxToWidth(px) } })
  const onCommit = (px: number) => dispatch({ type: 'updateStyle', id: sectionId, patch: { contentWidth: pxToWidth(px) } }, { commit: true })

  return (
    <div className="pointer-events-none absolute" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
      <NodeGrips>
        <ResizeGrip
          axis="x" invert value={value} min={320} max={1400} scale={0.5}
          snaps={WIDTH_SNAPS} tolerance={16} format={(v) => `${v}px`} onChange={onChange} onCommit={onCommit}
          ariaLabel="Section width, left edge" className={`!inset-y-0 !left-0 !right-auto ${GRIP_REST}`}
        />
        <ResizeGrip
          axis="x" value={value} min={320} max={1400} scale={0.5}
          snaps={WIDTH_SNAPS} tolerance={16} format={(v) => `${v}px`} onChange={onChange} onCommit={onCommit}
          ariaLabel="Section width, right edge" className={GRIP_REST}
        />
      </NodeGrips>
    </div>
  )
}
