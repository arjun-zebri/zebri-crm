/**
 * Pure conversions between a section's named style stops (padding, content
 * width) and the dragged px values the section's resize grips produce
 * (Task 12: `section-height-grip.tsx`, `section-width-handles.tsx`). Kept
 * DOM-free, like `components/editor/resize-math.ts`, so every conversion
 * is unit-testable without rendering anything.
 *
 * @module features/proposals/editor/resize/section-resize-math
 */
import type { Snap } from '@/components/editor'

import type { SectionPadding, SectionStyle } from '../../model/layout'
import { CONTENT_WIDTH_PX, SECTION_PADDING_PX } from '../../model/rich-doc-spec'

/** The padding stops the height grip's drag locks onto: compact, cozy, roomy. */
export const PADDING_SNAPS: readonly Snap[] = [
  { value: SECTION_PADDING_PX.compact, label: 'Compact' },
  { value: SECTION_PADDING_PX.cozy, label: 'Cozy' },
  { value: SECTION_PADDING_PX.roomy, label: 'Roomy' },
]

/** The content-width stops the side handles' drag locks onto: narrow, medium, wide. */
export const WIDTH_SNAPS: readonly Snap[] = [
  { value: CONTENT_WIDTH_PX.narrow, label: 'Narrow' },
  { value: CONTENT_WIDTH_PX.medium, label: 'Medium' },
  { value: CONTENT_WIDTH_PX.wide, label: 'Wide' },
]

/**
 * Dragging the section past this rendered height (layout px, one typical
 * canvas viewport) toggles it to `height: 'full'` on release instead of
 * committing a padding number: past this point the section already reads
 * as a full-screen opening, so the padding number stops being the thing
 * the drag is actually changing.
 */
export const FULL_HEIGHT_THRESHOLD_PX = 720

/** `padding`'s pixel value, resolving a named stop through `SECTION_PADDING_PX`; a dragged number passes through unchanged. */
export function paddingToPx(padding: SectionPadding): number {
  return typeof padding === 'number' ? padding : SECTION_PADDING_PX[padding]
}

/** `contentWidth`'s pixel value, resolving a named stop through `CONTENT_WIDTH_PX`; a dragged number passes through unchanged. */
export function widthToPx(width: NonNullable<SectionStyle['contentWidth']>): number {
  return typeof width === 'number' ? width : CONTENT_WIDTH_PX[width]
}

/** A px value that lands exactly on a padding stop is stored as the stop's name, otherwise as the number itself. */
export function pxToPadding(px: number): SectionPadding {
  const entries = Object.entries(SECTION_PADDING_PX) as ['compact' | 'cozy' | 'roomy', number][]
  const hit = entries.find(([, stopPx]) => stopPx === px)
  return hit ? hit[0] : px
}

/** A px value that lands exactly on a content-width stop is stored as the stop's name, otherwise as the number itself. */
export function pxToWidth(px: number): SectionStyle['contentWidth'] {
  const entries = Object.entries(CONTENT_WIDTH_PX) as ['narrow' | 'medium' | 'wide', number][]
  const hit = entries.find(([, stopPx]) => stopPx === px)
  return hit ? hit[0] : px
}
