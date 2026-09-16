'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as Popover from '@radix-ui/react-popover'
import { Plus, GripVertical, Copy, Trash2, RotateCcw } from 'lucide-react'
import { useEffect, useState, useRef, isValidElement, cloneElement, type CSSProperties, type ReactElement, type ReactNode } from 'react'

import { blockOuterStyle, hasOuterStyle, HPAD_EXEMPT_TYPES } from '@/lib/branding/block-outer-style'
import type { FrameMode } from '@/lib/branding/public-blocks/shared'
import { DENSITY_PADDING } from '@/types/branding-preview'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import { BlockToolbar } from './block-toolbar'
import { isDeletable, isMarker, stylesWrapMarker } from './policy'
import type { Block, BlockType } from './types'

/**
 * Blocks that size themselves, so the frame's drag-to-resize handle and its
 * `blockHeightPx` floor stay off them. Header banner, image, spacer and hero
 * each carry their own resize handle; the hero's writes a share of the
 * viewport (`heightVh`), not pixels, and pins a matching min-height, which a
 * frame floor could only fight (a smaller drag did nothing, a larger one
 * stretched the frame around an unchanged hero).
 */
const SELF_SIZED_TYPES: ReadonlySet<BlockType> = new Set<BlockType>(['headerBanner', 'image', 'spacer', 'hero'])

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
  /** The proposal surface: the child is already a `<PageSection>` that owns its own gutter. */
  frame?: FrameMode | undefined
  children: React.ReactNode
}

/**
 * In page mode, `children` is `<PageSection>{content}</PageSection>` (built
 * by `BlockRenderer`): the section owns the full-bleed background and the
 * centred `max-w-doc-page` column. Wrapping the section's own content in a
 * style div (rather than wrapping the section itself, as `BlockFrame`'s
 * sortable wrapper would) puts the box style inside that column, matching
 * `BlockOuter` on the public renderer. A no-op (returns `children` as-is)
 * when there's no style to apply or `children` isn't the expected element.
 */
