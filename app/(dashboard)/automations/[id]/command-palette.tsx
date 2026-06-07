/**
 * Notion-style command palette - rendered as an anchored popover.
 *
 * The trigger / action pickers position this near the canvas node
 * that was clicked, rather than centring it. We accept an `anchor`
 * {x, y} in viewport coordinates and clamp the rendered position
 * so it stays on-screen.
 *
 * Click-outside or Escape closes the palette. No backdrop overlay
 * - the canvas stays visually live behind the popover.
 *
 * @module app/(dashboard)/automations/[id]/command-palette
 */
'use client'

import { type LucideIcon, Search } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

export interface PaletteItem {
  id: string
  group: string
  label: string
  description?: string
  icon?: LucideIcon
  disabled?: boolean
  active?: boolean
}

export interface PaletteAnchor {
  x: number
  y: number
}

interface Props {
  title: string
  placeholder: string
  items: PaletteItem[]
  groupOrder: ReadonlyArray<{ slug: string; label: string }>
  anchor: PaletteAnchor
  /** Optional content rendered below the items (e.g. a "Remove" / destructive action). */
  footer?: React.ReactNode
  onClose: () => void
  onPick: (id: string) => void
}

const POPOVER_WIDTH = 360
const POPOVER_MAX_HEIGHT = 420
const EDGE_PADDING = 12

export function CommandPalette({
  title,
  placeholder,
  items,
  groupOrder,
  anchor,
  footer,
  onClose,
  onPick,
}: Props) {
  const [search, setSearch] = useState('')
  const [highlight, setHighlight] = useState(0)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>({
    left: anchor.x,
    top: anchor.y,
  })

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return items
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(s) ||
        (i.description ?? '').toLowerCase().includes(s) ||
        i.group.toLowerCase().includes(s),
    )
  }, [items, search])

  const flat = useMemo(() => {
    const result: PaletteItem[] = []
    for (const group of groupOrder) {
      for (const i of filtered) {
        if (i.group === group.slug && !i.disabled) result.push(i)
      }
    }
    return result
  }, [filtered, groupOrder])

  useEffect(() => {
    setHighlight(0)
  }, [search])

  // Edge-guard: clamp the popover inside the viewport after mount
  // (and any time the anchor coords change).
  useLayoutEffect(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const node = popoverRef.current
    const height = node?.offsetHeight ?? POPOVER_MAX_HEIGHT
    const width = node?.offsetWidth ?? POPOVER_WIDTH

    let left = anchor.x
    let top = anchor.y + 8 // slight offset below the click
    if (left + width + EDGE_PADDING > vw) {
      left = Math.max(EDGE_PADDING, vw - width - EDGE_PADDING)
    }
    if (top + height + EDGE_PADDING > vh) {
      top = Math.max(EDGE_PADDING, anchor.y - height - 8)
    }
    if (left < EDGE_PADDING) left = EDGE_PADDING
    if (top < EDGE_PADDING) top = EDGE_PADDING
    setPosition({ left, top })
  }, [anchor.x, anchor.y, flat.length])

  // Escape to close. Click-outside is handled by a transparent
  // overlay rendered behind the popover (more reliable than a
  // document mousedown listener, especially over canvases like
  // React Flow that capture pointer events themselves).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function move(delta: number) {
    if (flat.length === 0) return
    setHighlight((h) => (h + delta + flat.length) % flat.length)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const picked = flat[highlight]
      if (picked) onPick(picked.id)
    }
  }

  return (
    <>
      {/* Invisible click-catcher behind the popover. Anything that
          isn't the popover itself closes it on mousedown. */}
      <div
        className="fixed inset-0 z-40"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      />
      <div
        ref={popoverRef}
        role="dialog"
        aria-label={title}
        style={{ left: position.left, top: position.top, width: POPOVER_WIDTH }}
        className="fixed z-50 bg-white rounded-xl border border-gray-200 shadow-xl flex flex-col overflow-hidden"
        onKeyDown={handleKey}
      >
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <Search size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
        <input
          type="text"
          autoFocus
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
          aria-label={title}
        />
      </div>
      <div className="overflow-y-auto py-1" style={{ maxHeight: POPOVER_MAX_HEIGHT - 50 }}>
        {flat.length === 0 ? (
          <div className="px-3 py-6 text-xs text-gray-500 text-center">No matches</div>
        ) : (
          groupOrder.map((group) => {
            const inGroup = filtered.filter((i) => i.group === group.slug)
            if (inGroup.length === 0) return null
            return (
              <div key={group.slug} className="mb-1">
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">
                  {group.label}
                </div>
                {inGroup.map((item) => {
                  const flatIndex = flat.indexOf(item)
                  const isHighlighted = flatIndex === highlight
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={item.disabled}
                      onMouseEnter={() => flatIndex >= 0 && setHighlight(flatIndex)}
                      onClick={() => !item.disabled && onPick(item.id)}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-3 transition cursor-pointer disabled:cursor-default ${
                        isHighlighted ? 'bg-gray-50' : ''
                      } ${item.disabled ? 'opacity-50' : ''} ${item.active ? 'text-brand' : 'text-gray-900'}`}
                    >
                      {Icon && (
                        <Icon
                          size={14}
                          strokeWidth={1.5}
                          className={`shrink-0 ${item.active ? 'text-brand' : 'text-gray-400'}`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{item.label}</div>
                        {item.description && (
                          <div className="text-xs text-gray-500 truncate">{item.description}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
      {footer && (
        <div className="border-t border-gray-100">{footer}</div>
      )}
      </div>
    </>
  )
}
