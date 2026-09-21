'use client'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import { RenderFaq, type FaqSlots } from '@/lib/branding/public-blocks/proposal/faq'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import type { FaqBlock, FaqItem } from '../types'

import { AddItemButton, RemoveItemButton } from './item-list'
import { ProposalText } from './proposal-text'

/** The FAQ list's own cap, enforced by `AddItemButton`'s `max`. */
const MAX_ITEMS = 12

interface EditFaqProps {
  block: FaqBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/** New question ids never repeat within a session; that's all a client-only key needs. */
function newItemId(): string {
  return `fi-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Editor renderer for the proposal FAQ block: every question is shown fully
 * expanded (no accordion while editing, unlike the public page) with
 * inline-editable question and answer text and a hover remove control; "Add
 * question" appends a blank item up to the 12-question cap.
 */
export function EditFaq({ block, state, updateBlock }: EditFaqProps) {
  const branding = publicBrandingFromEditorState(state)

  const patchItem = (id: string, patch: Partial<FaqItem>) => {
    updateBlock<FaqBlock>(block.id, {
      items: block.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const removeItem = (id: string) => {
    updateBlock<FaqBlock>(block.id, { items: block.items.filter((item) => item.id !== id) })
  }

  const addItem = () => {
    updateBlock<FaqBlock>(block.id, { items: [...block.items, { id: newItemId(), question: '', answer: '' }] })
  }

  const slots: FaqSlots = {
    heading: (
      <ProposalText subtarget="heading" value={block.heading} onChange={(v) => updateBlock<FaqBlock>(block.id, { heading: v })} placeholder="Heading" />
    ),
    item: (item, i) => (
      <div className="group/item relative py-4">
        <ProposalText value={item.question} onChange={(v) => patchItem(item.id, { question: v })} placeholder="Question" />
        <ProposalText value={item.answer} onChange={(v) => patchItem(item.id, { answer: v })} placeholder="Answer" enterKey="paragraph" className="mt-1" />
        <RemoveItemButton onRemove={() => removeItem(item.id)} label={`Remove question ${i + 1}`} />
      </div>
    ),
  }

  return (
    <>
      <RenderFaq block={block} branding={branding} slots={slots} />
      <AddItemButton onAdd={addItem} label="Add question" count={block.items.length} max={MAX_ITEMS} />
    </>
  )
}
