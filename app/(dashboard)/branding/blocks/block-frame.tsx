'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Lock, EyeOff } from 'lucide-react'
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

  const hidden = !!block.hidden
  const locked = !!block.locked
  const selectionColor = state.brandColor || '#111827'

  const blockNode = (
    <div
      ref={setNodeRef}
      data-block-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : selected ? 20 : undefined,
        willChange: isDragging ? 'transform' : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(e.shiftKey || e.metaKey || e.ctrlKey)
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

      {/* Drag / lock handle */}
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pl-1 pr-0.5 transition z-10 ${
          selected || isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {locked ? (
          <span
            title="Locked"
            className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-gray-400 bg-white/60"
          >
            <Lock size={11} strokeWidth={1.75} />
          </span>
        ) : (
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            title="Drag to reorder"
            className="cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={14} strokeWidth={1.5} className="text-gray-400" />
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
            onCopyStyle={onCopyStyle}
            onPasteStyle={onPasteStyle}
            hasStyleClipboard={hasStyleClipboard}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
