/**
 * Shared input shape for every `edit-*.tsx` slot builder (FAQ,
 * testimonials, accept, packages): the owning section id, its own slice
 * of `SectionData`, the layout dispatcher, the `externalVersion` counter
 * `InlineField` needs to know when to re-hydrate, and a focus callback
 * that selects the owning section (mirrors `ContentSectionEditor`'s
 * `onFocusSection` - see `InlineField`'s own `onFocus` doc for why a data
 * section needs this wired explicitly).
 *
 * @module features/proposals/editor/data/edit-slot-args
 */
import type { LayoutAction } from '../state'

/** Inputs every `edit-*.tsx` slot builder takes, parameterised by its own slice of `SectionData` (`FaqData`, `TestimonialsData`, ...). */
export interface EditSlotArgs<T> {
  sectionId: string
  data: T
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  externalVersion: number
  onFocus: () => void
}
