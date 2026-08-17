'use client'

import * as Popover from '@radix-ui/react-popover'
import { Search, ImageIcon, Type, Table, CreditCard, Landmark, Pilcrow, Minus, Image, User, AlignLeft, PanelBottom, MoveVertical, Calculator, LayoutDashboard, FileSignature, CalendarClock, Clock, ClipboardList, SquareStack, Users2, Mail, Phone, Calendar, MapPin, HelpCircle, MessageSquare, PencilLine, Send, TextCursorInput } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { SurfaceTab } from '@/types/branding-preview'

import { paletteGroupsForSurface, type PaletteEntry } from './blocks-by-surface'
import { type BlockType } from './types'

const BLOCK_ICONS: Partial<Record<BlockType, typeof ImageIcon>> = {
  headerBanner: Image,
  businessName: User,
  tagline: AlignLeft,
  title: Type,
  lineItems: Table,
  totals: Calculator,
  paymentDetails: Landmark,
  text: Pilcrow,
  action: CreditCard,
  divider: Minus,
  image: Image,
  spacer: MoveVertical,
  footer: PanelBottom,
  couplePortal: LayoutDashboard,
  contractBody: FileSignature,
  paymentSchedule: CalendarClock,
  vendorTimelineBody: Clock,
  questionnaireOneAtATime: SquareStack,
  questionnaireAllOnePage: ClipboardList,
  formField: TextCursorInput,
  formSubmit: Send,
}

/** Icons for preset palette entries (keyed by entry key), over the type icon. */
const ENTRY_ICONS: Record<string, typeof ImageIcon> = {
  'lead-name': User,
  'lead-partner': Users2,
  'lead-email': Mail,
  'lead-phone': Phone,
  'lead-date': Calendar,
  'lead-venue': MapPin,
  'lead-referral': HelpCircle,
  'lead-message': MessageSquare,
  'lead-custom': PencilLine,
}

interface AddBlockPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (entry: PaletteEntry) => void
  trigger: React.ReactNode
  /** The surface for which blocks are being added. Controls which blocks are available. */
  surface: SurfaceTab
}

export function AddBlockPalette({ open, onOpenChange, onAdd, trigger, surface }: AddBlockPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const groups = paletteGroupsForSurface(surface)

  // Build flat list of filtered entries and track which group each belongs to
  const flatBlocks: { entry: PaletteEntry; group: string }[] = []
  const groupHeaders: Map<string, number> = new Map() // group name -> first index in flatBlocks

  for (const group of groups) {
    const q = query.toLowerCase().trim()
    const filteredEntries = group.entries.filter((entry) => {
      if (!q) return true
      return (
        (entry.label ?? '').toLowerCase().includes(q) ||
        (entry.description ?? '').toLowerCase().includes(q) ||
        entry.type.toLowerCase().includes(q)
      )
    })

    if (filteredEntries.length > 0) {
      groupHeaders.set(group.label, flatBlocks.length)
      for (const entry of filteredEntries) {
        flatBlocks.push({ entry, group: group.label })
      }
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setQuery('')
      setActiveIndex(0)
    }
    onOpenChange(newOpen)
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(prev => {
      if (flatBlocks.length > 0 && prev >= flatBlocks.length) {
        return 0
      }
      return prev
    })
  }, [flatBlocks.length])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, flatBlocks.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = flatBlocks[activeIndex]
      if (picked) {
        onAdd(picked.entry)
        onOpenChange(false)
      }
    } else if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="bg-surface border border-border rounded-control shadow-2xl z-[60] w-[360px] animate-modal-in"
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
            <Search size={14} strokeWidth={1.75} className="text-text-subtle shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search blocks…"
              className="flex-1 text-body bg-transparent outline-none placeholder:text-text-subtle"
            />
            <kbd className="text-[10px] text-text-subtle bg-gray-50 border border-border rounded-control px-1.5 py-0.5 font-mono">
              esc
            </kbd>
          </div>

          <div className="max-h-[320px] overflow-y-auto p-1">
            {flatBlocks.length === 0 ? (
              <p className="text-body text-text-subtle text-center py-6">No matching blocks</p>
            ) : (
              flatBlocks.map(({ entry, group }, idx) => {
                const Icon = ENTRY_ICONS[entry.key] ?? BLOCK_ICONS[entry.type] ?? Type
                const active = idx === activeIndex
                // Header before the first item of each group present.
                const showHeader = idx === 0 || flatBlocks[idx - 1]?.group !== group
                return (
                  <div key={entry.key}>
                    {showHeader ? (
                      <p className="px-2.5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-subtle">
                        {group}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        onAdd(entry)
                        handleOpenChange(false)
                      }}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-control text-left transition cursor-pointer ${
                        active ? 'bg-surface-emphasis' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-9 h-9 rounded-control bg-surface border border-border flex items-center justify-center shrink-0">
                        <Icon size={15} strokeWidth={1.5} className="text-text-muted" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-body font-medium text-text">{entry.label}</span>
                        <span className="block text-body text-text-muted truncate">{entry.description}</span>
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
