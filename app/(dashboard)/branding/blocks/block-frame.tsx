'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as Popover from '@radix-ui/react-popover'
import { Plus, GripVertical, Copy, Trash2, RotateCcw } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

import { blockOuterStyle } from '@/lib/branding/block-outer-style'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'
import { isDeletable } from './policy'

import { BlockToolbar } from './block-toolbar'
import type { Block } from './types'

interface BlockFrameProps {
  id: string
  block: Block
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  selected: boolean
  multiSelected: boolean
  onSelect: (additive: boolean) => void
  onDeselect: () => void
  onRequestAddBelow: () => void
  onDuplicate: () => void
  onDelete: () => void
  onResetBlock: () => void
  children: React.ReactNode
}

export function BlockFrame({
  id,
  block,
  state,
  surface,
  updateBlock,
  selected,
  multiSelected,
  onSelect,
  onDeselect,
  onRequestAddBelow,
  onDuplicate,
  onDelete,
  onResetBlock,
  children,
}: BlockFrameProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges: () => false,
  })

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [resizing, setResizing] = useState(false)
  const blockRef = useRef<HTMLDivElement>(null)

  const selectionColor = state.brandColor || '#111827'

  // Listen for text focus event from InlineText; select this block if not already selected
  useEffect(() => {
    const onTextFocus = (e: Event) => {
      if (e instanceof CustomEvent && e.type === 'zebri:text-focus' && !selected) {
        onSelect(false)
      }
    }
    const el = blockRef.current
    if (el) {
      el.addEventListener('zebri:text-focus', onTextFocus)
      return () => el.removeEventListener('zebri:text-focus', onTextFocus)
    }
  }, [selected, onSelect])

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const blockEl = (e.currentTarget as HTMLElement).closest('[data-block-id]') as HTMLElement | null
    const startHeight = block.blockHeightPx ?? (blockEl ? blockEl.getBoundingClientRect().height : 80)
    const startY = e.clientY
    setResizing(true)
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY
      const next = Math.max(32, startHeight + dy)
      updateBlock(block.id, { blockHeightPx: Math.round(next) })
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const borderWidth = block.borderWidth ?? 0
  const borderColor = block.borderColor || '#E5E7EB'
  const blockRadius = block.blockRadius
  const outerStyle = blockOuterStyle(block, { cornerRadius: state.cornerRadius })

  const blockNode = (
    <div
      ref={(node) => {
        setNodeRef(node)
        blockRef.current = node
      }}
      data-block-id={id}
      data-selected={selected || undefined}
      style={{
        ...outerStyle,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : selected ? 20 : undefined,
        willChange: isDragging ? 'transform' : undefined,
        borderWidth: borderWidth || outerStyle.borderWidth,
        borderStyle: (borderWidth || outerStyle.borderWidth) ? 'solid' : undefined,
        borderColor: (borderWidth || outerStyle.borderWidth) ? borderColor : undefined,
        borderRadius: blockRadius ?? (borderWidth ? state.cornerRadius : outerStyle.borderRadius),
        minHeight: block.type !== 'headerBanner' && block.blockHeightPx ? block.blockHeightPx : undefined,
        display: block.type !== 'headerBanner' && block.blockHeightPx ? 'flex' : undefined,
        flexDirection: block.type !== 'headerBanner' && block.blockHeightPx ? 'column' : undefined,
        justifyContent: block.type !== 'headerBanner' && block.blockHeightPx
          ? (block.blockVAlign === 'top' ? 'flex-start' : block.blockVAlign === 'bottom' ? 'flex-end' : 'center')
          : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(e.shiftKey || e.metaKey || e.ctrlKey)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!selected) onSelect(false)
        setMenuPos({ x: e.clientX, y: e.clientY })
      }}
      className={`group relative ${isDragging ? 'opacity-0' : ''}`}
    >
      {/* Selection / hover outline using brand color */}
      <div
        aria-hidden
        className={`absolute inset-0 pointer-events-none rounded-md transition`}
        style={{
          borderWidth: selected || multiSelected ? 2 : 1,
          borderStyle: 'solid',
          borderColor: selected
            ? selectionColor
            : multiSelected
              ? `${selectionColor}99`
              : 'transparent',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none rounded-md border border-transparent group-hover:border-gray-300/70 transition"
      />

      {/* Drag handle */}
      <div
        className={`absolute left-0.5 top-1/2 -translate-y-1/2 transition z-10 ${
          selected || isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          title="Drag to reorder"
          className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center w-5 h-5 rounded-sm text-gray-400 hover:text-gray-700 hover:bg-gray-100/80"
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </button>
      </div>

      {children}

      {/* Block resize handle — shown for all block types except headerBanner (which has its own) */}
      {block.type !== 'headerBanner' && (
        <BlockResizeHandle onMouseDown={startResize} active={resizing} />
      )}

      {/* Add-below hover affordance */}
      {!selected && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRequestAddBelow()
          }}
          aria-label="Add block below"
          title="Add block below"
          className="absolute left-1/2 -translate-x-1/2 -bottom-3 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-gray-300 opacity-0 group-hover:opacity-100 transition cursor-pointer"
        >
          <Plus size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  )

  return (
    <>
      <Popover.Root
        open={selected && !isDragging}
        onOpenChange={(open) => {
          if (!open && selected && !isDragging) onDeselect()
        }}
      >
        <Popover.Anchor asChild>{blockNode}</Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="center"
            sideOffset={6}
            collisionPadding={16}
            avoidCollisions
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => {
              const target = e.target as HTMLElement | null
              if (target?.closest(`[data-block-id="${id}"]`)) {
                e.preventDefault()
              }
            }}
            onFocusOutside={(e) => {
              const target = e.target as HTMLElement | null
              if (target?.closest(`[data-block-id="${id}"]`)) {
                e.preventDefault()
              }
            }}
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement | null
              if (target?.closest(`[data-block-id="${id}"]`)) {
                e.preventDefault()
              }
            }}
            className="z-50 outline-none"
          >
            <BlockToolbar
              block={block}
              state={state}
              surface={surface}
              updateBlock={updateBlock}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onResetBlock={onResetBlock}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          block={block}
          surface={surface}
          onClose={() => setMenuPos(null)}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onResetBlock={onResetBlock}
        />
      )}
    </>
  )
}

function ContextMenu({
  x,
  y,
  block,
  surface,
  onClose,
  onDuplicate,
  onDelete,
  onResetBlock,
}: {
  x: number
  y: number
  block: Block
  surface: SurfaceTab
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
  onResetBlock: () => void
}) {
  useEffect(() => {
    const close = () => onClose()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const left = Math.min(x, (typeof window === 'undefined' ? 9999 : window.innerWidth) - 220)
  const top = Math.min(y, (typeof window === 'undefined' ? 9999 : window.innerHeight) - 160)

  const canDelete = isDeletable(block, surface)

  const items: Array<{ label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }> = [
    { label: 'Reset to theme', icon: <RotateCcw size={12} strokeWidth={1.75} />, onClick: onResetBlock },
    { label: 'Duplicate', icon: <Copy size={12} strokeWidth={1.75} />, onClick: onDuplicate },
  ]

  // Only add Delete if the block is deletable
  if (canDelete) {
    items.push({ label: 'Delete', icon: <Trash2 size={12} strokeWidth={1.75} />, onClick: onDelete, danger: true })
  }

  return (
    <div
      role="menu"
      className="fixed z-[80] w-[180px] bg-white border border-gray-200 rounded-lg shadow-xl p-1 animate-modal-in"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer transition ${
            item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className={item.danger ? 'text-red-500' : 'text-gray-400'}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

function BlockResizeHandle({
  onMouseDown,
  active,
}: {
  onMouseDown: (e: React.MouseEvent) => void
  active: boolean
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute left-0 right-0 bottom-0 h-3 cursor-ns-resize flex items-end justify-center pb-1 transition ${
        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
      title="Drag to resize"
    >
      <div className="h-1 w-10 rounded-full bg-gray-900/60 ring-1 ring-white/80 shadow-sm" />
    </div>
  )
}
