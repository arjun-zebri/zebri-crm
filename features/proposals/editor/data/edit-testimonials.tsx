'use client'

/**
 * Testimonials slot builder (Slice E1, UX audit 3.4): per item, editable
 * quote/names/detail text with a hover remove control, inside the same
 * `TestimonialCard` frame the public page uses. `AddTestimonialItem` (the
 * `DataSectionSlots.after` node) appends a blank item after the list, with
 * no cap - matching the Branding editor's own testimonials block. Portrait
 * upload (Slice E2) is `testimonial-photo.tsx`, extracted to keep this
 * file under the ~150-line budget. No heading or text-below field
 * (2026-09-19 feedback: "remove the text from all these sections... we can
 * always add text sections around them") - either is its own text section
 * stacked above/below, not embedded here.
 *
 * @module features/proposals/editor/data/edit-testimonials
 */
import { Plus, X } from 'lucide-react'

import { TestimonialCard, type TestimonialsSlots } from '@/lib/branding/public-blocks/proposal/testimonials'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { TestimonialsData } from '../../model/layout'
import type { ProposalTheme } from '../../model/theme'

import type { EditSlotArgs } from './edit-slot-args'
import { focusNewItem } from './focus-new-item'
import { InlineField } from './inline-field'
import { TestimonialPhoto } from './testimonial-photo'

/** New testimonial item ids never repeat within a session; that's all a client-only key needs. Same `ti-` prefix the Branding editor's testimonials block uses. */
function newItemId(): string {
  return `ti-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Builds the testimonials block's `TestimonialsSlots`: per item an editable quote/names/detail with a remove control. */
export function testimonialsSlots({
  sectionId, data, dispatch, externalVersion, onFocus, branding, theme, swatches,
}: EditSlotArgs<TestimonialsData> & { branding: PublicBranding; theme: ProposalTheme; swatches: readonly string[] }): TestimonialsSlots {
  const setItems = (items: TestimonialsData['items'], commit: boolean) => {
    dispatch({ type: 'setData', id: sectionId, data: { kind: 'testimonials', testimonials: { ...data, items } } }, { commit })
  }
  const richTextBar = { theme, swatches }

  return {
    item: (item, i) => (
      <div key={item.id} data-item-id={item.id} className="group/item relative h-full">
        <TestimonialCard branding={branding} cardBackgroundColor={data.cardBackgroundColor}>
          <InlineField
            value={item.quote}
            placeholder="Add a quote"
            className="[&_p]:m-0"
            externalVersion={externalVersion}
            onFocus={onFocus}
            richTextBar={richTextBar}
            onChange={(quote) => setItems(data.items.map((it) => (it.id === item.id ? { ...it, quote } : it)), false)}
          />
          <div className="flex items-center gap-3">
            <TestimonialPhoto sectionId={sectionId} data={data} itemId={item.id} imageUrl={item.imageUrl} dispatch={dispatch} onFocus={onFocus} />
            <div className="min-w-0 flex-1">
              <InlineField
                value={item.names}
                placeholder="Names"
                singleLine
                className="[&_p]:m-0"
                externalVersion={externalVersion}
                onFocus={onFocus}
                richTextBar={richTextBar}
                onChange={(names) => setItems(data.items.map((it) => (it.id === item.id ? { ...it, names } : it)), false)}
              />
              <InlineField
                value={item.detail ?? ''}
                placeholder="Role or wedding, optional"
                singleLine
                className="[&_p]:m-0"
                externalVersion={externalVersion}
                onFocus={onFocus}
                richTextBar={richTextBar}
                onChange={(detail) => setItems(data.items.map((it) => (it.id === item.id ? { ...it, detail } : it)), false)}
              />
            </div>
          </div>
        </TestimonialCard>
        <button
          type="button"
          aria-label={`Remove testimonial ${i + 1}`}
          onClick={(e) => {
            e.stopPropagation()
            setItems(data.items.filter((it) => it.id !== item.id), true)
          }}
          className="absolute right-1 top-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-control text-text-subtle opacity-0 transition hover:text-text focus-visible:opacity-100 group-hover/item:opacity-100"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    ),
  }
}

/** Props for {@link AddTestimonialItem}. */
export interface AddTestimonialItemProps {
  sectionId: string
  data: TestimonialsData
  dispatch: EditSlotArgs<TestimonialsData>['dispatch']
}

/** "Add testimonial" affordance, appended after the testimonials list via `DataSectionSlots.after`. No cap, matching the Branding editor. */
export function AddTestimonialItem({ sectionId, data, dispatch }: AddTestimonialItemProps) {
  return (
    <>
      {data.items.length === 0 ? (
        // An empty list rendered nothing but this button,
        // which read as broken (audit pass 2); the public block hides the
        // section entirely while empty, which the hint also says.
        <p className="mt-2 text-body text-text-subtle">No testimonials yet. Add one, or delete this section. It is hidden on the sent proposal while empty.</p>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          const item = { id: newItemId(), quote: '', names: '', detail: '' }
          dispatch({ type: 'setData', id: sectionId, data: { kind: 'testimonials', testimonials: { ...data, items: [...data.items, item] } } }, { commit: true })
          focusNewItem(sectionId, item.id)
        }}
        className="mt-3 inline-flex h-8 cursor-pointer items-center gap-1.5 self-start rounded-control bg-surface-emphasis px-3 text-body text-text hover:bg-surface-muted"
      >
        <Plus size={14} strokeWidth={1.5} />
        Add testimonial
      </button>
    </>
  )
}
