/**
 * The Statuses dropdown on the calendar header.
 *
 * Narrows the weddings drawn on the grid to couples in the ticked statuses.
 * Bookings and external busy time are deliberately NOT filtered by it: those
 * are commitments the MC has already made, and hiding one is a way to
 * double-book. Only the wedding layer, which is a pipeline view, is filtered.
 *
 * `null` means "no filter applied" rather than an empty set, so an MC who has
 * never touched the control sees everything, and unticking the last status
 * shows nothing rather than silently resetting.
 *
 * @module app/(dashboard)/calendar/_components/calendar-status-filter
 */
'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { MenuPanel } from '@/components/ui/menu'
import { isChromePress } from '@/components/ui/use-overlay'
import type { CoupleStatusRecord } from '@/types/couple'

/** Props for {@link CalendarStatusFilter}. */
export interface CalendarStatusFilterProps {
  /** The MC's configured couple statuses, in display order. */
  statuses: CoupleStatusRecord[]
  /** Ticked slugs, or `null` when no filter is applied (everything shows). */
  activeStatuses: Set<string> | null
  /** Toggle one status slug on or off. */
  onToggle: (slug: string) => void
}

/**
 * Multi-select status filter. See {@link CalendarStatusFilterProps}.
 *
 * Dismissal is a hand-managed outside-click listener rather than a Radix
 * popover so it matches the view switcher sitting beside it in the header.
 */
export function CalendarStatusFilter({
  statuses,
  activeStatuses,
  onToggle,
}: CalendarStatusFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) && !isChromePress(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Nothing to filter by until the statuses query resolves. Rendering the
  // trigger over an empty list would open a blank panel.
  if (statuses.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        onClick={() => setOpen(!open)}
        className="whitespace-nowrap"
        aria-expanded={open}
      >
        <span>Statuses</span>
        <ChevronDown size={11} strokeWidth={1.5} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1">
          <MenuPanel className="px-2.5 py-2 space-y-2">
            {statuses.map((status) => (
              <Checkbox
                key={status.slug}
                label={status.name}
                checked={activeStatuses === null || activeStatuses.has(status.slug)}
                onChange={() => onToggle(status.slug)}
              />
            ))}
          </MenuPanel>
        </div>
      )}
    </div>
  )
}
