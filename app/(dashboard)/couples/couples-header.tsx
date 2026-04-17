'use client'

import { useEffect, useRef, useState } from 'react'
import { List, LayoutGrid, Plus, Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react'
import {
  Couple,
  CoupleStatusRecord,
  ViewMode,
  SortField,
  SortDirection,
  SORT_OPTIONS,
} from './couples-types'

interface CouplesHeaderProps {
  couples: Couple[]
  statuses: CoupleStatusRecord[]
  onAddClick: () => void
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
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)

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
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false)
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const countByStatus = (slug: string) =>
    couples.filter((c) => c.status === slug).length

  const hasActiveFilter = statusFilter !== 'all'

  return (
    <div>
      {/* Title + controls — flex-wrap so search drops to its own row on mobile */}
      <div className="flex items-center flex-wrap gap-x-1 gap-y-3">
        {/* Title */}
        <div className="flex items-baseline gap-3 flex-none sm:order-1">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Couples</h1>
          <span className="text-sm text-gray-400">{couples.length} total</span>
        </div>

        {/* Spacer — desktop only, pushes search + actions to the right */}
        <div className="hidden sm:block sm:flex-1 sm:order-2" />

        {/* Search — wraps to own full-width row on mobile, inline on desktop */}
        <div className="relative order-last w-full sm:order-3 sm:w-auto sm:mr-1">
          <Search size={15} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200"
          />
          {search && (
            <button
              onClick={() => {
                onSearchChange('')
                searchInputRef.current?.focus()
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto sm:ml-0 sm:order-4">
          {/* Sort — always visible */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
            >
              <ArrowUpDown size={16} strokeWidth={1.5} />
            </button>
            {sortOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-48 py-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={`${option.field}-${option.direction}`}
                    onClick={() => {
                      onSortChange(option.field, option.direction)
                      setSortOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      sortField === option.field && sortDirection === option.direction
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter dropdown — desktop only; chips handle filtering on mobile */}
          <div className="relative hidden sm:block" ref={filtersRef}>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`p-2 rounded-xl transition cursor-pointer ${
                hasActiveFilter
                  ? 'text-gray-900 bg-gray-100'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} />
            </button>
            {filtersOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-44 py-1">
                <button
                  onClick={() => {
                    onStatusFilterChange('all')
                    setFiltersOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-gray-50 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  All ({couples.length})
                </button>
                {statuses.map((status) => (
                  <button
                    key={status.slug}
                    onClick={() => {
                      onStatusFilterChange(status.slug)
                      setFiltersOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      statusFilter === status.slug
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {status.name} ({countByStatus(status.slug)})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* + New — desktop only; FAB handles mobile */}
          <button
            onClick={onAddClick}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-black rounded-xl hover:bg-neutral-800 transition ml-1 cursor-pointer"
          >
            <Plus size={14} strokeWidth={1.5} />
            New
          </button>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200 mt-6">
        <button
          onClick={() => onViewModeChange('list')}
          className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'list'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <List size={15} strokeWidth={1.5} /> List
        </button>
        <button
          onClick={() => onViewModeChange('kanban')}
          className={`pb-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'kanban'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <LayoutGrid size={15} strokeWidth={1.5} /> Board
        </button>
      </div>

      {/* Mobile status filter chips — replaces the filter dropdown on mobile; hidden on board view */}
      <div className={`sm:hidden overflow-x-auto flex gap-2 pt-3 -mx-6 px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${viewMode === 'kanban' ? 'hidden' : ''}`}>
        <button
          onClick={() => onStatusFilterChange('all')}
          className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          All
        </button>
        {statuses.map((status) => (
          <button
            key={status.slug}
            onClick={() => onStatusFilterChange(status.slug)}
            className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
              statusFilter === status.slug
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
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
