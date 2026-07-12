'use client'

import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { ProposalLabelEdit } from '@/lib/branding/proposal-labels'
import type { BrandPreviewState } from '@/types/branding-preview'

import { BlockFrame } from './block-frame'
import {
  RenderHeaderBanner,
  RenderBusinessName,
  RenderTagline,
  RenderTitle,
  RenderLineItems,
  RenderTotals,
  RenderPaymentDetails,
  RenderText,
  RenderAction,
  RenderContractBody,
  RenderCouplePortal,
  RenderDivider,
  RenderFooter,
  RenderPaymentSchedule,
  RenderProposalBody,
  RenderImage,
} from './render'
import type { Block } from './types'

interface BlockRendererProps {
  blocks: Block[]
  setBlocks: (b: Block[]) => void
  state: BrandPreviewState
  selectedBlockIds: string[]
  setSelectedBlockIds: (ids: string[]) => void
  requestAddAfter: (afterId: string | null) => void
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  duplicateBlock: (id: string) => void
  deleteBlock: (id: string) => void
  resetBlock: (id: string) => void
  setTagline?: (v: string) => void
  setBusinessName?: (v: string) => void
  uploadLogo?: (file: File) => Promise<void>
  removeLogo?: () => void | Promise<void>
  uploadHeader?: (file: File) => Promise<void>
  removeHeader?: () => void | Promise<void>
  uploadImage?: (file: File, blockId: string) => Promise<void>
  removeImage?: (blockId: string) => void | Promise<void>
  /** Proposal surface only: edit the fixed core's section labels. */
  onEditProposalLabel?: ProposalLabelEdit
  /** Proposal surface only: toggle the single/multi package preview. */
  setProposalPreviewMode?: (mode: 'single' | 'multi') => void
}

