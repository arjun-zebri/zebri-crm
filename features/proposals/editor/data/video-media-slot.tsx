'use client'

/**
 * The video's `media` slot: an empty-state card, or the real player with
 * a Replace/Remove overlay and, once clicked, four corner resize grips
 * (`video-grips.tsx`) sizing just the media box's own `widthPx` - not the
 * section's width/padding (2026-09-19 feedback). Split out of
 * `edit-video.tsx` to keep both files near the ~150-line guideline, the
 * same reason `image-grips.tsx` split out of `image-view.tsx`.
 *
 * The box sizes ITSELF (`RenderVideo` applies `widthPx` only on its own
 * unslotted path, `video.tsx`), so a drag can resize it live from local
 * state: `liveWidthPx` is set on every pointer-move and drives the root's
 * inline `width`, re-rendering only this small subtree (the `<iframe>`
 * element is reconciled in place, never recreated), and the committed
 * value is dispatched once on mouse up. Dispatching on every move instead
 * re-rendered the whole section canvas - every TipTap editor plus the
 * live YouTube/Vimeo embed - at pointer-move frequency, the "extremely
 * slow" live bug; dispatching only on mouse up with nothing local in
 * between left the box frozen while the readout counted, the "px numbers
 * change but the size does not" live bug.
 *
 * The drag starts from the box's MEASURED width (a `ResizeObserver` on
 * the root and its parent, the content column), not a stored value: with
 * `widthPx` unset the box is the column's full width and a stored
 * fallback would make the first move jump to it; with a stored value
 * wider than the column, `max-width: 100%` clamps the box and a drag
 * would count for a while before anything visibly moved. The column
 * width also caps the drag for the same reason.
 *
 * The player sits in its own `overflow-hidden` box (rounded to
 * `branding.corner_radius`, matching the public page); the selection ring
 * and grips are a SIBLING of that box, not a descendant of it (a corner
 * dot straddles the box's edge by design, and the same `overflow-hidden`
 * that rounds the video's own corners was cropping the dot down to an
 * invisible sliver).
 *
 * Selection is local state, not the layout editor's global `selectNode`
 * (`editor/state.ts`): that type is a TipTap document position
 * (`NodeSelection`), meaningless for a video data section, which has no
 * TipTap editor behind it at all. A full-box overlay (`z-[5]`, below the
 * `z-10` Replace/Remove buttons and corner grips so those stay clickable)
 * sits over the player the whole time it is in the editor: unselected it
 * is the click-to-select target, selected it is a plain shield. Both are
 * there because an embed's `<iframe>` is cross-origin: a click inside it
 * never bubbles to this component, so without the overlay nothing could
 * select the video - and a `mousemove` inside it never reaches the
 * window listener `ResizeGrip` drags with, so without the shield a drag
 * that crossed into the player (every inward drag does, the dot straddles
 * the corner) stalled until the pointer came back out, the "sometimes
 * responds, sometimes really slow" live bug. The player is therefore
 * inert on the canvas; Preview is where it plays. Clicking anywhere
 * outside the box (a window `mousedown` listener, live only while
 * selected) deselects.
 *
 * @module features/proposals/editor/data/video-media-slot
 */
