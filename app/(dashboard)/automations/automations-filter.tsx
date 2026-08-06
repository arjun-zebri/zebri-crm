/**
 * Status filter pills + search input.
 *
 * Hidden when the user has fewer than 5 automations - at that
 * scale the list itself is the filter. The home page passes the
 * total count so this component decides whether to render.
 *
 * Local state only; the parent reads selected status + query via
 * the `onChange` handler.
 *
 * @module app/(dashboard)/automations/automations-filter
 */
'use client'

import { Search } from 'lucide-react'

import type { AutomationStatus } from '@/types/automations'

export type StatusFilter = 'all' | AutomationStatus

interface Props {
  totalAutomations: number
  status: StatusFilter
  query: string
  onStatusChange: (s: StatusFilter) => void
  onQueryChange: (q: string) => void
}

const PILLS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
]

export function AutomationsFilter({
  totalAutomations,
  status,
  query,
  onStatusChange,
  onQueryChange,
}: Props) {
  if (totalAutomations < 5) return null

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1">
        {PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onStatusChange(p.value)}
            className={`text-xs px-2.5 py-1 rounded-control transition cursor-pointer ${
              status === p.value
                ? 'bg-text text-surface'
                : 'text-text-muted hover:text-text hover:bg-surface-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 px-2.5 py-1 bg-surface-muted rounded-control ml-auto min-w-[200px] max-w-xs">
        <Search size={13} strokeWidth={1.5} className="text-text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search…"
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-text-muted"
        />
      </div>
    </div>
  )
}

/**
 * Pure filter - applied to the enriched list before render. Lives
 * here so the unit test can import it without React.
 */
export function applyFilter<T extends { status: AutomationStatus; name: string; triggerLabel: string }>(
  rows: T[],
  status: StatusFilter,
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  return rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false
    if (!q) return true
    return r.name.toLowerCase().includes(q) || r.triggerLabel.toLowerCase().includes(q)
  })
}
