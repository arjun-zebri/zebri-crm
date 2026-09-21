'use client'

/**
 * A selected gallery section's own height grip: a bottom-edge `ResizeGrip`
 * dragging `GalleryData.tileHeight` - every tile's row height (2026-09-18
 * feedback: "this should be resizeable images"). `tileHeight` unset keeps
 * the layout's original fixed aspect ratio
 * (`lib/branding/public-blocks/proposal/gallery.tsx`); the first drag
 * commits an explicit px value. Positioned against the gallery's own
 * rendered box (`[data-gallery-frame]`, measured by `SectionResizeOverlay`
 * into `galleryRect`) rather than the section's content column
 * (`ColumnRect`/`columnRect`): the column often renders taller than its
 * content (it vertically centres via `justify-center`), which would drop
 * this grip somewhere past the visible photos, overlapping the
 * between-sections "+" button instead of sitting where the photos
 * actually end.
 *
 * @module features/proposals/editor/resize/gallery-height-handle
 */
import { ResizeGrip } from '@/components/editor'

import type { GalleryData } from '../../model/layout'
import type { LayoutAction } from '../state'

import type { ColumnRect } from './section-width-handles'

const MIN_TILE_HEIGHT = 100
const MAX_TILE_HEIGHT = 600
/** The row height a first drag starts from when the gallery has never had one set - roughly today's default 4:3 tile at the canvas's usual column width. */
const DEFAULT_TILE_HEIGHT = 280

/** Props for {@link GalleryHeightHandle}. */
export interface GalleryHeightHandleProps {
  sectionId: string
  data: GalleryData
  /** The measured `[data-gallery-frame]` box from `SectionResizeOverlay` (`galleryRect`), or `null` before the first measurement (nothing renders yet). */
  rect: ColumnRect | null
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
}

/** Bottom-edge grip on the gallery's own rendered content, dragging every tile's row height. */
export function GalleryHeightHandle({ sectionId, data, rect, dispatch }: GalleryHeightHandleProps) {
  if (!rect) return null
  const value = data.tileHeight ?? DEFAULT_TILE_HEIGHT
  const setHeight = (tileHeight: number, opts?: { commit?: boolean }) =>
    dispatch({ type: 'setData', id: sectionId, data: { kind: 'gallery', gallery: { ...data, tileHeight } } }, opts)

  return (
    <div className="pointer-events-none absolute" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
      <ResizeGrip
        axis="y"
        value={value}
        min={MIN_TILE_HEIGHT}
        max={MAX_TILE_HEIGHT}
        tolerance={6}
        format={(v) => `${v}px`}
        onChange={(px) => setHeight(px)}
        onCommit={(px) => setHeight(px, { commit: true })}
        ariaLabel="Gallery photo height"
        className="pointer-events-auto opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100 data-[dragging=true]:opacity-100"
      />
    </div>
  )
}
