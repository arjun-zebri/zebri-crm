'use client'

/**
 * FAQ slot builder (Slice E1, UX audit 3.4): per item, editable
 * question/answer text with a hover remove control; `AddFaqItem`
 * (rendered by `editable-data-section.tsx` as the `DataSectionSlots.after`
 * node, since `FaqSlots` itself has no "after the list" slot - see that
 * type's own doc) appends a blank item up to the same 12-question cap the
 * Branding editor's own FAQ block enforces. No heading field (2026-09-19
 * feedback: "remove the text from all these sections... we can always add
 * text sections around them") - a heading is its own text section stacked
 * above, not embedded here.
 *
 * @module features/proposals/editor/data/edit-faq
 */
import { Plus, X } from 'lucide-react'

import type { FaqSlots } from '@/lib/branding/public-blocks/proposal/faq'

import type { FaqData } from '../../model/layout'
import type { ProposalTheme } from '../../model/theme'

import type { EditSlotArgs } from './edit-slot-args'
import { focusNewItem } from './focus-new-item'
import { InlineField } from './inline-field'

/** Mirrors the Branding editor's own FAQ cap (`app/(dashboard)/branding/blocks/proposal/faq.tsx`'s `MAX_ITEMS`) - this feature may not import that file, so the number is kept in step by eye rather than shared. */
const MAX_ITEMS = 12

/** New FAQ item ids never repeat within a session; that's all a client-only key needs. Same `fi-` prefix the Branding editor's FAQ block uses. */
function newItemId(): string {
  return `fi-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Builds the FAQ block's `FaqSlots`: per item an editable question/answer with a remove control. */
export function faqSlots({
  sectionId, data, dispatch, externalVersion, onFocus, theme, swatches,
}: EditSlotArgs<FaqData> & { theme: ProposalTheme; swatches: readonly string[] }): FaqSlots {
  const setItems = (items: FaqData['items'], commit: boolean) => {
    dispatch({ type: 'setData', id: sectionId, data: { kind: 'faq', faq: { ...data, items } } }, { commit })
  }
  const richTextBar = { theme, swatches }

  return {
    item: (item, i) => (
      <div key={item.id} data-item-id={item.id} className="group/item relative py-4">
        <InlineField
          value={item.question}
          placeholder="Question"
          singleLine
          className="[&_p]:m-0"
          externalVersion={externalVersion}
          onFocus={onFocus}
          richTextBar={richTextBar}
          onChange={(question) => setItems(data.items.map((it) => (it.id === item.id ? { ...it, question } : it)), false)}
        />
        <InlineField
          value={item.answer}
          placeholder="Answer"
          className="mt-1 [&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0"
          externalVersion={externalVersion}
          onFocus={onFocus}
          richTextBar={richTextBar}
          onChange={(answer) => setItems(data.items.map((it) => (it.id === item.id ? { ...it, answer } : it)), false)}
        />
        <button
          type="button"
          aria-label={`Remove question ${i + 1}`}
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

/** Props for {@link AddFaqItem}. */
export interface AddFaqItemProps {
  sectionId: string
  data: FaqData
  dispatch: EditSlotArgs<FaqData>['dispatch']
}

/** "Add question" affordance, appended after the FAQ list via `DataSectionSlots.after`. Hidden once the item count reaches {@link MAX_ITEMS}. */
export function AddFaqItem({ sectionId, data, dispatch }: AddFaqItemProps) {
  if (data.items.length >= MAX_ITEMS) return null
  return (
    <>
      {data.items.length === 0 ? (
        // An empty list rendered nothing but this button,
        // which read as broken (audit pass 2); the public block hides the
        // section entirely while empty, which the hint also says.
        <p className="mt-2 text-body text-text-subtle">No questions yet. Add one, or delete this section. It is hidden on the sent proposal while empty.</p>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          const item = { id: newItemId(), question: '', answer: '' }
          dispatch({ type: 'setData', id: sectionId, data: { kind: 'faq', faq: { ...data, items: [...data.items, item] } } }, { commit: true })
          focusNewItem(sectionId, item.id)
        }}
        className="mt-3 inline-flex h-8 cursor-pointer items-center gap-1.5 self-start rounded-control bg-surface-emphasis px-3 text-body text-text hover:bg-surface-muted"
      >
        <Plus size={14} strokeWidth={1.5} />
        Add question
      </button>
    </>
  )
}
