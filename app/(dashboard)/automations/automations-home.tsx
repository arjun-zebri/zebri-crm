/**
 * /automations home - orchestrates the sub-sections.
 *
 * State (filter, query, pagination) lives on the parent page so
 * the pagination footer can render outside the scroll container,
 * anchored to the viewport bottom. This component renders the
 * content above that footer.
 *
 * Layout: health banner (only on errors) · stats cards · tabs ·
 * toolbar (search + Filter + Sort) · table.
 *
 * @module app/(dashboard)/automations/automations-home
 */
'use client'

import {
  Activity,
  ArrowUp,
  FileEdit,
  Filter as FilterIcon,
  LayoutList,
  Pause,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react'

import type { AutomationsHomePayload, EnrichedAutomationRow } from '@/types/automations'

import { type StatusFilter } from './automations-filter'
import { AutomationsTable } from './automations-table'
import { HealthBanner } from './health-banner'
import { StatsCards } from './stats-cards'

interface Props {
  payload: AutomationsHomePayload | null
  /** Slice the parent already filtered + paged for us. */
  paged: EnrichedAutomationRow[]
  pending: boolean
  statusFilter: StatusFilter
  query: string
  onStatusChange: (s: StatusFilter) => void
  onQueryChange: (q: string) => void
  onOpen: (id: string) => void
  onCreate: () => void
  onChange: () => void
}

const TABS: { value: StatusFilter; label: string; icon: LucideIcon }[] = [
  { value: 'all', label: 'All', icon: LayoutList },
  { value: 'active', label: 'Active', icon: Activity },
  { value: 'paused', label: 'Paused', icon: Pause },
  { value: 'draft', label: 'Draft', icon: FileEdit },
]

export function AutomationsHome({
  payload,
  paged,
  pending,
  statusFilter,
  query,
  onStatusChange,
  onQueryChange,
  onOpen,
  onCreate,
  onChange,
}: Props) {
  const loading = payload === null

  // Empty (loaded + no automations): full-bleed empty state.
  if (!loading && payload && payload.automations.length === 0) {
    return <EmptyState onCreate={onCreate} pending={pending} />
  }

  const tabCounts = {
    all: payload?.automations.length ?? 0,
    active: payload?.automations.filter((a) => a.status === 'active').length ?? 0,
    paused: payload?.automations.filter((a) => a.status === 'paused').length ?? 0,
    draft: payload?.automations.filter((a) => a.status === 'draft').length ?? 0,
  }

  return (
    <div className="space-y-5">
      {payload && (
        <HealthBanner
          erroredCount={payload.stats.erroredLast7d}
          firstErrorAutomationId={payload.firstErrorAutomationId}
          firstErrorAutomationName={payload.firstErrorAutomationName}
        />
      )}

      {payload ? <StatsCards payload={payload} /> : <StatsCardsSkeleton />}

      <Tabs status={statusFilter} onChange={onStatusChange} counts={tabCounts} loading={loading} />

      <Toolbar query={query} onQueryChange={onQueryChange} />

      {loading || paged.length > 0 ? (
        <AutomationsTable
          automations={paged}
          loading={loading}
          onOpen={onOpen}
          onChange={onChange}
        />
      ) : (
        <div className="text-sm text-text-muted px-1 py-12 text-center border border-border rounded-xl bg-surface">
          No automations match.
        </div>
      )}
    </div>
  )
}

/* ─── Tabs (spaced, with icons) ───────────────────────────────── */

function Tabs({
  status,
  onChange,
  counts,
  loading,
}: {
  status: StatusFilter
  onChange: (s: StatusFilter) => void
  counts: { all: number; active: number; paused: number; draft: number }
  loading: boolean
}) {
  return (
    <div className="flex items-center gap-6 border-b border-gray-200">
      {TABS.map((t) => {
        const active = status === t.value
        const Icon = t.icon
        const count = counts[t.value as keyof typeof counts] ?? 0
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`flex items-center gap-1.5 pb-2.5 -mb-px text-sm transition cursor-pointer ${
              active
                ? 'text-gray-900 font-medium border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon size={13} strokeWidth={1.5} />
            <span>{t.label}</span>
            {!loading && <span className="text-xs text-gray-400">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ─── Toolbar (search + Filter + Sort) ───────────────────────── */

function Toolbar({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (q: string) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative w-full sm:w-56">
        <Search
          size={11}
          strokeWidth={1.5}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search automations..."
          className="w-full border border-gray-200 rounded-md pl-6 pr-6 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 transition"
        />
        {query && (
          <button
            onClick={() => onQueryChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition cursor-pointer p-0.5"
            aria-label="Clear search"
          >
            <X size={10} strokeWidth={2} />
          </button>
        )}
      </div>
      <button
        type="button"
        className="flex items-center gap-1 border border-gray-200 rounded-md px-2 py-2 text-xs text-gray-500 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
        title="Filter (coming soon)"
      >
        <FilterIcon size={11} strokeWidth={1.5} />
        <span>Filter</span>
      </button>
      <button
        type="button"
        className="flex items-center gap-1 border border-gray-200 rounded-md px-2 py-2 text-xs text-gray-500 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
        title="Sort (coming soon)"
      >
        <ArrowUp size={11} strokeWidth={1.5} />
        <span>Sort</span>
      </button>
    </div>
  )
}

/* ─── Stats cards skeleton ────────────────────────────────────── */

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="border border-border rounded-xl bg-surface px-4 py-3 flex items-center gap-3 animate-pulse"
        >
          <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2.5 w-20 bg-gray-100 rounded" />
            <div className="h-5 w-10 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Empty state ─────────────────────────────────────────────── */

function EmptyState({ onCreate, pending }: { onCreate: () => void; pending: boolean }) {
  // The empty state lives inside the scroll area below the page
  // header (~88px tall). `flex-1 items-center justify-center`
  // would centre it within that area, leaving it ~44px below the
  // viewport's true centre. Padding-bottom equal to the header
  // height pulls the centred content up by half of it, so it
  // lands at the actual viewport vertical centre.
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center pb-[88px]">
      <Sparkles size={32} strokeWidth={1.5} className="text-text-subtle mb-3" />
      <h2 className="text-base font-medium mb-1">No automations yet</h2>
      <p className="text-sm text-text-muted mb-6 max-w-sm">
        Set up the work that happens for every couple, without you lifting a finger.
      </p>
      <button
        onClick={onCreate}
        disabled={pending}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 transition cursor-pointer disabled:opacity-50"
      >
        New automation
      </button>
    </div>
  )
}