import { Video as VideoIcon, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { EmbedFrame, VideoPlayer } from '@/lib/branding/public-blocks/proposal/media'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { VideoData } from '../../model/layout'

import type { EditSlotArgs } from './edit-slot-args'
import { useMediaUpload } from './use-media-upload'
import { DEFAULT_VIDEO_WIDTH_PX, MAX_VIDEO_WIDTH_PX, MIN_VIDEO_WIDTH_PX, VideoGrips } from './video-grips'
import { VideoSourceModal } from './video-source-modal'

/** Props for {@link VideoMediaSlot}. */
export interface VideoMediaSlotProps {
  sectionId: string
  data: VideoData
  branding: PublicBranding
  dispatch: EditSlotArgs<VideoData>['dispatch']
  onFocus: () => void
}

/** Rendered widths (layout px) of the media box and the column it sits in; `0` until measured (first paint, or jsdom). */
interface Measured {
  box: number
  column: number
}

/** The video's `media` slot: an empty-state card, or the real player with a Replace/Remove overlay and corner resize grips once selected. */
export function VideoMediaSlot({ sectionId, data, branding, dispatch, onFocus }: VideoMediaSlotProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState(false)
  const [liveWidthPx, setLiveWidthPx] = useState<number | null>(null)
  const [measured, setMeasured] = useState<Measured>({ box: 0, column: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const { pick, input } = useMediaUpload()
  // `pick`'s completion callback (in `uploadVideo` below) fires once the OS
  // file dialog and the upload resolve, well after this render - reading
  // the closed-over `data` prop there re-bases the write on whatever it
  // was when Upload was clicked, silently reverting a width/rounding
  // change made to this section in the meantime once the upload lands
  // (2026-09-19 "flickers back to a previous state", rare/intermittent -
  // only shows up when an upload is slow enough to race a second edit).
  // Same fix as `edit-gallery.tsx`'s `AddPhotosTile`.
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      const next = { box: root.offsetWidth, column: root.parentElement?.clientWidth ?? 0 }
      setMeasured((prev) => (prev.box === next.box && prev.column === next.column ? prev : next))
    }
    measure()
    // jsdom (unit tests) has no `ResizeObserver`; the one-shot measurement
    // above still runs, just without staying live for a later resize.
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    if (root.parentElement) ro.observe(root.parentElement)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!selected) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setSelected(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [selected])

  const setSource = (source: VideoData['source']) => {
    dispatch({ type: 'setData', id: sectionId, data: { kind: 'video', video: { ...data, source } } }, { commit: true })
  }
  const commitWidth = (widthPx: number) => {
    // Dispatch before clearing the live value, so the box goes straight
    // from the streamed width to the identical committed one.
    dispatch({ type: 'setData', id: sectionId, data: { kind: 'video', video: { ...data, widthPx } } }, { commit: true })
    setLiveWidthPx(null)
  }
  const uploadVideo = () => {
    onFocus()
    pick('video', undefined, (urls) => {
      const url = urls[0]
      if (!url) return
      const current = dataRef.current
      dispatch({ type: 'setData', id: sectionId, data: { kind: 'video', video: { ...current, source: { kind: 'upload', url } } } }, { commit: true })
    })
  }

  const widthPx = liveWidthPx ?? data.widthPx
  const gripValue = liveWidthPx ?? (measured.box > 0 ? measured.box : (data.widthPx ?? DEFAULT_VIDEO_WIDTH_PX))
  const gripMax = measured.column > 0 ? Math.max(MIN_VIDEO_WIDTH_PX, Math.min(MAX_VIDEO_WIDTH_PX, measured.column)) : MAX_VIDEO_WIDTH_PX

  return (
    // `aspect-video` establishes this box's own height from its width;
    // `max-width: 100%` keeps a saved width from a wider column from
    // overflowing this one.
    <div
      ref={rootRef}
      className="group/media relative aspect-video"
      style={{ width: widthPx ? `${widthPx}px` : '100%', maxWidth: '100%', marginInline: 'var(--doc-box-margin, auto)' }}
    >
      <div className="h-full w-full overflow-hidden" style={{ borderRadius: data.cornerRadius ?? branding.corner_radius }}>
        {data.source?.kind === 'upload' ? (
          <VideoPlayer url={data.source.url} posterUrl={data.source.posterUrl} frame="page" />
        ) : data.source?.kind === 'embed' ? (
          <EmbedFrame url={data.source.url} frame="page" title="Video" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-border bg-surface-muted">
            <VideoIcon size={20} strokeWidth={1.5} className="text-text-subtle" />
            <span className="text-body text-text-muted">Add a video</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onFocus(); setModalOpen(true) }}
                className="h-8 cursor-pointer rounded-control bg-surface-emphasis px-3 text-body text-text hover:bg-surface"
              >
                Paste a link
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); uploadVideo() }} className="h-8 cursor-pointer rounded-control bg-surface-emphasis px-3 text-body text-text hover:bg-surface">
                Upload
              </button>
            </div>
          </div>
        )}
      </div>
      {data.source ? (
        <>
          {selected ? (
            <div data-video-shield aria-hidden className="absolute inset-0 z-[5]" />
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Select video"
              className="absolute inset-0 z-[5] cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onFocus(); setSelected(true) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(); setSelected(true) } }}
            />
          )}
          {selected && (
            <>
              <div className="pointer-events-none absolute inset-0 rounded-control ring-2 ring-brand-fg" />
              <VideoGrips widthPx={gripValue} max={gripMax} onChange={setLiveWidthPx} onCommit={commitWidth} />
            </>
          )}
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5 opacity-0 transition group-hover/media:opacity-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFocus(); setModalOpen(true) }}
              className="cursor-pointer rounded-control bg-surface/90 px-2 py-1 text-body text-text-muted hover:text-text"
            >
              Replace
            </button>
            <button
              type="button"
              aria-label="Remove video"
              onClick={(e) => { e.stopPropagation(); setSource(null) }}
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-control bg-surface/90 text-text-subtle hover:text-text"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        </>
      ) : null}
      <VideoSourceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitUrl={(url) => { setSource({ kind: 'embed', url }); setModalOpen(false) }}
        onUploadInstead={() => { setModalOpen(false); uploadVideo() }}
      />
      {input}
    </div>
  )
}
