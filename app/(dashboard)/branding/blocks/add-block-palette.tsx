'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, ImageIcon, Type, Table, CreditCard, MessageSquare, Activity, Minus, Image, User, AlignLeft } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { BLOCK_LABELS, BLOCK_DESCRIPTIONS, type BlockType } from './types'

const BLOCK_ICONS: Partial<Record<BlockType, typeof ImageIcon>> = {
  headerBanner: Image,
  businessName: User,
  tagline: AlignLeft,
  title: Type,
  lineItems: Table,
  totals: CreditCard,
  message: MessageSquare,
  action: Activity,
  divider: Minus,
}

const BLOCK_ORDER: BlockType[] = [
  'headerBanner',
  'businessName',
  'tagline',
  'title',
  'lineItems',
  'totals',
  'message',
  'action',
  'divider',
]

interface AddBlockPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (type: BlockType) => void
  trigger: React.ReactNode
}

export function AddBlockPalette({ open, onOpenChange, onAdd, trigger }: AddBlockPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = BLOCK_ORDER.filter((type) => {
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
                return (
                  <button
                    key={type}
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
                )
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
