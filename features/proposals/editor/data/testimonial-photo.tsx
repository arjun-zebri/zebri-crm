'use client'

/**
 * A testimonial item's portrait (Slice E2, UX audit 3.4): the round photo
 * the public `TestimonialCard`/`Card` renders when `imageUrl` is set, with
 * a hover Change/Remove; an empty one is a dashed circle "Add photo"
 * button. Extracted from `edit-testimonials.tsx` to keep that file under
 * the ~150-line budget.
 *
 * @module features/proposals/editor/data/testimonial-photo
 */
import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { TestimonialsData } from '../../model/layout'

import type { EditSlotArgs } from './edit-slot-args'
import { useMediaUpload } from './use-media-upload'

/** Props for {@link TestimonialPhoto}. */
export interface TestimonialPhotoProps {
  sectionId: string
  data: TestimonialsData
  itemId: string
  /** Not optional (`string | undefined`, not `?`): the caller always has an answer, even when it's "no photo yet" - see `SectionStyle.textColor`'s doc in `model/layout.ts` for why this shape plays nicer with `exactOptionalPropertyTypes` than a bare `?`. */
  imageUrl: string | undefined
  dispatch: EditSlotArgs<TestimonialsData>['dispatch']
  onFocus: () => void
}

/** One testimonial's photo, editable in place: an existing portrait gets a hover Change/Remove; an empty one is a dashed "Add photo" button. */
export function TestimonialPhoto({ sectionId, data, itemId, imageUrl, dispatch, onFocus }: TestimonialPhotoProps) {
  const { pick, input } = useMediaUpload()
  // `pick`'s completion callback (in `choose` below) fires once the OS file
  // dialog and the upload resolve, well after this render - reading the
  // closed-over `data` prop there re-bases the write on whatever it was
  // when Add/Change photo was clicked, silently reverting an edit made to
  // another item in this section in the meantime once the upload lands
  // (2026-09-19 "flickers back to a previous state", rare/intermittent -
  // only shows up when an upload is slow enough to race a second edit).
  // Same fix as `edit-gallery.tsx`'s `AddPhotosTile`.
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  const commitItems = (items: TestimonialsData['items']) => {
    dispatch({ type: 'setData', id: sectionId, data: { kind: 'testimonials', testimonials: { ...data, items } } }, { commit: true })
  }
  const removePhoto = () => {
    commitItems(data.items.map((it) => {
      if (it.id !== itemId) return it
      // Dropping the key rather than assigning `imageUrl: undefined`:
      // `TestimonialItem.imageUrl` is a plain `?: string`, and an explicit
      // `undefined` there is a distinct (and stricter-mode-hostile) value
      // from the key being absent.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the destructure itself is how the key is dropped
      const { imageUrl: _drop, ...rest } = it
      return rest
    }))
  }
  const choose = () => {
    onFocus()
    pick('image', undefined, (urls) => {
      const url = urls[0]
      if (!url) return
      const current = dataRef.current
      dispatch(
        { type: 'setData', id: sectionId, data: { kind: 'testimonials', testimonials: { ...current, items: current.items.map((it) => (it.id === itemId ? { ...it, imageUrl: url } : it)) } } },
        { commit: true },
      )
    })
  }

  if (!imageUrl) {
    return (
      <>
        <button
          type="button"
          aria-label="Add photo"
          onClick={(e) => { e.stopPropagation(); choose() }}
          className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill border-2 border-dashed border-border text-text-subtle hover:border-border-strong hover:text-text"
        >
          <ImagePlus size={14} strokeWidth={1.5} />
        </button>
        {input}
      </>
    )
  }

  return (
    <div className="group/photo relative h-10 w-10 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of an uploaded testimonial portrait */}
      <img src={imageUrl} alt="" className="h-10 w-10 rounded-pill object-cover" />
      <div className="absolute inset-0 flex items-center justify-center gap-0.5 rounded-pill bg-black/50 opacity-0 transition group-hover/photo:opacity-100">
        <button
          type="button"
          aria-label="Change photo"
          onClick={(e) => { e.stopPropagation(); choose() }}
          className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-control text-white hover:bg-white/20"
        >
          <ImagePlus size={12} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Remove photo"
          onClick={(e) => { e.stopPropagation(); removePhoto() }}
          className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-control text-white hover:bg-white/20"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>
      {input}
    </div>
  )
}
