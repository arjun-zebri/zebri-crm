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
import { RenderDivider as PublicRenderDivider } from '@/lib/branding/public-blocks/divider'
import { RenderFooter as PublicRenderFooter } from '@/lib/branding/public-blocks/footer'
import { RenderSpacer as PublicRenderSpacer } from '@/lib/branding/public-blocks/spacer'
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
  RenderCouplePortal,
  RenderHeaderBanner,
  RenderImage,
  RenderLineItems,
  RenderPackageDetails,
  RenderPackageHeader,
  RenderPackageInclusions,
  RenderPackageTotals,
  RenderPaymentDetails,
  RenderPaymentSchedule,
  RenderProposalBody,
  RenderQuestionnaireBody,
  RenderTitle,
  RenderTotals,
  RenderVendorTimelineBody,
  ResizeHandle,
} from './render'
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
  /** Proposal surface only: edit the fixed core's section labels. */
  onEditProposalLabel?: ProposalLabelEdit
  /** Proposal surface only: toggle the single/multi package preview. */
  setProposalPreviewMode?: (mode: 'single' | 'multi') => void
  /** Questionnaire surface only: toggle the form/typeform preview mode. */
  setQuestionnairePreviewMode?: (mode: 'form' | 'typeform') => void
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
  onEditProposalLabel,
  setProposalPreviewMode,
  setQuestionnairePreviewMode,
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
              if (
                block.type === 'couplePortal' ||
                block.type === 'paymentSchedule' ||
                block.type === 'contractBody' ||
                block.type === 'proposalBody' ||
                block.type === 'vendorTimelineBody' ||
                block.type === 'questionnaireBody'
              ) {
                const fixedLabel =
                  block.type === 'couplePortal'
                    ? 'Couple portal (fixed)'
                    : block.type === 'paymentSchedule'
                      ? 'Payment schedule (fixed)'
                      : block.type === 'contractBody'
                        ? 'Contract body (fixed)'
                        : block.type === 'proposalBody'
                          ? 'Proposal (fixed)'
                          : block.type === 'vendorTimelineBody'
                            ? 'Run sheet (fixed)'
                            : 'Questionnaire (fixed)';
                return (
                  <div key={block.id} aria-label={fixedLabel} className="group relative">
                    {renderBlock(block, state, updateBlock, {
                      onEditProposalLabel,
                      setProposalPreviewMode,
                      setQuestionnairePreviewMode,
                    }, surface)}
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
  onEditProposalLabel?: ProposalLabelEdit | undefined
  setProposalPreviewMode?: ((mode: 'single' | 'multi') => void) | undefined
  setQuestionnairePreviewMode?: ((mode: 'form' | 'typeform') => void) | undefined
}

interface SpacerWithResizeProps {
  block: SpacerBlock
  branding: ReturnType<typeof publicBrandingFromEditorState>
  heightPx: number
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}

function SpacerWithResize({ block, branding, heightPx, updateBlock }: SpacerWithResizeProps) {
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
    <div className="group relative w-full bg-gradient-to-b from-gray-100 to-gray-50 flex items-center justify-center" style={{ height: heightPx, borderRadius: 4 }}>
      <PublicRenderSpacer
        block={block}
        branding={branding}
        chrome={
          <>
            <span className="text-[10px] text-gray-400 font-medium">{heightPx}px</span>
            <ResizeHandle onMouseDown={startResize} active={resizing} />
          </>
        }
      />
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
          setBusinessName={extras.setBusinessName}
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
              <InlineText
                value={block.text}
                onChange={(v) => updateBlock(block.id, { text: v })}
                placeholder="Add text..."
                multiline
                as="div"
                className="whitespace-pre-wrap break-words"
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
          slots={{
            note: (
              <InlineText
                value={block.closingNote ?? ''}
                onChange={(v) => updateBlock(block.id, { closingNote: v })}
                placeholder="Closing line"
                as="span"
              />
            ),
          }}
        />
      )
    }
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
    case 'vendorTimelineBody':
      return <RenderVendorTimelineBody state={state} />
    case 'questionnaireBody':
      return <RenderQuestionnaireBody state={state} />
    case 'packageHeader':
      return <RenderPackageHeader block={block} state={state} surface={surface} updateBlock={updateBlock} />
    case 'packageDetails':
      return <RenderPackageDetails block={block} state={state} surface={surface} updateBlock={updateBlock} />
    case 'packageInclusions':
      return <RenderPackageInclusions block={block} state={state} surface={surface} updateBlock={updateBlock} />
    case 'packageTotals':
      return <RenderPackageTotals block={block} state={state} surface={surface} updateBlock={updateBlock} />
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

