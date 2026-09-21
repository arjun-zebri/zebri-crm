'use client'

/**
 * Gallery slot builder (Slice E2, UX audit 3.4): per-tile hover remove +
 * "reorder-lite" move-left/move-right controls (no drag), and a trailing
 * "Add photos" tile up to the 12-image cap - a big, inviting full-width
 * tile while the gallery is empty, a small one alongside the real photos
 * once it isn't (2026-09-18 feedback: "big image... say you can add as
 * many as you want"). Gallery's own layout setting moved into the
 * section's Style popover (`bars/section-style-popover.tsx`), matching
 * packages - there is no more Gallery toolbar button. No heading/text
 * fields on this block (2026-09-19 feedback: "remove the text from all
 * these sections... we can always add text sections around them" - a
 * heading or caption is its own text section stacked above/below, not
 * embedded here). An empty gallery still renders - just the trailing
 * tile - because the caller always supplies `trailing`, which is
 * `RenderGallery`'s own "show me even with zero images" gate
 * (`lib/branding/public-blocks/proposal/gallery.tsx`).
 *
 * @module features/proposals/editor/data/edit-gallery
 */
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { GallerySlots } from '@/lib/branding/public-blocks/proposal/gallery'

import type { GalleryData } from '../../model/layout'

import type { EditSlotArgs } from './edit-slot-args'
import { useMediaUpload } from './use-media-upload'

/** Gallery's own cap; mirrors the Branding editor's `MAX_IMAGES` (`app/(dashboard)/branding/blocks/proposal/gallery.tsx`) - this feature may not import that file, so the number is kept in step by eye rather than shared. */
const MAX_IMAGES = 12

/** New gallery image ids never repeat within a session; that's all a client-only key needs. */
function newImageId(): string {
  return `gi-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Builds the gallery block's `GallerySlots`: a `tile` with hover remove/move controls, and a `trailing` "Add photos" tile. */
export function gallerySlots({ sectionId, data, dispatch }: EditSlotArgs<GalleryData>): GallerySlots {
  const setImages = (images: GalleryData['images'], commit: boolean) => {
    dispatch({ type: 'setData', id: sectionId, data: { kind: 'gallery', gallery: { ...data, images } } }, { commit })
  }
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= data.images.length) return
    const next = [...data.images]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    setImages(next, true)
  }

  return {
    tile: (image, i) => (
      <div className="group/item relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of an uploaded gallery photo */}
        <img src={image.url} alt={image.alt ?? ''} className="block h-full w-full object-cover" />
        <button
          type="button"
          aria-label={`Remove photo ${i + 1}`}
          onClick={(e) => { e.stopPropagation(); setImages(data.images.filter((img) => img.id !== image.id), true) }}
          className="absolute right-1 top-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-control bg-surface/90 text-text-subtle opacity-0 transition hover:text-text focus-visible:opacity-100 group-hover/item:opacity-100"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
        <div className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover/item:opacity-100">
          {i > 0 ? (
            <button
              type="button"
              aria-label={`Move photo ${i + 1} left`}
              onClick={(e) => { e.stopPropagation(); move(i, -1) }}
              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-control bg-surface/90 text-text-subtle hover:text-text"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
          ) : null}
          {i < data.images.length - 1 ? (
            <button
              type="button"
              aria-label={`Move photo ${i + 1} right`}
              onClick={(e) => { e.stopPropagation(); move(i, 1) }}
              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-control bg-surface/90 text-text-subtle hover:text-text"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
      </div>
    ),
    trailing: <AddPhotosTile sectionId={sectionId} data={data} dispatch={dispatch} />,
  }
}

/** Props for {@link AddPhotosTile}. */
export interface AddPhotosTileProps {
  sectionId: string
  data: GalleryData
  dispatch: EditSlotArgs<GalleryData>['dispatch']
}

/**
 * The gallery's "Add photos" trailing tile: a big, inviting full-width
 * tile while there are no photos yet, a small one alongside the real
 * tiles once there are - up to {@link MAX_IMAGES}, past which it reads
 * "12 photos max" and stops opening the picker.
 */
export function AddPhotosTile({ sectionId, data, dispatch }: AddPhotosTileProps) {
  const { pick, input } = useMediaUpload()
  const atCap = data.images.length >= MAX_IMAGES
  const empty = data.images.length === 0
  // Matches `RenderGallery`'s own row-height rule (`lib/branding/public-blocks/proposal/gallery.tsx`):
  // a custom `tileHeight` wins over the layout's default aspect ratio, so this tile lines up with the real photos.
  const frameStyle = data.tileHeight ? { height: data.tileHeight } : undefined

  // `pick`'s completion callback fires whenever the OS file dialog and the
  // upload resolve, well after this render - reading the closed-over
  // `data` prop there re-bases the write on whatever it was when Add
  // photos was clicked, silently reverting any edit made to this section
  // in the meantime (remove/reorder a photo, a style change) once the
  // upload lands (2026-09-19 "flickers back to a previous state",
  // rare/intermittent - only shows up when an upload is slow enough to
  // race a second edit). A ref kept in step with every render reads the
  // *current* data at the moment the callback actually runs instead
  // (same pattern as `use-rehydrate-editor.ts`'s `contentRef`).
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  const addImages = () => {
    if (atCap) return
    pick('image', { multiple: true }, (urls) => {
      const current = dataRef.current
      // A pick can return more files than the remaining cap allows (the OS
      // dialog has no way to enforce it); trim rather than reject, so a
      // couple's photographer who selects 20 at once still gets the first
      // batch instead of an error.
      const remaining = MAX_IMAGES - current.images.length
      const images = [...current.images, ...urls.slice(0, remaining).map((url) => ({ id: newImageId(), url }))]
      dispatch({ type: 'setData', id: sectionId, data: { kind: 'gallery', gallery: { ...current, images } } }, { commit: true })
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={atCap}
        onClick={(e) => { e.stopPropagation(); addImages() }}
        aria-label={atCap ? '12 photos max' : 'Add photos'}
        style={frameStyle ?? (empty ? { aspectRatio: '16 / 6' } : data.layout === 'masonry' ? undefined : { aspectRatio: '4 / 3' })}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed border-border text-text-subtle transition ${
          atCap ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-border-strong hover:text-text'
        } ${empty ? 'col-span-full' : data.layout === 'masonry' ? 'mb-3 break-inside-avoid' : ''}`}
      >
        <ImagePlus size={empty ? 24 : 18} strokeWidth={1.5} />
        <span className="text-body">{atCap ? '12 photos max' : 'Add photos'}</span>
        {empty && !atCap ? <span className="text-body text-text-subtle">Add as many as you want</span> : null}
      </button>
      {input}
    </>
  )
}
