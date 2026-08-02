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
import { RenderDivider as PublicRenderDivider } from '@/lib/branding/public-blocks/divider'
import { RenderFooter as PublicRenderFooter } from '@/lib/branding/public-blocks/footer'
import { RenderTagline as PublicRenderTagline } from '@/lib/branding/public-blocks/tagline'
import { RenderText as PublicRenderText } from '@/lib/branding/public-blocks/text'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import { publicBrandingFromEditorState } from '../editor-branding'

import { BlockFrame } from './block-frame'
import { InlineText } from './inline-text'
import {
  RenderAction,
  RenderBusinessName,
  RenderContractBody,
  RenderContractSign,
  RenderCouplePortal,
  RenderHeaderBanner,
  RenderImage,
  RenderLineItems,
  RenderPaymentDetails,
  RenderPaymentSchedule,
  RenderQuestionnaireBody,
  RenderTitle,
  RenderTotals,
  RenderVendorTimelineBody,
} from './render'
import { RichText } from './rich-text/rich-text'
import type { Block, SpacerBlock } from './types'

interface BlockRendererProps {
  blocks: Block[]
  setBlocks: (b: Block[]) => void
  state: BrandPreviewState
  surface: SurfaceTab
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
}

export function BlockRenderer({
  blocks,
  setBlocks,
  state,
  surface,
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
      <div className="relative min-h-[60vh]">
        {/* Render the same white document page a real document sits on, so an
            empty surface reads as a clean blank page rather than bare canvas. */}
        <div
          aria-hidden
          className="absolute inset-0 border border-gray-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]"
          style={{
            background: state.surfaceColor || '#FFFFFF',
            borderRadius: state.cornerRadius,
          }}
        />
        <div className="relative flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <p className="text-xs text-gray-500 mb-4">This document is empty</p>
          <button
            type="button"
            onClick={() => requestAddAfter(null)}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black cursor-pointer transition shadow-sm"
          >
            <Plus size={14} strokeWidth={2} />
            Add your first block
          </button>
        </div>
      </div>
    )
  }

  return (
    // Same min height as the empty state so the page never shrinks when the
    // first block lands; it only grows once content exceeds this minimum.
    <div className="relative min-h-[60vh]">
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
            {/* Insert above the first block. Every block carries an "add below"
                affordance, which leaves the very top of the document as the one
                place nothing can be inserted. This is its counterpart, and it
                reuses the same null target the empty-state button uses. */}
            <div className="group relative h-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  requestAddAfter(null)
                }}
                aria-label="Add block above"
                title="Add block above"
                className="absolute left-1/2 -translate-x-1/2 -top-3 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-gray-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition cursor-pointer"
              >
                <Plus size={12} strokeWidth={2} />
              </button>
              {/* Hover target: the button itself is 24px in a zero-height row,
                  so this widens the area that reveals it to the full width of
                  the document. */}
              <div aria-hidden className="absolute inset-x-0 -top-4 h-8" />
            </div>
            {blocks.map((block) => {
              // Non-contract render-split markers stay fixed (non-selectable):
              // their surface is nothing but that one body, so there's nothing
              // to arrange around them. The contract body is the exception — it
              // flows through the normal BlockFrame path below so the MC can
              // select it and reach the shared style toolbar (it's still locked,
              // so delete/duplicate stay disabled).
              if (
                block.type === 'couplePortal' ||
                block.type === 'vendorTimelineBody' ||
                block.type === 'questionnaireBody'
              ) {
                const fixedLabel =
                  block.type === 'couplePortal'
                    ? 'Couple portal (fixed)'
                    : block.type === 'vendorTimelineBody'
                      ? 'Run sheet (fixed)'
                      : 'Questionnaire (fixed)';
                return (
                  <div key={block.id} aria-label={fixedLabel} className="group relative">
                    {renderBlock(block, state, updateBlock, {}, surface)}
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
                  surface={surface}
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
                  }, surface)}
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
                {renderBlock(activeBlock, state, updateBlock, {}, surface)}
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
}

interface SpacerWithResizeProps {
  block: SpacerBlock
  branding: ReturnType<typeof publicBrandingFromEditorState>
  heightPx: number
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}

function SpacerWithResize({ block, heightPx, updateBlock }: SpacerWithResizeProps) {
  const [resizing, setResizing] = useState(false)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = heightPx
    setResizing(true)
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY
      const next = Math.max(8, Math.min(160, startHeight + dy))
      updateBlock(block.id, { heightPx: Math.round(next) })
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="group relative w-full" style={{ height: heightPx }}>
      {/* Height readout centred inside the spacer, hover-only. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-gray-400 font-medium opacity-0 group-hover:opacity-100 transition">
          {heightPx}px
        </span>
      </div>
      {/* The single resize control: a grip on the bottom edge. */}
      <div
        onMouseDown={startResize}
        title="Drag to resize"
        className={`absolute inset-x-0 bottom-0 h-3 flex items-end justify-center pb-0.5 cursor-ns-resize transition ${
          resizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <div className="h-1 w-10 rounded-full bg-gray-900/50 ring-1 ring-white/80 shadow-sm" />
      </div>
    </div>
  )
}

function renderBlock(
  block: Block,
  state: BrandPreviewState,
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void,
  extras: RenderExtras = {},
  surface?: SurfaceTab,
) {
  switch (block.type) {
    case 'headerBanner':
      return (
        <RenderHeaderBanner
          block={block}
          state={state}
          surface={surface}
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
          surface={surface}
          updateBlock={updateBlock}
          uploadLogo={extras.uploadLogo}
          removeLogo={extras.removeLogo}
        />
      )
    case 'tagline': {
      const branding = publicBrandingFromEditorState(state)
      return (
        <PublicRenderTagline
          block={block}
          branding={branding}
          slots={{
            text: (
              <InlineText
                value={state.tagline ?? ''}
                onChange={(v) => extras.setTagline?.(v)}
                placeholder="Your tagline"
                as="span"
              />
            ),
          }}
        />
      )
    }
    case 'title':
      return <RenderTitle block={block} state={state} surface={surface} updateBlock={updateBlock} />
    case 'lineItems':
      return <RenderLineItems block={block} state={state} surface={surface} updateBlock={updateBlock} />
    case 'totals':
      return <RenderTotals block={block} state={state} surface={surface} updateBlock={updateBlock} />
    case 'paymentDetails':
      return <RenderPaymentDetails block={block} state={state} surface={surface} updateBlock={updateBlock} />
    case 'text': {
      const branding = publicBrandingFromEditorState(state)
      return (
        <PublicRenderText
          block={block}
          branding={branding}
          slots={{
            text: (
              <RichText
                value={block.text}
                onChange={(v) => updateBlock(block.id, { text: v })}
                surface={surface ?? 'invoice'}
                placeholder="Add a note to your client."
                className="break-words"
              />
            ),
          }}
        />
      )
    }
    case 'action':
      return <RenderAction block={block} state={state} surface={surface} updateBlock={updateBlock} selected={extras.selected} />
    case 'divider': {
      const branding = publicBrandingFromEditorState(state)
      return <PublicRenderDivider block={block} branding={branding} />
    }
    case 'footer': {
      const branding = publicBrandingFromEditorState(state)
      return (
        <PublicRenderFooter
          block={block}
          branding={branding}
          variablePreview
          slots={{
            note: (
              <RichText
                value={block.closingNote}
                onChange={(v) => updateBlock(block.id, { closingNote: v })}
                surface={surface ?? 'invoice'}
                placeholder="Closing line"
              />
            ),
          }}
        />
      )
    }
    case 'couplePortal':
      return <RenderCouplePortal state={state} />
    case 'paymentSchedule':
      return <RenderPaymentSchedule block={block} state={state} updateBlock={updateBlock} />
    case 'contractBody':
      return <RenderContractBody state={state} block={block} />
    case 'contractSign':
      return <RenderContractSign state={state} block={block} />
    case 'vendorTimelineBody':
      return <RenderVendorTimelineBody state={state} />
    case 'questionnaireBody':
      return <RenderQuestionnaireBody block={block} state={state} updateBlock={updateBlock} />
    case 'image':
      return (
        <RenderImage
          block={block}
          state={state}
          surface={surface}
          updateBlock={updateBlock}
          uploadImage={extras.uploadImage}
          removeImage={extras.removeImage}
        />
      )
    case 'spacer': {
      const branding = publicBrandingFromEditorState(state)
      const heightPx = block.heightPx ?? 32
      return (
        <SpacerWithResize
          block={block}
          branding={branding}
          heightPx={heightPx}
          updateBlock={updateBlock}
        />
      )
    }
  }
}

