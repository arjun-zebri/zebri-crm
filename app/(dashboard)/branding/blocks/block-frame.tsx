'use client'

import { useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Lock, EyeOff, Copy, Trash2, Eye, Unlock, Paintbrush, ClipboardPaste, RotateCcw, FileStack } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { BlockToolbar } from './block-toolbar'
import type { Block } from './types'
import type { BrandPreviewState } from '../branding-preview-types'

interface BlockFrameProps {
  id: string
  block: Block
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  selected: boolean
  multiSelected: boolean
  onSelect: (additive: boolean) => void
  onDeselect: () => void
  onRequestAddBelow: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleLock: () => void
  onToggleHide: () => void
  onResetBlock: () => void
  onApplyToAllDocs: () => void
  onCopyStyle: () => void
  onPasteStyle: () => void
  hasStyleClipboard: boolean
  children: React.ReactNode
}

export function BlockFrame({
  id,
  block,
  state,
  updateBlock,
  selected,
  multiSelected,
  onSelect,
  onDeselect,
  onRequestAddBelow,
  onDuplicate,
  onDelete,
  onToggleLock,
  onToggleHide,
  onResetBlock,
  onApplyToAllDocs,
  onCopyStyle,
  onPasteStyle,
  hasStyleClipboard,
  children,
}: BlockFrameProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges: () => false,
    disabled: !!block.locked,
  })

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const hidden = !!block.hidden
  const locked = !!block.locked
  const selectionColor = state.brandColor || '#111827'

  const borderWidth = block.borderWidth ?? 0
  const borderColor = block.borderColor || '#E5E7EB'
  const blockRadius = block.blockRadius

  const blockNode = (
    <div
      ref={setNodeRef}
      data-block-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : selected ? 20 : undefined,
        willChange: isDragging ? 'transform' : undefined,
        borderWidth,
        borderStyle: borderWidth ? 'solid' : undefined,
        borderColor: borderWidth ? borderColor : undefined,
        borderRadius: blockRadius ?? (borderWidth ? state.cornerRadius : undefined),
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
      className={`group relative ${isDragging ? 'opacity-0' : ''} ${hidden ? 'opacity-40' : ''}`}
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

      {/* Drag / lock handle — sits inside the block-frame's left padding so it
          never gets clipped by the document card's edge. */}
      <div
        className={`absolute left-0.5 top-1/2 -translate-y-1/2 transition z-10 ${
          selected || isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {locked ? (
          <span
            title="Locked"
            className="inline-flex items-center justify-center w-5 h-5 rounded-sm text-gray-400"
          >
            <Lock size={11} strokeWidth={1.75} />
          </span>
        ) : (
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            title="Drag to reorder"
            className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center w-5 h-5 rounded-sm text-gray-400 hover:text-gray-700 hover:bg-gray-100/80"
          >
            <GripVertical size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Hidden eye badge - shows on selection */}
      {hidden && (
        <span
          className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-900 text-white inline-flex items-center gap-1 z-10"
          title="Hidden from output"
        >
          <EyeOff size={9} strokeWidth={2} />
          Hidden
        </span>
      )}

      {children}

      {/* Add-below hover affordance */}
      {!selected && !locked && (
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
            side="top"
            align="center"
            sideOffset={10}
            collisionPadding={16}
            avoidCollisions
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => {
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
              updateBlock={updateBlock}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onAddBelow={onRequestAddBelow}
              onToggleLock={onToggleLock}
              onToggleHide={onToggleHide}
              onResetBlock={onResetBlock}
              onApplyToAllDocs={onApplyToAllDocs}
              onCopyStyle={onCopyStyle}
              onPasteStyle={onPasteStyle}
              hasStyleClipboard={hasStyleClipboard}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          locked={locked}
          hidden={hidden}
          hasStyleClipboard={hasStyleClipboard}
          onClose={() => setMenuPos(null)}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onToggleLock={onToggleLock}
          onToggleHide={onToggleHide}
          onResetBlock={onResetBlock}
          onApplyToAllDocs={onApplyToAllDocs}
          onCopyStyle={onCopyStyle}
          onPasteStyle={onPasteStyle}
        />
      )}
    </>
  )
}

function ContextMenu({
  x,
  y,
  locked,
  hidden,
  hasStyleClipboard,
  onClose,
  onDuplicate,
  onDelete,
  onToggleLock,
  onToggleHide,
  onResetBlock,
  onApplyToAllDocs,
  onCopyStyle,
  onPasteStyle,
}: {
  x: number
  y: number
  locked: boolean
  hidden: boolean
  hasStyleClipboard: boolean
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleLock: () => void
  onToggleHide: () => void
  onResetBlock: () => void
  onApplyToAllDocs: () => void
  onCopyStyle: () => void
  onPasteStyle: () => void
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

  // Keep menu inside viewport
  const left = Math.min(x, (typeof window === 'undefined' ? 9999 : window.innerWidth) - 220)
  const top = Math.min(y, (typeof window === 'undefined' ? 9999 : window.innerHeight) - 280)

  const items: Array<{ label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }> = [
    { label: 'Copy style', icon: <Paintbrush size={12} strokeWidth={1.75} />, onClick: onCopyStyle },
    { label: 'Paste style', icon: <ClipboardPaste size={12} strokeWidth={1.75} />, onClick: onPasteStyle, disabled: !hasStyleClipboard },
    { label: 'Apply to all docs', icon: <FileStack size={12} strokeWidth={1.75} />, onClick: onApplyToAllDocs },
    { label: 'Reset to theme', icon: <RotateCcw size={12} strokeWidth={1.75} />, onClick: onResetBlock },
    { label: 'Duplicate', icon: <Copy size={12} strokeWidth={1.75} />, onClick: onDuplicate },
    { label: hidden ? 'Show' : 'Hide', icon: hidden ? <Eye size={12} strokeWidth={1.75} /> : <EyeOff size={12} strokeWidth={1.75} />, onClick: onToggleHide },
    { label: locked ? 'Unlock' : 'Lock', icon: locked ? <Unlock size={12} strokeWidth={1.75} /> : <Lock size={12} strokeWidth={1.75} />, onClick: onToggleLock },
    { label: 'Delete', icon: <Trash2 size={12} strokeWidth={1.75} />, onClick: onDelete, danger: true },
  ]

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
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return
            item.onClick()
            onClose()
          }}
          className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-left cursor-pointer transition ${
            item.disabled
              ? 'text-gray-300 cursor-not-allowed'
              : item.danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className={item.danger ? 'text-red-500' : 'text-gray-400'}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}
