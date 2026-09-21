'use client'

/**
 * Video slot builder (Slice E2, UX audit 3.4): the `media` slot
 * (`video-media-slot.tsx`, split out to keep this file near the
 * ~150-line guideline) always renders something - an empty-state card
 * with "Paste a link"/"Upload", or the real player, resizable once
 * clicked (`video-grips.tsx`) - so `RenderVideo`'s "no source, no `media`
 * slot -> render nothing" branch (`lib/branding/public-blocks/proposal/video.tsx`)
 * never leaves an empty video section invisible on the canvas. No heading
 * or caption field (2026-09-19 feedback: "remove the text from all these
 * sections... we can always add text sections around them") - a heading
 * or description is its own text section stacked above/below, not
 * embedded here; the section is the media box alone.
 *
 * @module features/proposals/editor/data/edit-video
 */
import type { VideoSlots } from '@/lib/branding/public-blocks/proposal/video'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { VideoData } from '../../model/layout'

import type { EditSlotArgs } from './edit-slot-args'
import { VideoMediaSlot } from './video-media-slot'

/** Builds the video block's `VideoSlots`: an always-present `media` slot. */
export function videoSlots({
  sectionId, data, dispatch, onFocus, branding,
}: EditSlotArgs<VideoData> & { branding: PublicBranding }): VideoSlots {
  return {
    media: <VideoMediaSlot sectionId={sectionId} data={data} branding={branding} dispatch={dispatch} onFocus={onFocus} />,
  }
}
