'use client'

import { List, LayoutGrid, Plus, Search, SlidersHorizontal, ArrowUpDown, Upload, X, Settings2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { MenuItem, MenuPanel } from '@/components/ui/menu'
import { PageHeader } from '@/components/ui/page-header'
import { isChromePress } from '@/components/ui/use-overlay'
import {
  Couple,
  CoupleStatusRecord,
  ViewMode,
  SortField,
  SortDirection,
  SORT_OPTIONS,
} from '@/types/couple'

interface CouplesHeaderProps {
  couples: Couple[]
  statuses: CoupleStatusRecord[]
  onAddClick: () => void
  onImportClick: () => void
  onManageStatuses: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  search: string
  onSearchChange: (search: string) => void
  statusFilter: string | 'all'
  onStatusFilterChange: (status: string | 'all') => void
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField, direction: SortDirection) => void
}

export function CouplesHeader({
  couples,
  statuses,
  onAddClick,
  onImportClick,
  onManageStatuses,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortField,
  sortDirection,
  onSortChange,
}: CouplesHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [mobileAddOpen, setMobileAddOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLDivElement>(null)
  const mobileAddRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          searchInputRef.current?.focus()
        }
      }
      if (e.key === 'Escape') {
        onSearchChange('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSearchChange])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node) && !isChromePress(e.target)) {
        setFiltersOpen(false)
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node) && !isChromePress(e.target)) {
        setSortOpen(false)
      }
      if (addRef.current && !addRef.current.contains(e.target as Node) && !isChromePress(e.target)) {
        setAddOpen(false)
      }
      if (mobileAddRef.current && !mobileAddRef.current.contains(e.target as Node) && !isChromePress(e.target)) {
        setMobileAddOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const countByStatus = (slug: string) =>
    couples.filter((c) => c.status === slug).length

  const hasActiveFilter = statusFilter !== 'all'
  const activeFilterLabel =
    statuses.find((s) => s.slug === statusFilter)?.name ?? statusFilter
  const activeSortLabel =
    SORT_OPTIONS.find(
      (o) => o.field === sortField && o.direction === sortDirection
    )?.label ?? ''

  return (
    <div>
      <PageHeader
        title="Couples"
        count={couples.length}
        className="mb-4"
        actions={
          <div className="relative sm:hidden" ref={mobileAddRef}>
          <Button
            iconOnly
            onClick={() => setMobileAddOpen((o) => !o)}
            aria-label="New couple"
            className="rounded-pill"
          >
            <Plus size={16} strokeWidth={1.5} />
          </Button>
          {mobileAddOpen && (
            <div className="absolute right-0 top-full z-30 mt-1">
              <MenuPanel>
                <MenuItem size="sm" onClick={() => { setMobileAddOpen(false); onAddClick() }}>
                  <span className="flex items-center gap-2">
                    <Plus size={13} strokeWidth={1.5} /> Add manually
                  </span>
                </MenuItem>
                <MenuItem size="sm" onClick={() => { setMobileAddOpen(false); onImportClick() }}>
                  <span className="flex items-center gap-2">
                    <Upload size={13} strokeWidth={1.5} /> Import from CSV
                  </span>
                </MenuItem>
              </MenuPanel>
            </div>
          )}
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {/* Search */}
        <div className="relative w-full sm:w-56">
          <Search
            size={11}
            strokeWidth={1.5}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search couples..."
            // Matches `Input size="sm"` exactly. Not the primitive itself:
            // this field carries a leading icon and a trailing clear button,
            // and Input has no prefix/suffix slot yet.
            className="block h-8 w-full rounded-control border border-border bg-surface pl-6 pr-6 text-body text-text transition-colors placeholder:text-text-subtle focus-visible:border-brand-fg focus-visible:outline-none"
          />
          {search && (
            <button
              onClick={() => {
                onSearchChange('')
                searchInputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer p-0.5 text-text-subtle transition-colors hover:text-text"
            >
              <X size={10} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Filter button - desktop only; mobile uses status chips below */}
        <div className="relative hidden sm:block" ref={filtersRef}>
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`whitespace-nowrap ${hasActiveFilter ? 'bg-surface-emphasis' : ''}`}
          >
            <SlidersHorizontal size={11} strokeWidth={1.5} />
            <span>{hasActiveFilter ? activeFilterLabel : 'Filter'}</span>
            {hasActiveFilter && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusFilterChange('all')
                }}
                className="ml-0.5 cursor-pointer text-text-subtle hover:text-text"
              >
                <X size={10} strokeWidth={1.5} />
              </span>
            )}
          </Button>
          {filtersOpen && (
            <div className="absolute left-0 top-full z-20 mt-1">
              <MenuPanel>
                <MenuItem
                  size="sm"
                  selected={statusFilter === 'all'}
                  onClick={() => {
                    onStatusFilterChange('all')
                    setFiltersOpen(false)
                  }}
                >
                  All ({couples.length})
                </MenuItem>
                {statuses.map((status) => (
                  <MenuItem
                    key={status.slug}
                    size="sm"
                    selected={statusFilter === status.slug}
                    onClick={() => {
                      onStatusFilterChange(status.slug)
                      setFiltersOpen(false)
                    }}
                  >
                    {status.name} ({countByStatus(status.slug)})
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>
          )}
        </div>

        {/* Sort button */}
        <div className="relative" ref={sortRef}>
          <Button
            variant="outline"
            onClick={() => setSortOpen(!sortOpen)}
            className="whitespace-nowrap"
          >
            <ArrowUpDown size={11} strokeWidth={1.5} />
            <span>{activeSortLabel || 'Sort'}</span>
          </Button>
          {sortOpen && (
            <div className="absolute left-0 top-full z-20 mt-1">
              <MenuPanel>
                {SORT_OPTIONS.map((option) => (
                  <MenuItem
                    key={`${option.field}-${option.direction}`}
                    size="sm"
                    selected={sortField === option.field && sortDirection === option.direction}
                    onClick={() => {
                      onSortChange(option.field, option.direction)
                      setSortOpen(false)
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>
          )}
        </div>

        {/* Status manager + New couple. The gear opens the status editor
            (statuses define the kanban columns); the split button covers
            "Add manually" and "Import from CSV". */}
        <div className="ml-auto flex items-center gap-2">
          {/* Gear opens the status editor (rename/recolour/reorder/add/delete).
              Statuses define the kanban columns, so management lives here
              rather than under Settings. Visible in both List and Board views. */}
          <Button
            variant="outline"
            iconOnly
            onClick={onManageStatuses}
            aria-label="Manage statuses"
            title="Manage statuses"
          >
            <Settings2 size={11} strokeWidth={1.5} />
          </Button>
          {/* New couple dropdown - desktop only. Splits the primary action
              into "Add manually" and "Import from CSV" so the bulk path is
              discoverable without crowding the toolbar. */}
          <div className="hidden sm:block relative" ref={addRef}>
            <Button onClick={() => setAddOpen((o) => !o)}>
              <Plus size={11} strokeWidth={1.5} />
              New couple
            </Button>
            {addOpen && (
              <div className="absolute right-0 top-full z-30 mt-1">
                <MenuPanel>
                  <MenuItem
                    size="sm"
                    onClick={() => { setAddOpen(false); onAddClick() }}
                  >
                    <span className="flex items-center gap-2">
                      <Plus size={13} strokeWidth={1.5} /> Add manually
                    </span>
                  </MenuItem>
                  <MenuItem
                    size="sm"
                    onClick={() => { setAddOpen(false); onImportClick() }}
                  >
                    <span className="flex items-center gap-2">
                      <Upload size={13} strokeWidth={1.5} /> Import from CSV
                    </span>
                  </MenuItem>
                </MenuPanel>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex items-center gap-6 border-b border-border mt-6">
        <button
          onClick={() => onViewModeChange('kanban')}
          className={`pb-2 text-body font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'kanban'
              ? 'border-gray-900 text-text'
              : 'border-transparent text-text-subtle hover:text-gray-600'
          }`}
        >
          <LayoutGrid size={15} strokeWidth={1.5} /> Board
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`pb-2 text-body font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'list'
              ? 'border-gray-900 text-text'
              : 'border-transparent text-text-subtle hover:text-gray-600'
          }`}
        >
          <List size={15} strokeWidth={1.5} /> List
        </button>
      </div>

      {/* Mobile status filter chips - replaces the filter dropdown on mobile; hidden on board view */}
      <div className={`sm:hidden overflow-x-auto flex gap-2 pt-3 -mx-6 px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${viewMode === 'kanban' ? 'hidden' : ''}`}>
        <button
          onClick={() => onStatusFilterChange('all')}
          className={`flex-none px-3 py-1.5 rounded-pill text-body font-medium whitespace-nowrap transition cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-surface-emphasis text-gray-600 active:bg-gray-200'
          }`}
        >
          All
        </button>
        {statuses.map((status) => (
          <button
            key={status.slug}
            onClick={() => onStatusFilterChange(status.slug)}
            className={`flex-none px-3 py-1.5 rounded-pill text-body font-medium whitespace-nowrap transition cursor-pointer ${
              statusFilter === status.slug
                ? 'bg-gray-900 text-white'
                : 'bg-surface-emphasis text-gray-600 active:bg-gray-200'
            }`}
          >
            {status.name}
            <span className="ml-1.5 opacity-60">{countByStatus(status.slug)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