function applyBoxStyleInsideSection(children: ReactNode, style: CSSProperties | undefined): ReactNode {
  if (!style || !isValidElement(children)) return children
  const section = children as ReactElement<{ children?: ReactNode }>
  return cloneElement(section, {}, <div style={style}>{section.props.children}</div>)
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
  frame = 'document',
  children,
}: BlockFrameProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges: () => false,
  })

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [resizing, setResizing] = useState(false)
  const [editing, setEditing] = useState(false)
  // Which styleable sub-element inside this block is targeted by the toolbar's
  // style controls. Driven by clicking a `data-subtarget`-tagged element in the
  // preview (direct manipulation) rather than a toolbar switcher. Null = the
  // control's own default target.
  const [activeSubTarget, setActiveSubTarget] = useState<string | null>(null)
  const blockRef = useRef<HTMLDivElement>(null)
  // The canvas scroll area, for the toolbar's collision boundary. A block
  // taller than the canvas (a full-screen hero) otherwise flips the toolbar
  // above itself and over the surface tabs; bounded to the canvas it slides
  // to the nearest edge inside it instead.
  const [toolbarBoundary, setToolbarBoundary] = useState<Element | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the mounted DOM once; there is no render-time way to find the scroll ancestor.
    setToolbarBoundary(blockRef.current?.closest('[data-canvas-scroll]') ?? null)
  }, [])

  const selectionColor = state.brandColor || '#111827'

  // Note: no reset-on-deselect effect (it would setState in an effect). The
  // highlight below is guarded by `selected`, so it clears when the block is
  // deselected; the remembered target is simply sticky per block, which reads
  // fine — re-selecting a block returns you to the part you last styled.

  // Outline the targeted sub-element so it's obvious what the toolbar's style
  // controls affect. Uses `outline` (not `border`) so it never reflows the
  // print-accurate preview, and re-runs every commit so it survives the
  // preview re-rendering mid-edit. Also gives tagged parts a pointer cursor so
  // they read as clickable.
  useEffect(() => {
    const el = blockRef.current
    if (!el) return
    const parts = el.querySelectorAll<HTMLElement>('[data-subtarget]')
    parts.forEach((n) => {
      n.style.cursor = 'pointer'
      n.style.outline = ''
      n.style.outlineOffset = ''
    })
    if (selected && activeSubTarget) {
      // Outline every element carrying the active target — some blocks repeat a
      // target (e.g. the three label cells in payment details).
      el.querySelectorAll<HTMLElement>(`[data-subtarget="${activeSubTarget}"]`).forEach((active) => {
        active.style.outline = `2px solid ${selectionColor}`
        active.style.outlineOffset = '3px'
      })
    }
  })

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

  // Track whether an editable field inside this block has focus, so the green
  // selection outline can hide while editing (it otherwise obscures the very
  // background/colours the user is adjusting).
  useEffect(() => {
    const el = blockRef.current
    if (!el) return
    const isEditable = (n: EventTarget | null) => {
      const t = n as HTMLElement | null
      return !!t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')
    }
    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) setEditing(true)
    }
    const onFocusOut = () => {
      // Let focus settle, then keep editing true only if it stayed on an
      // editable field within this block.
      requestAnimationFrame(() => {
        setEditing(el.contains(document.activeElement) && isEditable(document.activeElement))
      })
    }
    el.addEventListener('focusin', onFocusIn)
    el.addEventListener('focusout', onFocusOut)
    return () => {
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', onFocusOut)
    }
  }, [])

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

  // Render-split markers inject live/couple-owned content on the sent document,
  // so a per-block background / border / radius does nothing there and would
  // only tint the editor preview (the misleading white-cards-on-colour case).
  // Strip those overrides for markers — their surface comes from the brand
  // Surface colour. Typography overrides still apply. Exception: the
  // style-wrapping markers (questionnaire form blocks) keep their frame, which
  // wraps the questions area exactly like a normal block.
  const isMarkerBlock = isMarker(block.type) && !stylesWrapMarker(block.type)
  const borderWidth = isMarkerBlock ? 0 : (block.borderWidth ?? 0)
  const borderColor = block.borderColor || '#E5E7EB'
  const blockRadius = isMarkerBlock ? undefined : block.blockRadius
  const rawOuterStyle = blockOuterStyle(block, { cornerRadius: state.cornerRadius })
  const outerStyle = isMarkerBlock ? { ...rawOuterStyle, background: undefined } : rawOuterStyle
  // The full "box" style (padding, background, border, radius, maxWidth,
  // align, spacing): everything blockOuterStyle produces plus the border
  // overrides below, folded together because both describe the same visual
  // box, just with the border fields resolved from a few more inputs.
  const boxStyle: CSSProperties = {
    ...outerStyle,
    borderWidth: borderWidth || outerStyle.borderWidth,
    borderStyle: (borderWidth || outerStyle.borderWidth) ? 'solid' : undefined,
    borderColor: (borderWidth || outerStyle.borderWidth) ? borderColor : undefined,
    borderRadius: blockRadius ?? (borderWidth ? state.cornerRadius : outerStyle.borderRadius),
  }
  const isPageFrame = frame === 'page'
  // The dragged height floor, only for blocks the frame sizes.
  const frameHeight = !SELF_SIZED_TYPES.has(block.type) && block.blockHeightPx ? block.blockHeightPx : undefined

  const blockNode = (
    <div
      ref={(node) => {
        setNodeRef(node)
        blockRef.current = node
      }}
      data-block-id={id}
      // Mirrors the public renderer's PageSection, which already tags every
      // section with its type. Lets tooling and e2e target a block by what it
      // IS rather than by matching its rendered copy, which changes with the
      // MC's own text.
      data-block-type={block.type}
      data-selected={selected || undefined}
      style={{
        // In page mode the box style (padding/background/border/radius/
        // maxWidth/align/spacing) is rendered inside the <PageSection> below
        // instead of here, mirroring the public renderer's BlockOuter, which
        // nests the same style inside the section rather than around it,
        // otherwise a maxWidthPx/align on this full-width sortable wrapper
        // would constrain the whole section instead of just its content.
        ...(isPageFrame ? {} : boxStyle),
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : selected ? 20 : undefined,
        willChange: isDragging ? 'transform' : undefined,
        minHeight: frameHeight,
        display: frameHeight ? 'flex' : undefined,
        flexDirection: frameHeight ? 'column' : undefined,
        justifyContent: frameHeight
          ? (block.blockVAlign === 'top' ? 'flex-start' : block.blockVAlign === 'bottom' ? 'flex-end' : 'center')
          : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(e.shiftKey || e.metaKey || e.ctrlKey)
        // Target the clicked sub-element (title, subtitle, a totals row, …) so
        // the toolbar styles it; clicking anywhere else in the block clears back
        // to the control's default target.
        const part = (e.target as HTMLElement).closest('[data-subtarget]')
        setActiveSubTarget(part && blockRef.current?.contains(part) ? part.getAttribute('data-subtarget') : null)
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
        className={`absolute inset-0 pointer-events-none rounded-control transition`}
        style={{
          borderWidth: !editing && (selected || multiSelected) ? 2 : 1,
          borderStyle: 'solid',
          // While editing an inner field, drop the brand-coloured outline so it
          // does not obscure the block's own background/colours.
          borderColor: editing
            ? 'transparent'
            : selected
              ? selectionColor
              : multiSelected
                ? `${selectionColor}99`
                : 'transparent',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none rounded-control border border-transparent group-hover:border-border-strong/70 transition"
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
          className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center w-5 h-5 rounded-control text-text-subtle hover:text-gray-700 hover:bg-surface-emphasis/80"
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Horizontal document padding is applied once here (matching the public
          BlockOuter), not inside each block, so the whole document shares one
          inset. Only the empty spacer is exempt. In page mode, `children` is
          already a `<PageSection>` (see BlockRenderer) that owns its own
          full-bleed background and inner `max-w-doc-page` gutter, so adding
          the doc padding here as well would inset it a second time and stop
          section backgrounds reaching the canvas edge. */}
      {HPAD_EXEMPT_TYPES.has(block.type) || isPageFrame ? (
        isPageFrame ? applyBoxStyleInsideSection(children, hasOuterStyle(block) ? boxStyle : undefined) : children
      ) : (
        <div className={DENSITY_PADDING[state.density].docX}>{children}</div>
      )}

      {/* Block resize handle, for every block that does not size itself
          (see SELF_SIZED_TYPES). */}
      {!SELF_SIZED_TYPES.has(block.type) && (
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
          className="absolute left-1/2 -translate-x-1/2 -bottom-3 z-10 w-6 h-6 rounded-pill bg-surface border border-border shadow-sm flex items-center justify-center text-text-subtle hover:text-text hover:border-border-strong opacity-0 group-hover:opacity-100 transition cursor-pointer"
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
            {...(toolbarBoundary ? { collisionBoundary: toolbarBoundary, sticky: 'always' as const } : {})}
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
              activeSubTarget={activeSubTarget}
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
      className="fixed z-[80] w-[180px] bg-surface border border-border rounded-control shadow-xl p-1 animate-modal-in"
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
          className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-control text-body text-left cursor-pointer transition ${
            item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className={item.danger ? 'text-red-500' : 'text-text-subtle'}>{item.icon}</span>
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
      <div className="h-1 w-10 rounded-pill bg-gray-900/60 ring-1 ring-white/80 shadow-sm" />
    </div>
  )
}
