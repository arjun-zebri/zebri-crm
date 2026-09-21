'use client'

/**
 * The selected section's height grip: a `ResizeGrip` pinned to the
 * section's bottom edge that drags `SectionStyle.padding`. Once the
 * section's measured rendered height (`heightPx`, tracked by
 * `SectionResizeOverlay`) passes one canvas viewport
 * (`FULL_HEIGHT_THRESHOLD_PX`), the readout swaps to "Full screen" and
 * releasing the drag promotes the section to `height: 'full'` instead of
 * committing a padding number - the same state the section bar's Height
 * pill sets (`section-style-pills.tsx`), just reached here by dragging
 * past the point a padding number stops describing what happened.
 *
 * @module features/proposals/editor/resize/section-height-grip
 */
import { ResizeGrip } from '@/components/editor'

import type { SectionPadding } from '../../model/layout'
import type { LayoutAction } from '../state'

import { FULL_HEIGHT_THRESHOLD_PX, PADDING_SNAPS, paddingToPx, pxToPadding } from './section-resize-math'

/** Props for {@link SectionHeightGrip}. */
export interface SectionHeightGripProps {
  sectionId: string
  padding: SectionPadding
  /** The section wrapper's live rendered height in px, 0 before `SectionResizeOverlay` has measured it. */
  heightPx: number
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
}

/** Bottom-edge grip dragging a section's vertical padding, or promoting it to a full-screen hero once the drag pushes it past the threshold. */
export function SectionHeightGrip({ sectionId, padding, heightPx, dispatch }: SectionHeightGripProps) {
  const overFull = heightPx > FULL_HEIGHT_THRESHOLD_PX

  return (
    <ResizeGrip
      axis="y"
      value={paddingToPx(padding)}
      min={0}
      max={240}
      // Past the full-screen threshold the padding stops are meaningless
      // (commit switches to `height: 'full'`), and a stop label would
      // otherwise outrank `format` in the readout and hide "Full screen".
      {...(overFull ? {} : { snaps: PADDING_SNAPS })}
      tolerance={6}
      format={(v) => (overFull ? 'Full screen' : `${v}px`)}
      onChange={(px) => dispatch({ type: 'updateStyle', id: sectionId, patch: { padding: pxToPadding(px) } })}
      onCommit={(px) =>
        dispatch(
          { type: 'updateStyle', id: sectionId, patch: overFull ? { height: 'full' } : { padding: pxToPadding(px) } },
          { commit: true },
        )
      }
      ariaLabel="Section height"
    />
  )
}