export function BlockRenderer({
  blocks,
  setBlocks,
  state,
  selectedBlockIds,
  setSelectedBlockIds,
  requestAddAfter,
  updateBlock,
  duplicateBlock,
  deleteBlock,
  resetBlock,
  setTagline,
  setBusinessName,
  uploadLogo,
  removeLogo,
  uploadHeader,
  removeHeader,
  uploadImage,
  removeImage,
  onEditProposalLabel,
  setProposalPreviewMode,
}: BlockRendererProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeBlock = activeId ? blocks.find(b => b.id === activeId) ?? null : null
  const primarySelectedId = selectedBlockIds[0] ?? null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = blocks.findIndex(b => b.id === active.id)
    const newIdx = blocks.findIndex(b => b.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    setBlocks(arrayMove(blocks, oldIdx, newIdx))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      const meta = e.metaKey || e.ctrlKey
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedBlockIds.length > 0) {
        e.preventDefault()
        setBlocks(blocks.filter(b => !selectedBlockIds.includes(b.id)))
        setSelectedBlockIds([])
      } else if (meta && (e.key === 'd' || e.key === 'D')) {
        if (primarySelectedId) {
          e.preventDefault()
          duplicateBlock(primarySelectedId)
        }
      } else if (meta && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        setSelectedBlockIds(blocks.map(b => b.id))
      } else if (e.key === 'Escape') {
        setSelectedBlockIds([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockIds, blocks, primarySelectedId])

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-sm font-semibold text-gray-800">No blocks yet</p>
        <p className="text-xs text-gray-500 mt-1 mb-4">Build your document layout block by block</p>
        <button
          type="button"
          onClick={() => requestAddAfter(null)}
          className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black cursor-pointer transition shadow-sm"
        >
          <Plus size={14} strokeWidth={2} />
          Add your first element
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 border border-gray-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]"
        style={{
          background: state.surfaceColor || '#FFFFFF',
          borderRadius: state.cornerRadius,
        }}
      />
      <div
        className="relative pt-4 pb-8"
        style={{
          fontFamily: FONT_STACKS[state.fontBody],
          paddingLeft: state.docPadding,
          paddingRight: state.docPadding,
        }}
        onClick={() => setSelectedBlockIds([])}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => {
              if (
                block.type === 'couplePortal' ||
                block.type === 'paymentSchedule' ||
                block.type === 'contractBody' ||
                block.type === 'proposalBody'
              ) {
                const fixedLabel =
                  block.type === 'couplePortal'
                    ? 'Couple portal (fixed)'
                    : block.type === 'paymentSchedule'
                      ? 'Payment schedule (fixed)'
                      : block.type === 'contractBody'
                        ? 'Contract body (fixed)'
                        : 'Proposal (fixed)';
                return (
                  <div key={block.id} aria-label={fixedLabel} className="group relative">
                    {renderBlock(block, state, updateBlock, {
                      onEditProposalLabel,
                      setProposalPreviewMode,
                    })}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        requestAddAfter(block.id)
                      }}
                      aria-label="Add block below"
                      title="Add block below"
                      className="absolute left-1/2 -translate-x-1/2 -bottom-3 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-gray-300 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    >
                      <Plus size={12} strokeWidth={2} />
                    </button>
                  </div>
                )
              }
              const selected = primarySelectedId === block.id
              const multi = !selected && selectedBlockIds.includes(block.id)
              return (
                <BlockFrame
                  key={block.id}
                  id={block.id}
                  block={block}
                  state={state}
                  updateBlock={updateBlock}
                  selected={selected}
                  multiSelected={multi}
                  onSelect={(additive) => {
                    if (additive) {
                      const has = selectedBlockIds.includes(block.id)
                      const next = has
                        ? selectedBlockIds.filter(id => id !== block.id)
                        : [block.id, ...selectedBlockIds]
                      setSelectedBlockIds(next)
                    } else {
                      setSelectedBlockIds([block.id])
                    }
                  }}
                  onDeselect={() => setSelectedBlockIds([])}
                  onRequestAddBelow={() => requestAddAfter(block.id)}
                  onDuplicate={() => duplicateBlock(block.id)}
                  onDelete={() => deleteBlock(block.id)}
                  onResetBlock={() => resetBlock(block.id)}
                >
                  {renderBlock(block, state, updateBlock, {
                    selected,
                    setTagline,
                    setBusinessName,
                    uploadLogo,
                    removeLogo,
                    uploadHeader,
                    removeHeader,
                    uploadImage,
                    removeImage,
                  })}
                </BlockFrame>
              )
            })}
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeBlock ? (
              <div
                className="opacity-90 shadow-2xl rounded-md bg-white"
                style={{ outline: `2px solid ${state.brandColor || '#111827'}` }}
              >
                {renderBlock(activeBlock, state, updateBlock)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

interface RenderExtras {
  selected?: boolean
  setTagline?: (v: string) => void
  setBusinessName?: (v: string) => void
  uploadLogo?: (file: File) => Promise<void>
  removeLogo?: () => void | Promise<void>
  uploadHeader?: (file: File) => Promise<void>
  removeHeader?: () => void | Promise<void>
  uploadImage?: (file: File, blockId: string) => Promise<void>
  removeImage?: (blockId: string) => void | Promise<void>
  onEditProposalLabel?: ProposalLabelEdit | undefined
  setProposalPreviewMode?: ((mode: 'single' | 'multi') => void) | undefined
}

function renderBlock(
  block: Block,
  state: BrandPreviewState,
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void,
  extras: RenderExtras = {},
) {
  switch (block.type) {
    case 'headerBanner':
      return (
        <RenderHeaderBanner
          block={block}
          state={state}
          updateBlock={updateBlock}
          uploadHeader={extras.uploadHeader}
          removeHeader={extras.removeHeader}
        />
      )
    case 'businessName':
      return (
        <RenderBusinessName
          block={block}
          state={state}
          updateBlock={updateBlock}
          setBusinessName={extras.setBusinessName}
          uploadLogo={extras.uploadLogo}
          removeLogo={extras.removeLogo}
        />
      )
    case 'tagline':
      return <RenderTagline block={block} state={state} updateBlock={updateBlock} setTagline={extras.setTagline} />
    case 'title':
      return <RenderTitle block={block} state={state} updateBlock={updateBlock} />
    case 'lineItems':
      return <RenderLineItems block={block} state={state} updateBlock={updateBlock} />
    case 'totals':
      return <RenderTotals block={block} state={state} updateBlock={updateBlock} />
    case 'paymentDetails':
      return <RenderPaymentDetails block={block} state={state} updateBlock={updateBlock} />
    case 'text':
      return <RenderText block={block} state={state} updateBlock={updateBlock} />
    case 'action':
      return <RenderAction block={block} state={state} updateBlock={updateBlock} selected={extras.selected} />
    case 'divider':
      return <RenderDivider block={block} state={state} updateBlock={updateBlock} />
    case 'footer':
      return <RenderFooter block={block} state={state} updateBlock={updateBlock} />
    case 'couplePortal':
      return <RenderCouplePortal state={state} />
    case 'paymentSchedule':
      return <RenderPaymentSchedule state={state} />
    case 'contractBody':
      return <RenderContractBody state={state} />
    case 'proposalBody':
      return (
        <RenderProposalBody
          state={state}
          onEditLabel={extras.onEditProposalLabel}
          setPreviewMode={extras.setProposalPreviewMode}
        />
      )
    case 'image':
      return (
        <RenderImage
          block={block}
          state={state}
          updateBlock={updateBlock}
          uploadImage={extras.uploadImage}
          removeImage={extras.removeImage}
        />
      )
  }
}

