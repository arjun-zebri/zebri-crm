'use client'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import {
  RenderTestimonials,
  TestimonialCard,
  type TestimonialsSlots,
} from '@/lib/branding/public-blocks/proposal/testimonials'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import { InlineAsset } from '../inline-asset'
import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import type { TestimonialItem, TestimonialsBlock } from '../types'

import { AddItemButton, RemoveItemButton } from './item-list'
import { ProposalText } from './proposal-text'

interface EditTestimonialsProps {
  block: TestimonialsBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/** New testimonial ids never repeat within a session; that's all a client-only key needs. */
function newItemId(): string {
  return `ti-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Editor renderer for the proposal testimonials block: each card is edited
 * in place (quote, names, detail, portrait) inside the same `TestimonialCard`
 * frame the public page uses, with a hover remove control; "Add testimonial"
 * appends a blank item after the list.
 */
export function EditTestimonials({ block, state, updateBlock, extras }: EditTestimonialsProps) {
  const branding = publicBrandingFromEditorState(state)

  const patchItem = (id: string, patch: Partial<TestimonialItem>) => {
    updateBlock<TestimonialsBlock>(block.id, {
      items: block.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const removeItem = (id: string) => {
    updateBlock<TestimonialsBlock>(block.id, { items: block.items.filter((item) => item.id !== id) })
  }

  const addItem = () => {
    updateBlock<TestimonialsBlock>(block.id, {
      items: [...block.items, { id: newItemId(), quote: '', names: '', detail: '' }],
    })
  }

  const slots: TestimonialsSlots = {
    heading: (
      <ProposalText subtarget="heading" value={block.heading} onChange={(v) => updateBlock<TestimonialsBlock>(block.id, { heading: v })} placeholder="Section heading" />
    ),
    item: (item, i) => (
      <div className="group/item relative h-full">
        <TestimonialCard branding={branding}>
          <ProposalText value={item.quote} onChange={(v) => patchItem(item.id, { quote: v })} placeholder="Add a quote" enterKey="paragraph" />
          <div className="flex items-center gap-3">
            <InlineAsset
              value={item.imageUrl}
              onUpload={async (file) => {
                if (!extras.uploadBlockImage) return
                const url = await extras.uploadBlockImage(file, `testimonial-${item.id}`)
                patchItem(item.id, { imageUrl: url })
              }}
              label="Upload portrait"
              compact
              className="h-10 w-10 rounded-pill overflow-hidden shrink-0"
              emptyState={<div className="h-10 w-10 rounded-pill border-2 border-dashed border-border bg-gray-50/40" />}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of an uploaded testimonial portrait */}
              <img src={item.imageUrl} alt="" className="h-10 w-10 rounded-pill object-cover" />
            </InlineAsset>
            <div>
              <ProposalText value={item.names} onChange={(v) => patchItem(item.id, { names: v })} placeholder="Names" />
              <ProposalText value={item.detail ?? ''} onChange={(v) => patchItem(item.id, { detail: v })} placeholder="Detail (optional)" />
            </div>
          </div>
        </TestimonialCard>
        <RemoveItemButton onRemove={() => removeItem(item.id)} label={`Remove testimonial ${i + 1}`} />
      </div>
    ),
  }

  return (
    <>
      <RenderTestimonials block={block} branding={branding} slots={slots} />
      <AddItemButton onAdd={addItem} label="Add testimonial" count={block.items.length} />
    </>
  )
}
