'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, ImageIcon, Type, Table, CreditCard, Landmark, Pilcrow, Activity, Minus, Image, User, AlignLeft, PanelBottom } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'

import type { SurfaceTab } from '@/types/branding-preview'

import { blocksForSurface } from './blocks-by-surface'
import { BLOCK_LABELS, BLOCK_DESCRIPTIONS, type BlockType } from './types'

const BLOCK_ICONS: Partial<Record<BlockType, typeof ImageIcon>> = {
  headerBanner: Image,
  businessName: User,
  tagline: AlignLeft,
  title: Type,
  lineItems: Table,
  totals: CreditCard,
  paymentDetails: Landmark,
  text: Pilcrow,
  action: Activity,
  divider: Minus,
  image: Image,
  footer: PanelBottom,
}

// Blocks are grouped by intent (Structure / Content / Action) so the
// palette reads like Canva's insert menu: scannable categories instead
// of one long list. The flat BLOCK_ORDER + GROUP_OF derive from this so
// search + keyboard nav stay index-based against a single ordered list.
const BLOCK_GROUPS: { label: string; types: BlockType[] }[] = [
  { label: 'Structure', types: ['headerBanner', 'businessName', 'tagline', 'divider', 'image', 'footer'] },
  { label: 'Content', types: ['title', 'text', 'lineItems', 'totals', 'paymentDetails'] },
  { label: 'Action', types: ['action'] },
]

const BLOCK_ORDER: BlockType[] = BLOCK_GROUPS.flatMap((g) => g.types)

const GROUP_OF: Partial<Record<BlockType, string>> = Object.fromEntries(
  BLOCK_GROUPS.flatMap((g) => g.types.map((t) => [t, g.label] as const)),
)

interface AddBlockPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (type: BlockType) => void
  trigger: React.ReactNode
  /** The surface for which blocks are being added. Controls which blocks are available. */
  surface: SurfaceTab
}

export function AddBlockPalette({ open, onOpenChange, onAdd, trigger, surface }: AddBlockPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allowedBlocks = blocksForSurface(surface)

  const filtered = BLOCK_ORDER.filter((type) => {
    // First check if this block type is available for the current surface
    if (!allowedBlocks.includes(type)) return false

    const q = query.toLowerCase().trim()
    if (!q) return true
    return (
      BLOCK_LABELS[type].toLowerCase().includes(q) ||
      BLOCK_DESCRIPTIONS[type].toLowerCase().includes(q) ||
      type.toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30)
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0)
  }, [filtered.length, activeIndex])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = filtered[activeIndex]
      if (picked) {
        onAdd(picked)
        onOpenChange(false)
      }
    } else if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl z-[60] w-[360px] animate-modal-in"
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
            <Search size={14} strokeWidth={1.75} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search blocks…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
            />
            <kbd className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 font-mono">
              esc
            </kbd>
          </div>

          <div className="max-h-[320px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No matching blocks</p>
            ) : (
              filtered.map((type, idx) => {
                const Icon = BLOCK_ICONS[type] ?? Type
                const active = idx === activeIndex
                const group = GROUP_OF[type]
                // Header before the first item of each group present.
                const showHeader = idx === 0 || GROUP_OF[filtered[idx - 1]!] !== group
                return (
                  <div key={type}>
                    {showHeader && group ? (
                      <p className="px-2.5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                        {group}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        onAdd(type)
                        onOpenChange(false)
                      }}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                        active ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        <Icon size={15} strokeWidth={1.75} className="text-gray-500" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-900">{BLOCK_LABELS[type]}</span>
                        <span className="block text-xs text-gray-500 truncate">{BLOCK_DESCRIPTIONS[type]}</span>
                      </span>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
