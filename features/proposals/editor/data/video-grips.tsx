'use client'

/**
 * The video media slot's four corner resize grips (2026-09-19 feedback:
 * "you should be able to resize just the video ... without resizing the
 * whole section padding. Dots on the corners"), all writing the block's
 * own `widthPx` - height follows automatically via the media box's
 * `aspect-video` CSS ratio, so a corner grip needs no vertical axis of
 * its own. Mirrors `node-views/image-grips.tsx`'s four-dot-only shape and
 * corner-cursor convention exactly (reusing its `NodeGrips` overlay),
 * just in px instead of column percent - a video's box has no intrinsic
 * size of its own to measure a column-relative scale against, unlike an
 * `<img>`.
 *
 * `onChange` fires on every pointer-move and `onCommit` once on mouse up;
 * the caller keeps the streamed value local and only dispatches the
 * committed one (`video-media-slot.tsx`'s module doc has why).
 *
 * @module features/proposals/editor/data/video-grips
 */
import { ResizeGrip } from '@/components/editor'
import type { Snap } from '@/components/editor'

import { NodeGrips } from '../node-views/node-grips'

export const MIN_VIDEO_WIDTH_PX = 240
export const MAX_VIDEO_WIDTH_PX = 1200
/** The width a first drag starts from when the video has never had one set - a typical embed width, since the media box's own natural (100%-of-column) width isn't measured here. */
export const DEFAULT_VIDEO_WIDTH_PX = 640

const WIDTH_SNAPS: Snap[] = [
  { value: 400, label: '400px' },
  { value: 640, label: '640px' },
  { value: 960, label: '960px' },
]

// Same four corners, same invert/cursor convention as `ImageGrips`.
const CORNERS = [
  { key: 'top-left', label: 'top-left corner', invert: true, className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' },
  { key: 'top-right', label: 'top-right corner', invert: false, className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
  { key: 'bottom-left', label: 'bottom-left corner', invert: true, className: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' },
  { key: 'bottom-right', label: 'bottom-right corner', invert: false, className: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' },
] as const

/** Props for {@link VideoGrips}. */
export interface VideoGripsProps {
  widthPx: number
  /** Upper bound for the drag: the content column's measured width when known, so the readout can never run past what the box can actually render at (`max-width: 100%` clamps it there anyway). Defaults to {@link MAX_VIDEO_WIDTH_PX}. */
  max?: number
  onChange: (widthPx: number) => void
  onCommit: (widthPx: number) => void
}

/** The video media slot's four corner width grips, rendered only while the media box is selected. */
export function VideoGrips({ widthPx, max = MAX_VIDEO_WIDTH_PX, onChange, onCommit }: VideoGripsProps) {
  return (
    <NodeGrips>
      {CORNERS.map(({ key, label, invert, className }) => (
        <ResizeGrip
          key={key}
          shape="dot"
          axis="x" invert={invert} value={widthPx} min={MIN_VIDEO_WIDTH_PX} max={max}
          snaps={WIDTH_SNAPS} tolerance={12} format={(v) => `${v}px`}
          onChange={onChange} onCommit={onCommit}
          ariaLabel={`Video size, ${label}`} className={className}
        />
      ))}
    </NodeGrips>
  )
}
