'use client'

import { useEffect, useState } from 'react'
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
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { Block, TextStyle } from './types'
import type { BrandPreviewState } from '../branding-preview-types'
import { BlockFrame } from './block-frame'
import {
  RenderHeaderBanner,
  RenderBusinessName,
  RenderTagline,
  RenderTitle,
  RenderLineItems,
  RenderTotals,
  RenderMessage,
  RenderAction,
  RenderDivider,
} from './render'

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
  toggleLock: (id: string) => void
  toggleHide: (id: string) => void
  styleClipboard: TextStyle | null
  setStyleClipboard: (s: TextStyle | null) => void
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
  toggleLock,
  toggleHide,
  styleClipboard,
  setStyleClipboard,
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
      } else if (meta && e.altKey && (e.key === 'c' || e.key === 'C')) {
        if (primarySelectedId) {
          e.preventDefault()
          const styleOfBlock = readStyle(blocks.find(b => b.id === primarySelectedId))
          setStyleClipboard(styleOfBlock)
        }
      } else if (meta && e.altKey && (e.key === 'v' || e.key === 'V')) {
        if (primarySelectedId && styleClipboard) {
          e.preventDefault()
          const target = blocks.find(b => b.id === primarySelectedId)
          if (target) writeStyle(target, styleClipboard, updateBlock)
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
  }, [selectedBlockIds, blocks, styleClipboard, primarySelectedId])

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
                  onToggleLock={() => toggleLock(block.id)}
                  onToggleHide={() => toggleHide(block.id)}
                  onCopyStyle={() => setStyleClipboard(readStyle(block))}
                  onPasteStyle={() => {
                    if (styleClipboard) writeStyle(block, styleClipboard, updateBlock)
                  }}
                  hasStyleClipboard={!!styleClipboard}
                >
                  {renderBlock(block, state, updateBlock)}
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

function renderBlock(
  block: Block,
  state: BrandPreviewState,
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void,
) {
  switch (block.type) {
    case 'headerBanner':
      return <RenderHeaderBanner block={block} state={state} updateBlock={updateBlock} />
    case 'businessName':
      return <RenderBusinessName block={block} state={state} updateBlock={updateBlock} />
    case 'tagline':
      return <RenderTagline block={block} state={state} updateBlock={updateBlock} />
    case 'title':
      return <RenderTitle block={block} state={state} updateBlock={updateBlock} />
    case 'lineItems':
      return <RenderLineItems block={block} state={state} updateBlock={updateBlock} />
    case 'totals':
      return <RenderTotals block={block} state={state} updateBlock={updateBlock} />
    case 'message':
      return <RenderMessage block={block} state={state} updateBlock={updateBlock} />
    case 'action':
      return <RenderAction block={block} state={state} updateBlock={updateBlock} />
    case 'divider':
      return <RenderDivider block={block} state={state} updateBlock={updateBlock} />
  }
}

function readStyle(block: Block | undefined): TextStyle | null {
  if (!block) return null
  switch (block.type) {
    case 'title': return block.titleStyle ?? null
    case 'businessName': return block.nameStyle ?? null
    case 'tagline': return block.textStyle ?? null
    case 'message': return block.textStyle ?? null
    case 'totals': return block.totalStyle ?? null
    case 'action': return block.primaryStyle ?? null
    default: return null
  }
}

function writeStyle(
  block: Block,
  style: TextStyle,
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void,
) {
  switch (block.type) {
    case 'title': updateBlock(block.id, { titleStyle: { ...(block.titleStyle ?? {}), ...style } }); break
    case 'businessName': updateBlock(block.id, { nameStyle: { ...(block.nameStyle ?? {}), ...style } }); break
    case 'tagline': updateBlock(block.id, { textStyle: { ...(block.textStyle ?? {}), ...style } }); break
    case 'message': updateBlock(block.id, { textStyle: { ...(block.textStyle ?? {}), ...style } }); break
    case 'totals': updateBlock(block.id, { totalStyle: { ...(block.totalStyle ?? {}), ...style } }); break
    case 'action': updateBlock(block.id, { primaryStyle: { ...(block.primaryStyle ?? {}), ...style } }); break
  }
}
